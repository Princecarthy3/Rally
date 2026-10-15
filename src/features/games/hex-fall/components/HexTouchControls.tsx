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
 * Always visible on phones/tablets — including landscape
 * (previous `sm:hidden` hid controls once width ≥ 640px).
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
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchId = useRef<number | null>(null);
  const currentInputs = useRef<HexTouchInputs>({ moveX: 0, moveY: 0, jump: false, dive: false });

  const push = useCallback(
    (patch: Partial<HexTouchInputs>) => {
      currentInputs.current = { ...currentInputs.current, ...patch };
      onInputsChange(currentInputs.current);
    },
    [onInputsChange]
  );

  // Release all inputs if the tab loses focus mid-touch
  useEffect(() => {
    const release = () => {
      touchId.current = null;
      touchOrigin.current = null;
      setStickPos({ x: 0, y: 0 });
      setJumpPressed(false);
      setDivePressed(false);
      push({ moveX: 0, moveY: 0, jump: false, dive: false });
    };
    window.addEventListener("blur", release);
    return () => window.removeEventListener("blur", release);
  }, [push]);

  if (!visible) return null;

  const handleStickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchId.current !== null) return;
    const touch = e.changedTouches[0];
    touchId.current = touch.identifier;
    touchOrigin.current = { x: touch.clientX, y: touch.clientY };
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
      const maxRadius = 52;
      const dist = Math.hypot(dx, dy) || 1;
      const scale = Math.min(1, maxRadius / dist);
      const stickX = dx * scale;
      const stickY = dy * scale;
      setStickPos({ x: stickX, y: stickY });
      // Screen up = forward (−Z / negative moveY in game uses moveY as Z)
      push({
        moveX: stickX / maxRadius,
        moveY: stickY / maxRadius,
      });
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
      setStickPos({ x: 0, y: 0 });
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
      {/* Virtual joystick — bottom left */}
      <div
        className="pointer-events-auto absolute bottom-6 left-5 h-40 w-40 touch-none rounded-full border-2 border-white/30 bg-black/40 shadow-[0_8px_32px_rgba(0,0,0,.45)] backdrop-blur-md"
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        onTouchCancel={handleStickEnd}
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border border-white/20 bg-white/5" />
        </div>
        <div
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50 bg-sky-400/90 shadow-lg"
          style={{ transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))` }}
        />
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-white/70">
          Move
        </span>
      </div>

      {/* Action buttons — bottom right */}
      <div className="pointer-events-auto absolute bottom-6 right-5 flex flex-col items-center gap-3">
        <button
          type="button"
          className={`flex h-16 w-16 touch-none items-center justify-center rounded-full border-2 border-slate-950 text-xs font-black uppercase shadow-[3px_3px_0_#0f172a] active:translate-y-0.5 ${
            divePressed ? "bg-amber-300 text-slate-950" : "bg-amber-400/95 text-slate-950"
          }`}
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
          className={`flex h-20 w-20 touch-none items-center justify-center rounded-full border-2 border-slate-950 text-sm font-black uppercase shadow-[4px_4px_0_#0f172a] active:translate-y-0.5 ${
            jumpPressed ? "bg-emerald-300 text-slate-950" : "bg-emerald-400 text-slate-950"
          }`}
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
