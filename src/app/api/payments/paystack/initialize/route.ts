import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const packages = {
  starter: { coins: 1000, amount: 200 },
  popular: { coins: 4000, amount: 500 },
  pro: { coins: 9500, amount: 1000 },
  mega: { coins: 21500, amount: 2000 },
  ultimate: { coins: 37500, amount: 3000 },
} as const;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !supabaseAnonKey || !paystackSecret || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user?.email) return NextResponse.json({ error: "Sign in before purchasing Rally Coins." }, { status: 401 });

  const body = await request.json().catch(() => null) as { packageId?: string } | null;
  const selected = body?.packageId ? packages[body.packageId as keyof typeof packages] : undefined;
  if (!selected) return NextResponse.json({ error: "Invalid coin package." }, { status: 400 });

  const reference = `rally_${user.id}_${crypto.randomUUID()}`;
  const origin = new URL(request.url).origin;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      amount: selected.amount,
      currency: "GHS",
      reference,
      callback_url: `${origin}/shop?paystack_reference=${encodeURIComponent(reference)}`,
      metadata: { user_id: user.id, package_id: body?.packageId, coins: selected.coins },
    }),
  });
  const result = await response.json() as { status?: boolean; message?: string; data?: { authorization_url?: string } };
  if (!response.ok || !result.status || !result.data?.authorization_url) {
    return NextResponse.json({ error: result.message || "Paystack could not start the payment." }, { status: 502 });
  }
  return NextResponse.json({ authorizationUrl: result.data.authorization_url });
}
