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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-[#f8f9fd]/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Brand />
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm md:flex">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                pathname === href
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link href="/profile" className="hidden text-right sm:block">
            <span className="block text-[11px] font-medium text-slate-400">Playing as</span>
            <span className="block max-w-28 truncate text-xs font-bold text-slate-900">{name}</span>
          </Link>
          <button
            onClick={handleSignOut}
            aria-label="Log out"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Log out</span>
          </button>
        </div>
      </div>

      <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 justify-around rounded-full border border-white/20 bg-slate-950/90 p-1.5 text-white shadow-2xl backdrop-blur-lg md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition ${
              pathname === href ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
