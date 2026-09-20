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
  if (!wordSelected) {
    return (
      <div className="mx-auto max-w-lg text-center">
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


  // When the Rally bot is the drawer, the human host streams simple strokes for everyone.
  const drawerPlayer = players.find((p) => p.seat === drawerSeat);
  const drawerIsBot = Boolean(
    drawerPlayer &&
      (drawerPlayer.player_id === "11111111-1111-1111-1111-111111111111" ||
        (drawerPlayer.profile?.display_name || "").toLowerCase().includes("rally ai") ||
        (drawerPlayer.profile?.display_name || "").toLowerCase().includes("bot"))
  );

  useEffect(() => {
    if (!wordSelected || !drawerIsBot || !channelRef.current) return;
    // Only one client drives bot art — prefer seat 1 human, else any non-bot.
    const humans = players.filter(
      (p) => p.player_id !== "11111111-1111-1111-1111-111111111111"
    );
    const driver = humans.find((p) => p.player_id === userId);
    if (!driver) return;
    // Lowest human seat drives to avoid duplicate streams
    const lowestHuman = Math.min(...humans.map((p) => p.seat));
    if (driver.seat !== lowestHuman) return;

    let cancelled = false;
    const word = String(wordSelected);
    const palette = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];
    const pickColor = () => palette[Math.floor(Math.random() * palette.length)];

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const broadcastStroke = (x0: number, y0: number, x1: number, y1: number, c: string, size: number) => {
      drawStroke(x0, y0, x1, y1, c, size);
      channelRef.current?.send({
        type: "broadcast",
        event: "draw",
        payload: { x0, y0, x1, y1, color: c, size },
      });
    };

    void (async () => {
      await sleep(600);
      if (cancelled) return;
      // Simple "sketch" based on word length — abstract but looks intentional
      const cx = 300;
      const cy = 190;
      const color = pickColor();
      // Outline circle / box
      const steps = 24;
      let prevX = cx + 80;
      let prevY = cy;
      for (let i = 1; i <= steps; i++) {
        if (cancelled) return;
        const a = (i / steps) * Math.PI * 2;
        const x = cx + Math.cos(a) * (70 + (word.length % 5) * 4);
        const y = cy + Math.sin(a) * (55 + (word.length % 3) * 6);
        broadcastStroke(prevX, prevY, x, y, color, 5);
        prevX = x;
        prevY = y;
        await sleep(40);
      }
      // Accent lines
      for (let k = 0; k < 3 + (word.length % 4); k++) {
        if (cancelled) return;
        const x0 = 80 + Math.random() * 440;
        const y0 = 60 + Math.random() * 260;
        const x1 = x0 + (Math.random() - 0.5) * 120;
        const y1 = y0 + (Math.random() - 0.5) * 120;
        broadcastStroke(x0, y0, x1, y1, pickColor(), 3 + Math.random() * 4);
        await sleep(80);
      }
      // Optional fill splash
      if (!cancelled && Math.random() > 0.4) {
        const fx = cx + (Math.random() - 0.5) * 40;
        const fy = cy + (Math.random() - 0.5) * 40;
        const fc = pickColor();
        floodFill(fx, fy, fc);
        channelRef.current?.send({
          type: "broadcast",
          event: "fill",
          payload: { x: fx, y: fy, color: fc },
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wordSelected, drawerIsBot, drawerSeat, players, userId, room.match_number, state.round]);

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

      {secondsLeft <= 0 && wordSelected && (
        <p className="text-center text-xs font-black text-red-600">Time is up — guessing is locked for this round.</p>
      )}
    </div>
  );
}
