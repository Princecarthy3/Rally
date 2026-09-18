import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "Payment service is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const validSignature = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: {
      status?: string;
      reference?: string;
      amount?: number;
      currency?: string;
      metadata?: { user_id?: string; package_id?: string };
    };
  };
  const payment = event.data;
  if (event.event !== "charge.success" || payment?.status !== "success" || payment.currency !== "GHS" || !payment.reference || !payment.metadata?.user_id || !payment.metadata.package_id) {
    return NextResponse.json({ received: true });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await adminClient.rpc("credit_paystack_purchase", {
    p_user_id: payment.metadata.user_id,
    p_reference: payment.reference,
    p_package_id: payment.metadata.package_id,
    p_amount_pesewas: payment.amount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ received: true });
}
