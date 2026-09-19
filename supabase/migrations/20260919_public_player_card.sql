-- Full public player card for leaderboard / friends inspect views.
-- Includes all cosmetics, bio, badges, and current Rally Coins (via security definer).

create or replace function public.get_public_player_card(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  badge_list jsonb := '[]'::jsonb;
  uc public.user_customization;
begin
  if p_user is null then
    raise exception 'Player not found';
  end if;

  select * into uc from public.user_customization where user_id = p_user;

  if uc.badge_ids is not null and cardinality(uc.badge_ids) > 0 then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.name), '[]'::jsonb)
      into badge_list
      from public.shop_items s
     where s.id = any (uc.badge_ids);
  end if;

  select jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'wins', p.wins,
    'losses', p.losses,
    'draws', p.draws,
    'games_played', p.games_played,
    'xp', coalesce(ul.xp, 0),
    'level', coalesce(ul.level, 1),
    'balance', coalesce(w.balance, 500),
    'streak', coalesce(dr.current_streak, 0),
    'customization', jsonb_build_object(
      'bio', coalesce(uc.bio, 'Always ready for a rematch 🎮'),
      'status_preset', coalesce(uc.status_preset, 'Online'),
      'avatar', (select to_jsonb(s) from public.shop_items s where s.id = uc.avatar_id),
      'frame', (select to_jsonb(s) from public.shop_items s where s.id = uc.frame_id),
      'banner', (select to_jsonb(s) from public.shop_items s where s.id = uc.banner_id),
      'background', (select to_jsonb(s) from public.shop_items s where s.id = uc.background_id),
      'title', (select to_jsonb(s) from public.shop_items s where s.id = uc.title_id),
      'name_color', (select to_jsonb(s) from public.shop_items s where s.id = uc.name_color_id),
      'name_effect', (select to_jsonb(s) from public.shop_items s where s.id = uc.name_effect_id),
      'victory', (select to_jsonb(s) from public.shop_items s where s.id = uc.victory_id),
      'room_theme', (select to_jsonb(s) from public.shop_items s where s.id = uc.room_theme_id),
      'badges', badge_list
    )
  )
  into result
  from public.profiles p
  left join public.user_levels ul on ul.user_id = p.id
  left join public.user_wallets w on w.user_id = p.id
  left join public.daily_rewards dr on dr.user_id = p.id
  where p.id = p_user;

  if result is null then
    raise exception 'Player not found';
  end if;

  return result;
end;
$$;

grant execute on function public.get_public_player_card(uuid) to authenticated, anon;

-- Enrich leaderboard rows with full cosmetics + coins so list previews are accurate too.
create or replace function public.get_leaderboard(p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  xp int,
  level int,
  wins int,
  games_played int,
  balance int,
  customization jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
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
    coalesce(w.balance, 500) as balance,
    jsonb_build_object(
      'bio', coalesce(uc.bio, 'Always ready for a rematch 🎮'),
      'status_preset', coalesce(uc.status_preset, 'Online'),
      'avatar', (select to_jsonb(s) from public.shop_items s where s.id = uc.avatar_id),
      'frame', (select to_jsonb(s) from public.shop_items s where s.id = uc.frame_id),
      'banner', (select to_jsonb(s) from public.shop_items s where s.id = uc.banner_id),
      'background', (select to_jsonb(s) from public.shop_items s where s.id = uc.background_id),
      'title', (select to_jsonb(s) from public.shop_items s where s.id = uc.title_id),
      'name_color', (select to_jsonb(s) from public.shop_items s where s.id = uc.name_color_id),
      'name_effect', (select to_jsonb(s) from public.shop_items s where s.id = uc.name_effect_id),
      'victory', (select to_jsonb(s) from public.shop_items s where s.id = uc.victory_id),
      'room_theme', (select to_jsonb(s) from public.shop_items s where s.id = uc.room_theme_id),
      'badges', coalesce(
        (
          select jsonb_agg(to_jsonb(s) order by s.name)
          from public.shop_items s
          where uc.badge_ids is not null and s.id = any (uc.badge_ids)
        ),
        '[]'::jsonb
      )
    ) as customization
  from public.profiles p
  left join public.user_levels ul on ul.user_id = p.id
  left join public.user_customization uc on uc.user_id = p.id
  left join public.user_wallets w on w.user_id = p.id
  order by coalesce(ul.xp, 0) desc, p.wins desc, p.games_played desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

grant execute on function public.get_leaderboard(int) to authenticated, anon;
