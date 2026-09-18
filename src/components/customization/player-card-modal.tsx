"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PlayerCard } from "./player-card";
import { ShopItem, UserCustomizationState, UserLevelState } from "@/lib/customization";
import { X, Loader2 } from "lucide-react";

interface PlayerCardModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  fallbackDisplayName?: string;
  fallbackAvatarUrl?: string | null;
}

export function PlayerCardModal({
  userId,
  isOpen,
  onClose,
  fallbackDisplayName = "Player",
  fallbackAvatarUrl = null,
}: PlayerCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(fallbackDisplayName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(fallbackAvatarUrl);
  const [wins, setWins] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [balance, setBalance] = useState(500);
  const [streak, setStreak] = useState(0);
  const [customization, setCustomization] = useState<UserCustomizationState | null>(null);
  const [levelState, setLevelState] = useState<UserLevelState | null>({ xp: 0, level: 1 });

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!isOpen || !userId || !supabase) return;

    let active = true;
    const client = supabase;

    async function loadFullProfile() {
      if (active) setLoading(true);
      try {
        const [profRes, custRes, walletRes, streakRes, levelRes] = await Promise.all([
          client.from("profiles").select("display_name, avatar_url, games_played, wins").eq("id", userId!).maybeSingle(),
          client.from("user_customization").select(`
            bio, status_preset, badge_ids,
            avatar:avatar_id(*), frame:frame_id(*), banner:banner_id(*), background:background_id(*),
            title:title_id(*), name_color:name_color_id(*), name_effect:name_effect_id(*),
            victory:victory_id(*), room_theme:room_theme_id(*)
          `).eq("user_id", userId!).maybeSingle(),
          client.from("user_wallets").select("balance").eq("user_id", userId!).maybeSingle(),
          client.from("daily_rewards").select("current_streak").eq("user_id", userId!).maybeSingle(),
          client.from("user_levels").select("xp, level").eq("user_id", userId!).maybeSingle(),
        ]);

        if (!active) return;

        if (profRes.data) {
          setDisplayName(profRes.data.display_name || fallbackDisplayName);
          setAvatarUrl(profRes.data.avatar_url || fallbackAvatarUrl);
          setWins(profRes.data.wins || 0);
          setGamesPlayed(profRes.data.games_played || 0);
        } else {
          setDisplayName(fallbackDisplayName);
          setAvatarUrl(fallbackAvatarUrl);
        }

        setBalance(walletRes.data?.balance ?? 500);
        setStreak(streakRes.data?.current_streak ?? 0);
        setLevelState((levelRes.data as UserLevelState) || { xp: 0, level: 1 });

        if (custRes.data) {
          let badgeItems: ShopItem[] = [];
          if (custRes.data.badge_ids && custRes.data.badge_ids.length > 0) {
            const { data: bData } = await client.from("shop_items").select("*").in("id", custRes.data.badge_ids);
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
            bio: custRes.data.bio || "Always ready for a rematch 🎮",
            status_preset: custRes.data.status_preset || "Online",
          });
        } else {
          setCustomization(null);
        }
      } catch (err) {
        console.error("Failed to load player profile card:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFullProfile();

    return () => {
      active = false;
    };
  }, [isOpen, userId, supabase, fallbackDisplayName, fallbackAvatarUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border-2 border-slate-950 bg-white shadow-2xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-20 grid h-9 w-9 place-items-center rounded-full border-2 border-slate-950 bg-white/90 text-slate-900 shadow-md hover:bg-slate-100 transition-all cursor-pointer"
        >
          <X size={18} />
        </button>

        {loading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 p-8">
            <Loader2 size={36} className="animate-spin text-amber-500" />
            <p className="text-sm font-black text-slate-600">Fetching Player Card...</p>
          </div>
        ) : (
          <PlayerCard
            displayName={displayName}
            avatarUrl={avatarUrl}
            customization={customization}
            levelState={levelState}
            wins={wins}
            gamesPlayed={gamesPlayed}
            balance={balance}
            streak={streak}
          />
        )}
      </div>
    </div>
  );
}
