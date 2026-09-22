"use client";
/* eslint-disable react-hooks/immutability */

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { getTerrainHeight } from "../../track-data";

export function ChaseCamera({
  targetPos,
  targetYaw,
  speed = 0
}: {
  targetPos: [number, number, number];
  targetYaw: number;
  speed?: number;
}) {
  const { camera } = useThree();
  const currentCamPos = useRef(new THREE.Vector3(targetPos[0], targetPos[1] + 4, targetPos[2] - 10));

  useFrame((_, delta) => {
    // 1. Calculate ideal camera offset behind the car
    const dist = 9.5;
    const height = 4.2;

    const idealX = targetPos[0] - Math.sin(targetYaw) * dist;
    const idealZ = targetPos[2] - Math.cos(targetYaw) * dist;
    const terrainY = getTerrainHeight(idealX, idealZ);
    const idealY = Math.max(terrainY + 1.8, targetPos[1] + height);

    const targetVector = new THREE.Vector3(idealX, idealY, idealZ);

    // 2. Smooth camera position interpolation
    currentCamPos.current.lerp(targetVector, Math.min(1, delta * 7.5));
    camera.position.copy(currentCamPos.current);

    // 3. Look slightly ahead of car
    const lookAtPos = new THREE.Vector3(
      targetPos[0] + Math.sin(targetYaw) * 4,
      targetPos[1] + 1.2,
      targetPos[2] + Math.cos(targetYaw) * 4
    );
    camera.lookAt(lookAtPos);

    // 4. Speed FOV scaling (Wider field of view at high speed)
    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = 65;
      const speedFovBonus = Math.min(18, (speed / 135) * 18);
      camera.fov = THREE.MathUtils.lerp(camera.fov, baseFov + speedFovBonus, delta * 4);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
