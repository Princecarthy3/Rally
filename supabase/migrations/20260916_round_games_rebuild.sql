-- Dedicated, state-safe game actions for RPS, Number Hunt, and Skribbl.

create table if not exists private.number_hunt_targets (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  round integer not null,
  target integer not null check (target between 1 and 25),
  primary key(room_id, round)
);

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
  if p_action='next_round' then
    if not coalesce((state->>'revealed')::boolean,false) then raise exception 'Finish this round first'; end if;
    if current_round >= 3 then raise exception 'Match is complete'; end if;
    state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
    state:=jsonb_set(state,'{choices}','{}'::jsonb,true);
    state:=jsonb_set(state,'{revealed}','false'::jsonb,true);
    state:=jsonb_set(state,'{message}',to_jsonb(('Round '||(current_round+1)||' of 3: make a secret pick.')::text),true);
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
      if current_round>=3 or score_one>=2 or score_two>=2 then
        r.status:='completed';
        if score_one>score_two then winner:=1; elsif score_two>score_one then winner:=2; else winner:=null; end if;
        state:=jsonb_set(state,'{winnerSeat}',case when winner is null then 'null'::jsonb else to_jsonb(winner) end,true);
        state:=jsonb_set(state,'{message}',to_jsonb(case when winner is null then 'RPS match draw!' else 'Player '||winner||' wins the match!' end),true);
      else
        state:=jsonb_set(state,'{message}',to_jsonb(case when round_winner is null then 'Round draw — choose Next Round.' else 'Round '||current_round||': Player '||round_winner||' wins!' end),true);
      end if;
    else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked a choice.')::text),true); end if;
  else raise exception 'Invalid RPS action'; end if;
  update public.game_rooms set public_state=coalesce(state,'{}'::jsonb),status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

create or replace function public.play_number_hunt_action(p_room uuid, p_value text, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; guess int; target int; guesses jsonb; guessed_count int; score int; top_score int; winner int;
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
  -- Older Number Hunt rooms used an array here; Grid Rush uses player-seat keys.
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
      select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
      r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb('Number Hunt complete!'::text),true);
    else
      state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true); state:=jsonb_set(state,'{guesses}','{}'::jsonb,true); state:=jsonb_set(state,'{message}',to_jsonb(('Round '||(current_round+1)||' of 5: choose a tile.')::text),true);
    end if;
  end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if; return state;
end $$;

grant execute on function public.play_rps_action(uuid,text,text,integer), public.play_number_hunt_action(uuid,text,integer) to anon,authenticated;

create or replace function public.play_skribbl_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; started_at bigint; seconds_left int; tries_left int; guessed jsonb; resolved int; next_seat int; score int; top_score int; winner int;
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
        select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb('Skribbl match complete!'::text),true);
      else
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true); state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true); state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true); state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true); state:=jsonb_set(state,'{message}',to_jsonb(('Next drawer: Player '||next_seat||'.')::text),true);
      end if;
    end if;
  else raise exception 'Invalid Skribbl action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if; return state;
end $$;

grant execute on function public.play_skribbl_action(uuid,text,text,integer) to anon,authenticated;
