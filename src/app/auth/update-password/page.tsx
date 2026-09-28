"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function parseHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const raw = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(raw);
}

function UpdatePasswordForm() {
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let attempts = 0;

    async function establishRecoverySession() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (active) {
          setLinkError("Authentication is not configured.");
          setCheckingLink(false);
        }
        return;
      }

      const client = supabase;

      // Surface errors Supabase puts in the hash or query (expired OTP, etc.)
      const hash = parseHashParams();
      const hashError = hash.get("error_description") || hash.get("error");
      const queryError = search.get("error_description") || search.get("error");
      if (hashError || queryError) {
        if (active) {
          setLinkError(decodeURIComponent(hashError || queryError || "Invalid recovery link."));
          setCheckingLink(false);
        }
        return;
      }

      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setReady(true);
          setCheckingLink(false);
          setLinkError(null);
        }
      });

      try {
        // 0) Session already set by /auth/confirm (token_hash server verify)
        {
          const { data: existing } = await client.auth.getSession();
          if (existing.session) {
            if (active) {
              setReady(true);
              setCheckingLink(false);
              setLinkError(null);
            }
            listener.subscription.unsubscribe();
            return;
          }
        }

        // 1) Implicit / recovery redirect: tokens in the URL hash
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            if (active) {
              setReady(true);
              setCheckingLink(false);
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
            }
            listener.subscription.unsubscribe();
            return;
          }
        }

        // 2) PKCE: ?code=
        const code = search.get("code");
        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (!error) {
            if (active) {
              setReady(true);
              setCheckingLink(false);
            }
            listener.subscription.unsubscribe();
            return;
          }
          // PKCE can fail when the email is opened in a different browser than the one
          // that requested the reset — fall through to other strategies / clearer error.
          if (active && !error.message.toLowerCase().includes("pkce") && !error.message.toLowerCase().includes("verifier")) {
            setLinkError(error.message);
            setCheckingLink(false);
            listener.subscription.unsubscribe();
            return;
          }
        }

        // 3) token_hash + type (email template style)
        const tokenHash = search.get("token_hash") || hash.get("token_hash");
        const type = search.get("type") || hash.get("type") || "recovery";
        if (tokenHash) {
          const { error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
          });
          if (!error) {
            if (active) {
              setReady(true);
              setCheckingLink(false);
            }
            listener.subscription.unsubscribe();
            return;
          }
        }

        // 4) Session may already exist (callback already exchanged the code)
        const trySession = async () => {
          const { data } = await client.auth.getSession();
          if (!active) return;
          if (data.session) {
            setReady(true);
            setCheckingLink(false);
            setLinkError(null);
            return true;
          }
          return false;
        };

        if (await trySession()) {
          listener.subscription.unsubscribe();
          return;
        }

        // Retry a few times — mobile browsers sometimes process the hash slightly late.
        const poll = window.setInterval(async () => {
          attempts += 1;
          if (!active) {
            window.clearInterval(poll);
            return;
          }
          if (await trySession() || attempts >= 8) {
            window.clearInterval(poll);
            if (active && attempts >= 8) {
              setCheckingLink(false);
              setLinkError(
                "This reset link is invalid, expired, or was opened in a different browser. Request a new password reset and open the email link in the same browser."
              );
            }
          }
        }, 400);

        return () => {
          active = false;
          window.clearInterval(poll);
          listener.subscription.unsubscribe();
        };
      } catch (err) {
        if (active) {
          setLinkError(err instanceof Error ? err.message : "Could not verify recovery link.");
          setCheckingLink(false);
        }
        listener.subscription.unsubscribe();
      }
    }

    const cleanup = establishRecoverySession();
    return () => {
      active = false;
      void cleanup.then((fn) => {
        if (typeof fn === "function") fn();
      });
    };
  }, [search]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage({ type: "error", text: "Use at least 8 characters for your password." });
      return;
    }
    if (password !== confirmation) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Password updated. You can sign in with your new password." });
    window.setTimeout(() => {
      window.location.href = "/auth?mode=login";
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-[#f8f9fd] px-5 py-6 sm:px-10">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Brand />
        <Link href="/auth?mode=login" className="text-sm font-bold text-violet-600">
          Sign in
        </Link>
      </div>

      <section className="mx-auto mt-16 max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <h1 className="text-3xl font-black tracking-[-.04em] text-slate-950">Reset your password</h1>
        <p className="mt-2 text-slate-500">Enter a new password for your account.</p>

        {checkingLink ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-slate-500">
            <LoaderCircle className="animate-spin text-violet-600" size={28} />
            <p className="text-sm font-bold">Verifying recovery link…</p>
          </div>
        ) : ready ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold">New password</span>
              <span className="relative block">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 outline-none"
                  placeholder="8+ characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Confirm password</span>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none"
                placeholder="••••••••"
              />
            </label>
            {message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  message.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-4 font-bold text-white disabled:opacity-60"
            >
              {busy && <LoaderCircle size={18} className="animate-spin" />}
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {linkError || "Invalid or expired password recovery link."}
            </div>
            <Link
              href="/auth/forgot-password"
              className="focus-ring flex w-full items-center justify-center rounded-2xl bg-slate-950 py-3.5 text-sm font-bold text-white"
            >
              Request a new reset link
            </Link>
          </div>
        )}
      </section>
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
