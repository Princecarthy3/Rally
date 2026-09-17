-- Mini Golf: nine holes with server-authoritative shot and stroke scoring.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in ('basketball','ping_pong','rps','number_guess','trivia_clash','memory_match','mini_golf','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo'));

do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, '''memory_match'',''tic_tac_toe''', '''memory_match'',''mini_golf'',''tic_tac_toe''');
    execute definition;
  end if;
end $$;

create or replace function public.start_mini_golf(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Everyone must be ready'; end if;
  update public.game_rooms
  set status='playing',
      public_state=jsonb_build_object('hole',1,'target',1+floor(random()*6)::int,'shots','{}'::jsonb,'scores','{}'::jsonb,'holeResults','[]'::jsonb,'message','Hole 1: choose your shot power!'),
      state_version=state_version+1, updated_at=now()
  where id=p_room;
end $$;

create or replace function public.play_mini_golf_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; shots jsonb; scores jsonb; hole_results jsonb; n int; hole int; target int; power int; strokes int; submitted int; winner int; lowest int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'mini_golf' then raise exception 'Mini Golf is not active'; end if;
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111';
  end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  if p_action<>'shot' then raise exception 'Invalid Mini Golf action'; end if;
  state:=r.public_state; hole:=coalesce((state->>'hole')::int,1); target:=coalesce((state->>'target')::int,3);
  shots:=coalesce(state->'shots','{}'::jsonb); scores:=coalesce(state->'scores','{}'::jsonb); hole_results:=coalesce(state->'holeResults','[]'::jsonb);
  if shots ? me.seat::text then raise exception 'Your shot is already locked'; end if;
  power:=p_value::int;
  if power<1 or power>6 then raise exception 'Choose a shot power from 1 to 6'; end if;
  strokes:=1+abs(power-target);
  shots:=jsonb_set(shots,array[me.seat::text],to_jsonb(power),true);
  scores:=jsonb_set(scores,array[me.seat::text],to_jsonb(coalesce((scores->>me.seat::text)::int,0)+strokes),true);
  state:=jsonb_set(state,'{shots}',shots,true); state:=jsonb_set(state,'{scores}',scores,true);
  select count(*) into n from public.game_players where room_id=p_room;
  select count(*) into submitted from jsonb_object_keys(shots);
  if submitted=n then
    hole_results:=hole_results||jsonb_build_object('hole',hole,'target',target,'strokes',scores);
    state:=jsonb_set(state,'{holeResults}',hole_results,true);
    if hole>=9 then
      select min((scores->>p.seat::text)::int) into lowest from public.game_players p where p.room_id=p_room;
      select min(p.seat) into winner from public.game_players p where p.room_id=p_room and (scores->>p.seat::text)::int=lowest;
      r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb('Mini Golf complete!'::text),true);
    else
      state:=jsonb_set(state,'{hole}',to_jsonb(hole+1),true); state:=jsonb_set(state,'{target}',to_jsonb(1+floor(random()*6)::int),true); state:=jsonb_set(state,'{shots}','{}'::jsonb,true); state:=jsonb_set(state,'{message}',to_jsonb(('Hole '||(hole+1)||': choose your shot power!')::text),true);
    end if;
  else
    state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked a shot.')::text),true);
  end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

grant execute on function public.start_mini_golf(uuid) to authenticated;
grant execute on function public.play_mini_golf_action(uuid,text,text,integer) to anon, authenticated;
