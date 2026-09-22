"use client";

import {  useCallback, useEffect, useState, useSyncExternalStore , type ReactNode } from "react";
import { Smartphone } from "lucide-react";

function isPortraitMobileNow(): boolean {
  if (typeof window === "undefined") return false;
  const isMobileDevice =
    window.innerWidth <= 900 ||
    window.matchMedia("(pointer: coarse)").matches ||
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isPortrait = window.innerHeight > window.innerWidth;
  return isMobileDevice && isPortrait;
}

function subscribeOrientation(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onStoreChange);
  document.addEventListener("fullscreenchange", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
    document.removeEventListener("fullscreenchange", onStoreChange);
  };
}

async function requestLandscapeMode(): Promise<boolean> {
  if (typeof window === "undefined" || typeof screen === "undefined") return false;

  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        await el.requestFullscreen().catch(() => undefined);
      } else if (el.webkitRequestFullscreen) {
        await Promise.resolve(el.webkitRequestFullscreen());
      }
    }
  } catch {
    /* fullscreen may be blocked */
  }

  try {
    const orient = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (typeof orient?.lock === "function") {
      await orient.lock("landscape");
      return true;
    }
  } catch {
    /* orientation lock may be blocked */
  }

  try {
    const legacy = screen as Screen & {
      lockOrientation?: (o: string) => boolean;
      mozLockOrientation?: (o: string) => boolean;
      msLockOrientation?: (o: string) => boolean;
    };
    if (typeof legacy.lockOrientation === "function") return !!legacy.lockOrientation("landscape");
    if (typeof legacy.mozLockOrientation === "function") return !!legacy.mozLockOrientation("landscape");
    if (typeof legacy.msLockOrientation === "function") return !!legacy.msLockOrientation("landscape");
  } catch {
    /* ignore */
  }
  return false;
}

export function MobileOrientationOverlay({ children }: { children: ReactNode }) {
  const isPortraitMobile = useSyncExternalStore(
    subscribeOrientation,
    isPortraitMobileNow,
    () => false
  );
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    void requestLandscapeMode();
    return () => {
      try {
        screen.orientation?.unlock?.();
      } catch {
        /* ignore */
      }
      try {
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  const handleEnterLandscape = useCallback(async () => {
    setLocking(true);
    try {
      await requestLandscapeMode();
    } finally {
      setLocking(false);
    }
  }, []);

  if (isPortraitMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 shadow-2xl shadow-red-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-900">
              <Smartphone
                className="h-10 w-10 animate-spin text-amber-400"
                style={{ animationDuration: "3.5s" }}
              />
            </div>
          </div>
        </div>
        <span className="rounded-full bg-red-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-red-400">
          🏎️ Landscape mode
        </span>
        <h2 className="mt-4 text-2xl font-black tracking-tight">Rotate your phone</h2>
        <p className="mt-2 max-w-xs text-sm font-semibold text-slate-400">
          Rally Racing runs in landscape. We&apos;ll lock orientation when the browser allows it.
        </p>
        <button
          type="button"
          onClick={() => void handleEnterLandscape()}
          disabled={locking}
          className="mt-6 rounded-2xl border-2 border-slate-950 bg-amber-400 px-6 py-3 text-sm font-black text-slate-950 shadow-[4px_4px_0_#000] active:translate-y-0.5 disabled:opacity-60"
        >
          {locking ? "Switching…" : "Enter landscape"}
        </button>
        <p className="mt-3 max-w-xs text-[11px] font-semibold text-slate-500">
          If nothing happens, turn the phone sideways — the race opens automatically.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
