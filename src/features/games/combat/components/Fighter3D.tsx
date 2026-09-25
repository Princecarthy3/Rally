"use client";

import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { getCharacterConfig } from "../character-config";
import type { FighterTransform } from "../types";

export function Fighter3D({
  transform,
  isLocal,
}: {
  transform: FighterTransform;
  isLocal?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMeshRef = useRef<THREE.Mesh>(null);
  const config = getCharacterConfig(transform.archetype);
  const isEliminated = transform.isEliminated || transform.animState === "defeat";

  const proportions = useMemo(() => {
    switch (transform.archetype) {
      case "speed":
        return { scale: 0.92, limb: 0.11, torsoH: 0.85, head: 0.28 };
      case "power":
        return { scale: 1.12, limb: 0.16, torsoH: 1.0, head: 0.32 };
      case "defender":
        return { scale: 1.08, limb: 0.15, torsoH: 0.95, head: 0.3 };
      default:
        return { scale: 1.0, limb: 0.13, torsoH: 0.9, head: 0.3 };
    }
  }, [transform.archetype]);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(...transform.position);
    groupRef.current.rotation.y = transform.rotationY;

    if (bodyMeshRef.current && !isEliminated) {
      const t = state.clock.elapsedTime;
      const bob =
        transform.animState === "walk"
          ? Math.sin(t * 10) * 0.04
          : transform.attackState !== "idle"
            ? Math.sin(t * 20) * 0.06
            : Math.sin(t * 2) * 0.015;
      bodyMeshRef.current.position.y = 1.0 + bob;
    }
  });

  const armZ =
    transform.attackState === "light" || transform.attackState === "heavy"
      ? 0.45
      : transform.isBlocking
        ? 0.25
        : 0.05;

  const accent =
    transform.archetype === "speed"
      ? "#67e8f9"
      : transform.archetype === "power"
        ? "#fbbf24"
        : transform.archetype === "defender"
          ? "#4ade80"
          : "#fb7185";

  return (
    <group ref={groupRef} scale={proportions.scale}>
      {!isEliminated && (
        <Html position={[0, 2.35, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <div className="flex min-w-[5.5rem] flex-col items-center rounded-lg border border-white/20 bg-slate-950/85 px-2 py-1 text-center shadow-lg backdrop-blur-sm">
            <span className="max-w-[7rem] truncate text-[10px] font-black text-white">
              {isLocal ? `${transform.displayName} (you)` : transform.displayName}
            </span>
            <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${Math.max(0, (transform.hp / transform.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        </Html>
      )}

      <group
        rotation={[0, 0, isEliminated ? Math.PI / 2 : 0]}
        position={[0, isEliminated ? 0.25 : 0, 0]}
      >
        {/* Head */}
        <mesh position={[0, 1.65, 0]} castShadow>
          <sphereGeometry args={[proportions.head, 16, 16]} />
          <meshStandardMaterial color={config.color} roughness={0.35} metalness={0.15} />
        </mesh>
        {/* Visor / face plate by archetype */}
        <mesh position={[0, 1.68, proportions.head * 0.75]}>
          <boxGeometry args={[proportions.head * 1.1, proportions.head * 0.35, 0.06]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
        </mesh>

        {/* Torso */}
        <mesh ref={bodyMeshRef} position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.7, proportions.torsoH, 0.42]} />
          <meshStandardMaterial
            color={transform.isDodging ? "#ffffff" : transform.isBlocking ? "#fbbf24" : config.color}
            metalness={transform.isBlocking ? 0.75 : 0.25}
            roughness={0.4}
          />
        </mesh>

        {/* Shoulder pads for power/defender */}
        {(transform.archetype === "power" || transform.archetype === "defender") && (
          <>
            <mesh position={[-0.48, 1.35, 0]} castShadow>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshStandardMaterial color={accent} metalness={0.5} />
            </mesh>
            <mesh position={[0.48, 1.35, 0]} castShadow>
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshStandardMaterial color={accent} metalness={0.5} />
            </mesh>
          </>
        )}

        {/* Arms */}
        <mesh position={[-0.48, 1.0, armZ * 0.3]} castShadow>
          <capsuleGeometry args={[proportions.limb, 0.55, 6, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0.48, 1.0, armZ]} castShadow>
          <capsuleGeometry args={[proportions.limb + 0.02, 0.6, 6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>

        {/* Legs */}
        <mesh position={[-0.2, 0.32, 0]} castShadow>
          <capsuleGeometry args={[proportions.limb + 0.02, 0.65, 6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0.2, 0.32, 0]} castShadow>
          <capsuleGeometry args={[proportions.limb + 0.02, 0.65, 6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>

        {transform.isBlocking && (
          <mesh position={[0, 1.05, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.06, 8, 20]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.7} />
          </mesh>
        )}
      </group>
    </group>
  );
}
