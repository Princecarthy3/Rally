"use client";

import { useState } from "react";
import { Smile } from "lucide-react";

const DEFAULT_EMOTES = ["😂", "😭", "💀", "😤", "🤝", "😎", "🔥", "👏", "👀", "😱", "❤️", "👑"];

interface EmoteWheelProps {
  onSendEmote: (emote: string) => void;
  className?: string;
}

export function EmoteWheel({ onSendEmote, className = "" }: EmoteWheelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  function handleTrigger(emote: string) {
    if (cooldown) return;
    onSendEmote(emote);
    setCooldown(true);
    setIsOpen(false);
    setTimeout(() => setCooldown(false), 3000);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={cooldown}
        className="arcade-button bg-white text-slate-950 p-2.5 shadow-[2px_2px_0_#171821] disabled:opacity-50"
        title="Emotes"
      >
        <Smile size={18} />
        {cooldown && <span className="text-[10px] font-black text-rose-500">Wait...</span>}
      </button>

      {isOpen && (
        <div className="absolute bottom-12 right-0 z-50 grid w-56 grid-cols-4 gap-2 rounded-2xl border-2 border-slate-950 bg-white p-3 shadow-[6px_6px_0_#171821] animate-in zoom-in-95">
          {DEFAULT_EMOTES.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleTrigger(emoji)}
              className="grid h-11 w-11 place-items-center rounded-xl border-2 border-slate-200 bg-slate-50 text-2xl hover:bg-[#f4dc69] transition active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
