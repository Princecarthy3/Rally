"use client";

import { Flag, Waves } from "lucide-react";
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
  const [aim, setAim] = useState<{ angle: number; power: number } | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const hazards = useMemo(() => HOLE_HAZARDS[hole] || HOLE_HAZARDS[1], [hole]);
  const cup = state.cup || { x: 50, y: 12 };
  const difficultyLabel =
    hole <= 3 ? "Easy" : hole <= 6 ? "Medium" : "Hard";

  function setAimFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (!canShoot || !ball || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const dx = ((event.clientX - rect.left) / rect.width) * 100 - ball.x;
    const dy = ((event.clientY - rect.top) / rect.height) * 100 - ball.y;
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(40, Math.hypot(dx, dy));
    setAim({ angle, power: Math.max(8, dist) });
  }

  async function releaseShot() {
    if (!canShoot || !aim) return;
    sounds.playClickSound();
    await onAct("shoot", JSON.stringify({ angle: aim.angle, power: aim.power }));
    setAim(null);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 px-1">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-slate-950 bg-gradient-to-r from-emerald-800 to-green-700 px-3 py-2 text-white shadow-[3px_3px_0_#171821]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">
            Hole {hole} / 9 · Par {state.par || 3}
          </p>
          <p className="text-sm font-black">Difficulty: {difficultyLabel}</p>
        </div>
        <div className="text-right text-xs font-bold">
          <p>Your strokes: {ball?.strokes ?? 0}</p>
          <p className="text-emerald-100">Total: {scores[String(meSeat)] ?? 0}</p>
        </div>
      </div>

      <p className="text-center text-xs font-bold text-slate-600">
        {state.message || (canShoot ? "Drag to aim, release to putt" : "Waiting…")}
      </p>

      {/* Larger mobile-friendly green */}
      <div
        ref={fieldRef}
        onPointerDown={setAimFromPointer}
        onPointerMove={(e) => e.buttons === 1 && setAimFromPointer(e)}
        onPointerUp={() => void releaseShot()}
        onPointerLeave={() => aim && void releaseShot()}
        className={`relative mx-auto aspect-[3/4] w-full max-h-[70vh] touch-none overflow-hidden rounded-[28px] border-[3px] border-[#2d5a1b] shadow-[0_12px_0_#1a3a10,0_16px_24px_rgba(0,0,0,0.25)] ${
          canShoot ? "cursor-crosshair" : "cursor-default"
        }`}
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.12), transparent 50%),
            linear-gradient(160deg, #3d9e3a 0%, #2d7a2a 40%, #256b22 100%)
          `,
        }}
      >
        {/* Fairway stripes */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent, transparent 18px, rgba(0,0,0,0.08) 18px, rgba(0,0,0,0.08) 20px)",
          }}
        />

        {/* Hazards */}
        {hazards.map((h, i) => {
          if (h.type === "water") {
            return (
              <div
                key={i}
                className="absolute border border-sky-300/40 shadow-inner"
                style={{
                  left: h.left,
                  top: h.top,
                  width: h.width,
                  height: h.height,
                  borderRadius: h.radius || "12px",
                  background:
                    "linear-gradient(180deg, #38bdf8 0%, #0ea5e9 40%, #0284c7 100%)",
                }}
              >
                <Waves className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white/50" />
              </div>
            );
          }
          if (h.type === "sand") {
            return (
              <div
                key={i}
                className="absolute border border-amber-200/50"
                style={{
                  left: h.left,
                  top: h.top,
                  width: h.width,
                  height: h.height,
                  borderRadius: h.radius || "40%",
                  background: "radial-gradient(circle at 30% 30%, #fde68a, #d97706)",
                }}
              />
            );
          }
          if (h.type === "wall") {
            return (
              <div
                key={i}
                className="absolute rounded-sm border border-stone-600 bg-gradient-to-b from-stone-400 to-stone-700 shadow-md"
                style={{
                  left: h.left,
                  top: h.top,
                  width: h.width,
                  height: h.height,
                  transform: h.rotate ? `rotate(${h.rotate})` : undefined,
                }}
              />
            );
          }
          if (h.type === "rock") {
            return (
              <div
                key={i}
                className="absolute rounded-full bg-gradient-to-br from-stone-400 to-stone-700 shadow"
                style={{ left: h.left, top: h.top, width: h.size, height: h.size }}
              />
            );
          }
          if (h.type === "tree") {
            return (
              <div key={i} className="absolute" style={{ left: h.left, top: h.top }}>
                <div className="h-3 w-2 translate-x-[7px] rounded-sm bg-amber-900" />
                <div className="-mt-1 h-8 w-8 rounded-full bg-gradient-to-b from-green-500 to-green-800 shadow" />
              </div>
            );
          }
          if (h.type === "bridge") {
            return (
              <div
                key={i}
                className="absolute rounded-sm border border-amber-900/40 bg-gradient-to-b from-amber-700 to-amber-900"
                style={{ left: h.left, top: h.top, width: h.width, height: h.height }}
              />
            );
          }
          return null;
        })}

        {/* Cup */}
        <div
          className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${cup.x}%`, top: `${cup.y}%` }}
        >
          <Flag size={16} className="text-white drop-shadow" />
          <div className="h-4 w-4 rounded-full border-2 border-white/80 bg-slate-900 shadow-inner" />
        </div>

        {/* Balls */}
        {players.map((p, idx) => {
          const b = balls[String(p.seat)];
          if (!b) return null;
          const colors = ["#f8fafc", "#fde047", "#fb7185", "#38bdf8"];
          return (
            <div
              key={p.seat}
              className="absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/30 shadow-md transition-all duration-300 sm:h-5 sm:w-5"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                background: colors[idx % colors.length],
                opacity: b.finished ? 0.35 : 1,
              }}
              title={p.profile?.display_name || `P${p.seat}`}
            />
          );
        })}

        {/* Aim line */}
        {aim && ball && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1={`${ball.x}%`}
              y1={`${ball.y}%`}
              x2={`${ball.x + Math.cos(aim.angle) * aim.power}%`}
              y2={`${ball.y + Math.sin(aim.angle) * aim.power}%`}
              stroke="white"
              strokeWidth="2"
              strokeDasharray="4 3"
              opacity="0.85"
            />
          </svg>
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
