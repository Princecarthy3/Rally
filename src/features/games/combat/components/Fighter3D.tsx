"use client";

import { Html } from "@react-three/drei";
import { useRef } from "react";
import { Group, Mesh } from "three";
import { getCharacterConfig } from "../character-config";
import { FighterTransform } from "../types";

export function Fighter3D({
  transform,
  isLocal,
}: {
  transform: FighterTransform;
  isLocal: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const bodyMeshRef = useRef<Mesh>(null);
  const config = getCharacterConfig(transform.archetype);

  const hpPercent = Math.max(0, Math.min(100, (transform.hp / (transform.maxHp || 100)) * 100));

  // Visual pose tweaks based on animState & attackState
  const isAttacking = transform.attackState === "light" || transform.attackState === "heavy" || transform.attackState === "special";
  const armOffsetZ = isAttacking ? -0.4 : 0;
  const bodyRotX = transform.isBlocking ? 0.2 : transform.isDodging ? -0.3 : 0;
  const isEliminated = transform.isEliminated || transform.hp <= 0;

  return (
    <group
      ref={groupRef}
      position={transform.position}
      rotation={[0, transform.rotationY, 0]}
    >
      {/* Overhead Player HP Bar and Name Tag */}
      <Html position={[0, 2.6, 0]} center distanceFactor={14}>
        <div className="flex flex-col items-center pointer-events-none select-none">
          <div className="flex items-center gap-1 text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <span className="rounded-full bg-slate-950/80 px-2 py-0.5 border border-white/20">
              P{transform.seat} {transform.displayName} {isLocal ? "(you)" : ""}
            </span>
          </div>

          <div className="mt-1 h-2.5 w-24 overflow-hidden rounded-full border border-black bg-slate-900 shadow-md">
            <div
              className={`h-full transition-all duration-150 ${
                hpPercent > 50 ? "bg-emerald-500" : hpPercent > 20 ? "bg-amber-400" : "bg-rose-600 animate-pulse"
              }`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>

          {/* Action indicator status */}
          {transform.isBlocking && (
            <span className="mt-0.5 text-[9px] font-black uppercase text-amber-300 bg-black/70 px-1.5 py-0.2 rounded">
              🛡️ BLOCK
            </span>
          )}
          {transform.isDodging && (
            <span className="mt-0.5 text-[9px] font-black uppercase text-cyan-300 bg-black/70 px-1.5 py-0.2 rounded">
              ⚡ DODGE
            </span>
          )}
          {transform.comboCount > 1 && (
            <span className="mt-0.5 text-[10px] font-black text-yellow-300 animate-bounce">
              COMBO x{transform.comboCount}
            </span>
          )}
        </div>
      </Html>

      {/* Humanoid Fighter Body Structure */}
      <group rotation={[bodyRotX, 0, isEliminated ? Math.PI / 2 : 0]} position={[0, isEliminated ? 0.3 : 0, 0]}>
        {/* Head */}
        <mesh position={[0, 1.7, 0]} castShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color={config.color} roughness={0.3} />
        </mesh>

        {/* Torso */}
        <mesh ref={bodyMeshRef} position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.65, 0.9, 0.4]} />
          <meshStandardMaterial
            color={transform.isDodging ? "#ffffff" : transform.isBlocking ? "#fbbf24" : config.color}
            metalness={transform.isBlocking ? 0.8 : 0.2}
            roughness={0.4}
          />
        </mesh>

        {/* Left Arm */}
        <mesh position={[-0.45, 1.0, armOffsetZ]} castShadow>
          <capsuleGeometry args={[0.12, 0.6, 8, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {/* Right Arm / Weapon Hand */}
        <mesh position={[0.45, 1.0, armOffsetZ]} castShadow>
          <capsuleGeometry args={[0.14, 0.65, 8, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {/* Left Leg */}
        <mesh position={[-0.2, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.14, 0.7, 8, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>

        {/* Right Leg */}
        <mesh position={[0.2, 0.35, 0]} castShadow>
          <capsuleGeometry args={[0.14, 0.7, 8, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>

        {/* Blocking Shield Barrier Visual Effect */}
        {transform.isBlocking && (
          <mesh position={[0, 1.0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.7, 0.7, 0.1, 16]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
          </mesh>
        )}
      </group>
    </group>
  );
}
