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
  isHost,
}: {
  state: Record<string, any>;
  mySeat?: number;
  act: (action: string, value?: string) => Promise<void>;
  busy: boolean;
  players: RoomPlayer[];
  isHost?: boolean;
}) {
  const gridSize: number = state.gridSize || 3; // 3 = 9 boxes, 4 = 16 boxes, 5 = 25 boxes
  const isMyTurn = state.turn === mySeat;
  const hLines: Record<string, number> = state.hLines || {};
  const vLines: Record<string, number> = state.vLines || {};
  const boxes: Record<string, number> = state.boxes || {};

  // Keep dots/lines inside the card on every grid size (esp. mobile).
  // Positions map into [margin%, 100-margin%] instead of [0%, 100%].
  const margin = gridSize >= 5 ? 5 : gridSize === 4 ? 6 : 7;
  const usable = 100 - margin * 2;
  const step = usable / gridSize;
  const at = (index: number) => margin + index * step;

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

  const handleGridSizeChange = (size: number) => {
    if (!isHost || busy) return;
    act("set_grid_size", String(size));
  };

  const linesDrawnCount = Object.keys(hLines).length + Object.keys(vLines).length;
  const canChangeGridSize = isHost && linesDrawnCount === 0;

  const lineThickness = gridSize >= 5 ? 2.4 : 3.2;
  const dotSize = gridSize >= 5 ? 9 : gridSize === 4 ? 11 : 13;
  const lineInset = step * (gridSize >= 5 ? 0.18 : 0.2);

  return (
    <div className="mx-auto w-full max-w-md select-none text-center">
      {canChangeGridSize && (
        <div className="mb-4 rounded-2xl border-2 border-slate-950 bg-slate-100 p-2 shadow-[3px_3px_0_#171821]">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Host Option: Select Grid Size
          </p>
          <div className="flex justify-center gap-2">
            {[
              { size: 3, label: "9 Boxes (3×3)" },
              { size: 4, label: "16 Boxes (4×4)" },
              { size: 5, label: "25 Boxes (5×5)" },
            ].map(({ size, label }) => (
              <button
                key={size}
                type="button"
                disabled={busy}
                onClick={() => handleGridSizeChange(size)}
                className={`rounded-xl border-2 border-slate-950 px-2 py-2 text-[10px] font-black leading-tight transition sm:px-3 sm:text-xs ${
                  gridSize === size
                    ? "bg-[#f4dc69] shadow-[2px_2px_0_#171821]"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border-2 border-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide sm:text-xs ${
            isMyTurn ? "bg-[#fef9c3]" : "bg-white"
          }`}
        >
          {isMyTurn ? "👉 Your turn to draw a line" : `Player ${state.turn || 1}, draw a line`}
        </span>
        <span className="rounded-full border-2 border-slate-950 bg-[#f4dc69] px-2.5 py-1 text-[10px] font-black sm:text-xs">
          {gridSize * gridSize} Boxes ({gridSize}×{gridSize})
        </span>
      </div>

      {/* Board card — overflow hidden so nothing spills; inset coords keep dots inside */}
      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,360px)] overflow-hidden rounded-3xl border-4 border-slate-950 bg-slate-900 p-2 shadow-[6px_6px_0_#171821] sm:p-3">
        <div className="relative h-full w-full">
          {/* Claimed boxes */}
          {Array.from({ length: gridSize }).map((_, r) =>
            Array.from({ length: gridSize }).map((_, c) => {
              const boxOwner = boxes[`b_${r}_${c}`];
              const p = boxOwner ? playerMap.get(boxOwner) : null;
              const style = boxOwner ? PLAYER_COLORS[(boxOwner - 1) % 4] : null;
              const pad = step * 0.12;

              return (
                <div
                  key={`box_${r}_${c}`}
                  className={`absolute flex items-center justify-center rounded-md transition-all duration-300 sm:rounded-lg ${
                    style ? `${style.bg} ${style.border} border-2 shadow-inner` : ""
                  }`}
                  style={{
                    left: `${at(c) + pad}%`,
                    top: `${at(r) + pad}%`,
                    width: `${step - pad * 2}%`,
                    height: `${step - pad * 2}%`,
                  }}
                >
                  {p && (
                    <span
                      className={`font-black ${
                        gridSize >= 5
                          ? "text-[9px] sm:text-[10px]"
                          : gridSize === 4
                            ? "text-[10px] sm:text-xs"
                            : "text-xs sm:text-sm"
                      } ${style?.text}`}
                    >
                      {p.profile?.display_name
                        ? p.profile.display_name.slice(0, 2).toUpperCase()
                        : `P${boxOwner}`}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Horizontal lines */}
          {Array.from({ length: gridSize + 1 }).map((_, r) =>
            Array.from({ length: gridSize }).map((_, c) => {
              const owner = hLines[`${r}_${c}`];
              const drawn = Boolean(owner);
              const ownerStyle = owner ? PLAYER_COLORS[(owner - 1) % 4] : null;

              return (
                <button
                  key={`h_${r}_${c}`}
                  type="button"
                  disabled={!isMyTurn || drawn || busy}
                  onClick={() => handleLineClick("h", r, c)}
                  aria-label={`Horizontal line row ${r + 1} col ${c + 1}`}
                  className={`absolute z-[5] cursor-pointer rounded-full transition-all duration-200 ${
                    drawn
                      ? "scale-100 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                      : isMyTurn
                        ? "bg-slate-700 opacity-60 hover:scale-105 hover:bg-amber-300"
                        : "cursor-not-allowed bg-slate-800 opacity-40"
                  }`}
                  style={{
                    left: `${at(c) + lineInset}%`,
                    top: `${at(r)}%`,
                    width: `${step - lineInset * 2}%`,
                    height: `${lineThickness}%`,
                    transform: "translateY(-50%)",
                    backgroundColor: ownerStyle ? ownerStyle.fill : drawn ? "#fbbf24" : undefined,
                  }}
                />
              );
            })
          )}

          {/* Vertical lines */}
          {Array.from({ length: gridSize }).map((_, r) =>
            Array.from({ length: gridSize + 1 }).map((_, c) => {
              const owner = vLines[`${r}_${c}`];
              const drawn = Boolean(owner);
              const ownerStyle = owner ? PLAYER_COLORS[(owner - 1) % 4] : null;

              return (
                <button
                  key={`v_${r}_${c}`}
                  type="button"
                  disabled={!isMyTurn || drawn || busy}
                  onClick={() => handleLineClick("v", r, c)}
                  aria-label={`Vertical line row ${r + 1} col ${c + 1}`}
                  className={`absolute z-[5] cursor-pointer rounded-full transition-all duration-200 ${
                    drawn
                      ? "scale-100 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                      : isMyTurn
                        ? "bg-slate-700 opacity-60 hover:scale-105 hover:bg-amber-300"
                        : "cursor-not-allowed bg-slate-800 opacity-40"
                  }`}
                  style={{
                    left: `${at(c)}%`,
                    top: `${at(r) + lineInset}%`,
                    width: `${lineThickness}%`,
                    height: `${step - lineInset * 2}%`,
                    transform: "translateX(-50%)",
                    backgroundColor: ownerStyle ? ownerStyle.fill : drawn ? "#fbbf24" : undefined,
                  }}
                />
              );
            })
          )}

          {/* Dots */}
          {Array.from({ length: gridSize + 1 }).map((_, r) =>
            Array.from({ length: gridSize + 1 }).map((_, c) => (
              <div
                key={`dot_${r}_${c}`}
                className="absolute z-10 rounded-full border-2 border-slate-950 bg-white shadow-md"
                style={{
                  left: `${at(c)}%`,
                  top: `${at(r)}%`,
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))
          )}
        </div>
      </div>

      <p className="mt-4 px-1 text-xs font-bold text-slate-500">
        Connect lines between dots. Complete 4 sides of a box to score points & get an extra turn!
      </p>
    </div>
  );
}
