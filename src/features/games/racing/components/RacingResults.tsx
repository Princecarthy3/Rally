"use client";

import { Flag, LogOut, RotateCcw, Trophy } from "lucide-react";
import { RaceResult } from "../types";
import type { RoomPlayer } from "@/features/rooms/types";

export function RacingResults({
  results,
  players,
  meSeat,
  isHost,
  onRematch,
  onExit,
  busy
}: {
  results: RaceResult[];
  players: RoomPlayer[];
  meSeat: number;
  isHost: boolean;
  onRematch: () => void;
  onExit: () => void;
  busy?: boolean;
}) {
  const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];

  function formatTime(t: number) {
    if (!t) return "--:--.--";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 select-none backdrop-blur-xl">
      <div className="w-full max-w-lg rounded-3xl border-2 border-white/20 bg-slate-900 p-6 text-white shadow-2xl">
        {/* Header Title */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg">
            <Trophy className="h-8 w-8" />
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-amber-300">RACE RESULTS</h2>
          <p className="text-xs font-bold text-slate-400">Rally Stage Complete</p>
        </div>

        {/* Results Leaderboard Table */}
        <div className="mt-6 space-y-2.5">
          {results.map((res, index) => {
            const player = players.find(p => p.seat === res.seat);
            const isMe = res.seat === meSeat;

            return (
              <div
                key={res.seat}
                className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all ${
                  isMe ? "border-amber-400/60 bg-amber-500/10" : "border-white/10 bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black ${
                      index === 0
                        ? "bg-amber-400 text-slate-950"
                        : index === 1
                        ? "bg-slate-300 text-slate-950"
                        : index === 2
                        ? "bg-amber-700 text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    #{index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">
                      {player?.profile?.display_name || `Player ${res.seat}`}
                      {isMe && <span className="ml-1.5 text-xs text-amber-400">(You)</span>}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">Seat {res.seat}</p>
                  </div>
                </div>

                <div className="font-mono text-sm font-black text-amber-400">
                  {formatTime(res.time)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons: REMATCH & EXIT */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onExit}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-slate-800 py-3 text-xs font-black text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span>EXIT RACE</span>
          </button>

          {isHost ? (
            <button
              onClick={onRematch}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-black text-slate-950 shadow-lg transition-all hover:bg-amber-400 active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              <span>REMATCH</span>
            </button>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 py-3 text-xs font-bold text-amber-300">
              Waiting for host...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
