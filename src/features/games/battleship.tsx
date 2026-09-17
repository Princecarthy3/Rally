"use client";

import type { Room, RoomPlayer } from "@/features/rooms/types";

type Shot = { row: number; col: number; hit: boolean };
type BattleshipState = { turn?: number; shots?: Record<string, Shot[]>; message?: string };

export function Battleship({
  room,
  players,
  meSeat,
  onAct,
  busy,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
}) {
  const state = (room.public_state || {}) as BattleshipState;
  const shots = state.shots?.[String(meSeat)] || [];
  const shotMap = new Map(shots.map((shot) => [`${shot.row},${shot.col}`, shot]));
  const isMyTurn = state.turn === meSeat;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-700">Battleship</p>
          <h3 className="text-2xl font-black">Find their fleet</h3>
        </div>
        <div className="text-xs font-black">
          {players.map((player) => <span key={player.seat} className="ml-2 rounded-full bg-slate-100 px-3 py-1">P{player.seat}: {state.shots?.[String(player.seat)]?.filter((shot) => shot.hit).length || 0} hits</span>)}
        </div>
      </div>
      <p className="text-center text-sm font-bold text-slate-500">
        {isMyTurn ? "Your turn: fire at a coordinate." : state.message || "Waiting for the other captain…"}
      </p>
      <div className="mx-auto grid max-w-sm grid-cols-5 gap-2 rounded-2xl border-2 border-slate-950 bg-[#bde3ff] p-3 shadow-[4px_4px_0_#171821]">
        {Array.from({ length: 25 }, (_, index) => {
          const row = Math.floor(index / 5);
          const col = index % 5;
          const shot = shotMap.get(`${row},${col}`);
          return (
            <button
              key={index}
              disabled={!isMyTurn || busy || Boolean(shot)}
              onClick={() => void onAct("fire", `${row},${col}`)}
              className={`aspect-square rounded-xl border-2 border-slate-950 text-xl font-black transition ${
                shot ? (shot.hit ? "bg-red-400" : "bg-white") : "bg-blue-500 text-white hover:bg-blue-400"
              } disabled:cursor-not-allowed`}
              aria-label={`Fire at row ${row + 1}, column ${col + 1}`}
            >
              {shot ? (shot.hit ? "💥" : "🌊") : "?"}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-slate-500">
        <span>💥 Hit</span><span>🌊 Miss</span>
      </div>
    </div>
  );
}
