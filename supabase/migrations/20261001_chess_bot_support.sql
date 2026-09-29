-- Allow a ready Rally bot to fill one Chess seat for solo play.
create or replace function public.start_chess_game(p_room uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n integer; white_id uuid; black_id uuid; state jsonb; mid uuid;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'chess' or r.status<>'waiting' then raise exception 'This Chess room cannot start'; end if;
  if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if;
  select count(*) into n from public.game_players where room_id=p_room;
  if n<>2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then
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
