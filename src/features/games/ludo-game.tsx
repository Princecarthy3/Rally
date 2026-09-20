"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";

type Props = {
  state: Room["public_state"];
  players: RoomPlayer[];
  mySeat?: number;
  busy: boolean;
  act: (action: string, value?: string) => Promise<void>;
};

// Seat order: red (top-left), blue (top-right), yellow (bottom-right), green (bottom-left)
const PLAYERS = [
  { token: "#e11d48", home: "#fecdd3", deep: "#9f1239", label: "Red" },
  { token: "#2563eb", home: "#bfdbfe", deep: "#1e3a8a", label: "Blue" },
  { token: "#ca8a04", home: "#fef08a", deep: "#854d0e", label: "Yellow" },
  { token: "#16a34a", home: "#bbf7d0", deep: "#14532d", label: "Green" },
];

const STARTS = [0, 13, 26, 39];
/** Classic safe squares: each colour's start + the starred cells. */
const SAFE_TRACK = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Clockwise main track on a 15×15 grid (row, col)
const TRACK: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

// Home stretch lanes into the centre (progress 52–57)
const LANES: Array<Array<[number, number]>> = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]], // red → centre rightward
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]], // blue → centre downward
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]], // yellow → centre leftward
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]], // green → centre upward
];

// Arrow direction along the main track at each index (for path markers)
function trackArrow(index: number): string {
  const a = TRACK[index];
  const b = TRACK[(index + 1) % 52];
  if (!a || !b) return "";
  const [r0, c0] = a;
  const [r1, c1] = b;
  if (r1 === r0 && c1 > c0) return "→";
  if (r1 === r0 && c1 < c0) return "←";
  if (c1 === c0 && r1 > r0) return "↓";
  if (c1 === c0 && r1 < r0) return "↑";
  return "";
}

const LANE_ARROWS = ["→", "↓", "←", "↑"];

function positionFor(seat: number, progress: number): [number, number] | null {
  if (progress < 0) return null;
  return progress < 52 ? TRACK[(STARTS[seat - 1] + progress) % 52] : LANES[seat - 1][progress - 52];
}

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

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

