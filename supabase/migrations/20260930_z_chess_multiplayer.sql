-- Multiplayer Chess. Run this migration in Supabase before deploying the app.
alter table public.game_rooms drop constraint if exists game_rooms_game_type_check;
alter table public.game_rooms add constraint game_rooms_game_type_check check (game_type in (
  'basketball','dice_dash','trivia_clash','uno','rps','number_guess','memory_match','mini_golf','battleship',
  'ping_pong','tic_tac_toe','connect_four','dots_boxes','skribbl','ludo','racing','rally_racing','rally_combat','combat','emoji_decode','chess'
));

-- Preserve the deployed room RPC and its existing game list while registering
-- Chess in the allow-list. Its max player count is always two.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_game_room(text,integer)'::regprocedure) into definition;
  if position('chess' in definition)=0 then
    if position('emoji_decode' in definition)>0 then
      definition:=replace(definition, '''emoji_decode''', '''emoji_decode'',''chess''');
    elsif position('ludo' in definition)>0 then
      definition:=replace(definition, '''ludo''', '''ludo'',''chess''');
    else
      raise exception 'Could not find a supported game allow-list in create_game_room';
    end if;
    if position('chess' in definition)=0 then raise exception 'Could not register Chess in create_game_room'; end if;
    execute definition;
  end if;
end $$;

create or replace function public.force_chess_room_size() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.game_type='chess' then new.max_players:=2; end if;
  return new;
end $$;
revoke all on function public.force_chess_room_size() from public,anon,authenticated;
drop trigger if exists force_chess_room_size on public.game_rooms;
create trigger force_chess_room_size before insert or update of game_type,max_players on public.game_rooms
for each row execute function public.force_chess_room_size();

create table if not exists public.chess_games (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  match_id uuid not null default gen_random_uuid(),
  white_player_id uuid not null references public.profiles(id),
  black_player_id uuid not null references public.profiles(id),
  fen text not null,
  moves jsonb not null default '[]'::jsonb,
  position_counts jsonb not null default '{}'::jsonb,
  status text not null check (status in ('active','checkmate','stalemate','draw','resigned')),
  winner_player_id uuid references public.profiles(id),
  result_reason text,
  draw_offered_by uuid references public.profiles(id),
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  check (white_player_id <> black_player_id)
);
alter table public.chess_games enable row level security;
revoke all on public.chess_games from public, anon, authenticated;
grant select, insert, update, delete on public.chess_games to service_role;

create or replace function public.start_chess_game(p_room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n integer; white_id uuid; black_id uuid; state jsonb; mid uuid;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'chess' or r.status<>'waiting' then raise exception 'This Chess room cannot start'; end if;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<>2 or exists(select 1 from public.game_players where room_id=p_room and (not is_ready or player_id::text like '11111111-1111-1111-1111-%')) then
    raise exception 'Chess needs two ready players';
  end if;
  if mod(r.match_number,2)=1 then
    select player_id into white_id from public.game_players where room_id=p_room and seat=1;
    select player_id into black_id from public.game_players where room_id=p_room and seat=2;
  else
    select player_id into black_id from public.game_players where room_id=p_room and seat=1;
    select player_id into white_id from public.game_players where room_id=p_room and seat=2;
  end if;
  mid:=gen_random_uuid();
  insert into public.chess_games(room_id,match_id,white_player_id,black_player_id,fen,moves,position_counts,status,winner_player_id,result_reason,draw_offered_by,revision,updated_at)
  values(p_room,mid,white_id,black_id,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1','[]'::jsonb,'{}'::jsonb,'active',null,null,null,0,now())
  on conflict(room_id) do update set match_id=excluded.match_id,white_player_id=excluded.white_player_id,black_player_id=excluded.black_player_id,fen=excluded.fen,moves=excluded.moves,position_counts=excluded.position_counts,status='active',winner_player_id=null,result_reason=null,draw_offered_by=null,revision=0,updated_at=now();
  state:=jsonb_build_object('chess',jsonb_build_object('matchId',mid,'fen','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1','moves','[]'::jsonb,'turn','w','whitePlayerId',white_id,'blackPlayerId',black_id,'status','active','winnerPlayerId',null,'resultReason',null,'drawOfferedBy',null,'revision',0,'inCheck',false,'lastMove',null,'message','White to move'));
  update public.game_rooms set status='playing',public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
  return state;
end $$;
revoke all on function public.start_chess_game(uuid) from public,anon;
grant execute on function public.start_chess_game(uuid) to authenticated;

-- Only the server route may commit a move/state transition. The route verifies
-- the user's session, room seat, turn and legal move with chess.js first.
create or replace function public.commit_chess_state(
  p_room uuid,p_match_id uuid,p_expected_revision bigint,p_actor uuid,
  p_fen text,p_moves jsonb,p_position_counts jsonb,p_status text,
  p_winner_player_id uuid,p_result_reason text,p_draw_offered_by uuid,p_public_state jsonb
) returns bigint language plpgsql security definer set search_path='' as $$
declare g public.chess_games; r public.game_rooms; next_revision bigint; next_room_status text; winner_seat integer; history_state jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server operation required'; end if;
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'chess' or r.status<>'playing' then raise exception 'This Chess room is no longer active'; end if;
  select * into g from public.chess_games where room_id=p_room for update;
  if g.room_id is null or g.match_id<>p_match_id then raise exception 'This Chess game has changed'; end if;
  if g.revision<>p_expected_revision then raise exception 'A newer move was already accepted'; end if;
  if not exists(select 1 from public.game_players where room_id=p_room and player_id=p_actor and player_id in (g.white_player_id,g.black_player_id)) then raise exception 'You are not a player in this Chess game'; end if;
  next_revision:=g.revision+1;
  update public.chess_games set fen=p_fen,moves=p_moves,position_counts=p_position_counts,status=p_status,winner_player_id=p_winner_player_id,result_reason=p_result_reason,draw_offered_by=p_draw_offered_by,revision=next_revision,updated_at=now() where room_id=p_room;
  next_room_status:=case when p_status='active' then 'playing' else 'completed' end;
  update public.game_rooms set status=next_room_status,public_state=p_public_state,state_version=state_version+1,updated_at=now() where id=p_room and game_type='chess';
  if p_status<>'active' then
    select seat into winner_seat from public.game_players where room_id=p_room and player_id=p_winner_player_id;
    history_state:=p_public_state || jsonb_build_object(
      'winnerSeat',winner_seat,
      'scores',(select jsonb_object_agg(seat::text,case when player_id=p_winner_player_id then 1 else 0 end) from public.game_players where room_id=p_room)
    );
    perform public.finalize_room(p_room,history_state,'chess');
  end if;
  return next_revision;
end $$;
revoke all on function public.commit_chess_state(uuid,uuid,bigint,uuid,text,jsonb,jsonb,text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.commit_chess_state(uuid,uuid,bigint,uuid,text,jsonb,jsonb,text,uuid,text,uuid,jsonb) to service_role;

notify pgrst, 'reload schema';
