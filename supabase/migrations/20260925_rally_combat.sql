-- Rally Combat 3D Arena Brawler Migration

alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;

-- Normalize any legacy/test rows that violate the check constraint:
update public.game_rooms
set game_type = 'racing'
where game_type not in (
  'basketball','dice_dash','trivia_clash','uno',
  'rps','number_guess','memory_match','mini_golf','battleship',
  'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
  'racing','rally_racing','rally_combat','combat'
) or game_type is null;

alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
    'racing','rally_racing','rally_combat','combat'
  ));

create or replace function public.create_game_room(p_game_type text, p_max_players int default 2)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_room uuid;
  v_max int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_game_type not in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
    'racing','rally_racing','rally_combat','combat'
  ) then
    raise exception 'Unknown game: %', p_game_type;
  end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship','basketball') then 2
    when p_game_type in ('racing','rally_racing','rally_combat','combat') then greatest(2, least(4, coalesce(p_max_players, 4)))
    else greatest(2, least(4, coalesce(p_max_players, 2)))
  end;

  loop
    v_code := public.random_room_code();
    exit when not exists(select 1 from public.game_rooms where code = v_code);
  end loop;

  insert into public.game_rooms(code, game_type, host_id, max_players, status, public_state)
  values (v_code, p_game_type, auth.uid(), v_max, 'waiting', '{}'::jsonb)
  returning id into v_room;

  insert into public.game_players(room_id, player_id, seat, is_ready)
  values (v_room, auth.uid(), 1, false);

  return v_code;
end;
$$;

grant execute on function public.create_game_room(text, int) to authenticated;

-- Start Rally Combat RPC
create or replace function public.start_rally_combat_game(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n < 1 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then
    raise exception 'Everyone must be ready';
  end if;

  update public.game_rooms
  set status='playing',
      public_state=jsonb_build_object(
        'stage','countdown',
        'arena', 'rally_rooftop',
        'results', '[]'::jsonb,
        'eliminations', '[]'::jsonb,
        'start_time', null,
        'message', '3D Arena Combat starting!'
      ),
      state_version=state_version+1, updated_at=now()
  where id=p_room;
end $$;

grant execute on function public.start_rally_combat_game(uuid) to authenticated;

-- Play Rally Combat Action RPC
create or replace function public.play_rally_combat_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  results jsonb;
  eliminations jsonb;
  n int;
  finished_count int;
  target_seat int;
  damage_amount float8;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or (r.game_type <> 'rally_combat' and r.game_type <> 'combat') then
    raise exception 'Rally Combat is not active';
  end if;
  
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  
  if me.id is null then raise exception 'Not a player in this match'; end if;
  
  state := coalesce(r.public_state, '{}'::jsonb);
  results := coalesce(state->'results', '[]'::jsonb);
  eliminations := coalesce(state->'eliminations', '[]'::jsonb);

  if p_action = 'start_fight' then
    state := jsonb_set(state, '{stage}', '"fighting"'::jsonb, true);
    state := jsonb_set(state, '{start_time}', to_jsonb(extract(epoch from now())::float8), true);
    state := jsonb_set(state, '{message}', '"FIGHT!"'::jsonb, true);

  elsif p_action = 'eliminate_player' then
    target_seat := coalesce(p_value::int, me.seat);
    if not exists(select 1 from jsonb_array_elements(eliminations) elem where (elem->>'seat')::int = target_seat) then
      select count(*) into n from public.game_players where room_id=p_room;
      
      eliminations := eliminations || jsonb_build_object(
        'seat', target_seat,
        'eliminated_by', me.seat,
        'eliminated_at', now()
      );
      state := jsonb_set(state, '{eliminations}', eliminations, true);

      -- Check if 1 or 0 players remain alive
      if jsonb_array_length(eliminations) >= n - 1 then
        r.status := 'completed';
        state := jsonb_set(state, '{stage}', '"results"'::jsonb, true);
        
        -- Winner is the non-eliminated player seat (or me if all eliminated)
        select seat into target_seat from public.game_players where room_id=p_room and seat not in (
          select (elem->>'seat')::int from jsonb_array_elements(eliminations) elem
        ) limit 1;

        if target_seat is null then target_seat := me.seat; end if;

        state := jsonb_set(state, '{winnerSeat}', to_jsonb(target_seat), true);
        state := jsonb_set(state, '{message}', '"Match Over - Winner Decided!"'::jsonb, true);
      end if;
    end if;

  elsif p_action = 'restart' or p_action = 'rematch' then
    if r.host_id = auth.uid() or p_actor_seat is not null then
      update public.game_players set is_ready = false where room_id = p_room;
      r.status := 'waiting';
      state := jsonb_build_object(
        'stage', 'lobby',
        'arena', 'rally_rooftop',
        'results', '[]'::jsonb,
        'eliminations', '[]'::jsonb,
        'start_time', null,
        'message', 'Ready for next fight!'
      );
    end if;
  end if;

  update public.game_rooms set public_state=state, status=r.status, state_version=state_version+1, updated_at=now() where id=p_room;
  if r.status = 'completed' then perform public.finalize_room(p_room, state, r.game_type); end if;
  return state;
end $$;

grant execute on function public.play_rally_combat_action(uuid,text,text,integer) to anon, authenticated;

-- Rally Combat Stats & Match History Tables
create table if not exists public.rally_combat_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.game_rooms(id) on delete cascade,
  winner_seat int,
  duration_seconds float8,
  created_at timestamp with time zone default now()
);

create table if not exists public.rally_combat_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  matches_played int default 0,
  wins int default 0,
  eliminations int default 0,
  total_damage_dealt float8 default 0,
  total_damage_received float8 default 0,
  highest_combo int default 0,
  favorite_character text default 'balanced',
  updated_at timestamp with time zone default now()
);

alter table public.rally_combat_matches enable row level security;
alter table public.rally_combat_stats enable row level security;

create policy "Matches are readable by everyone" on public.rally_combat_matches for select using (true);
create policy "Stats are readable by everyone" on public.rally_combat_stats for select using (true);
create policy "Stats updateable by owners" on public.rally_combat_stats for all using (auth.uid() = user_id);
