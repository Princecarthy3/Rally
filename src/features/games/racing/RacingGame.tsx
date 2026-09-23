"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { RaceNavSheet, exitRaceFullscreen } from "./components/RaceNavSheet";

const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];

export function RacingGame({
  room,
  players,
  meSeat,
  onAct,
  busy,
  channel,
  onLeaveRace,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
  channel?: any;
  onLeaveRace?: () => void;
}) {
  const state = (room.public_state || {}) as Record<string, any>;
  const isHost = room.host_id === players.find(p => p.seat === meSeat)?.player_id;
  const mePlayer = players.find(p => p.seat === meSeat);

  // Local race stage & controls state
  const [controlsEnabled, setControlsEnabled] = useState(() => state.stage === "racing" || state.phase === "racing");
  const [inCountdown, setInCountdown] = useState(() => state.stage === "countdown" || state.phase === "countdown");
  const [lapTime, setLapTime] = useState(0);
  const [touchState, setTouchState] = useState<TouchInputState>({
    steerLeft: false,
    steerRight: false,
    accelerate: false,
    brake: false,
    handbrake: false
  });
  const [keyboardSteer, setKeyboardSteer] = useState(0);

  // Local vehicle physics instance
  const physicsRef = useRef<ArcadeVehiclePhysics | null>(null);
  const keysRef = useRef<KeyInputState>({ forward: false, backward: false, left: false, right: false, handbrake: false });
  const lapTimeRef = useRef(0);
  const [myTransform, setMyTransform] = useState<CarTransform>({
    seat: meSeat,
    playerId: mePlayer?.player_id || "",
    displayName: mePlayer?.profile?.display_name || `Player ${meSeat}`,
    position: START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length]?.position || [0, 0.1, 0],
    rotation: [0, START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length]?.rotation || 0, 0],
    speed: 0,
    isDrifting: false,
    currentCheckpoint: 0,
    currentLap: 1,
    progressDistance: 0,
    lapTime: 0,
    finished: false
  });

  // Opponent car transforms synchronized via Realtime Broadcast
  const [otherCars, setOtherCars] = useState<Record<number, CarTransform>>({});
  const raceIsLive = state.stage === "racing" || state.phase === "racing";
  const canDrive = controlsEnabled || raceIsLive;

  const handleCountdownComplete = useCallback(() => {
    setInCountdown(false);
    lapTimeRef.current = 0;
    setLapTime(0);
    setControlsEnabled(true);
    if (isHost) void onAct("start_race");
  }, [isHost, onAct]);

  // Initialize vehicle physics position
  useEffect(() => {
    const slot = START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length];
    physicsRef.current = new ArcadeVehiclePhysics(slot.position, slot.rotation);
    lapTimeRef.current = 0;
  }, [meSeat]);

  // When host starts a rematch, public_state jumps back to countdown — reset local race.
  useEffect(() => {
    const stage = String(state.stage || state.phase || "");
    if (stage !== "countdown" && stage !== "lobby" && stage !== "racing") return;
    const slot = START_GRID_SLOTS[(meSeat - 1) % START_GRID_SLOTS.length];
    const timer = window.setTimeout(() => {
      if (stage === "countdown" || stage === "lobby") {
        physicsRef.current = new ArcadeVehiclePhysics(slot.position, slot.rotation);
        if (physicsRef.current) {
          physicsRef.current.finished = false;
          physicsRef.current.currentCheckpoint = 0;
          physicsRef.current.progressDistance = 0;
        }
        lapTimeRef.current = 0;
        setLapTime(0);
        setControlsEnabled(false);
        setInCountdown(true);
        setOtherCars({});
        setMyTransform((prev) => ({
          ...prev,
          position: slot?.position || [0, 0.1, 0],
          rotation: [0, slot?.rotation || 0, 0],
          speed: 0,
          isDrifting: false,
          currentCheckpoint: 0,
          progressDistance: 0,
          lapTime: 0,
          finished: false,
        }));
      } else if (stage === "racing") {
        setInCountdown(false);
        setControlsEnabled(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.stage, state.phase, meSeat]);

  // Handle Keyboard Inputs
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["w", "W", "a", "A", "s", "S", "d", "D", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.forward = true;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.backward = true;
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysRef.current.left = true;
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === " ") keysRef.current.handbrake = true;
      setKeyboardSteer((keysRef.current.left ? 1 : 0) - (keysRef.current.right ? 1 : 0));
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (["w", "W", "a", "A", "s", "S", "d", "D", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.forward = false;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.backward = false;
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === " ") keysRef.current.handbrake = false;
      setKeyboardSteer((keysRef.current.left ? 1 : 0) - (keysRef.current.right ? 1 : 0));
    }

    function releaseInputs() {
      keysRef.current = { forward: false, backward: false, left: false, right: false, handbrake: false };
      setKeyboardSteer(0);
    }
    function handleVisibilityChange() {
      if (document.hidden) releaseInputs();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseInputs);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseInputs);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    let hudTimer = 0;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (physicsRef.current) {
        const updated = physicsRef.current.update(dt, keysRef.current, touchState, canDrive);
        
        if (canDrive && !physicsRef.current.finished) {
          lapTimeRef.current += dt;
          hudTimer += dt;
          if (hudTimer >= 0.1) {
            hudTimer = 0;
            setLapTime(lapTimeRef.current);
          }
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
          currentLap: physicsRef.current.currentLap,
          progressDistance: physicsRef.current.progressDistance,
          lapTime: lapTimeRef.current,
          finished: physicsRef.current.finished
        };

        setMyTransform(transformPayload);

        // Sound Synthesis updates
        if (canDrive) {
          sounds.playEngineSound(updated.speed / 135);
          if (updated.isDrifting) sounds.playSkidSound();
        }

        // Finish only after the final checkpoint of the third lap.
        if (physicsRef.current.finished && physicsRef.current.finishTime === 0) {
          physicsRef.current.finishTime = performance.now();
          sounds.playFinishSound();
          setLapTime(lapTimeRef.current);
          void onAct("finish", String(lapTimeRef.current));
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
  }, [canDrive, meSeat, mePlayer, touchState, channel, onAct]);

  // Live Position Calculation based on progress distance metric
  const livePositions = Object.values(otherCars).concat([myTransform]);
  livePositions.sort((a, b) => (b.progressDistance ?? 0) - (a.progressDistance ?? 0));
  const myRank = livePositions.findIndex(c => c.seat === meSeat) + 1;
  const standings = livePositions.map((car) => ({
    seat: car.seat,
    displayName: car.displayName || players.find(player => player.seat === car.seat)?.profile?.display_name || `Player ${car.seat}`,
    color: colors[(car.seat - 1) % colors.length],
    finished: car.finished
  }));

  const resultsList: RaceResult[] = ([...(state.results || [])] as RaceResult[])
    .map((r) => ({
      seat: Number(r.seat),
      player_id: String(r.player_id || ""),
      position: Number(r.position || 0),
      time: Number(r.time || 0),
      finished_at: r.finished_at,
    }))
    .sort((a, b) => a.time - b.time);

  return (
    <MobileOrientationOverlay>
      <div className="fixed inset-0 z-[60] isolate h-screen w-screen overflow-hidden bg-slate-950 touch-none select-none">
        {/* Countdown Overlay */}
        {inCountdown && (
          <RacingCountdown
            onComplete={handleCountdownComplete}
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
            steerAngle={keyboardSteer || (touchState.steerLeft ? 1 : 0) - (touchState.steerRight ? 1 : 0)}
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
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_42%,transparent_38%,rgba(3,10,16,.42)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[#07131d]/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-[#07131d]/70 to-transparent" />

        {/* Race HUD */}
        <RacingHUD
          position={myRank}
          totalPlayers={players.length}
          lapTime={lapTime}
          checkpoint={myTransform.currentCheckpoint}
          totalCheckpoints={5}
          lap={myTransform.currentLap}
          totalLaps={3}
          speed={myTransform.speed}
          standings={standings}
        />

        {/* Touch Controls Overlay */}
        <RacingTouchControls onTouchChange={setTouchState} />

        {/* Post-Race Leaderboard Modal */}
        {(state.stage === "results" || state.phase === "finished") && resultsList.length > 0 && (
          <RacingResults
            results={resultsList}
            players={players}
            meSeat={meSeat}
            isHost={isHost}
            onRematch={() => onAct("restart")}
            onExit={() => {
              void exitRaceFullscreen().finally(() => {
                if (onLeaveRace) onLeaveRace();
                else window.location.href = "/";
              });
            }}
            busy={busy}
          />
        )}
      </div>
    </MobileOrientationOverlay>
  );
}
