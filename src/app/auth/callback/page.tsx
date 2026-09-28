"use client";

import { LoaderCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNext(raw: string | null) {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function parseHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function Callback() {
  const search = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pkce_verified">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const nextPath = safeNext(search.get("next"));

  useEffect(() => {
    const code = search.get("code");
    const tokenHash = search.get("token_hash");
    const type = search.get("type");
    const errorDesc = search.get("error_description") || search.get("error");
    const supabase = getSupabaseBrowserClient();
    const hash = parseHashParams();
    const hashError = hash.get("error_description") || hash.get("error");

    if (errorDesc || hashError) {
      queueMicrotask(() => {
        setErrorMsg(decodeURIComponent(errorDesc || hashError || "Authentication failed."));
        setStatus("error");
      });
      return;
    }

    if (!supabase) {
      queueMicrotask(() => {
        setErrorMsg("Unable to connect to authentication service.");
        setStatus("error");
      });
      return;
    }

    async function run() {
      // Hash tokens from email redirect (implicit recovery flow)
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase!.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          const dest =
            (hash.get("type") === "recovery" || type === "recovery")
              ? "/auth/update-password"
              : nextPath;
          router.replace(dest);
          return;
        }
      }

      const { data: sessionData } = await supabase!.auth.getSession();
      if (sessionData?.session) {
        const dest = type === "recovery" || nextPath.includes("update-password")
          ? (nextPath.includes("update-password") ? nextPath : "/auth/update-password")
          : nextPath;
        router.replace(dest);
        return;
      }

      if (tokenHash && (type || hash.get("type"))) {
        const otpType = (type || hash.get("type") || "recovery") as
          | "recovery"
          | "email"
          | "signup"
          | "invite"
          | "magiclink"
          | "email_change";
        const { error: otpError } = await supabase!.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (!otpError) {
          router.replace(otpType === "recovery" || nextPath.includes("update-password") ? "/auth/update-password" : nextPath);
          return;
        }
        setErrorMsg(otpError.message);
        setStatus("error");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase!.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          const err = exchangeError.message.toLowerCase();
          if (err.includes("pkce") || err.includes("code verifier") || err.includes("storage")) {
            // Email opened in a different browser than the one that requested reset.
            // Send user to update-password; they may still have a session, or can request a new link.
            if (nextPath.includes("update-password")) {
              router.replace("/auth/update-password");
              return;
            }
            setStatus("pkce_verified");
          } else {
            setErrorMsg(exchangeError.message);
            setStatus("error");
          }
        } else {
          router.replace(
            type === "recovery" || nextPath.includes("update-password")
              ? "/auth/update-password"
              : nextPath
          );
        }
        return;
      }

      // No tokens in URL — if next is update-password, still try that page (it has its own recovery logic)
      if (nextPath.includes("update-password")) {
        router.replace("/auth/update-password");
        return;
      }
      setStatus("pkce_verified");
    }

    void run();
  }, [router, search, nextPath]);

  if (status === "pkce_verified") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f9fd] px-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
          <h1 className="mt-4 text-xl font-black text-slate-950">Almost there</h1>
          <p className="mt-2 text-sm text-slate-500">
            Open the reset link in the same browser where you requested it, or request a new password reset.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/auth/forgot-password" className="rounded-2xl bg-slate-950 py-3 text-sm font-bold text-white">
              Request new reset link
            </Link>
            <Link href="/auth?mode=login" className="text-sm font-bold text-violet-600">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f9fd] px-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-slate-950">Link problem</h1>
          <p className="mt-2 text-sm text-red-600">{errorMsg || "Could not complete sign-in."}</p>
          <Link href="/auth/forgot-password" className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">
            Request new reset link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f9fd]">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <LoaderCircle className="animate-spin text-violet-600" size={32} />
        <p className="text-sm font-bold">Finishing sign-in…</p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          <LoaderCircle className="animate-spin text-violet-600" size={32} />
        </main>
      }
    >
      <Callback />
    </Suspense>
  );
}
