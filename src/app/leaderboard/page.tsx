"use client";

import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/protected-page";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/customization/user-avatar";
import { NameDisplay } from "@/components/customization/name-display";
import { ShopItem } from "@/lib/customization";
import { PlayerCard } from "@/components/customization/player-card";
import { Trophy, Gamepad2, Sparkles, LoaderCircle, Award, X, Eye } from "lucide-react";

type LeaderboardUser = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  wins: number;
  games_played: number;
  customization?: {
    avatar?: ShopItem | null;
    frame?: ShopItem | null;
    banner?: ShopItem | null;
    background?: ShopItem | null;
    title?: ShopItem | null;
    name_color?: ShopItem | null;
    name_effect?: ShopItem | null;
    badges?: ShopItem[];
    bio?: string;
    status_preset?: string;
  } | null;
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);

  useEffect(() => {
    let active = true;
    async function loadLeaderboard() {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;

      const { data, error } = await sb.rpc("get_leaderboard", { p_limit: 50 });

      if (active) {
        if (!error && data) {
          setLeaderboard(data as LeaderboardUser[]);
        } else {
          // Fallback query if RPC not yet run
          const { data: levels } = await sb
            .from("user_levels")
            .select("user_id, xp, level, profile:profiles(display_name, avatar_url, wins, games_played)")
            .order("xp", { ascending: false })
            .limit(50);

          if (levels) {
            const mapped: LeaderboardUser[] = levels.map((l) => ({
              user_id: l.user_id,
              display_name: (l.profile as any)?.display_name || "Player",
              avatar_url: (l.profile as any)?.avatar_url || null,
              xp: l.xp,
              level: l.level,
              wins: (l.profile as any)?.wins || 0,
              games_played: (l.profile as any)?.games_played || 0,
            }));
            setLeaderboard(mapped);
          }
        }
        setLoading(false);
      }
    }

    void loadLeaderboard();
    return () => {
      active = false;
    };
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <ProtectedPage>
      <main className="min-h-screen bg-[#fffdf7] pb-28">
        {/* Banner */}
        <section className="border-b-2 border-slate-950 bg-[#f4dc69]">
          <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
            <p className="eyebrow">Rally Global Rankings</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-[-.06em]">🏆 XP Leaderboard</h1>
                <p className="mt-2 text-slate-800 font-medium">
                  Rankings based on XP earned from playing and winning games across Rally.
                </p>
              </div>
              <div className="rounded-2xl border-2 border-slate-950 bg-white px-5 py-3 shadow-[4px_4px_0_#171821]">
                <span className="text-[10px] font-black uppercase text-slate-500">Registered Players</span>
                <p className="text-2xl font-black">{leaderboard.length} Ranked</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
          {loading ? (
            <div className="grid min-h-[40vh] place-items-center">
              <div className="text-center">
                <LoaderCircle className="mx-auto animate-spin text-[#7357ff]" size={36} />
                <p className="mt-3 text-sm font-black">Loading Global XP Rankings...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Podium Top 3 */}
              {top3.length > 0 && (
                <div className="mb-12">
                  <p className="mb-6 text-center text-xs font-black uppercase tracking-widest text-violet-600">
                    The Champions Podium (Click card to view profile)
                  </p>
                  <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
                    {/* #2 Silver */}
                    {top3[1] && (
                      <PodiumCard
                        user={top3[1]}
                        rank={2}
                        color="bg-slate-200"
                        titleBadge="🥈 2nd Place"
                        isMe={top3[1].user_id === user?.id}
                        onSelect={() => setSelectedUser(top3[1])}
                      />
                    )}

                    {/* #1 Gold */}
                    {top3[0] && (
                      <PodiumCard
                        user={top3[0]}
                        rank={1}
                        color="bg-[#f4dc69]"
                        titleBadge="👑 1st Champion"
                        isMe={top3[0].user_id === user?.id}
                        isFirst
                        onSelect={() => setSelectedUser(top3[0])}
                      />
                    )}

                    {/* #3 Bronze */}
                    {top3[2] && (
                      <PodiumCard
                        user={top3[2]}
                        rank={3}
                        color="bg-amber-100"
                        titleBadge="🥉 3rd Place"
                        isMe={top3[2].user_id === user?.id}
                        onSelect={() => setSelectedUser(top3[2])}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Full Rankings Table */}
              <section className="rounded-[28px] border-2 border-slate-950 bg-white p-6 shadow-[6px_6px_0_#171821]">
                <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4 mb-4">
                  <h2 className="text-xl font-black text-slate-950">Global XP Rankings</h2>
                  <span className="text-xs font-bold text-slate-600">Click any player to view profile</span>
                </div>

                <div className="divide-y-2 divide-slate-100">
                  {leaderboard.map((item, idx) => {
                    const isMe = item.user_id === user?.id;
                    const rank = idx + 1;

                    return (
                      <div
                        key={item.user_id}
                        onClick={() => setSelectedUser(item)}
                        className={`flex flex-wrap items-center justify-between gap-4 py-3.5 px-3 rounded-2xl cursor-pointer transition ${
                          isMe ? "bg-violet-100/90 border-2 border-slate-950 shadow-[3px_3px_0_#171821]" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Rank Badge */}
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-slate-950 font-black text-sm ${
                              rank === 1
                                ? "bg-[#f4dc69] text-slate-950"
                                : rank === 2
                                ? "bg-slate-200 text-slate-950"
                                : rank === 3
                                ? "bg-amber-300 text-slate-950"
                                : "bg-white text-slate-950"
                            }`}
                          >
                            #{rank}
                          </span>

                          <UserAvatar
                            avatarUrl={item.avatar_url}
                            equippedAvatar={item.customization?.avatar}
                            equippedFrame={item.customization?.frame}
                            fallbackName={item.display_name}
                            size="sm"
                          />

                          <div className="min-w-0">
                            <NameDisplay
                              name={item.display_name}
                              nameColor={item.customization?.name_color}
                              nameEffect={item.customization?.name_effect}
                              className="text-base font-black text-slate-950"
                            />
                            <span className="block truncate text-xs font-bold text-slate-600">
                              [{item.customization?.title?.asset_value || "Player"}] {isMe ? "(You)" : ""}
                            </span>
                          </div>
                        </div>

                        {/* XP & Stats */}
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="flex items-center justify-end gap-1 text-xs font-black text-violet-700">
                              <Sparkles size={13} /> {item.xp.toLocaleString()} XP
                            </span>
                            <span className="text-[11px] font-bold text-slate-600">Level {item.level}</span>
                          </div>

                          <div className="hidden sm:flex items-center gap-2 text-right">
                            <div>
                              <span className="flex items-center justify-end gap-1 text-xs font-black text-slate-900">
                                <Trophy size={13} className="text-amber-500" /> {item.wins} Wins
                              </span>
                              <span className="text-[11px] font-bold text-slate-600">{item.games_played} Games</span>
                            </div>
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm">
                              <Eye size={14} />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Inspect Player Profile Card Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#fffdf7] p-6 shadow-[8px_8px_0_#171821]">
            <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-violet-600 tracking-wider">Player Profile Card</span>
                <h2 className="text-xl font-black text-slate-950">{selectedUser.display_name}</h2>
              </div>
              <button onClick={() => setSelectedUser(null)} className="rounded-full border-2 border-slate-950 bg-white p-2 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <PlayerCard
              displayName={selectedUser.display_name}
              avatarUrl={selectedUser.avatar_url}
              customization={
                selectedUser.customization
                  ? {
                      ...selectedUser.customization,
                      badges: selectedUser.customization.badges || [],
                      bio: selectedUser.customization.bio || "",
                      status_preset: selectedUser.customization.status_preset || "Online",
                    }
                  : null
              }
              levelState={{ xp: selectedUser.xp, level: selectedUser.level }}
              wins={selectedUser.wins}
              gamesPlayed={selectedUser.games_played}
            />

            <button onClick={() => setSelectedUser(null)} className="arcade-button mt-6 w-full bg-slate-950 text-white text-xs font-black">
              CLOSE PROFILE
            </button>
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}

function PodiumCard({
  user,
  rank,
  color,
  titleBadge,
  isMe,
  isFirst = false,
  onSelect,
}: {
  user: LeaderboardUser;
  rank: number;
  color: string;
  titleBadge: string;
  isMe: boolean;
  isFirst?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative overflow-hidden rounded-[26px] border-2 border-slate-950 p-5 text-center shadow-[6px_6px_0_#171821] cursor-pointer transition hover:-translate-y-1 ${color} ${
        isFirst ? "sm:-translate-y-4" : ""
      } ${isMe ? "ring-4 ring-violet-600" : ""}`}
    >
      <span className="rounded-full border-2 border-slate-950 bg-white px-3 py-0.5 text-[10px] font-black uppercase text-slate-950 shadow-sm">
        {titleBadge}
      </span>

      <div className="mt-4 flex justify-center">
        <UserAvatar
          avatarUrl={user.avatar_url}
          equippedAvatar={user.customization?.avatar}
          equippedFrame={user.customization?.frame}
          fallbackName={user.display_name}
          size={isFirst ? "xl" : "lg"}
        />
      </div>

      <NameDisplay
        name={user.display_name}
        nameColor={user.customization?.name_color}
        nameEffect={user.customization?.name_effect}
        className="mt-3 block text-xl font-black text-slate-950"
      />
      <p className="text-xs font-bold text-slate-800">[{user.customization?.title?.asset_value || "Challenger"}]</p>

      <div className="mt-4 border-t-2 border-slate-950/20 pt-3">
        <strong className="block text-xl font-black text-slate-950">{user.xp.toLocaleString()} XP</strong>
        <span className="text-xs font-black text-slate-800">Level {user.level} · {user.wins} Wins</span>
      </div>
    </div>
  );
}
