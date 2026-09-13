"use client";

import { History, LayoutGrid, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";
import { useAuth } from "./auth-provider";

const links = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, signOut } = useAuth();
  const name = profile?.display_name || user?.user_metadata?.display_name || "Player";

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f8f9fd]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5 lg:px-8">
        <Brand />
        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${pathname === href ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/profile" className="hidden text-right sm:block">
            <span className="block text-xs text-slate-400">Playing as</span>
            <span className="block max-w-32 truncate text-sm font-bold text-slate-900">{name}</span>
          </Link>
          <button onClick={handleSignOut} aria-label="Log out" className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:text-red-500"><LogOut size={17} /></button>
        </div>
      </div>
      <nav className="fixed inset-x-4 bottom-4 z-50 flex justify-around rounded-2xl border border-white/70 bg-slate-950/95 p-2 text-white shadow-2xl backdrop-blur md:hidden">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold ${pathname === href ? "bg-white/15" : "text-slate-400"}`}><Icon size={18} />{label}</Link>)}
      </nav>
    </header>
  );
}
