"use client";

import { Check, CheckCheck, Lock, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedPage } from "@/components/protected-page";
import { useAuth } from "@/components/auth-provider";
import { decryptMessage, encryptMessage, publishMessageKey } from "@/lib/message-crypto";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Friend = { id: string; display_name: string; avatar_url: string | null };
type EncryptedMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  ciphertext: string;
  iv: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  deleted_by_sender_at: string | null;
  deleted_by_receiver_at: string | null;
};
type Message = EncryptedMessage & { body: string; deletedForEveryone: boolean };

function MessagesContent() {
  const searchParams = useSearchParams();
  const friendIdParam = searchParams.get("friendId");
  const { user } = useAuth();
  const sb = getSupabaseBrowserClient();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const loadingMessages = useRef(false);
  const [unreadByFriend, setUnreadByFriend] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadFriends = useCallback(async () => {
    if (!sb) return;
    const [{ data, error: loadError }, { data: unread, error: unreadError }] = await Promise.all([
      sb.rpc("get_friends"),
      sb.rpc("get_unread_friend_message_counts"),
    ]);
    if (loadError) setError(loadError.message);
    else if (unreadError) setError(`Connecting to server… ${unreadError.message}`);
    else {
      const friendList = (data || []) as Friend[];
      setFriends(friendList);
      setUnreadByFriend(
        Object.fromEntries(((unread || []) as { friend_id: string; unread_count: number }[]).map((row) => [row.friend_id, Number(row.unread_count)]))
      );

      // Auto select matching friendId from param or fallback to first friend
      if (friendList.length > 0) {
        if (friendIdParam) {
          const matched = friendList.find((f) => f.id === friendIdParam);
          if (matched) setSelected(matched);
          else setSelected(friendList[0]);
        } else if (!selected) {
          setSelected(friendList[0]);
        }
      }
    }
  }, [sb, friendIdParam, selected]);

  const loadMessages = useCallback(async (friend: Friend) => {
    if (!sb || !user || loadingMessages.current) return;
    loadingMessages.current = true;
    try {
      const [{ data, error: loadError }, { data: key, error: keyError }] = await Promise.all([
        sb.rpc("get_encrypted_friend_messages", { p_friend: friend.id }),
        sb.from("friend_message_keys").select("public_key").eq("user_id", friend.id).maybeSingle(),
      ]);
      if (loadError || keyError) {
        setError(`Connecting to server… ${((loadError || keyError)?.message || "Unable to load messages.")}`);
        return;
      }
      const encrypted = (data || []) as EncryptedMessage[];
      const decoded = await Promise.all(
        encrypted.map(async (message) => {
          if (!message.ciphertext || (message.deleted_by_sender_at && message.deleted_by_receiver_at)) {
            return { ...message, body: "", deletedForEveryone: true };
          }
          if (!key?.public_key) return { ...message, body: "Unable to decrypt this message.", deletedForEveryone: false };
          try {
            return { ...message, body: await decryptMessage(message.ciphertext, message.iv, key.public_key), deletedForEveryone: false };
          } catch {
            return { ...message, body: "Unable to decrypt this message.", deletedForEveryone: false };
          }
        })
      );
      setMessages(decoded);
      setTimeout(scrollToBottom, 100);
      const { error: readError } = await sb.rpc("mark_friend_messages_read", { p_friend: friend.id });
      if (readError) setError(`Connecting to server… ${readError.message}`);
      else setUnreadByFriend((current) => ({ ...current, [friend.id]: 0 }));
    } finally {
      loadingMessages.current = false;
    }
  }, [sb, user]);

  useEffect(() => {
    const timer = setTimeout(() => void loadFriends(), 0);
    return () => clearTimeout(timer);
  }, [loadFriends]);

  useEffect(() => {
    if (!selected) return;
    const timer = setTimeout(() => void loadMessages(selected), 0);
    return () => clearTimeout(timer);
  }, [loadMessages, selected]);

  useEffect(() => {
    if (!sb || !selected) return;
    const channel = sb
      .channel(`messages:${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages" }, () => void loadMessages(selected))
      .subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [loadMessages, sb, selected]);

  useEffect(() => {
    if (!sb || !user) return;
    void publishMessageKey(sb, user.id).catch((publishError: Error) => setError(publishError.message));
  }, [sb, user]);

  async function send() {
    if (!sb || !user || !selected || !draft.trim() || sending) return;
    setError("");
    setSending(true);
    try {
      await publishMessageKey(sb, user.id);
      const { data: key, error: keyError } = await sb.from("friend_message_keys").select("public_key").eq("user_id", selected.id).maybeSingle();
      if (keyError) throw new Error(`Connecting to server… ${keyError.message}`);
      if (!key?.public_key) throw new Error("This friend has not enabled encryption yet.");
      const encrypted = await encryptMessage(draft.trim(), key.public_key);
      const { error: sendError } = await sb.rpc("send_encrypted_friend_message", {
        p_receiver: selected.id,
        p_ciphertext: encrypted.ciphertext,
        p_iv: encrypted.iv,
      });
      if (sendError) setError(`Connecting to server… ${sendError.message}`);
      else {
        setDraft("");
        await loadMessages(selected);
      }
    } catch (sendError) {
      console.error("Unable to send encrypted friend message", sendError);
      setError(sendError instanceof Error ? sendError.message : "Unable to send encrypted message.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(message: Message, forEveryone: boolean) {
    if (!sb) return;
    const { error: deleteError } = await sb.rpc("delete_encrypted_friend_message", {
      p_message: message.id,
      p_everyone: forEveryone,
    });
    if (deleteError) setError(deleteError.message);
    else if (selected) await loadMessages(selected);
  }

  return (
    <main className="h-[calc(100dvh-75px)] bg-[#fffdf7] p-3 sm:p-5 pb-20 sm:pb-24 flex flex-col">
      <div className="mx-auto flex-1 min-h-0 w-full max-w-5xl overflow-hidden rounded-[24px] sm:rounded-[28px] border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821] flex flex-col md:grid md:grid-cols-[260px_1fr]">
        <aside className="shrink-0 border-b-2 border-slate-950 p-3 sm:p-4 md:border-b-0 md:border-r-2 bg-[#faf9f6]">
          <div className="flex items-center justify-between md:block">
            <div>
              <p className="eyebrow">Messages</p>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-black">Your chats</h1>
            </div>
            {friends.length > 0 && (
              <span className="text-xs font-bold text-slate-500 md:hidden">
                {friends.length} {friends.length === 1 ? "friend" : "friends"}
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x md:block md:space-y-2 md:pb-0">
            {friends.map((friend) => (
              <button
                onClick={() => {
                  setSelected(friend);
                  setError("");
                }}
                key={friend.id}
                className={`flex shrink-0 snap-start items-center gap-2 rounded-xl border-2 p-2 text-left transition ${
                  selected?.id === friend.id ? "border-slate-950 bg-[#f0edff]" : "border-transparent hover:bg-slate-100 bg-white"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4dc69] font-black border border-slate-950">
                  {friend.display_name[0]?.toUpperCase()}
                </span>
                <strong className="text-xs sm:text-sm truncate max-w-[110px] sm:max-w-none">{friend.display_name}</strong>
                {unreadByFriend[friend.id] > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                    {unreadByFriend[friend.id]}
                  </span>
                )}
              </button>
            ))}
            {!friends.length && <p className="mt-2 text-xs sm:text-sm text-slate-500">Add friends to start chatting.</p>}
          </div>
        </aside>

        <section className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
          <header className="shrink-0 border-b-2 border-slate-100 p-3 sm:p-4 font-black bg-white flex items-center justify-between">
            <span className="truncate text-base sm:text-lg">{selected ? selected.display_name : "Choose a friend"}</span>
            {selected && <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Encrypted</span>}
          </header>
          {error && <p className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 font-bold">{error}</p>}

          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3 sm:p-4">
            {!messages.length && selected && <p className="text-center text-xs sm:text-sm text-slate-400 py-6">No messages yet. Direct messages are end-to-end encrypted.</p>}
            {messages.map((message) => {
              const own = message.sender_id === user?.id;
              const status = message.read_at ? "read" : message.delivered_at ? "delivered" : "sent";
              return (
                <div key={message.id} className={`group flex max-w-[85%] sm:max-w-[75%] items-end gap-1.5 ${own ? "ml-auto flex-row-reverse" : ""}`}>
                  <div className={`rounded-2xl px-3.5 py-2 text-xs sm:text-sm ${own ? "bg-[#7357ff] text-white" : "bg-slate-100 text-slate-900 border border-slate-200"}`}>
                    {message.deletedForEveryone ? <em className="text-slate-400">Message deleted</em> : message.body}
                    <div className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${own ? "text-violet-200" : "text-slate-400"}`}>
                      {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {own && (status === "sent" ? <Check size={12} /> : <CheckCheck size={12} className={status === "read" ? "text-sky-300" : ""} />)}
                    </div>
                  </div>
                  {!message.deletedForEveryone && (
                    <button title="Delete for me" onClick={() => void deleteMessage(message, false)} className="rounded p-1 text-slate-400 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  )}
                  {own && !message.deletedForEveryone && (
                    <button title="Delete for everyone" onClick={() => void deleteMessage(message, true)} className="rounded p-1 text-slate-400 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {selected && (
            <div className="shrink-0 border-t-2 border-slate-100 p-2.5 sm:p-3 bg-white">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Lock size={11} /> End-to-end encrypted chat
              </p>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void send()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border-2 border-slate-950 px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-[#7357ff]"
                />
                <button
                  disabled={sending || !draft.trim()}
                  onClick={() => void send()}
                  className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl bg-slate-950 text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[2px_2px_0_#171821]"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <ProtectedPage>
      <Suspense fallback={<div className="grid min-h-[60vh] place-items-center"><p className="text-sm font-bold">Loading messages…</p></div>}>
        <MessagesContent />
      </Suspense>
    </ProtectedPage>
  );
}

