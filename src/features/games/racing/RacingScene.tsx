"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CHECKPOINT_INDICES, TRACK_CENTERLINE, type Vec3 } from "./track";
import type { VehicleState } from "./vehicle";

const CAR_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

function TrackMesh() {
  const points = useMemo(
    () => TRACK_CENTERLINE.map((p) => new THREE.Vector3(p[0], 0.05, p[2])),
    []
  );
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const roadGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-5, -0.5);
    shape.lineTo(5, -0.5);
    shape.lineTo(5, 0.5);
    shape.lineTo(-5, 0.5);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      steps: 80,
      bevelEnabled: false,
      extrudePath: curve,
    });
  }, [curve]);

  return (
    <group>
      <mesh geometry={roadGeo} receiveShadow>
        <meshStandardMaterial color="#8B7355" roughness={0.95} />
      </mesh>
      {/* Grass plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -190]} receiveShadow>
        <planeGeometry args={[220, 420]} />
        <meshStandardMaterial color="#3d7a3a" />
      </mesh>
      {TRACK_CENTERLINE.filter((_, i) => i % 2 === 0).map((p, i) => (
        <group key={i}>
          <mesh position={[p[0] - 14, 2, p[2]]}>
            <cylinderGeometry args={[0.4, 0.6, 4, 6]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
          <mesh position={[p[0] - 14, 5, p[2]]}>
            <sphereGeometry args={[2.2, 6, 6]} />
            <meshStandardMaterial color="#1f6b2e" />
          </mesh>
          <mesh position={[p[0] + 14, 2, p[2]]}>
            <cylinderGeometry args={[0.4, 0.6, 4, 6]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
          <mesh position={[p[0] + 14, 5, p[2]]}>
            <sphereGeometry args={[2.2, 6, 6]} />
            <meshStandardMaterial color="#1f6b2e" />
          </mesh>
        </group>
      ))}
      {CHECKPOINT_INDICES.map((idx, i) => {
        const p = TRACK_CENTERLINE[idx];
        const isFinish = i === CHECKPOINT_INDICES.length - 1;
        return (
          <mesh key={i} position={[p[0], 1.5, p[2]]}>
            <boxGeometry args={[12, 3, 0.4]} />
            <meshStandardMaterial
              color={isFinish ? "#f8fafc" : "#fbbf24"}
              transparent
              opacity={0.55}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function CarMesh({
  state,
  stateRef,
  color,
  isLocal,
}: {
  state?: VehicleState;
  stateRef?: React.MutableRefObject<VehicleState>;
  color: string;
  isLocal?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const s = stateRef?.current || state;
    if (!s) return;
    ref.current.position.set(s.x, s.y, s.z);
    ref.current.rotation.y = s.rotY;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[1.6, 0.5, 3.2]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.75, -0.2]} castShadow>
        <boxGeometry args={[1.4, 0.45, 1.6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {[
        [-0.75, 0.25, 1.0],
        [0.75, 0.25, 1.0],
        [-0.75, 0.25, -1.0],
        [0.75, 0.25, -1.0],
      ].map((pos, i) => (
        <mesh key={i} position={pos as Vec3} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.25, 10]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {isLocal && (
        <pointLight position={[0, 2, 0]} intensity={0.4} distance={12} color="#fff7ed" />
      )}
    </group>
  );
}

function ChaseCamera({ target }: { target: React.MutableRefObject<VehicleState> }) {
  const cam = useRef<THREE.PerspectiveCamera>(null);
  useFrame(() => {
    if (!cam.current) return;
    const v = target.current;
    const back = 10 + Math.min(6, Math.abs(v.speed) * 0.12);
    const height = 4.5;
    const lx = v.x - Math.sin(v.rotY) * back;
    const lz = v.z + Math.cos(v.rotY) * back;
    cam.current.position.lerp(new THREE.Vector3(lx, height, lz), 0.08);
    cam.current.lookAt(v.x, v.y + 1, v.z);
  });
  return <PerspectiveCamera ref={cam} makeDefault fov={60} near={0.5} far={500} />;
}

export type RemoteRacer = {
  seat: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  finished?: boolean;
};

export function RacingScene({
  localRef,
  remotes,
  localSeat,
}: {
  localRef: React.MutableRefObject<VehicleState>;
  remotes: RemoteRacer[];
  localSeat: number;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <color attach="background" args={["#87CEEB"]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        position={[40, 60, 20]}
        intensity={1.1}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <fog attach="fog" args={["#a8d4f0", 60, 220]} />
      <ChaseCamera target={localRef} />
      <TrackMesh />
      <CarMesh stateRef={localRef} color={CAR_COLORS[(localSeat - 1) % 4]} isLocal />
      {remotes
        .filter((r) => r.seat !== localSeat)
        .map((r) => (
          <CarMesh
            key={r.seat}
            state={{
              x: r.x,
              y: r.y,
              z: r.z,
              rotY: r.rotY,
              speed: r.speed,
              vx: 0,
              vz: 0,
            }}
            color={CAR_COLORS[(r.seat - 1) % 4]}
          />
        ))}
    </Canvas>
  );
}
