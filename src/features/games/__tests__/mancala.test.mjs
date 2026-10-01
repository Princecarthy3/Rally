import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMancalaMove,
  createInitialMancalaState,
  finalizeMancalaGame,
  getLegalMancalaMoves,
  getMancalaWinner,
  isMancalaGameOver,
} from "../mancala.ts";

const at = Date.parse("2026-01-01T00:00:00.000Z");

test("starts with 48 stones and Player 1 to move", () => {
  const state = createInitialMancalaState(at);
  assert.deepEqual(state.pits[1], [4, 4, 4, 4, 4, 4]);
  assert.deepEqual(state.pits[2], [4, 4, 4, 4, 4, 4]);
  assert.deepEqual(state.stores, { 1: 0, 2: 0 });
  assert.equal(state.turn, 1);
  assert.equal(Object.values(state.pits).flat().reduce((a, b) => a + b, 0), 48);
});

test("distributes stones normally and skips the opponent store while wrapping", () => {
  const normal = applyMancalaMove(createInitialMancalaState(at), 1, 0, at);
  assert.deepEqual(normal.pits[1], [0, 5, 5, 5, 5, 4]);
  assert.equal(normal.stores[1], 0);
  assert.equal(normal.turn, 2);

  const wrapState = createInitialMancalaState(at);
  wrapState.pits[1] = [0, 0, 0, 0, 1, 12];
  const wrapped = applyMancalaMove(wrapState, 1, 5, at);
  assert.equal(wrapped.stores[1], 1);
  assert.equal(wrapped.stores[2], 0);
  assert.deepEqual(wrapped.pits[2], [5, 5, 5, 5, 5, 5]);
  assert.deepEqual(wrapped.pits[1], [1, 1, 1, 1, 2, 0]);
  assert.equal(wrapped.lastMove?.path.length, 12);
});

test("keeps the turn when the final stone lands in the player's store", () => {
  const state = createInitialMancalaState(at);
  state.pits[1] = [0, 0, 0, 0, 0, 1];
  const next = applyMancalaMove(state, 1, 5, at);
  assert.equal(next.stores[1], 1);
  assert.equal(next.turn, 1);
  assert.equal(next.lastMove?.extraTurn, true);
});

test("supports Player 2 sowing in their direction and earning an extra turn", () => {
  const state = createInitialMancalaState(at);
  state.pits[2] = [1, 0, 0, 0, 0, 1];
  state.turn = 2;
  const next = applyMancalaMove(state, 2, 5, at);
  assert.equal(next.stores[2], 1);
  assert.equal(next.turn, 2);
  assert.equal(next.pits[2][0], 1);
  assert.equal(next.lastMove?.extraTurn, true);
});

test("captures the landing stone and opposite pit, but not an empty opposite pit", () => {
  const captureState = createInitialMancalaState(at);
  captureState.pits[1] = [0, 0, 0, 0, 1, 0];
  captureState.pits[2] = [3, 0, 0, 0, 0, 0];
  const captured = applyMancalaMove(captureState, 1, 4, at);
  assert.equal(captured.stores[1], 4);
  assert.equal(captured.pits[1][5], 0);
  assert.equal(captured.pits[2][0], 0);
  assert.equal(captured.lastMove?.captured, 4);

  const noCapture = createInitialMancalaState(at);
  noCapture.pits[1] = [0, 0, 0, 0, 1, 0];
  noCapture.pits[2] = [0, 1, 0, 0, 0, 0];
  const unchanged = applyMancalaMove(noCapture, 1, 4, at);
  assert.equal(unchanged.stores[1], 0);
  assert.equal(unchanged.pits[1][5], 1);
});

test("rejects empty pits, invalid or opponent pits, wrong turns, and completed games", () => {
  const state = createInitialMancalaState(at);
  assert.throws(() => applyMancalaMove(state, 1, 6, at), /Invalid pit/);
  assert.throws(() => applyMancalaMove(state, 1, -1, at), /Invalid pit/);
  assert.throws(() => applyMancalaMove(state, 1, 0.5, at), /Invalid pit/);
  assert.throws(() => applyMancalaMove(state, 2, 0, at), /Wait for your turn/);
  state.pits[1][0] = 0;
  assert.deepEqual(getLegalMancalaMoves(state, 1), [1, 2, 3, 4, 5]);
  assert.throws(() => applyMancalaMove(state, 1, 0, at), /empty/);
  const completed = finalizeMancalaGame(state);
  assert.throws(() => applyMancalaMove(completed, 1, 1, at), /not active/);
});

test("ends when one side is empty, sweeps remaining stones, and calculates a winner or draw", () => {
  const state = createInitialMancalaState(at);
  state.pits[1] = [0, 0, 0, 0, 0, 1];
  state.pits[2] = [0, 0, 0, 0, 0, 2];
  const finished = applyMancalaMove(state, 1, 5, at);
  assert.equal(finished.status, "completed");
  assert.deepEqual(finished.pits[1], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(finished.pits[2], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(finished.scores, { 1: 1, 2: 2 });
  assert.equal(getMancalaWinner(finished), 2);
  assert.equal(isMancalaGameOver(finished), true);

  const draw = finalizeMancalaGame({
    ...createInitialMancalaState(at),
    pits: { 1: [0, 0, 0, 0, 0, 1], 2: [0, 0, 0, 0, 0, 1] },
    stores: { 1: 23, 2: 23 },
  });
  assert.equal(draw.winnerSeat, null);
  assert.equal(getMancalaWinner(draw), null);
  assert.deepEqual(draw.scores, { 1: 24, 2: 24 });
});

test("transitions are immutable and conserve all stones", () => {
  const state = createInitialMancalaState(at);
  const original = structuredClone(state);
  const next = applyMancalaMove(state, 1, 0, at);
  assert.deepEqual(state, original);
  assert.notEqual(state.pits, next.pits);
  assert.equal(
    Object.values(next.pits).flat().reduce((a, b) => a + b, 0) + next.stores[1] + next.stores[2],
    48,
  );
});
