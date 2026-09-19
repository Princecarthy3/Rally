"use client";

import { useEffect } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";

type MemoryState = {
  turn?: number;
  cards?: (string | null)[];
  flipped?: number[];
  matched?: number[];
  revealed?: boolean;
  scores?: Record<string, number>;
  message?: string;
  mode?: string;
  pairs?: number;
  cols?: number;
};

const MODES = [
  { id: "easy", label: "Easy", detail: "12 cards · 6 pairs", pairs: 6 },
  { id: "classic", label: "Classic", detail: "16 cards · 8 pairs", pairs: 8 },
  { id: "expert", label: "Expert", detail: "24 cards · 12 pairs", pairs: 12 },
] as const;

export function MemoryMatch({
  room,
  players,
  meSeat,
  onAct,
  busy,
  isHost,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
  isHost?: boolean;
}) {
  const state = (room.public_state || {}) as MemoryState;
  const flipped = (state.flipped || []).map((n) => Number(n));
  const matched = (state.matched || []).map((n) => Number(n));
  const mode = (state.mode || "classic") as string;
  const pairs = Number(state.pairs || (mode === "easy" ? 6 : mode === "expert" ? 12 : 8));
  const cols = Number(state.cols || (mode === "easy" ? 3 : 4));
  const cards = state.cards?.length
    ? state.cards
    : Array(pairs * 2).fill(null);
  const isMyTurn = Number(state.turn) === meSeat;
  const isResolvingPair = Boolean(state.revealed) || flipped.length === 2;
  const canChangeMode =
    Boolean(isHost) && flipped.length === 0 && matched.length === 0 && mode !== "sudden";

  const gridClass =
    cols >= 6
      ? "grid-cols-6"
      : cols === 3
        ? "grid-cols-3"
        : cols === 2
          ? "grid-cols-2"
          : "grid-cols-4";

  const gapClass = pairs >= 12 ? "gap-1.5 sm:gap-2" : "gap-2 sm:gap-3";
  const textClass = pairs >= 12 ? "text-lg sm:text-2xl" : "text-2xl sm:text-3xl";

  useEffect(() => {
    if (Number(state.turn) !== meSeat || !state.revealed || flipped.length !== 2 || busy) return;
    const timer = window.setTimeout(() => void onAct("resolve"), 900);
    return () => window.clearTimeout(timer);
  }, [busy, flipped.length, meSeat, onAct, state.revealed, state.turn]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-200 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-orange-600">Memory Match</p>
          <h3 className="text-xl font-black sm:text-2xl">Find the pairs</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-black sm:gap-2 sm:text-xs">
          {players.map((player) => (
            <span key={player.seat} className="rounded-full bg-slate-100 px-2.5 py-1 sm:px-3">
              P{player.seat}: {state.scores?.[String(player.seat)] || 0}
            </span>
          ))}
        </div>
      </div>

      {canChangeMode && (
        <div className="rounded-2xl border-2 border-slate-950 bg-slate-100 p-2 shadow-[3px_3px_0_#171821]">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Host option: board size
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => void onAct("set_mode", m.id)}
                className={`rounded-xl border-2 border-slate-950 px-1.5 py-2 text-[10px] font-black leading-tight transition sm:px-2 sm:text-xs ${
                  mode === m.id
                    ? "bg-[#f4dc69] shadow-[2px_2px_0_#171821]"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <span className="block">{m.label}</span>
                <span className="mt-0.5 block font-bold text-slate-500">{m.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <p className="text-center text-sm font-bold text-slate-500">
          {state.message || `Player ${state.turn || 1}'s turn`}
        </p>
        <span className="rounded-full border-2 border-slate-950 bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase sm:text-xs">
          {mode === "sudden" ? "Sudden death" : `${mode} · ${pairs} pairs`}
        </span>
      </div>

      <div className={`grid ${gridClass} ${gapClass}`}>
        {cards.map((card, index) => {
          const visible = card !== null || flipped.includes(index) || matched.includes(index);
          return (
            <button
              key={index}
              type="button"
              disabled={!isMyTurn || busy || visible || isResolvingPair}
              onClick={() => void onAct("flip", String(index))}
              className={`aspect-square rounded-xl border-2 border-slate-950 font-black shadow-[3px_3px_0_#171821] transition sm:rounded-2xl ${textClass} ${
                visible ? "bg-orange-100" : "bg-violet-600 text-white hover:bg-violet-500"
              }`}
            >
              {visible ? card : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
