import type {
  TowerCheckpoint,
  StaticPlatformDef,
  MovingPlatformDef,
  RotatingHazardDef,
  DisappearingPlatformDef,
} from "./types";

export const SUMMIT_ALTITUDE = 70.0;
export const FALL_THRESHOLD_OFFSET = 12.0;

export const TOWER_CHECKPOINTS: TowerCheckpoint[] = [
  {
    idx: 0,
    name: "Ground Base",
    sectionName: "Launch Pad",
    position: [0, 0.5, 0],
    respawnPos: [0, 1.2, 0],
    radius: 7.0,
    color: "#a855f7",
  },
  {
    idx: 1,
    name: "Checkpoint 1",
    sectionName: "Section 1: Warm-up",
    position: [0, 14.2, -5],
    respawnPos: [0, 14.8, -5],
    radius: 3.5,
    color: "#22c55e",
  },
  {
    idx: 2,
    name: "Checkpoint 2",
    sectionName: "Section 2: Precision",
    position: [0, 28.2, 6],
    respawnPos: [0, 28.8, 6],
    radius: 3.2,
    color: "#06b6d4",
  },
  {
    idx: 3,
    name: "Checkpoint 3",
    sectionName: "Section 3: Moving Hazards",
    position: [-6, 44.2, 0],
    respawnPos: [-6, 44.8, 0],
    radius: 3.2,
    color: "#eab308",
  },
  {
    idx: 4,
    name: "Checkpoint 4",
    sectionName: "Section 4: Survival",
    position: [6, 58.2, 0],
    respawnPos: [6, 58.8, 0],
    radius: 3.2,
    color: "#f97316",
  },
  {
    idx: 5,
    name: "The Summit",
    sectionName: "Section 5: Final Ascent",
    position: [0, 70.2, 0],
    respawnPos: [0, 70.8, 0],
    radius: 4.8,
    color: "#fbbf24",
  },
];

