-- Remove spectator mode and restore room membership to players only.
create or replace function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.game_players
    where room_id=p_room and player_id=auth.uid()
  );
$$;

drop function if exists public.spectate_game_room(text);
drop function if exists public.leave_spectator_room(text);
drop function if exists public.get_active_friend_rooms();
drop table if exists public.game_spectators;
