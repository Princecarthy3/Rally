"use client";
/* eslint-disable @next/next/no-img-element */

import { ShopItem, getFrameCssClass } from "@/lib/customization";

interface UserAvatarProps {
  avatarUrl?: string | null;
  equippedAvatar?: ShopItem | null;
  equippedFrame?: ShopItem | null;
  fallbackName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: "h-8 w-8 text-xs border-2",
  sm: "h-10 w-10 text-sm border-2",
  md: "h-14 w-14 text-xl border-3",
  lg: "h-20 w-20 text-3xl border-4",
  xl: "h-28 w-28 text-5xl border-4",
};

export function UserAvatar({
  avatarUrl,
  equippedAvatar,
  equippedFrame,
  fallbackName = "Player",
  size = "md",
  className = "",
}: UserAvatarProps) {
  const frameClass = getFrameCssClass(equippedFrame);
  const sizeClass = sizes[size] || sizes.md;
  const initial = fallbackName.trim().charAt(0).toUpperCase() || "P";
  const avatarAsset = equippedAvatar?.asset_value;
  const isCustomAssetImage = avatarAsset?.startsWith("http") || avatarAsset?.startsWith("/");

  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-full bg-slate-900 font-black text-white shrink-0 transition-transform ${sizeClass} ${frameClass} ${className}`}
    >
      {avatarAsset ? (
        isCustomAssetImage ? (
          <img src={avatarAsset} alt={fallbackName} className="h-full w-full object-cover" />
        ) : (
          <span className="select-none">{avatarAsset}</span>
        )
      ) : avatarUrl ? (
        <img src={avatarUrl} alt={fallbackName} className="h-full w-full object-cover" />
      ) : (
        <span className="select-none">{initial}</span>
      )}
    </div>
  );
}
