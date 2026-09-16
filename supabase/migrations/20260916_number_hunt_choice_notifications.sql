-- Announce each hunter's selected number to every player without exposing the target.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.play_number_hunt_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(
      definition,
      'to_jsonb((''Player ''||me.seat||'' found it! +100 points.'')::text)',
      'to_jsonb((''Player ''||me.seat||'' chose ''||guess||'' and found it! +100 points.'')::text)'
    );
    definition := replace(
      definition,
      'to_jsonb((''Player ''||me.seat||'' locked a guess.'')::text)',
      'to_jsonb((''Player ''||me.seat||'' chose ''||guess||''.'')::text)'
    );
    execute definition;
  end if;
end $$;
