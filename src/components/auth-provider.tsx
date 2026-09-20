"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sounds } from "@/lib/audio";
import { ShopItem, UserCustomizationState, UserLevelState } from "@/lib/customization";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  customization: UserCustomizationState | null;
  balance: number;
  streak: number;
  levelState: UserLevelState | null;
  refreshProfile: () => Promise<void>;
  refreshCustomization: () => Promise<void>;
  equipItem: (itemId: string) => Promise<boolean>;
  unequipCategory: (category: string) => Promise<boolean>;
  claimDaily: () => Promise<{ balance: number; reward: number; streak: number } | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customization, setCustomization] = useState<UserCustomizationState | null>(null);
  const [balance, setBalance] = useState<number>(500);
  const [streak, setStreak] = useState<number>(0);
  const [levelState, setLevelState] = useState<UserLevelState | null>({ xp: 0, level: 1 });
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const supabase = getSupabaseBrowserClient();

  const loadUserData = useCallback(async (userId?: string) => {
    if (!supabase || !userId) {
      setProfile(null);
      setCustomization(null);
      setBalance(500);
      setStreak(0);
      setLevelState({ xp: 0, level: 1 });
      return;
    }

    try {
      const [profRes, custRes, walletRes, streakRes, levelRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, games_played, wins, losses, draws, created_at").eq("id", userId).maybeSingle(),
        supabase.from("user_customization").select(`
          bio, status_preset, badge_ids,
          avatar:avatar_id(*), frame:frame_id(*), banner:banner_id(*), background:background_id(*),
          title:title_id(*), name_color:name_color_id(*), name_effect:name_effect_id(*),
          victory:victory_id(*), room_theme:room_theme_id(*)
        `).eq("user_id", userId).maybeSingle(),
        supabase.from("user_wallets").select("balance").eq("user_id", userId).maybeSingle(),
        supabase.from("daily_rewards").select("current_streak").eq("user_id", userId).maybeSingle(),
        supabase.from("user_levels").select("xp, level").eq("user_id", userId).maybeSingle(),
      ]);

      setProfile(profRes.data as Profile | null);
      setBalance(walletRes.data?.balance ?? 500);
      setStreak(streakRes.data?.current_streak ?? 0);
      setLevelState(levelRes.data as UserLevelState | null ?? { xp: 0, level: 1 });

      if (custRes.data) {
        let badgeItems: ShopItem[] = [];
        if (custRes.data.badge_ids && custRes.data.badge_ids.length > 0) {
          const { data: bData } = await supabase.from("shop_items").select("*").in("id", custRes.data.badge_ids);
          badgeItems = (bData || []) as ShopItem[];
        }

        setCustomization({
          avatar: (custRes.data.avatar as unknown as ShopItem) || null,
          frame: (custRes.data.frame as unknown as ShopItem) || null,
          banner: (custRes.data.banner as unknown as ShopItem) || null,
          background: (custRes.data.background as unknown as ShopItem) || null,
          title: (custRes.data.title as unknown as ShopItem) || null,
          name_color: (custRes.data.name_color as unknown as ShopItem) || null,
          name_effect: (custRes.data.name_effect as unknown as ShopItem) || null,
          victory: (custRes.data.victory as unknown as ShopItem) || null,
          room_theme: (custRes.data.room_theme as unknown as ShopItem) || null,
          badges: badgeItems,
          bio: custRes.data.bio || "",
          status_preset: custRes.data.status_preset || "Online",
        });
      }
    } catch (e) {
      console.error("Error loading profile/customization data:", e);
    }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadUserData(data.session?.user.id);
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      queueMicrotask(() => loadUserData(nextSession?.user.id));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserData, supabase]);

  const userId = session?.user.id;
  const refreshProfile = useCallback(async () => loadUserData(userId), [loadUserData, userId]);
  const refreshCustomization = useCallback(async () => loadUserData(userId), [loadUserData, userId]);

  const equipItem = useCallback(
    async (itemId: string) => {
      if (!supabase || !userId) return false;
      const { error } = await supabase.rpc("equip_shop_item", { p_item: itemId });
      if (!error) {
        await loadUserData(userId);
        return true;
      }
      return false;
    },
    [loadUserData, userId, supabase]
  );

  const unequipCategory = useCallback(
    async (category: string) => {
      if (!supabase || !userId) return false;
      const { error } = await supabase.rpc("unequip_shop_item", { p_category: category });
      if (!error) {
        await loadUserData(userId);
        return true;
      }
      return false;
    },
    [loadUserData, userId, supabase]
  );

  const claimDaily = useCallback(async () => {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase.rpc("claim_daily_reward");
    if (!error && data) {
      await loadUserData(userId);
      return data as { balance: number; reward: number; streak: number };
    }
    return null;
  }, [loadUserData, userId, supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setProfile(null);
    setCustomization(null);
  }, [supabase]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user: session?.user ?? null,
      session,
      profile,
      customization,
      balance,
      streak,
      levelState,
      refreshProfile,
      refreshCustomization,
      equipItem,
      unequipCategory,
      claimDaily,
      signOut,
    }),
    [
      loading,
      profile,
      customization,
      balance,
      streak,
      levelState,
      refreshProfile,
      refreshCustomization,
      equipItem,
      unequipCategory,
      claimDaily,
      session,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
