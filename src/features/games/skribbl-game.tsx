"use client";

import { Eraser, Paintbrush, PaintBucket, RotateCcw, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const WORD_BANK = [
  "Apple", "Banana", "House", "Cat", "Dog", "Sun", "Moon", "Tree", "Car", "Fish",
  "Pizza", "Chair", "Book", "Phone", "Ball", "Shoe", "Hat", "Cloud", "Star", "Cake",
  "Toilet", "Vampire", "Ghost", "Robot", "Dinosaur", "Astronaut", "Pirate", "Mermaid",
  "Zombie", "Monkey", "Chicken", "Skateboard", "Sunglasses", "Toothbrush", "Backpack",
  "Wi-Fi", "Exam", "Procrastination", "Alien", "Time machine", "Broken heart", "Traffic jam", "Superhero",
  "Submarine", "Pikachu", "Telescope", "Pineapple", "Helicopter", "Rainbow", "Watermelon", "Guitar",
  "Hamburger", "Campfire", "Microscope", "Lighthouse", "Rollercoaster", "Butterfly", "Volcano", "Spaghetti", "Pyramid"
];

const COLORS = [
  "#000000", "#ffffff", "#64748b", "#78350f",
  "#ef4444", "#f97316", "#eab308", "#84cc16",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#6366f1", "#a855f7", "#ec4899", "#f43f5e",
];

const ROUND_SECONDS = 60;

interface StrokeData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
}

function fallbackWords(excluded: string[]) {
  const blocked = new Set(excluded.map((word) => word.toLowerCase()));
  const pool = WORD_BANK.filter((word) => !blocked.has(word.toLowerCase()));
  const choices: string[] = [];
  while (choices.length < 3 && pool.length) {
    choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return choices;
}


/** Simple stroke recipes so the bot can sketch something related to the word. */
type BotStroke = { x0: number; y0: number; x1: number; y1: number; color: string; size: number };
type BotFill = { x: number; y: number; color: string };

function circleStrokes(cx: number, cy: number, r: number, color: string, size = 4, steps = 28): BotStroke[] {
  const out: BotStroke[] = [];
  let px = cx + r;
  let py = cy;
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    out.push({ x0: px, y0: py, x1: x, y1: y, color, size });
    px = x;
    py = y;
  }
  return out;
}

function line(x0: number, y0: number, x1: number, y1: number, color: string, size = 4): BotStroke {
  return { x0, y0, x1, y1, color, size };
}

function rectStrokes(x: number, y: number, w: number, h: number, color: string, size = 4): BotStroke[] {
  return [
    line(x, y, x + w, y, color, size),
    line(x + w, y, x + w, y + h, color, size),
    line(x + w, y + h, x, y + h, color, size),
    line(x, y + h, x, y, color, size),
  ];
}

function polyStrokes(points: Array<[number, number]>, color: string, size = 4, close = true): BotStroke[] {
  const out: BotStroke[] = [];
  for (let i = 1; i < points.length; i++) {
    out.push(line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], color, size));
  }
  if (close && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];
    out.push(line(last[0], last[1], first[0], first[1], color, size));
  }
  return out;
}

