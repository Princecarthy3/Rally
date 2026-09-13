"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { ConfigNotice } from "./config-notice";
import { SiteHeader } from "./site-header";

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { configured, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => { if (configured && !loading && !user) router.replace("/auth?mode=login"); }, [configured, loading, router, user]);

  if (!configured) return <main className="grid min-h-screen place-items-center px-5"><div className="w-full max-w-lg"><ConfigNotice /></div></main>;
  if (loading || !user) return <main className="grid min-h-screen place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-violet-600" /><p className="mt-3 text-sm font-medium text-slate-500">Loading your Rally…</p></div></main>;
  return <><SiteHeader />{children}</>;
}
