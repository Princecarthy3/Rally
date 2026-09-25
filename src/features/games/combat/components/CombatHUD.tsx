"use client";

import { useSyncExternalStore } from "react";
import type { RoomPlayer } from "@/features/rooms/types";
import { CHARACTERS } from "../character-config";
import type { FighterTransform } from "../types";

const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];

function subscribeFinePointer(onChange: () => void) {
  const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

function isFinePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function CombatHUD({
  players,
  fighters,
  meSeat,
  isSpectating,
  spectateTargetSeat,
  onNextSpectate,
  comboCount,
  specialCooldown,
  dodgeCooldown,
}: {
  players: RoomPlayer[];
  fighters: Record<number, FighterTransform>;
  meSeat: number;
  isSpectating: boolean;
  spectateTargetSeat?: number;
  onNextSpectate?: () => void;
  comboCount: number;
  specialCooldown: number;
  dodgeCooldown: number;
}) {
  const showDesktopLegend = useSyncExternalStore(subscribeFinePointer, isFinePointer, () => false);
  const meFighter = fighters[meSeat];
  const meConfig = meFighter
    ? CHARACTERS[meFighter.archetype] || CHARACTERS.balanced
    : CHARACTERS.balanced;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between select-none"
      style={{
        paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      {/* Compact HP strip */}
      <div className="flex gap-1.5 overflow-x-auto px-2 pb-1 sm:gap-3 sm:px-3">
        {players.map((player) => {
          const f = fighters[player.seat];
          const hp = f ? f.hp : 100;
          const maxHp = f ? f.maxHp : 100;
          const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
          const isElim = f ? f.isEliminated : false;
          const isMe = player.seat === meSeat;

          return (
            <div
              key={player.id}
              className={`min-w-[9.5rem] flex-1 rounded-xl border border-slate-950/80 px-2.5 py-1.5 shadow-lg backdrop-blur-md sm:min-w-40 sm:rounded-2xl sm:p-2.5 ${
                isElim ? "opacity-45 grayscale" : ""
              } ${isMe ? "ring-2 ring-amber-300/80" : ""}`}
              style={{ backgroundColor: colors[(player.seat - 1) % colors.length] }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-black text-slate-950 sm:text-xs">
                  P{player.seat} {player.profile?.display_name || `Player ${player.seat}`}
                  {isMe ? " (you)" : ""}
                </span>
                <span className="shrink-0 text-[9px] font-black uppercase text-slate-800 sm:text-[10px]">
                  {isElim ? "OUT" : `${Math.round(hp)} HP`}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full border border-slate-950/50 bg-slate-950/35 sm:h-2.5">
                <div
                  className={`h-full transition-all duration-200 ${
                    pct > 50 ? "bg-emerald-500" : pct > 25 ? "bg-amber-400" : "bg-rose-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {comboCount > 1 && (
        <div className="pointer-events-none mx-auto flex flex-col items-center">
          <span className="text-3xl font-black italic tracking-tighter text-amber-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] sm:text-5xl">
            COMBO x{comboCount}!
          </span>
        </div>
      )}

      {isSpectating && (
        <div className="pointer-events-auto mx-auto flex items-center gap-3 rounded-2xl border-2 border-slate-950 bg-purple-900/90 px-5 py-3 text-white shadow-2xl">
          <span className="text-xs font-black uppercase tracking-widest text-purple-300">
            Spectating P{spectateTargetSeat}
          </span>
          {onNextSpectate && (
            <button
              type="button"
              onClick={onNextSpectate}
              className="rounded-xl bg-purple-600 px-3 py-1 text-xs font-black text-white"
            >
              NEXT
            </button>
          )}
        </div>
      )}

      {/* Desktop-only legend — never on touch devices */}
      {!isSpectating && showDesktopLegend && (
        <div className="pointer-events-none mx-2 mb-2 flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-950 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meConfig.modelIcon}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fighter</p>
              <h4 className="text-sm font-black text-rose-400">
                {meConfig.name} — {meConfig.title}
              </h4>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] font-bold text-slate-300">
            <span className="rounded bg-slate-800 px-2 py-1">WASD Move</span>
            <span className="rounded bg-slate-800 px-2 py-1">Space Jump</span>
            <span className="rounded bg-slate-800 px-2 py-1">LMB Light</span>
            <span className="rounded bg-slate-800 px-2 py-1">RMB Heavy</span>
            <span className="rounded bg-slate-800 px-2 py-1">E Block</span>
            <span className="rounded bg-slate-800 px-2 py-1">Shift Dodge</span>
            <span className="rounded bg-slate-800 px-2 py-1">Q Special</span>
          </div>
          <div className="text-right text-[10px] font-bold text-slate-400">
            <p>Special {specialCooldown > 0 ? `${specialCooldown.toFixed(1)}s` : "Ready"}</p>
            <p>Dodge {dodgeCooldown > 0 ? `${dodgeCooldown.toFixed(1)}s` : "Ready"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
