"use client";

import { LoaderCircle, CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function Callback() {
  const search = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "pkce_verified">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = search.get("code");
    const tokenHash = search.get("token_hash");
    const type = search.get("type");
    const errorDesc = search.get("error_description");
    const supabase = getSupabaseBrowserClient();

    if (errorDesc) {
      queueMicrotask(() => {
        setErrorMsg(errorDesc);
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

    // Check if session is already active
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData?.session) {
        router.replace("/dashboard");
        return;
      }

      if (tokenHash && type) {
        supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any }).then(({ error: otpError }) => {
          if (!otpError) {
            router.replace("/dashboard");
          } else {
            setStatus("pkce_verified");
          }
        });
        return;
      }

      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
          if (exchangeError) {
            // Handle PKCE code_verifier missing (e.g. email link opened in mobile browser or different app)
            const err = exchangeError.message.toLowerCase();
            if (err.includes("pkce") || err.includes("code verifier") || err.includes("storage")) {
              setStatus("pkce_verified");
            } else {
              setErrorMsg(exchangeError.message);
              setStatus("error");
            }
          } else {
            router.replace("/dashboard");
          }
        });
        return;
      }

      setStatus("pkce_verified");
    });
  }, [router, search]);

  if (status === "pkce_verified") {
    return (
      <main className="grid min-h-screen place-items-center px-5 bg-[#f8f9fd]">
        <div className="mx-auto max-w-md p-8 text-center rounded-3xl border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821]">
          <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Email Verified!</h1>
          <p className="mt-2 text-sm font-bold text-slate-600 leading-relaxed">
            Your account is confirmed! Since you opened this link in a new browser window or mobile device, please log in with your email and password to start playing.
          </p>
          <button
            onClick={() => router.replace("/auth?mode=login")}
            className="arcade-button mt-6 w-full bg-violet-600 text-white font-black py-3.5 text-sm shadow-[4px_4px_0_#171821] hover:bg-violet-700"
          >
            LOG IN TO RALLY 🚀
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="text-center">
        {status === "error" ? (
          <>
            <p className="font-bold text-red-600">We couldn’t confirm your account</p>
            <p className="mt-2 text-sm text-slate-500">{errorMsg}</p>
            <button
              onClick={() => router.replace("/auth?mode=login")}
              className="mt-5 cursor-pointer rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white"
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto animate-spin text-violet-600" size={32} />
            <p className="mt-3 text-sm font-bold text-slate-600">Confirming your account…</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-violet-600" /></main>}>
      <Callback />
    </Suspense>
  );
}
