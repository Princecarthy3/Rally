"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { sounds } from "@/lib/audio";

export function SoundToggle() {
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("rally_muted") === "true";
  });

  const handleToggle = () => {
    const isNowMuted = sounds.toggleMute();
    setMuted(isNowMuted);
    if (!isNowMuted) {
      sounds.playClickSound();
    }
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={muted ? "Unmute sounds and music" : "Mute sounds and music"}
      title={muted ? "Unmute sounds & music" : "Mute sounds & music"}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-violet-50 hover:text-violet-600"
    >
      {muted ? <VolumeX size={16} className="text-slate-400" /> : <Volume2 size={16} className="text-violet-600" />}
    </button>
  );
}
