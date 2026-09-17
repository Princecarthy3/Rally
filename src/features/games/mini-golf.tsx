"use client";

import type { Room, RoomPlayer } from "@/features/rooms/types";

type MiniGolfState = {
  hole?: number;
  target?: number;
  shots?: Record<string, number>;
  scores?: Record<string, number>;
  holeResults?: Array<Record<string, number>>;
  message?: string;
};

export function MiniGolf({
  room,
  players,
  meSeat,
  onAct,
  busy,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
}) {
  const state = (room.public_state || {}) as MiniGolfState;
  const hole = state.hole || 1;
  const shots = state.shots || {};
  const scores = state.scores || {};
  const hasShot = Object.prototype.hasOwnProperty.call(shots, String(meSeat));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Mini Golf</p>
          <h3 className="text-2xl font-black">Hole {hole} of 9</h3>
        </div>
        <div className="flex gap-2 text-xs font-black">
          {players.map((player) => (
            <span key={player.seat} className="rounded-full bg-slate-100 px-3 py-1">
              P{player.seat}: {scores[String(player.seat)] || 0}
            </span>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#9be39b] p-6 text-center shadow-[4px_4px_0_#171821]">
        <div className="absolute inset-x-0 bottom-0 h-8 bg-[#72c878]" />
        <div className="relative">
          <div className="mx-auto flex max-w-md items-center justify-between text-5xl">
            <span>⛳</span>
            <span className="text-3xl">🏌️</span>
            <span>🕳️</span>
          </div>
          <p className="mt-5 text-sm font-black text-emerald-950">
            Pick your shot power. The closer you land to the pin, the fewer strokes you take.
          </p>
          <p className="mt-2 text-xs font-bold text-emerald-900/70">
            {hasShot ? "Shot locked — waiting for the other players…" : state.message || "Choose your power"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => index + 1).map((power) => (
          <button
            key={power}
            disabled={hasShot || busy}
            onClick={() => void onAct("shot", String(power))}
            className="rounded-2xl border-2 border-slate-950 bg-[#fff8dd] px-2 py-4 text-center font-black shadow-[3px_3px_0_#171821] transition hover:-translate-y-1 hover:bg-[#f4dc69] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="block text-2xl">🏌️</span>
            <span className="mt-1 block text-xs">Power {power}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {players.map((player) => (
          <div key={player.seat} className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold">
            <span>Player {player.seat}</span>
            <span>{Object.prototype.hasOwnProperty.call(shots, String(player.seat)) ? "✅ Shot locked" : "⏳ Choosing…"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
