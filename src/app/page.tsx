import { ArrowRight, Check, Link2, MessageCircle, Radio, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";

const games = [
  { icon: "✊", title: "Rock Paper Scissors", text: "Classic. Quick. Clever.", color: "bg-[#eee9ff]", tilt: "rotate-1" },
  { icon: "🔢", title: "Number Hunt", text: "Read their mind", color: "bg-[#e8f2ff]", tilt: "-rotate-1" },
  { icon: "⭕", title: "Tic-Tac-Toe", text: "Three in a row", color: "bg-[#ffe7eb]", tilt: "rotate-1" },
  { icon: "🔲", title: "Dots & Boxes", text: "Claim the grid", color: "bg-[#e4f8ef]", tilt: "rotate-2" },
  { icon: "🎨", title: "Draw & Guess", text: "Sketch it before time runs out", color: "bg-[#fff6c9]", tilt: "-rotate-2" },
];

function GitHubLogo() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .7a11.3 11.3 0 0 0-3.57 22.02c.57.1.77-.24.77-.55v-2.15c-3.14.68-3.8-1.33-3.8-1.33-.5-1.3-1.25-1.64-1.25-1.64-1.03-.7.08-.69.08-.69 1.13.08 1.73 1.17 1.73 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.4-1.23.72-1.51-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16A10.8 10.8 0 0 1 12 6.2c.96 0 1.92.13 2.82.38 2.15-1.46 3.1-1.16 3.1-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.63 5.28-5.14 5.56.41.35.77 1.02.77 2.06v3.06c0 .3.2.66.78.55A11.3 11.3 0 0 0 12 .7Z" /></svg>;
}

