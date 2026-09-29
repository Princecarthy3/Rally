import "server-only";

import { Chess, type Move } from "chess.js";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type StoredMove = { from: string; to: string; san: string; promotion?: string; captured?: string; flags: string };
type ChessRecord = {
  room_id: string; match_id: string; white_player_id: string; black_player_id: string; fen: string;
  moves: StoredMove[]; position_counts: Record<string, number>; status: string; winner_player_id: string | null;
  result_reason: string | null; draw_offered_by: string | null; revision: number;
};
const promotions = new Set(["q", "r", "b", "n"]);
const squarePattern = /^[a-h][1-8]$/;

function clients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return null;
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { auth, admin, token };
}

async function loadAuthorizedGame(request: Request, roomId: string) {
  const c = clients(request);
  if (!c) return { response: NextResponse.json({ error: "Chess is temporarily unavailable. Check the server Supabase configuration." }, { status: 503 }) };
  const { data: authData, error: authError } = await c.auth.auth.getUser(c.token);
  if (authError || !authData.user) return { response: NextResponse.json({ error: "Sign in to play Chess." }, { status: 401 }) };
  const [{ data: room, error: roomError }, { data: player }, { data: spectator }, { data: record, error: gameError }] = await Promise.all([
    c.admin.from("game_rooms").select("id,game_type,status,allow_spectators").eq("id", roomId).maybeSingle(),
    c.admin.from("game_players").select("player_id,seat").eq("room_id", roomId).eq("player_id", authData.user.id).maybeSingle(),
    c.admin.from("game_spectators").select("spectator_id").eq("room_id", roomId).eq("spectator_id", authData.user.id).maybeSingle(),
    c.admin.from("chess_games").select("*").eq("room_id", roomId).maybeSingle(),
  ]);
  if (roomError || !room || room.game_type !== "chess") return { response: NextResponse.json({ error: "Chess room not found." }, { status: 404 }) };
  if (!player && spectator && !room.allow_spectators) return { response: NextResponse.json({ error: "Spectating is disabled for this room." }, { status: 403 }) };
  if (!player && !spectator) return { response: NextResponse.json({ error: "Only room players and authorized spectators can view this Chess board." }, { status: 403 }) };
  if (gameError || !record) return { response: NextResponse.json({ error: "Chess has not started in this room yet." }, { status: 409 }) };
  return { client: c, userId: authData.user.id, room, record: record as ChessRecord, player, spectator: !player };
}

function replay(record: ChessRecord) {
  const chess = new Chess();
  for (const move of record.moves || []) chess.move({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) });
  if (chess.fen() !== record.fen) throw new Error("Stored Chess history does not match its position.");
  return chess;
}

function publicState(record: ChessRecord, chess: Chess) {
  const last = record.moves.at(-1);
  return {
    matchId: record.match_id, fen: record.fen, moves: record.moves, turn: chess.turn(),
    whitePlayerId: record.white_player_id, blackPlayerId: record.black_player_id, status: record.status,
    winnerPlayerId: record.winner_player_id, resultReason: record.result_reason,
    drawOfferedBy: record.draw_offered_by, revision: record.revision, inCheck: chess.inCheck(),
    lastMove: last ? { from: last.from, to: last.to } : null,
    message: record.status === "active" ? (chess.inCheck() ? "Check" : `${chess.turn() === "w" ? "White" : "Black"} to move`) : record.result_reason,
  };
}

function resultFor(chess: Chess, actor: string) {
  if (chess.isCheckmate()) return { status: "checkmate", winner: actor, reason: "Checkmate" };
  if (chess.isStalemate()) return { status: "stalemate", winner: null, reason: "Stalemate" };
  if (chess.isThreefoldRepetition()) return { status: "draw", winner: null, reason: "Draw by threefold repetition" };
  if (chess.isDrawByFiftyMoves()) return { status: "draw", winner: null, reason: "Draw by the fifty-move rule" };
  if (chess.isInsufficientMaterial()) return { status: "draw", winner: null, reason: "Draw by insufficient material" };
  if (chess.isDraw()) return { status: "draw", winner: null, reason: "Draw" };
  return { status: "active", winner: null, reason: null };
}

