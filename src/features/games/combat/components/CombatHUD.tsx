"use client";

import { RoomPlayer } from "@/features/rooms/types";
import { CHARACTERS } from "../character-config";
import { FighterTransform } from "../types";

const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];

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
  const meFighter = fighters[meSeat];
  const meConfig = meFighter ? CHARACTERS[meFighter.archetype] || CHARACTERS.balanced : CHARACTERS.balanced;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Header: Player Health Cards */}
      <div className="flex flex-wrap gap-2 sm:gap-4 overflow-x-auto pb-2">
        {players.map((player) => {
          const f = fighters[player.seat];
          const hp = f ? f.hp : 100;
          const maxHp = f ? f.maxHp : 100;
          const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
          const isElim = f ? f.isEliminated : false;

          return (
            <div
              key={player.id}
              className={`min-w-36 flex-1 rounded-2xl border-2 border-slate-950 p-2.5 shadow-[3px_3px_0_#171821] backdrop-blur-md transition ${
                isElim ? "opacity-50 grayscale" : ""
              }`}
              style={{ backgroundColor: colors[(player.seat - 1) % colors.length] }}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-black text-slate-950">
                  P{player.seat} {player.profile?.display_name || `Player ${player.seat}`}
                  {player.seat === meSeat ? " (you)" : ""}
                </span>
                <span className="text-[10px] font-black uppercase text-slate-800">
                  {isElim ? "OUT 💀" : `${Math.round(hp)} HP`}
                </span>
              </div>

              {/* Health Progress Bar */}
              <div className="mt-1.5 h-3 overflow-hidden rounded-full border border-slate-950 bg-slate-950/40">
                <div
                  className={`h-full transition-all duration-200 ${
                    pct > 50 ? "bg-emerald-500" : pct > 20 ? "bg-amber-400" : "bg-rose-600 animate-pulse"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Combo Announcement Overlay */}
      {comboCount > 1 && (
        <div className="pointer-events-none mx-auto flex flex-col items-center animate-bounce">
          <span className="text-4xl sm:text-6xl font-black italic tracking-tighter text-amber-300 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
            COMBO x{comboCount}!
          </span>
        </div>
      )}

      {/* Spectator Overlay */}
      {isSpectating && (
        <div className="pointer-events-auto mx-auto flex items-center gap-3 rounded-2xl border-2 border-slate-950 bg-purple-900/90 px-5 py-3 text-white shadow-2xl backdrop-blur-md">
          <span className="text-xs font-black uppercase tracking-widest text-purple-300">
            SPECTATING PLAYER {spectateTargetSeat}
          </span>
          {onNextSpectate && (
            <button
              onClick={onNextSpectate}
              className="arcade-button bg-purple-600 px-3 py-1 text-xs text-white shadow-[2px_2px_0_#171821]"
            >
              NEXT PLAYER ➡️
            </button>
          )}
        </div>
      )}

      {/* Bottom Desktop Combat HUD Bar */}
      {!isSpectating && (
        <div className="pointer-events-none hidden sm:flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meConfig.modelIcon}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">FIGHTER</p>
              <h4 className="text-sm font-black text-rose-400">{meConfig.name} — {meConfig.title}</h4>
            </div>
          </div>

          {/* Desktop Controls Legend */}
          <div className="flex items-center gap-4 text-xs font-bold text-slate-300">
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700">WASD: Move</span>
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700">Space: Jump</span>
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700">L-Click: Light Attack</span>
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700">R-Click: Heavy Attack</span>
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700">E: Block</span>
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700">
              Shift: Dodge {dodgeCooldown > 0 ? `(${dodgeCooldown.toFixed(1)}s)` : "READY"}
            </span>
            <span className="rounded bg-slate-800 px-2 py-1 border border-slate-700 text-amber-300">
              Q: {meConfig.specialName} {specialCooldown > 0 ? `(${specialCooldown.toFixed(1)}s)` : "READY"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
