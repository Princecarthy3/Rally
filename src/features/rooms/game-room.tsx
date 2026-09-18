"use client";

import { ArrowLeft, Check, Copy, LoaderCircle, Radio, Share2, ShieldCheck, UsersRound, WifiOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { getRoomThemeStyle } from "@/lib/customization";
import { sounds } from "@/lib/audio";

const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];
const BOT_ID = "11111111-1111-1111-1111-111111111111";

export function GameRoom() {
  const params = useParams<{ code: string }>();
  const { user, profile } = useAuth();
  const { room, players, loading, error, onlineIds, connection, channel } = useRoom(params.code, user?.id);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeEmotes, setActiveEmotes] = useState<Array<{ seat: number; emote: string; senderName?: string; id: number }>>([]);
  const [showVictory, setShowVictory] = useState(true);

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
    const startRpc = room.game_type === "ludo" ? "start_ludo_game" : room.game_type === "memory_match" ? "start_memory_match" : room.game_type === "mini_golf" ? "start_mini_golf" : room.game_type === "battleship" ? "start_battleship" : "start_game";
    const { error } = await supabase!.rpc(startRpc, { p_room: room.id });
    if (error) setNotice(error.message);
    setBusy(false);
  }

  async function addBot() {
    if (!room) return;
    setBusy(true);
    setNotice("");
    const { error } = await supabase!.rpc("add_ai_bot_to_room", { p_room: room.id });
    if (error) setNotice(error.message);
    setBusy(false);
  }

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 2400);
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    flash(`${label} copied!`);
  }

  async function share() {
    if (!room) return;
    const data = {
      title: `Join my ${gameByKey[room.game_type].name} room`,
      text: `Room ${room.code} on Rally`,
      url: window.location.href,
    };
    if (navigator.share) await navigator.share(data);
    else copy(window.location.href, "Invite link");
  }

  function handleSendEmote(emote: string) {
    const me = players.find((p) => p.player_id === user?.id);
    const item = { seat: me?.seat || 1, emote, senderName: myName, id: Date.now() + Math.random() };
    setActiveEmotes((prev) => [...prev, item]);
    setTimeout(() => {
      setActiveEmotes((prev) => prev.filter((e) => e.id !== item.id));
    }, 3500);

    if (channel) {
      void channel.send({
        type: "broadcast",
        event: "emote",
        payload: item,
      });
    }
  }

  // Determine winner for victory animation
  const winnerSeat = room?.public_state?.winnerSeat;
  const winningPlayer = players.find((p) => p.seat === winnerSeat);

  return (
    <ProtectedPage>
      <main className={`min-h-[calc(100vh-72px)] pb-28 ${roomThemeStyle.containerClass}`} style={roomThemeStyle.bgStyle}>
        <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/dashboard" className="arcade-button bg-white text-slate-950">
              <ArrowLeft size={16} /> Arcade
            </Link>

            <div className="flex items-center gap-3">
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

          {room && user && <RoomChat roomCode={room.code} userId={user.id} userName={myName} players={players} />}

          {notice && room && room.status !== "waiting" && (
            <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-5 py-3 text-sm font-black shadow-[4px_4px_0_#171821]">
              {notice}
            </div>
          )}

          {/* Full-Screen Realtime Reaction Overlay for All Players */}
          {activeEmotes.length > 0 && (
            <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center overflow-hidden bg-slate-950/20 backdrop-blur-[2px] animate-in fade-in duration-200">
              {activeEmotes.map((e) => (
                <div key={e.id} className="relative flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                  {/* Massive Floating Emote */}
                  <div className="text-8xl sm:text-[12rem] filter drop-shadow-[0_25px_25px_rgba(0,0,0,0.5)] animate-bounce">
                    {e.emote}
                  </div>
                  {/* Floating background particles */}
                  <div className="absolute inset-0 flex items-center justify-center gap-12 -z-10 opacity-80 pointer-events-none">
                    <span className="text-6xl animate-ping">{e.emote}</span>
                    <span className="text-7xl animate-pulse">{e.emote}</span>
                    <span className="text-6xl animate-bounce">{e.emote}</span>
                  </div>
                  {/* Player Toast Banner */}
                  <div className="mt-4 flex items-center gap-3 rounded-full border-4 border-slate-950 bg-[#f4dc69] px-6 py-2.5 shadow-[6px_6px_0_#171821]">
                    <span className="text-2xl">{e.emote}</span>
                    <span className="text-base sm:text-xl font-black text-slate-950">
                      {e.senderName || `Player ${e.seat}`} sent a reaction!
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
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
}: {
  room: NonNullable<ReturnType<typeof useRoom>["room"]>;
  players: ReturnType<typeof useRoom>["players"];
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
      // Fallback to send_game_invite
      const { error: err2 } = await supabase.rpc("send_game_invite", { p_receiver: friendId });
      if (err2) {
        setInviteNotice(err2.message);
        return;
      }
    }
    setInvitedFriends((prev) => new Set(prev).add(friendId));
    setInviteNotice(`Invite sent to ${friendName}!`);
    setTimeout(() => setInviteNotice(""), 3000);
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

          {/* Player Cards Grid with Frames, Avatars, Colors, Badges & Titles */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: room.max_players }, (_, i) => {
              const player = players.find((p) => p.seat === i + 1);
              const isBot = player?.player_id === BOT_ID;
              const emotesForSeat = activeEmotes.filter((e) => e.seat === i + 1);

              return player ? (
                <article
                  key={player.id}
                  className="relative flex items-center gap-4 rounded-2xl border-2 border-slate-950 p-4 shadow-[3px_3px_0_#171821]"
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
                  className={`arcade-button ${me?.is_ready ? "bg-white text-slate-950" : "bg-[#f4dc69] text-slate-950 shadow-[3px_3px_0_#171821]"}`}
                >
                  {me?.is_ready ? (
                    <>
                      <Check size={16} /> Ready!
                    </>
                  ) : (
                    "I’M READY"
                  )}
                </button>

                {host && (
                  <button
                    onClick={start}
                    disabled={!everyoneReady || busy}
                    className="arcade-button bg-[#7357ff] text-white shadow-[3px_3px_0_#171821]"
                  >
                    {busy ? <LoaderCircle className="animate-spin" size={16} /> : "START GAME"}
                  </button>
                )}
              </div>
            </div>

            {!host && everyoneReady && <p className="mt-4 text-center text-sm font-black text-[#7357ff]">Everyone’s ready—waiting for the host.</p>}
            {notice && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-700">{notice}</p>}
          </div>
        </div>
      </section>

      {/* Invite Friends Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] border-2 border-slate-950 bg-[#fffdf7] p-6 shadow-[8px_8px_0_#171821]">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Squad Invite</p>
                <h3 className="mt-1 text-2xl font-black">Invite to Lobby</h3>
              </div>
              <button onClick={() => setIsInviteOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-950 bg-white font-black hover:bg-slate-100">
                ✕
              </button>
            </div>

            {inviteNotice && (
              <p className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800 animate-in fade-in">
                {inviteNotice}
              </p>
            )}

            <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
              {loadingFriends ? (
                <div className="py-8 text-center text-sm font-bold text-slate-500">Loading your squad...</div>
              ) : friendsList.length ? (
                friendsList.map((friend) => {
                  const isOnline = onlineIds.includes(friend.id);
                  const isAlreadyInRoom = players.some((p) => p.player_id === friend.id);
                  const hasInvited = invitedFriends.has(friend.id);

                  return (
                    <div key={friend.id} className="flex items-center gap-3 rounded-2xl border-2 border-slate-950 bg-white p-3 shadow-[2px_2px_0_#171821]">
                      <div className="relative">
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-slate-950 bg-[#f4dc69] text-xs font-black">
                          {friend.display_name[0]?.toUpperCase()}
                        </span>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{friend.display_name}</strong>
                        <span className="text-[10px] font-bold text-slate-500">{isOnline ? "Online" : "Offline"}</span>
                      </div>
                      {isAlreadyInRoom ? (
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">In Room</span>
                      ) : hasInvited ? (
                        <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">Sent ✓</span>
                      ) : (
                        <button
                          onClick={() => void handleInviteFriend(friend.id, friend.display_name)}
                          className="arcade-button bg-[#7357ff] px-3 py-1.5 text-xs text-white shadow-[2px_2px_0_#171821]"
                        >
                          Invite
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="py-8 text-center text-xs font-bold text-slate-500">
                  No friends found in your squad. Add friends from the Social tab first!
                </p>
              )}
            </div>

            <button onClick={() => setIsInviteOpen(false)} className="arcade-button mt-6 w-full justify-center bg-slate-950 text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

