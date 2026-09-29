"use client";

import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { ArrowLeft, Check, LoaderCircle, RotateCcw, Shield, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/customization/user-avatar";

type ChessGameState = NonNullable<Room["public_state"]["chess"]>;
const glyphs: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};
const promotionPieces: Array<{ type: PieceSymbol; name: string; glyph: string }> = [
  { type: "q", name: "Queen", glyph: "♕" }, { type: "r", name: "Rook", glyph: "♖" },
  { type: "b", name: "Bishop", glyph: "♗" }, { type: "n", name: "Knight", glyph: "♘" },
];

export function ChessGame({ room, players, userId, onlineIds, isSpectator = false, refresh }: {
  room: Room; players: RoomPlayer[]; userId: string; onlineIds: string[]; isSpectator?: boolean; refresh: () => Promise<void>;
}) {
  const [game, setGame] = useState<ChessGameState | null>(null);
  const [selection, setSelection] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    try {
      const response = await fetch(`/api/games/chess?roomId=${encodeURIComponent(room.id)}`, {
        headers: { authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const payload = await response.json() as { game?: ChessGameState; error?: string };
      if (!response.ok || !payload.game) { setLoadError(payload.error || "Could not load the current Chess position."); return; }
      setGame((current) => !current || current.matchId !== payload.game!.matchId || payload.game!.revision >= current.revision ? payload.game! : current);
      setLoadError("");
    } catch { setLoadError("Connection interrupted. Trying to reload the latest position…"); }
  }, [room.id]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load, room.state_version]);
  useEffect(() => {
    const timer = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const chess = useMemo(() => {
    if (!game) return null;
    try { return new Chess(game.fen); } catch { return null; }
  }, [game]);
  const white = players.find((player) => player.player_id === game?.whitePlayerId);
  const black = players.find((player) => player.player_id === game?.blackPlayerId);
  const myColor = game?.whitePlayerId === userId ? "w" : game?.blackPlayerId === userId ? "b" : null;
  const myTurn = Boolean(game && myColor && myColor === game.turn && game.status === "active");
  const whiteTurn = game?.turn === "w";
  const activePlayer = whiteTurn ? white : black;
  const drawOfferedByOpponent = Boolean(game?.drawOfferedBy && game.drawOfferedBy !== userId);

  async function act(action: string, extra: { from?: Square; to?: Square; promotion?: PieceSymbol } = {}) {
    if (!game || pending || isSpectator || !myColor) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Chess is temporarily unavailable."); return; }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setError("Sign in again to continue playing."); return; }
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/games/chess", {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId: room.id, matchId: game.matchId, expectedRevision: game.revision, action, ...extra }),
      });
      const payload = await response.json() as { game?: ChessGameState; error?: string };
      if (!response.ok || !payload.game) {
        setError(payload.error || "Chess could not save that action.");
        await load();
      } else {
        setGame(payload.game); setSelection(null); setPromotion(null); setNotice("Move saved and shared.");
        await refresh();
      }
    } catch { setError("Connection interrupted. Reloading the current board…"); await load(); }
    finally { setPending(false); }
  }

  function selectSquare(square: Square) {
    if (!chess || !myTurn || pending || isSpectator) return;
    if (selection) {
      const candidate = chess.moves({ square: selection, verbose: true }).find((move: Move) => move.to === square);
      if (candidate) {
        if (candidate.isPromotion()) setPromotion({ from: selection, to: square });
        else void act("move", { from: selection, to: square });
        return;
      }
    }
    if (chess.get(square)?.color === myColor) setSelection(square);
    else setSelection(null);
  }

  async function rematch() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || room.host_id !== userId || pending) return;
    setPending(true); setError("");
    const { error: rematchError } = await supabase.rpc("rematch_room", { p_room: room.id });
    if (rematchError) setError(rematchError.message);
    else { setGame(null); await refresh(); }
    setPending(false);
  }

  const legalMoves = useMemo(() => selection && chess ? chess.moves({ square: selection, verbose: true }).map((move: Move) => move.to) : [], [selection, chess]);
  const checkedKing = useMemo(() => {
    if (!chess || !game?.inCheck) return null;
    const side = chess.turn();
    return chess.findPiece({ type: "k", color: side })[0] || null;
  }, [chess, game?.inCheck]);
  const squares = chess ? chess.board().flat().map((piece, i) => ({
    piece, square: `${String.fromCharCode(97 + (i % 8))}${8 - Math.floor(i / 8)}` as Square,
  })) : [];
  const orientedSquares = myColor === "b" ? [...squares].reverse() : squares;

  if (!game || !chess) return <section className="paper-card mx-auto max-w-4xl p-8 text-center"><LoaderCircle className="mx-auto animate-spin text-violet-600" /><p className="mt-3 font-bold">{loadError || "Loading the official Chess position…"}</p><button onClick={() => void load()} className="mt-4 rounded-full bg-violet-600 px-5 py-2 font-bold text-white">Retry</button></section>;

  const ended = game.status !== "active";
  const winnerName = game.winnerPlayerId === game.whitePlayerId ? "White" : game.winnerPlayerId === game.blackPlayerId ? "Black" : null;
  const statusText = ended
    ? game.status === "resigned"
      ? game.winnerPlayerId === userId ? "You resigned" : "Opponent resigned"
      : winnerName ? `${winnerName} wins · ${game.resultReason || "Checkmate"}` : (game.resultReason || "Draw")
    : game.inCheck ? `${whiteTurn ? "White" : "Black"} is in check` : `${activePlayer?.profile?.display_name || (whiteTurn ? "White" : "Black")}'s turn`;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="paper-card overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b-2 border-slate-950 bg-violet-100 px-4 py-4 sm:px-6">
          <div><p className="eyebrow">Rally · Strategy</p><h1 className="text-2xl font-black">Chess</h1></div>
          <Link href="/games" className="inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-white px-3 py-2 text-xs font-black"><ArrowLeft size={15} /> All games</Link>
        </header>
        <div className="p-3 sm:p-6">
          <div className="mb-3 flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-white p-3">
            <PlayerChip player={black} color="Black" active={!whiteTurn && !ended} connected={Boolean(black && onlineIds.includes(black.player_id))} mine={black?.player_id === userId} />
            <span className="text-xs font-black text-slate-400">VS</span>
            <PlayerChip player={white} color="White" active={whiteTurn && !ended} connected={Boolean(white && onlineIds.includes(white.player_id))} mine={white?.player_id === userId} />
          </div>
          <div className="mx-auto grid w-full max-w-[min(78vh,680px)] grid-cols-8 overflow-hidden rounded-xl border-2 border-slate-950 shadow-[4px_4px_0_#171821]" role="grid" aria-label={`Chess board. ${statusText}`}>
            {orientedSquares.map(({ piece, square }, index) => {
              const squareColor = (square.charCodeAt(0) - 97 + Number(square[1])) % 2 === 0 ? "bg-[#eee7d7]" : "bg-[#7357ff]";
              const isSelected = selection === square;
              const isLegal = legalMoves.includes(square);
              const isLast = game.lastMove?.from === square || game.lastMove?.to === square;
              const isCheck = checkedKing === square;
              const rank = myColor === "b" ? Math.floor(index / 8) + 1 : 8 - Math.floor(index / 8);
              const file = myColor === "b" ? String.fromCharCode(104 - (index % 8)) : String.fromCharCode(97 + (index % 8));
              return <button key={square} role="gridcell" aria-label={`${file}${rank}${piece ? ` ${piece.color === "w" ? "White" : "Black"} ${piece.type === "n" ? "knight" : ({ p: "pawn", r: "rook", b: "bishop", q: "queen", k: "king" } as Record<string, string>)[piece.type]}` : " empty"}${isLegal ? ", legal destination" : ""}${isCheck ? ", king in check" : ""}`} onClick={() => selectSquare(square)} disabled={!myTurn || pending || isSpectator} className={`relative grid aspect-square place-items-center text-[clamp(1.65rem,8vw,4.5rem)] leading-none transition focus-visible:z-10 focus-visible:outline-4 focus-visible:outline-yellow-300 ${squareColor} ${isLast ? "ring-inset ring-4 ring-amber-300/80" : ""} ${isSelected ? "!bg-yellow-300" : ""} ${isCheck ? "!bg-rose-400" : ""} disabled:cursor-default`}>
                {piece && <span className={piece.color === "w" ? "text-white drop-shadow-[0_2px_2px_rgba(15,23,42,.9)]" : "text-slate-950 drop-shadow-[0_1px_0_rgba(255,255,255,.7)]"}>{glyphs[`${piece.color}${piece.type}`]}</span>}
                {isLegal && <span aria-hidden="true" className={`absolute h-[24%] w-[24%] rounded-full ${piece ? "border-[5px] border-rose-500/75" : "bg-slate-950/25"}`} />}
                {index % 8 === 0 && <span className="absolute left-1 top-0.5 text-[9px] font-black opacity-50">{rank}</span>}
                {Math.floor(index / 8) === 7 && <span className="absolute bottom-0 right-1 text-[9px] font-black opacity-50">{file}</span>}
              </button>;
            })}
          </div>
          <p aria-live="polite" className={`mt-4 text-center text-sm font-black ${ended ? "text-violet-800" : game.inCheck ? "text-rose-700" : "text-slate-700"}`}>{ended ? `Game over · ${statusText}` : statusText}</p>
          {loadError && <p role="status" className="mt-2 text-center text-xs font-bold text-amber-700">{loadError}</p>}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="paper-card p-4">
          <div className="flex items-center justify-between"><h2 className="font-black">Move history</h2><span className="text-xs font-bold text-slate-500">{game.moves.length} plies</span></div>
          <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm font-mono" aria-label="Move history">
            {game.moves.length ? Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, index) => <div key={index} className="grid grid-cols-[32px_1fr_1fr] gap-2"><span className="text-slate-400">{index + 1}.</span><span>{game.moves[index * 2]?.san || ""}</span><span>{game.moves[index * 2 + 1]?.san || ""}</span></div>) : <p className="text-xs font-sans text-slate-500">The opening position · White moves first.</p>}
          </div>
        </section>
        <section className="paper-card space-y-2 p-4">
          {game.drawOfferedBy && <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-bold text-violet-900">{drawOfferedByOpponent ? "Your opponent offered a draw." : "Draw offer sent. Waiting for your opponent."}</div>}
          {drawOfferedByOpponent && !ended && !isSpectator && <div className="grid grid-cols-2 gap-2"><button disabled={pending} onClick={() => void act("accept_draw")} className="arcade-button justify-center bg-emerald-300 text-xs">Accept draw</button><button disabled={pending} onClick={() => void act("decline_draw")} className="arcade-button justify-center bg-white text-xs">Decline</button></div>}
          {!ended && !game.drawOfferedBy && <button disabled={isSpectator || pending} onClick={() => void act("offer_draw")} className="arcade-button w-full justify-center bg-white text-sm"><Check size={16} /> Offer draw</button>}
          {!ended && !isSpectator && <button disabled={pending} onClick={() => { if (window.confirm("Resign this game?")) void act("resign"); }} className="arcade-button w-full justify-center bg-rose-100 text-sm">Resign</button>}
          {ended && room.host_id === userId && <button disabled={pending} onClick={() => void rematch()} className="arcade-button w-full justify-center bg-yellow-300 text-sm"><RotateCcw size={16} /> Rematch</button>}
          {ended && room.host_id !== userId && <p className="text-center text-xs font-bold text-slate-500">Waiting for the host to start a rematch.</p>}
          <Link href="/dashboard" className="arcade-button w-full justify-center bg-slate-950 text-sm text-white"><ArrowLeft size={16} /> Return to the arcade</Link>
        </section>
        <section className="paper-card p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-600">{pending ? <LoaderCircle className="animate-spin" size={15} /> : game.status !== "active" ? <Shield size={15} /> : activePlayer && onlineIds.includes(activePlayer.player_id) ? <Wifi size={15} className="text-emerald-600" /> : <WifiOff size={15} className="text-amber-600" />}{pending ? "Saving the official move…" : game.status !== "active" ? "This game has ended." : activePlayer && onlineIds.includes(activePlayer.player_id) ? "Current player connected" : "Current player reconnecting"}</div></section>
        {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border-2 px-4 py-3 text-sm font-bold ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error || notice}</p>}
      </aside>

      {promotion && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><section className="paper-card w-full max-w-sm p-5 text-center"><h2 id="promotion-title" className="text-xl font-black">Promote your pawn</h2><p className="mt-1 text-sm text-slate-600">Choose the piece for {promotion.to}.</p><div className="mt-4 grid grid-cols-4 gap-2">{promotionPieces.map((piece) => <button key={piece.type} onClick={() => void act("move", { ...promotion, promotion: piece.type })} disabled={pending} aria-label={`Promote to ${piece.name}`} className="rounded-xl border-2 border-slate-950 bg-violet-50 p-3 text-4xl text-slate-950 hover:bg-violet-200">{myColor === "b" ? ({ q: "♛", r: "♜", b: "♝", n: "♞" } as Record<string, string>)[piece.type] : piece.glyph}</button>)}</div><button onClick={() => setPromotion(null)} className="mt-4 text-sm font-bold text-slate-500 underline">Cancel</button></section></div>}
    </div>
  );
}

function PlayerChip({ player, color, active, connected, mine }: { player?: RoomPlayer; color: "White" | "Black"; active: boolean; connected: boolean; mine: boolean }) {
  return <div className={`flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 ${active ? "bg-violet-100 ring-2 ring-violet-500" : ""}`}>
    <UserAvatar avatarUrl={player?.profile?.avatar_url} equippedAvatar={player?.customization?.avatar} equippedFrame={player?.customization?.frame} fallbackName={player?.profile?.display_name} size="sm" />
    <div className="min-w-0"><p className="truncate text-xs font-black">{player?.profile?.display_name || `${color} player`}{mine ? " (you)" : ""}</p><p className="text-[10px] font-bold text-slate-500">{color}{active ? " · to move" : ""}{player ? connected ? " · online" : " · reconnecting" : " · waiting"}</p></div>
  </div>;
}
