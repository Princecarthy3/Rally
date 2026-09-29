-- Allow the authenticated room host to install the generated clue without
-- requiring a service-role key in the game-generation route.
create or replace function public.install_emoji_decode_puzzle(
  p_room uuid,p_round integer,p_answer text,p_acceptable_answers text[],p_emojis text[],p_category text,p_difficulty text,p_explanation text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; state jsonb;
begin
  select * into r from public.game_rooms where id=p_room for update;
  if r.id is null or r.game_type<>'emoji_decode' or r.status<>'playing' then raise exception 'Game is not active'; end if;
  if auth.uid() is null or r.host_id<>auth.uid() then raise exception 'Only the room host can install a puzzle'; end if;
  state:=r.public_state;
  if coalesce((state->>'round')::integer,0)<>p_round or state->>'phase'<>'generating_puzzle' then return state; end if;
  insert into private.emoji_decode_answers(room_id,round_no,answer,acceptable_answers,explanation)
  values(p_room,p_round,p_answer,p_acceptable_answers,p_explanation)
  on conflict(room_id,round_no) do update set answer=excluded.answer,acceptable_answers=excluded.acceptable_answers,explanation=excluded.explanation;
  state:=jsonb_set(state,'{emojis}',to_jsonb(p_emojis),true);
  state:=jsonb_set(state,'{category}',to_jsonb(p_category),true);
  state:=jsonb_set(state,'{difficulty}',to_jsonb(p_difficulty),true);
  state:=jsonb_set(state,'{roundEndsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000)::bigint+30000),true);
  state:=jsonb_set(state,'{phase}','"playing"'::jsonb,true);
  state:=jsonb_set(state,'{solvedSeats}','[]'::jsonb,true);
  state:=jsonb_set(state,'{roundPoints}','{}'::jsonb,true);
  state:=jsonb_set(state,'{message}',to_jsonb('Decode the emojis!'),true);
  update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
  return state;
end $$;

revoke all on function public.install_emoji_decode_puzzle(uuid,integer,text,text[],text[],text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.install_emoji_decode_puzzle(uuid,integer,text,text[],text[],text,text,text) to authenticated;
