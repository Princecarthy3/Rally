-- Give every Mini Golf hole its own condition and reduce the cup tolerance as
-- the round advances. The server remains the source of truth for a made putt.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.start_mini_golf(uuid)'::regprocedure) into definition;
  if definition is null then raise exception 'Mini Golf start function is missing'; end if;
  definition := replace(
    definition,
    '''scores'',''{}''::jsonb,''message'',''Player 1 tees off!''',
    '''scores'',''{}''::jsonb,''difficulty'',1,''obstacle'',''Open fairway'',''message'',''Player 1 tees off!'''
  );
  execute definition;

  select pg_get_functiondef('public.play_mini_golf_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is null then raise exception 'Mini Golf action function is missing'; end if;
  definition := replace(definition, 'water boolean:=false; par int;', 'water boolean:=false; par int; difficulty int;');
  definition := replace(
    definition,
    'hole:=coalesce((state->>''hole'')::int,1); x:=',
    'hole:=coalesce((state->>''hole'')::int,1); difficulty:=least(5,greatest(1,ceil(hole::numeric/2)::int)); x:='
  );
  definition := replace(definition, '))<=6 or strokes>=8)', '))<=greatest(2,7-difficulty) or strokes>=8)');
  definition := replace(definition, 'strokes>=8', 'strokes>=4');
  definition := replace(
    definition,
    'state:=jsonb_set(state,''{hole}'',to_jsonb(hole),true); state:=jsonb_set(state,''{par}'',to_jsonb(par),true);',
    'state:=jsonb_set(state,''{hole}'',to_jsonb(hole),true); state:=jsonb_set(state,''{par}'',to_jsonb(par),true); state:=jsonb_set(state,''{difficulty}'',to_jsonb(least(5,greatest(1,ceil(hole::numeric/2)::int))),true); state:=jsonb_set(state,''{obstacle}'',to_jsonb(case hole when 2 then ''Water channel'' when 3 then ''Deep sand trap'' when 4 then ''Narrow wall lane'' when 5 then ''Wide water crossing'' when 6 then ''Bunker and wall'' when 7 then ''Long guarded green'' when 8 then ''Island fairway'' else ''Championship final'' end),true);'
  );
  execute definition;
end $$;
