"use client";

import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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
    groupRef.current.position.lerp(new THREE.Vector3(...transform.position), 0.42);
    groupRef.current.rotation.y += (transform.rotationY - groupRef.current.rotation.y) * 0.42;

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
    transform.attackState === "light" || transform.attackState === "heavy" || transform.attackState === "special"
      ? transform.attackState === "special" ? 0.85 : transform.attackState === "heavy" ? 0.65 : 0.45
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
          <div className="flex min-w-[5.5rem] flex-col items-center rounded-lg border border-slate-900/20 bg-white/90 px-2 py-1 text-center shadow-lg backdrop-blur-sm">
            <span className="max-w-[7rem] truncate text-[10px] font-black text-slate-900">
              {isLocal ? `${transform.displayName} (you)` : transform.displayName}
            </span>
            <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-slate-300">
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
        {/* Neck, face, hair and eyes give the armored fighters a readable head. */}
        <mesh position={[0, 1.43, 0]} castShadow><cylinderGeometry args={[0.13, 0.16, 0.28, 12]} /><meshStandardMaterial color="#b87958" roughness={0.65} /></mesh>
        <mesh position={[0, 1.68, 0]} castShadow>
          <sphereGeometry args={[proportions.head, 24, 18]} />
          <meshStandardMaterial color="#d5a17f" roughness={0.74} />
        </mesh>
        <mesh position={[0, 1.79, -0.035]} rotation={[-0.15, 0, 0]} castShadow>
          <sphereGeometry args={[proportions.head * 0.99, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={transform.archetype === "power" ? "#30251e" : transform.archetype === "speed" ? "#1c2938" : "#262d3b"} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.7, proportions.head * 0.83]}>
          <boxGeometry args={[proportions.head * 1.22, proportions.head * 0.24, 0.045]} />
          <meshStandardMaterial color="#263448" metalness={0.35} roughness={0.28} />
        </mesh>
        <mesh position={[-0.075, 1.7, proportions.head * 0.96]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#fff2cf" /></mesh>
        <mesh position={[0.075, 1.7, proportions.head * 0.96]}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color="#fff2cf" /></mesh>

        {/* Armored torso, waist and chest plate */}
        <mesh ref={bodyMeshRef} position={[0, 1.0, 0]} castShadow>
          <capsuleGeometry args={[0.36, proportions.torsoH * 0.72, 8, 12]} />
          <meshStandardMaterial color={transform.isDodging ? "#ffffff" : transform.isBlocking ? "#fbbf24" : config.color} metalness={0.62} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.08, 0.34]} scale={[0.72, 0.62, 0.12]} castShadow>
          <sphereGeometry args={[0.55, 16, 10]} />
          <meshStandardMaterial color={accent} metalness={0.8} roughness={0.22} emissive={accent} emissiveIntensity={0.12} />
        </mesh>
        <mesh position={[0, 0.48, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.34, 0.18, 12]} />
          <meshStandardMaterial color="#171b20" metalness={0.8} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.48, 0.305]} castShadow><boxGeometry args={[0.2, 0.16, 0.08]} /><meshStandardMaterial color={accent} metalness={0.55} roughness={0.3} /></mesh>

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
        <mesh position={[-0.48, 0.67, armZ * 0.4]} castShadow><sphereGeometry args={[0.16, 12, 10]} /><meshStandardMaterial color={accent} metalness={0.45} roughness={0.3} /></mesh>
        <mesh position={[0.48, 1.0, armZ]} castShadow>
          <capsuleGeometry args={[proportions.limb + 0.02, 0.6, 6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0.48, 0.67, armZ + 0.04]} castShadow><sphereGeometry args={[transform.attackState === "heavy" ? 0.23 : 0.18, 14, 12]} /><meshStandardMaterial color={accent} metalness={0.5} roughness={0.28} /></mesh>

        {/* Legs */}
        <mesh position={[-0.2, 0.32, 0]} castShadow>
          <capsuleGeometry args={[proportions.limb + 0.02, 0.65, 6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[-0.2, 0.08, 0.05]} castShadow><boxGeometry args={[0.3, 0.16, 0.42]} /><meshStandardMaterial color="#253047" roughness={0.8} /></mesh>
        <mesh position={[0.2, 0.32, 0]} castShadow>
          <capsuleGeometry args={[proportions.limb + 0.02, 0.65, 6, 8]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0.2, 0.08, 0.05]} castShadow><boxGeometry args={[0.3, 0.16, 0.42]} /><meshStandardMaterial color="#253047" roughness={0.8} /></mesh>

        <mesh position={[-0.4, 1.39, 0.02]} castShadow><sphereGeometry args={[0.2, 14, 10]} /><meshStandardMaterial color={accent} metalness={0.55} roughness={0.3} /></mesh>
        <mesh position={[0.4, 1.39, 0.02]} castShadow><sphereGeometry args={[0.2, 14, 10]} /><meshStandardMaterial color={accent} metalness={0.55} roughness={0.3} /></mesh>
        <mesh position={[0, 1.08, 0.44]} castShadow><octahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color="#fff0b5" emissive={accent} emissiveIntensity={0.22} metalness={0.5} /></mesh>

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
