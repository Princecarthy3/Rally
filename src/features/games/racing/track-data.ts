import { CheckpointData, SurfaceType } from "./types";

// Dirt Forest Stage Track Loop Waypoints [x, y, z]
export const TRACK_WAYPOINTS: Array<[number, number, number]> = [
  [0, 0, 0],         // Start Line
  [0, 0, 40],        // Straight stretch
  [15, 1.5, 80],     // Gentle right uphill
  [45, 3.0, 110],    // Sweeping right turn
  [80, 2.0, 100],    // Crest
  [110, 0.5, 70],    // Downhill curve
  [120, 0.0, 30],    // Sharp right hairpin
  [100, -1.0, -20],  // Lower valley
  [65, -0.5, -60],   // S-curve entrance
  [25, 0.5, -80],    // S-curve apex
  [-25, 2.0, -70],   // Hill climb curve
  [-65, 3.5, -40],   // High ridge turn
  [-90, 2.5, 0],     // Downhill sweeping left
  [-80, 1.0, 45],    // Muddy chicane
  [-50, 0.2, 75],    // Final sector turn
  [-20, 0.0, 40],    // Final straight approach
];

// Checkpoint gates along the stage
export const CHECKPOINTS: CheckpointData[] = [
  { index: 1, position: [15, 1.5, 80], radius: 14, name: "Forest Gate 1" },
  { index: 2, position: [110, 0.5, 70], radius: 14, name: "Hairpin Bend" },
  { index: 3, position: [65, -0.5, -60], radius: 14, name: "Valley Checkpoint" },
  { index: 4, position: [-65, 3.5, -40], radius: 14, name: "High Ridge" },
  { index: 5, position: [0, 0, 0], radius: 12, name: "Finish Arch" }
];

export const START_GRID_SLOTS: Array<{ position: [number, number, number]; rotation: number }> = [
  { position: [-3, 0.1, -12], rotation: 0 },
  { position: [3, 0.1, -12], rotation: 0 },
  { position: [-3, 0.1, -22], rotation: 0 },
  { position: [3, 0.1, -22], rotation: 0 }
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
  if (dist <= 7.0) return { distance: dist, surface: "dirt" };
  if (dist <= 10.0) return { distance: dist, surface: "gravel" };
  return { distance: dist, surface: "grass" };
}
