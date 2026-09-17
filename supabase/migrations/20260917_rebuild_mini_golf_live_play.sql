-- Replace the power-picker prototype with a server-owned live 2D putting game.
create or replace function public.start_mini_golf(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int; start_x numeric:=12; start_y numeric:=82;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Everyone must be ready'; end if;
  update public.game_rooms set status='playing', public_state=jsonb_build_object('hole',1,'par',3,'turn',1,'cup',jsonb_build_object('x',86,'y',22),'start',jsonb_build_object('x',start_x,'y',start_y),'balls',(select coalesce(jsonb_object_agg(seat::text,jsonb_build_object('x',start_x,'y',start_y,'strokes',0,'finished',false)),'{}'::jsonb) from public.game_players where room_id=p_room),'scores','{}'::jsonb,'message','Player 1 tees off!'), state_version=state_version+1, updated_at=now() where id=p_room;
end $$;

create or replace function public.play_mini_golf_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; balls jsonb; scores jsonb; shot jsonb; ball jsonb; hole int; angle numeric; shot_power numeric; x numeric; y numeric; next_x numeric; next_y numeric; cup_x numeric; cup_y numeric; start_x numeric; start_y numeric; strokes int; next_seat int; active_count int; winner int; lowest int; water boolean:=false; par int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'mini_golf' then raise exception 'Mini Golf is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  state:=r.public_state; if p_action<>'shoot' then raise exception 'Invalid Mini Golf action'; end if;
  if coalesce((state->>'turn')::int,1)<>me.seat then raise exception 'Wait for your turn'; end if;
  balls:=coalesce(state->'balls','{}'::jsonb); scores:=coalesce(state->'scores','{}'::jsonb); ball:=balls->me.seat::text;
  if ball is null or coalesce((ball->>'finished')::boolean,false) then raise exception 'Your hole is complete'; end if;
  shot:=p_value::jsonb; angle:=(shot->>'angle')::numeric; shot_power:=(shot->>'power')::numeric;
  if angle<-180 or angle>180 or shot_power<14 or shot_power>100 then raise exception 'Invalid shot'; end if;
  hole:=coalesce((state->>'hole')::int,1); x:=(ball->>'x')::numeric; y:=(ball->>'y')::numeric; start_x:=(state->'start'->>'x')::numeric; start_y:=(state->'start'->>'y')::numeric; cup_x:=(state->'cup'->>'x')::numeric; cup_y:=(state->'cup'->>'y')::numeric;
  next_x:=greatest(5,least(95,x+cos(radians(angle))*shot_power*.46)); next_y:=greatest(7,least(93,y+sin(radians(angle))*shot_power*.46));
  water:=hole in (2,5,8) and next_x between 43 and 57 and next_y<68;
  if water then next_x:=start_x; next_y:=start_y; end if;
  strokes:=coalesce((ball->>'strokes')::int,0)+1;
  ball:=jsonb_build_object('x',next_x,'y',next_y,'strokes',strokes,'finished',(sqrt(power(next_x-cup_x,2)+power(next_y-cup_y,2))<=6 or strokes>=8),'water',water);
  balls:=jsonb_set(balls,array[me.seat::text],ball,true); scores:=jsonb_set(scores,array[me.seat::text],to_jsonb(coalesce((scores->>me.seat::text)::int,0)+1),true); state:=jsonb_set(state,'{balls}',balls,true); state:=jsonb_set(state,'{scores}',scores,true);
  select count(*) into active_count from jsonb_each(balls) item where not coalesce((item.value->>'finished')::boolean,false);
  if active_count=0 then
    if hole>=9 then
      select min(coalesce((scores->>seat::text)::int,0)) into lowest from public.game_players where room_id=p_room;
      select min(seat) into winner from public.game_players where room_id=p_room and coalesce((scores->>seat::text)::int,0)=lowest;
      r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb('Mini Golf complete!'::text),true);
    else
      hole:=hole+1; par:=case when hole in (3,6,9) then 4 else 3 end; start_x:=case when hole%2=0 then 12 else 88 end; start_y:=case when hole%3=0 then 18 else 82 end; cup_x:=100-start_x; cup_y:=100-start_y;
      state:=jsonb_set(state,'{hole}',to_jsonb(hole),true); state:=jsonb_set(state,'{par}',to_jsonb(par),true); state:=jsonb_set(state,'{turn}',to_jsonb(1),true); state:=jsonb_set(state,'{start}',jsonb_build_object('x',start_x,'y',start_y),true); state:=jsonb_set(state,'{cup}',jsonb_build_object('x',cup_x,'y',cup_y),true); state:=jsonb_set(state,'{balls}',(select jsonb_object_agg(seat::text,jsonb_build_object('x',start_x,'y',start_y,'strokes',0,'finished',false)) from public.game_players where room_id=p_room),true); state:=jsonb_set(state,'{message}',to_jsonb(('Hole '||hole||': Player 1 tees off!')::text),true);
    end if;
  else
    select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat and not coalesce((balls->seat::text->>'finished')::boolean,false);
    if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room and not coalesce((balls->seat::text->>'finished')::boolean,false); end if;
    state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true); state:=jsonb_set(state,'{message}',to_jsonb(case when water then ('Player '||me.seat||' found water — back to the tee!') when coalesce((ball->>'finished')::boolean,false) then ('Player '||me.seat||' finished the hole!') else ('Player '||next_seat||' is up!') end),true);
  end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

grant execute on function public.start_mini_golf(uuid) to authenticated;
grant execute on function public.play_mini_golf_action(uuid,text,text,integer) to anon,authenticated;
