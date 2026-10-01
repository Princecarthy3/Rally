alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check
  check (game_type in (
    'basketball','dice_dash','trivia_clash','uno',
    'rps','number_guess','memory_match','mini_golf','battleship',
    'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo',
    'racing','rally_racing','rally_combat','combat','emoji_decode','chess','sudoku_battle','mancala'
  ));

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure)
    into definition;
  if definition is null then raise exception 'create_game_room is not installed'; end if;
  if position('mancala' in definition)=0 then
    if position('sudoku_battle' in definition)>0 then
      definition := replace(definition, '''sudoku_battle''', '''sudoku_battle'',''mancala''');
    elsif position('chess' in definition)>0 then
      definition := replace(definition, '''chess''', '''chess'',''mancala''');
    elsif position('emoji_decode' in definition)>0 then
      definition := replace(definition, '''emoji_decode''', '''emoji_decode'',''mancala''');
    else
      raise exception 'Could not extend create_game_room for Mancala';
    end if;
    execute definition;
  end if;
end
$$;

create or replace function public.force_mancala_room_size()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.game_type='mancala' then new.max_players:=2; end if;
  return new;
end
$$;

revoke all on function public.force_mancala_room_size() from public,anon,authenticated;
drop trigger if exists force_mancala_room_size on public.game_rooms;
create trigger force_mancala_room_size
before insert or update of game_type,max_players on public.game_rooms
for each row execute function public.force_mancala_room_size();

create or replace function private.mancala_initial_state(p_now timestamptz)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object(
    'pits', jsonb_build_object('1', jsonb_build_array(4,4,4,4,4,4), '2', jsonb_build_array(4,4,4,4,4,4)),
    'stores', jsonb_build_object('1', 0, '2', 0),
    'turn', 1,
    'status', 'playing',
    'winnerSeat', null,
    'scores', jsonb_build_object('1', 0, '2', 0),
    'moveNumber', 0,
    'lastMove', null,
    'turnDeadline', (p_now + interval '30 seconds')::text,
    'rematchRequests', '[]'::jsonb,
    'message', 'Player 1 goes first.'
  )
$$;

