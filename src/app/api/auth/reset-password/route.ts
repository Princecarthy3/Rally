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
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Rally</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#080811;
  font-family:Arial, Helvetica, sans-serif;
  color:#ffffff;
">

  <!-- Outer background -->
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      background-color:#080811;
      padding:40px 15px;
    "
  >
    <tr>
      <td align="center">

        <!-- Main card -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:620px;
            background-color:#11111c;
            border:1px solid #292943;
            border-radius:20px;
            overflow:hidden;
          "
        >

          <!-- TOP PURPLE GLOW -->
          <tr>
            <td
              height="6"
              style="
                background-color:#7c3aed;
                background:linear-gradient(
                  90deg,
                  #6d28d9,
                  #8b5cf6,
                  #a855f7
                );
                font-size:0;
                line-height:0;
              "
            >
            </td>
          </tr>


          <!-- HEADER -->
          <tr>
            <td
              align="center"
              style="
                padding:45px 30px 15px;
              "
            >

              <!-- Rally Logo -->
              <div
                style="
                  font-size:44px;
                  font-weight:800;
                  color:#ffffff;
                  letter-spacing:-2px;
                  line-height:1;
                "
              >
                <span style="color:#8b5cf6;">R</span>ally
              </div>

              <div
                style="
                  margin-top:10px;
                  font-size:15px;
                  color:#a7a7bd;
                  letter-spacing:0.3px;
                "
              >
                Play together. Anywhere.
              </div>

            </td>
          </tr>


          <!-- ICON -->
          <tr>
            <td align="center" style="padding:35px 30px 15px;">

              <table
                width="110"
                height="110"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  background-color:#24134f;
                  border:1px solid #6338b5;
                  border-radius:30px;
                "
              >
                <tr>
                  <td
                    align="center"
                    valign="middle"
                    style="
                      font-size:52px;
                      color:#a855f7;
                    "
                  >
                    ✉
                  </td>
                </tr>
              </table>

            </td>
          </tr>


          <!-- MAIN CONTENT -->
          <tr>
            <td
              align="center"
              style="
                padding:25px 45px 20px;
              "
            >

              <!-- Heading -->
              <h1
                style="
                  margin:0 0 12px;
                  font-size:34px;
                  line-height:1.2;
                  font-weight:800;
                  color:#ffffff;
                  letter-spacing:-1px;
                "
              >
                Welcome to Rally!
              </h1>


             


              <!-- Description -->
              <p
                style="
                  margin:0;
                  font-size:16px;
                  line-height:1.8;
                  color:#b9b9ca;
                "
              >
                Thanks for playing our game!
                Use the link below to reset your password

                
              </p>

              

            </td>
          </tr>


          <!-- VERIFY BUTTON -->
          <tr>
            <td align="center" style="padding:25px 30px 30px;">

              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>
                  <td
                    align="center"
                    style="
                      border-radius:14px;
                      background-color:#7c3aed;
                    "
                  >

                    <a
                      href="  ${resetUrl}"
                      style="
                        display:inline-block;
                        padding:17px 42px;
                        border-radius:14px;
                        background-color:#7c3aed;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:17px;
                        font-weight:700;
                        letter-spacing:0.2px;
                      "
                    >
                      Reset Password&nbsp; →
                    </a>

                  </td>
                </tr>
              </table>

            </td>
          </tr>


          <!-- SECURITY NOTICE -->
          <tr>
            <td
              align="center"
              style="
                padding:0 45px 35px;
              "
            >

              <p
                style="
                  margin:0;
                  font-size:13px;
                  line-height:1.7;
                  color:#77778e;
                "
              >
                This Password Reset link is for your Rally account.
                If you didn't request to reset your password, you can safely
                ignore this email.
              </p>

            </td>
          </tr>


          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">

              <div
                style="
                  height:1px;
                  background-color:#29293d;
                  font-size:0;
                  line-height:0;
                "
              >
              </div>

            </td>
          </tr>


          <!-- FEATURES -->
          <tr>
            <td style="padding:35px 25px;">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>

                  <!-- Feature 1 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="padding:0 8px;"
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      ♟
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      Play with<br>friends
                    </div>

                  </td>


                  <!-- Feature 2 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="
                      padding:0 8px;
                      border-left:1px solid #29293d;
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      🎮
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      Discover<br>new games
                    </div>

                  </td>


                  <!-- Feature 3 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="
                      padding:0 8px;
                      border-left:1px solid #29293d;
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      ⚡
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      Quick &<br>easy setup
                    </div>

                  </td>


                  <!-- Feature 4 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="
                      padding:0 8px;
                      border-left:1px solid #29293d;
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      ♡
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      A community<br>that plays
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>
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

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px;
                background-color:#0c0c15;
                border-top:1px solid #29293d;
              "
            >

              <div
                style="
                  font-size:24px;
                  font-weight:800;
                  color:#ffffff;
                  margin-bottom:10px;
                "
              >
                <span style="color:#8b5cf6;">R</span>ally
              </div>


              <p
                style="
                  margin:0 0 8px;
                  font-size:12px;
                  color:#77778e;
                "
              >
                © 2026 Rally | Developed By Carthy. Play together, anywhere.
              </p>


              <p
                style="
                  margin:0;
                  font-size:11px;
                  line-height:1.6;
                  color:#555568;
                "
              >
                This is an automated email. Please do not reply.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Rally</title>
</head>

<body style="
  margin:0;
  padding:0;
  background-color:#080811;
  font-family:Arial, Helvetica, sans-serif;
  color:#ffffff;
