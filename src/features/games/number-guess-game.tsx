"use client";

import type { Room, RoomPlayer } from "@/features/rooms/types";
import { Bell, LockKeyhole, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function NumberGuessGame({ room, players, meSeat, onAct, busy }: {
  room: Room; players: RoomPlayer[]; meSeat: number; isMyTurn: boolean;
  onAct: (action: string, value?: string) => Promise<void>; busy?: boolean;
}) {
  const state = (room.public_state || {}) as Record<string, any>;
  const round = state.round || 1;
  const pickerSeat = state.pickerSeat || 1;
  const targetPicked = Boolean(state.targetPicked);
  const guesses = (state.guesses || {}) as Record<string, number>;
  const guessResults = useMemo(() => (state.guessResults || {}) as Record<string, { guess: number; correct: boolean }>, [state.guessResults]);
  const [selected, setSelected] = useState<number | null>(null);
  const [choiceNotice, setChoiceNotice] = useState("");
  const seenChoices = useRef<Record<string, number>>({});
  const seenRound = useRef(round);
  const isPicker = meSeat === pickerSeat;
  const myGuess = guesses[String(meSeat)];
  const scores = (state.scores || {}) as Record<string, number>;
  const choose = async () => { if (selected) await onAct(isPicker && !targetPicked ? "set_target" : "guess", String(selected)); };

  useEffect(() => {
    if (seenRound.current !== round) {
      seenRound.current = round;
      seenChoices.current = {};
    }

    const newChoices = Object.entries(guessResults)
      .filter(([seat, result]) => seenChoices.current[seat] !== result.guess)
      .map(([seat, result]) => {
        seenChoices.current[seat] = result.guess;
        const name = players.find((player) => String(player.seat) === seat)?.profile?.display_name || `Player ${seat}`;
        return `${name} chose ${result.guess}.`;
      });

    if (newChoices.length > 0) {
      setChoiceNotice(newChoices.join(" "));
      const timeout = window.setTimeout(() => setChoiceNotice(""), 3500);
      return () => window.clearTimeout(timeout);
    }
  }, [guessResults, players, round]);

  return <div className="mx-auto max-w-2xl space-y-5 text-center">
    <div className="flex items-center justify-between gap-3 border-b-2 border-slate-200 pb-3 text-left">
      <h3 className="text-xl font-black">Round {round} of 5</h3>
      <div className="flex gap-2 text-xs font-black">{players.map((player) => <span key={player.seat} className="rounded-full bg-slate-100 px-3 py-1">P{player.seat}: {scores[String(player.seat)] || 0}</span>)}</div>
    </div>
    {choiceNotice && <p role="status" className="flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-950"><Bell size={16} /> {choiceNotice}</p>}
    {state.message && <p role="status" className="flex items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-900"><Bell size={16} /> {state.message}</p>}
    {!targetPicked && !isPicker && <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 font-bold">Waiting for the round number to be chosen…</div>}
    {targetPicked && isPicker && <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 font-bold"><LockKeyhole className="mx-auto text-violet-700" /><p className="mt-2">The round number is set. Watch the guesses come in.</p></div>}
    {(!targetPicked && isPicker || targetPicked && !isPicker && !myGuess) && <>
      <p className="font-black">{isPicker ? "Choose the round number." : "Choose your guess."}</p>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">{Array.from({ length: 25 }, (_, i) => i + 1).map((tile) => <button key={tile} onClick={() => setSelected(tile)} disabled={busy} className={`aspect-square rounded-xl border-2 border-slate-950 text-lg font-black shadow-[3px_3px_0_#171821] ${selected === tile ? "bg-cyan-400 ring-4 ring-cyan-200" : "bg-[#e0f2fe] hover:bg-cyan-200"}`}>{tile}</button>)}</div>
      <button disabled={!selected || busy} onClick={choose} className="arcade-button mx-auto bg-[#7357ff] text-white shadow-[4px_4px_0_#171821]">{isPicker ? <><LockKeyhole size={16}/> SET {selected || ""}</> : <><Search size={16}/> GUESS {selected || ""}</>}</button>
    </>}
    {targetPicked && !isPicker && myGuess && <div className="rounded-2xl border-2 border-slate-950 bg-emerald-50 p-6 font-bold">Your guess, {myGuess}, is locked. Waiting for the other hunters…</div>}
    {Object.keys(guessResults).length > 0 && <section className="rounded-2xl border-2 border-slate-950 bg-slate-50 p-4 text-left shadow-[3px_3px_0_#171821]"><h4 className="text-xs font-black uppercase tracking-wider text-slate-600">Round activity</h4><div className="mt-3 space-y-2">{Object.entries(guessResults).map(([seat, result]) => <div key={seat} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-bold ${result.correct ? "border-emerald-500 bg-emerald-100 text-emerald-900" : "border-slate-200 bg-white"}`}><span>{players.find((player) => String(player.seat) === seat)?.profile?.display_name || `Player ${seat}`} picked {result.guess}</span><span>{result.correct ? "🎯 Found it!" : "✗ Not this time"}</span></div>)}</div></section>}
  </div>;
}
