import { FLOOR_HEIGHTS, TOTAL_FLOORS, FINISH_Z, findNearestSafeTile } from "./hex-math";
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

  // 2. On ground: race toward finish (+Z), prefer intact tiles ahead
  if (nowMs > brain.nextDecisionTime || !brain.targetPos) {
    brain.nextDecisionTime = nowMs + 180 + Math.random() * 220;

    const candidates: Array<{ x: number; z: number; score: number }> = [];

    for (const id in tiles) {
      const tile = tiles[id];
      if (tile.floor !== currentFloor) continue;
      if (tile.state === "fallen") continue;

      const dist = Math.hypot(tile.x - px, tile.z - pz);
      if (dist < 0.35 || dist > 6.5) continue;

      // Intact preferred; strong +Z race bias toward finish
      let score = tile.state === "intact" ? 14 - dist : 1.5 - dist;
      score += Math.max(0, tile.z - pz) * 0.55;
      // Prefer staying near center of path
      score += 1.5 / (1 + Math.abs(tile.x) * 0.15);
      score += Math.random() * 1.2;
      candidates.push({ x: tile.x, z: tile.z, score });
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const pickIdx = Math.random() < 0.8 ? 0 : Math.min(2, candidates.length - 1);
      const picked = candidates[pickIdx];
      brain.targetPos = [picked.x, picked.z];
    } else {
      // Push toward finish even with no nearby tiles
      brain.targetPos = [0, Math.min(FINISH_Z, pz + 4)];
    }
  }

  if (brain.targetPos) {
    const [tx, tz] = brain.targetPos;
    const dx = tx - px;
    const dz = tz - pz;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.35) {
      brain.targetPos = null;
      // Keep a little forward momentum toward finish
      return { vx: 0, vz: 6.5, jump: false, dive: false };
    }

    const angle = Math.atan2(dz, dx);
    const speed = 9.0;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;

    const shouldJump = dist > 2.2 && brain.jumpCooldown <= 0 && runner.isGrounded;
    if (shouldJump) {
      brain.jumpCooldown = 0.85 + Math.random() * 0.45;
    }

    return {
      vx,
      vz,
      jump: shouldJump,
      dive: false,
    };
  }

  return { vx: 0, vz: 5.5, jump: false, dive: false };
}
