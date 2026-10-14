"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FLOOR_HEIGHTS } from "../hex-math";

export function HexStadium3D() {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const laserGridRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Spark / starfield particles
  const particleGeo = useMemo(() => {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 12 + Math.random() * 22;
      const y = -8 + Math.random() * 32;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Neon cyan, purple, or rose
      const randColor = Math.random();
      if (randColor < 0.33) {
        colors[i * 3] = 0.22;
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 0.98;
      } else if (randColor < 0.66) {
        colors[i * 3] = 0.75;
        colors[i * 3 + 1] = 0.42;
        colors[i * 3 + 2] = 0.98;
      } else {
        colors[i * 3] = 0.98;
        colors[i * 3 + 1] = 0.35;
        colors[i * 3 + 2] = 0.52;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.y += delta * 0.08;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.05;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.02;
    }
    if (laserGridRef.current) {
      const mat = laserGridRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        const pulse = 0.6 + Math.sin(state.clock.elapsedTime * 3) * 0.3;
        mat.emissiveIntensity = pulse;
      }
    }
  });

  return (
    <group>
      {/* Background Floating Stars & Neon Sparks */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial size={0.35} vertexColors transparent opacity={0.75} sizeAttenuation />
      </points>

      {/* Outer Stadium Floating Rings */}
      <group ref={ring1Ref} position={[0, 15, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[16, 0.22, 16, 64]} />
          <meshStandardMaterial color="#0891b2" emissive="#06b6d4" emissiveIntensity={0.8} />
        </mesh>
        {/* Neon Pylon Nodes */}
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const angle = (idx / 6) * Math.PI * 2;
          return (
            <mesh key={idx} position={[Math.cos(angle) * 16, 0, Math.sin(angle) * 16]}>
              <boxGeometry args={[0.6, 2.5, 0.6]} />
              <meshStandardMaterial color="#22d3ee" emissive="#38bdf8" emissiveIntensity={1.2} />
            </mesh>
          );
        })}
      </group>

      <group ref={ring2Ref} position={[0, 5, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[18.5, 0.25, 16, 64]} />
          <meshStandardMaterial color="#7c3aed" emissive="#a855f7" emissiveIntensity={0.7} />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
          const angle = (idx / 8) * Math.PI * 2;
          return (
            <mesh key={idx} position={[Math.cos(angle) * 18.5, 0, Math.sin(angle) * 18.5]}>
              <boxGeometry args={[0.7, 3.2, 0.7]} />
              <meshStandardMaterial color="#c084fc" emissive="#d8b4fe" emissiveIntensity={1.1} />
            </mesh>
          );
        })}
      </group>

      {/* Floor Support Structural Columns in corners */}
      {[0, 1, 2, 3].map((idx) => {
        const angle = (idx / 4) * Math.PI * 2 + Math.PI / 4;
        const colRadius = 14.5;
        const colX = Math.cos(angle) * colRadius;
        const colZ = Math.sin(angle) * colRadius;
        return (
          <group key={idx} position={[colX, 9, colZ]}>
            <mesh>
              <cylinderGeometry args={[0.35, 0.45, 26, 16]} />
              <meshStandardMaterial color="#1e1b4b" roughness={0.4} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.38, 0.48, 25.8, 16]} />
              <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* Floor Depth Level Markers */}
      {FLOOR_HEIGHTS.map((y, fIndex) => (
        <group key={fIndex} position={[0, y - 0.25, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[13.2, 13.5, 48]} />
            <meshBasicMaterial
              color={fIndex === 0 ? "#06b6d4" : fIndex === 1 ? "#a855f7" : fIndex === 2 ? "#f59e0b" : "#f43f5e"}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* Bottom Elimination Abyss Laser Grid */}
      <group position={[0, -5.6, 0]}>
        <mesh ref={laserGridRef} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[70, 70]} />
          <meshStandardMaterial
            color="#4c0519"
            emissive="#f43f5e"
            emissiveIntensity={0.8}
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>
        {/* Holographic Wireframe Grid Overlay */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <planeGeometry args={[70, 70, 35, 35]} />
          <meshBasicMaterial color="#fb7185" wireframe transparent opacity={0.45} />
        </mesh>
      </group>
    </group>
  );
}
