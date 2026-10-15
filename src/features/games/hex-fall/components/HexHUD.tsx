"use client";

import { Users, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import { FLOOR_THEMES, FLOOR_HEIGHTS } from "../hex-math";
import type { HexMatchStage, HexRunnerTransform } from "../types";

export function HexHUD({
  stage,
  countdown,
  elapsedSeconds,
  aliveCount,
  totalCount,
  localRunner,
  runners,
  spectatingSeat,
  onCycleSpectate,
  toasts,
  raceProgress = 0,
}: {
  stage: HexMatchStage;
  countdown: number;
  elapsedSeconds: number;
  aliveCount: number;
  totalCount: number;
  localRunner?: HexRunnerTransform;
  runners: Record<number, HexRunnerTransform>;
  spectatingSeat: number;
  onCycleSpectate?: (delta: number) => void;
  toasts: string[];
  raceProgress?: number;
}) {
  const currentFloorIdx = localRunner ? localRunner.currentFloor : 0;
  const currentTheme = FLOOR_THEMES[currentFloorIdx] || FLOOR_THEMES[0];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const spectatedRunner = runners[spectatingSeat];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-2">
        {/* Alive Counter & Timer */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-950 bg-white/95 px-3 py-2 shadow-[3px_3px_0_#0f172a] backdrop-blur-md">
            <Users size={16} className="text-slate-700" />
            <span className="text-sm font-black text-slate-950">
              {aliveCount} / {totalCount} ALIVE
            </span>
          </div>

          <div className="rounded-2xl border-2 border-slate-950 bg-slate-950 px-3.5 py-2 font-mono text-sm font-black text-white shadow-[3px_3px_0_#0f172a]">
            ⏱ {formatTime(elapsedSeconds)}
          </div>
        </div>

        {/* Current Floor Badge */}
        {localRunner && !localRunner.isEliminated && (
          <div
            className="flex items-center gap-2 rounded-2xl border-2 border-slate-950 px-3.5 py-2 font-black shadow-[3px_3px_0_#0f172a] backdrop-blur-md"
            style={{ backgroundColor: currentTheme.baseColor, color: "#ffffff" }}
          >
            <span className="text-xs uppercase tracking-wider opacity-90">Floor {currentFloorIdx + 1}/4</span>
            <span className="rounded-lg bg-black/30 px-2 py-0.5 text-xs font-black">{currentTheme.name}</span>
          </div>
        )}
      </div>

      {/* Race progress bar */}
      {stage === "playing" && localRunner && !localRunner.isEliminated && (
        <div className="mt-2 mx-auto w-full max-w-md">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-950 bg-slate-950/85 px-3 py-2 shadow-[3px_3px_0_#0f172a] backdrop-blur-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">🏁 Race</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-700">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-yellow-300 transition-[width] duration-150"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, raceProgress)) * 100)}%` }}
              />
            </div>
            <span className="min-w-[2.5rem] text-right font-mono text-xs font-black text-white">
              {Math.round(Math.min(1, Math.max(0, raceProgress)) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Middle Countdown Overlay */}
      {stage === "countdown" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="animate-bounce text-center">
            <span className="block font-black text-8xl sm:text-9xl tracking-tighter text-yellow-300 drop-shadow-[0_8px_0_#0f172a]">
              {countdown > 0 ? countdown : "RUN!"}
            </span>
            <p className="mt-2 text-xl sm:text-2xl font-black uppercase tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Race the long path — first to the FINISH wins!
            </p>
          </div>
        </div>
      )}

      {/* Middle Left: Vertical Altitude Gauge */}
      <div className="pointer-events-none absolute left-3 top-24 hidden flex-col items-center sm:flex">
        <div className="relative flex h-52 w-10 flex-col justify-between rounded-2xl border-2 border-slate-950 bg-slate-900/80 p-2 shadow-[3px_3px_0_#0f172a] backdrop-blur-md">
          {FLOOR_HEIGHTS.map((h, i) => (
            <div key={i} className="flex items-center justify-between">
              <span
                className="h-2 w-2 rounded-full border border-black/40"
                style={{ backgroundColor: FLOOR_THEMES[i].baseColor }}
              />
              <span className="text-[10px] font-black text-slate-300">F{i + 1}</span>
            </div>
          ))}
          {/* Laser Floor Icon */}
          <div className="flex items-center justify-between border-t border-red-500/50 pt-1 text-center">
            <span className="text-[10px] text-red-400">⚡</span>
            <span className="text-[8px] font-black uppercase text-red-400">Abyss</span>
          </div>

          {/* Player dots along the gauge */}
          {Object.values(runners).map((r) => {
            if (r.isEliminated) return null;
            // Map height 18 down to -5 to 0% - 100% top offset
            const py = r.position[1];
            const clampedY = Math.max(-5, Math.min(18.5, py));
            const pct = ((18.5 - clampedY) / (18.5 - -5)) * 82 + 5;

            return (
              <span
                key={r.seat}
                className="absolute left-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 border-slate-950 transition-all duration-100"
                style={{
                  top: `${pct}%`,
                  backgroundColor: r.color,
                  boxShadow: r.isLocal ? "0 0 8px #ffffff" : undefined,
                  zIndex: r.isLocal ? 10 : 5,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Center Left: Elimination Toasts Feed */}
      <div className="pointer-events-none absolute bottom-28 left-4 flex flex-col gap-1.5 sm:bottom-20">
        {toasts.map((toast, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-xl border-2 border-slate-950 bg-red-500/90 px-3 py-1 text-xs font-black text-white shadow-[2px_2px_0_#0f172a] backdrop-blur-md animate-fade-in"
          >
            <span>⚡</span>
            <span>{toast}</span>
          </div>
        ))}
      </div>

      {/* Bottom Center: Controls Guide or Spectator Bar */}
      <div className="flex flex-col items-center gap-2">
        {localRunner?.isEliminated && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border-2 border-slate-950 bg-slate-950/90 px-4 py-2 text-white shadow-[4px_4px_0_#0f172a] backdrop-blur-md">
            <Eye size={16} className="text-yellow-400" />
            <span className="text-xs font-black">
              Spectating: {spectatedRunner?.displayName || "Player"}
            </span>
            {onCycleSpectate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onCycleSpectate(-1)}
                  className="grid h-6 w-6 place-items-center rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95"
                >
                  <ArrowLeft size={12} />
                </button>
                <button
                  onClick={() => onCycleSpectate(1)}
                  className="grid h-6 w-6 place-items-center rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95"
                >
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Desktop Controls Tip */}
        <div className="hidden rounded-full border border-white/20 bg-black/40 px-3.5 py-1 text-[11px] font-bold text-slate-300 backdrop-blur-sm sm:block">
          <span className="text-yellow-300">[WASD]</span> Run • <span className="text-yellow-300">[SPACE]</span> Jump •{" "}
          <span className="text-yellow-300">[SHIFT]</span> Dive
        </div>
      </div>
    </div>
  );
}
