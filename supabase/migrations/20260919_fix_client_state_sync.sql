-- Ensure Realtime publishes game_rooms/game_players so clients receive move updates.
do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.game_players;
exception when duplicate_object then null;
end $$;

-- Re-grant action RPCs (authenticated + anon for bot route).
do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.play_room_action(uuid,text,text,integer)',
    'public.play_ludo_action(uuid,text,text,integer)',
    'public.play_rps_action(uuid,text,text,integer)',
    'public.play_number_hunt_action(uuid,text,text,integer)',
    'public.play_skribbl_action(uuid,text,text,integer)',
    'public.play_mini_golf_action(uuid,text,text,integer)',
    'public.play_battleship_action(uuid,text,text,integer)',
    'public.play_memory_match_action(uuid,text,text,integer)'
  ]
  loop
    if to_regprocedure(signature) is not null then
      execute format('grant execute on function %s to authenticated, anon', signature);
    end if;
  end loop;
end
$$;

drop policy if exists "authenticated read rooms" on public.game_rooms;
create policy "authenticated read rooms"
  on public.game_rooms for select to authenticated using (true);

drop policy if exists "authenticated read players" on public.game_players;
create policy "authenticated read players"
  on public.game_players for select to authenticated using (true);

grant select on public.game_rooms to authenticated;
grant select on public.game_players to authenticated;
