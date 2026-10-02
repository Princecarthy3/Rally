"use client";

import { ArrowLeft, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function normalizeSide(raw: unknown): number[] {
  const read = (value: unknown) => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
  };
  if (Array.isArray(raw)) return Array.from({ length: 6 }, (_, i) => read(raw[i]));
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return Array.from({ length: 6 }, (_, i) => read(obj[i] ?? obj[String(i)]));
  }
  return [0, 0, 0, 0, 0, 0];
}

/** Seed positions for stones inside a circular pit */
function stoneOffsets(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  const shown = Math.min(count, 12);
  const out: Array<{ x: number; y: number }> = [];
  const rings = shown <= 4 ? 1 : 2;
  let placed = 0;
  for (let ring = 0; ring < rings && placed < shown; ring++) {
    const inRing = ring === 0 ? Math.min(shown, 1) : Math.min(shown - placed, shown <= 7 ? 6 : 8);
    if (ring === 0 && shown > 1) {
      // skip center-only for multi
    } else if (ring === 0) {
      out.push({ x: 0, y: 0 });
      placed++;
      continue;
    }
    const n = ring === 0 ? 1 : Math.min(shown - placed, ring === 1 ? 5 : 7);
    const radius = ring === 0 ? 0 : ring === 1 ? 28 : 42;
    for (let i = 0; i < n && placed < shown; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      placed++;
    }
  }
  while (out.length < shown) {
    const i = out.length;
    out.push({ x: ((i * 37) % 50) - 25, y: ((i * 53) % 50) - 25 });
  }
  return out;
}

function StoneDot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block h-3 w-3 rounded-full border border-black/20 bg-[radial-gradient(circle_at_30%_30%,#fff8e7,#e8c56a_45%,#b8892a)] shadow-[0_1px_2px_rgba(0,0,0,.35)] sm:h-3.5 sm:w-3.5 ${className}`}
    />
  );
}

type DisplayBoard = {
  pits: Record<MancalaSeat, number[]>;
  stores: Record<MancalaSeat, number>;
};

type CaptureEffect = {
  landingKey: string;
  oppositeKey: string;
  storeKey: string;
  count: number;
};

