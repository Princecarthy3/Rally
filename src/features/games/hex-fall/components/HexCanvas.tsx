"use client";

import { Canvas } from "@react-three/fiber";
import type { ReactNode } from "react";

export function HexCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 h-full w-full bg-[#080718]">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 24, 18], fov: 48 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        className="h-full w-full touch-none"
        style={{ width: "100%", height: "100%", display: "block", background: "#080718" }}
      >
        <color attach="background" args={["#080718"]} />
        <ambientLight intensity={1.2} color="#f0f4ff" />
        <directionalLight
          position={[-18, 38, 22]}
          intensity={2.2}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={90}
          shadow-camera-left={-26}
          shadow-camera-right={26}
          shadow-camera-top={26}
          shadow-camera-bottom={-26}
        />
        <pointLight position={[0, 22, 0]} intensity={1.5} color="#38bdf8" distance={45} />
        <pointLight position={[0, 8, 0]} intensity={1.8} color="#c084fc" distance={40} />
        <pointLight position={[0, -4, 0]} intensity={2.5} color="#fb7185" distance={35} />
        <hemisphereLight args={["#38bdf8", "#080718", 0.9]} />
        <fog attach="fog" args={["#080718", 40, 110]} />
        {children}
      </Canvas>
    </div>
  );
}
