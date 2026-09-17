import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSharedTriviaQuestion } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    const { roomId, round, accessToken } = await request.json();
    if (!roomId || !accessToken) {
      return NextResponse.json({ error: "Missing roomId or access token" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Supabase environment variables missing" }, { status: 500 });
    }

    // The first generated question is persisted by play_trivia_action. Every
    // player then receives that one room-state question through Realtime.
    const question = await generateSharedTriviaQuestion(roomId, Number(round) || 1);
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data, error } = await supabase.rpc("play_trivia_action", {
      p_room: roomId,
      p_action: "load_question",
      p_value: JSON.stringify(question),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, newState: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate trivia question" }, { status: 500 });
  }
}
