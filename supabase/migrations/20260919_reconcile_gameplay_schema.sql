-- Final deployment reconciliation for all current game RPCs.
-- This migration is safe to rerun after partial/manual migration attempts.

alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ));

-- Remove stale overloads that make PostgREST choose the wrong action signature.
drop function if exists public.play_room_action(uuid,text,text);
drop function if exists public.play_number_hunt_action(uuid,text,int);

-- Every browser and bot action uses the four-argument form.
do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.play_room_action(uuid,text,text,integer)',
    'public.play_ludo_action(uuid,text,text,integer)',
    'public.play_rps_action(uuid,text,text,integer)',
    'public.play_number_hunt_action(uuid,text,text,integer)',
    'public.play_skribbl_action(uuid,text,text,integer)',
    'public.play_mini_golf_action(uuid,text,text,integer)',
    'public.play_battleship_action(uuid,text,text,integer)',
    'public.play_memory_match_action(uuid,text,text,integer)',
    'public.play_trivia_clash_action(uuid,text,text,integer)'
  ]
  loop
    if to_regprocedure(signature) is not null then
      execute format('grant execute on function %s to authenticated, anon', signature);
    end if;
  end loop;

  foreach signature in array array[
    'public.start_game(uuid)',
    'public.start_ludo_game(uuid)',
    'public.start_memory_match(uuid)',
    'public.start_mini_golf(uuid)',
    'public.start_battleship(uuid)'
  ]
  loop
    if to_regprocedure(signature) is not null then
      execute format('grant execute on function %s to authenticated', signature);
    end if;
  end loop;
end $$;

-- Accept all reserved seat-specific bot IDs in deployed action functions.
do $$
declare
  function_row record;
  definition text;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
  loop
    select pg_get_functiondef(function_row.signature) into definition;
    if definition like '%player_id%11111111-1111-1111-1111-111111111111%' then
      definition := regexp_replace(
        definition,
        'player_id[[:space:]]*=[[:space:]]*''11111111-1111-1111-1111-111111111111''',
        'player_id::text like ''11111111-1111-1111-1111-1111111111%''',
        'g'
      );
      execute definition;
    end if;
  end loop;
end $$;
