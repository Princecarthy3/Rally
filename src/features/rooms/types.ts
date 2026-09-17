import type { GameKey } from "@/features/games/registry";
import type { ShopItem } from "@/lib/customization";

export type RoomStatus = "waiting" | "playing" | "completed" | "cancelled";
export type PublicGameState = {
  turn?: number; round?: number; message?: string; winnerSeat?: number | null; winners?: number[];
  scores?: Record<string, number>; shots?: Record<string, number>; choices?: Record<string, string>;
  guesses?: Array<{ seat:number; value:number; hint:string }>; board?: string[]; positions?: Record<string, number>;
  question?: string; options?: string[]; answers?: Record<string, number>; correctAnswer?: number; revealed?: boolean;
  history?: Array<any>; tries?: Record<string, number>; drawerSeat?: number; targetPicked?: boolean; wordSelected?: string | null;
  ludoPositions?: Record<string, number[]>; lastRoll?: number; awaitingMove?: boolean;
  connectFourBoard?: string[]; roundWins?: Record<string, number>;
  hole?: number; target?: number; holeResults?: Array<Record<string, number>>;
};
export type Room = { id:string; code:string; game_type:GameKey; host_id:string; status:RoomStatus; max_players:number; public_state:PublicGameState; state_version:number; match_number:number; created_at:string; updated_at:string };
export type RoomPlayer = {
  id: string;
  room_id: string;
  player_id: string;
  seat: number;
  is_ready: boolean;
  score: number;
  joined_at: string;
  profile?: { display_name: string; avatar_url: string | null } | null;
  customization?: {
    avatar?: ShopItem | null;
    frame?: ShopItem | null;
    banner?: ShopItem | null;
    title?: ShopItem | null;
    name_color?: ShopItem | null;
    name_effect?: ShopItem | null;
    room_theme?: ShopItem | null;
    victory?: ShopItem | null;
    badges?: ShopItem[];
  } | null;
};
