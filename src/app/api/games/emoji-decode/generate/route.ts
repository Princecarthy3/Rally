import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateEmojiDecodePuzzleAI, type EmojiDecodeDifficulty } from "@/lib/ai/gemini";

const difficulties = new Set<EmojiDecodeDifficulty>(["easy", "medium", "hard"]);

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Puzzle generation is temporarily unavailable." }, { status: 503 });
  }
  if (!token) return NextResponse.json({ error: "Sign in to create a puzzle." }, { status: 401 });

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in to create a puzzle." }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { roomId?: string; round?: number } | null;
    if (
      !body?.roomId ||
      typeof body.round !== "number" ||
      !Number.isInteger(body.round) ||
      body.round < 1 ||
      body.round > 8
    ) {
      return NextResponse.json({ error: "Invalid puzzle request." }, { status: 400 });
    }

    const { data: room, error: roomError } = await authClient
      .from("game_rooms")
      .select("id,game_type,status,host_id,public_state")
      .eq("id", body.roomId)
      .maybeSingle();

    if (roomError || !room || room.game_type !== "emoji_decode" || room.status !== "playing") {
      return NextResponse.json({ error: "This game is no longer active." }, { status: 404 });
    }
    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only the room host can create the puzzle." }, { status: 403 });
    }
    if (Number(room.public_state?.round) !== body.round || room.public_state?.phase !== "generating_puzzle") {
      return NextResponse.json({ ready: true });
    }

    const difficulty = difficulties.has(room.public_state?.difficulty as EmojiDecodeDifficulty)
      ? (room.public_state.difficulty as EmojiDecodeDifficulty)
      : "medium";

    const installClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : authClient;

    // Answers already used in this room must not repeat across rounds.
    let excludeAnswers: string[] = [];
    const { data: usedList } = await installClient.rpc("get_emoji_decode_used_answers", {
      p_room: room.id,
    });
    if (Array.isArray(usedList)) {
      excludeAnswers = usedList.map((item: unknown) => String(item || "")).filter(Boolean);
    } else if (Array.isArray(room.public_state?.usedAnswers)) {
      excludeAnswers = room.public_state.usedAnswers.map((item: unknown) => String(item || "")).filter(Boolean);
    }

    const { puzzle, source } = await generateEmojiDecodePuzzleAI({
      difficulty,
      category: "Random",
      nonce: `${room.id}:${body.round}:${Date.now()}`,
      excludeAnswers,
    });

    // Extra guard: if somehow still a duplicate, pick another via a shifted nonce
    const usedKeys = new Set(excludeAnswers.map(normalizeAnswer));
    let finalPuzzle = puzzle;
    let finalSource = source;
    if (usedKeys.has(normalizeAnswer(puzzle.answer))) {
      const retry = await generateEmojiDecodePuzzleAI({
        difficulty,
        category: "Random",
        nonce: `${room.id}:${body.round}:retry:${crypto.randomUUID()}`,
        excludeAnswers: [...excludeAnswers, puzzle.answer],
      });
      finalPuzzle = retry.puzzle;
      finalSource = retry.source;
    }

    const emojis = Array.isArray(finalPuzzle.emojis)
      ? finalPuzzle.emojis.map((e) => String(e)).filter(Boolean)
      : [];
    const acceptable = Array.isArray(finalPuzzle.acceptableAnswers)
      ? finalPuzzle.acceptableAnswers.map((a) => String(a)).filter(Boolean)
      : [];
    if (emojis.length < 1) {
      return NextResponse.json({ error: "Generated puzzle was empty. Please try again." }, { status: 503 });
    }

    const { data, error } = await installClient.rpc("install_emoji_decode_puzzle", {
      p_room: room.id,
      p_round: body.round,
      p_answer: String(finalPuzzle.answer || "").trim(),
      p_acceptable_answers: acceptable,
      p_emojis: emojis,
      p_category: String(finalPuzzle.category || "Random"),
      p_difficulty: String(finalPuzzle.difficulty || difficulty),
      p_explanation: String(finalPuzzle.explanation || "Decode the emojis!"),
    });

    if (error) {
      console.error("Emoji Decode puzzle installation failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      const message =
        error.code === "PGRST202" || error.code === "42883"
          ? "Emoji Decode database setup is incomplete. Run the latest Emoji Decode Supabase migrations."
          : error.code === "42P01"
            ? "Emoji Decode answer storage is missing. Apply the Emoji Decode Supabase migrations."
            : error.code === "42501"
              ? "Supabase denied puzzle installation. Re-run the Emoji Decode install migration."
              : `Rally generated the puzzle but could not save it (${error.code || "unknown"}: ${error.message}). Run the latest Emoji Decode SQL migration and try again.`;
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json({ ready: true, source: finalSource, phase: data?.phase });
  } catch (error) {
    console.error("Emoji Decode puzzle generation failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not create a puzzle. Please try again." }, { status: 503 });
  }
}
