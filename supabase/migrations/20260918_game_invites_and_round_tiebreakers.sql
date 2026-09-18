-- Migration for Game Invites fix & Round Game Sudden-Death Tiebreakers

-- 1. Game Invites Fix: allow inviting friends to any waiting room the user is in
create or replace function public.send_game_invite(p_receiver uuid) returns void
language plpgsql security definer set search_path='' as $$
declare active_room public.game_rooms;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only invite friends'; end if;
  select r.* into active_room from public.game_rooms r join public.game_players gp on gp.room_id=r.id where (r.host_id=auth.uid() or gp.player_id=auth.uid()) and r.status='waiting' order by r.created_at desc limit 1;
  if active_room.id is null then raise exception 'Create or join a room first.'; end if;
  insert into public.game_invites(sender_id,receiver_id,room_id) values(auth.uid(),p_receiver,active_room.id) on conflict do nothing;
end $$;

create or replace function public.send_game_invite_to_room(p_receiver uuid, p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare target_room public.game_rooms;
begin
  if not exists(select 1 from public.friendships where user_id=auth.uid() and friend_id=p_receiver) then raise exception 'You can only invite friends'; end if;
  select r.* into target_room from public.game_rooms r join public.game_players gp on gp.room_id=r.id where r.id=p_room and gp.player_id=auth.uid() and r.status='waiting' limit 1;
  if target_room.id is null then raise exception 'This room is not available for invite or you are not in it.'; end if;
  insert into public.game_invites(sender_id,receiver_id,room_id) values(auth.uid(),p_receiver,target_room.id) on conflict do nothing;
end $$;

grant execute on function public.send_game_invite_to_room(uuid, uuid) to authenticated;

-- 2. Rock Paper Scissors Sudden Death Tiebreaker
create or replace function public.play_rps_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; count_choices int; one_choice text; two_choice text; round_winner int; score_one int; score_two int; winner int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'rps' then raise exception 'RPS is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
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
    if not found then raise exception 'Choice already locked'; end if;
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

-- 3. Number Hunt Sudden Death Tiebreaker
create or replace function public.play_number_hunt_action(p_room uuid, p_value text, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; guess int; target int; guesses jsonb; guessed_count int; score int; top_score int; count_tied int; winner int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'number_guess' then raise exception 'Number Hunt is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  guess:=p_value::int; if guess not between 1 and 25 then raise exception 'Choose a tile from 1 to 25'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  state:=coalesce(r.public_state,'{}'::jsonb); current_round:=coalesce((state->>'round')::int,1);
  insert into private.number_hunt_targets(room_id,round,target) values(p_room,current_round,1+floor(random()*25)::int) on conflict do nothing;
  select t.target into target from private.number_hunt_targets t where t.room_id=p_room and t.round=current_round;
  guesses:=case when jsonb_typeof(state->'guesses')='object' then state->'guesses' else '{}'::jsonb end; if guesses ? me.seat::text then raise exception 'You already chose a tile this round'; end if;
  guesses:=jsonb_set(guesses,array[me.seat::text],to_jsonb(guess),true); state:=jsonb_set(state,'{guesses}',guesses,true);
  if guess=target then
    score:=coalesce((state->'scores'->>me.seat::text)::int,0)+100;
    state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
    state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' found the number! +100')::text),true);
  else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' chose tile '||guess||'.')::text),true); end if;
  select count(*) into guessed_count from jsonb_object_keys(guesses);
  if guessed_count=n then
    if current_round>=5 then
      select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
      select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
      if count_tied=1 then
        select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb(('Number Hunt complete! Player '||winner||' wins!')::text),true);
      else
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
        state:=jsonb_set(state,'{guesses}','{}'::jsonb,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Tiebreaker Round '||(current_round+1)||'! Tied for 1st place!')::text),true);
      end if;
    else
      state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true); state:=jsonb_set(state,'{guesses}','{}'::jsonb,true); state:=jsonb_set(state,'{message}',to_jsonb(('Round '||(current_round+1)||' of 5: choose a tile.')::text),true);
    end if;
  end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if; return state;
end $$;

-- 4. Skribbl Sudden Death Tiebreaker
create or replace function public.play_skribbl_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; started_at bigint; seconds_left int; tries_left int; guessed jsonb; resolved int; next_seat int; score int; top_score int; count_tied int; winner int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'skribbl' then raise exception 'Skribbl is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
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
        score:=coalesce((state->'scores'->>(state->>'drawerSeat'))::int,0)+15;
        state:=jsonb_set(state,array['scores',state->>'drawerSeat'],to_jsonb(score),true);
        guessed:=guessed||jsonb_build_array(me.seat); state:=jsonb_set(state,'{guessedSeats}',guessed,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' guessed it! +'||(20+seconds_left)||' points.')::text),true);
      elsif tries_left<=0 then guessed:=guessed||jsonb_build_array(me.seat); state:=jsonb_set(state,'{guessedSeats}',guessed,true); end if;
    end if;
    select count(*) into resolved from jsonb_array_elements_text(coalesce(state->'guessedSeats','[]'::jsonb));
    if seconds_left=0 or resolved >= n-1 then
      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>coalesce((state->>'drawerSeat')::int,1);
      if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if;
      if current_round >= n*2 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        if count_tied=1 then
          select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
          r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb(('Skribbl match complete! Player '||winner||' wins!')::text),true);
        else
          state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true); state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true); state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true); state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true); state:=jsonb_set(state,'{message}',to_jsonb(('Tiebreaker Round '||(current_round+1)||': Next drawer: Player '||next_seat||'.')::text),true);
        end if;
      else
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true); state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true); state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true); state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true); state:=jsonb_set(state,'{message}',to_jsonb(('Next drawer: Player '||next_seat||'.')::text),true);
      end if;
    end if;
  else raise exception 'Invalid Skribbl action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if; return state;
