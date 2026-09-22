"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

export function MobileOrientationOverlay({ children }: { children: React.ReactNode }) {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    function checkOrientation() {
      if (typeof window === "undefined") return;
      const isMobileDevice = window.innerWidth <= 900 || window.matchMedia("(pointer: coarse)").matches;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsPortraitMobile(isMobileDevice && isPortrait);
    }

    // Try Screen Orientation Lock API where supported
    if (typeof screen !== "undefined" && screen.orientation && "lock" in screen.orientation) {
      (screen.orientation.lock as (orientation: string) => Promise<void>)("landscape").catch(() => {
        // Fallback gracefully if browser policy blocks orientation lock
      });
    }

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
      // Unlock orientation when unmounting
      if (typeof screen !== "undefined" && screen.orientation && "unlock" in screen.orientation) {
        try {
          screen.orientation.unlock();
        } catch {}
      }
    };
  }, []);

  if (isPortraitMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 shadow-2xl shadow-red-500/30">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-900">
              <Smartphone className="h-10 w-10 animate-spin text-amber-400" style={{ animationDuration: "3.5s" }} />
            </div>
          </div>
        </div>
        <span className="rounded-full bg-red-500/20 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-red-400">
          🏎️ Landscape Only
        </span>
        <h2 className="mt-4 text-2xl font-black tracking-tight">Rotate your phone</h2>
        <p className="mt-2 max-w-xs text-sm font-semibold text-slate-400">
          Rally Racing is designed for landscape orientation for maximum visibility and touch control accuracy.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
