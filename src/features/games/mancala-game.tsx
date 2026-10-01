"use client";

import { ArrowLeft, Clock3, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UserAvatar } from "@/components/customization/user-avatar";
import type { MancalaDestination, MancalaSeat, MancalaState } from "@/features/games/mancala";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function friendlyError(message: string) {
  if (/state changed|stale/i.test(message)) return "The board just updated. Your game has been refreshed.";
  if (/wait for your turn/i.test(message)) return "It isn't your turn yet.";
  if (/empty/i.test(message)) return "That pit is empty. Choose another pit.";
  if (/turn expired/i.test(message)) return "Time ran out. The turn is being passed.";
  if (/not a player|not in this room/i.test(message)) return "You are no longer a player in this room.";
  if (/not active|complete/i.test(message)) return "This game has already ended.";
  return message || "That action could not be saved. Check your connection and try again.";
}

function destinationKey(destination: MancalaDestination) {
  return destination.type === "store" ? `store-${destination.seat}` : `pit-${destination.seat}-${destination.index}`;
}

/** Normalize pits whether stored as array or object (legacy jsonb_set). */
function normalizeSide(raw: unknown): number[] {
  const read = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  };
  if (Array.isArray(raw)) {
    return Array.from({ length: 6 }, (_, i) => read(raw[i]));
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return Array.from({ length: 6 }, (_, i) => read(obj[i] ?? obj[String(i)]));
  }
  return [0, 0, 0, 0, 0, 0];
}