function botArtForWord(raw: string): { strokes: BotStroke[]; fills: BotFill[] } {
  const word = raw.toLowerCase().trim();
  const strokes: BotStroke[] = [];
  const fills: BotFill[] = [];
  const ink = "#171821";
  const red = "#ef4444";
  const blue = "#3b82f6";
  const green = "#22c55e";
  const yellow = "#eab308";
  const orange = "#f97316";
  const brown = "#78350f";
  const pink = "#ec4899";
  const cyan = "#06b6d4";
  const cx = 300;
  const cy = 190;

  // --- Animals ---
  if (/\b(cat|kitten)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 10, 55, ink, 4));
    strokes.push(...polyStrokes([[cx - 40, cy - 30], [cx - 25, cy - 70], [cx - 10, cy - 30]], ink, 4));
    strokes.push(...polyStrokes([[cx + 10, cy - 30], [cx + 25, cy - 70], [cx + 40, cy - 30]], ink, 4));
    strokes.push(...circleStrokes(cx - 18, cy, 6, ink, 3));
    strokes.push(...circleStrokes(cx + 18, cy, 6, ink, 3));
    strokes.push(line(cx - 8, cy + 18, cx + 8, cy + 18, pink, 3));
    fills.push({ x: cx, y: cy, color: "#fde68a" });
  } else if (/\b(dog|puppy)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 5, 50, ink, 4));
    strokes.push(...circleStrokes(cx - 55, cy - 10, 18, ink, 3));
    strokes.push(...circleStrokes(cx + 55, cy - 10, 18, ink, 3));
    strokes.push(...circleStrokes(cx - 15, cy, 5, ink, 3));
    strokes.push(...circleStrokes(cx + 15, cy, 5, ink, 3));
    strokes.push(line(cx, cy + 10, cx, cy + 25, ink, 3));
    fills.push({ x: cx, y: cy, color: "#fbbf24" });
  } else if (/\b(fish)\b/.test(word)) {
    strokes.push(...circleStrokes(cx - 20, cy, 45, cyan, 4));
    strokes.push(...polyStrokes([[cx + 20, cy], [cx + 80, cy - 35], [cx + 80, cy + 35]], cyan, 4));
    strokes.push(...circleStrokes(cx - 35, cy - 10, 5, ink, 3));
    fills.push({ x: cx - 20, y: cy, color: "#7dd3fc" });
  } else if (/\b(bird|chicken)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 40, ink, 4));
    strokes.push(...circleStrokes(cx + 35, cy - 25, 18, ink, 3));
    strokes.push(...polyStrokes([[cx + 50, cy - 25], [cx + 75, cy - 20], [cx + 50, cy - 15]], orange, 3));
    strokes.push(...polyStrokes([[cx - 10, cy + 10], [cx - 70, cy - 20], [cx - 20, cy + 25]], ink, 3));
    fills.push({ x: cx, y: cy, color: "#fef3c7" });
  } else if (/\b(monkey)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 50, brown, 4));
    strokes.push(...circleStrokes(cx - 40, cy - 20, 16, brown, 3));
    strokes.push(...circleStrokes(cx + 40, cy - 20, 16, brown, 3));
    strokes.push(...circleStrokes(cx - 15, cy, 5, ink, 3));
    strokes.push(...circleStrokes(cx + 15, cy, 5, ink, 3));
    fills.push({ x: cx, y: cy, color: "#d6a06a" });
  } else if (/\b(butterfly)\b/.test(word)) {
    strokes.push(...circleStrokes(cx - 50, cy - 20, 35, pink, 3));
    strokes.push(...circleStrokes(cx + 50, cy - 20, 35, pink, 3));
    strokes.push(...circleStrokes(cx - 45, cy + 30, 28, "#a855f7", 3));
    strokes.push(...circleStrokes(cx + 45, cy + 30, 28, "#a855f7", 3));
    strokes.push(line(cx, cy - 60, cx, cy + 70, ink, 4));
    fills.push({ x: cx - 50, y: cy - 20, color: "#fbcfe8" });
  } else if (/\b(dinosaur)\b/.test(word)) {
    strokes.push(...circleStrokes(cx - 40, cy + 10, 40, green, 4));
    strokes.push(line(cx - 10, cy + 10, cx + 80, cy + 30, green, 6));
    strokes.push(...polyStrokes([[cx - 60, cy - 20], [cx - 50, cy - 60], [cx - 30, cy - 20]], green, 3));
    strokes.push(...polyStrokes([[cx - 40, cy - 15], [cx - 30, cy - 50], [cx - 15, cy - 15]], green, 3));
    fills.push({ x: cx - 40, y: cy + 10, color: "#86efac" });
  } else if (/\b(zombie)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 40, 35, green, 4));
    strokes.push(...rectStrokes(cx - 35, cy, 70, 90, green, 4));
    strokes.push(...circleStrokes(cx - 12, cy - 45, 5, ink, 3));
    strokes.push(...circleStrokes(cx + 12, cy - 45, 5, ink, 3));
    strokes.push(line(cx - 10, cy - 25, cx + 10, cy - 25, ink, 2));
    fills.push({ x: cx, y: cy - 40, color: "#bbf7d0" });
  } else if (/\b(ghost)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 30, 40, "#94a3b8", 4));
    strokes.push(line(cx - 40, cy - 20, cx - 40, cy + 60, "#94a3b8", 4));
    strokes.push(line(cx + 40, cy - 20, cx + 40, cy + 60, "#94a3b8", 4));
    strokes.push(...polyStrokes([[cx - 40, cy + 60], [cx - 20, cy + 40], [cx, cy + 60], [cx + 20, cy + 40], [cx + 40, cy + 60]], "#94a3b8", 3, false));
    strokes.push(...circleStrokes(cx - 12, cy - 35, 5, ink, 3));
    strokes.push(...circleStrokes(cx + 12, cy - 35, 5, ink, 3));
  } else if (/\b(alien)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 55, green, 4));
    strokes.push(...circleStrokes(cx - 18, cy - 5, 12, ink, 3));
    strokes.push(...circleStrokes(cx + 18, cy - 5, 12, ink, 3));
    strokes.push(line(cx - 30, cy - 55, cx - 50, cy - 90, green, 3));
    strokes.push(line(cx + 30, cy - 55, cx + 50, cy - 90, green, 3));
    fills.push({ x: cx, y: cy, color: "#86efac" });
  } else if (/\b(mermaid)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 50, 28, pink, 3));
    strokes.push(...rectStrokes(cx - 25, cy - 25, 50, 55, pink, 3));
    strokes.push(...polyStrokes([[cx - 30, cy + 30], [cx, cy + 100], [cx + 30, cy + 30]], cyan, 4));
    fills.push({ x: cx, y: cy + 50, color: "#67e8f9" });
  } else if (/\b(pirate)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 50, ink, 4));
    strokes.push(line(cx - 45, cy - 15, cx + 45, cy - 15, ink, 8));
    strokes.push(...circleStrokes(cx + 15, cy, 6, ink, 3));
    strokes.push(line(cx - 15, cy + 15, cx + 5, cy + 15, ink, 3));
    fills.push({ x: cx, y: cy + 20, color: "#fed7aa" });
  } else if (/\b(robot)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 50, cy - 40, 100, 90, ink, 4));
    strokes.push(...rectStrokes(cx - 30, cy - 80, 60, 35, ink, 4));
    strokes.push(...circleStrokes(cx - 15, cy - 62, 6, red, 3));
    strokes.push(...circleStrokes(cx + 15, cy - 62, 6, red, 3));
    strokes.push(line(cx - 20, cy, cx + 20, cy, ink, 3));
    fills.push({ x: cx, y: cy, color: "#cbd5e1" });
  } else if (/\b(superhero)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 40, 30, ink, 3));
    strokes.push(...rectStrokes(cx - 30, cy - 10, 60, 80, red, 4));
    strokes.push(...polyStrokes([[cx - 30, cy], [cx - 80, cy + 40], [cx - 30, cy + 30]], red, 3));
    strokes.push(...polyStrokes([[cx + 30, cy], [cx + 80, cy + 40], [cx + 30, cy + 30]], red, 3));
  }
  // --- Nature / objects ---
  else if (/\b(sun|star)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 40, yellow, 4));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      strokes.push(line(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50, cx + Math.cos(a) * 80, cy + Math.sin(a) * 80, yellow, 4));
    }
    fills.push({ x: cx, y: cy, color: "#fde047" });
  } else if (/\b(moon)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 55, yellow, 4));
    strokes.push(...circleStrokes(cx + 20, cy - 10, 40, "#fffbeb", 4));
    fills.push({ x: cx - 15, y: cy, color: "#fef08a" });
  } else if (/\b(tree)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 12, cy + 20, 24, 70, brown, 4));
    strokes.push(...circleStrokes(cx, cy - 10, 55, green, 4));
    fills.push({ x: cx, y: cy - 10, color: "#4ade80" });
  } else if (/\b(cloud)\b/.test(word)) {
    strokes.push(...circleStrokes(cx - 40, cy, 35, "#94a3b8", 3));
    strokes.push(...circleStrokes(cx + 10, cy - 15, 45, "#94a3b8", 3));
    strokes.push(...circleStrokes(cx + 50, cy + 5, 32, "#94a3b8", 3));
  } else if (/\b(volcano)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx - 100, cy + 80], [cx - 20, cy - 40], [cx + 20, cy - 40], [cx + 100, cy + 80]], brown, 4));
    strokes.push(...polyStrokes([[cx - 15, cy - 40], [cx, cy - 90], [cx + 15, cy - 40]], red, 3));
    fills.push({ x: cx, y: cy + 20, color: "#a16207" });
  } else if (/\b(rainbow)\b/.test(word)) {
    const cols = [red, orange, yellow, green, blue, "#a855f7"];
    cols.forEach((c, i) => {
      strokes.push(...circleStrokes(cx, cy + 40, 100 - i * 12, c, 5, 20).filter((s) => s.y0 < cy + 40 && s.y1 < cy + 40));
    });
  } else if (/\b(house)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 70, cy - 10, 140, 100, ink, 4));
    strokes.push(...polyStrokes([[cx - 90, cy - 10], [cx, cy - 90], [cx + 90, cy - 10]], red, 4));
    strokes.push(...rectStrokes(cx - 15, cy + 30, 30, 60, brown, 3));
    fills.push({ x: cx, y: cy + 20, color: "#fef3c7" });
  } else if (/\b(car)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 90, cy - 10, 180, 50, blue, 4));
    strokes.push(...polyStrokes([[cx - 50, cy - 10], [cx - 30, cy - 50], [cx + 40, cy - 50], [cx + 70, cy - 10]], blue, 3));
    strokes.push(...circleStrokes(cx - 50, cy + 40, 18, ink, 4));
    strokes.push(...circleStrokes(cx + 50, cy + 40, 18, ink, 4));
    fills.push({ x: cx, y: cy + 10, color: "#93c5fd" });
  } else if (/\b(bicycle|bike)\b/.test(word)) {
    strokes.push(...circleStrokes(cx - 70, cy + 20, 35, ink, 4));
    strokes.push(...circleStrokes(cx + 70, cy + 20, 35, ink, 4));
    strokes.push(line(cx - 70, cy + 20, cx + 20, cy + 20, ink, 3));
    strokes.push(line(cx + 20, cy + 20, cx + 70, cy + 20, ink, 3));
    strokes.push(line(cx + 20, cy + 20, cx, cy - 40, ink, 3));
    strokes.push(line(cx, cy - 40, cx - 40, cy + 20, ink, 3));
  } else if (/\b(airplane|helicopter)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 80, cy - 15, 160, 30, ink, 4));
    strokes.push(...polyStrokes([[cx - 10, cy], [cx - 60, cy - 50], [cx + 10, cy]], ink, 3));
    strokes.push(...polyStrokes([[cx - 10, cy + 15], [cx - 50, cy + 55], [cx + 10, cy + 15]], ink, 3));
    if (word.includes("helicopter")) {
      strokes.push(line(cx - 90, cy - 40, cx + 90, cy - 40, ink, 3));
    }
  } else if (/\b(boat|submarine|ship)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx - 90, cy], [cx - 70, cy + 50], [cx + 70, cy + 50], [cx + 90, cy]], blue, 4));
    strokes.push(...rectStrokes(cx - 30, cy - 40, 60, 40, ink, 3));
    fills.push({ x: cx, y: cy + 20, color: "#7dd3fc" });
  } else if (/\b(apple)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 10, 50, red, 4));
    strokes.push(line(cx, cy - 40, cx + 5, cy - 70, brown, 3));
    strokes.push(...polyStrokes([[cx + 5, cy - 55], [cx + 35, cy - 70], [cx + 15, cy - 45]], green, 3));
    fills.push({ x: cx, y: cy + 10, color: "#fca5a5" });
  } else if (/\b(banana)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx - 60, cy - 20], [cx - 40, cy + 40], [cx + 20, cy + 50], [cx + 70, cy + 10], [cx + 40, cy - 10], [cx - 20, cy + 10]], yellow, 4));
    fills.push({ x: cx, y: cy + 15, color: "#fde047" });
  } else if (/\b(pizza)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx, cy - 70], [cx - 80, cy + 60], [cx + 80, cy + 60]], orange, 4));
    strokes.push(...circleStrokes(cx - 15, cy, 8, red, 3));
    strokes.push(...circleStrokes(cx + 20, cy + 20, 8, red, 3));
    strokes.push(...circleStrokes(cx - 25, cy + 30, 7, red, 3));
    fills.push({ x: cx, y: cy + 10, color: "#fdba74" });
  } else if (/\b(cake|cupcake)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 50, cy, 100, 60, pink, 4));
    strokes.push(...polyStrokes([[cx - 50, cy], [cx - 40, cy - 30], [cx - 20, cy - 10], [cx, cy - 35], [cx + 20, cy - 10], [cx + 40, cy - 30], [cx + 50, cy]], pink, 3, false));
    strokes.push(line(cx, cy - 35, cx, cy - 60, ink, 2));
    strokes.push(...circleStrokes(cx, cy - 65, 6, red, 3));
    fills.push({ x: cx, y: cy + 20, color: "#fbcfe8" });
  } else if (/\b(hamburger|burger)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 25, 55, orange, 4, 20).filter((s) => s.y0 <= cy - 25 || s.y1 <= cy - 25));
    strokes.push(...rectStrokes(cx - 55, cy - 10, 110, 18, green, 3));
    strokes.push(...rectStrokes(cx - 55, cy + 8, 110, 18, brown, 3));
    strokes.push(...circleStrokes(cx, cy + 40, 55, orange, 4, 20).filter((s) => s.y0 >= cy + 40 || s.y1 >= cy + 40));
  } else if (/\b(watermelon)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 70, green, 5));
    strokes.push(...circleStrokes(cx, cy, 55, red, 3));
    strokes.push(...circleStrokes(cx - 15, cy - 10, 4, ink, 2));
    strokes.push(...circleStrokes(cx + 18, cy + 12, 4, ink, 2));
    fills.push({ x: cx, y: cy, color: "#fca5a5" });
  } else if (/\b(pineapple)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 20, 50, yellow, 4));
    strokes.push(...polyStrokes([[cx - 20, cy - 30], [cx, cy - 90], [cx + 20, cy - 30]], green, 3));
    strokes.push(...polyStrokes([[cx - 35, cy - 20], [cx - 10, cy - 75], [cx + 5, cy - 25]], green, 3));
    fills.push({ x: cx, y: cy + 20, color: "#fde047" });
  } else if (/\b(phone)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 35, cy - 70, 70, 140, ink, 4));
    strokes.push(...rectStrokes(cx - 25, cy - 55, 50, 100, blue, 3));
    strokes.push(...circleStrokes(cx, cy + 55, 6, ink, 2));
  } else if (/\b(book)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 60, cy - 50, 120, 100, blue, 4));
    strokes.push(line(cx, cy - 50, cx, cy + 50, ink, 3));
    fills.push({ x: cx - 30, y: cy, color: "#93c5fd" });
  } else if (/\b(chair)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 50, cy - 10, 100, 15, brown, 4));
    strokes.push(line(cx - 50, cy - 10, cx - 50, cy - 70, brown, 4));
    strokes.push(line(cx + 50, cy - 10, cx + 50, cy - 70, brown, 4));
    strokes.push(line(cx - 50, cy - 70, cx + 50, cy - 70, brown, 3));
    strokes.push(line(cx - 40, cy + 5, cx - 40, cy + 70, brown, 3));
    strokes.push(line(cx + 40, cy + 5, cx + 40, cy + 70, brown, 3));
  } else if (/\b(hat)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 10, 40, ink, 4));
    strokes.push(line(cx - 80, cy + 20, cx + 80, cy + 20, ink, 6));
    fills.push({ x: cx, y: cy - 10, color: "#334155" });
  } else if (/\b(shoe)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx - 70, cy - 20], [cx + 40, cy - 20], [cx + 80, cy + 30], [cx - 70, cy + 30]], ink, 4));
    fills.push({ x: cx, y: cy, color: "#94a3b8" });
  } else if (/\b(ball)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 60, orange, 4));
    strokes.push(line(cx - 60, cy, cx + 60, cy, ink, 2));
    strokes.push(line(cx, cy - 60, cx, cy + 60, ink, 2));
    fills.push({ x: cx, y: cy, color: "#fdba74" });
  } else if (/\b(guitar)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 30, 50, brown, 4));
    strokes.push(...circleStrokes(cx, cy - 5, 30, brown, 3));
    strokes.push(...rectStrokes(cx - 8, cy - 100, 16, 90, brown, 3));
    strokes.push(...circleStrokes(cx, cy + 30, 12, ink, 2));
    fills.push({ x: cx, y: cy + 30, color: "#d6a06a" });
  } else if (/\b(umbrella)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy, 70, red, 4, 24).filter((s) => s.y0 <= cy && s.y1 <= cy));
    strokes.push(line(cx, cy, cx, cy + 90, ink, 3));
    strokes.push(...polyStrokes([[cx, cy + 90], [cx + 20, cy + 100], [cx, cy + 95]], ink, 2));
  } else if (/\b(toilet)\b/.test(word)) {
    strokes.push(...rectStrokes(cx - 40, cy - 20, 80, 70, "#94a3b8", 4));
    strokes.push(...circleStrokes(cx, cy + 5, 28, "#e2e8f0", 3));
    strokes.push(...rectStrokes(cx - 50, cy - 70, 100, 50, "#94a3b8", 3));
  } else if (/\b(heart|broken heart)\b/.test(word)) {
    strokes.push(...circleStrokes(cx - 25, cy - 10, 30, red, 4));
    strokes.push(...circleStrokes(cx + 25, cy - 10, 30, red, 4));
    strokes.push(...polyStrokes([[cx - 52, cy], [cx, cy + 70], [cx + 52, cy]], red, 4, false));
    fills.push({ x: cx, y: cy + 10, color: "#fca5a5" });
  } else if (/\b(castle|pyramid)\b/.test(word)) {
    if (word.includes("pyramid")) {
      strokes.push(...polyStrokes([[cx - 100, cy + 80], [cx, cy - 80], [cx + 100, cy + 80]], yellow, 4));
      fills.push({ x: cx, y: cy + 20, color: "#fde68a" });
    } else {
      strokes.push(...rectStrokes(cx - 80, cy - 20, 160, 100, "#64748b", 4));
      strokes.push(...rectStrokes(cx - 90, cy - 50, 30, 40, "#64748b", 3));
      strokes.push(...rectStrokes(cx + 60, cy - 50, 30, 40, "#64748b", 3));
      strokes.push(...rectStrokes(cx - 20, cy - 70, 40, 50, "#64748b", 3));
    }
  } else if (/\b(lighthouse)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx - 40, cy + 90], [cx - 25, cy - 60], [cx + 25, cy - 60], [cx + 40, cy + 90]], red, 4));
    strokes.push(...rectStrokes(cx - 30, cy - 90, 60, 30, yellow, 3));
    fills.push({ x: cx, y: cy + 20, color: "#fca5a5" });
  } else if (/\b(campfire|fire)\b/.test(word)) {
    strokes.push(...polyStrokes([[cx - 40, cy + 40], [cx, cy - 50], [cx + 40, cy + 40]], red, 4));
    strokes.push(...polyStrokes([[cx - 25, cy + 40], [cx, cy - 20], [cx + 25, cy + 40]], orange, 3));
    strokes.push(line(cx - 50, cy + 45, cx + 50, cy + 45, brown, 5));
    fills.push({ x: cx, y: cy + 10, color: "#fb923c" });
  } else if (/\b(wi-?fi|wifi)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 40, 8, ink, 3));
    strokes.push(...circleStrokes(cx, cy + 40, 30, ink, 3, 16).filter((s) => s.y0 <= cy + 40 && s.y1 <= cy + 40));
    strokes.push(...circleStrokes(cx, cy + 40, 50, ink, 3, 16).filter((s) => s.y0 <= cy + 40 && s.y1 <= cy + 40));
    strokes.push(...circleStrokes(cx, cy + 40, 70, ink, 3, 16).filter((s) => s.y0 <= cy + 40 && s.y1 <= cy + 40));
  } else if (/\b(pikachu)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy + 10, 55, yellow, 4));
    strokes.push(...polyStrokes([[cx - 35, cy - 30], [cx - 50, cy - 90], [cx - 10, cy - 40]], yellow, 3));
    strokes.push(...polyStrokes([[cx + 35, cy - 30], [cx + 50, cy - 90], [cx + 10, cy - 40]], yellow, 3));
    strokes.push(...circleStrokes(cx - 18, cy, 6, ink, 3));
    strokes.push(...circleStrokes(cx + 18, cy, 6, ink, 3));
    strokes.push(...circleStrokes(cx - 30, cy + 25, 10, red, 2));
    strokes.push(...circleStrokes(cx + 30, cy + 25, 10, red, 2));
    fills.push({ x: cx, y: cy + 10, color: "#fde047" });
  } else if (/\b(astronaut)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 40, 40, ink, 4));
    strokes.push(...circleStrokes(cx, cy - 40, 28, cyan, 3));
    strokes.push(...rectStrokes(cx - 40, cy, 80, 90, ink, 4));
    fills.push({ x: cx, y: cy - 40, color: "#e2e8f0" });
  } else if (/\b(vampire)\b/.test(word)) {
    strokes.push(...circleStrokes(cx, cy - 30, 35, ink, 3));
    strokes.push(...rectStrokes(cx - 40, cy, 80, 90, ink, 4));
    strokes.push(...polyStrokes([[cx - 40, cy], [cx - 90, cy + 80], [cx - 40, cy + 40]], ink, 3));
    strokes.push(...polyStrokes([[cx + 40, cy], [cx + 90, cy + 80], [cx + 40, cy + 40]], ink, 3));
    strokes.push(line(cx - 10, cy - 20, cx - 5, cy - 10, ink, 2));
    strokes.push(line(cx + 5, cy - 10, cx + 10, cy - 20, ink, 2));
  }
  // --- Generic fallback from letters / shape keywords ---
  else {
    // Try keyword families
    if (/animal|creature|pet/.test(word)) {
      strokes.push(...circleStrokes(cx, cy, 50, ink, 4));
      strokes.push(...circleStrokes(cx - 15, cy - 5, 5, ink, 3));
      strokes.push(...circleStrokes(cx + 15, cy - 5, 5, ink, 3));
    } else if (/food|eat|fruit|meal/.test(word)) {
      strokes.push(...circleStrokes(cx, cy, 55, orange, 4));
      fills.push({ x: cx, y: cy, color: "#fdba74" });
    } else if (/vehicle|drive|ride|truck/.test(word)) {
      strokes.push(...rectStrokes(cx - 80, cy - 10, 160, 50, blue, 4));
      strokes.push(...circleStrokes(cx - 45, cy + 40, 16, ink, 3));
      strokes.push(...circleStrokes(cx + 45, cy + 40, 16, ink, 3));
    } else if (/place|building|city|school|hospital/.test(word)) {
      strokes.push(...rectStrokes(cx - 70, cy - 40, 140, 120, ink, 4));
      strokes.push(...rectStrokes(cx - 25, cy + 20, 50, 60, ink, 3));
    } else {
      // Draw a rounded blob + write first letter as stick strokes for a hint
      strokes.push(...circleStrokes(cx, cy, 60, ink, 4));
      const letter = (raw[0] || "?").toUpperCase();
      // simple letter-ish marks in the center
      if ("AEFHIKLMNTVWXYZ".includes(letter)) {
        strokes.push(line(cx - 20, cy - 30, cx - 20, cy + 30, ink, 5));
      }
      if ("ABCDEFHJKLMNPR".includes(letter)) {
        strokes.push(line(cx - 20, cy - 30, cx + 15, cy - 30, ink, 4));
      }
      strokes.push(line(cx - 15, cy, cx + 15, cy, ink, 3));
      strokes.push(line(cx - 25, cy + 40, cx + 25, cy + 40, ink, 3));
    }
  }

  return { strokes, fills };
}


