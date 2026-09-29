-- Fix play_emoji_decode_action: polymorphic "unknown" type on guess (42804).

create or replace function public.play_emoji_decode_action(
  p_room uuid,
  p_action text,
  p_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  answer_row private.emoji_decode_answers;
  guess_text text;
  solved jsonb;
  points jsonb;
  scores jsonb;
  order_no integer;
  awarded integer;
  n integer;
  seat_key text;
  current_score integer;
  ends_at bigint;
  now_ms bigint;
  normalized_answer text;
  match_found boolean := false;
  ans text;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'emoji_decode' or r.status <> 'playing' then
    raise exception 'Emoji Decode is not active';
  end if;

  select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  if me.id is null then
    raise exception 'You are not in this room';
  end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  now_ms := ((extract(epoch from clock_timestamp()) * 1000.0))::bigint;
  seat_key := me.seat::text;

  if p_action = 'guess' then
    if coalesce(state->>'phase', '') <> 'playing' then
      raise exception 'This round is not accepting guesses';
    end if;

    ends_at := coalesce((state->>'roundEndsAt')::bigint, 0);
    if ends_at > 0 and ends_at <= now_ms then
      raise exception 'Time is up';
    end if;

    if p_value is null or length(trim(p_value)) < 1 or length(p_value) > 80 then
      raise exception 'Enter a valid guess';
    end if;

    solved := coalesce(state->'solvedSeats', '[]'::jsonb);
    if exists (
      select 1
      from jsonb_array_elements_text(solved) as x(val)
      where val = seat_key or val::integer = me.seat
    ) then
      raise exception 'You already solved this round';
    end if;

    select * into answer_row
    from private.emoji_decode_answers
    where room_id = p_room
      and round_no = coalesce((state->>'round')::integer, 0);

    if answer_row.room_id is null then
      raise exception 'Puzzle is still loading';
    end if;

    guess_text := regexp_replace(lower(trim(p_value)), '[^a-z0-9]', '', 'g');

    -- Compare against canonical answer + acceptable list without polymorphic array tricks
    normalized_answer := regexp_replace(lower(trim(answer_row.answer)), '[^a-z0-9]', '', 'g');
    if normalized_answer = guess_text then
      match_found := true;
    else
      if answer_row.acceptable_answers is not null then
        foreach ans in array answer_row.acceptable_answers
        loop
          if regexp_replace(lower(trim(ans)), '[^a-z0-9]', '', 'g') = guess_text then
            match_found := true;
            exit;
          end if;
        end loop;
      end if;
    end if;

    if not match_found then
      return jsonb_build_object(
        'correct', false,
        'public_state', state,
        'status', r.status
      );
    end if;

    order_no := coalesce(jsonb_array_length(solved), 0) + 1;
    awarded := case order_no
      when 1 then 100
      when 2 then 75
      when 3 then 50
      else 25
    end;

    solved := solved || jsonb_build_array(me.seat);
    points := coalesce(state->'roundPoints', '{}'::jsonb)
      || jsonb_build_object(seat_key, awarded);

    scores := coalesce(state->'scores', '{}'::jsonb);
    current_score := coalesce((scores->>seat_key)::integer, 0);
    scores := scores || jsonb_build_object(seat_key, current_score + awarded);

    state := state
      || jsonb_build_object(
        'solvedSeats', solved,
        'roundPoints', points,
        'scores', scores
      );

    select count(*)::integer into n from public.game_players where room_id = p_room;

    if coalesce(jsonb_array_length(solved), 0) >= n then
      state := state || jsonb_build_object(
        'phase', 'round_complete',
        'revealAt', (now_ms + 4000)::bigint,
        'answer', answer_row.answer,
        'explanation', answer_row.explanation,
        'message', 'Everyone decoded it!'
      );
    else
      state := state || jsonb_build_object(
        'message', 'A player decoded it! Keep guessing.'
      );
    end if;

    update public.game_rooms
    set public_state = state,
        state_version = state_version + 1,
        updated_at = now()
    where id = p_room;

    return jsonb_build_object(
      'correct', true,
      'points', awarded,
      'public_state', state,
      'status', r.status
    );

  elsif p_action = 'time_expired' then
    if coalesce(state->>'phase', '') <> 'playing' then
      return jsonb_build_object('public_state', state, 'status', r.status);
    end if;

    ends_at := coalesce((state->>'roundEndsAt')::bigint, 0);
    if ends_at > now_ms then
      raise exception 'The round timer is still running';
    end if;

    select * into answer_row
    from private.emoji_decode_answers
    where room_id = p_room
      and round_no = coalesce((state->>'round')::integer, 0);

    if answer_row.room_id is null then
      raise exception 'Puzzle is still loading';
    end if;

    state := state || jsonb_build_object(
      'phase', 'round_complete',
      'answer', answer_row.answer,
      'explanation', answer_row.explanation,
      'revealAt', (now_ms + 4000)::bigint,
      'message', 'Time is up!'
    );

  elsif p_action = 'advance' then
    if r.host_id is distinct from auth.uid() then
      raise exception 'Only the host can advance the round';
    end if;

    if coalesce(state->>'phase', '') <> 'round_complete' then
      raise exception 'Round results are still showing';
    end if;

    if coalesce((state->>'revealAt')::bigint, 0) > now_ms then
      raise exception 'Round results are still showing';
    end if;

    if coalesce((state->>'round')::integer, 0) >= 8 then
      state := state || jsonb_build_object(
        'phase', 'final_results',
        'winnerSeat', (
          select gp.seat
          from public.game_players gp
          where gp.room_id = p_room
          order by coalesce((state->'scores'->>gp.seat::text)::integer, 0) desc, gp.seat asc
          limit 1
        ),
        'message', 'Emoji Decode complete!'
      );
      r.status := 'completed';
    else
      state := state
        || jsonb_build_object(
          'round', coalesce((state->>'round')::integer, 1) + 1,
          'phase', 'generating_puzzle',
          'message', 'Creating your next puzzle…'
        );
      state := state - 'answer' - 'emojis' - 'category' - 'roundEndsAt' - 'revealAt' - 'solvedSeats' - 'roundPoints' - 'explanation';
    end if;

  else
    raise exception 'Invalid Emoji Decode action';
  end if;

  update public.game_rooms
  set public_state = state,
      status = r.status,
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room;

  if r.status = 'completed' then
    perform public.finalize_room(p_room, state, r.game_type);
  end if;

  return jsonb_build_object('public_state', state, 'status', r.status);
end;
$$;

grant execute on function public.play_emoji_decode_action(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
