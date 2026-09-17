-- Battleship: private random fleets and public hit/miss results.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in ('basketball','ping_pong','rps','number_guess','trivia_clash','memory_match','mini_golf','battleship','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo'));

do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, '''mini_golf'',''tic_tac_toe''', '''mini_golf'',''battleship'',''tic_tac_toe''');
    execute definition;
  end if;
end $$;

create table if not exists private.battleship_boards (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  seat integer not null,
  ships jsonb not null,
  hits jsonb not null default '[]'::jsonb,
  primary key (room_id, seat)
);

create or replace function public.start_battleship(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int; seat_no int; ships jsonb; cell int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<>2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Battleship needs two ready players'; end if;
  delete from private.battleship_boards where room_id=p_room;
  for seat_no in 1..2 loop
    ships:='[]'::jsonb;
    while jsonb_array_length(ships)<5 loop
      cell:=floor(random()*25)::int;
      if not exists(select 1 from jsonb_array_elements_text(ships) item(value) where value::int=cell) then ships:=ships||to_jsonb(cell); end if;
    end loop;
    insert into private.battleship_boards(room_id,seat,ships) values(p_room,seat_no,ships);
  end loop;
  update public.game_rooms set status='playing', public_state=jsonb_build_object('turn',1,'shots','{}'::jsonb,'message','Captain 1 fires first!'), state_version=state_version+1, updated_at=now() where id=p_room;
end $$;

create or replace function public.play_battleship_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; shots jsonb; my_shots jsonb; target_board record; row_no int; col_no int; cell int; hit boolean; hit_count int; next_seat int; shot jsonb;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'battleship' then raise exception 'Battleship is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  if (r.public_state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
  if p_action<>'fire' or p_value is null or p_value !~ '^[0-4],[0-4]$' then raise exception 'Choose a coordinate on the board'; end if;
  row_no:=split_part(p_value,',',1)::int; col_no:=split_part(p_value,',',2)::int; cell:=row_no*5+col_no;
  state:=r.public_state; shots:=coalesce(state->'shots','{}'::jsonb); my_shots:=coalesce(shots->me.seat::text,'[]'::jsonb);
  if exists(select 1 from jsonb_array_elements(my_shots) item(value) where (value->>'row')::int=row_no and (value->>'col')::int=col_no) then raise exception 'You already fired there'; end if;
  select * into target_board from private.battleship_boards where room_id=p_room and seat=(case when me.seat=1 then 2 else 1 end);
  hit:=exists(select 1 from jsonb_array_elements_text(target_board.ships) item(value) where value::int=cell);
  shot:=jsonb_build_object('row',row_no,'col',col_no,'hit',hit);
  my_shots:=my_shots||shot; shots:=jsonb_set(shots,array[me.seat::text],my_shots,true); state:=jsonb_set(state,'{shots}',shots,true);
  if hit then
    update private.battleship_boards set hits=hits||to_jsonb(cell) where room_id=p_room and seat=target_board.seat;
    select jsonb_array_length(hits) into hit_count from private.battleship_boards where room_id=p_room and seat=target_board.seat;
    state:=jsonb_set(state,'{message}',to_jsonb(('Hit! Player '||me.seat||' found part of the fleet.')::text),true);
  else state:=jsonb_set(state,'{message}',to_jsonb(('Miss. Player '||me.seat||' fired into open water.')::text),true); end if;
  if hit_count=5 then
    r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat),true); state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' sank the fleet!')::text),true);
  else
    next_seat:=case when me.seat=1 then 2 else 1 end;
    state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
  end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

grant execute on function public.start_battleship(uuid) to authenticated;
grant execute on function public.play_battleship_action(uuid,text,text,integer) to anon, authenticated;
