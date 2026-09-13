const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'complete.sql');
let content = fs.readFileSync(sqlPath, 'utf8');

// Update start_game function
content = content.replace(
  "when 'emoji_decode' then jsonb_build_object('question',0,'answers','{}'::jsonb,'scores','{}'::jsonb,'message','Decode the emoji clue')",
  "when 'emoji_decode' then jsonb_build_object('qIndex',0,'totalQ',5,'answers','{}'::jsonb,'scores','{}'::jsonb,'message','Question 1 of 5: Decode the emoji clue')"
);

content = content.replace(
  "when 'dots_boxes' then jsonb_build_object('turn',1,'hLines','{}'::jsonb,'vLines','{}'::jsonb,'boxes','{}'::jsonb,'scores','{}'::jsonb,'message','Player 1, draw a line')",
  "when 'dots_boxes' then jsonb_build_object('turn',1,'gridSize',coalesce((r.public_state->>'gridSize')::int,3),'hLines','{}'::jsonb,'vLines','{}'::jsonb,'boxes','{}'::jsonb,'scores','{}'::jsonb,'message','Player 1, draw a line')"
);

// Update declare section in play_room_action
content = content.replace(
  "declare r public.game_rooms; me public.game_players; n int; next_seat int; state jsonb; score int; val int; roll int; board jsonb; mark text; winner int:=null; new_boxes int:=0; r_idx int; c_idx int; key_b text;",
  "declare r public.game_rooms; me public.game_players; n int; next_seat int; state jsonb; score int; val int; roll int; board jsonb; mark text; winner int:=null; new_boxes int:=0; r_idx int; c_idx int; key_b text; grid_size int:=3; q_idx int:=0;"
);

// Add set_grid_size handler at the start of play_room_action
const insertAfterMe = "select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); if me.id is null then raise exception 'Not a player'; end if; state:=r.public_state; select count(*) into n from public.game_players where room_id=p_room;";
const setGridSizeCode = insertAfterMe + "\n  if p_action='set_grid_size' then\n   if r.host_id<>auth.uid() then raise exception 'Only host can set grid size'; end if;\n   val:=p_value::int; if val not in (3,4,5) then raise exception 'Grid size must be 3, 4, or 5'; end if;\n   state:=jsonb_set(state,'{gridSize}',to_jsonb(val),true);\n   update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;\n   return state;\n  end if;";

content = content.replace(insertAfterMe, setGridSizeCode);

// Update emoji_decode in play_room_action
const oldEmojiBlock = ` elsif r.game_type in ('quick_quiz','emoji_decode') then
  if p_action<>'answer' then raise exception 'Invalid action'; end if; val:=p_value::int; if val<0 or val>3 then raise exception 'Invalid answer'; end if; if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if; state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(val),true);
  if (r.game_type='quick_quiz' and val=1) or (r.game_type='emoji_decode' and val=2) then state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(1),true); else state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(0),true); end if;
  if (select count(*) from jsonb_object_keys(state->'answers'))=n then state:=jsonb_set(state,array['revealed'],to_jsonb(true),true); r.status:='completed'; end if;`;

const newQuizAndEmojiBlock = ` elsif r.game_type='quick_quiz' then
  if p_action<>'answer' then raise exception 'Invalid action'; end if; val:=p_value::int; if val<0 or val>3 then raise exception 'Invalid answer'; end if; if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if; state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(val),true);
  if val=1 then state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(1),true); else state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(0),true); end if;
  if (select count(*) from jsonb_object_keys(state->'answers'))=n then state:=jsonb_set(state,array['revealed'],to_jsonb(true),true); r.status:='completed'; end if;
 elsif r.game_type='emoji_decode' then
  if p_action<>'answer' then raise exception 'Invalid action'; end if;
  if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if;
  state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(p_value),true);
  if p_value in ('correct','1','true') or right(p_value,8)='_correct' then
    score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;
    state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
  else
    score:=coalesce((state->'scores'->>me.seat::text)::int,0);
    state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
  end if;
  if (select count(*) from jsonb_object_keys(state->'answers'))=n then
    q_idx:=coalesce((state->>'qIndex')::int,0)+1;
    if q_idx < 5 then
      state:=jsonb_set(state,array['qIndex'],to_jsonb(q_idx),true);
      state:=jsonb_set(state,array['answers'],'{}'::jsonb,true);
      state:=jsonb_set(state,array['message'],to_jsonb('Question '||(q_idx+1)||' of 5: Decode the emoji clue'),true);
    else
      state:=jsonb_set(state,array['revealed'],to_jsonb(true),true);
      r.status:='completed';
    end if;
  end if;`;

content = content.replace(oldEmojiBlock, newQuizAndEmojiBlock);

// Update dots_boxes in play_room_action to handle dynamic grid_size
const oldDotsBlock = ` for r_idx in 0..2 loop
    for c_idx in 0..2 loop`;

const newDotsBlock = ` grid_size:=coalesce((state->>'gridSize')::int,3);
  new_boxes:=0;
  for r_idx in 0..(grid_size-1) loop
    for c_idx in 0..(grid_size-1) loop`;

content = content.replace(oldDotsBlock, newDotsBlock);

content = content.replace(
  "if (select count(*) from jsonb_object_keys(state->'boxes')) >= 9 then",
  "if (select count(*) from jsonb_object_keys(state->'boxes')) >= (grid_size * grid_size) then"
);

fs.writeFileSync(sqlPath, content, 'utf8');
console.log('Successfully updated complete.sql for dynamic grid size & 5-question emoji guessing!');
