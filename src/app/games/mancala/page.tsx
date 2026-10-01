import type { Metadata } from "next";
import { MancalaLanding } from "@/features/games/mancala-landing";

export const metadata: Metadata = {
  title: { absolute: "Mancala Online Multiplayer Game | Rally" },
  description: "Play Mancala online with friends on Rally. Sow stones, capture pieces, and outsmart your opponent in a fast multiplayer board game.",
  openGraph: {
    title: "Mancala Online Multiplayer Game | Rally",
    description: "Classic stones. Smart moves. One winner.",
    type: "website",
  },
};

export default function MancalaPage() {
  return <MancalaLanding />;
}
