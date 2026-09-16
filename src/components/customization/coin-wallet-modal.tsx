"use client";

import { X, CircleDollarSign, Sparkles, ArrowDownRight, ArrowUpRight, ShieldCheck, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Transaction = {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
};

interface CoinWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  userId?: string;
  onClaimDaily?: () => void;
}

const coinPackages = [
  { id: "starter", coins: 1000, bonus: 0, price: "$0.99", tag: "Starter" },
  { id: "popular", coins: 5000, bonus: 500, price: "$4.99", tag: "Most Popular" },
  { id: "pro", coins: 10500, bonus: 1500, price: "$9.99", tag: "Pro Value" },
  { id: "mega", coins: 25000, bonus: 5000, price: "$19.99", tag: "Mega Pack" },
  { id: "ultimate", coins: 70000, bonus: 15000, price: "$49.99", tag: "Ultimate" },
];

export function CoinWalletModal({ isOpen, onClose, balance, userId, onClaimDaily }: CoinWalletModalProps) {
  const [tab, setTab] = useState<"topup" | "history" | "plus">("topup");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isOpen || !userId) return;
    const sb = getSupabaseBrowserClient();
    if (!sb) return;

    let active = true;
    async function fetchTransactions() {
      setLoading(true);
      const { data } = await sb
        .from("coin_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (active) {
        setTransactions((data || []) as Transaction[]);
        setLoading(false);
      }
    }
    void fetchTransactions();
    return () => {
      active = false;
    };
  }, [isOpen, userId]);

  if (!isOpen) return null;

  function simulatePurchase(coins: number, price: string) {
    setNotice(`Simulated purchase of ${coins.toLocaleString()} RC for ${price}. Payment gateway will launch on production release.`);
    setTimeout(() => setNotice(""), 4000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#fffdf7] p-6 shadow-[8px_8px_0_#171821]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-slate-950 bg-[#f4dc69] text-2xl shadow-[2px_2px_0_#171821]">
              🪙
            </span>
            <div>
              <p className="eyebrow">Rally Currency</p>
              <h2 className="text-2xl font-black">Rally Coin Wallet</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full border-2 border-slate-950 bg-white p-2 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Current Balance Card */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-slate-950 p-5 text-white shadow-[4px_4px_0_#171821]">
          <div>
            <span className="text-xs font-black uppercase text-violet-300">Your Coin Balance</span>
            <p className="mt-1 flex items-center gap-2 text-3xl font-black">
              <CircleDollarSign className="text-amber-400" size={28} />
              {balance.toLocaleString()} RC
            </p>
          </div>
          {onClaimDaily && (
            <button
              onClick={() => {
                onClaimDaily();
                onClose();
              }}
              className="arcade-button bg-[#f4dc69] text-xs text-slate-950 shadow-[2px_2px_0_#fff]"
            >
              <Sparkles size={14} /> Claim Daily
            </button>
          )}
        </div>

        {notice && <p className="mt-4 rounded-xl border-2 border-slate-950 bg-[#a7efc8] p-3 text-xs font-black">{notice}</p>}

        {/* Tab Navigation */}
        <div className="mt-5 flex border-b-2 border-slate-950">
          <button
            onClick={() => setTab("topup")}
            className={`flex-1 py-2 text-xs font-black uppercase ${tab === "topup" ? "border-b-4 border-slate-950 text-slate-950" : "text-slate-400"}`}
          >
            Buy Coins
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2 text-xs font-black uppercase ${tab === "history" ? "border-b-4 border-slate-950 text-slate-950" : "text-slate-400"}`}
          >
            History
          </button>
          <button
            onClick={() => setTab("plus")}
            className={`flex-1 py-2 text-xs font-black uppercase ${tab === "plus" ? "border-b-4 border-slate-950 text-slate-950" : "text-slate-400"}`}
          >
            Rally Plus 👑
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-5 max-h-[340px] overflow-y-auto pr-1">
          {tab === "topup" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Rally Coins are cosmetic-only and provide zero competitive gameplay advantage.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {coinPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => simulatePurchase(pkg.coins + pkg.bonus, pkg.price)}
                    className="cursor-pointer rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[3px_3px_0_#171821] transition hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-violet-800">{pkg.tag}</span>
                      {pkg.bonus > 0 && <span className="text-[10px] font-black text-emerald-600">+{pkg.bonus} Bonus</span>}
                    </div>
                    <strong className="mt-3 block text-xl font-black">{pkg.coins.toLocaleString()} RC</strong>
                    <div className="mt-3 flex items-center justify-between border-t-2 border-slate-100 pt-2">
                      <span className="text-xs font-bold text-slate-500">Real Currency</span>
                      <span className="arcade-button bg-[#f4dc69] text-xs py-1 px-3">{pkg.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "history" && (
            <div>
              {loading ? (
                <p className="py-8 text-center text-xs font-bold text-slate-400">Loading transactions...</p>
              ) : transactions.length > 0 ? (
                <div className="divide-y-2 divide-slate-100">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-8 w-8 place-items-center rounded-xl border-2 border-slate-950 ${isPositive ? "bg-[#a7efc8]" : "bg-[#ffb0bb]"}`}>
                            {isPositive ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                          </span>
                          <div>
                            <strong className="block text-xs font-black">{tx.description}</strong>
                            <span className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-black ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? `+${tx.amount}` : tx.amount} RC
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-xs font-bold text-slate-400">No transactions recorded yet.</p>
              )}
            </div>
          )}

          {tab === "plus" && (
            <div className="rounded-2xl border-2 border-slate-950 bg-slate-900 p-6 text-white text-center shadow-[4px_4px_0_#171821]">
              <Crown size={36} className="mx-auto text-amber-400 mb-2" />
              <h3 className="text-xl font-black">Rally Plus Membership</h3>
              <p className="mt-2 text-xs text-slate-300">$2.99 / month</p>
              <ul className="mt-4 space-y-2 text-left text-xs text-slate-300 border-t border-white/10 pt-4">
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" /> Ad-Free multiplayer experience
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" /> +1,500 Monthly Rally Coin allowance
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" /> Exclusive Royal Crest frames & Golden Crown title
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" /> Early access to limited edition seasonal collections
                </li>
              </ul>
              <button
                onClick={() => simulatePurchase(0, "$2.99/mo")}
                className="arcade-button mt-6 w-full bg-[#f4dc69] text-slate-950 font-black"
              >
                JOIN RALLY PLUS — $2.99/MO
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
