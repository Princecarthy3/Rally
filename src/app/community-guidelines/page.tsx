import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description:
    "Rally's Community Guidelines for safe and respectful multiplayer gaming.",
  alternates: {
    canonical: "https://rallygames.vercel.app/community-guidelines",
  },
};

export default function CommunityGuidelinesPage() {
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
          Community Guidelines
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Last updated: September 28, 2026
        </p>

        <div className="mt-8 space-y-8 text-slate-600">
          <section>
            <h2 className="text-2xl font-black text-slate-950">
              Be respectful
            </h2>

            <p className="mt-3 leading-7">
              Treat other players with respect. Harassment, bullying,
              intimidation, hateful conduct, and targeted abuse are not
              welcome on Rally.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              Keep games fair
            </h2>

            <p className="mt-3 leading-7">
              Do not cheat, exploit bugs, manipulate game results, use
              unauthorized automation, or deliberately interfere with another
              player's experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              No scams or harmful activity
            </h2>

            <p className="mt-3 leading-7">
              Do not use Rally to scam users, steal accounts, distribute
              malicious content, impersonate others, or facilitate illegal
              activity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              Protect personal information
            </h2>

            <p className="mt-3 leading-7">
              Avoid sharing sensitive personal information in public or
              multiplayer spaces. Do not publish another person's private
              information without permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-slate-950">
              Enforcement
            </h2>

            <p className="mt-3 leading-7">
              Content or accounts that violate these guidelines may be
              restricted, removed, or suspended. Serious or repeated violations
              may result in loss of access to Rally.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
