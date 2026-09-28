import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Rally",
  description:
    "Learn about Rally, a place for quick online multiplayer games with friends.",
  alternates: {
    canonical: "https://rallygames.vercel.app/about",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfe] px-5 py-16">
      <article className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="font-bold text-violet-600 hover:text-violet-700"
        >
          ← Back to Rally
        </Link>

        <p className="mt-12 text-sm font-extrabold uppercase tracking-[.2em] text-violet-600">
          About Rally
        </p>

        <h1 className="mt-4 text-5xl font-black tracking-[-.05em] text-slate-950">
          Play together. Anywhere.
        </h1>

        <div className="mt-8 space-y-6 text-lg leading-8 text-slate-600">
          <p>
            Rally is an online multiplayer gaming platform built around quick,
            social games you can play with friends from different places.
          </p>

          <p>
            The idea is simple: choose a game, create a private room, share the
            room with your friends, and start playing without complicated setup.
          </p>

          <p>
            Rally is designed for casual competition, friendly rivalries, and
            short game sessions that are easy to jump into.
          </p>
        </div>

        <div className="mt-12 rounded-[28px] bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black text-slate-950">
            What you can do
          </h2>

          <ul className="mt-5 list-disc space-y-3 pl-6 text-slate-600">
            <li>Play multiplayer mini games online.</li>
            <li>Create private rooms for friends.</li>
            <li>Compete in quick games for 2–4 players.</li>
            <li>Build your Rally profile and track your gaming activity.</li>
          </ul>
        </div>
      </article>
    </main>
  );
}
