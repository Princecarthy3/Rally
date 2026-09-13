const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'complete.sql');
let lines = fs.readFileSync(sqlPath, 'utf8').split(/\r?\n/);

// Find index of elsif r.game_type='dots_boxes'
const startIndex = lines.findIndex(l => l.includes("elsif r.game_type='dots_boxes'"));
const endIndex = lines.findIndex((l, idx) => idx > startIndex && l.includes("elsif r.game_type='skribbl'"));

console.log('startIndex:', startIndex, 'endIndex:', endIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const newDotsLines = [
    " elsif r.game_type='dots_boxes' then",
    "  if (state->>'turn')::int<>me.seat or p_action<>'line' then raise exception 'Wait for your turn'; end if;",
    "  if (state->'hLines' ? p_value) or (state->'vLines' ? p_value) then raise exception 'Line already drawn'; end if;",
    "  if left(p_value,2)='h_' then",
    "    state:=jsonb_set(state,array['hLines',substr(p_value,3)],to_jsonb(me.seat),true);",
    "  else",
    "    state:=jsonb_set(state,array['vLines',substr(p_value,3)],to_jsonb(me.seat),true);",
    "  end if;",
    "  new_boxes:=0;",
    "  for r_idx in 0..2 loop",
    "    for c_idx in 0..2 loop",
    "      key_b:='b_'||r_idx||'_'||c_idx;",
    "      if not (state->'boxes' ? key_b) then",
    "        if (state->'hLines' ? (r_idx||'_'||c_idx)) and",
    "           (state->'hLines' ? ((r_idx+1)||\"_\"||c_idx)) and",
    "           (state->'vLines' ? (r_idx||'_'||c_idx)) and",
    "           (state->'vLines' ? (r_idx||'_'||(c_idx+1))) then",
    "          state:=jsonb_set(state,array['boxes',key_b],to_jsonb(me.seat),true);",
    "          new_boxes:=new_boxes+1;",
    "          score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;",
    "          state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);",
    "        end if;",
    "      end if;",
    "    end loop;",
    "  end loop;",
    "  if new_boxes > 0 then",
    "    state:=jsonb_set(state,array['message'],to_jsonb('Player '||me.seat||' completed '||new_boxes||' box(es)! Extra turn.'),true);",
    "  else",
    "    select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;",
    "    state:=jsonb_set(state,array['turn'],to_jsonb(next_seat),true);",
    "    state:=jsonb_set(state,array['message'],to_jsonb('Player '||next_seat||'’s turn'),true);",
    "  end if;",
    "  if (select count(*) from jsonb_object_keys(state->'boxes')) >= 9 then",
    "    r.status:='completed';",
    "  end if;"
  ];

  lines.splice(startIndex, endIndex - startIndex, ...newDotsLines);
  fs.writeFileSync(sqlPath, lines.join('\n'), 'utf8');
  console.log('Successfully updated dots_boxes logic in complete.sql!');
}
