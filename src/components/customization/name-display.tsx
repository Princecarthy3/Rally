"use client";

import { ShopItem, getNameColorStyle, getNameEffectElement } from "@/lib/customization";

interface NameDisplayProps {
  name: string;
  nameColor?: ShopItem | null;
  nameEffect?: ShopItem | null;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "strong";
}

export function NameDisplay({
  name,
  nameColor,
  nameEffect,
  className = "",
  as: Component = "span",
}: NameDisplayProps) {
  const { className: colorClass, style: colorStyle } = getNameColorStyle(nameColor);
  const { prefix, suffix, className: effectClass } = getNameEffectElement(nameEffect);

  return (
    <Component className={`inline-flex items-center gap-0.5 font-black ${colorClass} ${className}`} style={colorStyle}>
      {prefix && <span className={`select-none ${effectClass}`}>{prefix}</span>}
      <span className="truncate">{name}</span>
      {suffix && <span className={`select-none ${effectClass}`}>{suffix}</span>}
    </Component>
  );
}
