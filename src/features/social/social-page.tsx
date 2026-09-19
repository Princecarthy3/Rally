"use client";

import { Bell, Eye, MessageCircle, Search, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useSocialPresence } from "@/components/app-presence";
import { PlayerCardModal } from "@/components/customization/player-card-modal";

type Player = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  room_status?: string;
  game_type?: string | null;
  room_code?: string | null;
  allow_spectate?: boolean | null;
};
type Inbox = { kind: "friend" | "invite"; id: string; sender_id: string; sender_name: string; sender_avatar: string | null; room_code: string | null; created_at: string };

const GAME_LABELS: Record<string, string> = {
  ludo: "Ludo",
  memory_match: "Memory Match",
  mini_golf: "Mini Golf",
  tic_tac_toe: "Tic-Tac-Toe",
  connect_four: "Connect Four",
  rps: "Rock Paper Scissors",
  number_guess: "Number Hunt",
  dots_boxes: "Dots & Boxes",
  battleship: "Battleship",
  skribbl: "Skribbl",
};

const statusLabel = (friend: Player, online: boolean) => {
  if (friend.room_status === "playing") {
    const game = friend.game_type ? GAME_LABELS[friend.game_type] || friend.game_type : "a game";
    return `Playing ${game}`;
  }
  if (friend.room_status === "lobby") return "In Lobby";
  return online ? "Online" : "Offline";
};
const statusDot = (status: string, online: boolean) =>
  status === "playing"
    ? "bg-emerald-500"
    : status === "lobby"
      ? "bg-amber-400"
      : online
        ? "bg-emerald-500"
        : "bg-slate-400";