export const STATIC_PLATFORMS: StaticPlatformDef[] = [
  // ==========================================
  // SECTION 0: Ground Base
  // ==========================================
  {
    id: "base_platform",
    position: [0, 0, 0],
    size: [14, 1.0, 14],
    color: "#1e1b4b",
    emissive: "#6366f1",
    type: "checkpoint",
    section: 0,
  },

  // ==========================================
  // SECTION 1: WARM-UP (Y: 1 to 14)
  // Wide steps, small gaps, intro jumps
  // ==========================================
  {
    id: "s1_step_1",
    position: [4, 1.8, 2],
    size: [4.2, 0.8, 3.2],
    color: "#3b82f6",
    section: 1,
  },
  {
    id: "s1_step_2",
    position: [6, 3.6, -2],
    size: [3.8, 0.8, 3.0],
    color: "#2563eb",
    section: 1,
  },
  {
    id: "s1_step_3",
    position: [4.5, 5.4, -5.5],
    size: [3.5, 0.8, 3.0],
    color: "#1d4ed8",
    section: 1,
  },
  {
    id: "s1_step_4",
    position: [0, 7.2, -6.5],
    size: [3.6, 0.8, 3.2],
    color: "#38bdf8",
    section: 1,
  },
  {
    id: "s1_step_5",
    position: [-4.5, 9.0, -5.5],
    size: [3.4, 0.8, 3.0],
    color: "#0ea5e9",
    section: 1,
  },
  {
    id: "s1_step_6",
    position: [-5.5, 10.8, -2],
    size: [3.2, 0.8, 3.0],
    color: "#0284c7",
    section: 1,
  },
  {
    id: "s1_step_7",
    position: [-4, 12.6, 1.5],
    size: [3.2, 0.8, 3.0],
    color: "#0369a1",
    section: 1,
  },
  // Checkpoint 1 Pad
  {
    id: "s1_checkpoint_pad",
    position: [0, 14.0, -5],
    size: [6.5, 0.9, 5.5],
    color: "#14532d",
    emissive: "#22c55e",
    type: "checkpoint",
    section: 1,
  },

  // ==========================================
  // SECTION 2: PRECISION (Y: 15 to 28)
  // Narrow beam walkways, elevated diamond stones, longer gaps
  // ==========================================
  {
    id: "s2_beam_1",
    position: [3.2, 15.6, -3],
    size: [1.8, 0.7, 4.0],
    color: "#059669",
    section: 2,
  },
  {
    id: "s2_diamond_1",
    position: [5.2, 17.2, 0.5],
    size: [2.0, 0.7, 2.0],
    color: "#10b981",
    section: 2,
  },
  {
    id: "s2_diamond_2",
    position: [3.5, 18.8, 3.5],
    size: [1.8, 0.7, 1.8],
    color: "#34d399",
    section: 2,
  },
  {
    id: "s2_beam_2",
    position: [0, 20.4, 5.2],
    size: [4.5, 0.7, 1.4],
    color: "#06b6d4",
    section: 2,
  },
  {
    id: "s2_diamond_3",
    position: [-3.8, 22.0, 3.8],
    size: [1.8, 0.7, 1.8],
    color: "#0891b2",
    section: 2,
  },
  {
    id: "s2_beam_3",
    position: [-5.2, 23.6, 0.5],
    size: [1.5, 0.7, 3.8],
    color: "#0e7490",
    section: 2,
  },
  {
    id: "s2_pillar_jump",
    position: [-3.0, 25.4, -2.5],
    size: [1.9, 0.7, 1.9],
    color: "#155e75",
    section: 2,
  },
  {
    id: "s2_catwalk",
    position: [0, 27.0, 1.5],
    size: [2.2, 0.7, 3.5],
    color: "#042f2e",
    section: 2,
  },
  // Checkpoint 2 Pad
  {
    id: "s2_checkpoint_pad",
    position: [0, 28.0, 6],
    size: [5.8, 0.9, 5.0],
    color: "#083344",
    emissive: "#06b6d4",
    type: "checkpoint",
    section: 2,
  },

  // ==========================================
  // SECTION 3: STATIC RESTING PADS
  // (Moving and rotating hazards defined below)
  // ==========================================
  {
    id: "s3_rest_1",
    position: [5.0, 31.5, 4.0],
    size: [2.6, 0.7, 2.6],
    color: "#d97706",
    section: 3,
  },
  {
    id: "s3_rest_2",
    position: [5.0, 36.5, -4.0],
    size: [2.6, 0.7, 2.6],
    color: "#b45309",
    section: 3,
  },
  {
    id: "s3_rest_3",
    position: [-4.0, 40.5, -4.0],
    size: [2.6, 0.7, 2.6],
    color: "#92400e",
    section: 3,
  },
  // Checkpoint 3 Pad
  {
    id: "s3_checkpoint_pad",
    position: [-6, 44.0, 0],
    size: [5.5, 0.9, 5.5],
    color: "#713f12",
    emissive: "#eab308",
    type: "checkpoint",
    section: 3,
  },

  // ==========================================
  // SECTION 4: SURVIVAL STATIC PADS
  // ==========================================
  {
    id: "s4_solid_bridge_1",
    position: [-2.5, 48.0, 3.5],
    size: [2.2, 0.7, 2.2],
    color: "#ea580c",
    section: 4,
  },
  {
    id: "s4_solid_bridge_2",
    position: [2.5, 53.0, 3.5],
    size: [2.2, 0.7, 2.2],
    color: "#c2410c",
    section: 4,
  },
  // Checkpoint 4 Pad
  {
    id: "s4_checkpoint_pad",
    position: [6, 58.0, 0],
    size: [5.5, 0.9, 5.5],
    color: "#7c2d12",
    emissive: "#f97316",
    type: "checkpoint",
    section: 4,
  },

  // ==========================================
  // SECTION 5: FINAL ASCENT & SUMMIT (Y: 59 to 70)
  // Highest jumps, dramatic floating pillars, crowned summit
  // ==========================================
  {
    id: "s5_pillar_1",
    position: [4.2, 60.0, -3.5],
    size: [1.9, 0.7, 1.9],
    color: "#7c3aed",
    section: 5,
  },
  {
    id: "s5_pillar_2",
    position: [0, 62.0, -5.2],
    size: [1.8, 0.7, 1.8],
    color: "#8b5cf6",
    section: 5,
  },
  {
    id: "s5_pillar_3",
    position: [-4.2, 64.0, -3.2],
    size: [1.8, 0.7, 1.8],
    color: "#a855f7",
    section: 5,
  },
  {
    id: "s5_pillar_4",
    position: [-4.0, 66.2, 2.2],
    size: [1.8, 0.7, 1.8],
    color: "#c084fc",
    section: 5,
  },
  {
    id: "s5_final_launch_ramp",
    position: [-1.8, 68.2, 4.0],
    size: [2.4, 0.7, 2.4],
    color: "#f43f5e",
    emissive: "#fb7185",
    section: 5,
  },
  // THE SUMMIT PODIUM
  {
    id: "summit_platform",
    position: [0, 70.0, 0],
    size: [9.0, 1.2, 9.0],
    color: "#451a03",
    emissive: "#f59e0b",
    type: "summit",
    section: 5,
  },
];

