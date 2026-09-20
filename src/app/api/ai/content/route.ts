import { NextResponse } from "next/server";
import {
  generateSkribblWordsAI,
  type SkribblCategory,
  type SkribblDifficulty,
} from "@/lib/ai/gemini";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "skribbl";

  if (type === "skribbl") {
    const seed = searchParams.get("seed") || undefined;
    const excluded = (searchParams.get("exclude") || "")
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);
    const difficulty = (searchParams.get("difficulty") || "medium") as SkribblDifficulty;
    const category = (searchParams.get("category") || "random") as SkribblCategory;

    // Per-room seed ensures Room A / B / C get different sets for the same round.
    const words = await generateSkribblWordsAI(seed, excluded, {
      difficulty:
        difficulty === "easy" || difficulty === "hard" || difficulty === "medium"
          ? difficulty
          : "medium",
      category,
    });

    return NextResponse.json({
      words,
      difficulty,
      category,
    });
  }

  return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
}
