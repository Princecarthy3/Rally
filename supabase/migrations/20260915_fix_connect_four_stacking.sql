-- Fix Connect Four disc stacking & Tic Tac Toe 3-round tracking & diagonal win counting
create or replace function public.play_room_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; n int; next_seat int; state jsonb; score int; val int; roll int; board jsonb; mark text; winner int:=null; new_boxes int:=0; r_idx int; c_idx int; key_b text; grid_size int:=3; q_idx int:=0; round_ended boolean:=false; round_winner int:=null; cur_round int:=1; round_wins jsonb; p_toks jsonb; tok_idx int; cur_pos int; new_pos int; card_id text; chosen_color text; elem jsonb; card_elem jsonb; new_hand jsonb; dir int:=1; skip_step int:=1; active_col text; card_val text; card_col text; penalty_cards jsonb; picker_s int; guesser_s int; target_n int; clue_msg text; c_color text; c_val text; i int;
begin
 select * into r from public.game_rooms where id=p_room for update; if r.status<>'playing' then raise exception 'Game is not active'; end if;
 if p_actor_seat is not null then
  select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111';
 end if;
 if me.id is null then
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
 end if;
 if me.id is null then raise exception 'Not a player'; end if; state:=r.public_state; select count(*) into n from public.game_players where room_id=p_room;
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

 elsif r.game_type='number_guess' then
   picker_s:=coalesce((state->>'pickerSeat')::int, 1);
   guesser_s:=coalesce((state->>'guesserSeat')::int, case when picker_s = 1 then 2 else 1 end);

   if p_action='set_target' then
     if picker_s <> me.seat then raise exception 'Only the picker can set the secret number'; end if;
     val:=p_value::int; if val<1 or val>100 then raise exception 'Number must be between 1 and 100'; end if;
     state:=jsonb_set(state, '{targetNumber}', to_jsonb(val), true);
     state:=jsonb_set(state, '{targetPicked}', 'true'::jsonb, true);
     state:=jsonb_set(state, '{lastGuess}', 'null'::jsonb, true);
     state:=jsonb_set(state, '{attemptsLeft}', to_jsonb(3), true);
     state:=jsonb_set(state, '{guesses}', '[]'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb('Secret number set! Guesser has 3 tries in 45 seconds!'::text));
   elsif p_action='time_expired' then
     round_ended:=true; round_winner:=picker_s;
     score:=coalesce((state->'scores'->>picker_s::text)::int, 0) + 50;
     state:=jsonb_set(state, array['scores', picker_s::text], to_jsonb(score), true);
     state:=jsonb_set(state, '{pickerSeat}', to_jsonb(guesser_s), true);
     state:=jsonb_set(state, '{guesserSeat}', to_jsonb(picker_s), true);
     state:=jsonb_set(state, '{targetPicked}', 'false'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb(('45-Second timer expired! Player '||picker_s||' (Picker) wins the round! Roles swapped!')::text));
   elsif p_action='guess' then
     if guesser_s <> me.seat then raise exception 'Only the guesser can make a guess'; end if;
     val:=p_value::int; if val<1 or val>100 then raise exception 'Guess must be 1 to 100'; end if;
     
     score:=coalesce((state->>'attemptsLeft')::int, 3) - 1;
     state:=jsonb_set(state, '{attemptsLeft}', to_jsonb(greatest(0, score)), true);
     state:=jsonb_set(state, '{lastGuess}', to_jsonb(val), true);
     state:=jsonb_set(state, '{guesses}', coalesce(state->'guesses', '[]'::jsonb) || to_jsonb(val), true);
     target_n:=coalesce((state->>'targetNumber')::int, 50);

     if val = target_n then
       score:=coalesce((state->'scores'->>me.seat::text)::int, 0) + 100;
       state:=jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
       round_ended:=true; round_winner:=me.seat;
       state:=jsonb_set(state, '{pickerSeat}', to_jsonb(me.seat), true);
       state:=jsonb_set(state, '{guesserSeat}', to_jsonb(picker_s), true);
       state:=jsonb_set(state, '{targetPicked}', 'false'::jsonb, true);
       state:=jsonb_set(state, '{message}', to_jsonb(('CORRECT! Player '||me.seat||' guessed secret target '||target_n||'! Roles swapped! 🎉')::text));
     elsif score <= 0 then
       round_ended:=true; round_winner:=picker_s;
       score:=coalesce((state->'scores'->>picker_s::text)::int, 0) + 50;
       state:=jsonb_set(state, array['scores', picker_s::text], to_jsonb(score), true);
       state:=jsonb_set(state, '{pickerSeat}', to_jsonb(guesser_s), true);
       state:=jsonb_set(state, '{guesserSeat}', to_jsonb(picker_s), true);
       state:=jsonb_set(state, '{targetPicked}', 'false'::jsonb, true);
       state:=jsonb_set(state, '{message}', to_jsonb(('Used all 3 tries! Player '||picker_s||' (Picker) wins the round! Target was '||target_n||'. Roles swapped!')::text));
     else
       clue_msg:=case when target_n > val then 'TOO LOW ⬆️' else 'TOO HIGH ⬇️' end;
       if abs(target_n - val) <= 5 then clue_msg:=clue_msg || ' (Very Close 🔥)'; elsif abs(target_n - val) > 25 then clue_msg:=clue_msg || ' (Cold 🥶)'; end if;
       state:=jsonb_set(state, '{message}', to_jsonb(('Guess '||val||' is '||clue_msg||' — '||score||' try(ies) left!')::text));
     end if;
   end if;

 elsif r.game_type='rps' then
   if p_action='next_round' then
     cur_round:=coalesce((state->>'round')::int, 1) + 1;
     state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
     state:=jsonb_set(state, '{choices}', '{}'::jsonb, true);
     state:=jsonb_set(state, '{revealed}', 'false'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb(('Round '||cur_round||' of 3: Make your pick!')::text));
   elsif p_action='choose' then
     if p_value not in ('rock','paper','scissors') then raise exception 'Invalid choice'; end if;
     insert into private.rps_choices(room_id,round,player_id,choice) values(p_room,cur_round,me.player_id,p_value) on conflict do nothing; if not found then raise exception 'Choice already locked'; end if;
     state:=jsonb_set(state,array['choices',me.seat::text],to_jsonb(p_value::text),true);
     select count(*) into val from private.rps_choices where room_id=p_room and round=cur_round;
     
     if val=n then
       state:=jsonb_set(state,array['choices'],coalesce((select jsonb_object_agg(p.seat::text,c.choice::text) from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=cur_round),'{}'::jsonb),true);
       state:=jsonb_set(state,array['revealed'],to_jsonb(true),true);
       
       select choice into c_color from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=cur_round and p.seat=1;
       select choice into c_val from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=cur_round and p.seat=2;
       
       if c_color = c_val then
         clue_msg := 'Draw! Both players picked ' || c_color || '!';
         round_winner := null;
       elsif (c_color='rock' and c_val='scissors') or (c_color='scissors' and c_val='paper') or (c_color='paper' and c_val='rock') then
         score := coalesce((state->'scores'->>'1')::int, 0) + 1;
         state := jsonb_set(state, array['scores', '1'], to_jsonb(score), true);
         round_winner := 1;
         clue_msg := 'Player 1 wins! (' || c_color || ' beats ' || c_val || ') 🎉';
       else
         score := coalesce((state->'scores'->>'2')::int, 0) + 1;
         state := jsonb_set(state, array['scores', '2'], to_jsonb(score), true);
         round_winner := 2;
         clue_msg := 'Player 2 wins! (' || c_val || ' beats ' || c_color || ') 🎉';
       end if;

       state := jsonb_set(state, '{message}', to_jsonb(('Round '||cur_round||' Result: '||clue_msg)::text));
       state := jsonb_set(state, '{history}', coalesce(state->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('round', cur_round, 'winnerSeat', round_winner, 'message', clue_msg)), true);
       
       if cur_round >= 3 then
         round_ended := true;
       end if;
     end if;
   end if;

 elsif r.game_type='connect_four' then
   if p_action<>'drop' or p_value is null or p_value !~ '^[0-6]$' then raise exception 'Choose a valid column'; end if;
   if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
   board:=state->'connectFourBoard';
   if jsonb_typeof(board) <> 'array' or jsonb_array_length(board) <> 42 then
     board:=to_jsonb(array_fill(''::text, ARRAY[42]));
   end if;
   c_idx:=p_value::int; r_idx:=null;
   for i in reverse 5..0 loop
     if coalesce(board->>(i*7+c_idx), '') = '' then r_idx:=i; exit; end if;
   end loop;
   if r_idx is null then raise exception 'That column is full'; end if;
   mark:=me.seat::text;
   board:=jsonb_set(board,array[(r_idx*7+c_idx)::text],to_jsonb(mark),true);
   state:=jsonb_set(state,'{connectFourBoard}',board,true);
   winner:=null;
   for r_idx in 0..5 loop
     for c_idx in 0..6 loop
       if board->>(r_idx*7+c_idx)=mark then
         if c_idx<=3 and board->>(r_idx*7+c_idx+1)=mark and board->>(r_idx*7+c_idx+2)=mark and board->>(r_idx*7+c_idx+3)=mark then winner:=me.seat; end if;
         if r_idx<=2 and board->>((r_idx+1)*7+c_idx)=mark and board->>((r_idx+2)*7+c_idx)=mark and board->>((r_idx+3)*7+c_idx)=mark then winner:=me.seat; end if;
         if r_idx<=2 and c_idx<=3 and board->>((r_idx+1)*7+c_idx+1)=mark and board->>((r_idx+2)*7+c_idx+2)=mark and board->>((r_idx+3)*7+c_idx+3)=mark then winner:=me.seat; end if;
         if r_idx<=2 and c_idx>=3 and board->>((r_idx+1)*7+c_idx-1)=mark and board->>((r_idx+2)*7+c_idx-2)=mark and board->>((r_idx+3)*7+c_idx-3)=mark then winner:=me.seat; end if;
       end if;
     end loop;
   end loop;
   if winner is not null then
     round_ended:=true; round_winner:=winner; r.status:='completed';
     state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
     state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' connects four!')::text),true);
   elsif not exists(select 1 from jsonb_array_elements_text(board) cell where cell='') then
     round_ended:=true; round_winner:=null; r.status:='completed';
     state:=jsonb_set(state,'{winnerSeat}','null'::jsonb,true);
     state:=jsonb_set(state,'{message}',to_jsonb('Board full — round draw!'::text),true);
   else
     next_seat:=case when me.seat=1 then 2 else 1 end;
     state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
     state:=jsonb_set(state,'{message}',to_jsonb(('Player '||next_seat||' drops next')::text),true);
   end if;

 elsif r.game_type='quick_quiz' then
   if p_action<>'answer' then raise exception 'Invalid action'; end if; val:=p_value::int; if val<0 or val>3 then raise exception 'Invalid answer'; end if; if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if; state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(val),true);
   if val=1 then state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(1),true); else state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(0),true); end if;
   if (select count(*) from jsonb_object_keys(state->'answers'))=n then state:=jsonb_set(state,array['revealed'],to_jsonb(true),true); round_ended:=true; end if;

 elsif r.game_type='emoji_decode' then
   if p_action<>'answer' then raise exception 'Invalid action'; end if;
   if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if;
   state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(p_value::text),true);
   if p_value in ('correct','1','true') or right(p_value,8)='_correct' then
     score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;
     state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
   end if;
   if (select count(*) from jsonb_object_keys(state->'answers'))=n then
     q_idx:=coalesce((state->>'qIndex')::int,0)+1;
     if q_idx < 5 then
       state:=jsonb_set(state,array['qIndex'],to_jsonb(q_idx::int),true);
       state:=jsonb_set(state,array['answers'],'{}'::jsonb,true);
       state:=jsonb_set(state,array['message'],to_jsonb(('Question '||(q_idx+1)||' of 5: Decode the emoji clue')::text),true);
     else
       state:=jsonb_set(state,array['revealed'],to_jsonb(true),true);
       round_ended:=true;
     end if;
   end if;

 elsif r.game_type='dots_boxes' then
   if (state->>'turn')::int<>me.seat or p_action<>'line' then raise exception 'Wait for your turn'; end if;
   if (state->'hLines' ? p_value) or (state->'vLines' ? p_value) then raise exception 'Line already drawn'; end if;
   if left(p_value,2)='h_' then
     state:=jsonb_set(state,array['hLines',substr(p_value,3)],to_jsonb(me.seat::int),true);
   else
     state:=jsonb_set(state,array['vLines',substr(p_value,3)],to_jsonb(me.seat),true);
   end if;
   grid_size:=coalesce((state->>'gridSize')::int,3); new_boxes:=0;
   for r_idx in 0..(grid_size-1) loop
     for c_idx in 0..(grid_size-1) loop
       key_b:='b_'||r_idx||'_'||c_idx;
       if not (state->'boxes' ? key_b) then
         if (state->'hLines' ? (r_idx||'_'||c_idx)) and
            (state->'hLines' ? ((r_idx+1)||'_'||c_idx)) and
            (state->'vLines' ? (r_idx||'_'||c_idx)) and
            (state->'vLines' ? (r_idx||'_'||(c_idx+1))) then
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
     state:=jsonb_set(state,array['message'],to_jsonb(('Player '||next_seat||'’s turn')::text),true);
   end if;
   if (select count(*) from jsonb_object_keys(state->'boxes')) >= (grid_size * grid_size) then
     round_ended:=true;
   end if;

 elsif r.game_type='skribbl' then
   if p_action='select_word' then
     if (state->>'drawerSeat')::int<>me.seat then raise exception 'Only the drawer can pick'; end if;
     state:=jsonb_set(state,array['wordSelected'],to_jsonb(p_value::text),true);
     state:=jsonb_set(state,array['tries'], '{}'::jsonb, true);
     state:=jsonb_set(state,array['message'],to_jsonb('Drawer selected a word! Guesser gets 3 tries.'::text));
   elsif p_action='guess' then
     if (state->>'drawerSeat')::int=me.seat then raise exception 'Drawer cannot guess'; end if;
     val:=coalesce((state->'tries'->>me.seat::text)::int, 3) - 1;
     state:=jsonb_set(state, array['tries'], coalesce(state->'tries', '{}'::jsonb) || jsonb_build_object(me.seat::text, greatest(0, val)), true);

     if lower(trim(p_value))=lower(trim(state->>'wordSelected')) then
       score:=coalesce((state->'scores'->>me.seat::text)::int, 0) + 100;
       state:=jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
       score:=coalesce((state->'scores'->>(state->>'drawerSeat'))::int, 0) + 50;
       state:=jsonb_set(state, array['scores', state->>'drawerSeat'], to_jsonb(score), true);
       
       next_seat:=((coalesce((state->>'drawerSeat')::int, 1) % n) + 1);
       state:=jsonb_set(state, '{drawerSeat}', to_jsonb(next_seat), true);
       state:=jsonb_set(state, '{wordSelected}', 'null'::jsonb, true);
       state:=jsonb_set(state, '{tries}', '{}'::jsonb, true);
       round_ended:=true; round_winner:=me.seat;
       state:=jsonb_set(state, array['message'], to_jsonb(('Player '||me.seat||' guessed the word correctly! 🎉 Next drawer: Player '||next_seat||'.')::text));
     elsif val <= 0 then
       score:=coalesce((state->'scores'->>(state->>'drawerSeat'))::int, 0) + 50;
       state:=jsonb_set(state, array['scores', state->>'drawerSeat'], to_jsonb(score), true);
       
       next_seat:=((coalesce((state->>'drawerSeat')::int, 1) % n) + 1);
       round_winner:=(state->>'drawerSeat')::int;
       state:=jsonb_set(state, '{drawerSeat}', to_jsonb(next_seat), true);
       state:=jsonb_set(state, '{wordSelected}', 'null'::jsonb, true);
       state:=jsonb_set(state, '{tries}', '{}'::jsonb, true);
       round_ended:=true;
       state:=jsonb_set(state, array['message'], to_jsonb(('Used all 3 tries! Drawer (Player '||round_winner||') wins the round! Next drawer: Player '||next_seat||'.')::text));
     else
       state:=jsonb_set(state, array['message'], to_jsonb(('Wrong guess by Player '||me.seat||'! ('||val||' try(ies) left)')::text));
     end if;
   end if;
 end if;

 -- 3-ROUND MATCH LOGIC FOR MATCH GAMES (rps, tic_tac_toe, dots_boxes)
  if round_ended and r.game_type <> 'connect_four' then
    if round_winner is not null then
      score:=coalesce((round_wins->>round_winner::text)::int, 0) + 1;
      round_wins:=jsonb_set(round_wins, array[round_winner::text], to_jsonb(score), true);
    end if;
    state:=jsonb_set(state, '{roundWins}', round_wins, true);

     clue_msg:=case when round_winner is not null then ('Player '||round_winner||' wins Round '||cur_round||'!') else ('Round '||cur_round||' draw!') end;
     state:=jsonb_set(state, '{history}', coalesce(state->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('round', cur_round, 'winnerSeat', round_winner, 'message', clue_msg)), true);
    if r.game_type in ('rps', 'tic_tac_toe', 'connect_four', 'dots_boxes') then
       select coalesce((round_wins->>'1')::int, 0) into val;
       select coalesce((round_wins->>'2')::int, 0) into target_n;
       if cur_round >= 3 or val >= 2 or target_n >= 2 then
         r.status:='completed';
         if val > target_n then winner:=1; elsif target_n > val then winner:=2; else winner:=null; end if;
         state:=jsonb_set(state, '{winnerSeat}', to_jsonb(winner), true);
         state:=jsonb_set(state, '{message}', to_jsonb(case when winner is not null then ('Player '||winner||' wins the match!') else 'Match ended in a draw!' end), true);
      else
        if r.game_type='tic_tac_toe' then
          cur_round:=cur_round + 1;
          state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
          state:=jsonb_set(state, '{board}', jsonb_build_array('','','','','','','','',''), true);
        elsif r.game_type='dots_boxes' then
          cur_round:=cur_round + 1;
          state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
          state:=jsonb_set(state, '{hLines}', '{}'::jsonb, true);
          state:=jsonb_set(state, '{vLines}', '{}'::jsonb, true);
          state:=jsonb_set(state, '{boxes}', '{}'::jsonb, true);
        elsif r.game_type='connect_four' then
          cur_round:=cur_round + 1;
          state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
          state:=jsonb_set(state, '{turn}', '1'::jsonb, true);
          state:=jsonb_set(state, '{connectFourBoard}', to_jsonb(array_fill(''::text, ARRAY[42])), true);
        end if;
      end if;
    elsif r.game_type in ('skribbl', 'number_guess') then
      cur_round:=cur_round + 1;
      state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
    end if;
  end if;

  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
 if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
 return state;
