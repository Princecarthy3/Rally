import { FLOOR_HEIGHTS, TOTAL_FLOORS, findNearestSafeTile } from "./hex-math";
import type { HexRunnerTransform, HexTile } from "./types";

export type BotBrain = {
  seat: number;
  targetPos: [number, number] | null; // [x, z]
  nextDecisionTime: number;
  jumpCooldown: number;
  isJumping: boolean;
};

export function createBotBrain(seat: number): BotBrain {
  return {
    seat,
    targetPos: null,
    nextDecisionTime: 0,
    jumpCooldown: 0,
    isJumping: false,
  };
}

export function updateBot(
  runner: HexRunnerTransform,
  brain: BotBrain,
  tiles: Record<string, HexTile>,
  delta: number,
  nowMs: number
): {
  vx: number;
  vz: number;
  jump: boolean;
  dive: boolean;
} {
  const [px, py, pz] = runner.position;
  const currentFloor = runner.currentFloor;

  brain.jumpCooldown -= delta;

  // 1. Falling between floors — steer toward nearest intact tile below
  const floorY = FLOOR_HEIGHTS[currentFloor] ?? 0;
  const isFallingDown = py < floorY - 0.6;

  if (isFallingDown && currentFloor < TOTAL_FLOORS - 1) {
    const nextFloor = currentFloor + 1;
    const safe = findNearestSafeTile(px, pz, nextFloor, tiles, true);
    if (safe) {
      const angle = Math.atan2(safe.z - pz, safe.x - px);
      return {
        vx: Math.cos(angle) * 8.0,
        vz: Math.sin(angle) * 8.0,
        jump: false,
        dive: Math.hypot(safe.x - px, safe.z - pz) > 3.5,
      };
    }
  }

  // 2. On ground: keep moving to intact tiles, avoid decaying ones
  if (nowMs > brain.nextDecisionTime || !brain.targetPos) {
    brain.nextDecisionTime = nowMs + 220 + Math.random() * 280;

    const candidates: Array<{ x: number; z: number; score: number }> = [];

    for (const id in tiles) {
      const tile = tiles[id];
      if (tile.floor !== currentFloor) continue;
      if (tile.state === "fallen") continue;

      const dist = Math.hypot(tile.x - px, tile.z - pz);
      if (dist < 0.35 || dist > 5.0) continue;

      // Strongly prefer intact; decaying is only a last resort
      let score = tile.state === "intact" ? 12 - dist : 2 - dist;
      // Drift toward center so the floor doesn't empty from the middle-out unfairly for humans
      score += 2 / (1 + Math.hypot(tile.x, tile.z) * 0.12);
      // Slight randomness so bots don't lock-step
      score += Math.random() * 1.5;
      candidates.push({ x: tile.x, z: tile.z, score });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const pickIdx = Math.random() < 0.75 ? 0 : Math.min(2, candidates.length - 1);
      const picked = candidates[pickIdx];
      brain.targetPos = [picked.x, picked.z];
    } else {
      brain.targetPos = [0, 0];
    }
  }

  if (brain.targetPos) {
    const [tx, tz] = brain.targetPos;
    const dx = tx - px;
    const dz = tz - pz;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.35) {
      brain.targetPos = null;
      return { vx: 0, vz: 0, jump: false, dive: false };
    }

    const angle = Math.atan2(dz, dx);
    const speed = 8.2;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;

    const shouldJump = dist > 2.2 && brain.jumpCooldown <= 0 && runner.isGrounded;
    if (shouldJump) {
      brain.jumpCooldown = 0.9 + Math.random() * 0.5;
    }

    return {
      vx,
      vz,
      jump: shouldJump,
      dive: false,
    };
  }

  return { vx: 0, vz: 0, jump: false, dive: false };
}
