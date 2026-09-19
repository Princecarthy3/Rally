-- Fix Mini Golf: 'record "item" is not assigned yet'
-- Cause: declared variable `item record` shadowed jsonb_each alias named `item`.

create or replace function public.play_mini_golf_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; balls jsonb; scores jsonb; shot jsonb; ball jsonb; hole int; angle numeric; shot_power numeric; x numeric; y numeric; next_x numeric; next_y numeric; cup_x numeric; cup_y numeric; start_x numeric; start_y numeric; strokes int; next_seat int; active_count int; winner int; lowest int; count_tied int; water boolean:=false; par int; item record;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'mini_golf' then raise exception 'Mini Golf is not active'; end if;
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
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
  select count(*) into active_count from jsonb_each(balls) as ball_row where not coalesce((ball_row.value->>'finished')::boolean,false);
  if active_count=0 then
    if hole>=9 then
      select min(coalesce((scores->>seat::text)::int,0)) into lowest from public.game_players where room_id=p_room;
      select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((scores->>seat::text)::int,0)=lowest;
      if count_tied=1 then
        select min(seat) into winner from public.game_players where room_id=p_room and coalesce((scores->>seat::text)::int,0)=lowest;
        r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb(('Mini Golf complete! Player '||winner||' wins!')::text),true);
      else
        hole:=hole+1; start_x:=12; start_y:=82; cup_x:=84; cup_y:=18; par:=3;
        state:=jsonb_set(state,'{hole}',to_jsonb(hole),true); state:=jsonb_set(state,'{par}',to_jsonb(par),true);
        state:=jsonb_set(state,'{start}',jsonb_build_object('x',start_x,'y',start_y),true); state:=jsonb_set(state,'{cup}',jsonb_build_object('x',cup_x,'y',cup_y),true);
        balls:='{}'::jsonb; for item in select seat from public.game_players where room_id=p_room loop balls:=jsonb_set(balls,array[item.seat::text],jsonb_build_object('x',start_x,'y',start_y,'strokes',0,'finished',false),true); end loop;
        state:=jsonb_set(state,'{balls}',balls,true); state:=jsonb_set(state,'{turn}',to_jsonb(1),true); state:=jsonb_set(state,'{message}',to_jsonb(('Sudden Death Hole '||hole||'! Tied for 1st place! Player 1 tees off!')::text),true);
      end if;
    else
      hole:=hole+1;
      start_x:=case hole when 2 then 14 when 3 then 12 when 4 then 15 when 5 then 10 when 6 then 14 when 7 then 12 when 8 then 15 else 12 end;
      start_y:=case hole when 2 then 84 when 3 then 80 when 4 then 82 when 5 then 86 when 6 then 84 when 7 then 82 when 8 then 86 else 82 end;
      cup_x:=case hole when 2 then 82 when 3 then 86 when 4 then 84 when 5 then 88 when 6 then 82 when 7 then 85 when 8 then 86 else 84 end;
      cup_y:=case hole when 2 then 20 when 3 then 16 when 4 then 18 when 5 then 14 when 6 then 20 when 7 then 18 when 8 then 16 else 18 end;
      par:=case hole when 2 then 4 when 3 then 3 when 4 then 4 when 5 then 5 when 6 then 3 when 7 then 4 when 8 then 5 else 3 end;
      state:=jsonb_set(state,'{hole}',to_jsonb(hole),true); state:=jsonb_set(state,'{par}',to_jsonb(par),true);
      state:=jsonb_set(state,'{start}',jsonb_build_object('x',start_x,'y',start_y),true); state:=jsonb_set(state,'{cup}',jsonb_build_object('x',cup_x,'y',cup_y),true);
      balls:='{}'::jsonb; for item in select seat from public.game_players where room_id=p_room loop balls:=jsonb_set(balls,array[item.seat::text],jsonb_build_object('x',start_x,'y',start_y,'strokes',0,'finished',false),true); end loop;
      state:=jsonb_set(state,'{balls}',balls,true); state:=jsonb_set(state,'{turn}',to_jsonb(1),true); state:=jsonb_set(state,'{message}',to_jsonb(('Hole '||hole||' of 9! Player 1 tees off.')::text),true);
    end if;
  else
    select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat and not coalesce((balls->seat::text->>'finished')::boolean,false);
    if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room and not coalesce((balls->seat::text->>'finished')::boolean,false); end if;
    state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true); state:=jsonb_set(state,'{message}',to_jsonb(('Player '||next_seat||'''s turn to shoot.')::text),true);
  end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- 7. Battleship action handler

grant execute on function public.play_mini_golf_action(uuid,text,text,integer) to anon, authenticated;
