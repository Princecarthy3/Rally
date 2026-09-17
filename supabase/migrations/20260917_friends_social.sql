-- Social data is deliberately isolated from Rally's room tables and RPCs.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);
create unique index if not exists friend_requests_pending_pair_idx on public.friend_requests
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status='pending';

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id), check (user_id <> friend_id)
);

create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '30 minutes'),
  check (sender_id <> receiver_id)
);
create unique index if not exists game_invites_pending_unique_idx on public.game_invites(sender_id,receiver_id,room_id) where status='pending';

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.game_invites enable row level security;
revoke all on public.friend_requests, public.friendships, public.game_invites from authenticated;
grant select on public.friend_requests, public.friendships, public.game_invites to authenticated;
create policy "social participants read friend requests" on public.friend_requests for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());
create policy "social participants read friendships" on public.friendships for select to authenticated using (user_id=auth.uid());
create policy "social participants read invites" on public.game_invites for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());

create or replace function public.social_search_players(p_query text) returns table(id uuid, display_name text, avatar_url text)
language sql security definer set search_path='' as $$
  select p.id,p.display_name,p.avatar_url from public.profiles p
  where p.id <> auth.uid() and (p.display_name ilike '%' || trim(p_query) || '%' or p.id::text ilike trim(p_query) || '%')
  order by p.display_name limit 20;
$$;

create or replace function public.send_friend_request(p_receiver uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_receiver=auth.uid() then raise exception 'You cannot add yourself'; end if;
  if not exists(select 1 from public.profiles where id=p_receiver) then raise exception 'Player not found'; end if;
  if exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You are already friends'; end if;
  if exists(select 1 from public.friend_requests where sender_id=p_receiver and receiver_id=auth.uid() and status='pending') then raise exception 'This player has already sent you a request'; end if;
  insert into public.friend_requests(sender_id,receiver_id) values(auth.uid(),p_receiver)
    on conflict do nothing;
end $$;

create or replace function public.respond_to_friend_request(p_request uuid,p_accept boolean) returns void
language plpgsql security definer set search_path='' as $$
declare req public.friend_requests;
begin
  select * into req from public.friend_requests where id=p_request for update;
  if req.id is null or req.receiver_id<>auth.uid() or req.status<>'pending' then raise exception 'Friend request is no longer available'; end if;
  update public.friend_requests set status=case when p_accept then 'accepted' else 'declined' end,updated_at=now() where id=req.id;
  if p_accept then
    insert into public.friendships(user_id,friend_id) values(req.sender_id,req.receiver_id),(req.receiver_id,req.sender_id) on conflict do nothing;
  end if;
end $$;

create or replace function public.remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path='' as $$
begin delete from public.friendships where (user_id=auth.uid() and friend_id=p_friend) or (user_id=p_friend and friend_id=auth.uid()); end $$;

create or replace function public.get_friends() returns table(id uuid,display_name text,avatar_url text,room_status text)
language sql security definer set search_path='' as $$
  select p.id,p.display_name,p.avatar_url,coalesce((select case when r.status='playing' then 'playing' else 'lobby' end from public.game_players gp join public.game_rooms r on r.id=gp.room_id where gp.player_id=p.id and r.status in ('waiting','playing') order by gp.joined_at desc limit 1),'offline')
  from public.friendships f join public.profiles p on p.id=f.friend_id where f.user_id=auth.uid() order by lower(p.display_name);
$$;

create or replace function public.get_social_relationships() returns table(player_id uuid, relationship text)
language sql security definer set search_path='' as $$
  select f.friend_id, 'friend'::text from public.friendships f where f.user_id=auth.uid()
  union all select fr.receiver_id, 'outgoing_request'::text from public.friend_requests fr where fr.sender_id=auth.uid() and fr.status='pending'
  union all select fr.sender_id, 'incoming_request'::text from public.friend_requests fr where fr.receiver_id=auth.uid() and fr.status='pending';
$$;

create or replace function public.send_game_invite(p_receiver uuid) returns void
language plpgsql security definer set search_path='' as $$
declare active_room public.game_rooms;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only invite friends'; end if;
  select r.* into active_room from public.game_rooms r join public.game_players gp on gp.room_id=r.id where r.host_id=auth.uid() and gp.player_id=auth.uid() and r.status='waiting' order by r.created_at desc limit 1;
  if active_room.id is null then raise exception 'Create or join a room first.'; end if;
  insert into public.game_invites(sender_id,receiver_id,room_id) values(auth.uid(),p_receiver,active_room.id) on conflict do nothing;
end $$;

create or replace function public.respond_to_game_invite(p_invite uuid,p_accept boolean) returns text
language plpgsql security definer set search_path='' as $$
declare invite public.game_invites; room_row public.game_rooms; room_code text;
begin
  select * into invite from public.game_invites where id=p_invite for update;
  if invite.id is null or invite.receiver_id<>auth.uid() or invite.status<>'pending' then raise exception 'Invitation is no longer available'; end if;
  select * into room_row from public.game_rooms where id=invite.room_id for update;
  if room_row.id is null or invite.expires_at<now() or room_row.host_id<>invite.sender_id or room_row.status<>'waiting' then update public.game_invites set status='expired',updated_at=now() where id=invite.id; raise exception 'This room is no longer available.'; end if;
  if not p_accept then update public.game_invites set status='declined',updated_at=now() where id=invite.id; return null; end if;
  room_code:=public.join_game_room(room_row.code);
  update public.game_invites set status='accepted',updated_at=now() where id=invite.id;
  return room_code;
end $$;

create or replace function public.get_social_inbox() returns table(kind text,id uuid,sender_id uuid,sender_name text,sender_avatar text,room_code text,created_at timestamptz)
language sql security definer set search_path='' as $$
  select 'friend',fr.id,fr.sender_id,p.display_name,p.avatar_url,null::text,fr.created_at from public.friend_requests fr join public.profiles p on p.id=fr.sender_id where fr.receiver_id=auth.uid() and fr.status='pending'
  union all
  select 'invite',gi.id,gi.sender_id,p.display_name,p.avatar_url,r.code,gi.created_at from public.game_invites gi join public.profiles p on p.id=gi.sender_id join public.game_rooms r on r.id=gi.room_id where gi.receiver_id=auth.uid() and gi.status='pending' and gi.expires_at>now()
  order by created_at desc;
$$;

grant execute on function public.social_search_players(text),public.send_friend_request(uuid),public.respond_to_friend_request(uuid,boolean),public.remove_friend(uuid),public.get_friends(),public.get_social_relationships(),public.send_game_invite(uuid),public.respond_to_game_invite(uuid,boolean),public.get_social_inbox() to authenticated;
do $$ begin alter publication supabase_realtime add table public.friend_requests; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.friendships; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_invites; exception when duplicate_object then null; end $$;
