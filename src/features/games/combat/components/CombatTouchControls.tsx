"use client";

import { useEffect, useState } from "react";
import { TouchCombatInputs } from "../types";

export function CombatTouchControls({
  onInputsChange,
  specialName,
  specialCooldown,
}: {
  onInputsChange: (inputs: TouchCombatInputs) => void;
  specialName: string;
  specialCooldown: number;
}) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [inputs, setInputs] = useState<TouchCombatInputs>({
    moveDir: [0, 0],
    lightAttack: false,
    heavyAttack: false,
    block: false,
    dodge: false,
    special: false,
    jump: false,
  });

  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    setIsTouchDevice(isTouch);
  }, []);

  const updateInput = (key: keyof TouchCombatInputs, value: any) => {
    setInputs((prev) => {
      const next = { ...prev, [key]: value };
      onInputsChange(next);
      return next;
    });
  };

  if (!isTouchDevice) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex justify-between p-6 select-none">
      {/* Left Side: Directional Touch Movement Buttons */}
      <div className="pointer-events-auto self-end grid grid-cols-3 gap-2 w-40 h-40">
        <div />
        <button
          onTouchStart={() => updateInput("moveDir", [0, -1])}
          onTouchEnd={() => updateInput("moveDir", [0, 0])}
          className="arcade-button bg-slate-800 text-white text-lg rounded-xl active:bg-slate-700"
        >
          ▲
        </button>
        <div />
        <button
          onTouchStart={() => updateInput("moveDir", [-1, 0])}
          onTouchEnd={() => updateInput("moveDir", [0, 0])}
          className="arcade-button bg-slate-800 text-white text-lg rounded-xl active:bg-slate-700"
        >
          ◄
        </button>
        <div />
        <button
          onTouchStart={() => updateInput("moveDir", [1, 0])}
          onTouchEnd={() => updateInput("moveDir", [0, 0])}
          className="arcade-button bg-slate-800 text-white text-lg rounded-xl active:bg-slate-700"
        >
          ►
        </button>
        <div />
        <button
          onTouchStart={() => updateInput("moveDir", [0, 1])}
          onTouchEnd={() => updateInput("moveDir", [0, 0])}
          className="arcade-button bg-slate-800 text-white text-lg rounded-xl active:bg-slate-700"
        >
          ▼
        </button>
        <div />
      </div>

      {/* Right Side: Action Touch Buttons */}
      <div className="pointer-events-auto self-end flex flex-col gap-2.5 items-end">
        <div className="flex gap-2">
          <button
            onTouchStart={() => updateInput("special", true)}
            onTouchEnd={() => updateInput("special", false)}
            disabled={specialCooldown > 0}
            className="arcade-button bg-amber-500 text-slate-950 font-black text-xs px-4 py-3 rounded-2xl shadow-[3px_3px_0_#171821] disabled:opacity-40"
          >
            Q {specialName}
          </button>
          <button
            onTouchStart={() => updateInput("dodge", true)}
            onTouchEnd={() => updateInput("dodge", false)}
            className="arcade-button bg-cyan-400 text-slate-950 font-black text-xs px-4 py-3 rounded-2xl shadow-[3px_3px_0_#171821]"
          >
            DODGE
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onTouchStart={() => updateInput("lightAttack", true)}
            onTouchEnd={() => updateInput("lightAttack", false)}
            className="arcade-button bg-rose-500 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-[3px_3px_0_#171821]"
          >
            LIGHT
          </button>
          <button
            onTouchStart={() => updateInput("heavyAttack", true)}
            onTouchEnd={() => updateInput("heavyAttack", false)}
            className="arcade-button bg-purple-600 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-[3px_3px_0_#171821]"
          >
            HEAVY
          </button>
          <button
            onTouchStart={() => updateInput("block", true)}
            onTouchEnd={() => updateInput("block", false)}
            className="arcade-button bg-yellow-400 text-slate-950 font-black text-xs px-4 py-3 rounded-2xl shadow-[3px_3px_0_#171821]"
          >
            BLOCK
          </button>
          <button
            onTouchStart={() => updateInput("jump", true)}
            onTouchEnd={() => updateInput("jump", false)}
            className="arcade-button bg-emerald-400 text-slate-950 font-black text-xs px-4 py-3 rounded-2xl shadow-[3px_3px_0_#171821]"
          >
            JUMP
          </button>
        </div>
      </div>
    </div>
  );
}