">

  <!-- Outer background -->
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      background-color:#8b5cf6;
      padding:40px 15px;
    "
  >
    <tr>
      <td align="center">

        <!-- Main card -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:620px;
            background-color:#11111c;
            border:1px solid #292943;
            border-radius:20px;
            overflow:hidden;
          "
        >

          <!-- TOP PURPLE GLOW -->
          <tr>
            <td
              height="6"
              style="
                background-color:#7c3aed;
                background:linear-gradient(
                  90deg,
                  #6d28d9,
                  #8b5cf6,
                  #a855f7
                );
                font-size:0;
                line-height:0;
              "
            >
            </td>
          </tr>


          <!-- HEADER -->
          <tr>
            <td
              align="center"
              style="
                padding:45px 30px 15px;
              "
            >

              <!-- Rally Logo -->
              <div
                style="
                  font-size:44px;
                  font-weight:800;
                  color:#ffffff;
                  letter-spacing:-2px;
                  line-height:1;
                "
              >
                <span style="color:#8b5cf6;">R</span>ally
              </div>

              <div
                style="
                  margin-top:10px;
                  font-size:15px;
                  color:#a7a7bd;
                  letter-spacing:0.3px;
                "
              >
                Play together. Anywhere.
              </div>

            </td>
          </tr>


          <!-- ICON -->
          <tr>
            <td align="center" style="padding:35px 30px 15px;">

              <table
                width="110"
                height="110"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  background-color:#24134f;
                  border:1px solid #6338b5;
                  border-radius:30px;
                "
              >
                <tr>
                  <td
                    align="center"
                    valign="middle"
                    style="
                      font-size:52px;
                      color:#a855f7;
                    "
                  >
                   <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-violet-600 text-lg text-white shadow-[0_8px_24px_rgba(108,71,255,.28)] transition-transform group-hover:-rotate-6 group-hover:scale-105">
        ✦
      </span>
                  </td>
                </tr>
              </table>

            </td>
          </tr>


          <!-- MAIN CONTENT -->
          <tr>
            <td
              align="center"
              style="
                padding:25px 45px 20px;
              "
            >

              <!-- Heading -->
              <h1
                style="
                  margin:0 0 12px;
                  font-size:34px;
                  line-height:1.2;
                  font-weight:800;
                  color:#ffffff;
                  letter-spacing:-1px;
                "
              >
                Welcome to Rally!
              </h1>


             


              <!-- Description -->
              <p
                style="
                  margin:0;
                  font-size:16px;
                  line-height:1.8;
                  color:#b9b9ca;
                "
              >
                Thanks for playing our game!
                Use the link below to reset your password

                
              </p>

              

            </td>
          </tr>


          <!-- VERIFY BUTTON -->
          <tr>
            <td align="center" style="padding:25px 30px 30px;">

              <table
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>
                  <td
                    align="center"
                    style="
                      border-radius:14px;
                      background-color:#7c3aed;
                    "
                  >

                    <a
                      href="  ${resetUrl}"
                      style="
                        display:inline-block;
                        padding:17px 42px;
                        border-radius:14px;
                        background-color:#7c3aed;
                        color:#ffffff;
                        text-decoration:none;
                        font-size:17px;
                        font-weight:700;
                        letter-spacing:0.2px;
                      "
                    >
                      Reset Password&nbsp; →
                    </a>

                  </td>
                </tr>
              </table>

            </td>
          </tr>


          <!-- SECURITY NOTICE -->
          <tr>
            <td
              align="center"
              style="
                padding:0 45px 35px;
              "
            >

              <p
                style="
                  margin:0;
                  font-size:13px;
                  line-height:1.7;
                  color:#77778e;
                "
              >
                This Password Reset link is for your Rally account.
                If you didn't request to reset your password, you can safely
                ignore this email.
              </p>
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
            </td>
          </tr>


          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 40px;">

              <div
                style="
                  height:1px;
                  background-color:#29293d;
                  font-size:0;
                  line-height:0;
                "
              >
              </div>

            </td>
          </tr>


          <!-- FEATURES -->
          <tr>
            <td style="padding:35px 25px;">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>

                  <!-- Feature 1 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="padding:0 8px;"
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      ♟
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      Play with<br>friends
                    </div>

                  </td>


                  <!-- Feature 2 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="
                      padding:0 8px;
                      border-left:1px solid #29293d;
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      🎮
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      Discover<br>new games
                    </div>

                  </td>


                  <!-- Feature 3 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="
                      padding:0 8px;
                      border-left:1px solid #29293d;
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      ⚡
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      Quick &<br>easy setup
                    </div>

                  </td>


                  <!-- Feature 4 -->
                  <td
                    width="25%"
                    align="center"
                    valign="top"
                    style="
                      padding:0 8px;
                      border-left:1px solid #29293d;
                    "
                  >

                    <div
                      style="
                        font-size:28px;
                        color:#8b5cf6;
                        margin-bottom:10px;
                      "
                    >
                      ♡
                    </div>

                    <div
                      style="
                        font-size:13px;
                        line-height:1.4;
                        color:#ffffff;
                        font-weight:600;
                      "
                    >
                      A community<br>that plays
                    </div>

                  </td>

                </tr>
              </table>

            </td>
          </tr>
           

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              style="
                padding:28px 30px;
                background-color:#0c0c15;
                border-top:1px solid #29293d;
              "
            >

              <div
                style="
                  font-size:24px;
                  font-weight:800;
                  color:#ffffff;
                  margin-bottom:10px;
                "
              >
                <span style="color:#8b5cf6;">R</span>ally
              </div>


              <p
                style="
                  margin:0 0 8px;
                  font-size:12px;
                  color:#77778e;
                "
              >
                © 2026 Rally | Developed By Carthy. Play together, anywhere.
              </p>


              <p
                style="
                  margin:0;
                  font-size:11px;
                  line-height:1.6;
                  color:#555568;
                "
              >
                This is an automated email. Please do not reply.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

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
