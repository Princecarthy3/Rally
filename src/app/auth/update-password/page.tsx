"use client";

import {
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

import { Brand } from "@/components/brand";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function UpdatePasswordForm() {
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [checkingSession, setCheckingSession] =
    useState(true);

  const [ready, setReady] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState<{
      type: "error" | "success";
      text: string;
    } | null>(null);

  const [linkError, setLinkError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const supabase =
        getSupabaseBrowserClient();

      if (!supabase) {
        if (active) {
          setLinkError(
            "Authentication is not configured."
          );
          setCheckingSession(false);
        }

        return;
      }

      /*
       * /auth/confirm has already verified the
       * recovery token and established the session.
       *
       * We only need to check that the browser can
       * see that session.
       */
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setLinkError(error.message);
        setCheckingSession(false);
        return;
      }

      if (!data.session) {
        setLinkError(
          searchParams.get("error") ||
            "This password reset link is invalid or expired. Please request a new reset link."
        );

        setCheckingSession(false);
        return;
      }

      setReady(true);
      setCheckingSession(false);
      setLinkError(null);
    }

    void checkRecoverySession();

    return () => {
      active = false;
    };
  }, [searchParams]);

  async function submit(event: FormEvent) {
    event.preventDefault();

    setMessage(null);

    if (password.length < 8) {
      setMessage({
        type: "error",
        text: "Use at least 8 characters for your password.",
      });

      return;
    }

    if (password !== confirmation) {
      setMessage({
        type: "error",
        text: "Passwords do not match.",
      });

      return;
    }

    const supabase =
      getSupabaseBrowserClient();

    if (!supabase) {
      setMessage({
        type: "error",
        text: "Authentication is not configured.",
      });

      return;
    }

    setBusy(true);

    const { error } =
      await supabase.auth.updateUser({
        password,
      });

    setBusy(false);

    if (error) {
      setMessage({
        type: "error",
        text: error.message,
      });

      return;
    }

    setMessage({
      type: "success",
      text:
        "Password updated successfully. You can now sign in with your new password.",
    });

    window.setTimeout(() => {
      window.location.href =
        "/auth?mode=login";
    }, 1500);
  }

  return (
    <main className="min-h-screen bg-[#f8f9fd] px-5 py-6 sm:px-10">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Brand />

        <Link
          href="/auth?mode=login"
          className="text-sm font-bold text-violet-600"
        >
          Sign in
        </Link>
      </div>

      <section className="mx-auto mt-16 max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <h1 className="text-3xl font-black tracking-[-.04em] text-slate-950">
          Reset your password
        </h1>

        <p className="mt-2 text-slate-500">
          Enter a new password for your Rally account.
        </p>

        {checkingSession ? (
          <div className="mt-10 flex flex-col items-center gap-3 text-slate-500">
            <LoaderCircle
              className="animate-spin text-violet-600"
              size={28}
            />

            <p className="text-sm font-bold">
              Verifying recovery link…
            </p>
          </div>
        ) : ready ? (
          <form
            onSubmit={submit}
            className="mt-8 space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                New password
              </span>

              <span className="relative block">
                <input
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
                  required
                  className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 outline-none"
                  placeholder="8+ characters"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold">
                Confirm password
              </span>

              <input
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(
                    event.target.value
                  )
                }
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                required
                className="focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 outline-none"
                placeholder="••••••••"
              />
            </label>

            {message && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  message.type === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
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
              {busy && (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              )}

              {busy
                ? "Updating…"
                : "Update password"}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {linkError ||
                "Invalid or expired password recovery link."}
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
          <LoaderCircle
            className="animate-spin text-violet-600"
            size={32}
          />
        </main>
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  );
}
