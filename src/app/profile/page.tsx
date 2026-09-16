"use client";

import { Camera, CheckCircle2, LoaderCircle, Trash2, UserRound, Sparkles, Check } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ProtectedPage } from "@/components/protected-page";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { PlayerCard } from "@/components/customization/player-card";
import { ShopItem, RARITY_STYLES } from "@/lib/customization";

const inventoryTabs = [
  { id: "all", label: "All Owned" },
  { id: "avatar", label: "Avatars" },
  { id: "frame", label: "Frames" },
  { id: "background", label: "Backgrounds" },
  { id: "banner", label: "Banners" },
  { id: "title", label: "Titles" },
  { id: "name_color", label: "Name Colors" },
  { id: "name_effect", label: "Name Effects" },
  { id: "badge", label: "Badges" },
  { id: "victory", label: "Victory Animations" },
  { id: "room_theme", label: "Room Themes" },
];

const statusPresets = ["Online", "Playing 🎮", "Winning 🏆", "Away 😴", "On a streak 🔥", "Do not disturb 👻"];

type InventoryItem = ShopItem & { acquired_at: string };

export default function ProfilePage() {
  const { profile, user, customization, balance, streak, levelState, refreshProfile, equipItem, unequipCategory, refreshCustomization } = useAuth();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [statusPreset, setStatusPreset] = useState("Online");

  const [ownedItems, setOwnedItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setName(profile?.display_name || user?.user_metadata?.display_name || "");
      setAvatar(profile?.avatar_url || "");
      setBio(customization?.bio || "");
      setStatusPreset(customization?.status_preset || "Online");
    });
  }, [profile, user, customization]);

  const loadInventory = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb || !user) return;
    const { data } = await sb.from("user_inventory").select("acquired_at, item:item_id(*)").eq("user_id", user.id);
    if (data) {
      const items = data.map((d) => ({ ...(d.item as unknown as ShopItem), acquired_at: d.acquired_at }));
      setOwnedItems(items as InventoryItem[]);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    async function fetchInventory() {
      const sb = getSupabaseBrowserClient();
      if (!sb || !user) return;
      const { data } = await sb.from("user_inventory").select("acquired_at, item:item_id(*)").eq("user_id", user.id);
      if (active && data) {
        const items = data.map((d) => ({ ...(d.item as unknown as ShopItem), acquired_at: d.acquired_at }));
        setOwnedItems(items as InventoryItem[]);
      }
    }
    void fetchInventory();
    return () => {
      active = false;
    };
  }, [user]);

  const filteredOwned = useMemo(() => {
    return ownedItems.filter((item) => activeTab === "all" || item.category === activeTab);
  }, [ownedItems, activeTab]);

  const collectionStats = useMemo(() => {
    const avatars = ownedItems.filter((i) => i.category === "avatar").length;
    const frames = ownedItems.filter((i) => i.category === "frame").length;
    const badges = ownedItems.filter((i) => i.category === "badge").length;
    const themes = ownedItems.filter((i) => i.category === "room_theme").length;
    return { avatars, frames, badges, themes };
  }, [ownedItems]);



  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be under 5MB.");
      return;
    }

    setError("");
    setMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxSize = 256;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatar(dataUrl);
          setMessage("Avatar photo loaded. Click 'Save profile' to keep changes.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (name.trim().length < 2 || name.trim().length > 24) {
      setError("Display name must be 2–24 characters.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    setBusy(true);

    const [profRes, bioRes] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          display_name: name.trim(),
          avatar_url: avatar.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id),
      supabase.rpc("update_profile_bio", { p_bio: bio.trim(), p_status_preset: statusPreset }),
    ]);

    if (profRes.error) {
      setError(profRes.error.message);
    } else {
      await refreshProfile();
      await refreshCustomization();
      setMessage("Profile and bio saved successfully.");
    }
    setBusy(false);
  }

  const [localEquippedIds, setLocalEquippedIds] = useState<string[]>([]);

  const equippedIds = useMemo(() => {
    const ids: string[] = [...localEquippedIds];
    if (customization) {
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
    }
    return Array.from(new Set(ids));
  }, [customization, localEquippedIds]);

  async function toggleEquip(item: ShopItem) {
    const isEquipped = equippedIds.includes(item.id);
    if (isEquipped) {
      setLocalEquippedIds((prev) => prev.filter((id) => id !== item.id));
      await unequipCategory(item.category);
    } else {
      setLocalEquippedIds((prev) => (item.category === "badge" ? [...prev, item.id] : [item.id]));
      await equipItem(item.id);
    }
    await refreshCustomization();
    setLocalEquippedIds([]);
  }

  return (
    <ProtectedPage>
      <main className="mx-auto max-w-5xl px-5 pb-28 pt-10 lg:px-8 lg:pt-12">
        <p className="eyebrow">Personal Rally Card</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-[-.05em]">Profile & Inventory</h1>
        <p className="mt-2 text-slate-500 font-medium">Equip owned cosmetics, update your status & check collection stats.</p>

        {/* Live Player Card Top Preview */}
        <div className="mt-8">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-violet-600">Equipped Player Card</p>
          <PlayerCard
            displayName={name || "Player"}
            avatarUrl={avatar}
            customization={customization}
            levelState={levelState}
            wins={profile?.wins ?? 0}
            gamesPlayed={profile?.games_played ?? 0}
            balance={balance}
            streak={streak}
          />
        </div>

        {/* Collection Tracker Bar */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="paper-card p-4 text-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Avatars</span>
            <p className="text-2xl font-black">{collectionStats.avatars} / 20</p>
          </div>
          <div className="paper-card p-4 text-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Frames</span>
            <p className="text-2xl font-black">{collectionStats.frames} / 12</p>
          </div>
          <div className="paper-card p-4 text-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Badges</span>
            <p className="text-2xl font-black">{collectionStats.badges} / 12</p>
          </div>
          <div className="paper-card p-4 text-center">
            <span className="text-[10px] font-black uppercase text-slate-400">Themes</span>
            <p className="text-2xl font-black">{collectionStats.themes} / 9</p>
          </div>
        </div>

        {/* Public Details Form */}
        <form onSubmit={save} className="mt-8 rounded-[28px] border-2 border-slate-950 bg-white p-6 md:p-8 shadow-[6px_6px_0_#171821]">
          <div className="flex items-center gap-3 border-b-2 border-slate-100 pb-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-600 border-2 border-slate-950">
              <UserRound size={20} />
            </span>
            <div>
              <h2 className="font-black text-xl">Profile Information</h2>
              <p className="text-xs text-slate-400">Customize how you appear in multiplayer lobbies.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">Display Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                required
                className="focus-ring w-full rounded-2xl border-2 border-slate-950 px-4 py-3 font-bold outline-none"
              />
              <span className="mt-1 block text-right text-[10px] font-bold text-slate-400">{name.length}/24</span>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">Status Preset</span>
              <select
                value={statusPreset}
                onChange={(e) => setStatusPreset(e.target.value)}
                className="focus-ring w-full rounded-2xl border-2 border-slate-950 px-4 py-3 font-bold outline-none bg-white"
              >
                {statusPresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">Bio / Status Quote</span>
            <input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={120}
              placeholder="Write a short player status (e.g. Always ready for a rematch 🎮)..."
              className="focus-ring w-full rounded-2xl border-2 border-slate-950 px-4 py-3 text-xs font-bold outline-none"
            />
            <span className="mt-1 block text-right text-[10px] font-bold text-slate-400">{bio.length}/120</span>
          </label>

          {/* Photo Avatar Upload */}
          <div className="mt-6 border-t-2 border-slate-100 pt-5">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-700">Custom Photo Avatar (Optional)</span>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/png, image/jpeg, image/webp" className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="arcade-button bg-violet-600 text-white shadow-[3px_3px_0_#171821] text-xs"
              >
                <Camera size={15} /> Upload Photo File
              </button>

              {avatar && (
                <button
                  type="button"
                  onClick={() => setAvatar("")}
                  className="arcade-button bg-rose-100 text-rose-700 shadow-[3px_3px_0_#171821] text-xs"
                >
                  <Trash2 size={15} /> Remove Photo
                </button>
              )}
            </div>
          </div>

          {error && <p className="mt-4 rounded-xl border-2 border-slate-950 bg-rose-100 p-3 text-xs font-bold text-rose-800">{error}</p>}
          {message && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border-2 border-slate-950 bg-emerald-100 p-3 text-xs font-bold text-emerald-800">
              <CheckCircle2 size={16} /> {message}
            </p>
          )}

          <button disabled={busy} className="arcade-button mt-6 w-full bg-[#f4dc69] text-slate-950 font-black shadow-[4px_4px_0_#171821]">
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            SAVE PROFILE DETAILS
          </button>
        </form>

        {/* My Inventory & Equipment Manager */}
        <section className="mt-12">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Inventory Hub</p>
              <h2 className="text-3xl font-black">Equip Cosmetics</h2>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {inventoryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full border-2 border-slate-950 px-4 py-2 text-xs font-black transition ${
                  activeTab === tab.id ? "bg-slate-950 text-white" : "bg-white text-slate-800 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Inventory Grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOwned.length > 0 ? (
              filteredOwned.map((item) => {
                const isEquipped = equippedIds.includes(item.id);
                const rarityStyle = RARITY_STYLES[item.rarity] || RARITY_STYLES.common;

                return (
                  <article
                    key={item.id}
                    className={`relative flex flex-col justify-between rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[4px_4px_0_#171821] ${
                      isEquipped ? "ring-2 ring-violet-600" : ""
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-xl border-2 border-slate-950 bg-[#f0edff] text-2xl shadow-[2px_2px_0_#171821]">
                          {item.asset_value?.startsWith("#") ? "🎨" : item.asset_value || "✦"}
                        </span>
                        <span className={`rounded-full border-2 border-slate-950 px-2 py-0.5 text-[9px] font-black uppercase ${rarityStyle.bg} ${rarityStyle.text}`}>
                          {item.rarity}
                        </span>
                      </div>
                      <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">{item.category.replace("_", " ")}</p>
                      <h3 className="text-lg font-black">{item.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t-2 border-slate-100 pt-3">
                      <span className="text-[10px] font-bold text-slate-400">OWNED</span>
                      <button
                        onClick={() => toggleEquip(item)}
                        className={`arcade-button text-xs py-1.5 px-4 shadow-[2px_2px_0_#171821] ${
                          isEquipped ? "bg-slate-950 text-white" : "bg-[#a7efc8] text-slate-950"
                        }`}
                      >
                        {isEquipped ? <Check size={14} /> : <Sparkles size={14} />}
                        {isEquipped ? "EQUIPPED" : "EQUIP"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center bg-white">
                <span className="text-4xl">🛍️</span>
                <p className="mt-2 text-sm font-black">No cosmetics owned in this category.</p>
                <p className="mt-1 text-xs text-slate-400">Visit the Rally Shop to unlock new cosmetics!</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </ProtectedPage>
  );
}
