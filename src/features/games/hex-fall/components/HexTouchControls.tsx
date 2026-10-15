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
 * Soft analog joystick — drag anywhere in the left pad.
 * Stick-up = forward relative to camera (handled in HexFallGame).
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
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchId = useRef<number | null>(null);
  const currentInputs = useRef<HexTouchInputs>({ moveX: 0, moveY: 0, jump: false, dive: false });
  const rafRef = useRef<number | null>(null);
  const pendingStick = useRef({ x: 0, y: 0, mx: 0, my: 0 });

  const push = useCallback(
    (patch: Partial<HexTouchInputs>) => {
      currentInputs.current = { ...currentInputs.current, ...patch };
      onInputsChange(currentInputs.current);
    },
    [onInputsChange]
  );

  // Coalesce visual updates to one per frame so dragging feels smooth
  const flushStickVisual = useCallback(() => {
    rafRef.current = null;
    setStickPos({ x: pendingStick.current.x, y: pendingStick.current.y });
    push({ moveX: pendingStick.current.mx, moveY: pendingStick.current.my });
  }, [push]);

  useEffect(() => {
    const release = () => {
      touchId.current = null;
      touchOrigin.current = null;
      setStickPos({ x: 0, y: 0 });
      setActive(false);
      setJumpPressed(false);
      setDivePressed(false);
      push({ moveX: 0, moveY: 0, jump: false, dive: false });
    };
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [push]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!visible) return null;

  const MAX_R = 64;
  const DEAD = 6; // px — soft center

  const handleStickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchId.current !== null) return;
    const touch = e.changedTouches[0];
    touchId.current = touch.identifier;
    // Origin = first contact so the whole pad is usable
    touchOrigin.current = { x: touch.clientX, y: touch.clientY };
    setActive(true);
    setStickPos({ x: 0, y: 0 });
  };

  const handleStickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchId.current === null || !touchOrigin.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== touchId.current) continue;

      const dx = touch.clientX - touchOrigin.current.x;
      const dy = touch.clientY - touchOrigin.current.y;
      const rawDist = Math.hypot(dx, dy);

      // Soft deadzone
      if (rawDist < DEAD) {
        pendingStick.current = { x: 0, y: 0, mx: 0, my: 0 };
      } else {
        const clamped = Math.min(rawDist, MAX_R);
        const angle = Math.atan2(dy, dx);
        const stickX = Math.cos(angle) * clamped;
        const stickY = Math.sin(angle) * clamped;
        // Normalize outside deadzone so edge of deadzone ≈ 0 speed
        const usable = (clamped - DEAD) / (MAX_R - DEAD);
        const nx = Math.cos(angle) * usable;
        const ny = Math.sin(angle) * usable;
        pendingStick.current = {
          x: stickX,
          y: stickY,
          // Screen up → positive moveY (forward)
          mx: nx,
          my: -ny,
        };
      }

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flushStickVisual);
      }
      break;
    }
  };

  const handleStickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier !== touchId.current) continue;
      touchId.current = null;
      touchOrigin.current = null;
      setActive(false);
      setStickPos({ x: 0, y: 0 });
      pendingStick.current = { x: 0, y: 0, mx: 0, my: 0 };
      push({ moveX: 0, moveY: 0 });
      break;
    }
  };

  const pressJump = (down: boolean) => {
    setJumpPressed(down);
    push({ jump: down });
  };
  const pressDive = (down: boolean) => {
    setDivePressed(down);
    push({ dive: down });
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] select-none">
      {/* Large soft pad — bottom left */}
      <div
        className={`pointer-events-auto absolute bottom-5 left-4 h-44 w-44 touch-none rounded-full border-2 shadow-[0_10px_40px_rgba(0,0,0,.4)] backdrop-blur-md transition-colors ${
          active ? "border-sky-300/60 bg-sky-500/25" : "border-white/25 bg-black/35"
        }`}
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        onTouchCancel={handleStickEnd}
        style={{ WebkitUserSelect: "none", userSelect: "none", touchAction: "none" }}
      >
        {/* Outer ring guide */}
        <div className="absolute inset-3 rounded-full border border-white/15" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[4.5rem] w-[4.5rem] rounded-full border border-dashed border-white/20 bg-white/5" />
        </div>
        {/* Thumb */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 rounded-full border-2 border-white/70 bg-gradient-to-b from-sky-300 to-sky-500 shadow-lg"
          style={{
            transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
            transition: active ? "none" : "transform 120ms ease-out",
          }}
        />
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-white/80">
          Move
        </span>
      </div>

      {/* Actions — bottom right */}
      <div className="pointer-events-auto absolute bottom-5 right-4 flex flex-col items-center gap-3">
        <button
          type="button"
          className={`flex h-[4.25rem] w-[4.25rem] touch-none items-center justify-center rounded-full border-2 border-slate-950 text-xs font-black uppercase shadow-[3px_3px_0_#0f172a] active:translate-y-0.5 ${
            divePressed ? "scale-95 bg-amber-200 text-slate-950" : "bg-amber-400 text-slate-950"
          }`}
          style={{ touchAction: "none" }}
          onTouchStart={(e) => {
            e.preventDefault();
            pressDive(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            pressDive(false);
          }}
          onTouchCancel={() => pressDive(false)}
        >
          Dive
        </button>
        <button
          type="button"
          className={`flex h-[5.25rem] w-[5.25rem] touch-none items-center justify-center rounded-full border-2 border-slate-950 text-sm font-black uppercase shadow-[4px_4px_0_#0f172a] active:translate-y-0.5 ${
            jumpPressed ? "scale-95 bg-emerald-200 text-slate-950" : "bg-emerald-400 text-slate-950"
          }`}
          style={{ touchAction: "none" }}
          onTouchStart={(e) => {
            e.preventDefault();
            pressJump(true);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            pressJump(false);
          }}
          onTouchCancel={() => pressJump(false)}
        >
          Jump
        </button>
      </div>
    </div>
  );
}
