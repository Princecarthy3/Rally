"use client";
/* eslint-disable react-hooks/immutability */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { HexRunnerTransform } from "../types";

/**
 * Dynamic chase camera for Hex Fall:
 * - sits behind the runner based on facing
 * - lifts higher as you drop floors so the arena stays readable
 * - pulls back during falls for spatial awareness
 */
export function HexCamera({
  runners,
  spectateSeat,
}: {
  runners: Record<number, HexRunnerTransform>;
  spectateSeat: number;
}) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 24, 28));
  const currentTarget = useRef(new THREE.Vector3(0, 18, 0));
  const smoothedYaw = useRef(0);

  useFrame((state, delta) => {
    let target = runners[spectateSeat];

    if (!target || target.isEliminated) {
      const aliveRunners = Object.values(runners).filter((r) => !r.isEliminated);
      if (aliveRunners.length > 0) {
        target = aliveRunners[0];
      }
    }

    if (!target) {
      const t = state.clock.elapsedTime * 0.15;
      const desiredPos = new THREE.Vector3(Math.cos(t) * 22, 16, Math.sin(t) * 22);
      currentPos.current.lerp(desiredPos, Math.min(1, delta * 3));
      currentTarget.current.lerp(new THREE.Vector3(0, 6, 0), Math.min(1, delta * 3));
      camera.position.copy(currentPos.current);
      camera.lookAt(currentTarget.current);
      return;
    }

    const [px, py, pz] = target.position;
    const [vx, vy, vz] = target.velocity;
    const falling = !target.isGrounded && vy < -1;
    const speed = Math.hypot(vx, vz);

    // Smooth yaw toward facing / movement
    let desiredYaw = target.rotationY;
    if (speed > 0.8) {
      desiredYaw = Math.atan2(vx, vz);
    }
    let diff = desiredYaw - smoothedYaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    smoothedYaw.current += diff * Math.min(1, delta * 4);

    const yaw = smoothedYaw.current;
    // Camera sits *behind* the runner
    const backDist = falling ? 12.5 : 9.2 + Math.min(2.5, speed * 0.2);
    const height = falling ? 8.5 : 5.8 + target.currentFloor * 0.35;

    const camX = px - Math.sin(yaw) * backDist;
    const camZ = pz - Math.cos(yaw) * backDist;
    const camY = Math.max(-1.5, py + height);

    const lookY = py + 1.1 + (falling ? -0.4 : 0.3);
    // Look slightly ahead in facing direction
    const lookX = px + Math.sin(yaw) * 2.2;
    const lookZ = pz + Math.cos(yaw) * 2.2;

    const followRate = falling ? 5 : 7.5;
    currentPos.current.lerp(new THREE.Vector3(camX, camY, camZ), Math.min(1, delta * followRate));
    currentTarget.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1, delta * 9));

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = falling ? 62 : 52 + Math.min(8, speed * 0.6);
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, delta * 4));
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
