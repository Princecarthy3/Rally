"use client";

import type { Room, RoomPlayer } from "@/features/rooms/types";
import { Target } from "lucide-react";

export function NumberGuessGame({ room, players, meSeat, onAct, busy }: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  isMyTurn: boolean;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
}) {
  const state = (room.public_state || {}) as Record<string, any>;
  const round = state.round || 1;
  const guesses = (state.guesses || {}) as Record<string, number>;
  const mine = guesses[String(meSeat)];
  const scores = (state.scores || {}) as Record<string, number>;

  return <div className="mx-auto max-w-2xl space-y-5 text-center">
    <div className="rounded-3xl border-4 border-slate-950 bg-slate-900 p-5 text-white shadow-[6px_6px_0_#171821]">
      <div className="flex items-center justify-center gap-3"><span className="text-3xl">🔎</span><div className="text-left"><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Number Hunt: Grid Rush</p><h3 className="text-lg font-black">Round {round} of 5</h3></div></div>
      <p className="mt-3 text-sm text-slate-300">Everyone secretly picks one tile. Find the hidden number to score 100 points—then a new number appears.</p>
      <div className="mt-4 flex justify-center gap-3 text-xs font-black">{players.map((player) => <span key={player.seat} className="rounded-full bg-white/10 px-3 py-1">P{player.seat}: {scores[String(player.seat)] || 0}</span>)}</div>
    </div>
    {state.message && <p className="rounded-xl border-2 border-slate-950 bg-[#f4dc69] px-4 py-2 text-sm font-black">{state.message}</p>}
    {mine ? <div className="rounded-2xl border-2 border-slate-950 bg-emerald-50 p-6 shadow-[4px_4px_0_#171821]"><Target className="mx-auto text-emerald-600" /><p className="mt-2 font-black">Tile {mine} locked in.</p><p className="mt-1 text-sm text-slate-600">Waiting for the other hunters…</p></div> :
      <div className="grid grid-cols-5 gap-2 sm:gap-3">{Array.from({ length: 25 }, (_, index) => index + 1).map((tile) => <button key={tile} disabled={busy} onClick={() => onAct("choose", String(tile))} className="aspect-square rounded-xl border-2 border-slate-950 bg-[#e0f2fe] text-lg font-black shadow-[3px_3px_0_#171821] transition hover:-translate-y-1 hover:bg-cyan-300 disabled:opacity-50">{tile}</button>)}</div>}
  </div>;
}
