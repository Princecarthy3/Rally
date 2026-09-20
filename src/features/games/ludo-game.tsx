"use client";

import { useCallback, useEffect, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";

type Props = {
  state: Room["public_state"];
  players: RoomPlayer[];
  mySeat?: number;
  busy: boolean;
  act: (action: string, value?: string) => Promise<void>;
};

// Keep the board, starting route, and player seat in the same colour order:
// red starts top-left; blue top-right; yellow bottom-right; green bottom-left.
const PLAYERS = [
  { token: "#ef4444", home: "#fee2e2" }, // red
  { token: "#3b82f6", home: "#dbeafe" }, // blue
  { token: "#eab308", home: "#fef9c3" }, // yellow
  { token: "#22c55e", home: "#dcfce7" }, // green
];
const STARTS = [0, 13, 26, 39];
// Coordinates on the classic 15×15 Ludo grid, in clockwise order.
const TRACK: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
const LANES: Array<Array<[number, number]>> = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
];

/** Pip layouts for faces 1–6 (3×3 grid cells that light up). */
const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function positionFor(seat: number, progress: number): [number, number] | null {
  if (progress < 0) return null;
  return progress < 52 ? TRACK[(STARTS[seat - 1] + progress) % 52] : LANES[seat - 1][progress - 52];
}

function DiceFace({ value, size = 72 }: { value: number; size?: number }) {
  const pips = PIP_MAP[value] || PIP_MAP[1];
  return (
    <div
      className="grid grid-cols-3 grid-rows-3 rounded-2xl border-[3px] border-slate-950 bg-white p-2 shadow-[4px_4px_0_#171821]"
      style={{ width: size, height: size }}
      aria-label={`Die showing ${value}`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="grid place-items-center">
          {pips.includes(i) ? (
            <span className="block h-[28%] min-h-[8px] w-[28%] min-w-[8px] rounded-full bg-slate-950" />
          ) : null}
        </span>
      ))}
    </div>
  );
}

function SpinningDice({
  rolling,
  face,
  size = 88,
}: {
  rolling: boolean;
  face: number;
  size?: number;
}) {
  const [spinFace, setSpinFace] = useState(1);

  // Only drive random faces from the interval callback (not sync setState in effect body).
  useEffect(() => {
    if (!rolling) return;
    const id = window.setInterval(() => {
      setSpinFace(1 + Math.floor(Math.random() * 6));
    }, 80);
    return () => window.clearInterval(id);
  }, [rolling]);

  const value = rolling ? spinFace : face >= 1 && face <= 6 ? face : 1;

  return (
    <div
      className="relative transition-transform"
      style={{
        animation: rolling ? "ludo-dice-spin 0.35s linear infinite" : undefined,
      }}
    >
      <div className={rolling ? "opacity-90" : undefined}>
        <DiceFace value={value} size={size} />
      </div>
      <style>{`
        @keyframes ludo-dice-spin {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(12deg) scale(1.06); }
          50% { transform: rotate(-10deg) scale(0.96); }
          75% { transform: rotate(8deg) scale(1.04); }
          100% { transform: rotate(0deg) scale(1); }
        }
      `}</style>
    </div>
  );
}

