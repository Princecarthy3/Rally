"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group } from "three";

export type HitParticle = {
  id: number;
  position: [number, number, number];
  color: string;
  createdAt: number;
};

export function HitVFX({ particles }: { particles: HitParticle[] }) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    // Pulse animation
    if (groupRef.current) {
      groupRef.current.children.forEach((child) => {
        child.scale.multiplyScalar(1.05);
      });
    }
  });

  return (
    <group ref={groupRef}>
      {particles.map((p) => (
        <mesh key={p.id} position={p.position}>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshBasicMaterial color={p.color} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}
