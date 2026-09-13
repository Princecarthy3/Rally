"use client";

import { Download, Share, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (inStandalone) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Listen for Chrome/Android beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show prompt automatically for iOS or desktop if not dismissed in this session
    const dismissed = sessionStorage.getItem("rally_install_dismissed");
    if (!dismissed && (iosDevice || deferredPrompt)) {
      setShowPrompt(true);
    } else if (!dismissed && !iosDevice) {
      // Show default banner fallback after sign-in so user knows it can be installed
      const timer = setTimeout(() => setShowPrompt(true), 1200);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("rally_install_dismissed", "true");
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md animate-in slide-in-from-bottom duration-300 md:bottom-6 md:right-6 md:mx-0">
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-950 bg-slate-950 p-6 text-white shadow-[6px_6px_0_#6c47ff]">
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
          aria-label="Dismiss install notice"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-2xl shadow-lg">
            ✦
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-violet-300">
              <Smartphone size={13} /> Standalone App
            </span>
            <h3 className="mt-2 text-lg font-black tracking-tight">Install Rally on your device</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Add Rally to your home screen for full-screen gameplay, faster load times, and instant access without browser bars!
            </p>
          </div>
        </div>

        {isIOS ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-200">
            <p className="flex items-center gap-2 font-bold text-violet-300">
              <Share size={15} /> How to install on iPhone / iPad:
            </p>
            <ol className="mt-2 space-y-1 text-[11px] text-slate-300">
              <li>1. Tap the <strong>Share button</strong> in Safari menu bar.</li>
              <li>2. Scroll down & select <strong>"Add to Home Screen"</strong>.</li>
            </ol>
          </div>
        ) : (
          <div className="mt-5 flex gap-3">
            <button
              onClick={handleInstallClick}
              className="arcade-button flex-1 bg-violet-600 text-white border-slate-900 shadow-[3px_3px_0_#171821] py-3 text-sm"
            >
              <Download size={16} /> {deferredPrompt ? "INSTALL APP NOW" : "ADD TO HOME SCREEN"}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-2xl border border-white/20 bg-transparent px-4 py-3 text-xs font-bold text-slate-300 hover:bg-white/10"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
