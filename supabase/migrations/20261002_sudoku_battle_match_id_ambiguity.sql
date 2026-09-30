-- Qualify the active Sudoku match identifier in board lookups.
-- The old local variable name collided with the match_id table column.

create or replace function public.get_sudoku_my_board(p_room uuid)
returns jsonb
language plpgsql security definer set search_path = public, private, auth as $$
declare
  r public.game_rooms;
  state jsonb;
  v_match_id uuid;
  b_board text;
  b_mistakes integer;
  b_finished boolean;
  b_finish bigint;
begin
  select * into r from public.game_rooms where id = p_room;
  if r.id is null or r.game_type <> 'sudoku_battle' then
    raise exception 'Not a Sudoku Battle room';
  end if;
  if not exists(select 1 from public.game_players where room_id = p_room and player_id = auth.uid()) then
    raise exception 'You are not in this room';
  end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  v_match_id := nullif(state->>'matchId','')::uuid;

  select b.board, b.mistakes, b.finished, b.finish_ms
    into b_board, b_mistakes, b_finished, b_finish
  from private.sudoku_player_boards b
  where b.room_id = p_room
    and b.player_id = auth.uid()
    and (v_match_id is null or b.match_id = v_match_id)
  order by b.updated_at desc
  limit 1;

  return jsonb_build_object(
    'board', coalesce(b_board, state->>'puzzle'),
    'mistakes', coalesce(b_mistakes, 0),
    'finished', coalesce(b_finished, false),
    'finishMs', b_finish,
    'puzzle', state->>'puzzle',
    'phase', state->>'phase',
    'startAt', state->>'startAt',
    'endsAt', state->>'endsAt'
  );
end;
$$;

grant execute on function public.get_sudoku_my_board(uuid) to authenticated;

