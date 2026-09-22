-- iMessage-style basketball: 5 shots each, make/miss scoring
create or replace function public.play_basketball_action(
  p_room uuid, p_action text, p_value text default null, p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  n int;
  my_shots int;
  score int;
  next_seat int;
  all_done boolean;
  top_score int;
  winner int;
  tied int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.status<>'playing' or r.game_type<>'basketball' then
    raise exception 'Basketball is not active';
  end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id=p_room and seat=p_actor_seat
      and player_id::text like '11111111-1111-1111-1111-%';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'You are not in this room'; end if;

  state:=coalesce(r.public_state, jsonb_build_object(
    'turn',1,'round',1,'scores','{}'::jsonb,'shots','{}'::jsonb,'message','Player 1 shoots first'
  ));

  if p_action<>'shoot' then raise exception 'Invalid basketball action'; end if;
  if coalesce((state->>'turn')::int,0)<>me.seat then raise exception 'Not your turn'; end if;

  my_shots:=coalesce((state->'shots'->>me.seat::text)::int,0);
  if my_shots >= 5 then raise exception 'No shots remaining'; end if;

  state:=jsonb_set(state, array['shots', me.seat::text], to_jsonb(my_shots+1), true);

  if lower(coalesce(p_value,'')) in ('make','1','true','swish') then
    score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;
    state:=jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
    state:=jsonb_set(state, '{lastResult}', '"make"'::jsonb, true);
    state:=jsonb_set(state, '{message}', to_jsonb(('Player '||me.seat||' scores! ('||score||')')::text), true);
  else
    state:=jsonb_set(state, '{lastResult}', '"miss"'::jsonb, true);
    state:=jsonb_set(state, '{message}', to_jsonb(('Player '||me.seat||' missed.')::text), true);
  end if;

  select count(*) into n from public.game_players where room_id=p_room;
  select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat;
  if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if;

  -- If everyone has taken 5 shots, end
  select bool_and(coalesce((state->'shots'->>seat::text)::int,0) >= 5)
    into all_done from public.game_players where room_id=p_room;

  if all_done then
    select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
    select count(*) into tied from public.game_players gp where coalesce((state->'scores'->>gp.seat::text)::int,0)=top_score;
    select gp.seat into winner from public.game_players gp
      where coalesce((state->'scores'->>gp.seat::text)::int,0)=top_score order by gp.seat limit 1;
    r.status:='completed';
    state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
    state:=jsonb_set(state,'{message}',to_jsonb(
      ('Game over! Player '||winner||' wins with '||coalesce(top_score,0)||' points.')::text
    ),true);
  else
    state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
    if lower(coalesce(p_value,'')) in ('make','1','true','swish') then
      state:=jsonb_set(state,'{message}',to_jsonb(
        ('Player '||me.seat||' scores! Player '||next_seat||' is up.')::text
      ),true);
    else
      state:=jsonb_set(state,'{message}',to_jsonb(
        ('Miss. Player '||next_seat||' is up.')::text
      ),true);
    end if;
  end if;

  update public.game_rooms set public_state=state, status=r.status, state_version=state_version+1, updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end;
$$;

grant execute on function public.play_basketball_action(uuid,text,text,int) to authenticated, anon;
