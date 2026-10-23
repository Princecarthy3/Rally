import { CheckpointData, SurfaceType } from "./types";

/**
 * Pine Ridge rally stage — flowing circuit inspired by Trigger Rally courses:
 * gravel shoulders, named checkpoints, sequential gates.
 */
export const TRACK_WAYPOINTS: Array<[number, number, number]> = [
  [0, 0, 0],
  [0, 0, 70],
  [34, 0, 132],
  [102, 0, 170],
  [182, 0, 158],
  [238, 0, 112],
  [250, 0, 42],
  [224, 0, -30],
  [164, 0, -86],
  [88, 0, -126],
  [12, 0, -142],
  [-72, 0, -128],
  [-148, 0, -92],
  [-218, 0, -34],
  [-244, 0, 38],
  [-220, 0, 106],
  [-164, 0, 150],
  [-94, 0, 130],
  [-42, 0, 82],
  [-16, 0, 34],
];

export const TOTAL_LAPS = 3;

/** Checkpoint gates along the stage (Trigger Rally Progress system style) */
export const CHECKPOINTS: CheckpointData[] = [
  { index: 1, position: [34, 0, 132], radius: 18, name: "North Ridge" },
  { index: 2, position: [238, 0, 112], radius: 18, name: "East Hairpin" },
  { index: 3, position: [12, 0, -142], radius: 18, name: "South Sweep" },
  { index: 4, position: [-218, 0, -34], radius: 18, name: "West Canyon" },
  { index: 5, position: [0, 0, 0], radius: 16, name: "Start / Finish" },
];

export const START_GRID_SLOTS: Array<{ position: [number, number, number]; rotation: number }> = [
  { position: [-3, 0.1, 8], rotation: 0 },
  { position: [3, 0.1, 8], rotation: 0 },
  { position: [-3, 0.1, 1], rotation: 0 },
  { position: [3, 0.1, 1], rotation: 0 },
];

export const SURFACE_FRICTION: Record<SurfaceType, { grip: number; topSpeedRatio: number }> = {
  asphalt: { grip: 1.0, topSpeedRatio: 1.0 },
  dirt: { grip: 0.78, topSpeedRatio: 0.9 },
  gravel: { grip: 0.66, topSpeedRatio: 0.84 },
  mud: { grip: 0.42, topSpeedRatio: 0.68 },
  grass: { grip: 0.5, topSpeedRatio: 0.7 },
};

/** Rolling hills — denser undulation than a flat GP pad */
export function getTerrainHeight(x: number, z: number): number {
  const wave1 = Math.sin(x * 0.032) * Math.cos(z * 0.032) * 3.1;
  const wave2 = Math.sin(x * 0.075 + z * 0.048) * 1.35;
  const wave3 = Math.cos(x * 0.018 - z * 0.022) * 0.85;
  return Math.max(-2.5, wave1 + wave2 + wave3);
}

/**
 * Road is packed gravel/dirt with a firmer racing line in the center
 * (Trigger Rally cuts a course into heightmap terrain).
 */
export function getDistanceToTrack(x: number, z: number): {
  distance: number;
  surface: SurfaceType;
} {
  let minSq = Infinity;
  for (let i = 0; i < TRACK_WAYPOINTS.length; i++) {
    const p1 = TRACK_WAYPOINTS[i];
    const p2 = TRACK_WAYPOINTS[(i + 1) % TRACK_WAYPOINTS.length];
    const dx = p2[0] - p1[0];
    const dz = p2[2] - p1[2];
    const lenSq = dx * dx + dz * dz;
    let t = lenSq === 0 ? 0 : ((x - p1[0]) * dx + (z - p1[2]) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = p1[0] + t * dx;
    const projZ = p1[2] + t * dz;
    const distSq = (x - projX) * (x - projX) + (z - projZ) * (z - projZ);
    if (distSq < minSq) minSq = distSq;
  }

  const dist = Math.sqrt(minSq);
  if (dist <= 5.5) return { distance: dist, surface: "dirt" };
  if (dist <= 8.5) return { distance: dist, surface: "gravel" };
  if (dist <= 12) return { distance: dist, surface: "grass" };
  return { distance: dist, surface: "grass" };
}
