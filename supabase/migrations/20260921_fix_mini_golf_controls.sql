-- Mini Golf: multi-bot UUID, degree angles, power 8-100, max 4 strokes/hole (fail = no score credit)
create or replace function public.play_mini_golf_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  balls jsonb;
  scores jsonb;
  shot jsonb;
  ball jsonb;
  hole int;
  angle_rad numeric;
  angle_in numeric;
  shot_power numeric;
  x numeric;
  y numeric;
  next_x numeric;
  next_y numeric;
  cup_x numeric;
  cup_y numeric;
  start_x numeric;
  start_y numeric;
  strokes int;
  next_seat int;
  active_count int;
  winner int;
  lowest int;
  water boolean := false;
  par int;
  dist numeric;
  finished boolean := false;
  scored_hole boolean := false;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.status <> 'playing' or r.game_type <> 'mini_golf' then
    raise exception 'Mini Golf is not active';
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
  if p_action <> 'shoot' then raise exception 'Invalid Mini Golf action'; end if;
  if coalesce((state->>'turn')::int, 1) <> me.seat then raise exception 'Wait for your turn'; end if;

  balls := coalesce(state->'balls', '{}'::jsonb);
  scores := coalesce(state->'scores', '{}'::jsonb);
  ball := balls->me.seat::text;
  if ball is null or coalesce((ball->>'finished')::boolean, false) then
    raise exception 'Your hole is complete';
  end if;

  shot := p_value::jsonb;
  angle_in := coalesce((shot->>'angle')::numeric, 0);
  shot_power := coalesce((shot->>'power')::numeric, 20);

  -- Accept radians (-pi..pi) or degrees (-180..180)
  if abs(angle_in) <= 3.14159265 + 0.01 then
    angle_rad := angle_in;
  else
    angle_rad := radians(angle_in);
  end if;

  -- Normalize power into usable range
  if shot_power < 1 then shot_power := 20; end if;
  if shot_power <= 40 then
    -- client often sends 8-40 aim length → scale up
    shot_power := greatest(14, least(100, shot_power * 2.2));
  else
    shot_power := greatest(14, least(100, shot_power));
  end if;

  hole := coalesce((state->>'hole')::int, 1);
  x := (ball->>'x')::numeric;
  y := (ball->>'y')::numeric;
  start_x := coalesce((state->'start'->>'x')::numeric, 12);
  start_y := coalesce((state->'start'->>'y')::numeric, 82);
  cup_x := coalesce((state->'cup'->>'x')::numeric, 86);
  cup_y := coalesce((state->'cup'->>'y')::numeric, 22);

  next_x := greatest(4, least(96, x + cos(angle_rad) * shot_power * 0.42));
  next_y := greatest(4, least(96, y + sin(angle_rad) * shot_power * 0.42));

  -- Simple water on odd progressive holes near center strip
  water := hole in (2, 5, 8) and next_x between 40 and 60 and next_y < 65;
  if water then
    next_x := start_x;
    next_y := start_y;
  end if;

  strokes := coalesce((ball->>'strokes')::int, 0) + 1;
  dist := sqrt(power(next_x - cup_x, 2) + power(next_y - cup_y, 2));

  if dist <= 7 then
    finished := true;
    scored_hole := true;
    next_x := cup_x;
    next_y := cup_y;
  elsif strokes >= 4 then
    -- Max 4 strokes: hole failed — no score credit for this hole
    finished := true;
    scored_hole := false;
  end if;

  ball := jsonb_build_object(
    'x', next_x,
    'y', next_y,
    'strokes', strokes,
    'finished', finished,
    'scored', scored_hole,
    'lost', water
  );
  balls := jsonb_set(balls, array[me.seat::text], ball, true);

  if finished and scored_hole then
    scores := jsonb_set(
      scores,
      array[me.seat::text],
      to_jsonb(coalesce((scores->>me.seat::text)::int, 0) + strokes),
      true
    );
  elsif finished and not scored_hole then
    -- No points for the hole (do not add strokes to total)
    scores := jsonb_set(
      scores,
      array[me.seat::text],
      to_jsonb(coalesce((scores->>me.seat::text)::int, 0)),
      true
    );
  end if;

  state := jsonb_set(state, '{balls}', balls, true);
  state := jsonb_set(state, '{scores}', scores, true);

  select count(*) into active_count
  from jsonb_each(balls) e
  where not coalesce((e.value->>'finished')::boolean, false);

  if active_count = 0 then
    if hole >= 9 then
      select min(coalesce((scores->>seat::text)::int, 9999)) into lowest
        from public.game_players where room_id = p_room;
      select min(seat) into winner from public.game_players
        where room_id = p_room and coalesce((scores->>seat::text)::int, 9999) = lowest;
      r.status := 'completed';
      state := jsonb_set(state, '{winnerSeat}', to_jsonb(winner), true);
      state := jsonb_set(state, '{message}', to_jsonb(
        ('Mini Golf complete! Player ' || winner || ' wins with the best score.')::text
      ), true);
    else
      hole := hole + 1;
      par := case when hole in (3, 6, 9) then 4 else 3 end;
      start_x := case when hole % 2 = 0 then 14 else 86 end;
      start_y := case when hole % 3 = 0 then 18 else 82 end;
      cup_x := 100 - start_x;
      cup_y := 100 - start_y;
      state := jsonb_set(state, '{hole}', to_jsonb(hole), true);
      state := jsonb_set(state, '{par}', to_jsonb(par), true);
      state := jsonb_set(state, '{turn}', to_jsonb(1), true);
      state := jsonb_set(state, '{start}', jsonb_build_object('x', start_x, 'y', start_y), true);
      state := jsonb_set(state, '{cup}', jsonb_build_object('x', cup_x, 'y', cup_y), true);
      state := jsonb_set(state, '{balls}', (
        select coalesce(jsonb_object_agg(
          seat::text,
          jsonb_build_object('x', start_x, 'y', start_y, 'strokes', 0, 'finished', false, 'scored', false)
        ), '{}'::jsonb)
        from public.game_players where room_id = p_room
      ), true);
      state := jsonb_set(state, '{message}', to_jsonb(
        ('Hole ' || hole || ' (max 4 strokes). Player 1 tees off!')::text
      ), true);
    end if;
  else
    select min(seat) into next_seat from public.game_players
      where room_id = p_room and seat > me.seat
        and not coalesce((balls->seat::text->>'finished')::boolean, false);
    if next_seat is null then
      select min(seat) into next_seat from public.game_players
        where room_id = p_room
          and not coalesce((balls->seat::text->>'finished')::boolean, false);
    end if;
    state := jsonb_set(state, '{turn}', to_jsonb(next_seat), true);
    state := jsonb_set(state, '{message}', to_jsonb(
      case
        when water then ('Player ' || me.seat || ' found water — back to the tee! Player ' || next_seat || ' up.')
        when finished and scored_hole then ('Player ' || me.seat || ' holed out in ' || strokes || '! Player ' || next_seat || ' up.')
        when finished and not scored_hole then ('Player ' || me.seat || ' missed the hole (4 strokes) — no points. Player ' || next_seat || ' up.')
        else ('Player ' || next_seat || ' is up! (' || strokes || '/4 strokes used)')
      end
    ), true);
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

grant execute on function public.play_mini_golf_action(uuid, text, text, int) to authenticated, anon;
