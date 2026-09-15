-- Rally Coins: server-controlled wallet, cosmetics, inventory, and daily rewards.
create table if not exists public.user_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 500 check (balance >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0), transaction_type text not null,
  description text not null, reference_id text, created_at timestamptz not null default now(),
  unique(user_id, transaction_type, reference_id)
);
create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, description text not null,
  category text not null check(category in ('avatar','frame','banner','background','title','name_color','name_effect','badge','victory','room_theme','emote')),
  rarity text not null check(rarity in ('common','uncommon','rare','epic','legendary','mythic')), price integer not null check(price >= 0),
  asset_value text, active boolean not null default true, limited boolean not null default false, event_ends_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.user_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade, item_id uuid not null references public.shop_items(id) on delete cascade,
  acquired_at timestamptz not null default now(), primary key(user_id,item_id)
);
create table if not exists public.user_customization (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  avatar_id uuid references public.shop_items(id), frame_id uuid references public.shop_items(id), banner_id uuid references public.shop_items(id),
  background_id uuid references public.shop_items(id), title_id uuid references public.shop_items(id), name_color_id uuid references public.shop_items(id),
  name_effect_id uuid references public.shop_items(id), victory_id uuid references public.shop_items(id), room_theme_id uuid references public.shop_items(id),
  badge_ids uuid[] not null default '{}', bio text not null default '' check(char_length(bio) <= 120), updated_at timestamptz not null default now()
);
create table if not exists public.daily_rewards (
  user_id uuid primary key references public.profiles(id) on delete cascade, current_streak integer not null default 0,
  last_claim_date date, updated_at timestamptz not null default now()
);

insert into public.user_wallets(user_id,balance) select id,500 from public.profiles on conflict(user_id) do nothing;
insert into public.coin_transactions(user_id,amount,transaction_type,description,reference_id)
select id,500,'welcome','Welcome to Rally Coins','welcome' from public.profiles
on conflict(user_id,transaction_type,reference_id) do nothing;
insert into public.user_customization(user_id) select id from public.profiles on conflict(user_id) do nothing;
insert into public.daily_rewards(user_id) select id from public.profiles on conflict(user_id) do nothing;

create or replace function public.create_rally_wallet() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.user_wallets(user_id,balance) values(new.id,500) on conflict do nothing;
 insert into public.coin_transactions(user_id,amount,transaction_type,description,reference_id) values(new.id,500,'welcome','Welcome to Rally Coins','welcome') on conflict do nothing;
 insert into public.user_customization(user_id) values(new.id) on conflict do nothing;
 insert into public.daily_rewards(user_id) values(new.id) on conflict do nothing;
 return new;
end $$;
drop trigger if exists rally_wallet_for_profile on public.profiles;
create trigger rally_wallet_for_profile after insert on public.profiles for each row execute procedure public.create_rally_wallet();

alter table public.user_wallets enable row level security; alter table public.coin_transactions enable row level security; alter table public.shop_items enable row level security; alter table public.user_inventory enable row level security; alter table public.user_customization enable row level security; alter table public.daily_rewards enable row level security;
grant select on public.user_wallets,public.coin_transactions,public.shop_items,public.user_inventory,public.user_customization,public.daily_rewards to authenticated;
create policy "wallet owner reads" on public.user_wallets for select to authenticated using(user_id=(select auth.uid()));
create policy "transactions owner reads" on public.coin_transactions for select to authenticated using(user_id=(select auth.uid()));
create policy "active shop readable" on public.shop_items for select to authenticated using(active=true);
create policy "inventory owner reads" on public.user_inventory for select to authenticated using(user_id=(select auth.uid()));
create policy "customization readable" on public.user_customization for select to authenticated using(true);
create policy "daily owner reads" on public.daily_rewards for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.claim_daily_reward() returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.daily_rewards; reward int; today date:=current_date;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into r from public.daily_rewards where user_id=auth.uid() for update;
 if r.last_claim_date=today then raise exception 'Today''s reward is already claimed'; end if;
 if r.last_claim_date=today-1 then r.current_streak:=least(r.current_streak+1,7); else r.current_streak:=1; end if;
 reward:=case r.current_streak when 1 then 50 when 2 then 75 when 3 then 100 when 4 then 125 when 5 then 150 when 6 then 200 else 500 end;
 update public.daily_rewards set current_streak=r.current_streak,last_claim_date=today,updated_at=now() where user_id=auth.uid();
 update public.user_wallets set balance=balance+reward,updated_at=now() where user_id=auth.uid();
 insert into public.coin_transactions(user_id,amount,transaction_type,description,reference_id) values(auth.uid(),reward,'daily_reward','Day '||r.current_streak||' daily streak','daily:'||today);
 return jsonb_build_object('balance',(select balance from public.user_wallets where user_id=auth.uid()),'reward',reward,'streak',r.current_streak);
end $$;

