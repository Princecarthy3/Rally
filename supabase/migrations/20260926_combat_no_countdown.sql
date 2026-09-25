-- Rally Combat: skip countdown and start fighting immediately.

create or replace function public.start_rally_combat_game(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.game_rooms; n int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id = p_room;
  if n < 1 or exists(select 1 from public.game_players where room_id = p_room and not is_ready) then
    raise exception 'Everyone must be ready';
  end if;

  update public.game_rooms
  set status = 'playing',
      public_state = jsonb_build_object(
        'stage', 'fighting',
        'phase', 'combat',
        'arena', 'rally_rooftop',
        'results', '[]'::jsonb,
        'eliminations', '[]'::jsonb,
        'start_time', extract(epoch from now())::float8,
        'message', 'Fight!'
      ),
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room;
end;
$$;

grant execute on function public.start_rally_combat_game(uuid) to authenticated;
