"use client";

import { Eraser, Paintbrush, RotateCcw, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sounds } from "@/lib/audio";

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
  "#000000", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#a855f7",
  "#ec4899", "#78350f", "#64748b", "#ffffff"
];

interface StrokeData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
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
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [guess, setGuess] = useState("");
  const [guessFeed, setGuessFeed] = useState<{ sender: string; text: string; correct?: boolean }[]>([]);

  const prevPos = useRef<{ x: number; y: number } | null>(null);
  const channelRef = useRef<any>(null);

  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [loadingAiWords, setLoadingAiWords] = useState(false);

  useEffect(() => {
    let ignore = false;
    if (isDrawer && !wordSelected) {
      fetch("/api/ai/content?type=skribbl")
        .then((res) => res.json())
        .then((data) => {
          if (ignore) return;
          if (data.words && Array.isArray(data.words) && data.words.length === 3) {
            setWordChoices(data.words);
          } else {
            const pool = [...WORD_BANK];
            const choices: string[] = [];
            for (let i = 0; i < 3; i++) {
              const idx = Math.floor(Math.random() * pool.length);
              choices.push(pool.splice(idx, 1)[0]);
            }
            setWordChoices(choices);
          }
        })
        .catch(() => {
          if (ignore) return;
          const pool = [...WORD_BANK];
          const choices: string[] = [];
          for (let i = 0; i < 3; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            choices.push(pool.splice(idx, 1)[0]);
          }
          setWordChoices(choices);
        });
    }
    return () => {
      ignore = true;
    };
  }, [isDrawer, wordSelected]);



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
    setDrawing(true);
    const coords = getCanvasCoords(e);
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
    if (!guess.trim() || isDrawer || busy) return;

    const val = guess.trim();
    setGuess("");

    const isCorrect = Boolean(wordSelected && val.toLowerCase() === wordSelected.toLowerCase());
    const senderName = me?.profile?.display_name || `Player ${me?.seat}`;

    setGuessFeed((prev) => [...prev, { sender: senderName, text: val, correct: isCorrect }]);

    if (isCorrect) {
      sounds.playWinSound();
    }

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
            <p className="mt-1 text-xs text-slate-600">Pick one of these 3 dynamic words to draw for your opponents:</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {wordChoices.map((word) => (
                <button
                  key={word}
                  disabled={busy}
                  onClick={() => act("select_word", word)}
                  className="arcade-button bg-amber-300 py-4 text-sm font-black shadow-[3px_3px_0_#171821] hover:bg-amber-400"
                >
                  {word}
                </button>
              ))}
            </div>
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
              >
                <Paintbrush size={16} />
              </button>
              <button
                type="button"
                onClick={() => setTool("eraser")}
                className={`rounded-lg border-2 border-slate-950 p-1.5 text-xs font-bold ${
                  tool === "eraser" ? "bg-amber-300" : "bg-white"
                }`}
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
            disabled={busy || attemptsLeft <= 0}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={attemptsLeft <= 0 ? "No tries remaining for this word" : "Type your guess here..."}
            className="flex-1 rounded-2xl border-2 border-slate-950 px-4 py-3 text-sm font-bold outline-none shadow-[3px_3px_0_#171821] disabled:bg-slate-100 disabled:opacity-60"
          />
          <button
            disabled={busy || attemptsLeft <= 0}
            type="submit"
            className="arcade-button bg-amber-400 px-6 text-sm font-black shadow-[3px_3px_0_#171821] disabled:opacity-50"
          >
            <Send size={16} />
            <span>GUESS ({attemptsLeft}/3)</span>
          </button>
        </form>
      )}

      {/* Recent Guesses */}
      {guessFeed.length > 0 && (
        <div className="max-h-28 overflow-y-auto space-y-1.5 rounded-2xl border-2 border-slate-950 bg-slate-50 p-3 text-xs font-bold">
          {guessFeed.slice(-4).map((g, i) => (
            <div
              key={i}
              className={`flex justify-between rounded-lg px-2 py-1 ${
                g.correct ? "bg-emerald-100 text-emerald-800 border border-emerald-400" : "bg-white"
              }`}
            >
              <span>{g.sender}: {g.text}</span>
              {g.correct && <span className="font-black">🎯 CORRECT!</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
