"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import {
  checkpointReached,
  CHECKPOINT_COUNT,
  nearestTrackProgress,
  spawnPose,
} from "./track";
import { createVehicle, stepVehicle, type VehicleState } from "./vehicle";
import { useRacingInput } from "./use-racing-input";
import { RacingScene, type RemoteRacer } from "./RacingScene";

type RacingPublic = {
  phase?: "countdown" | "racing" | "finished";
  countdown?: number;
  startedAt?: number;
  racers?: Record<
    string,
    {
      x: number;
      y: number;
      z: number;
      rotY: number;
      speed: number;
      checkpoint: number;
      progress: number;
      finished: boolean;
      finishTime?: number;
    }
  >;
  results?: Array<{ seat: number; finishTime: number | null; position: number }>;
  message?: string;
};

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return `${m}:${String(rem).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

function useLandscapeLock(active: boolean) {
  const [isPortrait, setIsPortrait] = useState(false);
  useEffect(() => {
    if (!active) {
      setIsPortrait(false);
      return;
    }
    const check = () => {
      const portrait = window.matchMedia("(orientation: portrait)").matches && window.innerWidth < 900;
      setIsPortrait(portrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    try {
      const orient = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      void orient.lock?.("landscape")?.catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      try {
        screen.orientation?.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, [active]);
  return isPortrait;
}

export function RacingGame({
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
  const state = (room.public_state || {}) as RacingPublic;
  const phase = state.phase || "countdown";
  const isPortrait = useLandscapeLock(true);
  const controlsEnabled = phase === "racing";
  const { input, setTouch } = useRacingInput(controlsEnabled);

  const spawn = useMemo(() => spawnPose(meSeat), [meSeat]);
  const vehicleRef = useRef<VehicleState>(
    createVehicle(spawn.position[0], spawn.position[1], spawn.position[2], spawn.rotationY)
  );
  const [hud, setHud] = useState({
    speed: 0,
    timeMs: 0,
    checkpoint: 0,
    position: 1,
    total: players.length,
  });
  const [remotes, setRemotes] = useState<RemoteRacer[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSync = useRef(0);
  const lastCp = useRef(0);
  const raceStart = useRef<number | null>(null);
  const finishedLocal = useRef(false);

  // Hydrate from server / reset on rematch
  useEffect(() => {
    const racer = state.racers?.[String(meSeat)];
    if (phase === "countdown" || !racer) {
      const s = spawnPose(meSeat);
      vehicleRef.current = createVehicle(s.position[0], s.position[1], s.position[2], s.rotationY);
      lastCp.current = 0;
      finishedLocal.current = false;
      raceStart.current = null;
    } else if (racer.finished) {
      finishedLocal.current = true;
    }
    if (state.startedAt) raceStart.current = state.startedAt;
  }, [room.state_version, meSeat, phase, state.racers, state.startedAt]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, [room.id]);


  // Countdown tick from server phase
  useEffect(() => {
    if (phase === "countdown" && (state.countdown ?? 3) <= 3) {
      sounds.playClickSound();
    }
    if (phase === "racing" && !raceStart.current) {
      raceStart.current = state.startedAt || Date.now();
      sounds.playTokenFinishSound();
    }
  }, [phase, state.countdown, state.startedAt]);

  // Remote racers from public state
  useEffect(() => {
    const list: RemoteRacer[] = [];
    const racers = state.racers || {};
    for (const p of players) {
      const r = racers[String(p.seat)];
      if (!r) continue;
      list.push({
        seat: p.seat,
        x: r.x,
        y: r.y,
        z: r.z,
        rotY: r.rotY,
        speed: r.speed,
        finished: r.finished,
      });
    }
    setRemotes(list);
  }, [state.racers, players, room.state_version]);

  const report = useCallback(
    async (action: string, value?: string) => {
      if (busy) return;
      try {
        await onAct(action, value);
      } catch {
        /* surface via room error */
      }
    },
    [onAct, busy]
  );

  // Host (lowest seat) advances countdown once per second
  useEffect(() => {
    if (phase !== "countdown") return;
    const seats = players.map((p) => p.seat).sort((a, b) => a - b);
    if (seats[0] !== meSeat) return;
    const id = window.setInterval(() => {
      void report("tick_countdown");
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, meSeat, players, report]);

  // Game loop
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      if (phase === "racing" && !finishedLocal.current) {
        vehicleRef.current = stepVehicle(vehicleRef.current, input.current, dt);
        const v = vehicleRef.current;
        const prog = nearestTrackProgress(v.x, v.z);
        let cp = lastCp.current;
        if (cp < CHECKPOINT_COUNT && checkpointReached(cp, v.x, v.z)) {
          cp += 1;
          lastCp.current = cp;
          void report("checkpoint", String(cp));
          sounds.playClickSound();
        }
        if (cp >= CHECKPOINT_COUNT && !finishedLocal.current) {
          finishedLocal.current = true;
          const elapsed = raceStart.current ? Date.now() - raceStart.current : 0;
          void report(
            "finish",
            JSON.stringify({ timeMs: elapsed, progress: 1, checkpoint: cp })
          );
          sounds.playTokenFinishSound();
        }

        const elapsed = raceStart.current ? Date.now() - raceStart.current : 0;
        // Rank by progress
        const others = Object.entries(state.racers || {}).map(([seat, r]) => ({
          seat: Number(seat),
          progress: r.finished ? 1 : r.progress || 0,
        }));
        const meProg = finishedLocal.current ? 1 : prog.progress;
        const sorted = [...others.filter((o) => o.seat !== meSeat), { seat: meSeat, progress: meProg }].sort(
          (a, b) => b.progress - a.progress
        );
        const pos = sorted.findIndex((s) => s.seat === meSeat) + 1;

        setHud({
          speed: Math.abs(v.speed),
          timeMs: elapsed,
          checkpoint: Math.min(cp, CHECKPOINT_COUNT - 1),
          position: pos || 1,
          total: players.length,
        });

        // Sync pose ~12 Hz
        if (now - lastSync.current > 80) {
          lastSync.current = now;
          void report(
            "sync",
            JSON.stringify({
              x: v.x,
              y: v.y,
              z: v.z,
              rotY: v.rotY,
              speed: v.speed,
              checkpoint: lastCp.current,
              progress: prog.progress,
            })
          );
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, input, report, meSeat, players.length, state.racers]);

  if (isPortrait) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-slate-950 bg-gradient-to-b from-sky-200 to-emerald-100 p-8 text-center">
        <div className="animate-pulse text-5xl">📱</div>
        <p className="text-xl font-black text-slate-900">Rotate your phone</p>
        <p className="max-w-xs text-sm font-bold text-slate-600">
          Rally Racing is designed for landscape. Turn your device sideways to race.
        </p>
        <div className="mt-2 h-16 w-10 animate-bounce rounded-lg border-4 border-slate-800" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-slate-950 bg-slate-900 text-white">
        <span className="text-4xl">🏎️</span>
        <p className="text-lg font-black tracking-wide">RALLY</p>
        <p className="text-sm text-slate-300">Loading Forest Run…</p>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-400" />
        </div>
      </div>
    );
  }

  if (phase === "finished" && state.results) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-3xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0_#171821]">
        <h2 className="text-center text-2xl font-black">🏁 Rally Results</h2>
        <ul className="space-y-2">
          {state.results.map((r) => {
            const p = players.find((pl) => pl.seat === r.seat);
            return (
              <li
                key={r.seat}
                className="flex items-center justify-between rounded-xl border-2 border-slate-900 px-3 py-2 font-bold"
              >
                <span>
                  {r.position === 1 ? "🏆 " : `${r.position}. `}
                  {p?.profile?.display_name || `Player ${r.seat}`}
                </span>
                <span className="tabular-nums text-slate-600">
                  {r.finishTime != null ? formatTime(r.finishTime) : "DNF"}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void report("rematch")}
            className="flex-1 rounded-xl border-2 border-slate-950 bg-orange-400 py-3 font-black shadow-[3px_3px_0_#171821]"
          >
            REMATCH
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative isolate w-full overflow-hidden rounded-2xl border-2 border-slate-950 bg-black"
      style={{ height: "min(70vh, 520px)", touchAction: "none" }}
    >
      <RacingScene localRef={vehicleRef} remotes={remotes} localSeat={meSeat} />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 text-white drop-shadow-lg">
        <div className="rounded-lg bg-black/50 px-3 py-1 text-sm font-black">
          🏁 {hud.position}/{hud.total}
        </div>
        <div className="rounded-lg bg-black/50 px-3 py-1 font-mono text-sm font-black">
          {formatTime(hud.timeMs)}
        </div>
        <div className="rounded-lg bg-black/50 px-3 py-1 text-xs font-bold">
          CP {Math.min(hud.checkpoint + 1, CHECKPOINT_COUNT)}/{CHECKPOINT_COUNT}
          <div>{Math.round(hud.speed * 3.6)} km/h</div>
        </div>
      </div>

      {phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="text-7xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            {(state.countdown ?? 3) <= 0 ? "GO!" : state.countdown}
          </span>
        </div>
      )}

      {finishedLocal.current && phase === "racing" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center text-3xl font-black text-white drop-shadow-lg">
          FINISHED
        </div>
      )}

      {/* Touch controls */}
      <div className="absolute bottom-3 left-3 z-20 flex gap-2 sm:hidden">
        <TouchBtn
          label="◀"
          on={
            (down) => setTouch({ steer: down ? -1 : input.current.steer > 0 ? input.current.steer : 0 })
          }
        />
        <TouchBtn
          label="▶"
          on={(down) => setTouch({ steer: down ? 1 : input.current.steer < 0 ? input.current.steer : 0 })}
        />
      </div>
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2 sm:hidden">
        <TouchBtn label="GAS" on={(down) => setTouch({ accelerate: down })} wide />
        <TouchBtn label="BRAKE" on={(down) => setTouch({ brake: down })} wide />
        <TouchBtn label="HB" on={(down) => setTouch({ handbrake: down })} />
      </div>

      <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 text-[10px] font-bold text-white/70 sm:block">
        WASD / Arrows drive · Space handbrake
      </p>
    </div>
  );
}

function TouchBtn({
  label,
  on,
  wide,
}: {
  label: string;
  on: (down: boolean) => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={`select-none rounded-2xl border-2 border-white/40 bg-black/45 text-lg font-black text-white backdrop-blur ${
        wide ? "h-14 w-20" : "h-14 w-14"
      }`}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        on(true);
      }}
      onPointerUp={() => on(false)}
      onPointerCancel={() => on(false)}
    >
      {label}
    </button>
  );
}
