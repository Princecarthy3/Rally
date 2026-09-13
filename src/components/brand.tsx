import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3" aria-label="Rally home">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-violet-600 text-lg text-white shadow-[0_8px_24px_rgba(108,71,255,.28)] transition-transform group-hover:-rotate-6 group-hover:scale-105">
        ✦
      </span>
      {!compact && <span className="text-[21px] font-extrabold tracking-[-.04em] text-slate-950">rally</span>}
    </Link>
  );
}
