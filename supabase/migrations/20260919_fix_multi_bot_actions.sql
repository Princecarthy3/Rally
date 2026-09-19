-- Multi-bot rooms use the reserved 11111111 UUID prefix with a seat suffix.
-- Accept every reserved bot ID when validating server-side bot actions.
do $$
declare
  function_row record;
  definition text;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
      and pg_get_functiondef(p.oid) like '%player_id%11111111-1111-1111-1111-111111111111%'
  loop
    select pg_get_functiondef(function_row.signature) into definition;
    definition := regexp_replace(
      definition,
      'player_id[[:space:]]*=[[:space:]]*''11111111-1111-1111-1111-111111111111''',
      'player_id::text like ''11111111-1111-1111-1111-1111111111%''',
      'g'
    );
    execute definition;
  end loop;
end $$;
