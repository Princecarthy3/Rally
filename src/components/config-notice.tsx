import { Settings2 } from "lucide-react";

export function ConfigNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "p-4" : "p-6"}`} role="status">
      <div className="flex gap-3">
        <Settings2 className="mt-0.5 shrink-0 text-amber-600" size={20} />
        <div><p className="font-bold">Connect Supabase to continue</p><p className="mt-1 text-sm leading-6 text-amber-800">Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then run the included <code>supabase/phase1.sql</code>.</p></div>
      </div>
    </div>
  );
}
