-- Fix RLS Policies for game_rooms, game_players, and game_spectators for Realtime event delivery
drop policy if exists "members read rooms" on public.game_rooms;
drop policy if exists "authenticated read rooms" on public.game_rooms;
create policy "authenticated read rooms" on public.game_rooms for select to authenticated using(true);

drop policy if exists "members read players" on public.game_players;
drop policy if exists "authenticated read players" on public.game_players;
create policy "authenticated read players" on public.game_players for select to authenticated using(true);

drop policy if exists "members read spectators" on public.game_spectators;
drop policy if exists "authenticated read spectators" on public.game_spectators;
create policy "authenticated read spectators" on public.game_spectators for select to authenticated using(true);

grant select on public.game_rooms to authenticated;
grant select on public.game_players to authenticated;
grant select on public.game_spectators to authenticated;

-- Prevent inviting friends when room is full
create or replace function public.send_game_invite_to_room(p_receiver uuid, p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target_room public.game_rooms; p_count int;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only invite friends'; end if;
  select r.* into target_room from public.game_rooms r join public.game_players gp on gp.room_id=r.id where r.id=p_room and gp.player_id=auth.uid() and r.status='waiting' limit 1;
  if target_room.id is null then raise exception 'This room is not available for invite or you are not in it.'; end if;
  select count(*) into p_count from public.game_players where room_id=p_room;
  if p_count >= target_room.max_players then raise exception 'Room is full'; end if;
  insert into public.game_invites(sender_id,receiver_id,room_id) values(auth.uid(),p_receiver,target_room.id) on conflict do nothing;
end $$;

create or replace function public.send_game_invite(p_receiver uuid) returns void
language plpgsql security definer set search_path='' as $$
declare active_room public.game_rooms; p_count int;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only invite friends'; end if;
  select r.* into active_room from public.game_rooms r join public.game_players gp on gp.room_id=r.id where gp.player_id=auth.uid() and r.status='waiting' order by r.created_at desc limit 1;
  if active_room.id is null then raise exception 'Create or join a room first.'; end if;
  select count(*) into p_count from public.game_players where room_id=active_room.id;
  if p_count >= active_room.max_players then raise exception 'Room is full'; end if;
  insert into public.game_invites(sender_id,receiver_id,room_id) values(auth.uid(),p_receiver,active_room.id) on conflict do nothing;
end $$;

grant execute on function public.send_game_invite_to_room(uuid, uuid) to authenticated;
grant execute on function public.send_game_invite(uuid) to authenticated;
