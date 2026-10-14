"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import {
  ELIMINATION_Y,
  FLOOR_HEIGHTS,
  generateAllFloors,
  getStartingPositions,
  getTileUnderPlayer,
  TILE_DECAY_DURATION,
  TOTAL_FLOORS,
} from "./hex-math";
import type {
  HexMatchStage,
  HexPlayerPlacement,
  HexRunnerTransform,
  HexTile,
  HexTouchInputs,
} from "./types";
import { BotBrain, createBotBrain, updateBot } from "./bot-runner";
import { HexCanvas } from "./components/HexCanvas";
import { HexStadium3D } from "./components/HexStadium3D";
import { HexFloorLayers3D } from "./components/HexFloorLayers3D";
import { RunnerAvatar3D } from "./components/RunnerAvatar3D";
import { HexCamera } from "./components/HexCamera";
import { HexHUD } from "./components/HexHUD";
import { HexTouchControls } from "./components/HexTouchControls";
import { HexResultsModal } from "./components/HexResultsModal";

const GRAVITY = -26.0;
const JUMP_VELOCITY = 11.2;
const RUN_SPEED = 9.2;
const DIVE_BOOST = 12.0;

const PLAYER_COLORS = [
  "#ff9eaa", // Seat 1: Coral Rose
  "#77dce7", // Seat 2: Sky Cyan
  "#f4dc69", // Seat 3: Sun Gold
  "#8de2bd", // Seat 4: Mint Green
  "#c084fc", // Seat 5: Electric Purple
  "#fb923c", // Seat 6: Bright Orange
  "#f43f5e", // Seat 7: Hot Pink
  "#38bdf8", // Seat 8: Electric Blue
];

const isBotId = (id: string) => id.startsWith("11111111-1111-1111-1111-");

