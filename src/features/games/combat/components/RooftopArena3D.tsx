"use client";

import { useMemo } from "react";
import * as THREE from "three";

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function RooftopArena3D() {
  const cityBuildings = useMemo(() => {
    const list = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 32 + pseudoRandom(i * 1.1) * 15;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = 12 + pseudoRandom(i * 2.3) * 25;
      const width = 6 + pseudoRandom(i * 3.7) * 6;
      list.push({ id: i, position: [x, height / 2 - 10, z] as [number, number, number], args: [width, height, width] as [number, number, number] });
    }
    return list;
  }, []);

  return (
    <group>
      {/* Concrete rooftop and a raised steel combat deck */}
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <cylinderGeometry args={[15, 15.5, 1.2, 48]} />
        <meshStandardMaterial color="#77736b" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[13.6, 13.9, 0.32, 48]} />
        <meshStandardMaterial color="#343a3d" roughness={0.7} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[12.9, 13.05, 64]} />
        <meshStandardMaterial color="#d7a84b" emissive="#8a5d17" emissiveIntensity={0.35} metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 32]} />
        <meshStandardMaterial color="#24292b" roughness={0.65} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.05, 3.12, 48]} />
        <meshStandardMaterial color="#c48a36" emissive="#8a5d17" emissiveIntensity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Safety posts and practical floodlights */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const x = Math.cos(angle) * 13.35;
        const z = Math.sin(angle) * 13.35;
        return (
          <group key={i} position={[x, 1.25, z]}>
            <mesh castShadow><cylinderGeometry args={[0.18, 0.24, 2.5, 12]} /><meshStandardMaterial color="#24282a" metalness={0.85} roughness={0.3} /></mesh>
            <mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.18, 12, 12]} /><meshStandardMaterial color="#f2c45c" emissive="#b26c18" emissiveIntensity={1.2} /></mesh>
          </group>
        );
      })}

      {/* Warm city skyline instead of an empty neon void */}
      {cityBuildings.map((b) => (
        <group key={b.id} position={b.position}>
          <mesh castShadow><boxGeometry args={b.args} /><meshStandardMaterial color={b.id % 3 === 0 ? "#5b5148" : "#3d4546"} roughness={0.86} metalness={0.12} /></mesh>
          <mesh position={[0, 0, b.args[2] / 2 + 0.02]}><planeGeometry args={[b.args[0] * 0.7, b.args[1] * 0.55]} /><meshStandardMaterial color="#d4a94d" emissive="#8f5f1b" emissiveIntensity={0.45} /></mesh>
        </group>
      ))}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[65, 64]} /><meshStandardMaterial color="#1d2525" roughness={1} />
      </mesh>
    </group>
  );
}
