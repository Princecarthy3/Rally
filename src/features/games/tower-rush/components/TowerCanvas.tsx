"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

export function TowerCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 h-full w-full bg-[#09081a]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 8, 14], fov: 52 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        className="h-full w-full touch-none"
        style={{ width: "100%", height: "100%", display: "block", background: "#09081a" }}
      >
        <color attach="background" args={["#09081a"]} />
        <ambientLight intensity={1.3} color="#f5f3ff" />
        
        {/* Main Sun / Tower Key Light */}
        <directionalLight
          position={[-22, 50, 26]}
          intensity={2.4}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={120}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />

        {/* Vertical Tower Section Accent Lights */}
        <pointLight position={[0, 8, 0]} intensity={1.8} color="#818cf8" distance={35} />
        <pointLight position={[0, 24, 0]} intensity={2.0} color="#2dd4bf" distance={40} />
        <pointLight position={[0, 42, 0]} intensity={2.2} color="#fbbf24" distance={45} />
        <pointLight position={[0, 60, 0]} intensity={2.5} color="#f43f5e" distance={50} />
        <pointLight position={[0, 72, 0]} intensity={3.5} color="#e879f9" distance={40} />

        <hemisphereLight args={["#818cf8", "#09081a", 0.9]} />
        <fog attach="fog" args={["#09081a", 45, 140]} />

        {children}
      </Canvas>
    </div>
  );
}
