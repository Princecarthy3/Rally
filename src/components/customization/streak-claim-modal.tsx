"use client";

import { X, Sparkles, CheckCircle2, Flame, LoaderCircle } from "lucide-react";

interface StreakClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
  onClaim: () => Promise<void>;
  busy: boolean;
}

const streakRewards = [
  { day: 1, reward: 50 },
  { day: 2, reward: 75 },
  { day: 3, reward: 100 },
  { day: 4, reward: 125 },
  { day: 5, reward: 150 },
  { day: 6, reward: 200 },
  { day: 7, reward: 500, highlight: true },
];

export function StreakClaimModal({ isOpen, onClose, currentStreak, onClaim, busy }: StreakClaimModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#fffdf7] p-6 text-center shadow-[8px_8px_0_#171821]">
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full border-2 border-slate-950 bg-white p-2 hover:bg-slate-100">
          <X size={18} />
        </button>

        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border-2 border-slate-950 bg-orange-400 text-3xl shadow-[3px_3px_0_#171821]">
          🔥
        </div>

        <p className="eyebrow mt-4">Daily Streak</p>
        <h2 className="text-3xl font-black">{currentStreak} Day Streak!</h2>
        <p className="mt-1 text-xs text-slate-500">Claim your Rally Coins each day to maintain your streak bonus.</p>

        {/* 7-Day Grid */}
        <div className="mt-6 grid grid-cols-7 gap-1.5">
          {streakRewards.map((item) => {
            const isCompleted = item.day <= currentStreak;
            const isCurrentDay = item.day === (currentStreak % 7) + 1;

            return (
              <div
                key={item.day}
                className={`flex flex-col items-center justify-between rounded-xl border-2 border-slate-950 p-1.5 py-2 text-center shadow-[2px_2px_0_#171821] ${
                  isCurrentDay
                    ? "bg-[#f4dc69] ring-2 ring-slate-950"
                    : isCompleted
                    ? "bg-[#a7efc8]"
                    : "bg-white opacity-60"
                }`}
              >
                <span className="text-[9px] font-black uppercase text-slate-500">D{item.day}</span>
                {isCompleted ? (
                  <CheckCircle2 size={16} className="text-emerald-800 my-1" />
                ) : (
                  <span className="my-1 text-xs">🪙</span>
                )}
                <span className="text-[10px] font-black">+{item.reward}</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={async () => {
            await onClaim();
            onClose();
          }}
          disabled={busy}
          className="arcade-button mt-6 w-full bg-[#f4dc69] text-slate-950 text-sm shadow-[4px_4px_0_#171821]"
        >
          {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
          CLAIM TODAY&apos;S REWARD
        </button>
      </div>
    </div>
  );
}
