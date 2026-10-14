import { TOWER_CHECKPOINTS, STATIC_PLATFORMS, SUMMIT_ALTITUDE } from "./tower-layout";
import type { ClimberTransform } from "./types";

export interface TowerBotBrain {
  seat: number;
  waypointIndex: number;
  pauseTimer: number;
  jumpCooldown: number;
  skillLevel: number; // 0.8 to 1.2
}

// Generate an ascending sequence of navigational waypoints up the tower
const NAV_WAYPOINTS: [number, number, number][] = [
  [0, 1.2, 0],
  [4, 2.2, 2],
  [6, 4.0, -2],
  [4.5, 5.8, -5.5],
  [0, 7.6, -6.5],
  [-4.5, 9.4, -5.5],
  [-5.5, 11.2, -2],
  [-4, 13.0, 1.5],
  [0, 14.8, -5], // Checkpoint 1
  [3.2, 16.0, -3],
  [5.2, 17.6, 0.5],
  [3.5, 19.2, 3.5],
  [0, 20.8, 5.2],
  [-3.8, 22.4, 3.8],
  [-5.2, 24.0, 0.5],
  [-3.0, 25.8, -2.5],
  [0, 27.4, 1.5],
  [0, 28.8, 6], // Checkpoint 2
  [3.2, 30.5, 4.5],
  [5.0, 32.2, 4.0],
  [5.0, 34.5, 0],
  [5.0, 37.0, -4.0],
  [1.0, 39.0, -4.5],
  [-4.0, 41.0, -4.0],
  [-5.5, 43.0, -1.0],
  [-6, 44.8, 0], // Checkpoint 3
  [-4.0, 46.5, 2.2],
  [-2.5, 48.5, 3.5],
  [0, 50.5, 4.2],
  [2.5, 53.5, 3.5],
  [4.5, 55.5, 1.8],
  [6, 58.8, 0], // Checkpoint 4
  [4.2, 60.5, -3.5],
  [0, 62.5, -5.2],
  [-4.2, 64.5, -3.2],
  [-4.0, 66.8, 2.2],
  [-1.8, 68.8, 4.0],
  [0, 70.8, 0], // The Summit!
];

export function createTowerBotBrain(seat: number): TowerBotBrain {
  return {
    seat,
    waypointIndex: 0,
    pauseTimer: Math.random() * 0.5,
    jumpCooldown: 0,
    skillLevel: 0.85 + Math.random() * 0.3,
  };
}

export function updateTowerBot(
  bot: TowerBotBrain,
  runner: ClimberTransform,
  delta: number,
  elapsedSec: number
): {
  keysDown: Set<string>;
  wantsJump: boolean;
} {
  const keys = new Set<string>();
  let wantsJump = false;

  if (bot.jumpCooldown > 0) bot.jumpCooldown -= delta;
  if (bot.pauseTimer > 0) {
    bot.pauseTimer -= delta;
    return { keysDown: keys, wantsJump: false };
  }

  const target = NAV_WAYPOINTS[bot.waypointIndex] || NAV_WAYPOINTS[NAV_WAYPOINTS.length - 1];
  const dx = target[0] - runner.position[0];
  const dz = target[2] - runner.position[2];
  const dy = target[1] - runner.position[1];
  const distXZ = Math.sqrt(dx * dx + dz * dz);

  // Reached current waypoint
  if (distXZ < 0.85 && Math.abs(dy) < 1.6) {
    if (bot.waypointIndex < NAV_WAYPOINTS.length - 1) {
      bot.waypointIndex++;
      // Brief human hesitation before next jump
      if (Math.random() < 0.25) {
        bot.pauseTimer = 0.15 + Math.random() * 0.3;
      }
    }
  }

  // Steer towards target waypoint
  if (dx > 0.3) keys.add("KeyD");
  else if (dx < -0.3) keys.add("KeyA");

  if (dz > 0.3) keys.add("KeyS");
  else if (dz < -0.3) keys.add("KeyW");

  // Bot decides to jump if target is higher or across a gap
  if (
    (dy > 0.5 || distXZ > 1.8) &&
    runner.isGrounded &&
    bot.jumpCooldown <= 0
  ) {
    wantsJump = true;
    bot.jumpCooldown = 0.65;
  }

  return { keysDown: keys, wantsJump };
}
