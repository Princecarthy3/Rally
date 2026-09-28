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
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://rallygames.vercel.app";

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * Generate a Supabase recovery link.
     *
     * We use generateLink() because Rally sends the email
     * itself through Brevo/Resend.
     */
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${siteUrl}/auth/confirm`,
        },
      });

    /*
     * Do not reveal whether an email exists.
     */
    if (linkError) {
      console.error(
        "Supabase generateLink error:",
        linkError.message
      );

      return NextResponse.json({
        success: true,
        message:
          "If an account uses that email, a password-reset link is on its way. Check your inbox and spam folder.",
      });
    }

    const hashedToken = linkData.properties?.hashed_token;

    if (!hashedToken) {
      console.error("Supabase did not return hashed_token");

      return NextResponse.json(
        { error: "Failed to generate recovery link" },
        { status: 500 }
      );
    }

    /*
     * This is the ONLY link we put inside the Rally email.
     *
     * /auth/confirm will verify the token and establish
     * the Supabase recovery session.
     */
    const resetUrl =
      `${siteUrl}/auth/confirm` +
      `?token_hash=${encodeURIComponent(hashedToken)}` +
      `&type=recovery` +
      `&next=${encodeURIComponent("/auth/update-password")}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <body
          style="
            margin:0;
            padding:0;
            background:#f8f9fd;
            font-family:Arial,Helvetica,sans-serif;
          "
        >
          <div
            style="
              padding:40px 16px;
              text-align:center;
            "
          >
            <div
              style="
                max-width:480px;
                margin:0 auto;
                background:#ffffff;
                padding:32px;
                border-radius:24px;
                border:2px solid #0f172a;
                box-shadow:6px 6px 0 #0f172a;
              "
            >

              <div
                style="
                  font-size:40px;
                  margin-bottom:12px;
                "
              >
                🔐
              </div>

              <h1
                style="
                  margin:0 0 10px;
                  font-size:26px;
                  font-weight:900;
                  color:#0f172a;
                "
              >
                Reset your Rally password
              </h1>

              <p
                style="
                  font-size:14px;
                  font-weight:600;
                  color:#475569;
                  line-height:1.6;
                  margin:0 0 26px;
                "
              >
                We received a request to reset your Rally password.
                Tap the button below to choose a new password.
              </p>

              <a
                href="${resetUrl}"
                style="
                  display:inline-block;
                  background:#0f172a;
                  color:#ffffff;
                  font-weight:800;
                  text-decoration:none;
                  padding:14px 28px;
                  border-radius:14px;
                  font-size:14px;
                "
              >
                Reset password
              </a>

              <p
                style="
                  font-size:12px;
                  color:#64748b;
                  margin-top:24px;
                  line-height:1.5;
                  word-break:break-all;
                "
              >
                If the button doesn't work, copy and paste this link
                into your browser:
                <br><br>
                ${resetUrl}
              </p>

              <p
                style="
                  font-size:11px;
                  color:#94a3b8;
                  margin-top:28px;
                  line-height:1.5;
                "
              >
                If you didn't request a password reset,
                you can safely ignore this email.
              </p>

              <p
                style="
                  margin-top:20px;
                  font-size:12px;
                  font-weight:800;
                  color:#7c3aed;
                "
              >
                Rally 🎮
              </p>

            </div>
          </div>
        </body>
      </html>
    `;

    /*
     * --------------------------------------------------
     * BREVO
     * --------------------------------------------------
     */
    if (brevoApiKey) {
      const senderEmail =
        process.env.BREVO_SENDER_EMAIL ||
        process.env.SMTP_SENDER_EMAIL ||
        "princemaccarthy006@gmail.com";

      const senderName =
        process.env.BREVO_SENDER_NAME || "Rally";

      const brevoResponse = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
          method: "POST",
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: senderName,
              email: senderEmail,
            },
            to: [
              {
                email,
              },
            ],
            subject: "Reset your Rally password 🔐",
            htmlContent: emailHtml,
          }),
        }
      );

      if (!brevoResponse.ok) {
        const brevoError = await brevoResponse
          .json()
          .catch(() => ({
            message: "Brevo API error",
          }));

        console.error(
          "Brevo error:",
          brevoError
        );

        return NextResponse.json(
          {
            error:
              brevoError.message ||
              "Failed to send password reset email",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "If an account uses that email, a password-reset link is on its way. Check your inbox and spam folder.",
        sentVia: "brevo",
      });
    }

    /*
     * --------------------------------------------------
     * RESEND FALLBACK
     * --------------------------------------------------
     */
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      const from =
        process.env.RESEND_FROM_EMAIL ||
        "Rally Arcade <onboarding@resend.dev>";

      const { error: resendError } =
        await resend.emails.send({
          from,
          to: [email],
          subject: "Reset your Rally password 🔐",
          html: emailHtml,
        });

      if (resendError) {
        console.error(
          "Resend error:",
          resendError.message
        );

        return NextResponse.json(
          { error: resendError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "If an account uses that email, a password-reset link is on its way. Check your inbox and spam folder.",
        sentVia: "resend",
      });
    }

    return NextResponse.json(
      {
        error:
          "No email provider is configured. Configure Brevo or Resend.",
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("Password reset error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process password reset",
      },
      { status: 500 }
    );
  }
}
