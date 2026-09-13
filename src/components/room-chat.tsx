"use client";

import { MessageSquare, Send, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { sounds } from "@/lib/audio";
import type { RoomPlayer } from "@/features/rooms/types";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

const QUICK_REACTIONS = ["GG! 🏆", "Nice move! 🔥", "Rematch? 🔄", "Haha 😂", "Lucky! 🍀"];

export function RoomChat({
  roomCode,
  userId,
  userName,
  players,
}: {
  roomCode: string;
  userId: string;
  userName: string;
  players: RoomPlayer[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !roomCode) return;

    const channel = supabase.channel(`room_chat_${roomCode.toLowerCase()}`, {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        const msg = payload as ChatMessage;
        setMessages((prev) => [...prev, msg]);
        if (!isOpen && msg.senderId !== userId) {
          setUnread((prev) => prev + 1);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, isOpen, userId]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages]);

  const sendMessage = (textToSend?: string) => {
    const content = (textToSend || input).trim();
    if (!content || !channelRef.current) return;

    sounds.playClickSound();

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      senderId: userId,
      senderName: userName,
      text: content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    channelRef.current.send({
      type: "broadcast",
      event: "chat_message",
      payload: newMsg,
    });

    if (!textToSend) {
      setInput("");
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open room chat"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border-2 border-slate-950 bg-[#7357ff] px-4 py-3 text-xs font-black text-white shadow-[4px_4px_0_#171821] transition hover:-translate-y-1 md:bottom-6 md:right-6"
      >
        <MessageSquare size={16} />
        <span>Room Chat</span>
        {unread > 0 && (
          <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-slate-950 bg-[#ff9eaa] text-[10px] font-black text-slate-950">
            {unread}
          </span>
        )}
      </button>

      {/* Chat Drawer Panel */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 z-50 flex h-96 w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border-2 border-slate-950 bg-white shadow-[6px_6px_0_#171821] md:bottom-20 md:right-6">
          {/* Header */}
          <header className="flex items-center justify-between border-b-2 border-slate-950 bg-[#f4dc69] px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-slate-950" />
              <strong className="text-xs font-black uppercase tracking-wider text-slate-950">Live Room Chat</strong>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="grid h-7 w-7 place-items-center rounded-full border border-slate-950 bg-white text-slate-950 hover:bg-slate-100"
            >
              <X size={14} />
            </button>
          </header>

          {/* Messages List */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <p className="text-2xl">💬</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">Say hello to your opponents!</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === userId;
                const playerObj = players.find((p) => p.player_id === msg.senderId);
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <span>{playerObj?.profile?.display_name || msg.senderName}</span>
                      <span>· {msg.timestamp}</span>
                    </div>
                    <div
                      className={`mt-1 max-w-[85%] rounded-2xl border-2 border-slate-950 px-3.5 py-2 text-xs font-bold ${
                        isMe
                          ? "bg-[#7357ff] text-white shadow-[2px_2px_0_#171821]"
                          : "bg-[#fff8dd] text-slate-950 shadow-[2px_2px_0_#171821]"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Reaction Chips */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 bg-slate-50 px-3 py-2">
            {QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                onClick={() => sendMessage(reaction)}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-slate-950 hover:bg-slate-100"
              >
                {reaction}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2 border-t-2 border-slate-950 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send message..."
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
