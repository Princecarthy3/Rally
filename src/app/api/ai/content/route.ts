import { NextResponse } from "next/server";
import { generateSkribblWordsAI } from "@/lib/ai/gemini";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "skribbl";

  if (type === "skribbl") {
    const words = await generateSkribblWordsAI();
    return NextResponse.json({ words });
  }

  return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
}
