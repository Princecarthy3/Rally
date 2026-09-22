"use client";

import { useEffect, useRef } from "react";
import type { VehicleInput } from "./vehicle";

export function useRacingInput(enabled: boolean) {
  const input = useRef<VehicleInput>({
    accelerate: false,
    brake: false,
    steer: 0,
    handbrake: false,
  });
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled) {
      input.current = { accelerate: false, brake: false, steer: 0, handbrake: false };
      return;
    }
    const sync = () => {
      const k = keys.current;
      input.current = {
        accelerate: !!(k["KeyW"] || k["ArrowUp"]),
        brake: !!(k["KeyS"] || k["ArrowDown"]),
        steer: (k["KeyA"] || k["ArrowLeft"] ? -1 : 0) + (k["KeyD"] || k["ArrowRight"] ? 1 : 0),
        handbrake: !!k["Space"],
      };
    };
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      sync();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled]);

  return {
    input,
    setTouch: (partial: Partial<VehicleInput>) => {
      input.current = { ...input.current, ...partial };
    },
  };
}
