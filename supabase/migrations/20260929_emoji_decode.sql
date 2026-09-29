-- Emoji Decode uses public room state for clues and a private table for answers.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
do $$
declare existing_constraint record;
begin
  for existing_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='game_rooms' and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%game_type%'
  loop
    execute format('alter table public.game_rooms drop constraint %I',existing_constraint.conname);
  end loop;
end $$;
alter table public.game_rooms add constraint game_rooms_game_type_check check (game_type in (
  'basketball','dice_dash','trivia_clash','uno','rps','number_guess','memory_match','mini_golf','battleship',
  'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo','racing','rally_racing','rally_combat','combat','emoji_decode'
));

-- Keep the current create_game_room implementation and extend its allowlist.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure) into definition;
  if position('emoji_decode' in definition)=0 then
    definition:=replace(definition, '''skribbl'',''ludo''', '''skribbl'',''ludo'',''emoji_decode''');
    definition:=replace(definition, '''ludo'') then', '''ludo'',''emoji_decode'') then');
    if position('emoji_decode' in definition)=0 then raise exception 'Could not extend create_game_room allowlist for Emoji Decode'; end if;
    execute definition;
  end if;
end $$;

create schema if not exists private;
create table if not exists private.emoji_decode_answers (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  round_no integer not null check (round_no between 1 and 8),
  answer text not null,
  acceptable_answers text[] not null default '{}',
  explanation text not null,
  created_at timestamptz not null default now(),
  primary key (room_id, round_no)
);
alter table private.emoji_decode_answers enable row level security;
revoke all on private.emoji_decode_answers from public, anon, authenticated;

