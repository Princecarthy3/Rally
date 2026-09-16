"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";

type TriviaState = {
  round?: number;
  question?: string;
  options?: string[];
  answers?: Record<string, number>;
  scores?: Record<string, number>;
  revealed?: boolean;
  correctAnswer?: number;
  message?: string;
};

export function TriviaClash({ room, players, meSeat, onAct, busy }: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
}) {
  const state = (room.public_state || {}) as TriviaState;
  const [selected, setSelected] = useState<number | null>(null);
  const answers = state.answers || {};
  const hasAnswered = Object.prototype.hasOwnProperty.call(answers, String(meSeat));
  const scores = state.scores || {};

  useEffect(() => {
    if (!state.question && !busy) void onAct("load_question");
  }, [busy, onAct, state.question]);

  async function submit() {
    if (selected === null || hasAnswered || state.revealed) return;
    await onAct("answer", String(selected));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-violet-600">Trivia Clash</p>
          <h3 className="text-2xl font-black">Question {state.round || 1} of 5</h3>
        </div>
        <div className="flex gap-2 text-xs font-black">
          {players.map((player) => <span key={player.seat} className="rounded-full bg-slate-100 px-3 py-1">P{player.seat}: {scores[String(player.seat)] || 0}</span>)}
        </div>
      </div>
      {state.message && <p role="status" className="rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2 text-center text-sm font-black text-violet-900">{state.message}</p>}
      {!state.question ? (
        <div className="py-16 text-center font-black"><LoaderCircle className="mx-auto animate-spin text-violet-600" /> Loading question…</div>
      ) : (
        <>
          <h4 className="text-center text-xl font-black">{state.question}</h4>
          <div className="grid gap-3">
            {(state.options || []).map((option, index) => {
              const isCorrect = state.revealed && index === state.correctAnswer;
              const isWrong = state.revealed && answers[String(meSeat)] === index && !isCorrect;
              return <button key={option} onClick={() => setSelected(index)} disabled={busy || hasAnswered || Boolean(state.revealed)} className={`flex items-center justify-between rounded-2xl border-2 border-slate-950 p-4 text-left font-bold transition ${isCorrect ? "bg-emerald-200" : isWrong ? "bg-red-100" : selected === index ? "bg-violet-200 shadow-[3px_3px_0_#171821]" : "bg-white hover:bg-violet-50"}`}>{option}{isCorrect && <Check size={18} />}{isWrong && <X size={18} />}</button>;
            })}
          </div>
          {!state.revealed && !hasAnswered && <button onClick={submit} disabled={selected === null || busy} className="arcade-button mx-auto bg-violet-600 text-white shadow-[4px_4px_0_#171821]">Lock answer</button>}
          {hasAnswered && !state.revealed && <p className="text-center text-sm font-bold text-slate-500">Answer locked. Waiting for the other players…</p>}
          {state.revealed && state.round! < 5 && <button onClick={() => onAct("next_question")} disabled={busy} className="arcade-button mx-auto bg-slate-950 text-white">Next question</button>}
        </>
      )}
    </div>
  );
}
