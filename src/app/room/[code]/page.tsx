import { GameRoom } from "@/features/rooms/game-room";

export function generateStaticParams() {
  return [{ code: "lobby" }];
}

export default function RoomPage() {
  return <GameRoom />;
}
