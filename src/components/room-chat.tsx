"use client";

import { MessageSquare, Pencil, Reply, Send, X } from "lucide-react";
import { FormEvent, TouchEvent, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sounds } from "@/lib/audio";
import type { RoomPlayer } from "@/features/rooms/types";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  replyToId?: string;
  replyToText?: string;
  replyToName?: string;
  edited?: boolean;
}

const QUICK_REACTIONS = ["GG! 🏆", "Nice move! 🔥", "Rematch? 🔄", "Haha 😂", "Lucky! 🍀"];

export function RoomChat({
  roomCode,
  userId,
  userName,
  players,
  onSelectPlayer,
}: {
  roomCode: string;
  userId: string;
  userName: string;
  players: RoomPlayer[];
  onSelectPlayer?: (pId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);
  const touchStartX = useRef<Record<string, number>>({});

  const isPlayer = players.some((p) => p.player_id === userId);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !roomCode || !isPlayer) return;

    const channel = supabase.channel(`room_chat_${roomCode.toLowerCase()}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.senderId !== userId) sounds.playMessageSound();
        if (!isOpen && msg.senderId !== userId) setUnread((u) => u + 1);
      })
      .on("broadcast", { event: "chat_edit" }, ({ payload }) => {
        const { id, text } = payload as { id: string; text: string };
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text, edited: true } : m))
        );
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, isOpen, userId, isPlayer]);

  useEffect(() => {
    if (isOpen) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages]);

  const toggleChat = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setUnread(0);
      return next;
    });
  };

  const sendMessage = (textToSend?: string) => {
    const content = (textToSend || input).trim();
    if (!content || !channelRef.current) return;
    sounds.playClickSound();

    if (editingId) {
      void channelRef.current.send({
        type: "broadcast",
        event: "chat_edit",
        payload: { id: editingId, text: content },
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, text: content, edited: true } : m))
      );
      setEditingId(null);
      setInput("");
      setReplyTo(null);
      return;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: userId,
      senderName: userName,
      text: content,
      timestamp,
      replyToId: replyTo?.id,
      replyToText: replyTo?.text,
      replyToName: replyTo?.senderName,
    };

    void channelRef.current.send({ type: "broadcast", event: "chat_message", payload: msg });
    setMessages((prev) => [...prev, msg]);
    setInput("");
    setReplyTo(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const onTouchStart = (id: string, e: TouchEvent) => {
    touchStartX.current[id] = e.touches[0]?.clientX ?? 0;
  };

  const onTouchEnd = (msg: ChatMessage, e: TouchEvent) => {
    const start = touchStartX.current[msg.id] ?? 0;
    const end = e.changedTouches[0]?.clientX ?? start;
    const dx = end - start;
    // Swipe right to reply
    if (dx > 56) {
      setReplyTo(msg);
      setEditingId(null);
      sounds.playClickSound();
    }
  };

  if (!isPlayer) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggleChat}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full border-2 border-slate-950 bg-[#7357ff] px-4 py-3 text-sm font-black text-white shadow-[4px_4px_0_#171821]"
      >
        <MessageSquare size={16} />
        Room Chat
        {unread > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black">
            {unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(70vh,480px)] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-3xl border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821]">
          <div className="flex items-center justify-between border-b-2 border-slate-950 bg-[#f0edff] px-4 py-3">
            <strong className="text-sm font-black">Room Chat</strong>
            <button type="button" onClick={toggleChat} className="rounded-full border-2 border-slate-950 bg-white p-1">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-slate-400">No messages yet. Say GG!</p>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === userId;
                const playerObj = players.find((p) => p.player_id === msg.senderId);
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    onTouchStart={(e) => onTouchStart(msg.id, e)}
                    onTouchEnd={(e) => onTouchEnd(msg, e)}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPlayer?.(msg.senderId)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:underline"
                    >
                      <span>{playerObj?.profile?.display_name || msg.senderName}</span>
                      <span>· {msg.timestamp}</span>
                      {msg.edited && <span className="text-slate-400">(edited)</span>}
                    </button>
                    {msg.replyToText && (
                      <div className="mt-1 max-w-[85%] rounded-xl border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
                        ↩ {msg.replyToName}: {msg.replyToText.slice(0, 80)}
                      </div>
                    )}
                    <div
                      className={`mt-1 max-w-[85%] rounded-2xl border-2 border-slate-950 px-3.5 py-2 text-xs font-bold ${
                        isMe
                          ? "bg-[#7357ff] text-white shadow-[2px_2px_0_#171821]"
                          : "bg-[#fff8dd] text-slate-950 shadow-[2px_2px_0_#171821]"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(msg);
                          setEditingId(null);
                        }}
                        className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-900"
                      >
                        <Reply size={12} /> Reply
                      </button>
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(msg.id);
                            setInput(msg.text);
                            setReplyTo(null);
                          }}
                          className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-900"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 bg-slate-50 px-3 py-2">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => sendMessage(reaction)}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700"
              >
                {reaction}
              </button>
            ))}
          </div>

          {(replyTo || editingId) && (
            <div className="flex items-center gap-2 border-t border-slate-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-slate-700">
              <span className="min-w-0 flex-1 truncate">
                {editingId ? "Editing message…" : `Replying to ${replyTo?.senderName}: ${replyTo?.text}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  setEditingId(null);
                  setInput("");
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 border-t-2 border-slate-950 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={editingId ? "Edit message…" : replyTo ? "Write a reply…" : "Send message…"}
              maxLength={120}
              className="min-w-0 flex-1 rounded-full border-2 border-slate-950 px-3.5 py-2 text-xs font-bold outline-none"
            />
            <button type="submit" className="arcade-button bg-slate-950 px-3 py-2 text-white">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
