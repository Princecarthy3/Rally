-- Rally: add Ludo and make API-driven bot moves valid.
-- Run this once in the Supabase SQL Editor before deploying the app code.

do $$
declare constraint_name text;
begin
  for constraint_name in select c.conname from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname='game_rooms' and pg_get_constraintdef(c.oid) like '%game_type%' loop
    execute format('alter table public.game_rooms drop constraint %I', constraint_name);
  end loop;
end $$;
alter table public.game_rooms add constraint game_rooms_game_type_check check (game_type in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','dice_dash','dots_boxes','skribbl','ludo'));

create or replace function public.start_ludo_game(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int; state jsonb;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' or r.game_type<>'ludo' then raise exception 'This Ludo room cannot start'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Everyone must be ready'; end if;
  state:=jsonb_build_object('turn',1,'ludoPositions',jsonb_build_object('1',jsonb_build_array(-1,-1,-1,-1),'2',jsonb_build_array(-1,-1,-1,-1),'3',jsonb_build_array(-1,-1,-1,-1),'4',jsonb_build_array(-1,-1,-1,-1)),'lastRoll',null,'awaitingMove',false,'scores','{}'::jsonb,'message','Player 1, roll the dice!');
  update public.game_rooms set status='playing',public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
end $$;

create or replace function public.play_ludo_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; roll int; token int; old_pos int; new_pos int; next_seat int; positions jsonb; other record; i int; finished boolean;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'ludo' then raise exception 'Ludo is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  state:=r.public_state;
  if coalesce((state->>'turn')::int,1)<>me.seat then raise exception 'Wait for your turn'; end if;
  positions:=state->'ludoPositions';
  if p_action='roll' then
    if coalesce((state->>'awaitingMove')::boolean,false) then raise exception 'Move a token first'; end if;
    roll:=1+floor(random()*6)::int;
    state:=jsonb_set(state,'{lastRoll}',to_jsonb(roll),true);
    state:=jsonb_set(state,'{awaitingMove}','true'::jsonb,true);
    state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' rolled a '||roll||'.')::text),true);
  elsif p_action='move' then
    if not coalesce((state->>'awaitingMove')::boolean,false) then raise exception 'Roll first'; end if;
    roll:=coalesce((state->>'lastRoll')::int,0); token:=p_value::int;
    if token=-1 then
      if exists(select 1 from jsonb_array_elements_text(positions->me.seat::text) with ordinality t(position,ord) where (roll=6 and t.position::int<57) or (roll<>6 and t.position::int>=0 and t.position::int+roll<=57)) then raise exception 'A token can move'; end if;
    else
      if token<0 or token>3 then raise exception 'Invalid token'; end if;
      old_pos:=coalesce((positions->me.seat::text->>token)::int,-1);
      if (roll=6 and old_pos>=57) or (roll<>6 and (old_pos<0 or old_pos+roll>57)) then raise exception 'That token cannot move'; end if;
      new_pos:=case when old_pos=-1 then 0 else old_pos+roll end;
      positions:=jsonb_set(positions,array[me.seat::text,token::text],to_jsonb(new_pos),true);
      -- Tokens on a shared track are captured except on each colour's start square (safe squares).
      if new_pos<52 and new_pos not in (0,8,13,21,26,34,39,47) then
        for other in select seat from public.game_players where room_id=p_room and seat<>me.seat loop
          for i in 0..3 loop
            if coalesce((positions->other.seat::text->>i)::int,-1)<52 and coalesce((positions->other.seat::text->>i)::int,-1)>=0 and ((case other.seat when 1 then 0 when 2 then 13 when 3 then 26 else 39 end + coalesce((positions->other.seat::text->>i)::int,-1)) % 52) = ((case me.seat when 1 then 0 when 2 then 13 when 3 then 26 else 39 end + new_pos) % 52) then positions:=jsonb_set(positions,array[other.seat::text,i::text],to_jsonb(-1),true); end if;
          end loop;
        end loop;
      end if;
    end if;
    finished:=not exists(select 1 from jsonb_array_elements_text(positions->me.seat::text) t where t::int<57);
    state:=jsonb_set(state,'{ludoPositions}',positions,true);
    state:=jsonb_set(state,'{awaitingMove}','false'::jsonb,true);
    state:=jsonb_set(state,'{lastRoll}','null'::jsonb,true);
    if finished then state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat),true); r.status:='completed'; state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' wins Ludo!')::text),true);
    elsif roll=6 and token<>-1 then state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' rolled 6 — roll again!')::text),true);
    else select seat into next_seat from public.game_players where room_id=p_room and seat>me.seat order by seat limit 1; if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true); state:=jsonb_set(state,'{message}',to_jsonb(('Player '||next_seat||', roll the dice!')::text),true); end if;
  else raise exception 'Invalid Ludo action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- Existing RPS function used auth.uid() even when p_actor_seat identified the bot.
-- This dedicated bot move uses the bot's database identity and lets the normal
-- player action reveal the round once both choices are present.
create or replace function public.play_bot_rps_move(p_room uuid,p_value text,p_actor_seat int) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; bot public.game_players; state jsonb; current_round int; choice_one text; choice_two text; winner int; message text;
begin
  if p_value not in ('rock','paper','scissors') then raise exception 'Invalid choice'; end if;
  select * into r from public.game_rooms where id=p_room for update;
  select * into bot from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111';
  if r.status<>'playing' or bot.id is null then raise exception 'Bot is not active'; end if;
  state:=r.public_state; current_round:=coalesce((state->>'round')::int,1);
  insert into private.rps_choices(room_id,round,player_id,choice) values(p_room,current_round,bot.player_id,p_value) on conflict do nothing;
  state:=jsonb_set(state,array['choices',bot.seat::text],to_jsonb(p_value),true);
  if (select count(*) from private.rps_choices where room_id=p_room and round=current_round) = (select count(*) from public.game_players where room_id=p_room) then
    select choice into choice_one from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=current_round and p.seat=1;
    select choice into choice_two from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=current_round and p.seat=2;
    if choice_one=choice_two then winner:=null; message:='Draw! Both players picked '||choice_one||'!';
    elsif (choice_one='rock' and choice_two='scissors') or (choice_one='scissors' and choice_two='paper') or (choice_one='paper' and choice_two='rock') then winner:=1; message:='Player 1 wins!';
    else winner:=2; message:='Player 2 wins!'; end if;
    if winner is not null then state:=jsonb_set(state,array['scores',winner::text],to_jsonb(coalesce((state->'scores'->>winner::text)::int,0)+1),true); end if;
    state:=jsonb_set(state,'{revealed}','true'::jsonb,true);
    state:=jsonb_set(state,'{history}',coalesce(state->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('round',current_round,'winnerSeat',winner,'message',message)),true);
    state:=jsonb_set(state,'{message}',to_jsonb(('Round '||current_round||' Result: '||message)::text),true);
  else state:=jsonb_set(state,'{message}',to_jsonb('Rally Bot locked in a choice.'::text),true); end if;
  update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
  return state;
end $$;
grant execute on function public.start_ludo_game(uuid), public.play_ludo_action(uuid,text,text,int) to authenticated;
grant execute on function public.play_bot_rps_move(uuid,text,int) to anon, authenticated;
