-- Memory Match: three board modes (easy 12 / classic 16 / expert 24 cards)

create or replace function public.start_memory_match(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.game_rooms;
  n int;
  deck jsonb := '[]'::jsonb;
  face_up jsonb := '[]'::jsonb;
  symbols text[] := array['🍎','🚀','🐶','🌈','⚽','🎸','🌙','🦄','🔥','⭐','🎯','🎮'];
  pairs int := 8;
  i int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id = p_room;
  if n < 2 or exists (select 1 from public.game_players where room_id = p_room and not is_ready) then
    raise exception 'Everyone must be ready';
  end if;

  for i in 1..pairs loop
    deck := deck || jsonb_build_array(symbols[i], symbols[i]);
  end loop;
  select jsonb_agg(card order by random()) into deck from jsonb_array_elements(deck) as item(card);

  for i in 1..(pairs * 2) loop
    face_up := face_up || 'null'::jsonb;
  end loop;

  insert into private.memory_match_decks(room_id, cards)
  values (p_room, deck)
  on conflict (room_id) do update set cards = excluded.cards;

  update public.game_rooms
  set status = 'playing',
      public_state = jsonb_build_object(
        'turn', 1,
        'mode', 'classic',
        'pairs', pairs,
        'cols', 4,
        'cards', face_up,
        'flipped', '[]'::jsonb,
        'matched', '[]'::jsonb,
        'scores', '{}'::jsonb,
        'revealed', false,
        'message', 'Player 1 flips first! Host can pick Easy, Classic, or Expert before the first flip.'
      ),
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room;
end;
$$;

create or replace function public.play_memory_match_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  deck jsonb;
  cards jsonb;
  flipped jsonb;
  matched jsonb;
  idx int;
  first_idx int;
  second_idx int;
  next_seat int;
  score int;
  winner int;
  top_score int;
  count_tied int;
  total_cards int;
  pairs int;
  cols int;
  mode text;
  symbols text[] := array['🍎','🚀','🐶','🌈','⚽','🎸','🌙','🦄','🔥','⭐','🎯','🎮'];
  face_up jsonb;
  i int;
  lines_drawn int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.status <> 'playing' or r.game_type <> 'memory_match' then
    raise exception 'Memory Match is not active';
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

  state := r.public_state;
  cards := coalesce(state->'cards', '[]'::jsonb);
  flipped := coalesce(state->'flipped', '[]'::jsonb);
  matched := coalesce(state->'matched', '[]'::jsonb);
  total_cards := greatest(jsonb_array_length(cards), 0);

  -- Host can change mode before any flip
  if p_action = 'set_mode' then
    if auth.uid() is null or r.host_id <> auth.uid() then
      raise exception 'Only the host can change the board size';
    end if;
    if jsonb_array_length(flipped) > 0 or jsonb_array_length(matched) > 0 then
      raise exception 'Board size can only be changed before the first flip';
    end if;

    mode := lower(trim(coalesce(p_value, 'classic')));
    if mode = 'easy' then
      pairs := 6; cols := 3;
    elsif mode = 'expert' then
      pairs := 12; cols := 4;
    else
      mode := 'classic'; pairs := 8; cols := 4;
    end if;

    deck := '[]'::jsonb;
    for i in 1..pairs loop
      deck := deck || jsonb_build_array(symbols[i], symbols[i]);
    end loop;
    select jsonb_agg(card order by random()) into deck from jsonb_array_elements(deck) as item(card);

    face_up := '[]'::jsonb;
    for i in 1..(pairs * 2) loop
      face_up := face_up || 'null'::jsonb;
    end loop;

    insert into private.memory_match_decks(room_id, cards)
    values (p_room, deck)
    on conflict (room_id) do update set cards = excluded.cards;

    state := jsonb_set(state, '{mode}', to_jsonb(mode), true);
    state := jsonb_set(state, '{pairs}', to_jsonb(pairs), true);
    state := jsonb_set(state, '{cols}', to_jsonb(cols), true);
    state := jsonb_set(state, '{cards}', face_up, true);
    state := jsonb_set(state, '{flipped}', '[]'::jsonb, true);
    state := jsonb_set(state, '{matched}', '[]'::jsonb, true);
    state := jsonb_set(state, '{revealed}', 'false'::jsonb, true);
    state := jsonb_set(state, '{message}', to_jsonb(format('Board set to %s (%s pairs). Player %s flips first!', mode, pairs, coalesce((state->>'turn')::int, 1))), true);

    update public.game_rooms
    set public_state = state, state_version = state_version + 1, updated_at = now()
    where id = p_room;
    return state;
  end if;

  if coalesce((state->>'turn')::int, 1) <> me.seat then
    raise exception 'Wait for your turn';
  end if;

  deck := (select d.cards from private.memory_match_decks d where d.room_id = p_room);
  if deck is null then raise exception 'Memory deck is missing'; end if;

  if p_action = 'flip' then
    if coalesce((state->>'revealed')::boolean, false) or jsonb_array_length(flipped) >= 2 then
      raise exception 'Resolve the current pair first';
    end if;
    idx := p_value::int;
    if idx < 0 or idx >= total_cards then raise exception 'Invalid card'; end if;
    -- matched / flipped may store numbers; check both forms
    if matched @> to_jsonb(idx) or flipped @> to_jsonb(idx) then
      raise exception 'Invalid card';
    end if;

    cards := jsonb_set(cards, array[idx::text], deck->idx, true);
    flipped := flipped || to_jsonb(idx);
    state := jsonb_set(state, '{cards}', cards, true);
    state := jsonb_set(state, '{flipped}', flipped, true);

    if jsonb_array_length(flipped) = 2 then
      state := jsonb_set(state, '{revealed}', 'true'::jsonb, true);
      first_idx := (flipped->>0)::int;
      second_idx := (flipped->>1)::int;
      if cards->first_idx = cards->second_idx then
        matched := matched || flipped;
        score := coalesce((state->'scores'->>me.seat::text)::int, 0) + 1;
        state := jsonb_set(state, '{matched}', matched, true);
        state := jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
        state := jsonb_set(state, '{message}', to_jsonb(format('Player %s found a pair!', me.seat)), true);
      else
        state := jsonb_set(state, '{message}', to_jsonb(format('Player %s missed. Next player goes.', me.seat)), true);
      end if;
    else
      state := jsonb_set(state, '{message}', to_jsonb(format('Player %s flipped a card. Pick one more.', me.seat)), true);
    end if;

  elsif p_action = 'resolve' then
    if not coalesce((state->>'revealed')::boolean, false) or jsonb_array_length(flipped) <> 2 then
      raise exception 'Cards are not ready to resolve';
    end if;
    first_idx := (flipped->>0)::int;
    second_idx := (flipped->>1)::int;

    if cards->first_idx = cards->second_idx then
      if jsonb_array_length(matched) >= total_cards then
        select max(coalesce((state->'scores'->>seat::text)::int, 0)) into top_score
        from public.game_players where room_id = p_room;
        select count(*) into count_tied
        from public.game_players
        where room_id = p_room
          and coalesce((state->'scores'->>seat::text)::int, 0) = top_score;
        if count_tied = 1 then
          select min(seat) into winner
          from public.game_players
          where room_id = p_room
            and coalesce((state->'scores'->>seat::text)::int, 0) = top_score;
          r.status := 'completed';
          state := jsonb_set(state, '{winnerSeat}', to_jsonb(winner), true);
          state := jsonb_set(state, '{message}', to_jsonb(format('Memory Match complete! Player %s wins!', winner)), true);
        else
          -- tiny sudden-death board
          deck := jsonb_build_array('🏆', '🏆', '👑', '👑');
          select jsonb_agg(card order by random()) into deck from jsonb_array_elements(deck) as item(card);
          insert into private.memory_match_decks(room_id, cards)
          values (p_room, deck)
          on conflict (room_id) do update set cards = excluded.cards;
          state := jsonb_set(state, '{cards}', jsonb_build_array(null, null, null, null), true);
          state := jsonb_set(state, '{matched}', '[]'::jsonb, true);
          state := jsonb_set(state, '{mode}', to_jsonb('sudden'::text), true);
          state := jsonb_set(state, '{pairs}', to_jsonb(2), true);
          state := jsonb_set(state, '{cols}', to_jsonb(2), true);
          state := jsonb_set(state, '{message}', to_jsonb('Score tie! Sudden death — match a pair to win!'::text), true);
        end if;
      end if;
    else
      cards := jsonb_set(cards, array[first_idx::text], 'null'::jsonb, true);
      cards := jsonb_set(cards, array[second_idx::text], 'null'::jsonb, true);
      state := jsonb_set(state, '{cards}', cards, true);
      select min(seat) into next_seat
      from public.game_players where room_id = p_room and seat > me.seat;
      if next_seat is null then
        select min(seat) into next_seat from public.game_players where room_id = p_room;
      end if;
      state := jsonb_set(state, '{turn}', to_jsonb(next_seat), true);
    end if;

    state := jsonb_set(state, '{flipped}', '[]'::jsonb, true);
    state := jsonb_set(state, '{revealed}', 'false'::jsonb, true);
  else
    raise exception 'Invalid Memory Match action';
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
  return state;
end;
$$;

grant execute on function public.start_memory_match(uuid) to authenticated;
grant execute on function public.play_memory_match_action(uuid, text, text, integer) to anon, authenticated;
