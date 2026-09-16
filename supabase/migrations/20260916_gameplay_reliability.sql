-- Rally gameplay reliability patch. Apply after the existing game migrations.
-- It patches already-deployed function bodies without depending on a specific
-- function OID, then restores the bot's ready state on rematches.

do $$
declare definition text;
begin
  select pg_get_functiondef('public.play_room_action(uuid,text,text,integer)'::regprocedure)
    into definition;
  if definition is not null then
    definition := replace(
      definition,
      'board->>2=mark and board->>5=mark and board->>6=mark',
      'board->>2=mark and board->>4=mark and board->>6=mark'
    );
    execute definition;
  end if;
end $$;

create or replace function public.rematch_room(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare room_row public.game_rooms;
begin
  select * into room_row from public.game_rooms where id=p_room for update;
  if room_row.id is null then raise exception 'Room not found'; end if;
  if room_row.host_id<>auth.uid() then raise exception 'Only host can rematch'; end if;

  delete from private.rps_choices where room_id=p_room;
  update public.game_players set is_ready=false, score=0 where room_id=p_room;
  -- The bot has no browser to press Ready after a rematch.
  update public.game_players set is_ready=true
    where room_id=p_room and player_id='11111111-1111-1111-1111-111111111111';
  update public.game_rooms
    set status='waiting', public_state='{}', match_number=match_number+1,
        state_version=state_version+1, updated_at=now()
    where id=p_room;
end $$;

create or replace function public.add_ai_bot_to_room(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare room_row public.game_rooms; bot_id uuid := '11111111-1111-1111-1111-111111111111'; bot_seat int;
begin
  select * into room_row from public.game_rooms where id=p_room for update;
  if room_row.id is null then raise exception 'Room not found'; end if;
  if room_row.status<>'waiting' then raise exception 'Game already started'; end if;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (bot_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bot@rally.game', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Rally Bot 🤖"}'::jsonb, now(), now())
    on conflict (id) do nothing;
  insert into public.profiles(id,display_name) values(bot_id,'Rally Bot 🤖')
    on conflict(id) do update set display_name=excluded.display_name;
  if exists(select 1 from public.game_players where room_id=p_room and player_id=bot_id) then
    update public.game_players set is_ready=true where room_id=p_room and player_id=bot_id;
    return;
  end if;
  if (select count(*) from public.game_players where room_id=p_room)>=room_row.max_players then raise exception 'Room is full'; end if;
  select s into bot_seat from generate_series(1,room_row.max_players) s
    where not exists(select 1 from public.game_players where room_id=p_room and game_players.seat=s)
    order by s limit 1;
  insert into public.game_players(room_id,player_id,seat,is_ready) values(p_room,bot_id,bot_seat,true);
end $$;

grant execute on function public.rematch_room(uuid), public.add_ai_bot_to_room(uuid) to authenticated;
