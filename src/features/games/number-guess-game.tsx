"use client";

import type { Room, RoomPlayer } from "@/features/rooms/types";
import { LockKeyhole, Search } from "lucide-react";
import { useState } from "react";

export function NumberGuessGame({ room, players, meSeat, onAct, busy }: {
  room: Room; players: RoomPlayer[]; meSeat: number; isMyTurn: boolean;
  onAct: (action: string, value?: string) => Promise<void>; busy?: boolean;
}) {
  const state = (room.public_state || {}) as Record<string, any>;
  const round = state.round || 1;
  const pickerSeat = state.pickerSeat || 1;
  const targetPicked = Boolean(state.targetPicked);
  const guesses = (state.guesses || {}) as Record<string, number>;
  const [selected, setSelected] = useState<number | null>(null);
  const isPicker = meSeat === pickerSeat;
  const myGuess = guesses[String(meSeat)];
  const scores = (state.scores || {}) as Record<string, number>;
  const pickerName = players.find((player) => player.seat === pickerSeat)?.profile?.display_name || `Player ${pickerSeat}`;
  const choose = async () => { if (selected) await onAct(isPicker && !targetPicked ? "set_target" : "guess", String(selected)); };

  return <div className="mx-auto max-w-2xl space-y-5 text-center">
    <div className="rounded-3xl border-4 border-slate-950 bg-slate-900 p-5 text-white shadow-[6px_6px_0_#171821]">
      <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Number Hunt: Secret Picker</p>
      <h3 className="mt-1 text-xl font-black">Round {round} of 5</h3>
      <p className="mt-3 text-sm text-slate-300">One player hides a number from 1–25. Every other player gets one chance to find it.</p>
      <div className="mt-4 flex justify-center gap-3 text-xs font-black">{players.map((player) => <span key={player.seat} className="rounded-full bg-white/10 px-3 py-1">P{player.seat}: {scores[String(player.seat)] || 0}</span>)}</div>
    </div>
    {state.message && <p className="rounded-xl border-2 border-slate-950 bg-[#f4dc69] px-4 py-2 text-sm font-black">{state.message}</p>}
    {!targetPicked && !isPicker && <div className="rounded-2xl border-2 border-slate-950 bg-slate-100 p-6 font-bold">{pickerName} is choosing a secret number…</div>}
    {targetPicked && isPicker && <div className="rounded-2xl border-2 border-slate-950 bg-violet-50 p-6 font-bold"><LockKeyhole className="mx-auto text-violet-700" /><p className="mt-2">Your number is hidden. Watch the hunters make their picks.</p></div>}
    {(!targetPicked && isPicker || targetPicked && !isPicker && !myGuess) && <>
      <p className="font-black">{isPicker ? "Choose the secret number—only the database will keep it." : "Pick the number you think is hidden."}</p>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">{Array.from({ length: 25 }, (_, i) => i + 1).map((tile) => <button key={tile} onClick={() => setSelected(tile)} disabled={busy} className={`aspect-square rounded-xl border-2 border-slate-950 text-lg font-black shadow-[3px_3px_0_#171821] ${selected === tile ? "bg-cyan-400 ring-4 ring-cyan-200" : "bg-[#e0f2fe] hover:bg-cyan-200"}`}>{tile}</button>)}</div>
      <button disabled={!selected || busy} onClick={choose} className="arcade-button mx-auto bg-[#7357ff] text-white shadow-[4px_4px_0_#171821]">{isPicker ? <><LockKeyhole size={16}/> HIDE {selected || ""}</> : <><Search size={16}/> GUESS {selected || ""}</>}</button>
    </>}
    {targetPicked && !isPicker && myGuess && <div className="rounded-2xl border-2 border-slate-950 bg-emerald-50 p-6 font-bold">Your guess, {myGuess}, is locked. Waiting for the other hunters…</div>}
  </div>;
}
