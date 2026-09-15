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
  const board = state.connectFourBoard || Array(ROWS * COLUMNS).fill("");
  const isMyTurn = state.turn === mySeat;

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-white px-4 py-2 text-xs font-black shadow-[2px_2px_0_#171821]">
        {isMyTurn ? "YOUR TURN — DROP A DISC" : `WAITING FOR PLAYER ${state.turn}`}
      </div>
      <div className="rounded-3xl border-4 border-slate-950 bg-[#7357ff] p-3 shadow-[6px_6px_0_#171821] sm:p-5">
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {board.map((cell, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Column ${(index % COLUMNS) + 1}, row ${Math.floor(index / COLUMNS) + 1}`}
              disabled={!isMyTurn || busy || Boolean(cell)}
              onClick={() => act("drop", String(index % COLUMNS))}
              className="aspect-square rounded-full border-2 border-slate-950 bg-white shadow-inner transition enabled:hover:-translate-y-1 enabled:hover:bg-slate-100 disabled:cursor-default"
              style={{ backgroundColor: cell === "1" ? "#ff4d6d" : cell === "2" ? "#f4dc69" : "#fff" }}
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs font-bold text-slate-500">Connect four discs vertically, horizontally, or diagonally to win.</p>
    </div>
  );
}
