"use client";

import { Check, CheckCheck, Lock, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

export default function MessagesPage() {
  const { user } = useAuth();
  const sb = getSupabaseBrowserClient();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const loadingMessages = useRef(false);

  const loadFriends = useCallback(async () => {
    if (!sb) return;
    const { data, error: loadError } = await sb.rpc("get_friends");
    if (loadError) setError(loadError.message);
    else setFriends((data || []) as Friend[]);
  }, [sb]);

  const loadMessages = useCallback(async (friend: Friend) => {
    if (!sb || !user || loadingMessages.current) return;
    loadingMessages.current = true;
    try {
      const [{ data, error: loadError }, { data: key, error: keyError }] = await Promise.all([
        sb.rpc("get_encrypted_friend_messages", { p_friend: friend.id }),
        sb.from("friend_message_keys").select("public_key").eq("user_id", friend.id).maybeSingle(),
      ]);
      if (loadError || keyError) {
        setError((loadError || keyError)?.message || "Unable to load messages.");
        return;
      }
      const encrypted = (data || []) as EncryptedMessage[];
      const decoded = await Promise.all(
        encrypted.map(async (message) => {
          if (!message.ciphertext || message.deleted_by_sender_at && message.deleted_by_receiver_at) {
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
      const { error: readError } = await sb.rpc("mark_friend_messages_read", { p_friend: friend.id });
      if (readError) setError(readError.message);
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
      if (keyError) throw keyError;
      if (!key?.public_key) throw new Error("This friend must open the app once before secure messages can be sent.");
      const encrypted = await encryptMessage(draft.trim(), key.public_key);
      const { error: sendError } = await sb.rpc("send_encrypted_friend_message", {
        p_receiver: selected.id,
        p_ciphertext: encrypted.ciphertext,
        p_iv: encrypted.iv,
      });
      if (sendError) setError(sendError.message);
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
    <ProtectedPage>
      <main className="min-h-screen bg-[#fffdf7] p-5 pb-28">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[28px] border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821] md:grid-cols-[260px_1fr]">
          <aside className="border-b-2 border-slate-950 p-4 md:border-b-0 md:border-r-2">
            <p className="eyebrow">Messages</p>
            <h1 className="mt-1 text-2xl font-black">Your chats</h1>
            <div className="mt-4 flex gap-2 overflow-x-auto md:block md:space-y-2">
              {friends.map((friend) => (
                <button onClick={() => { setSelected(friend); setError(""); }} key={friend.id} className={`flex shrink-0 items-center gap-2 rounded-xl border-2 p-2 text-left ${selected?.id === friend.id ? "border-slate-950 bg-[#f0edff]" : "border-transparent hover:bg-slate-50"}`}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f4dc69] font-black">{friend.display_name[0]}</span>
                  <strong className="text-sm">{friend.display_name}</strong>
                </button>
              ))}
              {!friends.length && <p className="mt-5 text-sm text-slate-500">Add friends to start chatting.</p>}
            </div>
          </aside>
          <section className="flex min-h-[62vh] flex-col">
            <header className="border-b-2 border-slate-100 p-4 font-black">{selected ? selected.display_name : "Choose a friend"}</header>
            {error && <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!messages.length && selected && <p className="text-center text-sm text-slate-500">Messages are end-to-end encrypted.</p>}
              {messages.map((message) => {
                const own = message.sender_id === user?.id;
                const status = message.read_at ? "read" : message.delivered_at ? "delivered" : "sent";
                return (
                  <div key={message.id} className={`group flex max-w-[85%] items-end gap-2 ${own ? "ml-auto flex-row-reverse" : ""}`}>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${own ? "bg-[#7357ff] text-white" : "bg-slate-100"}`}>
                      {message.deletedForEveryone ? <em className="text-slate-400">Message deleted</em> : message.body}
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-violet-200" : "text-slate-400"}`}>
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {own && (status === "sent" ? <Check size={13} /> : <CheckCheck size={13} className={status === "read" ? "text-sky-300" : ""} />)}
                      </div>
                    </div>
                    {!message.deletedForEveryone && <button title="Delete for me" onClick={() => void deleteMessage(message, false)} className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"><Trash2 size={14} /></button>}
                    {own && !message.deletedForEveryone && <button title="Delete for everyone" onClick={() => void deleteMessage(message, true)} className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"><Trash2 size={14} /></button>}
                  </div>
                );
              })}
            </div>
            {selected && <div className="border-t-2 border-slate-100 p-3">
              <p className="mb-2 flex items-center gap-1 text-xs text-slate-400"><Lock size={12} /> End-to-end encrypted</p>
              <div className="flex gap-2">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void send()} placeholder="Type a message" className="flex-1 rounded-xl border-2 border-slate-950 px-3 py-2 outline-none" />
                <button disabled={sending} onClick={() => void send()} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white disabled:cursor-wait disabled:opacity-50"><Send size={16} /></button>
              </div>
            </div>}
          </section>
        </div>
      </main>
    </ProtectedPage>
  );
}
