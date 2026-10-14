"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  STATIC_PLATFORMS,
  MOVING_PLATFORMS,
  ROTATING_HAZARDS,
  DISAPPEARING_PLATFORMS,
  TOWER_CHECKPOINTS,
  getMovingPlatformPos,
} from "../tower-layout";
import type { DisappearingPlatformState } from "../physics";

export function TowerEnvironment3D({
  elapsedSec,
  disappearingStates,
}: {
  elapsedSec: number;
  disappearingStates: Record<string, DisappearingPlatformState>;
}) {
  const movingPlatRefs = useRef<Record<string, THREE.Group | null>>({});
  const rotatingHazardRefs = useRef<Record<string, THREE.Group | null>>({});
  const disappearingRefs = useRef<Record<string, THREE.Mesh | null>>({});

  // Central core pulse animation
  const coreRingsRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    // 1. Update moving platforms
    for (const plat of MOVING_PLATFORMS) {
      const group = movingPlatRefs.current[plat.id];
      if (group) {
        const [x, y, z] = getMovingPlatformPos(plat, elapsedSec);
        group.position.set(x, y, z);
      }
    }

    // 2. Update rotating hazard laser beams
    for (const hazard of ROTATING_HAZARDS) {
      const group = rotatingHazardRefs.current[hazard.id];
      if (group) {
        group.rotation.y = elapsedSec * hazard.speed;
      }
    }

    // 3. Update disappearing platform visuals (flicker when decaying)
    for (const plat of DISAPPEARING_PLATFORMS) {
      const mesh = disappearingRefs.current[plat.id];
      if (mesh) {
        const state = disappearingStates[plat.id]?.state || "intact";
        if (state === "hidden") {
          mesh.scale.set(0, 0, 0);
        } else if (state === "decaying") {
          // Rapid strobe effect
          const flash = Math.sin(elapsedSec * 25) > 0 ? 0.3 : 1.0;
          mesh.scale.set(1, flash, 1);
        } else {
          mesh.scale.set(1, 1, 1);
        }
      }
    }

    // Rotate core rings slowly
    if (coreRingsRef.current) {
      coreRingsRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group>
      {/* ======================================================== */}
      {/* CENTRAL ARCHITECTURAL SPIRE & ENERGY CORE                 */}
      {/* ======================================================== */}
      <group position={[0, 35, 0]}>
        {/* Core Cylinder Spire */}
        <mesh receiveShadow>
          <cylinderGeometry args={[1.2, 2.2, 74, 24]} />
          <meshStandardMaterial
            color="#0f0e26"
            roughness={0.6}
            metalness={0.8}
          />
        </mesh>

        {/* Vertical Energy Ribs */}
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
          <mesh key={i} rotation={[0, angle, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[0.3, 74, 3.2]} />
            <meshStandardMaterial
              color="#312e81"
              emissive="#4338ca"
              emissiveIntensity={0.6}
              roughness={0.3}
            />
          </mesh>
        ))}
      </group>

      {/* Rotating Energy Rings on Core */}
      <group ref={coreRingsRef}>
        {[8, 20, 34, 48, 62].map((y, idx) => (
          <mesh key={idx} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.8, 0.12, 12, 32]} />
            <meshStandardMaterial
              color="#a855f7"
              emissive="#c084fc"
              emissiveIntensity={1.8}
            />
          </mesh>
        ))}
      </group>

      {/* ======================================================== */}
      {/* STATIC PLATFORMS                                         */}
      {/* ======================================================== */}
      {STATIC_PLATFORMS.map((plat) => {
        const isBase = plat.id === "base_platform";
        const isSummit = plat.id === "summit_platform";
        const isCp = plat.type === "checkpoint";

        return (
          <group key={plat.id} position={plat.position}>
            {/* Main Platform Body */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={plat.size} />
              <meshStandardMaterial
                color={plat.color}
                emissive={plat.emissive || "#000000"}
                emissiveIntensity={isSummit ? 1.2 : isCp ? 0.8 : 0.2}
                roughness={0.35}
                metalness={0.4}
              />
            </mesh>

            {/* Glowing Accent Rim / Border */}
            <mesh position={[0, plat.size[1] / 2 + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[plat.size[0] * 0.94, plat.size[2] * 0.94]} />
              <meshBasicMaterial
                color={isSummit ? "#fef08a" : isCp ? "#86efac" : "#60a5fa"}
                wireframe
              />
            </mesh>

            {/* Base platform decorative fence / glow ring */}
            {isBase && (
              <group position={[0, 0.6, 0]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[6.2, 6.6, 32]} />
                  <meshBasicMaterial color="#818cf8" />
                </mesh>
              </group>
            )}

            {/* Summit Grand Podium & Finish Ring */}
            {isSummit && (
              <group position={[0, 1.2, 0]}>
                {/* Floating Victory Finish Ring */}
                <mesh position={[0, 2.2, 0]} rotation={[0, 0, 0]}>
                  <torusGeometry args={[2.5, 0.22, 16, 32]} />
                  <meshStandardMaterial
                    color="#f59e0b"
                    emissive="#fbbf24"
                    emissiveIntensity={2.5}
                    roughness={0.1}
                  />
                </mesh>

                {/* 1st Place Trophy Cup */}
                <group position={[0, 0.8, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.6, 0.3, 0.9, 16]} />
                    <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
                  </mesh>
                  <mesh position={[0, 0.7, 0]} castShadow>
                    <sphereGeometry args={[0.3, 16, 16]} />
                    <meshStandardMaterial
                      color="#fef08a"
                      emissive="#fde047"
                      emissiveIntensity={1.5}
                    />
                  </mesh>
                </group>
              </group>
            )}
          </group>
        );
      })}

      {/* ======================================================== */}
      {/* MOVING PLATFORMS                                         */}
      {/* ======================================================== */}
      {MOVING_PLATFORMS.map((plat) => (
        <group
          key={plat.id}
          ref={(el) => {
            movingPlatRefs.current[plat.id] = el;
          }}
          position={plat.startPos}
        >
          {/* Main Floating Pad */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={plat.size} />
            <meshStandardMaterial
              color={plat.color}
              emissive={plat.color}
              emissiveIntensity={0.6}
              roughness={0.3}
              metalness={0.5}
            />
          </mesh>

          {/* Underglow Hazard Thruster */}
          <mesh position={[0, -plat.size[1] / 2 - 0.08, 0]}>
            <cylinderGeometry args={[0.4, 0.6, 0.2, 12]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={2.0}
            />
          </mesh>
        </group>
      ))}

      {/* ======================================================== */}
      {/* ROTATING HAZARDS (Laser Beams)                            */}
      {/* ======================================================== */}
      {ROTATING_HAZARDS.map((hazard) => (
        <group
          key={hazard.id}
          ref={(el) => {
            rotatingHazardRefs.current[hazard.id] = el;
          }}
          position={hazard.centerPos}
        >
          {/* Center Hub Rotor */}
          <mesh castShadow>
            <cylinderGeometry args={[0.5, 0.5, hazard.height * 1.5, 16]} />
            <meshStandardMaterial color="#1e1b4b" metalness={0.9} roughness={0.2} />
          </mesh>

          {/* Glowing Laser Beam Bar */}
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[hazard.length, hazard.height, hazard.thickness]} />
            <meshStandardMaterial
              color={hazard.color}
              emissive={hazard.color}
              emissiveIntensity={2.8}
              roughness={0.1}
            />
          </mesh>

          {/* Outer Glowing Energy Sheen */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[hazard.length + 0.1, hazard.height + 0.1, hazard.thickness + 0.1]} />
            <meshBasicMaterial color="#fca5a5" transparent opacity={0.25} />
          </mesh>
        </group>
      ))}

      {/* ======================================================== */}
      {/* DISAPPEARING PLATFORMS                                   */}
      {/* ======================================================== */}
      {DISAPPEARING_PLATFORMS.map((plat) => (
        <mesh
          key={plat.id}
          ref={(el) => {
            disappearingRefs.current[plat.id] = el;
          }}
          position={plat.position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={plat.size} />
          <meshStandardMaterial
            color={plat.color}
            emissive={plat.color}
            emissiveIntensity={0.8}
            roughness={0.2}
            metalness={0.3}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}

      {/* ======================================================== */}
      {/* CHECKPOINTS (Holographic Energy Pillars)                 */}
      {/* ======================================================== */}
      {TOWER_CHECKPOINTS.map((cp) => {
        if (cp.idx === 0) return null; // Skip ground spawn
        return (
          <group key={cp.idx} position={cp.position}>
            {/* Vertical translucent energy cylinder */}
            <mesh position={[0, 2.5, 0]}>
              <cylinderGeometry args={[cp.radius * 0.9, cp.radius * 0.9, 5.0, 16, 1, true]} />
              <meshBasicMaterial
                color={cp.color}
                transparent
                opacity={0.18}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Glowing Floor Ring */}
            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[cp.radius * 0.7, cp.radius * 0.95, 24]} />
              <meshStandardMaterial
                color={cp.color}
                emissive={cp.color}
                emissiveIntensity={2.0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {/* ======================================================== */}
      {/* FAR BELOW GROUND ABYSS & NEON GRID                       */}
      {/* ======================================================== */}
      <group position={[0, -6, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial color="#050512" roughness={0.9} />
        </mesh>
        <gridHelper args={[160, 40, "#6366f1", "#1e1b4b"]} position={[0, 0.05, 0]} />
      </group>
    </group>
  );
}