create or replace function public.play_sudoku_battle_action(
  p_room uuid,
  p_action text,
  p_value text default null
) returns jsonb
language plpgsql security definer set search_path = public, private, auth as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  v_match_id uuid;
  board_row private.sudoku_player_boards;
  solution text;
  puzzle text;
  board text;
  cell_i integer;
  digit integer;
  clue char;
  sol_digit char;
  mistakes integer;
  finished boolean;
  correct_count integer := 0;
  filled_count integer := 0;
  i integer;
  now_ms bigint;
  start_ms bigint;
  ends_ms bigint;
  progress jsonb;
  seat_key text;
  all_done boolean;
  n integer;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'sudoku_battle' or r.status not in ('playing','completed') then
    raise exception 'Sudoku Battle is not active';
  end if;

  select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  if me.id is null then raise exception 'You are not in this room'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  v_match_id := nullif(state->>'matchId','')::uuid;
  puzzle := coalesce(state->>'puzzle', '');
  now_ms := ((extract(epoch from clock_timestamp()) * 1000.0))::bigint;
  start_ms := coalesce((state->>'startAt')::bigint, now_ms);
  ends_ms := coalesce((state->>'endsAt')::bigint, now_ms + 600000);
  seat_key := me.seat::text;

  select * into board_row
  from private.sudoku_player_boards b
  where b.room_id = p_room and b.player_id = auth.uid() and b.match_id = v_match_id;

  if board_row.room_id is null then
    -- try without match filter
    select * into board_row from private.sudoku_player_boards
    where room_id = p_room and player_id = auth.uid()
    order by updated_at desc limit 1;
  end if;

  select s.solution into solution from private.sudoku_solutions s where s.room_id = p_room;

  if p_action = 'place' then
    if coalesce(state->>'phase','') <> 'playing' then raise exception 'Game is not accepting moves'; end if;
    if now_ms >= ends_ms then raise exception 'Time is up'; end if;
    if board_row.finished then raise exception 'You already finished'; end if;
    if solution is null or puzzle is null or char_length(puzzle) <> 81 then raise exception 'Puzzle not ready'; end if;

    -- p_value format: "index:digit" index 0-80, digit 0-9 (0 clears)
    if p_value is null or position(':' in p_value) = 0 then raise exception 'Invalid move'; end if;
    cell_i := split_part(p_value, ':', 1)::integer;
    digit := split_part(p_value, ':', 2)::integer;
    if cell_i < 0 or cell_i > 80 or digit < 0 or digit > 9 then raise exception 'Invalid cell or digit'; end if;

    clue := substr(puzzle, cell_i + 1, 1);
    if clue <> '0' then raise exception 'Cannot change a given clue'; end if;

    board := coalesce(board_row.board, puzzle);
    if char_length(board) <> 81 then board := puzzle; end if;
    mistakes := coalesce(board_row.mistakes, 0);
    finished := false;

    -- apply
    board := overlay(board placing digit::text from cell_i + 1 for 1);

    if digit > 0 then
      sol_digit := substr(solution, cell_i + 1, 1);
      if sol_digit <> digit::text then
        mistakes := mistakes + 1;
      end if;
    end if;

    -- progress counts
    for i in 0..80 loop
      if substr(board, i + 1, 1) <> '0' then
        filled_count := filled_count + 1;
        if substr(board, i + 1, 1) = substr(solution, i + 1, 1) then
          correct_count := correct_count + 1;
        end if;
      end if;
    end loop;

    if correct_count = 81 then
      finished := true;
    end if;

    insert into private.sudoku_player_boards as b (room_id, player_id, match_id, board, mistakes, finished, finish_ms, updated_at)
    values (
      p_room, auth.uid(), coalesce(v_match_id, gen_random_uuid()), board, mistakes, finished,
      case when finished then now_ms - start_ms else null end, now()
    )
    on conflict (room_id, player_id, match_id) do update
      set board = excluded.board,
          mistakes = excluded.mistakes,
          finished = excluded.finished,
          finish_ms = coalesce(b.finish_ms, excluded.finish_ms),
          updated_at = now();

    progress := coalesce(state->'progress', '{}'::jsonb);
    progress := progress || jsonb_build_object(
      seat_key,
      jsonb_build_object(
        'filled', filled_count,
        'correct', correct_count,
        'mistakes', mistakes,
        'finished', finished,
        'finishMs', case when finished then now_ms - start_ms else null end
      )
    );
    state := state || jsonb_build_object('progress', progress);

    if finished then
      state := state || jsonb_build_object('message', 'A player finished!');
    end if;

    -- end if all human/bot players finished or time up
    select count(*) into n from public.game_players where room_id = p_room;
    select bool_and(coalesce((state->'progress'->gp.seat::text->>'finished')::boolean, false))
      into all_done
    from public.game_players gp where gp.room_id = p_room;

    if all_done or now_ms >= ends_ms then
      state := state || jsonb_build_object('phase', 'results', 'message', 'Battle complete!');
      r.status := 'completed';
    end if;

    update public.game_rooms
    set public_state = state, status = r.status, state_version = state_version + 1, updated_at = now()
    where id = p_room;

    if r.status = 'completed' then
      perform public.finalize_room(p_room, state, r.game_type);
    end if;

    return jsonb_build_object(
      'ok', true,
      'board', board,
      'mistakes', mistakes,
      'finished', finished,
      'correct', correct_count,
      'filled', filled_count,
      'isCorrectDigit', case when digit = 0 then null else substr(solution, cell_i + 1, 1) = digit::text end,
      'public_state', state,
      'status', r.status
    );

  elsif p_action = 'time_expired' then
    if coalesce(state->>'phase','') <> 'playing' then
      return jsonb_build_object('public_state', state, 'status', r.status);
    end if;
    if now_ms < ends_ms then raise exception 'Timer still running'; end if;
    state := state || jsonb_build_object('phase', 'results', 'message', 'Time''s up!');
    r.status := 'completed';
    update public.game_rooms
    set public_state = state, status = r.status, state_version = state_version + 1, updated_at = now()
    where id = p_room;
    perform public.finalize_room(p_room, state, r.game_type);
    return jsonb_build_object('public_state', state, 'status', r.status);

  elsif p_action = 'rematch' or p_action = 'restart' then
    if r.host_id is distinct from auth.uid() then raise exception 'Only the host can rematch'; end if;
    update public.game_players set is_ready = false where room_id = p_room;
    delete from private.sudoku_player_boards where room_id = p_room;
    delete from private.sudoku_solutions where room_id = p_room;
    update public.game_rooms
    set status = 'waiting',
        public_state = jsonb_build_object(
          'phase', 'lobby',
          'difficulty', coalesce(state->>'difficulty', 'medium'),
          'message', 'Rematch — ready up!'
        ),
        state_version = state_version + 1,
        updated_at = now()
    where id = p_room;
    return jsonb_build_object('status', 'waiting');

  else
    raise exception 'Invalid Sudoku action';
  end if;
end;
$$;

grant execute on function public.play_sudoku_battle_action(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