create or replace function public.purchase_shop_item(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.shop_items; wallet public.user_wallets;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into item from public.shop_items where id=p_item and active=true and (event_ends_at is null or event_ends_at>now()); if item.id is null then raise exception 'Item unavailable'; end if;
 if exists(select 1 from public.user_inventory where user_id=auth.uid() and item_id=p_item) then raise exception 'Already owned'; end if;
 select * into wallet from public.user_wallets where user_id=auth.uid() for update; if wallet.balance<item.price then raise exception 'Not enough Rally Coins'; end if;
 if item.price>0 then
   update public.user_wallets set balance=balance-item.price,updated_at=now() where user_id=auth.uid();
   insert into public.coin_transactions(user_id,amount,transaction_type,description,reference_id) values(auth.uid(),-item.price,'purchase','Purchased '||item.name,item.id::text);
 end if;
 insert into public.user_inventory(user_id,item_id) values(auth.uid(),p_item);
 return jsonb_build_object('balance',wallet.balance-item.price,'item_id',item.id);
end $$;

-- Results are written by the protected game finalizer. This trigger awards
-- coins exactly once per stored player result; clients never submit amounts.
create or replace function public.reward_completed_game() returns trigger language plpgsql security definer set search_path='' as $$
declare played_added integer; win_added integer;
begin
 insert into public.coin_transactions(user_id,amount,transaction_type,description,reference_id) values(new.player_id,10,'game_completed','Completed a '||new.game_type||' game',new.id::text) on conflict do nothing;
 get diagnostics played_added=row_count;
 if played_added>0 then update public.user_wallets set balance=balance+10,updated_at=now() where user_id=new.player_id; end if;
 if new.outcome='win' then
   insert into public.coin_transactions(user_id,amount,transaction_type,description,reference_id) values(new.player_id,25,'game_win','Won a '||new.game_type||' game',new.id::text) on conflict do nothing;
   get diagnostics win_added=row_count;
   if win_added>0 then update public.user_wallets set balance=balance+25,updated_at=now() where user_id=new.player_id; end if;
 end if;
 return new;
end $$;
drop trigger if exists rally_reward_completed_game on public.game_results;
create trigger rally_reward_completed_game after insert on public.game_results for each row execute procedure public.reward_completed_game();

create or replace function public.equip_shop_item(p_item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.shop_items; badges uuid[];
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into item from public.shop_items where id=p_item and active=true; if item.id is null then raise exception 'Item unavailable'; end if;
 if item.price>0 and not exists(select 1 from public.user_inventory where user_id=auth.uid() and item_id=p_item) then raise exception 'Purchase this item first'; end if;
 insert into public.user_inventory(user_id,item_id) values(auth.uid(),p_item) on conflict do nothing;
 insert into public.user_customization(user_id) values(auth.uid()) on conflict do nothing;
 if item.category='badge' then select array(select distinct x from unnest(array_append((select badge_ids from public.user_customization where user_id=auth.uid()),p_item)) x limit 3) into badges; update public.user_customization set badge_ids=badges,updated_at=now() where user_id=auth.uid();
 else update public.user_customization set avatar_id=case when item.category='avatar' then p_item else avatar_id end,frame_id=case when item.category='frame' then p_item else frame_id end,banner_id=case when item.category='banner' then p_item else banner_id end,background_id=case when item.category='background' then p_item else background_id end,title_id=case when item.category='title' then p_item else title_id end,name_color_id=case when item.category='name_color' then p_item else name_color_id end,name_effect_id=case when item.category='name_effect' then p_item else name_effect_id end,victory_id=case when item.category='victory' then p_item else victory_id end,room_theme_id=case when item.category='room_theme' then p_item else room_theme_id end,updated_at=now() where user_id=auth.uid(); end if;
 return jsonb_build_object('equipped',p_item);
end $$;

insert into public.shop_items(slug,name,description,category,rarity,price,asset_value) values
('classic-frame','Classic Frame','A clean Rally profile frame.','frame','common',0,'classic'),('gold-frame','Gold Frame','A polished champion frame.','frame','rare',1500,'gold'),('gamer-avatar','Gamer','Ready for the next round.','avatar','common',500,'🎮'),('robot-avatar','Robot','Precision-play personality.','avatar','rare',2000,'🤖'),('galaxy-banner','Galaxy Banner','A deep-space profile banner.','banner','epic',3000,'galaxy'),('champion-title','Champion','Show your competitive spirit.','title','rare',2500,'Champion'),('gold-name','Gold Name','A golden display-name color.','name_color','rare',2000,'#ca8a04'),('fire-badge','Fire Streak','For players on a hot streak.','badge','rare',1500,'🔥'),('confetti-victory','Confetti Victory','Celebrate a win in style.','victory','uncommon',1000,'🎉'),('arcade-room','Arcade Room','Give your room an arcade glow.','room_theme','uncommon',1000,'arcade')
on conflict(slug) do nothing;
grant execute on function public.claim_daily_reward(),public.purchase_shop_item(uuid),public.equip_shop_item(uuid) to authenticated;
