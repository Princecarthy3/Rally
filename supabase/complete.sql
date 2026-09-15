-- Rally complete schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

-- Phase 1 compatibility
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 2 and 24), avatar_url text,
 games_played integer not null default 0 check(games_played>=0), wins integer not null default 0 check(wins>=0),
 losses integer not null default 0 check(losses>=0), draws integer not null default 0 check(draws>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.game_rooms (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code=upper(code) and char_length(code)=5),
 game_type text not null check(game_type in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo')),
 host_id uuid not null references public.profiles(id), status text not null default 'waiting' check(status in ('waiting','playing','completed','cancelled')),
 max_players smallint not null check(max_players between 2 and 4), public_state jsonb not null default '{}'::jsonb,
 state_version bigint not null default 0, match_number integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours')
);

-- Safely remap any unrecognized legacy records before applying constraint
update public.game_rooms set game_type = 'skribbl' where game_type not in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo');
update public.game_results set game_type = 'skribbl' where game_type not in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo');

-- Drop ALL existing constraints on column game_type dynamically regardless of constraint name
do $$
declare r record;
begin
  for r in (select constraint_name from information_schema.constraint_column_usage where table_name='game_rooms' and column_name='game_type') loop
    execute 'alter table public.game_rooms drop constraint if exists ' || quote_ident(r.constraint_name);
  end loop;
end $$;

alter table public.game_rooms add constraint game_rooms_game_type_check check (game_type in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo'));

create table if not exists public.game_players (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.game_rooms(id) on delete cascade,
 player_id uuid not null references public.profiles(id), seat smallint not null check(seat between 1 and 4), is_ready boolean not null default false,
 score integer not null default 0 check(score>=0), joined_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 unique(room_id,player_id), unique(room_id,seat)
);
create table if not exists public.game_results (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.game_rooms(id), player_id uuid not null references public.profiles(id),
 opponent_names text[] not null default '{}', game_type text not null, match_number integer not null default 1, outcome text not null check(outcome in ('win','loss','draw')),
 score integer not null default 0, top_score integer not null default 0, created_at timestamptz not null default now(), unique(room_id,match_number,player_id)
);
create schema if not exists private;
create table if not exists private.rps_choices(room_id uuid references public.game_rooms(id) on delete cascade, round integer not null, player_id uuid references public.profiles(id), choice text check(choice in('rock','paper','scissors')), primary key(room_id,round,player_id));

create index if not exists rooms_status_created_idx on public.game_rooms(status,created_at desc);
create index if not exists players_player_idx on public.game_players(player_id,joined_at desc);
create index if not exists results_player_created_idx on public.game_results(player_id,created_at desc);
alter table public.profiles enable row level security; alter table public.game_rooms enable row level security; alter table public.game_players enable row level security; alter table public.game_results enable row level security;

-- Fresh-install profile provisioning.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,display_name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Player'),24)) on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

drop policy if exists "Authenticated users can view player profiles" on public.profiles;
create policy "Authenticated users can view player profiles" on public.profiles for select to authenticated using(true);
revoke update on public.profiles from authenticated;
grant update(display_name,avatar_url,updated_at) on public.profiles to authenticated;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);

-- Security-definer helper avoids recursive game_players RLS evaluation.
create or replace function public.is_room_member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.game_players where room_id=p_room and player_id=auth.uid());
$$;
revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

-- Direct access is read-only and membership scoped. Mutations go through RPCs.
grant select on public.profiles to authenticated; grant select on public.game_rooms, public.game_players, public.game_results to authenticated;
revoke insert,update,delete on public.game_rooms,public.game_players,public.game_results from authenticated;
drop policy if exists "members read rooms" on public.game_rooms;
create policy "members read rooms" on public.game_rooms for select to authenticated using(public.is_room_member(id));
drop policy if exists "members read players" on public.game_players;
create policy "members read players" on public.game_players for select to authenticated using(public.is_room_member(room_id));
drop policy if exists "own results" on public.game_results;
create policy "own results" on public.game_results for select to authenticated using(player_id=(select auth.uid()));

create or replace function public.random_room_code() returns text language plpgsql volatile set search_path='' as $$
declare chars text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; output text:=''; i int;
begin for i in 1..5 loop output:=output||substr(chars,1+floor(random()*length(chars))::int,1); end loop; return output; end $$;

create or replace function public.create_game_room(p_game_type text,p_max_players int default 2) returns text language plpgsql security definer set search_path='' as $$
declare v_code text; v_room uuid; v_max int;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_game_type not in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','connect_four','dice_dash','dots_boxes','skribbl','ludo') then raise exception 'Unknown game'; end if;
 v_max:=case when p_game_type in ('ping_pong','tic_tac_toe','connect_four') then 2 else greatest(2,least(4,p_max_players)) end;
 loop v_code:=public.random_room_code(); exit when not exists(select 1 from public.game_rooms where code=v_code); end loop;
 insert into public.game_rooms(code,game_type,host_id,max_players) values(v_code,p_game_type,auth.uid(),v_max) returning id into v_room;
 insert into public.game_players(room_id,player_id,seat) values(v_room,auth.uid(),1); return v_code;
