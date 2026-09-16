"use client";

import { useState } from "react";
import { ShopItem, RARITY_STYLES, UserCustomizationState, getRoomThemeStyle } from "@/lib/customization";
import { PlayerCard } from "./player-card";
import { UserAvatar } from "./user-avatar";
import { VictoryAnimationOverlay } from "./victory-animation-overlay";
import { X, ShoppingBag, Check, CircleDollarSign, Sparkles, Gamepad2, Play } from "lucide-react";

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
  const [showVictoryDemo, setShowVictoryDemo] = useState(false);

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
  else if (item.category === "victory") previewCustomization.victory = item;
  else if (item.category === "room_theme") previewCustomization.room_theme = item;
  else if (item.category === "badge") {
    if (!previewCustomization.badges.some((b) => b.id === item.id)) {
      previewCustomization.badges = [item, ...previewCustomization.badges].slice(0, 3);
    }
  }

  const canAfford = userBalance >= item.price;
  const roomThemeStyle = getRoomThemeStyle(item.category === "room_theme" ? item : previewCustomization.room_theme);

  const victoryEmoji =
    item.asset_value === "fireworks"
      ? "🎆"
      : item.asset_value === "lightning"
      ? "⚡"
      : item.asset_value === "flame"
      ? "🔥"
      : item.asset_value === "crown"
      ? "👑"
      : item.asset_value === "galaxy"
      ? "🌌"
      : "🎉";

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
        <div className="relative w-full max-w-lg my-8 overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#fffdf7] p-6 shadow-[8px_8px_0_#171821]">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-950 pb-4">
            <div>
              <span className={`inline-block rounded-full border-2 border-slate-950 px-2.5 py-0.5 text-[10px] font-black uppercase ${rarityStyle.bg} ${rarityStyle.text}`}>
                {item.rarity} {item.category.replace("_", " ")}
              </span>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{item.name}</h2>
            </div>
            <button onClick={onClose} className="rounded-full border-2 border-slate-950 bg-white p-2 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          {/* Specific Item Previews */}
          {item.category === "room_theme" ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-violet-600">🎮 Game Room Theme Preview</p>
              <div
                className={`relative overflow-hidden rounded-2xl border-2 border-slate-950 p-4 shadow-[4px_4px_0_#171821] ${roomThemeStyle.containerClass}`}
                style={roomThemeStyle.bgStyle}
              >
                {/* Room Header Preview */}
                <div className="flex items-center justify-between border-b border-white/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-400 text-xs font-black text-slate-950">
                      🎮
                    </span>
                    <div>
                      <strong className="block text-xs font-black">Dots & Boxes Room</strong>
                      <span className="text-[10px] opacity-75">Code: #AB72K</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/30 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                    ● LOBBY READY
                  </span>
                </div>

                {/* Player Seats Preview */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2.5 backdrop-blur-sm">
                    <UserAvatar avatarUrl={avatarUrl} equippedAvatar={previewCustomization.avatar} size="xs" />
                    <div className="min-w-0">
                      <strong className="block truncate text-xs font-black">{displayName}</strong>
                      <span className="text-[9px] font-bold text-emerald-400">HOST · READY</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2.5 backdrop-blur-sm">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-violet-600 text-xs font-black text-white">
                      🤖
                    </div>
                    <div className="min-w-0">
                      <strong className="block truncate text-xs font-black">Rally Bot</strong>
                      <span className="text-[9px] font-bold text-amber-300">BOT SEAT</span>
                    </div>
                  </div>
                </div>

                {/* Theme Tag */}
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 text-xs backdrop-blur-md">
                  <span className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Sparkles size={14} /> Theme: {item.name}
                  </span>
                  <span className="text-[10px] font-black uppercase text-slate-300">Equip to apply in all rooms</span>
                </div>
              </div>
            </div>
          ) : item.category === "victory" ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-violet-600">🏆 Victory Celebration Preview</p>
              <div className="relative overflow-hidden rounded-2xl border-2 border-slate-950 bg-slate-950 p-6 text-center text-white shadow-[4px_4px_0_#171821]">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-[#f4dc69] bg-slate-900 text-4xl shadow-[0_0_30px_#f4dc69] animate-bounce">
                  {victoryEmoji}
                </div>
                <strong className="mt-3 block text-lg font-black text-[#f4dc69]">YOU WON THE MATCH! 🎉</strong>
                <p className="text-xs text-slate-300">Equipped Victory Effect: {item.name}</p>

                <button
                  type="button"
                  onClick={() => setShowVictoryDemo(true)}
                  className="arcade-button mt-4 bg-[#f4dc69] text-xs text-slate-950 font-black shadow-[2px_2px_0_#fff]"
                >
                  <Play size={14} /> PLAY FULL CELEBRATION
                </button>
              </div>
            </div>
          ) : (
            /* Live Profile Card Preview for Avatars, Frames, Banners, Titles, Badges */
            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-violet-600">Live Item Preview</p>
              <PlayerCard displayName={displayName} avatarUrl={avatarUrl} customization={previewCustomization} balance={userBalance} />
            </div>
          )}

          <p className="mt-4 text-xs text-slate-600 leading-relaxed font-medium">{item.description}</p>

          {/* Action Footer */}
          <div className="mt-6 flex items-center justify-between border-t-2 border-slate-950 pt-4">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-500">Item Price</span>
              <p className="flex items-center gap-1.5 text-xl font-black text-slate-950">
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

      {showVictoryDemo && (
        <VictoryAnimationOverlay
          winnerName={displayName}
          isMe={true}
          equippedVictory={item}
          onDismiss={() => setShowVictoryDemo(false)}
        />
      )}
    </>
  );
}
