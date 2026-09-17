-- Memory Match: server-owned shuffled deck and authoritative pair matching.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in ('basketball','ping_pong','rps','number_guess','trivia_clash','memory_match','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo'));

create table if not exists private.memory_match_decks (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  cards jsonb not null
);

do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, '''number_guess'',''trivia_clash'',''tic_tac_toe''', '''number_guess'',''trivia_clash'',''memory_match'',''tic_tac_toe''');
    execute definition;
  end if;
end $$;

create or replace function public.start_memory_match(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int; deck jsonb := '[]'::jsonb; symbols text[] := array['apple','rocket','dog','rainbow','ball','guitar','moon','unicorn']; i int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Everyone must be ready'; end if;
  for i in 1..8 loop deck := deck || jsonb_build_array(symbols[i], symbols[i]); end loop;
  select jsonb_agg(card order by random()) into deck from jsonb_array_elements(deck) as item(card);
  insert into private.memory_match_decks(room_id,cards) values(p_room,deck) on conflict(room_id) do update set cards=excluded.cards;
  update public.game_rooms set status='playing', public_state=jsonb_build_object('turn',1,'cards',jsonb_build_array(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null),'flipped','[]'::jsonb,'matched','[]'::jsonb,'scores','{}'::jsonb,'revealed',false,'message','Player 1 flips first!'), state_version=state_version+1, updated_at=now() where id=p_room;
end $$;

create or replace function public.play_memory_match_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; deck jsonb; cards jsonb; flipped jsonb; matched jsonb; idx int; next_seat int; score int; winner int; top_score int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'memory_match' then raise exception 'Memory Match is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  state:=r.public_state; if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
  deck:=(select d.cards from private.memory_match_decks d where d.room_id=p_room); if deck is null then raise exception 'Memory deck is missing'; end if;
  cards:=coalesce(state->'cards',jsonb_build_array(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)); flipped:=coalesce(state->'flipped','[]'::jsonb); matched:=coalesce(state->'matched','[]'::jsonb);
  if p_action='flip' then
    idx:=p_value::int; if idx<0 or idx>15 or matched ? idx::text or flipped ? idx::text then raise exception 'Invalid card'; end if;
    cards:=jsonb_set(cards,array[idx::text],deck->idx,true); flipped:=flipped||to_jsonb(idx); state:=jsonb_set(state,'{cards}',cards,true); state:=jsonb_set(state,'{flipped}',flipped,true);
    if jsonb_array_length(flipped)=2 then
      state:=jsonb_set(state,'{revealed}','true'::jsonb,true);
      if cards->(flipped->>0)=cards->(flipped->>1) then matched:=matched||flipped; state:=jsonb_set(state,'{matched}',matched,true); score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1; state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true); state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' found a pair!')::text),true);
      else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' missed. Next player goes.')::text),true); end if;
    end if;
  elsif p_action='resolve' then
    if not coalesce((state->>'revealed')::boolean,false) then raise exception 'Cards are not ready to resolve'; end if;
    flipped:=coalesce(state->'flipped','[]'::jsonb);
    if jsonb_array_length(flipped)<>2 then raise exception 'Invalid flip state'; end if;
    if cards->(flipped->>0)=cards->(flipped->>1) then
      if jsonb_array_length(matched)=16 then select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room; select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score; r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb('Memory Match complete!'::text),true); end if;
    else
      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
    end if;
    state:=jsonb_set(state,'{flipped}','[]'::jsonb,true); state:=jsonb_set(state,'{revealed}','false'::jsonb,true);
  else raise exception 'Invalid Memory Match action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

grant execute on function public.start_memory_match(uuid) to authenticated;
grant execute on function public.play_memory_match_action(uuid,text,text,integer) to anon, authenticated;
