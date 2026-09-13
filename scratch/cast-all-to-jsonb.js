const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'complete.sql');
let content = fs.readFileSync(sqlPath, 'utf8');

// Explicit type casts for to_jsonb
content = content.replace("to_jsonb(p_value),true);", "to_jsonb(p_value::text),true);");
content = content.replace("to_jsonb(q_idx),true);", "to_jsonb(q_idx::int),true);");
content = content.replace("to_jsonb('Question '||(q_idx+1)||' of 5: Decode the emoji clue'),true);", "to_jsonb(('Question '||(q_idx+1)||' of 5: Decode the emoji clue')::text),true);");
content = content.replace("to_jsonb(me.seat),true);", "to_jsonb(me.seat::int),true);");
content = content.replace("to_jsonb('Player '||me.seat||' completed '||new_boxes||' box(es)! Extra turn.'),true);", "to_jsonb(('Player '||me.seat||' completed '||new_boxes||' box(es)! Extra turn.')::text),true);");
content = content.replace("to_jsonb(next_seat),true);", "to_jsonb(next_seat::int),true);");
content = content.replace("to_jsonb('Player '||next_seat||'’s turn'),true);", "to_jsonb(('Player '||next_seat||'’s turn')::text),true);");

fs.writeFileSync(sqlPath, content, 'utf8');
console.log('Successfully updated all to_jsonb casts in complete.sql!');
