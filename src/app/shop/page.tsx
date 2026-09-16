"use client";

import { Check, CircleDollarSign, Eye, LoaderCircle, Search, ShoppingBag, Sparkles, Heart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/protected-page";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ShopItem, RARITY_STYLES } from "@/lib/customization";
import { ItemPreviewModal } from "@/components/customization/item-preview-modal";
import { CoinWalletModal } from "@/components/customization/coin-wallet-modal";
import { StreakClaimModal } from "@/components/customization/streak-claim-modal";

const categories = [
  { id: "all", label: "All Items" },
  { id: "featured", label: "Featured 🔥" },
  { id: "avatar", label: "Avatars 👤" },
  { id: "frame", label: "Frames 👑" },
  { id: "background", label: "Backgrounds 🎨" },
  { id: "banner", label: "Banners 🖼️" },
  { id: "title", label: "Titles 🏷️" },
  { id: "name_color", label: "Name Colors 🎨" },
  { id: "name_effect", label: "Name Effects ✨" },
  { id: "badge", label: "Badges 🏆" },
  { id: "victory", label: "Victory Animations 🎉" },
  { id: "room_theme", label: "Room Themes 🎮" },
  { id: "emote", label: "Emotes 😂" },
  { id: "bundles", label: "Bundles 🎁" },
];

const rarities = ["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"];

const cosmeticBundles = [
  {
    id: "champion-bundle",
    name: "Champion Collection 🏆",
    description: "Includes Champion Title, Gold Frame, Trophy Badge & Gold Name Color.",
    price: 4500,
    originalPrice: 7000,
    rarity: "legendary",
    items: ["champion-title", "gold-frame", "champion-badge", "gold-name-color"],
  },
  {
    id: "galaxy-collection",
    name: "Galaxy Voyager Bundle 🌌",
    description: "Includes Galaxy Explorer Avatar, Galaxy Frame, Galaxy Banner & Galaxy Background.",
    price: 18000,
    originalPrice: 25500,
    rarity: "mythic",
    items: ["galaxy-avatar", "galaxy-frame", "galaxy-banner", "galaxy-bg"],
  },
  {
    id: "cyberpunk-set",
    name: "Cyberpunk 2077 Set 🦾",
    description: "Includes Cyborg Avatar, Cyberpunk Frame, Cyber Overdrive Banner & Cyber Grid Background.",
    price: 20000,
    originalPrice: 30000,
    rarity: "mythic",
    items: ["cyberpunk-avatar", "cyberpunk-frame", "cyber-banner", "cyberpunk-bg"],
  },
];

export default function ShopPage() {
  const { user, profile, customization, balance, streak, claimDaily, equipItem, refreshCustomization } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const [previewItem, setPreviewItem] = useState<ShopItem | null>(null);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isStreakOpen, setIsStreakOpen] = useState(false);

  const displayName = profile?.display_name || user?.user_metadata?.display_name || "Player";

  const loadShop = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !user) return;
    const [shopRes, invRes] = await Promise.all([
      sb.from("shop_items").select("*").eq("active", true).order("price"),
      sb.from("user_inventory").select("item_id").eq("user_id", user.id),
    ]);
    setItems((shopRes.data || []) as ShopItem[]);
    setOwned((invRes.data || []).map((i) => i.item_id));
  }, [user]);

  useEffect(() => {
    let active = true;
    async function fetchShop() {
      const sb = getSupabaseBrowserClient();
      if (!sb || !user) return;
      const [shopRes, invRes] = await Promise.all([
        sb.from("shop_items").select("*").eq("active", true).order("price"),
        sb.from("user_inventory").select("item_id").eq("user_id", user.id),
      ]);
      if (active) {
        setItems((shopRes.data || []) as ShopItem[]);
        setOwned((invRes.data || []).map((i) => i.item_id));
      }
    }
    void fetchShop();
    return () => {
      active = false;
    };
  }, [user]);

  const shown = useMemo(() => {
    return items.filter((item) => {
      if (category === "featured") {
        if (item.rarity !== "epic" && item.rarity !== "legendary" && item.rarity !== "mythic") return false;
      } else if (category !== "all" && category !== "bundles") {
        if (item.category !== category) return false;
      }

      if (rarityFilter !== "all" && item.rarity !== rarityFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, category, rarityFilter, search]);

  async function buy(item: ShopItem) {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    setBusy(item.id);
    const { error } = await sb.rpc("purchase_shop_item", { p_item: item.id });
    if (error) {
      setNotice(error.message);
    } else {
      setNotice(`Purchased ${item.name}! Added to your inventory.`);
      await loadShop();
      await refreshCustomization();
    }
    setBusy(null);
  }

  async function equip(item: ShopItem) {
    setBusy(item.id);
    const success = await equipItem(item.id);
    if (success) {
      setNotice(`${item.name} equipped successfully!`);
    } else {
      setNotice(`Could not equip ${item.name}.`);
    }
    setBusy(null);
  }

  async function buyBundle(bundle: typeof cosmeticBundles[0]) {
    const sb = getSupabaseBrowserClient();
    if (!sb || !user) return;
    if (balance < bundle.price) {
      setNotice("Not enough Rally Coins for this bundle.");
      return;
    }

    setBusy(bundle.id);
    // Find matching shop items
    const matchingItems = items.filter((i) => bundle.items.includes(i.slug));
    let count = 0;
    for (const item of matchingItems) {
      if (!owned.includes(item.id)) {
        await sb.rpc("purchase_shop_item", { p_item: item.id });
        count++;
      }
    }
    setNotice(`Purchased ${bundle.name}! ${count} items added to your inventory.`);
    await loadShop();
    await refreshCustomization();
    setBusy(null);
  }

  function toggleFavorite(itemId: string) {
    setFavorites((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  }

  const equippedIds = useMemo(() => {
    if (!customization) return [];
    const ids: string[] = [];
    if (customization.avatar?.id) ids.push(customization.avatar.id);
    if (customization.frame?.id) ids.push(customization.frame.id);
    if (customization.banner?.id) ids.push(customization.banner.id);
    if (customization.background?.id) ids.push(customization.background.id);
    if (customization.title?.id) ids.push(customization.title.id);
    if (customization.name_color?.id) ids.push(customization.name_color.id);
    if (customization.name_effect?.id) ids.push(customization.name_effect.id);
    if (customization.victory?.id) ids.push(customization.victory.id);
    if (customization.room_theme?.id) ids.push(customization.room_theme.id);
    customization.badges?.forEach((b) => ids.push(b.id));
    return ids;
  }, [customization]);

  return (
    <ProtectedPage>
      <main className="min-h-screen bg-[#fffdf7] pb-28">
        {/* Banner Section */}
        <section className="border-b-2 border-slate-950 bg-[#f4dc69]">
          <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
            <p className="eyebrow">Rally In-App Economy</p>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-[-.06em]">🛍️ The Rally Shop</h1>
                <p className="mt-2 text-slate-800 font-medium">
                  Earn Rally Coins by playing games, complete challenges & equip exclusive cosmetics.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setIsStreakOpen(true)}
                  className="arcade-button bg-slate-950 text-white shadow-[4px_4px_0_#fff]"
                >
                  <Sparkles size={16} className="text-amber-400" />
                  <span>🔥 {streak} Day Streak</span>
                </button>

                <button
                  onClick={() => setIsWalletOpen(true)}
                  className="rounded-2xl border-2 border-slate-950 bg-white px-5 py-2.5 shadow-[4px_4px_0_#171821] transition hover:-translate-y-0.5 cursor-pointer"
                >
                  <span className="text-[10px] font-black uppercase text-slate-500">Your Wallet</span>
                  <p className="flex items-center gap-2 text-xl font-black">
                    <CircleDollarSign className="text-amber-500" size={22} />
                    {balance.toLocaleString()} RC
                  </p>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          {notice && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_#171821]">
              <p className="text-sm font-black">{notice}</p>
              <button onClick={() => setNotice("")} className="text-xs font-bold underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search avatars, frames, banners, titles..."
                className="focus-ring w-full rounded-full border-2 border-slate-950 bg-white py-3 pl-11 pr-4 text-xs font-bold"
              />
            </div>

            {/* Rarity Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Rarity:</span>
              {rarities.map((r) => (
                <button
                  key={r}
                  onClick={() => setRarityFilter(r)}
                  className={`shrink-0 rounded-full border-2 border-slate-950 px-3 py-1 text-[10px] font-black uppercase ${
                    rarityFilter === r ? "bg-slate-950 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full border-2 border-slate-950 px-4 py-2 text-xs font-black transition ${
                  category === c.id ? "bg-slate-950 text-white" : "bg-white text-slate-800 hover:bg-slate-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Bundles View */}
          {category === "bundles" && (
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {cosmeticBundles.map((bundle) => (
                <div key={bundle.id} className="rounded-[28px] border-2 border-slate-950 bg-white p-6 shadow-[6px_6px_0_#171821]">
                  <span className="rounded-full border-2 border-slate-950 bg-amber-400 px-3 py-1 text-[10px] font-black uppercase">
                    LIMITED BUNDLE
                  </span>
                  <h3 className="mt-4 text-2xl font-black">{bundle.name}</h3>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{bundle.description}</p>
                  <div className="mt-6 flex items-center justify-between border-t-2 border-slate-100 pt-4">
                    <div>
                      <span className="text-[10px] font-bold line-through text-slate-400">🪙 {bundle.originalPrice.toLocaleString()} RC</span>
                      <p className="text-xl font-black text-emerald-600">🪙 {bundle.price.toLocaleString()} RC</p>
                    </div>
                    <button
                      onClick={() => buyBundle(bundle)}
                      disabled={busy === bundle.id}
                      className="arcade-button bg-[#7357ff] text-white text-xs shadow-[3px_3px_0_#171821]"
                    >
                      {busy === bundle.id ? <LoaderCircle className="animate-spin" size={16} /> : <ShoppingBag size={16} />}
                      BUY BUNDLE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shop Item Grid */}
          {category !== "bundles" && (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((item) => {
                const isOwned = owned.includes(item.id);
                const isEquipped = equippedIds.includes(item.id);
                const isFavorite = favorites.includes(item.id);
                const rarityStyle = RARITY_STYLES[item.rarity] || RARITY_STYLES.common;

                return (
                  <article
                    key={item.id}
                    className="relative flex flex-col justify-between rounded-[26px] border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0_#171821] transition hover:-translate-y-1"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-slate-950 bg-[#f0edff] text-3xl shadow-[2px_2px_0_#171821]">
                          {item.asset_value?.startsWith("#") ? "🎨" : item.asset_value || "✦"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleFavorite(item.id)} className="text-slate-400 hover:text-rose-500">
                            <Heart size={18} className={isFavorite ? "fill-rose-500 text-rose-500" : ""} />
                          </button>
                          <span className={`rounded-full border-2 border-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase ${rarityStyle.bg} ${rarityStyle.text}`}>
                            {item.rarity}
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {item.category.replace("_", " ")}
                      </p>
                      <h2 className="mt-1 text-xl font-black">{item.name}</h2>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed min-h-9">{item.description}</p>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-6 flex items-center justify-between border-t-2 border-slate-100 pt-4 gap-2">
                      <strong className="text-xs font-black">
                        {item.price === 0 ? "FREE" : `🪙 ${item.price.toLocaleString()} RC`}
                      </strong>

                      <div className="flex items-center gap-2">
                        {/* Preview Button */}
                        <button
                          onClick={() => setPreviewItem(item)}
                          className="arcade-button bg-white text-slate-950 text-xs px-3 shadow-[2px_2px_0_#171821]"
                          title="Preview Item"
                        >
                          <Eye size={14} />
                        </button>

                        {isOwned ? (
                          <button
                            onClick={() => equip(item)}
                            disabled={busy === item.id}
                            className={`arcade-button text-xs px-3.5 shadow-[2px_2px_0_#171821] ${
                              isEquipped ? "bg-slate-950 text-white" : "bg-[#a7efc8] text-slate-950"
                            }`}
                          >
                            {busy === item.id ? (
                              <LoaderCircle className="animate-spin" size={14} />
                            ) : isEquipped ? (
                              <Check size={14} />
                            ) : (
                              "EQUIP"
                            )}
                            {isEquipped ? " EQUIPPED" : ""}
                          </button>
                        ) : (
                          <button
                            onClick={() => buy(item)}
                            disabled={busy === item.id}
                            className="arcade-button bg-[#7357ff] text-white text-xs px-3.5 shadow-[2px_2px_0_#171821]"
                          >
                            {busy === item.id ? <LoaderCircle className="animate-spin" size={14} /> : <ShoppingBag size={14} />}
                            BUY
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        <ItemPreviewModal
          item={previewItem}
          isOpen={Boolean(previewItem)}
          onClose={() => setPreviewItem(null)}
          onBuy={buy}
          onEquip={equip}
          isOwned={Boolean(previewItem && owned.includes(previewItem.id))}
          isEquipped={Boolean(previewItem && equippedIds.includes(previewItem.id))}
          userBalance={balance}
          displayName={displayName}
          avatarUrl={profile?.avatar_url}
          customization={customization}
          busy={Boolean(busy)}
        />

        <CoinWalletModal
          isOpen={isWalletOpen}
          onClose={() => setIsWalletOpen(false)}
          balance={balance}
          userId={user?.id}
          onClaimDaily={claimDaily ? async () => { await claimDaily(); } : undefined}
        />

        <StreakClaimModal
          isOpen={isStreakOpen}
          onClose={() => setIsStreakOpen(false)}
          currentStreak={streak}
          onClaim={async () => {
            const res = await claimDaily();
            if (res) setNotice(`+${res.reward} RC claimed! Current streak: ${res.streak} days.`);
          }}
          busy={Boolean(busy)}
        />
      </main>
    </ProtectedPage>
  );
}
