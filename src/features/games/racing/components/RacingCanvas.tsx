"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, type ReactNode } from "react";

export function RacingCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#87b7d9]">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 5, -10], fov: 62 }}
        className="h-full w-full touch-none select-none"
      >
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
