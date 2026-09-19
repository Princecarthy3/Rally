-- Existing room players must be able to refresh after the room starts.
create or replace function public.join_game_room(p_code text) returns text
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  v_seat int;
begin
  select * into r
  from public.game_rooms
  where code=upper(trim(p_code))
  for update;

  if exists(
    select 1 from public.game_players
    where room_id=r.id and player_id=auth.uid()
  ) then
    return r.code;
  end if;

  if r.id is null then raise exception 'Room not found'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  if (select count(*) from public.game_players where room_id=r.id) >= r.max_players then
    raise exception 'Room is full';
  end if;

  select s into v_seat
  from generate_series(1, r.max_players) s
  where not exists(
    select 1 from public.game_players
    where room_id=r.id and seat=s
  )
  order by s
  limit 1;

  insert into public.game_players(room_id, player_id, seat)
  values(r.id, auth.uid(), v_seat);
  return r.code;
end $$;

grant execute on function public.join_game_room(text) to authenticated;
