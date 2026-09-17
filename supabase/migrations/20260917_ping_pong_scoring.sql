-- The host simulates the live court; scores are persisted and finalized here.
create or replace function public.play_ping_pong_point(p_room uuid, p_scorer integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; state jsonb; score integer;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'ping_pong' or r.status<>'playing' then raise exception 'Mini Tennis is not active'; end if;
  if r.host_id<>auth.uid() then raise exception 'Only the court host can record a point'; end if;
  if p_scorer not in (1,2) or not exists(select 1 from public.game_players where room_id=p_room and seat=p_scorer) then raise exception 'Invalid scorer'; end if;
  state:=coalesce(r.public_state,'{}'::jsonb); score:=coalesce((state->'scores'->>p_scorer::text)::integer,0)+1;
  state:=jsonb_set(state,array['scores',p_scorer::text],to_jsonb(score),true);
  if score>=5 then
    state:=jsonb_set(state,'{winnerSeat}',to_jsonb(p_scorer),true);
    state:=jsonb_set(state,'{message}',to_jsonb(('Player '||p_scorer||' wins Mini Tennis!')::text),true);
    update public.game_rooms set public_state=state,status='completed',state_version=state_version+1,updated_at=now() where id=p_room;
    perform public.finalize_room(p_room,state,'ping_pong');
  else
    state:=jsonb_set(state,'{message}',to_jsonb(('Point to Player '||p_scorer||'!')::text),true);
    update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
  end if;
  return state;
end $$;
grant execute on function public.play_ping_pong_point(uuid,integer) to authenticated;
