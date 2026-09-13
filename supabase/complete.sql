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
 game_type text not null check(game_type in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','dice_dash','quick_quiz','emoji_decode')),
 host_id uuid not null references public.profiles(id), status text not null default 'waiting' check(status in ('waiting','playing','completed','cancelled')),
 max_players smallint not null check(max_players between 2 and 4), public_state jsonb not null default '{}'::jsonb,
 state_version bigint not null default 0, match_number integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '24 hours')
);
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
 if p_game_type not in ('basketball','ping_pong','rps','number_guess','tic_tac_toe','dice_dash','quick_quiz','emoji_decode') then raise exception 'Unknown game'; end if;
 v_max:=case when p_game_type in ('ping_pong','tic_tac_toe') then 2 else greatest(2,least(4,p_max_players)) end;
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
declare r public.game_rooms; n int; state jsonb;
begin select * into r from public.game_rooms where id=p_room for update; if r.host_id<>auth.uid() then raise exception 'Only the host can start'; end if; if r.status<>'waiting' then raise exception 'Game already started'; end if;
 select count(*) into n from public.game_players where room_id=p_room; if n<2 or exists(select 1 from public.game_players where room_id=p_room and not is_ready) then raise exception 'Everyone must be ready'; end if;
 state:=case r.game_type
 when 'basketball' then jsonb_build_object('turn',1,'round',1,'scores','{}'::jsonb,'shots','{}'::jsonb,'message','Player 1 shoots first')
 when 'rps' then jsonb_build_object('round',1,'scores','{}'::jsonb,'choices','{}'::jsonb,'message','Make a secret pick')
 when 'number_guess' then jsonb_build_object('round',1,'secret',1+floor(random()*100)::int,'guesses','[]'::jsonb,'scores','{}'::jsonb,'message','Find the number from 1 to 100')
 when 'tic_tac_toe' then jsonb_build_object('turn',1,'board',jsonb_build_array('','','','','','','','',''),'message','Player 1 places X')
 when 'dice_dash' then jsonb_build_object('turn',1,'positions','{}'::jsonb,'message','Player 1, roll the dice')
 when 'quick_quiz' then jsonb_build_object('question',0,'answers','{}'::jsonb,'scores','{}'::jsonb,'message','Question 1')
 when 'emoji_decode' then jsonb_build_object('question',0,'answers','{}'::jsonb,'scores','{}'::jsonb,'message','Decode clue 1')
 else jsonb_build_object('scores','{}'::jsonb,'message','First to five wins') end;
 update public.game_rooms set status='playing',public_state=state,state_version=state_version+1,updated_at=now() where id=p_room;
end $$;

