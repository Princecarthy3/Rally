"use client";

import { RoomPlayer } from "@/features/rooms/types";
import { RotateCcw } from "lucide-react";
import { CombatMatchResult } from "../types";

export function CombatResultsModal({
  results,
  players,
  meSeat,
  isHost,
  onRematch,
  onExit,
  busy,
}: {
  results: CombatMatchResult[];
  players: RoomPlayer[];
  meSeat: number;
  isHost: boolean;
  onRematch: () => void;
  onExit: () => void;
  busy?: boolean;
}) {
  const winner = results.find((r) => r.rank === 1) || results[0];
  const isWinner = winner?.seat === meSeat;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-xl rounded-3xl border-4 border-slate-950 bg-white p-6 sm:p-8 shadow-2xl text-center space-y-6">
        <div>
          <span className="text-6xl sm:text-7xl">{isWinner ? "🏆" : "⚔️"}</span>
          <p className="eyebrow mt-4">Rally Combat Complete</p>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-slate-950 mt-1">
            {isWinner ? "VICTORY!" : winner ? `${winner.displayName} WINS!` : "MATCH ENDED"}
          </h1>
        </div>

        {/* Standings Table */}
        <div className="space-y-2 text-left">
          {results.map((r, i) => (
            <div
              key={r.seat}
              className={`flex items-center justify-between rounded-2xl border-2 border-slate-950 p-3 shadow-[3px_3px_0_#171821] ${
                r.seat === meSeat ? "bg-amber-100" : "bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-950 bg-slate-900 text-xs font-black text-white">
                  #{i + 1}
                </span>
                <div>
                  <strong className="block text-sm font-black text-slate-950">{r.displayName}</strong>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Kills: {r.kills} · Dmg Dealt: {Math.round(r.damageDealt)} · Dmg Taken: {Math.round(r.damageReceived)}
                  </span>
                </div>
              </div>
              <span className="text-xs font-black uppercase text-slate-700">P{r.seat}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isHost ? (
            <button
              onClick={onRematch}
              disabled={busy}
              className="arcade-button w-full sm:w-auto bg-[#f4dc69] px-8 py-3.5 text-xs font-black text-slate-950 shadow-[4px_4px_0_#171821]"
            >
              <RotateCcw size={16} /> REMATCH
            </button>
          ) : (
            <p className="text-xs font-bold text-slate-500">Waiting for host to call rematch...</p>
          )}
          <button
            onClick={onExit}
            className="arcade-button w-full sm:w-auto bg-slate-950 px-8 py-3.5 text-xs font-black text-white shadow-[4px_4px_0_#171821]"
          >
            RETURN TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
