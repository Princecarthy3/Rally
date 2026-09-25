"use client";

import { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { CHARACTERS, getCharacterConfig } from "./character-config";
import { CombatCanvas } from "./components/CombatCanvas";
import { CombatHUD } from "./components/CombatHUD";
import { CombatResultsModal } from "./components/CombatResultsModal";
import { CombatTouchControls } from "./components/CombatTouchControls";
import { DynamicCombatCamera } from "./components/DynamicCombatCamera";
import { Fighter3D } from "./components/Fighter3D";
import { HitParticle, HitVFX } from "./components/HitVFX";
import { MobileOrientationOverlay } from "./components/MobileOrientationOverlay";
import { RooftopArena3D } from "./components/RooftopArena3D";
import { CharacterArchetype, CombatMatchResult, FighterTransform, TouchCombatInputs } from "./types";

const START_POSITIONS: [number, number, number][] = [
  [-6, 0.1, -6],
  [6, 0.1, 6],
  [-6, 0.1, 6],
  [6, 0.1, -6],
];

export function RallyCombatGame({
  room,
  players,
  meSeat,
  onAct,
  busy,
  channel,
}: {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  onAct: (action: string, value?: string) => Promise<void>;
  busy?: boolean;
  channel?: any;
}) {
  const state = (room.public_state || {}) as Record<string, any>;
  const isHost = room.host_id === players.find((p) => p.seat === meSeat)?.player_id;
  const mePlayer = players.find((p) => p.seat === meSeat);

  // Character Archetype Selection State
  const [selectedArchetype, setSelectedArchetype] = useState<CharacterArchetype>("balanced");
  const [characterConfirmed, setCharacterConfirmed] = useState(false);

  // Match Sequence State
  const [countdownText, setCountdownText] = useState("3");
  const [inCountdown, setInCountdown] = useState(true);
  const [fightActive, setFightActive] = useState(false);

  // Combat SFX & VFX State
  const [hitParticles, setHitParticles] = useState<HitParticle[]>([]);

  // Local Fighter State
  const [myFighter, setMyFighter] = useState<FighterTransform>(() => {
    const config = getCharacterConfig("balanced");
    const startPos = START_POSITIONS[(meSeat - 1) % START_POSITIONS.length];
    return {
      seat: meSeat,
      playerId: mePlayer?.player_id || "",
      displayName: mePlayer?.profile?.display_name || `Player ${meSeat}`,
      archetype: "balanced",
      position: startPos,
      rotationY: 0,
      hp: config.maxHp,
      maxHp: config.maxHp,
      isBlocking: false,
      isDodging: false,
      attackState: "idle",
      animState: "idle",
      comboCount: 0,
      specialCooldownRemaining: 0,
      dodgeCooldownRemaining: 0,
      isEliminated: false,
      kills: 0,
      damageDealt: 0,
      damageReceived: 0,
    };
  });

  // Keep every client on the same deterministic arena layout before the first packet arrives.
  const [allFighters, setAllFighters] = useState<Record<number, FighterTransform>>({});
  useEffect(() => {
    setAllFighters((current) => {
      const next = { ...current };
      for (const player of players) {
        if (player.seat === meSeat || next[player.seat]) continue;
        const config = getCharacterConfig("balanced");
        next[player.seat] = {
          seat: player.seat,
          playerId: player.player_id,
          displayName: player.profile?.display_name || `Player ${player.seat}`,
          archetype: "balanced",
          position: START_POSITIONS[(player.seat - 1) % START_POSITIONS.length],
          rotationY: player.seat % 2 === 0 ? Math.PI : 0,
          hp: config.maxHp,
          maxHp: config.maxHp,
          isBlocking: false,
          isDodging: false,
          attackState: "idle",
          animState: "idle",
          comboCount: 0,
          specialCooldownRemaining: 0,
          dodgeCooldownRemaining: 0,
          isEliminated: false,
          kills: 0,
          damageDealt: 0,
          damageReceived: 0,
        };
      }
      return next;
    });
  }, [players, meSeat]);

  // Spectator State
  const [spectateTargetSeat, setSpectateTargetSeat] = useState<number>(meSeat);

  // Touch Inputs State
  const [touchInputs, setTouchInputs] = useState<TouchCombatInputs>({
    moveDir: [0, 0],
    lightAttack: false,
    heavyAttack: false,
    block: false,
    dodge: false,
    special: false,
    jump: false,
  });
  const touchInputsRef = useRef<TouchCombatInputs>(touchInputs);
  useEffect(() => {
    touchInputsRef.current = touchInputs;
  }, [touchInputs]);

  // Local Physics & Controls Refs
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    space: false,
    shift: false,
    block: false,
  });
  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);

  // Handle Character Archetype Confirmation
  const confirmCharacter = (arch: CharacterArchetype) => {
    setSelectedArchetype(arch);
    const config = getCharacterConfig(arch);
    setMyFighter((prev) => ({
      ...prev,
      archetype: arch,
      hp: config.maxHp,
      maxHp: config.maxHp,
    }));
    setCharacterConfirmed(true);
  };

  // The room row is the source of truth. Only the host commits the start once;
  // every client renders the same absolute deadline instead of starting a local timer.
  const countdownStartedRef = useRef(false);
  useEffect(() => {
    if (!characterConfirmed) return;
    const phase = String(state.phase || state.stage || "countdown");
    if (phase === "racing" || phase === "playing" || phase === "combat") {
      setCountdownText("");
      setInCountdown(false);
      setFightActive(true);
      return;
    }
    if (!isHost || countdownStartedRef.current) return;

    countdownStartedRef.current = true;
    const startedAt = Date.now();
    const duration = 3200;
    const timer = window.setInterval(() => {
      const remainingMs = Math.max(0, startedAt + duration - Date.now());
      const remaining = Math.ceil(remainingMs / 1000);
      if (remaining > 0) {
        setCountdownText(String(remaining));
        sounds.playCountdownBeep(false);
        return;
      }
      window.clearInterval(timer);
      sounds.playCountdownBeep(true);
      setCountdownText("FIGHT!");
      setInCountdown(false);
      setFightActive(true);
      void onAct("start_fight");
      window.setTimeout(() => setCountdownText(""), 500);
    }, 100);
    return () => window.clearInterval(timer);
  }, [characterConfirmed, isHost, onAct, state.phase, state.stage]);

  // Keyboard Listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["w", "W", "a", "A", "s", "S", "d", "D", " ", "Shift", "e", "E", "q", "Q"].includes(e.key)) {
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
      }
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.forward = true;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.backward = true;
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysRef.current.left = true;
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.right = true;
      if (e.key === " ") {
        if (!keysRef.current.space) sounds.playJumpSound();
        keysRef.current.space = true;
      }
      if (e.key === "Shift") keysRef.current.shift = true;
      if (e.key === "e" || e.key === "E") keysRef.current.block = true;
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") keysRef.current.forward = false;
      if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") keysRef.current.backward = false;
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") keysRef.current.right = false;
      if (e.key === " ") keysRef.current.space = false;
      if (e.key === "Shift") keysRef.current.shift = false;
      if (e.key === "e" || e.key === "E") keysRef.current.block = false;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Subscribe to Supabase Realtime Broadcast for opponent transforms & hits
  useEffect(() => {
    if (!channel) return;

    const sub = channel.on("broadcast", { event: "combat_transform" }, (payload: any) => {
      if (payload.payload && payload.payload.seat !== meSeat) {
        const fighter = payload.payload as FighterTransform;
        setAllFighters((prev) => ({ ...prev, [fighter.seat]: fighter }));
      }
    });

    const hitSub = channel.on("broadcast", { event: "combat_hit" }, (payload: any) => {
      if (payload.payload) {
        const { victimSeat, damage, position } = payload.payload;
        sounds.playHitSound();
        setHitParticles((prev) => [
          ...prev,
          { id: Date.now() + Math.random(), position: position || [0, 1, 0], color: "#ff3366", createdAt: Date.now() },
        ]);
        if (victimSeat === meSeat) {
          setMyFighter((prev) => {
            const nextHp = Math.max(0, prev.hp - damage);
            const isElim = nextHp <= 0;
            if (isElim && !prev.isEliminated) {
              sounds.playEliminationSound();
              void onAct("eliminate_player", String(meSeat));
            }
            return {
              ...prev,
              hp: nextHp,
              damageReceived: prev.damageReceived + damage,
              isEliminated: isElim,
            };
          });
        }
      }
    });

    return () => {
      try {
        sub?.unsubscribe?.();
        hitSub?.unsubscribe?.();
      } catch {}
    };
  }, [channel, meSeat, onAct]);

  // Main 60 Hz Physics, Movement, Combat, and Broadcast Loop
  useEffect(() => {
    if (!fightActive) return;

    let animFrame: number;
    let lastTime = performance.now();
    let broadcastTimer = 0;

    function loop(now: number) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      setMyFighter((prev) => {
        if (prev.isEliminated) return prev;

        const config = getCharacterConfig(prev.archetype);
        let [vx, vy, vz] = velocityRef.current;
        let [px, py, pz] = prev.position;

        // Apply Gravity
        if (py > 0.1) {
          vy -= 24.0 * dt;
          py += vy * dt;
          if (py <= 0.1) {
            py = 0.1;
            vy = 0;
          }
        } else {
          py = 0.1;
          if (keysRef.current.space || touchInputsRef.current.jump) {
            vy = config.jumpVelocity;
            py += vy * dt;
          }
        }

        // Horizontal Movement
        const touch = touchInputsRef.current;
        let dirX = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0) + touch.moveDir[0];
        let dirZ = (keysRef.current.backward ? 1 : 0) - (keysRef.current.forward ? 1 : 0) + touch.moveDir[1];

        const isBlocking = keysRef.current.block || touch.block;
        const isDodging = prev.dodgeCooldownRemaining <= 0 && (keysRef.current.shift || touch.dodge);

        let rotY = prev.rotationY;
        if (dirX !== 0 || dirZ !== 0) {
          rotY = Math.atan2(dirX, dirZ);
        }

        if (isBlocking) {
          vx = 0;
          vz = 0;
        } else if (isDodging) {
          sounds.playDodgeSound();
          vx = Math.sin(rotY) * config.speed * 2.2;
          vz = Math.cos(rotY) * config.speed * 2.2;
        } else if (dirX !== 0 || dirZ !== 0) {
          vx = Math.sin(rotY) * config.speed;
          vz = Math.cos(rotY) * config.speed;
        } else {
          vx *= 0.8;
          vz *= 0.8;
        }

        // Apply arena radial boundaries (13m radius)
        px += vx * dt;
        pz += vz * dt;
        const dist = Math.sqrt(px * px + pz * pz);
        if (dist > 13.0) {
          px = (px / dist) * 13.0;
          pz = (pz / dist) * 13.0;
        }

        velocityRef.current = [vx, vy, vz];

        // Cooldown updates
        const specCd = Math.max(0, prev.specialCooldownRemaining - dt);
        const dodgeCd = Math.max(0, prev.dodgeCooldownRemaining - dt);

        const updated: FighterTransform = {
          ...prev,
          position: [px, py, pz],
          rotationY: rotY,
          isBlocking,
          isDodging,
          specialCooldownRemaining: specCd,
          dodgeCooldownRemaining: isDodging ? config.specialCooldown * 0.5 : dodgeCd,
        };

        // Broadcast transform every 33ms (30 Hz)
        broadcastTimer += dt;
        if (broadcastTimer >= 0.033 && channel) {
          broadcastTimer = 0;
          channel.send({
            type: "broadcast",
            event: "combat_transform",
            payload: updated,
          });
        }

        return updated;
      });

      // Cleanup hit particles older than 600ms
      setHitParticles((prev) => prev.filter((p) => Date.now() - p.createdAt < 600));

      animFrame = requestAnimationFrame(loop);
    }

    animFrame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [fightActive, channel]);

  // Combine local fighter with opponent fighters map
  const activeFightersMap = { ...allFighters, [meSeat]: myFighter };
  const fightersList = Object.values(activeFightersMap);

  // Handle Local Attacks & Hit Detection
  const handleAttack = (type: "light" | "heavy" | "special") => {
    if (!fightActive || myFighter.isEliminated || myFighter.isBlocking) return;

    const config = getCharacterConfig(myFighter.archetype);
    let damage = config.lightDamage;

    if (type === "light") {
      sounds.playLightAttackSound();
    } else if (type === "heavy") {
      sounds.playHeavyAttackSound();
      damage = config.heavyDamage;
    } else if (type === "special") {
      if (myFighter.specialCooldownRemaining > 0) return;
      sounds.playSpecialSound();
      damage = config.specialDamage;
      setMyFighter((prev) => ({ ...prev, specialCooldownRemaining: config.specialCooldown }));
    }

    // Check hit collision against nearby opponent fighters
    fightersList.forEach((target) => {
      if (target.seat !== meSeat && !target.isEliminated && target.hp > 0) {
        const dx = target.position[0] - myFighter.position[0];
        const dz = target.position[2] - myFighter.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Hitbox reach check (within 2.4m in front)
        if (distance <= 2.4) {
          const finalDamage = target.isBlocking ? damage * (1 - getCharacterConfig(target.archetype).blockMitigation) : damage;

          channel?.send({
            type: "broadcast",
            event: "combat_hit",
            payload: {
              attackerSeat: meSeat,
              victimSeat: target.seat,
              damage: finalDamage,
              position: target.position,
            },
          });

          setMyFighter((prev) => ({
            ...prev,
            comboCount: prev.comboCount + 1,
            damageDealt: prev.damageDealt + finalDamage,
          }));
        }
      }
    });
  };

  

  // Mouse Attack Listeners
  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    if (e.button === 0) handleAttack("light");
    else if (e.button === 2) handleAttack("heavy");
  };

  // Build Results Standings List if match completed
  const resultsList: CombatMatchResult[] = fightersList.map((f, i) => ({
    seat: f.seat,
    playerId: f.playerId,
    displayName: f.displayName,
    archetype: f.archetype,
    rank: f.isEliminated ? fightersList.length - i : 1,
    kills: f.kills,
    damageDealt: f.damageDealt,
    damageReceived: f.damageReceived,
  }));
  resultsList.sort((a, b) => a.rank - b.rank);

  // Spectator Next Target Switcher
  const handleNextSpectate = () => {
    const aliveSeats = fightersList.filter((f) => !f.isEliminated).map((f) => f.seat);
    if (aliveSeats.length === 0) return;
    const currentIdx = aliveSeats.indexOf(spectateTargetSeat);
    const nextIdx = (currentIdx + 1) % aliveSeats.length;
    setSpectateTargetSeat(aliveSeats[nextIdx]);
  };

  return (
    <MobileOrientationOverlay>
      <div
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed inset-0 z-[60] isolate h-[100dvh] min-h-screen w-screen overflow-hidden bg-slate-950 select-none"
      >
        {/* Pre-Match Character Archetype Picker Modal */}
        {!characterConfirmed && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/90 p-3 backdrop-blur-md sm:p-6">
            <div className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-y-auto rounded-3xl border-4 border-slate-950 bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-8">
              <div className="shrink-0 text-center">
                <span className="text-4xl sm:text-6xl">⚔️</span>
                <h2 className="mt-1 text-2xl font-black uppercase text-slate-950 sm:mt-2 sm:text-4xl">Choose Your Fighter</h2>
                <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">Select a fighter, then confirm to enter the 3D Rally Combat arena</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-left sm:mt-6 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
                {(["balanced", "speed", "power", "defender"] as CharacterArchetype[]).map((arch) => {
                  const cfg = CHARACTERS[arch];
                  const isSelected = selectedArchetype === arch;
                  return (
                    <button
                      key={arch}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedArchetype(arch)}
                      className={`min-h-[178px] rounded-2xl border-2 border-slate-950 p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-400 sm:min-h-[230px] sm:p-4 ${
                        isSelected
                          ? "bg-rose-100 ring-4 ring-rose-500 shadow-[3px_3px_0_#171821]"
                          : "bg-slate-50 shadow-[2px_2px_0_#171821] hover:bg-slate-100"
                      }`}
                    >
                      <span className="block text-2xl sm:text-3xl">{cfg.modelIcon}</span>
                      <strong className="mt-1 block text-xs font-black text-slate-950 sm:mt-2 sm:text-sm">{cfg.name}</strong>
                      <span className="block text-[9px] font-bold uppercase text-slate-600 sm:text-[10px]">{cfg.title}</span>
                      <p className="mt-1 line-clamp-3 text-[10px] font-medium leading-tight text-slate-700 sm:mt-2 sm:text-[11px]">{cfg.description}</p>
                      <div className="mt-2 border-t border-slate-200 pt-2 text-[9px] font-black text-slate-800 sm:mt-3 sm:text-[10px]">
                        <p>HP: {cfg.hp}</p>
                        <p className="truncate">Special: {cfg.specialName}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => confirmCharacter(selectedArchetype)}
                className="arcade-button mx-auto mt-4 w-full shrink-0 bg-[#ff3366] px-6 py-3 text-xs font-black text-white shadow-[4px_4px_0_#171821] sm:mt-6 sm:w-auto sm:px-10 sm:py-4 sm:text-sm"
              >
                ENTER ARENA ⚔️
              </button>
            </div>
          </div>
        )}

        {/* 3D Scene Canvas */}
        <CombatCanvas>
          <RooftopArena3D />

          {/* 3D Fighter Nodes */}
          {fightersList.map((f) => (
            <Fighter3D key={f.seat} transform={f} isLocal={f.seat === meSeat} />
          ))}

          {/* Hit Sparks & VFX */}
          <HitVFX particles={hitParticles} />

          {/* Dynamic 3D Group Camera */}
          <DynamicCombatCamera fighters={fightersList} />
        </CombatCanvas>

        {/* Countdown Overlay */}
        {inCountdown && countdownText && (
          <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center">
            <span className="text-7xl sm:text-9xl font-black italic tracking-tighter text-amber-300 drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)] animate-ping">
              {countdownText}
            </span>
          </div>
        )}

        {/* Combat HUD Overlay */}
        <CombatHUD
          players={players}
          fighters={activeFightersMap}
          meSeat={meSeat}
          isSpectating={myFighter.isEliminated}
          spectateTargetSeat={spectateTargetSeat}
          onNextSpectate={handleNextSpectate}
          comboCount={myFighter.comboCount}
          specialCooldown={myFighter.specialCooldownRemaining}
          dodgeCooldown={myFighter.dodgeCooldownRemaining}
        />

        {/* Mobile Landscape Touch Controls */}
        <CombatTouchControls
          onInputsChange={setTouchInputs}
          onAttack={handleAttack}
          specialName={CHARACTERS[myFighter.archetype].specialName}
          specialCooldown={myFighter.specialCooldownRemaining}
        />

        {/* Post-Match Results Modal */}
        {(state.stage === "results" || room.status === "completed") && (
          <CombatResultsModal
            results={resultsList}
            players={players}
            meSeat={meSeat}
            isHost={isHost}
            onRematch={() => onAct("restart")}
            onExit={() => (window.location.href = "/dashboard")}
            busy={busy}
          />
        )}
      </div>
    </MobileOrientationOverlay>
  );
}
