-- Spectator Mode and 30-Day Daily Missions Migration

-- 1. Spectator Mode Tables and RPCs
create table if not exists public.game_spectators (
  room_id uuid references public.game_rooms(id) on delete cascade,
  spectator_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(room_id, spectator_id)
);

alter table public.game_spectators enable row level security;

-- Update RLS helper function so spectators have SELECT access to room and player state
create or replace function public.is_room_member(p_room uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.game_players where room_id=p_room and player_id=auth.uid())
     or exists(select 1 from public.game_spectators where room_id=p_room and spectator_id=auth.uid());
$$;

drop policy if exists "members read spectators" on public.game_spectators;
create policy "members read spectators" on public.game_spectators for select to authenticated using(public.is_room_member(room_id));

grant select on public.game_spectators to authenticated;

-- Spectate Room RPC
create or replace function public.spectate_game_room(p_code text) returns text language plpgsql security definer set search_path='' as $$
declare v_room uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select id into v_room from public.game_rooms where code=upper(trim(p_code));
  if v_room is null then raise exception 'Room not found'; end if;
  
  insert into public.game_spectators(room_id, spectator_id)
  values(v_room, auth.uid())
  on conflict(room_id, spectator_id) do update set joined_at = now();
  
  return upper(trim(p_code));
end $$;

-- Leave Spectator Room RPC
create or replace function public.leave_spectator_room(p_code text) returns void language plpgsql security definer set search_path='' as $$
declare v_room uuid;
begin
  if auth.uid() is null then return; end if;
  select id into v_room from public.game_rooms where code=upper(trim(p_code));
  if v_room is not null then
    delete from public.game_spectators where room_id=v_room and spectator_id=auth.uid();
  end if;
end $$;

-- Get Active Friend Rooms RPC (For spectating friends)
create or replace function public.get_active_friend_rooms() returns table (
  room_code text,
  game_type text,
  status text,
  host_id uuid,
  host_name text,
  host_avatar text,
  player_count int,
  max_players int
) language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return; end if;
  return query
  select distinct
    r.code,
    r.game_type,
    r.status,
    r.host_id,
    p.display_name,
    p.avatar_url,
    (select count(*)::int from public.game_players gp where gp.room_id=r.id),
    r.max_players
  from public.game_rooms r
  join public.profiles p on p.id=r.host_id
  join public.friends f on (f.user_id=auth.uid() and f.friend_id=r.host_id) or (f.friend_id=auth.uid() and f.user_id=r.host_id)
  where f.status='accepted'
    and r.status in ('waiting','playing')
    and r.expires_at > now();
end $$;

grant execute on function public.spectate_game_room(text) to authenticated;
grant execute on function public.leave_spectator_room(text) to authenticated;
grant execute on function public.get_active_friend_rooms() to authenticated;


-- 2. Daily Missions & 30-Day Monthly Pass Tables
create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  day_number int not null check(day_number between 1 and 30),
  slot int not null check(slot between 1 and 3),
  title text not null,
  description text not null,
  target_count int not null default 1,
  reward_coins int not null default 50,
  reward_xp int not null default 25,
  mission_type text not null check(mission_type in ('play_game','win_game','send_message','invite_friend','claim_reward')),
  unique(day_number, slot)
);

create table if not exists public.user_daily_mission_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  mission_id uuid references public.daily_missions(id) on delete cascade,
  progress int not null default 0,
  completed boolean not null default false,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id, mission_id)
);

