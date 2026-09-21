-- Skribbl.io-style match: 3 rounds, each player draws once per round.
-- Unlimited guesses during a turn; no points if you never get the word.
create or replace function public.play_skribbl_action(p_room uuid, p_action text, p_value text default null, p_actor_seat int default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  n int;
  current_round int;
  max_rounds int := 3;
  draw_index int;
  started_at bigint;
  seconds_left int;
  guessed jsonb;
  resolved int;
  next_seat int;
  score int;
  top_score int;
  count_tied int;
  winner int;
  revealed text;
  anyone_correct boolean := false;
  correct_count int := 0;
  guess_rank int;
  drawer_bonus int;
  seats int[];
  i int;
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
  if n < 1 then raise exception 'No players in room'; end if;

  select array_agg(seat order by seat) into seats from public.game_players where room_id=p_room;

  state:=coalesce(
    r.public_state,
    jsonb_build_object(
      'drawerSeat', seats[1],
      'round', 1,
      'drawIndex', 0,
      'maxRounds', 3,
      'scores', '{}'::jsonb,
      'usedWords', '[]'::jsonb,
      'guessFeed', '[]'::jsonb
    )
  );
  current_round:=greatest(1, coalesce((state->>'round')::int,1));
  max_rounds:=greatest(1, coalesce((state->>'maxRounds')::int,3));
  draw_index:=greatest(0, coalesce((state->>'drawIndex')::int,0));

  if p_action='select_word' then
    if coalesce((state->>'drawerSeat')::int, seats[1])<>me.seat then raise exception 'Only the drawer can pick the word'; end if;
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
    state:=jsonb_set(state,'{guessedSeats}','[]'::jsonb,true);
    state:=jsonb_set(state,'{guessFeed}','[]'::jsonb,true);
    state:=jsonb_set(state,'{guessOrder}','[]'::jsonb,true);
    state:=jsonb_set(state,'{revealedWord}','null'::jsonb,true);
    state:=jsonb_set(state,'{usedWords}',coalesce(state->'usedWords','[]'::jsonb)||jsonb_build_array(trim(p_value)),true);
    state:=jsonb_set(state,'{maxRounds}',to_jsonb(max_rounds),true);
    state:=jsonb_set(state,'{message}',to_jsonb(
      ('Round '||current_round||'/'||max_rounds||' — draw it! 60s. Guessers who miss get 0 for this turn.')::text
    ),true);

  elsif p_action in ('guess','time_expired') then
    if state->>'wordSelected' is null or state->>'wordSelected'='' or state->>'wordSelected'='null' then
      raise exception 'No word selected yet';
    end if;
    if coalesce((state->>'drawerSeat')::int,seats[1])=me.seat and p_action='guess' then
      raise exception 'The drawer cannot guess';
    end if;
    started_at:=coalesce((state->>'roundStartedAt')::bigint,floor(extract(epoch from clock_timestamp())*1000)::bigint);
    seconds_left:=greatest(0,60-floor((extract(epoch from clock_timestamp())*1000-started_at)/1000)::int);
    guessed:=coalesce(state->'guessedSeats','[]'::jsonb);

    if p_action='time_expired' and seconds_left>0 then raise exception 'The round timer is still running'; end if;
    if p_action='guess' and seconds_left=0 then raise exception 'Time is up — no more guesses this turn'; end if;
    if p_action='guess' and exists(select 1 from jsonb_array_elements_text(guessed) seat where seat::int=me.seat) then
      raise exception 'You already got it this turn';
    end if;

    if p_action='guess' then
      -- Unlimited attempts until correct or time ends; only a correct guess scores.
      if lower(trim(p_value))=lower(trim(state->>'wordSelected')) then
        -- Rank among correct guessers (0-based)
        select count(*) into guess_rank
        from jsonb_array_elements_text(coalesce(state->'guessOrder','[]'::jsonb));
        -- skribbl-like: first ~100+time, later slightly less
        score:=greatest(50, 100 - guess_rank*15) + least(60, seconds_left);
        state:=jsonb_set(state,array['scores',me.seat::text],
          to_jsonb(coalesce((state->'scores'->>me.seat::text)::int,0)+score), true);
        state:=jsonb_set(state,'{guessOrder}',coalesce(state->'guessOrder','[]'::jsonb)||jsonb_build_array(me.seat),true);
        guessed:=guessed||jsonb_build_array(me.seat);
        state:=jsonb_set(state,'{guessedSeats}',guessed,true);
        state:=jsonb_set(state,'{guessFeed}',coalesce(state->'guessFeed','[]'::jsonb)||jsonb_build_array(
          jsonb_build_object('seat',me.seat,'text','','correct',true,'points',score)
        ),true);
        state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' guessed it! +'||score||' pts')::text),true);
      else
        -- Wrong guess: show in feed, no score, can try again
        state:=jsonb_set(state,'{guessFeed}',coalesce(state->'guessFeed','[]'::jsonb)||jsonb_build_array(
          jsonb_build_object('seat',me.seat,'text',trim(p_value),'correct',false)
        ),true);
      end if;
    end if;

    select count(*) into resolved from jsonb_array_elements_text(coalesce(state->'guessedSeats','[]'::jsonb));
    select count(*) into correct_count from jsonb_array_elements_text(coalesce(state->'guessOrder','[]'::jsonb));
    anyone_correct := correct_count > 0;

    -- Turn ends when timer hits 0 OR every non-drawer has guessed correctly
    if seconds_left=0 or resolved >= n-1 then
      revealed := trim(state->>'wordSelected');
      if revealed is not null and revealed <> '' and revealed <> 'null' then
        state:=jsonb_set(state,'{revealedWord}',to_jsonb(revealed),true);
      end if;

      -- Drawer bonus: more points when more people get it (skribbl-style)
      if anyone_correct and n > 1 then
        drawer_bonus := greatest(25, (correct_count * 50) / greatest(1, n-1) + least(30, seconds_left/2));
        state:=jsonb_set(
          state,
          array['scores', coalesce(state->>'drawerSeat','1')],
          to_jsonb(coalesce((state->'scores'->>(state->>'drawerSeat'))::int,0)+drawer_bonus),
          true
        );
      end if;

      if seconds_left=0 and not anyone_correct then
        state:=jsonb_set(state,'{message}',to_jsonb(('Time is up! Nobody got it. The word was: '||coalesce(revealed,'?')||'. (0 pts for guessers)')::text),true);
      elsif seconds_left=0 then
        state:=jsonb_set(state,'{message}',to_jsonb(('Time is up! The word was: '||coalesce(revealed,'?'))::text),true);
      elsif not anyone_correct then
        state:=jsonb_set(state,'{message}',to_jsonb(('No one got it! The word was: '||coalesce(revealed,'?'))::text),true);
      else
        state:=jsonb_set(state,'{message}',to_jsonb(('Everyone got it! The word was: '||coalesce(revealed,'?'))::text),true);
      end if;

      -- Advance drawer within the round; after last seat, next round
      draw_index := draw_index + 1;
      state:=jsonb_set(state,'{drawIndex}',to_jsonb(draw_index),true);

      -- Total draws finished across the match
      if draw_index >= n * max_rounds then
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score from public.game_players where room_id=p_room;
        select count(*) into count_tied from public.game_players gp where coalesce((state->'scores'->>gp.seat::text)::int,0)=top_score;
        select gp.seat into winner from public.game_players gp where coalesce((state->'scores'->>gp.seat::text)::int,0)=top_score order by gp.seat limit 1;
        r.status:='completed';
        state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
        state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true);
        state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true);
        state:=jsonb_set(state,'{message}',to_jsonb(
          ('Match over after '||max_rounds||' rounds! Player '||winner||' wins with '||coalesce(top_score,0)||' pts. Last word: '||coalesce(revealed,'?'))::text
        ),true);
      else
        -- Next drawer seat from ordered seats array (1-based in postgres arrays)
        next_seat := seats[(draw_index % n) + 1];
        current_round := (draw_index / n) + 1;
        state:=jsonb_set(state,'{round}',to_jsonb(current_round),true);
        state:=jsonb_set(state,'{drawerSeat}',to_jsonb(next_seat),true);
        state:=jsonb_set(state,'{wordSelected}','null'::jsonb,true);
        state:=jsonb_set(state,'{roundStartedAt}','null'::jsonb,true);
        state:=jsonb_set(state,'{message}',to_jsonb(
          ('Round '||current_round||'/'||max_rounds||' — next drawer: Player '||next_seat||'. Word was: '||coalesce(revealed,'?'))::text
        ),true);
      end if;
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