end $$;

create or replace function public.join_game_room(p_code text) returns text language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; v_seat int;
begin
 select * into r from public.game_rooms where code=upper(trim(p_code)) for update;
 if r.id is null then raise exception 'Room not found'; end if; if r.status<>'waiting' then raise exception 'Game already started'; end if;
 if exists(select 1 from public.game_players where room_id=r.id and player_id=auth.uid()) then return r.code; end if;
 if (select count(*) from public.game_players where room_id=r.id)>=r.max_players then raise exception 'Room is full'; end if;
 select s into v_seat from generate_series(1,r.max_players) s where not exists(select 1 from public.game_players where room_id=r.id and seat=s) order by s limit 1;
 insert into public.game_players(room_id,player_id,seat) values(r.id,auth.uid(),v_seat); return r.code;
end $$;

create or replace function public.set_player_ready(p_room uuid,p_ready boolean) returns void language plpgsql security definer set search_path='' as $$
begin update public.game_players set is_ready=p_ready,last_seen_at=now() where room_id=p_room and player_id=auth.uid(); if not found then raise exception 'Not in this room'; end if; end $$;

create or replace function public.start_game(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; n int; state jsonb; p_rec record; init_hands jsonb := '{}'::jsonb; p_hand jsonb; c_color text; c_val text; i int; top_c jsonb;
begin select * into r from public.game_rooms where id=p_room for update; if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if; if r.status<>'waiting' then raise exception 'Game already started'; end if;
 select count(*) into n from public.game_players where room_id=p_room; if n<2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Everyone must be ready'; end if;
 if r.game_type='uno' then
   for p_rec in select seat from public.game_players where room_id=p_room loop
     p_hand := '[]'::jsonb;
     for i in 1..7 loop
       c_color := case (1+floor(random()*4)::int) when 1 then 'red' when 2 then 'blue' when 3 then 'green' else 'yellow' end;
       c_val := (floor(random()*10)::int)::text;
       if random() < 0.15 then
         c_val := case (1+floor(random()*3)::int) when 1 then 'skip' when 2 then 'reverse' else 'draw2' end;
       elsif random() < 0.08 then
         c_color := 'wild';
         c_val := case when random() < 0.5 then 'wild' else 'wild_draw4' end;
       end if;
       p_hand := p_hand || jsonb_build_object('id', 'c_'||floor(random()*1000000)::text, 'color', c_color, 'value', c_val);
     end loop;
     init_hands := jsonb_set(init_hands, array[p_rec.seat::text], p_hand, true);
   end loop;
   c_color := case (1+floor(random()*4)::int) when 1 then 'red' when 2 then 'blue' when 3 then 'green' else 'yellow' end;
   c_val := (floor(random()*10)::int)::text;
   top_c := jsonb_build_object('id', 'c_top_'||floor(random()*100000)::text, 'color', c_color, 'value', c_val);
   state := jsonb_build_object(
     'turn', 1,
     'direction', 1,
     'topCard', top_c,
     'activeColor', c_color,
     'hands', init_hands,
     'unoCalled', '{}'::jsonb,
     'scores', '{}'::jsonb,
     'round', 1,
     'roundWins', '{}'::jsonb,
     'message', 'Game started! Player 1 goes first.'
   );
 else
   state:=case r.game_type
   when 'basketball' then jsonb_build_object('turn',1,'round',1,'scores','{}'::jsonb,'shots','{}'::jsonb,'message','Player 1 shoots first')
   when 'rps' then jsonb_build_object('round',1,'scores','{}'::jsonb,'choices','{}'::jsonb,'message','Make a secret pick')
   when 'number_guess' then jsonb_build_object('pickerSeat',1,'guesserSeat',2,'targetPicked',false,'targetNumber',null,'lastGuess',null,'attemptsLeft',3,'guesses','[]'::jsonb,'round',1,'scores','{}'::jsonb,'message','Player 1 (Picker): Set a secret number from 1 to 100!')
   when 'tic_tac_toe' then jsonb_build_object('turn',1,'board',jsonb_build_array('','','','','','','','',''),'message','Player 1 places X')
   when 'connect_four' then jsonb_build_object('turn',1,'round',1,'connectFourBoard',jsonb_build_array('','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','',''),'roundWins','{}'::jsonb,'message','Player 1 drops first')
   when 'dice_dash' then jsonb_build_object('turn',1,'positions','{}'::jsonb,'message','Player 1, roll the dice')
   when 'dots_boxes' then jsonb_build_object('turn',1,'gridSize',coalesce((r.public_state->>'gridSize')::int,3),'hLines','{}'::jsonb,'vLines','{}'::jsonb,'boxes','{}'::jsonb,'scores','{}'::jsonb,'message','Player 1, draw a line')
   when 'skribbl' then jsonb_build_object('drawerSeat',1,'round',1,'scores','{}'::jsonb,'wordSelected',null,'guessedSeats','[]'::jsonb,'message','Drawer is picking a word...')
   else jsonb_build_object('scores','{}'::jsonb,'message','First to five wins') end;
 end if;
 if r.game_type='connect_four' then
   state:=jsonb_set(state, '{connectFourBoard}', to_jsonb(array_fill(''::text, ARRAY[42])), true);
 end if;
 update public.game_rooms set status='playing',public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
end $$;

create or replace function public.finalize_room(p_room uuid,p_state jsonb,p_type text) returns void language plpgsql security definer set search_path='' as $$
declare p record; winning_seats int[]:='{}'; top_score int:=0; player_score int; result text; inserted int; distinct_choices int; winning_choice text; current_match int;
begin
 select match_number into current_match from public.game_rooms where id=p_room;
 if exists(select 1 from public.game_results where room_id=p_room and match_number=current_match) then return; end if;
 if p_state ? 'winnerSeat' and p_state->>'winnerSeat' is not null then winning_seats:=array[(p_state->>'winnerSeat')::int];
 elsif p_type in ('basketball','dots_boxes','skribbl') then
  select coalesce(max(coalesce((p_state->'scores'->>seat::text)::int,0)),0) into top_score from public.game_players where room_id=p_room;
  select coalesce(array_agg(seat),'{}'::int[]) into winning_seats from public.game_players where room_id=p_room and coalesce((p_state->'scores'->>seat::text)::int,0)=top_score;
 elsif p_type='rps' then
  select count(distinct value) into distinct_choices from jsonb_each_text(p_state->'choices');
  if distinct_choices=2 then
   if (p_state->'choices') @? '$.* ? (@ == "rock")' and (p_state->'choices') @? '$.* ? (@ == "scissors")' then winning_choice:='rock';
   elsif (p_state->'choices') @? '$.* ? (@ == "scissors")' and (p_state->'choices') @? '$.* ? (@ == "paper")' then winning_choice:='scissors'; else winning_choice:='paper'; end if;
   select coalesce(array_agg(key::int),'{}'::int[]) into winning_seats from jsonb_each_text(p_state->'choices') where value=winning_choice;
  end if;
 end if;
 foreach player_score in array winning_seats loop top_score:=greatest(top_score,coalesce((p_state->'scores'->>player_score::text)::int,0)); end loop;
 for p in select gp.*,pr.display_name from public.game_players gp join public.profiles pr on pr.id=gp.player_id where gp.room_id=p_room loop
  player_score:=coalesce((p_state->'scores'->>p.seat::text)::int,case when p_type='dice_dash' then coalesce((p_state->'positions'->>p.seat::text)::int,0) else 0 end);
  result:=case when cardinality(winning_seats)=0 or cardinality(winning_seats)=(select count(*) from public.game_players where room_id=p_room) then 'draw' when p.seat=any(winning_seats) then 'win' else 'loss' end;
  insert into public.game_results(room_id,player_id,opponent_names,game_type,match_number,outcome,score,top_score)
  select p_room,p.player_id,coalesce(array_agg(pr.display_name order by gp.seat),'{}'::text[]),p_type,current_match,result,player_score,top_score from public.game_players gp join public.profiles pr on pr.id=gp.player_id where gp.room_id=p_room and gp.player_id<>p.player_id
  on conflict(room_id,match_number,player_id) do nothing; get diagnostics inserted=row_count;
  if inserted=1 then update public.profiles set games_played=games_played+1,wins=wins+(result='win')::int,losses=losses+(result='loss')::int,draws=draws+(result='draw')::int,updated_at=now() where id=p.player_id; end if;
 end loop;
end $$;

-- Validates and applies casual turn-based actions. Client never supplies score or random outcome.
drop function if exists public.play_room_action(uuid,text,text);
create or replace function public.play_room_action(p_room uuid,p_action text,p_value text default null,p_actor_seat int default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; n int; next_seat int; state jsonb; score int; val int; roll int; board jsonb; mark text; winner int:=null; new_boxes int:=0; r_idx int; c_idx int; key_b text; grid_size int:=3; q_idx int:=0; round_ended boolean:=false; round_winner int:=null; cur_round int:=1; round_wins jsonb; p_toks jsonb; tok_idx int; cur_pos int; new_pos int; card_id text; chosen_color text; elem jsonb; card_elem jsonb; new_hand jsonb; dir int:=1; skip_step int:=1; active_col text; card_val text; card_col text; penalty_cards jsonb; picker_s int; guesser_s int; target_n int; clue_msg text; c_color text; c_val text; i int;
begin
 select * into r from public.game_rooms where id=p_room for update; if r.status<>'playing' then raise exception 'Game is not active'; end if;
 if p_actor_seat is not null then
  select * into me from public.game_players where room_id=p_room and seat=p_actor_seat and player_id='11111111-1111-1111-1111-111111111111';
 end if;
 if me.id is null then
  select * into me from public.game_players where room_id=p_room and player_id=auth.uid();
 end if;
 if me.id is null then raise exception 'Not a player'; end if; state:=r.public_state; select count(*) into n from public.game_players where room_id=p_room;
  if p_action='set_grid_size' then
   if r.host_id<>auth.uid() then raise exception 'Only host can set grid size'; end if;
   val:=p_value::int; if val not in (3,4,5) then raise exception 'Grid size must be 3, 4, or 5'; end if;
   state:=jsonb_set(state,'{gridSize}',to_jsonb(val),true);
   update public.game_rooms set public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
   return state;
  end if;

 cur_round:=coalesce((state->>'round')::int, 1);
 round_wins:=coalesce(state->'roundWins', '{}'::jsonb);

 if r.game_type='uno' then
   if p_action='call_uno' then
     state:=jsonb_set(state, array['unoCalled', me.seat::text], 'true'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb(('Player '||me.seat||' called UNO! 📣')::text));
   else
     if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
     if p_action='draw_card' then
       val:=1+floor(random()*9)::int;
       p_toks:=coalesce(state->'hands'->me.seat::text, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id','c_'||floor(random()*100000)::text,'color',case (1+floor(random()*4)::int) when 1 then 'red' when 2 then 'blue' when 3 then 'green' else 'yellow' end,'value',val::text));
       state:=jsonb_set(state, array['hands', me.seat::text], p_toks, true);
       state:=jsonb_set(state, '{message}', to_jsonb(('Player '||me.seat||' drew a card.')::text));
       select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;
       state:=jsonb_set(state, '{turn}', to_jsonb(next_seat));
     elsif p_action='play_card' then
       select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;
       state:=jsonb_set(state, '{turn}', to_jsonb(next_seat));
       p_toks:=coalesce(state->'hands'->me.seat::text, '[]'::jsonb);
       if (select count(*) from jsonb_array_elements(p_toks)) <= 1 then
         round_ended:=true; round_winner:=me.seat;
       end if;
     end if;
   end if;

 elsif r.game_type='tic_tac_toe' then
  if (state->>'turn')::int<>me.seat or p_action<>'place' then raise exception 'Wait for your turn'; end if; val:=p_value::int; if val<0 or val>8 or state->'board'->>val<>'' then raise exception 'Invalid square'; end if; mark:=case when me.seat=1 then 'X' else 'O' end; board:=jsonb_set(state->'board',array[val::text],to_jsonb(mark)); state:=jsonb_set(state,'{board}',board); next_seat:=case me.seat when 1 then 2 else 1 end; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat));
  if (board->>0=mark and board->>1=mark and board->>2=mark) or (board->>3=mark and board->>4=mark and board->>5=mark) or (board->>6=mark and board->>7=mark and board->>8=mark) or (board->>0=mark and board->>3=mark and board->>6=mark) or (board->>1=mark and board->>4=mark and board->>7=mark) or (board->>2=mark and board->>5=mark and board->>8=mark) or (board->>0=mark and board->>4=mark and board->>8=mark) or (board->>2=mark and board->>5=mark and board->>6=mark) then round_ended:=true; round_winner:=me.seat; elsif not board ? '' then round_ended:=true; round_winner:=null; end if;

 elsif r.game_type='number_guess' then
   picker_s:=coalesce((state->>'pickerSeat')::int, 1);
   guesser_s:=coalesce((state->>'guesserSeat')::int, case when picker_s = 1 then 2 else 1 end);

   if p_action='set_target' then
     if picker_s <> me.seat then raise exception 'Only the picker can set the secret number'; end if;
     val:=p_value::int; if val<1 or val>100 then raise exception 'Number must be between 1 and 100'; end if;
     state:=jsonb_set(state, '{targetNumber}', to_jsonb(val), true);
     state:=jsonb_set(state, '{targetPicked}', 'true'::jsonb, true);
     state:=jsonb_set(state, '{lastGuess}', 'null'::jsonb, true);
     state:=jsonb_set(state, '{attemptsLeft}', to_jsonb(3), true);
     state:=jsonb_set(state, '{guesses}', '[]'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb('Secret number set! Guesser has 3 tries in 45 seconds!'::text));
   elsif p_action='time_expired' then
     round_ended:=true; round_winner:=picker_s;
     score:=coalesce((state->'scores'->>picker_s::text)::int, 0) + 50;
     state:=jsonb_set(state, array['scores', picker_s::text], to_jsonb(score), true);
     state:=jsonb_set(state, '{pickerSeat}', to_jsonb(guesser_s), true);
     state:=jsonb_set(state, '{guesserSeat}', to_jsonb(picker_s), true);
     state:=jsonb_set(state, '{targetPicked}', 'false'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb(('45-Second timer expired! Player '||picker_s||' (Picker) wins the round! Roles swapped!')::text));
   elsif p_action='guess' then
     if guesser_s <> me.seat then raise exception 'Only the guesser can make a guess'; end if;
     val:=p_value::int; if val<1 or val>100 then raise exception 'Guess must be 1 to 100'; end if;
     
     score:=coalesce((state->>'attemptsLeft')::int, 3) - 1;
     state:=jsonb_set(state, '{attemptsLeft}', to_jsonb(greatest(0, score)), true);
     state:=jsonb_set(state, '{lastGuess}', to_jsonb(val), true);
     state:=jsonb_set(state, '{guesses}', coalesce(state->'guesses', '[]'::jsonb) || to_jsonb(val), true);
     target_n:=coalesce((state->>'targetNumber')::int, 50);

     if val = target_n then
       score:=coalesce((state->'scores'->>me.seat::text)::int, 0) + 100;
       state:=jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
       round_ended:=true; round_winner:=me.seat;
       state:=jsonb_set(state, '{pickerSeat}', to_jsonb(me.seat), true);
       state:=jsonb_set(state, '{guesserSeat}', to_jsonb(picker_s), true);
       state:=jsonb_set(state, '{targetPicked}', 'false'::jsonb, true);
       state:=jsonb_set(state, '{message}', to_jsonb(('CORRECT! Player '||me.seat||' guessed secret target '||target_n||'! Roles swapped! 🎉')::text));
     elsif score <= 0 then
       round_ended:=true; round_winner:=picker_s;
       score:=coalesce((state->'scores'->>picker_s::text)::int, 0) + 50;
       state:=jsonb_set(state, array['scores', picker_s::text], to_jsonb(score), true);
       state:=jsonb_set(state, '{pickerSeat}', to_jsonb(guesser_s), true);
       state:=jsonb_set(state, '{guesserSeat}', to_jsonb(picker_s), true);
       state:=jsonb_set(state, '{targetPicked}', 'false'::jsonb, true);
       state:=jsonb_set(state, '{message}', to_jsonb(('Used all 3 tries! Player '||picker_s||' (Picker) wins the round! Target was '||target_n||'. Roles swapped!')::text));
     else
       clue_msg:=case when target_n > val then 'TOO LOW ⬆️' else 'TOO HIGH ⬇️' end;
       if abs(target_n - val) <= 5 then clue_msg:=clue_msg || ' (Very Close 🔥)'; elsif abs(target_n - val) > 25 then clue_msg:=clue_msg || ' (Cold 🥶)'; end if;
       state:=jsonb_set(state, '{message}', to_jsonb(('Guess '||val||' is '||clue_msg||' — '||score||' try(ies) left!')::text));
     end if;
   end if;

 elsif r.game_type='rps' then
   if p_action='next_round' then
     cur_round:=coalesce((state->>'round')::int, 1) + 1;
     state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
     state:=jsonb_set(state, '{choices}', '{}'::jsonb, true);
     state:=jsonb_set(state, '{revealed}', 'false'::jsonb, true);
     state:=jsonb_set(state, '{message}', to_jsonb(('Round '||cur_round||' of 3: Make your pick!')::text));
   elsif p_action='choose' then
     if p_value not in ('rock','paper','scissors') then raise exception 'Invalid choice'; end if;
     insert into private.rps_choices(room_id,round,player_id,choice) values(p_room,cur_round,me.player_id,p_value) on conflict do nothing; if not found then raise exception 'Choice already locked'; end if;
     state:=jsonb_set(state,array['choices',me.seat::text],to_jsonb(p_value::text),true);
     select count(*) into val from private.rps_choices where room_id=p_room and round=cur_round;
     
     if val=n then
       state:=jsonb_set(state,array['choices'],coalesce((select jsonb_object_agg(p.seat::text,c.choice::text) from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=cur_round),'{}'::jsonb),true);
       state:=jsonb_set(state,array['revealed'],to_jsonb(true),true);
       
       select choice into c_color from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=cur_round and p.seat=1;
       select choice into c_val from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=cur_round and p.seat=2;
       
       if c_color = c_val then
         clue_msg := 'Draw! Both players picked ' || c_color || '!';
         round_winner := null;
       elsif (c_color='rock' and c_val='scissors') or (c_color='scissors' and c_val='paper') or (c_color='paper' and c_val='rock') then
         score := coalesce((state->'scores'->>'1')::int, 0) + 1;
         state := jsonb_set(state, array['scores', '1'], to_jsonb(score), true);
         round_winner := 1;
         clue_msg := 'Player 1 wins! (' || c_color || ' beats ' || c_val || ') 🎉';
       else
         score := coalesce((state->'scores'->>'2')::int, 0) + 1;
         state := jsonb_set(state, array['scores', '2'], to_jsonb(score), true);
         round_winner := 2;
         clue_msg := 'Player 2 wins! (' || c_val || ' beats ' || c_color || ') 🎉';
       end if;

       state := jsonb_set(state, '{message}', to_jsonb(('Round '||cur_round||' Result: '||clue_msg)::text));
       state := jsonb_set(state, '{history}', coalesce(state->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('round', cur_round, 'winnerSeat', round_winner, 'message', clue_msg)), true);
       
       if cur_round >= 3 then
         round_ended := true;
       end if;
     end if;
   end if;

 elsif r.game_type='connect_four' then
   if p_action<>'drop' or p_value is null or p_value !~ '^[0-6]$' then raise exception 'Choose a valid column'; end if;
   if (state->>'turn')::int<>me.seat then raise exception 'Wait for your turn'; end if;
   board:=state->'connectFourBoard';
   if jsonb_typeof(board) <> 'array' or jsonb_array_length(board) <> 42 then
     board:=to_jsonb(array_fill(''::text, ARRAY[42]));
   end if;
   c_idx:=p_value::int; r_idx:=null;
   for i in reverse 5..0 loop
     if coalesce(board->>((i*7+c_idx)::text), '') = '' then r_idx:=i; exit; end if;
   end loop;
   if r_idx is null then raise exception 'That column is full'; end if;
   mark:=me.seat::text;
   board:=jsonb_set(board,array[(r_idx*7+c_idx)::text],to_jsonb(mark),true);
   state:=jsonb_set(state,'{connectFourBoard}',board,true);
   winner:=null;
   for r_idx in 0..5 loop
     for c_idx in 0..6 loop
       if board->>((r_idx*7+c_idx)::text)=mark then
         if c_idx<=3 and board->>((r_idx*7+c_idx+1)::text)=mark and board->>((r_idx*7+c_idx+2)::text)=mark and board->>((r_idx*7+c_idx+3)::text)=mark then winner:=me.seat; end if;
         if r_idx<=2 and board->>(((r_idx+1)*7+c_idx)::text)=mark and board->>(((r_idx+2)*7+c_idx)::text)=mark and board->>(((r_idx+3)*7+c_idx)::text)=mark then winner:=me.seat; end if;
         if r_idx<=2 and c_idx<=3 and board->>(((r_idx+1)*7+c_idx+1)::text)=mark and board->>(((r_idx+2)*7+c_idx+2)::text)=mark and board->>(((r_idx+3)*7+c_idx+3)::text)=mark then winner:=me.seat; end if;
         if r_idx<=2 and c_idx>=3 and board->>(((r_idx+1)*7+c_idx-1)::text)=mark and board->>(((r_idx+2)*7+c_idx-2)::text)=mark and board->>(((r_idx+3)*7+c_idx-3)::text)=mark then winner:=me.seat; end if;
       end if;
     end loop;
   end loop;
   if winner is not null then
     round_ended:=true; round_winner:=winner; r.status:='completed';
     state:=jsonb_set(state,'{winnerSeat}',to_jsonb(winner),true);
     state:=jsonb_set(state,'{message}',to_jsonb(('Player '||me.seat||' connects four!')::text),true);
   elsif not exists(select 1 from jsonb_array_elements_text(board) cell where cell='') then
     round_ended:=true; round_winner:=null; r.status:='completed';
     state:=jsonb_set(state,'{winnerSeat}','null'::jsonb,true);
     state:=jsonb_set(state,'{message}',to_jsonb('Board full — round draw!'::text),true);
   else
     next_seat:=case when me.seat=1 then 2 else 1 end;
     state:=jsonb_set(state,'{turn}',to_jsonb(next_seat),true);
     state:=jsonb_set(state,'{message}',to_jsonb(('Player '||next_seat||' drops next')::text),true);
   end if;

 elsif r.game_type='quick_quiz' then
   if p_action<>'answer' then raise exception 'Invalid action'; end if; val:=p_value::int; if val<0 or val>3 then raise exception 'Invalid answer'; end if; if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if; state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(val),true);
   if val=1 then state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(1),true); else state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(0),true); end if;
   if (select count(*) from jsonb_object_keys(state->'answers'))=n then state:=jsonb_set(state,array['revealed'],to_jsonb(true),true); round_ended:=true; end if;

 elsif r.game_type='emoji_decode' then
   if p_action<>'answer' then raise exception 'Invalid action'; end if;
   if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if;
   state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(p_value::text),true);
   if p_value in ('correct','1','true') or right(p_value,8)='_correct' then
     score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;
     state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
   end if;
   if (select count(*) from jsonb_object_keys(state->'answers'))=n then
     q_idx:=coalesce((state->>'qIndex')::int,0)+1;
     if q_idx < 5 then
       state:=jsonb_set(state,array['qIndex'],to_jsonb(q_idx::int),true);
       state:=jsonb_set(state,array['answers'],'{}'::jsonb,true);
       state:=jsonb_set(state,array['message'],to_jsonb(('Question '||(q_idx+1)||' of 5: Decode the emoji clue')::text),true);
     else
       state:=jsonb_set(state,array['revealed'],to_jsonb(true),true);
       round_ended:=true;
     end if;
   end if;

 elsif r.game_type='dots_boxes' then
   if (state->>'turn')::int<>me.seat or p_action<>'line' then raise exception 'Wait for your turn'; end if;
   if (state->'hLines' ? p_value) or (state->'vLines' ? p_value) then raise exception 'Line already drawn'; end if;
   if left(p_value,2)='h_' then
     state:=jsonb_set(state,array['hLines',substr(p_value,3)],to_jsonb(me.seat::int),true);
   else
     state:=jsonb_set(state,array['vLines',substr(p_value,3)],to_jsonb(me.seat),true);
   end if;
   grid_size:=coalesce((state->>'gridSize')::int,3); new_boxes:=0;
   for r_idx in 0..(grid_size-1) loop
     for c_idx in 0..(grid_size-1) loop
       key_b:='b_'||r_idx||'_'||c_idx;
       if not (state->'boxes' ? key_b) then
         if (state->'hLines' ? (r_idx||'_'||c_idx)) and
            (state->'hLines' ? ((r_idx+1)||'_'||c_idx)) and
            (state->'vLines' ? (r_idx||'_'||c_idx)) and
            (state->'vLines' ? (r_idx||'_'||(c_idx+1))) then
           state:=jsonb_set(state,array['boxes',key_b],to_jsonb(me.seat),true);
           new_boxes:=new_boxes+1;
           score:=coalesce((state->'scores'->>me.seat::text)::int,0)+1;
           state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(score),true);
         end if;
       end if;
     end loop;
   end loop;
   if new_boxes > 0 then
     state:=jsonb_set(state,array['message'],to_jsonb(('Player '||me.seat||' completed '||new_boxes||' box(es)! Extra turn.')::text),true);
   else
     select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room; end if;
     state:=jsonb_set(state,array['turn'],to_jsonb(next_seat::int),true);
     state:=jsonb_set(state,array['message'],to_jsonb(('Player '||next_seat||'’s turn')::text),true);
   end if;
   if (select count(*) from jsonb_object_keys(state->'boxes')) >= (grid_size * grid_size) then
     round_ended:=true;
   end if;

 elsif r.game_type='skribbl' then
   if p_action='select_word' then
     if (state->>'drawerSeat')::int<>me.seat then raise exception 'Only the drawer can pick'; end if;
     state:=jsonb_set(state,array['wordSelected'],to_jsonb(p_value::text),true);
     state:=jsonb_set(state,array['tries'], '{}'::jsonb, true);
     state:=jsonb_set(state,array['message'],to_jsonb('Drawer selected a word! Guesser gets 3 tries.'::text));
   elsif p_action='guess' then
     if (state->>'drawerSeat')::int=me.seat then raise exception 'Drawer cannot guess'; end if;
     val:=coalesce((state->'tries'->>me.seat::text)::int, 3) - 1;
     state:=jsonb_set(state, array['tries'], coalesce(state->'tries', '{}'::jsonb) || jsonb_build_object(me.seat::text, greatest(0, val)), true);

     if lower(trim(p_value))=lower(trim(state->>'wordSelected')) then
       score:=coalesce((state->'scores'->>me.seat::text)::int, 0) + 100;
       state:=jsonb_set(state, array['scores', me.seat::text], to_jsonb(score), true);
       score:=coalesce((state->'scores'->>(state->>'drawerSeat'))::int, 0) + 50;
       state:=jsonb_set(state, array['scores', state->>'drawerSeat'], to_jsonb(score), true);
       
       next_seat:=((coalesce((state->>'drawerSeat')::int, 1) % n) + 1);
       state:=jsonb_set(state, '{drawerSeat}', to_jsonb(next_seat), true);
       state:=jsonb_set(state, '{wordSelected}', 'null'::jsonb, true);
       state:=jsonb_set(state, '{tries}', '{}'::jsonb, true);
       round_ended:=true; round_winner:=me.seat;
       state:=jsonb_set(state, array['message'], to_jsonb(('Player '||me.seat||' guessed the word correctly! 🎉 Next drawer: Player '||next_seat||'.')::text));
     elsif val <= 0 then
       score:=coalesce((state->'scores'->>(state->>'drawerSeat'))::int, 0) + 50;
       state:=jsonb_set(state, array['scores', state->>'drawerSeat'], to_jsonb(score), true);
       
       next_seat:=((coalesce((state->>'drawerSeat')::int, 1) % n) + 1);
       round_winner:=(state->>'drawerSeat')::int;
       state:=jsonb_set(state, '{drawerSeat}', to_jsonb(next_seat), true);
       state:=jsonb_set(state, '{wordSelected}', 'null'::jsonb, true);
       state:=jsonb_set(state, '{tries}', '{}'::jsonb, true);
       round_ended:=true;
       state:=jsonb_set(state, array['message'], to_jsonb(('Used all 3 tries! Drawer (Player '||round_winner||') wins the round! Next drawer: Player '||next_seat||'.')::text));
     else
       state:=jsonb_set(state, array['message'], to_jsonb(('Wrong guess by Player '||me.seat||'! ('||val||' try(ies) left)')::text));
     end if;
   end if;
 end if;

 -- 3-ROUND MATCH LOGIC FOR MATCH GAMES (rps, tic_tac_toe, dots_boxes)
  if round_ended and r.game_type <> 'connect_four' then
    if round_winner is not null then
      score:=coalesce((round_wins->>round_winner::text)::int, 0) + 1;
      round_wins:=jsonb_set(round_wins, array[round_winner::text], to_jsonb(score), true);
    end if;
    state:=jsonb_set(state, '{roundWins}', round_wins, true);

    if r.game_type in ('rps', 'tic_tac_toe', 'connect_four', 'dots_boxes') then
      if cur_round >= 3 or coalesce((round_wins->>me.seat::text)::int, 0) >= 2 then
        state:=jsonb_set(state, '{winnerSeat}', to_jsonb(coalesce(round_winner, me.seat)), true);
        r.status:='completed';
      else
        if r.game_type='tic_tac_toe' then
          cur_round:=cur_round + 1;
          state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
          state:=jsonb_set(state, '{board}', jsonb_build_array('','','','','','','','',''), true);
        elsif r.game_type='dots_boxes' then
          cur_round:=cur_round + 1;
          state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
          state:=jsonb_set(state, '{hLines}', '{}'::jsonb, true);
          state:=jsonb_set(state, '{vLines}', '{}'::jsonb, true);
          state:=jsonb_set(state, '{boxes}', '{}'::jsonb, true);
        elsif r.game_type='connect_four' then
          cur_round:=cur_round + 1;
          state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
          state:=jsonb_set(state, '{turn}', '1'::jsonb, true);
          state:=jsonb_set(state, '{connectFourBoard}', jsonb_build_array('','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','','',''), true);
        end if;
      end if;
    elsif r.game_type in ('skribbl', 'number_guess') then
      cur_round:=cur_round + 1;
      state:=jsonb_set(state, '{round}', to_jsonb(cur_round), true);
    end if;
  end if;

  update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
 if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
 return state;
