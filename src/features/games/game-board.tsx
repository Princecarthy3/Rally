"use client";

import { LoaderCircle, Lock, RotateCcw, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomPlayer } from "@/features/rooms/types";
import { gameByKey } from "./registry";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { NumberGuessGame } from "./number-guess-game";
import { DotsBoxes } from "./dots-boxes";
import { SkribblGame } from "./skribbl-game";
import { LudoGame } from "./ludo-game";
import { ConnectFour } from "./connect-four";
import { MemoryMatch } from "./memory-match";
import { MiniGolf } from "./mini-golf";
import { Battleship } from "./battleship";
import { UnoGame } from "./uno-game";
// pong removed

import { sounds } from "@/lib/audio";


const colors = ["#ff9eaa", "#77dce7", "#f4dc69", "#8de2bd"];
const isBotId = (id: string) => id.startsWith("11111111-1111-1111-1111-");

export function GameBoard({
  room,
  players,
  userId,
  onlineIds,
  refresh,
  applyPublicState,
  isSpectator = false,
}: {
  room: Room;
  players: RoomPlayer[];
  userId: string;
  onlineIds: string[];
  refresh: () => Promise<void>;
  applyPublicState?: (publicState: Room["public_state"], extras?: Partial<Room>) => void;
  isSpectator?: boolean;
}) {
  const me = players.find((p) => p.player_id === userId);
  const state = room.public_state || {};
  const game = gameByKey[room.game_type];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guess, setGuess] = useState("");
  // A room update can reach several clients at once. Keep each bot/state pair to
  // one request so a slow response cannot make the bot play twice.
  const pendingBotMoves = useRef(new Set<string>());

  // Game-specific BGM for this room; restore lobby theme when leaving the board.
  useEffect(() => {
    sounds.startGameBgm(room.game_type);
    return () => {
      sounds.startLobbyBgm();
    };
  }, [room.game_type, room.id]);



  async function act(action: string, value?: string) {
    if (busy || isSpectator) return;
    // Browsers only permit AudioContext playback after a real user gesture.
    // Starting here makes the music begin with the player's first game action.
    sounds.startGameBgm(room.game_type);
    sounds.playClickSound();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const rpc = room.game_type === "uno" ? "play_uno_action" : room.game_type === "ludo" ? "play_ludo_action" : room.game_type === "rps" ? "play_rps_action" : room.game_type === "number_guess" ? "play_number_hunt_action" : room.game_type === "memory_match" ? "play_memory_match_action" : room.game_type === "mini_golf" ? "play_mini_golf_action" : room.game_type === "battleship" ? "play_battleship_action" : room.game_type === "skribbl" ? "play_skribbl_action" : "play_room_action";
    const params = { p_room: room.id, p_action: action, p_value: value ?? null };
    const { data, error } = await supabase.rpc(rpc, params);
    if (error) {
      setError(error.message);
    } else {
      // Apply the authoritative state returned by the RPC immediately so the
      // acting client never depends on Realtime delivery or a follow-up SELECT.
      if (data && typeof data === "object" && applyPublicState) {
        const payload = data as Record<string, unknown>;
        const nextState = (payload.public_state && typeof payload.public_state === "object"
          ? payload.public_state
          : payload) as Room["public_state"];
        const extras: Partial<Room> = {};
        if (typeof payload.status === "string") {
          extras.status = payload.status as Room["status"];
        }
        applyPublicState(nextState, extras);
      }
      await refresh();
    }
    setBusy(false);
  }

  const scores = state.scores || {};
  const winningSeats = useMemo(() => deriveWinners(room, players), [room, players]);

  useEffect(() => {
    if (room.status !== "playing") return;
    const botPlayers = players.filter((p) => isBotId(p.player_id));
    if (botPlayers.length === 0) return;

    const s = (room.public_state || {}) as Record<string, any>;
    const turn = Number(s.turn);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const scheduledKeys: string[] = [];

    botPlayers.forEach((botPlayer) => {
      const botSeat = Number(botPlayer.seat);
      let isBotTurn = false;

      if (["tic_tac_toe", "connect_four", "dots_boxes", "ludo"].includes(room.game_type)) {
        isBotTurn = turn === botSeat;
        if (room.game_type === "ludo" && s.awaitingMove && turn === botSeat) isBotTurn = true;
      } else if (room.game_type === "number_guess") {
        const pickerSeat = Number(s.pickerSeat ?? 1);
        const targetPicked = Boolean(s.targetPicked);
        const guesses = s.guesses || {};
        const hasGuessed = Object.prototype.hasOwnProperty.call(guesses, String(botSeat));
        if (pickerSeat === botSeat && !targetPicked) isBotTurn = true;
        if (pickerSeat !== botSeat && targetPicked && !hasGuessed) isBotTurn = true;
      } else if (room.game_type === "rps") {
        isBotTurn = !s.choices?.[String(botSeat)] && !s.choices?.[botSeat];
      } else if (room.game_type === "skribbl") {
        const drawerSeat = Number(s.drawerSeat);
        const guessed = (s.guessedSeats || []).map((n: unknown) => Number(n));
        if (drawerSeat === botSeat && !s.wordSelected) isBotTurn = true;
        if (drawerSeat !== botSeat && s.wordSelected && !guessed.includes(botSeat)) isBotTurn = true;
      } else if (room.game_type === "memory_match") {
        isBotTurn = turn === botSeat;
      } else if (room.game_type === "mini_golf") {
        isBotTurn =
          turn === botSeat &&
          Boolean(s.balls?.[String(botSeat)]) &&
          !s.balls?.[String(botSeat)]?.finished;
      } else if (room.game_type === "uno") {
        isBotTurn = turn === botSeat || (s.challenge && Number(s.challenge.challengerSeat) === botSeat) || (s.unoVulnerableSeat && Number(s.unoVulnerableSeat) !== botSeat);
      }

      if (!isBotTurn) return;

      // Key by room + turn + seat (not state_version) so a cancelled timer can be rescheduled
      // after applyPublicState/refresh re-renders without getting stuck.
      const requestKey = `${room.id}:turn:${turn}:bot:${botSeat}`;
      if (pendingBotMoves.current.has(requestKey)) return;

      scheduledKeys.push(requestKey);

      const timer = setTimeout(() => {
        // Mark in-flight only when the request actually starts
        if (pendingBotMoves.current.has(requestKey)) return;
        pendingBotMoves.current.add(requestKey);

        fetch("/api/ai/bot-move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: room.id,
            gameType: room.game_type,
            publicState: room.public_state,
            botSeat,
            difficulty:
              (typeof window !== "undefined" &&
                localStorage.getItem(`rally_bot_difficulty_${room.id}`)) ||
              "medium",
          }),
        })
          .then(async (response) => {
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw body;
            if (body?.newState && typeof body.newState === "object" && applyPublicState) {
              const payload = body.newState as Record<string, unknown>;
              const nextState = (
                payload.public_state && typeof payload.public_state === "object"
                  ? payload.public_state
                  : payload
              ) as Room["public_state"];
              applyPublicState(nextState);
            }
            await refresh();
          })
          .catch((reason) => console.error("Bot move failed", reason))
          .finally(() => {
            pendingBotMoves.current.delete(requestKey);
          });
      }, 700);

      timers.push(timer);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
      // Do not leave pending locks for timers that never started
      scheduledKeys.forEach((key) => {
        // Only clear if fetch has not started yet — in-flight keys stay until finally()
        // Actually: if we cleared the timeout, fetch never started, so always safe to delete
        // unless fetch already began (timeout fired). Once fired, key is in pending and
        // timeout already ran — clearTimeout is a no-op. Safe to only delete keys whose
        // timeout was still pending: we track that by not having started fetch.
        // Simplest correct approach: never add to pending until fetch starts (done above),
        // so cleanup only clears timeouts and never leaves a stuck lock.
      });
    };
  }, [
    room.status,
    room.id,
    room.game_type,
    room.public_state,
    room.state_version,
    players,
    refresh,
    applyPublicState,
  ]);

  if (room.status === "completed") {
    return <Result room={room} players={players} me={me} winningSeats={winningSeats} refresh={refresh} />;
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`min-w-35 rounded-2xl border-2 border-slate-950 p-3 ${
              state.turn === player.seat ? "shadow-[4px_4px_0_#171821]" : ""
            }`}
            style={{ backgroundColor: colors[player.seat - 1] }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  onlineIds.includes(player.player_id) || isBotId(player.player_id) ? "bg-emerald-600" : "bg-slate-400"
                }`}
              />
              <strong className="truncate text-xs">
                {player.profile?.display_name || `Player ${player.seat}`}
                {player.player_id === userId ? " (you)" : ""}
                {isBotId(player.player_id) ? " (AI)" : ""}
              </strong>
            </div>
            <p className="mt-2 text-xl font-black">
              {state.scores ? `${scores[player.seat] || 0} pts` : `P${player.seat}`}
            </p>

          </div>
        ))}
      </div>

      <section className="paper-card overflow-hidden">
        <header
          className="flex items-center justify-between border-b-2 border-slate-950 px-5 py-4"
          style={{ backgroundColor: game.color }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{game.icon}</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {game.name}
              </p>
              <h2 className="font-black">{state.message || "Game on!"}</h2>
            </div>
          </div>
          {busy && <LoaderCircle className="animate-spin" size={20} />}
        </header>

        <div className="min-h-[430px] p-5 sm:p-8">
          {room.game_type === "rps" && (
            <RPS state={state} mySeat={me?.seat} choose={(v) => act("choose", v)} busy={busy} act={act} />
          )}
          {room.game_type === "number_guess" && (
            <NumberGuessGame
              room={room}
              players={players}
              meSeat={me?.seat || 1}
              isMyTurn={state.turn === me?.seat}
              onAct={act}
              busy={busy}
            />
          )}
          {room.game_type === "memory_match" && (
            <MemoryMatch room={room} players={players} meSeat={me?.seat || 1} onAct={act} busy={busy} isHost={room.host_id === userId} />
          )}
          {room.game_type === "mini_golf" && (
            <MiniGolf room={room} players={players} meSeat={me?.seat || 1} onAct={act} busy={busy} />
          )}
          {room.game_type === "battleship" && (
            <Battleship room={room} players={players} meSeat={me?.seat || 1} onAct={act} busy={busy} />
          )}
          {room.game_type === "tic_tac_toe" && (
            <TicTacToe state={state} mySeat={me?.seat} place={(i) => act("place", String(i))} busy={busy} />
          )}
          {room.game_type === "connect_four" && (
            <ConnectFour state={state} mySeat={me?.seat} act={act} busy={busy} />
          )}
          {room.game_type === "dots_boxes" && (
            <DotsBoxes state={state} mySeat={me?.seat} act={act} busy={busy} players={players} isHost={room.host_id === me?.player_id} />
          )}
          {room.game_type === "skribbl" && (
            <SkribblGame room={room} players={players} userId={userId} act={act} busy={busy} />
          )}
          {room.game_type === "ludo" && (
            <LudoGame state={state} players={players} mySeat={me?.seat} busy={busy} act={act} />
          )}
          {room.game_type === "uno" && (
            <UnoGame room={room} players={players} meSeat={me?.seat || 1} isMyTurn={state.turn === me?.seat} onAct={act} />
          )}
        </div>

        {error && (
          <p role="alert" className="border-t-2 border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function Basketball({ state, mySeat, busy, shoot }: { state: Room["public_state"]; mySeat?: number; busy: boolean; shoot: () => void }) {
  const mine = state.turn === mySeat;
  return (
    <div className="text-center">
      <div className="relative mx-auto h-64 max-w-xl overflow-hidden rounded-[28px] border-2 border-slate-950 bg-[#de945c]">
        <div className="absolute inset-x-0 top-0 h-28 bg-[#8ddcf0]" />
        <div className="absolute left-1/2 top-12 h-24 w-3 -translate-x-1/2 bg-slate-700" />
        <div className="absolute left-1/2 top-20 h-3 w-28 -translate-x-1/2 border-2 border-red-700 bg-white" />
        <div className="absolute left-1/2 top-24 h-12 w-20 -translate-x-1/2 rounded-b-full border-x-4 border-b-4 border-red-600" />
        <span className={`absolute bottom-7 left-1/2 -translate-x-1/2 text-6xl transition ${busy ? "-translate-y-36 scale-75 rotate-180" : ""}`}>🏀</span>
        <div className="absolute inset-x-0 bottom-0 h-3 bg-[#80502e]" />
      </div>
      <p className="mt-5 text-sm font-bold">Shot {Math.min(5, (state.shots?.[String(mySeat)] || 0) + 1)} of 5</p>
      <button onClick={shoot} disabled={!mine || busy} className="arcade-button mt-4 bg-[#ffb563] px-8 py-4 shadow-[4px_4px_0_#171821]">
        {mine ? "HOLD & SHOOT" : "WATCH THEIR SHOT"}
      </button>
    </div>
  );
}

function RPS({
  state,
  mySeat,
  choose,
  busy,
  act,
}: {
  state: Room["public_state"];
  mySeat?: number;
  choose: (v: string) => void;
  busy: boolean;
  act: (action: string, value?: string) => Promise<void>;
}) {
  const curRound = (state.round as number) || 1;
  const locked = Boolean(mySeat && state.choices?.[mySeat]);
  const revealed = Boolean(state.revealed);
  const choices = (state.choices || {}) as Record<string, string>;
  const history = (state.history || []) as Array<{
    round: number;
    winnerSeat: number | null;
    message: string;
  }>;

  const icons: Record<string, string> = {
    rock: "✊",
    paper: "📄",
    scissors: "✂️",
  };

  return (
    <div className="mx-auto max-w-xl text-center space-y-6">
      {/* Round Header */}
      <div className="flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-slate-900 px-5 py-3 text-white shadow-[4px_4px_0_#171821]">
        <div className="text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
            ROCK PAPER SCISSORS
          </span>
          <h3 className="text-lg font-black uppercase">Round {curRound} of 3</h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold opacity-60">STATUS</span>
          <p className="text-xs font-black text-amber-300">
            {revealed ? "ROUND ENDED" : locked ? "CHOICE SEALED" : "YOUR TURN"}
          </p>
        </div>
      </div>

      {/* Choice Buttons */}
      {!revealed && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ["rock", "✊", "ROCK"],
            ["paper", "📄", "PAPER"],
            ["scissors", "✂️", "SCISSORS"],
          ].map(([value, icon, label]) => (
            <button
              key={value}
              disabled={locked || busy}
              onClick={() => choose(value)}
              className={`group cursor-pointer rounded-[24px] border-2 border-slate-950 p-4 shadow-[3px_3px_0_#171821] transition hover:-translate-y-2 disabled:cursor-not-allowed ${
                choices[mySeat?.toString() || ""] === value
                  ? "bg-amber-300 ring-4 ring-amber-500 scale-105"
                  : "bg-[#f0edff] disabled:opacity-40"
              }`}
            >
              <span className="block text-5xl sm:text-7xl group-hover:scale-110">{icon}</span>
              <strong className="mt-3 block text-xs">{label}</strong>
            </button>
          ))}
        </div>
      )}

      {/* Waiting Indicator */}
      {locked && !revealed && (
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border-2 border-slate-950 bg-[#f4dc69] px-6 py-2.5 text-sm font-black animate-pulse">
          <Lock size={16} /> Choice sealed! Waiting for opponent...
        </div>
      )}

      {/* Revealed Round Cards */}
      {revealed && (
        <div className="rounded-3xl border-4 border-slate-950 bg-amber-50 p-6 shadow-[6px_6px_0_#171821] space-y-4">
          <h4 className="text-sm font-black uppercase text-slate-700">Round {curRound} Revealed!</h4>
          <div className="flex justify-center items-center gap-6">
            <div className="rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[3px_3px_0_#171821] text-center min-w-28">
              <span className="text-4xl">{icons[choices["1"] || ""] || "❓"}</span>
              <span className="block text-xs font-black mt-2">Player 1</span>
              <span className="text-[10px] font-bold uppercase text-slate-500">{choices["1"]}</span>
            </div>
            <span className="text-2xl font-black">VS</span>
            <div className="rounded-2xl border-2 border-slate-950 bg-white p-4 shadow-[3px_3px_0_#171821] text-center min-w-28">
              <span className="text-4xl">{icons[choices["2"] || ""] || "❓"}</span>
              <span className="block text-xs font-black mt-2">Player 2</span>
              <span className="text-[10px] font-bold uppercase text-slate-500">{choices["2"]}</span>
            </div>
          </div>

          {(state.winnerSeat === null || state.winnerSeat === undefined) && (
            <button
              disabled={busy}
              onClick={() => act("next_round")}
              className="arcade-button bg-purple-600 text-white px-8 py-3 text-sm font-black shadow-[4px_4px_0_#171821] hover:bg-purple-700"
            >
              NEXT ROUND {curRound >= 3 ? "(SUDDEN DEATH ⚡)" : `(${curRound + 1}/3)`} ➡️
            </button>
          )}
        </div>
      )}

      {/* History Log */}
      {history.length > 0 && (
        <div className="rounded-2xl border-2 border-slate-950 bg-slate-100 p-4 text-left">
          <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">Round History</h5>
          <div className="space-y-1.5 text-xs font-bold">
            {history.map((h, i) => (
              <div key={i} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border border-slate-300">
                <span>Round {h.round}: {h.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NumberGuess({ state, guess, setGuess, submit, busy }: { state: Room["public_state"]; guess: string; setGuess: (s: string) => void; submit: (e: FormEvent) => void; busy: boolean }) {
  const trail = (state.guesses || []).slice(-6).reverse();
  return (
    <div>
      <div className="mx-auto max-w-md text-center">
        <p className="text-8xl font-black tracking-[-.08em] text-[#9fcaff]">1—100</p>
        <form onSubmit={submit} className="mt-7 flex gap-2">
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            min={1}
            max={100}
            type="number"
            required
            placeholder="Your guess"
            className="min-w-0 flex-1 rounded-full border-2 border-slate-950 px-5 py-3 text-center text-xl font-black outline-none"
          />
          <button disabled={busy} className="arcade-button bg-slate-950 text-white">
            <Send size={17} />
            <span className="hidden sm:inline">GUESS</span>
          </button>
        </form>
      </div>
      <div className="mx-auto mt-8 max-w-md space-y-2">
        {trail.map((g: any, i: number) => (
          <div key={`${g.seat}-${g.value}-${i}`} className="flex justify-between rounded-xl border-2 border-slate-950 bg-white px-4 py-2 text-sm">
            <strong>Player {g.seat}: {g.value}</strong>
            <span>{g.hint === "Too low" ? "⬆️" : g.hint === "Too high" ? "⬇️" : "🎯"} {g.hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicTacToe({ state, mySeat, place, busy }: { state: Room["public_state"]; mySeat?: number; place: (i: number) => void; busy: boolean }) {
  const curRound = (state.round as number) || 1;
  const roundWins = (state.roundWins || {}) as Record<string, number>;
  const history = (state.history || []) as Array<{
    round: number;
    winnerSeat: number | null;
    message: string;
  }>;

  return (
    <div className="mx-auto max-w-sm text-center space-y-5">
      <div className="flex items-center justify-between rounded-2xl border-2 border-slate-950 bg-slate-900 px-4 py-2.5 text-white shadow-[3px_3px_0_#171821]">
        <div className="text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">TIC TAC TOE</span>
          <h3 className="text-sm font-black uppercase">Round {curRound} of 3</h3>
        </div>
        <div className="text-right text-xs font-black">
          <span className="text-emerald-400">P1: {roundWins["1"] || 0}</span>
          <span className="mx-1.5 opacity-50">|</span>
          <span className="text-amber-300">P2: {roundWins["2"] || 0}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(state.board || Array(9).fill("")).map((cell: string, i: number) => (
          <button
            key={i}
            onClick={() => place(i)}
            disabled={Boolean(cell) || state.turn !== mySeat || busy}
            className="aspect-square cursor-pointer rounded-2xl border-2 border-slate-950 bg-[#fff8dd] text-5xl font-black shadow-[3px_3px_0_#171821] transition hover:bg-[#fff0b3] disabled:cursor-not-allowed"
          >
            {cell}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="rounded-2xl border-2 border-slate-950 bg-slate-100 p-3 text-left">
          <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">Round History</h5>
          <div className="space-y-1 text-xs font-bold">
            {history.map((h, i) => (
              <div key={i} className="flex justify-between items-center bg-white px-3 py-1.5 rounded-xl border border-slate-300">
                <span>Round {h.round}: {h.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiceDash({ state, players, mySeat, roll, busy }: { state: Room["public_state"]; players: RoomPlayer[]; mySeat?: number; roll: () => void; busy: boolean }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((square) => (
          <div key={square} className="relative aspect-square rounded-xl border-2 border-slate-950 bg-[#fff8dd] p-1 text-xs font-black">
            <span className="opacity-40">{square}</span>
            <div className="absolute inset-0 flex flex-wrap items-center justify-center">
              {players
                .filter((p) => (state.positions?.[p.seat] || 0) === square)
                .map((p) => (
                  <span key={p.id} className="h-5 w-5 rounded-full border-2 border-slate-950" style={{ backgroundColor: colors[p.seat - 1] }} />
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-7 text-center">
        <button onClick={roll} disabled={state.turn !== mySeat || busy} className="arcade-button bg-[#f4dc69] px-8 py-4 shadow-[4px_4px_0_#171821]">
          <span className="text-2xl">🎲</span>
          {state.turn === mySeat ? "ROLL THE DICE" : "WAITING…"}
        </button>
      </div>
    </div>
  );
}

function deriveWinners(room: Room, players: RoomPlayer[]) {
  const state = room.public_state;
  if (typeof state.winnerSeat === "number") return [state.winnerSeat];
  if (room.game_type === "mini_golf") {
    const values = players.map((p) => Number(state.scores?.[p.seat] || 0));
    const lowest = Math.min(...values);
    const seats = players.filter((_, i) => values[i] === lowest).map((p) => p.seat);
    return seats.length === players.length ? [] : seats;
  }
  if (["dots_boxes", "skribbl"].includes(room.game_type)) {
    const values = players.map((p) => Number(state.scores?.[p.seat] || 0));
    const top = Math.max(...values);
    const seats = players.filter((_, i) => values[i] === top).map((p) => p.seat);
    return seats.length === players.length ? [] : seats;
  }
  if (room.game_type === "rps") {
    const choices = state.choices || {};
    const unique = [...new Set(Object.values(choices))];
    if (unique.length !== 2) return [];
    const winning =
      unique.includes("rock") && unique.includes("scissors")
        ? "rock"
        : unique.includes("scissors") && unique.includes("paper")
        ? "scissors"
        : "paper";
    return players.filter((p) => choices[p.seat] === winning).map((p) => p.seat);
  }
  return [];
}

function Result({
  room,
  players,
  me,
  winningSeats,
  refresh,
}: {
  room: Room;
  players: RoomPlayer[];
  me?: RoomPlayer;
  winningSeats: number[];
  refresh: () => Promise<void>;
}) {
  const supabase = getSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);
  const winners = players.filter((p) => winningSeats.includes(p.seat));
  const draw = winningSeats.length === 0 || winningSeats.length === players.length;
  const isWin = !draw && me?.seat !== undefined && winningSeats.includes(me.seat);

  useEffect(() => {
    if (draw) {
      sounds.playDrawSound();
    } else if (isWin) {
      sounds.playWinSound();
    } else {
      sounds.playLoseSound();
    }

    if (supabase && me) {
      void supabase.rpc("track_mission_progress", { p_mission_type: "play_game", p_amount: 1 });
      if (isWin) {
        void supabase.rpc("track_mission_progress", { p_mission_type: "win_game", p_amount: 1 });
      }
    }
  }, [draw, isWin, supabase, me]);

  const outcome = draw ? "IT’S A DRAW!" : isWin ? "YOU WIN!" : "GOOD GAME!";
  const summary = draw
    ? "Nobody walks away undefeated."
    : `${winners.map((w) => w.profile?.display_name || `Player ${w.seat}`).join(" & ")} ${
        winners.length > 1 ? "take" : "takes"
      } the round.`;

  async function rematch() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("rematch_room", { p_room: room.id });
    if (error) {
      // Fallback: direct table updates if RPC is outdated/fails
      await supabase.from("game_players").update({ is_ready: false, score: 0 }).eq("room_id", room.id);
      await supabase
        .from("game_players")
        .update({ is_ready: true })
        .eq("room_id", room.id)
        .like("player_id", "11111111-1111-1111-1111-%");
      await supabase
        .from("game_rooms")
        .update({
          status: "waiting",
          public_state: {},
          state_version: room.state_version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id);
    } else {
      // Ensure all bots in the room are set to is_ready=true after rematch_room RPC runs
      await supabase
        .from("game_players")
        .update({ is_ready: true })
        .eq("room_id", room.id)
        .like("player_id", "11111111-1111-1111-1111-%");
    }
    await refresh();
    setBusy(false);
  }

  return (
    <section className="paper-card mx-auto max-w-2xl overflow-hidden text-center">
      <div className="checker border-b-2 border-slate-950 px-5 py-12">
        <span className="text-7xl">{isWin ? "🏆" : draw ? "🤝" : "💀"}</span>
        <p className="eyebrow mt-5">Game over</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-.06em]">{outcome}</h1>
        <p className="mt-3 text-slate-600">{summary}</p>
      </div>
      <div className="p-6">
        {room.game_type === "battleship" && (
          <div className="mb-6 grid gap-2 sm:grid-cols-2">
            {players.map((player) => {
              const stat = (room.public_state as { stats?: Record<string, { hits?: number; misses?: number; sunk?: number }> }).stats?.[String(player.seat)] || {};
              return (
                <div key={player.id} className="rounded-xl border-2 border-slate-950 bg-sky-50 p-3 text-left text-xs font-bold">
                  <p className="font-black">{player.profile?.display_name || `Player ${player.seat}`}</p>
                  <p className="mt-1">{stat.hits || 0} hits · {stat.misses || 0} misses · {stat.sunk || 0} ships sunk · {(stat.hits || 0) + (stat.misses || 0)} turns</p>
                </div>
              );
            })}
          </div>
        )}
        <div className="mb-6 flex justify-center gap-3">
          {players.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border-2 border-slate-950 px-3 py-2 text-xs font-black ${
                winningSeats.includes(p.seat) ? "shadow-[3px_3px_0_#171821]" : "opacity-60"
              }`}
              style={{ backgroundColor: colors[p.seat - 1] }}
            >
              {p.profile?.display_name || `P${p.seat}`}
            </div>
          ))}
        </div>
        {room.host_id === me?.player_id ? (
          <button onClick={rematch} disabled={busy} className="arcade-button bg-[#f4dc69] shadow-[4px_4px_0_#171821]">
            <RotateCcw size={17} /> REMATCH
          </button>
        ) : (
          <p className="text-sm font-bold text-slate-500">Waiting for the host to call a rematch…</p>
        )}
        <a href="/dashboard" className="mx-auto mt-5 block text-xs font-black underline decoration-2 underline-offset-4">
          BACK TO THE ARCADE
        </a>
      </div>
    </section>
  );
}
