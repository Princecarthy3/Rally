"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function EmojiDecodeGame({ room, players, userId, onAct, busy, isSpectator }: {
  room: Room;
  players: RoomPlayer[];
  userId: string;
  onAct: (action: string, value?: string) => Promise<unknown>;
  busy: boolean;
  isSpectator: boolean;
}) {
  const state = room.public_state;
  const round = state.round ?? 1;
  const phase = state.phase ?? "generating_puzzle";
  const isHost = room.host_id === userId;
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [retry, setRetry] = useState(0);
  const [timer, setTimer] = useState({ round: 1, remaining: 30 });
  const generatedFor = useRef("");
  const expiredFor = useRef("");
  const advancedFor = useRef("");
  const myPlayer = players.find((player) => player.player_id === userId);
  const solved = state.solvedSeats ?? [];
  const hasSolved = myPlayer ? solved.includes(myPlayer.seat) : false;
  const remaining = timer.round === round ? timer.remaining : 30;

  useEffect(() => {
    if (phase !== "generating_puzzle" || !isHost) return;
    const key = `${room.id}:${round}`;
    if (generatedFor.current === key) return;
    generatedFor.current = key;
    let cancelled = false;
    let attempts = 0;
    const generate = async () => {
      if (cancelled) return;
      attempts += 1;
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } };
      const token = sessionData.session?.access_token;
      if (token) {
        try {
          const response = await fetch("/api/games/emoji-decode/generate", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id, round }),
          });
          if (response.ok || response.status === 403 || response.status === 404) return;
        } catch { /* retry below while the room is still on this puzzle */ }
      }
      if (attempts < 4 && !cancelled) window.setTimeout(() => void generate(), 2500);
    };
    void generate();
    return () => { cancelled = true; };
  }, [phase, isHost, room.id, round, retry]);

  useEffect(() => {
    if (phase !== "playing") return;
    const interval = window.setInterval(() => {
      const nextRemaining = Math.max(0, Math.ceil(((state.roundEndsAt ?? Date.now()) - Date.now()) / 1000));
      setTimer((current) => current.round === round && current.remaining === nextRemaining ? current : { round, remaining: nextRemaining });
    }, 250);
    return () => window.clearInterval(interval);
  }, [phase, state.roundEndsAt, round]);

  useEffect(() => {
    if (phase !== "playing" || remaining > 0) return;
    const key = `${room.id}:${round}`;
    if (expiredFor.current === key) return;
    expiredFor.current = key;
    let cancelled = false;
    let timeout: number | undefined;
    const expire = async () => {
      const result = await onAct("time_expired");
      if (!result && !cancelled) {
        expiredFor.current = "";
        timeout = window.setTimeout(() => { expiredFor.current = key; void expire(); }, 750);
      }
    };
    void expire();
    return () => { cancelled = true; if (timeout) window.clearTimeout(timeout); };
  }, [phase, remaining, room.id, round, onAct]);

  useEffect(() => {
    if (phase !== "round_complete") return;
    const key = `${room.id}:${round}`;
    const delay = Math.max(0, (state.revealAt ?? Date.now()) - Date.now());
    const timeout = window.setTimeout(() => {
      if (advancedFor.current === key || !isHost) return;
      advancedFor.current = key;
      void onAct("advance");
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [phase, isHost, room.id, round, state.revealAt, onAct]);

  const ranking = useMemo(() => [...players].sort((a, b) => (state.scores?.[String(b.seat)] ?? 0) - (state.scores?.[String(a.seat)] ?? 0)), [players, state.scores]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guess.trim() || busy || hasSolved || phase !== "playing" || isSpectator) return;
    setFeedback("");
    const result = await onAct("guess", guess.trim()) as { correct?: boolean; points?: number } | null;
    if (result?.correct) {
      setFeedback(`🎉 Correct! +${result.points ?? 0}`);
      setGuess("");
    } else if (result?.correct === false) {
      setFeedback("Not quite! Try again.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-violet-600">Emoji Decode</p>
          <h3 className="mt-1 text-xl font-black">Round {round} of 8</h3>
        </div>
        {phase === "playing" && <div role="timer" aria-label={`${remaining} seconds remaining`} className={`rounded-2xl border-2 border-slate-950 px-4 py-2 text-2xl font-black tabular-nums shadow-[3px_3px_0_#171821] ${remaining <= 8 ? "bg-rose-200 text-rose-900" : "bg-violet-100"}`}>⏱ {remaining}s</div>}
      </div>

      {phase === "generating_puzzle" ? (
        <div role="status" className="mt-6 rounded-[28px] border-2 border-slate-950 bg-violet-50 p-8 text-center">
          <span className="text-5xl animate-pulse" aria-hidden="true">🧩✨</span>
          <p className="mt-4 font-black">Creating your {round === 1 ? "first" : "next"} puzzle…</p>
          <p className="mt-1 text-sm text-slate-500">Everyone in the room will get the same clue.</p>
          {isHost && <button onClick={() => { generatedFor.current = ""; setRetry((value) => value + 1); }} className="mt-4 text-sm font-bold text-violet-700 underline">Try loading again</button>}
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-[28px] border-2 border-slate-950 bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 px-4 py-8 text-center shadow-[5px_5px_0_#171821] sm:px-8 sm:py-10">
            <p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">{state.category || "Random"} · {state.difficulty || "medium"}</p>
            <div aria-label="Emoji clue" className="mx-auto mt-5 flex max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-3 text-5xl leading-tight sm:gap-x-6 sm:text-7xl">{(state.emojis ?? []).map((emoji, index) => <span className="animate-[emoji-pop_.35s_ease-out_both]" style={{ animationDelay: `${index * 70}ms` }} key={`${emoji}-${index}`}>{emoji}</span>)}</div>
            <p className="mt-5 text-sm font-semibold text-slate-500">What do these emojis mean?</p>
          </div>

          {phase === "playing" ? (
            <form onSubmit={submit} className="mt-5">
              <label htmlFor="emoji-decode-guess" className="sr-only">Type your answer</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input id="emoji-decode-guess" value={guess} onChange={(event) => setGuess(event.target.value)} maxLength={80} autoComplete="off" placeholder="Type your answer..." disabled={busy || hasSolved || isSpectator} className="min-w-0 flex-1 rounded-2xl border-2 border-slate-950 bg-white px-4 py-4 text-base font-bold outline-none transition focus:ring-4 focus:ring-violet-200 disabled:bg-slate-100" />
                <button disabled={busy || hasSolved || isSpectator || !guess.trim()} className="rounded-2xl border-2 border-slate-950 bg-violet-600 px-8 py-4 font-black text-white shadow-[3px_3px_0_#171821] transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? "Checking…" : "Guess"}</button>
              </div>
              <p aria-live="polite" className={`mt-3 min-h-6 text-center text-sm font-black ${feedback.includes("Correct") ? "text-emerald-700" : "text-slate-500"}`}>{hasSolved ? "🎉 You decoded it! Keep cheering your friends on." : feedback}</p>
            </form>
          ) : (
            <section role="status" className="mt-5 rounded-2xl border-2 border-slate-950 bg-emerald-100 p-5 text-center">
              <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-800">Round complete</p>
              <h4 className="mt-1 break-words text-2xl font-black">{state.answer}</h4>
              {state.explanation && <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{state.explanation}</p>}
              <div className="mt-4 flex flex-wrap justify-center gap-2">{ranking.map((player) => <span key={player.id} className="rounded-full border border-slate-950/20 bg-white px-3 py-1.5 text-xs font-bold">{player.profile?.display_name || `Player ${player.seat}`} · +{state.roundPoints?.[String(player.seat)] ?? 0}</span>)}</div>
              <p className="mt-4 text-xs font-semibold text-slate-500">{isHost ? "Next round starting…" : "Waiting for the host to start the next round…"}</p>
            </section>
          )}
        </>
      )}

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {ranking.map((player, index) => <div key={player.id} className={`flex min-w-0 items-center justify-between rounded-2xl border-2 border-slate-950 px-4 py-3 ${player.player_id === userId ? "bg-violet-100" : "bg-white"}`}>
          <span className="truncate pr-2 text-sm font-bold"><span className="mr-2">{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🎮"}</span>{player.profile?.display_name || `Player ${player.seat}`}{player.player_id === userId ? " (you)" : ""}</span>
          <strong className="shrink-0 tabular-nums">{state.scores?.[String(player.seat)] ?? 0}</strong>
        </div>)}
      </div>
    </div>
  );
}
