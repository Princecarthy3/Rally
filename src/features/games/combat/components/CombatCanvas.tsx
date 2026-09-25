"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

export function CombatCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 h-full w-full bg-[#090a12]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 10, 15], fov: 50 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        className="h-full w-full touch-none"
        style={{ width: "100%", height: "100%", display: "block", background: "#090a12" }}
      >
        <ambientLight intensity={0.7} color="#dbeafe" />
        <directionalLight
          position={[15, 25, 10]}
          intensity={1.35}
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
        <pointLight position={[0, 8, 0]} intensity={1.6} color="#ff3366" distance={28} />
        <hemisphereLight args={["#bfdbfe", "#1e1b4b", 0.45]} />
        <fog attach="fog" args={["#090a12", 22, 60]} />
        {children}
      </Canvas>
    </div>
  );
}
