-- Reveal the secret word when the round ends for any reason (timer OR all guessers done).
create or replace function public.play_skribbl_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  n int;
  current_round int;
  started_at bigint;
  seconds_left int;
  tries_left int;
  guessed jsonb;
  resolved int;
  next_seat int;
  score int;
  top_score int;
  count_tied int;
  winner int;
  revealed text;
  anyone_correct boolean := false;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'skribbl' then raise exception 'Skribbl is not active'; end if;

  if p_actor_seat is not null then
    select * into me
    from public.game_players
    where room_id = p_room
      and seat = p_actor_seat
      and player_id::text like '11111111-1111-1111-1111-%';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
  if me.id is null then raise exception 'You are not in this room'; end if;

  select count(*) into n from public.game_players where room_id=p_room;
  state:=coalesce(r.public_state,jsonb_build_object('drawerSeat',1,'round',1,'scores','{}'::jsonb,'usedWords','[]'::jsonb,'guessFeed','[]'::jsonb));
  current_round:=coalesce((state->>'round')::int,1);

  if p_action='select_word' then
    if coalesce((state->>'drawerSeat')::int,1)<>me.seat then raise exception 'Only the drawer can pick the word'; end if;
    if state->>'wordSelected' is not null and state->>'wordSelected'<>'' and state->>'wordSelected'<>'null' then
      raise exception 'A word is already selected';
    end if;
    if p_value is null or length(trim(p_value))<1 then raise exception 'Pick a word'; end if;
    if exists(select 1 from jsonb_array_elements_text(coalesce(state->'usedWords','[]'::jsonb)) word where lower(word)=lower(trim(p_value))) then
      raise exception 'That word was already used in this match';
    end if;
    started_at:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
    state:=jsonb_set(state,'{wordSelected}',to_jsonb(trim(p_value)),true);
    state:=jsonb_set(state,'{roundStartedAt}',to_jsonb(started_at),true);
    state:=jsonb_set(state,'{tries}','{}'::jsonb,true);
    state:=jsonb_set(state,'{guessedSeats}','[]'::jsonb,true);
    state:=jsonb_set(state,'{guessFeed}','[]'::jsonb,true);
    state:=jsonb_set(state,'{revealedWord}','null'::jsonb,true);
    state:=jsonb_set(state,'{usedWords}',coalesce(state->'usedWords','[]'::jsonb)||jsonb_build_array(trim(p_value)),true);
    state:=jsonb_set(state,'{message}',to_jsonb('Draw it! Everyone has 60 seconds and three guesses.'::text),true);

  elsif p_action in ('guess','time_expired') then
    if state->>'wordSelected' is null or state->>'wordSelected'='' or state->>'wordSelected'='null' then
      raise exception 'No word selected yet';
    end if;
    if coalesce((state->>'drawerSeat')::int,1)=me.seat and p_action='guess' then raise exception 'The drawer cannot guess'; end if;
    started_at:=coalesce((state->>'roundStartedAt')::bigint,floor(extract(epoch from clock_timestamp())*1000)::bigint);
    seconds_left:=greatest(0,60-floor((extract(epoch from clock_timestamp())*1000-started_at)/1000)::int);
    guessed:=coalesce(state->'guessedSeats','[]'::jsonb);

    if p_action='time_expired' and seconds_left>0 then raise exception 'The round timer is still running'; end if;
    if p_action='guess' and seconds_left=0 then raise exception 'Time is up — no more guesses this round'; end if;
    if p_action='guess' and exists(select 1 from jsonb_array_elements_text(guessed) seat where seat::int=me.seat) then
      raise exception 'You are already done this round';
    end if;

    if p_action='guess' then
      tries_left:=coalesce((state->'tries'->>me.seat::text)::int,3)-1;
      state:=jsonb_set(state,array['tries',me.seat::text],to_jsonb(greatest(0,tries_left)),true);
      if lower(trim(p_value))=lower(trim(state->>'wordSelected')) then
        state:=jsonb_set(state,'{guessFeed}',coalesce(state->'guessFeed','[]'::jsonb)||jsonb_build_array(jsonb_build_object('seat',me.seat,'text','','correct',true)),true);
        score:=coalesce((state->'scores'->>me.seat::text)::int,0)+20+seconds_left;
        state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
        score:=coalesce((state->'scores'->>(state->>'drawerSeat'))::int,0)+15;
        state:=jsonb_set(state,array['scores',state->>'drawerSeat'],to_jsonb(score),true);
        guessed:=guessed||jsonb_build_array(me.seat);
        state:=jsonb_set(state,'{guessedSeats}',guessed,true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' guessed it! +'||(20+seconds_left)||' points.')::text),true);
      else
        state:=jsonb_set(state,'{guessFeed}',coalesce(state->'guessFeed','[]'::jsonb)||jsonb_build_array(jsonb_build_object('seat',me.seat,'text',trim(p_value),'correct',false)),true);
        if tries_left<=0 then
          guessed:=guessed||jsonb_build_array(me.seat);
          state:=jsonb_set(state,'{guessedSeats}',guessed,true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' used all 3 guesses.')::text),true);
        end if;
      end if;
    end if;

    select count(*) into resolved from jsonb_array_elements_text(coalesce(state->'guessedSeats','[]'::jsonb));
    select exists(
      select 1 from jsonb_array_elements(coalesce(state->'guessFeed','[]'::jsonb)) g
      where coalesce((g->>'correct')::boolean,false)
    ) into anyone_correct;

    -- Round ends: timer hit 0 OR every non-drawer is done (correct or out of tries)
    if seconds_left=0 or resolved >= n-1 then
      revealed := trim(state->>'wordSelected');
      -- Always reveal the word when the round closes
      if revealed is not null and revealed <> '' and revealed <> 'null' then
        state:=jsonb_set(state,'{revealedWord}',to_jsonb(revealed),true);
        if p_action='time_expired' or seconds_left=0 then
          state:=jsonb_set(state,'{message}',to_jsonb(('Time is up! The word was: '||revealed)::text),true);
        elsif not anyone_correct then
          state:=jsonb_set(state,'{message}',to_jsonb(('No one got it! The word was: '||revealed)::text),true);
        else
          state:=jsonb_set(state,'{message}',to_jsonb(('Round over. The word was: '||revealed)::text),true);
        end if;
      end if;

      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>coalesce((state->>'drawerSeat')::int,1);
      if next_seat is null then select min(seat) into next_seat from public.game_players where room_id=p_room; end if;

      if current_round >= n*2 then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players gp where coalesce((state->'scores'->>gp.seat::text)::int,0)=top_score;
        if count_tied=1 then
          select gp.seat into winner from public.game_players gp where coalesce((state->'scores'->>gp.seat::text)::int,0)=top_score limit 1;
          r.status:='completed';
          state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Skribbl match complete! Player '||winner||' wins! (Last word: '||coalesce(revealed,'?')||')')::text),true);
        else
          state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
          state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true);
          state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true);
          state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true);
          state:=jsonb_set(state,'{message}',to_jsonb(('Tiebreaker. The word was: '||coalesce(revealed,'?')||'. Next drawer: Player '||next_seat||'.')::text),true);
        end if;
      else
        state:=jsonb_set(state,'{round}',to_jsonb(current_round+1),true);
        state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true);
        state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true);
        state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true);
        if not anyone_correct then
          state:=jsonb_set(state,'{message}',to_jsonb(('No one got it! The word was: '||coalesce(revealed,'?')||'. Next drawer: Player '||next_seat||'.')::text),true);
        else
          state:=jsonb_set(state,'{message}',to_jsonb(('Round over. The word was: '||coalesce(revealed,'?')||'. Next drawer: Player '||next_seat||'.')::text),true);
        end if;
      end if;
    elsif p_action='time_expired' then
      -- Safety: timer path that somehow did not enter the block above
      revealed := trim(state->>'wordSelected');
      state:=jsonb_set(state,'{revealedWord}',to_jsonb(revealed),true);
      state:=jsonb_set(state,'{message}',to_jsonb(('Time is up! The word was: '||revealed)::text),true);
    end if;
  else
    raise exception 'Invalid Skribbl action';
  end if;

  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return state;
end;
$$;

grant execute on function public.play_skribbl_action(uuid,text,text,int) to authenticated, anon;
