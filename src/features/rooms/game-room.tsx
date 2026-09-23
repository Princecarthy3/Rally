"use client";

import { ArrowLeft, Check, Copy, LoaderCircle, Radio, Share2, ShieldCheck, UsersRound, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProtectedPage } from "@/components/protected-page";
import { useAuth } from "@/components/auth-provider";
import { gameByKey } from "@/features/games/registry";
import { GameBoard } from "@/features/games/game-board";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRoom } from "./use-room";
import { RoomChat } from "@/components/room-chat";
import { UserAvatar } from "@/components/customization/user-avatar";
import { NameDisplay } from "@/components/customization/name-display";
import { EmoteWheel } from "@/components/customization/emote-wheel";
import { VictoryAnimationOverlay } from "@/components/customization/victory-animation-overlay";
import { PlayerCardModal } from "@/components/customization/player-card-modal";
import { getRoomThemeStyle } from "@/lib/customization";
import { sounds } from "@/lib/audio";

const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];
const isBotId = (id: string) => id.startsWith("11111111-1111-1111-1111-");

export function GameRoom() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const spectateMode = searchParams.get("spectate") === "1" || searchParams.get("spectate") === "true";
  const { user, profile } = useAuth();
  const { room, players, loading, error, onlineIds, connection, channel, refresh, applyPublicState, isSpectator } = useRoom(
    params.code,
    user?.id,
    { spectate: spectateMode }
  );

  const [busy, setBusy] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [showBotPicker, setShowBotPicker] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeEmotes, setActiveEmotes] = useState<Array<{ seat: number; emote: string; senderName?: string; id: number }>>([]);
  const [victoryDismissedFor, setVictoryDismissedFor] = useState<string | null>(null);

  // Player Card Modal State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const myName = profile?.display_name || user?.user_metadata?.display_name || "Player";
  const isPlayer = !isSpectator && !spectateMode && players.some((p) => p.player_id === user?.id);

  // Host room theme
  const hostPlayer = players.find((p) => p.player_id === room?.host_id);
  const roomThemeStyle = getRoomThemeStyle(hostPlayer?.customization?.room_theme);

  
  // Leaving the room page returns to lobby ambient music.
  useEffect(() => {
    return () => {
      sounds.startLobbyBgm();
    };
  }, []);

  useEffect(() => {
    if (!channel) return;
    channel.on("broadcast", { event: "emote" }, (payload) => {
      if (payload.payload) {
        const item = payload.payload as { seat: number; emote: string; senderName?: string; id: number };
        setActiveEmotes((prev) => [...prev, item]);
        sounds.playMessageSound();
        setTimeout(() => {
          setActiveEmotes((prev) => prev.filter((e) => e.id !== item.id));
        }, 3500);
      }
    });
  }, [channel]);

  // Track daily missions on match completion
  useEffect(() => {
    if (room?.status === "completed" && user?.id && supabase) {
      void supabase.rpc("track_mission_progress", { p_mission_type: "play_game", p_amount: 1 });
      const myPlayer = players.find((p) => p.player_id === user.id);
      if (myPlayer && room.public_state?.winnerSeat === myPlayer.seat) {
        void supabase.rpc("track_mission_progress", { p_mission_type: "win_game", p_amount: 1 });
      }
    }
  }, [room?.status, room?.public_state?.winnerSeat, players, user?.id, supabase]);

  async function ready(value: boolean) {
    if (!room) return;
    setBusy(true);
    const { error } = await supabase!.rpc("set_player_ready", { p_room: room.id, p_ready: value });
    if (error) setNotice(error.message);
    else await refresh();
    setBusy(false);
  }

  async function start() {
    if (!room) return;
    setBusy(true);
    setNotice("");
    const startRpc =
      room.game_type === "racing"
        ? "start_racing_game"
        : room.game_type === "ludo"
        ? "start_ludo_game"
        : room.game_type === "memory_match"
        ? "start_memory_match"
        : room.game_type === "mini_golf"
        ? "start_mini_golf"
        : room.game_type === "battleship"
        ? "start_battleship"
        : room.game_type === "uno"
        ? "start_uno_game"
        : "start_game";
    const { error } = await supabase!.rpc(startRpc, { p_room: room.id });
    if (error) setNotice(error.message);
    setBusy(false);
  }

  async function addBot(difficulty: "easy" | "medium" | "hard" = botDifficulty) {
    if (!room) return;
    setBusy(true);
    setNotice("");
    setBotDifficulty(difficulty);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`rally_bot_difficulty_${room.id}`, difficulty);
      }
    } catch { /* ignore */ }
    const { error } = await supabase!.rpc("add_bot_to_room", { p_room: room.id });
    if (error) setNotice(error.message);
    else {
      setNotice(`AI Bot added (${difficulty}).`);
      await refresh();
    }
    setShowBotPicker(false);
    setBusy(false);
  }


  async function leaveSpectator() {
    if (!room || !supabase) return;
    setBusy(true);
    await supabase.rpc("leave_spectator_room", { p_code: room.code });
    setBusy(false);
    router.push("/friends");
  }

  function handleSendEmote(emote: string) {
    const me = players.find((p) => p.player_id === user?.id);
    if (!me || !channel) return;
    const payload = { seat: me.seat, emote, senderName: myName, id: Date.now() };
    channel.send({ type: "broadcast", event: "emote", payload });
  }

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value);
    setNotice(`${label} copied to clipboard!`);
    setTimeout(() => setNotice(""), 3000);
  }

  function share() {
    if (typeof window === "undefined" || !navigator.share || !room) return;
    void navigator.share({
      title: "Join my Rally game",
      text: `Jump into room ${room.code} to play!`,
      url: window.location.href,
    });
  }

  const winningPlayer = players.find((p) => p.seat === room?.public_state?.winnerSeat);

  return (
    <ProtectedPage>
      <div className={`min-h-[calc(100vh-80px)] p-3 pb-40 sm:p-6 lg:p-8 transition-colors duration-500 ${roomThemeStyle.containerClass}`} style={roomThemeStyle.bgStyle}>
        <div className="mx-auto max-w-6xl">

          <div className="mb-4 sm:mb-6 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-700 hover:text-slate-950 dark:text-slate-200">
              <ArrowLeft size={16} /> Exit Room
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <EmoteWheel onSendEmote={handleSendEmote} />

              <div
                className={`flex items-center gap-1.5 rounded-full border-2 border-slate-950 px-2.5 py-1 text-[10px] font-black ${
                  connection === "online" ? "bg-[#a7efc8] text-slate-950" : "bg-[#f4dc69] text-slate-950"
                }`}
              >
                {connection === "online" ? <Radio size={12} /> : <WifiOff size={12} />} {connection.toUpperCase()}
              </div>
            </div>
          </div>


          {(isSpectator || spectateMode) && room && room.status !== "waiting" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-950 bg-[#f4dc69] px-4 py-3 shadow-[4px_4px_0_#171821]">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Spectator mode</p>
                <p className="text-sm font-black text-slate-950">SPECTATING — read only. You cannot make moves.</p>
              </div>
              <button
                type="button"
                onClick={() => void leaveSpectator()}
                disabled={busy}
                className="arcade-button bg-slate-950 px-4 py-2 text-xs text-white"
              >
                Leave Spectator Mode
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid min-h-[60vh] place-items-center">
              <div className="text-center">
                <LoaderCircle className="mx-auto animate-spin text-[#7357ff]" />
                <p className="mt-3 text-sm font-black">Opening room {params.code.toUpperCase()}…</p>
              </div>
            </div>
          ) : error || !room ? (
            <div className="paper-card mx-auto max-w-lg p-6 sm:p-8 text-center">
              <span className="text-5xl sm:text-6xl">🚪</span>
              <h1 className="mt-4 text-2xl sm:text-3xl font-black">Couldn’t enter the room</h1>
              <p className="mt-2 text-sm text-slate-600">{error || "This invite is no longer available."}</p>
              <Link href="/dashboard" className="arcade-button mt-5 bg-slate-950 text-white text-xs sm:text-sm">
                Find another game
              </Link>
            </div>
          ) : room.status === "waiting" ? (
            <Lobby
              room={room}
              players={players}
              userId={user!.id}
              onlineIds={onlineIds}
              busy={busy}
              notice={notice}
              ready={ready}
              start={start}
              addBot={addBot}
              openBotPicker={() => setShowBotPicker(true)}
              copy={copy}
              share={share}
              activeEmotes={activeEmotes}
              onSelectPlayer={(pId) => {
                setSelectedPlayerId(pId);
                setIsPlayerModalOpen(true);
              }}
            />
          ) : (
            <GameBoard room={room} players={players} userId={user!.id} onlineIds={onlineIds} refresh={refresh} applyPublicState={applyPublicState} isSpectator={isSpectator || spectateMode} channel={channel} />
          )}

          {/* Victory Overlay Trigger */}
          {room?.status === "completed" && winningPlayer && victoryDismissedFor !== `${room.id}:${room.match_number}` && (
            <VictoryAnimationOverlay
              winnerName={winningPlayer.profile?.display_name || `Player ${winningPlayer.seat}`}
              isMe={winningPlayer.player_id === user?.id}
              equippedVictory={winningPlayer.customization?.victory}
              onDismiss={() => setVictoryDismissedFor(`${room.id}:${room.match_number}`)}
            />
          )}

          {room && user && isPlayer && (
            <RoomChat
              roomCode={room.code}
              userId={user.id}
              userName={myName}
              players={players}
              onSelectPlayer={(pId) => {
                setSelectedPlayerId(pId);
                setIsPlayerModalOpen(true);
              }}
            />
          )}

          {notice && room && room.status !== "waiting" && (
            <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-4 py-2.5 text-xs font-black shadow-[4px_4px_0_#171821]">
              {notice}
            </div>
          )}

          {/* Full-Screen Realtime Reaction Overlay for All Players */}
          {activeEmotes.length > 0 && (
            <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center overflow-hidden bg-slate-950/20 backdrop-blur-[2px] animate-in fade-in duration-200">
              {activeEmotes.map((item) => (
                <div key={item.id} className="mb-4 flex flex-col items-center animate-bounce">
                  <span className="text-7xl sm:text-8xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">{item.emote}</span>
                  {item.senderName && (
                    <span className="mt-2 rounded-full border-2 border-slate-950 bg-white px-3 py-0.5 text-xs font-black text-slate-950 shadow-md">
                      {item.senderName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Player Profile Card Modal */}
          
      {showBotPicker && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border-2 border-slate-950 bg-[#fffdf7] p-5 shadow-[6px_6px_0_#171821]">
            <h3 className="text-lg font-black">AI Bot difficulty</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">How smart should the bot play?</p>
            <div className="mt-4 grid gap-2">
              {([
                ["easy", "Easy — makes mistakes, random-ish moves"],
                ["medium", "Medium — solid play, occasional errors"],
                ["hard", "Hard — stronger, prioritizes best moves"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => void addBot(id)}
                  className={`rounded-2xl border-2 border-slate-950 px-4 py-3 text-left text-xs font-black transition ${
                    botDifficulty === id ? "bg-[#77dce7] shadow-[3px_3px_0_#171821]" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowBotPicker(false)}
              className="arcade-button mt-4 w-full bg-white text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <PlayerCardModal
            userId={selectedPlayerId}
            isOpen={isPlayerModalOpen}
            onClose={() => {
              setIsPlayerModalOpen(false);
              setSelectedPlayerId(null);
            }}
          />
        </div>
      </div>
    </ProtectedPage>
  );
}

function Lobby({
  room,
  players,
  userId,
  onlineIds,
  busy,
  notice,
  ready,
  start,
  addBot,
  openBotPicker,
  copy,
  share,
  activeEmotes,
  onSelectPlayer,
}: {
  room: import("./types").Room;
  players: import("./types").RoomPlayer[];
  userId: string;
  onlineIds: string[];
  busy: boolean;
  notice: string;
  ready: (v: boolean) => void;
  start: () => void;
  addBot: (difficulty?: "easy" | "medium" | "hard") => void;
  openBotPicker: () => void;
  copy: (v: string, l: string) => void;
  share: () => void;
  activeEmotes: Array<{ seat: number; emote: string; id: number }>;
  onSelectPlayer: (pId: string) => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const game = gameByKey[room.game_type];
  const me = players.find((p) => p.player_id === userId);
  const host = room.host_id === userId;
  const everyoneReady = players.length >= game.minPlayers && players.every((p) => p.is_ready);
  const invite = typeof window !== "undefined" ? window.location.href : "";
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [inviteNotice, setInviteNotice] = useState("");
  const [friendsList, setFriendsList] = useState<Array<{ id: string; display_name: string; avatar_url: string | null }>>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  const isRoomFull = players.length >= room.max_players;

  const openInviteModal = useCallback(async () => {
    if (isRoomFull) {
      return;
    }
    setIsInviteOpen(true);
    if (!supabase) return;
    setLoadingFriends(true);
    const { data } = await supabase.rpc("get_friends");
    setFriendsList((data || []) as Array<{ id: string; display_name: string; avatar_url: string | null }>);
    setLoadingFriends(false);
  }, [isRoomFull, supabase]);

  async function handleInviteFriend(friendId: string, friendName: string) {
    if (!supabase) return;
    if (players.length >= room.max_players) {
      setInviteNotice("Room is full!");
      return;
    }
    const { error } = await supabase.rpc("send_game_invite_to_room", { p_receiver: friendId, p_room: room.id });
    if (error) {
      const { error: err2 } = await supabase.rpc("send_game_invite", { p_receiver: friendId });
      if (err2) {
        setInviteNotice(err2.message);
        return;
      }
    }
    setInvitedFriends((prev) => new Set(prev).add(friendId));
    setInviteNotice(`Invite sent to ${friendName}!`);
    setTimeout(() => setInviteNotice(""), 3000);
    // Track invite daily mission
    void supabase.rpc("track_mission_progress", { p_mission_type: "invite_friend", p_amount: 1 });
  }

  return (
    <div className="mx-auto max-w-4xl pb-16 sm:pb-8">
      <section className="paper-card overflow-hidden">
        {/* Compact Header for mobile */}
        <header className="relative border-b-2 border-slate-950 p-4 sm:p-7" style={{ backgroundColor: game.color }}>
          <div className="absolute right-3 top-1 text-6xl sm:text-8xl opacity-15">{game.icon}</div>
          <p className="eyebrow !text-slate-950/50">Private game room</p>
          <h1 className="relative mt-1 text-2xl font-black tracking-[-.05em] sm:text-5xl">{game.name}</h1>
          <p className="relative mt-1 max-w-lg text-xs font-medium opacity-70 sm:mt-2 sm:text-sm">{game.description}</p>
        </header>

        <div className="p-4 sm:p-7">
          {/* Super Compact Room Code & Invite Buttons Box */}
          <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-dashed border-slate-300 bg-[#faf9f3] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex items-center justify-between sm:block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Room Code</span>
              <button
                onClick={() => copy(room.code, "Room code")}
                className="cursor-pointer font-mono text-xl font-black tracking-[.2em] text-slate-950 hover:text-[#7357ff] transition sm:text-3xl"
              >
                {room.code}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
              <button
                onClick={() => void openInviteModal()}
                disabled={isRoomFull}
                className={`arcade-button justify-center gap-1 px-2 py-2 text-[11px] ${
                  isRoomFull ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#7357ff] text-white"
                } shadow-[2px_2px_0_#171821] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs`}
              >
                <UsersRound size={13} /> <span className="truncate">{isRoomFull ? "Full" : "Invite"}</span>
              </button>
              <button
                onClick={() => copy(invite, "Invite link")}
                className="arcade-button justify-center gap-1 px-2 py-2 text-[11px] bg-white text-slate-950 shadow-[2px_2px_0_#171821] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs"
              >
                <Copy size={13} /> <span className="truncate">Copy</span>
              </button>
              <button
                onClick={share}
                className="arcade-button justify-center gap-1 px-2 py-2 text-[11px] bg-slate-950 text-white shadow-[2px_2px_0_#171821] sm:gap-2 sm:px-4 sm:py-2.5 sm:text-xs"
              >
                <Share2 size={13} /> <span className="truncate">Share</span>
              </button>
            </div>
          </div>

          <div className="my-5 flex items-center justify-between sm:my-8">
            <div>
              <p className="eyebrow">Players</p>
              <h2 className="mt-1 text-lg font-black sm:text-xl">The starting lineup</h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-black text-slate-500">
              <UsersRound size={15} />
              {players.length}/{room.max_players}
            </span>
          </div>

          {/* Player Cards Grid */}
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            {Array.from({ length: room.max_players }, (_, i) => {
              const player = players.find((p) => p.seat === i + 1);
              const isBot = Boolean(player?.player_id && isBotId(player.player_id));
              const emotesForSeat = activeEmotes.filter((e) => e.seat === i + 1);

              return player ? (
                <article
                  key={player.id}
                  onClick={() => {
                    if (!isBot) onSelectPlayer(player.player_id);
                  }}
                  className="relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-950 p-3 sm:p-4 shadow-[3px_3px_0_#171821] transition hover:scale-[1.02]"
                  style={{ backgroundColor: colors[i] }}
                >
                  {/* Floating Emote animation */}
                  {emotesForSeat.map((e) => (
                    <div key={e.id} className="absolute -top-6 left-1/2 z-50 -translate-x-1/2 text-3xl animate-bounce">
                      {e.emote}
                    </div>
                  ))}

                  <UserAvatar
                    avatarUrl={player.profile?.avatar_url}
                    equippedAvatar={player.customization?.avatar}
                    equippedFrame={player.customization?.frame}
                    fallbackName={player.profile?.display_name}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <NameDisplay
                      name={player.profile?.display_name || `Player ${player.seat}`}
                      nameColor={player.customization?.name_color}
                      nameEffect={player.customization?.name_effect}
                      className="block truncate text-sm sm:text-base font-black"
                    />
                    <span className="block text-[10px] font-bold text-slate-700">
                      [{player.customization?.title?.asset_value || "Newcomer"}]
                      {player.player_id === userId ? " (you)" : ""}
                      {isBot ? " (AI)" : ""}
                    </span>

                    <div className="mt-0.5 flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${onlineIds.includes(player.player_id) || isBot ? "bg-emerald-700" : "bg-slate-500"}`} />
                      <span className="text-[10px] font-black uppercase opacity-60">
                        {isBot ? "AI ACTIVE" : onlineIds.includes(player.player_id) ? "Connected" : "Reconnecting"}
                        {player.player_id === room.host_id ? " · Host" : ""}
                      </span>
                    </div>
                  </div>

                  <span className={`rounded-full border-2 border-slate-950 px-2 py-0.5 text-[9px] sm:text-[10px] font-black ${player.is_ready ? "bg-white text-slate-950" : "bg-white/40 text-slate-700"}`}>
                    {player.is_ready ? "READY" : "NOT READY"}
                  </span>
                </article>
              ) : (
                <button
                  key={i}
                  onClick={() => void openInviteModal()}
                  className="grid min-h-16 place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3 text-center transition hover:border-slate-950 hover:bg-slate-50 cursor-pointer group"
                >
                  <span className="text-xs font-black text-slate-500 group-hover:text-slate-950">
                    ➕ INVITE FRIEND (SEAT {i + 1})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Action Bar */}
          <div className="mt-6 border-t-2 border-slate-100 pt-5 pb-4 sm:mt-8 sm:pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" /> Game starts when everyone is ready.
              </div>

              {/* Action Buttons: Full width on mobile for easy single-thumb tapping */}
              <div className="grid grid-cols-1 w-full gap-2.5 sm:w-auto sm:flex sm:flex-wrap sm:gap-3">
                {host && players.length < room.max_players && (
                  <button onClick={() => openBotPicker()} disabled={busy} className="arcade-button justify-center bg-[#77dce7] text-slate-950 text-xs py-3 sm:py-2.5 shadow-[3px_3px_0_#171821]">
                    🤖 ADD AI BOT
                  </button>
                )}

                <button
                  onClick={() => ready(!me?.is_ready)}
                  disabled={busy}
                  className={`arcade-button justify-center text-xs py-3 sm:py-2.5 ${me?.is_ready ? "bg-emerald-400 text-slate-950" : "bg-[#f4dc69] text-slate-950"} shadow-[3px_3px_0_#171821]`}
                >
                  {me?.is_ready ? <Check size={16} /> : null}
                  {me?.is_ready ? "YOU ARE READY" : "I'M READY"}
                </button>

                {host && (
                  <button
                    onClick={start}
                    disabled={busy || !everyoneReady}
                    className="arcade-button justify-center bg-[#ff9eaa] text-slate-950 text-xs py-3 sm:py-2.5 shadow-[3px_3px_0_#171821] disabled:opacity-40"
                  >
                    START MATCH
                  </button>
                )}
              </div>
            </div>

            {notice && <p className="mt-3 text-center text-xs font-black text-rose-600">{notice}</p>}
          </div>
        </div>
      </section>

      {/* Invite Friends Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border-2 border-slate-950 bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black">Invite Friends to Lobby</h3>
                <p className="text-xs text-slate-500">Select friends to send a direct game invite</p>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-950 bg-slate-100 text-sm font-black hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {inviteNotice && (
              <div className="mt-3 rounded-xl border-2 border-slate-950 bg-emerald-100 p-2 text-center text-xs font-black text-emerald-900">
                {inviteNotice}
              </div>
            )}

            <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
              {loadingFriends ? (
                <div className="flex h-32 items-center justify-center">
                  <LoaderCircle className="animate-spin text-purple-600" />
                </div>
              ) : friendsList.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold text-slate-400">
                  No friends online right now. Add friends from the Social page!
                </div>
              ) : (
                friendsList.map((friend) => {
                  const isInvited = invitedFriends.has(friend.id);
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between rounded-2xl border-2 border-slate-950 p-2.5 sm:p-3 shadow-[2px_2px_0_#171821] bg-slate-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserAvatar avatarUrl={friend.avatar_url} fallbackName={friend.display_name} size="sm" />
                        <span className="text-xs sm:text-sm font-black text-slate-950">{friend.display_name}</span>
                      </div>

                      <button
                        onClick={() => void handleInviteFriend(friend.id, friend.display_name)}
                        disabled={isInvited || isRoomFull}
                        className={`arcade-button text-xs py-1.5 px-3 ${
                          isInvited
                            ? "bg-emerald-400 text-slate-950"
                            : isRoomFull
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-[#7357ff] text-white"
                        }`}
                      >
                        {isInvited ? "INVITED ✓" : isRoomFull ? "ROOM FULL" : "INVITE"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
