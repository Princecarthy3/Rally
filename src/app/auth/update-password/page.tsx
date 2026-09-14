"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function UpdatePasswordForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCheckingLink(false);
      return;
    }
    const client = supabase;
    let active = true;
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setReady(true);
        setCheckingLink(false);
      }
    });
    const code = search.get("code");

    async function establishRecoverySession() {
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (active) {
          setReady(!error);
          setCheckingLink(false);
        }
        return;
      }

      const { data } = await client.auth.getSession();
      if (active && data.session) {
        setReady(true);
        setCheckingLink(false);
      } else if (active) {
        // With Supabase's implicit flow, the client processes the token in the URL hash
        // asynchronously and then emits PASSWORD_RECOVERY.
        window.setTimeout(() => { if (active) setCheckingLink(false); }, 1200);
      }
    }

    establishRecoverySession();
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [search]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage({ type: "error", text: "Use at least 8 characters for your new password." });
    if (password !== confirmation) return setMessage({ type: "error", text: "The passwords don’t match." });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage({ type: "error", text: error.message });
    else setMessage({ type: "success", text: "Your password has been updated. You can now log in." });
  }

  return <main className="min-h-screen bg-[#f8f9fd] px-5 py-6 sm:px-10"><div className="mx-auto flex max-w-md items-center justify-between"><Brand /><Link href="/auth?mode=login" className="text-sm font-bold text-slate-500 hover:text-slate-950">Back to login</Link></div><section className="mx-auto mt-24 max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><p className="text-sm font-extrabold uppercase tracking-[.16em] text-violet-600">Password recovery</p><h1 className="mt-3 text-4xl font-black tracking-[-.05em] text-slate-950">Choose a new password</h1>{checkingLink ? <div className="mt-7 flex items-center gap-3 text-sm font-medium text-slate-500"><LoaderCircle size={18} className="animate-spin text-violet-600" />Checking your reset link…</div> : !ready ? <div className="mt-7 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This reset link is invalid or has expired. <Link href="/auth/forgot-password" className="font-bold underline">Request a new link</Link>.</div> : <form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold">New password</span><span className="relative block"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="8+ characters" required className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 outline-none transition focus:border-violet-400" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></label><label className="block"><span className="mb-2 block text-sm font-bold">Confirm new password</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" required className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-violet-400" /></label>{message && <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</div>}<button disabled={busy} className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy && <LoaderCircle size={18} className="animate-spin" />}Update password</button></form>}</section></main>;
}

export default function UpdatePasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-violet-600" /></main>}><UpdatePasswordForm /></Suspense>;
}
