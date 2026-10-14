"use client";

import { useEffect, useRef, useState } from "react";
import type { HexTouchInputs } from "../types";

export function HexTouchControls({
  onInputsChange,
}: {
  onInputsChange: (inputs: HexTouchInputs) => void;
}) {
  const [joystickActive, setJoystickActive] = useState(false);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchId = useRef<number | null>(null);
  const currentInputs = useRef<HexTouchInputs>({ moveX: 0, moveY: 0, jump: false, dive: false });

  const updateInputs = (patch: Partial<HexTouchInputs>) => {
    currentInputs.current = { ...currentInputs.current, ...patch };
    onInputsChange(currentInputs.current);
  };

  const handleStickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchId.current !== null) return;
    const touch = e.changedTouches[0];
    touchId.current = touch.identifier;
    touchOrigin.current = { x: touch.clientX, y: touch.clientY };
    setJoystickActive(true);
    setStickPos({ x: 0, y: 0 });
  };

  const handleStickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchId.current === null || !touchOrigin.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchId.current) {
        const dx = touch.clientX - touchOrigin.current.x;
        const dy = touch.clientY - touchOrigin.current.y;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 45;

        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);

        const stickX = Math.cos(angle) * clampedDist;
        const stickY = Math.sin(angle) * clampedDist;

        setStickPos({ x: stickX, y: stickY });
        updateInputs({
          moveX: stickX / maxRadius,
          moveY: stickY / maxRadius,
        });
        break;
      }
    }
  };

  const handleStickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId.current) {
        touchId.current = null;
        touchOrigin.current = null;
        setJoystickActive(false);
        setStickPos({ x: 0, y: 0 });
        updateInputs({ moveX: 0, moveY: 0 });
        break;
      }
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 select-none sm:hidden">
      {/* Joystick Zone (Left) */}
      <div
        className="pointer-events-auto absolute bottom-4 left-4 h-36 w-36 touch-none rounded-full border-2 border-white/20 bg-black/25 backdrop-blur-sm"
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
        onTouchCancel={handleStickEnd}
      >
        {/* Joystick Thumb Knob */}
        <div
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-yellow-400 shadow-[2px_2px_0_#0f172a] transition-transform duration-75"
          style={{
            transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))`,
          }}
        />
      </div>

      {/* Action Buttons Zone (Right) */}
      <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col items-center gap-3">
        {/* Dive / Dash Button */}
        <button
          onTouchStart={() => updateInputs({ dive: true })}
          onTouchEnd={() => updateInputs({ dive: false })}
          className="h-13 w-13 rounded-full border-2 border-slate-950 bg-[#38bdf8] text-xs font-black text-slate-950 shadow-[3px_3px_0_#0f172a] active:translate-y-0.5 active:shadow-none"
        >
          DIVE
        </button>

        {/* Big Jump Button */}
        <button
          onTouchStart={() => updateInputs({ jump: true })}
          onTouchEnd={() => updateInputs({ jump: false })}
          className="h-18 w-18 rounded-full border-2 border-slate-950 bg-[#f43f5e] text-sm font-black text-white shadow-[4px_4px_0_#0f172a] active:translate-y-0.5 active:shadow-none"
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
