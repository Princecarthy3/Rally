-- Publish only each hunter's result (not the hidden target) for the shared grid panel.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.play_number_hunt_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, 'guesses jsonb; guessed_count int;', 'guesses jsonb; results jsonb; guessed_count int;');
    definition := replace(definition, 'state:=jsonb_set(state,''{guesses}'',''{}''::jsonb,true);' || chr(10) || '    state:=jsonb_set(state,''{message}'',to_jsonb(''The number is hidden. Every hunter gets one guess!''::text),true);', 'state:=jsonb_set(state,''{guesses}'',''{}''::jsonb,true);' || chr(10) || '    state:=jsonb_set(state,''{guessResults}'',''{}''::jsonb,true);' || chr(10) || '    state:=jsonb_set(state,''{message}'',to_jsonb(''The number is hidden. Every hunter gets one guess!''::text),true);');
    definition := replace(definition, 'state:=jsonb_set(state,''{guesses}'',guesses,true);' || chr(10) || '    if guess=target then', 'state:=jsonb_set(state,''{guesses}'',guesses,true);' || chr(10) || '    results:=case when jsonb_typeof(state->''guessResults'')=''object'' then state->''guessResults'' else ''{}''::jsonb end;' || chr(10) || '    results:=jsonb_set(results,array[me.seat::text],jsonb_build_object(''guess'',guess,''correct'',guess=target),true);' || chr(10) || '    state:=jsonb_set(state,''{guessResults}'',results,true);' || chr(10) || '    if guess=target then');
    definition := replace(definition, 'state:=jsonb_set(state,''{guesses}'',''{}''::jsonb,true);' || chr(10) || '        state:=jsonb_set(state,''{message}'',to_jsonb((''Round ''||(current_round+1)||'': Player ''||next_picker||'' hides a number.'')::text),true);', 'state:=jsonb_set(state,''{guesses}'',''{}''::jsonb,true);' || chr(10) || '        state:=jsonb_set(state,''{guessResults}'',''{}''::jsonb,true);' || chr(10) || '        state:=jsonb_set(state,''{message}'',to_jsonb((''Round ''||(current_round+1)||'': Player ''||next_picker||'' hides a number.'')::text),true);');
    execute definition;
  end if;
end $$;
