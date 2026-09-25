"use client";

import { useMemo } from "react";
import * as THREE from "three";

export function RooftopArena3D() {
  const cityBuildings = useMemo(() => {
    const list = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const radius = 32 + Math.random() * 15;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const height = 12 + Math.random() * 25;
      const width = 6 + Math.random() * 6;
      list.push({ id: i, position: [x, height / 2 - 10, z] as [number, number, number], args: [width, height, width] as [number, number, number] });
    }
    return list;
  }, []);

  return (
    <group>
      {/* Central Combat Platform */}
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <cylinderGeometry args={[14, 14.5, 1, 32]} />
        <meshStandardMaterial color="#1a1c2e" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Inner Arena Ring Line (Neon Glow) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[12.8, 13.2, 64]} />
        <meshBasicMaterial color="#ff3366" side={THREE.DoubleSide} />
      </mesh>

      {/* Center Rally Logo Emblem */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.5, 32]} />
        <meshBasicMaterial color="#ffcc00" transparent opacity={0.3} />
      </mesh>

      {/* Neon Perimeter Barrier Posts */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.cos(angle) * 13.5;
        const z = Math.sin(angle) * 13.5;
        return (
          <group key={i} position={[x, 1.2, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.25, 0.3, 2.4, 16]} />
              <meshStandardMaterial color="#2d3748" metalness={0.8} />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
              <sphereGeometry args={[0.35, 16, 16]} />
              <meshBasicMaterial color={i % 2 === 0 ? "#ff3366" : "#00d2ff"} />
            </mesh>
          </group>
        );
      })}

      {/* Distant Futuristic City Skyline */}
      {cityBuildings.map((b) => (
        <mesh key={b.id} position={b.position}>
          <boxGeometry args={b.args} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
