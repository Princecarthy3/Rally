-- 20261014_hex_fall.sql
-- Add Hex Fall 3D: Multi-floor falling hex survival party royale supporting 2-8 players.

alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
    'racing','rally_racing','rally_combat','combat','emoji_decode','chess','sudoku_battle','mancala',
    'hex_fall'
  ));

-- Update create_game_room to accept hex_fall with up to 8 players
create or replace function public.create_game_room(p_game_type text, p_max_players int default 2)
returns text language plpgsql security definer set search_path='' as $$
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
    'racing','rally_racing','rally_combat','combat','emoji_decode','chess','sudoku_battle','mancala',
    'hex_fall'
  ) then
    raise exception 'Unknown game';
  end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship','chess','mancala') then 2
    when p_game_type = 'hex_fall' then greatest(2, least(8, coalesce(p_max_players, 8)))
    else greatest(2, least(4, coalesce(p_max_players, 4)))
  end;

  loop
    v_code := public.random_room_code();
    exit when not exists(select 1 from public.game_rooms where code = v_code);
  end loop;

  insert into public.game_rooms(code, game_type, host_id, max_players)
  values(v_code, p_game_type, auth.uid(), v_max)
  returning id into v_room;

  insert into public.game_players(room_id, player_id, seat)
  values(v_room, auth.uid(), 1);

  return v_code;
end;
$$;

grant execute on function public.create_game_room(text, int) to authenticated;

-- Start Hex Fall RPC
create or replace function public.start_hex_fall_game(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
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
        'stage', 'countdown',
        'arena', 'hex_stadium',
        'eliminations', '[]'::jsonb,
        'winnerSeat', null,
        'startTime', extract(epoch from now())::float8,
        'message', 'Stay on the tiles!'
      ),
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room;
end;
$$;

grant execute on function public.start_hex_fall_game(uuid) to authenticated;

-- Play Hex Fall Action RPC
create or replace function public.play_hex_fall_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  eliminations jsonb;
  n int;
  target_seat int;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.status <> 'playing' or r.game_type <> 'hex_fall' then
    raise exception 'Hex Fall is not active';
  end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id = p_room and seat = p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players
    where room_id = p_room and player_id = auth.uid();
  end if;

  if me.id is null then raise exception 'Not a player in this match'; end if;

  state := coalesce(r.public_state, '{}'::jsonb);
  eliminations := coalesce(state->'eliminations', '[]'::jsonb);

  if p_action = 'eliminate_player' then
    target_seat := coalesce(p_value::int, me.seat);

    if not exists(
      select 1 from jsonb_array_elements(eliminations) elem
      where (elem->>'seat')::int = target_seat
    ) then
      select count(*) into n from public.game_players where room_id = p_room;

      eliminations := eliminations || jsonb_build_object(
        'seat', target_seat,
        'eliminated_at', now()
      );
      state := jsonb_set(state, '{eliminations}', eliminations, true);

      -- If 1 or 0 players remain alive, end match
      if jsonb_array_length(eliminations) >= n - 1 then
        r.status := 'completed';
        state := jsonb_set(state, '{stage}', '"results"'::jsonb, true);

        select seat into target_seat from public.game_players
        where room_id = p_room and seat not in (
          select (elem->>'seat')::int from jsonb_array_elements(eliminations) elem
        ) limit 1;

        if target_seat is null then target_seat := me.seat; end if;

        state := jsonb_set(state, '{winnerSeat}', to_jsonb(target_seat), true);
        state := jsonb_set(state, '{message}', '"Champion Decided!"'::jsonb, true);
      end if;
    end if;

  elsif p_action = 'restart' or p_action = 'rematch' then
    if r.host_id = auth.uid() or p_actor_seat is not null then
      update public.game_players set is_ready = false where room_id = p_room;
      -- Auto-ready bots
      update public.game_players set is_ready = true
      where room_id = p_room and player_id::text like '11111111-1111-1111-1111-%';

      r.status := 'waiting';
      state := jsonb_build_object(
        'stage', 'waiting',
        'arena', 'hex_stadium',
        'eliminations', '[]'::jsonb,
        'winnerSeat', null,
        'message', 'Waiting for players...'
      );
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

grant execute on function public.play_hex_fall_action(uuid, text, text, integer) to anon, authenticated;
