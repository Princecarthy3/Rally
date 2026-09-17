"use client";

import { Flag, RotateCcw, Waves } from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";

type Ball = { x: number; y: number; strokes: number; finished?: boolean; lost?: boolean };
type MiniGolfState = { hole?: number; par?: number; turn?: number; obstacle?: string; difficulty?: number; cup?: { x: number; y: number }; balls?: Record<string, Ball>; scores?: Record<string, number>; message?: string };

type WaterHazard = Pick<CSSProperties, "left" | "top" | "width" | "height">;
const COURSE_ART: Record<number, { water?: WaterHazard; sand?: string; wall?: string }> = {
  1: { sand: "left-[33%] top-[12%] h-[28%] w-[30%]", wall: "left-[12%] top-[52%] h-3 w-[52%]" },
  2: { water: { left: "43%", top: "0%", width: "14%", height: "68%" }, sand: "right-[12%] bottom-[12%] h-[23%] w-[25%]" },
  3: { sand: "left-[18%] top-[16%] h-[24%] w-[36%]", wall: "right-[14%] top-[42%] h-3 w-[45%]" },
  4: { sand: "left-[18%] top-[43%] h-[15%] w-[38%]", wall: "right-[12%] top-[18%] h-3 w-[42%]" },
  5: { water: { left: "43%", top: "0%", width: "14%", height: "68%" }, wall: "left-[12%] bottom-[23%] h-3 w-[47%]" },
  6: { sand: "left-[14%] bottom-[12%] h-[25%] w-[29%]", wall: "right-[11%] top-[29%] h-3 w-[47%]" },
  7: { sand: "left-[30%] bottom-[8%] h-[20%] w-[42%]", wall: "right-[10%] top-[25%] h-3 w-[36%]" },
  8: { water: { left: "43%", top: "0%", width: "14%", height: "68%" }, wall: "left-[11%] bottom-[18%] h-3 w-[39%]" },
  9: { sand: "right-[11%] top-[12%] h-[25%] w-[28%]", wall: "left-[15%] top-[49%] h-3 w-[49%]" },
};

