"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import {
  TOWER_CHECKPOINTS,
  getTowerStartingPositions,
  DISAPPEARING_PLATFORMS,
  SUMMIT_ALTITUDE,
} from "./tower-layout";
import type {
  TowerMatchStage,
  ClimberTransform,
  TowerPlayerPlacement,
  TowerTouchInputs,
} from "./types";
import { updateClimberPhysics, DisappearingPlatformState } from "./physics";
import { TowerBotBrain, createTowerBotBrain, updateTowerBot } from "./bot-runner";
import { TowerCanvas } from "./components/TowerCanvas";
import { TowerEnvironment3D } from "./components/TowerEnvironment3D";
import { ClimberAvatar3D } from "./components/ClimberAvatar3D";
import { TowerCamera } from "./components/TowerCamera";
import { TowerHUD } from "./components/TowerHUD";
import { TowerTouchControls } from "./components/TowerTouchControls";
import { TowerResultsModal } from "./components/TowerResultsModal";
import { MobileOrientationOverlay } from "./components/MobileOrientationOverlay";

const PLAYER_COLORS = [
  "#a855f7", // Seat 1: Purple
  "#06b6d4", // Seat 2: Cyan
  "#f59e0b", // Seat 3: Amber
  "#10b981", // Seat 4: Emerald
  "#f43f5e", // Seat 5: Rose
  "#3b82f6", // Seat 6: Blue
  "#84cc16", // Seat 7: Lime
  "#ec4899", // Seat 8: Pink
];

const isBotId = (id: string) => id.startsWith("11111111-1111-1111-1111-");