export function MancalaGame({
  room,
  players,
  userId,
  onlineIds: _onlineIds,
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
  const [flying, setFlying] = useState<{ key: string; id: number } | null>(null);
  const [captureEffect, setCaptureEffect] = useState<CaptureEffect | null>(null);
  const [display, setDisplay] = useState<DisplayBoard | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animating = useRef(false);
  const lastAnimatedMove = useRef<number | null>(null);
  const timeoutRequestedVersion = useRef<number | null>(null);

  const serverPits = useMemo(
    () => ({
      1: normalizeSide(state.pits?.[1] ?? (state.pits as { "1"?: unknown } | undefined)?.["1"]),
      2: normalizeSide(state.pits?.[2] ?? (state.pits as { "2"?: unknown } | undefined)?.["2"]),
    }),
    [state.pits]
  );
  const serverStores = useMemo(
    () => ({
      1: Number(state.stores?.[1] ?? (state.stores as { "1"?: number } | undefined)?.["1"] ?? 0),
      2: Number(state.stores?.[2] ?? (state.stores as { "2"?: number } | undefined)?.["2"] ?? 0),
    }),
    [state.stores]
  );

  // Keep display board in sync when not animating
  useEffect(() => {
    if (animating.current) return;
    setDisplay({ pits: serverPits, stores: serverStores });
  }, [serverPits, serverStores]);

  const pits = display?.pits ?? serverPits;
  const stores = display?.stores ?? serverStores;

  const gameStateReady = serverPits[1].length === 6 && serverPits[2].length === 6 && state.turn !== undefined;
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

  // Animate last move path: clear source, drop one stone per destination
  useEffect(() => {
    const move = state.lastMove;
    const moveNumber = Number(room.public_state?.moveNumber ?? state.moveNumber ?? 0);
    if (!move?.path?.length || !moveNumber) return;
    if (lastAnimatedMove.current === moveNumber) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      lastAnimatedMove.current = moveNumber;
      return;
    }

    lastAnimatedMove.current = moveNumber;
    animating.current = true;

    const seat = move.seat as MancalaSeat;
    const working: DisplayBoard = {
      pits: {
        1: [...serverPits[1]],
        2: [...serverPits[2]],
      },
      stores: { 1: serverStores[1], 2: serverStores[2] },
    };

    // Undo the final path deposits roughly by removing 1 from each destination then restoring source
    for (let i = move.path.length - 1; i >= 0; i--) {
      const d = move.path[i];
      if (d.type === "store") {
        working.stores[d.seat as MancalaSeat] = Math.max(0, working.stores[d.seat as MancalaSeat] - 1);
      } else {
        const s = d.seat as MancalaSeat;
        const idx = d.index;
        working.pits[s][idx] = Math.max(0, working.pits[s][idx] - 1);
      }
    }
    // Restore captured stones roughly skipped — still shows sow flow
    const picked = move.path.length;
    working.pits[seat][move.pit] = (working.pits[seat][move.pit] || 0) + picked;

    let step = 0;
    const timers: number[] = [];
    const stepMs = 160;
    const startAnimationTimer = window.setTimeout(() => {
      setIsAnimating(true);
      setDisplay({
        pits: { 1: [...working.pits[1]], 2: [...working.pits[2]] },
        stores: { ...working.stores },
      });
    }, 0);
    timers.push(startAnimationTimer);

    // Lift from source
    timers.push(
      window.setTimeout(() => {
        working.pits[seat][move.pit] = 0;
        setDisplay({
          pits: { 1: [...working.pits[1]], 2: [...working.pits[2]] },
          stores: { ...working.stores },
        });
        sounds.playClickSound();
      }, 40)
    );

    for (const destination of move.path) {
      const destinationIndex = step;
      const delay = 80 + destinationIndex * stepMs;
      const key = destinationKey(destination);
      timers.push(
        window.setTimeout(() => {
          setFlying({ key, id: destinationIndex });
          if (destination.type === "store") {
            working.stores[destination.seat as MancalaSeat] += 1;
          } else {
            working.pits[destination.seat as MancalaSeat][destination.index] += 1;
          }
          setDisplay({
            pits: { 1: [...working.pits[1]], 2: [...working.pits[2]] },
            stores: { ...working.stores },
          });
          sounds.playTokenMoveSound();
          if (move.captured > 0 && destinationIndex === move.path.length - 1 && destination.type === "pit") {
            const oppositeSeat: MancalaSeat = destination.seat === 1 ? 2 : 1;
            setCaptureEffect({
              landingKey: key,
              oppositeKey: `pit-${oppositeSeat}-${5 - destination.index}`,
              storeKey: `store-${seat}`,
              count: move.captured,
            });
            sounds.playTokenCaptureSound();
          }
        }, delay)
      );
      step = destinationIndex + 1;
    }

    timers.push(
      window.setTimeout(() => {
        setFlying(null);
        animating.current = false;
        setIsAnimating(false);
        setDisplay({ pits: serverPits, stores: serverStores });
      }, 80 + step * stepMs + 200)
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the committed move number is the animation identity
  }, [room.public_state?.moveNumber]);

  useEffect(() => {
    if (!captureEffect) return;
    const timeout = window.setTimeout(() => setCaptureEffect(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [captureEffect]);

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
      if (!supabase || busy || isSpectator || !me || room.status !== "playing" || animating.current) return;
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
      timeoutRequestedVersion.current === room.state_version ||
      animating.current
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
    })();
  }, [applyResponse, busy, isSpectator, me, room.id, room.state_version, room.status, secondsLeft, supabase]);

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
      <div className="mx-auto grid min-h-72 max-w-md place-items-center rounded-3xl border-2 border-slate-950 bg-white p-8 text-center shadow-[4px_4px_0_#171821]">
        <LoaderCircle className="mx-auto animate-spin text-violet-600" />
        <p className="mt-3 font-black">Loading Mancala board…</p>
      </div>
    );
  }

  const names: Record<MancalaSeat, string> = {
    1: players.find((p) => p.seat === 1)?.profile?.display_name || "Player 1",
    2: players.find((p) => p.seat === 2)?.profile?.display_name || "Player 2",
  };
  const mySeat: MancalaSeat = (me?.seat as MancalaSeat) || 1;
  const oppSeat: MancalaSeat = mySeat === 1 ? 2 : 1;
  const myTurn = !isSpectator && Number(me?.seat) === Number(state.turn) && !isCompleted && !isAnimating;
  const activePlayer = players.find((player) => player.seat === Number(state.turn));
  const activePlayerName = activePlayer?.profile?.display_name || `Player ${state.turn}`;
  const activeTurnLabel = isCompleted
    ? "MATCH COMPLETE"
    : myTurn
      ? "YOUR TURN — PICK A PIT"
      : `${activePlayerName.toUpperCase()}${activePlayer?.player_id.startsWith("11111111-1111-1111-1111-") ? " · BOT TURN" : " · SOWING"}`;
  const rematchRequestedByMe = Boolean(me && state.rematchRequests?.includes(me.seat as MancalaSeat));

  const leftOrder = [5, 4, 3, 2, 1, 0];
  const rightOrder = [0, 1, 2, 3, 4, 5];

  function renderPit(seat: MancalaSeat, pit: number) {
    const stones = pits[seat][pit] ?? 0;
    const mine = seat === mySeat;
    const selectable = myTurn && mine && stones > 0 && !busy;
    const key = `pit-${seat}-${pit}`;
    const lit = flying?.key === key;
    const capturedHere = captureEffect?.landingKey === key || captureEffect?.oppositeKey === key;
    const rim = mine ? "border-[#1d9bb8] bg-[#2ec4d6]" : "border-[#c23b4a] bg-[#e85a66]";
    const offsets = stoneOffsets(stones);

    return (
      <button
        key={key}
        type="button"
        disabled={!selectable}
        aria-label={`${names[seat]} pit ${pit + 1}, ${stones} stones`}
        onClick={() => {
          if (!selectable) return;
          setSelectedPit(pit);
          void makeMove(pit).finally(() => setSelectedPit(null));
        }}
        className={[
          "relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] sm:h-12 sm:w-12",
          "shadow-[inset_0_4px_8px_rgba(0,0,0,.25),0_3px_0_rgba(0,0,0,.2)]",
          rim,
          selectable ? "cursor-pointer ring-2 ring-[#f4dc69] ring-offset-2 ring-offset-[#c4a574] hover:scale-105 active:scale-95" : "cursor-default",
          lit ? "scale-110 ring-2 ring-white" : "",
          capturedHere ? "z-10 scale-110 animate-pulse ring-4 ring-amber-300 bg-amber-400" : "",
          selectedPit === pit && mine ? "scale-105" : "",
        ].join(" ")}
      >
        <span className="relative h-full w-full">
          {offsets.map((o, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-150"
              style={{ transform: `translate(calc(-50% + ${o.x * 0.28}px), calc(-50% + ${o.y * 0.28}px))` }}
            >
              <StoneDot />
            </span>
          ))}
        </span>
        {lit && (
          <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-white/30" />
        )}
      </button>
    );
  }

  function renderStore(seat: MancalaSeat, position: "top" | "bottom") {
    const stones = stores[seat];
    const key = `store-${seat}`;
    const lit = flying?.key === key;
    const captureLanded = captureEffect?.storeKey === key;
    const isMine = seat === mySeat;
    const color = isMine
      ? "border-[#1d9bb8] bg-[#2ec4d6]"
      : "border-[#c23b4a] bg-[#e85a66]";
    const offsets = stoneOffsets(Math.min(stones, 16));

    return (
      <div
        className={[
          "relative mx-auto flex h-12 w-[88%] items-center justify-center rounded-full border-[3px] sm:h-14",
          "shadow-[inset_0_5px_10px_rgba(0,0,0,.28),0_3px_0_rgba(0,0,0,.18)]",
          color,
          lit ? "ring-2 ring-white scale-[1.02]" : "",
          captureLanded ? "scale-105 animate-pulse ring-4 ring-amber-300" : "",
          position === "top" ? "mb-1" : "mt-1",
        ].join(" ")}
        aria-label={`${names[seat]} store, ${stones} stones`}
      >
        <span className="relative flex h-full w-full flex-wrap items-center justify-center gap-0.5 px-12">
          {offsets.map((o, i) => (
            <span key={i} style={{ transform: `translate(${o.x * 0.15}px, ${o.y * 0.1}px)` }}>
              <StoneDot />
            </span>
          ))}
        </span>
        <span className="absolute left-3 text-[8px] font-black uppercase text-white/80 sm:text-[10px]">
          {seat === mySeat ? "Your store" : "Opponent"}
        </span>
        <span className="absolute right-3 text-xl font-black tabular-nums text-white sm:text-2xl">{stones}</span>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-1">
      {/* Score header like the video */}
      <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl border-2 border-slate-950 bg-[#3d4454] px-3 py-2 text-white shadow-[3px_3px_0_#171821]">
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-black uppercase tracking-wider text-sky-300">You</p>
          <p className="text-2xl font-black tabular-nums text-[#ff6b6b]">{stores[mySeat]}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-300">vs</p>
          <p className="text-[10px] font-bold text-slate-400">{secondsLeft}s</p>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[9px] font-black uppercase tracking-wider text-rose-300">
            {players.find((p) => p.seat === oppSeat)?.player_id.startsWith("11111111-1111-1111-1111-") ? "Bot" : names[oppSeat]}
          </p>
          <p className="text-2xl font-black tabular-nums text-white">{stores[oppSeat]}</p>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className={`mx-auto inline-flex items-center gap-2 rounded-full border-2 border-slate-950 px-4 py-2 text-center text-[11px] font-black shadow-[2px_2px_0_#171821] ${
          myTurn ? "bg-[#a7efc8] text-slate-950" : "bg-white text-slate-700"
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${myTurn ? "bg-emerald-600" : "bg-amber-500"}`} />
        {activeTurnLabel}
      </div>

      <div className="relative mx-auto w-full max-w-[22rem]">
        {/* Wooden board shell */}
        <div
          className="relative overflow-hidden rounded-[2.2rem] border-[5px] border-[#3b2412] px-3 py-4 shadow-[6px_8px_0_rgba(0,0,0,.35)] sm:px-4 sm:py-5"
          style={{
            background:
              "linear-gradient(160deg, #e2b87a 0%, #d4a35f 35%, #c4924a 70%, #b07d38 100%)",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,.35), inset 0 -8px 16px rgba(80,40,10,.25), 6px 8px 0 rgba(0,0,0,.28)",
          }}
        >
          {/* wood grain overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(90,50,10,.06) 6px, rgba(90,50,10,.06) 7px)",
            }}
          />

          <div className="relative z-[1] flex flex-col gap-1.5">
            {renderStore(mySeat, "top")}

            <div className="flex items-stretch justify-between gap-2 px-1">
              <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                {leftOrder.map((pit) => renderPit(mySeat, pit))}
              </div>
              <div className="flex flex-1 flex-col justify-around py-1">
                {leftOrder.map((pit, row) => {
                  const rightPit = rightOrder[row];
                  return (
                    <div key={row} className="flex items-center justify-center gap-3">
                      <span className="w-5 text-center text-sm font-black tabular-nums text-[#8b5a2b]">{pits[mySeat][pit]}</span>
                      <span className="w-5 text-center text-sm font-black tabular-nums text-[#8b5a2b]">{pits[oppSeat][rightPit]}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                {rightOrder.map((pit) => renderPit(oppSeat, pit))}
              </div>
            </div>

            {renderStore(oppSeat, "bottom")}
          </div>
        </div>

        {captureEffect && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
            <span className="animate-bounce rounded-full border-2 border-amber-200 bg-amber-500 px-5 py-2 text-sm font-black uppercase tracking-wide text-white shadow-[0_4px_0_#8a4a12,0_8px_18px_rgba(0,0,0,.3)]">
              Capture +{captureEffect.count}
            </span>
          </div>
        )}

      </div>

      <p className="text-center text-xs font-bold text-slate-600">
        {state.message || "Tap a pit on your side (blue) to sow stones counterclockwise."}
      </p>
      {notice && (
        <p role="alert" className="text-center text-xs font-bold text-rose-600">
          {notice}
        </p>
      )}

      {isCompleted ? (
        <section className="overflow-hidden rounded-3xl border-2 border-slate-950 bg-white shadow-[4px_4px_0_#171821]">
          <div className="border-b-2 border-slate-950 bg-[#f4dc69] px-5 py-4 text-center">
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">Game over</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
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
              href="/dashboard"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-slate-950 bg-white px-5 py-3 font-black"
            >
              <ArrowLeft size={17} /> Return to the arcade
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
