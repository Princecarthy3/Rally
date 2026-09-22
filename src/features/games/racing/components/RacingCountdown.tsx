"use client";

import { useEffect, useState } from "react";
import { sounds } from "@/lib/audio";

export function RacingCountdown({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState<number | string>(3);

  useEffect(() => {
    sounds.playCountdownBeep(false);

    const timer1 = setTimeout(() => {
      setCount(2);
      sounds.playCountdownBeep(false);
    }, 1000);

    const timer2 = setTimeout(() => {
      setCount(1);
      sounds.playCountdownBeep(false);
    }, 2000);

    const timer3 = setTimeout(() => {
      setCount("GO!");
      sounds.playCountdownBeep(true);
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex select-none items-center justify-center">
      <div className="animate-bounce text-8xl font-black italic tracking-tighter text-amber-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] sm:text-9xl">
        {count}
      </div>
    </div>
  );
}
