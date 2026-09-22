"use client";

import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { TouchInputState } from "../types";

export function RacingTouchControls({
  onTouchChange
}: {
  onTouchChange: (updater: (prev: TouchInputState) => TouchInputState) => void;
}) {
  function bindTouch(key: keyof TouchInputState) {
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onTouchChange(prev => ({ ...prev, [key]: true }));
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onTouchChange(prev => ({ ...prev, [key]: false }));
      },
      onPointerCancel: (e: React.PointerEvent) => {
        e.preventDefault();
        onTouchChange(prev => ({ ...prev, [key]: false }));
      }
    };
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex select-none items-end justify-between p-4 sm:p-6">
      {/* Bottom-Left: Steering Buttons (LEFT / RIGHT) */}
      <div className="pointer-events-auto flex gap-3">
        <button
          {...bindTouch("steerLeft")}
          aria-label="Steer Left"
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/30 bg-slate-900/65 text-white shadow-xl backdrop-blur-md active:scale-95 active:bg-amber-500/80 sm:h-20 sm:w-20"
        >
          <ChevronLeft className="h-9 w-9" />
        </button>
        <button
          {...bindTouch("steerRight")}
          aria-label="Steer Right"
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white/30 bg-slate-900/65 text-white shadow-xl backdrop-blur-md active:scale-95 active:bg-amber-500/80 sm:h-20 sm:w-20"
        >
          <ChevronRight className="h-9 w-9" />
        </button>
      </div>

      {/* Center-Bottom: Handbrake Drift Button */}
      <div className="pointer-events-auto mb-2">
        <button
          {...bindTouch("handbrake")}
          aria-label="Handbrake Drift"
          className="flex h-14 items-center gap-2 rounded-2xl border-2 border-amber-400/40 bg-slate-900/70 px-5 font-black uppercase tracking-wider text-amber-300 shadow-xl backdrop-blur-md active:scale-95 active:bg-amber-500/90 active:text-slate-950"
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
          className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 border-red-400/40 bg-red-950/70 text-red-300 shadow-xl backdrop-blur-md active:scale-95 active:bg-red-600 active:text-white sm:h-20 sm:w-20"
        >
          <span className="text-xs font-black uppercase">BRAKE</span>
        </button>
        <button
          {...bindTouch("accelerate")}
          aria-label="Accelerate"
          className="flex h-16 w-20 flex-col items-center justify-center rounded-2xl border-2 border-emerald-400/40 bg-emerald-950/75 text-emerald-300 shadow-xl backdrop-blur-md active:scale-95 active:bg-emerald-500 active:text-slate-950 sm:h-20 sm:w-24"
        >
          <span className="text-xs font-black uppercase">GAS</span>
        </button>
      </div>
    </div>
  );
}