// Moving Platforms with deterministic sinusoidal oscillation
export const MOVING_PLATFORMS: MovingPlatformDef[] = [
  // Section 3: Oscillating platforms
  {
    id: "s3_mover_1",
    startPos: [2.0, 29.5, 5.0],
    endPos: [4.5, 30.5, 4.2],
    size: [2.8, 0.6, 2.4],
    period: 4.2,
    phaseOffset: 0,
    color: "#f59e0b",
    section: 3,
  },
  {
    id: "s3_mover_2",
    startPos: [5.0, 33.5, 2.0],
    endPos: [5.0, 34.5, -2.5],
    size: [2.6, 0.6, 2.4],
    period: 4.8,
    phaseOffset: 0.3,
    color: "#eab308",
    section: 3,
  },
  {
    id: "s3_mover_3",
    startPos: [3.5, 38.0, -4.5],
    endPos: [-2.0, 39.2, -4.5],
    size: [2.6, 0.6, 2.4],
    period: 5.2,
    phaseOffset: 0.6,
    color: "#d97706",
    section: 3,
  },
  {
    id: "s3_mover_4",
    startPos: [-4.5, 41.8, -2.0],
    endPos: [-5.8, 43.0, 0],
    size: [2.6, 0.6, 2.4],
    period: 4.0,
    phaseOffset: 0.1,
    color: "#ca8a04",
    section: 3,
  },
  // Section 4: Oscillating hazard platform
  {
    id: "s4_mover_1",
    startPos: [-5.0, 45.8, 1.5],
    endPos: [-3.0, 47.0, 3.0],
    size: [2.4, 0.6, 2.2],
    period: 3.8,
    phaseOffset: 0.2,
    color: "#fb923c",
    section: 4,
  },
  {
    id: "s4_mover_2",
    startPos: [3.0, 54.5, 2.5],
    endPos: [5.5, 56.5, 0.8],
    size: [2.4, 0.6, 2.2],
    period: 4.2,
    phaseOffset: 0.7,
    color: "#f97316",
    section: 4,
  },
];

// Rotating Hazards: lasers & beams spinning around center points
export const ROTATING_HAZARDS: RotatingHazardDef[] = [
  // Section 3: Spinning hazard laser beams
  {
    id: "s3_hazard_beam_1",
    centerPos: [5.0, 32.2, 4.0],
    length: 4.6,
    thickness: 0.28,
    height: 0.45,
    speed: 1.6, // radians/sec
    color: "#ef4444",
    section: 3,
  },
  {
    id: "s3_hazard_beam_2",
    centerPos: [5.0, 37.2, -4.0],
    length: 4.6,
    thickness: 0.28,
    height: 0.45,
    speed: -1.8,
    color: "#ef4444",
    section: 3,
  },
  {
    id: "s3_hazard_beam_3",
    centerPos: [-4.0, 41.2, -4.0],
    length: 4.6,
    thickness: 0.28,
    height: 0.45,
    speed: 2.1,
    color: "#ef4444",
    section: 3,
  },
  // Section 4: Double cross lasers
  {
    id: "s4_hazard_beam_1",
    centerPos: [-2.5, 48.8, 3.5],
    length: 4.2,
    thickness: 0.28,
    height: 0.45,
    speed: 2.4,
    color: "#dc2626",
    section: 4,
  },
  {
    id: "s4_hazard_beam_2",
    centerPos: [2.5, 53.8, 3.5],
    length: 4.2,
    thickness: 0.28,
    height: 0.45,
    speed: -2.5,
    color: "#dc2626",
    section: 4,
  },
];

// Disappearing Platforms (decay when touched, vanish, respawn)
export const DISAPPEARING_PLATFORMS: DisappearingPlatformDef[] = [
  {
    id: "s4_disappear_1",
    position: [-1.0, 49.5, 4.2],
    size: [2.2, 0.5, 2.0],
    color: "#f43f5e",
    decayDelay: 0.75,
    respawnTime: 2.6,
    section: 4,
  },
  {
    id: "s4_disappear_2",
    position: [0.8, 51.2, 4.2],
    size: [2.2, 0.5, 2.0],
    color: "#f43f5e",
    decayDelay: 0.75,
    respawnTime: 2.6,
    section: 4,
  },
];

// Helper to calculate moving platform position at a given time
export function getMovingPlatformPos(
  def: MovingPlatformDef,
  elapsedSec: number
): [number, number, number] {
  const t = (elapsedSec / def.period + (def.phaseOffset || 0)) * Math.PI * 2;
  const factor = (Math.sin(t) + 1) / 2; // 0 to 1
  return [
    def.startPos[0] + (def.endPos[0] - def.startPos[0]) * factor,
    def.startPos[1] + (def.endPos[1] - def.startPos[1]) * factor,
    def.startPos[2] + (def.endPos[2] - def.startPos[2]) * factor,
  ];
}

// Starting spawn coordinates for up to 8 players around the launch circle
export function getTowerStartingPositions(count: number): [number, number, number][] {
  const positions: [number, number, number][] = [];
  const radius = 4.2;
  for (let i = 0; i < count; i++) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2;
    positions.push([
      Math.cos(angle) * radius,
      1.2,
      Math.sin(angle) * radius,
    ]);
  }
  return positions;
}
