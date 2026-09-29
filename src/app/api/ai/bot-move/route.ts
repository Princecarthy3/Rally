import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Chess, type Move } from "chess.js";
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

    if (gameType === "chess") return await makeChessBotMove(request, roomId, botSeat, difficulty);

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

type ChessBotRecord = {
  room_id: string; match_id: string; white_player_id: string; black_player_id: string; fen: string;
  moves: Array<{ from: string; to: string; promotion?: string; san: string; captured?: string; flags: string }>;
  position_counts: Record<string, number>; status: string; winner_player_id: string | null;
  result_reason: string | null; draw_offered_by: string | null; revision: number;
};

async function makeChessBotMove(request: Request, roomId: string, botSeat: number, difficulty: "easy" | "medium" | "hard") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Chess bot is unavailable. Check the server Supabase configuration." }, { status: 503 });
  if (!token) return NextResponse.json({ error: "Sign in before asking the Rally bot to move." }, { status: 401 });

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  const [{ data: room }, { data: bot }, { data: gameRow }] = await Promise.all([
    admin.from("game_rooms").select("id,host_id,game_type,status").eq("id", roomId).maybeSingle(),
    admin.from("game_players").select("player_id,seat").eq("room_id", roomId).eq("seat", botSeat).maybeSingle(),
    admin.from("chess_games").select("*").eq("room_id", roomId).maybeSingle(),
  ]);
  if (!room || room.game_type !== "chess" || room.status !== "playing") return NextResponse.json({ error: "This Chess game is no longer active." }, { status: 409 });
  if (room.host_id !== authData.user.id) return NextResponse.json({ error: "Only the room host can request the Rally bot's move." }, { status: 403 });
  if (!bot || !String(bot.player_id).startsWith("11111111-1111-1111-1111-")) return NextResponse.json({ error: "The Rally bot is not seated in this room." }, { status: 403 });
  if (!gameRow) return NextResponse.json({ error: "The Chess position has not been initialized." }, { status: 409 });
  const game = gameRow as ChessBotRecord;
  if (game.status !== "active") return NextResponse.json({ message: "The Chess game has ended." });

  let chess: Chess;
  try {
    chess = new Chess();
    for (const move of game.moves || []) chess.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
    if (chess.fen() !== game.fen) throw new Error("Position does not match history");
  } catch {
    return NextResponse.json({ error: "The Rally bot could not restore this Chess position." }, { status: 500 });
  }
  const currentPlayerId = chess.turn() === "w" ? game.white_player_id : game.black_player_id;
  if (currentPlayerId !== bot.player_id) return NextResponse.json({ message: "It is not the Rally bot's turn." });

  if (game.draw_offered_by && game.draw_offered_by !== bot.player_id) {
    const acceptsDraw = evaluateChessPosition(chess, chess.turn()) < -1 || (difficulty === "easy" && Math.random() < 0.4);
    const revision = Number(game.revision) + 1;
    const drawState = {
      matchId: game.match_id, fen: game.fen, moves: game.moves, turn: chess.turn(),
      whitePlayerId: game.white_player_id, blackPlayerId: game.black_player_id,
      status: acceptsDraw ? "draw" : "active", winnerPlayerId: null,
      resultReason: acceptsDraw ? "Draw agreed" : null, drawOfferedBy: null,
      revision, inCheck: chess.inCheck(), lastMove: game.moves.at(-1) ? { from: game.moves.at(-1)!.from, to: game.moves.at(-1)!.to } : null,
      message: acceptsDraw ? "Draw agreed" : `${chess.turn() === "w" ? "White" : "Black"} to move`,
    };
    const { error } = await admin.rpc("commit_chess_state", {
      p_room: roomId, p_match_id: game.match_id, p_expected_revision: game.revision, p_actor: bot.player_id,
      p_fen: game.fen, p_moves: game.moves, p_position_counts: game.position_counts || {},
      p_status: acceptsDraw ? "draw" : "active", p_winner_player_id: null,
      p_result_reason: acceptsDraw ? "Draw agreed" : null, p_draw_offered_by: null,
      p_public_state: { chess: drawState },
    });
    if (error) return NextResponse.json({ error: "The Rally bot could not respond to the draw offer." }, { status: 409 });
    return NextResponse.json({ success: true, action: acceptsDraw ? "accept_draw" : "decline_draw", newState: { chess: drawState } });
  }

  const candidates = chess.moves({ verbose: true });
  if (!candidates.length) return NextResponse.json({ message: "No legal bot move is available." });
  const botColor = chess.turn();
  const move = chooseChessBotMove(chess, candidates, difficulty, botColor);
  const applied = chess.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
  const moves = [...game.moves, { from: applied.from, to: applied.to, san: applied.san, promotion: applied.promotion, captured: applied.captured, flags: applied.flags }];
  const positionCounts = { ...(game.position_counts || {}) };
  const positionKey = chess.hash();
  positionCounts[positionKey] = (positionCounts[positionKey] || 0) + 1;
  const result = chess.isCheckmate()
    ? { status: "checkmate", winner: bot.player_id, reason: "Checkmate" }
    : chess.isStalemate()
      ? { status: "stalemate", winner: null, reason: "Stalemate" }
      : chess.isThreefoldRepetition()
        ? { status: "draw", winner: null, reason: "Draw by threefold repetition" }
        : chess.isDrawByFiftyMoves()
          ? { status: "draw", winner: null, reason: "Draw by the fifty-move rule" }
          : chess.isInsufficientMaterial()
            ? { status: "draw", winner: null, reason: "Draw by insufficient material" }
            : chess.isDraw()
              ? { status: "draw", winner: null, reason: "Draw" }
              : { status: "active", winner: null, reason: null };
  const nextRevision = Number(game.revision) + 1;
  const nextState = {
    matchId: game.match_id, fen: chess.fen(), moves, turn: chess.turn(), whitePlayerId: game.white_player_id,
    blackPlayerId: game.black_player_id, status: result.status, winnerPlayerId: result.winner,
    resultReason: result.reason, drawOfferedBy: null, revision: nextRevision, inCheck: chess.inCheck(),
    lastMove: { from: applied.from, to: applied.to },
    message: result.status === "active" ? chess.inCheck() ? "Check" : `${chess.turn() === "w" ? "White" : "Black"} to move` : result.reason,
  };
  const { error } = await admin.rpc("commit_chess_state", {
    p_room: roomId, p_match_id: game.match_id, p_expected_revision: game.revision, p_actor: bot.player_id,
    p_fen: chess.fen(), p_moves: moves, p_position_counts: positionCounts, p_status: result.status,
    p_winner_player_id: result.winner, p_result_reason: result.reason, p_draw_offered_by: null,
    p_public_state: { chess: nextState },
  });
  if (error) return NextResponse.json({ error: error.message.includes("newer move") ? "The board changed before the bot could move." : "The Rally bot's move could not be saved." }, { status: 409 });
  return NextResponse.json({ success: true, action: "move", newState: { chess: nextState } });
}

