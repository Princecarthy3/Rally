"use client";

import { Anchor, Crosshair, RotateCw, Shuffle, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sounds } from "@/lib/audio";

const SHIPS = [
  { id: "carrier", name: "Carrier", size: 5 },
  { id: "battleship", name: "Battleship", size: 4 },
  { id: "cruiser", name: "Cruiser", size: 3 },
  { id: "submarine", name: "Submarine", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
] as const;

type Shot = { row: number; col: number; hit: boolean; sunk?: string | null };
type Ship = { id: string; size: number; cells: number[] };
type State = {
  phase?: "placing" | "playing" | "finished";
  turn?: number;
  shots?: Record<string, Shot[]>;
  stats?: Record<string, { hits?: number; misses?: number; sunk?: number }>;
  placements?: Record<string, boolean>;
  remaining?: Record<string, number>;
  message?: string;
  winnerSeat?: number;
};

const key = (r: number, c: number) => `${r},${c}`;
const cellIndex = (r: number, c: number) => r * 8 + c;

export function Battleship({
  room,
  players,
  meSeat,
  onAct,
  busy,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
}) {
  const state = (room.public_state || {}) as State;
  const [ships, setShips] = useState<Record<string, Ship>>({});
  const [selected, setSelected] = useState("carrier");
  const [horizontal, setHorizontal] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState<string | null>(null);
  const lastMsg = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    setLoading(true);
    const { data } = await sb.rpc("get_battleship_private_state", { p_room: room.id });
    if (data) setShips((data as { ships?: Record<string, Ship> }).ships || {});
    setLoading(false);
  }, [room.id]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh, room.state_version]);

  // Sound cues from public message changes
  useEffect(() => {
    const msg = state.message || "";
    if (!msg || msg === lastMsg.current) return;
    lastMsg.current = msg;
    const lower = msg.toLowerCase();
    if (lower.includes("sank") || lower.includes("sunk")) {
      sounds.playTokenCaptureSound();
      setTimeout(() => sounds.playTokenFinishSound(), 120);
    } else if (lower.includes("hit")) {
      sounds.playTokenCaptureSound();
    } else if (lower.includes("miss")) {
      sounds.playClickSound();
    } else if (lower.includes("battle stations") || lower.includes("locked")) {
      sounds.playMessageSound();
    } else if (lower.includes("entire fleet") || lower.includes("wins")) {
      sounds.playWinSound();
    }
  }, [state.message]);

  const phase = state.phase || "placing";
  const opponent = players.find((p) => p.seat !== meSeat)?.seat || (meSeat === 1 ? 2 : 1);
  const ownShots = useMemo(() => state.shots?.[String(meSeat)] || [], [state.shots, meSeat]);
  const incoming = useMemo(() => state.shots?.[String(opponent)] || [], [state.shots, opponent]);
  const ownShotMap = useMemo(() => new Map(ownShots.map((s) => [key(s.row, s.col), s])), [ownShots]);
  const incomingMap = useMemo(() => new Map(incoming.map((s) => [key(s.row, s.col), s])), [incoming]);
  const ownCells = useMemo(
    () => new Set(Object.values(ships).flatMap((s) => s.cells || [])),
    [ships]
  );
  const selectedShip = SHIPS.find((s) => s.id === selected) || SHIPS[0];
  const locked = Boolean(state.placements?.[String(meSeat)]);
  const allPlaced = SHIPS.every((s) => ships[s.id]);
  const myTurn = phase === "playing" && Number(state.turn) === meSeat;
  const mine = state.stats?.[String(meSeat)] || {};
  const theirs = state.stats?.[String(opponent)] || {};
  const opponentName =
    players.find((p) => p.seat === opponent)?.profile?.display_name || `Player ${opponent}`;

  async function place(row: number, col: number) {
    if (phase !== "placing" || locked || busy) return;
    sounds.playClickSound();
    await onAct("place_ship", `${selected},${row},${col},${horizontal ? "H" : "V"}`);
    await refresh();
  }

  async function randomize() {
    if (phase !== "placing" || locked || busy) return;
    sounds.playDiceRollSound();
    await onAct("randomize_fleet");
    await refresh();
  }

  async function lockFleet() {
    if (!allPlaced || locked || busy) return;
    sounds.playMessageSound();
    await onAct("lock_fleet");
  }

  async function fire(row: number, col: number) {
    if (!myTurn || busy || ownShotMap.has(key(row, col))) return;
    setPulse(key(row, col));
    sounds.playClickSound();
    await onAct("fire", `${row},${col}`);
    setTimeout(() => setPulse(null), 400);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Ocean header */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-950 bg-gradient-to-br from-[#0b3d91] via-[#1d6fd8] to-[#5ec8f0] p-4 text-white shadow-[5px_5px_0_#171821]">
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/10 to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border-2 border-white/40 bg-white/15">
              <Anchor size={18} />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-100">Naval Battle</p>
              <h2 className="text-lg font-black leading-tight">Battleship</h2>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-white/30 bg-black/20 px-3 py-2 text-right backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase text-sky-100">
              {phase === "placing" ? "Deploy" : phase === "finished" ? "Complete" : "Combat"}
            </p>
            <p className="text-xs font-bold">{state.message || "Prepare your fleet"}</p>
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Your hits", `${mine.hits || 0}`],
          ["Your misses", `${mine.misses || 0}`],
          ["Enemy ships left", `${state.remaining?.[String(opponent)] ?? 5}`],
          ["Your ships left", `${state.remaining?.[String(meSeat)] ?? 5}`],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border-2 border-slate-950 bg-white px-3 py-2 text-center shadow-[2px_2px_0_#171821]"
          >
            <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
            <p className="text-base font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {phase === "placing" && (
        <div className="space-y-3 rounded-3xl border-2 border-slate-950 bg-[#f0f9ff] p-4 shadow-[4px_4px_0_#171821]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black">Deploy your fleet</h3>
              <p className="text-[11px] font-bold text-slate-500">
                {locked ? "Locked — waiting for opponent…" : "Tap the grid to place the selected ship"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={locked || busy}
                onClick={() => {
                  setHorizontal((h) => !h);
                  sounds.playClickSound();
                }}
                className="arcade-button bg-white text-xs"
              >
                <RotateCw size={14} /> {horizontal ? "Horizontal" : "Vertical"}
              </button>
              <button
                type="button"
                disabled={locked || busy}
                onClick={() => void randomize()}
                className="arcade-button bg-[#77dce7] text-xs"
              >
                <Shuffle size={14} /> Random
              </button>
              <button
                type="button"
                disabled={!allPlaced || locked || busy}
                onClick={() => void lockFleet()}
                className="arcade-button bg-emerald-400 text-xs disabled:opacity-40"
              >
                Lock fleet
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SHIPS.map((ship) => {
              const placed = Boolean(ships[ship.id]);
              return (
                <button
                  key={ship.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setSelected(ship.id);
                    sounds.playClickSound();
                  }}
                  className={`rounded-xl border-2 border-slate-950 px-3 py-1.5 text-[11px] font-black shadow-[2px_2px_0_#171821] ${
                    selected === ship.id ? "bg-[#7357ff] text-white" : placed ? "bg-emerald-100" : "bg-white"
                  }`}
                >
                  {ship.name} ({ship.size}){placed ? " ✓" : ""}
                </button>
              );
            })}
          </div>

          <OceanGrid
            title={`My waters · placing ${selectedShip.name}`}
            mode="place"
            ships={ownCells}
            shots={incomingMap}
            disabled={locked || loading}
            onCell={(r, c) => void place(r, c)}
            pulse={null}
          />
        </div>
      )}

      {(phase === "playing" || phase === "finished") && (
        <div className="grid gap-4 lg:grid-cols-2">
          <OceanGrid
            title="My fleet"
            mode="fleet"
            ships={ownCells}
            shots={incomingMap}
            disabled
            pulse={null}
          />
          <OceanGrid
            title={
              phase === "finished"
                ? "Enemy waters"
                : myTurn
                  ? `Enemy waters · fire on ${opponentName}`
                  : `Enemy waters · ${opponentName}'s turn`
            }
            mode="enemy"
            ships={new Set()}
            shots={ownShotMap}
            disabled={!myTurn || Boolean(busy) || phase === "finished"}
            onCell={(r, c) => void fire(r, c)}
            pulse={pulse}
            highlightTurn={Boolean(myTurn)}
          />
        </div>
      )}

      {phase === "playing" && (
        <div
          className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-950 px-4 py-3 text-sm font-black shadow-[3px_3px_0_#171821] ${
            myTurn ? "bg-[#f4dc69]" : "bg-slate-100"
          }`}
        >
          {myTurn ? (
            <>
              <Crosshair size={16} /> Your shot — pick a square
            </>
          ) : (
            <>
              <Waves size={16} /> Waiting for opponent…
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 text-[11px] font-bold text-slate-600">
        <span>🚢 Ship</span>
        <span>💥 Hit</span>
        <span>· Miss</span>
        <span>🔥 Sunk</span>
      </div>
    </div>
  );
}

function OceanGrid({
  title,
  mode,
  ships,
  shots,
  disabled,
  onCell,
  pulse,
  highlightTurn,
}: {
  title: string;
  mode: "place" | "fleet" | "enemy";
  ships: Set<number>;
  shots: Map<string, Shot>;
  disabled?: boolean;
  onCell?: (r: number, c: number) => void;
  pulse: string | null;
  highlightTurn?: boolean;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-3xl border-2 border-slate-950 shadow-[4px_4px_0_#171821] ${
        highlightTurn ? "ring-4 ring-amber-300" : ""
      }`}
    >
      <div className="border-b-2 border-slate-950 bg-gradient-to-r from-sky-800 to-sky-600 px-3 py-2 text-center text-xs font-black text-white">
        {title}
      </div>
      <div className="bg-gradient-to-b from-[#4db7e8] via-[#2f8fd4] to-[#1a6fb8] p-2">
        <div className="grid grid-cols-8 gap-0.5 rounded-xl bg-[#0c4a6e]/20 p-1">
          {Array.from({ length: 64 }, (_, i) => {
            const r = Math.floor(i / 8);
            const c = i % 8;
            const s = shots.get(key(r, c));
            const hasShip = ships.has(cellIndex(r, c));
            const isPulse = pulse === key(r, c);
            let bg = "bg-[#7dd3fc]/90";
            let content = "";
            if (mode === "enemy") {
              if (s?.sunk) {
                bg = "bg-orange-500";
                content = "🔥";
              } else if (s?.hit) {
                bg = "bg-red-500";
                content = "💥";
              } else if (s) {
                bg = "bg-sky-100";
                content = "·";
              } else {
                bg = "bg-[#2563eb]/80 hover:bg-[#3b82f6]";
              }
            } else {
              if (s?.hit) {
                bg = "bg-red-500";
                content = "💥";
              } else if (s) {
                bg = "bg-sky-100/90";
                content = "·";
              } else if (hasShip) {
                bg = "bg-slate-800";
                content = "🚢";
              }
            }
            return (
              <button
                key={key(r, c)}
                type="button"
                disabled={disabled || Boolean(mode === "enemy" && s)}
                onClick={() => onCell?.(r, c)}
                className={`aspect-square min-w-0 rounded-md border border-white/25 text-[clamp(9px,2vw,14px)] shadow-inner transition ${bg} ${
                  isPulse ? "scale-90 ring-2 ring-amber-200" : ""
                } disabled:cursor-default`}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
