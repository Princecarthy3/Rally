"use client";

import { Crown, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, RotateCw, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import type { RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";

interface LudoBoardProps {
  state: Record<string, any>;
  players: RoomPlayer[];
  mySeat?: number;
  act: (action: string, value?: string) => Promise<void>;
  busy: boolean;
}

const PLAYER_COLORS = [
  { name: "Red", main: "#ef4444", bg: "#fef2f2", border: "#b91c1c", accent: "#fca5a5" },
  { name: "Blue", main: "#3b82f6", bg: "#eff6ff", border: "#1d4ed8", accent: "#93c5fd" },
  { name: "Green", main: "#22c55e", bg: "#f0fdf4", border: "#15803d", accent: "#86efac" },
  { name: "Yellow", main: "#eab308", bg: "#fefce8", border: "#a16207", accent: "#fde047" },
];

const DICE_ICONS = [Dice1, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export function LudoBoard({ state, players, mySeat, act, busy }: LudoBoardProps) {
  const turn = state.turn || 1;
  const isMyTurn = turn === mySeat;
  const lastRoll = state.lastRoll as number | undefined;
  const tokens = (state.tokens || {
    "1": [0, 0, 0, 0],
    "2": [0, 0, 0, 0],
    "3": [0, 0, 0, 0],
    "4": [0, 0, 0, 0],
  }) as Record<string, number[]>;

  const currentRound = state.round || 1;
  const roundWins = (state.roundWins || {}) as Record<string, number>;

  async function handleRoll() {
    sounds.playClickSound();
    await act("roll");
  }

  async function handleMoveToken(tokenIdx: number) {
    sounds.playClickSound();
    await act("move_token", String(tokenIdx));
  }

  const DiceIcon = lastRoll ? DICE_ICONS[Math.min(6, Math.max(1, lastRoll))] : Dice6;

  return (
    <div className="mx-auto max-w-2xl text-center space-y-4">
      {/* Round & Game Banner */}
      <div className="flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-amber-100 px-4 py-2.5 shadow-[3px_3px_0_#171821]">
        <div className="flex items-center gap-2">
          <Sparkles className="text-amber-600" size={18} />
          <span className="text-xs font-black uppercase tracking-wider">Round {currentRound} of 3</span>
        </div>
        <div className="flex gap-2">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-1 text-xs font-black rounded-lg border border-slate-950 px-2 py-0.5 bg-white">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAYER_COLORS[p.seat - 1]?.main }} />
              <span>P{p.seat}:</span>
              <span className="text-[#7357ff]">{roundWins[p.seat] || 0}★</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ludo Board Layout */}
      <div className="relative mx-auto aspect-square w-full max-w-[420px] rounded-3xl border-4 border-slate-950 bg-white p-2 shadow-[8px_8px_0_#171821] overflow-hidden">
        {/* 15x15 Grid matrix */}
        <div className="grid grid-cols-15 grid-rows-15 h-full w-full border-2 border-slate-950 rounded-2xl overflow-hidden bg-slate-50">
          {/* Top-Left Red Yard (6x6) */}
          <div className="col-span-6 row-span-6 border-2 border-slate-950 p-3 flex flex-col justify-between" style={{ backgroundColor: PLAYER_COLORS[0].bg }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-700">Red Base (P1)</span>
            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl border-2 border-slate-950 bg-white shadow-inner">
              {tokens["1"]?.map((pos, idx) => (
                <button
                  key={idx}
                  disabled={!isMyTurn || mySeat !== 1 || busy}
                  onClick={() => handleMoveToken(idx)}
                  className={`h-7 w-7 rounded-full border-2 border-slate-950 shadow-md transition flex items-center justify-center font-black text-[10px] text-white cursor-pointer ${
                    pos === 0 ? "scale-100" : "opacity-30"
                  }`}
                  style={{ backgroundColor: PLAYER_COLORS[0].main }}
                >
                  T{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Top Green Track (3x6) */}
          <div className="col-span-3 row-span-6 border-x-2 border-slate-950 grid grid-cols-3 grid-rows-6 bg-white text-[9px] font-bold">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="border border-slate-200 flex items-center justify-center relative">
                {i === 7 && <Star size={12} className="text-green-600 fill-green-200" />}
              </div>
            ))}
          </div>

          {/* Top-Right Green Yard (6x6) */}
          <div className="col-span-6 row-span-6 border-2 border-slate-950 p-3 flex flex-col justify-between" style={{ backgroundColor: PLAYER_COLORS[2].bg }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-green-700">Green Base (P3)</span>
            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl border-2 border-slate-950 bg-white shadow-inner">
              {tokens["3"]?.map((pos, idx) => (
                <button
                  key={idx}
                  disabled={!isMyTurn || mySeat !== 3 || busy}
                  onClick={() => handleMoveToken(idx)}
                  className={`h-7 w-7 rounded-full border-2 border-slate-950 shadow-md transition flex items-center justify-center font-black text-[10px] text-white cursor-pointer ${
                    pos === 0 ? "scale-100" : "opacity-30"
                  }`}
                  style={{ backgroundColor: PLAYER_COLORS[2].main }}
                >
                  T{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Left Red Track (6x3) */}
          <div className="col-span-6 row-span-3 border-y-2 border-slate-950 grid grid-cols-6 grid-rows-3 bg-white text-[9px] font-bold">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="border border-slate-200 flex items-center justify-center relative">
                {i === 7 && <Star size={12} className="text-red-600 fill-red-200" />}
              </div>
            ))}
          </div>

          {/* Center Home Triangle (3x3) */}
          <div className="col-span-3 row-span-3 border-2 border-slate-950 bg-amber-300 grid place-items-center relative shadow-inner">
            <Crown size={28} className="text-slate-950 animate-bounce" />
            <span className="absolute bottom-1 text-[8px] font-black uppercase tracking-widest">HOME</span>
          </div>

          {/* Right Yellow Track (6x3) */}
          <div className="col-span-6 row-span-3 border-y-2 border-slate-950 grid grid-cols-6 grid-rows-3 bg-white text-[9px] font-bold">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="border border-slate-200 flex items-center justify-center relative">
                {i === 7 && <Star size={12} className="text-yellow-600 fill-yellow-200" />}
              </div>
            ))}
          </div>

          {/* Bottom-Left Blue Yard (6x6) */}
          <div className="col-span-6 row-span-6 border-2 border-slate-950 p-3 flex flex-col justify-between" style={{ backgroundColor: PLAYER_COLORS[1].bg }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Blue Base (P2)</span>
            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl border-2 border-slate-950 bg-white shadow-inner">
              {tokens["2"]?.map((pos, idx) => (
                <button
                  key={idx}
                  disabled={!isMyTurn || mySeat !== 2 || busy}
                  onClick={() => handleMoveToken(idx)}
                  className={`h-7 w-7 rounded-full border-2 border-slate-950 shadow-md transition flex items-center justify-center font-black text-[10px] text-white cursor-pointer ${
                    pos === 0 ? "scale-100" : "opacity-30"
                  }`}
                  style={{ backgroundColor: PLAYER_COLORS[1].main }}
                >
                  T{idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Track (3x6) */}
          <div className="col-span-3 row-span-6 border-x-2 border-slate-950 grid grid-cols-3 grid-rows-6 bg-white text-[9px] font-bold">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="border border-slate-200 flex items-center justify-center relative">
                {i === 7 && <Star size={12} className="text-blue-600 fill-blue-200" />}
              </div>
            ))}
          </div>

          {/* Bottom-Right Yellow Yard (6x6) */}
          <div className="col-span-6 row-span-6 border-2 border-slate-950 p-3 flex flex-col justify-between" style={{ backgroundColor: PLAYER_COLORS[3].bg }}>
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700">Yellow Base (P4)</span>
            <div className="grid grid-cols-2 gap-2 p-2 rounded-xl border-2 border-slate-950 bg-white shadow-inner">
              {tokens["4"]?.map((pos, idx) => (
                <button
                  key={idx}
                  disabled={!isMyTurn || mySeat !== 4 || busy}
                  onClick={() => handleMoveToken(idx)}
                  className={`h-7 w-7 rounded-full border-2 border-slate-950 shadow-md transition flex items-center justify-center font-black text-[10px] text-white cursor-pointer ${
                    pos === 0 ? "scale-100" : "opacity-30"
                  }`}
                  style={{ backgroundColor: PLAYER_COLORS[3].main }}
                >
                  T{idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Control Area */}
      <div className="rounded-2xl border-2 border-slate-950 bg-slate-900 p-4 text-white shadow-[4px_4px_0_#171821]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-slate-950 bg-[#f4dc69] text-slate-950 shadow-sm">
              <DiceIcon size={28} />
            </div>
            <div className="text-left">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                {isMyTurn ? "YOUR TURN TO ROLL" : `PLAYER ${turn} IS ROLLING`}
              </span>
              <p className="text-sm font-bold text-white">
                {lastRoll ? `Rolled a ${lastRoll}! ${lastRoll === 6 ? "⚡ EXTRA ROLL!" : ""}` : "Roll the dice to move tokens!"}
              </p>
            </div>
          </div>

          <button
            onClick={handleRoll}
            disabled={!isMyTurn || busy}
            className="arcade-button bg-[#f4dc69] text-slate-950 px-6 py-3 shadow-[3px_3px_0_#171821] hover:bg-amber-300 disabled:opacity-50"
          >
            <RotateCw size={16} />
            <span>ROLL</span>
          </button>
        </div>

        {/* Token Move Options for Active Player */}
        {isMyTurn && lastRoll && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <span className="text-xs font-black uppercase text-amber-300">Select token to move:</span>
            <div className="mt-2 flex justify-center gap-3">
              {[0, 1, 2, 3].map((tIdx) => {
                const currentPos = tokens[String(mySeat)]?.[tIdx] ?? 0;
                return (
                  <button
                    key={tIdx}
                    disabled={busy}
                    onClick={() => handleMoveToken(tIdx)}
                    className="arcade-button bg-white text-slate-950 px-4 py-2 text-xs shadow-[2px_2px_0_#171821]"
                  >
                    Token {tIdx + 1} ({currentPos === 0 ? "In Yard" : `Pos ${currentPos}`})
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