function chooseChessBotMove(chess: Chess, candidates: Move[], difficulty: "easy" | "medium" | "hard", botColor: "w" | "b") {
  if (difficulty === "easy") return candidates[Math.floor(Math.random() * candidates.length)];
  const scored = candidates.map((candidate) => {
    const afterBotMove = new Chess(chess.fen());
    afterBotMove.move({ from: candidate.from, to: candidate.to, ...(candidate.promotion ? { promotion: candidate.promotion } : {}) });
    let score = evaluateChessPosition(afterBotMove, botColor);
    if (difficulty === "hard" && !afterBotMove.isGameOver()) {
      const replies = afterBotMove.moves({ verbose: true });
      let worstReply = Infinity;
      for (const reply of replies) {
        const afterReply = new Chess(afterBotMove.fen());
        afterReply.move({ from: reply.from, to: reply.to, ...(reply.promotion ? { promotion: reply.promotion } : {}) });
        worstReply = Math.min(worstReply, evaluateChessPosition(afterReply, botColor));
      }
      score = Number.isFinite(worstReply) ? worstReply : score;
    }
    return { candidate, score };
  }).sort((a, b) => b.score - a.score);
  if (difficulty === "medium" && Math.random() < 0.3) return scored[Math.floor(Math.random() * Math.min(scored.length, 4))].candidate;
  const bestScore = scored[0].score;
  const best = scored.filter((entry) => entry.score === bestScore);
  return best[Math.floor(Math.random() * best.length)].candidate;
}

function evaluateChessPosition(chess: Chess, perspective: "w" | "b") {
  const values = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };
  let score = 0;
  for (const row of chess.board()) for (const piece of row) {
    if (piece) score += values[piece.type] * (piece.color === perspective ? 1 : -1);
  }
  if (chess.isCheckmate()) return chess.turn() === perspective ? -10000 : 10000;
  if (chess.isDraw()) return 0;
  if (chess.isCheck()) score += chess.turn() === perspective ? -0.4 : 0.4;
  return score;
}
