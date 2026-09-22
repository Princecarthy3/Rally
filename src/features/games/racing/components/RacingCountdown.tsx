"use client";

import { useEffect, useRef, useState } from "react";
import { sounds } from "@/lib/audio";

export function RacingCountdown({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState<number | string>(3);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (ms: number, value: number | string, complete = false) => {
      timers.push(
        setTimeout(() => {
          setCount(value);
          if (complete) {
            sounds.playCountdownBeep(true);
            onCompleteRef.current();
          } else {
            sounds.playCountdownBeep(false);
          }
        }, ms)
      );
    };

    sounds.playCountdownBeep(false);
    schedule(1000, 2);
    schedule(2000, 1);
    schedule(3000, "GO!", true);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex select-none items-center justify-center">
      <div className="animate-bounce text-8xl font-black italic tracking-tighter text-amber-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] sm:text-9xl">
        {count}
      </div>
    </div>
  );
}
