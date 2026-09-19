-- Migration: Fix Bot Rematch & Daily Mission Progress & Reward Claiming

-- 1. Fix rematch_room RPC to automatically ready ALL AI bots in the room upon rematch
create or replace function public.rematch_room(p_room uuid) returns void
language plpgsql security definer set search_path='' as $$
declare room_row public.game_rooms;
begin
  select * into room_row from public.game_rooms where id=p_room for update;
  if room_row.id is null then raise exception 'Room not found'; end if;
  if room_row.host_id<>auth.uid() then raise exception 'Only host can rematch'; end if;

  delete from private.rps_choices where room_id=p_room;
  update public.game_players set is_ready=false, score=0 where room_id=p_room;

  -- The bot has no browser to press Ready after a rematch.
  -- Automatically set all AI bots in this room (matching bot UUID prefix pattern) to is_ready=true.
  update public.game_players set is_ready=true
    where room_id=p_room and (
      player_id::text like '11111111-1111-1111-1111-%' or
      player_id = '11111111-1111-1111-1111-111111111111'
    );

  update public.game_rooms
    set status='waiting', public_state='{}', match_number=match_number+1,
        state_version=state_version+1, updated_at=now()
    where id=p_room;
end $$;

-- 2. Ensure RLS policies on mission tables
grant select, insert, update on public.user_daily_mission_progress to authenticated;
grant select, insert, update on public.user_monthly_mission_streak to authenticated;

drop policy if exists "own progress insert" on public.user_daily_mission_progress;
create policy "own progress insert" on public.user_daily_mission_progress for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "own progress update" on public.user_daily_mission_progress;
create policy "own progress update" on public.user_daily_mission_progress for update to authenticated using(user_id=auth.uid());

drop policy if exists "own monthly streak insert" on public.user_monthly_mission_streak;
create policy "own monthly streak insert" on public.user_monthly_mission_streak for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "own monthly streak update" on public.user_monthly_mission_streak;
create policy "own monthly streak update" on public.user_monthly_mission_streak for update to authenticated using(user_id=auth.uid());

-- 3. Robust track_mission_progress RPC
create or replace function public.track_mission_progress(p_mission_type text, p_amount int default 1) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_day int;
  r record;
  v_new_prog int;
  v_all_done boolean;
begin
  if v_uid is null then return; end if;

  -- Calculate current day of 30-day cycle
  v_day := ((extract(day from current_date)::int - 1) % 30) + 1;

  -- Ensure user monthly streak record exists
  insert into public.user_monthly_mission_streak(user_id) values(v_uid)
  on conflict (user_id) do nothing;

  -- Ensure user mission progress records exist for current day missions
  insert into public.user_daily_mission_progress(user_id, mission_id)
  select v_uid, dm.id from public.daily_missions dm where dm.day_number = v_day
  on conflict (user_id, mission_id) do nothing;

  -- Update progress for matching mission type
  for r in
    select dm.id, dm.target_count, coalesce(p.progress, 0) as cur_prog, coalesce(p.completed, false) as cur_comp
    from public.daily_missions dm
    left join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
    where dm.day_number = v_day and dm.mission_type = p_mission_type
  loop
    if not r.cur_comp then
      v_new_prog := least(r.target_count, r.cur_prog + p_amount);
      update public.user_daily_mission_progress
      set progress = v_new_prog,
          completed = (v_new_prog >= r.target_count),
          updated_at = now()
      where user_id = v_uid and mission_id = r.id;
    end if;
  end loop;

  -- Check if all 3 missions for today are now completed
  select not exists (
    select 1 from public.daily_missions dm
    left join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
    where dm.day_number = v_day and (p.completed is not true)
  ) into v_all_done;

  if v_all_done then
    -- Update completed_days count to match actual total count of fully completed days
    update public.user_monthly_mission_streak
    set completed_days = (
      select count(distinct sub.day_number)::int
      from (
        select dm.day_number
        from public.daily_missions dm
        join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
        where p.completed = true
        group by dm.day_number
        having count(distinct dm.slot) = 3
      ) sub
    ),
    updated_at = now()
    where user_id = v_uid;
  end if;
end $$;

