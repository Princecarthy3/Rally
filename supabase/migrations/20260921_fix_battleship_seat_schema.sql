-- Battleship boards are seat-keyed (not player_id). Rebuild start/play/private RPCs.

create table if not exists private.battleship_boards (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  seat integer not null,
  ships jsonb not null default '{}'::jsonb,
  hits jsonb not null default '[]'::jsonb,
  primary key (room_id, seat)
);

-- Drop legacy player_id column if a bad migration added it
do $$ begin
  alter table private.battleship_boards drop column if exists player_id;
exception when others then null;
end $$;

create or replace function public.start_battleship(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  n int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null then raise exception 'Room not found'; end if;
  if r.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  if r.game_type <> 'battleship' then raise exception 'Not a battleship room'; end if;

  select count(*) into n from public.game_players where room_id=p_room;
  if n <> 2 then raise exception 'Battleship needs exactly 2 players'; end if;
  if exists(select 1 from public.game_players where room_id=p_room and not is_ready) then
    raise exception 'All players must be ready';
  end if;

  delete from private.battleship_boards where room_id=p_room;
  insert into private.battleship_boards(room_id, seat, ships, hits)
  select p_room, seat, '{}'::jsonb, '[]'::jsonb
  from public.game_players where room_id=p_room;

  update public.game_rooms
  set status='playing',
      state_version=state_version+1,
      public_state=jsonb_build_object(
        'phase','placing',
        'turn',1,
        'shots',jsonb_build_object('1','[]'::jsonb,'2','[]'::jsonb),
        'stats',jsonb_build_object(
          '1',jsonb_build_object('hits',0,'misses',0,'sunk',0),
          '2',jsonb_build_object('hits',0,'misses',0,'sunk',0)
        ),
        'placements',jsonb_build_object('1',false,'2',false),
        'remaining',jsonb_build_object('1',5,'2',5),
        'message','Place your fleet. Both captains must lock in before battle.'
      ),
      updated_at=now()
  where id=p_room;
end;
$$;

create or replace function public.get_battleship_private_state(p_room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  me public.game_players;
  board private.battleship_boards;
begin
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  if me.id is null then raise exception 'Not a player'; end if;
  select * into board from private.battleship_boards where room_id=p_room and seat=me.seat;
  return jsonb_build_object('ships', coalesce(board.ships,'{}'::jsonb), 'hits', coalesce(board.hits,'[]'::jsonb));
end;
$$;

create or replace function public.play_battleship_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  target public.game_players;
  board private.battleship_boards;
  target_board private.battleship_boards;
  state jsonb;
  v_ships jsonb;
  ship_id text;
  size int;
  cells jsonb;
  row_no int;
  col_no int;
  horizontal boolean;
  i int;
  cell int;
  occupied int[];
  c int;
  ok boolean;
  placed_count int;
  both_ready boolean;
  shots jsonb;
  mine jsonb;
  hit boolean;
  new_hits jsonb;
  sunk text;
  remaining int;
  stats jsonb;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.status<>'playing' or r.game_type<>'battleship' then
    raise exception 'Battleship is not active';
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

  state:=coalesce(r.public_state,'{}'::jsonb);

  if p_action='randomize_fleet' then
    if coalesce(state->>'phase','placing')<>'placing' then raise exception 'Fleet is locked'; end if;
    if coalesce((state->'placements'->>me.seat::text)::boolean,false) then raise exception 'Fleet already locked'; end if;
    v_ships:='{}'::jsonb;
    occupied:=array[]::int[];
    foreach ship_id in array array['carrier','battleship','cruiser','submarine','destroyer'] loop
      size:=case ship_id when 'carrier' then 5 when 'battleship' then 4 when 'cruiser' then 3 when 'submarine' then 3 else 2 end;
      ok:=false;
      for i in 1..80 loop
        horizontal:=(random()<0.5);
        row_no:=floor(random()*8)::int;
        col_no:=floor(random()*8)::int;
        if horizontal and col_no+size>8 then continue; end if;
        if not horizontal and row_no+size>8 then continue; end if;
        cells:='[]'::jsonb;
        ok:=true;
        for c in 0..size-1 loop
          cell:=case when horizontal then row_no*8+(col_no+c) else (row_no+c)*8+col_no end;
          if cell = any(occupied) then ok:=false; exit; end if;
          cells:=cells||to_jsonb(cell);
        end loop;
        if ok then
          for c in 0..jsonb_array_length(cells)-1 loop
            occupied:=occupied||(cells->>c)::int;
          end loop;
          v_ships:=jsonb_set(v_ships,array[ship_id],jsonb_build_object('id',ship_id,'size',size,'cells',cells),true);
          exit;
        end if;
      end loop;
      if not ok then raise exception 'Could not place fleet — try again'; end if;
    end loop;
    update private.battleship_boards set ships=v_ships, hits='[]'::jsonb where room_id=p_room and seat=me.seat;
    state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' randomized their fleet.')::text),true);

  elsif p_action='place_ship' then
    if coalesce(state->>'phase','placing')<>'placing' then raise exception 'Fleet is locked'; end if;
    if coalesce((state->'placements'->>me.seat::text)::boolean,false) then raise exception 'Fleet already locked'; end if;
    -- value: shipId,row,col,H|V
    ship_id:=split_part(coalesce(p_value,''),',',1);
    row_no:=split_part(coalesce(p_value,''),',',2)::int;
    col_no:=split_part(coalesce(p_value,''),',',3)::int;
    horizontal:=upper(split_part(coalesce(p_value,''),',',4)) in ('H','TRUE','1');
    size:=case ship_id when 'carrier' then 5 when 'battleship' then 4 when 'cruiser' then 3 when 'submarine' then 3 when 'destroyer' then 2 else 0 end;
    if size=0 then raise exception 'Unknown ship'; end if;
    if row_no<0 or row_no>7 or col_no<0 or col_no>7 then raise exception 'Out of bounds'; end if;
    if horizontal and col_no+size>8 then raise exception 'Ship does not fit'; end if;
    if not horizontal and row_no+size>8 then raise exception 'Ship does not fit'; end if;

    select * into board from private.battleship_boards where room_id=p_room and seat=me.seat for update;
    v_ships:=coalesce(board.ships,'{}'::jsonb);
    -- Occupancy = all cells of other ships (exclude the one being moved)
    select coalesce(array_agg((x.value)::int), array[]::int[]) into occupied
    from jsonb_each(v_ships) e
    cross join lateral jsonb_array_elements_text(e.value->'cells') x
    where e.key <> ship_id;
    cells:='[]'::jsonb;
    for c in 0..size-1 loop
      cell:=case when horizontal then row_no*8+(col_no+c) else (row_no+c)*8+col_no end;
      if cell = any(occupied) then raise exception 'Ships cannot overlap'; end if;
      cells:=cells||to_jsonb(cell);
    end loop;
    v_ships:=jsonb_set(v_ships,array[ship_id],jsonb_build_object('id',ship_id,'size',size,'cells',cells),true);
    update private.battleship_boards set ships=v_ships where room_id=p_room and seat=me.seat;
    state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' placed the '||initcap(ship_id)||'.')::text),true);

  elsif p_action='lock_fleet' then
    if coalesce(state->>'phase','placing')<>'placing' then raise exception 'Already in battle'; end if;
    select * into board from private.battleship_boards where room_id=p_room and seat=me.seat;
    select count(*) into placed_count from jsonb_object_keys(coalesce(board.ships,'{}'::jsonb));
    if placed_count < 5 then raise exception 'Place all 5 ships before locking'; end if;
    state:=jsonb_set(state,array['placements',me.seat::text],'true'::jsonb,true);
    both_ready:=coalesce((state->'placements'->>'1')::boolean,false) and coalesce((state->'placements'->>'2')::boolean,false);
    if both_ready then
      state:=jsonb_set(state,'{phase}','"playing"'::jsonb,true);
      state:=jsonb_set(state,'{turn}','1'::jsonb,true);
      state:=jsonb_set(state,'{message}','"Battle stations! Player 1 fires first."'::jsonb,true);
    else
      state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked fleet. Waiting for opponent…')::text),true);
    end if;

  elsif p_action='fire' then
    if coalesce(state->>'phase','')<>'playing' then raise exception 'Battle has not started'; end if;
    if coalesce((state->>'turn')::int,0)<>me.seat then raise exception 'Not your turn'; end if;
    row_no:=split_part(coalesce(p_value,''),',',1)::int;
    col_no:=split_part(coalesce(p_value,''),',',2)::int;
    if row_no<0 or row_no>7 or col_no<0 or col_no>7 then raise exception 'Invalid target'; end if;
    cell:=row_no*8+col_no;

    select * into target from public.game_players where room_id=p_room and seat<>me.seat limit 1;
    if target.id is null then raise exception 'No opponent'; end if;
    select * into target_board from private.battleship_boards where room_id=p_room and seat=target.seat for update;

    shots:=coalesce(state->'shots','{}'::jsonb);
    mine:=coalesce(shots->me.seat::text,'[]'::jsonb);
    if exists(select 1 from jsonb_array_elements(mine) s where (s->>'row')::int=row_no and (s->>'col')::int=col_no) then
      raise exception 'Already fired there';
    end if;

    select exists(
      select 1 from jsonb_each(coalesce(target_board.ships,'{}'::jsonb)) e,
                   jsonb_array_elements_text(e.value->'cells') x
      where x.value::int=cell
    ) into hit;

    new_hits:=coalesce(target_board.hits,'[]'::jsonb);
    sunk:=null;
    if hit then
      new_hits:=new_hits||to_jsonb(cell);
      update private.battleship_boards set hits=new_hits where room_id=p_room and seat=target.seat;
      select e.key into sunk
      from jsonb_each(target_board.ships) e
      where not exists(
        select 1 from jsonb_array_elements_text(e.value->'cells') x
        where not (new_hits @> jsonb_build_array(x.value::int))
      )
      and exists(
        select 1 from jsonb_array_elements_text(e.value->'cells') x where x.value::int=cell
      )
      limit 1;
    end if;

    mine:=mine||jsonb_build_object('row',row_no,'col',col_no,'hit',hit,'sunk',sunk);
    shots:=jsonb_set(shots,array[me.seat::text],mine,true);
    state:=jsonb_set(state,'{shots}',shots,true);

    stats:=coalesce(state->'stats','{}'::jsonb);
    stats:=jsonb_set(stats,array[me.seat::text,case when hit then 'hits' else 'misses' end],
      to_jsonb(coalesce((stats->me.seat::text->>case when hit then 'hits' else 'misses' end)::int,0)+1),true);
    if sunk is not null then
      stats:=jsonb_set(stats,array[me.seat::text,'sunk'],
        to_jsonb(coalesce((stats->me.seat::text->>'sunk')::int,0)+1),true);
    end if;
    state:=jsonb_set(state,'{stats}',stats,true);

    select count(*) into remaining
    from jsonb_each(coalesce(target_board.ships,'{}'::jsonb)) e
    where exists(
      select 1 from jsonb_array_elements_text(e.value->'cells') x
      where not (coalesce(new_hits,'[]'::jsonb) @> jsonb_build_array(x.value::int))
    );
    state:=jsonb_set(state,array['remaining',target.seat::text],to_jsonb(remaining),true);

    if remaining=0 then
      r.status:='completed';
      state:=jsonb_set(state,'{phase}','"finished"'::jsonb,true);
      state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat),true);
      state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' sank the entire fleet!')::text),true);
    else
      state:=jsonb_set(state,'{turn}',to_jsonb(target.seat),true);
      state:=jsonb_set(state,'{message}',to_jsonb(
        case
          when sunk is not null then ('Sunk the '||initcap(sunk)||'! Player '||target.seat||' to fire.')
          when hit then ('Hit! Player '||target.seat||' to fire.')
          else ('Miss. Player '||target.seat||' to fire.')
        end
      ),true);
    end if;
  else
    raise exception 'Invalid battleship action';
  end if;

  update public.game_rooms
  set public_state=state, status=r.status, state_version=state_version+1, updated_at=now()
  where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end;
$$;

grant execute on function public.start_battleship(uuid) to authenticated;
grant execute on function public.get_battleship_private_state(uuid) to authenticated;
grant execute on function public.play_battleship_action(uuid,text,text,int) to authenticated, anon;
