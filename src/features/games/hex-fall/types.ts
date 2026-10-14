export type TileState = "intact" | "decaying" | "fallen";

export type HexTile = {
  id: string;
  floor: number;
  q: number;
  r: number;
  x: number;
  y: number;
  z: number;
  state: TileState;
  decayStartTime?: number;
};

export type RunnerAnimState = "idle" | "run" | "jump" | "fall" | "dive" | "eliminated";

export type HexRunnerTransform = {
  seat: number;
  playerId: string;
  displayName: string;
  color: string;
  isLocal: boolean;
  isBot: boolean;
  position: [number, number, number];
  rotationY: number;
  velocity: [number, number, number];
  isGrounded: boolean;
  animState: RunnerAnimState;
  currentFloor: number;
  isEliminated: boolean;
  eliminatedAtFloor?: number;
  placement?: number;
  survivalTime?: number;
};

export type HexMatchStage = "countdown" | "playing" | "results";

export type HexPlayerPlacement = {
  seat: number;
  playerId: string;
  displayName: string;
  color: string;
  placement: number;
  survivalTime: number;
  isBot: boolean;
};

export type HexTouchInputs = {
  moveX: number;
  moveY: number;
  jump: boolean;
  dive: boolean;
};
