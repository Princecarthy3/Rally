"use client";

import { useEffect, useState } from "react";

type NetworkState = "connected" | "offline" | "restored";

export function NetworkStatus() {
  const [state, setState] = useState<NetworkState>(() => typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "connected");

  useEffect(() => {
    const update = () => setState("restored");
    const goOffline = () => setState("offline");
    window.addEventListener("online", update);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (state !== "restored") return;
    const timer = setTimeout(() => setState("connected"), 3000);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "connected") return null;
  return <div className={`fixed inset-x-0 top-0 z-[70] px-4 py-2 text-center text-xs font-black text-white ${state === "offline" ? "bg-red-600" : "bg-emerald-600"}`}>{state === "offline" ? "No internet connection" : "Internet connection restored"}</div>;
}
