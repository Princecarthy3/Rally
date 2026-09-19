-- Migration for add_bot_to_room RPC & Multi-Bot Support in Party Games

create or replace function public.add_bot_to_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare
  v_room public.game_rooms;
  v_count int;
  v_next_seat int;
  v_bot_id uuid;
  v_bot_name text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;

  select * into v_room from public.game_rooms where id=p_room for update;
  if v_room.id is null then raise exception 'Room not found'; end if;
  if v_room.host_id <> auth.uid() then raise exception 'Only the host can add bots'; end if;
  if v_room.status <> 'waiting' then raise exception 'Cannot add bots to an active game'; end if;

  select count(*) into v_count from public.game_players where room_id=p_room;
  if v_count >= v_room.max_players then raise exception 'Room is already full'; end if;

  -- Find lowest open seat number between 1 and v_room.max_players
  select min(s.seat) into v_next_seat
  from generate_series(1, v_room.max_players) as s(seat)
  where not exists (select 1 from public.game_players gp where gp.room_id=p_room and gp.seat=s.seat);

  if v_next_seat is null then raise exception 'No open seat available'; end if;

  -- Construct unique bot ID for seat
  v_bot_id := ('11111111-1111-1111-1111-11111111111' || v_next_seat::text)::uuid;
  v_bot_name := 'Rally AI ' || case v_next_seat when 2 then 'Alpha' when 3 then 'Beta' when 4 then 'Gamma' else 'Bot' end;

  -- Ensure bot profile exists
  insert into public.profiles(id, display_name)
  values (v_bot_id, v_bot_name)
  on conflict (id) do update set display_name = excluded.display_name;

  -- Add bot to room as ready player
  insert into public.game_players(room_id, player_id, seat, is_ready)
  values (p_room, v_bot_id, v_next_seat, true)
  on conflict (room_id, player_id) do update set seat = v_next_seat, is_ready = true;

  update public.game_rooms set updated_at = now() where id = p_room;
end $$;

grant execute on function public.add_bot_to_room(uuid) to authenticated;
