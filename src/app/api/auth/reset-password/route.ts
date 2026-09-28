import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase environment variables missing" }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a recovery token that we embed as token_hash in our own app link.
    // Query-param links survive mobile in-app browsers; hash tokens often do not.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (linkError) {
      // Do not reveal whether the email exists
      console.error("reset-password generateLink", linkError.message);
      return NextResponse.json({
        success: true,
        message: "If an account uses that email, a password-reset link is on its way.",
      });
    }

    const hashedToken = linkData.properties?.hashed_token;
    if (!hashedToken) {
      return NextResponse.json({ error: "Failed to generate recovery link" }, { status: 500 });
    }

    const resetUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent("/auth/update-password")}`;

    const emailHtml = `
      <div style="font-family: sans-serif; background-color: #f8f9fd; padding: 40px 16px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 24px; border: 2px solid #0f172a; box-shadow: 6px 6px 0 #0f172a;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔐</div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin-bottom: 8px;">Reset your Rally password</h1>
          <p style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 24px; line-height: 1.5;">
            Tap the button below to choose a new password. This link works in any browser — including your phone’s mail app.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 14px; font-size: 14px;">
            Reset password
          </a>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px; line-height: 1.5; word-break: break-all;">
            Or copy this link:<br/>${resetUrl}
          </p>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 28px;">
            If you didn’t request a password reset, you can ignore this email.
          </p>
        </div>
      </div>
    `;

    if (brevoApiKey) {
      const senderEmail =
        process.env.BREVO_SENDER_EMAIL || process.env.SMTP_SENDER_EMAIL || "princemaccarthy006@gmail.com";
      const senderName = process.env.BREVO_SENDER_NAME || "Rally";

      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject: "Reset your Rally password 🔐",
          htmlContent: emailHtml,
        }),
      });

      if (!brevoRes.ok) {
        const brevoErr = await brevoRes.json().catch(() => ({ message: "Brevo API error" }));
        return NextResponse.json(
          { error: brevoErr.message || "Failed to send email via Brevo API" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "If an account uses that email, a password-reset link is on its way. Check inbox and spam.",
        sentVia: "brevo",
      });
    }

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const from = process.env.RESEND_FROM_EMAIL || "Rally Arcade <onboarding@resend.dev>";
      const { error: resendError } = await resend.emails.send({
        from,
        to: [email],
        subject: "Reset your Rally password 🔐",
        html: emailHtml,
      });

      if (resendError) {
        return NextResponse.json({ error: resendError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "If an account uses that email, a password-reset link is on its way. Check inbox and spam.",
        sentVia: "resend",
      });
    }

    // No outbound mail provider — fall back to Supabase's built-in recovery email
    const { error: sbError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/update-password`,
    });
    if (sbError) {
      console.error("resetPasswordForEmail fallback", sbError.message);
    }

    return NextResponse.json({
      success: true,
      message: "If an account uses that email, a password-reset link is on its way. Check inbox and spam.",
      sentVia: "supabase",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process password reset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
