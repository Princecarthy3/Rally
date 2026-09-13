import { NextResponse } from "next/server";
import {
  generateEmojiPuzzleAI,
  generateSkribblWordsAI,
  generateTriviaQuestionAI,
} from "@/lib/ai/gemini";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "skribbl";

  if (type === "skribbl") {
    const words = await generateSkribblWordsAI();
    return NextResponse.json({ words });
  }

  if (type === "trivia") {
    const trivia = await generateTriviaQuestionAI();
    return NextResponse.json({ trivia });
  }

  if (type === "emoji") {
    const emoji = await generateEmojiPuzzleAI();
    return NextResponse.json({ emoji });
  }

  return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
}
