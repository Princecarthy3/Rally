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
    let active = true;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      if (active) setCheckingLink(false);
      return;
    }
    const client = supabase;
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
    if (password !== confirmation) return setMessage({ type: "error", text: "The passwords don't match." });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage({ type: "error", text: error.message });
    else setMessage({ type: "success", text: "Your password has been updated. You can now log in." });
  }

  return <main className="min-h-screen bg-[#f8f9fd] px-5 py-6 sm:px-10"><div className="mx-auto flex max-w-md items-center justify-between"><Brand /><Link href="/auth?mode=login" className="text-s[...]
}

export default function UpdatePasswordPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-violet-600" /></main>}><UpdatePasswordForm /></Suspense>;
}
