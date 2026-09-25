"use client";

import { Canvas } from "@react-three/fiber";
import { ReactNode } from "react";

export function CombatCanvas({ children }: { children: ReactNode }) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 10, 15], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100vw", height: "100vh", background: "#090a12" }}
    >
      <ambientLight intensity={0.65} color="#dbeafe" />
      <directionalLight
        position={[15, 25, 10]}
        intensity={1.4}
        color="#fff5ea"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 8, 0]} intensity={2.0} color="#ff3366" distance={25} />
      <fog attach="fog" args={["#090a12", 25, 65]} />
      {children}
    </Canvas>
  );
}
