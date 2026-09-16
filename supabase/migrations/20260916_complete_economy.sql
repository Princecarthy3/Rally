-- Rally Complete Coins, Cosmetics & Customization Schema

create table if not exists public.user_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 500 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  transaction_type text not null,
  description text not null,
  reference_id text,
  created_at timestamptz not null default now(),
  unique(user_id, transaction_type, reference_id)
);

create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category text not null check(category in ('avatar','frame','banner','background','title','name_color','name_effect','badge','victory','room_theme','emote')),
  rarity text not null check(rarity in ('common','uncommon','rare','epic','legendary','mythic')),
  price integer not null check(price >= 0),
  asset_value text,
  active boolean not null default true,
  limited boolean not null default false,
  event_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  primary key(user_id, item_id)
);

create table if not exists public.user_customization (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  avatar_id uuid references public.shop_items(id),
  frame_id uuid references public.shop_items(id),
  banner_id uuid references public.shop_items(id),
  background_id uuid references public.shop_items(id),
  title_id uuid references public.shop_items(id),
  name_color_id uuid references public.shop_items(id),
  name_effect_id uuid references public.shop_items(id),
  victory_id uuid references public.shop_items(id),
  room_theme_id uuid references public.shop_items(id),
  badge_ids uuid[] not null default '{}',
  bio text not null default '' check(char_length(bio) <= 120),
  status_preset text not null default 'Online',
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_rewards (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak integer not null default 0,
  last_claim_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_levels (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check(xp >= 0),
  level integer not null default 1 check(level >= 1),
  updated_at timestamptz not null default now()
);

-- Default provisioning triggers for new users
insert into public.user_wallets(user_id, balance) select id, 500 from public.profiles on conflict(user_id) do nothing;
insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id)
select id, 500, 'welcome', 'Welcome to Rally Coins', 'welcome' from public.profiles
on conflict(user_id, transaction_type, reference_id) do nothing;
insert into public.user_customization(user_id) select id from public.profiles on conflict(user_id) do nothing;
insert into public.daily_rewards(user_id) select id from public.profiles on conflict(user_id) do nothing;
insert into public.user_levels(user_id, xp, level) select id, 0, 1 from public.profiles on conflict(user_id) do nothing;

create or replace function public.create_rally_wallet() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.user_wallets(user_id, balance) values(new.id, 500) on conflict do nothing;
  insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id) values(new.id, 500, 'welcome', 'Welcome to Rally Coins', 'welcome') on conflict do nothing;
  insert into public.user_customization(user_id) values(new.id) on conflict do nothing;
  insert into public.daily_rewards(user_id) values(new.id) on conflict do nothing;
  insert into public.user_levels(user_id, xp, level) values(new.id, 0, 1) on conflict do nothing;
  return new;
end $$;

drop trigger if exists rally_wallet_for_profile on public.profiles;
create trigger rally_wallet_for_profile after insert on public.profiles for each row execute procedure public.create_rally_wallet();

-- Enable RLS
alter table public.user_wallets enable row level security;
alter table public.coin_transactions enable row level security;
alter table public.shop_items enable row level security;
alter table public.user_inventory enable row level security;
alter table public.user_customization enable row level security;
alter table public.daily_rewards enable row level security;
alter table public.user_levels enable row level security;

-- Policies
drop policy if exists "wallet owner reads" on public.user_wallets;
create policy "wallet owner reads" on public.user_wallets for select to authenticated using(user_id = auth.uid());

drop policy if exists "transactions owner reads" on public.coin_transactions;
create policy "transactions owner reads" on public.coin_transactions for select to authenticated using(user_id = auth.uid());

drop policy if exists "active shop readable" on public.shop_items;
create policy "active shop readable" on public.shop_items for select to authenticated using(active = true);

drop policy if exists "inventory owner reads" on public.user_inventory;
create policy "inventory owner reads" on public.user_inventory for select to authenticated using(user_id = auth.uid());

drop policy if exists "customization readable" on public.user_customization;
create policy "customization readable" on public.user_customization for select to authenticated using(true);

drop policy if exists "daily owner reads" on public.daily_rewards;
create policy "daily owner reads" on public.daily_rewards for select to authenticated using(user_id = auth.uid());

drop policy if exists "levels readable" on public.user_levels;
create policy "levels readable" on public.user_levels for select to authenticated using(true);

