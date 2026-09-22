"use client";

import { Flag, Gauge, HelpCircle, Trophy } from "lucide-react";
import { useState } from "react";

export function RacingHUD({
  position = 1,
  totalPlayers = 4,
  lapTime = 0,
  checkpoint = 0,
  totalCheckpoints = 5,
  speed = 0,
  onExit
}: {
  position?: number;
  totalPlayers?: number;
  lapTime?: number;
  checkpoint?: number;
  totalCheckpoints?: number;
  speed?: number;
  onExit?: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  // Format time MM:SS.ms
  const mins = Math.floor(lapTime / 60);
  const secs = Math.floor(lapTime % 60);
  const ms = Math.floor((lapTime % 1) * 100);
  const formattedTime = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex select-none flex-col justify-between p-4">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between">
        {/* Top-Left: Live Race Position */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-slate-900/80 px-4 py-2 font-black text-white shadow-xl backdrop-blur-md">
          <Trophy className="h-5 w-5 text-amber-400" />
          <span className="text-sm uppercase tracking-wider text-slate-400">POS</span>
          <span className="text-xl text-amber-300">
            {position}<span className="text-xs text-slate-400">/{totalPlayers}</span>
          </span>
        </div>

        {/* Top-Center: Race Timer */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border-2 border-amber-500/40 bg-slate-950/85 px-5 py-2 font-mono text-xl font-black text-amber-400 shadow-2xl backdrop-blur-md">
          <span>⏱️</span>
          <span>{formattedTime}</span>
        </div>

        {/* Top-Right: Checkpoint Status & Controls Help */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-slate-900/80 px-4 py-2 font-black text-white shadow-xl backdrop-blur-md">
            <Flag className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-slate-400">CHECKPOINT</span>
            <span className="text-sm text-emerald-400">
              {checkpoint}/{totalCheckpoints}
            </span>
          </div>

          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-white/20 bg-slate-900/80 text-white shadow-xl backdrop-blur-md hover:bg-slate-800 active:scale-95"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Speedometer Gauge Bottom Center */}
      <div className="pointer-events-none flex flex-col items-center justify-center pb-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/75 px-4 py-1.5 font-black text-white shadow-lg backdrop-blur-md">
          <Gauge className="h-4 w-4 text-amber-400" />
          <span className="text-lg text-amber-300">{Math.round(speed)}</span>
          <span className="text-[10px] uppercase text-slate-400">KM/H</span>
        </div>
      </div>

      {/* Desktop Controls Help Modal */}
      {showHelp && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border-2 border-white/20 bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-lg font-black tracking-tight text-amber-400">🏎️ Rally Controls</h3>
            <div className="mt-4 space-y-2.5 text-xs font-bold text-slate-300">
              <div className="flex justify-between rounded-xl bg-slate-800/60 p-2.5">
                <span>Accelerate / Reverse</span>
                <span className="font-mono text-amber-300">W / S or Up / Down</span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-800/60 p-2.5">
                <span>Steer Left / Right</span>
                <span className="font-mono text-amber-300">A / D or Left / Right</span>
              </div>
              <div className="flex justify-between rounded-xl bg-slate-800/60 p-2.5">
                <span>Handbrake Drift</span>
                <span className="font-mono text-amber-300">SPACE</span>
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-2xl bg-amber-500 py-2.5 font-black text-slate-950 shadow-lg hover:bg-amber-400 active:scale-95"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
