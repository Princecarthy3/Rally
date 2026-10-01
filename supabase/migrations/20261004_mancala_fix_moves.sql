-- Fix Mancala sowing: reliably read/write pit arrays and avoid false "empty pit".

create or replace function private.mancala_side_to_ints(side jsonb)
returns int[]
language sql
immutable
set search_path = ''
as $$
  select array[
    coalesce((side->>0)::int, (side->>'0')::int, 0),
    coalesce((side->>1)::int, (side->>'1')::int, 0),
    coalesce((side->>2)::int, (side->>'2')::int, 0),
    coalesce((side->>3)::int, (side->>'3')::int, 0),
    coalesce((side->>4)::int, (side->>'4')::int, 0),
    coalesce((side->>5)::int, (side->>'5')::int, 0)
  ];
$$;

create or replace function private.mancala_ints_to_side(arr int[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    coalesce(arr[1], 0),
    coalesce(arr[2], 0),
    coalesce(arr[3], 0),
    coalesce(arr[4], 0),
    coalesce(arr[5], 0),
    coalesce(arr[6], 0)
  );
$$;

create or replace function public.play_mancala_action(
  p_room uuid,
  p_pit integer,
  p_expected_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  pits jsonb;
  stores jsonb;
  side1 int[];
  side2 int[];
  store1 int;
  store2 int;
  stones int;
  cursor_seat int;
  cursor_pit int;
  player_seat int;
  opposite_seat int;
  opposite_pit int;
  opposite_stones int;
  captured int := 0;
  path jsonb := '[]'::jsonb;
  last_type text;
  last_seat int;
  last_pit int;
  extra_turn boolean := false;
  side_empty boolean;
  seat_to_sweep int;
  remaining int;
  now_ts timestamptz := clock_timestamp();
  version_after bigint;
  winner int;
  result_status text := 'playing';
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'mancala' then raise exception 'Mancala game not found'; end if;
  if r.status <> 'playing' then raise exception 'Game is not active'; end if;
  if p_expected_version is null or p_expected_version <> r.state_version then
    raise exception 'Game state changed. Refresh and try again.';
  end if;

  select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  if me.id is null then raise exception 'You are not a player in this room'; end if;
  if me.seat not in (1, 2) then raise exception 'Invalid Mancala seat'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  if coalesce(state->>'status', 'playing') = 'completed' then
    raise exception 'Game is not active';
  end if;

  -- Soft-expire: still allow move if deadline just passed by a few seconds to avoid race with client timer
  if coalesce((state->>'turnDeadline')::timestamptz, now_ts) < now_ts - interval '2 seconds' then
    raise exception 'Turn expired. The next turn is loading.';
  end if;

  if coalesce((state->>'turn')::int, 0) <> me.seat then
    raise exception 'Wait for your turn';
  end if;

  if p_pit is null or p_pit < 0 or p_pit > 5 then
    raise exception 'Invalid pit';
  end if;

  pits := coalesce(state->'pits', '{}'::jsonb);
  stores := coalesce(state->'stores', '{}'::jsonb);

  side1 := private.mancala_side_to_ints(coalesce(pits->'1', pits->1, '[]'::jsonb));
  side2 := private.mancala_side_to_ints(coalesce(pits->'2', pits->2, '[]'::jsonb));
  store1 := coalesce((stores->>'1')::int, (stores->'1')::int, 0);
  store2 := coalesce((stores->>'2')::int, (stores->'2')::int, 0);

  player_seat := me.seat;
  opposite_seat := case when player_seat = 1 then 2 else 1 end;

  -- p_pit is 0-based; PostgreSQL arrays are 1-based
  if player_seat = 1 then
    stones := side1[p_pit + 1];
  else
    stones := side2[p_pit + 1];
  end if;

  if coalesce(stones, 0) <= 0 then
    raise exception 'That pit is empty';
  end if;

  if player_seat = 1 then
    side1[p_pit + 1] := 0;
  else
    side2[p_pit + 1] := 0;
  end if;

  cursor_seat := player_seat;
  cursor_pit := p_pit;

  while stones > 0 loop
    if cursor_seat = player_seat then
      if cursor_pit < 5 then
        cursor_pit := cursor_pit + 1;
        if cursor_seat = 1 then
          side1[cursor_pit + 1] := side1[cursor_pit + 1] + 1;
        else
          side2[cursor_pit + 1] := side2[cursor_pit + 1] + 1;
        end if;
        path := path || jsonb_build_array(jsonb_build_object('type', 'pit', 'seat', cursor_seat, 'index', cursor_pit));
        last_type := 'pit';
        last_seat := cursor_seat;
        last_pit := cursor_pit;
        stones := stones - 1;
      else
        -- reach own store
        if player_seat = 1 then store1 := store1 + 1; else store2 := store2 + 1; end if;
        path := path || jsonb_build_array(jsonb_build_object('type', 'store', 'seat', player_seat));
        last_type := 'store';
        last_seat := player_seat;
        last_pit := null;
        stones := stones - 1;
        -- after store, continue on opponent side from pit 0
        cursor_seat := opposite_seat;
        cursor_pit := -1;
      end if;
    else
      -- opponent side: sow pits 0..5, skip opponent store
      if cursor_pit < 5 then
        cursor_pit := cursor_pit + 1;
        if cursor_seat = 1 then
          side1[cursor_pit + 1] := side1[cursor_pit + 1] + 1;
        else
          side2[cursor_pit + 1] := side2[cursor_pit + 1] + 1;
        end if;
        path := path || jsonb_build_array(jsonb_build_object('type', 'pit', 'seat', cursor_seat, 'index', cursor_pit));
        last_type := 'pit';
        last_seat := cursor_seat;
        last_pit := cursor_pit;
        stones := stones - 1;
      else
        -- leave opponent side back to own pits
        cursor_seat := player_seat;
        cursor_pit := -1;
      end if;
    end if;
  end loop;

  -- Capture: last stone in own empty pit, opposite has stones
  if last_type = 'pit' and last_seat = player_seat and last_pit is not null then
    if player_seat = 1 then
      if side1[last_pit + 1] = 1 then
        opposite_pit := 5 - last_pit;
        opposite_stones := side2[opposite_pit + 1];
        if opposite_stones > 0 then
          captured := opposite_stones + 1;
          side1[last_pit + 1] := 0;
          side2[opposite_pit + 1] := 0;
          store1 := store1 + captured;
        end if;
      end if;
    else
      if side2[last_pit + 1] = 1 then
        opposite_pit := 5 - last_pit;
        opposite_stones := side1[opposite_pit + 1];
        if opposite_stones > 0 then
          captured := opposite_stones + 1;
          side2[last_pit + 1] := 0;
          side1[opposite_pit + 1] := 0;
          store2 := store2 + captured;
        end if;
      end if;
    end if;
  end if;

  extra_turn := (last_type = 'store' and last_seat = player_seat);

  -- End game if either side empty
  side_empty := false;
  for seat_to_sweep in 1..2 loop
    if seat_to_sweep = 1 then
      side_empty := (side1[1]+side1[2]+side1[3]+side1[4]+side1[5]+side1[6]) = 0;
    else
      side_empty := (side2[1]+side2[2]+side2[3]+side2[4]+side2[5]+side2[6]) = 0;
    end if;
    if side_empty then
      if seat_to_sweep = 1 then
        remaining := side2[1]+side2[2]+side2[3]+side2[4]+side2[5]+side2[6];
        store2 := store2 + remaining;
        side2 := array[0,0,0,0,0,0];
      else
        remaining := side1[1]+side1[2]+side1[3]+side1[4]+side1[5]+side1[6];
        store1 := store1 + remaining;
        side1 := array[0,0,0,0,0,0];
      end if;
      result_status := 'completed';
      exit;
    end if;
  end loop;

  pits := jsonb_build_object(
    '1', private.mancala_ints_to_side(side1),
    '2', private.mancala_ints_to_side(side2)
  );
  stores := jsonb_build_object('1', store1, '2', store2);

  state := state || jsonb_build_object(
    'pits', pits,
    'stores', stores,
    'moveNumber', coalesce((state->>'moveNumber')::int, 0) + 1,
    'lastMove', jsonb_build_object(
      'seat', player_seat,
      'pit', p_pit,
      'path', path,
      'captured', captured,
      'extraTurn', extra_turn,
      'at', now_ts
    ),
    'scores', stores
  );

  if result_status = 'completed' then
    winner := case
      when store1 > store2 then 1
      when store2 > store1 then 2
      else null
    end;
    state := state || jsonb_build_object(
      'status', 'completed',
      'turn', player_seat,
      'winnerSeat', winner,
      'message', case
        when winner is null then 'It''s a draw!'
        else format('Player %s wins!', winner)
      end
    );
  else
    state := state || jsonb_build_object(
      'status', 'playing',
      'turn', case when extra_turn then player_seat else opposite_seat end,
      'turnDeadline', (now_ts + interval '30 seconds'),
      'message', case
        when extra_turn then format('Player %s landed in their store — play again!', player_seat)
        when captured > 0 then format('Player %s captured %s stones.', player_seat, captured)
        else format('Player %s sowed. Player %s to move.', player_seat, case when extra_turn then player_seat else opposite_seat end)
      end
    );
  end if;

  update public.game_rooms
  set public_state = state,
      status = case when result_status = 'completed' then 'completed' else 'playing' end,
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room
  returning state_version into version_after;

  if result_status = 'completed' then
    perform public.finalize_room(p_room, state, 'mancala');
  end if;

  return jsonb_build_object(
    'public_state', state,
    'status', case when result_status = 'completed' then 'completed' else 'playing' end,
    'state_version', version_after
  );
end;
$$;

grant execute on function public.play_mancala_action(uuid, integer, bigint) to authenticated;

notify pgrst, 'reload schema';
