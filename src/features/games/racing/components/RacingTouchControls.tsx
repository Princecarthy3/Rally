"use client";

import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { TouchInputState } from "../types";

export function RacingTouchControls({
  onTouchChange
}: {
  onTouchChange: (updater: (prev: TouchInputState) => TouchInputState) => void;
}) {
  function bindTouch(key: keyof TouchInputState) {
    const release = (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onTouchChange(prev => ({ ...prev, [key]: false }));
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onTouchChange(prev => ({ ...prev, [key]: true }));
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault()
    };
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex select-none items-end justify-between p-4 sm:p-6">
      {/* Bottom-Left: Steering Buttons (LEFT / RIGHT) */}
      <div className="pointer-events-auto flex gap-3">
        <button
          {...bindTouch("steerLeft")}
          aria-label="Steer Left"
          className="touch-none flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/20 bg-[#07131d]/75 text-white shadow-[0_10px_35px_rgba(0,0,0,.35)] backdrop-blur-xl active:scale-95 active:bg-cyan-400/80 sm:h-20 sm:w-20"
        >
          <ChevronLeft className="h-9 w-9" />
        </button>
        <button
          {...bindTouch("steerRight")}
          aria-label="Steer Right"
          className="touch-none flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-white/20 bg-[#07131d]/75 text-white shadow-[0_10px_35px_rgba(0,0,0,.35)] backdrop-blur-xl active:scale-95 active:bg-cyan-400/80 sm:h-20 sm:w-20"
        >
          <ChevronRight className="h-9 w-9" />
        </button>
      </div>

      {/* Center-Bottom: Handbrake Drift Button */}
      <div className="pointer-events-auto mb-2">
        <button
          {...bindTouch("handbrake")}
          aria-label="Handbrake Drift"
          className="touch-none flex h-14 items-center gap-2 rounded-2xl border-2 border-amber-400/40 bg-slate-900/70 px-5 font-black uppercase tracking-wider text-amber-300 shadow-xl backdrop-blur-md active:scale-95 active:bg-amber-500/90 active:text-slate-950"
        >
          <Zap className="h-5 w-5 fill-current" />
          <span>DRIFT</span>
        </button>
      </div>

      {/* Bottom-Right: Pedals (ACCELERATE / BRAKE) */}
      <div className="pointer-events-auto flex gap-3">
        <button
          {...bindTouch("brake")}
          aria-label="Brake or Reverse"
          className="touch-none flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-2xl border-2 border-red-400/40 bg-red-950/70 text-red-300 shadow-xl backdrop-blur-md active:scale-95 active:bg-red-600 active:text-white sm:h-20 sm:w-20"
        >
          <span className="text-xs font-black uppercase">BRAKE</span>
        </button>
        <button
          {...bindTouch("accelerate")}
          aria-label="Accelerate"
          className="touch-none flex h-[4.5rem] w-24 flex-col items-center justify-center rounded-2xl border-2 border-emerald-400/40 bg-emerald-950/75 text-emerald-300 shadow-xl backdrop-blur-md active:scale-95 active:bg-emerald-500 active:text-slate-950 sm:h-20 sm:w-24"
        >
          <span className="text-xs font-black uppercase">GAS</span>
        </button>
      </div>
    </div>
  );
}