create table if not exists public.user_monthly_mission_streak (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  start_date date not null default current_date,
  completed_days int not null default 0,
  claimed_milestones int[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.daily_missions enable row level security;
alter table public.user_daily_mission_progress enable row level security;
alter table public.user_monthly_mission_streak enable row level security;

create policy "anyone read daily missions" on public.daily_missions for select to authenticated using(true);
create policy "own progress" on public.user_daily_mission_progress for select to authenticated using(user_id=auth.uid());
create policy "own monthly streak" on public.user_monthly_mission_streak for select to authenticated using(user_id=auth.uid());

grant select on public.daily_missions, public.user_daily_mission_progress, public.user_monthly_mission_streak to authenticated;

-- Seed 30 Days of Daily Missions (3 missions per day = 90 total)
do $$
declare d int;
begin
  for d in 1..30 loop
    insert into public.daily_missions(day_number, slot, title, description, target_count, reward_coins, reward_xp, mission_type)
    values
      (d, 1, 'Warm Up - Day ' || d, 'Play 1 multiplayer mini game', 1, 50 + (d * 5), 25 + d, 'play_game'),
      (d, 2, 'Chatterbox - Day ' || d, 'Send 2 room or friend messages', 2, 60 + (d * 5), 30 + d, 'send_message'),
      (d, 3, 'Victory Streak - Day ' || d, 'Win 1 match or round', 1, 100 + (d * 10), 50 + (d * 2), 'win_game')
    on conflict (day_number, slot) do update set
      title = excluded.title,
      description = excluded.description,
      reward_coins = excluded.reward_coins,
      reward_xp = excluded.reward_xp;
  end loop;
end $$;

-- RPC: Fetch User Daily Missions & Monthly Streak Progress
create or replace function public.get_user_daily_missions() returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_day int;
  v_streak record;
  v_missions jsonb;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;

  -- Calculate current day of 30-day month cycle based on day of month
  v_day := ((extract(day from current_date)::int - 1) % 30) + 1;

  -- Ensure user monthly streak record exists
  insert into public.user_monthly_mission_streak(user_id) values(v_uid)
  on conflict (user_id) do nothing;

  select * into v_streak from public.user_monthly_mission_streak where user_id = v_uid;

  -- Ensure progress records exist for current day missions
  insert into public.user_daily_mission_progress(user_id, mission_id)
  select v_uid, dm.id from public.daily_missions dm where dm.day_number = v_day
  on conflict (user_id, mission_id) do nothing;

  -- Aggregate current day missions with progress
  select jsonb_agg(
    jsonb_build_object(
      'id', dm.id,
      'day_number', dm.day_number,
      'slot', dm.slot,
      'title', dm.title,
      'description', dm.description,
      'target_count', dm.target_count,
      'reward_coins', dm.reward_coins,
      'reward_xp', dm.reward_xp,
      'mission_type', dm.mission_type,
      'progress', coalesce(p.progress, 0),
      'completed', coalesce(p.completed, false),
      'claimed', coalesce(p.claimed, false)
    ) order by dm.slot
  ) into v_missions
  from public.daily_missions dm
  left join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
  where dm.day_number = v_day;

  return jsonb_build_object(
    'current_day', v_day,
    'completed_days', v_streak.completed_days,
    'claimed_milestones', coalesce(v_streak.claimed_milestones, '{}'::int[]),
    'missions', coalesce(v_missions, '[]'::jsonb)
  );
end $$;

-- RPC: Track Mission Progress for actions (play_game, win_game, send_message, invite_friend)
create or replace function public.track_mission_progress(p_mission_type text, p_amount int default 1) returns void language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_day int;
  r record;
  v_new_prog int;
  v_all_done boolean;
begin
  if v_uid is null then return; end if;
  v_day := ((extract(day from current_date)::int - 1) % 30) + 1;

  for r in
    select dm.id, dm.target_count, coalesce(p.progress, 0) as cur_prog, coalesce(p.completed, false) as cur_comp
    from public.daily_missions dm
    left join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
    where dm.day_number = v_day and dm.mission_type = p_mission_type
  loop
    if not r.cur_comp then
      v_new_prog := least(r.target_count, r.cur_prog + p_amount);
      insert into public.user_daily_mission_progress(user_id, mission_id, progress, completed, updated_at)
      values (v_uid, r.id, v_new_prog, v_new_prog >= r.target_count, now())
      on conflict (user_id, mission_id) do update set
        progress = excluded.progress,
        completed = (excluded.progress >= r.target_count),
        updated_at = now();
    end if;
  end loop;

  -- Check if all 3 missions for today are now completed
  select not exists (
    select 1 from public.daily_missions dm
    left join public.user_daily_mission_progress p on p.mission_id = dm.id and p.user_id = v_uid
    where dm.day_number = v_day and (p.completed is not true)
  ) into v_all_done;

  if v_all_done then
    insert into public.user_monthly_mission_streak(user_id, completed_days)
    values (v_uid, 1)
    on conflict (user_id) do update set
      completed_days = greatest(user_monthly_mission_streak.completed_days, v_day),
      updated_at = now();
  end if;
end $$;

-- RPC: Claim Daily Mission Reward
create or replace function public.claim_daily_mission_reward(p_mission_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if v_prog.completed is not true then raise exception 'Mission is not completed yet'; end if;
  if v_prog.claimed is true then raise exception 'Reward already claimed'; end if;

  -- Mark claimed
  update public.user_daily_mission_progress set claimed = true, updated_at = now()
  where user_id = v_uid and mission_id = p_mission_id;

  -- Add Rally Coins to Wallet
  insert into public.user_wallets(user_id, balance) values(v_uid, 500 + v_mission.reward_coins)
  on conflict (user_id) do update set balance = user_wallets.balance + v_mission.reward_coins returning balance into v_new_bal;

  -- Add XP to Level
  insert into public.user_levels(user_id, xp, level) values(v_uid, v_mission.reward_xp, 1 + (v_mission.reward_xp / 250))
  on conflict (user_id) do update set
    xp = user_levels.xp + v_mission.reward_xp,
    level = 1 + ((user_levels.xp + v_mission.reward_xp) / 250);

  return jsonb_build_object('success', true, 'reward_coins', v_mission.reward_coins, 'reward_xp', v_mission.reward_xp, 'new_balance', v_new_bal);
end $$;

-- RPC: Claim Monthly Milestone Chest Reward (Days 7, 14, 21, 30)
create or replace function public.claim_monthly_milestone_reward(p_day int) returns jsonb language plpgsql security definer set search_path='' as $$
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
  on conflict (user_id) do update set balance = user_wallets.balance + v_coins returning balance into v_new_bal;

  return jsonb_build_object('success', true, 'milestone_day', p_day, 'reward_coins', v_coins, 'new_balance', v_new_bal);
end $$;

grant execute on function public.get_user_daily_missions() to authenticated;
grant execute on function public.track_mission_progress(text, int) to authenticated;
grant execute on function public.claim_daily_mission_reward(uuid) to authenticated;
grant execute on function public.claim_monthly_milestone_reward(int) to authenticated;