// Internal controller running inside R3F Canvas
function TowerPhysicsLoop({
  stage,
  meSeat,
  isSpectator,
  isHost,
  runnersRef,
  setRunners,
  keysDown,
  touchInputsRef,
  cameraAngleYRef,
  disappearingStatesRef,
  botBrainsRef,
  onCheckpointUnlocked,
  onPlayerFell,
  onPlayerFinished,
  elapsedSecRef,
}: {
  stage: TowerMatchStage;
  meSeat: number;
  isSpectator: boolean;
  isHost: boolean;
  runnersRef: React.MutableRefObject<Record<number, ClimberTransform>>;
  setRunners: React.Dispatch<React.SetStateAction<Record<number, ClimberTransform>>>;
  keysDown: React.MutableRefObject<Set<string>>;
  touchInputsRef: React.MutableRefObject<TowerTouchInputs>;
  cameraAngleYRef: React.MutableRefObject<number>;
  disappearingStatesRef: React.MutableRefObject<Record<string, DisappearingPlatformState>>;
  botBrainsRef: React.MutableRefObject<Record<number, TowerBotBrain>>;
  onCheckpointUnlocked: (seat: number, cpIdx: number) => void;
  onPlayerFell: (seat: number) => void;
  onPlayerFinished: (seat: number) => void;
  elapsedSecRef: React.MutableRefObject<number>;
}) {
  useFrame((_, delta) => {
    if (stage !== "racing") return;

    const elapsed = elapsedSecRef.current;

    // 1. Update disappearing platforms timing
    for (const plat of DISAPPEARING_PLATFORMS) {
      const state = disappearingStatesRef.current[plat.id];
      if (state) {
        if (state.state === "decaying" && state.decayStartTime) {
          if (elapsed - state.decayStartTime >= plat.decayDelay) {
            disappearingStatesRef.current[plat.id] = {
              state: "hidden",
              respawnTime: elapsed + plat.respawnTime,
            };
          }
        } else if (state.state === "hidden" && state.respawnTime) {
          if (elapsed >= state.respawnTime) {
            disappearingStatesRef.current[plat.id] = { state: "intact" };
          }
        }
      }
    }

    // 2. Local Player Physics
    if (!isSpectator && runnersRef.current[meSeat]) {
      const myRunner = runnersRef.current[meSeat];
      if (!myRunner.hasFinished) {
        const result = updateClimberPhysics({
          currentPos: myRunner.position,
          currentVel: myRunner.velocity,
          currentRotationY: myRunner.rotationY,
          keysDown: keysDown.current,
          touchInputs: touchInputsRef.current,
          cameraAngleY: cameraAngleYRef.current,
          delta,
          elapsedSec: elapsed,
          currentCheckpointIdx: myRunner.checkpointIdx,
          disappearingStates: disappearingStatesRef.current,
          hasFinished: myRunner.hasFinished,
        });

        // Disappearing platform touch trigger
        if (result.touchedDisappearingId) {
          const id = result.touchedDisappearingId;
          const cur = disappearingStatesRef.current[id];
          if (!cur || cur.state === "intact") {
            disappearingStatesRef.current[id] = {
              state: "decaying",
              decayStartTime: elapsed,
            };
          }
        }

        // Checkpoint unlocked
        if (result.unlockedCheckpointIdx !== null) {
          onCheckpointUnlocked(meSeat, result.unlockedCheckpointIdx);
        }

        // Fall detected
        if (result.hasFallen) {
          onPlayerFell(meSeat);
        }

        // Reached summit
        if (result.reachedSummit) {
          onPlayerFinished(meSeat);
        }

        // Update local runner state
        setRunners((prev) => ({
          ...prev,
          [meSeat]: {
            ...prev[meSeat],
            position: result.newPosition,
            velocity: result.newVelocity,
            rotationY: result.newRotationY,
            isGrounded: result.isGrounded,
            animState: result.animState,
            altitude: result.newPosition[1],
            checkpointIdx: result.unlockedCheckpointIdx ?? prev[meSeat]?.checkpointIdx ?? 0,
          },
        }));
      }
    }

    // 3. Host simulates Bots
    if (isHost) {
      Object.entries(botBrainsRef.current).forEach(([seatStr, brain]) => {
        const seat = Number(seatStr);
        const botRunner = runnersRef.current[seat];
        if (!botRunner || botRunner.hasFinished) return;

        const { keysDown: botKeys, wantsJump } = updateTowerBot(brain, botRunner, delta, elapsed);

        const botTouch: TowerTouchInputs = {
          moveX: 0,
          moveZ: 0,
          jump: wantsJump,
        };

        const result = updateClimberPhysics({
          currentPos: botRunner.position,
          currentVel: botRunner.velocity,
          currentRotationY: botRunner.rotationY,
          keysDown: botKeys,
          touchInputs: botTouch,
          cameraAngleY: 0,
          delta,
          elapsedSec: elapsed,
          currentCheckpointIdx: botRunner.checkpointIdx,
          disappearingStates: disappearingStatesRef.current,
          hasFinished: botRunner.hasFinished,
        });

        if (result.unlockedCheckpointIdx !== null) {
          onCheckpointUnlocked(seat, result.unlockedCheckpointIdx);
        }

        if (result.hasFallen) {
          onPlayerFell(seat);
        }

        if (result.reachedSummit) {
          onPlayerFinished(seat);
        }

        setRunners((prev) => ({
          ...prev,
          [seat]: {
            ...prev[seat],
            position: result.newPosition,
            velocity: result.newVelocity,
            rotationY: result.newRotationY,
            isGrounded: result.isGrounded,
            animState: result.animState,
            altitude: result.newPosition[1],
            checkpointIdx: result.unlockedCheckpointIdx ?? prev[seat]?.checkpointIdx ?? 0,
          },
        }));
      });
    }
  });

  return null;
}

