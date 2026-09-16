import { NextResponse } from "next/server";
import { generateSkribblWordsAI } from "@/lib/ai/gemini";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "skribbl";

  if (type === "skribbl") {
    const seed = searchParams.get("seed") || undefined;
    const excluded = (searchParams.get("exclude") || "").split(",").map((word) => word.trim()).filter(Boolean);
    const words = await generateSkribblWordsAI(seed, excluded);
    return NextResponse.json({ words });
  }

  return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
}