export function SocialPage() {
  const { user } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const online = useSocialPresence();

  const [friends, setFriends] = useState<Player[]>([]);
  const [inbox, setInbox] = useState<Inbox[]>([]);
  const [relationships, setRelationships] = useState<Map<string, string>>(new Map());
  const [results, setResults] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  // Player Card Modal State
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const [friendsRes, inboxRes, relationsRes] = await Promise.all([
      supabase.rpc("get_friends"),
      supabase.rpc("get_social_inbox"),
      supabase.rpc("get_social_relationships"),
    ]);

    setFriends((friendsRes.data || []) as Player[]);
    setInbox((inboxRes.data || []) as Inbox[]);
    setRelationships(new Map((relationsRes.data || []).map((item: { player_id: string; relationship: string }) => [item.player_id, item.relationship])));
  }, [supabase, user]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase.channel(`social-updates:${user.id}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_invites" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void load())
      .subscribe((state) => {
        if (state === "SUBSCRIBED") void load();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase, user]);

  const search = async () => {
    if (!supabase || query.trim().length < 2) return setResults([]);
    const { data, error } = await supabase.rpc("social_search_players", { p_query: query.trim() });
    if (error) setMessage(error.message);
    else setResults((data || []) as Player[]);
  };

  const call = async (name: string, args: Record<string, unknown>) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      setMessage(error.message);
      return null;
    }
    await load();
    return data;
  };

  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);
  const incomingByPlayer = useMemo(() => new Map(inbox.filter((item) => item.kind === "friend").map((item) => [item.sender_id, item])), [inbox]);
  const visibleFriends = [...friends].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.display_name.localeCompare(b.display_name));

  return (
    <main className="min-h-screen bg-[#fffdf7] pb-28">
      <section className="border-b-2 border-slate-950 bg-[#f0edff]">
        <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
          <p className="eyebrow">Social</p>
          <h1 className="mt-2 text-5xl font-black tracking-[-.06em]">Your squad.</h1>
          <p className="mt-3 text-slate-600">Find players, build your crew, and watch friends play live.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1.35fr_.65fr] lg:px-8">
        <section className="paper-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Friends</p>
              <h2 className="mt-1 text-2xl font-black">Ready to rally</h2>
            </div>
            <UsersRound />
          </div>

          <div className="mt-5 divide-y-2 divide-slate-100">
            {visibleFriends.length ? (
              visibleFriends.map((friend) => {
                const isOnline = online.has(friend.id);
                return (
                  <div className="flex items-center gap-2 sm:gap-3 py-4" key={friend.id}>
                    <button
                      onClick={() => {
                        setSelectedPlayerId(friend.id);
                        setIsPlayerModalOpen(true);
                      }}
                      className="cursor-pointer hover:opacity-80 transition"
                    >
                      <Avatar player={friend} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => {
                          setSelectedPlayerId(friend.id);
                          setIsPlayerModalOpen(true);
                        }}
                        className="block truncate text-sm sm:text-base font-black text-left hover:underline cursor-pointer"
                      >
                        {friend.display_name}
                      </button>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <i className={`h-2 w-2 rounded-full ${statusDot(friend.room_status || "offline", isOnline)}`} />
                        {statusLabel(friend, isOnline)}
                      </span>
                    </div>

                    <button
                      onClick={() => router.push(`/messages?friendId=${friend.id}`)}
                      className="arcade-button bg-[#f4dc69] px-2.5 sm:px-3 py-2 text-xs text-slate-950 flex items-center gap-1 shadow-[2px_2px_0_#171821]"
                    >
                      <MessageCircle size={14} /> Chat
                    </button>

                    {friend.room_status === "playing" && friend.room_code && friend.allow_spectate !== false && (
                      <button
                        onClick={() => router.push(`/room/${friend.room_code}?spectate=1`)}
                        className="arcade-button bg-emerald-500 px-2.5 sm:px-3 py-2 text-xs text-white flex items-center gap-1 shadow-[2px_2px_0_#171821]"
                      >
                        <Eye size={14} /> Spectate
                      </button>
                    )}

                    {isOnline && friend.room_status !== "playing" && (
                      <button
                        onClick={() =>
                          void call("send_game_invite", { p_receiver: friend.id }).then(() => setMessage(`Invite sent to ${friend.display_name}!`))
                        }
                        className="arcade-button bg-[#7357ff] px-2.5 sm:px-3 py-2 text-xs text-white"
                      >
                        Invite
                      </button>
                    )}

                    <button
                      aria-label={`Remove ${friend.display_name}`}
                      onClick={() => void call("remove_friend", { p_friend: friend.id })}
                      className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-950 bg-white hover:bg-red-50 hover:border-red-600 hover:text-red-600 transition"
                    >
                      <UserMinus size={15} />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="py-9 text-center text-sm font-bold text-slate-500">Your squad is empty. Search for a player to get started.</p>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="paper-card p-5">
            <div className="flex items-center gap-2">
              <Bell size={17} />
              <h2 className="font-black">Requests & invites</h2>
              {inbox.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{inbox.length}</span>}
            </div>

            <div className="mt-4 space-y-3">
              {inbox.length ? (
                inbox.map((item) => (
                  <div key={item.id} className="rounded-2xl border-2 border-slate-950 bg-white p-3">
                    <strong className="block text-sm">{item.sender_name}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.kind === "friend" ? "Wants to be your friend." : `Invited you to room ${item.room_code || ""}.`}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={async () => {
                          const data = await call(
                            item.kind === "friend" ? "respond_to_friend_request" : "respond_to_game_invite",
                            item.kind === "friend" ? { p_request: item.id, p_accept: true } : { p_invite: item.id, p_accept: true }
                          );
                          if (item.kind === "invite" && data) router.push(`/room/${data}`);
                          else if (item.kind === "friend") router.push(`/messages?friendId=${item.sender_id}`);
                        }}
                        className="arcade-button bg-[#a7efc8] px-3 py-2 text-xs"
                      >
                        {item.kind === "friend" ? "Accept & Message" : "Accept"}
                      </button>

                      <button
                        onClick={() =>
                          void call(
                            item.kind === "friend" ? "respond_to_friend_request" : "respond_to_game_invite",
                            item.kind === "friend" ? { p_request: item.id, p_accept: false } : { p_invite: item.id, p_accept: false }
                          )
                        }
                        className="arcade-button bg-white px-3 py-2 text-xs"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-xs font-bold text-slate-500">No pending requests.</p>
              )}
            </div>
          </section>

          <section className="paper-card p-5">
            <p className="eyebrow">Add friend</p>
            <h2 className="mt-1 text-xl font-black">Search players</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void search()}
                placeholder="Name or player ID"
                className="min-w-0 flex-1 rounded-xl border-2 border-slate-950 bg-white px-3 py-2 text-sm font-bold outline-none"
              />
              <button onClick={() => void search()} className="grid h-10 w-10 place-items-center rounded-xl border-2 border-slate-950 bg-slate-950 text-white">
                <Search size={16} />
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {results.map((player) => {
                const incoming = incomingByPlayer.get(player.id);
                const relation = relationships.get(player.id);
                const friendsAlready = friendIds.has(player.id);

                return (
                  <div key={player.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                    <button
                      onClick={() => {
                        setSelectedPlayerId(player.id);
                        setIsPlayerModalOpen(true);
                      }}
                      className="cursor-pointer"
                    >
                      <Avatar player={player} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlayerId(player.id);
                        setIsPlayerModalOpen(true);
                      }}
                      className="min-w-0 flex-1 truncate text-sm font-black text-left hover:underline cursor-pointer"
                    >
                      {player.display_name}
                    </button>

                    {friendsAlready ? (
                      <button onClick={() => router.push(`/messages?friendId=${player.id}`)} className="text-xs font-black text-[#7357ff] flex items-center gap-1">
                        <MessageCircle size={12} /> Message
                      </button>
                    ) : incoming ? (
                      <>
                        <button
                          onClick={async () => {
                            await call("respond_to_friend_request", { p_request: incoming.id, p_accept: true });
                            router.push(`/messages?friendId=${player.id}`);
                          }}
                          className="text-xs font-black text-[#7357ff]"
                        >
                          Accept
                        </button>
                        <button onClick={() => void call("respond_to_friend_request", { p_request: incoming.id, p_accept: false })}>
                          <X size={15} />
                        </button>
                      </>
                    ) : relation === "outgoing_request" ? (
                      <span className="text-xs font-black text-slate-500">Request sent</span>
                    ) : (
                      <button onClick={() => void call("send_friend_request", { p_receiver: player.id })} className="text-xs font-black text-[#7357ff]">
                        <UserPlus size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {message && (
        <button
          onClick={() => setMessage("")}
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-4 py-2 text-xs font-black shadow-[3px_3px_0_#171821]"
        >
          {message}
        </button>
      )}

      {/* Player Card Modal */}
      <PlayerCardModal
        userId={selectedPlayerId}
        isOpen={isPlayerModalOpen}
        onClose={() => {
          setIsPlayerModalOpen(false);
          setSelectedPlayerId(null);
        }}
      />
    </main>
  );
}

function Avatar({ player }: { player: Player }) {
  return player.avatar_url ? (
    <img src={player.avatar_url} alt="" className="h-10 w-10 rounded-full border-2 border-slate-950 object-cover" />
  ) : (
    <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-slate-950 bg-[#f4dc69] text-sm font-black">
      {player.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}
