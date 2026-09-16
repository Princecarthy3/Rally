-- Convert the legacy Number Hunt guesses array to Grid Rush's seat-keyed object.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.play_number_hunt_action(uuid,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(
      definition,
      'guesses:=coalesce(state->''guesses'',''{}''::jsonb); if guesses ? me.seat::text then raise exception ''You already chose a tile this round''; end if;',
      'guesses:=case when jsonb_typeof(state->''guesses'')=''object'' then state->''guesses'' else ''{}''::jsonb end; if guesses ? me.seat::text then raise exception ''You already chose a tile this round''; end if;'
    );
    execute definition;
  end if;
end $$;
