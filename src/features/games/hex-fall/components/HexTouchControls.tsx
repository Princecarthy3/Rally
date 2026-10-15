"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { HexTouchInputs } from "../types";

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
}

function subscribeTouch(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener?.("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener?.("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

/**
 * Simple analog stick for Hex Fall.
 * Writes movement to the parent ref immediately (no lag).
 * Stick up → forward down the path (+Z).
 */
export function HexTouchControls({
  onInputsChange,
}: {
  onInputsChange: (inputs: HexTouchInputs) => void;
}) {
  const visible = useSyncExternalStore(subscribeTouch, isTouchDevice, () => false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [jumpPressed, setJumpPressed] = useState(false);
  const [divePressed, setDivePressed] = useState(false);
  const [active, setActive] = useState(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const tid = useRef<number | null>(null);
  const inputs = useRef<HexTouchInputs>({ moveX: 0, moveY: 0, jump: false, dive: false });

  const emit = useCallback(
    (patch: Partial<HexTouchInputs>) => {
      inputs.current = { ...inputs.current, ...patch };
      onInputsChange(inputs.current);
    },
    [onInputsChange]
  );

  useEffect(() => {
    const release = () => {
      tid.current = null;
      origin.current = null;
      setStickPos({ x: 0, y: 0 });
      setActive(false);
      setJumpPressed(false);
      setDivePressed(false);
      emit({ moveX: 0, moveY: 0, jump: false, dive: false });
    };
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [emit]);

  if (!visible) return null;

  const MAX_R = 70;

  const onStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (tid.current !== null) return;
    const t = e.changedTouches[0];
    tid.current = t.identifier;
    origin.current = { x: t.clientX, y: t.clientY };
    setActive(true);
    setStickPos({ x: 0, y: 0 });
  };

  const onMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (tid.current === null || !origin.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== tid.current) continue;

      const dx = t.clientX - origin.current.x;
      const dy = t.clientY - origin.current.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, MAX_R);
      const angle = Math.atan2(dy, dx);
      const sx = Math.cos(angle) * clamped;
      const sy = Math.sin(angle) * clamped;

      // Immediate input — do not wait for rAF
      const mag = dist < 4 ? 0 : clamped / MAX_R;
      const mx = dist < 4 ? 0 : Math.cos(angle) * mag;
      const my = dist < 4 ? 0 : -Math.sin(angle) * mag; // screen-up → +moveY → +Z forward

      setStickPos({ x: sx, y: sy });
      emit({ moveX: mx, moveY: my });
      break;
    }
  };

  const onEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== tid.current) continue;
      tid.current = null;
      origin.current = null;
      setActive(false);
      setStickPos({ x: 0, y: 0 });
      emit({ moveX: 0, moveY: 0 });
      break;
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] select-none">
      <div
        className={`pointer-events-auto absolute bottom-5 left-4 h-48 w-48 touch-none rounded-full border-2 shadow-[0_10px_40px_rgba(0,0,0,.45)] backdrop-blur-md ${
          active ? "border-sky-300/70 bg-sky-500/30" : "border-white/30 bg-black/40"
        }`}
        style={{ touchAction: "none", WebkitUserSelect: "none" }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onTouchCancel={onEnd}
      >
        <div className="absolute inset-4 rounded-full border border-white/20" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[4.5rem] w-[4.5rem] rounded-full border-2 border-white/80 bg-gradient-to-b from-sky-300 to-sky-500 shadow-lg"
          style={{
            transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
          }}
        />
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wider text-white/80">
          Move
        </span>
      </div>

      <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-center gap-3">
        <button
          type="button"
          className={`flex h-[4.5rem] w-[4.5rem] touch-none items-center justify-center rounded-full border-2 border-slate-950 text-xs font-black uppercase shadow-[3px_3px_0_#0f172a] ${
            divePressed ? "bg-amber-200" : "bg-amber-400"
          }`}
          style={{ touchAction: "none" }}
          onTouchStart={(e) => {
            e.preventDefault();
            setDivePressed(true);
            emit({ dive: true });
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            setDivePressed(false);
            emit({ dive: false });
          }}
          onTouchCancel={() => {
            setDivePressed(false);
            emit({ dive: false });
          }}
        >
          Dive
        </button>
        <button
          type="button"
          className={`flex h-[5.5rem] w-[5.5rem] touch-none items-center justify-center rounded-full border-2 border-slate-950 text-sm font-black uppercase shadow-[4px_4px_0_#0f172a] ${
            jumpPressed ? "bg-emerald-200" : "bg-emerald-400"
          }`}
          style={{ touchAction: "none" }}
          onTouchStart={(e) => {
            e.preventDefault();
            setJumpPressed(true);
            emit({ jump: true });
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            setJumpPressed(false);
            emit({ jump: false });
          }}
          onTouchCancel={() => {
            setJumpPressed(false);
            emit({ jump: false });
          }}
        >
          Jump
        </button>
      </div>
    </div>
  );
}
