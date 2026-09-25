"use client";

import { type ReactNode, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

function isPortraitMobile() {
  if (typeof window === "undefined") return false;
  const mobile = window.innerWidth <= 900 || window.matchMedia("(pointer: coarse)").matches;
  return mobile && window.innerHeight > window.innerWidth;
}

export function MobileOrientationOverlay({ children }: { children: ReactNode }) {
  const isPortrait = useSyncExternalStore(subscribe, isPortraitMobile, () => false);

  if (isPortrait) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white select-none">
        <span className="mb-4 text-6xl">📱🔄</span>
        <h2 className="text-2xl font-black uppercase text-rose-500">Rotate Device</h2>
        <p className="mt-2 max-w-xs text-sm font-medium text-slate-300">
          Rotate your phone to landscape for full-screen Rally Combat.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
