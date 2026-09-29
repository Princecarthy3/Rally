import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Rally's Privacy Policy.",
  alternates: {
    canonical: "https://rallygames.vercel.app/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfe] px-5 py-16">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="font-bold text-violet-600 hover:text-violet-700"
        >
          ← Back to Rally
        </Link>

        <h1 className="mt-12 text-5xl font-black tracking-[-.05em] text-slate-950">
          Privacy Policy
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Last updated: September 28, 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-600">
          <section>
            <h2 className="text-2xl font-black text-slate-950">
              1. Overview
            </h2>

            <p className="mt-3 leading-7">
              Rally respects your privacy. This policy explains the types of
              information Rally may process when you use the service and how
              that information is used to operate and improve Rally.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              2. Information you provide
            </h2>

            <p className="mt-3 leading-7">
              Depending on the features you use, Rally may process account
              information such as your email address, display name, profile
              information, game activity, and information you provide when
              communicating with other players.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              3. How information is used
            </h2>

            <p className="mt-3 leading-7">
              Information may be used to authenticate accounts, provide
              multiplayer functionality, maintain profiles and game records,
              communicate with users, prevent abuse, secure the service, and
              improve Rally.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              4. Service providers
            </h2>

            <p className="mt-3 leading-7">
              Rally may use third-party services to provide infrastructure,
              authentication, hosting, email, payments, analytics, or other
              necessary functionality. Those providers process information
              according to their own terms and privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              5. Security
            </h2>

            <p className="mt-3 leading-7">
              Rally uses reasonable technical and organizational measures to
              protect information. No internet service can guarantee absolute
              security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              6. Your choices
            </h2>

            <p className="mt-3 leading-7">
              You may contact Rally about questions concerning your account or
              personal information. Some information may need to be retained
              where required for security, legal, or operational purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              7. Contact
            </h2>

            <p className="mt-3 leading-7">
              For privacy questions,enquiries or game suggestions contact Rally via<br />
Email: <a href="mailto:princemaccarthy006@gmail.com">princemaccarthy006@gmail.com</a><br /><br />
WhatsApp:<a href="https://wa.me/233536918893">+233536918893</a>
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
