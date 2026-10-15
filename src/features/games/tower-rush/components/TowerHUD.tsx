"use client";
import { GameIcon } from "@/features/games/game-icon";
import { IconTrophy, IconLightbulb } from "@/components/ui-icons";


import { useState } from "react";
import {
  Trophy,
  Flag,
  RotateCcw,
  HelpCircle,
  Volume2,
  VolumeX,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import { sounds } from "@/lib/audio";
import type { ClimberTransform, TowerMatchStage } from "../types";
import { TOWER_CHECKPOINTS, SUMMIT_ALTITUDE } from "../tower-layout";

export function TowerHUD({
  stage,
  countdown,
  elapsedSec,
  runners,
  localSeat,
  toasts,
  onRestart,
  isHost,
}: {
  stage: TowerMatchStage;
  countdown: number;
  elapsedSec: number;
  runners: Record<number, ClimberTransform>;
  localSeat: number;
  toasts: string[];
  onRestart?: () => void;
  isHost?: boolean;
}) {
  const [showControlsGuide, setShowControlsGuide] = useState(false);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());

  const localRunner = runners[localSeat];
  const altitude = Math.max(0, Math.min(SUMMIT_ALTITUDE, localRunner?.position[1] || 0));
  const progressPct = Math.min(100, (altitude / SUMMIT_ALTITUDE) * 100);

  // Current section name
  const currentCheckpoint =
    TOWER_CHECKPOINTS[localRunner?.checkpointIdx || 0] || TOWER_CHECKPOINTS[0];

  // Leaderboard ranking: finished first (by time), then by altitude desc
  const sortedRunners = Object.values(runners).sort((a, b) => {
    if (a.hasFinished && b.hasFinished) {
      return (a.finishTime || 0) - (b.finishTime || 0);
    }
    if (a.hasFinished) return -1;
    if (b.hasFinished) return 1;
    return b.position[1] - a.position[1];
  });

  const toggleSound = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* ======================================================== */}
      {/* TOP BAR: Altitude Meter, Section, Timer, Settings        */}
      {/* ======================================================== */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: Altitude & Section Pill */}
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-950 bg-slate-900/90 px-3.5 py-1.5 text-white shadow-[3px_3px_0_#0f172a] backdrop-blur-md">
            <Layers className="h-4 w-4 text-violet-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {currentCheckpoint.sectionName}
              </span>
              <span className="text-sm font-black text-white">
                {altitude.toFixed(1)}m{" "}
                <span className="text-xs font-semibold text-slate-400">/ {SUMMIT_ALTITUDE}m</span>
              </span>
            </div>
          </div>

          {/* Quick Checkpoint Indicator */}
          <div className="flex items-center gap-1">
            {TOWER_CHECKPOINTS.map((cp) => {
              const reached = (localRunner?.checkpointIdx || 0) >= cp.idx;
              return (
                <div
                  key={cp.idx}
                  title={cp.name}
                  className={`h-2 w-5 rounded-full border border-slate-900 transition-all ${
                    reached ? "bg-amber-400 shadow-[0_0_8px_#f59e0b]" : "bg-slate-800"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Center: Countdown or Match Timer */}
        {stage === "countdown" ? (
          <div className="pointer-events-auto animate-bounce rounded-3xl border-3 border-slate-950 bg-amber-400 px-6 py-2 shadow-[4px_4px_0_#0f172a]">
            <span className="text-3xl font-black text-amber-950 sm:text-4xl">
              {countdown > 0 ? countdown : "CLIMB!"}
            </span>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border-2 border-slate-950 bg-slate-900/90 px-4 py-1.5 text-white shadow-[3px_3px_0_#0f172a] backdrop-blur-md">
            <span className="text-xs font-bold uppercase text-slate-400">Time</span>
            <span className="font-mono text-base font-black text-violet-300">
              {elapsedSec.toFixed(1)}s
            </span>
          </div>
        )}

        {/* Right: Sound & Controls Guide Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-label="Toggle Mute"
            className="grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-950 bg-white shadow-[2px_2px_0_#0f172a] transition active:translate-y-0.5"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-slate-600" />
            ) : (
              <Volume2 className="h-4 w-4 text-slate-900" />
            )}
          </button>

          <button
            onClick={() => setShowControlsGuide(true)}
            aria-label="Controls Guide"
            className="flex items-center gap-1 rounded-xl border-2 border-slate-950 bg-violet-500 px-2.5 py-1.5 text-xs font-black text-white shadow-[2px_2px_0_#0f172a] transition active:translate-y-0.5 hover:bg-violet-600"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Controls</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MIDDLE: Vertical Progress Spire & Live Race Leaderboard  */}
      {/* ======================================================== */}
      <div className="flex items-center justify-between pointer-events-none mt-2 flex-1">
        {/* Vertical Tower Height Progress Bar (Left edge) */}
        <div className="pointer-events-auto relative hidden sm:flex flex-col items-center justify-between h-[280px] w-7 rounded-full border-2 border-slate-950 bg-slate-900/80 p-1 shadow-[3px_3px_0_#0f172a] backdrop-blur-sm">
          {/* Summit Icon */}
          <Trophy className="h-4 w-4 text-amber-400 animate-pulse" />

          {/* Vertical Track */}
          <div className="relative w-2 flex-1 my-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="absolute bottom-0 w-full rounded-full bg-gradient-to-t from-violet-600 to-cyan-400 transition-all duration-150"
              style={{ height: `${progressPct}%` }}
            />
          </div>

          {/* Runners Indicators */}
          {sortedRunners.map((r) => {
            const runnerAlt = Math.max(0, Math.min(SUMMIT_ALTITUDE, r.position[1]));
            const pct = (runnerAlt / SUMMIT_ALTITUDE) * 100;
            return (
              <div
                key={r.seat}
                title={`${r.displayName}: ${runnerAlt.toFixed(0)}m`}
                className="absolute left-7 -translate-y-1/2 flex items-center gap-1 whitespace-nowrap transition-all duration-150"
                style={{ bottom: `${pct}%` }}
              >
                <div
                  className="h-3.5 w-3.5 rounded-full border border-slate-950 shadow-[1px_1px_0_#0f172a]"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {r.displayName.slice(0, 5)}
                </span>
              </div>
            );
          })}

          {/* Base Icon */}
          <Flag className="h-3.5 w-3.5 text-slate-400" />
        </div>

        {/* Live Race Mini-Leaderboard (Top-Right) */}
        <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border-2 border-slate-950 bg-slate-900/90 p-2 text-white shadow-[3px_3px_0_#0f172a] backdrop-blur-md max-w-[170px] sm:max-w-[190px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>Tower Race</span>
            <span>Alt / Time</span>
          </div>

          <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
            {sortedRunners.map((runner, rank) => {
              const isMe = runner.seat === localSeat;
              return (
                <div
                  key={runner.seat}
                  className={`flex items-center justify-between gap-1.5 rounded-lg px-1.5 py-0.5 text-xs font-bold transition-all ${
                    isMe ? "bg-violet-600/60 text-white" : "text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-[10px] font-black text-slate-400">#{rank + 1}</span>
                    <span
                      className="inline-block h-2 w-2 rounded-full border border-slate-900"
                      style={{ backgroundColor: runner.color }}
                    />
                    <span className="truncate max-w-[70px] sm:max-w-[85px]">
                      {runner.displayName}
                    </span>
                  </div>

                  <span className="font-mono text-[11px] font-black shrink-0">
                    {runner.hasFinished
                      ? `${(runner.finishTime || 0).toFixed(1)}s`
                      : `${runner.position[1].toFixed(0)}m`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TOAST ALERTS (Checkpoints, Falls, Finish announcements)  */}
      {/* ======================================================== */}
      <div className="pointer-events-none flex flex-col items-center gap-1.5 mb-2">
        {toasts.map((toast, i) => (
          <div
            key={i}
            className="animate-in fade-in slide-in-from-bottom-2 duration-200 rounded-xl border-2 border-slate-950 bg-slate-900/95 px-4 py-1.5 text-center text-xs font-black text-white shadow-[3px_3px_0_#0f172a] backdrop-blur-md"
          >
            {toast}
          </div>
        ))}
      </div>

      {/* ======================================================== */}
      {/* CONTROLS GUIDE MODAL                                     */}
      {/* ======================================================== */}
      {showControlsGuide && (
        <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-3 border-slate-950 bg-white p-5 shadow-[6px_6px_0_#0f172a]">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GameIcon gameKey="tower_rush" size={22} />
                <h3 className="text-lg font-black text-slate-900">How to Play</h3>
              </div>
              <button
                onClick={() => setShowControlsGuide(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                <span>Move</span>
                <span className="rounded bg-violet-100 px-2 py-0.5 font-mono font-black text-violet-700">
                  W, A, S, D / Arrows
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                <span>Jump</span>
                <span className="rounded bg-violet-100 px-2 py-0.5 font-mono font-black text-violet-700">
                  Spacebar
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                <span>Look Around</span>
                <span className="rounded bg-violet-100 px-2 py-0.5 font-mono font-black text-violet-700">
                  Click & Drag / Touch Swipe
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                <span>Mobile Controls</span>
                <span className="rounded bg-violet-100 px-2 py-0.5 font-mono font-black text-violet-700">
                  Virtual Joystick & Jump Button
                </span>
              </div>

              <div className="rounded-xl bg-amber-50 p-2.5 text-[11px] text-amber-800 border border-amber-200">
                <IconLightbulb size={14} className="inline" /> <strong>Tip:</strong> Moving platforms match your momentum! Time your jumps past
                spinning laser beams and don&apos;t linger on decaying pink blocks.
              </div>
            </div>

            <button
              onClick={() => setShowControlsGuide(false)}
              className="mt-4 w-full rounded-2xl border-2 border-slate-950 bg-violet-600 py-2.5 text-center text-sm font-black text-white shadow-[3px_3px_0_#0f172a] hover:bg-violet-700 active:translate-y-0.5"
            >
              Got It, Let&apos;s Climb!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
