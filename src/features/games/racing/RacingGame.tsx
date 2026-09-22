"use client";

import { useEffect, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { ArcadeVehiclePhysics, KeyInputState } from "./arcade-vehicle";
import { CarTransform, RaceResult, TouchInputState } from "./types";
import { START_GRID_SLOTS } from "./track-data";
import { RacingCanvas } from "./components/RacingCanvas";
import { RallyStage3D } from "./components/3d/RallyStage3D";
import { Car3D } from "./components/3d/Car3D";
import { OtherCar3D } from "./components/3d/OtherCar3D";
import { ChaseCamera } from "./components/3d/ChaseCamera";
import { MobileOrientationOverlay } from "./components/MobileOrientationOverlay";
import { RacingTouchControls } from "./components/RacingTouchControls";
import { RacingHUD } from "./components/RacingHUD";
import { RacingCountdown } from "./components/RacingCountdown";
import { RacingResults } from "./components/RacingResults";

const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];

export function RacingGame({
  room,
  players,
  meSeat,
  onAct,
  busy,
  channel
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
  channel?: any;
}) {
  const state = (room.public_state || {}) as Record<string, any>;
  const isHost = room.host_id === players.find(p => p.seat === meSeat)?.player_id;
  const mePlayer = players.find(p => p.seat === meSeat);

  // Local race stage & controls state
  const [controlsEnabled, setControlsEnabled] = useState(false);
  const [inCountdown, setInCountdown] = useState(state.stage === "countdown" || state.phase === "countdown");
  const [lapTime, setLapTime] = useState(0);
  const [touchState, setTouchState] = useState<TouchInputState>({
    steerLeft: false,
    steerRight: false,
    accelerate: false,
    brake: false,
    handbrake: false
  });

  // Local vehicle physics instance
  const physicsRef = useRef<ArcadeVehiclePhysics | null>(null);
  const keysRef = useRef<KeyInputState>({ forward: false, backward: false, left: false, right: false, handbrake: false });
  const [myTransform, setMyTransform] = useState<CarTransform>({
    seat: meSeat,
    playerId: mePlayer?.player_id || "",
    displayName: mePlayer?.profile?.display_name || `Player ${meSeat}`,
    position: START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length]?.position || [0, 0.1, 0],
    rotation: [0, START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length]?.rotation || 0, 0],
    speed: 0,
    isDrifting: false,
    currentCheckpoint: 0,
    progressDistance: 0,
    lapTime: 0,
    finished: false
  });

  // Opponent car transforms synchronized via Realtime Broadcast
  const [otherCars, setOtherCars] = useState<Record<number, CarTransform>>({});

  // Initialize vehicle physics position
  useEffect(() => {
    const slot = START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length];
    physicsRef.current = new ArcadeVehiclePhysics(slot.position, slot.rotation);
  }, [meSeat]);

  // Handle Keyboard Inputs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.forward = true;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.backward = true;
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysRef.current.left = true;
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === " ") keysRef.current.handbrake = true;
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.forward = false;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.backward = false;
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === " ") keysRef.current.handbrake = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Subscribe to Realtime Broadcast for opponent car transforms
  useEffect(() => {
    if (!channel) return;

    const sub = channel.on("broadcast", { event: "car_transform" }, (payload: any) => {
      if (payload.payload && payload.payload.seat !== meSeat) {
        const carData = payload.payload as CarTransform;
        setOtherCars(prev => ({ ...prev, [carData.seat]: carData }));
      }
    });

    return () => {
      try {
        sub?.unsubscribe?.();
      } catch {}
    };
  }, [channel, meSeat]);

  // Main Physics & Broadcast Loop (60 Hz)
  useEffect(() => {
    let animFrame: number;
    let lastTime = performance.now();
    let broadcastTimer = 0;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (physicsRef.current) {
        const updated = physicsRef.current.update(dt, keysRef.current, touchState, controlsEnabled);
        
        if (controlsEnabled && !physicsRef.current.finished) {
          setLapTime(prev => prev + dt);
        }

        const transformPayload: CarTransform = {
          seat: meSeat,
          playerId: mePlayer?.player_id || "",
          displayName: mePlayer?.profile?.display_name || `Player ${meSeat}`,
          position: updated.position,
          rotation: updated.rotation,
          speed: updated.speed,
          isDrifting: updated.isDrifting,
          currentCheckpoint: physicsRef.current.currentCheckpoint,
          progressDistance: physicsRef.current.progressDistance,
          lapTime,
          finished: physicsRef.current.finished
        };

        setMyTransform(transformPayload);

        // Sound Synthesis updates
        if (controlsEnabled) {
          sounds.playEngineSound(updated.speed / 135);
          if (updated.isDrifting) sounds.playSkidSound();
        }

        // Checkpoint completion RPC trigger
        if (physicsRef.current.currentCheckpoint === 5 && !physicsRef.current.finished) {
          physicsRef.current.finished = true;
          sounds.playFinishSound();
          void onAct("finish", String(lapTime));
        }

        // Broadcast transform every 33ms (30 Hz)
        broadcastTimer += dt;
        if (broadcastTimer >= 0.033 && channel) {
          broadcastTimer = 0;
          channel.send({
            type: "broadcast",
            event: "car_transform",
            payload: transformPayload
          });
        }
      }

      animFrame = requestAnimationFrame(loop);
    }

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
      sounds.stopEngineSound();
    };
  }, [controlsEnabled, meSeat, mePlayer, touchState, channel, lapTime, onAct]);

  // Live Position Calculation based on progress distance metric
  const livePositions = Object.values(otherCars).concat([myTransform]);
  livePositions.sort((a, b) => b.progressDistance - a.progressDistance);
  const myRank = livePositions.findIndex(c => c.seat === meSeat) + 1;

  const resultsList = (state.results || []) as RaceResult[];

  return (
    <MobileOrientationOverlay>
      <div className="fixed inset-0 z-30 h-screen w-screen overflow-hidden bg-slate-950 touch-none select-none">
        {/* Countdown Overlay */}
        {inCountdown && (
          <RacingCountdown
            onComplete={() => {
              setInCountdown(false);
              setControlsEnabled(true);
              if (isHost) void onAct("start_race");
            }}
          />
        )}

        {/* 3D Scene Viewport */}
        <RacingCanvas>
          <RallyStage3D activeCheckpoint={myTransform.currentCheckpoint} />
          <Car3D
            position={myTransform.position}
            rotation={myTransform.rotation}
            speed={myTransform.speed}
            isDrifting={myTransform.isDrifting}
            color={colors[(meSeat - 1) % colors.length]}
            steerAngle={(touchState.steerLeft ? 1 : 0) - (touchState.steerRight ? -1 : 0)}
          />

          {/* Opponent Rival Cars */}
          {players
            .filter(p => p.seat !== meSeat)
            .map(p => {
              const car = otherCars[p.seat] || {
                position: START_GRID_SLOTS[(p.seat - 1) % START_GRID_SLOTS.length].position,
                rotation: [0, START_GRID_SLOTS[(p.seat - 1) % START_GRID_SLOTS.length].rotation, 0]
              };
              return (
                <OtherCar3D
                  key={p.seat}
                  position={car.position}
                  rotation={car.rotation as [number, number, number]}
                  displayName={p.profile?.display_name || `Player ${p.seat}`}
                  seatColor={colors[(p.seat - 1) % colors.length]}
                  seatNumber={p.seat}
                />
              );
            })}

          <ChaseCamera
            targetPos={myTransform.position}
            targetYaw={myTransform.rotation[1]}
            speed={myTransform.speed}
          />
        </RacingCanvas>

        {/* Race HUD */}
        <RacingHUD
          position={myRank}
          totalPlayers={players.length}
          lapTime={lapTime}
          checkpoint={myTransform.currentCheckpoint}
          totalCheckpoints={5}
          speed={myTransform.speed}
        />

        {/* Touch Controls Overlay */}
        <RacingTouchControls onTouchChange={setTouchState} />

        {/* Post-Race Leaderboard Modal */}
        {(state.stage === "results" || state.phase === "finished" || resultsList.length >= players.length) && (
          <RacingResults
            results={resultsList}
            players={players}
            meSeat={meSeat}
            isHost={isHost}
            onRematch={() => onAct("restart")}
            onExit={() => (window.location.href = "/")}
            busy={busy}
          />
        )}
      </div>
    </MobileOrientationOverlay>
  );
}
