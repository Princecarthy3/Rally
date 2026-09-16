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
    } else if (gameType === "uno") {
      const hands = state.hands || {};
      const botHand: any[] = hands[String(botSeat)] || [];
      const topCard = state.topCard || { color: "red", value: "7" };
      const activeColor = state.activeColor || (topCard.color !== "wild" ? topCard.color : "red");
      const unoCalled = state.unoCalled || {};

      if (botHand.length <= 2 && !unoCalled[botSeat]) {
        action = "call_uno";
      } else {
        const playableCard = botHand.find(
          (c: any) => c.color === "wild" || c.color === activeColor || c.value === topCard.value
        );

        if (playableCard) {
          action = "play_card";
          if (playableCard.color === "wild") {
            const colorCounts: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
            botHand.forEach((c: any) => {
              if (colorCounts[c.color] !== undefined) colorCounts[c.color]++;
            });
            const bestColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0][0];
            value = `${playableCard.id}:${bestColor}`;
          } else {
            value = playableCard.id;
          }
        } else {
          action = "draw_card";
        }
      }
    } else if (gameType === "tic_tac_toe") {

      action = "place";
      const board: string[] = state.board || Array(9).fill("");
      const emptyIndices = board.map((cell, i) => (cell === "" ? i : -1)).filter((i) => i !== -1);
      if (emptyIndices.length > 0) {
        value = String(emptyIndices[Math.floor(Math.random() * emptyIndices.length)]);
      }
    } else if (gameType === "connect_four") {
      action = "drop";
      const board: string[] = state.connectFourBoard || Array(42).fill("");
      const availableColumns = Array.from({ length: 7 }, (_, column) => column).filter(
        (column) => board[column] === ""
      );
      if (availableColumns.length > 0) {
        value = String(availableColumns[Math.floor(Math.random() * availableColumns.length)]);
      }
    } else if (gameType === "number_guess") {
      const pickerSeat = state.pickerSeat || 1;
      const guesserSeat = state.guesserSeat || 2;
      if (pickerSeat === botSeat && !state.targetPicked) {
        action = "set_target";
        value = String(1 + Math.floor(Math.random() * 100));
      } else if (guesserSeat === botSeat && state.targetPicked) {
        action = "guess";
        const lastGuess = state.lastGuess;
        const msg: string = state.message || "";
        if (lastGuess !== null && lastGuess !== undefined) {
          const delta = Math.floor(Math.random() * 8) + 1;
          if (msg.includes("TOO LOW")) {
            value = String(Math.min(100, lastGuess + delta));
          } else if (msg.includes("TOO HIGH")) {
            value = String(Math.max(1, lastGuess - delta));
          } else {
            value = String(Math.min(100, Math.max(1, lastGuess + (Math.random() > 0.5 ? delta : -delta))));
          }
        } else {
          value = String(40 + Math.floor(Math.random() * 20));
        }
      }
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
    } else if (gameType === "ludo") {
      if (state.awaitingMove) {
        action = "move";
        const tokens: number[] = state.ludoPositions?.[String(botSeat)] || [-1, -1, -1, -1];
        const roll = Number(state.lastRoll || 0);
        const movable = tokens.map((position, index) => ({ position, index })).filter(({ position }) =>
          roll === 6 ? position < 57 : position >= 0 && position + roll <= 57
        );
        value = movable.length ? String(movable[Math.floor(Math.random() * movable.length)].index) : "-1";
      } else {
        action = "roll";
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

    const rpc = gameType === "ludo" ? "play_ludo_action" : gameType === "rps" ? "play_bot_rps_move" : "play_room_action";
    // `play_bot_rps_move` intentionally has no p_action argument. Sending the
    // generic payload made PostgREST fail function resolution, so the bot
    // appeared to think forever without ever locking in a hand.
    const params = gameType === "rps"
      ? { p_room: roomId, p_value: value, p_actor_seat: botSeat }
      : { p_room: roomId, p_action: action, p_value: value, p_actor_seat: botSeat };
    const { data, error } = await supabase.rpc(rpc, params);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, action, value, newState: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to make bot move" }, { status: 500 });
  }
}
