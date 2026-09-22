"use client";

import { Flag, Gauge, HelpCircle, Trophy } from "lucide-react";
import { useState } from "react";

type LiveStanding = { seat: number; displayName: string; color: string; finished?: boolean };

export function RacingHUD({
  position = 1,
  totalPlayers = 4,
  lapTime = 0,
  checkpoint = 0,
  totalCheckpoints = 5,
  speed = 0,
  standings = [],
}: {
  position?: number;
  totalPlayers?: number;
  lapTime?: number;
  checkpoint?: number;
  totalCheckpoints?: number;
  speed?: number;
  standings?: LiveStanding[];
  onExit?: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  const mins = Math.floor(lapTime / 60);
  const secs = Math.floor(lapTime % 60);
  const ms = Math.floor((lapTime % 1) * 100);
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex select-none flex-col justify-between"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      {/* Top row: leaderboard | timer | CP + help */}
      <div className="flex items-start justify-between gap-2 px-2 sm:gap-3 sm:px-3">
        {/* Live order / leaderboard — always visible */}
        <div className="pointer-events-auto w-[9.5rem] shrink-0 overflow-hidden rounded-xl border border-white/25 bg-slate-950/85 text-white shadow-xl backdrop-blur-md sm:w-56 sm:rounded-2xl">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400 sm:h-5 sm:w-5" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 sm:text-sm">
              Live order
            </span>
            <span className="ml-auto text-sm font-black text-amber-300 sm:text-xl">
              {position}
              <span className="text-[10px] text-slate-400 sm:text-xs">/{totalPlayers}</span>
            </span>
          </div>
          <div className="max-h-[28vh] space-y-0.5 overflow-y-auto p-1 sm:max-h-none sm:p-1.5">
            {(standings.length > 0
              ? standings
              : Array.from({ length: totalPlayers }, (_, i) => ({
                  seat: i + 1,
                  displayName: `Player ${i + 1}`,
                  color: "#94a3b8",
                  finished: false,
                }))
            ).map((standing, index) => (
              <div
                key={standing.seat}
                className={`flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[10px] font-bold sm:gap-2 sm:px-2 sm:py-1 sm:text-xs ${
                  index + 1 === position ? "bg-white/15" : ""
                }`}
              >
                <span className="w-3 text-slate-400">{index + 1}</span>
                <span className="h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5" style={{ backgroundColor: standing.color }} />
                <span className="min-w-0 flex-1 truncate">{standing.displayName}</span>
                {standing.finished && (
                  <span className="text-[8px] uppercase text-emerald-300 sm:text-[9px]">Done</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className="pointer-events-auto shrink-0 rounded-xl border border-white/25 bg-slate-950/85 px-2.5 py-1.5 font-mono text-sm font-black text-white shadow-xl backdrop-blur-md sm:rounded-2xl sm:px-4 sm:py-2 sm:text-xl">
          {formattedTime}
        </div>

        {/* Checkpoint + help */}
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/25 bg-slate-950/85 px-2 py-1.5 text-white shadow-xl backdrop-blur-md sm:rounded-2xl sm:px-3 sm:py-2">
            <Flag className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
            <span className="text-[10px] font-black sm:text-xs">
              CP {Math.min(checkpoint + 1, totalCheckpoints)}/{totalCheckpoints}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl border border-white/25 bg-slate-950/85 text-white shadow-xl backdrop-blur-md sm:h-10 sm:w-10 sm:rounded-2xl"
          >
            <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Speed — bottom center, above touch controls */}
      <div className="pointer-events-none flex flex-col items-center pb-16 sm:pb-4">
        <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-1 font-black text-white shadow-lg backdrop-blur-md sm:rounded-2xl sm:px-4 sm:py-1.5">
          <Gauge className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
          <span className="text-base text-amber-300 sm:text-lg">{Math.round(speed)}</span>
          <span className="text-[9px] uppercase text-slate-400 sm:text-[10px]">KM/H</span>
        </div>
      </div>

      {showHelp && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border-2 border-white/20 bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-lg font-black tracking-tight text-amber-400">🏎️ Rally Controls</h3>
            <div className="mt-4 space-y-2.5 text-xs font-bold text-slate-300">
              <div className="flex justify-between rounded-xl bg-slate-800/60 p-2.5">
                <span>Accelerate / Reverse</span>
                <span className="font-mono text-amber-300">W / S · ↑ / ↓</span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-800/60 p-2.5">
                <span>Steer</span>
                <span className="font-mono text-amber-300">A / D · ← / →</span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-800/60 p-2.5">
                <span>Handbrake</span>
                <span className="font-mono text-amber-300">SPACE</span>
              </div>
              <p className="pt-1 text-[11px] text-slate-400">On mobile, use the on-screen buttons.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-2xl bg-amber-500 py-2.5 font-black text-slate-950 shadow-lg hover:bg-amber-400 active:scale-95"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
