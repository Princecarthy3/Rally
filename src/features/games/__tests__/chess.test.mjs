import test from "node:test";
import assert from "node:assert/strict";
import { Chess, DEFAULT_POSITION } from "chess.js";

test("starts with the standard position and all 32 pieces", () => {
  const chess = new Chess();
  assert.equal(chess.fen(), DEFAULT_POSITION);
  assert.equal(chess.board().flat().filter(Boolean).length, 32);
  assert.equal(chess.moves().length, 20);
});

test("validates movement and captures using chess rules", () => {
  const chess = new Chess();
  assert.throws(() => chess.move("Ra3"));
  chess.move("e4"); chess.move("d5"); chess.move("exd5");
  assert.equal(chess.get("d5").type, "p");
  assert.equal(chess.get("d5").color, "w");
});

test("supports legal rook, bishop, queen, knight and king moves", () => {
  const cases = [
    ["4k3/8/8/8/8/8/8/R3K3 w - - 0 1", "a1", "a4"],
    ["4k3/8/8/8/8/8/8/B3K3 w - - 0 1", "a1", "d4"],
    ["4k3/8/8/8/8/8/8/Q3K3 w - - 0 1", "a1", "d4"],
    ["4k3/8/8/8/8/8/8/N3K3 w - - 0 1", "a1", "b3"],
    ["4k3/8/8/8/8/8/8/4K3 w - - 0 1", "e1", "d1"],
  ];
  for (const [fen, from, to] of cases) assert.equal(new Chess(fen).move({ from, to }).to, to);
});

test("supports castling on both sides", () => {
  const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  assert.equal(chess.move({ from: "e1", to: "g1" }).isKingsideCastle(), true);
  assert.equal(chess.get("f1").type, "r");
  assert.equal(chess.move({ from: "e8", to: "c8" }).isQueensideCastle(), true);
  assert.equal(chess.get("d8").color, "b");
});

test("supports en passant", () => {
  const chess = new Chess();
  for (const move of ["e4", "a6", "e5", "d5"]) chess.move(move);
  const capture = chess.move({ from: "e5", to: "d6" });
  assert.equal(capture.isEnPassant(), true);
  assert.equal(chess.get("d5"), undefined);
  assert.equal(chess.get("d6").type, "p");
});

test("promotes to a chosen piece", () => {
  const chess = new Chess("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  const move = chess.move({ from: "a7", to: "a8", promotion: "n" });
  assert.equal(move.promotion, "n");
  assert.equal(chess.get("a8").type, "n");
});

test("detects checkmate and rejects further moves", () => {
  const chess = new Chess();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) chess.move(move);
  assert.equal(chess.isCheckmate(), true);
  assert.equal(chess.isGameOver(), true);
  assert.throws(() => chess.move("a3"));
});

test("detects stalemate", () => {
  const chess = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(chess.isStalemate(), true);
});

test("detects threefold repetition after replaying move history", () => {
  const chess = new Chess();
  for (let i = 0; i < 2; i++) for (const move of ["Nf3", "Nf6", "Ng1", "Ng8"]) chess.move(move);
  assert.equal(chess.isThreefoldRepetition(), true);
});

test("detects the fifty-move rule and insufficient material", () => {
  const fiftyMove = new Chess("4k1n1/8/8/8/8/8/8/4K1N1 w - - 99 51");
  fiftyMove.move({ from: "g1", to: "f3" });
  assert.equal(fiftyMove.isDrawByFiftyMoves(), true);
  const material = new Chess("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  assert.equal(material.isInsufficientMaterial(), true);
});
