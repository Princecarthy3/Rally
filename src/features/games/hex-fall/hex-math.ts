import type { HexTile } from "./types";

export const HEX_RADIUS = 1.32;
export const HEX_HEIGHT = 0.35;
export const GRID_RADIUS = 4; // 61 tiles per floor
export const TOTAL_FLOORS = 4;
export const FLOOR_HEIGHTS = [18, 12, 6, 0];
export const ELIMINATION_Y = -5;
/** Seconds from first step to tile vanishing — long enough to react and jump away */
export const TILE_DECAY_DURATION = 1.85;

export const FLOOR_THEMES = [
  {
    name: "Cyan Skyline",
    floorNumber: 1,
    baseColor: "#0891b2",
    accentColor: "#22d3ee",
    rimColor: "#67e8f9",
    emissive: "#0e7490",
  },
  {
    name: "Violet Grid",
    floorNumber: 2,
    baseColor: "#7c3aed",
    accentColor: "#a855f7",
    rimColor: "#d8b4fe",
    emissive: "#6d28d9",
  },
  {
    name: "Solar Deck",
    floorNumber: 3,
    baseColor: "#d97706",
    accentColor: "#fbbf24",
    rimColor: "#fef08a",
    emissive: "#b45309",
  },
  {
    name: "Inferno Floor",
    floorNumber: 4,
    baseColor: "#e11d48",
    accentColor: "#fb7185",
    rimColor: "#fecdd3",
    emissive: "#be123c",
  },
];

export function hexToWorld(q: number, r: number, floorIndex: number) {
  const x = HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
  const z = HEX_RADIUS * 1.5 * r;
  const y = FLOOR_HEIGHTS[floorIndex] ?? 0;
  return { x, y, z };
}

export function generateAllFloors(): Record<string, HexTile> {
  const tiles: Record<string, HexTile> = {};

  for (let floor = 0; floor < TOTAL_FLOORS; floor++) {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
      const r1 = Math.max(-GRID_RADIUS, -q - GRID_RADIUS);
      const r2 = Math.min(GRID_RADIUS, -q + GRID_RADIUS);
      for (let r = r1; r <= r2; r++) {
        const id = `f${floor}_q${q}_r${r}`;
        const pos = hexToWorld(q, r, floor);
        tiles[id] = {
          id,
          floor,
          q,
          r,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          state: "intact",
        };
      }
    }
  }

  return tiles;
}

/** Slightly oversized hitbox so gaps between hexes don't drop you unfairly */
export function isPointInsideHex(
  px: number,
  pz: number,
  hx: number,
  hz: number,
  radius: number = HEX_RADIUS
): boolean {
  const dx = Math.abs(px - hx);
  const dz = Math.abs(pz - hz);
  const sqrt3 = 1.73205;

  // Forgiving outer bounds
  if (dx > (sqrt3 / 2) * radius * 1.08 || dz > radius * 1.08) return false;
  return dz * 0.5 + dx * (sqrt3 / 2) <= radius * 1.05;
}

export function getTileUnderPlayer(
  px: number,
  py: number,
  pz: number,
  floorIndex: number,
  tiles: Record<string, HexTile>
): HexTile | null {
  const floorY = FLOOR_HEIGHTS[floorIndex];
  if (floorY === undefined) return null;

  // Landing tolerance — generous so jumps still connect
  if (py < floorY - 0.55 || py > floorY + 1.45) {
    return null;
  }

  let best: HexTile | null = null;
  let bestDist = Infinity;

  for (const id in tiles) {
    const tile = tiles[id];
    if (tile.floor === floorIndex && tile.state !== "fallen") {
      if (isPointInsideHex(px, pz, tile.x, tile.z, HEX_RADIUS)) {
        const d = Math.hypot(px - tile.x, pz - tile.z);
        if (d < bestDist) {
          bestDist = d;
          best = tile;
        }
      }
    }
  }

  return best;
}

/** Find nearest intact (or still-standing) tile on a floor for bots / air steering */
export function findNearestSafeTile(
  px: number,
  pz: number,
  floorIndex: number,
  tiles: Record<string, HexTile>,
  preferIntact = true
): HexTile | null {
  let best: HexTile | null = null;
  let bestScore = -Infinity;

  for (const id in tiles) {
    const tile = tiles[id];
    if (tile.floor !== floorIndex || tile.state === "fallen") continue;
    if (preferIntact && tile.state !== "intact") continue;
    const dist = Math.hypot(tile.x - px, tile.z - pz);
    // Prefer closer intact tiles, slight bias toward center
    const centerBias = 1 / (1 + Math.hypot(tile.x, tile.z) * 0.08);
    const score = 20 - dist + centerBias * 3;
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}

export function getStartingPositions(playerCount: number): [number, number, number][] {
  const n = Math.max(2, playerCount);
  // Keep spawns well inside the hex grid so nobody starts mid-air
  const radius = 4.2;
  const topY = FLOOR_HEIGHTS[0] + 0.5;
  const positions: [number, number, number][] = [];

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push([Number(x.toFixed(2)), topY, Number(z.toFixed(2))]);
  }

  return positions;
}
