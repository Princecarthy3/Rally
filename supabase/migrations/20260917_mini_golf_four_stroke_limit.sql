-- Four strokes is the maximum for a hole. A player who has not holed out by
-- their fourth shot loses that hole, but remains in the game for later holes.
-- Each hole also gets a distinct obstacle, with later holes adding hazards.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.start_mini_golf(uuid)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(
      definition,
      $old$'cup',jsonb_build_object('x',86,'y',22),'start'$old$,
      $new$'cup',jsonb_build_object('x',86,'y',22),'obstacle','sand trap','start'$new$
    );
    definition := replace(
      definition,
      $old$'cup',jsonb_build_object('x',cup_x,'y',cup_y),'balls'$old$,
      $new$'cup',jsonb_build_object('x',cup_x,'y',cup_y),'obstacle',case when hole in (2,5,8) then 'water channel' when hole in (3,6,9) then 'moving wall' else 'sand trap' end,'balls'$new$
    );
    execute definition;
  end if;

  select pg_get_functiondef('public.play_mini_golf_action(uuid,text,text,integer)'::regprocedure) into definition;
  if definition is not null then
    definition := replace(definition, 'strokes>=8', 'strokes>=4');
    definition := replace(
      definition,
      $old$'finished',(sqrt(power(next_x-cup_x,2)+power(next_y-cup_y,2))<=6 or strokes>=4),'water'$old$,
      $new$'finished',(sqrt(power(next_x-cup_x,2)+power(next_y-cup_y,2))<=6 or strokes>=4),'lost',(strokes>=4 and sqrt(power(next_x-cup_x,2)+power(next_y-cup_y,2))>6),'water'$new$
    );
    definition := replace(
      definition,
      $old$water:=hole in (2,5,8) and next_x between 43 and 57 and next_y<68;$old$,
      $new$water:=(hole in (2,5,8) and next_x between 43 and 57 and next_y<68) or (hole in (3,6,9) and next_y between 42 and 48 and next_x>25) or (hole in (4,7) and next_x between 35 and 65 and next_y between 30 and 38);$new$
    );
    definition := replace(
      definition,
      $old$when water then ('Player '||me.seat||' found water — back to the tee!')$old$,
      $new$when strokes>=4 and sqrt(power(next_x-cup_x,2)+power(next_y-cup_y,2))>6 then ('Player '||me.seat||' used all 4 strokes and lost this hole.') when water then ('Player '||me.seat||' hit an obstacle — back to the tee!')$new$
    );
    execute definition;
  end if;
end $migration$;
