"use client";

import { ShopItem, RARITY_STYLES, UserCustomizationState } from "@/lib/customization";
import { PlayerCard } from "./player-card";
import { X, ShoppingBag, Check, CircleDollarSign } from "lucide-react";

interface ItemPreviewModalProps {
  item: ShopItem | null;
  isOpen: boolean;
  onClose: () => void;
  onBuy: (item: ShopItem) => void;
  onEquip: (item: ShopItem) => void;
  isOwned: boolean;
  isEquipped: boolean;
  userBalance: number;
  displayName: string;
  avatarUrl?: string | null;
  customization?: UserCustomizationState | null;
  busy: boolean;
}

export function ItemPreviewModal({
  item,
  isOpen,
  onClose,
  onBuy,
  onEquip,
  isOwned,
  isEquipped,
  userBalance,
  displayName,
  avatarUrl,
  customization,
  busy,
}: ItemPreviewModalProps) {
  if (!isOpen || !item) return null;

  const rarityStyle = RARITY_STYLES[item.rarity] || RARITY_STYLES.common;

  // Clone customization and override with preview item
  const previewCustomization: UserCustomizationState = {
    avatar: customization?.avatar ?? null,
    frame: customization?.frame ?? null,
    banner: customization?.banner ?? null,
    background: customization?.background ?? null,
    title: customization?.title ?? null,
    name_color: customization?.name_color ?? null,
    name_effect: customization?.name_effect ?? null,
    victory: customization?.victory ?? null,
    room_theme: customization?.room_theme ?? null,
    badges: customization?.badges ?? [],
    bio: customization?.bio || "",
    status_preset: customization?.status_preset || "Online",
  };

  if (item.category === "avatar") previewCustomization.avatar = item;
  else if (item.category === "frame") previewCustomization.frame = item;
  else if (item.category === "banner") previewCustomization.banner = item;
  else if (item.category === "background") previewCustomization.background = item;
  else if (item.category === "title") previewCustomization.title = item;
  else if (item.category === "name_color") previewCustomization.name_color = item;
  else if (item.category === "name_effect") previewCustomization.name_effect = item;
  else if (item.category === "badge") {
    if (!previewCustomization.badges.some((b) => b.id === item.id)) {
      previewCustomization.badges = [item, ...previewCustomization.badges].slice(0, 3);
    }
  }

  const canAfford = userBalance >= item.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#fffdf7] p-6 shadow-[8px_8px_0_#171821]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4">
          <div>
            <span className={`inline-block rounded-full border-2 border-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase ${rarityStyle.bg} ${rarityStyle.text}`}>
              {item.rarity} {item.category.replace("_", " ")}
            </span>
            <h2 className="mt-1 text-2xl font-black">{item.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full border-2 border-slate-950 bg-white p-2 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Live Profile Card Preview */}
        <div className="mt-5">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-violet-600">Live Item Preview</p>
          <PlayerCard displayName={displayName} avatarUrl={avatarUrl} customization={previewCustomization} balance={userBalance} />
        </div>

        <p className="mt-4 text-xs text-slate-500 leading-relaxed">{item.description}</p>

        {/* Action Footer */}
        <div className="mt-6 flex items-center justify-between border-t-2 border-slate-950 pt-4">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400">Item Price</span>
            <p className="flex items-center gap-1.5 text-xl font-black">
              {item.price === 0 ? "FREE" : <><CircleDollarSign className="text-amber-500" size={20} /> {item.price.toLocaleString()} RC</>}
            </p>
          </div>

          <div className="flex gap-2">
            {isOwned ? (
              <button
                onClick={() => {
                  onEquip(item);
                  onClose();
                }}
                disabled={busy}
                className="arcade-button bg-[#a7efc8] text-slate-950 text-xs shadow-[3px_3px_0_#171821]"
              >
                <Check size={16} /> {isEquipped ? "EQUIPPED" : "EQUIP NOW"}
              </button>
            ) : (
              <button
                onClick={() => {
                  onBuy(item);
                  onClose();
                }}
                disabled={busy || !canAfford}
                className="arcade-button bg-[#7357ff] text-white text-xs shadow-[3px_3px_0_#171821] disabled:opacity-50"
              >
                <ShoppingBag size={16} /> {canAfford ? "BUY ITEM" : "NEED MORE COINS"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