-- Grant Read Access
grant select on public.user_wallets, public.coin_transactions, public.shop_items, public.user_inventory, public.user_customization, public.daily_rewards, public.user_levels to authenticated;

-- RPC Functions
create or replace function public.claim_daily_reward() returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.daily_rewards; reward int; today date := current_date;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.daily_rewards where user_id = auth.uid() for update;
  if r.last_claim_date = today then raise exception 'Today''s reward is already claimed'; end if;
  if r.last_claim_date = today - 1 then r.current_streak := least(r.current_streak + 1, 7); else r.current_streak := 1; end if;
  reward := case r.current_streak when 1 then 50 when 2 then 75 when 3 then 100 when 4 then 125 when 5 then 150 when 6 then 200 else 500 end;
  update public.daily_rewards set current_streak = r.current_streak, last_claim_date = today, updated_at = now() where user_id = auth.uid();
  update public.user_wallets set balance = balance + reward, updated_at = now() where user_id = auth.uid();
  insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id) values(auth.uid(), reward, 'daily_reward', 'Day ' || r.current_streak || ' daily streak', 'daily:' || today);
  return jsonb_build_object('balance', (select balance from public.user_wallets where user_id = auth.uid()), 'reward', reward, 'streak', r.current_streak);
end $$;

create or replace function public.purchase_shop_item(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.shop_items; wallet public.user_wallets;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into item from public.shop_items where id = p_item and active = true and (event_ends_at is null or event_ends_at > now());
  if item.id is null then raise exception 'Item unavailable'; end if;
  if exists(select 1 from public.user_inventory where user_id = auth.uid() and item_id = p_item) then raise exception 'Already owned'; end if;
  select * into wallet from public.user_wallets where user_id = auth.uid() for update;
  if wallet.balance < item.price then raise exception 'Not enough Rally Coins'; end if;
  if item.price > 0 then
    update public.user_wallets set balance = balance - item.price, updated_at = now() where user_id = auth.uid();
    insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id) values(auth.uid(), -item.price, 'purchase', 'Purchased ' || item.name, item.id::text);
  end if;
  insert into public.user_inventory(user_id, item_id) values(auth.uid(), p_item);
  return jsonb_build_object('balance', wallet.balance - item.price, 'item_id', item.id);
end $$;

