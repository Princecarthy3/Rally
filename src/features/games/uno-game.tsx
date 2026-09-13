"use client";

import React, { useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { sounds } from "@/lib/audio";
import { Sparkles, Layers, AlertCircle, ArrowRightLeft } from "lucide-react";

export interface UnoCard {
  id: string;
  color: "red" | "blue" | "green" | "yellow" | "wild";
  value: string; // '0'-'9', 'skip', 'reverse', 'draw2', 'wild', 'wild_draw4'
}

interface UnoGameProps {
  room: Room;
  players: RoomPlayer[];
  meSeat: number;
  isMyTurn: boolean;
  onAct: (action: string, value?: string) => Promise<void>;
}

const COLOR_MAP = {
  red: { bg: "bg-red-500", text: "text-red-500", border: "border-red-600", hex: "#ef4444" },
  blue: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-600", hex: "#3b82f6" },
  green: { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-600", hex: "#10b981" },
  yellow: { bg: "bg-amber-400", text: "text-amber-500", border: "border-amber-500", hex: "#f59e0b" },
  wild: { bg: "bg-slate-900", text: "text-slate-100", border: "border-purple-500", hex: "#8b5cf6" },
};

export function UnoGame({ room, players, meSeat, isMyTurn, onAct }: UnoGameProps) {
  const state = (room.public_state || {}) as Record<string, any>;
  const turn = state.turn || 1;
  const topCard: UnoCard = state.topCard || { id: "c0", color: "red", value: "7" };
  const activeColor: "red" | "blue" | "green" | "yellow" = state.activeColor || (topCard.color !== "wild" ? (topCard.color as any) : "red");
  const hands: Record<string, UnoCard[]> = state.hands || {};
  const myHand: UnoCard[] = hands[meSeat.toString()] || [];
  const direction = state.direction || 1;
  const unoCalled = state.unoCalled || {};
  
  const [selectedWildCard, setSelectedWildCard] = useState<UnoCard | null>(null);

  const isPlayable = (card: UnoCard) => {
    if (!isMyTurn) return false;
    if (card.color === "wild") return true;
    if (card.color === activeColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  const handleCardClick = (card: UnoCard) => {
    if (!isMyTurn) return;
    if (!isPlayable(card)) return;

    if (card.color === "wild") {
      setSelectedWildCard(card);
      return;
    }

    sounds.playClickSound();
    onAct("play_card", card.id);
  };

  const handleWildColorSelect = (color: "red" | "blue" | "green" | "yellow") => {
    if (!selectedWildCard) return;
    sounds.playClickSound();
    onAct("play_card", `${selectedWildCard.id}:${color}`);
    setSelectedWildCard(null);
  };

  const handleDrawCard = () => {
    if (!isMyTurn) return;
    sounds.playClickSound();
    onAct("draw_card");
  };

  const handleCallUno = () => {
    sounds.playWinSound();
    onAct("call_uno");
  };

  const renderCardSymbol = (val: string) => {
    switch (val) {
      case "skip": return "🚫";
      case "reverse": return "🔄";
      case "draw2": return "+2";
      case "wild": return "🌈";
      case "wild_draw4": return "+4";
      default: return val;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* Game Header Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between bg-slate-900 text-white px-5 py-3 rounded-2xl border-2 border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🃏</span>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-amber-400">UNO Cards</h3>
            <p className="text-xs text-slate-300">
              Active Color: <span className={`font-bold capitalize ${COLOR_MAP[activeColor]?.text}`}>{activeColor}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <ArrowRightLeft className={`w-4 h-4 text-emerald-400 ${direction === -1 ? "rotate-180" : ""}`} />
            <span className="text-xs font-semibold text-slate-300">
              {direction === 1 ? "Clockwise" : "Counter-Clockwise"}
            </span>
          </div>

          {myHand.length <= 2 && (
            <button
              onClick={handleCallUno}
              className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all animate-bounce ${
                unoCalled[meSeat] ? "bg-emerald-600 text-white" : "bg-gradient-to-r from-red-500 to-amber-500 text-white hover:scale-105"
              }`}
            >
              {unoCalled[meSeat] ? "UNO Called! 🎉" : "CALL UNO! 📣"}
            </button>
          )}
        </div>
      </div>

      {/* Main Play Area */}
      <div className="w-full max-w-2xl bg-slate-950/80 rounded-3xl p-6 border-4 border-slate-800 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
        {/* Active Top Discard Card & Draw Deck */}
        <div className="flex items-center justify-center gap-8 my-4">
          {/* Draw Deck */}
          <button
            onClick={handleDrawCard}
            disabled={!isMyTurn}
            className={`w-24 h-36 rounded-2xl border-4 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${
              isMyTurn ? "hover:scale-105 hover:border-amber-400 cursor-pointer" : "opacity-60 cursor-not-allowed"
            }`}
          >
            <Layers className="w-8 h-8 text-amber-400 animate-pulse" />
            <span className="text-xs font-black uppercase text-amber-300 tracking-wider">Draw Card</span>
          </button>

          {/* Active Played Card */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Discard Pile</span>
            <div
              className={`w-28 h-40 rounded-2xl border-4 ${COLOR_MAP[topCard.color]?.border} ${COLOR_MAP[topCard.color]?.bg} text-white flex flex-col items-center justify-between p-3 shadow-2xl transform rotate-1 scale-105 transition-all`}
            >
              <span className="text-sm font-black self-start">{renderCardSymbol(topCard.value)}</span>
              <span className="text-4xl font-black">{renderCardSymbol(topCard.value)}</span>
              <span className="text-sm font-black self-end">{renderCardSymbol(topCard.value)}</span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {state.message && (
          <div className="bg-slate-900/90 border border-slate-700 text-amber-300 text-xs font-bold px-4 py-2 rounded-xl text-center">
            {state.message}
          </div>
        )}

        {/* Players Card Count Row */}
        <div className="flex gap-4 overflow-x-auto w-full justify-center py-2">
          {players.map((p) => {
            const isTurn = turn === p.seat;
            const cardCount = (hands[p.seat.toString()] || []).length;
            return (
              <div
                key={p.id}
                className={`flex flex-col items-center p-2.5 rounded-2xl border-2 transition-all ${
                  isTurn ? "bg-amber-500/20 border-amber-400 scale-105" : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    {p.profile?.display_name || `P${p.seat}`} {p.seat === meSeat ? "(You)" : ""}
                  </span>
                  {unoCalled[p.seat] && <span className="text-[10px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded">UNO</span>}
                </div>
                <div className="mt-1 flex items-center gap-1 text-slate-300 text-xs font-semibold">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>{cardCount} cards</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Player's Hand */}
        <div className="w-full flex flex-col items-center gap-3 mt-2">
          <div className="flex items-center justify-between w-full px-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-300">
              Your Cards ({myHand.length})
            </span>
            {isMyTurn && (
              <span className="text-xs font-bold text-emerald-400 animate-pulse">
                👉 Your turn to play or draw!
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5 justify-center max-h-60 overflow-y-auto p-2 w-full">
            {myHand.map((card) => {
              const playable = isPlayable(card);
              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  disabled={!playable}
                  className={`w-16 h-24 rounded-xl border-2 ${COLOR_MAP[card.color]?.border} ${COLOR_MAP[card.color]?.bg} text-white flex flex-col items-center justify-between p-2 shadow-lg transition-all ${
                    playable
                      ? "hover:-translate-y-2 hover:shadow-2xl hover:border-white cursor-pointer ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950"
                      : "opacity-40 grayscale cursor-not-allowed"
                  }`}
                >
                  <span className="text-xs font-bold self-start">{renderCardSymbol(card.value)}</span>
                  <span className="text-xl font-black">{renderCardSymbol(card.value)}</span>
                  <span className="text-xs font-bold self-end">{renderCardSymbol(card.value)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Wild Color Choice Modal */}
      {selectedWildCard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-slate-700 p-6 rounded-3xl max-w-sm w-full flex flex-col items-center gap-4 text-center shadow-2xl animate-in zoom-in-95">
            <h4 className="text-lg font-black text-white">Select Active Color</h4>
            <p className="text-xs text-slate-400">Choose the color for your Wild card</p>
            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              {(["red", "blue", "green", "yellow"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => handleWildColorSelect(c)}
                  className={`py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-wider ${COLOR_MAP[c].bg} hover:scale-105 transition-all shadow-lg`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedWildCard(null)}
              className="mt-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