/** Home yard: coloured base with a white circle holding up to 4 tokens. */
function HomeYard({
  seat,
  positions,
  mySeat,
  canMove,
  lastRoll,
  busy,
  onMove,
}: {
  seat: number;
  positions: Record<string, number[]>;
  mySeat?: number;
  canMove: boolean;
  lastRoll: number;
  busy: boolean;
  onMove: (tokenIndex: string) => Promise<void>;
}) {
  const color = PLAYERS[seat];
  const tokens = positions[String(seat + 1)] || [-1, -1, -1, -1];
  const left = seat === 0 || seat === 3 ? "0%" : "60%";
  const top = seat <= 1 ? "0%" : "60%";

  return (
    <div
      className="absolute box-border border-[3px] border-slate-950 p-[4%]"
      style={{
        width: "40%",
        height: "40%",
        left,
        top,
        backgroundColor: color.home,
      }}
    >
      <div
        className="relative grid h-full w-full grid-cols-2 grid-rows-2 place-items-center gap-[8%] rounded-full border-[3px] border-slate-950 bg-white p-[10%]"
      >
        {[0, 1, 2, 3].map((token) => {
          const isHome = tokens[token] < 0;
          const canBringOut = canMove && seat + 1 === mySeat && lastRoll === 6 && isHome;
          return (
            <button
              key={token}
              type="button"
              disabled={!canBringOut || busy}
              onClick={() => void onMove(String(token))}
              aria-label={`${color.label} token ${token + 1}${isHome ? " in home" : ""}`}
              className={`aspect-square h-full w-full max-h-[100%] max-w-[100%] rounded-full border-2 border-slate-950 shadow-sm transition disabled:cursor-default ${
                canBringOut ? "ring-2 ring-offset-1 ring-slate-950 scale-105" : ""
              }`}
              style={{
                backgroundColor: color.token,
                opacity: isHome ? 1 : 0.15,
                visibility: isHome ? "visible" : "hidden",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function LudoGame({ state, players, mySeat, busy, act }: Props) {
  const positions = useMemo(() => state.ludoPositions || {}, [state.ludoPositions]);
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
  const face = lastRoll >= 1 && lastRoll <= 6 ? lastRoll : 1;

  const handleRoll = useCallback(async () => {
    if (!isMyTurn || awaitingMove || busy || rolling) return;
    setRolling(true);
    sounds.playDiceRollSound();
    const started = Date.now();
    try {
      await act("roll");
    } finally {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, 900 - elapsed);
      window.setTimeout(() => {
        setRolling(false);
      }, wait);
    }
  }, [act, awaitingMove, busy, isMyTurn, rolling]);

  const handleMove = useCallback(
    async (tokenIndex: string) => {
      if (busy) return;
      const idx = Number(tokenIndex);
      const before = (positions[String(mySeat)] || [-1, -1, -1, -1])[idx];
      const leavingHome = before !== undefined && before < 0;
      const finishing = before !== undefined && before >= 0 && before + lastRoll >= 57;

      // Capture heuristic: opponent tokens on destination cell
      let willCapture = false;
      if (before !== undefined && before >= 0 && lastRoll > 0) {
        const destProgress = before + lastRoll;
        if (destProgress < 52) {
          const destAbs = (STARTS[(mySeat || 1) - 1] + destProgress) % 52;
          for (const p of players) {
            if (p.seat === mySeat) continue;
            const toks = positions[String(p.seat)] || [];
            for (const prog of toks) {
              if (prog >= 0 && prog < 52 && (STARTS[p.seat - 1] + prog) % 52 === destAbs) {
                if (!SAFE_TRACK.has(destAbs)) willCapture = true;
              }
            }
          }
        }
      }

      if (leavingHome) sounds.playTokenExitHomeSound();
      else if (willCapture) sounds.playTokenCaptureSound();
      else if (finishing) sounds.playTokenFinishSound();
      else sounds.playTokenMoveSound();

      await act("move", tokenIndex);
    },
    [act, busy, lastRoll, mySeat, players, positions]
  );

  // Auto-pass when it's your turn to move but nothing is movable
  useEffect(() => {
    if (!canMove || movable.length > 0 || busy || rolling) return;
    const t = window.setTimeout(() => {
      sounds.playClickSound();
      void act("move", "-1");
    }, 650);
    return () => window.clearTimeout(t);
  }, [act, busy, canMove, movable.length, rolling]);

  const cell = 100 / 15;

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-slate-950 bg-white px-3 py-2 text-xs font-black sm:text-sm">
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

      {/* Compact die row — keeps full board visible without scrolling */}
      <div className="mb-3 flex items-center gap-3 rounded-2xl border-2 border-slate-950 bg-gradient-to-r from-slate-100 to-slate-200 px-3 py-2 shadow-[3px_3px_0_#171821]">
        <SpinningDice rolling={rolling} face={face} size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Game die</p>
          <p className="truncate text-xs font-bold text-slate-700">
            {rolling
              ? "Tossing…"
              : awaitingMove && lastRoll
                ? `Rolled ${lastRoll}${lastRoll === 6 ? " — leave home or move!" : ""}`
                : canMove && movable.length === 0
                  ? "No moves — passing…"
                  : isMyTurn && !awaitingMove
                    ? "Your turn — toss"
                    : awaitingMove
                      ? "Choose a token"
                      : `Waiting for P${turn}`}
          </p>
        </div>
        {!awaitingMove && (
          <button
            type="button"
            disabled={!isMyTurn || busy || rolling}
            onClick={() => void handleRoll()}
            className="arcade-button shrink-0 bg-[#f4dc69] px-3 py-2 text-[11px] shadow-[3px_3px_0_#171821] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-xs"
          >
            {rolling ? "…" : isMyTurn ? "TOSS" : "WAIT"}
          </button>
        )}
      </div>

      {/* Classic Ludo board */}
      <div className="relative mx-auto aspect-square w-full max-w-none overflow-hidden rounded-2xl border-[4px] border-slate-950 bg-white shadow-[6px_6px_0_#171821]">
        {/* Soft board cloth background */}
        <div className="absolute inset-0 bg-[#f1f5f9]" />

        {/* Four home yards */}
        {[0, 1, 2, 3].map((seat) => (
          <HomeYard
            key={seat}
            seat={seat}
            positions={positions}
            mySeat={mySeat}
            canMove={canMove}
            lastRoll={lastRoll}
            busy={busy}
            onMove={handleMove}
          />
        ))}

        {/* Main track cells */}
        {TRACK.map(([row, col], index) => {
          const isStart = STARTS.includes(index);
          const startSeat = STARTS.indexOf(index);
          const isSafe = SAFE_TRACK.has(index);
          const bg = isStart
            ? PLAYERS[startSeat].token
            : isSafe
              ? "#fff7ed"
              : "#ffffff";
          const arrow = trackArrow(index);
          // Show arrows on a few key cells per segment (not every cell — less clutter)
          const showArrow = index % 3 === 1;

          return (
            <div
              key={`t-${index}`}
              className="absolute box-border border border-slate-400/80"
              style={{
                width: `${cell}%`,
                height: `${cell}%`,
                left: `${col * cell}%`,
                top: `${row * cell}%`,
                backgroundColor: bg,
              }}
            >
              {isSafe && (
                <span
                  className="absolute inset-0 grid place-items-center text-[clamp(8px,2.2vw,14px)] leading-none"
                  style={{ color: isStart ? "#fff" : PLAYERS[Math.floor(index / 13) % 4].token }}
                >
                  ★
                </span>
              )}
              {showArrow && !isSafe && (
                <span className="absolute inset-0 grid place-items-center text-[10px] font-black text-slate-400 opacity-70">
                  {arrow}
                </span>
              )}
            </div>
          );
        })}

        {/* Coloured home lanes with inward arrows */}
        {LANES.map((lane, seat) =>
          lane.map(([row, col], index) => (
            <div
              key={`lane-${seat}-${index}`}
              className="absolute box-border border border-slate-400/70"
              style={{
                width: `${cell}%`,
                height: `${cell}%`,
                left: `${col * cell}%`,
                top: `${row * cell}%`,
                backgroundColor: index === 5 ? PLAYERS[seat].deep : PLAYERS[seat].home,
              }}
            >
              {index < 5 && (
                <span
                  className="absolute inset-0 grid place-items-center text-[10px] font-black opacity-80"
                  style={{ color: PLAYERS[seat].deep }}
                >
                  {LANE_ARROWS[seat]}
                </span>
              )}
            </div>
          ))
        )}

        {/* Centre home — four coloured triangles meeting in the middle */}
        <div
          className="absolute overflow-hidden border-[3px] border-slate-950"
          style={{
            left: `${6 * cell}%`,
            top: `${6 * cell}%`,
            width: `${3 * cell}%`,
            height: `${3 * cell}%`,
          }}
        >
          {/* Top (blue) */}
          <div
            className="absolute inset-0"
            style={{
              background: PLAYERS[1].token,
              clipPath: "polygon(0 0, 100% 0, 50% 50%)",
            }}
          />
          {/* Right (yellow) */}
          <div
            className="absolute inset-0"
            style={{
              background: PLAYERS[2].token,
              clipPath: "polygon(100% 0, 100% 100%, 50% 50%)",
            }}
          />
          {/* Bottom (green) */}
          <div
            className="absolute inset-0"
            style={{
              background: PLAYERS[3].token,
              clipPath: "polygon(0 100%, 100% 100%, 50% 50%)",
            }}
          />
          {/* Left (red) */}
          <div
            className="absolute inset-0"
            style={{
              background: PLAYERS[0].token,
              clipPath: "polygon(0 0, 0 100%, 50% 50%)",
            }}
          />
        </div>

        {/* Tokens on the path / lanes — no numbers */}
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
            const isMovable = canMove && movable.some((move) => move.index === token);
            const color = PLAYERS[player.seat - 1];
            // Slight offset when multiple tokens share a cell
            const stackOffset = token * 0.35;

            return (
              <button
                key={`${player.seat}-${token}`}
                type="button"
                disabled={!isMovable || busy}
                onClick={() => void handleMove(String(token))}
                aria-label={`${color.label} token`}
                className={`absolute z-20 rounded-full border-[2.5px] border-slate-950 shadow-[1px_2px_0_rgba(0,0,0,0.35)] transition disabled:cursor-default ${
                  isMovable ? "ring-2 ring-offset-1 ring-slate-950 scale-110 z-30" : ""
                }`}
                style={{
                  width: `${cell * 0.72}%`,
                  height: `${cell * 0.72}%`,
                  left: `${col * cell + cell * 0.14 + stackOffset}%`,
                  top: `${row * cell + cell * 0.14 + stackOffset}%`,
                  background: `radial-gradient(circle at 35% 30%, ${color.home}, ${color.token} 55%, ${color.deep})`,
                }}
              />
            );
          })}
      </div>

      <p className="mt-4 text-center text-xs font-bold text-slate-500">
        Toss the die on your turn. Roll a <strong>6</strong> to leave home. ★ Safe squares. Arrows show the path into home.
      </p>
    </div>
  );
}
