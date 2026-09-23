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

    if (gameType === "racing") {
      const results = Array.isArray(state.results) ? state.results : [];
      const stage = String(state.stage || state.phase || "");
      if (
        (stage === "racing" || stage === "playing") &&
        !results.some((result: any) => Number(result?.seat) === botSeat)
      ) {
        // Times are for a full 3-lap stage so humans can beat the bot fairly.
        const laps = Math.max(1, Number(state.lapCount || 3));
        const perLap =
          difficulty === "easy" ? 58 + botSeat * 2 : difficulty === "hard" ? 42 + botSeat * 1.2 : 50 + botSeat * 1.6;
        const variance = (difficulty === "easy" ? 12 : difficulty === "hard" ? 4 : 8) * laps;
        let botTime = perLap * laps + Math.random() * variance;
        // If a human already finished, never invent a faster time than them.
        const humanTimes = results
          .filter((result: any) => Number(result?.seat) !== botSeat)
          .map((result: any) => Number(result?.time))
          .filter((time: number) => Number.isFinite(time) && time > 0);
        if (humanTimes.length > 0) {
          const bestHuman = Math.min(...humanTimes);
          botTime = Math.max(botTime, bestHuman + 4 + Math.random() * 10);
        }
        const startTime = Number(state.start_time || 0);
        const elapsed = startTime > 0 ? Date.now() / 1000 - startTime : 0;
        if (startTime > 0 && elapsed >= botTime * 0.95) {
          action = "finish";
          value = String(Number(botTime.toFixed(2)));
        }
      }
    } else if (gameType === "rps") {
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
      const cup = state.cup || { x: 86, y: 22 };
      if (Number(state.turn) === botSeat && ball && !ball.finished) {
        action = "shoot";
        const dx = Number(cup.x) - Number(ball.x);
        const dy = Number(cup.y) - Number(ball.y);
        // radians — server accepts both
        let angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);
        // Scale power so the ball roughly reaches the cup (server uses *0.42)
        let power = Math.min(100, Math.max(18, dist / 0.42));
        // Difficulty: easy misses aim, hard is accurate
        const jitter =
          difficulty === "easy" ? 0.45 : difficulty === "hard" ? 0.06 : 0.2;
        angle += (Math.random() - 0.5) * jitter;
        power *= 0.85 + Math.random() * 0.3;
        power = Math.min(100, Math.max(14, power));
        value = JSON.stringify({ angle, power });
      }
    } else if (gameType === "basketball") {
      if (Number(state.turn) === botSeat) {
        action = "shoot";
        // skill by difficulty
        const makeChance = difficulty === "easy" ? 0.35 : difficulty === "hard" ? 0.7 : 0.5;
        value = Math.random() < makeChance ? "make" : "miss";
      }
    } else if (gameType === "battleship") {
      if ((state.phase || "placing") === "placing") {
        if (!state.placements?.[String(botSeat)]) {
          action = "auto_deploy"; // randomize + lock in one RPC
        }
      } else if ((state.phase || "") === "playing" && Number(state.turn) === botSeat) {
        const fired: Array<{ row: number; col: number }> = state.shots?.[String(botSeat)] || [];
        const used = new Set(fired.map((shot) => `${shot.row},${shot.col}`));
        // Prefer hunting adjacent to hits
        const hits = fired.filter((s) => (s as { hit?: boolean }).hit);
        let candidates = Array.from({ length: 64 }, (_, index) => ({
          row: Math.floor(index / 8),
          col: index % 8,
        })).filter((shot) => !used.has(`${shot.row},${shot.col}`));
        if (hits.length > 0 && difficulty !== "easy") {
          const adj: typeof candidates = [];
          for (const h of hits) {
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]] as const) {
              const nr = h.row + dr, nc = h.col + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !used.has(`${nr},${nc}`)) {
                adj.push({ row: nr, col: nc });
              }
            }
          }
          if (adj.length) candidates = adj;
        }
        if (candidates.length > 0) {
          const shot = candidates[Math.floor(Math.random() * candidates.length)];
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

    const rpc = gameType === "racing" ? "play_racing_action" : gameType === "tic_tac_toe" || gameType === "connect_four" || gameType === "dots_boxes" ? "play_room_action" : gameType === "uno" ? "play_uno_action" : gameType === "ludo" ? "play_ludo_action" : gameType === "rps" ? "play_rps_action" : gameType === "number_guess" ? "play_number_hunt_action" : gameType === "memory_match" ? "play_memory_match_action" : gameType === "mini_golf" ? "play_mini_golf_action" : gameType === "battleship" ? "play_battleship_action" : gameType === "skribbl" ? "play_skribbl_action" : gameType === "basketball" ? "play_basketball_action" : "play_room_action";
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
