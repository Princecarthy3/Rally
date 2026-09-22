import { CheckpointData, SurfaceType } from "./types";

// A single, flowing Grand Prix circuit. The route does not cross itself, so
// every section has a clear racing line and there are no overlapping surfaces.
export const TRACK_WAYPOINTS: Array<[number, number, number]> = [
  [0, 0, 0], [0, 0, 48], [22, 0, 88], [65, 0, 112],
  [108, 0, 102], [134, 0, 64], [130, 0, 20], [104, 0, -28],
  [62, 0, -66], [8, 0, -80], [-48, 0, -72], [-94, 0, -42],
  [-118, 0, 2], [-103, 0, 48], [-68, 0, 82], [-28, 0, 66], [-10, 0, 30]
];

// Checkpoint gates along the stage
export const CHECKPOINTS: CheckpointData[] = [
  { index: 1, position: [22, 0, 88], radius: 16, name: "North Bend" },
  { index: 2, position: [134, 0, 64], radius: 16, name: "East Hairpin" },
  { index: 3, position: [62, 0, -66], radius: 16, name: "South Curve" },
  { index: 4, position: [-94, 0, -42], radius: 16, name: "West Bend" },
  { index: 5, position: [0, 0, 0], radius: 12, name: "Finish Arch" }
];

export const START_GRID_SLOTS: Array<{ position: [number, number, number]; rotation: number }> = [
  { position: [-3, 0.1, 8], rotation: 0 },
  { position: [3, 0.1, 8], rotation: 0 },
  { position: [-3, 0.1, 1], rotation: 0 },
  { position: [3, 0.1, 1], rotation: 0 }
];

// Surface friction table
export const SURFACE_FRICTION: Record<SurfaceType, { grip: number; topSpeedRatio: number }> = {
  asphalt: { grip: 1.0, topSpeedRatio: 1.0 },
  dirt: { grip: 0.78, topSpeedRatio: 0.92 },
  gravel: { grip: 0.68, topSpeedRatio: 0.85 },
  mud: { grip: 0.45, topSpeedRatio: 0.70 },
  grass: { grip: 0.52, topSpeedRatio: 0.72 }
};

// Simple procedural terrain height lookup
export function getTerrainHeight(x: number, z: number): number {
  const wave1 = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 2.8;
  const wave2 = Math.sin(x * 0.08 + z * 0.05) * 1.2;
  return Math.max(-2, wave1 + wave2);
}

// Distance from (x, z) to nearest track segment
export function getDistanceToTrack(x: number, z: number): { distance: number; surface: SurfaceType } {
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
  // The visible circuit is a Grand Prix-style asphalt surface. Keep this in
  // sync with the rendered road width so the car feels planted on the tarmac.
  if (dist <= 7.0) return { distance: dist, surface: "asphalt" };
  if (dist <= 10.0) return { distance: dist, surface: "gravel" };
  return { distance: dist, surface: "grass" };
}
