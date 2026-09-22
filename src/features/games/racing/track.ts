/** Forest Run track: centerline waypoints + checkpoints. */

export type Vec3 = [number, number, number];

export const TRACK_CENTERLINE: Vec3[] = [
  [0, 0.2, 0],
  [0, 0.2, -20],
  [8, 0.3, -40],
  [20, 0.2, -55],
  [35, 0.4, -70],
  [40, 0.2, -95],
  [28, 0.3, -115],
  [10, 0.2, -130],
  [-10, 0.3, -145],
  [-25, 0.2, -165],
  [-30, 0.4, -190],
  [-18, 0.2, -210],
  [0, 0.3, -230],
  [15, 0.2, -250],
  [25, 0.3, -270],
  [20, 0.2, -290],
  [5, 0.2, -305],
  [-10, 0.3, -320],
  [-20, 0.2, -340],
  [-15, 0.2, -360],
  [0, 0.2, -380],
];

export const CHECKPOINT_INDICES = [0, 4, 8, 12, 16, TRACK_CENTERLINE.length - 1];
export const CHECKPOINT_COUNT = CHECKPOINT_INDICES.length;

export function nearestTrackProgress(x: number, z: number): { index: number; t: number; progress: number } {
  let best = 0;
  let bestDist = Infinity;
  let bestT = 0;
  for (let i = 0; i < TRACK_CENTERLINE.length - 1; i++) {
    const a = TRACK_CENTERLINE[i];
    const b = TRACK_CENTERLINE[i + 1];
    const abx = b[0] - a[0];
    const abz = b[2] - a[2];
    const apx = x - a[0];
    const apz = z - a[2];
    const ab2 = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, (apx * abx + apz * abz) / ab2));
    const px = a[0] + abx * t;
    const pz = a[2] + abz * t;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestDist) {
      bestDist = d;
      best = i;
      bestT = t;
    }
  }
  const progress = (best + bestT) / (TRACK_CENTERLINE.length - 1);
  return { index: best, t: bestT, progress };
}

export function checkpointReached(cpIndex: number, x: number, z: number, radius = 12): boolean {
  const idx = CHECKPOINT_INDICES[cpIndex];
  if (idx == null) return false;
  const p = TRACK_CENTERLINE[idx];
  const dx = x - p[0];
  const dz = z - p[2];
  return dx * dx + dz * dz <= radius * radius;
}

export function spawnPose(seat: number): { position: Vec3; rotationY: number } {
  const offset = (seat - 1) * 3.2 - 3.2;
  return { position: [offset, 0.4, 4], rotationY: Math.PI };
}
