"use client";

import { Sky, Sparkles, Text } from "@react-three/drei";
import { memo, useMemo } from "react";
import * as THREE from "three";
import { CHECKPOINTS, getTerrainHeight, TRACK_WAYPOINTS } from "../../track-data";

const STAGE_SIZE = 320;
const TERRAIN_SEGMENTS = 96;
const ROAD_HALF_WIDTH = 7.2;

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
    // A PlaneGeometry is rotated onto XZ below; its local Z becomes world height.
    positions.setZ(index, getTerrainHeight(x, z) - 0.12);
    const shade = 0.82 + pseudoRandom(index + 90) * 0.18;
    color.setRGB(0.19 * shade, 0.42 * shade, 0.15 * shade);
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
  return curve.getPoints(300).slice(0, -1).map(point => ({ x: point.x, z: point.z }));
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
      vertices.push(x, getTerrainHeight(x, z) + 0.025, z);
    }
  }
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    const left = index * 2;
    const right = left + 1;
    const nextLeft = next * 2;
    const nextRight = nextLeft + 1;
    // Winding must face upward; otherwise Three.js culls the road from the chase camera.
    indices.push(left, right, nextLeft, right, nextRight, nextLeft);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createEdgeStripeGeometry(innerWidth: number, outerWidth: number) {
  const points = getTrackSamples();
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const direction = new THREE.Vector2(next.x - previous.x, next.z - previous.z).normalize();
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    for (const side of [-1, 1]) for (const width of [innerWidth, outerWidth]) {
      const x = current.x + perpendicular.x * width * side;
      const z = current.z + perpendicular.y * width * side;
      vertices.push(x, getTerrainHeight(x, z) + 0.065, z);
    }
  }
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    for (let side = 0; side < 2; side += 1) {
      const current = index * 4 + side * 2;
      const following = next * 4 + side * 2;
      if (side === 0) {
        indices.push(current, following, current + 1, current + 1, following, following + 1);
      } else {
        indices.push(current, current + 1, following, current + 1, following + 1, following);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const RallyStage3D = memo(function RallyStage3D({ activeCheckpoint = 0 }: { activeCheckpoint?: number }) {
  const terrainGeometry = useMemo(createTerrainGeometry, []);
  const shoulderGeometry = useMemo(() => createRoadGeometry(ROAD_HALF_WIDTH + 1.15), []);
  const roadGeometry = useMemo(() => createRoadGeometry(ROAD_HALF_WIDTH), []);
  const edgeStripeGeometry = useMemo(() => createEdgeStripeGeometry(ROAD_HALF_WIDTH - 0.22, ROAD_HALF_WIDTH), []);
  const gridMarkers = useMemo(() => {
    const points = getTrackSamples();
    return Array.from({ length: 10 }, (_, index) => {
      const point = points[index * 2];
      const next = points[(index * 2 + 1) % points.length];
      return { x: point.x, z: point.z, yaw: Math.atan2(next.x - point.x, next.z - point.z), side: index % 2 === 0 ? -2.9 : 2.9 };
    });
  }, []);
  const forestTrees = useMemo(() => {
    const trees: Array<{ x: number; z: number; scale: number; rotation: number }> = [];
    let seed = 1;
    for (let x = -145; x <= 145; x += 11) for (let z = -145; z <= 145; z += 11) {
      const nearest = Math.min(...TRACK_WAYPOINTS.map(([trackX, , trackZ]) => Math.hypot(x - trackX, z - trackZ)));
      if (nearest > 16 && pseudoRandom(seed++) > 0.42) trees.push({ x: x + (pseudoRandom(seed++) - 0.5) * 5, z: z + (pseudoRandom(seed++) - 0.5) * 5, scale: 0.72 + pseudoRandom(seed++) * 0.72, rotation: pseudoRandom(seed++) * Math.PI * 2 });
    }
    return trees;
  }, []);
  const rocks = useMemo(() => Array.from({ length: 72 }, (_, index) => {
    const angle = pseudoRandom(index + 5000) * Math.PI * 2;
    const radius = 24 + pseudoRandom(index + 7000) * 118;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, scale: 0.45 + pseudoRandom(index + 9000) * 1.25 };
  }), []);

  return <group>
    <color attach="background" args={["#82b9dc"]} />
    <fog attach="fog" args={["#b7d4df", 70, 205]} />
    <Sky distance={450000} sunPosition={[90, 70, -80]} inclination={0.52} azimuth={0.18} />
    <hemisphereLight args={["#d9f3ff", "#31421b", 2.1]} />
    <directionalLight position={[60, 90, 35]} intensity={2.8} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-110} shadow-camera-right={110} shadow-camera-top={110} shadow-camera-bottom={-110} />
    <mesh geometry={terrainGeometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><meshStandardMaterial vertexColors roughness={0.98} /></mesh>
    {/* A wide, high-contrast Grand Prix surface keeps the racing line clear. */}
    <mesh geometry={shoulderGeometry} receiveShadow><meshStandardMaterial color="#b99a66" roughness={1} /></mesh>
    <mesh geometry={roadGeometry} receiveShadow><meshStandardMaterial color="#252b31" roughness={0.88} metalness={0.06} /></mesh>
    <mesh geometry={edgeStripeGeometry}><meshStandardMaterial color="#f8fafc" roughness={0.7} /></mesh>
    {gridMarkers.map((marker, index) => {
      const x = marker.x + Math.cos(marker.yaw) * marker.side;
      const z = marker.z - Math.sin(marker.yaw) * marker.side;
      return <mesh key={index} position={[x, getTerrainHeight(x, z) + 0.09, z]} rotation={[0, marker.yaw, 0]}>
      <boxGeometry args={[1.35, 0.035, 3.4]} />
      <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>;
    })}

    {forestTrees.map((tree, index) => <group key={index} position={[tree.x, getTerrainHeight(tree.x, tree.z), tree.z]} scale={tree.scale} rotation={[0, tree.rotation, 0]}>
      <mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[0.22, 0.38, 2.6, 7]} /><meshStandardMaterial color="#5a351e" roughness={1} /></mesh>
      <mesh position={[0, 3.25, 0]} castShadow><coneGeometry args={[2.1, 3.8, 7]} /><meshStandardMaterial color={index % 3 === 0 ? "#1e5a34" : "#276b39"} flatShading /></mesh>
      <mesh position={[0, 4.8, 0]} castShadow><coneGeometry args={[1.45, 2.8, 7]} /><meshStandardMaterial color="#3b8547" flatShading /></mesh>
    </group>)}
    {rocks.map((rock, index) => <mesh key={index} position={[rock.x, getTerrainHeight(rock.x, rock.z) + rock.scale * 0.45, rock.z]} scale={rock.scale} castShadow receiveShadow><dodecahedronGeometry args={[0.95, 1]} /><meshStandardMaterial color="#7c786c" roughness={1} flatShading /></mesh>)}
    <Sparkles count={90} scale={[260, 24, 260]} size={2.5} speed={0.16} color="#fff0bf" />

    {CHECKPOINTS.map((checkpoint, index) => {
      const previous = CHECKPOINTS[(index - 1 + CHECKPOINTS.length) % CHECKPOINTS.length].position;
      const next = CHECKPOINTS[(index + 1) % CHECKPOINTS.length].position;
      const yaw = Math.atan2(next[0] - previous[0], next[2] - previous[2]);
      const isCurrent = checkpoint.index === (activeCheckpoint % CHECKPOINTS.length) + 1;
      const isFinish = checkpoint.index === CHECKPOINTS.length;
      const accent = isFinish ? "#ff4d4d" : isCurrent ? "#ffd43b" : "#20c9ff";
      return <group key={checkpoint.index} position={[checkpoint.position[0], getTerrainHeight(checkpoint.position[0], checkpoint.position[2]), checkpoint.position[2]]} rotation={[0, yaw, 0]}>
        <pointLight position={[0, 5, 2]} color={accent} intensity={isCurrent ? 8 : 3.5} distance={34} />
        <mesh position={[-8.2, 3.8, 0]} castShadow><boxGeometry args={[0.85, 7.6, 0.85]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} /></mesh>
        <mesh position={[8.2, 3.8, 0]} castShadow><boxGeometry args={[0.85, 7.6, 0.85]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} /></mesh>
        <mesh position={[0, 7.25, 0]} castShadow><boxGeometry args={[17.2, 1.35, 0.65]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isCurrent ? 1.2 : 0.5} /></mesh>
        <mesh position={[0, 3.5, 0]}><torusGeometry args={[6.1, 0.28, 12, 40]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={isCurrent ? 2.4 : 0.85} /></mesh>
        <Text position={[0, 7.25, 0.36]} fontSize={0.78} anchorX="center" anchorY="middle" color="#ffffff" outlineWidth={0.045} outlineColor="#07111f">
          {isFinish ? "FINISH" : `CHECKPOINT ${checkpoint.index}`}
        </Text>
      </group>;
    })}
  </group>;
});
