"use client";

import { UserAvatar } from "./user-avatar";
import { NameDisplay } from "./name-display";
import { UserCustomizationState, UserLevelState, getBannerStyle, getBackgroundStyle } from "@/lib/customization";
import { Trophy, Gamepad2, Flame, CircleDollarSign, ShieldCheck } from "lucide-react";

interface PlayerCardProps {
  displayName: string;
  avatarUrl?: string | null;
  customization?: UserCustomizationState | null;
  levelState?: UserLevelState | null;
  wins?: number;
  gamesPlayed?: number;
  balance?: number;
  streak?: number;
  className?: string;
  compact?: boolean;
}

export function PlayerCard({
  displayName,
  avatarUrl,
  customization,
  levelState,
  wins = 0,
  gamesPlayed = 0,
  balance = 500,
  streak = 0,
  className = "",
  compact = false,
}: PlayerCardProps) {
  const bannerStyle = getBannerStyle(customization?.banner);
  const bgStyle = getBackgroundStyle(customization?.background);

  const titleText = customization?.title?.asset_value || customization?.title?.name || "Newcomer";
  const badges = customization?.badges || [];
  const bioText = customization?.bio || "Always ready for a rematch 🎮";
  const statusPreset = customization?.status_preset || "Online";

  const level = levelState?.level || 1;
  const xp = levelState?.xp || 0;
  const xpNext = level * 250;
  const xpProgress = Math.min(100, Math.round(((xp % 250) / 250) * 100));

  if (compact) {
    return (
      <div className={`relative overflow-hidden rounded-2xl border-2 border-slate-950 bg-white p-3 shadow-[3px_3px_0_#171821] ${className}`}>
        <div className="flex items-center gap-3">
          <UserAvatar
            avatarUrl={avatarUrl}
            equippedAvatar={customization?.avatar}
            equippedFrame={customization?.frame}
            fallbackName={displayName}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <NameDisplay name={displayName} nameColor={customization?.name_color} nameEffect={customization?.name_effect} className="text-sm" />
            <span className="block truncate text-[10px] font-bold text-slate-500">[{titleText}]</span>
          </div>
          {badges.length > 0 && (
            <div className="flex gap-1">
              {badges.map((b) => (
                <span key={b.id} title={b.name} className="text-sm">
                  {b.asset_value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-[28px] border-2 border-slate-950 shadow-[6px_6px_0_#171821] ${className}`} style={bgStyle}>
      {/* Banner */}
      <div className="relative h-28 w-full border-b-2 border-slate-950 p-4 transition-all" style={{ background: bannerStyle.background }}>
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full border-2 border-slate-950 bg-white/90 px-3 py-1 text-xs font-black shadow-sm">
          <CircleDollarSign size={14} className="text-amber-500" />
          <span>{balance.toLocaleString()} RC</span>
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full border-2 border-slate-950 bg-slate-950/80 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{statusPreset}</span>
        </div>
      </div>

      {/* Profile Details */}
      <div className="relative px-6 pb-6 pt-0">
        {/* Avatar centered over banner line */}
        <div className="-mt-12 flex justify-between items-end">
          <UserAvatar
            avatarUrl={avatarUrl}
            equippedAvatar={customization?.avatar}
            equippedFrame={customization?.frame}
            fallbackName={displayName}
            size="xl"
            className="shadow-xl ring-4 ring-white"
          />
          {/* Equipped Badges */}
          <div className="flex items-center gap-1.5 mb-2">
            {badges.map((badge) => (
              <span
                key={badge.id}
                title={badge.name}
                className="grid h-10 w-10 place-items-center rounded-xl border-2 border-slate-950 bg-white text-xl shadow-[2px_2px_0_#171821]"
              >
                {badge.asset_value || "🏆"}
              </span>
            ))}
          </div>
        </div>

        {/* User Info */}
        <div className="mt-4">
          <NameDisplay name={displayName} nameColor={customization?.name_color} nameEffect={customization?.name_effect} className="text-2xl font-black" />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border-2 border-slate-950 bg-[#f4dc69] px-3 py-0.5 text-xs font-black text-slate-950 shadow-[2px_2px_0_#171821]">
              [{titleText}]
            </span>
            <span className="rounded-full border-2 border-slate-950 bg-violet-600 px-3 py-0.5 text-xs font-black text-white shadow-[2px_2px_0_#171821]">
              Lvl {level}
            </span>
            {streak > 0 && (
              <span className="flex items-center gap-1 rounded-full border-2 border-slate-950 bg-orange-500 px-2.5 py-0.5 text-xs font-black text-white shadow-[2px_2px_0_#171821]">
                <Flame size={13} /> {streak} Streak
              </span>
            )}
          </div>

          <p className="mt-3 text-xs italic text-slate-600 dark:text-slate-300">&quot;{bioText}&quot;</p>
        </div>

        {/* XP Level Bar */}
        <div className="mt-5 rounded-2xl border-2 border-slate-950 bg-white p-3 shadow-[3px_3px_0_#171821]">
          <div className="flex justify-between text-xs font-black mb-1">
            <span>Rally Level {level}</span>
            <span className="text-slate-500">{xp} / {xpNext} XP</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-slate-950 bg-slate-100">
            <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border-2 border-slate-950 bg-amber-50 p-2.5 text-center shadow-[2px_2px_0_#171821]">
            <Trophy size={16} className="mx-auto text-amber-600 mb-1" />
            <strong className="block text-lg font-black">{wins}</strong>
            <span className="text-[10px] font-black uppercase text-slate-500">Wins</span>
          </div>
          <div className="rounded-2xl border-2 border-slate-950 bg-blue-50 p-2.5 text-center shadow-[2px_2px_0_#171821]">
            <Gamepad2 size={16} className="mx-auto text-blue-600 mb-1" />
            <strong className="block text-lg font-black">{gamesPlayed}</strong>
            <span className="text-[10px] font-black uppercase text-slate-500">Games</span>
          </div>
          <div className="rounded-2xl border-2 border-slate-950 bg-emerald-50 p-2.5 text-center shadow-[2px_2px_0_#171821]">
            <ShieldCheck size={16} className="mx-auto text-emerald-600 mb-1" />
            <strong className="block text-lg font-black">{gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : "0%"}</strong>
            <span className="text-[10px] font-black uppercase text-slate-500">Win Rate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
