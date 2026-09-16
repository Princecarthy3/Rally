-- Number Hunt: one player hides a private 1–25 number; every other player guesses.
create or replace function public.play_number_hunt_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; n int; current_round int; picker int; guess int; target int; guesses jsonb; guessed_count int; next_picker int; winner int:=null; score int; top_score int;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status<>'playing' or r.game_type<>'number_guess' then raise exception 'Number Hunt is not active'; end if;
  if p_actor_seat is not null then select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111'; end if;
  if me.id is null then select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); end if;
  if me.id is null then raise exception 'Not a player'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  state:=coalesce(r.public_state,'{}'::jsonb);
  current_round:=coalesce((state->>'round')::int,1);
  picker:=coalesce((state->>'pickerSeat')::int,1);
  if p_action='set_target' then
    if me.seat<>picker then raise exception 'Only the picker can hide the number'; end if;
    guess:=p_value::int; if guess not between 1 and 25 then raise exception 'Choose a number from 1 to 25'; end if;
    insert into private.number_hunt_targets(room_id,round,target) values(p_room,current_round,guess)
      on conflict(room_id,round) do update set target=excluded.target;
    state:=state-'targetNumber'-'lastGuess'-'attemptsLeft';
    state:=jsonb_set(state,'{pickerSeat}',to_jsonb(picker),true);
    state:=jsonb_set(state,'{targetPicked}','true'::jsonb,true);
    state:=jsonb_set(state,'{guesses}','{}'::jsonb,true);
    state:=jsonb_set(state,'{message}',to_jsonb('The number is hidden. Every hunter gets one guess!'::text),true);
  elsif p_action='guess' then
    if not coalesce((state->>'targetPicked')::boolean,false) then raise exception 'Wait for the picker to hide a number'; end if;
    if me.seat=picker then raise exception 'The picker cannot guess'; end if;
    guess:=p_value::int; if guess not between 1 and 25 then raise exception 'Choose a number from 1 to 25'; end if;
    guesses:=case when jsonb_typeof(state->'guesses')='object' then state->'guesses' else '{}'::jsonb end;
    if guesses ? me.seat::text then raise exception 'You already guessed this round'; end if;
    select t.target into target from private.number_hunt_targets t where t.room_id=p_room and t.round=current_round;
    if target is null then raise exception 'Secret number is missing'; end if;
    guesses:=jsonb_set(guesses,array[me.seat::text],to_jsonb(guess),true);
    state:=jsonb_set(state,'{guesses}',guesses,true);
    if guess=target then
      winner:=me.seat; score:=coalesce((state->'scores'->>me.seat::text)::int,0)+100;
      state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
      state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' found it! +100 points.')::text),true);
    else state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked a guess.')::text),true); end if;
    select count(*) into guessed_count from jsonb_object_keys(guesses);
    if guessed_count=n-1 then
      select min(seat) into next_picker from public.game_players where room_id=p_room and seat>picker;
      if next_picker is null then select min(seat) into next_picker from public.game_players where room_id=p_room; end if;
      if current_round>=5 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select min(seat) into winner from public.game_players where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        r.status:='completed'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true); state:=jsonb_set(state,'{message}',to_jsonb('Number Hunt complete!'::text),true);
      else
        state:=state-'targetNumber'-'lastGuess'-'attemptsLeft';
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
        state:=jsonb_set(state,'{pickerSeat}',to_jsonb(next_picker),true);
        state:=jsonb_set(state,'{targetPicked}','false'::jsonb,true);
        state:=jsonb_set(state,'{guesses}','{}'::jsonb,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Round '||(current_round+1)||': Player '||next_picker||' hides a number.')::text),true);
      end if;
    end if;
  else raise exception 'Invalid Number Hunt action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end $$;

grant execute on function public.play_number_hunt_action(uuid,text,text,integer) to anon,authenticated;
