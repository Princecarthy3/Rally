import { Suspense } from "react";
import { GameRoom } from "@/features/rooms/game-room";
import { LoaderCircle } from "lucide-react";

export function generateStaticParams() {
  return [{ code: "lobby" }];
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center">
          <div className="text-center">
            <LoaderCircle className="mx-auto animate-spin text-[#7357ff]" />
            <p className="mt-3 text-sm font-black">Entering game room...</p>
          </div>
        </div>
      }
    >
      <GameRoom />
    </Suspense>
  );
}