export function TowerRushGame({
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
  const [stage, setStage] = useState<TowerMatchStage>("countdown");
  const [countdown, setCountdown] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedSecRef = useRef(0);
  useEffect(() => {
    elapsedSecRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const [winnerSeat, setWinnerSeat] = useState<number | null>(null);
  const [placements, setPlacements] = useState<TowerPlayerPlacement[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  const [spectatingSeat, setSpectatingSeat] = useState<number>(meSeat);

  // Disappearing platforms state map
  const [disappearingStates, setDisappearingStates] = useState<Record<string, DisappearingPlatformState>>({});
  const disappearingStatesRef = useRef<Record<string, DisappearingPlatformState>>({});
  useEffect(() => {
    disappearingStatesRef.current = disappearingStates;
  }, [disappearingStates]);

  // Seed initial runners
  const startPositions = useMemo(() => getTowerStartingPositions(players.length), [players.length]);

  const [runners, setRunners] = useState<Record<number, ClimberTransform>>(() => {
    const map: Record<number, ClimberTransform> = {};
    players.forEach((p, idx) => {
      const pos = startPositions[idx] || [0, 1.2, 0];
      const color = PLAYER_COLORS[(p.seat - 1) % PLAYER_COLORS.length];
      map[p.seat] = {
        seat: p.seat,
        playerId: p.player_id,
        displayName: p.profile?.display_name || `Player ${p.seat}`,
        color,
        isLocal: p.seat === meSeat && !isSpectator,
        isBot: isBotId(p.player_id),
        position: pos,
        velocity: [0, 0, 0],
        rotationY: Math.atan2(-pos[0], -pos[2]),
        isGrounded: true,
        animState: "idle",
        checkpointIdx: 0,
        altitude: pos[1],
        hasFinished: false,
      };
    });
    return map;
  });

  const runnersRef = useRef(runners);
  useEffect(() => {
    runnersRef.current = runners;
  }, [runners]);

  // Inputs & Camera
  const keysDown = useRef(new Set<string>());
  const touchInputsRef = useRef<TowerTouchInputs>({ moveX: 0, moveZ: 0, jump: false });
  const cameraAngleYRef = useRef(0);

  // Bot brains
  const botBrainsRef = useRef<Record<number, TowerBotBrain>>({});
  useEffect(() => {
    players.forEach((p) => {
      if (isBotId(p.player_id)) {
        botBrainsRef.current[p.seat] = createTowerBotBrain(p.seat);
      }
    });
  }, [players]);

  // Audio BGM
  useEffect(() => {
    sounds.startGameBgm("tower_rush");
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

  // Keyboard Event Listeners (Prevent Space scroll)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
      }
      keysDown.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Checkpoint Unlocked Handler
  const handleCheckpointUnlocked = useCallback(
    (seat: number, cpIdx: number) => {
      const runner = runnersRef.current[seat];
      if (!runner || runner.checkpointIdx >= cpIdx) return;

      const cp = TOWER_CHECKPOINTS[cpIdx];
      if (!cp) return;

      setRunners((prev) => {
        if (!prev[seat]) return prev;
        return {
          ...prev,
          [seat]: {
            ...prev[seat],
            checkpointIdx: cpIdx,
          },
        };
      });

      if (runner.isLocal) {
        sounds.playCheckpointSound();
        addToast(`Reached ${cp.name}!`);
      }

      // Broadcast checkpoint update
      channel?.send({
        type: "broadcast",
        event: "tower_checkpoint",
        payload: { seat, cpIdx, displayName: runner.displayName },
      });
    },
    [addToast, channel]
  );

  // Player Fell Handler
  const handlePlayerFell = useCallback(
    (seat: number) => {
      const runner = runnersRef.current[seat];
      if (!runner) return;

      if (runner.isLocal) {
        sounds.playEliminationSound();
        addToast("Fell! Respawned at checkpoint.");
      }

      channel?.send({
        type: "broadcast",
        event: "tower_fall",
        payload: { seat, displayName: runner.displayName },
      });
    },
    [addToast, channel]
  );

  // Player Finished Handler
  const handlePlayerFinished = useCallback(
    (seat: number) => {
      const runner = runnersRef.current[seat];
      if (!runner || runner.hasFinished) return;

      const finishTime = elapsedSeconds;
      const finishedCount = Object.values(runnersRef.current).filter((r) => r.hasFinished).length;
      const placement = finishedCount + 1;

      setRunners((prev) => {
        if (!prev[seat]) return prev;
        return {
          ...prev,
          [seat]: {
            ...prev[seat],
            hasFinished: true,
            finishTime,
            placement,
            animState: "celebrate",
          },
        };
      });

      const newPlacement: TowerPlayerPlacement = {
        seat,
        playerId: runner.playerId,
        displayName: runner.displayName,
        color: runner.color,
        placement,
        finishTime,
        isBot: runner.isBot,
        maxCheckpoint: runner.checkpointIdx,
      };

      setPlacements((prev) => [...prev, newPlacement]);
      addToast(`${runner.displayName} reached the summit! (${finishTime.toFixed(1)}s)`);

      if (placement === 1) {
        setWinnerSeat(seat);
        sounds.playWinSound();
      }

      // Broadcast finish
      channel?.send({
        type: "broadcast",
        event: "tower_finish",
        payload: newPlacement,
      });

      // Submit finish to server RPC
      if (runner.isLocal || (isHost && runner.isBot)) {
        void onAct("finish_race", String(finishTime));
      }
    },
    [elapsedSeconds, addToast, channel, onAct, isHost]
  );

  // End match when all finished or first finished
  useEffect(() => {
    if (stage !== "racing") return;
    const allRunners = Object.values(runners);
    const finishedRunners = allRunners.filter((r) => r.hasFinished);

    if (allRunners.length > 0 && finishedRunners.length >= allRunners.length) {
      const timer = setTimeout(() => {
        setStage("results");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [runners, stage]);

  // Realtime Broadcast Channel Listeners
  useEffect(() => {
    if (!channel) return;

    // Transform updates from remote players
    channel.on("broadcast", { event: "tower_transform" }, (payload: any) => {
      const data = payload?.payload as ClimberTransform;
      if (!data || data.seat === meSeat) return;

      setRunners((prev) => {
        const existing = prev[data.seat];
        if (!existing || existing.hasFinished) return prev;
        return {
          ...prev,
          [data.seat]: {
            ...existing,
            position: data.position,
            rotationY: data.rotationY,
            velocity: data.velocity,
            animState: data.animState,
            isGrounded: data.isGrounded,
            checkpointIdx: data.checkpointIdx,
            altitude: data.altitude,
          },
        };
      });
    });

    // Checkpoint updates
    channel.on("broadcast", { event: "tower_checkpoint" }, (payload: any) => {
      const data = payload?.payload;
      if (!data || data.seat === meSeat) return;

      setRunners((prev) => {
        const existing = prev[data.seat];
        if (!existing) return prev;
        return {
          ...prev,
          [data.seat]: {
            ...existing,
            checkpointIdx: data.cpIdx,
          },
        };
      });

      const cp = TOWER_CHECKPOINTS[data.cpIdx];
      if (cp) {
        addToast(`${data.displayName} reached ${cp.name}!`);
      }
    });

    // Fall notifications
    channel.on("broadcast", { event: "tower_fall" }, (payload: any) => {
      const data = payload?.payload;
      if (!data || data.seat === meSeat) return;
      addToast(`${data.displayName} took a tumble!`);
    });

    // Finish updates
    channel.on("broadcast", { event: "tower_finish" }, (payload: any) => {
      const data = payload?.payload as TowerPlayerPlacement;
      if (!data) return;

      setRunners((prev) => {
        const existing = prev[data.seat];
        if (!existing) return prev;
        return {
          ...prev,
          [data.seat]: {
            ...existing,
            hasFinished: true,
            finishTime: data.finishTime,
            placement: data.placement,
            animState: "celebrate",
          },
        };
      });

      setPlacements((prev) => {
        if (prev.some((p) => p.seat === data.seat)) return prev;
        return [...prev, data];
      });

      if (data.placement === 1) {
        setWinnerSeat(data.seat);
      }
      addToast(`${data.displayName} conquered the tower!`);
    });
  }, [channel, meSeat, addToast]);

  // Periodic Broadcast of Local Player Transform (at ~16Hz)
  useEffect(() => {
    if (!channel || stage !== "racing") return;

    const interval = setInterval(() => {
      const me = runnersRef.current[meSeat];
      if (me && !me.hasFinished && !isSpectator) {
        channel.send({
          type: "broadcast",
          event: "tower_transform",
          payload: {
            seat: me.seat,
            position: me.position,
            velocity: me.velocity,
            rotationY: me.rotationY,
            animState: me.animState,
            isGrounded: me.isGrounded,
            checkpointIdx: me.checkpointIdx,
            altitude: me.position[1],
          },
        });
      }

      // Host also broadcasts bot transforms
      if (isHost) {
        Object.values(runnersRef.current).forEach((r) => {
          if (r.isBot && !r.hasFinished) {
            channel.send({
              type: "broadcast",
              event: "tower_transform",
              payload: {
                seat: r.seat,
                position: r.position,
                velocity: r.velocity,
                rotationY: r.rotationY,
                animState: r.animState,
                isGrounded: r.isGrounded,
                checkpointIdx: r.checkpointIdx,
                altitude: r.position[1],
              },
            });
          }
        });
      }
    }, 60);

    return () => clearInterval(interval);
  }, [channel, stage, meSeat, isSpectator, isHost]);

  // Match Countdown & Race Elapsed Timer
  useEffect(() => {
    if (stage === "countdown") {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setStage("racing");
            sounds.playCountdownBeep(true);
            return 0;
          }
          sounds.playCountdownBeep(false);
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else if (stage === "racing") {
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => +(prev + 0.1).toFixed(1));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [stage]);

  // Focused Runner for 3D Camera
  const focusedRunner =
    runners[isSpectator ? spectatingSeat : meSeat] ||
    runners[meSeat] ||
    Object.values(runners)[0];

  const handleRematch = async () => {
    await onAct("rematch");
  };

  const handleLeave = () => {
    window.location.href = "/games";
  };

  // Lock page scroll while the climb is on screen
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <MobileOrientationOverlay>
      <div className="fixed inset-0 z-[60] isolate h-[100dvh] min-h-screen w-screen overflow-hidden bg-[#09081a] touch-none select-none">
        {/* 3D WebGL Canvas — fills the entire viewport */}
        <TowerCanvas>
          <TowerEnvironment3D
            elapsedSec={elapsedSeconds}
            disappearingStates={disappearingStates}
          />

          {/* Climbers Avatars */}
          {Object.values(runners).map((runner) => (
            <ClimberAvatar3D
              key={runner.seat}
              runner={runner}
              isLocal={runner.seat === meSeat && !isSpectator}
            />
          ))}

          {/* Dynamic 3rd-person chase camera */}
          {focusedRunner && (
            <TowerCamera
              targetPos={focusedRunner.position}
              targetVel={focusedRunner.velocity}
              targetRotationY={focusedRunner.rotationY}
              animState={focusedRunner.animState}
              checkpointIdx={focusedRunner.checkpointIdx}
              cameraAngleYRef={cameraAngleYRef}
            />
          )}

          {/* Frame Physics Loop */}
          <TowerPhysicsLoop
            stage={stage}
            meSeat={meSeat}
            isSpectator={isSpectator}
            isHost={isHost}
            runnersRef={runnersRef}
            setRunners={setRunners}
            keysDown={keysDown}
            touchInputsRef={touchInputsRef}
            cameraAngleYRef={cameraAngleYRef}
            disappearingStatesRef={disappearingStatesRef}
            botBrainsRef={botBrainsRef}
            onCheckpointUnlocked={handleCheckpointUnlocked}
            onPlayerFell={handlePlayerFell}
            onPlayerFinished={handlePlayerFinished}
            elapsedSecRef={elapsedSecRef}
          />
        </TowerCanvas>

        {/* In-Game HUD Overlay */}
        <TowerHUD
          stage={stage}
          countdown={countdown}
          elapsedSec={elapsedSeconds}
          runners={runners}
          localSeat={meSeat}
          toasts={toasts}
          onRestart={handleRematch}
          isHost={isHost}
        />

        {/* Mobile Touch Controls */}
        {stage === "racing" && !isSpectator && (
          <TowerTouchControls touchInputsRef={touchInputsRef} />
        )}

        {/* Results & Rewards Modal */}
        {stage === "results" && (
          <TowerResultsModal
            placements={placements}
            winnerSeat={winnerSeat}
            localSeat={meSeat}
            onRematch={handleRematch}
            onLeave={handleLeave}
            isHost={isHost}
          />
        )}
      </div>
    </MobileOrientationOverlay>
  );
}