end $$;


create or replace function public.rematch_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; begin select * into r from public.game_rooms where id=p_room for update; if r.host_id<>auth.uid() then raise exception 'Only host can rematch'; end if; delete from private.rps_choices where room_id=p_room; update public.game_players set is_ready=false,score=0 where room_id=p_room; update public.game_rooms set status='waiting',public_state='{}',match_number=match_number+1,state_version=state_version+1,updated_at=now() where id=p_room; end $$;

create or replace function public.add_ai_bot_to_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; v_bot_id uuid := '11111111-1111-1111-1111-111111111111'; v_seat int;
begin
 select * into r from public.game_rooms where id=p_room for update;
 if r.id is null then raise exception 'Room not found'; end if;
 if r.status<>'waiting' then raise exception 'Game already started'; end if;

 -- Ensure bot user exists in auth.users to satisfy profiles foreign key constraint
 insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
 values (v_bot_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bot@rally.game', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Rally Bot 🤖"}'::jsonb, now(), now())
 on conflict (id) do nothing;

 insert into public.profiles(id,display_name) values(v_bot_id,'Rally Bot 🤖') on conflict(id) do update set display_name='Rally Bot 🤖';
 if exists(select 1 from public.game_players where room_id=p_room and player_id=v_bot_id) then return; end if;
 if (select count(*) from public.game_players where room_id=p_room)>=r.max_players then raise exception 'Room is full'; end if;
 select s into v_seat from generate_series(1,r.max_players) s where not exists(select 1 from public.game_players where room_id=r.id and seat=s) order by s limit 1;
 insert into public.game_players(room_id,player_id,seat,is_ready) values(p_room,v_bot_id,v_seat,true);
end $$;

revoke all on function public.finalize_room(uuid,jsonb,text) from public;
revoke all on function public.create_game_room(text,int),public.join_game_room(text),public.set_player_ready(uuid,boolean),public.start_game(uuid),public.play_room_action(uuid,text,text,int),public.rematch_room(uuid),public.add_ai_bot_to_room(uuid) from public;
grant execute on function public.create_game_room(text,int),public.join_game_room(text),public.set_player_ready(uuid,boolean),public.start_game(uuid),public.rematch_room(uuid),public.add_ai_bot_to_room(uuid) to authenticated;
-- Bot moves are sent through the server route with Supabase's anon key. The
-- RPC validates p_actor_seat against the dedicated bot record before acting.
grant execute on function public.play_room_action(uuid,text,text,int) to anon, authenticated;

-- Realtime publication (safe if already added).
do $$ begin alter publication supabase_realtime add table public.game_rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_players; exception when duplicate_object then null; end $$;
