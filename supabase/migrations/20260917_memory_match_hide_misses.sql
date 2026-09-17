-- Hide unmatched Memory Match cards again after their reveal window.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.play_memory_match_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(
      definition,
      $old$else
      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat;$old$,
      $new$else
      cards:=jsonb_set(cards,array[(flipped->>0)::text],'null'::jsonb,true);
      cards:=jsonb_set(cards,array[(flipped->>1)::text],'null'::jsonb,true);
      state:=jsonb_set(state,'{cards}',cards,true);
      select min(seat) into next_seat from public.game_players where room_id=p_room and seat>me.seat;$new$
    );
    execute definition;
  end if;
end $migration$;
