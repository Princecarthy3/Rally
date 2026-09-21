
-- Basketball: 10 shots per player, sequential sets (finish all 10 before opponent)
create or replace function public.play_basketball_action(
  p_room uuid, p_action text, p_value text default null, p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  my_shots int;
  score int;
  next_seat int;
  all_done boolean;
  top_score int;
  winner int;
  max_shots int := 10;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.status <> 'playing' or r.game_type <> 'basketball' then
    raise exception 'Basketball is not active';
  end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id = p_room and seat = p_actor_seat
      and player_id::text like '11111111-1111-1111-1111-%';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  end if;
  if me.id is null then raise exception 'You are not in this room'; end if;

  state := coalesce(r.public_state, jsonb_build_object(
    'turn',1,'round',1,'scores','{}'::jsonb,'shots','{}'::jsonb,'message','Player 1 takes all 10 shots first'
  ));

  if p_action <> 'shoot' then raise exception 'Invalid basketball action'; end if;
  if coalesce((state->>'turn')::int, 0) <> me.seat then raise exception 'Not your turn'; end if;

  my_shots := coalesce((state->'shots'->>me.seat::text)::int, 0);
  if my_shots >= max_shots then raise exception 'No shots remaining in your set'; end if;

  my_shots := my_shots + 1;
  state := jsonb_set(state, array['shots', me.seat::text], to_jsonb(my_shots), true);

  if lower(coalesce(p_value, '')) in ('make', '1', 'true', 'swish') then
    score := coalesce((state->'scores'->>me.seat::text)::int, 0) + 1;
    state := jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
    state := jsonb_set(state, '{lastResult}', '"make"'::jsonb, true);
  else
    state := jsonb_set(state, '{lastResult}', '"miss"'::jsonb, true);
  end if;

  -- Still has shots left in this set → keep the turn
  if my_shots < max_shots then
    state := jsonb_set(state, '{turn}', to_jsonb(me.seat), true);
    if lower(coalesce(p_value, '')) in ('make', '1', 'true', 'swish') then
      state := jsonb_set(state, '{message}', to_jsonb(
        ('SWISH! Player ' || me.seat || ' — shot ' || my_shots || '/' || max_shots || '. Keep going!')::text
      ), true);
    else
      state := jsonb_set(state, '{message}', to_jsonb(
        ('Miss. Player ' || me.seat || ' — shot ' || my_shots || '/' || max_shots || '. Keep going!')::text
      ), true);
    end if;
  else
    -- Finished set of 10: pass to next player who still has shots, or end game
    select min(seat) into next_seat from public.game_players
      where room_id = p_room and seat > me.seat
        and coalesce((state->'shots'->>seat::text)::int, 0) < max_shots;
    if next_seat is null then
      select min(seat) into next_seat from public.game_players
        where room_id = p_room
          and coalesce((state->'shots'->>seat::text)::int, 0) < max_shots;
    end if;

    select bool_and(coalesce((state->'shots'->>seat::text)::int, 0) >= max_shots)
      into all_done from public.game_players where room_id = p_room;

    if all_done then
      select max(coalesce((state->'scores'->>seat::text)::int, 0)) into top_score
        from public.game_players where room_id = p_room;
      select gp.seat into winner from public.game_players gp
        where coalesce((state->'scores'->>gp.seat::text)::int, 0) = top_score
        order by gp.seat limit 1;
      r.status := 'completed';
      state := jsonb_set(state, '{winnerSeat}', to_jsonb(winner), true);
      state := jsonb_set(state, '{message}', to_jsonb(
        ('Game over! Player ' || winner || ' wins with ' || coalesce(top_score, 0) || '/' || max_shots || ' makes.')::text
      ), true);
    else
      state := jsonb_set(state, '{turn}', to_jsonb(next_seat), true);
      state := jsonb_set(state, '{message}', to_jsonb(
        ('Player ' || me.seat || ' finished 10 shots! Player ' || next_seat || ' — your full set of 10.')::text
      ), true);
    end if;
  end if;

  update public.game_rooms
  set public_state = state, status = r.status, state_version = state_version + 1, updated_at = now()
  where id = p_room;
  if r.status = 'completed' then
    perform public.finalize_room(p_room, state, r.game_type);
  end if;
  return state;
end;
$$;

grant execute on function public.play_basketball_action(uuid, text, text, int) to authenticated, anon;

-- Start message for basketball
create or replace function public.start_game(p_room uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  n int;
  state jsonb;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null then raise exception 'Room not found'; end if;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;

  select count(*) into n from public.game_players where room_id = p_room;
  if n < 2 then raise exception 'Need at least 2 players'; end if;
  if exists(select 1 from public.game_players where room_id = p_room and not is_ready) then
    raise exception 'All players must be ready';
  end if;

  if r.game_type = 'uno' then
    perform public.start_uno_game(p_room); return;
  elsif r.game_type = 'battleship' then
    perform public.start_battleship(p_room); return;
  elsif r.game_type = 'mini_golf' then
    perform public.start_mini_golf(p_room); return;
  elsif r.game_type = 'memory_match' then
    perform public.start_memory_match(p_room); return;
  elsif r.game_type = 'ludo' then
    begin
      perform public.start_ludo_game(p_room); return;
    exception when undefined_function then null;
    end;
  end if;

  state := case r.game_type
    when 'basketball' then jsonb_build_object(
      'turn', 1, 'round', 1, 'scores', '{}'::jsonb, 'shots', '{}'::jsonb,
      'lastResult', null,
      'message', 'Player 1 takes all 10 shots first — then Player 2.'
    )
    when 'rps' then jsonb_build_object('round',1,'scores','{}'::jsonb,'choices','{}'::jsonb,'message','Make a secret pick')
    when 'number_guess' then jsonb_build_object('pickerSeat',1,'targetPicked',false,'guesses','{}'::jsonb,'round',1,'scores','{}'::jsonb,'message','Player 1 hides a number 1–25')
    when 'tic_tac_toe' then jsonb_build_object('turn',1,'board',jsonb_build_array('','','','','','','','',''),'message','Player 1 places X')
    when 'connect_four' then jsonb_build_object('turn',1,'round',1,'connectFourBoard',to_jsonb(array_fill(''::text, array[42])),'roundWins','{}'::jsonb,'message','Player 1 drops first')
    when 'dots_boxes' then jsonb_build_object('turn',1,'gridSize',3,'hLines','{}'::jsonb,'vLines','{}'::jsonb,'boxes','{}'::jsonb,'scores','{}'::jsonb,'message','Player 1, draw a line')
    when 'skribbl' then jsonb_build_object('drawerSeat',1,'round',1,'maxRounds',3,'drawIndex',0,'scores','{}'::jsonb,'usedWords','[]'::jsonb,'message','Drawer is picking a word...')
    else jsonb_build_object('scores','{}'::jsonb,'message','Game started')
  end;

  update public.game_rooms
  set status = 'playing', public_state = state, state_version = state_version + 1, updated_at = now()
  where id = p_room;
end;
$$;

grant execute on function public.start_game(uuid) to authenticated;
