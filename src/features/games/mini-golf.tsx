"use client";

import { Flag } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";

type Ball = { x: number; y: number; strokes: number; finished?: boolean; lost?: boolean };
type MiniGolfState = {
  hole?: number;
  par?: number;
  turn?: number;
  cup?: { x: number; y: number };
  balls?: Record<string, Ball>;
  scores?: Record<string, number>;
  message?: string;
};

type Hazard =
  | { type: "water"; left: string; top: string; width: string; height: string; radius?: string }
  | { type: "sand"; left: string; top: string; width: string; height: string; radius?: string }
  | { type: "wall"; left: string; top: string; width: string; height: string; rotate?: string }
  | { type: "rock"; left: string; top: string; size: string }
  | { type: "tree"; left: string; top: string }
  | { type: "bridge"; left: string; top: string; width: string; height: string };

/** Unique obstacle layouts that get harder as the hole number rises */
const HOLE_HAZARDS: Record<number, Hazard[]> = {
  1: [
    { type: "sand", left: "30%", top: "18%", width: "28%", height: "22%", radius: "40%" },
    { type: "wall", left: "14%", top: "55%", width: "48%", height: "10px" },
  ],
  2: [
    { type: "water", left: "40%", top: "0%", width: "18%", height: "70%", radius: "0 0 40% 40%" },
    { type: "sand", left: "62%", top: "62%", width: "24%", height: "20%", radius: "50%" },
    { type: "rock", left: "22%", top: "40%", size: "14px" },
  ],
  3: [
    { type: "tree", left: "18%", top: "22%" },
    { type: "tree", left: "72%", top: "28%" },
    { type: "wall", left: "28%", top: "48%", width: "44%", height: "10px", rotate: "-8deg" },
    { type: "sand", left: "8%", top: "60%", width: "30%", height: "18%", radius: "40%" },
  ],
  4: [
    { type: "water", left: "8%", top: "30%", width: "34%", height: "28%", radius: "50%" },
    { type: "wall", left: "50%", top: "20%", width: "10px", height: "45%" },
    { type: "rock", left: "58%", top: "55%", size: "16px" },
    { type: "sand", left: "62%", top: "8%", width: "26%", height: "16%", radius: "40%" },
  ],
  5: [
    { type: "water", left: "36%", top: "0%", width: "16%", height: "55%", radius: "0 0 50% 50%" },
    { type: "bridge", left: "34%", top: "42%", width: "20%", height: "10px" },
    { type: "wall", left: "10%", top: "70%", width: "40%", height: "10px" },
    { type: "tree", left: "70%", top: "60%" },
  ],
  6: [
    { type: "sand", left: "12%", top: "12%", width: "22%", height: "20%", radius: "50%" },
    { type: "sand", left: "66%", top: "55%", width: "24%", height: "22%", radius: "45%" },
    { type: "wall", left: "35%", top: "35%", width: "42%", height: "10px", rotate: "15deg" },
    { type: "rock", left: "48%", top: "58%", size: "18px" },
    { type: "tree", left: "20%", top: "48%" },
  ],
  7: [
    { type: "water", left: "15%", top: "15%", width: "28%", height: "25%", radius: "50%" },
    { type: "water", left: "55%", top: "45%", width: "30%", height: "28%", radius: "50%" },
    { type: "wall", left: "42%", top: "10%", width: "10px", height: "40%" },
    { type: "rock", left: "40%", top: "55%", size: "14px" },
    { type: "rock", left: "50%", top: "62%", size: "12px" },
  ],
  8: [
    { type: "water", left: "0%", top: "35%", width: "100%", height: "14%" },
    { type: "bridge", left: "40%", top: "35%", width: "20%", height: "14%" },
    { type: "sand", left: "8%", top: "55%", width: "28%", height: "18%", radius: "40%" },
    { type: "wall", left: "60%", top: "8%", width: "10px", height: "28%" },
    { type: "tree", left: "75%", top: "60%" },
  ],
  9: [
    { type: "water", left: "20%", top: "8%", width: "22%", height: "22%", radius: "50%" },
    { type: "water", left: "55%", top: "28%", width: "20%", height: "20%", radius: "50%" },
    { type: "sand", left: "10%", top: "55%", width: "26%", height: "20%", radius: "40%" },
    { type: "wall", left: "40%", top: "48%", width: "45%", height: "10px", rotate: "-12deg" },
    { type: "rock", left: "48%", top: "20%", size: "16px" },
    { type: "tree", left: "78%", top: "55%" },
    { type: "tree", left: "12%", top: "30%" },
  ],
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
  const balls = state.balls || {};
  const scores = state.scores || {};
  const ball = balls[String(meSeat)];
  const canShoot = state.turn === meSeat && !ball?.finished && !busy;
  const [aim, setAim] = useState<{ angle: number; power: number; visual: number } | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const hazards = useMemo(() => HOLE_HAZARDS[hole] || HOLE_HAZARDS[1], [hole]);
  const cup = state.cup || { x: 50, y: 12 };
  const difficultyLabel =
    hole <= 3 ? "Easy" : hole <= 6 ? "Medium" : "Hard";
  const asPercent = (value: string | undefined, fallback = 0) => {
    if (!value) return fallback;
    const parsed = Number.parseFloat(value);
    return value.endsWith("%") ? parsed : parsed * 1.25;
  };

  function setAimFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!canShoot || !ball || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const dx = ((event.clientX - rect.left) / rect.width) * 100 - ball.x;
    const dy = ((event.clientY - rect.top) / rect.height) * 100 - ball.y;
    // Server accepts radians or degrees; we send radians + power 14-100
    const angle = Math.atan2(dy, dx);
    // Visual aim length stays capped (control feel); power is scaled separately for the server
    const visual = Math.min(28, Math.hypot(dx, dy));
    const power = Math.max(14, Math.min(100, Math.hypot(dx, dy) * 2.4));
    setAim({ angle, power, visual });
  }

  async function releaseShot() {
    if (!canShoot || !aim || aim.power < 14) return;
    sounds.playClickSound();
    await onAct(
      "shoot",
      JSON.stringify({ angle: aim.angle, power: aim.power })
    );
    setAim(null);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 px-1">
      <style>{"@keyframes golf-roll{0%{transform:rotate(0) scale(1)}35%{transform:rotate(240deg) scale(1.18)}100%{transform:rotate(720deg) scale(1)}}"}</style>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-slate-950 bg-gradient-to-r from-emerald-800 to-green-700 px-3 py-2 text-white shadow-[3px_3px_0_#171821]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">
            Hole {hole} / 9 · Par {state.par || 3} · Max 4 strokes
          </p>
          <p className="text-sm font-black">Difficulty: {difficultyLabel}</p>
        </div>
        <div className="text-right text-xs font-bold">
          <p>Strokes: {ball?.strokes ?? 0}/4</p>
          <p className="text-emerald-100">Score: {scores[String(meSeat)] ?? 0}</p>
        </div>
      </div>

      <p className="text-center text-xs font-bold text-slate-600">
        {state.message ||
          (canShoot
            ? "Drag toward the cup, release to putt (max 4 strokes — miss = no points)"
            : "Waiting…")}
      </p>

      {/* Larger mobile-friendly green */}
      <div
        ref={fieldRef}
        onPointerDown={setAimFromPointer}
        onPointerMove={(e) => e.buttons === 1 && setAimFromPointer(e)}
        onPointerUp={() => void releaseShot()}
        onPointerCancel={() => setAim(null)}
        className={`relative mx-auto aspect-[3/4] w-full max-h-[70vh] touch-none overflow-hidden rounded-[28px] border-[3px] border-[#2d5a1b] shadow-[0_12px_0_#1a3a10,0_16px_24px_rgba(0,0,0,0.25)] ${
          canShoot ? "cursor-crosshair" : "cursor-default"
        }`}
        style={{ background: "linear-gradient(145deg,#58b64e 0%,#31883c 48%,#175d32 100%)" }}
      >
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="golf-turf" x2="0" y2="1"><stop stopColor="#b8ee81" stopOpacity=".18"/><stop offset="1" stopColor="#073d25" stopOpacity=".28"/></linearGradient>
            <linearGradient id="golf-water" x2="0" y2="1"><stop stopColor="#8af4ff"/><stop offset=".48" stopColor="#24aee9"/><stop offset="1" stopColor="#07559b"/></linearGradient>
            <linearGradient id="golf-sand" x2="0" y2="1"><stop stopColor="#fff2ad"/><stop offset="1" stopColor="#d48a32"/></linearGradient>
            <linearGradient id="golf-wood" x2="0" y2="1"><stop stopColor="#f4c274"/><stop offset="1" stopColor="#81502b"/></linearGradient>
            <radialGradient id="golf-rock"><stop stopColor="#d7e2d0"/><stop offset="1" stopColor="#52645a"/></radialGradient>
            <radialGradient id="golf-ball" cx="32%" cy="25%"><stop stopColor="white"/><stop offset=".5" stopColor="#f3f7ff"/><stop offset="1" stopColor="#aab6c9"/></radialGradient>
            <filter id="golf-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
          </defs>
          <rect width="100" height="100" fill="url(#golf-turf)" />
          {Array.from({length: 10}, (_, i) => <path key={`stripe-${i}`} d={`M${i * 11} 0v100`} stroke="#d9ffb2" strokeOpacity=".035" strokeWidth="5" />)}
          {hazards.map((h, i) => {
            const x = asPercent(h.left), y = asPercent(h.top), w = asPercent("width" in h ? h.width : undefined, 5), ht = asPercent("height" in h ? h.height : undefined, 5);
            if (h.type === "water") return <g key={i}><ellipse cx={x+w/2} cy={y+ht/2+1} rx={w/2} ry={ht/2} fill="#083b42" opacity=".4"/><ellipse cx={x+w/2} cy={y+ht/2} rx={w/2} ry={ht/2} fill="url(#golf-water)" stroke="#b5f8ff" strokeOpacity=".7" strokeWidth=".7"/><path d={`M${x+w*.2} ${y+ht*.42}q${w*.12} -2 ${w*.24} 0t${w*.24} 0`} fill="none" stroke="white" strokeOpacity=".65" strokeWidth=".7"/></g>;
            if (h.type === "sand") return <g key={i}><ellipse cx={x+w/2} cy={y+ht/2+1} rx={w/2} ry={ht/2} fill="#593e1f" opacity=".3"/><ellipse cx={x+w/2} cy={y+ht/2} rx={w/2} ry={ht/2} fill="url(#golf-sand)" stroke="#fff1b1" strokeWidth=".6"/><path d={`M${x+w*.18} ${y+ht*.45}q${w*.28} ${ht*.25} ${w*.62} -.04`} fill="none" stroke="#fff9d8" strokeOpacity=".55" strokeWidth=".45"/></g>;
            if (h.type === "wall" || h.type === "bridge") {
              const horizontal = h.type === "bridge" || w > ht;
              const rw = h.type === "bridge" ? w : horizontal ? w : Math.max(w, 2.3), rh = h.type === "bridge" ? Math.max(ht, 2) : horizontal ? Math.max(ht, 2.3) : ht;
              return <g key={i} transform={h.type === "wall" && h.rotate ? `rotate(${Number.parseFloat(h.rotate)} ${x+w/2} ${y+ht/2})` : undefined}><rect x={x} y={y+1} width={rw} height={rh} rx="1.2" fill="#092e20" opacity=".35"/><rect x={x} y={y} width={rw} height={rh} rx="1.2" fill={h.type === "bridge" ? "url(#golf-wood)" : "#747d76"} stroke={h.type === "bridge" ? "#ffdda2" : "#d7e0d4"} strokeWidth=".55"/><path d={`M${x+1} ${y+rh*.28}h${rw-2}`} stroke="white" strokeOpacity=".4" strokeWidth=".45"/></g>;
            }
            if (h.type === "rock") { const r = Math.max(asPercent(h.size) / 2, 1); return <g key={i}><ellipse cx={x+r} cy={y+r+1} rx={r} ry={r*.65} fill="#072a1c" opacity=".4"/><circle cx={x+r} cy={y+r} r={r} fill="url(#golf-rock)" stroke="#e2eadf" strokeOpacity=".65" strokeWidth=".4"/></g>; }
            return <g key={i}><ellipse cx={x+2.5} cy={y+5} rx="3.8" ry="1.2" fill="#073b20" opacity=".35"/><path d={`M${x+2.5} ${y+5}v-2.5`} stroke="#79502d" strokeWidth="1.4"/><circle cx={x+2.5} cy={y+1.8} r="3.2" fill="#126333"/><circle cx={x+1.5} cy={y+1} r="1.5" fill="#48a84e"/><circle cx={x+3.4} cy={y+1} r="1.6" fill="#2c873e"/></g>;
          })}
        </svg>

        {/* Cup */}
        <div
          className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${cup.x}%`, top: `${cup.y}%` }}
        >
          <Flag size={16} className="text-white drop-shadow" />
          <div className="h-4 w-4 rounded-full border-2 border-white/80 bg-slate-950 shadow-[inset_0_2px_4px_#000,0_2px_5px_#0008]" />
        </div>

        {/* Balls */}
        {players.map((p, idx) => {
          const b = balls[String(p.seat)];
          if (!b) return null;
          const colors = ["#f8fafc", "#fde047", "#fb7185", "#38bdf8"];
          return (
            <div
              key={p.seat}
              className="absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-out sm:h-6 sm:w-6"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                opacity: b.finished ? 0.35 : 1,
                filter: "drop-shadow(0 4px 2px #09281999)",
              }}
              title={p.profile?.display_name || `P${p.seat}`}
            ><svg key={b.strokes} viewBox="0 0 32 32" className="h-full w-full overflow-visible" style={b.strokes ? { animation: "golf-roll 650ms cubic-bezier(.2,.75,.3,1)" } : undefined}><defs><radialGradient id={`ball-${p.seat}`} cx="30%" cy="24%"><stop stopColor="#fff"/><stop offset=".38" stopColor={colors[idx % colors.length]}/><stop offset="1" stopColor="#334155"/></radialGradient></defs><ellipse cx="16" cy="28" rx="10" ry="3" fill="#061b12" opacity=".38"/><circle cx="16" cy="15" r="12" fill={`url(#ball-${p.seat})`} stroke="white" strokeOpacity=".8" strokeWidth="1.4"/><ellipse cx="12" cy="10" rx="4" ry="2.4" fill="white" opacity=".72"/><path d="M8 19q8 3 16 0" fill="none" stroke="white" strokeOpacity=".3" strokeWidth=".8"/></svg></div>
          );
        })}

        {/* Aim line */}
        {aim && ball && (
          <>
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <line
                x1={`${ball.x}%`}
                y1={`${ball.y}%`}
                x2={`${ball.x + Math.cos(aim.angle) * aim.visual}%`}
                y2={`${ball.y + Math.sin(aim.angle) * aim.visual}%`}
                stroke="#fff5b1"
                strokeWidth="0.7"
                strokeDasharray="1.4 1"
                opacity="0.95"
              />
              <circle cx={`${ball.x}%`} cy={`${ball.y}%`} r="3.2%" fill="none" stroke="#fff5b1" strokeOpacity=".55" strokeWidth=".55" />
            </svg>
            <div
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-lg border-2 border-slate-950 bg-white px-2 py-0.5 text-[11px] font-black shadow-[2px_2px_0_#171821]"
              style={{
                left: `${ball.x + Math.cos(aim.angle) * aim.visual}%`,
                top: `${ball.y + Math.sin(aim.angle) * aim.visual}%`,
              }}
            >
              <span className="flex items-center gap-1.5">⛳ Power {Math.round(aim.power)}</span>
              <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-[width]" style={{ width: `${aim.power}%` }} /></span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {players.map((p) => (
          <div
            key={p.seat}
            className={`rounded-xl border-2 border-slate-950 px-2 py-1.5 text-center text-[11px] font-bold shadow-[2px_2px_0_#171821] ${
              state.turn === p.seat ? "bg-amber-200" : "bg-white"
            }`}
          >
            <p className="truncate">{p.profile?.display_name || `P${p.seat}`}</p>
            <p className="text-slate-500">{scores[String(p.seat)] ?? 0} strokes</p>
          </div>
        ))}
      </div>
    </div>
  );
}
