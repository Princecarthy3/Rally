-- Rally Racing: allow-list + start/play RPCs

alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
    'rally_racing'
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
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
    'rally_racing'
  ) then
    raise exception 'Unknown game: %', p_game_type;
  end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship','basketball') then 2
    when p_game_type = 'rally_racing' then greatest(2, least(4, coalesce(p_max_players, 4)))
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

create or replace function public.start_rally_racing(p_room uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  n int;
  racers jsonb := '{}'::jsonb;
  seat_rec record;
  ox numeric;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null then raise exception 'Room not found'; end if;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  if r.game_type <> 'rally_racing' then raise exception 'Not a racing room'; end if;

  select count(*) into n from public.game_players where room_id = p_room;
  if n < 2 then raise exception 'Need at least 2 players'; end if;
  if exists(select 1 from public.game_players where room_id = p_room and not is_ready) then
    raise exception 'All players must be ready';
  end if;

  for seat_rec in select seat from public.game_players where room_id = p_room order by seat loop
    ox := (seat_rec.seat - 1) * 3.2 - 3.2;
    racers := jsonb_set(racers, array[seat_rec.seat::text], jsonb_build_object(
      'x', ox, 'y', 0.4, 'z', 4, 'rotY', pi(),
      'speed', 0, 'checkpoint', 0, 'progress', 0, 'finished', false
    ), true);
  end loop;

  update public.game_rooms set
    status = 'playing',
    state_version = state_version + 1,
    public_state = jsonb_build_object(
      'phase', 'countdown',
      'countdown', 3,
      'track', 'forest_run',
      'racers', racers,
      'results', '[]'::jsonb,
      'message', 'Get ready!'
    ),
    updated_at = now()
  where id = p_room;
end;
$$;

grant execute on function public.start_rally_racing(uuid) to authenticated;

create or replace function public.play_racing_action(
  p_room uuid, p_action text, p_value text default null, p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  payload jsonb;
  racer jsonb;
  seat_key text;
  cp int;
  results jsonb;
  tms int;
  finished_count int;
  total int;
  racers jsonb;
  seat_rec record;
  ox numeric;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'rally_racing' then
    raise exception 'Racing is not active';
  end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id = p_room and seat = p_actor_seat
      and player_id::text like '11111111-1111-1111-1111-%';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id = p_room and player_id = auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  seat_key := me.seat::text;

  if p_action = 'tick_countdown' then
    if coalesce(state->>'phase','') <> 'countdown' then return state; end if;
    if me.seat <> (select min(seat) from public.game_players where room_id = p_room) then
      return state;
    end if;
    cp := greatest(0, coalesce((state->>'countdown')::int, 3) - 1);
    if cp <= 0 then
      state := jsonb_set(state, '{phase}', '"racing"'::jsonb, true);
      state := jsonb_set(state, '{countdown}', '0'::jsonb, true);
      state := jsonb_set(state, '{startedAt}', to_jsonb((extract(epoch from now()) * 1000)::bigint), true);
      state := jsonb_set(state, '{message}', '"GO!"'::jsonb, true);
    else
      state := jsonb_set(state, '{countdown}', to_jsonb(cp), true);
    end if;

  elsif p_action = 'sync' then
    if coalesce(state->>'phase','') not in ('racing', 'countdown') then return state; end if;
    payload := coalesce(p_value::jsonb, '{}'::jsonb);
    racer := coalesce(state->'racers'->seat_key, '{}'::jsonb);
    if coalesce((racer->>'finished')::boolean, false) then return state; end if;
    racer := racer || jsonb_build_object(
      'x', coalesce((payload->>'x')::numeric, (racer->>'x')::numeric, 0),
      'y', coalesce((payload->>'y')::numeric, 0.4),
      'z', coalesce((payload->>'z')::numeric, (racer->>'z')::numeric, 0),
      'rotY', coalesce((payload->>'rotY')::numeric, (racer->>'rotY')::numeric, 0),
      'speed', coalesce((payload->>'speed')::numeric, 0),
      'progress', greatest(
        coalesce((racer->>'progress')::numeric, 0),
        coalesce((payload->>'progress')::numeric, 0)
      )
    );
    state := jsonb_set(state, array['racers', seat_key], racer, true);

  elsif p_action = 'checkpoint' then
    if coalesce(state->>'phase','') <> 'racing' then return state; end if;
    racer := coalesce(state->'racers'->seat_key, '{}'::jsonb);
    if coalesce((racer->>'finished')::boolean, false) then return state; end if;
    cp := coalesce(nullif(p_value, '')::int, 0);
    if cp = coalesce((racer->>'checkpoint')::int, 0) + 1 and cp <= 6 then
      racer := jsonb_set(racer, '{checkpoint}', to_jsonb(cp), true);
      state := jsonb_set(state, array['racers', seat_key], racer, true);
    end if;

  elsif p_action = 'finish' then
    if coalesce(state->>'phase','') <> 'racing' then return state; end if;
    racer := coalesce(state->'racers'->seat_key, '{}'::jsonb);
    if coalesce((racer->>'finished')::boolean, false) then return state; end if;
    if coalesce((racer->>'checkpoint')::int, 0) < 5 then
      raise exception 'Finish before checkpoints complete';
    end if;
    payload := coalesce(p_value::jsonb, '{}'::jsonb);
    tms := greatest(0, coalesce((payload->>'timeMs')::int, 0));
    racer := racer || jsonb_build_object(
      'finished', true,
      'finishTime', tms,
      'progress', 1,
      'checkpoint', 6
    );
    state := jsonb_set(state, array['racers', seat_key], racer, true);

    select count(*) into finished_count
    from jsonb_each(state->'racers') e
    where coalesce((e.value->>'finished')::boolean, false);
    select count(*) into total from public.game_players where room_id = p_room;

    if finished_count >= total then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'seat', t.seat,
            'finishTime', t.finish_time,
            'position', t.position
          ) order by t.position
        ),
        '[]'::jsonb
      )
      into results
      from (
        select
          (e.key)::int as seat,
          (e.value->>'finishTime')::int as finish_time,
          row_number() over (order by (e.value->>'finishTime')::int nulls last) as position
        from jsonb_each(state->'racers') e
      ) t;
      state := jsonb_set(state, '{results}', results, true);
      state := jsonb_set(state, '{phase}', '"finished"'::jsonb, true);
      state := jsonb_set(state, '{message}', '"Race complete!"'::jsonb, true);
      r.status := 'completed';
    end if;

  elsif p_action = 'rematch' then
    racers := '{}'::jsonb;
    for seat_rec in select seat from public.game_players where room_id = p_room order by seat loop
      ox := (seat_rec.seat - 1) * 3.2 - 3.2;
      racers := jsonb_set(racers, array[seat_rec.seat::text], jsonb_build_object(
        'x', ox, 'y', 0.4, 'z', 4, 'rotY', pi(),
        'speed', 0, 'checkpoint', 0, 'progress', 0, 'finished', false
      ), true);
    end loop;
    state := jsonb_build_object(
      'phase', 'countdown',
      'countdown', 3,
      'track', 'forest_run',
      'racers', racers,
      'results', '[]'::jsonb,
      'message', 'Rematch! Get ready!'
    );
    r.status := 'playing';

  else
    raise exception 'Invalid racing action';
  end if;

  update public.game_rooms
  set public_state = state, status = r.status, state_version = state_version + 1, updated_at = now()
  where id = p_room;
  return state;
end;
$$;

grant execute on function public.play_racing_action(uuid, text, text, int) to authenticated, anon;
