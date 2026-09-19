"use client";

import { ArrowRight, Copy, LoaderCircle, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { games, type GameDefinition } from "@/features/games/registry";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "create" | "join" | null;

export function RoomLauncher({
  initialMode = null,
  initialGame = null,
  onClose,
}: {
  initialMode?: Mode;
  initialGame?: GameDefinition | null;
  onClose?: () => void;
}) {
  const [prevGame, setPrevGame] = useState<GameDefinition | null>(initialGame);
  const [prevMode, setPrevMode] = useState<Mode>(initialMode);
  const [mode, setMode] = useState<Mode>(initialMode || (initialGame ? "create" : null));
  const [selected, setSelected] = useState<GameDefinition>(initialGame || games[0]);
  const [max, setMax] = useState(initialGame ? initialGame.maxPlayers : 4);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Sync state when props change during render (avoids useEffect setState lint error)
  if (initialGame !== prevGame) {
    setPrevGame(initialGame);
    if (initialGame) {
      setSelected(initialGame);
      setMode("create");
      setMax(initialGame.maxPlayers);
    }
  } else if (initialMode !== prevMode) {
    setPrevMode(initialMode);
    if (initialMode) {
      setMode(initialMode);
    }
  }

  function close() {
    setMode(null);
    setError("");
    onClose?.();
  }

  async function create() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError("");

    const targetMax = selected.maxPlayers === 2 ? 2 : max;

    // 1. Attempt create via Supabase RPC
    const { data, error: rpcError } = await supabase.rpc("create_game_room", {
      p_game_type: selected.key,
      p_max_players: targetMax,
    });

    if (!rpcError && data) {
      router.push(`/room/${data}`);
      setBusy(false);
      return;
    }

    // 2. Fallback: Direct table creation if RPC constraint fails or is outdated
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError(rpcError?.message || "Sign in first");
        setBusy(false);
        return;
      }

      const randomCode = Array.from({ length: 5 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 30)]
      ).join("");

      const { data: newRoom, error: roomErr } = await supabase
        .from("game_rooms")
        .insert({
          code: randomCode,
          game_type: selected.key,
          host_id: userData.user.id,
          max_players: targetMax,
          status: "waiting",
          public_state: {},
        })
        .select("code, id")
        .single();

      if (roomErr || !newRoom) {
        setError(roomErr?.message || rpcError?.message || "Failed to create game room");
        setBusy(false);
        return;
      }

      await supabase.from("game_players").insert({
        room_id: newRoom.id,
        player_id: userData.user.id,
        seat: 1,
        is_ready: false,
      });

      router.push(`/room/${newRoom.code}`);
    } catch (err: any) {
      setError(err.message || rpcError?.message || "Could not create room");
    } finally {
      setBusy(false);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 5) {
      setError("Room codes have five characters.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError("");

    const { data, error } = await supabase.rpc("join_game_room", { p_code: cleaned });
    if (error) setError(error.message);
    else router.push(`/room/${data}`);
    setBusy(false);
  }

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setMode("join")} className="arcade-button bg-white">
          <Users size={17} /> Join room
        </button>
        <button
          onClick={() => setMode("create")}
          className="arcade-button bg-[#7357ff] text-white shadow-[4px_4px_0_#171821]"
        >
          <span className="text-lg">＋</span> Make a room
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/55 p-0 backdrop-blur-sm sm:place-items-center sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Create a room" : "Join a room"}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border-2 border-slate-950 bg-[#fffdf7] p-5 shadow-[8px_8px_0_#171821] sm:max-w-2xl sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow">{mode === "create" ? "New room" : "Got an invite?"}</p>
            <h2 className="mt-1 text-3xl font-black tracking-[-.04em]">
              {mode === "create" ? "Pick tonight’s game" : "Enter the room code"}
            </h2>
          </div>
          <button
            onClick={close}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border-2 border-slate-950 bg-white"
          >
            <X size={18} />
          </button>
        </div>

        {mode === "create" ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {games.map((game) => (
                <button
                  key={game.key}
                  onClick={() => {
                    setSelected(game);
                    setMax(game.maxPlayers === 2 ? 2 : Math.max(2, Math.min(max, game.maxPlayers)));
                  }}
                  className={`cursor-pointer rounded-2xl border-2 p-3 text-left transition ${
                    selected.key === game.key
                      ? "-translate-y-1 border-slate-950 shadow-[3px_3px_0_#171821]"
                      : "border-slate-200 bg-white hover:border-slate-400"
                  }`}
                  style={selected.key === game.key ? { backgroundColor: game.color } : undefined}
                >
                  <span className="text-3xl">{game.icon}</span>
                  <strong className="mt-2 block text-sm leading-tight">{game.shortName}</strong>
                  <span className="mt-1 block text-[11px] opacity-60">{game.players} players</span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-4 rounded-2xl border-2 border-slate-950 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong>{selected.name}</strong>
                <p className="mt-1 text-xs text-slate-500">{selected.description}</p>
              </div>

              {selected.maxPlayers > 2 && (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold">Room size</span>
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMax(n)}
                      className={`h-9 w-9 cursor-pointer rounded-full border-2 border-slate-950 text-sm font-black ${
                        max === n ? "bg-slate-950 text-white" : "bg-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={create}
              disabled={busy}
              className="arcade-button mt-5 w-full justify-center bg-slate-950 py-4 text-white"
            >
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />} Create room
            </button>
          </>
        ) : (
          <form onSubmit={join} className="mt-10">
            <label className="block text-sm font-black">Five-character code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 5))}
              autoFocus
              placeholder="AB72K"
              className="mt-3 w-full rounded-2xl border-2 border-slate-950 bg-white px-5 py-5 text-center font-mono text-4xl font-black uppercase tracking-[.32em] outline-none focus:shadow-[4px_4px_0_#7357ff]"
            />
            <button
              disabled={busy}
              className="arcade-button mt-5 w-full justify-center bg-[#7357ff] py-4 text-white shadow-[4px_4px_0_#171821]"
            >
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />} Join the room
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.readText().then((text) => setCode(text.trim().slice(0, 5)))}
              className="mx-auto mt-4 flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-500"
            >
              <Copy size={14} /> Paste from clipboard
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
