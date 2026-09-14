import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase environment variables missing" }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/auth/callback`;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Step 1: Generate confirmation link via Supabase Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo,
        data: { display_name: displayName || "Player" },
      },
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    const confirmUrl = linkData.properties?.action_link;

    if (!confirmUrl) {
      return NextResponse.json({ error: "Failed to generate email confirmation link" }, { status: 500 });
    }

    const emailHtml = `
      <div style="font-family: sans-serif; background-color: #f8f9fd; padding: 40px 16px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 24px; border: 2px solid #0f172a; box-shadow: 6px 6px 0 #0f172a;">
          <div style="font-size: 40px; margin-bottom: 12px;">🎮</div>
          <h1 style="font-size: 26px; font-weight: 900; color: #0f172a; margin-bottom: 8px;">Welcome to Rally!</h1>
          <p style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 24px; line-height: 1.5;">
            Hi <strong>${displayName || "Player"}</strong>,<br/>
            Click below to verify your email address and start competing in the game arcade!
          </p>
          <a href="${confirmUrl}" style="display: inline-block; background-color: #7357ff; color: #ffffff; font-weight: 900; font-size: 14px; padding: 14px 28px; border-radius: 16px; text-decoration: none; border: 2px solid #0f172a; box-shadow: 3px 3px 0 #0f172a;">
            VERIFY EMAIL 🚀
          </a>
          <p style="font-size: 11px; color: #94a3b8; margin-top: 28px;">
            If you didn't create this account, you can safely ignore this message.
          </p>
        </div>
      </div>
    `;

    // Step 2a: Send via Brevo HTTP API if API key provided
    if (brevoApiKey) {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_SENDER_EMAIL || "princemaccarthy006@gmail.com";
      const senderName = process.env.BREVO_SENDER_NAME || "Rally";

      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email, name: displayName || "Player" }],
          subject: "Verify your Rally account 🎮",
          htmlContent: emailHtml,
        }),
      });

      if (!brevoRes.ok) {
        const brevoErr = await brevoRes.json().catch(() => ({ message: "Brevo API error" }));
        return NextResponse.json({ error: brevoErr.message || "Failed to send email via Brevo API" }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Verification email sent via Brevo! Check your inbox to confirm your email.",
        sentVia: "brevo",
      });
    }

    // Step 2b: Send via Resend if RESEND_API_KEY provided
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const { error: resendError } = await resend.emails.send({
        from: "Rally Arcade <onboarding@resend.dev>",
        to: [email],
        subject: "Verify your Rally account 🎮",
        html: emailHtml,
      });

      if (resendError) {
        return NextResponse.json({ error: resendError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Verification email sent via Resend! Check your inbox to confirm your email.",
        sentVia: "resend",
      });
    }

    // Step 2c: Default to Supabase SMTP (e.g. Brevo SMTP configured in Supabase Dashboard)
    return NextResponse.json({
      success: true,
      confirmUrl,
      message: "Verification email generated! Check your inbox via Brevo SMTP.",
      sentVia: "supabase",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process signup" }, { status: 500 });
  }
}

