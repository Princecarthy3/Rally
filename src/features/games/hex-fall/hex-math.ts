import type { HexTile } from "./types";

export const HEX_RADIUS = 1.28;
export const HEX_HEIGHT = 0.38;
/** How many hexes along the run (straight path length) */
export const PATH_ROWS = 28;
/** Half-width in hexes → total width = 2 * half + 1 (5-wide path) */
export const PATH_HALF_WIDTH = 3; // 7 hexes wide — easier to stay on
export const TOTAL_FLOORS = 4;
export const FLOOR_HEIGHTS = [18, 12, 6, 0];
export const ELIMINATION_Y = -5;
/** Seconds from first step to tile vanishing */
export const TILE_DECAY_DURATION = 1.85;

const X_SPACING = HEX_RADIUS * Math.sqrt(3);
const Z_SPACING = HEX_RADIUS * 1.5;

/** World length of the full path (for camera / stadium) */
export const PATH_LENGTH_Z = PATH_ROWS * Z_SPACING;
export const PATH_WIDTH_X = (PATH_HALF_WIDTH * 2 + 1) * X_SPACING;

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

/** Long straight hex runway: rows along +Z, columns across X */
export function pathToWorld(col: number, row: number, floorIndex: number) {
  const offset = (row % 2) * (X_SPACING * 0.5);
  const x = col * X_SPACING + offset;
  const z = row * Z_SPACING;
  const y = FLOOR_HEIGHTS[floorIndex] ?? 0;
  return { x, y, z };
}

export function generateAllFloors(): Record<string, HexTile> {
  const tiles: Record<string, HexTile> = {};

  for (let floor = 0; floor < TOTAL_FLOORS; floor++) {
    for (let row = 0; row < PATH_ROWS; row++) {
      for (let col = -PATH_HALF_WIDTH; col <= PATH_HALF_WIDTH; col++) {
        const id = `f${floor}_c${col}_r${row}`;
        const pos = pathToWorld(col, row, floor);
        tiles[id] = {
          id,
          floor,
          q: col,
          r: row,
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

  if (dx > (sqrt3 / 2) * radius * 1.1 || dz > radius * 1.1) return false;
  return dz * 0.5 + dx * (sqrt3 / 2) <= radius * 1.08;
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

/** Prefer intact tiles; bias forward along the path (+Z) for bots */
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
    // Prefer closer tiles slightly ahead on the path
    const forwardBias = Math.max(0, tile.z - pz) * 0.15;
    const score = 20 - dist + forwardBias;
    if (score > bestScore) {
      bestScore = score;
      best = tile;
    }
  }
  return best;
}

/** Spawn near the start of the path (low Z), facing down the runway */
export function getStartingPositions(playerCount: number): [number, number, number][] {
  const n = Math.max(2, playerCount);
  const topY = FLOOR_HEIGHTS[0] + 0.5;
  const startRow = 1;
  const positions: [number, number, number][] = [];

  for (let i = 0; i < n; i++) {
    // Spread across path width
    const t = n === 1 ? 0 : i / (n - 1);
    const col = -PATH_HALF_WIDTH + t * (PATH_HALF_WIDTH * 2);
    const pos = pathToWorld(col, startRow, 0);
    positions.push([Number(pos.x.toFixed(2)), topY, Number(pos.z.toFixed(2))]);
  }

  return positions;
}