create or replace function public.equip_shop_item(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.shop_items; badges uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into item from public.shop_items where id = p_item and active = true;
  if item.id is null then raise exception 'Item unavailable'; end if;
  if item.price > 0 and not exists(select 1 from public.user_inventory where user_id = auth.uid() and item_id = p_item) then raise exception 'Purchase this item first'; end if;
  insert into public.user_inventory(user_id, item_id) values(auth.uid(), p_item) on conflict do nothing;
  insert into public.user_customization(user_id) values(auth.uid()) on conflict do nothing;
  
  if item.category = 'badge' then
    select array(select distinct x from unnest(array_append((select badge_ids from public.user_customization where user_id = auth.uid()), p_item)) x limit 3) into badges;
    update public.user_customization set badge_ids = badges, updated_at = now() where user_id = auth.uid();
  else
    update public.user_customization set
      avatar_id = case when item.category = 'avatar' then p_item else avatar_id end,
      frame_id = case when item.category = 'frame' then p_item else frame_id end,
      banner_id = case when item.category = 'banner' then p_item else banner_id end,
      background_id = case when item.category = 'background' then p_item else background_id end,
      title_id = case when item.category = 'title' then p_item else title_id end,
      name_color_id = case when item.category = 'name_color' then p_item else name_color_id end,
      name_effect_id = case when item.category = 'name_effect' then p_item else name_effect_id end,
      victory_id = case when item.category = 'victory' then p_item else victory_id end,
      room_theme_id = case when item.category = 'room_theme' then p_item else room_theme_id end,
      updated_at = now()
    where user_id = auth.uid();
  end if;
  return jsonb_build_object('equipped', p_item);
end $$;

create or replace function public.unequip_shop_item(p_category text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.user_customization set
    avatar_id = case when p_category = 'avatar' then null else avatar_id end,
    frame_id = case when p_category = 'frame' then null else frame_id end,
    banner_id = case when p_category = 'banner' then null else banner_id end,
    background_id = case when p_category = 'background' then null else background_id end,
    title_id = case when p_category = 'title' then null else title_id end,
    name_color_id = case when p_category = 'name_color' then null else name_color_id end,
    name_effect_id = case when p_category = 'name_effect' then null else name_effect_id end,
    victory_id = case when p_category = 'victory' then null else victory_id end,
    room_theme_id = case when p_category = 'room_theme' then null else room_theme_id end,
    badge_ids = case when p_category = 'badge' then '{}'::uuid[] else badge_ids end,
    updated_at = now()
  where user_id = auth.uid();
  return jsonb_build_object('unequipped', p_category);
end $$;

create or replace function public.update_profile_bio(p_bio text, p_status_preset text default 'Online') returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into public.user_customization(user_id, bio, status_preset)
  values(auth.uid(), left(coalesce(p_bio, ''), 120), coalesce(p_status_preset, 'Online'))
  on conflict(user_id) do update set bio = left(coalesce(p_bio, ''), 120), status_preset = coalesce(p_status_preset, 'Online'), updated_at = now();
end $$;

-- Award Game Rewards Trigger (Coins + XP)
create or replace function public.reward_completed_game() returns trigger language plpgsql security definer set search_path='' as $$
declare played_added integer; win_added integer; cur_xp integer; new_xp integer; cur_lvl integer; calc_lvl integer;
begin
  -- Coins
  insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id) values(new.player_id, 10, 'game_completed', 'Completed a ' || new.game_type || ' game', new.id::text) on conflict do nothing;
  get diagnostics played_added = row_count;
  if played_added > 0 then update public.user_wallets set balance = balance + 10, updated_at = now() where user_id = new.player_id; end if;
  
  if new.outcome = 'win' then
    insert into public.coin_transactions(user_id, amount, transaction_type, description, reference_id) values(new.player_id, 25, 'game_win', 'Won a ' || new.game_type || ' game', new.id::text) on conflict do nothing;
    get diagnostics win_added = row_count;
    if win_added > 0 then update public.user_wallets set balance = balance + 25, updated_at = now() where user_id = new.player_id; end if;
  end if;

  -- XP & Leveling (50 XP for completed, +100 XP bonus for win)
  select xp, level into cur_xp, cur_lvl from public.user_levels where user_id = new.player_id for update;
  if cur_xp is null then cur_xp := 0; cur_lvl := 1; end if;
  new_xp := cur_xp + case when new.outcome = 'win' then 150 else 50 end;
  calc_lvl := greatest(1, 1 + floor(new_xp / 250)::int);
  insert into public.user_levels(user_id, xp, level) values(new.player_id, new_xp, calc_lvl)
  on conflict(user_id) do update set xp = new_xp, level = calc_lvl, updated_at = now();

  return new;
end $$;

drop trigger if exists rally_reward_completed_game on public.game_results;
create trigger rally_reward_completed_game after insert on public.game_results for each row execute procedure public.reward_completed_game();

grant execute on function public.claim_daily_reward(), public.purchase_shop_item(uuid), public.equip_shop_item(uuid), public.unequip_shop_item(text), public.update_profile_bio(text, text) to authenticated;

-- ============================================================================
-- SEED DATA: WIDE RANGE OF COSMETICS (50+ ITEMS)
-- ============================================================================

-- FRAMES
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('classic-frame', 'Classic Frame', 'A clean, subtle border.', 'frame', 'common', 0, 'classic'),
('silver-frame', 'Silver Frame', 'Sleek metallic silver finish.', 'frame', 'uncommon', 750, 'silver'),
('gold-frame', 'Gold Frame', 'A polished golden champion frame.', 'frame', 'rare', 1500, 'gold'),
('diamond-frame', 'Diamond Frame', 'Sparkling diamond cyan border with glitter glow.', 'frame', 'epic', 3500, 'diamond'),
('fire-frame', 'Fire Frame', 'Blazing orange flame animated aura.', 'frame', 'epic', 4000, 'fire'),
('lightning-frame', 'Lightning Frame', 'Electric blue high-voltage energy ring.', 'frame', 'epic', 5000, 'lightning'),
('galaxy-frame', 'Galaxy Frame', 'Deep cosmic purple gradient with shimmering stars.', 'frame', 'legendary', 7500, 'galaxy'),
('royal-frame', 'Royal Frame', 'Opulent velvet purple and golden crown trim.', 'frame', 'legendary', 10000, 'royal'),
('cyberpunk-frame', 'Cyberpunk Frame', 'Futuristic neon yellow & cyan block border.', 'frame', 'legendary', 8000, 'cyberpunk'),
('rainbow-wave-frame', 'Rainbow Wave Frame', 'Multi-color animated rainbow aura.', 'frame', 'legendary', 12000, 'rainbow_wave'),
('legendary-frame', 'Legendary Frame', 'The ultimate glowing golden aura of a champion.', 'frame', 'mythic', 15000, 'legendary'),
('mythic-neon-frame', 'Mythic Neon Frame', 'Intense pulsing magenta and cyan neon outline.', 'frame', 'mythic', 20000, 'mythic_neon')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- AVATARS
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('gamer-avatar', 'Gamer Avatar', 'Always ready for another round.', 'avatar', 'common', 500, '🎮'),
('cool-avatar', 'Cool Sunglasses', 'Cool, calm, and collected under pressure.', 'avatar', 'common', 750, '😎'),
('robot-avatar', 'Bot 3000', 'Calculated moves and zero mistakes.', 'avatar', 'rare', 1500, '🤖'),
('alien-avatar', 'Cosmic Alien', 'Out of this world gaming skills.', 'avatar', 'rare', 2000, '👽'),
('panda-avatar', 'Panda Master', 'Chill vibes, fierce plays.', 'avatar', 'rare', 2500, '🐼'),
('fox-avatar', 'Clever Fox', 'Outsmarting opponents every step.', 'avatar', 'rare', 3000, '🦊'),
('tiger-avatar', 'Tiger Claw', 'Fierce competitor in the arena.', 'avatar', 'epic', 4500, '🐯'),
('wolf-avatar', 'Lone Wolf', 'Alpha player mentality.', 'avatar', 'epic', 5000, '🐺'),
('king-avatar', 'Royalty King', 'Commanding respect on the board.', 'avatar', 'legendary', 10000, '👑'),
('queen-avatar', 'Empress Queen', 'Dominating every game mode.', 'avatar', 'legendary', 10000, '👸'),
('flame-avatar', 'Inferno Flame', 'Burning hot streak!', 'avatar', 'epic', 6000, '🔥'),
('lightning-avatar', 'Storm Lightning', 'Fast as lightning execution.', 'avatar', 'epic', 6500, '⚡'),
('galaxy-avatar', 'Galaxy Explorer', 'Infinite possibilities.', 'avatar', 'legendary', 12000, '🌌'),
('dragon-avatar', 'Dragon Lord', 'Mythical power in your hands.', 'avatar', 'mythic', 15000, '🐲'),
('ninja-avatar', 'Shadow Ninja', 'Silent but decisive victory.', 'avatar', 'epic', 7000, '🥷'),
('wizard-avatar', 'Arcane Wizard', 'Magical strategies.', 'avatar', 'epic', 7500, '🧙'),
('superhero-avatar', 'Rally Hero', 'Saving the game in the clutch.', 'avatar', 'legendary', 11000, '🦸'),
('astronaut-avatar', 'Astro Voyager', 'Reaching for the stars.', 'avatar', 'rare', 3500, '🧑‍🚀'),
('cyberpunk-avatar', 'Cyborg 2077', 'Cybernetically augmented gamer.', 'avatar', 'legendary', 13000, '🦾'),
('lion-avatar', 'Crowned Lion', 'The true king of multiplayer.', 'avatar', 'mythic', 18000, '🦁')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- BACKGROUNDS
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('default-bg', 'Default Studio', 'Clean Rally paper aesthetic.', 'background', 'common', 0, 'default'),
('ocean-bg', 'Ocean Wave', 'Calming deep sea gradient.', 'background', 'uncommon', 1000, 'ocean'),
('sunset-bg', 'Sunset Glow', 'Warm golden twilight skies.', 'background', 'rare', 1500, 'sunset'),
('galaxy-bg', 'Galaxy Deep Space', 'Cosmic starfield backdrop.', 'background', 'epic', 3000, 'galaxy'),
('cyberpunk-bg', 'Cyberpunk Grid', 'High-tech neon grid lines.', 'background', 'epic', 4000, 'cyberpunk'),
('neon-bg', 'Neon Lights', 'Vibrant synthwave colors.', 'background', 'epic', 5000, 'neon'),
('space-bg', 'Deep Space Nebula', 'Interstellar nebula cloud.', 'background', 'legendary', 6000, 'space'),
('aurora-bg', 'Northern Aurora', 'Shimmering polar lights.', 'background', 'legendary', 7000, 'aurora'),
('volcano-bg', 'Volcanic Fire', 'Molten lava and ember heat.', 'background', 'legendary', 8000, 'volcano'),
('palace-bg', 'Royal Palace', 'Opulent gold and royal purple hall.', 'background', 'mythic', 10000, 'palace')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- BANNERS
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('classic-banner', 'Classic Banner', 'Minimalist slate header.', 'banner', 'common', 0, 'classic'),
('sunset-banner', 'Sunset Waves Banner', 'Warm evening gradient.', 'banner', 'uncommon', 2500, 'sunset'),
('neon-banner', 'Neon Pulse Banner', 'Glowing neon bar.', 'banner', 'rare', 1500, 'neon'),
('galaxy-banner', 'Galaxy Banner', 'Interstellar banner wallpaper.', 'banner', 'epic', 3000, 'galaxy'),
('ocean-banner', 'Ocean Tide Banner', 'Aquatic blue energy.', 'banner', 'rare', 4000, 'ocean'),
('fire-banner', 'Fire Ember Banner', 'Blazing fire background.', 'banner', 'epic', 4000, 'fire'),
('synth-banner', 'Retro Synth Banner', '80s synthwave horizon.', 'banner', 'epic', 4500, 'synth'),
('cyber-banner', 'Cyber Overdrive Banner', 'Futuristic matrix grid.', 'banner', 'epic', 5000, 'cyber'),
('royal-banner', 'Royal Crest Banner', 'Gold and royal velvet crest.', 'banner', 'legendary', 8000, 'royal'),
('legendary-banner', 'Legendary Aura Banner', 'Glorious golden champion banner.', 'banner', 'mythic', 15000, 'legendary')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- NAME COLORS
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('default-name-color', 'Default Slate', 'Standard crisp display name.', 'name_color', 'common', 0, 'default'),
('blue-name-color', 'Electric Blue', 'Bright neon blue display name.', 'name_color', 'common', 500, '#3b82f6'),
('purple-name-color', 'Royal Purple', 'Vibrant violet display name.', 'name_color', 'uncommon', 750, '#a855f7'),
('pink-name-color', 'Hot Pink', 'Flamboyant magenta display name.', 'name_color', 'uncommon', 750, '#ec4899'),
('emerald-name-color', 'Emerald Green', 'Lush green display name.', 'name_color', 'rare', 1000, '#10b981'),
('crimson-name-color', 'Crimson Red', 'Fiery red display name.', 'name_color', 'rare', 1500, '#ef4444'),
('gold-name-color', 'Gold Champion', 'Shimmering metallic gold display name.', 'name_color', 'rare', 2000, '#eab308'),
('diamond-name-color', 'Diamond Cyan', 'Glittering cyan display name.', 'name_color', 'epic', 3500, '#06b6d4'),
('rainbow-name-color', 'Rainbow Prism', 'Animated multi-color gradient name.', 'name_color', 'legendary', 5000, 'rainbow')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- NAME EFFECTS
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('sparkle-name-effect', '✨ Sparkle Effect', 'Shimmering magic sparkles around your name.', 'name_effect', 'rare', 1500, 'sparkle'),
('flame-name-effect', '🔥 Flame Effect', 'Fiery aura flickering on your name.', 'name_effect', 'epic', 2500, 'flame'),
('lightning-name-effect', '⚡ Lightning Effect', 'Electric sparks zapping around your name.', 'name_effect', 'epic', 3500, 'lightning'),
('rainbow-name-effect', '🌈 Rainbow Effect', 'Prismatic wave flowing across your name.', 'name_effect', 'legendary', 5000, 'rainbow'),
('diamond-name-effect', '💎 Diamond Effect', 'Glittering diamond shines on your name.', 'name_effect', 'legendary', 7500, 'diamond'),
('royal-name-effect', '👑 Royal Crown Effect', 'Golden crown floating above your display name.', 'name_effect', 'mythic', 10000, 'royal')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- TITLES
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('newcomer-title', 'Newcomer', 'Welcome to the Rally arena.', 'title', 'common', 0, 'Newcomer'),
('gamer-title', 'Gamer', 'Dedicated player.', 'title', 'common', 500, 'Gamer'),
('challenger-title', 'Challenger', 'Always looking for a match.', 'title', 'uncommon', 1000, 'Challenger'),
('champion-title', 'Champion', 'Proven winner in combat.', 'title', 'rare', 2500, 'Champion'),
('elite-title', 'Elite', 'Top tier player skills.', 'title', 'epic', 5000, 'Elite'),
('legend-title', 'Legend', 'A household name on Rally.', 'title', 'legendary', 10000, 'Legend'),
('royalty-title', 'Rally Royalty', 'Supreme ruler of the leaderboards.', 'title', 'mythic', 20000, 'Rally Royalty'),
('century-champion-title', 'Century Champion', 'Won 100 total games.', 'title', 'legendary', 0, 'Century Champion'),
('speed-demon-title', 'Speed Demon', 'Lightning fast decision maker.', 'title', 'rare', 3000, 'Speed Demon'),
('undefeated-title', 'Undefeated', 'Holding a massive winning streak.', 'title', 'epic', 6000, 'Undefeated')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- BADGES
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('gamer-badge', 'Gamer Badge', 'Dedicated gamer badge.', 'badge', 'common', 500, '🎮'),
('champion-badge', 'Trophy Badge', 'Trophy of victory.', 'badge', 'rare', 1000, '🏆'),
('fire-badge', 'Fire Streak Badge', 'For players on a hot streak.', 'badge', 'rare', 1500, '🔥'),
('speedster-badge', 'Speedster Badge', 'Fast reactions badge.', 'badge', 'rare', 1500, '⚡'),
('veteran-badge', 'Veteran Badge', 'Seasoned veteran player.', 'badge', 'epic', 3000, '👑'),
('elite-badge', 'Elite Diamond Badge', 'Diamond rank competitor.', 'badge', 'epic', 4000, '💎'),
('supporter-badge', 'Early Supporter', 'Joined Rally in early days.', 'badge', 'legendary', 5000, '🌟'),
('sharpshooter-badge', 'Sharpshooter', 'Precision accuracy in games.', 'badge', 'epic', 3500, '🎯'),
('team-player-badge', 'Team Player', 'Great teammate in party games.', 'badge', 'uncommon', 1000, '🤝'),
('mastermind-badge', 'Mastermind', 'Strategic genius badge.', 'badge', 'legendary', 6000, '🧠'),
('high-roller-badge', 'High Roller', 'Big coin collector.', 'badge', 'legendary', 8000, '🎰'),
('mvp-badge', 'MVP Gold Medal', 'Most Valuable Player.', 'badge', 'mythic', 10000, '🥇')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- ROOM THEMES
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('classic-room', 'Classic Studio Room', 'Clean paper style room.', 'room_theme', 'common', 0, 'classic'),
('arcade-room', 'Arcade Glow Room', 'Retro arcade cabinet aesthetic.', 'room_theme', 'uncommon', 1000, 'arcade'),
('neon-room', 'Neon Synthwave Room', 'Vibrant neon grid canvas.', 'room_theme', 'rare', 2000, 'neon'),
('space-room', 'Deep Space Room', 'Cosmic stars surrounding the board.', 'room_theme', 'rare', 3000, 'space'),
('galaxy-room', 'Galaxy Nebula Room', 'Swirling galaxy dust background.', 'room_theme', 'epic', 4000, 'galaxy'),
('fire-room', 'Inferno Fire Room', 'Embers and flames around the arena.', 'room_theme', 'epic', 4000, 'fire'),
('cyberpunk-room', 'Cyberpunk Matrix Room', 'High tech cyan matrix arena.', 'room_theme', 'epic', 5000, 'cyberpunk'),
('royal-room', 'Royal Throne Room', 'Luxurious gold trim and velvet carpet.', 'room_theme', 'legendary', 7500, 'royal'),
('legendary-room', 'Legendary Stadium', 'Colossal arena with energetic crowd lights.', 'room_theme', 'mythic', 12000, 'legendary')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- VICTORY ANIMATIONS
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('classic-victory', 'Classic Cheer', 'Simple win celebration.', 'victory', 'common', 0, 'classic'),
('confetti-victory', 'Confetti Burst', 'Colorful party confetti rains down.', 'victory', 'uncommon', 1000, 'confetti'),
('fireworks-victory', 'Fireworks Display', 'Spectacular fireworks burst on screen.', 'victory', 'rare', 2500, 'fireworks'),
('lightning-victory', 'Storm Lightning', 'Thunder strikes celebrate your victory.', 'victory', 'epic', 4000, 'lightning'),
('flame-victory', 'Dragon Flame', 'Columns of fire ignite to honor your win.', 'victory', 'epic', 5000, 'flame'),
('crown-victory', 'Golden Crown Drop', 'A majestic golden crown descends.', 'victory', 'legendary', 7500, 'crown'),
('galaxy-victory', 'Galaxy Explosion', 'Cosmic supernova explodes across the screen.', 'victory', 'legendary', 10000, 'galaxy'),
('legendary-victory', 'Legendary Triumph', 'Gold trophies, confetti, and fireworks rain down.', 'victory', 'mythic', 20000, 'legendary')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- EMOTES
insert into public.shop_items(slug, name, description, category, rarity, price, asset_value) values
('laugh-emote', 'Laughing 😂', 'Crying with laughter emote.', 'emote', 'common', 0, '😂'),
('cry-emote', 'Crying 😭', 'Lamenting a close loss.', 'emote', 'common', 0, '😭'),
('skull-emote', 'Dead 💀', 'Dead from funny moment.', 'emote', 'common', 0, '💀'),
('angry-emote', 'Angry 😤', 'Frustrated reaction.', 'emote', 'common', 0, '😤'),
('gg-emote', 'Good Game 🤝', 'Handshake sportsmanship.', 'emote', 'common', 0, '🤝'),
('respect-emote', 'Respect 😎', 'Sunglasses salute.', 'emote', 'common', 0, '😎'),
('fire-emote', 'Animated Fire 🔥', 'Burning hot play emote.', 'emote', 'uncommon', 500, '🔥'),
('clap-emote', 'Applause 👏', 'Clapping for a great move.', 'emote', 'uncommon', 500, '👏'),
('eyes-emote', 'Eyes Watching 👀', 'Keeping an eye on you.', 'emote', 'uncommon', 500, '👀'),
('shocked-emote', 'Shocked 😱', 'Mind blown reaction.', 'emote', 'uncommon', 500, '😱'),
('heart-emote', 'Love Heart ❤️', 'Showing love to opponent.', 'emote', 'rare', 750, '❤️'),
('trophy-emote', 'Animated Crown 👑', 'Flexing victory crown.', 'emote', 'rare', 1000, '👑')
on conflict(slug) do update set name=excluded.name, description=excluded.description, category=excluded.category, rarity=excluded.rarity, price=excluded.price, asset_value=excluded.asset_value;

-- Auto-grant all free (0 RC) default items to existing profiles
insert into public.user_inventory(user_id, item_id)
select p.id, s.id from public.profiles p cross join public.shop_items s where s.price = 0
on conflict do nothing;

-- Leaderboard RPC function: ranks all signed-up players by XP
create or replace function public.get_leaderboard(p_limit int default 50) returns table(
  user_id uuid,
  display_name text,
  avatar_url text,
  xp int,
  level int,
  wins int,
  games_played int,
  customization jsonb
) language plpgsql security definer set search_path='' as $$
begin
  return query
  select
    p.id as user_id,
    p.display_name,
    p.avatar_url,
    coalesce(ul.xp, 0) as xp,
    coalesce(ul.level, 1) as level,
    p.wins,
    p.games_played,
    jsonb_build_object(
      'avatar', (select to_jsonb(s) from public.shop_items s where s.id = uc.avatar_id),
      'frame', (select to_jsonb(s) from public.shop_items s where s.id = uc.frame_id),
      'title', (select to_jsonb(s) from public.shop_items s where s.id = uc.title_id),
      'name_color', (select to_jsonb(s) from public.shop_items s where s.id = uc.name_color_id),
      'name_effect', (select to_jsonb(s) from public.shop_items s where s.id = uc.name_effect_id)
    ) as customization
  from public.profiles p
  left join public.user_levels ul on ul.user_id = p.id
  left join public.user_customization uc on uc.user_id = p.id
  order by coalesce(ul.xp, 0) desc, p.wins desc, p.games_played desc
  limit p_limit;
end $$;

grant execute on function public.get_leaderboard(int) to authenticated, anon;

