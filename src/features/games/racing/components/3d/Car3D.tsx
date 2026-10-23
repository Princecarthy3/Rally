"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

/** Compact dirt-rally car silhouette (procedural — not Trigger Rally mesh assets). */
export function Car3D({
  position,
  rotation,
  speed = 0,
  isDrifting = false,
  color = "#c0392b",
  steerAngle = 0,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  speed?: number;
  isDrifting?: boolean;
  color?: string;
  steerAngle?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const fl = useRef<THREE.Mesh>(null);
  const fr = useRef<THREE.Mesh>(null);
  const rl = useRef<THREE.Mesh>(null);
  const rr = useRef<THREE.Mesh>(null);
  const dustRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(position[0], position[1], position[2]);
    groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);

    const wheelRot = (speed * delta * 0.18);
    if (fl.current) {
      fl.current.rotation.x += wheelRot;
      fl.current.rotation.y = steerAngle * 0.42;
    }
    if (fr.current) {
      fr.current.rotation.x += wheelRot;
      fr.current.rotation.y = steerAngle * 0.42;
    }
    if (rl.current) rl.current.rotation.x += wheelRot;
    if (rr.current) rr.current.rotation.x += wheelRot;

    if (dustRef.current) {
      dustRef.current.visible = isDrifting || Math.abs(speed) > 25;
      dustRef.current.children.forEach((child, i) => {
        const m = child as THREE.Mesh;
        m.position.y = 0.15 + Math.sin(performance.now() * 0.01 + i) * 0.08;
        m.position.z = -1.4 - i * 0.35 - (Math.abs(speed) / 200);
        const mat = m.material as THREE.MeshBasicMaterial;
        if (mat) mat.opacity = isDrifting ? 0.45 : 0.22;
      });
    }
  });

  const wheel = (ref: any, x: number, z: number) => (
    <mesh ref={ref} position={[x, 0.28, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.34, 0.34, 0.28, 14]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
    </mesh>
  );

  return (
    <group ref={groupRef}>
      {/* Lower chassis */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[1.65, 0.42, 3.35]} />
        <meshStandardMaterial color={color} roughness={0.45} metalness={0.25} />
      </mesh>
      {/* Hood slope */}
      <mesh position={[0, 0.55, 0.85]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.55, 0.2, 1.1]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.82, -0.15]} castShadow>
        <boxGeometry args={[1.35, 0.5, 1.55]} />
        <meshStandardMaterial color="#1e2430" roughness={0.25} metalness={0.55} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 0.88, 0.55]} rotation={[0.45, 0, 0]}>
        <planeGeometry args={[1.2, 0.55]} />
        <meshStandardMaterial color="#a8c0d0" transparent opacity={0.65} roughness={0.1} />
      </mesh>
      {/* Roof scoop / rear wing */}
      <mesh position={[0, 1.12, -1.35]} castShadow>
        <boxGeometry args={[1.45, 0.08, 0.5]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.55, 0.42, 1.68]}>
        <boxGeometry args={[0.28, 0.16, 0.06]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.55, 0.42, 1.68]}>
        <boxGeometry args={[0.28, 0.16, 0.06]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fef08a" emissiveIntensity={0.8} />
      </mesh>
      {/* Rally light bar */}
      <mesh position={[0, 0.72, 1.55]}>
        <boxGeometry args={[0.9, 0.12, 0.12]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#f8fafc" emissiveIntensity={0.5} />
      </mesh>

      {wheel(fl, -0.88, 1.0)}
      {wheel(fr, 0.88, 1.0)}
      {wheel(rl, -0.88, -1.0)}
      {wheel(rr, 0.88, -1.0)}

      {/* Dust cloud (Trigger Rally dust system, simplified) */}
      <group ref={dustRef} position={[0, 0.1, -1.5]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[(i % 2 === 0 ? -0.5 : 0.5), 0.2, -i * 0.4]}>
            <sphereGeometry args={[0.4 + i * 0.08, 8, 8]} />
            <meshBasicMaterial color="#c4a882" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
