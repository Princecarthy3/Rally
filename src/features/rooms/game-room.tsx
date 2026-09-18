"use client";

import { ArrowLeft, Check, Copy, Eye, LoaderCircle, Radio, Share2, ShieldCheck, UsersRound, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
const BOT_ID = "11111111-1111-1111-1111-111111111111";

export function GameRoom() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const isSpectatorRequested = searchParams?.get("spectate") === "true";

  const { user, profile } = useAuth();
  const { room, players, loading, error, onlineIds, connection, channel, isSpectator, spectatorCount } = useRoom(
    params.code,
    user?.id,
    isSpectatorRequested
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeEmotes, setActiveEmotes] = useState<Array<{ seat: number; emote: string; senderName?: string; id: number }>>([]);
  const [showVictory, setShowVictory] = useState(true);

  // Player Card Modal State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  const supabase = getSupabaseBrowserClient();
  const myName = profile?.display_name || user?.user_metadata?.display_name || "Player";

  // Host room theme
  const hostPlayer = players.find((p) => p.player_id === room?.host_id);
  const roomThemeStyle = getRoomThemeStyle(hostPlayer?.customization?.room_theme);

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
    setBusy(false);
  }

  async function start() {
    if (!room) return;
    setBusy(true);
    setNotice("");
    const startRpc =
      room.game_type === "ludo"
        ? "start_ludo_game"
        : room.game_type === "memory_match"
        ? "start_memory_match"
        : room.game_type === "mini_golf"
        ? "start_mini_golf"
        : room.game_type === "battleship"
        ? "start_battleship"
        : "start_game";
    const { error } = await supabase!.rpc(startRpc, { p_room: room.id });
    if (error) setNotice(error.message);
    setBusy(false);
  }

  async function addBot() {
    if (!room) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase!.rpc("add_bot_to_room", { p_room: room.id });
    if (error) setNotice(error.message);
    setBusy(false);
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
      <div className={`min-h-[calc(100vh-80px)] p-4 sm:p-6 lg:p-8 transition-colors duration-500 ${roomThemeStyle.containerClass}`} style={roomThemeStyle.bgStyle}>
        <div className="mx-auto max-w-6xl">

          {/* Spectator Mode Banner */}
          {isSpectator && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-950 bg-amber-400 p-4 shadow-[3px_3px_0_#171821] animate-fadeIn">
              <div className="flex items-center gap-2 font-black text-slate-950 text-sm">
                <Eye className="animate-pulse text-slate-950" size={20} />
                <span>SPECTATOR MODE — You are watching this match live!</span>
              </div>
              <Link href="/dashboard" className="rounded-xl border-2 border-slate-950 bg-white px-3.5 py-1.5 text-xs font-black shadow-[2px_2px_0_#171821] hover:bg-slate-100 transition-all">
                Exit Spectator
              </Link>
            </div>
          )}

          <div className="mb-6 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm font-black text-slate-700 hover:text-slate-950 dark:text-slate-200">
              <ArrowLeft size={16} /> Exit Room
            </Link>

            <div className="flex items-center gap-3">
              {spectatorCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border-2 border-slate-950 bg-purple-100 px-3 py-1 text-xs font-black text-purple-900 shadow-sm">
                  <Eye size={14} className="text-purple-700 animate-pulse" />
                  <span>{spectatorCount} Spectating</span>
                </div>
              )}

              <EmoteWheel onSendEmote={handleSendEmote} />

              <div
                className={`flex items-center gap-2 rounded-full border-2 border-slate-950 px-3 py-1.5 text-[10px] font-black ${
                  connection === "online" ? "bg-[#a7efc8] text-slate-950" : "bg-[#f4dc69] text-slate-950"
                }`}
              >
                {connection === "online" ? <Radio size={12} /> : <WifiOff size={12} />} {connection.toUpperCase()}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-[60vh] place-items-center">
              <div className="text-center">
                <LoaderCircle className="mx-auto animate-spin text-[#7357ff]" />
                <p className="mt-3 text-sm font-black">Opening room {params.code.toUpperCase()}…</p>
              </div>
            </div>
          ) : error || !room ? (
            <div className="paper-card mx-auto max-w-lg p-8 text-center">
              <span className="text-6xl">🚪</span>
              <h1 className="mt-5 text-3xl font-black">Couldn’t enter the room</h1>
              <p className="mt-3 text-slate-600">{error || "This invite is no longer available."}</p>
              <Link href="/dashboard" className="arcade-button mt-6 bg-slate-950 text-white">
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
              copy={copy}
              share={share}
              activeEmotes={activeEmotes}
              onSelectPlayer={(pId) => {
                setSelectedPlayerId(pId);
                setIsPlayerModalOpen(true);
              }}
            />
          ) : (
            <GameBoard room={room} players={players} userId={user!.id} onlineIds={onlineIds} />
          )}

          {/* Victory Overlay Trigger */}
          {room?.status === "completed" && winningPlayer && showVictory && (
            <VictoryAnimationOverlay
              winnerName={winningPlayer.profile?.display_name || `Player ${winningPlayer.seat}`}
              isMe={winningPlayer.player_id === user?.id}
              equippedVictory={winningPlayer.customization?.victory}
              onDismiss={() => setShowVictory(false)}
            />
          )}

          {room && user && (
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
            <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-5 py-3 text-sm font-black shadow-[4px_4px_0_#171821]">
              {notice}
            </div>
          )}

          {/* Full-Screen Realtime Reaction Overlay for All Players */}
          {activeEmotes.length > 0 && (
            <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center overflow-hidden bg-slate-950/20 backdrop-blur-[2px] animate-in fade-in duration-200">
              {activeEmotes.map((item) => (
                <div key={item.id} className="mb-4 flex flex-col items-center animate-bounce">
                  <span className="text-8xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">{item.emote}</span>
                  {item.senderName && (
                    <span className="mt-2 rounded-full border-2 border-slate-950 bg-white px-4 py-1 text-xs font-black text-slate-950 shadow-md">
                      {item.senderName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Player Profile Card Modal */}
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
  addBot: () => void;
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

  const openInviteModal = useCallback(async () => {
    setIsInviteOpen(true);
    if (!supabase) return;
    setLoadingFriends(true);
    const { data } = await supabase.rpc("get_friends");
    setFriendsList((data || []) as Array<{ id: string; display_name: string; avatar_url: string | null }>);
    setLoadingFriends(false);
  }, [supabase]);

  async function handleInviteFriend(friendId: string, friendName: string) {
    if (!supabase) return;
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
    <div className="mx-auto max-w-4xl">
      <section className="paper-card overflow-hidden">
        <header className="relative border-b-2 border-slate-950 p-6 sm:p-8" style={{ backgroundColor: game.color }}>
          <div className="absolute right-4 top-1 text-8xl opacity-15">{game.icon}</div>
          <p className="eyebrow !text-slate-950/50">Private game room</p>
          <h1 className="relative mt-2 text-4xl font-black tracking-[-.05em] sm:text-5xl">{game.name}</h1>
          <p className="relative mt-3 max-w-lg text-sm font-medium opacity-65">{game.description}</p>
        </header>

        <div className="p-5 sm:p-8">
          <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-[#faf9f3] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Room code</p>
              <button onClick={() => copy(room.code, "Room code")} className="mt-1 cursor-pointer font-mono text-3xl font-black tracking-[.2em]">
                {room.code}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void openInviteModal()} className="arcade-button bg-[#7357ff] text-white shadow-[2px_2px_0_#171821]">
                <UsersRound size={15} /> Invite friends
              </button>
              <button onClick={() => copy(invite, "Invite link")} className="arcade-button bg-white text-slate-950">
                <Copy size={15} /> Copy link
              </button>
              <button onClick={share} className="arcade-button bg-slate-950 text-white">
                <Share2 size={15} /> Share
              </button>
            </div>
          </div>

          <div className="my-8 flex items-center justify-between">
            <div>
              <p className="eyebrow">Players</p>
              <h2 className="mt-2 text-xl font-black">The starting lineup</h2>
            </div>
            <span className="flex items-center gap-2 text-xs font-black text-slate-500">
              <UsersRound size={16} />
              {players.length}/{room.max_players}
            </span>
          </div>

          {/* Player Cards Grid with Clickable Player Profiles */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: room.max_players }, (_, i) => {
              const player = players.find((p) => p.seat === i + 1);
              const isBot = player?.player_id === BOT_ID;
              const emotesForSeat = activeEmotes.filter((e) => e.seat === i + 1);

              return player ? (
                <article
                  key={player.id}
                  onClick={() => {
                    if (!isBot) onSelectPlayer(player.player_id);
                  }}
                  className="relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-950 p-4 shadow-[3px_3px_0_#171821] transition hover:scale-[1.02]"
                  style={{ backgroundColor: colors[i] }}
                >
                  {/* Floating Emote animation */}
                  {emotesForSeat.map((e) => (
                    <div key={e.id} className="absolute -top-6 left-1/2 z-50 -translate-x-1/2 text-4xl animate-bounce">
                      {e.emote}
                    </div>
                  ))}

                  <UserAvatar
                    avatarUrl={player.profile?.avatar_url}
                    equippedAvatar={player.customization?.avatar}
                    equippedFrame={player.customization?.frame}
                    fallbackName={player.profile?.display_name}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <NameDisplay
                      name={player.profile?.display_name || `Player ${player.seat}`}
                      nameColor={player.customization?.name_color}
                      nameEffect={player.customization?.name_effect}
                      className="block truncate text-base font-black"
                    />
                    <span className="block text-[10px] font-bold text-slate-700">
                      [{player.customization?.title?.asset_value || "Newcomer"}]
                      {player.player_id === userId ? " (you)" : ""}
                      {isBot ? " (AI)" : ""}
                    </span>

                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${onlineIds.includes(player.player_id) || isBot ? "bg-emerald-700" : "bg-slate-500"}`} />
                      <span className="text-[10px] font-black uppercase opacity-60">
                        {isBot ? "AI ACTIVE" : onlineIds.includes(player.player_id) ? "Connected" : "Reconnecting"}
                        {player.player_id === room.host_id ? " · Host" : ""}
                      </span>
                    </div>
                  </div>

                  <span className={`rounded-full border-2 border-slate-950 px-2.5 py-1 text-[10px] font-black ${player.is_ready ? "bg-white text-slate-950" : "bg-white/40 text-slate-700"}`}>
                    {player.is_ready ? "READY" : "NOT READY"}
                  </span>
                </article>
              ) : (
                <button
                  key={i}
                  onClick={() => void openInviteModal()}
                  className="grid min-h-20 place-items-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-center transition hover:border-slate-950 hover:bg-slate-50 cursor-pointer group"
                >
                  <span className="text-xs font-black text-slate-500 group-hover:text-slate-950">
                    ➕ INVITE FRIEND (SEAT {i + 1})
                    <br />
                    <span className="font-normal text-slate-400">click to choose from squad</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 border-t-2 border-slate-100 pt-6">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <ShieldCheck size={17} className="text-emerald-600" /> Game starts when everyone is ready.
              </div>

              <div className="flex flex-wrap gap-3">
                {host && players.length < room.max_players && (
                  <button onClick={addBot} disabled={busy} className="arcade-button bg-[#77dce7] text-slate-950 shadow-[3px_3px_0_#171821]">
                    🤖 ADD AI BOT
                  </button>
                )}

                <button
                  onClick={() => ready(!me?.is_ready)}
                  disabled={busy}
                  className={`arcade-button ${me?.is_ready ? "bg-emerald-400 text-slate-950" : "bg-[#f4dc69] text-slate-950"} shadow-[3px_3px_0_#171821]`}
                >
                  {me?.is_ready ? <Check size={16} /> : null}
                  {me?.is_ready ? "YOU ARE READY" : "I'M READY"}
                </button>

                {host && (
                  <button
                    onClick={start}
                    disabled={busy || !everyoneReady}
                    className="arcade-button bg-[#ff9eaa] text-slate-950 shadow-[3px_3px_0_#171821] disabled:opacity-40"
                  >
                    START MATCH
                  </button>
                )}
              </div>
            </div>

            {notice && <p className="mt-4 text-center text-xs font-black text-rose-600">{notice}</p>}
          </div>
        </div>
      </section>

      {/* Invite Friends Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl border-2 border-slate-950 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black">Invite Friends to Lobby</h3>
                <p className="text-xs text-slate-500">Select friends to send a direct game invite</p>
              </div>
              <button
                onClick={() => setIsInviteOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-950 bg-slate-100 text-sm font-black hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {inviteNotice && (
              <div className="mt-3 rounded-xl border-2 border-slate-950 bg-emerald-100 p-2.5 text-center text-xs font-black text-emerald-900">
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
                      className="flex items-center justify-between rounded-2xl border-2 border-slate-950 p-3 shadow-[2px_2px_0_#171821] bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar avatarUrl={friend.avatar_url} fallbackName={friend.display_name} size="sm" />
                        <span className="text-sm font-black text-slate-950">{friend.display_name}</span>
                      </div>

                      <button
                        onClick={() => void handleInviteFriend(friend.id, friend.display_name)}
                        disabled={isInvited}
                        className={`arcade-button text-xs py-1.5 px-3 ${
                          isInvited ? "bg-emerald-400 text-slate-950" : "bg-[#7357ff] text-white"
                        }`}
                      >
                        {isInvited ? "INVITED ✓" : "INVITE"}
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
