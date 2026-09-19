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
    } else if (gameType === "memory_match") {
      const matched = state.matched || [];
      const flipped = state.flipped || [];
      if (state.turn === botSeat) {
        if (state.revealed) {
          action = "resolve";
        } else {
          const available = Array.from({ length: 16 }, (_, index) => index).filter((index) => !matched.includes(index) && !flipped.includes(index));
          if (available.length > 0) {
            action = "flip";
            value = String(available[Math.floor(Math.random() * available.length)]);
          }
          }
        }
    } else if (gameType === "mini_golf") {
        const ball = state.balls?.[String(botSeat)];
        const cup = state.cup;
        if (state.turn === botSeat && ball && cup && !ball.finished) {
          action = "shoot";
          const angle = Math.atan2(Number(cup.y) - Number(ball.y), Number(cup.x) - Number(ball.x)) * 180 / Math.PI;
          const power = Math.min(100, Math.max(14, Math.hypot(Number(cup.x) - Number(ball.x), Number(cup.y) - Number(ball.y)) / .46));
          value = JSON.stringify({ angle, power });
        }
    } else if (gameType === "battleship") {
      if (state.phase === "placing") {
        if (!state.placements?.[String(botSeat)]) action = "randomize_fleet";
      } else {
        const fired: Array<{ row: number; col: number }> = state.shots?.[String(botSeat)] || [];
        const used = new Set(fired.map((shot) => `${shot.row},${shot.col}`));
        const available = Array.from({ length: 64 }, (_, index) => ({ row: Math.floor(index / 8), col: index % 8 }))
          .filter((shot) => !used.has(`${shot.row},${shot.col}`));
        if (state.turn === botSeat && available.length > 0) {
          const shot = available[Math.floor(Math.random() * available.length)];
          action = "fire";
          value = `${shot.row},${shot.col}`;
        }
      }
    } else if (gameType === "number_guess") {
      // Normalize types and handle string-keyed guess objects safely so the bot can act reliably
      const pickerSeat = Number(state.pickerSeat ?? 1);
      const targetPicked = Boolean(state.targetPicked);
      const guesses = state.guesses || {};
      const hasGuessed = Object.prototype.hasOwnProperty.call(guesses, String(botSeat));
      const isPicker = pickerSeat === Number(botSeat);

      if (isPicker && !targetPicked) {
        action = "set_target";
        value = String(1 + Math.floor(Math.random() * 25));
      } else if (!isPicker && targetPicked && !hasGuessed) {
        action = "guess";
        value = String(1 + Math.floor(Math.random() * 25));
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
        const aiWords = await generateSkribblWordsAI(`${roomId}:${state.round || 1}`, state.usedWords || []);
        value = aiWords[0] || "Pikachu";
      } else if (state.drawerSeat !== botSeat && state.wordSelected) {
        action = "guess";
        value = state.wordSelected;
      }
    }

    if (!action) {
      return NextResponse.json({ message: "No action required" });
    }

    const rpc = gameType === "ludo" ? "play_ludo_action" : gameType === "rps" ? "play_rps_action" : gameType === "number_guess" ? "play_number_hunt_action" : gameType === "memory_match" ? "play_memory_match_action" : gameType === "mini_golf" ? "play_mini_golf_action" : gameType === "battleship" ? "play_battleship_action" : gameType === "skribbl" ? "play_skribbl_action" : "play_room_action";
    const params = { p_room: roomId, p_action: action, p_value: value, p_actor_seat: botSeat };
    const { data, error } = await supabase.rpc(rpc, params);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, action, value, newState: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to make bot move" }, { status: 500 });
  }
}