create or replace function public.start_mancala_game(p_room uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  n int;
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
  if exists(
    select 1 from public.game_players
     where room_id=p_room and player_id::text like '11111111-1111-1111-1111-%'
  ) then
    raise exception 'Mancala requires two human players';
  end if;

  state := private.mancala_initial_state(now());
  update public.game_rooms
     set status='playing', public_state=state, state_version=state_version+1, updated_at=now()
   where id=p_room;
end
$$;

create or replace function public.play_mancala_action(
  p_room uuid,
  p_pit integer,
  p_expected_version bigint
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  pits jsonb;
  stores jsonb;
  stones int;
  cursor_seat int;
  cursor_pit int;
  opposite_seat int;
  opposite_pit int;
  opposite_stones int;
  captured int := 0;
  side_empty boolean;
  player_seat int;
  seat_to_sweep int;
  remaining int;
  next_seat int;
  path jsonb := '[]'::jsonb;
  last_destination jsonb;
  last_type text;
  last_seat int;
  last_pit int;
  extra_turn boolean := false;
  result_status text := 'playing';
  version_after bigint;
  winner int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'mancala' then raise exception 'Mancala game not found'; end if;
  if r.status<>'playing' then raise exception 'Game is not active'; end if;
  if p_expected_version is null or p_expected_version<>r.state_version then
    raise exception 'Game state changed. Refresh and try again.';
  end if;

  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  if me.id is null then raise exception 'You are not a player in this room'; end if;
  if me.seat not in (1,2) then raise exception 'Invalid Mancala seat'; end if;
  if coalesce((r.public_state->>'turnDeadline')::timestamptz, now())<=now() then
    raise exception 'Turn expired. The next turn is loading.';
  end if;
  if coalesce((r.public_state->>'turn')::int,0)<>me.seat then raise exception 'Wait for your turn'; end if;
  if p_pit is null or p_pit<0 or p_pit>5 then raise exception 'Invalid pit'; end if;

  state := r.public_state;
  pits := state->'pits';
  stores := state->'stores';
  stones := coalesce((pits->(me.seat::text)->>p_pit::text)::int,0);
  if stones<=0 then raise exception 'That pit is empty'; end if;
  pits := jsonb_set(pits,array[me.seat::text,p_pit::text],'0'::jsonb,true);

  player_seat := me.seat;
  opposite_seat := case when player_seat=1 then 2 else 1 end;
  cursor_seat := player_seat;
  cursor_pit := p_pit;

  while stones>0 loop
    if cursor_seat=player_seat then
      if cursor_pit<5 then
        cursor_pit := cursor_pit+1;
        pits := jsonb_set(
          pits,array[cursor_seat::text,cursor_pit::text],
          to_jsonb((pits->(cursor_seat::text)->>cursor_pit::text)::int+1),true
        );
        last_destination := jsonb_build_object('type','pit','seat',cursor_seat,'index',cursor_pit);
      else
        stores := jsonb_set(
          stores,array[player_seat::text],
          to_jsonb((stores->>player_seat::text)::int+1),true
        );
        last_destination := jsonb_build_object('type','store','seat',player_seat);
        cursor_seat := opposite_seat;
        cursor_pit := 6;
      end if;
    elsif cursor_pit=6 then
      cursor_pit := 5;
      pits := jsonb_set(
        pits,array[cursor_seat::text,cursor_pit::text],
        to_jsonb((pits->(cursor_seat::text)->>cursor_pit::text)::int+1),true
      );
      last_destination := jsonb_build_object('type','pit','seat',cursor_seat,'index',cursor_pit);
    elsif cursor_pit>0 then
      cursor_pit := cursor_pit-1;
      pits := jsonb_set(
        pits,array[cursor_seat::text,cursor_pit::text],
        to_jsonb((pits->(cursor_seat::text)->>cursor_pit::text)::int+1),true
      );
      last_destination := jsonb_build_object('type','pit','seat',cursor_seat,'index',cursor_pit);
    else
      cursor_seat := player_seat;
      cursor_pit := 0;
      pits := jsonb_set(
        pits,array[cursor_seat::text,cursor_pit::text],
        to_jsonb((pits->(cursor_seat::text)->>cursor_pit::text)::int+1),true
      );
      last_destination := jsonb_build_object('type','pit','seat',cursor_seat,'index',cursor_pit);
    end if;
    path := path || jsonb_build_array(last_destination);
    stones := stones-1;
  end loop;

  last_type := last_destination->>'type';
  last_seat := (last_destination->>'seat')::int;
  if last_type='store' then
    extra_turn := last_seat=player_seat;
  elsif last_seat=player_seat then
    last_pit := (last_destination->>'index')::int;
    opposite_pit := 5-last_pit;
    opposite_stones := coalesce((pits->(opposite_seat::text)->>opposite_pit::text)::int,0);
    if (pits->(player_seat::text)->>last_pit::text)::int=1 and opposite_stones>0 then
      captured := opposite_stones+1;
      stores := jsonb_set(
        stores,array[player_seat::text],
        to_jsonb((stores->>player_seat::text)::int+captured),true
      );
      pits := jsonb_set(pits,array[player_seat::text,last_pit::text],'0'::jsonb,true);
      pits := jsonb_set(pits,array[opposite_seat::text,opposite_pit::text],'0'::jsonb,true);
    end if;
  end if;

  for seat_to_sweep in 1..2 loop
    select coalesce(bool_and(value::int=0),true) into side_empty
      from jsonb_array_elements_text(pits->seat_to_sweep::text) as pit(value);
    if side_empty then exit; end if;
  end loop;

  if side_empty then
    for seat_to_sweep in 1..2 loop
      select coalesce(sum(value::int),0) into remaining
        from jsonb_array_elements_text(pits->seat_to_sweep::text) as pit(value);
      stores := jsonb_set(
        stores,array[seat_to_sweep::text],
        to_jsonb((stores->>seat_to_sweep::text)::int+remaining),true
      );
      pits := jsonb_set(pits,array[seat_to_sweep::text],'[0,0,0,0,0,0]'::jsonb,true);
    end loop;
    result_status := 'completed';
  end if;

  if result_status='completed' then
    if (stores->>'1')::int=(stores->>'2')::int then
      winner := null;
    else
      winner := case when (stores->>'1')::int>(stores->>'2')::int then 1 else 2 end;
    end if;
    state := jsonb_set(state,'{winnerSeat}',coalesce(to_jsonb(winner),'null'::jsonb),true);
    state := jsonb_set(state,'{status}','"completed"'::jsonb,true);
    state := jsonb_set(state,'{scores}',stores,true);
    state := jsonb_set(state,'{turnDeadline}',to_jsonb(now()::text),true);
    state := jsonb_set(
      state,'{message}',
      to_jsonb(case when winner is null then 'It''s a draw!' else 'Player '||winner||' wins!' end),true
    );
  else
    next_seat := case when extra_turn then player_seat else opposite_seat end;
    state := jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
    state := jsonb_set(state,'{winnerSeat}','null'::jsonb,true);
    state := jsonb_set(state,'{scores}',stores,true);
    state := jsonb_set(state,'{turnDeadline}',to_jsonb((now()+interval '30 seconds')::text),true);
    state := jsonb_set(state,'{rematchRequests}','[]'::jsonb,true);
    state := jsonb_set(
      state,'{message}',
      to_jsonb(case when captured>0 then 'Captured '||captured||' stones!'
                    when extra_turn then 'Extra turn!'
                    else 'Turn switched.' end),true
    );
  end if;

  state := jsonb_set(state,'{pits}',pits,true);
  state := jsonb_set(state,'{stores}',stores,true);
  state := jsonb_set(
    state,'{moveNumber}',to_jsonb(coalesce((state->>'moveNumber')::int,0)+1),true
  );
  state := jsonb_set(
    state,'{lastMove}',
    jsonb_build_object(
      'seat',player_seat,'pit',p_pit,'path',path,'captured',captured,
      'extraTurn',extra_turn,'at',now()::text
    ),true
  );

  update public.game_rooms
     set public_state=state,status=result_status,state_version=state_version+1,updated_at=now()
   where id=p_room returning state_version into version_after;
  if result_status='completed' then perform public.finalize_room(p_room,state,'mancala'); end if;

  return jsonb_build_object(
    'public_state',state,'status',result_status,'state_version',version_after
  );
end
$$;

create or replace function public.expire_mancala_turn(p_room uuid,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  state jsonb;
  next_seat int;
  version_after bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'mancala' then raise exception 'Mancala game not found'; end if;
  if r.status<>'playing' then raise exception 'Game is not active'; end if;
  if p_expected_version is null or p_expected_version<>r.state_version then
    raise exception 'Game state changed. Refresh and try again.';
  end if;
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  if me.id is null then raise exception 'You are not a player in this room'; end if;
  if coalesce((r.public_state->>'turnDeadline')::timestamptz,now())>now() then
    raise exception 'Turn timer has not expired';
  end if;

  state := r.public_state;
  next_seat := case when (state->>'turn')::int=1 then 2 else 1 end;
  state := jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
  state := jsonb_set(state,'{turnDeadline}',to_jsonb((now()+interval '30 seconds')::text),true);
  state := jsonb_set(
    state,'{message}',
    to_jsonb('Player '||(case when next_seat=1 then 2 else 1 end)||' ran out of time. Player '||next_seat||'''s turn.'),true
  );

  update public.game_rooms
     set public_state=state,state_version=state_version+1,updated_at=now()
   where id=p_room returning state_version into version_after;
  return jsonb_build_object('public_state',state,'status','playing','state_version',version_after);
end
$$;

create or replace function public.request_mancala_rematch(p_room uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  r public.game_rooms;
  me public.game_players;
  requests jsonb;
  state jsonb;
  version_after bigint;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'mancala' then raise exception 'Mancala game not found'; end if;
  if r.status<>'completed' then raise exception 'Game is not complete'; end if;
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
  if me.id is null then raise exception 'You are not a player in this room'; end if;

  state := r.public_state;
  requests := coalesce(state->'rematchRequests','[]'::jsonb);
  if not (requests @> jsonb_build_array(me.seat)) then
    requests := requests || jsonb_build_array(me.seat);
  end if;
  if requests @> '[1,2]'::jsonb then
    update public.game_players set is_ready=true,score=0 where room_id=p_room;
    state := private.mancala_initial_state(now());
    update public.game_rooms
       set status='playing',public_state=state,match_number=match_number+1,
           state_version=state_version+1,updated_at=now()
     where id=p_room returning state_version into version_after;
    return jsonb_build_object('public_state',state,'status','playing','state_version',version_after);
  end if;

  state := jsonb_set(state,'{rematchRequests}',requests,true);
  update public.game_rooms
     set public_state=state,state_version=state_version+1,updated_at=now()
   where id=p_room returning state_version into version_after;
  return jsonb_build_object('public_state',state,'status','completed','state_version',version_after);
end
$$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.start_game(uuid)'::regprocedure)
    into definition;
  definition := replace(
    definition,
    'select * into r from public.game_rooms where id = p_room for update;',
    'select * into r from public.game_rooms where id = p_room for update; if r.game_type = ''mancala'' then perform public.start_mancala_game(p_room); return; end if;'
  );
  if position('start_mancala_game(p_room)' in definition)=0 then
    raise exception 'Could not route generic start_game through the Mancala validator';
  end if;
  execute definition;

  select pg_get_functiondef('public.play_room_action(uuid,text,text,integer)'::regprocedure)
    into definition;
  definition := replace(
    definition,
    'if r.status<>''playing'' then raise exception ''Game is not active''; end if;',
    'if r.status<>''playing'' then raise exception ''Game is not active''; end if; if r.game_type=''mancala'' then raise exception ''Use the dedicated Mancala action''; end if;'
  );
  if position('Use the dedicated Mancala action' in definition)=0 then
    raise exception 'Could not prevent generic actions from bypassing Mancala validation';
  end if;
  execute definition;

  select pg_get_functiondef('public.rematch_room(uuid)'::regprocedure)
    into definition;
  definition := replace(
    definition,
    'if room_row.host_id<>auth.uid() then raise exception ''Only host can rematch''; end if;',
    'if room_row.game_type=''mancala'' then raise exception ''Use the Mancala rematch request''; end if; if room_row.host_id<>auth.uid() then raise exception ''Only host can rematch''; end if;'
  );
  if position('Use the Mancala rematch request' in definition)=0 then
    raise exception 'Could not require mutual consent for a Mancala rematch';
  end if;
  execute definition;
end
$$;

revoke all on function private.mancala_initial_state(timestamptz) from public, anon, authenticated;
revoke all on function public.start_mancala_game(uuid) from public, anon;
revoke all on function public.play_mancala_action(uuid,integer,bigint) from public, anon;
revoke all on function public.expire_mancala_turn(uuid,bigint) from public, anon;
revoke all on function public.request_mancala_rematch(uuid) from public, anon;
grant execute on function public.start_mancala_game(uuid) to authenticated;
grant execute on function public.play_mancala_action(uuid,integer,bigint) to authenticated;
grant execute on function public.expire_mancala_turn(uuid,bigint) to authenticated;
grant execute on function public.request_mancala_rematch(uuid) to authenticated;
