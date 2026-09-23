-- Rally Racing: three-lap race configuration.
-- Copy/paste this migration into the Supabase SQL editor.

create or replace function public.start_racing_game(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
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
        'checkpointCount', 5,
        'lapCount', 3,
        'results', '[]'::jsonb,
        'checkpoints', '{}'::jsonb,
        'laps', '{}'::jsonb,
        'start_time', null,
        'message', 'Get ready for Rally Racing!'
      ),
      state_version=state_version+1, updated_at=now()
  where id=p_room;
end $$;

grant execute on function public.start_racing_game(uuid) to authenticated;

-- The client reports finish only after checkpoint 5 on lap 3. This keeps the
-- existing action API compatible while storing the race configuration in state.
create or replace function public.play_racing_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; state jsonb; results jsonb; n int; finished_count int; finish_time float8; me public.game_players;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or (r.game_type <> 'racing' and r.game_type <> 'rally_racing') then raise exception 'Racing is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  state := coalesce(r.public_state, '{}'::jsonb); results := coalesce(state->'results', '[]'::jsonb);
  if p_action = 'start_race' then
    state := jsonb_set(state, '{stage}', '"racing"'::jsonb, true);
    state := jsonb_set(state, '{start_time}', to_jsonb(extract(epoch from now())::float8), true);
    state := jsonb_set(state, '{message}', '"GO!"'::jsonb, true);
  elsif p_action = 'finish' then
    if not exists(select 1 from jsonb_array_elements(results) elem where (elem->>'seat')::int = me.seat) then
      finish_time := p_value::float8; select count(*) into n from public.game_players where room_id=p_room; finished_count := jsonb_array_length(results) + 1;
      results := results || jsonb_build_object('seat', me.seat, 'player_id', me.player_id, 'position', finished_count, 'time', finish_time, 'finished_at', now());
      state := jsonb_set(state, '{results}', results, true);
      if finished_count >= n then r.status := 'completed'; state := jsonb_set(state, '{stage}', '"results"'::jsonb, true); state := jsonb_set(state, '{winnerSeat}', results->0->'seat', true); state := jsonb_set(state, '{message}', '"Race finished!"'::jsonb, true); end if;
    end if;
  elsif p_action = 'restart' or p_action = 'rematch' then
    if r.host_id = auth.uid() or p_actor_seat is not null then
      update public.game_players set is_ready = false where room_id = p_room; r.status := 'waiting';
      state := jsonb_build_object('stage','lobby','checkpointCount',5,'lapCount',3,'results','[]'::jsonb,'checkpoints','{}'::jsonb,'laps','{}'::jsonb,'start_time',null,'message','Ready for next race!');
    end if;
  else raise exception 'Invalid Racing action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status = 'completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

grant execute on function public.play_racing_action(uuid,text,text,integer) to anon, authenticated;
