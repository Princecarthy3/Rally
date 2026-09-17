-- Battleship now uses an unlabeled 8x8 grid. A successful hit keeps the turn.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.play_battleship_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is null then raise exception 'Battleship action function is missing'; end if;

  definition := replace(definition, 'then 11-size else 10 end', 'then 9-size else 8 end');
  definition := replace(definition, 'between 0 and 9', 'between 0 and 7');
  definition := replace(definition, 'row_no*10+col_no', 'row_no*8+col_no');
  definition := replace(definition, '(row_no+i)*10+col_no', '(row_no+i)*8+col_no');
  definition := replace(
    definition,
    'row_no:=split_part(p_value,'','',1)::int;col_no:=split_part(p_value,'','',2)::int;cell:=row_no*8+col_no;',
    'row_no:=split_part(p_value,'','',1)::int;col_no:=split_part(p_value,'','',2)::int;if row_no not between 0 and 7 or col_no not between 0 and 7 then raise exception ''Choose a coordinate on the board'';end if;cell:=row_no*8+col_no;'
  );
  definition := replace(
    definition,
    'else state:=jsonb_set(state,''{turn}'',to_jsonb(target.seat),true);state:=jsonb_set(state,''{message}'',to_jsonb(case when sunk is not null then (''Player ''||me.seat||'' sank the ''||initcap(sunk)||''!'') when hit then (''Hit! Player ''||target.seat||'' to fire.'') else (''Miss. Player ''||target.seat||'' to fire.'') end),true);end if;',
    'else if hit then state:=jsonb_set(state,''{message}'',to_jsonb(case when sunk is not null then (''Player ''||me.seat||'' sank the ''||initcap(sunk)||''! Fire again.'') else ''Hit! Fire again.'' end),true); else state:=jsonb_set(state,''{turn}'',to_jsonb(target.seat),true);state:=jsonb_set(state,''{message}'',to_jsonb((''Miss. Player ''||target.seat||'' to fire.'')::text),true); end if;end if;'
  );
  execute definition;
end $$;
