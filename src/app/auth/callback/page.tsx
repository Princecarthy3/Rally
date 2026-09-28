"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Fallback UI when the browser lands on /auth/callback with hash tokens
 * (server route cannot read the fragment). Exchanges session client-side.
 */
function CallbackFallback() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const next = search.get("next") || "/dashboard";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

    async function run() {
      if (!supabase) {
        router.replace("/auth?mode=login");
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type") || search.get("type");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        router.replace(type === "recovery" || safeNext.includes("update-password") ? "/auth/update-password" : safeNext);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace(type === "recovery" || safeNext.includes("update-password") ? "/auth/update-password" : safeNext);
        return;
      }

      // Server route should have handled ?code= — if we're here with code, try client exchange
      const code = search.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace(type === "recovery" || safeNext.includes("update-password") ? "/auth/update-password" : safeNext);
          return;
        }
      }

      router.replace(safeNext.includes("update-password") ? "/auth/update-password" : "/auth/forgot-password");
    }

    void run();
  }, [router, search]);

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
      <CallbackFallback />
    </Suspense>
  );
}
