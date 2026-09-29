-- Fix Emoji Decode install datatype mismatch (42804) by accepting jsonb arrays
-- from the API and casting explicitly inside the function. Also allow the
-- service role (server route) to install so generation stays under a few seconds.

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

-- Drop all prior overloads so PostgREST binds the new signature cleanly.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'install_emoji_decode_puzzle'
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

create or replace function public.install_emoji_decode_puzzle(
  p_room uuid,
  p_round integer,
  p_answer text,
  p_acceptable_answers jsonb,
  p_emojis jsonb,
  p_category text,
  p_difficulty text,
  p_explanation text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  r public.game_rooms;
  state jsonb;
  answers text[];
  emojis text[];
  ends_at bigint;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'emoji_decode' or r.status <> 'playing' then
    raise exception 'Game is not active';
  end if;

  -- Authenticated hosts may install; service role (auth.uid() null) may also install
  -- when called from the trusted Next.js API route.
  if auth.uid() is not null and r.host_id is distinct from auth.uid() then
    raise exception 'Only the room host can install a puzzle';
  end if;

  state := coalesce(r.public_state, '{}'::jsonb);

  if coalesce((state->>'round')::integer, 0) <> p_round
     or coalesce(state->>'phase', '') <> 'generating_puzzle' then
    return state;
  end if;

  select coalesce(array_agg(x), '{}'::text[])
    into answers
  from jsonb_array_elements_text(coalesce(p_acceptable_answers, '[]'::jsonb)) as t(x);

  select coalesce(array_agg(x), '{}'::text[])
    into emojis
  from jsonb_array_elements_text(coalesce(p_emojis, '[]'::jsonb)) as t(x);

  if p_answer is null or length(trim(p_answer)) < 1 then
    raise exception 'Puzzle answer is required';
  end if;
  if emojis is null or coalesce(array_length(emojis, 1), 0) < 1 then
    raise exception 'Puzzle emojis are required';
  end if;

  insert into private.emoji_decode_answers (room_id, round_no, answer, acceptable_answers, explanation)
  values (
    p_room,
    p_round,
    trim(p_answer),
    answers,
    coalesce(nullif(trim(p_explanation), ''), 'Decode the emojis!')
  )
  on conflict (room_id, round_no) do update
    set answer = excluded.answer,
        acceptable_answers = excluded.acceptable_answers,
        explanation = excluded.explanation;

  ends_at := ((extract(epoch from clock_timestamp()) * 1000) + 30000)::bigint;

  state := jsonb_set(state, '{emojis}', to_jsonb(emojis), true);
  state := jsonb_set(state, '{category}', to_jsonb(coalesce(nullif(trim(p_category), ''), 'Random')), true);
  state := jsonb_set(state, '{difficulty}', to_jsonb(coalesce(nullif(trim(p_difficulty), ''), 'medium')), true);
  state := jsonb_set(state, '{roundEndsAt}', to_jsonb(ends_at), true);
  state := jsonb_set(state, '{phase}', '"playing"'::jsonb, true);
  state := jsonb_set(state, '{solvedSeats}', '[]'::jsonb, true);
  state := jsonb_set(state, '{roundPoints}', '{}'::jsonb, true);
  state := jsonb_set(state, '{message}', to_jsonb('Decode the emojis!'), true);
  -- Never leak the answer into public_state
  state := state - 'answer' - 'explanation';

  update public.game_rooms
  set public_state = state,
      state_version = state_version + 1,
      updated_at = now()
  where id = p_room;

  return state;
end;
$$;

revoke all on function public.install_emoji_decode_puzzle(uuid, integer, text, jsonb, jsonb, text, text, text) from public, anon;
grant execute on function public.install_emoji_decode_puzzle(uuid, integer, text, jsonb, jsonb, text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
