"use client";
/* eslint-disable react-hooks/immutability */

import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { getTerrainHeight } from "../../track-data";

/**
 * Chase camera similar to Trigger Rally's drive cam:
 * sits behind & above the car, stays clear of terrain, FOV widens with speed.
 */
export function ChaseCamera({
  targetPos,
  targetYaw,
  speed = 0,
}: {
  targetPos: [number, number, number];
  targetYaw: number;
  speed?: number;
}) {
  const { camera } = useThree();
  const currentCamPos = useRef(
    new THREE.Vector3(targetPos[0], targetPos[1] + 3.5, targetPos[2] - 9)
  );
  const look = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const dist = 9.5;
    const height = 3.6;

    const idealX = targetPos[0] - Math.sin(targetYaw) * dist;
    const idealZ = targetPos[2] - Math.cos(targetYaw) * dist;
    const terrainY = getTerrainHeight(idealX, idealZ);
    // Keep camera above terrain (Trigger Rally CamControl terrain clamp)
    const idealY = Math.max(terrainY + 1.6, targetPos[1] + height);

    currentCamPos.current.lerp(
      new THREE.Vector3(idealX, idealY, idealZ),
      Math.min(1, delta * 6.5)
    );
    camera.position.copy(currentCamPos.current);

    look.current.set(
      targetPos[0] + Math.sin(targetYaw) * 5,
      targetPos[1] + 1.1,
      targetPos[2] + Math.cos(targetYaw) * 5
    );
    camera.lookAt(look.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = 62;
      const speedFovBonus = Math.min(16, (speed / 140) * 16);
      camera.fov = THREE.MathUtils.lerp(camera.fov, baseFov + speedFovBonus, delta * 3.5);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
