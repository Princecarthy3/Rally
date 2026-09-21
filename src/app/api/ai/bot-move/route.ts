import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSkribblWordsAI } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, gameType, publicState, botSeat: rawBotSeat, difficulty: rawDifficulty } = body;
    const botSeat = Number(rawBotSeat);
    const difficulty =
      rawDifficulty === "easy" || rawDifficulty === "hard" ? rawDifficulty : "medium";

    if (!roomId || !gameType || !Number.isFinite(botSeat)) {
      return NextResponse.json({ error: "Missing roomId, gameType, or botSeat" }, { status: 400 });
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

    // easy: high chance of suboptimal picks; hard: almost always optimal among candidates
    const blunderChance = difficulty === "easy" ? 0.55 : difficulty === "hard" ? 0.08 : 0.28;
    const pick = <T,>(best: T, alternatives: T[]): T => {
      if (alternatives.length === 0) return best;
      if (Math.random() < blunderChance) {
        return alternatives[Math.floor(Math.random() * alternatives.length)] ?? best;
      }
      return best;
    };

    if (gameType === "rps") {
      action = "choose";
      const choices = ["rock", "paper", "scissors"];
      value = choices[Math.floor(Math.random() * choices.length)];
    } else if (gameType === "uno") {
      const topCard = state.topCard || { color: "red", value: "7" };
      const activeColor = state.activeColor || (topCard.color !== "wild" ? topCard.color : "red");
      const unoCalled = state.unoCalled || {};

      // Check +4 challenge
      if (state.challenge && Number(state.challenge.challengerSeat) === Number(botSeat)) {
        action = Math.random() > 0.5 ? "challenge_draw4" : "accept_draw4";
      } else if (state.unoVulnerableSeat && Number(state.unoVulnerableSeat) !== Number(botSeat)) {
        action = "catch_uno";
      } else {
        // Fetch bot's private hand
        const { data: botHandData, error: handErr } = await supabase.rpc("get_my_uno_hand", {
          p_room: roomId,
          p_actor_seat: botSeat,
        });
        if (handErr) console.error("UNO bot hand error", handErr);
        const botHand: any[] = Array.isArray(botHandData)
          ? botHandData
          : Array.isArray((botHandData as any)?.hand)
            ? (botHandData as any).hand
            : [];

        if (botHand.length === 1 && !unoCalled[String(botSeat)]) {
          action = "call_uno";
        } else if (state.drawnCardId) {
          const drawnCard = botHand.find((c: any) => c.id === state.drawnCardId);
          if (drawnCard && (drawnCard.color === "wild" || drawnCard.color === activeColor || drawnCard.value === topCard.value)) {
            action = "play_card";
            if (drawnCard.color === "wild") {
              const colorCounts: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
              botHand.forEach((c: any) => { if (colorCounts[c.color] !== undefined) colorCounts[c.color]++; });
              const bestColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0][0];
              value = `${drawnCard.id}:${bestColor}`;
            } else {
              value = drawnCard.id;
            }
          } else {
            action = "pass_turn";
          }
        } else {
          // Play normal matching card or Wild
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
      }
    } else if (gameType === "tic_tac_toe") {
      action = "place";
      const board: string[] = state.board || Array(9).fill("");
      const emptyIndices = board.map((cell, i) => (!cell || cell === "" ? i : -1)).filter((i) => i !== -1);
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
      const matched = (state.matched || []).map((n: unknown) => Number(n));
      const flipped = (state.flipped || []).map((n: unknown) => Number(n));
      const cardCount = Array.isArray(state.cards)
        ? state.cards.length
        : Number(state.pairs || 8) * 2;
      if (Number(state.turn) === Number(botSeat)) {
        if (state.revealed) {
          action = "resolve";
        } else {
          const available = Array.from({ length: cardCount }, (_, index) => index).filter(
            (index) => !matched.includes(index) && !flipped.includes(index)
          );
          if (available.length > 0) {
            action = "flip";
            const preferred = available[0];
            const choice = pick(preferred, available.slice(1));
            value = String(choice);
          }
        }
      }
    } else if (gameType === "mini_golf") {
      const ball = state.balls?.[String(botSeat)];
      const cup = state.cup;
      if (Number(state.turn) === botSeat && ball && cup && !ball.finished) {
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
        if (Number(state.turn) === botSeat && available.length > 0) {
          const shot = available[Math.floor(Math.random() * available.length)];
          action = "fire";
          value = `${shot.row},${shot.col}`;
        }
      }
    } else if (gameType === "number_guess") {
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
      const drawer = Number(state.drawerSeat);
      const selected =
        typeof state.wordSelected === "string" &&
        state.wordSelected.length > 0 &&
        state.wordSelected !== "null"
          ? state.wordSelected
          : null;
      if (drawer === botSeat && !selected) {
        action = "select_word";
        try {
          const aiWords = await generateSkribblWordsAI(
            `${roomId}:${state.round || 1}`,
            state.usedWords || [],
            { difficulty: "medium", category: "random" }
          );
          value = (aiWords && aiWords[0]) || "Robot";
        } catch {
          value = "Robot";
        }
      } else if (drawer === botSeat && selected) {
        // Bot is drawing — no RPC action; client hosts the canvas stream.
        return NextResponse.json({ message: "Bot is drawing" });
      } else if (drawer !== botSeat && selected) {
        const guessed = (state.guessedSeats || []).map((n: unknown) => Number(n));
        if (guessed.includes(botSeat)) {
          return NextResponse.json({ message: "Bot already guessed" });
        }
        action = "guess";
        // Easy bots miss more often
        const missChance = difficulty === "easy" ? 0.55 : difficulty === "hard" ? 0.15 : 0.3;
        if (Math.random() < missChance) {
          const decoys = ["cat", "tree", "car", "house", "fish", "sun", "robot", "pizza", "moon"];
          value = decoys[Math.floor(Math.random() * decoys.length)];
        } else {
          value = selected;
        }
      }
    }

    if (!action) {
      return NextResponse.json({ message: "No action required" });
    }

    const rpc = gameType === "uno" ? "play_uno_action" : gameType === "ludo" ? "play_ludo_action" : gameType === "rps" ? "play_rps_action" : gameType === "number_guess" ? "play_number_hunt_action" : gameType === "memory_match" ? "play_memory_match_action" : gameType === "mini_golf" ? "play_mini_golf_action" : gameType === "battleship" ? "play_battleship_action" : gameType === "skribbl" ? "play_skribbl_action" : "play_room_action";
    const params = { p_room: roomId, p_action: action, p_value: value, p_actor_seat: botSeat };
    const { data, error } = await supabase.rpc(rpc, params);

    if (error) {
      console.error("Bot RPC failed", { rpc, params, message: error.message, details: error });
      return NextResponse.json({ error: error.message, rpc, params }, { status: 400 });
    }

    return NextResponse.json({ success: true, action, value, newState: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to make bot move" }, { status: 500 });
  }
}
