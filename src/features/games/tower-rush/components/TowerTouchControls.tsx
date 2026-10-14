"use client";

import { useEffect, useRef, useState } from "react";
import type { TowerTouchInputs } from "../types";

export function TowerTouchControls({
  touchInputsRef,
}: {
  touchInputsRef: React.MutableRefObject<TowerTouchInputs>;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const activeTouchId = useRef<number | null>(null);
  const baseCenter = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const checkTouch = () => {
      setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
  }, []);

  if (!isMobile) return null;

  const handleJoystickTouchStart = (e: React.TouchEvent) => {
    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    activeTouchId.current = touch.identifier;
    setIsDragging(true);

    const rect = joystickRef.current?.getBoundingClientRect();
    if (rect) {
      baseCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  };

  const handleJoystickTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === activeTouchId.current) {
        const dx = touch.clientX - baseCenter.current.x;
        const dy = touch.clientY - baseCenter.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxRadius = 40;

        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);

        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        setKnobPos({ x: knobX, y: knobY });

        // Normalize inputs (-1 to 1)
        touchInputsRef.current.moveX = knobX / maxRadius;
        touchInputsRef.current.moveZ = knobY / maxRadius;
      }
    }
  };

  const handleJoystickTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        setIsDragging(false);
        setKnobPos({ x: 0, y: 0 });
        touchInputsRef.current.moveX = 0;
        touchInputsRef.current.moveZ = 0;
      }
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex justify-between items-end p-6 select-none">
      {/* Virtual Joystick Base (Bottom Left) */}
      <div
        ref={joystickRef}
        onTouchStart={handleJoystickTouchStart}
        onTouchMove={handleJoystickTouchMove}
        onTouchEnd={handleJoystickTouchEnd}
        onTouchCancel={handleJoystickTouchEnd}
        className="pointer-events-auto relative grid h-28 w-28 place-items-center rounded-full border-3 border-white/30 bg-slate-900/60 shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-md"
      >
        {/* Joystick Center Indicator */}
        <div className="h-4 w-4 rounded-full bg-white/20" />

        {/* Joystick Thumb Knob */}
        <div
          className="absolute h-14 w-14 rounded-full border-2 border-white/50 bg-gradient-to-tr from-violet-600 to-indigo-500 shadow-lg"
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        />
      </div>

      {/* Jump Button (Bottom Right) */}
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            touchInputsRef.current.jump = true;
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            touchInputsRef.current.jump = false;
          }}
          className="grid h-20 w-20 place-items-center rounded-full border-3 border-white/40 bg-gradient-to-tr from-amber-500 to-yellow-400 font-black text-amber-950 shadow-[0_4px_16px_rgba(245,158,11,0.5)] active:scale-95"
        >
          <span className="text-sm font-black tracking-wider uppercase">JUMP</span>
        </button>
      </div>
    </div>
  );
}
