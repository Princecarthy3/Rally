"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Room, RoomPlayer } from "./types";

export function useRoom(code:string,userId?:string){
 const [room,setRoom]=useState<Room|null>(null); const [players,setPlayers]=useState<RoomPlayer[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [onlineIds,setOnlineIds]=useState<string[]>([]); const [connection,setConnection]=useState<"connecting"|"online"|"reconnecting">("connecting"); const [channel,setChannel]=useState<RealtimeChannel|null>(null); const supabase=getSupabaseBrowserClient();
 const refresh=useCallback(async()=>{if(!supabase||!userId)return;const join=await supabase.rpc("join_game_room",{p_code:code.toUpperCase()});if(join.error&&!join.error.message.includes("already started")){setError(join.error.message);setLoading(false);return}const {data:roomData,error:roomError}=await supabase.from("game_rooms").select("*").eq("code",code.toUpperCase()).maybeSingle();if(roomError||!roomData){setError(roomError?.message||"Room not found");setLoading(false);return}setRoom(roomData as Room);const {data:playerData}=await supabase.from("game_players").select("*, profile:profiles(display_name,avatar_url)").eq("room_id",roomData.id).order("seat");setPlayers((playerData||[]) as unknown as RoomPlayer[]);setError("");setLoading(false)},[code,supabase,userId]);
 useEffect(()=>{if(!supabase||!userId)return;queueMicrotask(()=>refresh())},[refresh,supabase,userId]);
 useEffect(()=>{if(!supabase||!room||!userId)return;const ch=supabase.channel(`room:${room.id}`,{config:{presence:{key:userId}}});ch.on("postgres_changes",{event:"*",schema:"public",table:"game_rooms",filter:`id=eq.${room.id}`},payload=>{if(payload.eventType!=="DELETE")setRoom(payload.new as Room)}).on("postgres_changes",{event:"*",schema:"public",table:"game_players",filter:`room_id=eq.${room.id}`},()=>{void refresh()}).on("presence",{event:"sync"},()=>{const state=ch.presenceState();setOnlineIds(Object.keys(state));}).subscribe(async status=>{if(status==="SUBSCRIBED"){setChannel(ch);setConnection("online");await ch.track({online_at:new Date().toISOString()})}else if(status==="CLOSED"||status==="CHANNEL_ERROR"||status==="TIMED_OUT")setConnection("reconnecting")});
 const onOnline=()=>{setConnection("reconnecting");void refresh()};window.addEventListener("online",onOnline);return()=>{window.removeEventListener("online",onOnline);supabase.removeChannel(ch);setChannel(null)}},[refresh,room,supabase,userId]);
 return {room,players,loading,error,onlineIds,connection,refresh,channel};
}
