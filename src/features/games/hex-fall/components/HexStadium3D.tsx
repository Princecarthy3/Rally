"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FLOOR_HEIGHTS, PATH_LENGTH_Z, PATH_WIDTH_X } from "../hex-math";

function createStadiumParticleGeo() {
  const count = 140;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const pathLen = PATH_LENGTH_Z;
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * (PATH_WIDTH_X + 18);
    positions[i * 3 + 1] = -6 + rand() * 30;
    positions[i * 3 + 2] = rand() * (pathLen + 12) - 4;

    const randColor = rand();
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
}

const STADIUM_PARTICLE_GEO = createStadiumParticleGeo();

export function HexStadium3D() {
  const particlesRef = useRef<THREE.Points>(null);
  const laserGridRef = useRef<THREE.Mesh>(null);
  const particleGeo = useMemo(() => STADIUM_PARTICLE_GEO, []);

  const pathLen = PATH_LENGTH_Z;
  const midZ = pathLen * 0.5;

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
    if (laserGridRef.current) {
      const mat = laserGridRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.55 + Math.sin(state.clock.elapsedTime * 2.4) * 0.25;
      }
    }
  });

  return (
    <group>
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial size={0.32} vertexColors transparent opacity={0.7} sizeAttenuation />
      </points>

      {/* Side neon rails along the long path */}
      {[-1, 1].map((side) => {
        const x = side * (PATH_WIDTH_X * 0.5 + 3.5);
        return (
          <group key={side}>
            <mesh position={[x, 10, midZ]}>
              <boxGeometry args={[0.35, 22, pathLen + 4]} />
              <meshStandardMaterial
                color={side < 0 ? "#0e7490" : "#6d28d9"}
                emissive={side < 0 ? "#22d3ee" : "#a855f7"}
                emissiveIntensity={0.45}
                transparent
                opacity={0.35}
              />
            </mesh>
            {/* Pylon markers along the rail */}
            {Array.from({ length: 8 }).map((_, i) => {
              const z = (i / 7) * pathLen;
              return (
                <mesh key={i} position={[x, 4 + (i % 3), z]}>
                  <boxGeometry args={[0.55, 2.2, 0.55]} />
                  <meshStandardMaterial
                    color="#38bdf8"
                    emissive="#67e8f9"
                    emissiveIntensity={1.1}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {/* Floor height rings elongated as path outlines */}
      {FLOOR_HEIGHTS.map((y, fIndex) => (
        <mesh
          key={fIndex}
          position={[0, y - 0.2, midZ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry
            args={[
              Math.max(PATH_WIDTH_X * 0.55, 4),
              Math.max(PATH_WIDTH_X * 0.55, 4) + 0.35,
              48,
            ]}
          />
          <meshBasicMaterial
            color={
              fIndex === 0 ? "#06b6d4" : fIndex === 1 ? "#a855f7" : fIndex === 2 ? "#f59e0b" : "#f43f5e"
            }
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* Abyss laser under the path */}
      <group position={[0, -5.6, midZ]}>
        <mesh ref={laserGridRef} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[PATH_WIDTH_X + 24, pathLen + 20]} />
          <meshStandardMaterial
            color="#4c0519"
            emissive="#f43f5e"
            emissiveIntensity={0.75}
            roughness={0.25}
            metalness={0.85}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <planeGeometry args={[PATH_WIDTH_X + 24, pathLen + 20, 12, 40]} />
          <meshBasicMaterial color="#fb7185" wireframe transparent opacity={0.4} />
        </mesh>
      </group>

      {/* Start / finish markers */}
      <mesh position={[0, FLOOR_HEIGHTS[0] + 0.05, 0.5]}>
        <boxGeometry args={[PATH_WIDTH_X * 0.9, 0.08, 0.4]} />
        <meshStandardMaterial color="#22d3ee" emissive="#67e8f9" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, FLOOR_HEIGHTS[0] + 0.05, pathLen - 1]}>
        <boxGeometry args={[PATH_WIDTH_X * 0.9, 0.08, 0.4]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fde68a" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}
