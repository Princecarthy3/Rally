-- Fix racing: rank by finish time (not RPC order), allow rematch after completed,
-- and reset everyone into countdown lineup on rematch.

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
  checkpoints jsonb;
  player_cp int;
  cp_index int;
  n int;
  finished_count int;
  finish_time float8;
  sorted jsonb;
  winner_seat int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null then raise exception 'Room not found'; end if;
  if r.game_type not in ('racing', 'rally_racing') then raise exception 'Racing is not active'; end if;

  -- Rematch/restart allowed after the race completes; other actions need playing.
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
  checkpoints := coalesce(state->'checkpoints', '{}'::jsonb);

  if p_action = 'start_race' then
    state := jsonb_set(state, '{stage}', '"racing"'::jsonb, true);
    state := jsonb_set(state, '{start_time}', to_jsonb(extract(epoch from now())::float8), true);
    state := jsonb_set(state, '{message}', '"GO!"'::jsonb, true);

  elsif p_action = 'checkpoint' then
    cp_index := p_value::int;
    player_cp := coalesce((checkpoints->>me.seat::text)::int, 0);
    if cp_index = player_cp + 1 then
      checkpoints := jsonb_set(checkpoints, array[me.seat::text], to_jsonb(cp_index), true);
      state := jsonb_set(state, '{checkpoints}', checkpoints, true);
    end if;

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

      -- Rank by actual race time (ascending), not by who called finish first.
      select coalesce(jsonb_agg(item.obj order by (item.obj->>'time')::float8 asc), '[]'::jsonb)
      into sorted
      from (
        select elem || jsonb_build_object('position', row_number() over (order by (elem->>'time')::float8 asc)) as obj
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
    -- Only human host can rematch (bots use actor_seat for other actions).
    if r.host_id is distinct from auth.uid() then
      raise exception 'Only the host can start a rematch';
    end if;

    update public.game_players set is_ready = true where room_id = p_room;

    -- Jump everyone straight back into the countdown / starting lineup.
    r.status := 'playing';
    state := jsonb_build_object(
      'stage', 'countdown',
      'phase', 'countdown',
      'checkpointCount', 5,
      'results', '[]'::jsonb,
      'checkpoints', '{}'::jsonb,
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

  return state;
end;
$$;

grant execute on function public.play_racing_action(uuid, text, text, integer) to anon, authenticated;
