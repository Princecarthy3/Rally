"use client";

import { CircleDollarSign, History, LayoutGrid, LogOut, MessageCircle, Settings, Share2, ShoppingBag, Trophy, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Brand } from "./brand";
import { useAuth } from "./auth-provider";
import { SoundToggle } from "./sound-toggle";
import { SettingsModal } from "./settings-modal";
import { sounds } from "@/lib/audio";
import { UserAvatar } from "@/components/customization/user-avatar";
import { NameDisplay } from "@/components/customization/name-display";
import { CoinWalletModal } from "@/components/customization/coin-wallet-modal";

const links = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid },
  { href: "/leaderboard", label: "Rankings", icon: Trophy },
  { href: "/history", label: "History", icon: History },
  { href: "/friends", label: "Friends", icon: UsersRound },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, customization, balance, claimDaily, signOut } = useAuth();
  const name = profile?.display_name || user?.user_metadata?.display_name || "Player";
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [socialBadge, setSocialBadge] = useState(0);
  const [messageBadge, setMessageBadge] = useState(0);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const refreshBadge = async () => {
      const { data } = await supabase.rpc("get_social_inbox");
      setSocialBadge((data || []).length);
    };
    void refreshBadge();
    const channel = supabase.channel(`social-badge:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `receiver_id=eq.${user.id}` }, refreshBadge)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites", filter: `receiver_id=eq.${user.id}` }, refreshBadge)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    let previousTotal = 0;
    const refreshMessages = async (notify = false) => {
      const { data } = await supabase.rpc("get_unread_friend_message_counts");
      const total = ((data || []) as { unread_count: number }[]).reduce((sum, row) => sum + Number(row.unread_count), 0);
      if (notify && total > previousTotal) {
        sounds.playMessageSound();
        if ("Notification" in window && Notification.permission === "granted") new Notification("New Rally message", { body: "You received a new message from a friend." });
      }
      previousTotal = total;
      setMessageBadge(total);
    };
    void refreshMessages();
    const channel = supabase.channel(`message-badge:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages", filter: `receiver_id=eq.${user.id}` }, () => void refreshMessages(true))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "friend_messages", filter: `receiver_id=eq.${user.id}` }, () => void refreshMessages())
      .subscribe();
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  async function handleShareApp() {
    sounds.playClickSound();
    const shareData = {
      title: "Rally - Multiplayer Mini Games",
      text: "Play fun multiplayer mini-games together on Rally!",
      url: typeof window !== "undefined" ? window.location.origin : "https://rallygames.vercel.app",
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.url);
      setToast("App link copied!");
      setTimeout(() => setToast(""), 2200);
    }
  }

  return (
    <>
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
                <Icon size={16} /> {label}{href === "/friends" && socialBadge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{socialBadge}</span>}{href === "/messages" && messageBadge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{messageBadge}</span>}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Coin Balance Badge */}
            {user && (
              <button
                onClick={() => setIsWalletOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-100 cursor-pointer"
                title="Rally Coin Wallet"
              >
                <CircleDollarSign size={16} className="text-amber-500" />
                <span>{balance.toLocaleString()}</span>
              </button>
            )}

            {/* Share App Button */}
            <button
              onClick={handleShareApp}
              title="Share Rally App"
              aria-label="Share Rally App"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 cursor-pointer"
            >
              <Share2 size={15} className="text-[#7357ff]" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Settings Tab Button */}
            <button
              onClick={() => {
                sounds.playClickSound();
                setIsSettingsOpen(true);
              }}
              title="Settings"
              aria-label="Settings"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 cursor-pointer"
            >
              <Settings size={17} />
            </button>

            <SoundToggle />

            {user && (
              <Link href="/profile" className="hidden items-center gap-2.5 rounded-full border border-slate-200 bg-white p-1 pl-2.5 shadow-sm transition hover:bg-slate-50 sm:flex">
                <div className="text-right leading-tight">
                  <NameDisplay name={name} nameColor={customization?.name_color} nameEffect={customization?.name_effect} className="block max-w-28 truncate text-xs font-black text-slate-950" />
                  <span className="block text-[10px] font-extrabold text-slate-600">
                    [{customization?.title?.asset_value || "Newcomer"}]
                  </span>
                </div>
                <UserAvatar
                  avatarUrl={profile?.avatar_url}
                  equippedAvatar={customization?.avatar}
                  equippedFrame={customization?.frame}
                  fallbackName={name}
                  size="xs"
                />
              </Link>
            )}

            <button
              onClick={handleSignOut}
              aria-label="Log out"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <CoinWalletModal
        isOpen={isWalletOpen}
        onClose={() => setIsWalletOpen(false)}
        balance={balance}
        userId={user?.id}
        onClaimDaily={claimDaily ? async () => { await claimDaily(); } : undefined}
      />

      {toast && (
        <div className="fixed top-20 right-6 z-50 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-4 py-2 text-xs font-black shadow-[3px_3px_0_#171821] animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Mobile navigation (Symbols only for clean responsive layout) */}
      <nav className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 items-center justify-around rounded-full border-2 border-slate-950 bg-slate-950/95 p-1.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md md:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`grid h-11 w-11 place-items-center rounded-full transition-all ${
                isActive
                  ? "bg-[#7357ff] text-white shadow-[0_0_12px_rgba(115,87,255,0.8)] scale-105"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="relative"><Icon size={20} />{href === "/friends" && socialBadge > 0 && <span className="absolute -right-2 -top-2 h-2 w-2 rounded-full bg-red-500"/>}{href === "/messages" && messageBadge > 0 && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] text-white">{messageBadge}</span>}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
