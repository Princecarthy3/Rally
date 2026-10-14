"use client";

import { useRef, memo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HEX_RADIUS, HEX_HEIGHT, FLOOR_THEMES, TILE_DECAY_DURATION } from "../hex-math";
import type { HexTile } from "../types";

const HexTile3D = memo(function HexTile3D({
  tile,
}: {
  tile: HexTile;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const theme = FLOOR_THEMES[tile.floor] || FLOOR_THEMES[0];

  useFrame((state) => {
    if (!meshRef.current) return;

    if (tile.state === "decaying" && tile.decayStartTime) {
      const elapsed = (Date.now() - tile.decayStartTime) / 1000;
      const progress = Math.min(1, elapsed / TILE_DECAY_DURATION);

      // Jitter shake & sink
      const jitterX = (Math.sin(elapsed * 45) * 0.04) * (1 - progress);
      const jitterZ = (Math.cos(elapsed * 40) * 0.04) * (1 - progress);
      const dropY = -progress * 0.35;

      meshRef.current.position.set(tile.x + jitterX, tile.y + dropY, tile.z + jitterZ);

      // Flash & emissive ramp
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (progress > 0.6) {
          mat.color.setHex(0xff3344);
          mat.emissive.setHex(0xff5533);
        } else if (progress > 0.3) {
          mat.color.setHex(0xffaa22);
          mat.emissive.setHex(0xff8800);
        } else {
          mat.color.setHex(0xffffff);
          mat.emissive.setHex(0xffffff);
        }
        mat.emissiveIntensity = 1.0 + progress * 2.0;
        mat.opacity = Math.max(0, 1 - Math.pow(progress, 3));
      }
    } else {
      meshRef.current.position.set(tile.x, tile.y, tile.z);
    }
  });

  if (tile.state === "fallen") return null;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[tile.x, tile.y, tile.z]}
        rotation={[0, Math.PI / 6, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[HEX_RADIUS * 0.96, HEX_RADIUS * 0.94, HEX_HEIGHT, 6]} />
        <meshStandardMaterial
          color={theme.baseColor}
          emissive={theme.emissive}
          emissiveIntensity={0.35}
          roughness={0.25}
          metalness={0.4}
          transparent={tile.state === "decaying"}
        />
        {/* Glowing Rim Border on Top Face */}
        <mesh position={[0, HEX_HEIGHT / 2 + 0.01, 0]}>
          <cylinderGeometry args={[HEX_RADIUS * 0.92, HEX_RADIUS * 0.92, 0.02, 6]} />
          <meshBasicMaterial
            color={tile.state === "decaying" ? "#ffffff" : theme.rimColor}
            wireframe
            transparent
            opacity={0.8}
          />
        </mesh>
      </mesh>
    </group>
  );
});

export function HexFloorLayers3D({
  tiles,
}: {
  tiles: Record<string, HexTile>;
}) {
  return (
    <group>
      {Object.values(tiles).map((tile) => (
        <HexTile3D key={tile.id} tile={tile} />
      ))}
    </group>
  );
}
