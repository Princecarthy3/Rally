"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { HexRunnerTransform } from "../types";

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

  useFrame((state, delta) => {
    // Find target runner
    let target = runners[spectateSeat];

    // If spectated runner is eliminated, find another alive runner
    if (!target || target.isEliminated) {
      const aliveRunners = Object.values(runners).filter((r) => !r.isEliminated);
      if (aliveRunners.length > 0) {
        // Pick one on lowest or highest floor
        target = aliveRunners[0];
      }
    }

    if (!target) {
      // General overview camera if all eliminated
      const t = state.clock.elapsedTime * 0.15;
      const desiredPos = new THREE.Vector3(Math.cos(t) * 22, 16, Math.sin(t) * 22);
      currentPos.current.lerp(desiredPos, delta * 3);
      currentTarget.current.lerp(new THREE.Vector3(0, 6, 0), delta * 3);
      camera.position.copy(currentPos.current);
      camera.lookAt(currentTarget.current);
      return;
    }

    const [px, py, pz] = target.position;

    // Follow target from behind and slightly elevated
    const targetY = py + 1.2;
    const camY = Math.max(-2, py + 6.5);
    const camZ = pz + 9.0;
    const camX = px;

    const desiredCamPos = new THREE.Vector3(camX, camY, camZ);
    const desiredTargetPos = new THREE.Vector3(px, targetY, pz);

    currentPos.current.lerp(desiredCamPos, delta * 6.5);
    currentTarget.current.lerp(desiredTargetPos, delta * 6.5);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
}
