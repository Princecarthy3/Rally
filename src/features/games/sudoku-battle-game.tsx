"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasLocalConflict, stringToGrid, type SudokuGrid } from "@/features/games/sudoku/engine";
import type { Room, RoomPlayer } from "@/features/rooms/types";

type Props = {
  room: Room;
  players: RoomPlayer[];
  userId: string;
  onAct: (action: string, value?: string) => Promise<unknown>;
  busy: boolean;
  isSpectator?: boolean;
};

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function SudokuBattleGame({ room, players, userId, onAct, busy, isSpectator }: Props) {
  const state = (room.public_state || {}) as Record<string, unknown>;
  const phase = String(state.phase || "lobby");
  const puzzleStr = String(state.puzzle || "");
  const startAt = Number(state.startAt || 0);
  const endsAt = Number(state.endsAt || 0);
  const progress = useMemo(
    () =>
      (state.progress || {}) as Record<
        string,
        { filled?: number; correct?: number; mistakes?: number; finished?: boolean; finishMs?: number }
      >,
    [state.progress]
  );
  const isHost = room.host_id === userId;

  const [board, setBoard] = useState<SudokuGrid>(() => stringToGrid(puzzleStr));
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [boardReady, setBoardReady] = useState(false);
  const generatedFor = useRef("");

  const puzzle = useMemo(() => stringToGrid(puzzleStr), [puzzleStr]);
  const clues = useMemo(() => new Set(puzzle.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0)), [puzzle]);

  // Host generates shared puzzle once
  useEffect(() => {
    if (phase !== "generating" || !isHost) return;
    const key = `${room.id}:${String(state.matchId || "")}`;
    if (generatedFor.current === key) return;
    generatedFor.current = key;
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/games/sudoku-battle/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id }),
      });
      if (!res.ok && !cancelled) {
        const body = await res.json().catch(() => null);
        setMessage(body?.error || "Could not generate puzzle");
        generatedFor.current = "";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, isHost, room.id, state.matchId]);

  // Load private board from server when the match is live / finished.
  const shouldLoadBoard = phase === "playing" || phase === "results";
  useEffect(() => {
    if (!shouldLoadBoard) return;
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) setBoardReady(true);
        return;
      }
      const { data, error } = await supabase.rpc("get_sudoku_my_board", { p_room: room.id });
      if (cancelled) return;
      if (!error && data) {
        setBoard(stringToGrid(String(data.board || puzzleStr || "")));
        setMistakes(Number(data.mistakes || 0));
        setFinished(Boolean(data.finished));
      } else if (puzzleStr) {
        setBoard(stringToGrid(puzzleStr));
      }
      setBoardReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [room.id, shouldLoadBoard, puzzleStr, state.matchId]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || !endsAt || now < endsAt || finished) return;
    void onAct("time_expired");
  }, [phase, endsAt, now, finished, onAct]);

  const elapsed = startAt ? Math.max(0, Math.min(now, endsAt || now) - startAt) : 0;
  const remaining = endsAt ? Math.max(0, endsAt - now) : 0;

  const place = useCallback(
    async (cell: number, digit: number) => {
      if (isSpectator || finished || busy || phase !== "playing" || clues.has(cell)) return;
      const result = (await onAct("place", `${cell}:${digit}`)) as {
        board?: string;
        mistakes?: number;
        finished?: boolean;
        isCorrectDigit?: boolean | null;
      } | null;
      if (result?.board) {
        setBoard(stringToGrid(result.board));
        setMistakes(Number(result.mistakes || 0));
        setFinished(Boolean(result.finished));
        if (result.finished) setMessage("You finished!");
        else if (result.isCorrectDigit === false) setMessage("Incorrect — try another number");
        else setMessage("");
      }
    },
    [isSpectator, finished, busy, phase, clues, onAct]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "playing" || selected == null || finished) return;
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        void place(selected, Number(e.key));
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        void place(selected, 0);
      } else if (e.key.startsWith("Arrow") && selected != null) {
        e.preventDefault();
        const row = Math.floor(selected / 9);
        const col = selected % 9;
        let nr = row;
        let nc = col;
        if (e.key === "ArrowUp") nr = Math.max(0, row - 1);
        if (e.key === "ArrowDown") nr = Math.min(8, row + 1);
        if (e.key === "ArrowLeft") nc = Math.max(0, col - 1);
        if (e.key === "ArrowRight") nc = Math.min(8, col + 1);
        setSelected(nr * 9 + nc);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, selected, finished, place]);

  const rankings = useMemo(() => {
    return [...players]
      .map((p) => {
        const prog = progress[String(p.seat)] || {};
        return {
          player: p,
          finished: Boolean(prog.finished),
          finishMs: Number(prog.finishMs || 0),
          correct: Number(prog.correct || 0),
          mistakes: Number(prog.mistakes || 0),
        };
      })
      .sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? -1 : 1;
        if (a.finished && b.finished) {
          if (a.finishMs !== b.finishMs) return a.finishMs - b.finishMs;
          return a.mistakes - b.mistakes;
        }
        if (a.correct !== b.correct) return b.correct - a.correct;
        return a.mistakes - b.mistakes;
      });
  }, [players, progress]);

  if (phase === "generating") {
    return (
      <div className="rounded-3xl border-2 border-slate-950 bg-white p-8 text-center shadow-[4px_4px_0_#171821]">
        <p className="text-lg font-black">Building a unique Sudoku…</p>
        <p className="mt-2 text-sm text-slate-500">Everyone gets the same puzzle.</p>
        {message && <p className="mt-3 text-sm font-bold text-red-600">{message}</p>}
      </div>
    );
  }

  if (phase === "results" || room.status === "completed") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border-2 border-slate-950 bg-[#f4dc69] p-5 shadow-[4px_4px_0_#171821]">
          <h2 className="text-2xl font-black">Sudoku Battle Complete</h2>
          <p className="text-sm font-bold text-slate-700">Completed players rank by time, then mistakes.</p>
        </div>
        <ol className="space-y-2">
          {rankings.map((row, i) => (
            <li
              key={row.player.player_id}
              className="flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 shadow-[3px_3px_0_#171821]"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-black">{row.player.profile?.display_name || `Player ${row.player.seat}`}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {row.finished
                      ? `Completed in ${formatMs(row.finishMs)} · ${row.mistakes} mistake${row.mistakes === 1 ? "" : "s"}`
                      : `${row.correct}/81 correct · ${row.mistakes} mistakes`}
                  </p>
                </div>
              </div>
              {i === 0 && row.finished && <span className="text-xl">🏆</span>}
            </li>
          ))}
        </ol>
        {isHost && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAct("rematch")}
            className="w-full rounded-2xl border-2 border-slate-950 bg-[#7357ff] py-3 text-sm font-black text-white shadow-[3px_3px_0_#171821]"
          >
            Rematch
          </button>
        )}
      </div>
    );
  }

  const selRow = selected != null ? Math.floor(selected / 9) : -1;
  const selCol = selected != null ? selected % 9 : -1;
  const selBoxR = selRow >= 0 ? Math.floor(selRow / 3) : -1;
  const selBoxC = selCol >= 0 ? Math.floor(selCol / 3) : -1;
  const selVal = selected != null ? board[selected] : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="rounded-3xl border-2 border-slate-950 bg-white p-3 shadow-[4px_4px_0_#171821] sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Sudoku Battle</p>
            <p className="text-sm font-black text-slate-700">
              {finished ? "You finished!" : "Solve the puzzle!"}
            </p>
          </div>
          <div className="flex gap-2 text-xs font-black">
            <span className="rounded-full border-2 border-slate-950 bg-violet-100 px-3 py-1 tabular-nums">
              ⏱ {formatMs(finished ? elapsed : remaining)}
            </span>
            <span className="rounded-full border-2 border-slate-950 bg-rose-100 px-3 py-1">✗ {mistakes}</span>
          </div>
        </div>

        {shouldLoadBoard && !boardReady ? (
          <p className="py-10 text-center text-sm font-bold text-slate-500">Loading your board…</p>
        ) : (
          <div
            role="grid"
            aria-label="Sudoku board"
            className="mx-auto grid aspect-square w-full max-w-[min(100%,420px)] grid-cols-9 overflow-hidden rounded-xl border-2 border-slate-950 bg-slate-950"
          >
            {board.map((val, i) => {
              const row = Math.floor(i / 9);
              const col = i % 9;
              const isClue = clues.has(i);
              const isSel = selected === i;
              const inLine = row === selRow || col === selCol;
              const inBox =
                Math.floor(row / 3) === selBoxR && Math.floor(col / 3) === selBoxC;
              const sameNum = selVal > 0 && val === selVal;
              const conflict = val > 0 && hasLocalConflict(board, i, val);
              const thickRight = col % 3 === 2 && col !== 8;
              const thickBottom = row % 3 === 2 && row !== 8;
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  aria-label={`Row ${row + 1} column ${col + 1}${isClue ? " clue" : ""} ${val || "empty"}`}
                  disabled={finished || isSpectator || isClue}
                  onClick={() => setSelected(i)}
                  className={[
                    "relative flex items-center justify-center text-base font-black sm:text-lg",
                    "border border-slate-300 bg-white",
                    thickRight ? "border-r-2 border-r-slate-950" : "",
                    thickBottom ? "border-b-2 border-b-slate-950" : "",
                    isClue ? "bg-slate-100 text-slate-950" : "text-violet-700",
                    inLine || inBox ? "bg-violet-50" : "",
                    sameNum ? "bg-amber-100" : "",
                    isSel ? "z-10 ring-2 ring-inset ring-[#7357ff]" : "",
                    conflict ? "text-rose-600" : "",
                    finished ? "opacity-90" : "",
                  ].join(" ")}
                >
                  {val > 0 ? val : ""}
                </button>
              );
            })}
          </div>
        )}

        {!finished && !isSpectator && phase === "playing" && (
          <div className="mx-auto mt-3 grid max-w-[min(100%,420px)] grid-cols-5 gap-1.5 sm:grid-cols-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy || selected == null}
                onClick={() => selected != null && void place(selected, n)}
                className="rounded-xl border-2 border-slate-950 bg-[#e8e1ff] py-2.5 text-sm font-black shadow-[2px_2px_0_#171821] active:translate-y-0.5"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={busy || selected == null}
              onClick={() => selected != null && void place(selected, 0)}
              className="rounded-xl border-2 border-slate-950 bg-slate-100 py-2.5 text-sm font-black shadow-[2px_2px_0_#171821]"
              aria-label="Clear cell"
            >
              ⌫
            </button>
          </div>
        )}
        {message && <p className="mt-2 text-center text-xs font-bold text-slate-600">{message}</p>}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Opponents</p>
        {players.map((p) => {
          const prog = progress[String(p.seat)] || {};
          const correct = Number(prog.correct || 0);
          const pct = Math.round((correct / 81) * 100);
          const done = Boolean(prog.finished);
          return (
            <div
              key={p.player_id}
              className="rounded-2xl border-2 border-slate-950 bg-white p-3 shadow-[2px_2px_0_#171821]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-black">
                  {p.profile?.display_name || `P${p.seat}`}
                  {p.player_id === userId ? " (you)" : ""}
                </p>
                {done ? (
                  <span className="text-xs font-black text-emerald-600">✓ Done</span>
                ) : (
                  <span className="text-xs font-bold text-slate-500">{pct}%</span>
                )}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-[#7357ff]"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-bold text-slate-500">
                {correct}/81 · {Number(prog.mistakes || 0)} mistakes
                {done && prog.finishMs != null ? ` · ${formatMs(Number(prog.finishMs))}` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
