import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSudoku, gridToString, type Difficulty } from "@/features/games/sudoku/engine";

const difficulties = new Set<Difficulty>(["easy", "medium", "hard"]);

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
  if (!token) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { roomId?: string } | null;
    if (!body?.roomId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const { data: room, error: roomError } = await authClient
      .from("game_rooms")
      .select("id,game_type,status,host_id,public_state")
      .eq("id", body.roomId)
      .maybeSingle();

    if (roomError || !room || room.game_type !== "sudoku_battle" || room.status !== "playing") {
      return NextResponse.json({ error: "Room not active" }, { status: 404 });
    }
    if (room.host_id !== user.id) {
      return NextResponse.json({ error: "Only the host can generate the puzzle" }, { status: 403 });
    }
    if (room.public_state?.phase !== "generating" && room.public_state?.puzzle) {
      return NextResponse.json({ ready: true });
    }

    const difficulty = difficulties.has(room.public_state?.difficulty as Difficulty)
      ? (room.public_state.difficulty as Difficulty)
      : "medium";

    const seed =
      Array.from(String(room.id)).reduce((a, c) => a + c.charCodeAt(0), 0) +
      Date.now() +
      Math.floor(Math.random() * 1000);

    const { puzzle, solution } = generateSudoku(difficulty, seed);

    const installClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : authClient;

    const { data, error } = await installClient.rpc("install_sudoku_puzzle", {
      p_room: room.id,
      p_puzzle: gridToString(puzzle),
      p_solution: gridToString(solution),
      p_difficulty: difficulty,
    });

    if (error) {
      console.error("install_sudoku_puzzle", error);
      return NextResponse.json(
        { error: `Could not save puzzle (${error.code || "error"}). Run the Sudoku Battle SQL migration.` },
        { status: 503 }
      );
    }

    return NextResponse.json({ ready: true, phase: data?.phase });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Puzzle generation failed" }, { status: 503 });
  }
}
