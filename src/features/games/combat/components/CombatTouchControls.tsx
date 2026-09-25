"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import type { TouchCombatInputs } from "../types";

const EMPTY: TouchCombatInputs = {
  moveDir: [0, 0],
  lightAttack: false,
  heavyAttack: false,
  block: false,
  dodge: false,
  special: false,
  jump: false,
};

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

function subscribePointer(onStoreChange: () => void) {
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener?.("change", onStoreChange);
  return () => mq.removeEventListener?.("change", onStoreChange);
}

export function CombatTouchControls({
  onInputsChange,
  onAttack,
  specialName,
  specialCooldown,
}: {
  onInputsChange: (inputs: TouchCombatInputs) => void;
  onAttack?: (type: "light" | "heavy" | "special") => void;
  specialName: string;
  specialCooldown: number;
}) {
  const visible = useSyncExternalStore(subscribePointer, isCoarsePointer, () => false);
  const inputsRef = useRef<TouchCombatInputs>({ ...EMPTY });
  const stickOrigin = useRef<{ x: number; y: number } | null>(null);
  const stickEl = useRef<HTMLDivElement>(null);

  const push = useCallback(
    (patch: Partial<TouchCombatInputs>) => {
      inputsRef.current = { ...inputsRef.current, ...patch };
      onInputsChange(inputsRef.current);
    },
    [onInputsChange]
  );

  const releaseAll = useCallback(() => {
    inputsRef.current = { ...EMPTY };
    stickOrigin.current = null;
    if (stickEl.current) stickEl.current.style.transform = "translate(0,0)";
    onInputsChange(inputsRef.current);
  }, [onInputsChange]);

  useEffect(() => {
    const up = () => releaseAll();
    window.addEventListener("blur", up);
    return () => window.removeEventListener("blur", up);
  }, [releaseAll]);

  if (!visible) return null;

  const onStickStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    stickOrigin.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const onStickMove = (e: ReactPointerEvent) => {
    if (!stickOrigin.current) return;
    e.preventDefault();
    const dx = e.clientX - stickOrigin.current.x;
    const dy = e.clientY - stickOrigin.current.y;
    const max = 42;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, max / len);
    const nx = (dx * scale) / max;
    const ny = (dy * scale) / max;
    if (stickEl.current) {
      stickEl.current.style.transform = `translate(${nx * max}px, ${ny * max}px)`;
    }
    // Forward = negative Z on screen up
    push({ moveDir: [nx, ny] });
  };

  const onStickEnd = (e: ReactPointerEvent) => {
    e.preventDefault();
    stickOrigin.current = null;
    if (stickEl.current) stickEl.current.style.transform = "translate(0,0)";
    push({ moveDir: [0, 0] });
  };

  const hold = (key: keyof TouchCombatInputs) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      push({ [key]: true } as Partial<TouchCombatInputs>);
    },
    onPointerUp: (e: ReactPointerEvent) => {
      e.preventDefault();
      push({ [key]: false } as Partial<TouchCombatInputs>);
    },
    onPointerCancel: () => push({ [key]: false } as Partial<TouchCombatInputs>),
  });

  const attackBtn = (type: "light" | "heavy" | "special", key: keyof TouchCombatInputs) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      push({ [key]: true } as Partial<TouchCombatInputs>);
      onAttack?.(type);
    },
    onPointerUp: (e: ReactPointerEvent) => {
      e.preventDefault();
      push({ [key]: false } as Partial<TouchCombatInputs>);
    },
    onPointerCancel: () => push({ [key]: false } as Partial<TouchCombatInputs>),
  });

  const specialReady = specialCooldown <= 0;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] select-none"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right))",
      }}
    >
      {/* Virtual stick — bottom left */}
      <div className="pointer-events-auto absolute bottom-4 left-4 sm:bottom-6 sm:left-6">
        <div
          className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-white/25 bg-slate-950/55 shadow-xl backdrop-blur-md"
          onPointerDown={onStickStart}
          onPointerMove={onStickMove}
          onPointerUp={onStickEnd}
          onPointerCancel={onStickEnd}
          style={{ touchAction: "none" }}
        >
          <div
            ref={stickEl}
            className="h-12 w-12 rounded-full border-2 border-white/40 bg-white/25 shadow-inner transition-transform duration-75"
          />
          <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-wider text-white/50">
            Move
          </span>
        </div>
      </div>

      {/* Action cluster — bottom right */}
      <div
        className="pointer-events-auto absolute bottom-4 right-4 grid grid-cols-3 gap-2 sm:bottom-6 sm:right-6"
        style={{ touchAction: "none" }}
      >
        <button
          type="button"
          {...hold("jump")}
          className="col-start-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-300/40 bg-emerald-950/80 text-[10px] font-black text-emerald-200 active:scale-95"
        >
          JUMP
        </button>
        <button
          type="button"
          {...hold("dodge")}
          className="col-start-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-sky-300/40 bg-sky-950/80 text-[10px] font-black text-sky-200 active:scale-95"
        >
          DODGE
        </button>
        <button
          type="button"
          {...attackBtn("light", "lightAttack")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-rose-300/50 bg-rose-600 text-[11px] font-black text-white shadow-lg active:scale-95"
        >
          LIGHT
        </button>
        <button
          type="button"
          {...attackBtn("heavy", "heavyAttack")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-300/50 bg-violet-600 text-[11px] font-black text-white shadow-lg active:scale-95"
        >
          HEAVY
        </button>
        <button
          type="button"
          {...hold("block")}
          className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-300/50 bg-amber-500 text-[11px] font-black text-slate-950 shadow-lg active:scale-95"
        >
          BLOCK
        </button>
        <button
          type="button"
          {...attackBtn("special", "special")}
          disabled={!specialReady}
          className={`col-span-3 mt-0.5 flex h-11 items-center justify-center rounded-2xl border-2 text-xs font-black shadow-lg active:scale-[0.98] disabled:opacity-40 ${
            specialReady
              ? "border-orange-300/60 bg-orange-500 text-slate-950"
              : "border-white/15 bg-slate-800 text-slate-400"
          }`}
        >
          {specialReady ? specialName : `Special ${specialCooldown.toFixed(1)}s`}
        </button>
      </div>
    </div>
  );
}
