-- Fix Mancala moves: reliable pit stone counts + stable state updates.
-- Prior versions could mis-read pit arrays after nested jsonb_set paths.

create or replace function private.mancala_side_array(p_pits jsonb, p_seat int)
returns int[]
language plpgsql
immutable
set search_path = public
as $$
declare
  side jsonb;
  result int[] := array[0,0,0,0,0,0];
  i int;
  v text;
begin
  if p_pits is null then return result; end if;
  side := p_pits -> p_seat::text;
  if side is null then
    side := p_pits -> (p_seat - 1)::text; -- tolerate 0-based seats if ever present
  end if;
  if side is null then return result; end if;

  if jsonb_typeof(side) = 'array' then
    for i in 0..5 loop
      v := side ->> i;
      result[i + 1] := coalesce(v::int, 0);
    end loop;
  elsif jsonb_typeof(side) = 'object' then
    for i in 0..5 loop
      v := coalesce(side ->> i::text, side ->> (i + 1)::text, '0');
      result[i + 1] := coalesce(v::int, 0);
    end loop;
  end if;
  return result;
end;
$$;

create or replace function private.mancala_pits_json(p1 int[], p2 int[])
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    '1', to_jsonb(p1),
    '2', to_jsonb(p2)
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
  stores jsonb;
  side1 int[];
  side2 int[];
  my_side int[];
  opp_side int[];
  stones int;
  cursor_seat int;
  cursor_pit int;
  player_seat int;
  opposite_seat int;
  opposite_pit int;
  opposite_stones int;
  captured int := 0;
  path jsonb := '[]'::jsonb;
  last_destination jsonb;
  last_type text;
  last_seat int;
  last_pit int;
  extra_turn boolean := false;
  result_status text := 'playing';
  version_after bigint;
  next_seat int;
  side_empty boolean;
  remaining int;
  i int;
  deadline timestamptz;
  deadline_raw text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'mancala' then raise exception 'Mancala game not found'; end if;
  if r.status <> 'playing' then raise exception 'Game is not active'; end if;

  -- Soft version check: allow same or +0 drift by re-reading locked row
  if p_expected_version is not null and p_expected_version <> r.state_version then
    raise exception 'Game state changed. Refresh and try again.';
  end if;

  select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  if me.id is null then raise exception 'You are not a player in this room'; end if;
  if me.seat not in (1, 2) then raise exception 'Invalid Mancala seat'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  if coalesce((state->>'status'), 'playing') = 'completed' then
    raise exception 'Game is not active';
  end if;

  if coalesce((state->>'turn')::int, 0) <> me.seat then
    raise exception 'Wait for your turn';
  end if;

  deadline_raw := state->>'turnDeadline';
  if deadline_raw is not null and length(trim(deadline_raw)) > 0 then
    begin
      deadline := deadline_raw::timestamptz;
    exception when others then
      deadline := null;
    end;
    -- Only block if clearly expired by >2s (clock skew tolerance)
    if deadline is not null and deadline < (now() - interval '2 seconds') then
      raise exception 'Turn expired. The next turn is loading.';
    end if;
  end if;

  if p_pit is null or p_pit < 0 or p_pit > 5 then
    raise exception 'Invalid pit';
  end if;

  side1 := private.mancala_side_array(state->'pits', 1);
  side2 := private.mancala_side_array(state->'pits', 2);
  stores := coalesce(state->'stores', '{"1":0,"2":0}'::jsonb);

  player_seat := me.seat;
  opposite_seat := case when player_seat = 1 then 2 else 1 end;
  my_side := case when player_seat = 1 then side1 else side2 end;
  opp_side := case when player_seat = 1 then side2 else side1 end;

  stones := my_side[p_pit + 1];
  if stones is null or stones <= 0 then
    raise exception 'That pit is empty';
  end if;

  my_side[p_pit + 1] := 0;
  cursor_seat := player_seat;
  cursor_pit := p_pit;

  while stones > 0 loop
    if cursor_seat = player_seat then
      if cursor_pit < 5 then
        cursor_pit := cursor_pit + 1;
        my_side[cursor_pit + 1] := my_side[cursor_pit + 1] + 1;
        last_destination := jsonb_build_object('type', 'pit', 'seat', cursor_seat, 'index', cursor_pit);
      else
        -- land in own store
        stores := jsonb_set(
          stores,
          array[player_seat::text],
          to_jsonb(coalesce((stores ->> player_seat::text)::int, 0) + 1),
          true
        );
        last_destination := jsonb_build_object('type', 'store', 'seat', player_seat);
        -- next continues on opponent side from their pit 0
        cursor_seat := opposite_seat;
        cursor_pit := -1;
      end if;
    else
      -- sowing on opponent side: pits 0..5 only (never opponent store)
      if cursor_pit < 5 then
        cursor_pit := cursor_pit + 1;
        opp_side[cursor_pit + 1] := opp_side[cursor_pit + 1] + 1;
        last_destination := jsonb_build_object('type', 'pit', 'seat', cursor_seat, 'index', cursor_pit);
      else
        -- after opponent's last pit, return to own side pit 0
        cursor_seat := player_seat;
        cursor_pit := 0;
        my_side[1] := my_side[1] + 1;
        last_destination := jsonb_build_object('type', 'pit', 'seat', cursor_seat, 'index', 0);
      end if;
    end if;

    path := path || jsonb_build_array(last_destination);
    stones := stones - 1;
  end loop;

  -- Capture: last stone in empty own pit, opposite has stones
  last_type := last_destination ->> 'type';
  last_seat := (last_destination ->> 'seat')::int;
  if last_type = 'store' then
    extra_turn := last_seat = player_seat;
  elsif last_seat = player_seat then
    last_pit := (last_destination ->> 'index')::int;
    opposite_pit := 5 - last_pit;
    if my_side[last_pit + 1] = 1 then
      opposite_stones := opp_side[opposite_pit + 1];
      if opposite_stones > 0 then
        captured := opposite_stones + 1;
        my_side[last_pit + 1] := 0;
        opp_side[opposite_pit + 1] := 0;
        stores := jsonb_set(
          stores,
          array[player_seat::text],
          to_jsonb(coalesce((stores ->> player_seat::text)::int, 0) + captured),
          true
        );
      end if;
    end if;
  end if;

  -- Write sides back
  if player_seat = 1 then
    side1 := my_side;
    side2 := opp_side;
  else
    side2 := my_side;
    side1 := opp_side;
  end if;

  -- End game if either side empty
  side_empty := true;
  for i in 1..6 loop
    if side1[i] <> 0 then side_empty := false; exit; end if;
  end loop;
  if not side_empty then
    side_empty := true;
    for i in 1..6 loop
      if side2[i] <> 0 then side_empty := false; exit; end if;
    end loop;
  end if;

  if side_empty then
    remaining := 0;
    for i in 1..6 loop remaining := remaining + side1[i]; side1[i] := 0; end loop;
    stores := jsonb_set(stores, array['1'], to_jsonb(coalesce((stores ->> '1')::int, 0) + remaining), true);
    remaining := 0;
    for i in 1..6 loop remaining := remaining + side2[i]; side2[i] := 0; end loop;
    stores := jsonb_set(stores, array['2'], to_jsonb(coalesce((stores ->> '2')::int, 0) + remaining), true);
    result_status := 'completed';
  end if;

  if extra_turn and result_status = 'playing' then
    next_seat := player_seat;
  else
    next_seat := opposite_seat;
  end if;

  state := state
    || jsonb_build_object(
      'pits', private.mancala_pits_json(side1, side2),
      'stores', stores,
      'scores', stores,
      'turn', next_seat,
      'moveNumber', coalesce((state ->> 'moveNumber')::int, 0) + 1,
      'lastMove', jsonb_build_object(
        'seat', player_seat,
        'pit', p_pit,
        'path', path,
        'captured', captured,
        'extraTurn', extra_turn,
        'at', now()
      ),
      'turnDeadline', (now() + interval '30 seconds')::text,
      'status', result_status,
      'message', case
        when result_status = 'completed' then
          case
            when (stores ->> '1')::int = (stores ->> '2')::int then 'It''s a draw!'
            when (stores ->> '1')::int > (stores ->> '2')::int then 'Player 1 wins!'
            else 'Player 2 wins!'
          end
        when extra_turn then 'Extra turn!'
        else 'Player ' || next_seat || '''s turn.'
      end,
      'winnerSeat', case
        when result_status <> 'completed' then null
        when (stores ->> '1')::int = (stores ->> '2')::int then null
        when (stores ->> '1')::int > (stores ->> '2')::int then 1
        else 2
      end,
      'rematchRequests', '[]'::jsonb
    );

  update public.game_rooms
  set public_state = state,
      status = case when result_status = 'completed' then 'completed' else 'playing' end,
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room
  returning state_version into version_after;

  if result_status = 'completed' then
    begin
      perform public.finalize_room(p_room, state, 'mancala');
    exception when others then
      null; -- optional scoring hook
    end;
  end if;

  return jsonb_build_object(
    'public_state', state,
    'status', case when result_status = 'completed' then 'completed' else 'playing' end,
    'state_version', version_after
  );
end;
$$;

grant execute on function public.play_mancala_action(uuid, integer, bigint) to authenticated;

-- Keep initial state format consistent
create or replace function private.mancala_initial_state(p_now timestamptz)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'pits', jsonb_build_object(
      '1', jsonb_build_array(4,4,4,4,4,4),
      '2', jsonb_build_array(4,4,4,4,4,4)
    ),
    'stores', jsonb_build_object('1', 0, '2', 0),
    'turn', 1,
    'status', 'playing',
    'winnerSeat', null,
    'scores', jsonb_build_object('1', 0, '2', 0),
    'moveNumber', 0,
    'lastMove', null,
    'turnDeadline', (p_now + interval '30 seconds')::text,
    'rematchRequests', '[]'::jsonb,
    'message', 'Player 1 goes first.'
  );
$$;

notify pgrst, 'reload schema';
