import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateEmojiDecodePuzzleAI, type EmojiDecodeDifficulty } from "@/lib/ai/gemini";

const difficulties = new Set<EmojiDecodeDifficulty>(["easy", "medium", "hard"]);

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Puzzle generation is temporarily unavailable." }, { status: 503 });
  }
  if (!token) return NextResponse.json({ error: "Sign in to create a puzzle." }, { status: 401 });

  try {
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to create a puzzle." }, { status: 401 });
    const body = await request.json().catch(() => null) as { roomId?: string; round?: number } | null;
    if (!body?.roomId || typeof body.round !== "number" || !Number.isInteger(body.round) || body.round < 1 || body.round > 8) {
      return NextResponse.json({ error: "Invalid puzzle request." }, { status: 400 });
    }
    const { data: room, error: roomError } = await authClient.from("game_rooms").select("id,game_type,status,host_id,public_state").eq("id", body.roomId).maybeSingle();
    if (roomError || !room || room.game_type !== "emoji_decode" || room.status !== "playing") return NextResponse.json({ error: "This game is no longer active." }, { status: 404 });
    if (room.host_id !== user.id) return NextResponse.json({ error: "Only the room host can create the puzzle." }, { status: 403 });
    if (Number(room.public_state?.round) !== body.round || room.public_state?.phase !== "generating_puzzle") {
      return NextResponse.json({ ready: true });
    }

    const difficulty = difficulties.has(room.public_state?.difficulty as EmojiDecodeDifficulty) ? room.public_state.difficulty as EmojiDecodeDifficulty : "medium";
    const { puzzle, source } = await generateEmojiDecodePuzzleAI({ difficulty, category: "Random", nonce: `${room.id}:${body.round}:${crypto.randomUUID()}` });
    const { data, error } = await authClient.rpc("install_emoji_decode_puzzle", {
      p_room: room.id,
      p_round: body.round,
      p_answer: puzzle.answer,
      p_acceptable_answers: puzzle.acceptableAnswers,
      p_emojis: puzzle.emojis,
      p_category: puzzle.category,
      p_difficulty: puzzle.difficulty,
      p_explanation: puzzle.explanation,
    });
    if (error) {
      console.error("Emoji Decode puzzle installation failed:", { code: error.code, message: error.message, details: error.details });
      const message = error.code === "PGRST202" || error.code === "42883"
        ? "Emoji Decode database setup is incomplete. Apply the latest Emoji Decode Supabase migrations."
        : error.code === "42501"
          ? "Supabase denied puzzle installation. Apply the latest Emoji Decode Supabase migration to update host permissions."
          : "Rally generated the puzzle but could not save it. Check the Emoji Decode Supabase migration and try again.";
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ ready: true, source, phase: data?.phase });
  } catch (error) {
    console.error("Emoji Decode puzzle generation failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not create a puzzle. Please try again." }, { status: 503 });
  }
}