export async function GET(request: Request) {
  const roomId = new URL(request.url).searchParams.get("roomId") || "";
  if (!roomId) return NextResponse.json({ error: "Room id is required." }, { status: 400 });
  const loaded = await loadAuthorizedGame(request, roomId);
  if ("response" in loaded) return loaded.response;
  try {
    return NextResponse.json({ game: publicState(loaded.record, replay(loaded.record)) });
  } catch {
    return NextResponse.json({ error: "Chess state could not be restored. Please reload the room." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    roomId?: string; matchId?: string; expectedRevision?: number; action?: string;
    from?: string; to?: string; promotion?: string;
  } | null;
  if (!body?.roomId || !body.matchId || !Number.isInteger(body.expectedRevision) || !body.action) {
    return NextResponse.json({ error: "Invalid Chess action." }, { status: 400 });
  }
  const loaded = await loadAuthorizedGame(request, body.roomId);
  if ("response" in loaded) return loaded.response;
  const admin = loaded.client.admin;
  if (loaded.spectator) return NextResponse.json({ error: "Spectators cannot change the Chess game." }, { status: 403 });
  const record = loaded.record;
  if (record.match_id !== body.matchId || Number(record.revision) !== body.expectedRevision) {
    return NextResponse.json({ error: "The board changed. The latest position has been loaded." }, { status: 409 });
  }
  if (record.status !== "active") return NextResponse.json({ error: "This Chess game is already over." }, { status: 409 });
  if (loaded.room.status !== "playing") return NextResponse.json({ error: "This Chess room is no longer active." }, { status: 409 });

  let chess: Chess;
  try { chess = replay(record); } catch {
    return NextResponse.json({ error: "Chess state could not be restored. Please reload the room." }, { status: 500 });
  }
  const actor = loaded.userId;
  let nextMoves = [...record.moves];
  let nextStatus = record.status;
  let winner = record.winner_player_id;
  let reason = record.result_reason;
  let drawOfferedBy = record.draw_offered_by;

  if (body.action === "move") {
    const expectedPlayer = chess.turn() === "w" ? record.white_player_id : record.black_player_id;
    if (actor !== expectedPlayer) return NextResponse.json({ error: "It is not your turn." }, { status: 403 });
    if (!body.from || !body.to || !squarePattern.test(body.from) || !squarePattern.test(body.to)) return NextResponse.json({ error: "Select a valid move." }, { status: 400 });
    if (body.promotion && !promotions.has(body.promotion)) return NextResponse.json({ error: "Choose a valid promotion piece." }, { status: 400 });
    try {
      const move = chess.move({ from: body.from, to: body.to, ...(body.promotion ? { promotion: body.promotion } : {}) });
      nextMoves = [...nextMoves, { from: move.from, to: move.to, san: move.san, promotion: move.promotion, captured: move.captured, flags: move.flags }];
      const result = resultFor(chess, actor);
      nextStatus = result.status;
      winner = result.winner;
      reason = result.reason;
    } catch {
      return NextResponse.json({ error: "That move is not legal." }, { status: 400 });
    }
  } else if (body.action === "offer_draw") {
    if (drawOfferedBy) return NextResponse.json({ error: "A draw offer is already waiting for a response." }, { status: 409 });
    drawOfferedBy = actor;
  } else if (body.action === "decline_draw") {
    if (!drawOfferedBy || drawOfferedBy === actor) return NextResponse.json({ error: "There is no draw offer from your opponent." }, { status: 409 });
    drawOfferedBy = null;
  } else if (body.action === "accept_draw") {
    if (!drawOfferedBy || drawOfferedBy === actor) return NextResponse.json({ error: "There is no draw offer from your opponent." }, { status: 409 });
    drawOfferedBy = null;
    nextStatus = "draw";
    winner = null;
    reason = "Draw agreed";
  } else if (body.action === "resign") {
    winner = actor === record.white_player_id ? record.black_player_id : record.white_player_id;
    nextStatus = "resigned";
    reason = "Opponent resigned";
    drawOfferedBy = null;
  } else {
    return NextResponse.json({ error: "Unknown Chess action." }, { status: 400 });
  }

  const positionCounts = { ...(record.position_counts || {}) };
  if (body.action === "move") {
    const key = chess.hash();
    positionCounts[key] = (positionCounts[key] || 0) + 1;
  }
  const nextRecord: ChessRecord = {
    ...record, fen: chess.fen(), moves: nextMoves, position_counts: positionCounts,
    status: nextStatus, winner_player_id: winner, result_reason: reason, draw_offered_by: drawOfferedBy,
    revision: Number(record.revision) + 1,
  };
  const state = publicState(nextRecord, chess);
  const { error } = await admin.rpc("commit_chess_state", {
    p_room: body.roomId, p_match_id: body.matchId, p_expected_revision: body.expectedRevision,
    p_actor: actor, p_fen: nextRecord.fen, p_moves: nextRecord.moves, p_position_counts: nextRecord.position_counts,
    p_status: nextStatus, p_winner_player_id: winner, p_result_reason: reason,
    p_draw_offered_by: drawOfferedBy, p_public_state: { chess: state },
  });
  if (error) return NextResponse.json({ error: error.message.includes("newer move") ? "The board changed. The latest position has been loaded." : "Chess could not save that action. Please try again." }, { status: 409 });
  return NextResponse.json({ game: state });
}
