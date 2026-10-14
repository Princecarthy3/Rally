"use client";

import { Trophy, RotateCcw, Home, Sparkles, Award } from "lucide-react";
import type { TowerPlayerPlacement } from "../types";

export function TowerResultsModal({
  placements,
  winnerSeat,
  localSeat,
  onRematch,
  onLeave,
  isHost,
}: {
  placements: TowerPlayerPlacement[];
  winnerSeat: number | null;
  localSeat: number;
  onRematch: () => void;
  onLeave: () => void;
  isHost?: boolean;
}) {
  const winner = placements.find((p) => p.seat === winnerSeat) || placements[0];
  const isMeWinner = winner?.seat === localSeat;

  // Podium (Top 3)
  const first = placements[0];
  const second = placements[1];
  const third = placements[2];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md rounded-3xl border-3 border-slate-950 bg-white p-6 shadow-[8px_8px_0_#0f172a] sm:p-8">
        {/* Floating Celebration Header */}
        <div className="text-center">
          <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-3xl border-3 border-slate-950 bg-gradient-to-tr from-amber-400 to-yellow-300 shadow-[4px_4px_0_#0f172a]">
            <Trophy className="h-8 w-8 text-amber-950" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
            {isMeWinner ? "Summit Conquered!" : "Tower Rush Complete!"}
          </h2>

          <p className="mt-1 text-sm font-bold text-slate-500">
            {winner ? (
              <span>
                <strong className="text-violet-600">{winner.displayName}</strong> scaled the tower
                first in{" "}
                <span className="font-mono text-slate-800">{winner.finishTime.toFixed(1)}s</span>!
              </span>
            ) : (
              "Match concluded!"
            )}
          </p>

          {/* Reward Banner */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-amber-400/40 bg-amber-50 px-4 py-1 text-xs font-black text-amber-900">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>+30 Rally Coins Awarded</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PODIUM DISPLAY                                           */}
        {/* ======================================================== */}
        <div className="mt-6 flex items-end justify-center gap-2 border-b-2 border-slate-100 pb-5">
          {/* 2nd Place */}
          {second && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-600 truncate max-w-[65px]">
                {second.displayName}
              </span>
              <div
                className="mt-1 h-3 w-3 rounded-full border border-slate-900"
                style={{ backgroundColor: second.color }}
              />
              <div className="mt-1 flex h-16 w-18 flex-col items-center justify-center rounded-2xl border-2 border-slate-950 bg-slate-200 shadow-[2px_2px_0_#0f172a]">
                <span className="text-xs font-black text-slate-600">2nd</span>
                <span className="font-mono text-[10px] font-bold text-slate-500">
                  {second.finishTime > 0 ? `${second.finishTime.toFixed(1)}s` : "DNF"}
                </span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {first && (
            <div className="flex flex-col items-center">
              <span className="text-xs font-black text-amber-900 truncate max-w-[75px]">
                {first.displayName}
              </span>
              <div
                className="mt-1 h-3.5 w-3.5 rounded-full border border-slate-900"
                style={{ backgroundColor: first.color }}
              />
              <div className="mt-1 flex h-22 w-20 flex-col items-center justify-center rounded-2xl border-3 border-slate-950 bg-gradient-to-t from-amber-400 to-yellow-300 shadow-[3px_3px_0_#0f172a]">
                <Award className="h-5 w-5 text-amber-950 mb-0.5" />
                <span className="text-sm font-black text-amber-950">1st</span>
                <span className="font-mono text-[11px] font-bold text-amber-900">
                  {first.finishTime > 0 ? `${first.finishTime.toFixed(1)}s` : "Winner"}
                </span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {third && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-600 truncate max-w-[65px]">
                {third.displayName}
              </span>
              <div
                className="mt-1 h-3 w-3 rounded-full border border-slate-900"
                style={{ backgroundColor: third.color }}
              />
              <div className="mt-1 flex h-12 w-18 flex-col items-center justify-center rounded-2xl border-2 border-slate-950 bg-amber-700/20 shadow-[2px_2px_0_#0f172a]">
                <span className="text-xs font-black text-amber-800">3rd</span>
                <span className="font-mono text-[10px] font-bold text-amber-900">
                  {third.finishTime > 0 ? `${third.finishTime.toFixed(1)}s` : "DNF"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Full Rankings List */}
        <div className="mt-4 flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1">
          {placements.map((p, idx) => (
            <div
              key={p.seat}
              className={`flex items-center justify-between rounded-xl border-2 border-slate-950 p-2 text-xs font-black shadow-[2px_2px_0_#0f172a] ${
                p.seat === localSeat ? "bg-violet-100 text-violet-950" : "bg-white text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-400">#{idx + 1}</span>
                <div
                  className="h-2.5 w-2.5 rounded-full border border-slate-900"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate max-w-[120px]">
                  {p.displayName} {p.seat === localSeat ? "(you)" : ""}
                </span>
              </div>

              <span className="font-mono text-xs">
                {p.finishTime > 0 ? `${p.finishTime.toFixed(1)}s` : "Did not finish"}
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          {isHost ? (
            <button
              onClick={onRematch}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-3 border-slate-950 bg-violet-600 py-3 text-sm font-black text-white shadow-[4px_4px_0_#0f172a] hover:bg-violet-700 active:translate-y-0.5"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Play Again (Rematch)</span>
            </button>
          ) : (
            <div className="text-center text-xs font-bold text-slate-500 py-1">
              Waiting for host to restart match...
            </div>
          )}

          <button
            onClick={onLeave}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-100 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-200 active:translate-y-0.5"
          >
            <Home className="h-4 w-4" />
            <span>Return to Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
}
