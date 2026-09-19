"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Room, RoomPlayer } from "./types";
import type { ShopItem } from "@/lib/customization";

export function useRoom(code: string, userId?: string, isSpectatorRequested: boolean = false) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [connection, setConnection] = useState<"connecting" | "online" | "reconnecting">("connecting");
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isSpectator, setIsSpectator] = useState(isSpectatorRequested);
  const [spectatorCount, setSpectatorCount] = useState(0);

  const supabase = getSupabaseBrowserClient();

  const refresh = useCallback(async () => {
    if (!supabase || !userId) return;

    if (isSpectatorRequested) {
      const specRes = await supabase.rpc("spectate_game_room", { p_code: code.toUpperCase() });
      if (specRes.error) {
        setError(specRes.error.message);
        setLoading(false);
        return;
      }
      setIsSpectator(true);
    } else {
      const join = await supabase.rpc("join_game_room", { p_code: code.toUpperCase() });
      if (join.error && (join.error.message.includes("already started") || join.error.message.includes("full"))) {
        // Fallback to spectator mode if room is full or playing
        const specRes = await supabase.rpc("spectate_game_room", { p_code: code.toUpperCase() });
        if (!specRes.error) {
          setIsSpectator(true);
        } else {
          setError(join.error.message);
          setLoading(false);
          return;
        }
      } else if (join.error) {
        setError(join.error.message);
        setLoading(false);
        return;
      }
    }

    const { data: roomData, error: roomError } = await supabase
      .from("game_rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (roomError || !roomData) {
      setError(roomError?.message || "Room not found");
      setLoading(false);
      return;
    }

    setRoom(roomData as Room);

    // Fetch players
    const { data: playerData } = await supabase
      .from("game_players")
      .select("*, profile:profiles(display_name, avatar_url)")
      .eq("room_id", roomData.id)
      .order("seat");

    // Fetch spectators count
    const { count: specCount } = await supabase
      .from("game_spectators")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomData.id);

    setSpectatorCount(specCount || 0);

    if (playerData) {
      const pIds = playerData.map((p) => p.player_id);
      const { data: custData } = await supabase
        .from("user_customization")
        .select(`
          user_id, badge_ids,
          avatar:avatar_id(*), frame:frame_id(*), banner:banner_id(*),
          title:title_id(*), name_color:name_color_id(*), name_effect:name_effect_id(*),
          room_theme:room_theme_id(*), victory:victory_id(*)
        `)
        .in("user_id", pIds);

      const custMap = new Map();
      if (custData) {
        custData.forEach((c) => custMap.set(c.user_id, c));
      }

      const mergedPlayers: RoomPlayer[] = await Promise.all(
        playerData.map(async (p) => {
          const c = custMap.get(p.player_id);
          let badges: ShopItem[] = [];
          if (c && c.badge_ids && c.badge_ids.length > 0) {
            const { data: bData } = await supabase.from("shop_items").select("*").in("id", c.badge_ids);
            badges = (bData || []) as ShopItem[];
          }
          return {
            ...p,
            customization: c
              ? {
                  avatar: c.avatar as unknown as ShopItem,
                  frame: c.frame as unknown as ShopItem,
                  banner: c.banner as unknown as ShopItem,
                  title: c.title as unknown as ShopItem,
                  name_color: c.name_color as unknown as ShopItem,
                  name_effect: c.name_effect as unknown as ShopItem,
                  room_theme: c.room_theme as unknown as ShopItem,
                  victory: c.victory as unknown as ShopItem,
                  badges,
                }
              : null,
          } as RoomPlayer;
        })
      );

      setPlayers(mergedPlayers);
    }

    setError("");
    setLoading(false);
  }, [code, isSpectatorRequested, supabase, userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    queueMicrotask(() => refresh());
  }, [refresh, supabase, userId]);

  useEffect(() => {
    if (!supabase || !room || !userId) return;
    const roomId = room.id;
    const ch = supabase.channel(`room:${roomId}`, { config: { presence: { key: userId } } });

    ch.on("postgres_changes", { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` }, (payload) => {
      if (payload.eventType !== "DELETE") setRoom(payload.new as Room);
    })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `room_id=eq.${roomId}` }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_spectators", filter: `room_id=eq.${roomId}` }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_customization" }, () => {
        void refresh();
      })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState();
        setOnlineIds(Object.keys(state));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setChannel(ch);
          setConnection("online");
          await ch.track({ online_at: new Date().toISOString() });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting");
        }
      });

    const onOnline = () => {
      setConnection("reconnecting");
      void refresh();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(ch);
      setChannel(null);
    };
  }, [refresh, room?.id, supabase, userId]);

  useEffect(() => {
    if (!room || room.status !== "waiting" || isSpectator || !userId) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isSpectator, refresh, room?.status, userId]);

  return { room, players, loading, error, onlineIds, connection, refresh, channel, isSpectator, spectatorCount };
}
