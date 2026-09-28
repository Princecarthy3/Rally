import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(raw: string | null) {
  if (!raw) return "/auth/update-password";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/auth/update-password";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") || "recovery";
  const next = safeNext(searchParams.get("next"));

  if (!tokenHash) {
    const dest = new URL("/auth/update-password", origin);
    dest.searchParams.set("error", "Missing recovery token. Request a new password reset.");
    return NextResponse.redirect(dest);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?mode=login", origin));
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
  });

  if (error) {
    const dest = new URL("/auth/update-password", origin);
    dest.searchParams.set("error", error.message || "Invalid or expired recovery link.");
    return NextResponse.redirect(dest);
  }

  // Session cookies are set by the server client. Recovery → password form.
  const dest =
    type === "recovery" || next.includes("update-password")
      ? "/auth/update-password"
      : next;

  return NextResponse.redirect(new URL(dest, origin));
}
