"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { CHECKPOINTS, getTerrainHeight, TRACK_WAYPOINTS } from "../../track-data";

// Deterministic pseudo-random number generator for React 19 purity compliance
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function RallyStage3D({ activeCheckpoint = 0 }: { activeCheckpoint?: number }) {
  // Generate Dirt Road Track Mesh Geometry
  const trackMeshGeometry = useMemo(() => {
    const points = TRACK_WAYPOINTS.map(p => new THREE.Vector3(p[0], p[1] + 0.05, p[2]));
    const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
    
    // Create track ribbon mesh
    const tubularSegments = 240;
    const radius = 6.5; // Track width
    const radialSegments = 8;
    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, true);
  }, []);

  // Generate Forest Trees Coordinates deterministically
  const forestTrees = useMemo(() => {
    const trees: Array<{ x: number; z: number; scale: number; rotation: number }> = [];
    let seedIndex = 1;

    for (let x = -140; x <= 140; x += 12) {
      for (let z = -140; z <= 140; z += 12) {
        let nearTrack = false;
        for (const wp of TRACK_WAYPOINTS) {
          if (Math.hypot(x - wp[0], z - wp[2]) < 11) {
            nearTrack = true;
            break;
          }
        }
        const randVal = pseudoRandom(seedIndex++);
        if (!nearTrack && randVal > 0.35) {
          trees.push({
            x: x + (pseudoRandom(seedIndex++) - 0.5) * 4,
            z: z + (pseudoRandom(seedIndex++) - 0.5) * 4,
            scale: 0.8 + pseudoRandom(seedIndex++) * 0.7,
            rotation: pseudoRandom(seedIndex++) * Math.PI * 2
          });
        }
      }
    }
    return trees;
  }, []);

  // Generate Rocks along terrain deterministically
  const rocks = useMemo(() => {
    const items: Array<{ x: number; z: number; scale: number }> = [];
    let seedIndex = 5000;

    for (let i = 0; i < 60; i++) {
      const angle = pseudoRandom(seedIndex++) * Math.PI * 2;
      const radius = 25 + pseudoRandom(seedIndex++) * 90;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      items.push({ x, z, scale: 0.7 + pseudoRandom(seedIndex++) * 1.2 });
    }
    return items;
  }, []);

  return (
    <group>
      {/* Lighting & Environment Fog */}
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[60, 80, 50]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <fog attach="fog" args={["#cce0ff", 40, 180]} />

      {/* Ground Grass Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
        <planeGeometry args={[350, 350, 64, 64]} />
        <meshStandardMaterial color="#4d8b31" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Dirt Rally Road Mesh */}
      <mesh geometry={trackMeshGeometry} receiveShadow>
        <meshStandardMaterial color="#8b5a2b" roughness={0.95} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Low-Poly Forest Trees */}
      {forestTrees.map((tree, idx) => {
        const y = getTerrainHeight(tree.x, tree.z);
        return (
          <group key={idx} position={[tree.x, y, tree.z]} scale={tree.scale} rotation={[0, tree.rotation, 0]}>
            {/* Trunk */}
            <mesh position={[0, 1.2, 0]} castShadow>
              <cylinderGeometry args={[0.3, 0.45, 2.4, 6]} />
              <meshStandardMaterial color="#4a2e18" />
            </mesh>
            {/* Foliage Layers */}
            <mesh position={[0, 3.2, 0]} castShadow>
              <coneGeometry args={[2.0, 3.5, 6]} />
              <meshStandardMaterial color="#1e5c2b" flatShading />
            </mesh>
            <mesh position={[0, 4.8, 0]} castShadow>
              <coneGeometry args={[1.5, 2.8, 6]} />
              <meshStandardMaterial color="#2d7a3e" flatShading />
            </mesh>
          </group>
        );
      })}

      {/* Terrain Rocks */}
      {rocks.map((rock, idx) => {
        const y = getTerrainHeight(rock.x, rock.z);
        return (
          <mesh key={idx} position={[rock.x, y + 0.4, rock.z]} scale={rock.scale} castShadow>
            <dodecahedronGeometry args={[1.2, 1]} />
            <meshStandardMaterial color="#6b7280" roughness={0.8} flatShading />
          </mesh>
        );
      })}

      {/* Start Arch & Checkpoint Rings */}
      {CHECKPOINTS.map((cp) => {
        const isCurrent = cp.index === (activeCheckpoint % CHECKPOINTS.length) + 1;
        const isFinish = cp.index === CHECKPOINTS.length;

        return (
          <group key={cp.index} position={cp.position}>
            {/* Arch Pillars */}
            <mesh position={[-6, 3, 0]} castShadow>
              <boxGeometry args={[0.8, 6, 0.8]} />
              <meshStandardMaterial color={isFinish ? "#ef4444" : "#3b82f6"} />
            </mesh>
            <mesh position={[6, 3, 0]} castShadow>
              <boxGeometry args={[0.8, 6, 0.8]} />
              <meshStandardMaterial color={isFinish ? "#ef4444" : "#3b82f6"} />
            </mesh>

            {/* Arch Banner */}
            <mesh position={[0, 5.8, 0]}>
              <boxGeometry args={[12.8, 1.2, 0.4]} />
              <meshStandardMaterial color={isFinish ? "#dc2626" : isCurrent ? "#10b981" : "#2563eb"} />
            </mesh>

            {/* Illuminated Checkpoint Ring */}
            <mesh position={[0, 2.5, 0]} rotation={[0, 0, 0]}>
              <torusGeometry args={[cp.radius * 0.45, 0.25, 12, 32]} />
              <meshStandardMaterial
                color={isFinish ? "#ff4d4d" : isCurrent ? "#34d399" : "#60a5fa"}
                emissive={isCurrent ? "#10b981" : "#1d4ed8"}
                emissiveIntensity={isCurrent ? 0.8 : 0.2}
                transparent
                opacity={0.8}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
