"use client";

import type { Room } from "@/features/rooms/types";

const ROWS = 6;
const COLUMNS = 7;

export function ConnectFour({
  state,
  mySeat,
  act,
  busy,
}: {
  state: Room["public_state"];
  mySeat?: number;
  act: (action: string, value?: string) => Promise<void>;
  busy: boolean;
}) {
  const board = Array.from({ length: ROWS * COLUMNS }, (_, index) => state.connectFourBoard?.[index] || "");
  const isMyTurn = state.turn === mySeat;
  const openColumns = Array.from({ length: COLUMNS }, (_, column) =>
    Array.from({ length: ROWS }, (_, row) => board[row * COLUMNS + column]).some((cell) => !cell)
  );

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-white px-4 py-2 text-xs font-black shadow-[2px_2px_0_#171821]">
        {isMyTurn ? "YOUR TURN — DROP A DISC" : `WAITING FOR PLAYER ${state.turn}`}
      </div>
      <div className="rounded-3xl border-4 border-slate-950 bg-[#7357ff] p-3 shadow-[6px_6px_0_#171821] sm:p-5">
        <div className="mb-3 grid grid-cols-7 gap-2 sm:gap-3">
          {openColumns.map((isOpen, column) => (
            <button
              key={column}
              type="button"
              aria-label={`Drop disc in column ${column + 1}`}
              disabled={!isMyTurn || busy || !isOpen}
              onClick={() => act("drop", String(column))}
              className="rounded-xl border-2 border-slate-950 bg-white py-2 text-sm font-black transition enabled:hover:-translate-y-1 enabled:hover:bg-[#a7efc8] disabled:cursor-default disabled:opacity-40"
            >
              ↓
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6 gap-2 sm:gap-3">
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: COLUMNS }, (_, column) => {
              const columnDiscs = Array.from({ length: ROWS }, (_, offset) => board[(ROWS - 1 - offset) * COLUMNS + column])
                .filter(Boolean)
                .slice(0, ROWS);
              const cell = String(columnDiscs[ROWS - 1 - row] || "");
              return (
                <div
                  key={`cell-${row}-${column}`}
                  aria-label={`Column ${column + 1}, row ${row + 1}`}
                  className="aspect-square min-w-0 rounded-full border-2 border-slate-950 bg-white shadow-inner"
                  style={{
                    backgroundColor: cell === "1" ? "#ff4d6d" : cell === "2" ? "#f4dc69" : "#fff",
                  }}
                />
              );
            })
          )}
        </div>
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500">Connect four discs vertically, horizontally, or diagonally to win.</p>
    </div>
  );
}
