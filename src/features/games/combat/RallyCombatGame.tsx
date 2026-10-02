"use client";

import { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  [-6, 0.4, -6],
  [6, 0.4, 6],
  [-6, 0.4, 6],
  [6, 0.4, -6],
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
  const onActRef = useRef(onAct);
  const processedHitsRef = useRef(new Set<string>());
  const attackResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackHandlerRef = useRef<(type: "light" | "heavy" | "special") => void>(() => undefined);
  useEffect(() => {
    onActRef.current = onAct;
  }, [onAct]);

  // Match is live as soon as the fighter is confirmed (no countdown).
  const fightActive = characterConfirmed;

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

  // Seed opponents from the roster; live transforms arrive over the channel.
  const [allFighters, setAllFighters] = useState<Record<number, FighterTransform>>({});
  const rosterKey = players.map((p) => `${p.seat}:${p.player_id}`).join("|");
  const seededOpponents = useMemo(() => {
    const next: Record<number, FighterTransform> = {};
    for (const player of players) {
      if (player.seat === meSeat) continue;
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
    // rosterKey captures seat/player identity changes without depending on the players array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey, meSeat]);

  // Merge seeded placeholders with live updates (live wins when present).
  const mergedOpponents = useMemo(() => {
    const merged = { ...seededOpponents };
    for (const [seat, fighter] of Object.entries(allFighters)) {
      merged[Number(seat)] = fighter;
    }
    return merged;
  }, [seededOpponents, allFighters]);

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

  // Host marks the fight live on the server once characters are ready — no 3-2-1 delay.
  const fightStartedRef = useRef(false);
  useEffect(() => {
    if (!characterConfirmed || !isHost || fightStartedRef.current) return;
    fightStartedRef.current = true;
    void onAct("start_fight");
  }, [characterConfirmed, isHost, onAct]);


  // Keyboard Listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["w", "W", "a", "A", "s", "S", "d", "D", " ", "Shift", "e", "E", "q", "Q", "f", "F", "r", "R"].includes(e.key)) {
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
      if (!e.repeat && (e.key === "q" || e.key === "Q")) attackHandlerRef.current("special");
      if (!e.repeat && (e.key === "f" || e.key === "F")) attackHandlerRef.current("light");
      if (!e.repeat && (e.key === "r" || e.key === "R")) attackHandlerRef.current("heavy");
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

    channel.on("broadcast", { event: "combat_transform" }, (payload: any) => {
      const data = payload?.payload ?? payload;
      if (data?.seat && data.seat !== meSeat) {
        const fighter = data as FighterTransform;
        setAllFighters((prev) => ({ ...prev, [fighter.seat]: fighter }));
      }
    });

    channel.on("broadcast", { event: "combat_hit" }, (payload: any) => {
      const hit = payload?.payload ?? payload;
      if (!hit || typeof hit.victimSeat !== "number") return;
      const hitId = typeof hit.hitId === "string" ? hit.hitId : `${hit.attackerSeat}:${hit.victimSeat}:${hit.createdAt}`;
      if (processedHitsRef.current.has(hitId)) return;
      processedHitsRef.current.add(hitId);
      if (processedHitsRef.current.size > 100) {
        const oldest = processedHitsRef.current.values().next().value;
        if (oldest) processedHitsRef.current.delete(oldest);
      }
      const damage = Math.max(0, Number(hit.damage) || 0);
      const position: [number, number, number] = Array.isArray(hit.position) ? hit.position as [number, number, number] : [0, 1, 0];
      sounds.playHitSound();
      setHitParticles((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), position, color: "#ff8a38", createdAt: Date.now() },
      ]);
      if (hit.victimSeat !== meSeat || damage <= 0) return;

      setMyFighter((prev) => {
        if (prev.isEliminated) return prev;
        const nextHp = Math.max(0, prev.hp - damage);
        const isElim = nextHp <= 0;
        if (isElim && !prev.isEliminated) {
          sounds.playEliminationSound();
          void onActRef.current("eliminate_player", String(meSeat));
        }
        return {
          ...prev,
          hp: nextHp,
          damageReceived: prev.damageReceived + damage,
          isEliminated: isElim,
          attackState: "hit",
        };
      });
    });

    // This is useRoom's shared channel; its owner removes it. Unsubscribing here
    // would also stop presence, room updates, and every other game's broadcasts.
  }, [channel, meSeat]);

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
  const activeFightersMap = { ...mergedOpponents, [meSeat]: myFighter };
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
    const facing: [number, number] = [Math.sin(myFighter.rotationY), Math.cos(myFighter.rotationY)];
    const reach = type === "special" ? 5.5 : type === "heavy" ? 3.8 : 3.2;
    let hitCount = 0;
    fightersList.forEach((target) => {
      if (target.seat !== meSeat && !target.isEliminated && target.hp > 0) {
        const dx = target.position[0] - myFighter.position[0];
        const dz = target.position[2] - myFighter.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);

        const directionX = distance > 0 ? dx / distance : 0;
        const directionZ = distance > 0 ? dz / distance : 0;
        const inFront = facing[0] * directionX + facing[1] * directionZ >= -0.25;
        // Wide, forgiving melee arcs make touch and pointer attacks dependable.
        if (distance <= reach && inFront) {
          const finalDamage = target.isBlocking ? damage * (1 - getCharacterConfig(target.archetype).blockMitigation) : damage;

          channel?.send({
            type: "broadcast",
            event: "combat_hit",
            payload: {
              attackerSeat: meSeat,
              victimSeat: target.seat,
              damage: finalDamage,
              position: target.position,
              hitId: `${meSeat}-${target.seat}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: Date.now(),
            },
          });
          hitCount += 1;

          setMyFighter((prev) => ({
            ...prev,
            comboCount: prev.comboCount + 1,
            damageDealt: prev.damageDealt + finalDamage,
          }));
        }
      }
    });

    setMyFighter((prev) => ({ ...prev, attackState: type }));
    if (attackResetRef.current) clearTimeout(attackResetRef.current);
    attackResetRef.current = setTimeout(() => {
      setMyFighter((prev) => prev.attackState === type ? { ...prev, attackState: "idle" } : prev);
    }, type === "heavy" || type === "special" ? 480 : 300);

    if (hitCount === 0) {
      setHitParticles((prev) => [...prev, {
        id: Date.now() + Math.random(),
        position: [myFighter.position[0] + facing[0] * 1.2, myFighter.position[1] + 1.2, myFighter.position[2] + facing[1] * 1.2],
        color: "#fbbf24",
        createdAt: Date.now(),
      }]);
    }
  };

  useEffect(() => {
    attackHandlerRef.current = handleAttack;
  });

  

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
        className="fixed inset-0 z-[60] isolate h-[100dvh] min-h-screen w-screen overflow-hidden bg-sky-100 select-none"
      >
        {/* Pre-Match Character Archetype Picker Modal */}
        {!characterConfirmed && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-sky-950/35 p-3 backdrop-blur-sm sm:p-6">
            <div className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-y-auto rounded-3xl border-4 border-slate-900 bg-gradient-to-br from-white via-sky-50 to-amber-50 p-4 shadow-[0_24px_70px_rgba(15,23,42,.35)] sm:max-h-[calc(100dvh-3rem)] sm:p-8">
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
                      className={`relative min-h-[178px] overflow-hidden rounded-2xl border-2 border-slate-900 p-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-400 sm:min-h-[230px] sm:p-4 ${
                        isSelected
                          ? "bg-white ring-4 ring-rose-500 shadow-[0_12px_30px_rgba(225,29,72,.22)] -translate-y-1"
                          : "bg-white/75 shadow-[0_5px_0_#cbd5e1] hover:-translate-y-1 hover:bg-white"
                      }`}
                    >
                      <span className="mb-2 flex h-16 items-center justify-center overflow-hidden rounded-xl sm:h-24" style={{ background: `radial-gradient(ellipse at 50% 100%, ${cfg.color}75, transparent 68%),linear-gradient(145deg,#dbeafe,#f8fafc)` }}>
                        <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true"><ellipse cx="60" cy="80" rx="28" ry="5" fill="#0f172a" opacity=".18"/><path d="M42 78 46 54 39 42q-4-8 3-13l10 8h16l10-8q7 5 3 13l-7 12 4 24z" fill={cfg.color} stroke="#172033" strokeWidth="3" strokeLinejoin="round"/><path d="M48 42q12 6 24 0l6 15H42z" fill="#f8fafc" stroke="#172033" strokeWidth="2"/><circle cx="60" cy="24" r="13" fill="#c68c68" stroke="#172033" strokeWidth="3"/><path d="M47 23q2-15 15-13 10 1 12 12l-5 2-4-6q-7 6-18 5z" fill="#253047"/><path d="M51 25h7m5 0h7" stroke="#172033" strokeWidth="2" strokeLinecap="round"/><path d="M35 44 24 54m61-10 11 10" stroke="#172033" strokeWidth="9" strokeLinecap="round"/><circle cx="23" cy="55" r="6" fill={cfg.color} stroke="#172033" strokeWidth="2"/><circle cx="97" cy="55" r="6" fill={cfg.color} stroke="#172033" strokeWidth="2"/></svg>
                      </span>
                      <span className="mr-1 inline-block text-lg align-middle">{cfg.modelIcon}</span>
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
                className="mx-auto mt-4 w-full shrink-0 rounded-2xl border-2 border-slate-950 bg-gradient-to-r from-rose-500 to-orange-400 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-[0_6px_0_#9f1239,0_12px_24px_rgba(225,29,72,.28)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_#9f1239] sm:mt-6 sm:w-auto sm:px-10 sm:py-4"
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
