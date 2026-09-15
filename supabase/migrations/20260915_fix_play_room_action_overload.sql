-- Remove the legacy three-argument RPC so Supabase can resolve the current
-- four-argument play_room_action call unambiguously.
do $$
begin
  if to_regprocedure('public.play_room_action(uuid,text,text,integer)') is not null
     and to_regprocedure('public.play_room_action(uuid,text,text)') is not null then
    drop function public.play_room_action(uuid,text,text);
  end if;
end $$;
