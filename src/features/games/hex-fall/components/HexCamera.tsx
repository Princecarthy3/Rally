"use client";
/* eslint-disable react-hooks/immutability */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { HexRunnerTransform } from "../types";

/**
 * Stable chase cam for the long path:
 * mostly sits behind looking down +Z, mild turn with the player.
 */
export function HexCamera({
  runners,
  spectateSeat,
}: {
  runners: Record<number, HexRunnerTransform>;
  spectateSeat: number;
}) {
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 22, -10));
  const look = useRef(new THREE.Vector3(0, 18, 12));
  const yaw = useRef(0);

  useFrame((_, delta) => {
    let target = runners[spectateSeat];
    if (!target || target.isEliminated) {
      const alive = Object.values(runners).filter((r) => !r.isEliminated);
      if (alive.length) target = alive[0];
    }

    if (!target) {
      pos.current.lerp(new THREE.Vector3(0, 18, 8), Math.min(1, delta * 2));
      look.current.lerp(new THREE.Vector3(0, 8, 20), Math.min(1, delta * 2));
      camera.position.copy(pos.current);
      camera.lookAt(look.current);
      return;
    }

    const [px, py, pz] = target.position;
    const [vx, vy, vz] = target.velocity;
    const falling = !target.isGrounded && vy < -2;
    const speed = Math.hypot(vx, vz);

    // Prefer path direction; only blend toward facing when clearly running
    let desired = 0; // default look down +Z
    if (speed > 1.2) {
      desired = Math.atan2(vx, vz);
    } else if (Math.abs(target.rotationY) > 0.01) {
      desired = target.rotationY * 0.35; // mild, not full spin
    }

    let diff = desired - yaw.current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw.current += diff * Math.min(1, delta * 2.2);

    const back = falling ? 14 : 10;
    const height = falling ? 9 : 6.5;
    const y = yaw.current;

    const camX = px - Math.sin(y) * back;
    const camZ = pz - Math.cos(y) * back;
    const camY = Math.max(1, py + height);

    const lookX = px + Math.sin(y) * 4;
    const lookZ = pz + Math.cos(y) * 6;
    const lookY = py + 1.2;

    const rate = falling ? 4 : 6;
    pos.current.lerp(new THREE.Vector3(camX, camY, camZ), Math.min(1, delta * rate));
    look.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1, delta * 8));

    camera.position.copy(pos.current);
    camera.lookAt(look.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, falling ? 62 : 54, Math.min(1, delta * 3));
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
