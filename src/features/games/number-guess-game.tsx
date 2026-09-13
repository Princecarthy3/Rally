"use client";

import React, { useState, useEffect } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { Timer, Flame, Snowflake, ArrowUp, ArrowDown, Target, HelpCircle } from "lucide-react";

interface NumberGuessGameProps {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  isMyTurn: boolean;
  onAct: (action: string, value?: string) => Promise<void>;
}

export function NumberGuessGame({ room, players, meSeat, isMyTurn, onAct }: NumberGuessGameProps) {
  const state = (room.public_state || {}) as Record<string, any>;
  const pickerSeat = state.pickerSeat || 1;
  const guesserSeat = state.guesserSeat || (pickerSeat === 1 ? 2 : 1);
  const targetPicked = state.targetPicked || false;
  const targetNumber = state.targetNumber; // Secret target (visible only to picker)
  const lastGuess = state.lastGuess;
  const hintType = state.hintType; // 'very_close' | 'far' | 'higher' | 'lower' | 'correct'
  const isPicker = meSeat === pickerSeat;
  const isGuesser = meSeat === guesserSeat;
  const turn = state.turn || guesserSeat;

  const [inputVal, setInputVal] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(5);

  // 5-second countdown timer for guesser phase
  useEffect(() => {
    if (!targetPicked || room.status !== "playing") return;

    setTimeLeft(5);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (isGuesser) {
            onAct("time_expired");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetPicked, lastGuess, state.turn, room.status, isGuesser]);

  const handlePickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputVal, 10);
    if (isNaN(num) || num < 1 || num > 100) return;

    sounds.playClickSound();
    onAct("set_target", num.toString());
    setInputVal("");
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(inputVal, 10);
    if (isNaN(num) || num < 1 || num > 100) return;

    sounds.playClickSound();
    onAct("guess", num.toString());
    setInputVal("");
  };

  const pickerPlayer = players.find((p) => p.seat === pickerSeat);
  const guesserPlayer = players.find((p) => p.seat === guesserSeat);

  return (
    <div className="flex flex-col items-center gap-6 p-4 w-full max-w-xl mx-auto">
      {/* Game Stage Info Card */}
      <div className="w-full bg-slate-900 border-2 border-slate-800 text-white rounded-3xl p-6 shadow-xl flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔢</span>
          <div>
            <h3 className="font-black text-base uppercase tracking-wider text-amber-400">5-Second Number Hunt</h3>
            <p className="text-xs text-slate-300">
              {pickerPlayer?.profile?.display_name || `Player ${pickerSeat}`} picks secret number (1-100),{" "}
              {guesserPlayer?.profile?.display_name || `Player ${guesserSeat}`} gets 5 seconds to guess!
            </p>
          </div>
        </div>

        {/* Status Message */}
        {state.message && (
          <div className="w-full bg-slate-800/90 border border-slate-700 text-amber-300 font-bold text-xs px-4 py-2.5 rounded-2xl animate-in fade-in">
            {state.message}
          </div>
        )}

        {/* Phase 1: Picker Secret Number Selection */}
        {!targetPicked && (
          <div className="w-full flex flex-col items-center gap-4 py-4">
            {isPicker ? (
              <form onSubmit={handlePickSubmit} className="w-full flex flex-col items-center gap-3">
                <label className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4" /> Pick Secret Target Number (1 - 100)
                </label>
                <div className="flex gap-2 w-full max-w-xs">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Enter 1-100"
                    className="flex-1 px-4 py-3 bg-slate-950 border-2 border-amber-500/50 rounded-2xl text-white font-black text-center text-lg focus:outline-none focus:border-amber-400"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:scale-105 text-white font-black text-sm uppercase rounded-2xl shadow-lg transition-all"
                  >
                    Lock 🔒
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-slate-400">
                <HelpCircle className="w-10 h-10 text-amber-400 animate-pulse" />
                <p className="text-xs font-bold">
                  Waiting for {pickerPlayer?.profile?.display_name || `Player ${pickerSeat}`} to set secret number...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Guesser 5-Second Guessing Duel */}
        {targetPicked && (
          <div className="w-full flex flex-col items-center gap-6 py-2">
            {/* 5-Second Countdown Timer Bar */}
            <div className="w-full flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-red-400 font-black text-sm uppercase tracking-wider">
                <Timer className="w-5 h-5 animate-spin" />
                <span>5-Sec Timer: <strong className="text-xl text-white">{timeLeft}s</strong></span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-1000 ${
                    timeLeft <= 2 ? "bg-red-600 animate-pulse" : "bg-gradient-to-r from-amber-500 to-red-500"
                  }`}
                  style={{ width: `${(timeLeft / 5) * 100}%` }}
                />
              </div>
            </div>

            {/* Last Guess Clue Badges */}
            {lastGuess !== null && lastGuess !== undefined && (
              <div className="flex flex-col items-center gap-2 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 w-full">
                <span className="text-xs font-bold text-slate-400">Last Guess: <strong className="text-white text-sm">{lastGuess}</strong></span>
                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  {Math.abs((targetNumber || 0) - lastGuess) <= 5 && (
                    <span className="inline-flex items-center gap-1.5 bg-red-500/20 text-red-400 border border-red-500/40 px-3 py-1 rounded-xl text-xs font-black">
                      <Flame className="w-4 h-4 text-red-500" /> 🔥 Very close
                    </span>
                  )}
                  {Math.abs((targetNumber || 0) - lastGuess) > 25 && (
                    <span className="inline-flex items-center gap-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 py-1 rounded-xl text-xs font-black">
                      <Snowflake className="w-4 h-4 text-cyan-400" /> 🥶 Far
                    </span>
                  )}
                  {(targetNumber || 0) > lastGuess && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3 py-1 rounded-xl text-xs font-black">
                      <ArrowUp className="w-4 h-4" /> ⬆️ Higher
                    </span>
                  )}
                  {(targetNumber || 0) < lastGuess && (
                    <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/40 px-3 py-1 rounded-xl text-xs font-black">
                      <ArrowDown className="w-4 h-4" /> ⬇️ Lower
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Guesser Input Form */}
            {isGuesser ? (
              <form onSubmit={handleGuessSubmit} className="w-full flex flex-col items-center gap-3">
                <label className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  Quick! Type your guess (1-100):
                </label>
                <div className="flex gap-2 w-full max-w-xs">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Guess #"
                    className="flex-1 px-4 py-3 bg-slate-950 border-2 border-emerald-500/50 rounded-2xl text-white font-black text-center text-lg focus:outline-none focus:border-emerald-400"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-105 text-white font-black text-sm uppercase rounded-2xl shadow-lg transition-all"
                  >
                    Guess 🎯
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-xs font-bold text-slate-400 animate-pulse">
                {guesserPlayer?.profile?.display_name || `Player ${guesserSeat}`} is guessing...
                {isPicker && targetNumber && (
                  <span className="block mt-2 text-amber-300 font-extrabold text-sm">
                    Secret Target: {targetNumber} 🤫
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