function Stones({ count }: { count: number }) {
  const shown = Math.min(count, 20);
  return (
    <span aria-hidden="true" className="flex max-w-[4.5rem] flex-wrap content-center justify-center gap-0.5">
      {Array.from({ length: shown }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full border border-black/15 shadow-[inset_1px_1px_1px_rgba(255,255,255,.85),0_1px_2px_rgba(0,0,0,.35)] sm:h-3 sm:w-3 ${
            index % 3 === 0
              ? "bg-gradient-to-br from-[#fff3a6] via-[#f4dc69] to-[#b68b24]"
              : index % 3 === 1
                ? "bg-gradient-to-br from-white via-[#eee9ff] to-[#9b91c5]"
                : "bg-gradient-to-br from-[#e5dcff] via-[#c4b5fd] to-[#7050bd]"
          }`}
        />
      ))}
      {count > shown && (
        <span className="w-full text-center text-[9px] font-black text-white/85">+{count - shown}</span>
      )}
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

  const pits = useMemo(
    () => ({
      1: normalizeSide(state.pits?.[1] ?? (state.pits as { "1"?: unknown } | undefined)?.["1"]),
      2: normalizeSide(state.pits?.[2] ?? (state.pits as { "2"?: unknown } | undefined)?.["2"]),
    }),
    [state.pits]
  );
  const stores = useMemo(
    () => ({
      1: Number(state.stores?.[1] ?? (state.stores as { "1"?: number } | undefined)?.["1"] ?? 0),
      2: Number(state.stores?.[2] ?? (state.stores as { "2"?: number } | undefined)?.["2"] ?? 0),
    }),
    [state.stores]
  );

  const gameStateReady = pits[1].length === 6 && pits[2].length === 6 && state.turn !== undefined;
  const isCompleted = room.status === "completed" || state.status === "completed";
  const secondsLeft = state.turnDeadline
    ? now === 0
      ? 30
      : Math.max(0, Math.ceil((Date.parse(String(state.turnDeadline)) - now) / 1000))
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
      timers.push(window.setTimeout(() => setActiveDestination(destinationKey(destination)), index * 42));
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
      if (payload.public_state && applyPublicState) {
        applyPublicState(payload.public_state, {
          ...(payload.status ? { status: payload.status } : {}),
          ...(typeof payload.state_version === "number" ? { state_version: payload.state_version } : {}),
        });
      } else {
        void refresh();
      }
    },
    [applyPublicState, refresh]
  );

  const makeMove = useCallback(
    async (pit: number) => {
      if (!supabase || busy || isSpectator || !me || room.status !== "playing") return;
      if (pit < 0 || pit > 5) return;
      const seat = me.seat as MancalaSeat;
      const stones = Number(pits[seat]?.[pit] ?? 0);
      if (!(stones > 0)) {
        setNotice("That pit is empty. Choose another pit.");
        return;
      }
      if (Number(state.turn) !== Number(me.seat)) {
        setNotice("It isn't your turn yet.");
        return;
      }
      setBusy(true);
      setNotice("");
      try {
        const { data, error } = await supabase.rpc("play_mancala_action", {
          p_room: room.id,
          p_pit: Math.floor(pit),
          p_expected_version: room.state_version,
        });
        if (error) {
          setNotice(friendlyError(error.message));
          await refresh();
          return;
        }
        sounds.playClickSound();
        applyResponse(data);
      } catch (err) {
        setNotice(friendlyError(err instanceof Error ? err.message : "Move failed"));
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [applyResponse, busy, isSpectator, me, pits, refresh, room.id, room.state_version, room.status, state.turn, supabase]
  );

  useEffect(() => {
    if (
      isSpectator ||
      busy ||
      room.status !== "playing" ||
      !me ||
      secondsLeft > 0 ||
      timeoutRequestedVersion.current === room.state_version
    ) {
      return;
    }
    timeoutRequestedVersion.current = room.state_version;
    void (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.rpc("expire_mancala_turn", {
        p_room: room.id,
        p_expected_version: room.state_version,
      });
      if (!error) applyResponse(data);
      else await refresh();
    })();
  }, [applyResponse, busy, isSpectator, me, refresh, room.id, room.state_version, room.status, secondsLeft, supabase]);

  const requestRematch = useCallback(async () => {
    if (!supabase || busy || isSpectator) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("request_mancala_rematch", { p_room: room.id });
      if (error) setNotice(friendlyError(error.message));
      else applyResponse(data);
    } finally {
      setBusy(false);
    }
  }, [applyResponse, busy, isSpectator, room.id, supabase]);

  if (!gameStateReady) {
    return (
      <div className="paper-card mx-auto grid min-h-72 max-w-md place-items-center p-8 text-center">
        <div>
          <LoaderCircle className="mx-auto animate-spin text-violet-600" />
          <p className="mt-3 font-black">Loading Mancala board…</p>
        </div>
      </div>
    );
  }

  const names: Record<MancalaSeat, string> = {
    1: players.find((player) => player.seat === 1)?.profile?.display_name || "Player 1",
    2: players.find((player) => player.seat === 2)?.profile?.display_name || "Player 2",
  };
  const opponentSeat: MancalaSeat = me?.seat === 1 ? 2 : 1;
  const opponent = players.find((player) => player.seat === opponentSeat);
  const opponentIsBot = Boolean(opponent?.player_id.startsWith("11111111-1111-1111-1111-"));
  const opponentOnline = Boolean(opponent && (opponentIsBot || onlineIds.includes(opponent.player_id)));
  const myTurn = !isSpectator && Number(me?.seat) === Number(state.turn) && !isCompleted;
  const rematchRequestedByMe = Boolean(me && state.rematchRequests?.includes(me.seat as MancalaSeat));
  const activeName = names[(state.turn as MancalaSeat) || 1] || "Player";

  // Portrait: opponent (seat 2 from seat-1 view, or always top = other player) store on top.
  // Board is oriented so *you* are always at the bottom.
  const bottomSeat: MancalaSeat = (me?.seat as MancalaSeat) || 1;
  const topSeat: MancalaSeat = bottomSeat === 1 ? 2 : 1;
  // Visual order left→right for bottom = pit 0..5; for top (facing you) = 5..0
  const topOrder = [5, 4, 3, 2, 1, 0];
  const bottomOrder = [0, 1, 2, 3, 4, 5];

  function renderPit(seat: MancalaSeat, pit: number) {
    const stones = pits[seat][pit] ?? 0;
    const selectable = myTurn && seat === me?.seat && stones > 0 && !busy;
    const key = `pit-${seat}-${pit}`;
    const lit = activeDestination === key;
    return (
      <button
        key={key}
        type="button"
        aria-label={`Player ${seat} pit ${pit + 1}, ${stones} stones`}
        aria-disabled={!selectable}
        aria-pressed={selectedPit === pit && seat === me?.seat}
        disabled={!selectable}
        onClick={() => {
          setSelectedPit(pit);
          void makeMove(pit).finally(() => setSelectedPit(null));
        }}
        className={[
          "relative flex aspect-square min-h-[3.4rem] w-full flex-col items-center justify-center gap-1 rounded-[42%] border-2 transition sm:min-h-[4.25rem]",
          "shadow-[inset_0_6px_10px_rgba(0,0,0,.35),inset_0_-2px_4px_rgba(255,255,255,.12),0_4px_0_rgba(18,10,35,.75)]",
          selectable
            ? "cursor-pointer border-[#f4dc69] bg-[#5b3d9c] hover:scale-[1.03] active:translate-y-0.5"
            : "cursor-default border-[#2a1a4a] bg-[#3d2a6b]",
          lit ? "ring-2 ring-[#f4dc69] ring-offset-2 ring-offset-[#1a1030]" : "",
          selectedPit === pit && seat === me?.seat ? "scale-105" : "",
        ].join(" ")}
      >
        <Stones count={stones} />
        <span className="text-[10px] font-black tabular-nums text-white/90 sm:text-xs">{stones}</span>
      </button>
    );
  }

  function renderStore(seat: MancalaSeat, position: "top" | "bottom") {
    const stones = stores[seat];
    const key = `store-${seat}`;
    const lit = activeDestination === key;
    return (
      <div
        className={[
          "mx-auto flex w-full max-w-[12rem] flex-col items-center justify-center gap-1.5 rounded-[2rem] border-2 border-[#2a1a4a] bg-[#2d1b56] px-4 py-5 shadow-[inset_0_8px_14px_rgba(0,0,0,.4),0_5px_0_rgba(18,10,35,.8)] sm:max-w-[14rem] sm:py-6",
          lit ? "ring-2 ring-[#f4dc69]" : "",
          position === "top" ? "mt-1" : "mb-1",
        ].join(" ")}
        aria-label={`${names[seat]} store, ${stones} stones`}
      >
        <p className="truncate text-[10px] font-black uppercase tracking-wider text-violet-200">{names[seat]}</p>
        <Stones count={stones} />
        <p className="text-2xl font-black tabular-nums text-white sm:text-3xl">{stones}</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-violet-300">store</p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-1 sm:max-w-lg sm:gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-slate-950 bg-white px-3 py-2 shadow-[3px_3px_0_#171821]">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Mancala</p>
          <p className="truncate text-sm font-black text-slate-900">
            {isCompleted ? "Game over" : myTurn ? "Your turn" : `${activeName}'s turn`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border-2 border-slate-950 px-2.5 py-1 text-xs font-black tabular-nums ${
              secondsLeft <= 5 && !isCompleted ? "bg-rose-200" : "bg-violet-100"
            }`}
          >
            <Clock3 size={14} /> {isCompleted ? "—" : `${secondsLeft}s`}
          </span>
          {opponent && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold">
              <span className={`h-2 w-2 rounded-full ${opponentOnline ? "bg-emerald-500" : "bg-slate-300"}`} />
              {opponentIsBot ? "Bot" : opponentOnline ? "Online" : "Away"}
            </span>
          )}
        </div>
      </header>

      {notice && (
        <p role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 px-3 py-2 text-center text-sm font-bold text-rose-800">
          {notice}
        </p>
      )}

      {/* Portrait board: top store → top pits → bottom pits → bottom store */}
      <section
        className="rounded-[28px] border-2 border-slate-950 bg-gradient-to-b from-[#4c2f8f] via-[#3a2170] to-[#2a1754] p-4 shadow-[5px_5px_0_#171821] sm:p-5"
        aria-label="Mancala board"
      >
        <div className="mb-2 flex items-center justify-center gap-2 text-white">
          <UserAvatar
            avatarUrl={players.find((p) => p.seat === topSeat)?.profile?.avatar_url}
            fallbackName={names[topSeat]}
            size="xs"
            className="border border-white/30"
          />
          <p className="truncate text-xs font-black">{names[topSeat]}</p>
          {state.turn === topSeat && !isCompleted && (
            <span className="rounded-full bg-[#f4dc69] px-2 py-0.5 text-[9px] font-black text-slate-950">playing</span>
          )}
        </div>

        {renderStore(topSeat, "top")}

        <div className="my-4 grid grid-cols-6 gap-2 sm:gap-2.5">
          {topOrder.map((pit) => renderPit(topSeat, pit))}
        </div>

        <div className="my-1 flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-white/20" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/50">board</span>
          <div className="h-px flex-1 bg-white/20" />
        </div>

        <div className="my-4 grid grid-cols-6 gap-2 sm:gap-2.5">
          {bottomOrder.map((pit) => renderPit(bottomSeat, pit))}
        </div>

        {renderStore(bottomSeat, "bottom")}

        <div className="mt-2 flex items-center justify-center gap-2 text-white">
          <UserAvatar
            avatarUrl={players.find((p) => p.seat === bottomSeat)?.profile?.avatar_url}
            fallbackName={names[bottomSeat]}
            size="xs"
            className="border border-white/30"
          />
          <p className="truncate text-xs font-black">{names[bottomSeat]}{me?.seat === bottomSeat ? " (you)" : ""}</p>
          {state.turn === bottomSeat && !isCompleted && (
            <span className="rounded-full bg-[#f4dc69] px-2 py-0.5 text-[9px] font-black text-slate-950">playing</span>
          )}
        </div>
      </section>

      <p className="text-center text-xs font-bold text-slate-600">
        {state.message || "Pick a pit on your side to sow stones counterclockwise."}
      </p>

      {isCompleted ? (
        <section className="overflow-hidden rounded-3xl border-2 border-slate-950 bg-white shadow-[4px_4px_0_#171821]">
          <div className="border-b-2 border-slate-950 bg-[#f4dc69] px-5 py-4 text-center">
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Game over</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {state.winnerSeat ? `${names[state.winnerSeat as MancalaSeat]} wins!` : "It's a draw!"}
            </h2>
          </div>
          <div className="flex gap-3 p-4">
            {([1, 2] as MancalaSeat[]).map((seat) => (
              <div
                key={seat}
                className={`min-w-0 flex-1 rounded-2xl border-2 border-slate-950 p-3 ${
                  state.winnerSeat === seat ? "bg-[#f4dc69]" : "bg-white"
                }`}
              >
                <p className="truncate text-xs font-black text-slate-600">{names[seat]}</p>
                <p className="mt-1 text-3xl font-black tabular-nums">{state.scores?.[seat] ?? stores[seat]}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row">
            {!isSpectator && (
              <button
                type="button"
                onClick={() => void requestRematch()}
                disabled={busy || rematchRequestedByMe}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-slate-950 bg-violet-600 px-5 py-3 font-black text-white shadow-[3px_3px_0_#171821] disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="animate-spin" size={17} /> : <RotateCcw size={17} />}
                {rematchRequestedByMe ? "Waiting…" : "Rematch"}
              </button>
            )}
            <Link
              href="/games"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-slate-950 bg-white px-5 py-3 font-black"
            >
              <ArrowLeft size={17} /> Games
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
