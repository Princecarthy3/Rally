const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'complete.sql');
let content = fs.readFileSync(sqlPath, 'utf8');

// 1. Fix RPS jsonb_object_agg and to_jsonb('locked')
content = content.replace(
  "to_jsonb('locked')",
  "to_jsonb('locked'::text)"
);

content = content.replace(
  "select jsonb_object_agg(p.seat::text,c.choice) from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=(state->>'round')::int",
  "select jsonb_object_agg(p.seat::text,c.choice::text) from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=(state->>'round')::int"
);

// 2. Fix Skribbl wordSelected and guessedSeats polymorphic types
content = content.replace(
  "state:=jsonb_set(state,array['wordSelected'],to_jsonb(p_value),true);",
  "state:=jsonb_set(state,array['wordSelected'],to_jsonb(p_value::text),true);"
);

content = content.replace(
  "state:=jsonb_set(state,array['guessedSeats'],(state->'guessedSeats')||to_jsonb(me.seat));",
  "state:=jsonb_set(state,array['guessedSeats'],coalesce(state->'guessedSeats','[]'::jsonb)||to_jsonb(me.seat::int));"
);

content = content.replace(
  "if (select count(*) from jsonb_array_elements(state->'guessedSeats'))>=n-1 then r.status:='completed'; end if;",
  "if (select count(*) from jsonb_array_elements(coalesce(state->'guessedSeats','[]'::jsonb)))>=n-1 then r.status:='completed'; end if;"
);

// 3. Fix to_jsonb in play_room_action messages and state values
content = content.replace(
  "to_jsonb('Drawer selected a word! Start drawing & guessing.')",
  "to_jsonb('Drawer selected a word! Start drawing & guessing.'::text)"
);

content = content.replace(
  "to_jsonb('Player '||me.seat||' guessed correctly! +100pts')",
  "to_jsonb(('Player '||me.seat||' guessed correctly! +100pts')::text)"
);

fs.writeFileSync(sqlPath, content, 'utf8');
console.log('Successfully fixed polymorphic types in complete.sql!');
