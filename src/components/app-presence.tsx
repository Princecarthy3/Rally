"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const PresenceContext = createContext<Set<string>>(new Set());

export function AppPresence({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const channel = supabase.channel("rally-social", { config: { presence: { key: user.id } } });
    channel.on("presence", { event: "sync" }, () => setOnlineIds(new Set(Object.keys(channel.presenceState()))));
    channel.subscribe(async (state) => {
      if (state === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(channel); };
  }, [user]);
  const value = useMemo(() => onlineIds, [onlineIds]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function useSocialPresence() { return useContext(PresenceContext); }
