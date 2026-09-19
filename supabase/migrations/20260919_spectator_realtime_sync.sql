-- Ensure spectators can read live room state and Realtime publishes updates.

create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players
    where room_id = p_room and player_id = auth.uid()
  )
  or exists (
    select 1 from public.game_spectators
    where room_id = p_room and spectator_id = auth.uid()
  );
$$;

drop policy if exists "authenticated read rooms" on public.game_rooms;
create policy "authenticated read rooms"
  on public.game_rooms for select to authenticated using (true);

drop policy if exists "authenticated read players" on public.game_players;
create policy "authenticated read players"
  on public.game_players for select to authenticated using (true);

grant select on public.game_rooms to authenticated;
grant select on public.game_players to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.game_players;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.game_spectators;
exception when duplicate_object then null;
end $$;
