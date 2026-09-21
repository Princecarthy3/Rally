"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";

type BBState = {
  turn?: number;
  round?: number;
  scores?: Record<string, number>;
  shots?: Record<string, number>;
  message?: string;
  lastResult?: "make" | "miss" | null;
  winnerSeat?: number;
};

const MAX_SHOTS = 5;
const GRAVITY = 0.45;

export function BasketballGame({
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
  const state = (room.public_state || {}) as BBState;
  const myTurn = Number(state.turn) === meSeat && !state.winnerSeat;
  const scores = state.scores || {};
  const shots = state.shots || {};
  const myShots = Number(shots[String(meSeat)] || 0);

  const courtRef = useRef<HTMLDivElement>(null);
  const [ball, setBall] = useState({ x: 50, y: 88, vx: 0, vy: 0, flying: false });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [aim, setAim] = useState<{ dx: number; dy: number } | null>(null);
  const [resultFlash, setResultFlash] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);

  // Sync flash from server message
  useEffect(() => {
    if (state.lastResult === "make") {
      setResultFlash("SWISH! 🔥");
      sounds.playTokenFinishSound();
    } else if (state.lastResult === "miss") {
      setResultFlash("Miss");
      sounds.playClickSound();
    }
    const t = setTimeout(() => setResultFlash(null), 900);
    return () => clearTimeout(t);
  }, [state.lastResult, room.state_version]);

  const launch = useCallback(
    (dx: number, dy: number) => {
      if (!myTurn || busy || ball.flying) return;
      // Pull back = opposite of release vector (iMessage style)
      const power = Math.min(22, Math.hypot(dx, dy) * 0.18);
      if (power < 3) return;
      const angle = Math.atan2(-Math.abs(dy) - 2, dx * 0.35); // mostly upward
      const vx = Math.cos(angle) * power * (dx >= 0 ? 1 : -1) * 0.35 + dx * 0.04;
      const vy = -Math.abs(Math.sin(angle) * power) - power * 0.35;

      setBall({ x: 50, y: 88, vx, vy, flying: true });
      sounds.playClickSound();

      let x = 50;
      let y = 88;
      let velX = vx;
      let velY = vy;
      let frames = 0;
      let scored = false;

      const tick = () => {
        frames += 1;
        velY += GRAVITY;
        x += velX * 0.9;
        y += velY * 0.9;

        // Rim / hoop region (center top)
        const rimX = 50;
        const rimY = 28;
        const distRim = Math.hypot(x - rimX, y - rimY);

        // Score if ball passes down through hoop
        if (!scored && y > rimY - 2 && y < rimY + 6 && Math.abs(x - rimX) < 7 && velY > 0) {
          scored = true;
        }

        // Bounce off backboard
        if (y < 18 && y > 8 && Math.abs(x - 50) < 14 && velY < 0) {
          velY *= -0.35;
          y = 18;
        }

        setBall({ x, y, vx: velX, vy: velY, flying: true });

        const out = y > 105 || x < -5 || x > 105 || frames > 120;
        if (out || (scored && y > rimY + 8)) {
          setBall({ x: 50, y: 88, vx: 0, vy: 0, flying: false });
          void onAct("shoot", scored ? "make" : "miss");
          return;
        }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [myTurn, busy, ball.flying, onAct]
  );

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  function pointerPos(e: React.PointerEvent) {
    const rect = courtRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <div className="flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-2 text-white shadow-[3px_3px_0_#171821]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-orange-100">Basketball</p>
          <p className="text-sm font-black">Best of {MAX_SHOTS} shots</p>
        </div>
        <div className="text-right text-xs font-bold">
          <p>
            You {scores[String(meSeat)] ?? 0} –{" "}
            {players
              .filter((p) => p.seat !== meSeat)
              .map((p) => scores[String(p.seat)] ?? 0)
              .join(", ") || "0"}
          </p>
          <p className="text-orange-100">
            Shot {Math.min(MAX_SHOTS, myShots + (myTurn ? 1 : 0))} / {MAX_SHOTS}
          </p>
        </div>
      </div>

      <p className="text-center text-xs font-bold text-slate-600">
        {state.message ||
          (myTurn ? "Pull back and release to shoot" : "Watch the other player…")}
      </p>

      <div
        ref={courtRef}
        className="relative mx-auto aspect-[3/4] w-full max-h-[68vh] touch-none overflow-hidden rounded-[28px] border-[3px] border-slate-950 shadow-[0_12px_0_#171821]"
        style={{
          background: "linear-gradient(180deg, #7dd3fc 0%, #7dd3fc 42%, #ea580c 42%, #c2410c 100%)",
        }}
        onPointerDown={(e) => {
          if (!myTurn || ball.flying || busy) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setDragStart(pointerPos(e));
          setAim({ dx: 0, dy: 0 });
        }}
        onPointerMove={(e) => {
          if (!dragging || !dragStart) return;
          const p = pointerPos(e);
          setAim({ dx: p.x - dragStart.x, dy: p.y - dragStart.y });
        }}
        onPointerUp={() => {
          if (!dragging || !aim) {
            setDragging(false);
            return;
          }
          setDragging(false);
          // Release: use opposite of drag (pull back)
          launch(-aim.dx, -aim.dy);
          setAim(null);
          setDragStart(null);
        }}
      >
        {/* Backboard */}
        <div className="absolute left-1/2 top-[10%] h-[12%] w-[28%] -translate-x-1/2 rounded-sm border-2 border-slate-300 bg-white/95 shadow-lg" />
        {/* Rim */}
        <div className="absolute left-1/2 top-[22%] h-[3%] w-[16%] -translate-x-1/2 rounded-full border-[3px] border-orange-600 bg-transparent shadow" />
        {/* Net */}
        <div className="absolute left-1/2 top-[24%] h-[10%] w-[14%] -translate-x-1/2 opacity-90">
          <svg viewBox="0 0 40 30" className="h-full w-full">
            {[0, 8, 16, 24, 32].map((x) => (
              <line key={x} x1={x + 4} y1="0" x2={20} y2="28" stroke="white" strokeWidth="1.2" />
            ))}
            <line x1="4" y1="0" x2="36" y2="0" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>
        {/* Pole */}
        <div className="absolute left-1/2 top-[34%] h-[8%] w-[3%] -translate-x-1/2 bg-slate-600" />

        {/* Court arc */}
        <div className="absolute bottom-[8%] left-1/2 h-[22%] w-[70%] -translate-x-1/2 rounded-t-full border-2 border-white/30" />

        {/* Aim guide */}
        {aim && dragStart && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <line
              x1="50%"
              y1="88%"
              x2={`${50 - aim.dx * 0.5}%`}
              y2={`${88 - Math.abs(aim.dy) * 0.5}%`}
              stroke="white"
              strokeWidth="2"
              strokeDasharray="5 4"
              opacity="0.8"
            />
          </svg>
        )}

        {/* Ball */}
        <div
          className="absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg sm:h-10 sm:w-10"
          style={{
            left: `${ball.x}%`,
            top: `${ball.y}%`,
            background: "radial-gradient(circle at 30% 30%, #fdba74, #ea580c 55%, #9a3412)",
            boxShadow: "inset -3px -3px 6px rgba(0,0,0,0.25), 2px 3px 6px rgba(0,0,0,0.35)",
          }}
        >
          <span className="text-[10px] font-black text-orange-950/40">●</span>
        </div>

        {resultFlash && (
          <div className="absolute inset-x-0 top-1/3 z-30 text-center text-2xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {resultFlash}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <div
            key={p.seat}
            className={`rounded-xl border-2 border-slate-950 px-3 py-2 text-center text-xs font-bold shadow-[2px_2px_0_#171821] ${
              Number(state.turn) === p.seat ? "bg-orange-200" : "bg-white"
            }`}
          >
            <p className="truncate">{p.profile?.display_name || `Player ${p.seat}`}</p>
            <p className="text-lg font-black text-orange-600">{scores[String(p.seat)] ?? 0}</p>
            <p className="text-[10px] text-slate-500">{shots[String(p.seat)] ?? 0}/{MAX_SHOTS} shots</p>
          </div>
        ))}
      </div>
    </div>
  );
}