export function SkribblGame({
  room,
  players,
  userId,
  act,
  busy,
}: {
  room: Room;
  players: RoomPlayer[];
  userId: string;
  act: (action: string, value?: string) => Promise<void>;
  busy: boolean;
}) {
  const me = players.find((p) => p.player_id === userId);
  const state = (room.public_state || {}) as Record<string, any>;
  const drawerSeat = (state.drawerSeat as number) || 1;
  const isDrawer = me?.seat === drawerSeat;
  const wordSelected = state.wordSelected as string | null;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(6);
  const [tool, setTool] = useState<"brush" | "eraser" | "fill">("brush");
  const [guess, setGuess] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);

  const prevPos = useRef<{ x: number; y: number } | null>(null);
  const channelRef = useRef<any>(null);

  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [wordDifficulty, setWordDifficulty] = useState<"easy" | "medium" | "hard">(
    () => (state.skribblDifficulty as "easy" | "medium" | "hard") || "medium"
  );
  const [wordCategory, setWordCategory] = useState<string>(
    () => (state.skribblCategory as string) || "random"
  );
  const [loadingWords, setLoadingWords] = useState(false);
  const fetchedSeedRef = useRef<string | null>(null);
  // Stabilize usedWords so realtime public_state refreshes don't retrigger generation.
  const usedWordsKey = Array.isArray(state.usedWords)
    ? (state.usedWords as string[]).map((w) => String(w).toLowerCase()).sort().join("|")
    : "";

  useEffect(() => {
    if (!isDrawer || wordSelected) return;

    const usedWords = Array.isArray(state.usedWords) ? (state.usedWords as string[]) : [];
    // Unique per room + round + drawer so concurrent games never share the same set.
    const seed = `${room.id}:${room.match_number}:${state.round || 1}:${drawerSeat}:${wordDifficulty}:${wordCategory}:${usedWordsKey}`;

    // Already loaded this exact set — do not clear buttons or refetch.
    if (fetchedSeedRef.current === seed && wordChoices.length >= 3) return;

    let ignore = false;
    const controller = new AbortController();

    void (async () => {
      setLoadingWords(true);
      // Only blank the list when switching rounds/categories (not on StrictMode remount of same seed).
      if (fetchedSeedRef.current !== seed) {
        /* keep previous buttons until new payload arrives */
      }
      try {
        const res = await fetch(
          `/api/ai/content?type=skribbl&seed=${encodeURIComponent(seed)}&exclude=${encodeURIComponent(usedWords.join(","))}&difficulty=${encodeURIComponent(wordDifficulty)}&category=${encodeURIComponent(wordCategory)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (ignore) return;
        const next =
          data.words && Array.isArray(data.words) && data.words.length >= 3
            ? data.words.slice(0, 3)
            : fallbackWords(usedWords);
        setWordChoices(next);
        fetchedSeedRef.current = seed;
      } catch (err) {
        if (ignore || (err as Error)?.name === "AbortError") return;
        setWordChoices(fallbackWords(usedWords));
        fetchedSeedRef.current = seed;
      } finally {
        if (!ignore) setLoadingWords(false);
      }
    })();

    return () => {
      ignore = true;
      controller.abort();
    };
    // wordChoices intentionally omitted — we only care about seed identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawer, wordSelected, room.id, room.match_number, state.round, drawerSeat, usedWordsKey, wordDifficulty, wordCategory]);

  // Reset cache when the round advances so a new drawer gets a fresh set.
  useEffect(() => {
    fetchedSeedRef.current = null;
  }, [state.round, room.match_number]);

  useEffect(() => {
    if (!wordSelected || !state.roundStartedAt || room.status !== "playing") return;
    const tick = () => setSecondsLeft(Math.max(0, ROUND_SECONDS - Math.floor((Date.now() - Number(state.roundStartedAt)) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [wordSelected, state.roundStartedAt, room.status]);

  useEffect(() => {
    if (secondsLeft !== 0 || !wordSelected) return;
    // Any client can close the round when the clock hits zero (covers bot-drawer games).
    void act("time_expired");
  }, [secondsLeft, wordSelected, act]);



  const drawStroke = (x0: number, y0: number, x1: number, y1: number, strokeColor: string, strokeSize: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const x0 = Math.max(0, Math.min(w - 1, Math.floor(startX)));
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(startY)));
    const image = ctx.getImageData(0, 0, w, h);
    const data = image.data;
    const idx = (x: number, y: number) => (y * w + x) * 4;
    const target = data.slice(idx(x0, y0), idx(x0, y0) + 4);
    const hex = fillColor.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const nr = parseInt(full.slice(0, 2), 16);
    const ng = parseInt(full.slice(2, 4), 16);
    const nb = parseInt(full.slice(4, 6), 16);
    if (target[0] === nr && target[1] === ng && target[2] === nb) return;

    const match = (x: number, y: number) => {
      const i = idx(x, y);
      return (
        Math.abs(data[i] - target[0]) < 12 &&
        Math.abs(data[i + 1] - target[1]) < 12 &&
        Math.abs(data[i + 2] - target[2]) < 12
      );
    };

    const stack: Array<[number, number]> = [[x0, y0]];
    const visited = new Uint8Array(w * h);
    while (stack.length) {
      const [x, y] = stack.pop()!;
      const key = y * w + x;
      if (visited[key]) continue;
      visited[key] = 1;
      if (!match(x, y)) continue;
      const i = idx(x, y);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
      data[i + 3] = 255;
      if (x > 0) stack.push([x - 1, y]);
      if (x < w - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < h - 1) stack.push([x, y + 1]);
    }
    ctx.putImageData(image, 0, 0);
  };

  // Set up Supabase Realtime Broadcast Channel for Live Canvas Strokes
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !room.code) return;

    const channelName = `room_drawing_${room.code}`;
    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "draw" }, (payload) => {
        const stroke: StrokeData = payload.payload;
        drawStroke(stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.size);
      })
      .on("broadcast", { event: "clear" }, () => {
        clearCanvasLocal();
      })
      .on("broadcast", { event: "fill" }, (payload) => {
        const f = payload.payload as { x: number; y: number; color: string };
        if (f) floodFill(f.x, f.y, f.color);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.code]);

  const handleClear = () => {
    clearCanvasLocal();
    channelRef.current?.send({
      type: "broadcast",
      event: "clear",
    });
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !wordSelected) return;
    const coords = getCanvasCoords(e);
    if (tool === "fill") {
      floodFill(coords.x, coords.y, color);
      channelRef.current?.send({
        type: "broadcast",
        event: "fill",
        payload: { x: coords.x, y: coords.y, color },
      });
      return;
    }
    setDrawing(true);
    prevPos.current = coords;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing || !isDrawer || !wordSelected || !prevPos.current) return;
    const current = getCanvasCoords(e);
    const activeColor = tool === "eraser" ? "#ffffff" : color;
    const activeSize = tool === "eraser" ? brushSize * 2.5 : brushSize;

    drawStroke(prevPos.current.x, prevPos.current.y, current.x, current.y, activeColor, activeSize);

    // Broadcast stroke to room
    channelRef.current?.send({
      type: "broadcast",
      event: "draw",
      payload: {
        x0: prevPos.current.x,
        y0: prevPos.current.y,
        x1: current.x,
        y1: current.y,
        color: activeColor,
        size: activeSize,
      },
    });

    prevPos.current = current;
  };

  const stopDrawing = () => {
    setDrawing(false);
    prevPos.current = null;
  };

  const handleGuessSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || isDrawer || busy || secondsLeft <= 0) return;

    const val = guess.trim();
    setGuess("");

    await act("guess", val);
  };

  // Word selection view for drawer
  // When the Rally bot is the drawer, stream strokes that resemble the chosen word.
  const drawerPlayer = players.find((p) => p.seat === drawerSeat);
  const drawerIsBot = Boolean(
    drawerPlayer &&
      (drawerPlayer.player_id.startsWith("11111111-1111-1111-1111-") ||
        (drawerPlayer.profile?.display_name || "").toLowerCase().includes("rally ai"))
  );

  useEffect(() => {
    if (!wordSelected || !drawerIsBot || !channelRef.current) return;
    const humans = players.filter((p) => !p.player_id.startsWith("11111111-1111-1111-1111-"));
    const driver = humans.find((p) => p.player_id === userId);
    if (!driver) return;
    const lowestHuman = Math.min(...humans.map((p) => p.seat));
    if (driver.seat !== lowestHuman) return;

    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const art = botArtForWord(String(wordSelected));

    void (async () => {
      await sleep(500);
      if (cancelled) return;
      clearCanvasLocal();
      channelRef.current?.send({ type: "broadcast", event: "clear" });
      await sleep(200);
      for (const s of art.strokes) {
        if (cancelled) return;
        drawStroke(s.x0, s.y0, s.x1, s.y1, s.color, s.size);
        channelRef.current?.send({
          type: "broadcast",
          event: "draw",
          payload: { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, color: s.color, size: s.size },
        });
        await sleep(18);
      }
      for (const f of art.fills) {
        if (cancelled) return;
        await sleep(80);
        floodFill(f.x, f.y, f.color);
        channelRef.current?.send({
          type: "broadcast",
          event: "fill",
          payload: { x: f.x, y: f.y, color: f.color },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wordSelected, drawerIsBot, drawerSeat, players, userId, room.match_number, state.round]);


  if (!wordSelected) {
    const lastReveal =
      state.revealedWord && String(state.revealedWord) !== "null"
        ? String(state.revealedWord)
        : null;
    return (
      <div className="mx-auto max-w-lg text-center space-y-3">
        {lastReveal && (
          <div className="rounded-2xl border-2 border-slate-950 bg-amber-100 px-4 py-3 shadow-[3px_3px_0_#171821]">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Previous word</p>
            <p className="text-sm font-black text-slate-900">
              The word was: <span className="text-[#7357ff]">{lastReveal}</span>
            </p>
          </div>
        )}
        {isDrawer ? (
          <div className="rounded-3xl border-4 border-slate-950 bg-amber-50 p-6 shadow-[6px_6px_0_#171821]">
            <Sparkles className="mx-auto text-amber-500" size={36} />
            <h3 className="mt-2 text-xl font-black">Choose a Word to Draw!</h3>
            <p className="mt-1 text-xs text-slate-600">
              AI picks 3 fresh words for this room only. Adjust difficulty or category, then pick one.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="text-left text-[10px] font-black uppercase tracking-wider text-slate-600">
                Difficulty
                <select
                  value={wordDifficulty}
                  onChange={(e) => setWordDifficulty(e.target.value as "easy" | "medium" | "hard")}
                  className="mt-1 w-full rounded-xl border-2 border-slate-950 bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="text-left text-[10px] font-black uppercase tracking-wider text-slate-600">
                Category
                <select
                  value={wordCategory}
                  onChange={(e) => setWordCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-950 bg-white px-3 py-2 text-xs font-bold"
                >
                  {[
                    "random",
                    "animals",
                    "food",
                    "sports",
                    "technology",
                    "places",
                    "vehicles",
                    "objects",
                    "movies",
                    "games",
                    "nature",
                    "professions",
                    "pop_culture",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {wordChoices.length === 0 ? (
                <p className="col-span-full text-sm font-bold text-slate-500">
                  {loadingWords ? "Generating words…" : "Preparing word choices…"}
                </p>
              ) : (
                wordChoices.map((word) => (
                  <button
                    key={word}
                    type="button"
                    disabled={busy || loadingWords}
                    onClick={() => void act("select_word", word)}
                    className="arcade-button bg-amber-300 py-4 text-sm font-black shadow-[3px_3px_0_#171821] hover:bg-amber-400 disabled:opacity-70"
                  >
                    {word}
                  </button>
                ))
              )}
            </div>
            {loadingWords && wordChoices.length > 0 && (
              <p className="mt-2 text-[10px] font-bold text-slate-400">Refreshing options…</p>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border-4 border-slate-950 bg-slate-100 p-8 shadow-[6px_6px_0_#171821]">
            <Paintbrush className="mx-auto animate-bounce text-slate-700" size={40} />
            <h3 className="mt-3 text-lg font-black">Drawer is Picking a Word</h3>
            <p className="mt-1 text-xs text-slate-500">Get your guessing fingers ready...</p>
          </div>
        )}
      </div>
    );
  }


  // Active Drawing & Guessing Canvas View
  const wordHint = isDrawer
    ? wordSelected
    : wordSelected.replace(/[a-zA-Z]/g, "_ ");

  const attemptsLeft = state.tries && me?.seat ? (state.tries[me.seat.toString()] ?? 3) : 3;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-slate-900 px-5 py-3 text-white shadow-[4px_4px_0_#171821]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            {isDrawer ? "YOUR SECRET WORD" : "GUESS THE WORD"}
          </span>
          <h3 className="text-xl font-black tracking-widest uppercase text-white">
            {wordHint}
          </h3>
        </div>
        <div className="text-right">
          <p className={`text-xl font-black ${secondsLeft <= 10 ? "text-red-400" : "text-cyan-300"}`}>⏱ {secondsLeft}s</p>
          <span className="text-[10px] font-bold opacity-60">DRAWER</span>
          <p className="text-xs font-black text-amber-300">
            Player {drawerSeat} {isDrawer ? "(YOU)" : ""}
          </p>
          {!isDrawer && (
            <div className="mt-1 flex items-center justify-end gap-1 text-xs font-black text-amber-400">
              <span>Tries:</span>
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={i < attemptsLeft ? "opacity-100 scale-110" : "opacity-30 grayscale"}>
                  🎨
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas & Controls Area */}
      <div className="relative rounded-3xl border-4 border-slate-950 bg-white p-3 shadow-[6px_6px_0_#171821]">
        <canvas
          ref={canvasRef}
          width={600}
          height={380}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`h-[280px] w-full rounded-2xl border-2 border-slate-200 touch-none bg-white ${
            isDrawer ? "cursor-crosshair" : "cursor-default"
          }`}
        />

        {/* Drawer Tools Bar */}
        {isDrawer && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 p-2.5">
            {/* Color Palette */}
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setTool("brush");
                  }}
                  className={`h-6 w-6 rounded-full border-2 border-slate-950 transition hover:scale-110 ${
                    color === c && tool === "brush" ? "ring-2 ring-amber-500 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Tool Toggles */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTool("brush")}
                className={`rounded-lg border-2 border-slate-950 p-1.5 text-xs font-bold ${
                  tool === "brush" ? "bg-amber-300" : "bg-white"
                }`}
                title="Brush"
              >
                <Paintbrush size={16} />
              </button>
              <button
                type="button"
                onClick={() => setTool("fill")}
                className={`rounded-lg border-2 border-slate-950 p-1.5 text-xs font-bold ${
                  tool === "fill" ? "bg-amber-300" : "bg-white"
                }`}
                title="Fill"
              >
                <PaintBucket size={16} />
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`rounded-lg border-2 border-slate-950 p-1.5 text-xs font-bold ${
                  tool === "eraser" ? "bg-amber-300" : "bg-white"
                }`}
                title="Eraser"
              >
                <Eraser size={16} />
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border-2 border-slate-950 bg-red-100 p-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Guesser Live Chat / Feed */}
      {!isDrawer && (
        <form onSubmit={handleGuessSubmit} className="flex gap-2">
          <input
            disabled={busy || attemptsLeft <= 0 || secondsLeft <= 0}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={
              secondsLeft <= 0
                ? "Time is up — no more guesses"
                : attemptsLeft <= 0
                  ? "No tries remaining for this word"
                  : "Type your guess here..."
            }
            className="flex-1 rounded-2xl border-2 border-slate-950 px-4 py-3 text-sm font-bold outline-none shadow-[3px_3px_0_#171821] disabled:bg-slate-100 disabled:opacity-60"
          />
          <button
            disabled={busy || attemptsLeft <= 0 || secondsLeft <= 0}
            type="submit"
            className="arcade-button bg-amber-400 px-6 text-sm font-black shadow-[3px_3px_0_#171821] disabled:opacity-50"
          >
            <Send size={16} />
            <span>GUESS ({attemptsLeft}/3)</span>
          </button>
        </form>
      )}

      {/* Live guesses — everyone sees wrong guesses; correct answers never reveal the word */}
      {Array.isArray(state.guessFeed) && state.guessFeed.length > 0 && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-2xl border-2 border-slate-950 bg-slate-50 p-3 text-xs font-bold">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Live room guesses</h4>
          {state.guessFeed.slice(-12).map((g: { seat: number; text: string; correct?: boolean }, i: number) => {
            const name = players.find((player) => player.seat === g.seat)?.profile?.display_name || `Player ${g.seat}`;
            return (
              <div
                key={i}
                className={`flex justify-between gap-2 rounded-lg px-2 py-1 ${
                  g.correct ? "bg-emerald-100 text-emerald-800 border border-emerald-400" : "bg-white"
                }`}
              >
                <span className="min-w-0 truncate">
                  {g.correct ? (
                    <>{name} got it!</>
                  ) : (
                    <>{name}: {g.text}</>
                  )}
                </span>
                {g.correct && <span className="shrink-0 font-black">🎯</span>}
              </div>
            );
          })}
        </div>
      )}

      {Boolean(state.revealedWord) && String(state.revealedWord) !== "null" && (
        <div className="rounded-2xl border-2 border-slate-950 bg-amber-100 px-4 py-3 text-center shadow-[3px_3px_0_#171821]">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Word revealed</p>
          <p className="text-sm font-black text-slate-900">
            The word was:{" "}
            <span className="text-[#7357ff]">{String(state.revealedWord)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
