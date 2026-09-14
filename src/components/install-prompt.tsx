"use client";

import {
  Download,
  Share,
  Smartphone,
  X,
  MoreVertical,
  PlusSquare,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
  }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [showPrompt, setShowPrompt] = useState(false);

  const [isStandalone] = useState(() => {
    if (typeof window === "undefined") return false;

    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });

  // =========================================================
  // DEVICE DETECTION
  // =========================================================

  const [device] = useState<"ios" | "android" | "desktop">(() => {
    if (typeof window === "undefined") return "desktop";

    const ua = window.navigator.userAgent.toLowerCase();

    // iPhone / iPad / iPod
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);

    if (isIOS) {
      return "ios";
    }

    // Android
    if (/android/.test(ua)) {
      return "android";
    }

    return "desktop";
  });

  const isIOS = device === "ios";
  const isAndroid = device === "android";
  const isMobile = isIOS || isAndroid;

  // =========================================================
  // INSTALL EVENT
  // =========================================================

  useEffect(() => {
    // Don't show if already installed
    if (isStandalone) return;

    // Don't show on desktop
    if (!isMobile) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();

      const installEvent =
        event as BeforeInstallPromptEvent;

      setDeferredPrompt(installEvent);
      setShowPrompt(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstall
    );

    // Check if user dismissed the prompt
    const dismissed = sessionStorage.getItem(
      "rally_install_dismissed"
    );

    if (!dismissed) {
      /*
       * iOS does not fire beforeinstallprompt.
       *
       * Android normally does, but if the browser
       * doesn't provide it, we still show the
       * manual installation instructions.
       */
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1200);

      return () => {
        clearTimeout(timer);

        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstall
        );
      };
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstall
      );
    };
  }, [isStandalone, isMobile]);

  // =========================================================
  // ANDROID INSTALL
  // =========================================================

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();

      const choiceResult =
        await deferredPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        setShowPrompt(false);
      }
    } catch (error) {
      console.error(
        "Rally installation failed:",
        error
      );
    }

    setDeferredPrompt(null);
  };

  // =========================================================
  // DISMISS
  // =========================================================

  const handleDismiss = () => {
    setShowPrompt(false);

    sessionStorage.setItem(
      "rally_install_dismissed",
      "true"
    );
  };

  // =========================================================
  // DON'T RENDER
  // =========================================================

  if (
    isStandalone ||
    !showPrompt ||
    !isMobile
  ) {
    return null;
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div
      className="
        fixed
        inset-x-4
        bottom-20
        z-50
        mx-auto
        max-w-md
        animate-in
        slide-in-from-bottom
        duration-300
        md:bottom-6
      "
    >
      <div
        className="
          relative
          overflow-hidden
          rounded-3xl
          border-2
          border-slate-950
          bg-slate-950
          p-6
          text-white
          shadow-[6px_6px_0_#7c3aed]
        "
      >
        {/* Purple glow */}
        <div
          className="
            pointer-events-none
            absolute
            -right-12
            -top-12
            h-32
            w-32
            rounded-full
            bg-violet-600/20
            blur-3xl
          "
        />

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="
            absolute
            right-4
            top-4
            z-10
            grid
            h-8
            w-8
            place-items-center
            rounded-full
            bg-white/10
            text-slate-300
            transition
            hover:bg-white/20
            hover:text-white
          "
          aria-label="Dismiss install notice"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="relative flex items-start gap-4">
          <div
            className="
              grid
              h-12
              w-12
              shrink-0
              place-items-center
              rounded-2xl
              bg-violet-600
              text-white
              shadow-[0_0_25px_rgba(124,58,237,0.35)]
            "
          >
            <Smartphone size={25} />
          </div>

          <div className="min-w-0 flex-1 pr-6">

            {/* ANDROID BADGE */}
            {isAndroid && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-violet-500/20
                  px-3
                  py-1
                  text-[11px]
                  font-black
                  uppercase
                  tracking-wider
                  text-violet-300
                "
              >
                <Smartphone size={13} />
                Android App
              </span>
            )}

            {/* IOS BADGE */}
            {isIOS && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-full
                  bg-violet-500/20
                  px-3
                  py-1
                  text-[11px]
                  font-black
                  uppercase
                  tracking-wider
                  text-violet-300
                "
              >
                <Smartphone size={13} />
                iPhone / iPad
              </span>
            )}

            <h3
              className="
                mt-2
                text-lg
                font-black
                tracking-tight
              "
            >
              Install Rally
            </h3>

            <p
              className="
                mt-1
                text-xs
                leading-relaxed
                text-slate-300
              "
            >
              Get faster access to Rally and enjoy
              a full-screen gaming experience right
              from your home screen.
            </p>
          </div>
        </div>

        {/* =================================================
            ANDROID
            ================================================= */}

        {isAndroid && (
          <>
            {deferredPrompt ? (
              /* REAL ANDROID INSTALL BUTTON */
              <div className="relative mt-5 flex gap-3">
                <button
                  onClick={handleInstallClick}
                  className="
                    arcade-button
                    flex-1
                    border-slate-900
                    bg-violet-600
                    py-3
                    text-sm
                    text-white
                    shadow-[3px_3px_0_#171821]
                    transition
                    hover:bg-violet-500
                    active:translate-y-[2px]
                    active:shadow-[1px_1px_0_#171821]
                  "
                >
                  <Download size={17} />
                  INSTALL RALLY
                </button>

                <button
                  onClick={handleDismiss}
                  className="
                    rounded-2xl
                    border
                    border-white/20
                    bg-transparent
                    px-4
                    py-3
                    text-xs
                    font-bold
                    text-slate-300
                    transition
                    hover:bg-white/10
                    hover:text-white
                  "
                >
                  Later
                </button>
              </div>
            ) : (
              /* ANDROID MANUAL INSTALL */
              <div
                className="
                  relative
                  mt-5
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/5
                  p-4
                "
              >
                <p
                  className="
                    flex
                    items-center
                    gap-2
                    font-bold
                    text-violet-300
                  "
                >
                  <MoreVertical size={17} />
                  How to install on Android
                </p>

                <ol
                  className="
                    mt-3
                    space-y-2
                    text-[11px]
                    leading-relaxed
                    text-slate-300
                  "
                >
                  <li className="flex gap-2">
                    <span className="font-bold text-violet-400">
                      1.
                    </span>

                    <span>
                      Tap the{" "}
                      <strong className="text-white">
                        ⋮ menu
                      </strong>{" "}
                      in Chrome.
                    </span>
                  </li>

                  <li className="flex gap-2">
                    <span className="font-bold text-violet-400">
                      2.
                    </span>

                    <span>
                      Select{" "}
                      <strong className="text-white">
                        Add to Home screen
                      </strong>{" "}
                      or{" "}
                      <strong className="text-white">
                        Install app
                      </strong>
                      .
                    </span>
                  </li>
                </ol>

                <button
                  onClick={handleDismiss}
                  className="
                    mt-4
                    w-full
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/5
                    py-2.5
                    text-xs
                    font-bold
                    text-slate-300
                    transition
                    hover:bg-white/10
                  "
                >
                  Got it
                </button>
              </div>
            )}
          </>
        )}

        {/* =================================================
            IOS
            ================================================= */}

        {isIOS && (
          <div
            className="
              relative
              mt-5
              rounded-2xl
              border
              border-white/10
              bg-white/5
              p-4
            "
          >
            <p
              className="
                flex
                items-center
                gap-2
                font-bold
                text-violet-300
              "
            >
              <Share size={17} />
              How to install on iPhone / iPad
            </p>

            <ol
              className="
                mt-3
                space-y-3
                text-[11px]
                leading-relaxed
                text-slate-300
              "
            >
              <li className="flex items-start gap-2">
                <span
                  className="
                    grid
                    h-5
                    w-5
                    shrink-0
                    place-items-center
                    rounded-full
                    bg-violet-600
                    text-[10px]
                    font-black
                    text-white
                  "
                >
                  1
                </span>

                <span>
                  Tap the{" "}
                  <strong className="text-white">
                    Share
                  </strong>{" "}
                  button in Safari.
                </span>
              </li>

              <li className="flex items-start gap-2">
                <span
                  className="
                    grid
                    h-5
                    w-5
                    shrink-0
                    place-items-center
                    rounded-full
                    bg-violet-600
                    text-[10px]
                    font-black
                    text-white
                  "
                >
                  2
                </span>

                <span>
                  Scroll down and tap{" "}
                  <strong className="text-white">
                    Add to Home Screen
                  </strong>
                  .
                </span>
              </li>

              <li className="flex items-start gap-2">
                <span
                  className="
                    grid
                    h-5
                    w-5
                    shrink-0
                    place-items-center
                    rounded-full
                    bg-violet-600
                    text-[10px]
                    font-black
                    text-white
                  "
                >
                  3
                </span>

                <span>
                  Tap{" "}
                  <strong className="text-white">
                    Add
                  </strong>{" "}
                  to finish.
                </span>
              </li>
            </ol>

            <div
              className="
                mt-4
                flex
                items-center
                gap-2
                rounded-xl
                bg-violet-500/10
                px-3
                py-2.5
                text-[10px]
                text-violet-200
              "
            >
              <PlusSquare
                size={15}
                className="shrink-0"
              />

              <span>
                Rally will appear on your home screen
                like a regular app.
              </span>
            </div>

            <button
              onClick={handleDismiss}
              className="
                mt-4
                w-full
                rounded-2xl
                border
                border-white/10
                bg-white/5
                py-2.5
                text-xs
                font-bold
                text-slate-300
                transition
                hover:bg-white/10
              "
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