end $$;

-- 5. Mini Golf Playoff Holes Tiebreaker
create or replace function public.play_mini_golf_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; balls jsonb; scores jsonb; shot jsonb; ball jsonb; hole int; angle numeric; shot_power numeric; x numeric; y numeric; next_x numeric; next_y numeric; cup_x numeric; cup_y numeric; start_x numeric; start_y numeric; strokes int; next_seat int; active_count int; winner int; lowest int; count_tied int; water boolean:=false; par int;
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
      select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((scores->>seat::text)::int,0)=lowest;
      if count_tied=1 then
        select min(seat) into winner from public.game_players where room_id=p_room and coalesce((scores->>seat::text)::int,0)=lowest;
        r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb(('Mini Golf complete! Player '||winner||' wins!')::text),true);
      else
        hole:=hole+1; par:=4; start_x:=12; start_y:=82; cup_x:=88; cup_y:=18;
        state:=jsonb_set(state,'{hole}',to_jsonb(hole),true); state:=jsonb_set(state,'{par}',to_jsonb(par),true); state:=jsonb_set(state,'{turn}',to_jsonb(1),true); state:=jsonb_set(state,'{start}',jsonb_build_object('x',start_x,'y',start_y),true); state:=jsonb_set(state,'{cup}',jsonb_build_object('x',cup_x,'y',cup_y),true); state:=jsonb_set(state,'{balls}',(select jsonb_object_agg(seat::text,jsonb_build_object('x',start_x,'y',start_y,'strokes',0,'finished',false)) from public.game_players where room_id=p_room),true); state:=jsonb_set(state,'{message}',to_jsonb(('Playoff Hole '||hole||': Sudden death tiebreaker!')::text),true);
      end if;
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

-- 6. Trivia Clash Sudden Death Tiebreaker
create or replace function public.play_trivia_action(
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
    select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111';
  end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;

  select count(*) into player_count from public.game_players where room_id=p_room;
  state := coalesce(r.public_state, '{}'::jsonb);
  current_round := coalesce((state->>'round')::int, 1);

  if p_action = 'load_question' then
    if state ? 'question' then return state; end if;
    if p_value is null then raise exception 'AI question payload is required'; end if;
    question := p_value::jsonb;
    if jsonb_typeof(question->'question') <> 'string'
      or jsonb_typeof(question->'options') <> 'array'
      or jsonb_array_length(question->'options') <> 4
      or jsonb_typeof(question->'answer') <> 'number'
      or (question->>'answer')::int not between 0 and 3 then
      raise exception 'Invalid AI question payload';
    end if;
    correct := (question->>'answer')::int;
    insert into private.trivia_answers(room_id,round,answer) values(p_room,current_round,correct)
      on conflict(room_id,round) do nothing;
    state := jsonb_set(state,'{question}',question->'question',true);
    state := jsonb_set(state,'{options}',question->'options',true);
    state := jsonb_set(state,'{answers}','{}'::jsonb,true);
    state := jsonb_set(state,'{revealed}','false'::jsonb,true);
    state := jsonb_set(state,'{message}',to_jsonb(('Question '||current_round||' is live!')::text),true);
  elsif p_action = 'answer' then
    if not state ? 'question' then raise exception 'Question is not ready'; end if;
    if coalesce((state->>'revealed')::boolean,false) then raise exception 'This question is already complete'; end if;
    selected := p_value::int;
    if selected not between 0 and 3 then raise exception 'Invalid answer'; end if;
    answers := case when jsonb_typeof(state->'answers')='object' then state->'answers' else '{}'::jsonb end;
    if answers ? me.seat::text then raise exception 'Answer already locked'; end if;
    answers := jsonb_set(answers,array[me.seat::text],to_jsonb(selected),true);
    state := jsonb_set(state,'{answers}',answers,true);
    select count(*) into answer_count from jsonb_object_keys(answers);
    if answer_count = player_count then
      select answer into correct from private.trivia_answers where room_id=p_room and round=current_round;
      for answer_row in select key, value from jsonb_each_text(answers) loop
        if answer_row.value::int = correct then
          score := coalesce((state->'scores'->>answer_row.key)::int,0) + 100;
          state := jsonb_set(state,array['scores',answer_row.key],to_jsonb(score),true);
        end if;
      end loop;
      state := jsonb_set(state,'{correctAnswer}',to_jsonb(correct),true);
      state := jsonb_set(state,'{revealed}','true'::jsonb,true);
      if current_round >= 5 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        if count_tied = 1 then
          select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
          r.status := 'completed';
          state := jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
          state := jsonb_set(state,'{message}',to_jsonb(('Trivia Clash complete! Player '||winner||' wins!')::text),true);
        else
          state := jsonb_set(state,'{message}',to_jsonb(('Scores tied! Sudden death tiebreaker question '||(current_round+1)||'!')::text),true);
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

-- 7. Memory Match Sudden Death Tiebreaker
create or replace function public.play_memory_match_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; deck jsonb; cards jsonb; flipped jsonb; matched jsonb; idx int; next_seat int; score int; winner int; top_score int; count_tied int; total_cards int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'memory_match' then raise exception 'Memory Match is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
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
