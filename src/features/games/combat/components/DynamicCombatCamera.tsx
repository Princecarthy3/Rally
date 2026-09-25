"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { FighterTransform } from "../types";

export function DynamicCombatCamera({
  fighters,
}: {
  fighters: FighterTransform[];
}) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 10, 15));
  const currentTarget = useRef(new THREE.Vector3(0, 1.2, 0));

  useFrame((_, delta) => {
    const activeFighters = fighters.filter((f) => !f.isEliminated && f.hp > 0);
    const pool = activeFighters.length > 0 ? activeFighters : fighters;

    if (pool.length === 0) return;

    // Calculate center of mass of active fighters
    let centerX = 0;
    let centerZ = 0;
    let minX = pool[0].position[0];
    let maxX = pool[0].position[0];
    let minZ = pool[0].position[2];
    let maxZ = pool[0].position[2];

    pool.forEach((f) => {
      centerX += f.position[0];
      centerZ += f.position[2];
      minX = Math.min(minX, f.position[0]);
      maxX = Math.max(maxX, f.position[0]);
      minZ = Math.min(minZ, f.position[2]);
      maxZ = Math.max(maxZ, f.position[2]);
    });

    centerX /= pool.length;
    centerZ /= pool.length;

    // Calculate maximum spread across X & Z axes
    const spreadX = maxX - minX;
    const spreadZ = maxZ - minZ;
    const maxSpread = Math.max(spreadX, spreadZ);

    // Dynamic camera distance zoom
    const desiredDistance = Math.min(22, Math.max(9, 8 + maxSpread * 0.75));
    const targetCamX = centerX;
    const targetCamY = desiredDistance * 0.6;
    const targetCamZ = centerZ + desiredDistance * 0.85;

    const desiredCamPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);
    const desiredTargetPos = new THREE.Vector3(centerX, 1.2, centerZ);

    // Smooth interpolation
    currentPos.current.lerp(desiredCamPos, delta * 4.5);
    currentTarget.current.lerp(desiredTargetPos, delta * 4.5);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
}
