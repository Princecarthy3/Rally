"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock3, Users } from "lucide-react";
import { useState } from "react";
import { RoomLauncher } from "@/features/rooms/room-launcher";
import { gameByKey } from "./registry";

export function EmojiDecodeLanding() {
  const [selected, setSelected] = useState(false);
  return (
    <main className="min-h-screen bg-[#fffdf7] px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/games" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> All games</Link>
        <section className="mt-8 overflow-hidden rounded-[36px] border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821]">
          <div className="grid gap-8 bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 p-6 sm:p-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700">Party · Guessing</p>
              <h1 className="mt-5 text-5xl font-black tracking-[-.06em] sm:text-6xl">Emoji Decode</h1>
              <p className="mt-4 text-xl font-bold text-violet-800">Decode the emojis. Beat your friends.</p>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">Can you figure out what the emojis mean? Decode fresh AI-generated clues and race your friends to the answer across eight fast rounds.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-slate-600"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Users size={16} /> 2–4 players</span><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Clock3 size={16} /> 30 seconds per round</span></div>
              <button onClick={() => setSelected(true)} className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-violet-600 px-7 py-4 font-black text-white shadow-[4px_4px_0_#171821] transition hover:-translate-y-1">Create a room <ArrowRight size={18} /></button>
            </div>
            <div className="grid min-h-64 place-items-center rounded-[28px] border-2 border-slate-950/10 bg-white/65 p-5 text-center sm:min-h-80">
              <div><div className="flex flex-wrap justify-center gap-3 text-6xl sm:text-7xl" aria-label="Example emoji clue"><span>🕷️</span><span>🧑</span><span>🦸</span><span>🏙️</span></div><p className="mt-5 text-sm font-bold text-slate-500">One shared clue. First correct guesses score the most.</p></div>
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8"><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">How to play</p><p className="mt-2 text-sm leading-6 text-slate-600">Submit guesses before time runs out. Answers stay hidden until the round ends.</p></div><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Scoring</p><p className="mt-2 text-sm leading-6 text-slate-600">Earn 100, 75, 50, or 25 points based on your correct-guess order.</p></div><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Play again</p><p className="mt-2 text-sm leading-6 text-slate-600">Play all eight rounds, then rematch your room to try again.</p></div></div>
        </section>
      </div>
      {selected && <RoomLauncher initialGame={gameByKey.emoji_decode} onClose={() => setSelected(false)} />}
    </main>
  );
}
