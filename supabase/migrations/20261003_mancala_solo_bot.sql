-- Allow the existing two seat Mancala room to launch with Rally's solo bot.
create or replace function public.start_mancala_game(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  n int;
  bot_count int;
  human_count int;
  state jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'mancala' then raise exception 'Mancala room not found'; end if;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  if r.status<>'waiting' then raise exception 'Game already started'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<>2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then
    raise exception 'Both players must be ready';
  end if;
  select count(*) filter (where player_id::text like '11111111-1111-1111-1111-%'),
         count(*) filter (where player_id::text not like '11111111-1111-1111-1111-%')
    into bot_count,human_count
    from public.game_players where room_id=p_room;
  if bot_count>1 or human_count=0 then raise exception 'Mancala needs two players or one player and a bot'; end if;

  state := private.mancala_initial_state(now());
  update public.game_rooms
     set status='playing', public_state=state, state_version=state_version+1, updated_at=now()
   where id=p_room;
end
$$;

-- Let the authenticated human request a bot move while retaining the same
-- turn, deadline, legal pit, sowing and capture checks as a normal move.
create or replace function public.play_mancala_bot_action(
  p_room uuid,
  p_pit integer,
  p_expected_version bigint,
  p_bot_seat integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor public.game_players;
  bot public.game_players;
  previous_subject text;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into actor from public.game_players where room_id=p_room and player_id=auth.uid();
  if actor.id is null then raise exception 'You are not a player in this room'; end if;
  select * into bot from public.game_players
   where room_id=p_room and seat=p_bot_seat
     and player_id::text like '11111111-1111-1111-1111-%';
  if bot.id is null or actor.seat not in (1,2) or actor.seat=p_bot_seat then
    raise exception 'Invalid Mancala bot turn';
  end if;

  previous_subject := current_setting('request.jwt.claim.sub',true);
  perform set_config('request.jwt.claim.sub',bot.player_id::text,true);
  begin
    result := public.play_mancala_action(p_room,p_pit,p_expected_version);
  exception when others then
    perform set_config('request.jwt.claim.sub',coalesce(previous_subject,''),true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub',coalesce(previous_subject,''),true);
  return result;
end
$$;

revoke all on function public.play_mancala_bot_action(uuid,integer,bigint,integer) from public,anon;
grant execute on function public.play_mancala_bot_action(uuid,integer,bigint,integer) to authenticated;
