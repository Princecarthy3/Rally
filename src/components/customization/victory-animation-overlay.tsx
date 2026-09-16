"use client";

import { useEffect, useState } from "react";
import { ShopItem } from "@/lib/customization";
import { Trophy, Sparkles, Flame, Zap } from "lucide-react";

interface VictoryAnimationOverlayProps {
  winnerName: string;
  isMe: boolean;
  equippedVictory?: ShopItem | null;
  onDismiss: () => void;
}

export function VictoryAnimationOverlay({ winnerName, isMe, equippedVictory, onDismiss }: VictoryAnimationOverlayProps) {
  const [visible, setVisible] = useState(true);
  const animKey = equippedVictory?.asset_value || "confetti";

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 p-4 text-white backdrop-blur-md animate-in fade-in">
      {/* Particle Icon based on equipped animation */}
      <div className="relative mb-6">
        <div className="grid h-32 w-32 place-items-center rounded-full border-4 border-[#f4dc69] bg-slate-900 text-6xl shadow-[0_0_50px_#f4dc69] animate-bounce">
          {animKey === "fireworks" ? "🎆" : animKey === "lightning" ? "⚡" : animKey === "flame" ? "🔥" : animKey === "crown" ? "👑" : animKey === "galaxy" ? "🌌" : "🎉"}
        </div>
      </div>

      <p className="eyebrow !text-[#f4dc69] text-sm">Match Victory</p>
      <h1 className="mt-2 text-center text-4xl sm:text-6xl font-black tracking-tight text-white">
        {isMe ? "YOU WON THE MATCH! 🎉" : `${winnerName} WINS! 🏆`}
      </h1>

      <p className="mt-3 text-sm text-slate-300">
        {equippedVictory ? `Playing ${equippedVictory.name}` : "Victory Celebration"}
      </p>

      <button
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        className="arcade-button mt-8 bg-[#f4dc69] text-slate-950 font-black text-sm"
      >
        CONTINUE
      </button>
    </div>
  );
}
