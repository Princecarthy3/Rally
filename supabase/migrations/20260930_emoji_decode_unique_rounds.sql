-- Helper so the generate API can exclude answers already used in this room.
create or replace function public.get_emoji_decode_used_answers(p_room uuid)
returns text[]
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  r public.game_rooms;
  answers text[];
begin
  select * into r from public.game_rooms where id = p_room;
  if r.id is null or r.game_type <> 'emoji_decode' then
    return '{}'::text[];
  end if;
  -- Host or any player in the room may read the used-answer list for generation only.
  if auth.uid() is not null then
    if r.host_id is distinct from auth.uid()
       and not exists (
         select 1 from public.game_players gp
         where gp.room_id = p_room and gp.player_id = auth.uid()
       ) then
      return '{}'::text[];
    end if;
  end if;

  select coalesce(array_agg(a.answer), '{}'::text[])
    into answers
  from private.emoji_decode_answers a
  where a.room_id = p_room;

  return answers;
end;
$$;

grant execute on function public.get_emoji_decode_used_answers(uuid) to authenticated, service_role;
notify pgrst, 'reload schema';
