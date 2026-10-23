"use client";

/**
 * Visual stage styled after Trigger Rally's outdoor dirt courses:
 * arid hills, packed-dirt track, green checkpoint rings, sparse scrub & rock.
 * Assets are procedural (Trigger Rally content may not be redistributed).
 */

import { Sky, Text } from "@react-three/drei";
import { memo, useMemo } from "react";
import * as THREE from "three";
import { CHECKPOINTS, getTerrainHeight, TRACK_WAYPOINTS } from "../../track-data";

const STAGE_SIZE = 640;
const TERRAIN_SEGMENTS = 110;
const ROAD_HALF_WIDTH = 7.0;

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function createTerrainGeometry() {
  const geometry = new THREE.PlaneGeometry(STAGE_SIZE, STAGE_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  const positions = geometry.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();

  // Approximate distance to track for cutting a lighter dirt path into the heightmap
  const samples = TRACK_WAYPOINTS.map(([x, , z]) => ({ x, z }));

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = -positions.getY(index);
    let minDist = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const a = samples[i];
      const b = samples[(i + 1) % samples.length];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1;
      let t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < minDist) minDist = d;
    }

    // Cut course slightly into terrain (Trigger Rally draws circles along checkpoints)
    let h = getTerrainHeight(x, z);
    if (minDist < ROAD_HALF_WIDTH + 2.5) {
      const cut = Math.max(0, 1 - minDist / (ROAD_HALF_WIDTH + 2.5));
      h -= cut * 0.55;
    }
    positions.setZ(index, h);

    // Arid tan / olive dirt palette (not lush green)
    const shade = 0.78 + pseudoRandom(index + 17) * 0.22;
    if (minDist < ROAD_HALF_WIDTH) {
      color.setRGB(0.42 * shade, 0.34 * shade, 0.24 * shade);
    } else if (minDist < ROAD_HALF_WIDTH + 6) {
      color.setRGB(0.48 * shade, 0.4 * shade, 0.28 * shade);
    } else {
      // Dry grass / scrub
      color.setRGB(0.45 * shade, 0.48 * shade, 0.28 * shade);
    }
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function getTrackSamples() {
  const curve = new THREE.CatmullRomCurve3(
    TRACK_WAYPOINTS.map(([x, , z]) => new THREE.Vector3(x, 0, z)),
    true,
    "centripetal",
    0.35
  );
  return curve.getPoints(320).slice(0, -1).map((point) => ({ x: point.x, z: point.z }));
}

function createRoadGeometry(halfWidth: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const points = getTrackSamples();
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const direction = new THREE.Vector2(next.x - previous.x, next.z - previous.z).normalize();
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    for (const side of [-1, 1]) {
      const x = current.x + perpendicular.x * halfWidth * side;
      const z = current.z + perpendicular.y * halfWidth * side;
      vertices.push(x, getTerrainHeight(x, z) - 0.15, z);
    }
  }
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    const left = index * 2;
    const right = left + 1;
    const nextLeft = next * 2;
    const nextRight = nextLeft + 1;
    indices.push(left, right, nextLeft, right, nextRight, nextLeft);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Trigger Rally–style triple green ring checkpoint */
function CheckpointRing({
  position,
  yaw,
  active,
  isFinish,
  label,
}: {
  position: [number, number, number];
  yaw: number;
  active: boolean;
  isFinish: boolean;
  label: string;
}) {
  const color = isFinish ? "#1a5c1a" : active ? "#2f9e2f" : "#103010";
  const intensity = active ? 1.4 : 0.55;
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((zRot, i) => (
        <mesh key={i} rotation={[1.1, 0, zRot]} position={[0, 2.4, 0]}>
          <torusGeometry args={[5.4, 0.22, 10, 36]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 5.6, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 4, 0]} color={color} intensity={intensity * 4} distance={28} />
      <Text
        position={[0, 6.2, 0]}
        fontSize={0.7}
        anchorX="center"
        anchorY="middle"
        color="#e8f5e0"
        outlineWidth={0.04}
        outlineColor="#0a1a0a"
      >
        {label}
      </Text>
    </group>
  );
}

