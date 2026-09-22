"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sounds } from "@/lib/audio";
import { Layers, ArrowRightLeft, ShieldAlert, Sparkles, Trophy, AlertTriangle } from "lucide-react";

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
  red: { bg: "bg-red-500", text: "text-red-500", border: "border-red-600", badgeBg: "bg-red-500/20", hex: "#ef4444" },
  blue: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-600", badgeBg: "bg-blue-500/20", hex: "#3b82f6" },
  green: { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-600", badgeBg: "bg-emerald-500/20", hex: "#10b981" },
  yellow: { bg: "bg-amber-400", text: "text-amber-500", border: "border-amber-500", badgeBg: "bg-amber-500/20", hex: "#f59e0b" },
  wild: { bg: "bg-slate-900", text: "text-purple-400", border: "border-purple-500", badgeBg: "bg-purple-500/20", hex: "#8b5cf6" },
};

export function UnoGame({ room, players, meSeat, isMyTurn, onAct }: UnoGameProps) {
  const state = (room.public_state || {}) as Record<string, any>;
  const turn = state.turn || 1;
  const topCard: UnoCard = state.topCard || { id: "c0", color: "red", value: "7" };
  const activeColor: "red" | "blue" | "green" | "yellow" = state.activeColor || (topCard.color !== "wild" ? (topCard.color as any) : "red");
  const direction = state.direction || 1;
  const cardCounts: Record<string, number> = state.cardCounts || {};
  const scores: Record<string, number> = state.scores || {};
  const unoCalled: Record<string, boolean> = state.unoCalled || {};
  const unoVulnerableSeat: number | null = state.unoVulnerableSeat ?? null;
  const challenge = state.challenge || null;
  const drawnCardId: string | null = state.drawnCardId || null;

  const [fetchedHand, setFetchedHand] = useState<UnoCard[]>([]);
  const [selectedWildCard, setSelectedWildCard] = useState<UnoCard | null>(null);

  const supabase = getSupabaseBrowserClient();

  // Fetch private hand from backend
  useEffect(() => {
    let active = true;
    async function loadHand() {
      if (!supabase || !room.id) return;
      const { data, error } = await supabase.rpc("get_my_uno_hand", { p_room: room.id, p_actor_seat: meSeat });
      if (active && !error && Array.isArray(data)) {
        setFetchedHand(data as UnoCard[]);
      }
    }
    void loadHand();
    return () => {
      active = false;
    };
  }, [supabase, room.id, meSeat, room.state_version, turn]);

  const publicHands: Record<string, UnoCard[]> = state.hands || {};
  const myHand: UnoCard[] = fetchedHand.length > 0 ? fetchedHand : (publicHands[meSeat.toString()] || []);

  const isPendingChallengeForMe = challenge && Number(challenge.challengerSeat) === meSeat;

  const isPlayable = (card: UnoCard) => {
    if (!isMyTurn || isPendingChallengeForMe) return false;
    if (card.color === "wild") return true;
    if (card.color === activeColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  };

  const handleCardClick = (card: UnoCard) => {
    if (!isMyTurn || isPendingChallengeForMe) return;
    if (!isPlayable(card)) return;

    if (card.color === "wild") {
      setSelectedWildCard(card);
      return;
    }

    sounds.playClickSound();
    void onAct("play_card", card.id);
  };

  const handleWildColorSelect = (color: "red" | "blue" | "green" | "yellow") => {
    if (!selectedWildCard) return;
    sounds.playClickSound();
    void onAct("play_card", `${selectedWildCard.id}:${color}`);
    setSelectedWildCard(null);
  };

  const handleDrawCard = () => {
    if (!isMyTurn || isPendingChallengeForMe) return;
    sounds.playClickSound();
    void onAct("draw_card");
  };

  const handlePassTurn = () => {
    if (!isMyTurn) return;
    sounds.playClickSound();
    void onAct("pass_turn");
  };

  const handleCallUno = () => {
    sounds.playWinSound();
    void onAct("call_uno");
  };

  const handleCatchUno = (seatToCatch: number) => {
    sounds.playWinSound();
    void onAct("catch_uno", String(seatToCatch));
  };

  const handleAcceptDraw4 = () => {
    sounds.playClickSound();
    void onAct("accept_draw4");
  };

  const handleChallengeDraw4 = () => {
    sounds.playClickSound();
    void onAct("challenge_draw4");
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
    <div className="flex flex-col items-center gap-6 p-2 sm:p-4">
      {/* Top Header Bar */}
      <div className="w-full max-w-3xl flex flex-wrap items-center justify-between bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-2xl border-2 border-slate-800 shadow-md gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🃏</span>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wider text-amber-400">Classic UNO</h3>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              Active Color:
              <span className={`font-black uppercase px-2 py-0.5 rounded-full text-[11px] ${COLOR_MAP[activeColor]?.bg} text-white`}>
                {activeColor}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Direction */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold">
            <ArrowRightLeft className={`w-4 h-4 text-emerald-400 transition-transform duration-300 ${direction === -1 ? "rotate-180" : ""}`} />
            <span className="hidden sm:inline">{direction === 1 ? "Clockwise" : "Counter-Clockwise"}</span>
          </div>

          {/* Call UNO Button */}
          {myHand.length <= 2 && (
            <button
              onClick={handleCallUno}
              className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all ${
                unoCalled[meSeat]
                  ? "bg-emerald-600 text-white cursor-default"
                  : "bg-gradient-to-r from-red-600 to-amber-500 text-white hover:scale-105 animate-bounce cursor-pointer shadow-red-500/50"
              }`}
            >
              {unoCalled[meSeat] ? "UNO Called! 🎉" : "CALL UNO! 📣"}
            </button>
          )}
        </div>
      </div>

      {/* Main Game Arena */}
      <div className="w-full max-w-3xl bg-slate-950/90 rounded-3xl p-4 sm:p-6 border-4 border-slate-800 flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
        
        {/* Center Board: Draw & Discard Piles */}
        <div className="flex items-center justify-center gap-6 sm:gap-12 my-2">
          
          {/* Draw Deck */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Draw Pile ({state.drawCount ?? 0})
            </span>
            <button
              onClick={handleDrawCard}
              disabled={!isMyTurn || Boolean(isPendingChallengeForMe)}
              className={`w-24 sm:w-28 h-36 sm:h-40 rounded-2xl border-4 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-2 shadow-xl transition-all ${
                isMyTurn && !isPendingChallengeForMe
                  ? "hover:scale-105 hover:border-amber-400 cursor-pointer ring-2 ring-amber-400/50"
                  : "opacity-60 cursor-not-allowed"
              }`}
            >
              <Layers className="w-8 h-8 text-amber-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider">Draw Card</span>
            </button>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Discard ({state.discardCount ?? 1})
            </span>
            <div
              className={`w-24 sm:w-28 h-36 sm:h-40 rounded-2xl border-4 ${COLOR_MAP[topCard.color]?.border} ${COLOR_MAP[topCard.color]?.bg} text-white flex flex-col items-center justify-between p-3 shadow-2xl transform rotate-1 scale-105 transition-all`}
            >
              <span className="text-sm font-black self-start">{renderCardSymbol(topCard.value)}</span>
              <span className="text-4xl font-black">{renderCardSymbol(topCard.value)}</span>
              <span className="text-sm font-black self-end">{renderCardSymbol(topCard.value)}</span>
            </div>
          </div>
        </div>

        {/* Status Message Banner */}
        {state.message && (
          <div className="bg-slate-900/90 border border-slate-700 text-amber-300 text-xs sm:text-sm font-black px-4 py-2.5 rounded-2xl text-center shadow-inner max-w-xl w-full">
            {state.message}
          </div>
        )}

        {/* Players Seats & Cards Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full py-1">
          {players.map((p) => {
            const isTurn = turn === p.seat;
            const count = cardCounts[p.seat.toString()] ?? 7;
            const isVulnerable = unoVulnerableSeat === p.seat;
            const score = scores[p.seat.toString()] ?? 0;

            return (
              <div
                key={p.id}
                className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all relative ${
                  isTurn ? "bg-amber-500/20 border-amber-400 scale-105 shadow-lg shadow-amber-500/20" : "bg-slate-900/60 border-slate-800"
                }`}
              >
                <div className="flex items-center gap-1.5 w-full justify-center">
                  <span className="text-xs font-black truncate text-slate-200">
                    {p.profile?.display_name || `P${p.seat}`} {p.seat === meSeat ? "(You)" : ""}
                  </span>
                  {unoCalled[p.seat] && (
                    <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-md animate-pulse">
                      UNO
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <strong>{count}</strong> cards
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-amber-300">{score} pts</span>
                </div>

                {/* Catch UNO button for opponent vulnerability */}
                {isVulnerable && p.seat !== meSeat && (
                  <button
                    onClick={() => handleCatchUno(p.seat)}
                    className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-black py-1 px-2 rounded-xl animate-bounce shadow-md uppercase tracking-wider"
                  >
                    CATCH UNO! 🚨
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Player's Private Hand Section */}
        <div className="w-full flex flex-col items-center gap-3 mt-1 border-t border-slate-800 pt-4">
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                Your Hand ({myHand.length})
              </span>
            </div>

            {isMyTurn && !isPendingChallengeForMe && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 animate-pulse">
                  👉 Your turn!
                </span>
                {drawnCardId && (
                  <button
                    onClick={handlePassTurn}
                    className="arcade-button bg-slate-800 text-amber-300 text-xs py-1 px-3 border border-slate-700"
                  >
                    PASS TURN ⏭️
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cards Hand Grid / Fan */}
          <div className="flex flex-wrap gap-2.5 justify-center max-h-64 overflow-y-auto p-2 w-full">
            {myHand.map((card) => {
              const playable = isPlayable(card);
              const isDrawn = drawnCardId === card.id;

              return (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(card)}
                  disabled={!playable}
                  className={`w-16 sm:w-20 h-24 sm:h-30 rounded-xl border-2 ${COLOR_MAP[card.color]?.border} ${COLOR_MAP[card.color]?.bg} text-white flex flex-col items-center justify-between p-2 shadow-lg transition-all ${
                    playable
                      ? "hover:-translate-y-3 hover:shadow-2xl hover:border-white cursor-pointer ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950"
                      : "opacity-40 grayscale cursor-not-allowed"
                  } ${isDrawn ? "ring-4 ring-amber-400 animate-bounce" : ""}`}
                >
                  <span className="text-xs font-bold self-start">{renderCardSymbol(card.value)}</span>
                  <span className="text-2xl sm:text-3xl font-black">{renderCardSymbol(card.value)}</span>
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

      {/* Wild Draw Four Challenge Modal for Target Player */}
      {isPendingChallengeForMe && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-500 p-6 rounded-3xl max-w-md w-full flex flex-col items-center gap-4 text-center shadow-2xl animate-in zoom-in-95">
            <AlertTriangle className="w-12 h-12 text-amber-400 animate-bounce" />
            <h4 className="text-xl font-black text-white">Wild Draw Four (+4) Played!</h4>
            <p className="text-xs text-slate-300">
              Player {challenge.targetSeat} played +4 against you. You can accept the 4 cards or challenge if you think they held a matching color!
            </p>

            <div className="grid grid-cols-2 gap-3 w-full mt-3">
              <button
                onClick={handleAcceptDraw4}
                className="py-3 px-4 rounded-2xl bg-slate-800 border-2 border-slate-700 text-white font-black text-xs uppercase tracking-wider hover:bg-slate-700 transition"
              >
                ACCEPT (+4 Cards)
              </button>
              <button
                onClick={handleChallengeDraw4}
                className="py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg"
              >
                CHALLENGE ⚖️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
