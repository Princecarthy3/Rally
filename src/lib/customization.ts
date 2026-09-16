export type ShopItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "avatar" | "frame" | "banner" | "background" | "title" | "name_color" | "name_effect" | "badge" | "victory" | "room_theme" | "emote";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  price: number;
  asset_value: string | null;
  active: boolean;
  limited: boolean;
};

export type UserCustomizationState = {
  avatar?: ShopItem | null;
  frame?: ShopItem | null;
  banner?: ShopItem | null;
  background?: ShopItem | null;
  title?: ShopItem | null;
  name_color?: ShopItem | null;
  name_effect?: ShopItem | null;
  victory?: ShopItem | null;
  room_theme?: ShopItem | null;
  badges: ShopItem[];
  bio: string;
  status_preset: string;
};

export type UserLevelState = {
  xp: number;
  level: number;
};

export const RARITY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  common: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300", glow: "" },
  uncommon: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-400", glow: "shadow-emerald-200" },
  rare: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-400", glow: "shadow-blue-200" },
  epic: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-400", glow: "shadow-purple-300" },
  legendary: { bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-400", glow: "shadow-amber-300" },
  mythic: { bg: "bg-rose-100", text: "text-rose-900", border: "border-rose-500", glow: "shadow-rose-400" },
};

// Helper: Get Frame CSS Class
export function getFrameCssClass(frame?: ShopItem | null): string {
  if (!frame || !frame.asset_value) return "frame-classic";
  const slug = frame.asset_value || frame.slug;
  return `frame-${slug.replace(/_/g, "-")}`;
}

