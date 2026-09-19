-- Fix PL/pgSQL array_agg aggregate subquery error in public.finalize_room
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
  values (
    p_room,
    p.player_id,
    coalesce((select array_agg(pr.display_name order by gp.seat) from public.game_players gp join public.profiles pr on pr.id=gp.player_id where gp.room_id=p_room and gp.player_id<>p.player_id),'{}'::text[]),
    p_type,
    current_match,
    result,
    player_score,
    top_score
  )
  on conflict(room_id,match_number,player_id) do nothing; get diagnostics inserted=row_count;
  if inserted=1 then update public.profiles set games_played=games_played+1,wins=wins+(result='win')::int,losses=losses+(result='loss')::int,draws=draws+(result='draw')::int,updated_at=now() where id=p.player_id; end if;
 end loop;
end $$;
