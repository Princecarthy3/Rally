"use client";

import { ArrowLeft, Clock3, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/customization/user-avatar";
import type { MancalaDestination, MancalaSeat, MancalaState } from "@/features/games/mancala";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const pitOrder = {
  1: [0, 1, 2, 3, 4, 5],
  2: [5, 4, 3, 2, 1, 0],
} satisfies Record<MancalaSeat, number[]>;

function friendlyError(message: string) {
  if (/state changed|stale/i.test(message)) return "The board just updated. Your game has been refreshed.";
  if (/wait for your turn/i.test(message)) return "It isn't your turn yet.";
  if (/empty pit/i.test(message)) return "That pit is empty. Choose another pit.";
  if (/turn expired/i.test(message)) return "Time ran out. The turn is being passed.";
  if (/not a player|not in this room/i.test(message)) return "You are no longer a player in this room.";
  if (/not active|complete/i.test(message)) return "This game has already ended.";
  return "That action could not be saved. Check your connection and try again.";
}

function destinationKey(destination: MancalaDestination) {
  return destination.type === "store" ? `store-${destination.seat}` : `pit-${destination.seat}-${destination.index}`;
}

function Stones({ count }: { count: number }) {
  const shown = Math.min(count, 16);
  return (
    <span aria-hidden="true" className="grid min-h-6 max-w-10 grid-cols-4 content-center justify-items-center gap-0.5 sm:min-h-7 sm:max-w-14">
      {Array.from({ length: shown }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-1.5 rounded-full border border-white/70 shadow-sm sm:h-2.5 sm:w-2.5 ${
            index % 3 === 0 ? "bg-[#f4dc69]" : index % 3 === 1 ? "bg-[#eee9ff]" : "bg-[#c4b5fd]"
          }`}
        />
      ))}
      {count > shown && <span className="col-span-4 text-[8px] font-black text-white/80">+{count - shown}</span>}
    </span>
  );
}

export function MancalaGame({
  room,
  players,
  userId,
  onlineIds,
  refresh,
  applyPublicState,
  isSpectator,
}: {
  room: Room;
  players: RoomPlayer[];
  userId: string;
  onlineIds: string[];
  refresh: () => Promise<void>;
  applyPublicState?: (publicState: Room["public_state"], extras?: Partial<Room>) => void;
  isSpectator: boolean;
}) {
  const me = players.find((player) => player.player_id === userId);
  const state = room.public_state as Room["public_state"] & Partial<MancalaState>;
  const supabase = getSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [selectedPit, setSelectedPit] = useState<number | null>(null);
  const [activeDestination, setActiveDestination] = useState<string | null>(null);
  const timeoutRequestedVersion = useRef<number | null>(null);
  const gameStateReady =
    Array.isArray(state.pits?.[1]) &&
    Array.isArray(state.pits?.[2]) &&
    state.stores !== undefined &&
    state.turn !== undefined;
  const isCompleted = room.status === "completed";
  const secondsLeft = state.turnDeadline
    ? now === 0 ? 30 : Math.max(0, Math.ceil((Date.parse(state.turnDeadline) - now) / 1000))
    : 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const move = state.lastMove;
    if (!move?.path?.length || !room.public_state.moveNumber) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let index = 0;
    const timers: number[] = [];
    for (const destination of move.path.slice(-18)) {
      timers.push(
        window.setTimeout(() => setActiveDestination(destinationKey(destination)), index * 42),
      );
      index += 1;
    }
    timers.push(window.setTimeout(() => setActiveDestination(null), index * 42 + 330));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [room.public_state.moveNumber, state.lastMove]);

  useEffect(() => {
    if (!isCompleted || state.status !== "completed") return;
    if (state.winnerSeat === null) sounds.playDrawSound();
    else if (state.winnerSeat === me?.seat) sounds.playWinSound();
    else sounds.playLoseSound();
  }, [isCompleted, me?.seat, room.match_number, state.status, state.winnerSeat]);

  const applyResponse = useCallback(
    (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const payload = data as {
        public_state?: Room["public_state"];
        status?: Room["status"];
        state_version?: number;
      };
      if (!payload.public_state) return;
      applyPublicState?.(payload.public_state, {
        ...(payload.status ? { status: payload.status } : {}),
        ...(typeof payload.state_version === "number" ? { state_version: payload.state_version } : {}),
      });
    },
    [applyPublicState],
  );

  const makeMove = useCallback(
    async (pit: number) => {
      if (busy || isSpectator || room.status !== "playing" || !me || !supabase) return;
      setBusy(true);
      setNotice("");
      sounds.playClickSound();
      try {
        const { data, error } = await supabase.rpc("play_mancala_action", {
          p_room: room.id,
          p_pit: pit,
          p_expected_version: room.state_version,
        });
        if (error) {
          setNotice(friendlyError(error.message));
          if (/state changed|turn expired/i.test(error.message)) await refresh();
          return;
        }
        applyResponse(data);
        const updated = data as { public_state?: MancalaState };
        const lastMove = updated.public_state?.lastMove;
        if (lastMove?.captured) sounds.playTokenCaptureSound();
        else if (lastMove?.extraTurn) sounds.playMessageSound();
        else sounds.playTokenMoveSound();
        await refresh();
      } catch {
        setNotice("Connection interrupted. Reconnecting to the room…");
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [applyResponse, busy, isSpectator, me, refresh, room.id, room.state_version, room.status, supabase],
  );

  const expireTurn = useCallback(async () => {
    if (
      busy ||
      !supabase ||
      !me ||
      isSpectator ||
      room.status !== "playing" ||
      secondsLeft > 0 ||
      timeoutRequestedVersion.current === room.state_version
    ) return;
    timeoutRequestedVersion.current = room.state_version;
    const { data, error } = await supabase.rpc("expire_mancala_turn", {
      p_room: room.id,
      p_expected_version: room.state_version,
    });
    if (error) {
      if (/state changed|not active/i.test(error.message)) {
        await refresh();
        return;
      }
      timeoutRequestedVersion.current = null;
      setNotice("The turn timer is reconnecting. Please wait a moment.");
      window.setTimeout(() => setNow(Date.now()), 1500);
      return;
    }
    setNotice("Time's up — the turn has passed.");
    applyResponse(data);
    await refresh();
  }, [applyResponse, busy, isSpectator, me, refresh, room.id, room.state_version, room.status, secondsLeft, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void expireTurn(), 0);
    return () => window.clearTimeout(timer);
  }, [expireTurn]);

  const requestRematch = useCallback(async () => {
    if (!supabase || !me || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await supabase.rpc("request_mancala_rematch", { p_room: room.id });
      if (error) {
        setNotice(friendlyError(error.message));
        return;
      }
      applyResponse(data);
      const payload = data as { status?: string };
      setNotice(payload.status === "playing" ? "Rematch accepted — good luck!" : "Rematch request sent. Waiting for your opponent…");
      sounds.playMessageSound();
      await refresh();
    } catch {
      setNotice("Connection interrupted. Your rematch request may not have reached the room.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [applyResponse, busy, me, refresh, room.id, supabase]);

  if (!gameStateReady) {
    return (
      <div className="paper-card mx-auto grid min-h-72 max-w-4xl place-items-center p-8 text-center">
        <div><LoaderCircle className="mx-auto animate-spin text-violet-600" /><p className="mt-3 font-black">Loading Mancala board…</p></div>
      </div>
    );
  }

  const names: Record<MancalaSeat, string> = {
    1: players.find((player) => player.seat === 1)?.profile?.display_name || "Player 1",
    2: players.find((player) => player.seat === 2)?.profile?.display_name || "Player 2",
  };
  const opponentSeat = me?.seat === 1 ? 2 : 1;
  const opponent = players.find((player) => player.seat === opponentSeat);
  const opponentOnline = Boolean(opponent && onlineIds.includes(opponent.player_id));
  const myTurn = !isSpectator && me?.seat === state.turn && !isCompleted;
  const rematchRequestedByMe = Boolean(me && state.rematchRequests?.includes(me.seat));
  const activeName = names[state.turn as MancalaSeat] || "Player";

  function renderPit(seat: MancalaSeat, pit: number) {
    const stones = state.pits?.[seat]?.[pit] ?? 0;
    const selectable = myTurn && seat === me?.seat && stones > 0 && !busy;
    const label = `Player ${seat} pit ${pit + 1}, ${stones} ${stones === 1 ? "stone" : "stones"}${
      selectable ? ", selectable" : stones === 0 ? ", empty" : ""
    }`;
    const key = `pit-${seat}-${pit}`;
    const isCapture = Boolean(
      state.lastMove?.captured &&
        state.lastMove.path.length > 0 &&
        destinationKey(state.lastMove.path[state.lastMove.path.length - 1]) === key,
    );
    return (
      <button
        key={key}
        type="button"
        aria-label={label}
        aria-disabled={!selectable}
        aria-pressed={selectedPit === pit && seat === me?.seat}
        disabled={!selectable}
        onClick={() => {
          setSelectedPit(pit);
          void makeMove(pit).finally(() => setSelectedPit(null));
        }}
        className={`flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1 rounded-[45%] border-2 px-0.5 py-2 transition duration-200 motion-reduce:animate-none sm:min-h-[104px] sm:gap-2 sm:rounded-[50%] ${
          activeDestination === key
            ? isCapture
              ? "scale-105 animate-pulse border-rose-200 bg-rose-500 ring-4 ring-rose-300/50"
              : "scale-105 border-[#f4dc69] bg-violet-500 ring-4 ring-[#f4dc69]/40"
            : selectedPit === pit && seat === me?.seat
              ? "scale-105 border-[#f4dc69] bg-violet-500 ring-4 ring-[#f4dc69]/40"
            : selectable
              ? "cursor-pointer border-violet-300 bg-[#261b3c] hover:-translate-y-1 hover:border-[#f4dc69] hover:bg-[#39275a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f4dc69]"
              : "cursor-not-allowed border-white/10 bg-[#241b32] opacity-70"
        } ${selectable ? "motion-safe:hover:shadow-[0_0_18px_rgba(244,220,105,.25)]" : ""}`}
      >
        <Stones count={stones} />
        <span className="text-sm font-black tabular-nums text-white sm:text-base">{stones}</span>
      </button>
    );
  }

  function renderStore(seat: MancalaSeat) {
    const count = state.stores?.[seat] ?? 0;
    const key = `store-${seat}`;
    return (
      <div
        key={key}
        role="group"
        aria-label={`${names[seat]} store, ${count} stones`}
        className={`row-span-2 flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-[32px] border-2 p-1 text-center sm:min-h-[224px] sm:rounded-[40px] sm:p-3 ${
          activeDestination === key
            ? "scale-[1.03] border-[#f4dc69] bg-violet-500 shadow-[0_0_22px_rgba(244,220,105,.35)]"
            : "border-violet-300/50 bg-[#281d3d]"
        }`}
      >
        <span className="text-[8px] font-black uppercase leading-tight tracking-wide text-violet-200 sm:text-[10px]">
          {names[seat]}<br />Store
        </span>
        <Stones count={count} />
        <span className="text-xl font-black tabular-nums text-white sm:text-3xl">{count}</span>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 pb-10">
      <header className="paper-card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-600">Mancala · Kalah</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Classic stones. Smart moves.</h1>
        </div>
        {room.status === "playing" && (
          <div className="flex items-center gap-2 rounded-full border-2 border-slate-950 bg-violet-100 px-3 py-2 text-xs font-black text-violet-950 sm:px-4">
            <Clock3 size={15} aria-hidden="true" />
            <span aria-live="polite">{secondsLeft}s</span>
          </div>
        )}
      </header>

      <section className="paper-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-950 bg-[#eee9ff] p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            {me && <UserAvatar avatarUrl={players.find((player) => player.player_id === userId)?.profile?.avatar_url} fallbackName={names[me.seat as MancalaSeat]} size="sm" />}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                {isSpectator ? "Spectating" : myTurn ? "Your turn" : "Opponent's turn"}
              </p>
              <p className="truncate text-lg font-black text-slate-950">
                {myTurn ? `${names[state.turn as MancalaSeat]}'s turn` : `${activeName}'s turn`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
            <span className={`h-2.5 w-2.5 rounded-full ${opponentOnline ? "bg-emerald-500" : "bg-amber-500"}`} />
            {opponentOnline ? `${opponent?.profile?.display_name || "Opponent"} connected` : `${opponent?.profile?.display_name || "Opponent"} disconnected · reconnecting`}
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {notice && <p role="status" className="mb-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-center text-sm font-bold text-violet-900">{notice}</p>}
          {state.message && room.status === "playing" && (
            <p aria-live="polite" className="mb-3 text-center text-sm font-black text-violet-800">
              {state.message}
            </p>
          )}

          <div className="rounded-[26px] border-2 border-slate-950 bg-[#7357ff] p-2 shadow-[5px_5px_0_#171821] sm:rounded-[34px] sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              {[2, 1].map((seat) => {
                const player = players.find((candidate) => candidate.seat === seat);
                const isActive = state.turn === seat && room.status === "playing";
                return (
                  <div key={seat} className={`flex min-w-0 items-center gap-2 rounded-full border px-2 py-1.5 sm:px-3 ${isActive ? "border-[#f4dc69] bg-[#f4dc69] text-slate-950" : "border-white/30 bg-[#281d3d] text-white"}`}>
                    <UserAvatar avatarUrl={player?.profile?.avatar_url} fallbackName={names[seat as MancalaSeat]} size="xs" />
                    <span className="max-w-28 truncate text-[10px] font-black sm:max-w-40 sm:text-xs">{names[seat as MancalaSeat]}</span>
                    {isActive && <span className="hidden text-[9px] font-black uppercase sm:inline">Playing</span>}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[32px_repeat(6,minmax(0,1fr))_32px] items-stretch gap-1 sm:grid-cols-[68px_repeat(6,minmax(0,1fr))_68px] sm:gap-3">
              {renderStore(2)}
              {pitOrder[2].map((pit) => renderPit(2, pit))}
              {pitOrder[1].map((pit) => renderPit(1, pit))}
              {renderStore(1)}
            </div>
            <div className="mt-3 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-widest text-white/80 sm:px-3 sm:text-[10px]">
              <span>{names[2]} · Player 2</span>
              <span>{names[1]} · Player 1</span>
            </div>
          </div>
          <p className="mt-4 text-center text-xs font-semibold text-slate-500">
            Choose a non-empty pit on your side. Land in your store for an extra turn.
          </p>
        </div>
      </section>

      {isCompleted ? (
        <section className="paper-card mx-auto max-w-3xl overflow-hidden text-center">
          <div className="border-b-2 border-slate-950 bg-violet-100 px-5 py-7 sm:py-9">
            <Sparkles className="mx-auto text-violet-600" size={28} aria-hidden="true" />
            <p className="mt-2 text-xs font-black uppercase tracking-[.2em] text-violet-700">Game over</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {state.winnerSeat ? `${names[state.winnerSeat as MancalaSeat]} wins!` : "It's a draw!"}
            </h2>
          </div>
          <div className="flex items-center justify-center gap-4 p-5 sm:gap-8 sm:p-7">
            {[1, 2].map((seat) => (
              <div key={seat} className={`min-w-0 flex-1 rounded-2xl border-2 border-slate-950 p-4 ${state.winnerSeat === seat ? "bg-[#f4dc69] shadow-[3px_3px_0_#171821]" : "bg-white"}`}>
                <p className="truncate text-xs font-black text-slate-600">{names[seat as MancalaSeat]}</p>
                <p className="mt-1 text-4xl font-black tabular-nums text-slate-950 sm:text-5xl">{state.scores?.[seat as MancalaSeat] ?? state.stores?.[seat as MancalaSeat] ?? 0}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">stones</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col justify-center gap-3 p-5 pt-0 sm:flex-row">
            {!isSpectator && (
              <button
                type="button"
                onClick={() => void requestRematch()}
                disabled={busy || rematchRequestedByMe}
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-950 bg-violet-600 px-6 py-3 font-black text-white shadow-[3px_3px_0_#171821] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="animate-spin" size={17} /> : <RotateCcw size={17} />}
                {rematchRequestedByMe ? "Waiting for opponent…" : "Rematch"}
              </button>
            )}
            <Link href="/games" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-950 bg-white px-6 py-3 font-black text-slate-950 transition hover:-translate-y-0.5">
              <ArrowLeft size={17} /> Back to Games
            </Link>
          </div>
          {rematchRequestedByMe && <p className="pb-5 text-xs font-bold text-slate-500">Your opponent must also agree before the next game begins.</p>}
        </section>
      ) : null}

      {room.status === "playing" && secondsLeft === 0 && <p className="text-center text-xs font-bold text-slate-500">Passing the turn…</p>}
    </main>
  );
}