export function HexFallGame({
  room,
  players,
  meSeat,
  onAct,
  busy,
  channel,
  isSpectator = false,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
  channel?: any;
  isSpectator?: boolean;
}) {
  const isHost = room.host_id === players.find((p) => p.seat === meSeat)?.player_id;

  // Match State
  const [stage, setStage] = useState<HexMatchStage>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [winnerSeat, setWinnerSeat] = useState<number | null>(null);
  const [placements, setPlacements] = useState<HexPlayerPlacement[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  const [spectatingSeat, setSpectatingSeat] = useState<number>(meSeat);

  // Tiles & Runners
  const [tiles, setTiles] = useState<Record<string, HexTile>>(() => generateAllFloors());
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;

  // Seed initial runners
  const startPositions = useMemo(() => getStartingPositions(players.length), [players.length]);

  const [runners, setRunners] = useState<Record<number, HexRunnerTransform>>(() => {
    const map: Record<number, HexRunnerTransform> = {};
    players.forEach((p, idx) => {
      const pos = startPositions[idx] || [0, 18.5, 0];
      const color = PLAYER_COLORS[(p.seat - 1) % PLAYER_COLORS.length];
      map[p.seat] = {
        seat: p.seat,
        playerId: p.player_id,
        displayName: p.profile?.display_name || `Player ${p.seat}`,
        color,
        isLocal: p.seat === meSeat && !isSpectator,
        isBot: isBotId(p.player_id),
        position: pos,
        rotationY: Math.atan2(-pos[2], -pos[0]) + Math.PI / 2, // Face center
        velocity: [0, 0, 0],
        isGrounded: true,
        animState: "idle",
        currentFloor: 0,
        isEliminated: false,
      };
    });
    return map;
  });

  const runnersRef = useRef(runners);
  runnersRef.current = runners;

  // Inputs
  const keysDown = useRef(new Set<string>());
  const touchInputs = useRef<HexTouchInputs>({ moveX: 0, moveY: 0, jump: false, dive: false });
  const diveCooldown = useRef(0);

  // Bot brains (managed by host or local client)
  const botBrains = useRef<Record<number, BotBrain>>({});
  useEffect(() => {
    players.forEach((p) => {
      if (isBotId(p.player_id)) {
        botBrains.current[p.seat] = createBotBrain(p.seat);
      }
    });
  }, [players]);

  // Audio BGM
  useEffect(() => {
    sounds.startGameBgm("hex_fall");
    return () => {
      sounds.startLobbyBgm();
    };
  }, []);

  // Add toast helper
  const addToast = useCallback((msg: string) => {
    setToasts((prev) => [msg, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t !== msg));
    }, 3800);
  }, []);

  // Trigger tile decay
  const triggerTileDecay = useCallback(
    (tileId: string) => {
      const current = tilesRef.current[tileId];
      if (!current || current.state !== "intact") return;

      const now = Date.now();
      const updatedTile: HexTile = {
        ...current,
        state: "decaying",
        decayStartTime: now,
      };

      setTiles((prev) => ({ ...prev, [tileId]: updatedTile }));
      sounds.playClickSound();

      // Broadcast tile decay to peers
      channel?.send({
        type: "broadcast",
        event: "hex_tile_decay",
        payload: { tileId, decayStartTime: now },
      });

      // Complete crumble after duration
      setTimeout(() => {
        setTiles((prev) => {
          if (!prev[tileId]) return prev;
          return {
            ...prev,
            [tileId]: { ...prev[tileId], state: "fallen" },
          };
        });
        sounds.playHitSound();
      }, TILE_DECAY_DURATION * 1000);
    },
    [channel]
  );

  // Eliminate a player
  const eliminatePlayer = useCallback(
    (seat: number) => {
      const runner = runnersRef.current[seat];
      if (!runner || runner.isEliminated) return;

      const survivalTime = elapsedSeconds;
      const aliveCount = Object.values(runnersRef.current).filter((r) => !r.isEliminated).length;
      const placement = aliveCount; // e.g. 8th, 7th...

      setRunners((prev) => {
        if (!prev[seat]) return prev;
        return {
          ...prev,
          [seat]: {
            ...prev[seat],
            isEliminated: true,
            animState: "eliminated",
            placement,
            survivalTime,
          },
        };
      });

      const newPlacement: HexPlayerPlacement = {
        seat,
        playerId: runner.playerId,
        displayName: runner.displayName,
        color: runner.color,
        placement,
        survivalTime,
        isBot: runner.isBot,
      };

      setPlacements((prev) => [newPlacement, ...prev]);
      addToast(`${runner.displayName} plummeted!`);

      if (runner.isLocal) {
        sounds.playEliminationSound();
      }

      // Broadcast elimination
      channel?.send({
        type: "broadcast",
        event: "hex_eliminated",
        payload: newPlacement,
      });
    },
    [elapsedSeconds, addToast, channel]
  );

  // Check victory condition
  useEffect(() => {
    if (stage !== "playing") return;

    const alive = Object.values(runners).filter((r) => !r.isEliminated);
    if (alive.length <= 1 && players.length > 1) {
      const winner = alive[0];
      const winSeat = winner ? winner.seat : null;
      setWinnerSeat(winSeat);
      setStage("results");
      sounds.playWinSound();

      if (winner) {
        setPlacements((prev) => [
          {
            seat: winner.seat,
            playerId: winner.playerId,
            displayName: winner.displayName,
            color: winner.color,
            placement: 1,
            survivalTime: elapsedSeconds,
            isBot: winner.isBot,
          },
          ...prev,
        ]);
      }

      if (isHost && winSeat !== null) {
        void onAct("eliminate_player", String(winSeat));
      }
    }
  }, [runners, stage, players.length, elapsedSeconds, isHost, onAct]);

  // Realtime Channel Sync
  useEffect(() => {
    if (!channel) return;

    // Receive transform updates
    channel.on("broadcast", { event: "hex_transform" }, (payload: any) => {
      const data = payload?.payload as HexRunnerTransform;
      if (!data || data.seat === meSeat) return;

      setRunners((prev) => {
        const existing = prev[data.seat];
        if (!existing || existing.isEliminated) return prev;
        return {
          ...prev,
          [data.seat]: {
            ...existing,
            position: data.position,
            rotationY: data.rotationY,
            velocity: data.velocity,
            animState: data.animState,
            currentFloor: data.currentFloor,
            isGrounded: data.isGrounded,
          },
        };
      });
    });

    // Receive tile decays
    channel.on("broadcast", { event: "hex_tile_decay" }, (payload: any) => {
      const { tileId, decayStartTime } = payload?.payload || {};
      if (!tileId) return;

      setTiles((prev) => {
        const cur = prev[tileId];
        if (!cur || cur.state !== "intact") return prev;
        return {
          ...prev,
          [tileId]: { ...cur, state: "decaying", decayStartTime },
        };
      });

      setTimeout(() => {
        setTiles((prev) => {
          if (!prev[tileId]) return prev;
          return {
            ...prev,
            [tileId]: { ...prev[tileId], state: "fallen" },
          };
        });
      }, TILE_DECAY_DURATION * 1000);
    });

    // Receive eliminations
    channel.on("broadcast", { event: "hex_eliminated" }, (payload: any) => {
      const data = payload?.payload as HexPlayerPlacement;
      if (!data) return;

      setRunners((prev) => {
        const existing = prev[data.seat];
        if (!existing || existing.isEliminated) return prev;
        return {
          ...prev,
          [data.seat]: {
            ...existing,
            isEliminated: true,
            animState: "eliminated",
            placement: data.placement,
            survivalTime: data.survivalTime,
          },
        };
      });

      setPlacements((prev) => {
        if (prev.some((p) => p.seat === data.seat)) return prev;
        return [data, ...prev];
      });
      addToast(`${data.displayName} plummeted!`);
    });
  }, [channel, meSeat, addToast]);

  // Match countdown timer
  useEffect(() => {
    if (stage !== "countdown") return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setStage("playing");
          sounds.playCountdownBeep(true);
          return 0;
        }
        sounds.playCountdownBeep(false);
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage]);

  // Elapsed survival timer
  useEffect(() => {
    if (stage !== "playing") return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  // Keyboard controls listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysDown.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Main 60FPS Game Physics & Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let broadcastTimer = 0;

    const loop = (now: number) => {
      const delta = Math.min(0.06, (now - lastTime) / 1000);
      lastTime = now;
      broadcastTimer += delta;

      if (stage === "playing") {
        diveCooldown.current = Math.max(0, diveCooldown.current - delta);

        // 1. Process Local Player
        const local = runnersRef.current[meSeat];
        if (local && !local.isEliminated && !isSpectator) {
          let moveX = 0;
          let moveZ = 0;

          // Keyboard input
          if (keysDown.current.has("KeyW") || keysDown.current.has("ArrowUp")) moveZ -= 1;
          if (keysDown.current.has("KeyS") || keysDown.current.has("ArrowDown")) moveZ += 1;
          if (keysDown.current.has("KeyA") || keysDown.current.has("ArrowLeft")) moveX -= 1;
          if (keysDown.current.has("KeyD") || keysDown.current.has("ArrowRight")) moveX += 1;

          // Mobile touch input
          if (touchInputs.current.moveX !== 0 || touchInputs.current.moveY !== 0) {
            moveX = touchInputs.current.moveX;
            moveZ = touchInputs.current.moveY;
          }

          // Normalize horizontal movement
          const inputLen = Math.hypot(moveX, moveZ);
          let vx = 0;
          let vz = 0;
          let rotationY = local.rotationY;

          if (inputLen > 0.05) {
            const normX = moveX / Math.max(1, inputLen);
            const normZ = moveZ / Math.max(1, inputLen);
            vx = normX * RUN_SPEED;
            vz = normZ * RUN_SPEED;
            rotationY = Math.atan2(vx, vz);
          }

          let [px, py, pz] = local.position;
          let [currentVx, vy, currentVz] = local.velocity;

          // Smooth horizontal velocity
          currentVx += (vx - currentVx) * 12 * delta;
          currentVz += (vz - currentVz) * 12 * delta;

          // Gravity
          vy += GRAVITY * delta;

          // Jump input
          const wantJump =
            keysDown.current.has("Space") || touchInputs.current.jump;
          if (wantJump && local.isGrounded) {
            vy = JUMP_VELOCITY;
            sounds.playJumpSound();
          }

          // Dive / Dash input
          const wantDive =
            (keysDown.current.has("ShiftLeft") || touchInputs.current.dive) &&
            diveCooldown.current <= 0 &&
            !local.isGrounded;
          if (wantDive) {
            diveCooldown.current = 1.2;
            const forwardX = Math.sin(rotationY);
            const forwardZ = Math.cos(rotationY);
            currentVx = forwardX * DIVE_BOOST;
            currentVz = forwardZ * DIVE_BOOST;
            vy = Math.max(vy, 3.5);
            sounds.playDodgeSound();
          }

          // Integrate position
          px += currentVx * delta;
          py += vy * delta;
          pz += currentVz * delta;

          // Collision detection with floors
          let isGrounded = false;
          let currentFloor = local.currentFloor;

          const currentTile = getTileUnderPlayer(px, py, pz, currentFloor, tilesRef.current);

          if (currentTile) {
            // Snapped to floor surface
            const floorY = FLOOR_HEIGHTS[currentFloor];
            if (py <= floorY + 0.52 && vy <= 0) {
              py = floorY + 0.5;
              vy = 0;
              isGrounded = true;

              // Step triggers tile decay!
              if (currentTile.state === "intact") {
                triggerTileDecay(currentTile.id);
              }
            }
          } else {
            // No tile directly below: check if player is dropping through to lower floor
            const currentFloorY = FLOOR_HEIGHTS[currentFloor];
            if (py < currentFloorY - 1.2 && currentFloor < TOTAL_FLOORS - 1) {
              currentFloor += 1;
            }
          }

          // Elimination check
          if (py < ELIMINATION_Y) {
            eliminatePlayer(meSeat);
          }

          // Animation state
          let animState: HexRunnerTransform["animState"] = "idle";
          if (!isGrounded) {
            if (wantDive) animState = "dive";
            else if (vy > 0) animState = "jump";
            else animState = "fall";
          } else if (inputLen > 0.1) {
            animState = "run";
          }

          const updatedLocal: HexRunnerTransform = {
            ...local,
            position: [px, py, pz],
            velocity: [currentVx, vy, currentVz],
            rotationY,
            isGrounded,
            currentFloor,
            animState,
          };

          runnersRef.current[meSeat] = updatedLocal;
          setRunners((prev) => ({ ...prev, [meSeat]: updatedLocal }));

          // Broadcast to peers (30fps)
          if (broadcastTimer >= 0.033 && channel) {
            channel.send({
              type: "broadcast",
              event: "hex_transform",
              payload: updatedLocal,
            });
          }
        }

        // 2. Process Bots (Run by Host or Local Client)
        if (isHost || Object.keys(runnersRef.current).length === players.length) {
          for (const seat in runnersRef.current) {
            const runner = runnersRef.current[seat];
            if (!runner || !runner.isBot || runner.isEliminated) continue;

            const brain = botBrains.current[runner.seat];
            if (!brain) continue;

            const botInputs = updateBot(runner, brain, tilesRef.current, delta, now);

            let [bx, by, bz] = runner.position;
            let [bvx, bvy, bvz] = runner.velocity;

            bvx += (botInputs.vx - bvx) * 10 * delta;
            bvz += (botInputs.vz - bvz) * 10 * delta;
            bvy += GRAVITY * delta;

            if (botInputs.jump && runner.isGrounded) {
              bvy = JUMP_VELOCITY * 0.95;
            }

            bx += bvx * delta;
            by += bvy * delta;
            bz += bvz * delta;

            let isGrounded = false;
            let currentFloor = runner.currentFloor;
            const tile = getTileUnderPlayer(bx, by, bz, currentFloor, tilesRef.current);

            if (tile) {
              const floorY = FLOOR_HEIGHTS[currentFloor];
              if (by <= floorY + 0.52 && bvy <= 0) {
                by = floorY + 0.5;
                bvy = 0;
                isGrounded = true;
                if (tile.state === "intact") {
                  triggerTileDecay(tile.id);
                }
              }
            } else {
              const floorY = FLOOR_HEIGHTS[currentFloor];
              if (by < floorY - 1.2 && currentFloor < TOTAL_FLOORS - 1) {
                currentFloor += 1;
              }
            }

            if (by < ELIMINATION_Y) {
              eliminatePlayer(runner.seat);
            }

            const rotY = Math.hypot(bvx, bvz) > 0.1 ? Math.atan2(bvx, bvz) : runner.rotationY;
            const updatedBot: HexRunnerTransform = {
              ...runner,
              position: [bx, by, bz],
              velocity: [bvx, bvy, bvz],
              rotationY: rotY,
              isGrounded,
              currentFloor,
              animState: !isGrounded ? (bvy > 0 ? "jump" : "fall") : Math.hypot(bvx, bvz) > 0.2 ? "run" : "idle",
            };

            runnersRef.current[runner.seat] = updatedBot;
            setRunners((prev) => ({ ...prev, [runner.seat]: updatedBot }));

            if (broadcastTimer >= 0.033 && channel && isHost) {
              channel.send({
                type: "broadcast",
                event: "hex_transform",
                payload: updatedBot,
              });
            }
          }
        }

        if (broadcastTimer >= 0.033) {
          broadcastTimer = 0;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [stage, meSeat, isSpectator, isHost, channel, triggerTileDecay, eliminatePlayer]);

  const aliveCount = Object.values(runners).filter((r) => !r.isEliminated).length;
  const localRunner = runners[meSeat];

  const handleCycleSpectate = (delta: number) => {
    const alive = Object.values(runners).filter((r) => !r.isEliminated);
    if (alive.length === 0) return;
    const currentIdx = alive.findIndex((r) => r.seat === spectatingSeat);
    const nextIdx = (currentIdx + delta + alive.length) % alive.length;
    setSpectatingSeat(alive[nextIdx].seat);
  };

  const handleRematch = async () => {
    await onAct("rematch");
  };

  return (
    <div className="relative h-[82vh] min-h-[580px] w-full overflow-hidden rounded-[28px] border-3 border-slate-950 bg-[#080718] shadow-[8px_8px_0_#0f172a]">
      {/* 3D WebGL Canvas */}
      <HexCanvas>
        <HexStadium3D />
        <HexFloorLayers3D tiles={tiles} />
        {Object.values(runners).map((runner) => (
          <RunnerAvatar3D
            key={runner.seat}
            runner={runner}
            isLocal={runner.seat === meSeat && !isSpectator}
          />
        ))}
        <HexCamera
          runners={runners}
          spectateSeat={localRunner && !localRunner.isEliminated ? meSeat : spectatingSeat}
        />
      </HexCanvas>

      {/* 2D Overlay HUD */}
      <HexHUD
        stage={stage}
        countdown={countdown}
        elapsedSeconds={elapsedSeconds}
        aliveCount={aliveCount}
        totalCount={players.length}
        localRunner={localRunner}
        runners={runners}
        spectatingSeat={spectatingSeat}
        onCycleSpectate={handleCycleSpectate}
        toasts={toasts}
      />

      {/* Touch Controls (Mobile Only) */}
      <HexTouchControls
        onInputsChange={(inputs) => {
          touchInputs.current = inputs;
        }}
      />

      {/* Results / Podium Modal */}
      {stage === "results" && (
        <HexResultsModal
          placements={placements}
          winnerSeat={winnerSeat}
          isHost={isHost}
          onRematch={handleRematch}
          busy={busy}
        />
      )}
    </div>
  );
}
