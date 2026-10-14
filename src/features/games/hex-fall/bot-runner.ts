import { FLOOR_HEIGHTS, HEX_RADIUS, TOTAL_FLOORS } from "./hex-math";
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

  // 1. If currently falling between floors, steer towards tiles on next floor below
  const floorY = FLOOR_HEIGHTS[currentFloor] ?? 0;
  const isFallingDown = py < floorY - 0.6;

  if (isFallingDown && currentFloor < TOTAL_FLOORS - 1) {
    const nextFloor = currentFloor + 1;
    // Find nearest intact tile on floor below
    let bestDist = Infinity;
    let targetX = 0;
    let targetZ = 0;

    for (const id in tiles) {
      const tile = tiles[id];
      if (tile.floor === nextFloor && tile.state === "intact") {
        const d = Math.hypot(tile.x - px, tile.z - pz);
        if (d < bestDist) {
          bestDist = d;
          targetX = tile.x;
          targetZ = tile.z;
        }
      }
    }

    if (bestDist < Infinity) {
      const angle = Math.atan2(targetZ - pz, targetX - px);
      const speed = 7.0;
      return {
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        jump: false,
        dive: false,
      };
    }
  }

  // 2. On ground: find safe adjacent tile
  if (nowMs > brain.nextDecisionTime || !brain.targetPos) {
    brain.nextDecisionTime = nowMs + 180 + Math.random() * 250;

    // Search for intact tiles on current floor within radius 1.2 to 3.8
    const candidates: Array<{ tile: HexTile; score: number }> = [];

    for (const id in tiles) {
      const tile = tiles[id];
      if (tile.floor === currentFloor && tile.state === "intact") {
        const dist = Math.hypot(tile.x - px, tile.z - pz);
        if (dist > 0.4 && dist < 4.2) {
          // Score based on being close, but slightly outward to preserve tiles
          let score = 10 - dist;
          candidates.push({ tile, score });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      // Pick best or second best
      const pickIdx = Math.random() < 0.8 ? 0 : Math.min(1, candidates.length - 1);
      const picked = candidates[pickIdx].tile;
      brain.targetPos = [picked.x, picked.z];
    } else {
      // No intact tiles nearby: walk towards center or leap off
      brain.targetPos = [0, 0];
    }
  }

  if (brain.targetPos) {
    const [tx, tz] = brain.targetPos;
    const dx = tx - px;
    const dz = tz - pz;
    const dist = Math.hypot(dx, dz);

    if (dist < 0.3) {
      brain.targetPos = null;
      return { vx: 0, vz: 0, jump: false, dive: false };
    }

    const angle = Math.atan2(dz, dx);
    const speed = 8.5;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;

    // Jump if gap ahead or target is > 2.0 units away
    const shouldJump = dist > 2.0 && brain.jumpCooldown <= 0 && runner.isGrounded;
    if (shouldJump) {
      brain.jumpCooldown = 0.85 + Math.random() * 0.4;
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
