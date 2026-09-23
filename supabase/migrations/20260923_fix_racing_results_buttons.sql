-- Rank by finish time, allow rematch after completed, keep 3-lap config.

create or replace function public.play_racing_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  results jsonb;
  n int;
  finished_count int;
  finish_time float8;
  sorted jsonb;
  winner_seat int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null then raise exception 'Room not found'; end if;
  if r.game_type not in ('racing', 'rally_racing') then raise exception 'Racing is not active'; end if;

  if p_action not in ('restart', 'rematch') and r.status <> 'playing' then
    raise exception 'Racing is not active';
  end if;
  if p_action in ('restart', 'rematch') and r.status not in ('playing', 'completed') then
    raise exception 'Cannot rematch from this room status';
  end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id = p_room and seat = p_actor_seat
      and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players
    where room_id = p_room and player_id = auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  results := coalesce(state->'results', '[]'::jsonb);

  if p_action = 'start_race' then
    state := jsonb_set(state, '{stage}', '"racing"'::jsonb, true);
    state := jsonb_set(state, '{start_time}', to_jsonb(extract(epoch from now())::float8), true);
    state := jsonb_set(state, '{message}', '"GO!"'::jsonb, true);

  elsif p_action = 'finish' then
    if not exists (
      select 1 from jsonb_array_elements(results) elem
      where (elem->>'seat')::int = me.seat
    ) then
      begin
        finish_time := greatest(0.01, p_value::float8);
      exception when others then
        finish_time := 9999;
      end;

      results := results || jsonb_build_object(
        'seat', me.seat,
        'player_id', me.player_id,
        'time', finish_time,
        'finished_at', now()
      );

      select coalesce(
        jsonb_agg(item.obj order by (item.obj->>'time')::float8 asc),
        '[]'::jsonb
      )
      into sorted
      from (
        select elem || jsonb_build_object(
          'position', row_number() over (order by (elem->>'time')::float8 asc)
        ) as obj
        from jsonb_array_elements(results) elem
      ) item;

      results := sorted;
      state := jsonb_set(state, '{results}', results, true);

      select count(*) into n from public.game_players where room_id = p_room;
      finished_count := jsonb_array_length(results);

      if finished_count >= n then
        r.status := 'completed';
        winner_seat := coalesce((results->0->>'seat')::int, me.seat);
        state := jsonb_set(state, '{stage}', '"results"'::jsonb, true);
        state := jsonb_set(state, '{winnerSeat}', to_jsonb(winner_seat), true);
        state := jsonb_set(state, '{message}', '"Race finished!"'::jsonb, true);
      end if;
    end if;

  elsif p_action = 'restart' or p_action = 'rematch' then
    if r.host_id is distinct from auth.uid() then
      raise exception 'Only the host can start a rematch';
    end if;
    update public.game_players set is_ready = true where room_id = p_room;
    r.status := 'playing';
    state := jsonb_build_object(
      'stage', 'countdown',
      'phase', 'countdown',
      'checkpointCount', 5,
      'lapCount', 3,
      'results', '[]'::jsonb,
      'checkpoints', '{}'::jsonb,
      'laps', '{}'::jsonb,
      'start_time', null,
      'winnerSeat', null,
      'message', 'Rematch! Get ready...'
    );

  else
    raise exception 'Invalid Racing action';
  end if;

  update public.game_rooms
  set public_state = state,
      status = r.status,
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room;

  if r.status = 'completed' then
    begin
      perform public.finalize_room(p_room, state, r.game_type);
    exception when others then
      null;
    end;
  end if;

  return state;
end;
$$;

grant execute on function public.play_racing_action(uuid, text, text, integer) to anon, authenticated;
