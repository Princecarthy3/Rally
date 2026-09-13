"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function Callback() {
  const search = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    const code = search.get("code");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !code) { queueMicrotask(() => setError("This confirmation link is incomplete or expired.")); return; }
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => { if (exchangeError) setError(exchangeError.message); else router.replace("/dashboard"); });
  }, [router, search]);
  return <main className="grid min-h-screen place-items-center px-5"><div className="text-center">{error ? <><p className="font-bold text-red-600">We couldn’t confirm your account</p><p className="mt-2 text-sm text-slate-500">{error}</p><button onClick={()=>router.replace("/auth")} className="mt-5 cursor-pointer rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Back to login</button></> : <><LoaderCircle className="mx-auto animate-spin text-violet-600"/><p className="mt-3 text-sm text-slate-500">Confirming your account…</p></>}</div></main>;
}
export default function AuthCallbackPage(){return <Suspense><Callback/></Suspense>}