create or replace function public.finalize_room(p_room uuid,p_state jsonb,p_type text) returns void language plpgsql security definer set search_path='' as $$
declare p record; winning_seats int[]:='{}'; top_score int:=0; player_score int; result text; inserted int; distinct_choices int; winning_choice text; current_match int;
begin
 select match_number into current_match from public.game_rooms where id=p_room;
 if exists(select 1 from public.game_results where room_id=p_room and match_number=current_match) then return; end if;
 if p_state ? 'winnerSeat' and p_state->>'winnerSeat' is not null then winning_seats:=array[(p_state->>'winnerSeat')::int];
 elsif p_type in ('basketball','quick_quiz','emoji_decode') then
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
create or replace function public.play_room_action(p_room uuid,p_action text,p_value text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; me public.game_players; n int; next_seat int; state jsonb; score int; val int; roll int; board jsonb; mark text; winner int:=null;
begin
 select * into r from public.game_rooms where id=p_room for update; if r.status<>'playing' then raise exception 'Game is not active'; end if;
 select * into me from public.game_players where room_id=p_room and player_id=auth.uid(); if me.id is null then raise exception 'Not a player'; end if; state:=r.public_state; select count(*) into n from public.game_players where room_id=p_room;
 if r.game_type='basketball' then
  if (state->>'turn')::int<>me.seat or p_action<>'shoot' then raise exception 'Wait for your turn'; end if; roll:=floor(random()*100)::int; score:=case when roll<18 then 3 when roll<62 then 2 else 0 end;
  state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(coalesce((state->'scores'->>me.seat::text)::int,0)+score),true);
  val:=coalesce((state->'shots'->>me.seat::text)::int,0)+1; state:=jsonb_set(state,array['shots',me.seat::text],to_jsonb(val),true);
  select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat and coalesce((state->'shots'->>seat::text)::int,0)<5; if next_seat=1 then select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and coalesce((state->'shots'->>seat::text)::int,0)<5; end if;
  state:=jsonb_set(state,'{turn}',to_jsonb(next_seat)); state:=jsonb_set(state,'{message}',to_jsonb(case score when 3 then 'Nothing but net! +3' when 2 then 'Nice bucket! +2' else 'Off the rim!' end));
  if not exists(select 1 from public.game_players where room_id=p_room and coalesce((state->'shots'->>seat::text)::int,0)<5) then r.status:='completed'; end if;
 elsif r.game_type='dice_dash' then
  if (state->>'turn')::int<>me.seat or p_action<>'roll' then raise exception 'Wait for your turn'; end if; roll:=1+floor(random()*6)::int; val:=least(20,coalesce((state->'positions'->>me.seat::text)::int,0)+roll); state:=jsonb_set(state,array['positions',me.seat::text],to_jsonb(val),true); state:=jsonb_set(state,'{message}',to_jsonb('Player '||me.seat||' rolled '||roll));
  if val>=20 then state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat)); r.status:='completed'; else select coalesce(min(seat),1) into next_seat from public.game_players where room_id=p_room and seat>me.seat; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat)); end if;
 elsif r.game_type='tic_tac_toe' then
  if (state->>'turn')::int<>me.seat or p_action<>'place' then raise exception 'Wait for your turn'; end if; val:=p_value::int; if val<0 or val>8 or state->'board'->>val<>'' then raise exception 'Invalid square'; end if; mark:=case when me.seat=1 then 'X' else 'O' end; board:=jsonb_set(state->'board',array[val::text],to_jsonb(mark)); state:=jsonb_set(state,'{board}',board); next_seat:=case me.seat when 1 then 2 else 1 end; state:=jsonb_set(state,'{turn}',to_jsonb(next_seat));
  if (board->>0=mark and board->>1=mark and board->>2=mark) or (board->>3=mark and board->>4=mark and board->>5=mark) or (board->>6=mark and board->>7=mark and board->>8=mark) or (board->>0=mark and board->>3=mark and board->>6=mark) or (board->>1=mark and board->>4=mark and board->>7=mark) or (board->>2=mark and board->>5=mark and board->>8=mark) or (board->>0=mark and board->>4=mark and board->>8=mark) or (board->>2=mark and board->>4=mark and board->>6=mark) then state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat)); r.status:='completed'; elsif not board ? '' then state:=jsonb_set(state,'{winnerSeat}','null'::jsonb); r.status:='completed'; end if;
 elsif r.game_type='number_guess' then
  if p_action<>'guess' then raise exception 'Invalid action'; end if; val:=p_value::int; if val<1 or val>100 then raise exception 'Guess 1 to 100'; end if;
  state:=jsonb_set(state,'{guesses}',(state->'guesses')||jsonb_build_object('seat',me.seat,'value',val,'hint',case when val<(state->>'secret')::int then 'Too low' when val>(state->>'secret')::int then 'Too high' else 'Correct' end)); if val=(state->>'secret')::int then state:=state-'secret'; state:=jsonb_set(state,'{winnerSeat}',to_jsonb(me.seat)); r.status:='completed'; end if;
 elsif r.game_type='rps' then
  if p_action<>'choose' or p_value not in ('rock','paper','scissors') then raise exception 'Invalid choice'; end if;
  insert into private.rps_choices(room_id,round,player_id,choice) values(p_room,(state->>'round')::int,auth.uid(),p_value) on conflict do nothing; if not found then raise exception 'Choice already locked'; end if;
  state:=jsonb_set(state,array['choices',me.seat::text],to_jsonb('locked'),true); select count(*) into val from private.rps_choices where room_id=p_room and round=(state->>'round')::int;
  if val=n then state:=jsonb_set(state,'{choices}',(select jsonb_object_agg(p.seat::text,c.choice) from private.rps_choices c join public.game_players p on p.room_id=c.room_id and p.player_id=c.player_id where c.room_id=p_room and c.round=(state->>'round')::int)); state:=jsonb_set(state,'{revealed}','true'); r.status:='completed'; end if;
 elsif r.game_type='ping_pong' then
  if r.host_id<>auth.uid() or p_action<>'point' then raise exception 'Only the host referee can score a point'; end if; val:=p_value::int; if val not in (1,2) then raise exception 'Invalid player'; end if;
  score:=coalesce((state->'scores'->>val::text)::int,0)+1; state:=jsonb_set(state,array['scores',val::text],to_jsonb(score),true); state:=jsonb_set(state,'{message}',to_jsonb('Player '||val||' scores!'));
  if score>=5 then state:=jsonb_set(state,'{winnerSeat}',to_jsonb(val)); r.status:='completed'; end if;
 else
  if p_action<>'answer' then raise exception 'Invalid action'; end if; val:=p_value::int; if val<0 or val>3 then raise exception 'Invalid answer'; end if; if state->'answers' ? me.seat::text then raise exception 'Answer already locked'; end if; state:=jsonb_set(state,array['answers',me.seat::text],to_jsonb(val),true);
  if (r.game_type='quick_quiz' and val=1) or (r.game_type='emoji_decode' and val=2) then state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(1),true); else state:=jsonb_set(state,array['scores',me.seat::text],to_jsonb(0),true); end if;
  if (select count(*) from jsonb_object_keys(state->'answers'))=n then state:=jsonb_set(state,'{revealed}','true'); r.status:='completed'; end if;
 end if;
 update public.game_rooms set public_state=state,status=r.status,state_version=state_version+1,updated_at=now() where id=p_room;
 if r.status='completed' then perform public.finalize_room(p_room,state,r.game_type); end if;
 return state;
end $$;

create or replace function public.rematch_room(p_room uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.game_rooms; begin select * into r from public.game_rooms where id=p_room for update; if r.host_id<>auth.uid() then raise exception 'Only host can rematch'; end if; delete from private.rps_choices where room_id=p_room; update public.game_players set is_ready=false,score=0 where room_id=p_room; update public.game_rooms set status='waiting',public_state='{}',match_number=match_number+1,state_version=state_version+1,updated_at=now() where id=p_room; end $$;

revoke all on function public.finalize_room(uuid,jsonb,text) from public;
revoke all on function public.create_game_room(text,int),public.join_game_room(text),public.set_player_ready(uuid,boolean),public.start_game(uuid),public.play_room_action(uuid,text,text),public.rematch_room(uuid) from public;
grant execute on function public.create_game_room(text,int),public.join_game_room(text),public.set_player_ready(uuid,boolean),public.start_game(uuid),public.play_room_action(uuid,text,text),public.rematch_room(uuid) to authenticated;

-- Realtime publication (safe if already added).
do $$ begin alter publication supabase_realtime add table public.game_rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_players; exception when duplicate_object then null; end $$;
