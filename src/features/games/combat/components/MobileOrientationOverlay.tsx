"use client";

import { ReactNode, useEffect, useState } from "react";

export function MobileOrientationOverlay({ children }: { children: ReactNode }) {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    function checkOrientation() {
      const isMobile = window.innerWidth <= 850;
      const portrait = isMobile && window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    }

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  return (
    <>
      {isPortrait && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white select-none">
          <span className="text-6xl animate-bounce mb-4">📱🔄</span>
          <h2 className="text-2xl font-black uppercase text-rose-500">Rotate Device</h2>
          <p className="mt-2 max-w-xs text-sm font-medium text-slate-300">
            Rotate your device to landscape to play Rally Combat.
          </p>
        </div>
      )}
      {children}
    </>
  );
}