end $$;


create or replace function public.rematch_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; begin select * into r from public.game_rooms where id=p_room for update; if r.host_id<>auth.uid() then raise exception 'Only host can rematch'; end if; delete from private.rps_choices where room_id=p_room; update public.game_players set is_ready=false,score=0 where room_id=p_room; update public.game_rooms set status='waiting',public_state='{}',match_number=match_number+1,state_version=state_version+1,updated_at=now() where id=p_room; end $$;

create or replace function public.add_ai_bot_to_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; v_bot_id uuid := '11111111-1111-1111-1111-111111111111'; v_seat int;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if r.id is null then raise exception 'Room not found'; end if;
 if r.status<>'waiting' then raise exception 'Game already started'; end if;

 -- Ensure bot user exists in auth.users to satisfy profiles foreign key constraint
 insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
 values (v_bot_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bot@rally.game', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Rally Bot 🤖"}'::jsonb, now(), now())
 on conflict (id) do nothing;

 insert into public.profiles(id,display_name) values(v_bot_id,'Rally Bot 🤖') on conflict(id) do update set display_name='Rally Bot 🤖';
 if exists(select 1 from public.game_players where room_id=p_room and player_id=v_bot_id) then return; end if;
 if (select count(*) from public.game_players where room_id=p_room)>=r.max_players then raise exception 'Room is full'; end if;
 select s into v_seat from generate_series(1,r.max_players) s where not exists(select 1 from public.game_players where room_id=r.id and seat=s) order by s limit 1;
 insert into public.game_players(room_id,player_id,seat,is_ready) values(p_room,v_bot_id,v_seat,true);
end $$;

revoke all on function public.finalize_room(uuid,jsonb,text) from public;
revoke all on function public.create_game_room(text,int),public.join_game_room(text),public.set_player_ready(uuid,boolean),public.start_game(uuid),public.play_room_action(uuid,text,text,int),public.rematch_room(uuid),public.add_ai_bot_to_room(uuid) from public;
grant execute on function public.create_game_room(text,int),public.join_game_room(text),public.set_player_ready(uuid,boolean),public.start_game(uuid),public.rematch_room(uuid),public.add_ai_bot_to_room(uuid) to authenticated;
-- Bot moves are sent through the server route with Supabase's anon key. The
-- RPC validates p_actor_seat against the dedicated bot record before acting.
grant execute on function public.play_room_action(uuid,text,text,int) to anon, authenticated;
