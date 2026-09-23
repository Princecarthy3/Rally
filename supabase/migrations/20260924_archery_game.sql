-- Rally Archery: 10 arrows per player, score-based multiplayer game
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno','rps','number_guess',
    'memory_match','mini_golf','battleship','ping_pong','tic_tac_toe',
    'connect_four','dots_boxes','skribbl','ludo','racing','rally_racing',
    'archery'
  ));

create or replace function public.create_game_room(p_game_type text, p_max_players int default 2)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_room uuid;
  v_max int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_game_type not in (
    'basketball','dice_dash','trivia_clash','uno','rps','number_guess',
    'memory_match','mini_golf','battleship','ping_pong','tic_tac_toe',
    'connect_four','dots_boxes','skribbl','ludo','racing','rally_racing','archery'
  ) then raise exception 'Unknown game: %', p_game_type; end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship','basketball') then 2
    when p_game_type in ('racing','rally_racing','archery') then greatest(2, least(4, coalesce(p_max_players, 4)))
    else greatest(2, least(4, coalesce(p_max_players, 2)))
  end;

  loop
    v_code := public.random_room_code();
    exit when not exists(select 1 from public.game_rooms where code = v_code);
  end loop;

  insert into public.game_rooms(code, game_type, host_id, max_players, status, public_state)
  values (v_code, p_game_type, auth.uid(), v_max, 'waiting', '{}'::jsonb)
  returning id into v_room;

  insert into public.game_players(room_id, player_id, seat, is_ready)
  values (v_room, auth.uid(), 1, false);
  return v_code;
end;
$$;

grant execute on function public.create_game_room(text, int) to authenticated;

create or replace function public.start_archery_game(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  n int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id = p_room;
  if n < 1 or exists(select 1 from public.game_players where room_id = p_room and not is_ready) then
    raise exception 'Everyone must be ready';
  end if;

  update public.game_rooms
  set status = 'playing',
      public_state = jsonb_build_object(
        'stage', 'shooting', 'scores', '{}'::jsonb, 'shots', '{}'::jsonb,
        'arrows', 0, 'totalArrows', 10, 'message', 'Take aim!'
      ),
      state_version = state_version + 1, updated_at = now()
  where id = p_room;
end;
$$;

grant execute on function public.start_archery_game(uuid) to authenticated;

create or replace function public.play_archery_action(
  p_room uuid, p_action text, p_value text default null, p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  score int;
  shot_count int;
  total_shots int;
  top_score int;
  winner int;
  all_done boolean;
  aim int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.status <> 'playing' or r.game_type <> 'archery' then
    raise exception 'Archery is not active';
  end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id = p_room and seat = p_actor_seat
      and player_id::text like '11111111-1111-1111-1111-%';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  end if;
  if me.id is null then raise exception 'You are not a player'; end if;
  if p_action <> 'shoot' then raise exception 'Invalid archery action'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  shot_count := coalesce((state->'shots'->>me.seat::text)::int, 0);
  if shot_count >= 10 then raise exception 'No arrows remaining'; end if;

  aim := greatest(0, least(10, coalesce(nullif(p_value, '')::int, 0)));
  score := coalesce((state->'scores'->>me.seat::text)::int, 0) + aim;
  state := jsonb_set(state, array['shots', me.seat::text], to_jsonb(shot_count + 1), true);
  state := jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
  state := jsonb_set(state, '{lastScore}', to_jsonb(aim), true);
  total_shots := coalesce((state->>'arrows')::int, 0) + 1;
  state := jsonb_set(state, '{arrows}', to_jsonb(total_shots), true);

  select bool_and(coalesce((state->'shots'->>seat::text)::int, 0) >= 10)
    into all_done from public.game_players where room_id = p_room;

  if all_done then
    select max(coalesce((state->'scores'->>seat::text)::int, 0)) into top_score
      from public.game_players where room_id = p_room;
    select seat into winner from public.game_players
      where room_id = p_room and coalesce((state->'scores'->>seat::text)::int, 0) = top_score
      order by seat limit 1;
    r.status := 'completed';
    state := jsonb_set(state, '{stage}', '"results"'::jsonb, true);
    state := jsonb_set(state, '{winnerSeat}', to_jsonb(winner), true);
    state := jsonb_set(state, '{message}', to_jsonb(('Player ' || winner || ' wins with ' || top_score || ' points!')::text), true);
  else
    state := jsonb_set(state, '{message}', to_jsonb(('Player ' || me.seat || ' scored ' || aim || '. Keep shooting!')::text), true);
  end if;

  update public.game_rooms
  set public_state = state, status = r.status, state_version = state_version + 1, updated_at = now()
  where id = p_room;
  if r.status = 'completed' then perform public.finalize_room(p_room, state, r.game_type); end if;
  return state;
end;
$$;

grant execute on function public.play_archery_action(uuid, text, text, integer) to anon, authenticated;
