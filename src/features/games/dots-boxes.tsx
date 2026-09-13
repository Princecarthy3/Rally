"use client";

import type { RoomPlayer } from "@/features/rooms/types";
import { useMemo } from "react";

const PLAYER_COLORS = [
  { border: "border-pink-500", bg: "bg-pink-100", text: "text-pink-700", fill: "#f472b6" },
  { border: "border-cyan-500", bg: "bg-cyan-100", text: "text-cyan-700", fill: "#38bdf8" },
  { border: "border-amber-500", bg: "bg-amber-100", text: "text-amber-700", fill: "#fbbf24" },
  { border: "border-emerald-500", bg: "bg-emerald-100", text: "text-emerald-700", fill: "#34d399" },
];

export function DotsBoxes({
  state,
  mySeat,
  act,
  busy,
  players,
}: {
  state: Record<string, any>;
  mySeat?: number;
  act: (action: string, value?: string) => Promise<void>;
  busy: boolean;
  players: RoomPlayer[];
}) {
  const isMyTurn = state.turn === mySeat;
  const hLines: Record<string, number> = state.hLines || {};
  const vLines: Record<string, number> = state.vLines || {};
  const boxes: Record<string, number> = state.boxes || {};

  const playerMap = useMemo(() => {
    const map = new Map<number, RoomPlayer>();
    players.forEach((p) => map.set(p.seat, p));
    return map;
  }, [players]);

  const handleLineClick = (type: "h" | "v", r: number, c: number) => {
    if (!isMyTurn || busy) return;
    const lineKey = `${type}_${r}_${c}`;
    if (type === "h" && hLines[`${r}_${c}`]) return;
    if (type === "v" && vLines[`${r}_${c}`]) return;
    act("line", lineKey);
  };

  return (
    <div className="mx-auto max-w-md select-none text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-amber-100 px-4 py-1.5 text-xs font-black shadow-[2px_2px_0_#171821]">
        <span>{isMyTurn ? "👉 YOUR TURN TO DRAW A LINE" : `WAITING FOR PLAYER ${state.turn}`}</span>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[340px] rounded-3xl border-4 border-slate-950 bg-slate-900 p-6 shadow-[6px_6px_0_#171821]">
        {/* Grid Container */}
        <div className="relative h-full w-full">
          {/* 3x3 Boxes */}
          {Array.from({ length: 3 }).map((_, r) =>
            Array.from({ length: 3 }).map((_, c) => {
              const boxOwner = boxes[`b_${r}_${c}`];
              const p = boxOwner ? playerMap.get(boxOwner) : null;
              const style = boxOwner ? PLAYER_COLORS[(boxOwner - 1) % 4] : null;

              return (
                <div
                  key={`box_${r}_${c}`}
                  className={`absolute flex items-center justify-center rounded-xl transition-all duration-300 ${
                    style ? `${style.bg} ${style.border} border-2 scale-95 shadow-inner` : ""
                  }`}
                  style={{
                    left: `${c * 33.33 + 4}%`,
                    top: `${r * 33.33 + 4}%`,
                    width: "25.33%",
                    height: "25.33%",
                  }}
                >
                  {p && (
                    <span className={`text-sm sm:text-base font-black ${style?.text}`}>
                      {p.profile?.display_name ? p.profile.display_name.slice(0, 2).toUpperCase() : `P${boxOwner}`}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Horizontal Lines (4 rows of 3 lines) */}
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 3 }).map((_, c) => {
              const owner = hLines[`${r}_${c}`];
              const drawn = Boolean(owner);
              const ownerStyle = owner ? PLAYER_COLORS[(owner - 1) % 4] : null;

              return (
                <button
                  key={`h_${r}_${c}`}
                  disabled={!isMyTurn || drawn || busy}
                  onClick={() => handleLineClick("h", r, c)}
                  aria-label={`Horizontal line row ${r + 1} col ${c + 1}`}
                  className={`absolute cursor-pointer rounded-full transition-all duration-200 ${
                    drawn
                      ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-100"
                      : isMyTurn
                      ? "bg-slate-700 hover:bg-amber-300 hover:scale-105 opacity-60"
                      : "bg-slate-800 opacity-40 cursor-not-allowed"
                  }`}
                  style={{
                    left: `${c * 33.33 + 8}%`,
                    top: `${r * 33.33 - 1.5}%`,
                    width: "17.33%",
                    height: "3%",
                    backgroundColor: ownerStyle ? ownerStyle.fill : undefined,
                  }}
                />
              );
            })
          )}

          {/* Vertical Lines (3 rows of 4 lines) */}
          {Array.from({ length: 3 }).map((_, r) =>
            Array.from({ length: 4 }).map((_, c) => {
              const owner = vLines[`${r}_${c}`];
              const drawn = Boolean(owner);
              const ownerStyle = owner ? PLAYER_COLORS[(owner - 1) % 4] : null;

              return (
                <button
                  key={`v_${r}_${c}`}
                  disabled={!isMyTurn || drawn || busy}
                  onClick={() => handleLineClick("v", r, c)}
                  aria-label={`Vertical line row ${r + 1} col ${c + 1}`}
                  className={`absolute cursor-pointer rounded-full transition-all duration-200 ${
                    drawn
                      ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] scale-100"
                      : isMyTurn
                      ? "bg-slate-700 hover:bg-amber-300 hover:scale-105 opacity-60"
                      : "bg-slate-800 opacity-40 cursor-not-allowed"
                  }`}
                  style={{
                    left: `${c * 33.33 - 1.5}%`,
                    top: `${r * 33.33 + 8}%`,
                    width: "3%",
                    height: "17.33%",
                    backgroundColor: ownerStyle ? ownerStyle.fill : undefined,
                  }}
                />
              );
            })
          )}

          {/* 4x4 Grid Dots */}
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 4 }).map((_, c) => (
              <div
                key={`dot_${r}_${c}`}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-white shadow-md"
                style={{
                  left: `${c * 33.33}%`,
                  top: `${r * 33.33}%`,
                  width: "14px",
                  height: "14px",
                }}
              />
            ))
          )}
        </div>
      </div>

      <p className="mt-4 text-xs font-bold text-slate-500">
        Connect lines between dots. Complete 4 sides of a box to score points & get an extra turn!
      </p>
    </div>
  );
}
