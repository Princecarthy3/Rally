"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Home, MessageCircle, Trophy, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";

export async function exitRaceFullscreen() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
  try {
    const doc = document as Document & {
      webkitExitFullscreen?: () => void;
      webkitFullscreenElement?: Element | null;
    };
    if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
      doc.webkitExitFullscreen();
    }
  } catch {
    /* ignore */
  }
}

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
] as const;

/**
 * Swipe down from the top (or tap the handle) to open navigation while racing
 * in fullscreen / fixed overlay mode.
 */
export function RaceNavSheet({ onResume }: { onResume?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  const close = useCallback(() => {
    setOpen(false);
    onResume?.();
  }, [onResume]);

  const leaveTo = useCallback(
    async (href: string) => {
      await exitRaceFullscreen();
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (open) close();
        else setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  function onPointerDown(e: React.PointerEvent) {
    startY.current = e.clientY;
    pulling.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pulling.current || startY.current == null) return;
    const dy = e.clientY - startY.current;
    if (dy > 56) {
      setOpen(true);
      pulling.current = false;
      startY.current = null;
    }
  }

  function onPointerUp() {
    pulling.current = false;
    startY.current = null;
  }

  return (
    <>
      {/* Top pull handle — always reachable in fullscreen */}
      <div
        className="pointer-events-auto absolute left-0 right-0 top-0 z-40 flex justify-center"
        style={{ paddingTop: "max(0.25rem, env(safe-area-inset-top))" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          aria-label="Open race menu — swipe down"
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-b-2xl border border-t-0 border-white/20 bg-slate-950/80 px-5 pb-2 pt-1.5 text-white shadow-lg backdrop-blur-md active:bg-slate-900"
        >
          <span className="h-1 w-10 rounded-full bg-white/50" />
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            <ChevronDown className="h-3.5 w-3.5" />
            Swipe for tabs
          </span>
        </button>
      </div>

      {open && (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col justify-start bg-slate-950/70 backdrop-blur-sm">
          <div
            className="mx-auto w-full max-w-md rounded-b-3xl border border-white/15 bg-slate-900 px-4 pb-5 pt-3 text-white shadow-2xl"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Navigation</p>
                <h3 className="text-lg font-black">Rally tabs</h3>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-white/15 bg-slate-800 p-2 hover:bg-slate-700"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-xs font-semibold text-slate-400">
              Swipe down anytime during a race to leave fullscreen and open the app tabs.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.href}
                    type="button"
                    onClick={() => void leaveTo(tab.href)}
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-800/80 px-3 py-3 text-left text-sm font-bold hover:bg-slate-700 active:scale-[0.98]"
                  >
                    <Icon className="h-4 w-4 text-amber-400" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void leaveTo("/")}
              className="mt-3 w-full rounded-2xl bg-amber-400 py-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#000] active:translate-y-0.5"
            >
              Exit race &amp; go home
            </button>

            <button
              type="button"
              onClick={close}
              className="mt-2 w-full rounded-2xl border border-white/15 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/5"
            >
              Resume race
            </button>
          </div>
        </div>
      )}
    </>
  );
}