export function LudoGame({ state, players, mySeat, busy, act }: Props) {
  const positions = state.ludoPositions || {};
  const turn = Number(state.turn);
  const lastRoll = Number(state.lastRoll || 0);
  const awaitingMove = Boolean(state.awaitingMove);
  const isMyTurn = turn === mySeat;
  const canMove = isMyTurn && awaitingMove;
  const myTokens = positions[String(mySeat)] || [-1, -1, -1, -1];
  const movable = myTokens
    .map((position, index) => ({ position, index }))
    .filter(({ position }) =>
      lastRoll === 6 ? position < 57 : position >= 0 && position + lastRoll <= 57
    );

  const [rolling, setRolling] = useState(false);
  // Authoritative face from server — no effect sync needed.
  const face = lastRoll >= 1 && lastRoll <= 6 ? lastRoll : 1;

  const handleRoll = useCallback(async () => {
    if (!isMyTurn || awaitingMove || busy || rolling) return;
    setRolling(true);
    const started = Date.now();
    try {
      await act("roll");
    } finally {
      // Keep spinning at least ~900ms so the toss feels physical
      const elapsed = Date.now() - started;
      const wait = Math.max(0, 900 - elapsed);
      window.setTimeout(() => {
        setRolling(false);
      }, wait);
    }
  }, [act, awaitingMove, busy, isMyTurn, rolling]);

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-slate-950 bg-white px-4 py-3 text-sm font-black">
        <span>
          {awaitingMove
            ? `Player ${turn}: choose a token`
            : rolling
              ? `Player ${turn} is tossing…`
              : `Player ${turn}: roll the die`}
        </span>
        <span className="rounded-xl border-2 border-slate-950 bg-[#f4dc69] px-3 py-1">
          {rolling ? "SPINNING…" : lastRoll ? `ROLLED ${lastRoll}` : "READY"}
        </span>
      </div>

      {/* Live die */}
      <div className="mb-5 flex flex-col items-center gap-3 rounded-3xl border-2 border-slate-950 bg-gradient-to-b from-slate-100 to-slate-200 px-4 py-5 shadow-[4px_4px_0_#171821]">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Game die</p>
        <SpinningDice rolling={rolling} face={face} size={96} />
        <p className="text-xs font-bold text-slate-600">
          {rolling
            ? "Dice in the air…"
            : awaitingMove && lastRoll
              ? `Result: ${lastRoll}${lastRoll === 6 ? " — leave home or advance!" : ""}`
              : isMyTurn
                ? "Your turn — toss the die"
                : `Waiting for Player ${turn}`}
        </p>
        {!awaitingMove && (
          <button
            type="button"
            disabled={!isMyTurn || busy || rolling}
            onClick={() => void handleRoll()}
            className="arcade-button bg-[#f4dc69] px-8 py-3 text-sm shadow-[4px_4px_0_#171821] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rolling ? "TOSSING…" : isMyTurn ? "TOSS THE DIE" : "WAITING…"}
          </button>
        )}
        {canMove && movable.length === 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("move", "-1")}
            className="arcade-button bg-white px-6 py-3 text-sm"
          >
            NO MOVE — PASS
          </button>
        )}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[520px] overflow-hidden rounded-3xl border-4 border-slate-950 bg-[#f8fafc] shadow-[6px_6px_0_#171821]">
        {Array.from({ length: 4 }).map((_, seat) => (
          <div
            key={seat}
            className="absolute grid grid-cols-2 gap-2 p-3"
            style={{
              width: "40%",
              height: "40%",
              left: seat === 0 || seat === 3 ? "0%" : "60%",
              top: seat <= 1 ? "0%" : "60%",
              backgroundColor: PLAYERS[seat].home,
            }}
          >
            {[0, 1, 2, 3].map((token) => {
              const isHome = (positions[String(seat + 1)] || [-1, -1, -1, -1])[token] < 0;
              const canBringOut = canMove && seat + 1 === mySeat && lastRoll === 6 && isHome;
              return (
                <button
                  key={token}
                  type="button"
                  disabled={!canBringOut || busy}
                  onClick={() => void act("move", String(token))}
                  aria-label={`Move token ${token + 1} from home`}
                  className="rounded-full border-2 border-slate-950 disabled:cursor-default"
                  style={{ backgroundColor: PLAYERS[seat].token, opacity: isHome ? 1 : 0.2 }}
                />
              );
            })}
          </div>
        ))}
        {TRACK.map(([row, col], index) => (
          <span
            key={index}
            className="absolute border border-slate-300"
            style={{
              width: "6.6667%",
              height: "6.6667%",
              left: `${col * 6.6667}%`,
              top: `${row * 6.6667}%`,
              backgroundColor: index % 13 === 0 ? PLAYERS[STARTS.indexOf(index)].token : "#fff",
            }}
          />
        ))}
        {LANES.map((lane, seat) =>
          lane.map(([row, col], index) => (
            <span
              key={`${seat}-${index}`}
              className="absolute border border-slate-300"
              style={{
                width: "6.6667%",
                height: "6.6667%",
                left: `${col * 6.6667}%`,
                top: `${row * 6.6667}%`,
                backgroundColor: PLAYERS[seat].home,
              }}
            />
          ))
        )}
        <span className="absolute left-[40%] top-[40%] grid h-[20%] w-[20%] place-items-center bg-slate-950 text-2xl">
          🏁
        </span>
        {players
          .flatMap((player) =>
            (positions[String(player.seat)] || [-1, -1, -1, -1]).map((progress, token) => ({
              player,
              progress,
              token,
            }))
          )
          .filter(({ progress }) => progress >= 0)
          .map(({ player, progress, token }) => {
            const point = positionFor(player.seat, progress);
            if (!point) return null;
            const [row, col] = point;
            return (
              <button
                key={`${player.seat}-${token}`}
                type="button"
                disabled={!canMove || !movable.some((move) => move.index === token) || busy}
                onClick={() => void act("move", String(token))}
                aria-label={`Move token ${token + 1}`}
                className="absolute z-10 grid place-items-center rounded-full border-2 border-slate-950 text-[10px] font-black shadow-sm disabled:cursor-default"
                style={{
                  width: "5.1%",
                  height: "5.1%",
                  left: `${col * 6.6667 + 0.8}%`,
                  top: `${row * 6.6667 + 0.8}%`,
                  backgroundColor: PLAYERS[player.seat - 1].token,
                }}
              >
                {token + 1}
              </button>
            );
          })}
      </div>

      <p className="mt-4 text-center text-xs font-bold text-slate-500">
        Take turns tossing the die. Roll a 6 to leave home. Land on an opponent to send them back; stars are safe.
      </p>
    </div>
  );
}
