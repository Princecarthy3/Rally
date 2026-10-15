"use client";
/* eslint-disable react-hooks/immutability */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { HexRunnerTransform } from "../types";

/**
 * Chase camera for the long hex runway:
 * - sits behind the runner along the path
 * - elevates on falls so you still see the strip ahead
 */
export function HexCamera({
  runners,
  spectateSeat,
}: {
  runners: Record<number, HexRunnerTransform>;
  spectateSeat: number;
}) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 22, -8));
  const currentTarget = useRef(new THREE.Vector3(0, 18, 8));
  const smoothedYaw = useRef(0);

  useFrame((_, delta) => {
    let target = runners[spectateSeat];

    if (!target || target.isEliminated) {
      const alive = Object.values(runners).filter((r) => !r.isEliminated);
      if (alive.length > 0) target = alive[0];
    }

    if (!target) {
      currentPos.current.lerp(new THREE.Vector3(0, 20, 10), Math.min(1, delta * 2));
      currentTarget.current.lerp(new THREE.Vector3(0, 8, 25), Math.min(1, delta * 2));
      camera.position.copy(currentPos.current);
      camera.lookAt(currentTarget.current);
      return;
    }

    const [px, py, pz] = target.position;
    const [vx, vy, vz] = target.velocity;
    const falling = !target.isGrounded && vy < -1;
    const speed = Math.hypot(vx, vz);

    // Prefer facing; when moving, blend toward velocity direction
    let desiredYaw = target.rotationY;
    if (speed > 0.6) {
      desiredYaw = Math.atan2(vx, vz);
    }
    let diff = desiredYaw - smoothedYaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    smoothedYaw.current += diff * Math.min(1, delta * 4.5);

    const yaw = smoothedYaw.current;
    const backDist = falling ? 13 : 9.5 + Math.min(2, speed * 0.18);
    const height = falling ? 9 : 6.2 + target.currentFloor * 0.25;

    const camX = px - Math.sin(yaw) * backDist;
    const camZ = pz - Math.cos(yaw) * backDist;
    const camY = Math.max(-1, py + height);

    // Look ahead down the path
    const lookX = px + Math.sin(yaw) * 3.5;
    const lookY = py + 1.15 + (falling ? -0.3 : 0.2);
    const lookZ = pz + Math.cos(yaw) * 3.5;

    const rate = falling ? 5 : 8;
    currentPos.current.lerp(new THREE.Vector3(camX, camY, camZ), Math.min(1, delta * rate));
    currentTarget.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1, delta * 10));

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = falling ? 64 : 54 + Math.min(7, speed * 0.5);
      camera.fov = THREE.MathUtils.lerp(camera.fov, fov, Math.min(1, delta * 4));
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
