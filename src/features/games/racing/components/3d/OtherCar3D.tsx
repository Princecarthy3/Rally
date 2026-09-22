"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

export function OtherCar3D({
  position,
  rotation,
  displayName,
  seatColor = "#77dce7",
  seatNumber = 2
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  displayName: string;
  seatColor?: string;
  seatNumber?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetRot = useRef(new THREE.Euler(...rotation));

  // Keep target refs synchronized
  targetPos.current.set(...position);
  targetRot.current.set(...rotation);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth network position interpolation (lerp)
    groupRef.current.position.lerp(targetPos.current, Math.min(1, delta * 18));
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRot.current.y,
      Math.min(1, delta * 18)
    );
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Floating 3D Name Tag */}
      <Html position={[0, 2.2, 0]} center distanceFactor={14}>
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-900/90 px-3 py-1 text-xs font-black text-white shadow-lg backdrop-blur-md">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-slate-950"
            style={{ backgroundColor: seatColor }}
          >
            P{seatNumber}
          </span>
          <span>{displayName}</span>
        </div>
      </Html>

      {/* Car Body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.7, 0.55, 3.2]} />
        <meshStandardMaterial color={seatColor} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Cabin Roof */}
      <mesh position={[0, 0.85, -0.2]} castShadow>
        <boxGeometry args={[1.3, 0.48, 1.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Wheels */}
      <mesh position={[-0.92, 0.25, 0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.92, 0.25, 0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[-0.92, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0.92, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}
