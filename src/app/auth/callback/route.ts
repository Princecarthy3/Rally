import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(raw: string | null) {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description") || searchParams.get("error");

  if (errorDescription) {
    const dest = new URL("/auth/update-password", origin);
    dest.searchParams.set("error", errorDescription);
    return NextResponse.redirect(dest);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/auth?mode=login", origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest =
        type === "recovery" || next.includes("update-password")
          ? "/auth/update-password"
          : next;
      return NextResponse.redirect(new URL(dest, origin));
    }
    // Fall through to client page for hash-token / PKCE recovery UI
    const dest = new URL("/auth/update-password", origin);
    dest.searchParams.set("error", error.message);
    return NextResponse.redirect(dest);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery" | "email" | "signup" | "invite" | "magiclink" | "email_change",
    });
    if (!error) {
      const dest = type === "recovery" || next.includes("update-password") ? "/auth/update-password" : next;
      return NextResponse.redirect(new URL(dest, origin));
    }
    const dest = new URL("/auth/update-password", origin);
    dest.searchParams.set("error", error.message);
    return NextResponse.redirect(dest);
  }

  // No server-visible tokens (hash-only recovery). Send to client page that reads the hash.
  if (next.includes("update-password") || type === "recovery") {
    return NextResponse.redirect(new URL("/auth/update-password", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
