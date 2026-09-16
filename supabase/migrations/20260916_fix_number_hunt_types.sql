-- Fix unknown string literals in the secret picker RPC and update new-room copy.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.play_number_hunt_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, 'to_jsonb(''The number is hidden. Every hunter gets one guess!'')::text', 'to_jsonb(''The number is hidden. Every hunter gets one guess!''::text)');
    definition := replace(definition, 'to_jsonb(''Number Hunt complete!'')::text', 'to_jsonb(''Number Hunt complete!''::text)');
    execute definition;
  end if;
  select pg_get_functiondef('public.start_game(uuid)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(
      definition,
      'jsonb_build_object(''pickerSeat'',1,''guesserSeat'',2,''targetPicked'',false,''targetNumber'',null,''lastGuess'',null,''attemptsLeft'',3,''guesses'',''[]''::jsonb,''round'',1,''scores'',''{}''::jsonb,''message'',''Player 1 (Picker): Set a secret number from 1 to 100!'')',
      'jsonb_build_object(''pickerSeat'',1,''targetPicked'',false,''guesses'',''{}''::jsonb,''round'',1,''scores'',''{}''::jsonb,''message'',''Player 1 (Picker): Hide a secret number from 1 to 25!'')'
    );
    execute definition;
  end if;
end $$;
