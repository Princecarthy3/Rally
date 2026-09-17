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
};

export function MemoryMatch({ room, players, meSeat, onAct, busy }: {
  room: Room; players: RoomPlayer[]; meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>; busy?: boolean;
}) {
  const state = (room.public_state || {}) as MemoryState;
  const flipped = state.flipped || [];
  const matched = state.matched || [];
  const cards = state.cards || Array(16).fill(null);
  const isMyTurn = state.turn === meSeat;
  const isResolvingPair = state.revealed || flipped.length === 2;

  useEffect(() => {
    if (meSeat !== state.turn || !state.revealed || flipped.length !== 2 || busy) return;
    const timer = window.setTimeout(() => void onAct("resolve"), 900);
    return () => window.clearTimeout(timer);
  }, [busy, flipped.length, meSeat, onAct, state.revealed, state.turn]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
        <div><p className="text-xs font-black uppercase tracking-widest text-orange-600">Memory Match</p><h3 className="text-2xl font-black">Find the pairs</h3></div>
        <div className="flex gap-2 text-xs font-black">{players.map((player) => <span key={player.seat} className="rounded-full bg-slate-100 px-3 py-1">P{player.seat}: {state.scores?.[String(player.seat)] || 0}</span>)}</div>
      </div>
      <p className="text-center text-sm font-bold text-slate-500">{state.message || `Player ${state.turn || 1}'s turn`}</p>
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card, index) => {
          const visible = card !== null || flipped.includes(index) || matched.includes(index);
          return <button key={index} disabled={!isMyTurn || busy || visible || isResolvingPair} onClick={() => onAct("flip", String(index))} className={`aspect-square rounded-2xl border-2 border-slate-950 text-2xl font-black shadow-[3px_3px_0_#171821] transition ${visible ? "bg-orange-100" : "bg-violet-600 text-white hover:bg-violet-500"}`}>{visible ? card : "?"}</button>;
        })}
      </div>
      <p className="text-center text-xs font-bold text-slate-400">Match pairs to keep your turn. Miss and the next player goes.</p>
    </div>
  );
}
