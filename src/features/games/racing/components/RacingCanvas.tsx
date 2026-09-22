"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";

export function RacingCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full bg-gradient-to-b from-sky-400 via-sky-200 to-emerald-800">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 5, -10], fov: 65 }}
        className="h-full w-full touch-none select-none"
      >
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
