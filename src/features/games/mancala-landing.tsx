"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Crown, Users } from "lucide-react";
import { useState } from "react";
import { RoomLauncher } from "@/features/rooms/room-launcher";
import { gameByKey } from "./registry";

const samplePits = [4, 4, 4, 4, 4, 4];

export function MancalaLanding() {
  const [selected, setSelected] = useState(false);
  return (
    <main className="min-h-screen bg-[#fbfaff] px-4 py-8 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link href="/games" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-violet-700">
          <ArrowLeft size={16} /> All games
        </Link>
        <section className="mt-7 overflow-hidden rounded-[32px] border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821] sm:rounded-[36px]">
          <div className="grid gap-8 bg-violet-50 p-5 sm:p-9 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700">Strategy · 2 players</p>
              <h1 className="mt-5 text-5xl font-black tracking-[-.06em] text-slate-950 sm:text-6xl">Mancala</h1>
              <p className="mt-4 text-xl font-black text-violet-800">Classic stones. Smart moves. One winner.</p>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">Sow your stones, capture your opponent&apos;s pieces, and outsmart them to control the board.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Users size={16} /> Exactly 2 players</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Crown size={16} /> 48 stones · Kalah rules</span>
              </div>
              <button onClick={() => setSelected(true)} className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-violet-600 px-7 py-4 font-black text-white shadow-[4px_4px_0_#171821] transition hover:-translate-y-1">
                Create a room <ArrowRight size={18} />
              </button>
            </div>
            <div className="rounded-[28px] border-2 border-slate-950 bg-[#7357ff] p-3 shadow-[5px_5px_0_#171821] sm:p-5" aria-label="Mancala board preview">
              <div className="grid grid-cols-[32px_repeat(6,minmax(0,1fr))_32px] gap-1 sm:grid-cols-[58px_repeat(6,minmax(0,1fr))_58px] sm:gap-2">
                <div className="row-span-2 grid min-h-40 place-items-center rounded-[30px] bg-[#281d3d] text-center text-xs font-black text-white sm:min-h-48">P2<br />0</div>
                {[...samplePits].reverse().map((count, index) => <div key={`top-${index}`} className="grid min-h-[72px] place-items-center rounded-[50%] bg-[#281d3d] text-lg font-black text-white sm:min-h-[88px]">{count}</div>)}
                {samplePits.map((count, index) => <div key={`bottom-${index}`} className="grid min-h-[72px] place-items-center rounded-[50%] bg-[#281d3d] text-lg font-black text-white sm:min-h-[88px]">{count}</div>)}
                <div className="row-span-2 grid min-h-40 place-items-center rounded-[30px] bg-[#281d3d] text-center text-xs font-black text-white sm:min-h-48">P1<br />0</div>
              </div>
              <p className="mt-3 text-center text-[10px] font-black uppercase tracking-widest text-white/80">Sow · Capture · Outsmart</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            <div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Plan each move</p><p className="mt-2 text-sm leading-6 text-slate-600">Distribute stones around the board and aim for your store to earn another turn.</p></div>
            <div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Capture for a lead</p><p className="mt-2 text-sm leading-6 text-slate-600">Finish in an empty pit on your side to sweep its opposite pit into your store.</p></div>
            <div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Validated live play</p><p className="mt-2 text-sm leading-6 text-slate-600">Rally verifies every move and keeps the shared board synchronized in real time.</p></div>
          </div>
        </section>
      </div>
      {selected && <RoomLauncher initialGame={gameByKey.mancala} onClose={() => setSelected(false)} />}
    </main>
  );
}
