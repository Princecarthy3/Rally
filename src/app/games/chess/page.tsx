import type { Metadata } from "next";
import { ChessLanding } from "@/features/games/chess-landing";

export const metadata: Metadata = {
  title: { absolute: "Chess | Rally" },
  description: "Challenge a friend to live multiplayer Chess in a private Rally room.",
  openGraph: { title: "Chess | Rally", description: "Challenge a friend to a battle of strategy. Every move counts.", type: "website" },
};

export default function ChessPage() { return <ChessLanding />; }
