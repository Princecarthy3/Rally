"use client";

import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { ConfigNotice } from "@/components/config-notice";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function AuthForm() {
  const search = useSearchParams();
  const router = useRouter();
  const { configured, loading: authLoading, user } = useAuth();
  const [mode, setMode] = useState(search.get("mode") === "signup" ? "signup" : "login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => { if (!authLoading && user) router.replace("/dashboard"); }, [authLoading, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (mode === "signup" && (displayName.trim().length < 2 || displayName.trim().length > 24)) return setMessage({ type: "error", text: "Display name must be 2–24 characters." });
    if (password.length < 8) return setMessage({ type: "error", text: "Use at least 8 characters for your password." });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ type: "error", text: error.message });
      else router.replace("/dashboard");
    } else {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { display_name: displayName.trim() } } });
      if (error) setMessage({ type: "error", text: error.message });
      else if (data.session) router.replace("/dashboard");
      else setMessage({ type: "success", text: "Check your inbox to confirm your email, then come back to play." });
    }
    setBusy(false);
  }

  return <main className="min-h-screen bg-[#f8f9fd] lg:grid lg:grid-cols-2">
    <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute inset-0 opacity-20 dot-grid"/><div className="absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-violet-600/40 blur-3xl"/><div className="relative"><Brand/></div><div className="relative max-w-lg"><div className="mb-8 flex gap-3"><span className="grid h-20 w-20 -rotate-6 place-items-center rounded-3xl bg-orange-100 text-4xl">🏀</span><span className="grid h-20 w-20 rotate-6 place-items-center rounded-3xl bg-violet-100 text-4xl">✊</span></div><h1 className="text-6xl font-black leading-[.95] tracking-[-.06em]">Good games.<br/><span className="text-violet-400">Great company.</span></h1><p className="mt-6 max-w-md text-lg leading-8 text-slate-400">Your profile keeps every win, friendly rivalry, and rematch in one place.</p></div><p className="relative text-sm text-slate-500">Made for friendly competition.</p></section>
    <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10"><div className="flex items-center justify-between lg:justify-end"><div className="lg:hidden"><Brand/></div><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"><ArrowLeft size={16}/> Back home</Link></div><div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12"><p className="text-sm font-extrabold uppercase tracking-[.16em] text-violet-600">{mode === "login" ? "Welcome back" : "Join the fun"}</p><h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-slate-950">{mode === "login" ? "Ready for a rematch?" : "Create your player."}</h2><p className="mt-3 text-slate-500">{mode === "login" ? "Sign in to see your games and stats." : "One account. A growing shelf of games."}</p>
    {!configured ? <div className="mt-8"><ConfigNotice compact/></div> : <form onSubmit={submit} className="mt-8 space-y-5">{mode === "signup" && <label className="block"><span className="mb-2 block text-sm font-bold">Display name</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="How friends will see you" required className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-violet-400"/></label>}<label className="block"><span className="mb-2 block text-sm font-bold">Email</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none transition focus:border-violet-400"/></label><label className="block"><span className="mb-2 block text-sm font-bold">Password</span><span className="relative block"><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?"text":"password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="8+ characters" required className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 outline-none transition focus:border-violet-400"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400">{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>{message && <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message.text}</div>}<button disabled={busy} className="focus-ring flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{busy&&<LoaderCircle size={18} className="animate-spin"/>}{mode === "login" ? "Log in" : "Create account"}</button></form>}
    <p className="mt-7 text-center text-sm text-slate-500">{mode === "login" ? "New around here?" : "Already have an account?"} <button onClick={()=>{setMode(mode === "login" ? "signup":"login");setMessage(null)}} className="cursor-pointer font-bold text-violet-600 hover:underline">{mode === "login" ? "Create an account" : "Log in"}</button></p></div></section>
  </main>;
}

export default function AuthPage(){return <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-violet-600"/></main>}><AuthForm/></Suspense>}
