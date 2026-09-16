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
    setTimeout(() => setCooldown(false), 2000);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={cooldown}
        className="arcade-button bg-[#f4dc69] text-slate-950 px-3 py-2 text-xs shadow-[2px_2px_0_#171821] disabled:opacity-50"
        title="Send Reaction Emote"
      >
        <Smile size={18} />
        <span className="font-black">Emotes</span>
        {cooldown && <span className="text-[10px] font-black text-rose-600">...</span>}
      </button>

      {isOpen && (
        <>
          {/* Backdrop for click outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Emote Picker Popup */}
          <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-xs rounded-2xl border-2 border-slate-950 bg-white p-3.5 shadow-[8px_8px_0_#171821] animate-in zoom-in-95 sm:absolute sm:bottom-12 sm:right-0 sm:top-auto sm:w-64">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2 mb-2">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Quick Emotes</span>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-950 text-xs font-bold">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DEFAULT_EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleTrigger(emoji)}
                  className="grid h-12 w-12 place-items-center rounded-xl border-2 border-slate-950 bg-slate-50 text-2xl hover:bg-[#f4dc69] hover:scale-110 transition active:scale-95 shadow-[2px_2px_0_#171821]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
