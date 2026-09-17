-- Trivia Clash: five shared questions with server-side answer validation.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in ('basketball','ping_pong','rps','number_guess','trivia_clash','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo'));

create table if not exists private.trivia_answers (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  round integer not null,
  answer integer not null check (answer between 0 and 3),
  primary key (room_id, round)
);

do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, '''number_guess'',''tic_tac_toe''', '''number_guess'',''trivia_clash'',''tic_tac_toe''');
    execute definition;
  end if;
end $$;

create or replace function public.play_trivia_action(
  p_room uuid,
  p_action text,
  p_value text default null,
  p_actor_seat int default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  answers jsonb;
  question jsonb;
  correct int;
  selected int;
  current_round int;
  player_count int;
  answer_count int;
  score int;
  winner int;
  top_score int;
  answer_row record;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.status <> 'playing' or r.game_type <> 'trivia_clash' then raise exception 'Trivia Clash is not active'; end if;

  if p_actor_seat is not null then
    select * into me from public.game_players
    where room_id=p_room and seat=p_actor_seat
      and player_id='11111111-1111-1111-1111-111111111111';
  end if;
  if me.id is null then
    select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  end if;
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
        select max(coalesce((state->'scores'->>seat::text)::int,0)) into top_score
        from public.game_players where room_id=p_room;
        select min(seat) into winner from public.game_players
        where room_id=p_room and coalesce((state->'scores'->>seat::text)::int,0)=top_score;
        r.status := 'completed';
        state := jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
        state := jsonb_set(state,'{message}',to_jsonb('Trivia Clash complete!'::text),true);
      else
        state := jsonb_set(state,'{message}',to_jsonb(('Correct answer revealed! +100 points for each correct player.')::text),true);
      end if;
    else
      state := jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' locked an answer.')::text),true);
    end if;
  elsif p_action = 'next_question' then
    if not coalesce((state->>'revealed')::boolean,false) then raise exception 'Finish this question first'; end if;
    if current_round >= 5 then raise exception 'Trivia Clash is complete'; end if;
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

grant execute on function public.play_trivia_action(uuid,text,text,integer) to anon,authenticated;
