-- Upgrade existing Trivia Clash installations to generate every question at runtime.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.play_trivia_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(
      definition,
      $question$question := case current_round
      when 1 then jsonb_build_object('question','Which planet is known as the Red Planet?','options',jsonb_build_array('Earth','Mars','Jupiter','Venus'),'answer',1)
      when 2 then jsonb_build_object('question','How many sides does a hexagon have?','options',jsonb_build_array('Five','Six','Seven','Eight'),'answer',1)
      when 3 then jsonb_build_object('question','What is the largest ocean on Earth?','options',jsonb_build_array('Atlantic Ocean','Indian Ocean','Pacific Ocean','Arctic Ocean'),'answer',2)
      when 4 then jsonb_build_object('question','Which animal is known as the fastest land animal?','options',jsonb_build_array('Lion','Cheetah','Horse','Kangaroo'),'answer',1)
      else jsonb_build_object('question','What gas do plants absorb from the atmosphere?','options',jsonb_build_array('Oxygen','Nitrogen','Carbon dioxide','Hydrogen'),'answer',2)
    end;$question$,
      $question$if p_value is null then raise exception 'AI question payload is required'; end if;
    question := p_value::jsonb;
    if jsonb_typeof(question->'question') <> 'string'
      or jsonb_typeof(question->'options') <> 'array'
      or jsonb_array_length(question->'options') <> 4
      or jsonb_typeof(question->'answer') <> 'number'
      or (question->>'answer')::int not between 0 and 3 then
      raise exception 'Invalid AI question payload';
    end if;$question$
    );
    execute definition;
  end if;
end $migration$;
