-- Fix player resolution in all game action RPCs to prevent "record me is not assigned yet" PL/pgSQL errors
-- and ensure multi-bot actions correctly resolve any bot seat UUID.

-- 1. Casual games action handler (TicTacToe, ConnectFour, DotsBoxes, Uno, etc.)
drop function if exists public.play_room_action(uuid,text,text);
create or replace function public.play_room_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; n int; next_seat int; state jsonb; score int; val int; roll int; board jsonb; mark text; winner int:=null; new_boxes int:=0; r_idx int; c_idx int; key_b text; grid_size int:=3; q_idx int:=0; round_ended boolean:=false; round_winner int:=null; cur_round int:=1; round_wins jsonb; p_toks jsonb; tok_idx int; cur_pos int; new_pos int; card_id text; chosen_color text; elem jsonb; card_elem jsonb; new_hand jsonb; dir int:=1; skip_step int:=1; active_col text; card_val text; card_col text; penalty_cards jsonb; picker_s int; guesser_s int; target_n int; clue_msg text; c_color text; c_val text; i int;
begin
 select * into r from public.game_rooms where id=p_room for update; if r.status<>'playing' then raise exception 'Game is not active'; end if;
 if p_actor_seat is not null then
  select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
 else
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
 end if;
 if me.id is null then raise exception 'Not a player'; end if;
 state:=r.public_state; select count(*) into n from public.game_players where room_id=p_room;
  if p_action='set_grid_size' then
   if r.host_id<>auth.uid() then raise exception 'Only host can set grid size'; end if;
   val:=p_value::int; if val not in (3,4,5) then raise exception 'Grid size must be 3, 4, or 5'; end if;
   state:=jsonb_set(state,'{gridSize}',to_jsonb(val),true);
   update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
   return state;
  end if;

 cur_round:=coalesce((state->>'round')::int, 1);
 round_wins:=coalesce(state->'roundWins', '{}'::jsonb);

 if r.game_type='uno' then
   if p_action='call_uno' then
     state:=jsonb_set(state, array['unoCalled', me.seat::text], 'true'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb(('Player '||me.seat||' called UNO! 📣')::text));
   else
     if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
     if p_action='draw_card' then
       val:=1+floor(random()*9)::int;
       p_toks:=coalesce(state->'hands'->me.seat::text, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id','c_'||floor(random()*100000)::text,'color',case (1+floor(random()*4)::int) when 1 then 'red' when 2 then 'blue' when 3 then 'green' else 'yellow' end,'value',val::text));
       state:=jsonb_set(state, array['hands', me.seat::text], p_toks, true);
       state:=jsonb_set(state, '{message}', to_jsonb(('Player '||me.seat||' drew a card.')::text));
       select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;
       state:=jsonb_set(state, '{turn}', to_jsonb(next_seat));
     elsif p_action='play_card' then
       select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;
       state:=jsonb_set(state, '{turn}', to_jsonb(next_seat));
       p_toks:=coalesce(state->'hands'->me.seat::text, '[]'::jsonb);
       if (select count(*) from jsonb_array_elements(p_toks)) <= 1 then
         round_ended:=true; round_winner:=me.seat;
       end if;
     end if;
   end if;

 elsif r.game_type='tic_tac_toe' then
  if (state->>'turn')::int<>me.seat or p_action<>'place' then raise exception 'Wait for your turn'; end if; val:=p_value::int; if val<0 or val>8 or state->'board'->>val<>'' then raise exception 'Invalid square'; end if; mark:=case when me.seat=1 then 'X' else 'O' end; board:=jsonb_set(state->'board',array[val::text],to_jsonb(mark)); state:=jsonb_set(state,'{board}',board); next_seat:=case me.seat when 1 then 2 else 1 end; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat));
  if (board->>0=mark and board->>1=mark and board->>2=mark) or (board->>3=mark and board->>4=mark and board->>5=mark) or (board->>6=mark and board->>7=mark and board->>8=mark) or (board->>0=mark and board->>3=mark and board->>6=mark) or (board->>1=mark and board->>4=mark and board->>7=mark) or (board->>2=mark and board->>5=mark and board->>8=mark) or (board->>0=mark and board->>4=mark and board->>8=mark) or (board->>2=mark and board->>4=mark and board->>6=mark) then round_ended:=true; round_winner:=me.seat; elsif not board ? '' then round_ended:=true; round_winner:=null; end if;

 elsif r.game_type='connect_four' then
  if (state->>'turn')::int<>me.seat or p_action<>'drop' then raise exception 'Wait for your turn'; end if; val:=p_value::int; if val<0 or val>6 then raise exception 'Invalid column'; end if; board:=state->'connectFourBoard'; if board->>val<>'' then raise exception 'Column full'; end if; mark:=case when me.seat=1 then '🔴' else '🟡' end;
  r_idx:=5; while r_idx>=0 loop if board->>(r_idx*7+val)='' then exit; end if; r_idx:=r_idx-1; end loop; if r_idx<0 then raise exception 'Column full'; end if;
  board:=jsonb_set(board,array[(r_idx*7+val)::text],to_jsonb(mark)); state:=jsonb_set(state,'{connectFourBoard}',board); next_seat:=case me.seat when 1 then 2 else 1 end; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat));
  r_idx:=0; while r_idx<6 loop c_idx:=0; while c_idx<7 loop
    if board->>(r_idx*7+c_idx)=mark then
      if c_idx+3<7 and board->>(r_idx*7+c_idx+1)=mark and board->>(r_idx*7+c_idx+2)=mark and board->>(r_idx*7+c_idx+3)=mark then round_ended:=true; round_winner:=me.seat; end if;
      if r_idx+3<6 and board->>((r_idx+1)*7+c_idx)=mark and board->>((r_idx+2)*7+c_idx)=mark and board->>((r_idx+3)*7+c_idx)=mark then round_ended:=true; round_winner:=me.seat; end if;
      if r_idx+3<6 and c_idx+3<7 and board->>((r_idx+1)*7+c_idx+1)=mark and board->>((r_idx+2)*7+c_idx+2)=mark and board->>((r_idx+3)*7+c_idx+3)=mark then round_ended:=true; round_winner:=me.seat; end if;
      if r_idx+3<6 and c_idx-3>=0 and board->>((r_idx+1)*7+c_idx-1)=mark and board->>((r_idx+2)*7+c_idx-2)=mark and board->>((r_idx+3)*7+c_idx-3)=mark then round_ended:=true; round_winner:=me.seat; end if;
    end if;
    c_idx:=c_idx+1; end loop; r_idx:=r_idx+1; end loop;
  if not round_ended and not board ? '' then round_ended:=true; round_winner:=null; end if;

 elsif r.game_type='dots_boxes' then
  if (state->>'turn')::int<>me.seat or p_action<>'line' then raise exception 'Wait for your turn'; end if;
  grid_size:=coalesce((state->>'gridSize')::int,3);
  if p_value not like 'h_%_%' and p_value not like 'v_%_%' then raise exception 'Invalid line'; end if;
  if (p_value like 'h_%' and state->'hLines' ? substr(p_value,3)) or (p_value like 'v_%' and state->'vLines' ? substr(p_value,3)) then raise exception 'Line taken'; end if;
  if p_value like 'h_%' then state:=jsonb_set(state,array['hLines',substr(p_value,3)],'true'::jsonb,true); else state:=jsonb_set(state,array['vLines',substr(p_value,3)],'true'::jsonb,true); end if;
  new_boxes:=0;
  for r_idx in 0..grid_size-1 loop
    for c_idx in 0..grid_size-1 loop
      key_b:=r_idx||'_'||c_idx;
      if not state->'boxes' ? key_b then
        if (state->'hLines' ? (r_idx||'_'||c_idx)) and (state->'hLines' ? ((r_idx+1)||'_'||c_idx)) and (state->'vLines' ? (r_idx||'_'||c_idx)) and (state->'vLines' ? (r_idx||'_'||(c_idx+1))) then
          state:=jsonb_set(state,array['boxes',key_b],to_jsonb(me.seat),true);
          new_boxes:=new_boxes+1;
          score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;
          state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
        end if;
      end if;
    end loop;
  end loop;
  if new_boxes > 0 then
    state:=jsonb_set(state,array['message'],to_jsonb(('Player '||me.seat||' completed '||new_boxes||' box(es)! Extra turn.')::text),true);
  else
    select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;
    state:=jsonb_set(state,array['turn'],to_jsonb(next_seat::int),true);
    state:=jsonb_set(state,array['message'],to_jsonb(('Player '||next_seat||'''s turn')::text),true);
  end if;
  if (select count(*) from jsonb_object_keys(state->'boxes')) >= (grid_size * grid_size) then
    round_ended:=true;
  end if;
 end if;

 if round_ended then
  if round_winner is not null then
    score:=coalesce((round_wins->>round_winner::text)::int,0)+1;
    round_wins:=jsonb_set(round_wins,array[round_winner::text],to_jsonb(score),true);
    state:=jsonb_set(state,'{roundWins}',round_wins,true);
  end if;
  if (round_winner is not null and score>=2) or cur_round>=3 then
    r.status:='completed';
    if round_winner is not null then winner:=round_winner; else winner:=null; end if;
    state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
    state:=jsonb_set(state,'{message}',to_jsonb(case when winner is not null then ('Match complete! Player '||winner||' wins!')::text else 'Match complete! Draw game!'::text end),true);
  else
    cur_round:=cur_round+1;
    state:=jsonb_set(state,'{round}',to_jsonb(cur_round),true);
    state:=jsonb_set(state,'{turn}',to_jsonb(1),true);
    if r.game_type='tic_tac_toe' then state:=jsonb_set(state,'{board}',jsonb_build_array('','','','','','','','',''),true);
    elsif r.game_type='connect_four' then state:=jsonb_set(state,'{connectFourBoard}',to_jsonb(array_fill(''::text, ARRAY[42])),true); end if;
    state:=jsonb_set(state,'{message}',to_jsonb(('Round '||cur_round||' of 3! Player 1 goes first.')::text),true);
  end if;
 end if;

 update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
 if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
 return state;
end $$;

-- 2. Ludo action handler
create or replace function public.play_ludo_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; roll int; token int; old_pos int; new_pos int; next_seat int; positions jsonb; other record; i int; finished boolean;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'ludo' then raise exception 'Ludo is not active'; end if;
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
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

-- 3. RPS action handler
create or replace function public.play_rps_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; count_choices int; one_choice text; two_choice text; round_winner int; score_one int; score_two int; winner int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'rps' then raise exception 'RPS is not active'; end if;
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  state:=coalesce(r.public_state, jsonb_build_object('round',1,'scores','{}'::jsonb,'choices','{}'::jsonb,'revealed',false));
  current_round:=coalesce((state->>'round')::int,1);
  score_one:=coalesce((state->'scores'->>'1')::int,0); score_two:=coalesce((state->'scores'->>'2')::int,0);
  if p_action='next_round' then
    if not coalesce((state->>'revealed')::boolean,false) then raise exception 'Finish this round first'; end if;
    if current_round >= 3 and score_one <> score_two then raise exception 'Match is complete'; end if;
    state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
    state:=jsonb_set(state,'{choices}','{}'::jsonb,true);
    state:=jsonb_set(state,'{revealed}','false'::jsonb,true);
    state:=jsonb_set(state,'{message}',to_jsonb(case when current_round>=3 then ('Sudden Death Round '||(current_round+1)||': make your pick!')::text else ('Round '||(current_round+1)||' of 3: make a secret pick.')::text end),true);
  elsif p_action='choose' then
    if p_value not in ('rock','paper','scissors') then raise exception 'Invalid choice'; end if;
    if coalesce((state->>'revealed')::boolean,false) then raise exception 'Start the next round first'; end if;
    insert into private.rps_choices(room_id,round,player_id,choice) values(p_room,current_round,me.player_id,p_value) on conflict do nothing;
    state:=jsonb_set(state,array['choices',me.seat::text],to_jsonb(p_value),true);
    select count(*) into count_choices from private.rps_choices where room_id=p_room and round=current_round;
    if count_choices=n then
      if n<>2 then raise exception 'RPS currently supports two players'; end if;
      select choice into one_choice from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=current_round and p.seat=1;
      select choice into two_choice from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=current_round and p.seat=2;
      if one_choice=two_choice then round_winner:=null;
      elsif (one_choice='rock' and two_choice='scissors') or (one_choice='scissors' and two_choice='paper') or (one_choice='paper' and two_choice='rock') then round_winner:=1;
      else round_winner:=2; end if;
      if round_winner is not null then state:=jsonb_set(state,array['scores',round_winner::text],to_jsonb(coalesce((state->'scores'->>round_winner::text)::int,0)+1),true); end if;
      state:=jsonb_set(state,'{revealed}','true'::jsonb,true);
      score_one:=coalesce((state->'scores'->>'1')::int,0); score_two:=coalesce((state->'scores'->>'2')::int,0);
      if (current_round>=3 or score_one>=2 or score_two>=2) and score_one <> score_two then
        r.status:='completed';
        winner:=case when score_one>score_two then 1 else 2 end;
        state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Player '||winner||' wins the match!')::text),true);
      elsif current_round>=3 and score_one = score_two then
        state:=jsonb_set(state,'{message}',to_jsonb(('Tie game ('||score_one||'-'||score_two||')! Sudden death tiebreaker round '||(current_round+1)||'!')::text),true);
      else
        state:=jsonb_set(state,'{message}',to_jsonb(case when round_winner is null then 'Round draw — choose Next Round.' else 'Round '||current_round||': Player '||round_winner||' wins!' end),true);
      end if;
    else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked a choice.')::text),true); end if;
  else raise exception 'Invalid RPS action'; end if;
  update public.game_rooms set public_state=coalesce(state,'{}'::jsonb),status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- 4. Number Hunt action handler
drop function if exists public.play_number_hunt_action(uuid, text, int);
drop function if exists public.play_number_hunt_action(uuid, text, text, int);

create or replace function public.play_number_hunt_action(
  p_room uuid, p_action text, p_value text default null, p_actor_seat int default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms; me public.game_players; state jsonb; player_count int;
  current_round int; picker int; guess int; target int; guesses jsonb; results jsonb;
  guessed_count int; next_picker int; winner int; score int; top_score int; tied_count int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'number_guess' then raise exception 'Number Hunt is not active'; end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
      where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;

  select count(*) into player_count from public.game_players where room_id=p_room;
  state:=coalesce(r.public_state,'{}'::jsonb);
  current_round:=coalesce((state->>'round')::int,1);
  picker:=coalesce((state->>'pickerSeat')::int,1);

  if p_action='set_target' then
    if me.seat<>picker then raise exception 'Only the picker can hide the number'; end if;
    guess:=p_value::int;
    if guess not between 1 and 25 then raise exception 'Choose a number from 1 to 25'; end if;
    insert into private.number_hunt_targets(room_id,round,target) values(p_room,current_round,guess)
      on conflict(room_id,round) do update set target=excluded.target;
    state:=state-'targetNumber'-'lastGuess'-'attemptsLeft';
    state:=jsonb_set(state,'{targetPicked}','true'::jsonb,true);
    state:=jsonb_set(state,'{guesses}','{}'::jsonb,true);
    state:=jsonb_set(state,'{guessResults}','{}'::jsonb,true);
    state:=jsonb_set(state,'{message}',to_jsonb('The number is hidden. Every hunter gets one guess!'::text),true);

  elsif p_action='guess' then
    if not coalesce((state->>'targetPicked')::boolean,false) then raise exception 'Wait for the picker to hide a number'; end if;
    if me.seat=picker then raise exception 'The picker cannot guess'; end if;
    guess:=p_value::int;
    if guess not between 1 and 25 then raise exception 'Choose a number from 1 to 25'; end if;
    guesses:=case when jsonb_typeof(state->'guesses')='object' then state->'guesses' else '{}'::jsonb end;
    if guesses ? me.seat::text then raise exception 'You already guessed this round'; end if;
    select t.target into target from private.number_hunt_targets t where t.room_id=p_room and t.round=current_round;
    if target is null then raise exception 'Secret number is missing'; end if;

    guesses:=jsonb_set(guesses,array[me.seat::text],to_jsonb(guess),true);
    results:=case when jsonb_typeof(state->'guessResults')='object' then state->'guessResults' else '{}'::jsonb end;
    results:=jsonb_set(results,array[me.seat::text],jsonb_build_object('guess',guess,'correct',guess=target),true);
    state:=jsonb_set(state,'{guesses}',guesses,true);
    state:=jsonb_set(state,'{guessResults}',results,true);
    if guess=target then
      score:=coalesce((state->'scores'->>me.seat::text)::int,0)+100;
      state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
      state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' found it! +100 points.')::text),true);
    else
      state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked a guess.')::text),true);
    end if;

    select count(*) into guessed_count from jsonb_object_keys(guesses);
    if guessed_count=player_count-1 then
      select min(seat) into next_picker from public.game_players where room_id=p_room and seat>picker;
      if next_picker is null then select min(seat) into next_picker from public.game_players where room_id=p_room; end if;
      if current_round>=5 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into tied_count from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        if tied_count=1 then
          select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
          r.status:='completed';
          state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Number Hunt complete! Player '||winner||' wins!')::text),true);
        else
          state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
          state:=jsonb_set(state,'{pickerSeat}',to_jsonb(next_picker),true);
          state:=jsonb_set(state,'{targetPicked}','false'::jsonb,true);
          state:=jsonb_set(state,'{guesses}','{}'::jsonb,true);
          state:=jsonb_set(state,'{guessResults}','{}'::jsonb,true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Tiebreaker round: Player '||next_picker||' hides a number.')::text),true);
        end if;
      else
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
        state:=jsonb_set(state,'{pickerSeat}',to_jsonb(next_picker),true);
        state:=jsonb_set(state,'{targetPicked}','false'::jsonb,true);
        state:=jsonb_set(state,'{guesses}','{}'::jsonb,true);
        state:=jsonb_set(state,'{guessResults}','{}'::jsonb,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Round '||(current_round+1)||': Player '||next_picker||' hides a number.')::text),true);
      end if;
    end if;
  else
    raise exception 'Invalid Number Hunt action';
  end if;

  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- 5. Skribbl action handler
create or replace function public.play_skribbl_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; started_at bigint; seconds_left int; tries_left int; guessed jsonb; resolved int; next_seat int; score int; top_score int; count_tied int; winner int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'skribbl' then raise exception 'Skribbl is not active'; end if;
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  state:=coalesce(r.public_state,jsonb_build_object('drawerSeat',1,'round',1,'scores','{}'::jsonb,'usedWords','[]'::jsonb,'guessFeed','[]'::jsonb));
  current_round:=coalesce((state->>'round')::int,1);
  if p_action='select_word' then
    if coalesce((state->>'drawerSeat')::int,1)<>me.seat then raise exception 'Only the drawer can pick'; end if;
    if p_value is null or length(trim(p_value))<2 or length(trim(p_value))>40 then raise exception 'Choose a valid word'; end if;
    if exists(select 1 from jsonb_array_elements_text(coalesce(state->'usedWords','[]'::jsonb)) word where lower(word)=lower(trim(p_value))) then raise exception 'That word was already used in this match'; end if;
    started_at:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
    state:=jsonb_set(state,'{wordSelected}',to_jsonb(trim(p_value)),true);
    state:=jsonb_set(state,'{roundStartedAt}',to_jsonb(started_at),true);
    state:=jsonb_set(state,'{tries}','{}'::jsonb,true);
    state:=jsonb_set(state,'{guessedSeats}','[]'::jsonb,true);
    state:=jsonb_set(state,'{guessFeed}','[]'::jsonb,true);
    state:=jsonb_set(state,'{usedWords}',coalesce(state->'usedWords','[]'::jsonb)||jsonb_build_array(trim(p_value)),true);
    state:=jsonb_set(state,'{message}',to_jsonb('Draw it! Everyone has 80 seconds and three guesses.'::text),true);
  elsif p_action in ('guess','time_expired') then
    if state->>'wordSelected' is null then raise exception 'The drawer is choosing a word'; end if;
    if coalesce((state->>'drawerSeat')::int,1)=me.seat and p_action='guess' then raise exception 'The drawer cannot guess'; end if;
    started_at:=coalesce((state->>'roundStartedAt')::bigint,floor(extract(epoch from clock_timestamp())*1000)::bigint);
    seconds_left:=greatest(0,80-floor((extract(epoch from clock_timestamp())*1000-started_at)/1000)::int);
    guessed:=coalesce(state->'guessedSeats','[]'::jsonb);
    if p_action='time_expired' and seconds_left>0 then raise exception 'The round timer is still running'; end if;
    if p_action='guess' and exists(select 1 from jsonb_array_elements_text(guessed) seat where seat::int=me.seat) then raise exception 'You are already done this round'; end if;
    if p_action='guess' then
      tries_left:=coalesce((state->'tries'->>me.seat::text)::int,3)-1;
      state:=jsonb_set(state,array['tries',me.seat::text],to_jsonb(greatest(0,tries_left)),true);
      state:=jsonb_set(state,'{guessFeed}',coalesce(state->'guessFeed','[]'::jsonb)||jsonb_build_array(jsonb_build_object('seat',me.seat,'text',trim(p_value),'correct',lower(trim(p_value))=lower(trim(state->>'wordSelected')))),true);
      if lower(trim(p_value))=lower(trim(state->>'wordSelected')) then
        score:=coalesce((state->'scores'->>me.seat::text)::int,0)+20+seconds_left;
        state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
        guessed:=guessed||to_jsonb(me.seat);
        state:=jsonb_set(state,'{guessedSeats}',guessed,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' guessed the word! +'||(20+seconds_left))::text),true);
      elsif tries_left<=0 then
        guessed:=guessed||to_jsonb(me.seat);
        state:=jsonb_set(state,'{guessedSeats}',guessed,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' used all 3 guesses.')::text),true);
      end if;
    end if;
    select count(*) into resolved from jsonb_array_elements(guessed);
    if resolved>=n-1 or p_action='time_expired' then
      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>coalesce((state->>'drawerSeat')::int,1);
      if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if;
      if current_round>=n*2 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        if count_tied=1 then
          select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
          r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Skribbl complete! Player '||winner||' wins!')::text),true);
        else
          state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
          state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true);
          state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true);
          state:=jsonb_set(state,'{guessedSeats}','[]'::jsonb,true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Tiebreaker Round '||(current_round+1)||'! Player '||next_seat||' draws next!')::text),true);
        end if;
      else
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
        state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true);
        state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true);
        state:=jsonb_set(state,'{guessedSeats}','[]'::jsonb,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Round '||(current_round+1)||': Player '||next_seat||' is picking a word.')::text),true);
      end if;
    end if;
  else raise exception 'Invalid Skribbl action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- 6. Mini Golf action handler
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
  select count(*) into active_count from jsonb_each(balls) item where not coalesce((item.value->>'finished')::boolean,false);
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
create or replace function public.play_battleship_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; target public.game_players; board private.battleship_boards; target_board private.battleship_boards; state jsonb; v_ships jsonb; placements jsonb; shots jsonb; mine jsonb; stats jsonb; cells jsonb; new_hits jsonb; ship_id text; orient text; sunk text; row_no int; col_no int; size int; i int; cell int; hit boolean; remaining int; all_ready boolean;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if r.id is null or r.status<>'playing' or r.game_type<>'battleship' then raise exception 'Battleship is not active'; end if;
 if p_actor_seat is not null then
  select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
 else
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
 end if;
 if me.id is null then raise exception 'Not a player'; end if;
 state:=r.public_state; placements:=coalesce(state->'placements','{}'::jsonb);
 if state->>'phase'='placing' then
  if p_action='randomize_fleet' then
   v_ships:='{}'::jsonb;
   foreach ship_id in array array['carrier','battleship','cruiser','submarine','destroyer'] loop
    size:=case ship_id when 'carrier' then 5 when 'battleship' then 4 when 'cruiser' then 3 when 'submarine' then 3 else 2 end;
    loop
     orient:=case when random()>.5 then 'H' else 'V' end;
     row_no:=case when orient='H' then floor(random()*8)::int else floor(random()*(8-size+1))::int end;
     col_no:=case when orient='H' then floor(random()*(8-size+1))::int else floor(random()*8)::int end;
     cells:='[]'::jsonb; i:=0; while i<size loop cells:=cells||to_jsonb(case when orient='H' then row_no*8+col_no+i else (row_no+i)*8+col_no end); i:=i+1; end loop;
     if not exists(select 1 from jsonb_each(v_ships) s, jsonb_array_elements_text(s.value->'cells') c1, jsonb_array_elements_text(cells) c2 where c1=c2) then
      v_ships:=jsonb_set(v_ships,array[ship_id],jsonb_build_object('id',ship_id,'row',row_no,'col',col_no,'orientation',orient,'cells',cells),true); exit;
     end if;
    end loop;
   end loop;
   insert into private.battleship_boards(room_id,player_id,ships) values(p_room,me.player_id,v_ships) on conflict(room_id,player_id) do update set ships=excluded.ships;
   placements:=jsonb_set(placements,array[me.seat::text],'true'::jsonb,true); state:=jsonb_set(state,'{placements}',placements,true);
   select not exists(select 1 from public.game_players p where p.room_id=p_room and not coalesce((placements->p.seat::text)::boolean,false)) into all_ready;
   if all_ready then state:=jsonb_set(state,'{phase}','battle'::jsonb,true); state:=jsonb_set(state,'{message}','Both fleets deployed! Player 1 fires first.'::jsonb,true); else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' deployed fleet. Waiting for opponent...')::text),true); end if;
  end if;
 elsif state->>'phase'='battle' then
  if (state->>'turn')::int<>me.seat or p_action<>'fire' then raise exception 'Wait for your turn'; end if;
  row_no:=split_part(p_value,',',1)::int; col_no:=split_part(p_value,',',2)::int; cell:=row_no*8+col_no;
  select * into target from public.game_players where room_id=p_room and seat<>me.seat limit 1;
  select * into target_board from private.battleship_boards where room_id=p_room and player_id=target.player_id;
  shots:=coalesce(state->'shots','{}'::jsonb); mine:=coalesce(shots->me.seat::text,'[]'::jsonb);
  if exists(select 1 from jsonb_array_elements(mine) s where (s->>'row')::int=row_no and (s->>'col')::int=col_no) then raise exception 'Coordinates already targeted'; end if;
  hit:=exists(select 1 from jsonb_each(target_board.ships) s, jsonb_array_elements_text(s.value->'cells') c where c::int=cell);
  mine:=mine||jsonb_build_array(jsonb_build_object('row',row_no,'col',col_no,'hit',hit));
  shots:=jsonb_set(shots,array[me.seat::text],mine,true); state:=jsonb_set(state,'{shots}',shots,true);
  stats:=coalesce(state->'stats','{}'::jsonb);
  stats:=jsonb_set(stats,array[me.seat::text,case when hit then 'hits' else 'misses' end],to_jsonb(coalesce((stats->me.seat::text->>(case when hit then 'hits' else 'misses' end))::int,0)+1),true);
  sunk:=null;
  for ship_id in select key from jsonb_each(target_board.ships) loop
   if not exists(select 1 from jsonb_array_elements_text(target_board.ships->ship_id->'cells') c where not exists(select 1 from jsonb_array_elements(mine) m where (m->>'hit')::boolean and (m->>'row')::int*8+(m->>'col')::int=c::int)) then
    new_hits:=coalesce(state->'sunkShips'->me.seat::text,'[]'::jsonb);
    if not new_hits ? ship_id then
     state:=jsonb_set(state,array['sunkShips',me.seat::text],new_hits||to_jsonb(ship_id),true);
     stats:=jsonb_set(stats,array[me.seat::text,'sunk'],to_jsonb(coalesce((stats->me.seat::text->>'sunk')::int,0)+1),true);
     sunk:=ship_id;
    end if;
   end if;
  end loop;
  state:=jsonb_set(state,'{stats}',stats,true);
  remaining:=0;
  for ship_id in select key from jsonb_each(target_board.ships) loop
   if exists(select 1 from jsonb_array_elements_text(target_board.ships->ship_id->'cells') c where not exists(select 1 from jsonb_array_elements(mine) m where (m->>'hit')::boolean and (m->>'row')::int*8+(m->>'col')::int=c::int)) then remaining:=remaining+1; end if;
  end loop;
  if remaining=0 then
   r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat),true); state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' sank the entire enemy fleet! Victory!')::text),true);
  else
   state:=jsonb_set(state,'{turn}',to_jsonb(target.seat),true);
   state:=jsonb_set(state,'{message}',to_jsonb(case when sunk is not null then ('Player '||me.seat||' SUNK enemy '||upper(sunk)||'! Player '||target.seat||'''s turn.')::text when hit then ('Player '||me.seat||' scored a HIT! Player '||target.seat||'''s turn.')::text else ('Player '||me.seat||' missed. Player '||target.seat||'''s turn.')::text end),true);
  end if;
 end if;
 update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
 if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
 return state;
end $$;

-- 8. Memory Match action handler
create or replace function public.play_memory_match_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; deck jsonb; cards jsonb; flipped jsonb; matched jsonb; idx int; next_seat int; score int; winner int; top_score int; count_tied int; total_cards int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'memory_match' then raise exception 'Memory Match is not active'; end if;
  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;
  state:=r.public_state; if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
  deck:=(select d.cards from private.memory_match_decks d where d.room_id=p_room); if deck is null then raise exception 'Memory deck is missing'; end if;
  cards:=coalesce(state->'cards',jsonb_build_array(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null)); flipped:=coalesce(state->'flipped','[]'::jsonb); matched:=coalesce(state->'matched','[]'::jsonb); total_cards:=jsonb_array_length(cards);
  if p_action='flip' then
    idx:=p_value::int; if idx<0 or idx>=total_cards or matched ? idx::text or flipped ? idx::text then raise exception 'Invalid card'; end if;
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
      if jsonb_array_length(matched)=total_cards then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        if count_tied=1 then
          select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
          r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb(('Memory Match complete! Player '||winner||' wins!')::text),true);
        else
          deck := jsonb_build_array('trophy','trophy','crown','crown');
          select jsonb_agg(card order by random()) into deck from jsonb_array_elements(deck) as item(card);
          insert into private.memory_match_decks(room_id,cards) values(p_room,deck) on conflict(room_id) do update set cards=excluded.cards;
          state:=jsonb_set(state,'{cards}',jsonb_build_array(null,null,null,null),true);
          state:=jsonb_set(state,'{matched}','[]'::jsonb,true);
          state:=jsonb_set(state,'{message}',to_jsonb('Score tie! Sudden death tiebreaker cards! Match a pair to win!'::text),true);
        end if;
      end if;
    else
      cards:=jsonb_set(cards,array[(flipped->>0)::text],'null'::jsonb,true);
      cards:=jsonb_set(cards,array[(flipped->>1)::text],'null'::jsonb,true);
      state:=jsonb_set(state,'{cards}',cards,true);
      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
    end if;
    state:=jsonb_set(state,'{flipped}','[]'::jsonb,true); state:=jsonb_set(state,'{revealed}','false'::jsonb,true);
  else raise exception 'Invalid Memory Match action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- 9. Trivia Clash action handler
create or replace function public.play_trivia_clash_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms; me public.game_players; state jsonb; answers jsonb; question jsonb; correct int; selected int; current_round int; player_count int; answer_count int; score int; winner int; top_score int; count_tied int; answer_row record;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'trivia_clash' then raise exception 'Trivia Clash is not active'; end if;

  if p_actor_seat is not null then
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id::text like '11111111-1111-1111-1111-%';
  else
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'Not a player'; end if;

  select count(*) into player_count from public.game_players where room_id=p_room;
  state := coalesce(r.public_state,'{}'::jsonb);
  current_round := coalesce((state->>'round')::int,1);
  answers := coalesce(state->'answers','{}'::jsonb);

  if p_action = 'set_question' then
    if r.host_id <> auth.uid() then raise exception 'Only host can set question'; end if;
    question := p_value::jsonb;
    state := jsonb_set(state,'{question}',question->'question',true);
    state := jsonb_set(state,'{options}',question->'options',true);
    state := jsonb_set(state,'{correctAnswer}',question->'correctAnswer',true);
    state := jsonb_set(state,'{answers}','{}'::jsonb,true);
    state := jsonb_set(state,'{revealed}','false'::jsonb,true);
    state := jsonb_set(state,'{message}',to_jsonb(('Question '||current_round||' is live! Lock in your answer.')::text),true);
  elsif p_action = 'answer' then
    if not (state ? 'question') then raise exception 'Waiting for next question'; end if;
    if coalesce((state->>'revealed')::boolean,false) then raise exception 'Question already revealed'; end if;
    if answers ? me.seat::text then raise exception 'Already answered'; end if;

    selected := p_value::int;
    if selected not between 0 and 3 then raise exception 'Invalid option'; end if;

    answers := jsonb_set(answers, array[me.seat::text], to_jsonb(selected), true);
    state := jsonb_set(state, '{answers}', answers, true);

    select count(*) into answer_count from jsonb_object_keys(answers);
    if answer_count >= player_count then
      state := jsonb_set(state, '{revealed}', 'true'::jsonb, true);
      correct := (state->>'correctAnswer')::int;

      for answer_row in select key as seat_str, value::int as chosen from jsonb_each_text(answers) loop
        if answer_row.chosen = correct then
          score := coalesce((state->'scores'->>answer_row.seat_str)::int,0) + 100;
          state := jsonb_set(state, array['scores', answer_row.seat_str], to_jsonb(score), true);
        end if;
      end loop;

      if current_round >= 5 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;

        if count_tied = 1 then
          select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
          r.status := 'completed';
          state := jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
          state := jsonb_set(state,'{message}',to_jsonb(('Trivia Clash complete! Player '||winner||' wins!')::text),true);
        else
          state := jsonb_set(state,'{message}',to_jsonb(('Tie game! Sudden death tiebreaker question coming up!')::text),true);
        end if;
      else
        state := jsonb_set(state,'{message}',to_jsonb(('Correct answer revealed! +100 points for each correct player.')::text),true);
      end if;
    else
      state := jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked an answer.')::text),true);
    end if;
  elsif p_action = 'next_question' then
    if not coalesce((state->>'revealed')::boolean,false) then raise exception 'Finish this question first'; end if;
    select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
    select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
    if current_round >= 5 and count_tied = 1 then raise exception 'Trivia Clash is complete'; end if;
    current_round := current_round + 1;
    state := state - 'question' - 'options' - 'correctAnswer';
    state := jsonb_set(state,'{round}',to_jsonb(current_round),true);
    state := jsonb_set(state,'{answers}','{}'::jsonb,true);
    state := jsonb_set(state,'{revealed}','false'::jsonb,true);
    state := jsonb_set(state,'{message}',to_jsonb(('Question '||current_round||' is ready to load.')::text),true);
  else
    raise exception 'Invalid Trivia Clash action';
  end if;

  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

-- Cleanup removed games
drop function if exists public.play_ping_pong_point(uuid, int);

-- Permissions grant
grant execute on function public.play_room_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_ludo_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_rps_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_number_hunt_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_skribbl_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_mini_golf_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_battleship_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_memory_match_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.play_trivia_clash_action(uuid,text,text,int) to authenticated, anon;
grant execute on function public.get_battleship_private_state(uuid) to authenticated, anon;
grant execute on function public.start_battleship(uuid) to authenticated, anon;