create or replace function public.start_emoji_decode(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n integer;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'emoji_decode' then raise exception 'Room not found'; end if;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<2 or n>4 then raise exception 'Emoji Decode needs 2 to 4 players'; end if;
  if exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'All players must be ready'; end if;
  update public.game_rooms set status='playing',public_state=jsonb_build_object(
    'round',1,'maxRounds',8,'phase','generating_puzzle','scores','{}'::jsonb,
    'solvedSeats','[]'::jsonb,'roundPoints','{}'::jsonb,'categoryPreference','Random',
    'difficulty','medium','message','Creating your first puzzle…'
  ),state_version=state_version+1,updated_at=now() where id=p_room;
end $$;

-- Called only by the authenticated server route through the service-role client.
create or replace function public.install_emoji_decode_puzzle(
  p_room uuid,p_round integer,p_answer text,p_acceptable_answers text[],p_emojis text[],p_category text,p_difficulty text,p_explanation text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; state jsonb;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'emoji_decode' or r.status<>'playing' then raise exception 'Game is not active'; end if;
  if auth.uid() is null or r.host_id<>auth.uid() then raise exception 'Only the room host can install a puzzle'; end if;
  state:=r.public_state;
  if coalesce((state->>'round')::integer,0)<>p_round or state->>'phase'<>'generating_puzzle' then return state; end if;
  insert into private.emoji_decode_answers(room_id,round_no,answer,acceptable_answers,explanation)
  values(p_room,p_round,p_answer,p_acceptable_answers,p_explanation)
  on conflict(room_id,round_no) do update set answer=excluded.answer,acceptable_answers=excluded.acceptable_answers,explanation=excluded.explanation;
  state:=jsonb_set(state,'{emojis}',to_jsonb(p_emojis),true);
  state:=jsonb_set(state,'{category}',to_jsonb(p_category),true);
  state:=jsonb_set(state,'{difficulty}',to_jsonb(p_difficulty),true);
  state:=jsonb_set(state,'{roundEndsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint+30000),true);
  state:=jsonb_set(state,'{phase}','"playing"'::jsonb,true);
  state:=jsonb_set(state,'{solvedSeats}','[]'::jsonb,true);
  state:=jsonb_set(state,'{roundPoints}','{}'::jsonb,true);
  state:=jsonb_set(state,'{message}',to_jsonb('Decode the emojis!'),true);
  update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
  return state;
end $$;

create or replace function public.play_emoji_decode_action(p_room uuid,p_action text,p_value text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; state jsonb; answer_row private.emoji_decode_answers; guess_text text; solved jsonb; points jsonb; order_no integer; awarded integer; n integer;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'emoji_decode' or r.status<>'playing' then raise exception 'Emoji Decode is not active'; end if;
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  if me.id is null then raise exception 'You are not in this room'; end if;
  state:=r.public_state;
  if p_action='guess' then
    if state->>'phase'<>'playing' then raise exception 'This round is not accepting guesses'; end if;
    if (state->>'roundEndsAt')::bigint <= (extract(epoch from clock_timestamp())*1000)::bigint then raise exception 'Time is up'; end if;
    if p_value is null or length(trim(p_value))<1 or length(p_value)>80 then raise exception 'Enter a valid guess'; end if;
    solved:=coalesce(state->'solvedSeats','[]'::jsonb);
    if exists(select 1 from jsonb_array_elements_text(solved) x where x::integer=me.seat) then raise exception 'You already solved this round'; end if;
    select * into answer_row from private.emoji_decode_answers where room_id=p_room and round_no=(state->>'round')::integer;
    if answer_row.room_id is null then raise exception 'Puzzle is still loading'; end if;
    guess_text:=regexp_replace(lower(trim(p_value)),'[^[:alnum:]]','','g');
    if not exists(select 1 from unnest(array_append(answer_row.acceptable_answers,answer_row.answer)) a where regexp_replace(lower(trim(a)),'[^[:alnum:]]','','g')=guess_text) then
      return jsonb_build_object('correct',false,'public_state',state,'status',r.status);
    end if;
    order_no:=jsonb_array_length(solved)+1;
    awarded:=case order_no when 1 then 100 when 2 then 75 when 3 then 50 else 25 end;
    solved:=solved||jsonb_build_array(me.seat);
    points:=coalesce(state->'roundPoints','{}'::jsonb)||jsonb_build_object(me.seat::text,awarded);
    state:=jsonb_set(state,'{solvedSeats}',solved,true);
    state:=jsonb_set(state,'{roundPoints}',points,true);
    state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(coalesce((state->'scores'->>me.seat::text)::integer,0)+awarded),true);
    select count(*) into n from public.game_players where room_id=p_room;
    if jsonb_array_length(solved)>=n then
      state:=jsonb_set(state,'{phase}','"round_complete"'::jsonb,true);
      state:=jsonb_set(state,'{revealAt}',to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint+4000),true);
      state:=jsonb_set(state,'{answer}',to_jsonb(answer_row.answer),true);
      state:=jsonb_set(state,'{explanation}',to_jsonb(answer_row.explanation),true);
      state:=jsonb_set(state,'{message}','"Everyone decoded it!"'::jsonb,true);
    else
      state:=jsonb_set(state,'{message}',to_jsonb('A player decoded it! Keep guessing.'),true);
    end if;
    update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
    return jsonb_build_object('correct',true,'points',awarded,'public_state',state,'status',r.status);
  elsif p_action='time_expired' then
    if state->>'phase'<>'playing' then return jsonb_build_object('public_state',state,'status',r.status); end if;
    if (state->>'roundEndsAt')::bigint>(extract(epoch from clock_timestamp())*1000)::bigint then raise exception 'The round timer is still running'; end if;
    select * into answer_row from private.emoji_decode_answers where room_id=p_room and round_no=(state->>'round')::integer;
    if answer_row.room_id is null then raise exception 'Puzzle is still loading'; end if;
    state:=jsonb_set(state,'{phase}','"round_complete"'::jsonb,true);
    state:=jsonb_set(state,'{answer}',to_jsonb(answer_row.answer),true);
    state:=jsonb_set(state,'{explanation}',to_jsonb(answer_row.explanation),true);
    state:=jsonb_set(state,'{revealAt}',to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint+4000),true);
    state:=jsonb_set(state,'{message}','"Time is up!"'::jsonb,true);
  elsif p_action='advance' then
    if r.host_id<>auth.uid() then raise exception 'Only the host can advance the round'; end if;
    if state->>'phase'<>'round_complete' or (state->>'revealAt')::bigint>(extract(epoch from clock_timestamp())*1000)::bigint then raise exception 'Round results are still showing'; end if;
    if (state->>'round')::integer>=8 then
      state:=jsonb_set(state,'{phase}','"final_results"'::jsonb,true);
      state:=jsonb_set(state,'{winnerSeat}',to_jsonb((select seat from public.game_players where room_id=p_room order by coalesce((state->'scores'->>seat::text)::integer,0) desc,seat asc limit 1)),true);
      state:=jsonb_set(state,'{message}','"Emoji Decode complete!"'::jsonb,true);
      r.status:='completed';
    else
      state:=jsonb_set(state,'{round}',to_jsonb((state->>'round')::integer+1),true);
      state:=jsonb_set(state,'{phase}','"generating_puzzle"'::jsonb,true);
      state:=state-'answer'-'emojis'-'category'-'roundEndsAt'-'revealAt'-'solvedSeats'-'roundPoints';
      state:=jsonb_set(state,'{message}','"Creating your next puzzle…"'::jsonb,true);
    end if;
  else raise exception 'Invalid Emoji Decode action'; end if;
  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
  if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
  return jsonb_build_object('public_state',state,'status',r.status);
end $$;

revoke all on function public.install_emoji_decode_puzzle(uuid,integer,text,text[],text[],text,text,text) from public,anon,authenticated;
grant execute on function public.install_emoji_decode_puzzle(uuid,integer,text,text[],text[],text,text,text) to authenticated;
grant execute on function public.start_emoji_decode(uuid) to authenticated;
grant execute on function public.play_emoji_decode_action(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
