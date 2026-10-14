"use client";

import { Trophy, RotateCcw, Home, Sparkles } from "lucide-react";
import Link from "next/link";
import type { HexPlayerPlacement } from "../types";

export function HexResultsModal({
  placements,
  winnerSeat,
  isHost,
  onRematch,
  busy,
}: {
  placements: HexPlayerPlacement[];
  winnerSeat: number | null;
  isHost: boolean;
  onRematch: () => void;
  busy?: boolean;
}) {
  const winner = placements.find((p) => p.placement === 1) || placements[0];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border-3 border-slate-950 bg-[#fffdf7] p-6 shadow-[8px_8px_0_#0f172a] sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Trophy Banner */}
        <div className="text-center">
          <div className="relative mx-auto mb-3 grid h-20 w-20 place-items-center rounded-3xl border-3 border-slate-950 bg-gradient-to-tr from-amber-400 to-yellow-200 shadow-[4px_4px_0_#0f172a]">
            <Trophy size={40} className="text-slate-950" />
            <Sparkles size={20} className="absolute -top-1 -right-1 text-amber-500 animate-spin" />
          </div>

          <p className="eyebrow text-amber-600">Champion Crowned</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {winner?.displayName || "Player"} Wins!
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Outlasted the falling arena across 4 floors
          </p>
        </div>

        {/* Standings Ladder */}
        <div className="mt-6 max-h-56 space-y-2 overflow-y-auto pr-1">
          {placements.map((p) => (
            <div
              key={p.seat}
              className={`flex items-center justify-between rounded-xl border-2 border-slate-950 p-2.5 shadow-[2px_2px_0_#0f172a] ${
                p.placement === 1
                  ? "bg-amber-100 font-black"
                  : p.placement === 2
                  ? "bg-slate-100"
                  : p.placement === 3
                  ? "bg-amber-50"
                  : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg border-2 border-slate-950 text-xs font-black ${
                    p.placement === 1
                      ? "bg-yellow-400 text-slate-950"
                      : p.placement === 2
                      ? "bg-slate-300 text-slate-950"
                      : p.placement === 3
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {p.placement === 1 ? "1st" : p.placement === 2 ? "2nd" : p.placement === 3 ? "3rd" : `${p.placement}th`}
                </span>
                <span
                  className="h-3 w-3 rounded-full border border-black/30"
                  style={{ backgroundColor: p.color }}
                />
                <span className="max-w-[130px] truncate text-xs font-black text-slate-900 sm:max-w-[170px]">
                  {p.displayName} {p.isBot ? "[AI]" : ""}
                </span>
              </div>

              <span className="font-mono text-xs font-extrabold text-slate-500">
                {formatTime(p.survivalTime)}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {isHost ? (
            <button
              onClick={onRematch}
              disabled={busy}
              className="arcade-button flex-1 justify-center bg-[#7357ff] py-3.5 text-white shadow-[4px_4px_0_#0f172a]"
            >
              <RotateCcw size={16} /> Play Again
            </button>
          ) : (
            <div className="flex-1 rounded-2xl border-2 border-slate-950 bg-slate-100 p-3 text-center text-xs font-black text-slate-600">
              Waiting for host to rematch...
            </div>
          )}

          <Link
            href="/dashboard"
            className="arcade-button justify-center bg-white py-3.5 text-slate-950 shadow-[3px_3px_0_#0f172a] hover:bg-slate-50"
          >
            <Home size={16} /> Exit
          </Link>
        </div>
      </div>
    </div>
  );
}
