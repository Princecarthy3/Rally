-- Final Emoji Decode install fix: avoid polymorphic "unknown" types (42804).

create schema if not exists private;

create table if not exists private.emoji_decode_answers (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  round_no integer not null check (round_no between 1 and 8),
  answer text not null,
  acceptable_answers text[] not null default '{}'::text[],
  explanation text not null default 'Decode the emojis!',
  created_at timestamptz not null default now(),
  primary key (room_id, round_no)
);

alter table private.emoji_decode_answers enable row level security;
revoke all on private.emoji_decode_answers from public, anon, authenticated;

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
  p_acceptable_answers jsonb default '[]'::jsonb,
  p_emojis jsonb default '[]'::jsonb,
  p_category text default 'Random',
  p_difficulty text default 'medium',
  p_explanation text default 'Decode the emojis!'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth, pg_temp
as $$
declare
  r public.game_rooms;
  state jsonb;
  answers text[] := '{}'::text[];
  ends_at bigint;
  answer_text text;
  category_text text;
  difficulty_text text;
  explanation_text text;
  emojis_json jsonb;
  answers_json jsonb;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.game_type <> 'emoji_decode' or r.status <> 'playing' then
    raise exception 'Game is not active';
  end if;

  if auth.uid() is not null and r.host_id is distinct from auth.uid() then
    raise exception 'Only the room host can install a puzzle';
  end if;

  state := coalesce(r.public_state, '{}'::jsonb);

  if coalesce((state ->> 'round')::integer, 0) <> p_round
     or coalesce(state ->> 'phase', '') <> 'generating_puzzle' then
    return state;
  end if;

  answer_text := trim(coalesce(p_answer, ''));
  if answer_text = '' then
    raise exception 'Puzzle answer is required';
  end if;

  emojis_json := case
    when p_emojis is null or jsonb_typeof(p_emojis) <> 'array' then '[]'::jsonb
    else p_emojis
  end;
  if jsonb_array_length(emojis_json) < 1 then
    raise exception 'Puzzle emojis are required';
  end if;

  answers_json := case
    when p_acceptable_answers is null or jsonb_typeof(p_acceptable_answers) <> 'array' then '[]'::jsonb
    else p_acceptable_answers
  end;

  select coalesce(array_agg(elem::text), '{}'::text[])
    into answers
  from jsonb_array_elements_text(answers_json) as e(elem);

  category_text := nullif(trim(coalesce(p_category, '')), '');
  if category_text is null then category_text := 'Random'; end if;

  difficulty_text := nullif(trim(coalesce(p_difficulty, '')), '');
  if difficulty_text is null then difficulty_text := 'medium'; end if;

  explanation_text := nullif(trim(coalesce(p_explanation, '')), '');
  if explanation_text is null then explanation_text := 'Decode the emojis!'; end if;

  insert into private.emoji_decode_answers (room_id, round_no, answer, acceptable_answers, explanation)
  values (p_room, p_round, answer_text, answers, explanation_text)
  on conflict (room_id, round_no) do update
    set answer = excluded.answer,
        acceptable_answers = excluded.acceptable_answers,
        explanation = excluded.explanation;

  ends_at := ((extract(epoch from clock_timestamp()) * 1000.0) + 30000.0)::bigint;

  state := state
    || jsonb_build_object(
      'emojis', emojis_json,
      'category', category_text,
      'difficulty', difficulty_text,
      'roundEndsAt', ends_at,
      'phase', 'playing',
      'solvedSeats', '[]'::jsonb,
      'roundPoints', '{}'::jsonb,
      'message', 'Decode the emojis!'
    );
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
