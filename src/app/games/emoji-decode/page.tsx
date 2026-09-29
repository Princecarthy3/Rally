import type { Metadata } from "next";
import { EmojiDecodeLanding } from "@/features/games/emoji-decode-landing";

export const metadata: Metadata = {
  title: { absolute: "Emoji Decode | Rally" },
  description: "Decode AI-generated emoji puzzles and race your friends in Rally's multiplayer Emoji Decode game.",
  openGraph: {
    title: "Emoji Decode | Rally",
    description: "Decode the emojis. Beat your friends.",
    type: "website",
  },
};

export default function EmojiDecodePage() {
  return <EmojiDecodeLanding />;
}
