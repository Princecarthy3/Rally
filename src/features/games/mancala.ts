export type MancalaSeat = 1 | 2;
export type MancalaPitDestination = { type: "pit"; seat: MancalaSeat; index: number };
export type MancalaStoreDestination = { type: "store"; seat: MancalaSeat };
export type MancalaDestination = MancalaPitDestination | MancalaStoreDestination;

export type MancalaLastMove = {
  seat: MancalaSeat;
  pit: number;
  path: MancalaDestination[];
  captured: number;
  extraTurn: boolean;
  at: string;
};

export type MancalaState = {
  pits: Record<MancalaSeat, number[]>;
  stores: Record<MancalaSeat, number>;
  turn: MancalaSeat;
  status: "playing" | "completed";
  winnerSeat: MancalaSeat | null;
  scores: Record<MancalaSeat, number>;
  moveNumber: number;
  lastMove: MancalaLastMove | null;
  turnDeadline: string;
  rematchRequests: MancalaSeat[];
  message: string;
};

const TURN_SECONDS = 30;
const otherSeat = (seat: MancalaSeat): MancalaSeat => (seat === 1 ? 2 : 1);

export function createInitialMancalaState(now = Date.now()): MancalaState {
  return {
    pits: { 1: Array(6).fill(4), 2: Array(6).fill(4) },
    stores: { 1: 0, 2: 0 },
    turn: 1,
    status: "playing",
    winnerSeat: null,
    scores: { 1: 0, 2: 0 },
    moveNumber: 0,
    lastMove: null,
    turnDeadline: new Date(now + TURN_SECONDS * 1000).toISOString(),
    rematchRequests: [],
    message: "Player 1 goes first.",
  };
}

export function getLegalMancalaMoves(state: MancalaState, player: MancalaSeat): number[] {
  if (state.status !== "playing" || state.turn !== player) return [];
  return state.pits[player].flatMap((stones, pit) => (stones > 0 ? [pit] : []));
}

export function isMancalaGameOver(state: MancalaState): boolean {
  return state.pits[1].every((stones) => stones === 0) || state.pits[2].every((stones) => stones === 0);
}

export function finalizeMancalaGame(state: MancalaState): MancalaState {
  const next: MancalaState = {
    ...state,
    pits: { 1: [...state.pits[1]], 2: [...state.pits[2]] },
    stores: { ...state.stores },
    scores: { ...state.scores },
    status: "completed",
  };

  for (const seat of [1, 2] as const) {
    next.stores[seat] += next.pits[seat].reduce((total, stones) => total + stones, 0);
    next.pits[seat] = Array(6).fill(0);
  }

  next.scores = { ...next.stores };
  next.winnerSeat =
    next.stores[1] === next.stores[2] ? null : next.stores[1] > next.stores[2] ? 1 : 2;
  next.message = next.winnerSeat === null ? "It's a draw!" : `Player ${next.winnerSeat} wins!`;
  return next;
}

export function getMancalaWinner(state: MancalaState): MancalaSeat | null {
  if (state.status !== "completed") return null;
  return state.winnerSeat;
}

export function applyMancalaMove(
  state: MancalaState,
  player: MancalaSeat,
  pitIndex: number,
  now = Date.now(),
): MancalaState {
  if (state.status !== "playing") throw new Error("Game is not active.");
  if (player !== 1 && player !== 2) throw new Error("Player is not in this game.");
  if (state.turn !== player) throw new Error("Wait for your turn.");
  if (!Number.isInteger(pitIndex) || pitIndex < 0 || pitIndex > 5) throw new Error("Invalid pit.");

  const pits: Record<MancalaSeat, number[]> = {
    1: [...state.pits[1]],
    2: [...state.pits[2]],
  };
  const stores = { ...state.stores };
  let stones = pits[player][pitIndex];
  if (stones === 0) throw new Error("That pit is empty.");
  pits[player][pitIndex] = 0;

  let cursorSeat = player;
  let cursorPit = pitIndex;
  const path: MancalaDestination[] = [];

  while (stones > 0) {
    if (cursorSeat === player) {
      if (cursorPit < 5) {
        cursorPit += 1;
        pits[player][cursorPit] += 1;
        path.push({ type: "pit", seat: player, index: cursorPit });
      } else {
        stores[player] += 1;
        path.push({ type: "store", seat: player });
        cursorSeat = otherSeat(player);
        cursorPit = 6;
      }
    } else if (cursorPit === 6) {
      cursorPit = 5;
      pits[cursorSeat][cursorPit] += 1;
      path.push({ type: "pit", seat: cursorSeat, index: cursorPit });
    } else if (cursorPit > 0) {
      cursorPit -= 1;
      pits[cursorSeat][cursorPit] += 1;
      path.push({ type: "pit", seat: cursorSeat, index: cursorPit });
    } else {
      cursorSeat = player;
      cursorPit = 0;
      pits[player][cursorPit] += 1;
      path.push({ type: "pit", seat: player, index: cursorPit });
    }
    stones -= 1;
  }

  const lastDestination = path[path.length - 1];
  let captured = 0;
  if (lastDestination?.type === "pit" && lastDestination.seat === player) {
    const oppositePit = 5 - lastDestination.index;
    const oppositeStones = pits[otherSeat(player)][oppositePit];
    if (pits[player][lastDestination.index] === 1 && oppositeStones > 0) {
      captured = oppositeStones + 1;
      stores[player] += captured;
      pits[player][lastDestination.index] = 0;
      pits[otherSeat(player)][oppositePit] = 0;
    }
  }

  const extraTurn = lastDestination?.type === "store" && lastDestination.seat === player;
  const partial: MancalaState = {
    ...state,
    pits,
    stores,
    scores: { ...stores },
    turn: extraTurn ? player : otherSeat(player),
    moveNumber: state.moveNumber + 1,
    lastMove: {
      seat: player,
      pit: pitIndex,
      path,
      captured,
      extraTurn,
      at: new Date(now).toISOString(),
    },
    turnDeadline: new Date(now + TURN_SECONDS * 1000).toISOString(),
    rematchRequests: [],
    message: captured > 0 ? `Captured ${captured} stones!` : extraTurn ? "Extra turn!" : "Turn switched.",
  };

  if (isMancalaGameOver(partial)) {
    return finalizeMancalaGame(partial);
  }
  return partial;
}