function InstagramLogo() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none" /></svg>;
}

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-[#fbfbfe]">
      <header className="relative z-30 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-10">
        <Brand />
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 md:flex"><a href="#games" className="hover:text-slate-950">Games</a><a href="#how" className="hover:text-slate-950">How it works</a></nav>
        <Link href="/auth?mode=login" className="focus-ring rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">Log in</Link>
      </header>

      <section className="hero-glow dot-grid relative min-h-[760px] px-5 pb-24 pt-16 text-center md:pt-24">
        <div className="absolute left-[8%] top-32 hidden h-24 w-24 place-items-center rounded-[28px] bg-[#fff0df] text-5xl shadow-xl shadow-orange-200/30 lg:grid animate-float">🏀</div>
        <div className="absolute right-[9%] top-52 hidden h-24 w-24 place-items-center rounded-[28px] bg-[#e3f7ee] text-5xl shadow-xl shadow-emerald-200/30 lg:grid animate-float-two">🏓</div>
        <div className="absolute bottom-36 left-[16%] hidden h-20 w-20 place-items-center rounded-[24px] bg-[#e7f1ff] text-4xl shadow-xl lg:grid animate-float-two">🔢</div>
        <div className="relative mx-auto max-w-4xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-4 py-2 text-xs font-black uppercase tracking-[.12em] text-slate-950 shadow-[3px_3px_0_#171821]"><Sparkles size={14} /> Made for 2–4 friends</div>
          <h1 className="balance mt-7 text-[clamp(3.3rem,9vw,7.4rem)] font-black leading-[.88] tracking-[-.075em] text-[#171821]">Play together.<br/><span className="text-violet-600">Anywhere.</span></h1>
          <p className="balance mx-auto mt-8 max-w-xl text-[17px] leading-7 text-slate-500 md:text-xl md:leading-8">Quick games, big bragging rights. Invite a friend and turn any moment into game time.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/auth?mode=signup" className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-8 py-4 font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,.2)] transition hover:-translate-y-1 sm:w-auto">Play now <ArrowRight size={18}/></Link><a href="https://discord.gg/y9aVcCgj9" target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#5865F2] px-8 py-4 font-bold text-white transition hover:-translate-y-1 hover:bg-[#4752c4] sm:w-auto"><MessageCircle size={18}/> Join Discord</a><a href="#how" className="w-full rounded-full px-8 py-4 font-bold text-slate-600 transition hover:bg-white sm:w-auto">See how it works</a></div>
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400"><span className="flex -space-x-2"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-amber-200">😎</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-violet-200">🤠</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-emerald-200">😁</span></span> Free to play · Friends welcome</div>
        </div>
      </section>

      <section id="games" className="bg-white px-5 py-24 md:py-32"><div className="mx-auto max-w-6xl"><div className="text-center"><p className="text-sm font-extrabold uppercase tracking-[.2em] text-violet-600">Pick your game</p><h2 className="mt-4 text-4xl font-black tracking-[-.05em] text-slate-950 md:text-6xl">Five ways to settle it.</h2><p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">Quick multiplayer games for 2–4 friends, all built to play from different places.</p></div><div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{games.map(game => <article key={game.title} className={`${game.color} ${game.tilt} group rounded-[32px] p-6 transition duration-300 hover:rotate-0 hover:-translate-y-2`}><div className="grid aspect-square place-items-center rounded-[24px] bg-white/55 text-7xl shadow-sm transition group-hover:scale-[1.03]">{game.icon}</div><h3 className="mt-6 text-xl font-extrabold tracking-tight">{game.title}</h3><p className="mt-1 text-sm text-slate-500">{game.text}</p></article>)}</div></div></section>

      <section id="how" className="px-5 py-24 md:py-32"><div className="mx-auto max-w-6xl rounded-[40px] bg-slate-950 px-6 py-16 text-white md:px-16 md:py-20"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="text-sm font-extrabold uppercase tracking-[.2em] text-violet-400">So simple</p><h2 className="balance mt-4 text-4xl font-black tracking-[-.05em] md:text-6xl">From “hey” to play in seconds.</h2><p className="mt-6 text-slate-400">No complicated setup. Just choose, share, and show them who’s boss.</p></div><ol className="space-y-4">{[["01",<Sparkles key="s"/>,"Choose a game","Pick a favorite from the game shelf."],["02",<Link2 key="l"/>,"Send the invite","Share a private room link with your friend."],["03",<Trophy key="t"/>,"Play & claim glory","Compete live and add a win to your record."]].map(([n,icon,title,text]) => <li key={String(n)} className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[.06] p-5"><span className="text-xs font-bold text-slate-500">{n}</span><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500 text-white">{icon}</span><span><strong className="block text-base">{title}</strong><span className="mt-1 block text-sm text-slate-400">{text}</span></span></li>)}</ol></div></div></section>

      <section className="px-5 pb-28 text-center"><div className="mx-auto max-w-3xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-100 text-3xl animate-pulse-soft">✦</div><h2 className="balance mt-7 text-4xl font-black tracking-[-.05em] md:text-6xl">Your next rivalry starts here.</h2><p className="mt-5 text-lg text-slate-500">Create your free account today and challenge your friends to instant multiplayer games.</p><Link href="/auth?mode=signup" className="mt-8 inline-flex items-center gap-2 rounded-full bg-violet-600 px-8 py-4 font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-1">Create free account <ArrowRight size={18}/></Link><div className="mt-6 flex justify-center gap-5 text-xs text-slate-400"><span className="flex gap-1"><Check size={14}/> Secure profile</span><span className="flex gap-1"><Radio size={14}/> Realtime-ready</span></div></div></section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row"><Brand/><p className="text-sm text-slate-400">© 2026 Rally. Play together, anywhere.</p><div className="flex items-center gap-3"><a href="https://github.com/Princecarthy3" target="_blank" rel="noreferrer" aria-label="Princecarthy3 on GitHub" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"><GitHubLogo/></a><a href="https://www.instagram.com/princecarthy_arts/" target="_blank" rel="noreferrer" aria-label="Princecarthy Arts on Instagram" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-pink-600"><InstagramLogo/></a></div></div></footer>
    </main>
  );
}
