"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { sounds } from "@/lib/audio";
import { X, Trophy, CheckCircle2, CircleDollarSign, Gift, Loader2, Flame } from "lucide-react";

interface DailyMission {
  id: string;
  day_number: number;
  slot: number;
  title: string;
  description: string;
  target_count: number;
  reward_coins: number;
  reward_xp: number;
  mission_type: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

interface MissionsData {
  current_day: number;
  completed_days: number;
  claimed_milestones: number[];
  missions: DailyMission[];
}

interface DailyMissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyMissionsModal({ isOpen, onClose }: DailyMissionsModalProps) {
  const { refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"today" | "monthly">("today");
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
  const [data, setData] = useState<MissionsData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  const loadMissions = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: resData, error } = await supabase.rpc("get_user_daily_missions");
      if (!error && resData) {
        setData(resData as MissionsData);
      }
    } catch (err) {
      console.error("Failed to load daily missions:", err);
    }
  }, [supabase]);

  useEffect(() => {
    if (!isOpen || !supabase) return;
    let active = true;

    async function fetchMissions() {
      if (active) setLoading(true);
      try {
        const { data: resData, error } = await supabase!.rpc("get_user_daily_missions");
        if (active && !error && resData) {
          setData(resData as MissionsData);
        }
      } catch (err) {
        console.error("Failed to load daily missions:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchMissions();
    return () => {
      active = false;
    };
  }, [isOpen, supabase]);

  const claimReward = async (missionId: string) => {
    if (!supabase) return;
    setClaimingId(missionId);
    try {
      const { data: claimRes, error } = await supabase.rpc("claim_daily_mission_reward", { p_mission_id: missionId });
      if (error) {
        setNotice(error.message);
      } else if (claimRes) {
        sounds.playClickSound();
        setNotice(`+${claimRes.reward_coins} Rally Coins & +${claimRes.reward_xp} XP Claimed! 🎉`);
        await loadMissions();
        await refreshProfile();
      }
    } catch (err) {
      console.error("Failed to claim mission reward:", err);
    } finally {
      setClaimingId(null);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  const claimMilestone = async (dayNumber: number) => {
    if (!supabase) return;
    setClaimingMilestone(dayNumber);
    try {
      const { data: claimRes, error } = await supabase.rpc("claim_monthly_milestone_reward", { p_day: dayNumber });
      if (error) {
        setNotice(error.message);
      } else if (claimRes) {
        sounds.playClickSound();
        setNotice(`Milestone Day ${dayNumber} Chest Claimed! +${claimRes.reward_coins} Rally Coins! 🎁`);
        await loadMissions();
        await refreshProfile();
      }
    } catch (err) {
      console.error("Failed to claim milestone chest:", err);
    } finally {
      setClaimingMilestone(null);
      setTimeout(() => setNotice(null), 3500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[32px] border-2 border-slate-950 bg-white shadow-2xl">
        {/* Header */}
        <header className="relative border-b-2 border-slate-950 bg-[#f4dc69] p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full border-2 border-slate-950 bg-white text-slate-950 hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-800">
            <Trophy size={16} className="text-slate-950" />
            <span>Monthly Season Pass</span>
          </div>
          <h2 className="mt-1 text-3xl font-black text-slate-950">Daily Missions & Rewards</h2>
          <p className="mt-1 text-xs font-bold text-slate-700">Complete daily objectives for 30 days to unlock massive monthly chests!</p>

          {/* Tabs */}
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setActiveTab("today")}
              className={`rounded-full border-2 border-slate-950 px-4 py-1.5 text-xs font-black shadow-[2px_2px_0_#171821] transition cursor-pointer ${
                activeTab === "today" ? "bg-slate-950 text-white" : "bg-white text-slate-950 hover:bg-slate-50"
              }`}
            >
              Today&apos;s Missions (Day {data?.current_day || 1})
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`rounded-full border-2 border-slate-950 px-4 py-1.5 text-xs font-black shadow-[2px_2px_0_#171821] transition cursor-pointer ${
                activeTab === "monthly" ? "bg-slate-950 text-white" : "bg-white text-slate-950 hover:bg-slate-50"
              }`}
            >
              30-Day Pass Calendar ({data?.completed_days || 0}/30 Days)
            </button>
          </div>
        </header>

        {/* Notice Banner */}
        {notice && (
          <div className="bg-emerald-400 p-3 text-center text-xs font-black text-slate-950 border-b-2 border-slate-950 animate-bounce">
            {notice}
          </div>
        )}

        {/* Modal Body */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <Loader2 size={36} className="animate-spin text-purple-600" />
              <p className="text-xs font-black text-slate-500">Loading daily missions...</p>
            </div>
          ) : activeTab === "today" ? (
            <div className="space-y-4">
              {data?.missions.map((m) => {
                const percent = Math.min(100, Math.round((m.progress / m.target_count) * 100));

                return (
                  <div
                    key={m.id}
                    className={`relative overflow-hidden rounded-2xl border-2 border-slate-950 p-4 shadow-[3px_3px_0_#171821] ${
                      m.claimed ? "bg-slate-50 opacity-75" : m.completed ? "bg-amber-50" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-slate-950 bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-900">
                            SLOT {m.slot}
                          </span>
                          <strong className="text-base font-black text-slate-950">{m.title}</strong>
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-600">{m.description}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-950 bg-white px-3 py-1.5 text-xs font-black">
                          <CircleDollarSign size={14} className="text-amber-500" />
                          <span>+{m.reward_coins} RC</span>
                          <span className="text-purple-600">+{m.reward_xp} XP</span>
                        </div>

                        {m.claimed ? (
                          <span className="flex items-center gap-1 text-xs font-black text-emerald-600">
                            <CheckCircle2 size={16} /> CLAIMED
                          </span>
                        ) : m.completed ? (
                          <button
                            onClick={() => claimReward(m.id)}
                            disabled={claimingId === m.id}
                            className="arcade-button bg-emerald-400 text-slate-950 shadow-[2px_2px_0_#171821] animate-pulse"
                          >
                            {claimingId === m.id ? <Loader2 size={14} className="animate-spin" /> : "CLAIM"}
                          </button>
                        ) : (
                          <span className="text-xs font-black text-slate-400">
                            {m.progress}/{m.target_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {!m.claimed && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 mb-1">
                          <span>Progress</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full border border-slate-950 bg-slate-100">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 30-Day Calendar View */
            <div>
              <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-indigo-50 p-4 shadow-[2px_2px_0_#171821]">
                <div className="flex items-center gap-3">
                  <Flame className="text-orange-500" size={24} />
                  <div>
                    <strong className="block text-sm font-black">Monthly Streak</strong>
                    <span className="text-xs text-slate-600">Complete all 3 missions daily to advance your month calendar!</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-indigo-950">{data?.completed_days || 0} / 30 Days</span>
              </div>

              {/* Milestones Preview */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { day: 7, coins: 500, label: "Day 7 Chest" },
                  { day: 14, coins: 1000, label: "Day 14 Chest" },
                  { day: 21, coins: 2000, label: "Day 21 Chest" },
                  { day: 30, coins: 5000, label: "Day 30 Mythic Chest" },
                ].map((m) => {
                  const reached = (data?.completed_days || 0) >= m.day;
                  const claimed = data?.claimed_milestones.includes(m.day);

                  return (
                    <div
                      key={m.day}
                      className={`rounded-2xl border-2 border-slate-950 p-3 text-center shadow-[2px_2px_0_#171821] ${
                        claimed ? "bg-slate-100" : reached ? "bg-amber-100 animate-pulse" : "bg-white"
                      }`}
                    >
                      <Gift size={20} className={`mx-auto mb-1 ${reached ? "text-amber-600" : "text-slate-400"}`} />
                      <strong className="block text-xs font-black">{m.label}</strong>
                      <span className="block text-[10px] font-bold text-slate-600">+{m.coins} Coins</span>

                      {claimed ? (
                        <span className="mt-2 block text-[10px] font-black text-emerald-600">✓ CLAIMED</span>
                      ) : reached ? (
                        <button
                          onClick={() => claimMilestone(m.day)}
                          disabled={claimingMilestone === m.day}
                          className="arcade-button mt-2 w-full bg-emerald-400 text-slate-950 text-[10px] py-1"
                        >
                          {claimingMilestone === m.day ? "..." : "OPEN"}
                        </button>
                      ) : (
                        <span className="mt-2 block text-[10px] font-bold text-slate-400">Locked</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 30-Day Grid */}
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {Array.from({ length: 30 }, (_, i) => {
                  const dayNum = i + 1;
                  const isCurrent = dayNum === data?.current_day;
                  const isPassed = dayNum <= (data?.completed_days || 0);

                  return (
                    <div
                      key={dayNum}
                      className={`grid h-14 place-items-center rounded-2xl border-2 border-slate-950 text-center font-black shadow-[2px_2px_0_#171821] ${
                        isPassed
                          ? "bg-emerald-400 text-slate-950"
                          : isCurrent
                          ? "bg-[#f4dc69] text-slate-950 ring-2 ring-purple-600"
                          : "bg-white text-slate-400"
                      }`}
                    >
                      <div>
                        <span className="block text-xs">Day {dayNum}</span>
                        {isPassed && <span className="text-[10px]">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
