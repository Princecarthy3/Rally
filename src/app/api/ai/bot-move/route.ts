import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSkribblWordsAI } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, gameType, publicState, botSeat } = body;

    if (!roomId || !gameType) {
      return NextResponse.json({ error: "Missing roomId or gameType" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase environment variables missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const state = publicState || {};
    let action = "";
    let value: string | null = null;

    if (gameType === "rps") {
      action = "choose";
      const choices = ["rock", "paper", "scissors"];
      value = choices[Math.floor(Math.random() * choices.length)];
    } else if (gameType === "dice_dash") {
      if (state.lastRoll) {
        action = "move_token";
        value = String(Math.floor(Math.random() * 4));
      } else {
        action = "roll";
      }
    } else if (gameType === "tic_tac_toe") {

      action = "place";
      const board: string[] = state.board || Array(9).fill("");
      const emptyIndices = board.map((cell, i) => (cell === "" ? i : -1)).filter((i) => i !== -1);
      if (emptyIndices.length > 0) {
        value = String(emptyIndices[Math.floor(Math.random() * emptyIndices.length)]);
      }
    } else if (gameType === "number_guess") {
      action = "guess";
      value = String(1 + Math.floor(Math.random() * 100));
    } else if (gameType === "quick_quiz" || gameType === "emoji_decode") {
      action = "answer";
      value = gameType === "emoji_decode" ? (Math.random() < 0.8 ? "correct" : "wrong") : String(Math.floor(Math.random() * 4));
    } else if (gameType === "dots_boxes") {
      action = "line";
      const gridSize = state.gridSize || 3;
      const hLines = state.hLines || {};
      const vLines = state.vLines || {};

      const availableLines: string[] = [];

      for (let r = 0; r <= gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!hLines[`${r}_${c}`]) availableLines.push(`h_${r}_${c}`);
        }
      }
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c <= gridSize; c++) {
          if (!vLines[`${r}_${c}`]) availableLines.push(`v_${r}_${c}`);
        }
      }

      if (availableLines.length > 0) {
        value = availableLines[Math.floor(Math.random() * availableLines.length)];
      }
    } else if (gameType === "skribbl") {
      if (state.drawerSeat === botSeat && !state.wordSelected) {
        action = "select_word";
        const aiWords = await generateSkribblWordsAI();
        value = aiWords[0] || "Pikachu";
      } else if (state.drawerSeat !== botSeat && state.wordSelected) {
        action = "guess";
        value = state.wordSelected;
      }
    }

    if (!action) {
      return NextResponse.json({ message: "No action required" });
    }

    const { data, error } = await supabase.rpc("play_room_action", {
      p_room: roomId,
      p_action: action,
      p_value: value,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, action, value, newState: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to make bot move" }, { status: 500 });
  }
}

