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
        <meshStandardMaterial color="#c9c9bb" roughness={0.88} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[13.6, 13.9, 0.32, 48]} />
        <meshStandardMaterial color="#52666a" roughness={0.66} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[12.9, 13.05, 64]} />
        <meshStandardMaterial color="#f5a942" emissive="#b45a16" emissiveIntensity={0.18} metalness={0.45} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 32]} />
        <meshStandardMaterial color="#8eaaa0" roughness={0.78} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.05, 3.12, 48]} />
        <meshStandardMaterial color="#f7bf59" emissive="#a3551f" emissiveIntensity={0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* Painted competition markings and the warm-up ring */}
      <mesh position={[0, 0.255, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.1, 8.2, 64]} />
        <meshBasicMaterial color="#eaf4dd" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.255, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[12.5, 12.57, 64]} />
        <meshBasicMaterial color="#ed8558" transparent opacity={0.88} side={THREE.DoubleSide} />
      </mesh>

      {/* Safety posts and practical floodlights */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const x = Math.cos(angle) * 13.35;
        const z = Math.sin(angle) * 13.35;
        return (
          <group key={i} position={[x, 1.25, z]}>
            <mesh castShadow><cylinderGeometry args={[0.18, 0.24, 2.5, 12]} /><meshStandardMaterial color="#52666a" metalness={0.6} roughness={0.38} /></mesh>
            <mesh position={[0, 1.3, 0]}><sphereGeometry args={[0.18, 12, 12]} /><meshStandardMaterial color="#fff0b5" emissive="#eca942" emissiveIntensity={0.35} /></mesh>
          </group>
        );
      })}

      {/* Sunlit city skyline behind the open rooftop arena */}
      {cityBuildings.map((b) => (
        <group key={b.id} position={b.position}>
          <mesh castShadow><boxGeometry args={b.args} /><meshStandardMaterial color={b.id % 3 === 0 ? "#9caeb0" : "#78939a"} roughness={0.86} metalness={0.08} /></mesh>
          <mesh position={[0, 0, b.args[2] / 2 + 0.02]}><planeGeometry args={[b.args[0] * 0.7, b.args[1] * 0.55]} /><meshStandardMaterial color="#f4d99e" emissive="#bf8b45" emissiveIntensity={0.12} /></mesh>
        </group>
      ))}
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[65, 64]} /><meshStandardMaterial color="#86b9c3" roughness={1} />
      </mesh>
    </group>
  );
}
