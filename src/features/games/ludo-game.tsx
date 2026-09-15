"use client";

import type { Room, RoomPlayer } from "@/features/rooms/types";

type Props = { state: Room["public_state"]; players: RoomPlayer[]; mySeat?: number; busy: boolean; act: (action: string, value?: string) => Promise<void> };

const COLORS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"];
const HOME = ["#fee2e2", "#dbeafe", "#fef9c3", "#dcfce7"];
const STARTS = [0, 13, 26, 39];
// Coordinates on the classic 15×15 Ludo grid, in clockwise order.
const TRACK: Array<[number, number]> = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];
const LANES: Array<Array<[number, number]>> = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]], [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]], [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
];

function positionFor(seat: number, progress: number): [number, number] | null {
  if (progress < 0) return null;
  return progress < 52 ? TRACK[(STARTS[seat - 1] + progress) % 52] : LANES[seat - 1][progress - 52];
}

export function LudoGame({ state, players, mySeat, busy, act }: Props) {
  const positions = state.ludoPositions || {};
  const turn = state.turn;
  const canMove = turn === mySeat && state.awaitingMove;
  const myTokens = positions[String(mySeat)] || [-1, -1, -1, -1];
  const movable = myTokens.map((position, index) => ({ position, index })).filter(({ position }) => state.lastRoll === 6 ? position < 57 : position >= 0 && position + (state.lastRoll || 0) <= 57);

  return <div className="mx-auto max-w-[640px]">
    <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black">
      <span>{state.awaitingMove ? `Player ${turn}: choose a token` : `Player ${turn}: roll the die`}</span>
      <span className="rounded-xl border-2 border-slate-950 bg-[#f4dc69] px-3 py-1">{state.lastRoll ? `ROLLED ${state.lastRoll}` : "🎲 READY"}</span>
    </div>
    <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl border-2 border-slate-950 bg-white shadow-[5px_5px_0_#171821]">
      <div className="grid h-full w-full grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))]">
        {Array.from({ length: 225 }, (_, i) => <div key={i} className="border-[0.5px] border-slate-200" />)}
      </div>
      {[0,1,2,3].map(seat => <div key={seat} className="absolute grid grid-cols-2 gap-1 rounded-[20%] border-2 border-slate-950 p-2" style={{ backgroundColor: HOME[seat], width:"35%", height:"35%", left: seat === 1 || seat === 3 ? "3%" : "62%", top: seat < 2 ? "3%" : "62%" }}>
        {[0,1,2,3].map(token => {
          const isHome = (positions[String(seat + 1)] || [-1,-1,-1,-1])[token] < 0;
          const canBringOut = canMove && seat + 1 === mySeat && state.lastRoll === 6 && isHome;
          return <button key={token} disabled={!canBringOut || busy} onClick={() => act("move", String(token))} aria-label={`Move token ${token + 1} from home`} className="rounded-full border-2 border-slate-950 disabled:cursor-default" style={{ backgroundColor: COLORS[seat], opacity:isHome ? 1 : .2 }} />;
        })}
      </div>)}
      {TRACK.map(([row, col], index) => <span key={index} className="absolute border border-slate-300" style={{ width:"6.6667%", height:"6.6667%", left:`${col * 6.6667}%`, top:`${row * 6.6667}%`, backgroundColor: index % 13 === 0 ? COLORS[STARTS.indexOf(index)] : "#fff" }} />)}
      {LANES.map((lane, seat) => lane.map(([row,col], index) => <span key={`${seat}-${index}`} className="absolute border border-slate-300" style={{ width:"6.6667%", height:"6.6667%", left:`${col * 6.6667}%`, top:`${row * 6.6667}%`, backgroundColor:HOME[seat] }} />))}
      <span className="absolute left-[40%] top-[40%] grid h-[20%] w-[20%] place-items-center bg-slate-950 text-2xl">🏁</span>
      {players.flatMap(player => (positions[String(player.seat)] || [-1,-1,-1,-1]).map((progress, token) => ({ player, progress, token }))).filter(({ progress }) => progress >= 0).map(({ player, progress, token }) => {
        const point = positionFor(player.seat, progress); if (!point) return null; const [row,col] = point;
        return <button key={`${player.seat}-${token}`} disabled={!canMove || !movable.some(move => move.index === token) || busy} onClick={() => act("move", String(token))} aria-label={`Move token ${token + 1}`} className="absolute z-10 grid place-items-center rounded-full border-2 border-slate-950 text-[10px] font-black shadow-sm disabled:cursor-default" style={{ width:"5.1%", height:"5.1%", left:`${col * 6.6667 + 0.8}%`, top:`${row * 6.6667 + 0.8}%`, backgroundColor:COLORS[player.seat - 1] }}>{token + 1}</button>;
      })}
    </div>
    <div className="mt-5 text-center">
      {!state.awaitingMove && <button disabled={turn !== mySeat || busy} onClick={() => act("roll")} className="arcade-button bg-[#f4dc69] px-7 py-4 shadow-[4px_4px_0_#171821]">🎲 {turn === mySeat ? "ROLL THE DICE" : "WAITING…"}</button>}
      {canMove && movable.length === 0 && <button disabled={busy} onClick={() => act("move", "-1")} className="arcade-button bg-white px-6 py-3">NO MOVE — PASS</button>}
    </div>
    <p className="mt-4 text-center text-xs font-bold text-slate-500">Roll a 6 to leave home. Land on an opponent to send them back; stars are safe.</p>
  </div>;
}
