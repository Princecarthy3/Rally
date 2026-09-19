-- Friends-tab spectating: privacy flag, spectators table, RPCs, enriched friend status

-- Privacy: friends may spectate by default
alter table public.profiles
  add column if not exists allow_friends_spectate boolean not null default true;

-- Optional per-room override (host can disable for a room later)
alter table public.game_rooms
  add column if not exists allow_spectators boolean not null default true;

create table if not exists public.game_spectators (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  spectator_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, spectator_id)
);

alter table public.game_spectators enable row level security;

-- Members + spectators can read room/player rows
create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players
    where room_id = p_room and player_id = auth.uid()
  )
  or exists (
    select 1 from public.game_spectators
    where room_id = p_room and spectator_id = auth.uid()
  );
$$;

drop policy if exists "members read spectators" on public.game_spectators;
create policy "members read spectators"
  on public.game_spectators for select to authenticated
  using (public.is_room_member(room_id));

grant select on public.game_spectators to authenticated;

-- Toggle privacy setting
create or replace function public.set_allow_friends_spectate(p_allow boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.profiles
     set allow_friends_spectate = coalesce(p_allow, true),
         updated_at = now()
   where id = auth.uid();
end;
$$;

grant execute on function public.set_allow_friends_spectate(boolean) to authenticated;

-- Enriched friends list for Friends tab
drop function if exists public.get_friends();
create function public.get_friends()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  room_status text,
  game_type text,
  room_code text,
  allow_spectate boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    coalesce(
      (
        select case when r.status = 'playing' then 'playing' else 'lobby' end
        from public.game_players gp
        join public.game_rooms r on r.id = gp.room_id
        where gp.player_id = p.id
          and r.status in ('waiting', 'playing')
          and r.expires_at > now()
        order by gp.joined_at desc
        limit 1
      ),
      'offline'
    ) as room_status,
    (
      select r.game_type
      from public.game_players gp
      join public.game_rooms r on r.id = gp.room_id
      where gp.player_id = p.id
        and r.status in ('waiting', 'playing')
        and r.expires_at > now()
      order by gp.joined_at desc
      limit 1
    ) as game_type,
    (
      select r.code
      from public.game_players gp
      join public.game_rooms r on r.id = gp.room_id
      where gp.player_id = p.id
        and r.status in ('waiting', 'playing')
        and r.expires_at > now()
      order by gp.joined_at desc
      limit 1
    ) as room_code,
    coalesce(p.allow_friends_spectate, true)
      and coalesce(
        (
          select r.allow_spectators
          from public.game_players gp
          join public.game_rooms r on r.id = gp.room_id
          where gp.player_id = p.id
            and r.status in ('waiting', 'playing')
            and r.expires_at > now()
          order by gp.joined_at desc
          limit 1
        ),
        true
      ) as allow_spectate
  from public.friendships f
  join public.profiles p on p.id = f.friend_id
  where f.user_id = auth.uid()
  order by lower(p.display_name);
$$;

grant execute on function public.get_friends() to authenticated;

-- Active friend rooms (for live hub / realtime refresh helpers)
drop function if exists public.get_active_friend_rooms();
create function public.get_active_friend_rooms()
returns table (
  room_code text,
  game_type text,
  status text,
  host_id uuid,
  friend_id uuid,
  friend_name text,
  friend_avatar text,
  player_count int,
  max_players int,
  allow_spectate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select distinct
    r.code,
    r.game_type,
    r.status,
    r.host_id,
    playing.player_id,
    fp.display_name,
    fp.avatar_url,
    (select count(*)::int from public.game_players gp where gp.room_id = r.id),
    r.max_players,
    (coalesce(fp.allow_friends_spectate, true) and coalesce(r.allow_spectators, true))
  from public.game_rooms r
  join public.game_players playing on playing.room_id = r.id
  join public.profiles fp on fp.id = playing.player_id
  join public.friendships f
    on (f.user_id = auth.uid() and f.friend_id = playing.player_id)
    or (f.friend_id = auth.uid() and f.user_id = playing.player_id)
  where r.status in ('waiting', 'playing')
    and r.expires_at > now()
    and playing.player_id <> auth.uid();
end;
$$;

grant execute on function public.get_active_friend_rooms() to authenticated;

-- Join as spectator (read-only)
create or replace function public.spectate_game_room(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.game_rooms;
  friend_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select * into r
  from public.game_rooms
  where code = upper(trim(p_code));

  if r.id is null then raise exception 'Room not found'; end if;
  if r.status not in ('waiting', 'playing') then raise exception 'This game is not active'; end if;
  if r.expires_at <= now() then raise exception 'This room has expired'; end if;
  if not coalesce(r.allow_spectators, true) then
    raise exception 'Spectating is disabled for this room';
  end if;

  -- Already a player? Just return the code (they play, not spectate)
  if exists (
    select 1 from public.game_players
    where room_id = r.id and player_id = auth.uid()
  ) then
    return r.code;
  end if;

  -- Must be friends with at least one player who allows spectating
  select exists (
    select 1
    from public.game_players gp
    join public.profiles p on p.id = gp.player_id
    join public.friendships f
      on (f.user_id = auth.uid() and f.friend_id = gp.player_id)
      or (f.friend_id = auth.uid() and f.user_id = gp.player_id)
    where gp.room_id = r.id
      
      and coalesce(p.allow_friends_spectate, true)
  ) into friend_ok;

  if not friend_ok then
    raise exception 'You can only spectate friends who allow it';
  end if;

  insert into public.game_spectators (room_id, spectator_id)
  values (r.id, auth.uid())
  on conflict (room_id, spectator_id) do update set joined_at = now();

  return r.code;
end;
$$;

grant execute on function public.spectate_game_room(text) to authenticated;

create or replace function public.leave_spectator_room(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room uuid;
begin
  if auth.uid() is null then return; end if;
  select id into v_room from public.game_rooms where code = upper(trim(p_code));
  if v_room is not null then
    delete from public.game_spectators
    where room_id = v_room and spectator_id = auth.uid();
  end if;
end;
$$;

grant execute on function public.leave_spectator_room(text) to authenticated;

-- Realtime for spectators table
do $$ begin
  alter publication supabase_realtime add table public.game_spectators;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.game_players;
exception when duplicate_object then null;
end $$;
