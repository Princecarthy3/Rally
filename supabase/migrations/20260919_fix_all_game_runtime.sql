-- Final runtime repair for deployed databases with partially-applied game migrations.
-- Keep the browser contract stable: room RPCs use one signature and action RPCs
-- use the four-argument form with a default actor seat for human players.

alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ));

drop function if exists public.play_room_action(uuid,text,text);
drop function if exists public.play_number_hunt_action(uuid,text,int);

create or replace function public.create_game_room(p_game_type text,p_max_players int default 2)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_code text;
  v_room uuid;
  v_max int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_game_type not in (
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo'
  ) then
    raise exception 'Unknown game';
  end if;

  v_max := case
    when p_game_type in ('ping_pong','tic_tac_toe','connect_four','battleship') then 2
    else greatest(2, least(4, coalesce(p_max_players, 2)))
  end;

  loop
    v_code := public.random_room_code();
    exit when not exists(select 1 from public.game_rooms where code=v_code);
  end loop;

  insert into public.game_rooms(code,game_type,host_id,max_players)
  values(v_code,p_game_type,auth.uid(),v_max)
  returning id into v_room;

  insert into public.game_players(room_id,player_id,seat,is_ready)
  values(v_room,auth.uid(),1,false);
  return v_code;
end
$$;

create or replace function public.join_game_room(p_code text)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.game_rooms;
  v_seat int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;

  select *
    into r
    from public.game_rooms
   where code=upper(trim(p_code))
   for update;

  if r.id is null then raise exception 'Room not found'; end if;

  if exists(
    select 1
      from public.game_players
     where room_id=r.id and player_id=auth.uid()
  ) then
    return r.code;
  end if;

  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  if (select count(*) from public.game_players where room_id=r.id) >= r.max_players then
    raise exception 'Room is full';
  end if;

  select s
    into v_seat
    from generate_series(1, r.max_players) s
   where not exists(
     select 1 from public.game_players
      where room_id=r.id and seat=s
   )
   order by s
   limit 1;

  insert into public.game_players(room_id,player_id,seat,is_ready)
  values(r.id,auth.uid(),v_seat,false);
  return r.code;
end
$$;

grant execute on function public.create_game_room(text,int) to authenticated;
grant execute on function public.join_game_room(text) to authenticated;
grant execute on function public.set_player_ready(uuid,boolean) to authenticated;
grant execute on function public.start_game(uuid) to authenticated;
grant execute on function public.add_bot_to_room(uuid) to authenticated;

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
    'public.play_memory_match_action(uuid,text,text,integer)'
  ]
  loop
    if to_regprocedure(signature) is not null then
      execute format('grant execute on function %s to authenticated, anon', signature);
    end if;
  end loop;
end
$$;

drop policy if exists "authenticated read rooms" on public.game_rooms;
create policy "authenticated read rooms"
  on public.game_rooms for select to authenticated using (true);

drop policy if exists "authenticated read players" on public.game_players;
create policy "authenticated read players"
  on public.game_players for select to authenticated using (true);

grant select on public.game_rooms to authenticated;
grant select on public.game_players to authenticated;
