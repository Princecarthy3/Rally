"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AppPresence() {
  const { user } = useAuth();
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user) return;
    const channel = supabase.channel("rally-social", { config: { presence: { key: user.id } } });
    channel.subscribe(async (state) => {
      if (state === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
    });
    return () => { supabase.removeChannel(channel); };
  }, [user]);
  return null;
}
