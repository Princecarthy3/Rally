-- Migration: Add Classic 108-card Multiplayer UNO support
-- Date: 2026-09-19

-- 1. Ensure game_rooms constraint allows 'uno'
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ));

-- 2. Update create_game_room to accept 'uno' with max 4 players
create or replace function public.create_game_room(p_game_type text, p_max_players int default 2)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_code text;
  v_room uuid;
  v_max int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_game_type not in (
    'uno','rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ) then raise exception 'Unknown game'; end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship') then 2
    else greatest(2, least(4, p_max_players))
  end;

  loop
    v_code := public.random_room_code();
    exit when not exists(select 1 from public.game_rooms where code=v_code);
  end loop;

  insert into public.game_rooms(code,game_type,host_id,max_players)
  values(v_code,p_game_type,auth.uid(),v_max)
  returning id into v_room;

  insert into public.game_players(room_id,player_id,seat)
  values(v_room,auth.uid(),1);
  return v_code;
end $$;

grant execute on function public.create_game_room(text,int) to authenticated;

-- 3. Private schema table for secret UNO hands and draw deck
create table if not exists private.uno_games (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  deck jsonb not null,
  hands jsonb not null,
  uno_called jsonb not null default '{}'::jsonb,
  uno_vulnerable_seat int default null,
  pending_challenge jsonb default null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Helper function to generate classic 108-card deck
create or replace function public.generate_uno_deck()
returns jsonb language plpgsql as $$
declare
  v_deck jsonb := '[]'::jsonb;
  v_colors text[] := array['red', 'blue', 'green', 'yellow'];
  v_color text;
  v_id int := 1;
  i int;
begin
  foreach v_color in array v_colors loop
    -- 0 x1
    v_deck := v_deck || jsonb_build_array(jsonb_build_object('id', 'c' || v_id, 'color', v_color, 'value', '0'));
    v_id := v_id + 1;
    -- 1..9 x2 each
    for i in 1..9 loop
      v_deck := v_deck || jsonb_build_array(
        jsonb_build_object('id', 'c' || v_id, 'color', v_color, 'value', i::text),
        jsonb_build_object('id', 'c' || (v_id + 1), 'color', v_color, 'value', i::text)
      );
      v_id := v_id + 2;
    end loop;
    -- Skip x2
    v_deck := v_deck || jsonb_build_array(
      jsonb_build_object('id', 'c' || v_id, 'color', v_color, 'value', 'skip'),
      jsonb_build_object('id', 'c' || (v_id + 1), 'color', v_color, 'value', 'skip')
    );
    v_id := v_id + 2;
    -- Reverse x2
    v_deck := v_deck || jsonb_build_array(
      jsonb_build_object('id', 'c' || v_id, 'color', v_color, 'value', 'reverse'),
      jsonb_build_object('id', 'c' || (v_id + 1), 'color', v_color, 'value', 'reverse')
    );
    v_id := v_id + 2;
    -- Draw Two x2
    v_deck := v_deck || jsonb_build_array(
      jsonb_build_object('id', 'c' || v_id, 'color', v_color, 'value', 'draw2'),
      jsonb_build_object('id', 'c' || (v_id + 1), 'color', v_color, 'value', 'draw2')
    );
    v_id := v_id + 2;
  end loop;

  -- Wild x4
  for i in 1..4 loop
    v_deck := v_deck || jsonb_build_array(jsonb_build_object('id', 'c' || v_id, 'color', 'wild', 'value', 'wild'));
    v_id := v_id + 1;
  end loop;

  -- Wild Draw Four x4
  for i in 1..4 loop
    v_deck := v_deck || jsonb_build_array(jsonb_build_object('id', 'c' || v_id, 'color', 'wild', 'value', 'wild_draw4'));
    v_id := v_id + 1;
  end loop;

  return v_deck;
end $$;

-- 5. Helper function to get next seat
create or replace function public.uno_next_seat(p_current int, p_dir int, p_max int)
returns int language plpgsql as $$
declare
  v_next int;
begin
  v_next := p_current + p_dir;
  if v_next > p_max then v_next := 1; end if;
  if v_next < 1 then v_next := p_max; end if;
  return v_next;
end $$;

-- 6. RPC: Start UNO Game
create or replace function public.start_uno_game(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  n int;
  v_full_deck jsonb;
  v_shuffled jsonb;
  v_hands jsonb := '{}'::jsonb;
  v_card_counts jsonb := '{}'::jsonb;
  v_scores jsonb := '{}'::jsonb;
  v_player_seats int[];
  v_seat int;
  v_hand jsonb;
  v_top_card jsonb;
  v_idx int;
  v_active_color text;
  v_turn int := 1;
  v_dir int := 1;
  v_colors text[] := array['red', 'blue', 'green', 'yellow'];
  v_msg text;
  i int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' and r.status <> 'completed' then raise exception 'Game already in progress'; end if;

  select count(*) into n from public.game_players where room_id=p_room;
  if n < 2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then
    raise exception 'Everyone must be ready (min 2 players)';
  end if;

  select array_agg(seat order by seat) into v_player_seats from public.game_players where room_id=p_room;

  -- 1. Generate & Shuffle 108 cards
  v_full_deck := public.generate_uno_deck();
  select jsonb_agg(elem order by random()) into v_shuffled from jsonb_array_elements(v_full_deck) elem;

  -- 2. Deal 7 cards to each seat
  foreach v_seat in array v_player_seats loop
    v_hand := '[]'::jsonb;
    for i in 1..7 loop
      v_hand := v_hand || jsonb_build_array(v_shuffled->0);
      -- Remove dealt card
      select jsonb_agg(elem) into v_shuffled from (
        select elem, row_number() over () as idx from jsonb_array_elements(v_shuffled) elem
      ) t where idx > 1;
    end loop;
    v_hands := jsonb_set(v_hands, array[v_seat::text], v_hand, true);
    v_card_counts := jsonb_set(v_card_counts, array[v_seat::text], '7'::jsonb, true);
    v_scores := jsonb_set(v_scores, array[v_seat::text], '0'::jsonb, true);
  end loop;

  -- Preserve scores if room public_state has existing scores
  if r.public_state ? 'scores' then
    v_scores := r.public_state->'scores';
  end if;

  -- 3. Select opening card (Wild Draw Four must NOT be opening discard)
  v_idx := 0;
  while (v_shuffled->v_idx->>'value') = 'wild_draw4' loop
    v_idx := v_idx + 1;
  end loop;

  v_top_card := v_shuffled->v_idx;

  -- Remove top card from deck
  select jsonb_agg(elem) into v_shuffled from (
    select elem, row_number() over () as row_num from jsonb_array_elements(v_shuffled) elem
  ) t where row_num <> (v_idx + 1);

  -- 4. Set initial active color and opening card action effects
  if (v_top_card->>'color') = 'wild' then
    v_active_color := v_colors[1 + floor(random()*4)::int];
  else
    v_active_color := v_top_card->>'color';
  end if;

  v_msg := 'Player 1''s turn';

  if (v_top_card->>'value') = 'skip' then
    v_turn := public.uno_next_seat(1, 1, n);
    v_msg := 'Opening Skip card! Turn skips to Player ' || v_turn;
  elsif (v_top_card->>'value') = 'reverse' then
    if n = 2 then
      v_turn := 1; -- 2-player Reverse acts like Skip, so Player 1 goes again
      v_msg := 'Opening Reverse card! Player 1 goes again';
    else
      v_dir := -1;
      v_turn := n; -- Direction reversed, so seat N starts
      v_msg := 'Opening Reverse card! Turn moves counter-clockwise to Player ' || v_turn;
    end if;
  elsif (v_top_card->>'value') = 'draw2' then
    -- Player 1 draws 2 cards and loses turn
    v_hand := v_hands->'1';
    for i in 1..2 loop
      v_hand := v_hand || jsonb_build_array(v_shuffled->0);
      select jsonb_agg(elem) into v_shuffled from (
        select elem, row_number() over () as idx from jsonb_array_elements(v_shuffled) elem
      ) t where idx > 1;
    end loop;
    v_hands := jsonb_set(v_hands, array['1'], v_hand, true);
    v_card_counts := jsonb_set(v_card_counts, array['1'], to_jsonb(jsonb_array_length(v_hand)), true);
    v_turn := public.uno_next_seat(1, 1, n);
    v_msg := 'Opening Draw Two card! Player 1 draws 2 cards and loses turn. Player ' || v_turn || '''s turn';
  end if;

  -- Save private state
  insert into private.uno_games(room_id, deck, hands, uno_called, uno_vulnerable_seat, pending_challenge)
  values(p_room, v_shuffled, v_hands, '{}'::jsonb, null, null)
  on conflict(room_id) do update set
    deck = excluded.deck,
    hands = excluded.hands,
    uno_called = '{}'::jsonb,
    uno_vulnerable_seat = null,
    pending_challenge = null,
    updated_at = now();

  -- Update public room state
  update public.game_rooms set
    status = 'playing',
    public_state = jsonb_build_object(
      'round', coalesce((r.public_state->>'round')::int, 1),
      'turn', v_turn,
      'direction', v_dir,
      'activeColor', v_active_color,
      'topCard', v_top_card,
      'discardCount', 1,
      'drawCount', jsonb_array_length(v_shuffled),
      'cardCounts', v_card_counts,
      'unoCalled', '{}'::jsonb,
      'unoVulnerableSeat', null,
      'challenge', null,
      'scores', v_scores,
      'message', v_msg,
      'winnerSeat', null,
      'roundWinnerSeat', null,
      'drawnCardId', null
    ),
    state_version = state_version + 1,
    updated_at = now()
  where id = p_room;
end $$;

grant execute on function public.start_uno_game(uuid) to authenticated;

-- 7. RPC: Secure Private Hand Getter
create or replace function public.get_my_uno_hand(p_room uuid, p_actor_seat int default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_seat int;
  v_hands jsonb;
begin
  if p_actor_seat is not null then
    v_seat := p_actor_seat;
  else
    select seat into v_seat from public.game_players where room_id = p_room and player_id = auth.uid();
  end if;

  if v_seat is null then return '[]'::jsonb; end if;

  select hands into v_hands from private.uno_games where room_id = p_room;
  if v_hands is null then return '[]'::jsonb; end if;

  return coalesce(v_hands->v_seat::text, '[]'::jsonb);
end $$;

grant execute on function public.get_my_uno_hand(uuid, int) to anon, authenticated;

-- 8. RPC: Play UNO Action (Server Authoritative)
create or replace function public.play_uno_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  priv record;
  state jsonb;
  v_n_players int;
  v_seat int;
  v_hand jsonb;
  v_deck jsonb;
  v_hands jsonb;
  v_uno_called jsonb;
  v_uno_vulnerable int;
  v_pending jsonb;
  
  v_turn int;
  v_dir int;
  v_active_color text;
  v_top_card jsonb;
  v_card_counts jsonb;
  v_scores jsonb;
  
  v_card_id text;
  v_chosen_color text;
  v_card jsonb;
  v_card_color text;
  v_card_val text;
  v_has_color boolean;
  v_was_bluff boolean;
  v_drawn_card jsonb;
  v_next_seat int;
  v_victim_seat int;
  v_is_playable boolean;
  v_drawn_card_id text := null;
  v_msg text;

  v_card_pts int;
  v_round_pts int := 0;
  v_opp record;
  v_opp_hand jsonb;
  v_opp_card jsonb;
  v_cur_score int;
  v_new_score int;
  v_winner_seat int := null;
  i int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.status <> 'playing' or r.game_type <> 'uno' then
    raise exception 'UNO game is not active';
  end if;

  select count(*) into v_n_players from public.game_players where room_id = p_room;

  -- Resolve acting player
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id = p_room and seat = p_actor_seat and player_id like '11111111-1111-1111-1111-11111111%';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player in this room'; end if;

  select * into priv from private.uno_games where room_id = p_room for update;
  if priv.room_id is null then raise exception 'Private game state missing'; end if;

  state := r.public_state;
  v_turn := coalesce((state->>'turn')::int, 1);
  v_dir := coalesce((state->>'direction')::int, 1);
  v_active_color := state->>'activeColor';
  v_top_card := state->'topCard';
  v_card_counts := coalesce(state->'cardCounts', '{}'::jsonb);
  v_scores := coalesce(state->'scores', '{}'::jsonb);
  
  v_deck := priv.deck;
  v_hands := priv.hands;
  v_uno_called := priv.uno_called;
  v_uno_vulnerable := priv.uno_vulnerable_seat;
  v_pending := priv.pending_challenge;
  v_hand := coalesce(v_hands->me.seat::text, '[]'::jsonb);

  -- =========================================================================
  -- ACTION 1: CALL UNO
  -- =========================================================================
  if p_action = 'call_uno' then
    v_uno_called := jsonb_set(v_uno_called, array[me.seat::text], 'true'::jsonb, true);
    if v_uno_vulnerable = me.seat then
      v_uno_vulnerable := null;
    end if;
    state := jsonb_set(state, '{unoCalled}', v_uno_called, true);
    state := jsonb_set(state, '{unoVulnerableSeat}', 'null'::jsonb, true);
    state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' called UNO! 📣')::text), true);

  -- =========================================================================
  -- ACTION 2: CATCH UNO
  -- =========================================================================
  elsif p_action = 'catch_uno' then
    if v_uno_vulnerable is not null and v_uno_vulnerable <> me.seat then
      v_victim_seat := v_uno_vulnerable;
      v_opp_hand := coalesce(v_hands->v_victim_seat::text, '[]'::jsonb);
      -- Vulnerable player draws 2 cards
      for i in 1..2 loop
        if jsonb_array_length(v_deck) = 0 then
          -- Recycle deck if needed
          select jsonb_agg(c order by random()) into v_deck from private.uno_games where room_id=p_room;
        end if;
        if jsonb_array_length(v_deck) > 0 then
          v_opp_hand := v_opp_hand || jsonb_build_array(v_deck->0);
          select jsonb_agg(elem) into v_deck from (
            select elem, row_number() over () as idx from jsonb_array_elements(v_deck) elem
          ) t where idx > 1;
        end if;
      end loop;

      v_hands := jsonb_set(v_hands, array[v_victim_seat::text], v_opp_hand, true);
      v_card_counts := jsonb_set(v_card_counts, array[v_victim_seat::text], to_jsonb(jsonb_array_length(v_opp_hand)), true);
      v_uno_vulnerable := null;
      v_uno_called := jsonb_set(v_uno_called, array[v_victim_seat::text], 'false'::jsonb, true);

      state := jsonb_set(state, '{cardCounts}', v_card_counts, true);
      state := jsonb_set(state, '{unoCalled}', v_uno_called, true);
      state := jsonb_set(state, '{unoVulnerableSeat}', 'null'::jsonb, true);
      state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' caught Player ' || v_victim_seat || ' not calling UNO! Player ' || v_victim_seat || ' draws 2 cards! 🚨')::text), true);
    else
      raise exception 'No player is vulnerable to UNO catch';
    end if;

  -- =========================================================================
  -- ACTION 3: ACCEPT WILD DRAW FOUR (+4)
  -- =========================================================================
  elsif p_action = 'accept_draw4' then
    if v_pending is null or (v_pending->>'challengerSeat')::int <> me.seat then
      raise exception 'No pending +4 challenge for you';
    end if;

    -- Challenger (me) draws 4 cards and loses turn
    for i in 1..4 loop
      if jsonb_array_length(v_deck) > 0 then
        v_hand := v_hand || jsonb_build_array(v_deck->0);
        select jsonb_agg(elem) into v_deck from (
          select elem, row_number() over () as idx from jsonb_array_elements(v_deck) elem
        ) t where idx > 1;
      end if;
    end loop;

    v_hands := jsonb_set(v_hands, array[me.seat::text], v_hand, true);
    v_card_counts := jsonb_set(v_card_counts, array[me.seat::text], to_jsonb(jsonb_array_length(v_hand)), true);

    -- Turn passes over challenger
    v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
    v_pending := null;

    state := jsonb_set(state, '{turn}', to_jsonb(v_turn), true);
    state := jsonb_set(state, '{cardCounts}', v_card_counts, true);
    state := jsonb_set(state, '{challenge}', 'null'::jsonb, true);
    state := jsonb_set(state, '{drawCount}', to_jsonb(jsonb_array_length(v_deck)), true);
    state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' accepted the +4 and drew 4 cards. Player ' || v_turn || '''s turn.')::text), true);

  -- =========================================================================
  -- ACTION 4: CHALLENGE WILD DRAW FOUR (+4)
  -- =========================================================================
  elsif p_action = 'challenge_draw4' then
    if v_pending is null or (v_pending->>'challengerSeat')::int <> me.seat then
      raise exception 'No pending +4 challenge for you';
    end if;

    v_victim_seat := (v_pending->>'targetSeat')::int;
    v_was_bluff := (v_pending->>'wasBluff')::boolean;

    if v_was_bluff then
      -- Illegal +4! Target seat who played +4 draws 4 cards penalty
      v_opp_hand := coalesce(v_hands->v_victim_seat::text, '[]'::jsonb);
      for i in 1..4 loop
        if jsonb_array_length(v_deck) > 0 then
          v_opp_hand := v_opp_hand || jsonb_build_array(v_deck->0);
          select jsonb_agg(elem) into v_deck from (
            select elem, row_number() over () as idx from jsonb_array_elements(v_deck) elem
          ) t where idx > 1;
        end if;
      end loop;

      v_hands := jsonb_set(v_hands, array[v_victim_seat::text], v_opp_hand, true);
      v_card_counts := jsonb_set(v_card_counts, array[v_victim_seat::text], to_jsonb(jsonb_array_length(v_opp_hand)), true);
      
      -- Challenger (me) does NOT draw 6 cards and does NOT lose turn!
      v_turn := me.seat;
      state := jsonb_set(state, '{message}', to_jsonb(('Challenge successful! Player ' || v_victim_seat || ' played +4 illegally and draws 4 cards! Player ' || me.seat || '''s turn.')::text), true);
    else
      -- Legal +4! Challenger (me) draws 6 cards (4 + 2 penalty) and loses turn!
      for i in 1..6 loop
        if jsonb_array_length(v_deck) > 0 then
          v_hand := v_hand || jsonb_build_array(v_deck->0);
          select jsonb_agg(elem) into v_deck from (
            select elem, row_number() over () as idx from jsonb_array_elements(v_deck) elem
          ) t where idx > 1;
        end if;
      end loop;

      v_hands := jsonb_set(v_hands, array[me.seat::text], v_hand, true);
      v_card_counts := jsonb_set(v_card_counts, array[me.seat::text], to_jsonb(jsonb_array_length(v_hand)), true);

      -- Turn passes over challenger
      v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
      state := jsonb_set(state, '{message}', to_jsonb(('Challenge failed! Player ' || v_victim_seat || '''s +4 was legal. Player ' || me.seat || ' draws 6 cards and loses turn! Player ' || v_turn || '''s turn.')::text), true);
    end if;

    v_pending := null;
    state := jsonb_set(state, '{turn}', to_jsonb(v_turn), true);
    state := jsonb_set(state, '{cardCounts}', v_card_counts, true);
    state := jsonb_set(state, '{challenge}', 'null'::jsonb, true);
    state := jsonb_set(state, '{drawCount}', to_jsonb(jsonb_array_length(v_deck)), true);

  -- =========================================================================
  -- ACTION 5: DRAW CARD
  -- =========================================================================
  elsif p_action = 'draw_card' then
    if v_turn <> me.seat then raise exception 'Wait for your turn'; end if;
    if v_pending is not null then raise exception 'Must resolve +4 challenge first'; end if;

    -- Catch window closes once action occurs
    v_uno_vulnerable := null;

    if jsonb_array_length(v_deck) = 0 then
      -- Recycle deck if empty
      v_deck := public.generate_uno_deck(); -- Fallback refill if deck empty
    end if;

    v_drawn_card := v_deck->0;
    -- Remove drawn card from deck
    select jsonb_agg(elem) into v_deck from (
      select elem, row_number() over () as idx from jsonb_array_elements(v_deck) elem
    ) t where idx > 1;

    -- Add drawn card to player hand
    v_hand := v_hand || jsonb_build_array(v_drawn_card);
    v_hands := jsonb_set(v_hands, array[me.seat::text], v_hand, true);
    v_card_counts := jsonb_set(v_card_counts, array[me.seat::text], to_jsonb(jsonb_array_length(v_hand)), true);

    -- Check if drawn card is playable
    v_card_color := v_drawn_card->>'color';
    v_card_val := v_drawn_card->>'value';
    v_is_playable := (v_card_color = 'wild') or (v_card_color = v_active_color) or (v_card_val = (v_top_card->>'value'));

    if v_is_playable then
      v_drawn_card_id := v_drawn_card->>'id';
      state := jsonb_set(state, '{drawnCardId}', to_jsonb(v_drawn_card_id), true);
      state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' drew a playable card! You can play it or pass.')::text), true);
    else
      -- Pass turn automatically if not playable
      v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
      state := jsonb_set(state, '{turn}', to_jsonb(v_turn), true);
      state := jsonb_set(state, '{drawnCardId}', 'null'::jsonb, true);
      state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' drew a card. Player ' || v_turn || '''s turn.')::text), true);
    end if;

    state := jsonb_set(state, '{cardCounts}', v_card_counts, true);
    state := jsonb_set(state, '{drawCount}', to_jsonb(jsonb_array_length(v_deck)), true);

  -- =========================================================================
  -- ACTION 6: PASS TURN (after drawing playable card)
  -- =========================================================================
  elsif p_action = 'pass_turn' then
    if v_turn <> me.seat then raise exception 'Wait for your turn'; end if;
    v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
    v_uno_vulnerable := null;
    state := jsonb_set(state, '{turn}', to_jsonb(v_turn), true);
    state := jsonb_set(state, '{drawnCardId}', 'null'::jsonb, true);
    state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' passed. Player ' || v_turn || '''s turn.')::text), true);

  -- =========================================================================
  -- ACTION 7: PLAY CARD
  -- =========================================================================
  elsif p_action = 'play_card' then
    if v_turn <> me.seat then raise exception 'Wait for your turn'; end if;
    if v_pending is not null then raise exception 'Must resolve +4 challenge first'; end if;

    -- Parse card id & chosen color
    v_card_id := split_part(p_value, ':', 1);
    v_chosen_color := split_part(p_value, ':', 2);

    -- Find card in hand
    select elem into v_card from jsonb_array_elements(v_hand) elem where (elem->>'id') = v_card_id;
    if v_card is null then raise exception 'Card not in your hand'; end if;

    v_card_color := v_card->>'color';
    v_card_val := v_card->>'value';

    -- Check legality
    if v_card_color = 'wild' then
      if v_chosen_color not in ('red', 'blue', 'green', 'yellow') then
        raise exception 'Must specify valid active color for Wild card';
      end if;
      if v_card_val = 'wild_draw4' then
        -- Check if player had matching active color in hand (bluff check)
        v_was_bluff := exists(
          select 1 from jsonb_array_elements(v_hand) elem
          where (elem->>'id') <> v_card_id and (elem->>'color') = v_active_color
        );
      end if;
    elsif v_card_color <> v_active_color and v_card_val <> (v_top_card->>'value') then
      raise exception 'Card does not match active color or top card value';
    end if;

    -- Remove played card from hand
    select jsonb_agg(elem) into v_hand from (
      select elem from jsonb_array_elements(v_hand) elem where (elem->>'id') <> v_card_id
    ) t;
    if v_hand is null then v_hand := '[]'::jsonb; end if;

    v_hands := jsonb_set(v_hands, array[me.seat::text], v_hand, true);
    v_card_counts := jsonb_set(v_card_counts, array[me.seat::text], to_jsonb(jsonb_array_length(v_hand)), true);

    -- Update top card & active color
    v_top_card := v_card;
    if v_card_color = 'wild' then
      v_active_color := v_chosen_color;
    else
      v_active_color := v_card_color;
    end if;

    -- Close catch window from previous turn
    v_uno_vulnerable := null;

    -- Handle Card Action & Turn Progression
    if v_card_val = 'skip' then
      v_turn := public.uno_next_seat(me.seat, v_dir * 2, v_n_players);
      v_msg := 'Player ' || me.seat || ' played Skip! Player ' || v_turn || '''s turn.';
    elsif v_card_val = 'reverse' then
      if v_n_players = 2 then
        v_turn := me.seat; -- 2-player Reverse acts like Skip, so player goes again!
        v_msg := 'Player ' || me.seat || ' played Reverse! You get another turn.';
      else
        v_dir := -v_dir;
        v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
        v_msg := 'Player ' || me.seat || ' played Reverse! Direction changed to ' || (case when v_dir = 1 then 'Clockwise' else 'Counter-Clockwise' end) || '. Player ' || v_turn || '''s turn.';
      end if;
    elsif v_card_val = 'draw2' then
      v_next_seat := public.uno_next_seat(me.seat, v_dir, v_n_players);
      v_opp_hand := coalesce(v_hands->v_next_seat::text, '[]'::jsonb);
      for i in 1..2 loop
        if jsonb_array_length(v_deck) > 0 then
          v_opp_hand := v_opp_hand || jsonb_build_array(v_deck->0);
          select jsonb_agg(elem) into v_deck from (
            select elem, row_number() over () as idx from jsonb_array_elements(v_deck) elem
          ) t where idx > 1;
        end if;
      end loop;
      v_hands := jsonb_set(v_hands, array[v_next_seat::text], v_opp_hand, true);
      v_card_counts := jsonb_set(v_card_counts, array[v_next_seat::text], to_jsonb(jsonb_array_length(v_opp_hand)), true);

      v_turn := public.uno_next_seat(me.seat, v_dir * 2, v_n_players);
      v_msg := 'Player ' || me.seat || ' played Draw Two! Player ' || v_next_seat || ' drew 2 cards and lost turn. Player ' || v_turn || '''s turn.';
    elsif v_card_val = 'wild_draw4' then
      v_next_seat := public.uno_next_seat(me.seat, v_dir, v_n_players);
      v_pending := jsonb_build_object(
        'challengerSeat', v_next_seat,
        'targetSeat', me.seat,
        'wasBluff', v_was_bluff,
        'chosenColor', v_chosen_color
      );
      v_turn := v_next_seat;
      v_msg := 'Player ' || me.seat || ' played Wild Draw Four (+4) and picked ' || upper(v_chosen_color) || '! Player ' || v_next_seat || ' must Accept or Challenge!';
    elsif v_card_val = 'wild' then
      v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
      v_msg := 'Player ' || me.seat || ' played Wild and set active color to ' || upper(v_chosen_color) || '! Player ' || v_turn || '''s turn.';
    else
      v_turn := public.uno_next_seat(me.seat, v_dir, v_n_players);
      v_msg := 'Player ' || me.seat || ' played ' || initcap(v_card_color) || ' ' || v_card_val || '. Player ' || v_turn || '''s turn.';
    end if;

    -- Check UNO Call Status (when left with 1 card)
    if jsonb_array_length(v_hand) = 1 then
      if not coalesce((v_uno_called->>me.seat::text)::boolean, false) then
        v_uno_vulnerable := me.seat;
      end if;
    end if;

    -- Check Round Victory (0 cards left)
    if jsonb_array_length(v_hand) = 0 then
      -- Sum points from remaining cards in opponents' hands
      for v_opp in select seat from public.game_players where room_id = p_room and seat <> me.seat loop
        v_opp_hand := coalesce(v_hands->v_opp.seat::text, '[]'::jsonb);
        for v_opp_card in select elem from jsonb_array_elements(v_opp_hand) elem loop
          v_card_val := v_opp_card->>'value';
          v_card_pts := case
            when v_card_val in ('wild', 'wild_draw4') then 50
            when v_card_val in ('skip', 'reverse', 'draw2') then 20
            else coalesce(v_card_val::int, 0)
          end;
          v_round_pts := v_round_pts + v_card_pts;
        end loop;
      end loop;

      v_cur_score := coalesce((v_scores->>me.seat::text)::int, 0);
      v_new_score := v_cur_score + v_round_pts;
      v_scores := jsonb_set(v_scores, array[me.seat::text], to_jsonb(v_new_score), true);

      if v_new_score >= 500 then
        r.status := 'completed';
        v_winner_seat := me.seat;
        v_msg := 'Player ' || me.seat || ' won the round (+ ' || v_round_pts || ' pts) and reached 500+ points to WIN THE GAME! 🏆';
      else
        v_msg := 'Player ' || me.seat || ' won the round (+ ' || v_round_pts || ' pts)! Total score: ' || v_new_score || '/500 points.';
      end if;
    end if;

    state := jsonb_set(state, '{turn}', to_jsonb(v_turn), true);
    state := jsonb_set(state, '{direction}', to_jsonb(v_dir), true);
    state := jsonb_set(state, '{activeColor}', to_jsonb(v_active_color), true);
    state := jsonb_set(state, '{topCard}', v_top_card, true);
    state := jsonb_set(state, '{cardCounts}', v_card_counts, true);
    state := jsonb_set(state, '{scores}', v_scores, true);
    state := jsonb_set(state, '{unoVulnerableSeat}', case when v_uno_vulnerable is not null then to_jsonb(v_uno_vulnerable) else 'null'::jsonb end, true);
    state := jsonb_set(state, '{challenge}', case when v_pending is not null then v_pending else 'null'::jsonb end, true);
    state := jsonb_set(state, '{drawnCardId}', 'null'::jsonb, true);
    state := jsonb_set(state, '{message}', to_jsonb(v_msg), true);
    if v_winner_seat is not null then
      state := jsonb_set(state, '{winnerSeat}', to_jsonb(v_winner_seat), true);
    end if;

  else
    raise exception 'Invalid UNO action: %', p_action;
  end if;

  -- Save private state
  update private.uno_games set
    deck = v_deck,
    hands = v_hands,
    uno_called = v_uno_called,
    uno_vulnerable_seat = v_uno_vulnerable,
    pending_challenge = v_pending,
    updated_at = now()
  where room_id = p_room;

  -- Update public room state
  update public.game_rooms set
    public_state = state,
    status = r.status,
    state_version = state_version + 1,
    updated_at = now()
  where id = p_room;

  if r.status = 'completed' then
    perform public.finalize_room(p_room, state, r.game_type);
  end if;

  return state;
grant execute on function public.play_uno_action(uuid, text, text, int) to anon, authenticated;

-- 9. Update rematch_room to ready all AI bots and reset UNO state
create or replace function public.rematch_room(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare room_row public.game_rooms;
begin
  select * into room_row from public.game_rooms where id=p_room for update;
  if room_row.id is null then raise exception 'Room not found'; end if;
  if room_row.host_id<>auth.uid() then raise exception 'Only host can rematch'; end if;

  delete from private.rps_choices where room_id=p_room;
  delete from private.uno_games where room_id=p_room;
  update public.game_players set is_ready=false, score=0 where room_id=p_room;
  -- Automatically set all AI bots in the room to is_ready=true after rematch
  update public.game_players set is_ready=true
    where room_id=p_room and player_id::text like '11111111-1111-1111-1111-%';
  update public.game_rooms
    set status='waiting', public_state='{}', match_number=match_number+1,
        state_version=state_version+1, updated_at=now()
    where id=p_room;
end $$;

grant execute on function public.rematch_room(uuid) to authenticated;
