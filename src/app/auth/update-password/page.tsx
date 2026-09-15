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

  return (
    <main className="min-h-screen bg-[#f8f9fd] px-5 py-6 sm:px-10">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Brand />
        <Link href="/auth?mode=login" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          Sign in
        </Link>
      </div>
      <div className="mx-auto mt-12 max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset your password</h1>
        <p className="text-gray-600 mb-6">Enter a new password for your account.</p>
        {checkingLink ? (
          <div className="flex items-center justify-center py-12">
            <LoaderCircle className="animate-spin text-violet-600" size={32} />
          </div>
        ) : !ready ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <p>Invalid or expired password recovery link.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 pr-10 text-sm focus:border-violet-500 focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmation"
                type={showPassword ? "text" : "password"}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {message && (
              <div className={`rounded-lg p-4 text-sm ${message.type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center">
          <LoaderCircle className="animate-spin text-violet-600" size={32} />
        </main>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  );
}
