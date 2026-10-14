"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { ClimberTransform } from "../types";

export function ClimberAvatar3D({
  runner,
  isLocal,
}: {
  runner: ClimberTransform;
  isLocal?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  const runnerColor = runner.color || "#8b5cf6";

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Smooth position and rotation interpolation
    if (isLocal) {
      groupRef.current.position.set(...runner.position);
      groupRef.current.rotation.y = runner.rotationY;
    } else {
      groupRef.current.position.lerp(new THREE.Vector3(...runner.position), delta * 20);
      let diff = runner.rotationY - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * delta * 20;
    }

    const t = state.clock.elapsedTime * 14;

    if (
      bodyRef.current &&
      leftLegRef.current &&
      rightLegRef.current &&
      leftArmRef.current &&
      rightArmRef.current
    ) {
      if (runner.animState === "run") {
        // Running leg swing
        leftLegRef.current.rotation.x = Math.sin(t) * 0.75;
        rightLegRef.current.rotation.x = -Math.sin(t) * 0.75;

        // Running arm swing
        leftArmRef.current.rotation.x = -Math.sin(t) * 0.65;
        rightArmRef.current.rotation.x = Math.sin(t) * 0.65;

        bodyRef.current.position.y = 0.65 + Math.abs(Math.sin(t)) * 0.08;
        bodyRef.current.rotation.x = 0.15;
      } else if (runner.animState === "jump") {
        // Jump pose: arms up, legs tuck slightly
        leftArmRef.current.rotation.x = -2.4;
        rightArmRef.current.rotation.x = -2.4;
        leftLegRef.current.rotation.x = 0.3;
        rightLegRef.current.rotation.x = -0.3;

        bodyRef.current.position.y = 0.72;
        bodyRef.current.rotation.x = -0.1;
      } else if (runner.animState === "fall") {
        // Falling flail
        leftArmRef.current.rotation.x = -2.0 + Math.sin(t * 1.5) * 0.6;
        rightArmRef.current.rotation.x = -2.0 + Math.cos(t * 1.5) * 0.6;
        leftLegRef.current.rotation.x = Math.sin(t * 1.5) * 0.5;
        rightLegRef.current.rotation.x = -Math.sin(t * 1.5) * 0.5;

        bodyRef.current.position.y = 0.65;
        bodyRef.current.rotation.x = -0.2;
      } else if (runner.animState === "celebrate") {
        // Victory cheer: bouncing and waving hands high!
        const cheerT = state.clock.elapsedTime * 8;
        bodyRef.current.position.y = 0.65 + Math.abs(Math.sin(cheerT)) * 0.25;
        leftArmRef.current.rotation.x = -2.8 + Math.sin(cheerT) * 0.4;
        rightArmRef.current.rotation.x = -2.8 - Math.sin(cheerT) * 0.4;
        leftArmRef.current.rotation.z = -0.4;
        rightArmRef.current.rotation.z = 0.4;
      } else {
        // Idle breathing
        const idleT = state.clock.elapsedTime * 3;
        bodyRef.current.position.y = 0.65 + Math.sin(idleT) * 0.02;
        bodyRef.current.rotation.x = 0;
        bodyRef.current.rotation.z = 0;
        leftLegRef.current.rotation.x = 0;
        rightLegRef.current.rotation.x = 0;
        leftArmRef.current.rotation.x = Math.sin(idleT) * 0.08;
        rightArmRef.current.rotation.x = -Math.sin(idleT) * 0.08;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Floating Overhead HTML Name Banner */}
      <Html position={[0, 1.9, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-slate-950 px-2 py-0.5 text-[11px] font-black shadow-[2px_2px_0_#0f172a] ${
            isLocal ? "bg-[#fef08a] text-slate-950" : "bg-white text-slate-900"
          }`}
        >
          <span
            className="inline-block h-2 w-2 rounded-full border border-slate-900"
            style={{ backgroundColor: runnerColor }}
          />
          <span className="max-w-[85px] truncate">
            {runner.displayName}
            {isLocal ? " (you)" : ""}
            {runner.isBot ? " [AI]" : ""}
          </span>
          {runner.hasFinished && (
            <span className="rounded bg-amber-400 px-1 py-0.2 text-[9px] font-black text-amber-950">
              🏆 #{runner.placement || 1}
            </span>
          )}
        </div>
      </Html>

      {/* Main Climber Body Group */}
      <group ref={bodyRef} position={[0, 0.65, 0]}>
        {/* Capsule Pill Body */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.36, 0.44, 16, 16]} />
          <meshStandardMaterial color={runnerColor} roughness={0.3} metalness={0.15} />
        </mesh>

        {/* Belly / Front Torso Accent */}
        <mesh position={[0, 0.05, 0.33]}>
          <circleGeometry args={[0.22, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Cyber Goggles / Visor */}
        <group position={[0, 0.22, 0.28]}>
          <mesh castShadow>
            <boxGeometry args={[0.44, 0.16, 0.18]} />
            <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.09]}>
            <planeGeometry args={[0.4, 0.12]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={1.5}
              roughness={0.1}
            />
          </mesh>
        </group>

        {/* Left Arm */}
        <mesh ref={leftArmRef} position={[-0.42, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.28, 8, 8]} />
          <meshStandardMaterial color={runnerColor} roughness={0.4} />
        </mesh>

        {/* Right Arm */}
        <mesh ref={rightArmRef} position={[0.42, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.28, 8, 8]} />
          <meshStandardMaterial color={runnerColor} roughness={0.4} />
        </mesh>
      </group>

      {/* Legs (pivot at hips) */}
      <group position={[0, 0.28, 0]}>
        {/* Left Leg */}
        <mesh ref={leftLegRef} position={[-0.16, -0.14, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.24, 8, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>

        {/* Right Leg */}
        <mesh ref={rightLegRef} position={[0.16, -0.14, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.24, 8, 8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
