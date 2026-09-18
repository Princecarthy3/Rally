import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !paystackSecret || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Sign in before verifying payment." }, { status: 401 });

  const body = await request.json().catch(() => null) as { reference?: string } | null;
  if (!body?.reference || !body.reference.startsWith(`rally_${user.id}_`)) {
    return NextResponse.json({ error: "Invalid payment reference." }, { status: 400 });
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret}` },
  });
  const result = await response.json() as { status?: boolean; message?: string; data?: { status?: string; reference?: string; amount?: number; currency?: string; metadata?: { user_id?: string; package_id?: string } } };
  const payment = result.data;
  if (!response.ok || !result.status || payment?.status !== "success" || payment.currency !== "GHS" || payment.metadata?.user_id !== user.id) {
    return NextResponse.json({ error: result.message || "Payment was not successful." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient.rpc("credit_paystack_purchase", {
    p_user_id: user.id,
    p_reference: body.reference,
    p_package_id: payment.metadata?.package_id || "",
    p_amount_pesewas: payment.amount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
