import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Rally's Terms of Service.",
  alternates: {
    canonical: "https://rallygames.vercel.app/terms",
  },
};

export default function TermsPage() {
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
          Terms of Service
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Last updated: September 28, 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-600">
          <section>
            <h2 className="text-2xl font-black text-slate-950">
              1. Using Rally
            </h2>

            <p className="mt-3 leading-7">
              By using Rally, you agree to use the service lawfully and
              responsibly and to follow these terms and the Community
              Guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              2. Accounts
            </h2>

            <p className="mt-3 leading-7">
              You are responsible for activity performed through your account
              and for keeping your login credentials secure. Do not impersonate
              another person or create accounts for abusive or fraudulent
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              3. Games and virtual items
            </h2>

            <p className="mt-3 leading-7">
              Rally games, features, virtual items, and other parts of the
              service may change over time. Virtual items or Rally Coins, where
              available, have no cash value unless Rally explicitly states
              otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              4. Prohibited conduct
            </h2>

            <p className="mt-3 leading-7">
              Do not use Rally to harass, threaten, scam, exploit, attack,
              disrupt, or otherwise harm other users or the service. Do not
              attempt to bypass security, manipulate game results, or interfere
              with normal gameplay.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              5. Availability
            </h2>

            <p className="mt-3 leading-7">
              Rally may change, suspend, or discontinue features when necessary.
              We do not guarantee that every feature will always be available
              or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              6. Enforcement
            </h2>

            <p className="mt-3 leading-7">
              Rally may restrict or suspend accounts that violate these terms,
              applicable law, or the Community Guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              7. Changes
            </h2>

            <p className="mt-3 leading-7">
              These terms may be updated as Rally develops. Continued use of
              the service after an update means you accept the revised terms.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
