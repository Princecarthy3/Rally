export type TowerMatchStage = "countdown" | "racing" | "results";

export type ClimberAnimState = "idle" | "run" | "jump" | "fall" | "celebrate";

export interface ClimberTransform {
  seat: number;
  playerId: string;
  displayName: string;
  color: string;
  isLocal: boolean;
  isBot: boolean;
  position: [number, number, number];
  velocity: [number, number, number];
  rotationY: number;
  isGrounded: boolean;
  animState: ClimberAnimState;
  checkpointIdx: number;
  altitude: number;
  hasFinished: boolean;
  finishTime?: number;
  placement?: number;
}

export interface TowerCheckpoint {
  idx: number;
  name: string;
  sectionName: string;
  position: [number, number, number]; // Center of checkpoint trigger zone
  respawnPos: [number, number, number];
  radius: number;
  color: string;
}

export interface StaticPlatformDef {
  id: string;
  position: [number, number, number];
  size: [number, number, number]; // width, height, depth
  color: string;
  emissive?: string;
  type?: "standard" | "checkpoint" | "summit" | "hazard" | "decaying";
  shape?: "box" | "cylinder";
  section: number;
}

export interface MovingPlatformDef {
  id: string;
  startPos: [number, number, number];
  endPos: [number, number, number];
  size: [number, number, number];
  period: number; // seconds for full cycle
  phaseOffset?: number; // 0 to 1
  color: string;
  section: number;
}

export interface RotatingHazardDef {
  id: string;
  centerPos: [number, number, number];
  length: number;
  thickness: number;
  height: number;
  speed: number; // radians per second
  color: string;
  section: number;
}

export interface DisappearingPlatformDef {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  decayDelay: number; // seconds before vanishing after touched
  respawnTime: number; // seconds before reappearing
  section: number;
}

export interface TowerPlayerPlacement {
  seat: number;
  playerId: string;
  displayName: string;
  color: string;
  placement: number;
  finishTime: number;
  isBot: boolean;
  maxCheckpoint: number;
}

export interface TowerTouchInputs {
  moveX: number;
  moveZ: number;
  jump: boolean;
}