export const RallyStage3D = memo(function RallyStage3D({
  activeCheckpoint = 0,
}: {
  activeCheckpoint?: number;
}) {
  const terrainGeometry = useMemo(createTerrainGeometry, []);
  const roadGeometry = useMemo(() => createRoadGeometry(ROAD_HALF_WIDTH), []);
  const shoulderGeometry = useMemo(() => createRoadGeometry(ROAD_HALF_WIDTH + 1.8), []);

  const scrub = useMemo(() => {
    const items: Array<{ x: number; z: number; s: number; r: number }> = [];
    let seed = 3;
    for (let x = -280; x <= 280; x += 14) {
      for (let z = -280; z <= 280; z += 14) {
        const nearest = Math.min(
          ...TRACK_WAYPOINTS.map(([tx, , tz]) => Math.hypot(x - tx, z - tz))
        );
        if (nearest > 14 && pseudoRandom(seed++) > 0.55) {
          items.push({
            x: x + (pseudoRandom(seed++) - 0.5) * 6,
            z: z + (pseudoRandom(seed++) - 0.5) * 6,
            s: 0.4 + pseudoRandom(seed++) * 0.9,
            r: pseudoRandom(seed++) * Math.PI * 2,
          });
        }
      }
    }
    return items;
  }, []);

  const rocks = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => {
        const angle = pseudoRandom(index + 5000) * Math.PI * 2;
        const radius = 28 + pseudoRandom(index + 7000) * 130;
        return {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          scale: 0.4 + pseudoRandom(index + 9000) * 1.4,
        };
      }),
    []
  );

  // Marker posts along course edges (chevron-like)
  const markers = useMemo(() => {
    const points = getTrackSamples();
    const list: Array<{ x: number; z: number; yaw: number }> = [];
    for (let i = 0; i < points.length; i += 5) {
      const prev = points[(i - 1 + points.length) % points.length];
      const cur = points[i];
      const next = points[(i + 1) % points.length];
      const dir = new THREE.Vector2(next.x - prev.x, next.z - prev.z).normalize();
      const perp = new THREE.Vector2(-dir.y, dir.x);
      const yaw = Math.atan2(dir.x, dir.y);
      for (const side of [-1, 1]) {
        list.push({
          x: cur.x + perp.x * (ROAD_HALF_WIDTH + 1.6) * side,
          z: cur.z + perp.y * (ROAD_HALF_WIDTH + 1.6) * side,
          yaw,
        });
      }
    }
    return list;
  }, []);

  return (
    <group>
      {/* Clear arid sky like Trigger Rally outdoor maps */}
      <color attach="background" args={["#87b7d9"]} />
      <fog attach="fog" args={["#c5d6e0", 90, 280]} />
      <Sky
        distance={450000}
        sunPosition={[-60, 40, -90]}
        inclination={0.48}
        azimuth={0.22}
        rayleigh={0.65}
        turbidity={4.5}
        mieCoefficient={0.006}
        mieDirectionalG={0.8}
      />
      {/* Warm sun 0xffe0bb from Trigger Rally SunLight */}
      <hemisphereLight args={["#cfe8ff", "#6b5a3e", 0.85]} />
      <directionalLight
        position={[-60, 70, 100]}
        intensity={1.35}
        color="#ffe0bb"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-near={-20}
        shadow-camera-far={80}
      />
      <ambientLight intensity={0.35} color="#d8c8a8" />

      {/* Terrain */}
      <mesh geometry={terrainGeometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.98} metalness={0} />
      </mesh>

      {/* Packed dirt course */}
      <mesh geometry={shoulderGeometry} receiveShadow>
        <meshStandardMaterial color="#6e5a42" roughness={1} />
      </mesh>
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial color="#5a4632" roughness={0.97} />
      </mesh>

      {/* Sparse dry scrub instead of pine forest */}
      {scrub.map((s, index) => (
        <group
          key={`scrub-${index}`}
          position={[s.x, getTerrainHeight(s.x, s.z), s.z]}
          scale={s.s}
          rotation={[0, s.r, 0]}
        >
          <mesh position={[0, 0.35, 0]} castShadow>
            <sphereGeometry args={[0.55, 6, 5]} />
            <meshStandardMaterial color="#6a7a3a" roughness={1} flatShading />
          </mesh>
          <mesh position={[0.25, 0.45, 0.15]} castShadow>
            <sphereGeometry args={[0.35, 5, 4]} />
            <meshStandardMaterial color="#5a6a32" roughness={1} flatShading />
          </mesh>
        </group>
      ))}

      {rocks.map((rock, index) => (
        <mesh
          key={`rock-${index}`}
          position={[rock.x, getTerrainHeight(rock.x, rock.z) + rock.scale * 0.4, rock.z]}
          scale={rock.scale}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[0.9, 0]} />
          <meshStandardMaterial color="#8a8070" roughness={1} flatShading />
        </mesh>
      ))}

      {/* Course edge posts */}
      {markers.map((m, index) => (
        <group
          key={`mk-${index}`}
          position={[m.x, getTerrainHeight(m.x, m.z), m.z]}
          rotation={[0, m.yaw, 0]}
        >
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[0.22, 1.4, 0.22]} />
            <meshStandardMaterial color={index % 2 === 0 ? "#c2410c" : "#f1f5f9"} />
          </mesh>
        </group>
      ))}

      {/* Trigger Rally–style green checkpoint rings */}
      {CHECKPOINTS.map((checkpoint, index) => {
        const previous = CHECKPOINTS[(index - 1 + CHECKPOINTS.length) % CHECKPOINTS.length].position;
        const next = CHECKPOINTS[(index + 1) % CHECKPOINTS.length].position;
        const yaw = Math.atan2(next[0] - previous[0], next[2] - previous[2]);
        const isCurrent = checkpoint.index === (activeCheckpoint % CHECKPOINTS.length) + 1;
        const isFinish = checkpoint.index === CHECKPOINTS.length;
        const y = getTerrainHeight(checkpoint.position[0], checkpoint.position[2]);
        return (
          <CheckpointRing
            key={checkpoint.index}
            position={[checkpoint.position[0], y, checkpoint.position[2]]}
            yaw={yaw}
            active={isCurrent}
            isFinish={isFinish}
            label={isFinish ? "FINISH" : `CP ${checkpoint.index}`}
          />
        );
      })}
    </group>
  );
});
