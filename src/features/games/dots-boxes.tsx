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

  const totalBoxes = gridSize * gridSize;
  const step = 100 / gridSize;

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

  // Has game started drawing lines yet?
  const linesDrawnCount = Object.keys(hLines).length + Object.keys(vLines).length;
  const canChangeGridSize = isHost && linesDrawnCount === 0;

  return (
    <div className="mx-auto max-w-md select-none text-center">
      {/* Grid Size Selection Bar */}
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
            ].map((opt) => (
              <button
                key={opt.size}
                disabled={busy}
                onClick={() => handleGridSizeChange(opt.size)}
                className={`rounded-xl border-2 border-slate-950 px-3 py-1.5 text-xs font-black transition ${
                  gridSize === opt.size
                    ? "bg-amber-300 shadow-[2px_2px_0_#171821] scale-105"
                    : "bg-white opacity-70 hover:opacity-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Turn Indicator */}
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-amber-100 px-4 py-1.5 text-xs font-black shadow-[2px_2px_0_#171821]">
        <span>
          {isMyTurn
            ? "👉 YOUR TURN TO DRAW A LINE"
            : `WAITING FOR PLAYER ${state.turn}`}
        </span>
        <span className="ml-2 rounded-full bg-amber-300 px-2 py-0.5 text-[10px]">
          {totalBoxes} Boxes ({gridSize}×{gridSize})
        </span>
      </div>

      {/* Main Board */}
      <div className="relative mx-auto aspect-square w-full max-w-[360px] rounded-3xl border-4 border-slate-950 bg-slate-900 p-6 shadow-[6px_6px_0_#171821]">
        <div className="relative h-full w-full">
          {/* Boxes */}
          {Array.from({ length: gridSize }).map((_, r) =>
            Array.from({ length: gridSize }).map((_, c) => {
              const boxOwner = boxes[`b_${r}_${c}`];
              const p = boxOwner ? playerMap.get(boxOwner) : null;
              const style = boxOwner ? PLAYER_COLORS[(boxOwner - 1) % 4] : null;

              const boxPadding = gridSize >= 5 ? 2.5 : 4;
              const boxSize = step - boxPadding * 2;

              return (
                <div
                  key={`box_${r}_${c}`}
                  className={`absolute flex items-center justify-center rounded-lg sm:rounded-xl transition-all duration-300 ${
                    style ? `${style.bg} ${style.border} border-2 scale-95 shadow-inner` : ""
                  }`}
                  style={{
                    left: `${c * step + boxPadding}%`,
                    top: `${r * step + boxPadding}%`,
                    width: `${boxSize}%`,
                    height: `${boxSize}%`,
                  }}
                >
                  {p && (
                    <span
                      className={`font-black ${
                        gridSize >= 5
                          ? "text-[10px] sm:text-xs"
                          : gridSize === 4
                          ? "text-xs sm:text-sm"
                          : "text-sm sm:text-base"
                      } ${style?.text}`}
                    >
                      {p.profile?.display_name ? p.profile.display_name.slice(0, 2).toUpperCase() : `P${boxOwner}`}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* Horizontal Lines */}
          {Array.from({ length: gridSize + 1 }).map((_, r) =>
            Array.from({ length: gridSize }).map((_, c) => {
              const owner = hLines[`${r}_${c}`];
              const drawn = Boolean(owner);
              const ownerStyle = owner ? PLAYER_COLORS[(owner - 1) % 4] : null;

              const lineOffset = gridSize >= 5 ? 4 : 8;
              const lineLength = step - lineOffset * 2;

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
                    left: `${c * step + lineOffset}%`,
                    top: `${r * step - 1.5}%`,
                    width: `${lineLength}%`,
                    height: "3%",
                    backgroundColor: ownerStyle ? ownerStyle.fill : undefined,
                  }}
                />
              );
            })
          )}

          {/* Vertical Lines */}
          {Array.from({ length: gridSize }).map((_, r) =>
            Array.from({ length: gridSize + 1 }).map((_, c) => {
              const owner = vLines[`${r}_${c}`];
              const drawn = Boolean(owner);
              const ownerStyle = owner ? PLAYER_COLORS[(owner - 1) % 4] : null;

              const lineOffset = gridSize >= 5 ? 4 : 8;
              const lineLength = step - lineOffset * 2;

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
                    left: `${c * step - 1.5}%`,
                    top: `${r * step + lineOffset}%`,
                    width: "3%",
                    height: `${lineLength}%`,
                    backgroundColor: ownerStyle ? ownerStyle.fill : undefined,
                  }}
                />
              );
            })
          )}

          {/* Grid Dots */}
          {Array.from({ length: gridSize + 1 }).map((_, r) =>
            Array.from({ length: gridSize + 1 }).map((_, c) => (
              <div
                key={`dot_${r}_${c}`}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-white shadow-md"
                style={{
                  left: `${c * step}%`,
                  top: `${r * step}%`,
                  width: gridSize >= 5 ? "10px" : "13px",
                  height: gridSize >= 5 ? "10px" : "13px",
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
