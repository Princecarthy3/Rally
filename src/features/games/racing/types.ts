export type SurfaceType = "asphalt" | "dirt" | "gravel" | "mud" | "grass";

export interface CarTransform {
  seat: number;
  playerId: string;
  displayName: string;
  position: [number, number, number];
  rotation: [number, number, number]; // [pitch, yaw, roll]
  speed: number; // km/h
  isDrifting: boolean;
  currentCheckpoint: number;
  currentLap: number;
  progressDistance: number;
  lapTime: number;
  finished: boolean;
  finishTime?: number;
}

export interface CheckpointData {
  index: number;
  position: [number, number, number];
  radius: number;
  name: string;
}

export interface TouchInputState {
  steerLeft: boolean;
  steerRight: boolean;
  accelerate: boolean;
  brake: boolean;
  handbrake: boolean;
}

export interface RaceResult {
  seat: number;
  player_id: string;
  position: number;
  time: number;
  finished_at?: string;
}
