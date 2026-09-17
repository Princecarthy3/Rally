-- A player-controlled 10x10 Battleship implementation. Ship positions stay in
-- private.battleship_boards; public_state only contains fired coordinates.
alter table private.battleship_boards alter column ships set default '{}'::jsonb;

create or replace function public.start_battleship(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int; bot_seat int;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if r.id is null or r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
 if r.status<>'waiting' then raise exception 'Game already started'; end if;
 select count(*) into n from public.game_players where room_id=p_room;
 if n<>2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Battleship needs two ready players'; end if;
 delete from private.battleship_boards where room_id=p_room;
 insert into private.battleship_boards(room_id,seat,ships,hits) select p_room,seat,'{}'::jsonb,'[]'::jsonb from public.game_players where room_id=p_room;
 update public.game_rooms set status='playing',public_state=jsonb_build_object('phase','placing','placements','{}'::jsonb,'shots','{}'::jsonb,'stats',jsonb_build_object('1',jsonb_build_object('hits',0,'misses',0,'sunk',0),'2',jsonb_build_object('hits',0,'misses',0,'sunk',0)),'remaining',jsonb_build_object('1',5,'2',5),'message','Place your fleet, then lock it in.'),state_version=state_version+1,updated_at=now() where id=p_room;
 select seat into bot_seat from public.game_players where room_id=p_room and player_id='11111111-1111-1111-1111-111111111111';
 if bot_seat is not null then perform public.play_battleship_action(p_room,'randomize_fleet',null,bot_seat); perform public.play_battleship_action(p_room,'ready',null,bot_seat); end if;
end $$;

create or replace function public.get_battleship_private_state(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.game_players; board private.battleship_boards;
begin
 select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); if me.id is null then raise exception 'Not a player'; end if;
 select * into board from private.battleship_boards where room_id=p_room and seat=me.seat;
 return jsonb_build_object('ships',coalesce(board.ships,'{}'::jsonb),'hits',coalesce(board.hits,'[]'::jsonb));
end $$;

create or replace function public.play_battleship_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; target public.game_players; board private.battleship_boards; target_board private.battleship_boards; state jsonb; v_ships jsonb; placements jsonb; shots jsonb; mine jsonb; stats jsonb; cells jsonb; new_hits jsonb; ship_id text; orient text; sunk text; row_no int; col_no int; size int; i int; cell int; hit boolean; remaining int; all_ready boolean;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if r.id is null or r.status<>'playing' or r.game_type<>'battleship' then raise exception 'Battleship is not active'; end if;
 if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; else select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
 if me.id is null then raise exception 'Not a player'; end if;
 state:=r.public_state; placements:=coalesce(state->'placements','{}'::jsonb);
 if state->>'phase'='placing' then
  if p_action='randomize_fleet' then
   v_ships:='{}'::jsonb;
   foreach ship_id in array array['carrier','battleship','cruiser','submarine','destroyer'] loop
    size:=case ship_id when 'carrier' then 5 when 'battleship' then 4 when 'cruiser' then 3 when 'submarine' then 3 else 2 end;
    loop
     orient:=case when random()<.5 then 'horizontal' else 'vertical' end; row_no:=floor(random()*(case when orient='vertical' then 11-size else 10 end))::int; col_no:=floor(random()*(case when orient='horizontal' then 11-size else 10 end))::int; cells:='[]'::jsonb;
     for i in 0..size-1 loop cell:=case when orient='horizontal' then row_no*10+col_no+i else (row_no+i)*10+col_no end; cells:=cells||to_jsonb(cell); end loop;
     exit when not exists(select 1 from jsonb_each(v_ships) e,jsonb_array_elements_text(e.value->'cells') x where x.value::int in (select value::int from jsonb_array_elements_text(cells)));
    end loop;
    v_ships:=jsonb_set(v_ships,array[ship_id],jsonb_build_object('id',ship_id,'size',size,'cells',cells),true);
   end loop;
   update private.battleship_boards set ships=v_ships,hits='[]'::jsonb where room_id=p_room and seat=me.seat;
  elsif p_action='place_ship' then
   if placements ? me.seat::text then raise exception 'Your fleet is already locked'; end if;
   begin ship_id:=p_value::jsonb->>'ship'; row_no:=(p_value::jsonb->>'row')::int; col_no:=(p_value::jsonb->>'col')::int; orient:=p_value::jsonb->>'orientation'; exception when others then raise exception 'Invalid ship placement'; end;
   size:=case ship_id when 'carrier' then 5 when 'battleship' then 4 when 'cruiser' then 3 when 'submarine' then 3 when 'destroyer' then 2 else 0 end;
   if size=0 or orient not in ('horizontal','vertical') or row_no not between 0 and 9 or col_no not between 0 and 9 or (orient='horizontal' and col_no+size>10) or (orient='vertical' and row_no+size>10) then raise exception 'That ship does not fit there'; end if;
   select * into board from private.battleship_boards where room_id=p_room and seat=me.seat for update; v_ships:=coalesce(board.ships,'{}'::jsonb); cells:='[]'::jsonb;
   for i in 0..size-1 loop cell:=case when orient='horizontal' then row_no*10+col_no+i else (row_no+i)*10+col_no end; cells:=cells||to_jsonb(cell); end loop;
   if exists(select 1 from jsonb_each(v_ships) e,jsonb_array_elements_text(e.value->'cells') x where e.key<>ship_id and x.value::int in (select value::int from jsonb_array_elements_text(cells))) then raise exception 'Ships cannot overlap'; end if;
   v_ships:=jsonb_set(v_ships,array[ship_id],jsonb_build_object('id',ship_id,'size',size,'cells',cells),true); update private.battleship_boards set ships=v_ships where room_id=p_room and seat=me.seat;
  elsif p_action='ready' then
   select * into board from private.battleship_boards where room_id=p_room and seat=me.seat;
   if (select count(*) from jsonb_object_keys(coalesce(board.ships,'{}'::jsonb)))<>5 then raise exception 'Place every ship before continuing'; end if;
   placements:=jsonb_set(placements,array[me.seat::text],'true'::jsonb,true); state:=jsonb_set(state,'{placements}',placements,true); select count(*)=2 into all_ready from jsonb_object_keys(placements);
   if all_ready then state:=jsonb_set(state,'{phase}','"playing"'::jsonb,true);state:=jsonb_set(state,'{turn}','1'::jsonb,true);state:=jsonb_set(state,'{message}','"Battle stations! Player 1 fires first."'::jsonb,true);else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' is ready. Waiting for opponent.')::text),true);end if;
  else raise exception 'Unknown Battleship action'; end if;
 elsif state->>'phase'='playing' then
  if p_action<>'fire' or p_value !~ '^[0-9],[0-9]$' then raise exception 'Choose a coordinate on the board'; end if; if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
  row_no:=split_part(p_value,',',1)::int;col_no:=split_part(p_value,',',2)::int;cell:=row_no*10+col_no;shots:=coalesce(state->'shots','{}'::jsonb);mine:=coalesce(shots->me.seat::text,'[]'::jsonb);
  if exists(select 1 from jsonb_array_elements(mine) x where (x->>'row')::int=row_no and (x->>'col')::int=col_no) then raise exception 'You already fired there';end if;
  select * into target from public.game_players where room_id=p_room and seat<>me.seat;select * into target_board from private.battleship_boards where room_id=p_room and seat=target.seat for update;
  hit:=exists(select 1 from jsonb_each(target_board.ships) e,jsonb_array_elements_text(e.value->'cells') x where x.value::int=cell);new_hits:=case when hit then target_board.hits||to_jsonb(cell) else target_board.hits end;sunk:=null;
  if hit then select e.key into sunk from jsonb_each(target_board.ships) e where not exists(select 1 from jsonb_array_elements_text(e.value->'cells') x where not(new_hits @> jsonb_build_array(x.value::int)));update private.battleship_boards set hits=new_hits where room_id=p_room and seat=target.seat;end if;
  mine:=mine||jsonb_build_object('row',row_no,'col',col_no,'hit',hit,'sunk',sunk);shots:=jsonb_set(shots,array[me.seat::text],mine,true);state:=jsonb_set(state,'{shots}',shots,true);stats:=coalesce(state->'stats','{}'::jsonb);stats:=jsonb_set(stats,array[me.seat::text,case when hit then 'hits' else 'misses' end],to_jsonb(coalesce((stats->me.seat::text->>case when hit then 'hits' else 'misses' end)::int,0)+1),true);if sunk is not null then stats:=jsonb_set(stats,array[me.seat::text,'sunk'],to_jsonb(coalesce((stats->me.seat::text->>'sunk')::int,0)+1),true);end if;state:=jsonb_set(state,'{stats}',stats,true);
  select count(*) into remaining from jsonb_each(target_board.ships) e where exists(select 1 from jsonb_array_elements_text(e.value->'cells') x where not(new_hits @> jsonb_build_array(x.value::int)));state:=jsonb_set(state,array['remaining',target.seat::text],to_jsonb(remaining),true);
  if remaining=0 then r.status:='completed';state:=jsonb_set(state,'{phase}','"finished"'::jsonb,true);state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat),true);state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' sank every ship!')::text),true);else state:=jsonb_set(state,'{turn}',to_jsonb(target.seat),true);state:=jsonb_set(state,'{message}',to_jsonb(case when sunk is not null then ('Player '||me.seat||' sank the '||initcap(sunk)||'!') when hit then ('Hit! Player '||target.seat||' to fire.') else ('Miss. Player '||target.seat||' to fire.') end),true);end if;
 else raise exception 'Battleship has finished';end if;
 update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type);end if;return state;
end $$;
grant execute on function public.start_battleship(uuid),public.get_battleship_private_state(uuid) to authenticated;
grant execute on function public.play_battleship_action(uuid,text,text,integer) to anon,authenticated;
