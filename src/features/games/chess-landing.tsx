"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Crown, Users } from "lucide-react";
import { useState } from "react";
import { RoomLauncher } from "@/features/rooms/room-launcher";
import { gameByKey } from "./registry";

export function ChessLanding() {
  const [selected, setSelected] = useState(false);
  return <main className="min-h-screen bg-[#fffdf7] px-5 py-10 sm:py-16"><div className="mx-auto max-w-5xl">
    <Link href="/games" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-950"><ArrowLeft size={16} /> All games</Link>
    <section className="mt-8 overflow-hidden rounded-[36px] border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821]">
      <div className="grid gap-8 bg-gradient-to-br from-violet-100 via-white to-fuchsia-100 p-6 sm:p-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div><p className="inline-flex rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700">Strategy · 2 players</p>
          <h1 className="mt-5 text-5xl font-black tracking-[-.06em] sm:text-6xl">Chess</h1>
          <p className="mt-4 text-xl font-bold text-violet-800">Challenge a friend to a battle of strategy. Every move counts.</p>
          <p className="mt-3 max-w-xl leading-7 text-slate-600">Play a full game of classic chess in real time. Rally checks every move, keeps both boards in sync, and restores the position when you reconnect.</p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-slate-600"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Users size={16} /> Exactly 2 players</span><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2"><Crown size={16} /> White and Black</span></div>
          <button onClick={() => setSelected(true)} className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-violet-600 px-7 py-4 font-black text-white shadow-[4px_4px_0_#171821] transition hover:-translate-y-1">Create a room <ArrowRight size={18} /></button>
        </div>
        <div className="mx-auto grid aspect-square w-full max-w-sm grid-cols-8 overflow-hidden rounded-2xl border-2 border-slate-950 shadow-[5px_5px_0_#171821]" aria-hidden="true">
          {["♜","♞","♝","♛","♚","♝","♞","♜", ...Array(8).fill("♟"), ...Array(32).fill(""), ...Array(8).fill("♙"), "♖","♘","♗","♕","♔","♗","♘","♖"].map((piece, index) => <span key={index} className={`grid aspect-square place-items-center text-[clamp(1.2rem,6vw,2.5rem)] ${(Math.floor(index / 8) + index % 8) % 2 ? "bg-[#7357ff]" : "bg-[#eee7d7]"} ${index < 16 ? "text-slate-950" : "text-white drop-shadow-[0_2px_2px_rgba(15,23,42,.9)]"}`}>{piece}</span>)}
        </div>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8"><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Complete chess rules</p><p className="mt-2 text-sm leading-6 text-slate-600">Castling, en passant, promotion, checkmate, repetition, and draws are handled by the chess rules engine.</p></div><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Live, validated moves</p><p className="mt-2 text-sm leading-6 text-slate-600">Every move is checked against the latest stored position before both players receive it.</p></div><div><p className="text-xs font-black uppercase tracking-wider text-violet-700">Play again</p><p className="mt-2 text-sm leading-6 text-slate-600">Rematch from the room after a result; players swap colors for the next game.</p></div></div>
    </section>
  </div>{selected && <RoomLauncher initialGame={gameByKey.chess} onClose={() => setSelected(false)} />}</main>;
}
