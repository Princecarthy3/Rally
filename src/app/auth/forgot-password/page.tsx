"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { Brand } from "@/components/brand";
import { ConfigNotice } from "@/components/config-notice";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setBusy(false);
    if (error) setMessage({ type: "error", text: error.message });
    else setMessage({ type: "success", text: "If an account uses that email, a password-reset link is on its way. Check your inbox and spam folder." });
  }

  return <main className="min-h-screen bg-[#f8f9fd] px-5 py-6 sm:px-10"><div className="mx-auto flex max-w-md items-center justify-between"><Brand /><Link href="/auth?mode=login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} />Back to login</Link></div><section className="mx-auto mt-24 max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><p className="text-sm font-extrabold uppercase tracking-[.16em] text-violet-600">Password recovery</p><h1 className="mt-3 text-4xl font-black tracking-[-.05em] text-slate-950">Reset your password</h1><p className="mt-3 text-slate-500">Enter your email and we’ll send a secure link to choose a new password.</p>{!isSupabaseConfigured ? <div className="mt-8"><ConfigNotice compact /></div> : <form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-violet-400" /></label>{message && <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</div>}<button disabled={busy} className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy && <LoaderCircle size={18} className="animate-spin" />}Send reset link</button></form>}</section></main>;
}
