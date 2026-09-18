"use client";

import { Check, Moon, Palette, Share2, Volume2, VolumeX, X, Sun, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { sounds } from "@/lib/audio";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const THEMES = [
  { id: "vibrant", name: "Vibrant Arcade", icon: Sparkles, color: "#7357ff", bg: "#fffdf7", preview: "from-purple-500 to-amber-300" },
  { id: "dark", name: "Midnight Dark", icon: Moon, color: "#1e293b", bg: "#0f172a", preview: "from-slate-900 to-slate-800" },
  { id: "sunlight", name: "Sunburst Light", icon: Sun, color: "#f59e0b", bg: "#ffffff", preview: "from-amber-400 to-orange-300" },
  { id: "emerald", name: "Cyber Emerald", icon: Palette, color: "#10b981", bg: "#064e3b", preview: "from-emerald-600 to-teal-400" },
];

function applyTheme(themeId: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", themeId);
  if (themeId === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [muted, setMuted] = useState(() => (typeof window !== "undefined" ? sounds.getMuted() : false));
  const [volume, setVolumeState] = useState(() => (typeof window !== "undefined" ? Math.round(sounds.getVolume() * 100) : 80));
  const [currentTheme, setCurrentTheme] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("rally_theme") || "vibrant" : "vibrant"));
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("rally_theme") || "vibrant";
      applyTheme(savedTheme);
    }
  }, []);


  function handleThemeChange(themeId: string) {
    setCurrentTheme(themeId);
    localStorage.setItem("rally_theme", themeId);
    applyTheme(themeId);
    sounds.playClickSound();
  }

  function handleVolumeChange(newVol: number) {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolumeState(clamped);
    sounds.setVolume(clamped / 100);
    sounds.playClickSound();
  }

  function handleMuteToggle() {
    const isNowMuted = sounds.toggleMute();
    setMuted(isNowMuted);
  }

  async function handleShareApp() {
    sounds.playClickSound();
    const shareData = {
      title: "Rally - Multiplayer Mini Games",
      text: "Play fun multiplayer mini-games together on Rally!",
      url: typeof window !== "undefined" ? window.location.origin : "https://rallygames.vercel.app",
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.url);
      setToast("App link copied to clipboard!");
      setTimeout(() => setToast(""), 2500);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="paper-card relative w-full max-w-md overflow-hidden bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <h2 className="text-xl font-black tracking-tight">Rally Settings</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-950 bg-slate-100 text-slate-700 transition hover:bg-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Sound & Volume Control */}
          <div className="rounded-2xl border-2 border-slate-950 bg-[#faf9f3] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {muted || volume === 0 ? <VolumeX size={20} className="text-red-500" /> : <Volume2 size={20} className="text-[#7357ff]" />}
                <span className="text-sm font-black uppercase tracking-wider">Audio & Sound</span>
              </div>
              <button
                onClick={handleMuteToggle}
                className={`rounded-full border-2 border-slate-950 px-3 py-1 text-xs font-black transition ${
                  muted ? "bg-red-200 text-red-900" : "bg-[#f4dc69]"
                }`}
              >
                {muted ? "MUTED" : "ON"}
              </button>
            </div>

            {/* Volume Controls */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Volume Level</span>
                <span className="font-mono text-sm font-black">{volume}%</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleVolumeChange(volume - 10)}
                  disabled={muted}
                  className="grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-950 bg-white font-black hover:bg-slate-100 disabled:opacity-40"
                >
                  -
                </button>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  disabled={muted}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="h-3 flex-1 cursor-pointer appearance-none rounded-lg border-2 border-slate-950 bg-slate-200 accent-[#7357ff] disabled:opacity-40"
                />

                <button
                  onClick={() => handleVolumeChange(volume + 10)}
                  disabled={muted}
                  className="grid h-9 w-9 place-items-center rounded-xl border-2 border-slate-950 bg-white font-black hover:bg-slate-100 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Theme Control */}
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Color Theme</span>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {THEMES.map((theme) => {
                const Icon = theme.icon;
                const isSelected = currentTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`flex items-center gap-3 rounded-2xl border-2 border-slate-950 p-3 text-left font-black transition ${
                      isSelected ? "bg-amber-100 shadow-[3px_3px_0_#171821]" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${theme.preview} text-white shadow-sm`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{theme.name}</span>
                    </div>
                    {isSelected && <Check size={16} className="text-[#7357ff]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Share App Action */}
          <div className="border-t-2 border-slate-100 pt-4">
            <button
              onClick={handleShareApp}
              className="arcade-button w-full bg-[#7357ff] text-white shadow-[4px_4px_0_#171821] hover:bg-[#5b3df0]"
            >
              <Share2 size={18} />
              <span>SHARE RALLY APP</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-5 py-2.5 text-xs font-black shadow-[3px_3px_0_#171821] animate-in fade-in slide-in-from-bottom-3">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