-- 4. Claim single mission reward RPC
create or replace function public.claim_daily_mission_reward(p_mission_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_mission record;
  v_prog record;
  v_new_bal int;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  select * into v_mission from public.daily_missions where id = p_mission_id;
  if v_mission.id is null then raise exception 'Mission not found'; end if;

  select * into v_prog from public.user_daily_mission_progress where user_id = v_uid and mission_id = p_mission_id;
  if v_prog.user_id is null or v_prog.completed is not true then raise exception 'Mission is not completed yet'; end if;
  if v_prog.claimed is true then raise exception 'Reward already claimed'; end if;

  -- Mark claimed
  update public.user_daily_mission_progress set claimed = true, updated_at = now()
  where user_id = v_uid and mission_id = p_mission_id;

  -- Credit Rally Coins to Wallet
  insert into public.user_wallets(user_id, balance) values(v_uid, 500 + v_mission.reward_coins)
  on conflict (user_id) do update set balance = public.user_wallets.balance + v_mission.reward_coins returning balance into v_new_bal;

  -- Credit XP to Level
  insert into public.user_levels(user_id, xp, level) values(v_uid, v_mission.reward_xp, 1 + (v_mission.reward_xp / 250))
  on conflict (user_id) do update set
    xp = public.user_levels.xp + v_mission.reward_xp,
    level = 1 + ((public.user_levels.xp + v_mission.reward_xp) / 250);

  -- Record Coin Transaction
  insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id)
  values(v_uid, v_mission.reward_coins, 'daily_mission', 'Completed: ' || v_mission.title, p_mission_id::text)
  on conflict do nothing;

  return jsonb_build_object('success', true, 'reward_coins', v_mission.reward_coins, 'reward_xp', v_mission.reward_xp, 'new_balance', v_new_bal);
end $$;

-- 5. Claim all completed daily mission rewards at once
create or replace function public.claim_all_daily_mission_rewards() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_day int;
  r record;
  v_total_coins int := 0;
  v_total_xp int := 0;
  v_claimed_count int := 0;
  v_new_bal int;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  v_day := ((extract(day from current_date)::int - 1) % 30) + 1;

  for r in
    select dm.id, dm.title, dm.reward_coins, dm.reward_xp
    from public.daily_missions dm
    join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
    where dm.day_number = v_day and p.completed = true and p.claimed = false
  loop
    update public.user_daily_mission_progress set claimed = true, updated_at = now()
    where user_id = v_uid and mission_id = r.id;

    v_total_coins := v_total_coins + r.reward_coins;
    v_total_xp := v_total_xp + r.reward_xp;
    v_claimed_count := v_claimed_count + 1;

    insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id)
    values(v_uid, r.reward_coins, 'daily_mission', 'Completed: ' || r.title, r.id::text)
    on conflict do nothing;
  end loop;

  if v_claimed_count > 0 then
    insert into public.user_wallets(user_id, balance) values(v_uid, 500 + v_total_coins)
    on conflict (user_id) do update set balance = public.user_wallets.balance + v_total_coins returning balance into v_new_bal;

    insert into public.user_levels(user_id, xp, level) values(v_uid, v_total_xp, 1 + (v_total_xp / 250))
    on conflict (user_id) do update set
      xp = public.user_levels.xp + v_total_xp,
      level = 1 + ((public.user_levels.xp + v_total_xp) / 250);
  else
    select balance into v_new_bal from public.user_wallets where user_id = v_uid;
  end if;

  return jsonb_build_object('success', true, 'claimed_count', v_claimed_count, 'reward_coins', v_total_coins, 'reward_xp', v_total_xp, 'new_balance', coalesce(v_new_bal, 500));
end $$;

grant execute on function public.rematch_room(uuid) to authenticated;
grant execute on function public.track_mission_progress(text, int) to authenticated;
grant execute on function public.claim_daily_mission_reward(uuid) to authenticated;
grant execute on function public.claim_all_daily_mission_rewards() to authenticated;

-- 6. Claim Monthly Milestone Chest Reward RPC
create or replace function public.claim_monthly_milestone_reward(p_day int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_streak record;
  v_coins int := 0;
  v_new_bal int;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  if p_day not in (7, 14, 21, 30) then raise exception 'Invalid milestone day'; end if;

  select * into v_streak from public.user_monthly_mission_streak where user_id = v_uid;
  if v_streak.user_id is null or v_streak.completed_days < p_day then
    raise exception 'Milestone not reached yet';
  end if;

  if p_day = any(v_streak.claimed_milestones) then
    raise exception 'Milestone already claimed';
  end if;

  v_coins := case p_day
    when 7 then 500
    when 14 then 1000
    when 21 then 2000
    when 30 then 5000
  end;

  update public.user_monthly_mission_streak
  set claimed_milestones = array_append(claimed_milestones, p_day), updated_at = now()
  where user_id = v_uid;

  insert into public.user_wallets(user_id, balance) values(v_uid, 500 + v_coins)
  on conflict (user_id) do update set balance = public.user_wallets.balance + v_coins returning balance into v_new_bal;

  insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id)
  values(v_uid, v_coins, 'milestone_reward', 'Unlocked Day ' || p_day || ' Chest', p_day::text)
  on conflict do nothing;

  return jsonb_build_object('success', true, 'reward_coins', v_coins, 'new_balance', coalesce(v_new_bal, 500));
end $$;

grant execute on function public.claim_monthly_milestone_reward(int) to authenticated;

