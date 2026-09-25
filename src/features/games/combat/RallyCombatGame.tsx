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

  // Opponent Fighters map synced via Supabase Realtime Broadcast
  const [allFighters, setAllFighters] = useState<Record<number, FighterTransform>>({});

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

  // Countdown Loop
  useEffect(() => {
    if (!characterConfirmed) return;

    const t0 = setTimeout(() => {
      sounds.playCountdownBeep(false);
      setCountdownText("3");
    }, 0);

    const t1 = setTimeout(() => {
      sounds.playCountdownBeep(false);
      setCountdownText("2");
    }, 1000);

    const t2 = setTimeout(() => {
      sounds.playCountdownBeep(false);
      setCountdownText("1");
    }, 2000);

    const t3 = setTimeout(() => {
      sounds.playCountdownBeep(true);
      setCountdownText("FIGHT!");
      setInCountdown(false);
      setFightActive(true);
      if (isHost) void onAct("start_fight");
    }, 3000);

    const t4 = setTimeout(() => {
      setCountdownText("");
    }, 4000);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [characterConfirmed, isHost, onAct]);

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
          <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-md">
            <div className="w-full max-w-3xl rounded-3xl border-4 border-slate-950 bg-white p-6 sm:p-8 shadow-2xl text-center space-y-6">
              <div>
                <span className="text-5xl sm:text-6xl">⚔️</span>
                <h2 className="text-3xl sm:text-4xl font-black uppercase text-slate-950 mt-2">Choose Your Fighter</h2>
                <p className="text-xs font-bold text-slate-500">Select an archetype to enter the 3D Rally Combat arena</p>
              </div>

              {/* Roster Archetypes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left">
                {(["balanced", "speed", "power", "defender"] as CharacterArchetype[]).map((arch) => {
                  const cfg = CHARACTERS[arch];
                  const isSelected = selectedArchetype === arch;
                  return (
                    <button
                      key={arch}
                      onClick={() => confirmCharacter(arch)}
                      className={`rounded-2xl border-2 border-slate-950 p-4 text-left transition hover:scale-105 cursor-pointer shadow-[3px_3px_0_#171821] ${
                        isSelected ? "bg-rose-100 ring-4 ring-rose-500" : "bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-3xl block">{cfg.modelIcon}</span>
                      <strong className="mt-2 block text-sm font-black text-slate-950">{cfg.name}</strong>
                      <span className="text-[10px] font-bold text-slate-600 block uppercase">{cfg.title}</span>
                      <p className="mt-2 text-[11px] font-medium text-slate-700 leading-tight">{cfg.description}</p>
                      <div className="mt-3 border-t border-slate-200 pt-2 text-[10px] font-black text-slate-800 space-y-0.5">
                        <p>HP: {cfg.hp}</p>
                        <p>Special: {cfg.specialName}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => confirmCharacter(selectedArchetype)}
                className="arcade-button w-full sm:w-auto bg-[#ff3366] text-white px-10 py-4 text-sm font-black shadow-[4px_4px_0_#171821]"
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