// Helper: Get Banner Style
export function getBannerStyle(banner?: ShopItem | null): { background: string; className: string } {
  if (!banner || !banner.asset_value) {
    return { background: "#0f172a", className: "" };
  }
  const key = banner.asset_value || banner.slug;
  switch (key) {
    case "sunset":
      return { background: "linear-gradient(135deg, #ff7e5f, #feb47b)", className: "" };
    case "neon":
      return { background: "linear-gradient(135deg, #00f2fe, #4facfe)", className: "" };
    case "galaxy":
      return { background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", className: "" };
    case "ocean":
      return { background: "linear-gradient(135deg, #2b5876, #4e4376)", className: "" };
    case "fire":
      return { background: "linear-gradient(135deg, #f12711, #f5af19)", className: "" };
    case "synth":
      return { background: "linear-gradient(135deg, #ff007f, #7928ca, #00dfd8)", className: "" };
    case "cyber":
      return { background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)", className: "" };
    case "royal":
      return { background: "linear-gradient(135deg, #3a1c71, #d76d77, #ffaf7b)", className: "" };
    case "legendary":
      return { background: "linear-gradient(135deg, #bf953f, #fcf6ba, #b38728, #fbf5b7)", className: "" };
    default:
      return { background: "#1e293b", className: "" };
  }
}

// Helper: Get Profile Background Style
export function getBackgroundStyle(bg?: ShopItem | null): { background: string } {
  if (!bg || !bg.asset_value || bg.asset_value === "default") {
    return { background: "#fffdf7" };
  }
  const key = bg.asset_value || bg.slug;
  switch (key) {
    case "ocean":
      return { background: "radial-gradient(circle, #e0f2fe 0%, #bae6fd 100%)" };
    case "sunset":
      return { background: "radial-gradient(circle, #ffedd5 0%, #fed7aa 100%)" };
    case "galaxy":
      return { background: "radial-gradient(circle, #312e81 0%, #1e1b4b 100%)" };
    case "cyberpunk":
      return { background: "radial-gradient(circle, #18181b 0%, #09090b 100%)" };
    case "neon":
      return { background: "radial-gradient(circle, #2e1065 0%, #0f172a 100%)" };
    case "space":
      return { background: "radial-gradient(circle, #020617 0%, #0f172a 100%)" };
    case "aurora":
      return { background: "radial-gradient(circle, #064e3b 0%, #022c22 100%)" };
    case "volcano":
      return { background: "radial-gradient(circle, #450a0a 0%, #180202 100%)" };
    case "palace":
      return { background: "radial-gradient(circle, #4c1d95 0%, #1e1b4b 100%)" };
    default:
      return { background: "#fffdf7" };
  }
}

// Helper: Get Name Color CSS / Style
export function getNameColorStyle(nameColor?: ShopItem | null): { className: string; style?: React.CSSProperties } {
  if (!nameColor || !nameColor.asset_value || nameColor.asset_value === "default") {
    return { className: "text-slate-950 font-black" };
  }
  if (nameColor.asset_value === "rainbow" || nameColor.slug === "rainbow-name-color") {
    return { className: "bg-gradient-to-r from-red-500 via-yellow-400 via-emerald-400 via-blue-500 to-purple-500 bg-clip-text text-transparent animate-rainbow font-extrabold" };
  }
  if (nameColor.asset_value.startsWith("#")) {
    const hex = nameColor.asset_value.toLowerCase().trim();
    if (["#ffffff", "#fff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#f5f5f5"].includes(hex)) {
      return { className: "text-slate-950 font-extrabold" };
    }
    return { className: "font-extrabold", style: { color: nameColor.asset_value } };
  }
  return { className: "text-slate-950 font-black" };
}

// Helper: Get Name Effect Asset/Emoji
export function getNameEffectElement(effect?: ShopItem | null): { prefix: string; suffix: string; className: string } {
  if (!effect || !effect.asset_value) return { prefix: "", suffix: "", className: "" };
  const key = effect.asset_value || effect.slug;
  switch (key) {
    case "sparkle":
      return { prefix: "✨ ", suffix: " ✨", className: "animate-pulse" };
    case "flame":
      return { prefix: "🔥 ", suffix: " 🔥", className: "animate-bounce" };
    case "lightning":
      return { prefix: "⚡ ", suffix: " ⚡", className: "" };
    case "rainbow":
      return { prefix: "🌈 ", suffix: " 🌈", className: "" };
    case "diamond":
      return { prefix: "💎 ", suffix: " 💎", className: "" };
    case "royal":
      return { prefix: "👑 ", suffix: " 👑", className: "" };
    default:
      return { prefix: "", suffix: "", className: "" };
  }
}

// Helper: Get Room Theme CSS Style
export function getRoomThemeStyle(theme?: ShopItem | null): { containerClass: string; bgStyle: React.CSSProperties } {
  if (!theme || !theme.asset_value || theme.asset_value === "classic") {
    return { containerClass: "bg-[#fffdf7]", bgStyle: {} };
  }
  const key = theme.asset_value || theme.slug;
  switch (key) {
    case "arcade":
      return { containerClass: "bg-[#181825] text-white", bgStyle: { backgroundImage: "radial-gradient(#313244 1px, transparent 1px)", backgroundSize: "20px 20px" } };
    case "neon":
      return { containerClass: "bg-[#090d16] text-white", bgStyle: { background: "radial-gradient(ellipse at center, #1b0c3a 0%, #05050f 100%)" } };
    case "space":
      return { containerClass: "bg-[#030712] text-white", bgStyle: { background: "radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 100%)" } };
    case "galaxy":
      return { containerClass: "bg-[#0b071e] text-white", bgStyle: { background: "linear-gradient(135deg, #180036 0%, #000000 100%)" } };
    case "fire":
      return { containerClass: "bg-[#1a0505] text-white", bgStyle: { background: "radial-gradient(circle at bottom, #450a0a 0%, #0f0202 100%)" } };
    case "cyberpunk":
      return { containerClass: "bg-[#05050a] text-[#00ffcc]", bgStyle: { background: "linear-gradient(180deg, #0d001a 0%, #020005 100%)" } };
    case "royal":
      return { containerClass: "bg-[#1a0c2e] text-amber-300", bgStyle: { background: "linear-gradient(135deg, #2e1065 0%, #0f051d 100%)" } };
    case "legendary":
      return { containerClass: "bg-[#1c1917] text-amber-400", bgStyle: { background: "radial-gradient(circle at center, #451a03 0%, #0c0a09 100%)" } };
    default:
      return { containerClass: "bg-[#fffdf7]", bgStyle: {} };
  }
}

// Helper: Get Item Card Preview Icon/Badge
export function getItemPreviewIcon(item?: ShopItem | null): string {
  if (!item) return "🎁";
  const val = (item.asset_value || item.slug || "").toLowerCase();

  if (item.category === "victory") {
    if (val.includes("firework")) return "🎆";
    if (val.includes("lightning") || val.includes("storm")) return "⚡";
    if (val.includes("flame") || val.includes("dragon") || val.includes("fire")) return "🔥";
    if (val.includes("crown") || val.includes("king")) return "👑";
    if (val.includes("galaxy") || val.includes("supernova")) return "🌌";
    if (val.includes("confetti")) return "🎊";
    return "🎉";
  }

  if (item.category === "room_theme") {
    if (val.includes("arcade")) return "🕹️";
    if (val.includes("neon")) return "🌃";
    if (val.includes("space")) return "🚀";
    if (val.includes("galaxy")) return "🌌";
    if (val.includes("fire") || val.includes("volcano")) return "🌋";
    if (val.includes("cyber")) return "🌆";
    if (val.includes("royal") || val.includes("palace")) return "🏰";
    if (val.includes("legend") || val.includes("hall")) return "👑";
    return "🎮";
  }

  if (item.category === "name_effect") {
    if (val.includes("sparkle")) return "✨";
    if (val.includes("flame")) return "🔥";
    if (val.includes("lightning")) return "⚡";
    if (val.includes("rainbow")) return "🌈";
    if (val.includes("diamond")) return "💎";
    if (val.includes("royal")) return "👑";
    return "✨";
  }

  if (item.category === "name_color") return "🎨";
  if (item.category === "title") return "🏆";
  if (item.category === "banner") return "🚩";
  if (item.category === "background") return "🖼️";
  if (item.category === "frame") return "⭕";
  if (item.category === "badge") return item.asset_value || "🎖️";
  if (item.category === "avatar") return item.asset_value || "👤";
  if (item.category === "emote") return item.asset_value || "😀";

  return item.asset_value || "🎁";
}
