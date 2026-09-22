"use client";

import { Sky } from "@react-three/drei";
import { memo, useMemo } from "react";
import * as THREE from "three";
import { CHECKPOINTS, getTerrainHeight, TRACK_WAYPOINTS } from "../../track-data";

const STAGE_SIZE = 320;
const TERRAIN_SEGMENTS = 80;
const ROAD_HALF_WIDTH = 7.5;
const BARRIER_OFFSET = 8.4;

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function createTerrainGeometry() {
  const geometry = new THREE.PlaneGeometry(STAGE_SIZE, STAGE_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  const positions = geometry.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = -positions.getY(index);
    positions.setZ(index, getTerrainHeight(x, z) - 0.14);
    const shade = 0.82 + pseudoRandom(index + 90) * 0.18;
    color.setRGB(0.18 * shade, 0.4 * shade, 0.14 * shade);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function getTrackSamples() {
  const samplesPerSegment = 16;
  const points: Array<{ x: number; z: number; yaw: number }> = [];
  for (let index = 0; index < TRACK_WAYPOINTS.length; index += 1) {
    const start = TRACK_WAYPOINTS[index];
    const end = TRACK_WAYPOINTS[(index + 1) % TRACK_WAYPOINTS.length];
    for (let sample = 0; sample < samplesPerSegment; sample += 1) {
      const progress = sample / samplesPerSegment;
      const x = THREE.MathUtils.lerp(start[0], end[0], progress);
      const z = THREE.MathUtils.lerp(start[2], end[2], progress);
      const yaw = Math.atan2(end[0] - start[0], end[2] - start[2]);
      points.push({ x, z, yaw });
    }
  }
  return points;
}

function createRibbonGeometry(halfWidth: number, yOffset = 0.03) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
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
      vertices.push(x, getTerrainHeight(x, z) + yOffset, z);
      uvs.push(side < 0 ? 0 : 1, index / points.length);
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
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCenterLineGeometry() {
  const points = getTrackSamples();
  const vertices: number[] = [];
  const indices: number[] = [];
  const half = 0.18;
  for (let index = 0; index < points.length; index += 2) {
    // dashed: skip every other sample pair
    if ((index / 2) % 2 === 1) continue;
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const direction = new THREE.Vector2(next.x - current.x, next.z - current.z).normalize();
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    const segs = [
      [current.x + perpendicular.x * half, current.z + perpendicular.y * half],
      [current.x - perpendicular.x * half, current.z - perpendicular.y * half],
      [next.x + perpendicular.x * half, next.z + perpendicular.y * half],
      [next.x - perpendicular.x * half, next.z - perpendicular.y * half],
    ];
    const base = vertices.length / 3;
    for (const [x, z] of segs) {
      vertices.push(x, getTerrainHeight(x, z) + 0.06, z);
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Armco / concrete barriers along both edges of the asphalt. */
function BarrierRails() {
  const points = useMemo(() => getTrackSamples(), []);
  const posts = useMemo(() => {
    const list: Array<{ x: number; z: number; yaw: number; side: number; stripe: boolean }> = [];
    for (let i = 0; i < points.length; i += 2) {
      const previous = points[(i - 1 + points.length) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const direction = new THREE.Vector2(next.x - previous.x, next.z - previous.z).normalize();
      const perpendicular = new THREE.Vector2(-direction.y, direction.x);
      const yaw = Math.atan2(direction.x, direction.y);
      for (const side of [-1, 1]) {
        const x = current.x + perpendicular.x * BARRIER_OFFSET * side;
        const z = current.z + perpendicular.y * BARRIER_OFFSET * side;
        list.push({ x, z, yaw, side, stripe: (i / 2) % 2 === 0 });
      }
    }
    return list;
  }, [points]);

  const railMeshes = useMemo(() => {
    // Build continuous rail segments per side
    const segments: Array<{ start: THREE.Vector3; end: THREE.Vector3; color: string }> = [];
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const prevA = points[(i - 1 + points.length) % points.length];
        const nextB = points[(i + 2) % points.length];
        const dirA = new THREE.Vector2(b.x - prevA.x, b.z - prevA.z).normalize();
        const dirB = new THREE.Vector2(nextB.x - a.x, nextB.z - a.z).normalize();
        const perpA = new THREE.Vector2(-dirA.y, dirA.x);
        const perpB = new THREE.Vector2(-dirB.y, dirB.x);
        const ax = a.x + perpA.x * BARRIER_OFFSET * side;
        const az = a.z + perpA.y * BARRIER_OFFSET * side;
        const bx = b.x + perpB.x * BARRIER_OFFSET * side;
        const bz = b.z + perpB.y * BARRIER_OFFSET * side;
        const ay = getTerrainHeight(ax, az) + 0.55;
        const by = getTerrainHeight(bx, bz) + 0.55;
        segments.push({
          start: new THREE.Vector3(ax, ay, az),
          end: new THREE.Vector3(bx, by, bz),
          color: i % 2 === 0 ? "#f8fafc" : "#dc2626",
        });
      }
    }
    return segments;
  }, [points]);

  return (
    <group>
      {railMeshes.map((seg, index) => {
        const mid = seg.start.clone().lerp(seg.end, 0.5);
        const len = seg.start.distanceTo(seg.end);
        const dir = seg.end.clone().sub(seg.start).normalize();
        const yaw = Math.atan2(dir.x, dir.z);
        const pitch = Math.asin(dir.y);
        return (
          <mesh key={index} position={[mid.x, mid.y, mid.z]} rotation={[pitch, yaw, 0]}>
            <boxGeometry args={[0.35, 0.7, Math.max(0.4, len)]} />
            <meshStandardMaterial color={seg.color} roughness={0.55} metalness={0.25} />
          </mesh>
        );
      })}
      {posts.map((post, index) => (
        <mesh
          key={`p-${index}`}
          position={[post.x, getTerrainHeight(post.x, post.z) + 0.35, post.z]}
          rotation={[0, post.yaw, 0]}
        >
          <boxGeometry args={[0.28, 0.7, 0.28]} />
          <meshStandardMaterial color={post.stripe ? "#f8fafc" : "#1e293b"} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export const RallyStage3D = memo(function RallyStage3D({ activeCheckpoint = 0 }: { activeCheckpoint?: number }) {
  const terrainGeometry = useMemo(() => createTerrainGeometry(), []);
  const shoulderGeometry = useMemo(() => createRibbonGeometry(ROAD_HALF_WIDTH + 1.4, 0.02), []);
  const roadGeometry = useMemo(() => createRibbonGeometry(ROAD_HALF_WIDTH, 0.04), []);
  const curbGeometry = useMemo(() => createRibbonGeometry(ROAD_HALF_WIDTH + 0.55, 0.055), []);
  const centerLineGeometry = useMemo(() => createCenterLineGeometry(), []);

  const forestTrees = useMemo(() => {
    const trees: Array<{ x: number; z: number; scale: number; rotation: number }> = [];
    let seed = 1;
    for (let x = -145; x <= 145; x += 12) {
      for (let z = -145; z <= 145; z += 12) {
        const nearest = Math.min(...TRACK_WAYPOINTS.map(([trackX, , trackZ]) => Math.hypot(x - trackX, z - trackZ)));
        if (nearest > 18 && pseudoRandom(seed++) > 0.45) {
          trees.push({
            x: x + (pseudoRandom(seed++) - 0.5) * 5,
            z: z + (pseudoRandom(seed++) - 0.5) * 5,
            scale: 0.72 + pseudoRandom(seed++) * 0.72,
            rotation: pseudoRandom(seed++) * Math.PI * 2,
          });
        }
      }
    }
    return trees;
  }, []);

  return (
    <group>
      <color attach="background" args={["#6eb6e0"]} />
      <fog attach="fog" args={["#a8cfe0", 80, 210]} />
      <Sky distance={450000} sunPosition={[90, 70, -80]} inclination={0.52} azimuth={0.18} />
      <hemisphereLight args={["#d9f3ff", "#31421b", 2.1]} />
      <directionalLight
        position={[60, 90, 35]}
        intensity={2.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
      />

      <mesh geometry={terrainGeometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.98} />
      </mesh>

      {/* Gravel shoulder */}
      <mesh geometry={shoulderGeometry} receiveShadow>
        <meshStandardMaterial color="#9ca3af" roughness={1} />
      </mesh>
      {/* Red/white curb underlay */}
      <mesh geometry={curbGeometry} receiveShadow>
        <meshStandardMaterial color="#e11d48" roughness={0.85} />
      </mesh>
      {/* Main asphalt */}
      <mesh geometry={roadGeometry} receiveShadow>
        <meshStandardMaterial color="#1f2937" roughness={0.82} metalness={0.08} />
      </mesh>
      {/* Dashed center line */}
      <mesh geometry={centerLineGeometry}>
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>

      <BarrierRails />

      {CHECKPOINTS.map((cp) => {
        const active = cp.index === activeCheckpoint + 1 || (activeCheckpoint >= 5 && cp.index === 5);
        return (
          <group key={cp.index} position={[cp.position[0], getTerrainHeight(cp.position[0], cp.position[2]) + 2.2, cp.position[2]]}>
            <mesh>
              <boxGeometry args={[14, 0.35, 0.35]} />
              <meshStandardMaterial color={active ? "#fbbf24" : "#f8fafc"} emissive={active ? "#f59e0b" : "#000"} emissiveIntensity={active ? 0.4 : 0} />
            </mesh>
            <mesh position={[-6.5, -1.1, 0]}>
              <boxGeometry args={[0.35, 2.2, 0.35]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh position={[6.5, -1.1, 0]}>
              <boxGeometry args={[0.35, 2.2, 0.35]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          </group>
        );
      })}

      {forestTrees.map((tree, index) => (
        <group key={index} position={[tree.x, getTerrainHeight(tree.x, tree.z), tree.z]} scale={tree.scale} rotation={[0, tree.rotation, 0]}>
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.38, 2.6, 6]} />
            <meshStandardMaterial color="#5a351e" roughness={1} />
          </mesh>
          <mesh position={[0, 3.25, 0]} castShadow>
            <coneGeometry args={[2.1, 3.8, 6]} />
            <meshStandardMaterial color={index % 3 === 0 ? "#1e5a34" : "#276b39"} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
});
