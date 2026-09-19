-- Expose active rooms for every friend who is playing, not only room hosts.
drop function if exists public.get_active_friend_rooms();

create function public.get_active_friend_rooms() returns table (
  room_code text,
  game_type text,
  status text,
  host_id uuid,
  friend_id uuid,
  host_name text,
  host_avatar text,
  player_count int,
  max_players int
) language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select distinct
    r.code,
    r.game_type,
    r.status,
    r.host_id,
    fp.id,
    hp.display_name,
    hp.avatar_url,
    (select count(*)::int from public.game_players gp where gp.room_id=r.id),
    r.max_players
  from public.game_rooms r
  join public.game_players playing on playing.room_id=r.id
  join public.profiles fp on fp.id=playing.player_id
  join public.profiles hp on hp.id=r.host_id
  join public.friendships f
    on (f.user_id=auth.uid() and f.friend_id=playing.player_id)
    or (f.friend_id=auth.uid() and f.user_id=playing.player_id)
  where f.status='accepted'
    and r.status in ('waiting','playing')
    and r.expires_at > now()
    and playing.player_id <> auth.uid();
end $$;

grant execute on function public.get_active_friend_rooms() to authenticated;
