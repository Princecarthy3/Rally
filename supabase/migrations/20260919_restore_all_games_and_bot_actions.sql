-- Restore the complete game allow-list and bot action support on deployed databases.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ));

create or replace function public.create_game_room(p_game_type text,p_max_players int default 2)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_code text;
  v_room uuid;
  v_max int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_game_type not in (
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ) then raise exception 'Unknown game'; end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship') then 2
    else greatest(2, least(4, p_max_players))
  end;

  loop
    v_code := public.random_room_code();
    exit when not exists(select 1 from public.game_rooms where code=v_code);
  end loop;

  insert into public.game_rooms(code,game_type,host_id,max_players)
  values(v_code,p_game_type,auth.uid(),v_max)
  returning id into v_room;

  insert into public.game_players(room_id,player_id,seat)
  values(v_room,auth.uid(),1);
  return v_code;
end $$;

grant execute on function public.create_game_room(text,int) to authenticated;

-- Earlier deployments only accepted the original bot UUID ending in 1111.
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
        'player_id::text like ''11111111-1111-1111-1111-1111111111%'''
        ,'g'
      );
      execute definition;
    end if;
  end loop;
end $$;