export function MiniGolf({ room, players, meSeat, onAct, busy }: { room: Room; players: RoomPlayer[]; meSeat: number; onAct: (action: string, value?: string) => Promise<void>; busy?: boolean }) {
  const state = (room.public_state || {}) as MiniGolfState;
  const hole = state.hole || 1;
  const balls = state.balls || {};
  const scores = state.scores || {};
  const ball = balls[String(meSeat)];
  const canShoot = state.turn === meSeat && !ball?.finished && !busy;
  const [aim, setAim] = useState<{ angle: number; power: number } | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const art = COURSE_ART[hole] || COURSE_ART[1];

  function setAimFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!canShoot || !ball || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const dx = ((event.clientX - rect.left) / rect.width) * 100 - ball.x;
    const dy = ((event.clientY - rect.top) / rect.height) * 100 - ball.y;
    setAim({ angle: Math.atan2(dy, dx) * 180 / Math.PI, power: Math.min(100, Math.max(14, Math.hypot(dx, dy) * 1.5)) });
  }

  async function shoot(event: React.PointerEvent<HTMLDivElement>) {
    if (!canShoot || !aim) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const shot = aim;
    setAim(null);
    await onAct("shoot", JSON.stringify(shot));
  }

  return <div className="mx-auto max-w-2xl space-y-4">
    <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Live Mini Golf</p><h3 className="text-2xl font-black">Hole {hole} of 9 <span className="text-sm text-slate-400">PAR {state.par || 3}</span></h3></div><div className="flex gap-2 text-xs font-black">{players.map((player) => <span key={player.seat} className="rounded-full bg-slate-100 px-3 py-1">P{player.seat}: {scores[String(player.seat)] || 0}</span>)}</div></div>
    <p className="text-center text-xs font-bold text-slate-500">Four strokes max · {state.obstacle || "Open fairway"} · <span className="text-amber-600">Difficulty {"★".repeat(Math.min(5, state.difficulty || Math.ceil(hole / 2)))}{"☆".repeat(Math.max(0, 5 - Math.min(5, state.difficulty || Math.ceil(hole / 2))))}</span></p>
    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-950"><span>{state.message || "Line up your putt."}</span><span>{ball?.finished ? "Hole complete" : canShoot ? "YOUR TURN" : `Player ${state.turn || 1} is putting`}</span></div>
    <div ref={fieldRef} onPointerDown={(event) => { if (canShoot) { event.currentTarget.setPointerCapture(event.pointerId); setAimFromPointer(event); } }} onPointerMove={setAimFromPointer} onPointerUp={shoot} className={`relative aspect-[1.55] touch-none select-none overflow-hidden rounded-[28px] border-4 border-[#155434] bg-[#79d56d] shadow-[5px_5px_0_#171821] ${canShoot ? "cursor-crosshair" : "cursor-not-allowed"}`} aria-label={canShoot ? "Drag from your ball to aim and release to putt" : "Mini golf course"}>
      <div className="absolute inset-2 rounded-[20px] border-2 border-[#b7ef94]" /><div className="absolute inset-x-0 top-[21%] h-px bg-emerald-900/10" /><div className="absolute inset-x-0 top-[72%] h-px bg-emerald-900/10" />
      {art.water && <div className="absolute z-10 overflow-hidden rounded-full border-2 border-cyan-200 bg-cyan-500/90 shadow-[inset_0_0_14px_rgba(255,255,255,.45)]" style={art.water}><Waves className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90" size={22} /></div>}{art.sand && <div className={`absolute rounded-[45%] border-2 border-amber-300 bg-[#f4d47f] ${art.sand}`} />}{art.wall && <div className={`absolute rounded-full bg-[#684a35] shadow-[0_2px_0_#a27b58] ${art.wall}`} />}
      {state.cup && <><div className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-slate-900" style={{ left: `${state.cup.x}%`, top: `${state.cup.y}%` }} /><div className="absolute h-11 w-1 -translate-x-1/2 -translate-y-full bg-white" style={{ left: `${state.cup.x}%`, top: `${state.cup.y}%` }} /><Flag className="absolute -translate-y-[calc(100%+4px)] text-red-500" style={{ left: `calc(${state.cup.x}% - 1px)`, top: `${state.cup.y}%` }} size={24} fill="currentColor" /></>}
      {aim && ball && <div className="pointer-events-none absolute h-0.5 origin-left border-t-2 border-dashed border-slate-950/70" style={{ left: `${ball.x}%`, top: `${ball.y}%`, width: `${Math.min(30, aim.power * .35)}%`, transform: `rotate(${aim.angle}deg)` }} />}
      {players.map((player) => { const playerBall = balls[String(player.seat)]; if (!playerBall || playerBall.finished) return null; return <div key={player.seat} className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-slate-950 text-[10px] font-black shadow-[2px_2px_0_#171821] transition-all duration-500" style={{ left: `${playerBall.x}%`, top: `${playerBall.y}%`, backgroundColor: ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"][player.seat - 1] }}>P{player.seat}</div>; })}
      {canShoot && <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black">DRAG FROM YOUR BALL TO AIM</p>}
    </div>
    <div className="grid gap-2 sm:grid-cols-2">{players.map((player) => { const playerBall = balls[String(player.seat)]; return <div key={player.seat} className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold"><span>Player {player.seat}</span><span>{playerBall?.lost ? "✖ Lost hole" : playerBall?.finished ? "⛳ Finished" : `${playerBall?.strokes || 0}/4 strokes`}</span></div>; })}</div>
    {aim && <p className="text-center text-xs font-bold text-slate-500">Power {Math.round(aim.power)}% · release to putt <RotateCcw className="inline" size={13} /></p>}
  </div>;
}
