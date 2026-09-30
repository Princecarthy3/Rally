"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Timer, Users } from "lucide-react";
import { useState } from "react";
import { RoomLauncher } from "@/features/rooms/room-launcher";
import { gameByKey } from "./registry";

export function SudokuLanding() {
  const [selected, setSelected] = useState(false);
  return (
    <main className="min-h-screen bg-[#fffdf7] px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/games" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950">
          <ArrowLeft size={16} /> All games
        </Link>
        <section className="mt-8 overflow-hidden rounded-[36px] border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821]">
          <div className="grid gap-8 bg-gradient-to-br from-violet-100 via-white to-indigo-100 p-6 sm:p-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700">
                Puzzle · 1–4 players
              </p>
              <h1 className="mt-5 text-5xl font-black tracking-[-.06em] sm:text-6xl">Sudoku Battle</h1>
              <p className="mt-4 text-xl font-bold text-violet-800">
                Race your friends to solve the same Sudoku puzzle.
              </p>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                Everyone gets one shared, uniquely solvable board. Fill cells, avoid mistakes, and finish before the
                others. Play solo with a Rally bot or invite up to three friends.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-slate-600">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
                  <Users size={16} /> 1–4 players
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2">
                  <Timer size={16} /> 10-minute races
                </span>
              </div>
              <button
                onClick={() => setSelected(true)}
                className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-violet-600 px-7 py-4 font-black text-white shadow-[4px_4px_0_#171821] transition hover:-translate-y-1"
              >
                Create a room <ArrowRight size={18} />
              </button>
            </div>
            <div
              className="mx-auto grid aspect-square w-full max-w-sm grid-cols-9 overflow-hidden rounded-2xl border-2 border-slate-950 shadow-[5px_5px_0_#171821]"
              aria-hidden="true"
            >
              {"530070000600195000098000060800060003400803001700020006060000280000419005000080079"
                .split("")
                .map((ch, index) => {
                  const row = Math.floor(index / 9);
                  const col = index % 9;
                  const thickR = col % 3 === 2 && col !== 8;
                  const thickB = row % 3 === 2 && row !== 8;
                  return (
                    <span
                      key={index}
                      className={`grid place-items-center border border-slate-300 text-sm font-black ${
                        ch === "0" ? "bg-white text-violet-600" : "bg-slate-100 text-slate-950"
                      } ${thickR ? "border-r-2 border-r-slate-950" : ""} ${thickB ? "border-b-2 border-b-slate-950" : ""}`}
                    >
                      {ch === "0" ? "" : ch}
                    </span>
                  );
                })}
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-violet-700">Same puzzle</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                One server-generated board for the whole room — fair race, unique solution.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-violet-700">Private boards</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Opponents see progress only, never your exact numbers.
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-violet-700">Solo ready</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Jump in alone or tap Play Solo to race with a Rally bot.
              </p>
            </div>
          </div>
        </section>
      </div>
      {selected && <RoomLauncher initialGame={gameByKey.sudoku_battle} onClose={() => setSelected(false)} />}
    </main>
  );
}
