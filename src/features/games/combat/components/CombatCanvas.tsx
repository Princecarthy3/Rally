"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

export function CombatCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 h-full w-full bg-[#b9dff1]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 10, 15], fov: 50 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        className="h-full w-full touch-none"
        style={{ width: "100%", height: "100%", display: "block", background: "#b9dff1" }}
      >
        <color attach="background" args={["#b9dff1"]} />
        <ambientLight intensity={1.5} color="#fff8e7" />
        <directionalLight
          position={[-12, 26, 8]}
          intensity={2.4}
          color="#fff3d5"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <pointLight position={[0, 9, 0]} intensity={1.3} color="#ffe1a1" distance={32} />
        <hemisphereLight args={["#e0f2fe", "#5a765e", 1.1]} />
        <fog attach="fog" args={["#b9dff1", 35, 85]} />
        {children}
      </Canvas>
    </div>
  );
}
