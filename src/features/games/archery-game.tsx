"use client";

import { useMemo } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";

type Props = { room: Room; players: RoomPlayer[]; meSeat: number; onAct: (action: string, value?: string) => Promise<void>; busy: boolean };

export function ArcheryGame({ room, players, meSeat, onAct, busy }: Props) {
  const state = room.public_state || {};
  const scores = (state.scores || {}) as Record<string, number>;
  const arrows = Number(state.arrows || 0);
  const totalArrows = Number(state.totalArrows || 10);
  const locked = Boolean((state.shots || {})[String(meSeat)]);
  const positions = useMemo(() => players.slice(0, 4).map((player, index) => ({ player, left: `${14 + index * (72 / Math.max(1, players.length - 1))}%` })), [players]);

  return (
    <div className="mx-auto max-w-4xl text-slate-950">
      <div className="grid gap-4 lg:grid-cols-[1fr_250px]">
        <div className="relative min-h-[350px] overflow-hidden rounded-[28px] border-2 border-slate-950 bg-gradient-to-b from-sky-300 via-emerald-100 to-emerald-500 shadow-[6px_6px_0_#171821]">
          <div className="absolute inset-x-0 bottom-0 h-24 bg-emerald-700/40" />
          <div className="absolute left-1/2 top-16 grid size-40 -translate-x-1/2 place-items-center rounded-full border-[14px] border-red-500 bg-amber-300 shadow-[0_0_0_10px_white,0_0_0_14px_#2563eb]">
            <span className="grid size-12 place-items-center rounded-full bg-red-700 text-2xl text-white">10</span>
          </div>
          <div className="absolute inset-x-0 bottom-12 text-center text-xs font-black uppercase tracking-[.25em] text-emerald-950/70">Rally range</div>
          {positions.map(({ player, left }) => (
            <div key={player.id} className="absolute bottom-8 -translate-x-1/2 text-center" style={{ left }}>
              <div className="text-5xl">🏹</div>
              <div className="rounded-full border-2 border-slate-950 bg-white px-2 py-1 text-[10px] font-black">P{player.seat}</div>
            </div>
          ))}
        </div>

        <aside className="rounded-[24px] border-2 border-slate-950 bg-slate-950 p-4 text-white shadow-[5px_5px_0_#171821]">
          <div className="flex items-center justify-between border-b border-white/15 pb-3">
            <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Live match</p><h3 className="text-xl font-black">Scoreboard</h3></div>
            <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-xs font-black text-emerald-300">{players.length}/4</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {players.map((player, index) => <div key={player.id} className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2"><span className="text-sm font-bold">{index + 1}. {player.profile?.display_name || `Player ${player.seat}`}</span><strong className="text-amber-300">{scores[String(player.seat)] || 0}</strong></div>)}
          </div>
          <div className="mt-5 flex items-center justify-between text-xs font-bold text-white/60"><span>Arrows</span><span>{arrows}/{totalArrows}</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-amber-300 transition-all" style={{ width: `${Math.min(100, (arrows / totalArrows) * 100)}%` }} /></div>
          <button onClick={() => void onAct("shoot", "10")} disabled={busy || locked || arrows >= totalArrows} className="arcade-button mt-5 w-full justify-center bg-amber-300 py-3 text-slate-950 shadow-[3px_3px_0_#fff] disabled:cursor-not-allowed disabled:opacity-50">{locked ? "SHOT LOCKED" : "RELEASE ARROW"}</button>
          <p className="mt-3 text-center text-[10px] font-bold text-white/50">Aim for the bullseye. Best score wins.</p>
        </aside>
      </div>
    </div>
  );
}
