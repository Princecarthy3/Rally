import {
  STATIC_PLATFORMS,
  MOVING_PLATFORMS,
  ROTATING_HAZARDS,
  DISAPPEARING_PLATFORMS,
  TOWER_CHECKPOINTS,
  getMovingPlatformPos,
  FALL_THRESHOLD_OFFSET,
} from "./tower-layout";
import type { TowerTouchInputs } from "./types";

export const GRAVITY = -26.0;
export const JUMP_VELOCITY = 11.6;
export const RUN_SPEED = 9.5;
export const AIR_CONTROL = 0.85;
export const PLAYER_RADIUS = 0.38;
export const PLAYER_HEIGHT = 1.35;

export interface DisappearingPlatformState {
  state: "intact" | "decaying" | "hidden";
  decayStartTime?: number;
  respawnTime?: number;
}

export interface PhysicsStepResult {
  newPosition: [number, number, number];
  newVelocity: [number, number, number];
  newRotationY: number;
  isGrounded: boolean;
  animState: "idle" | "run" | "jump" | "fall" | "celebrate";
  unlockedCheckpointIdx: number | null;
  hasFallen: boolean;
  respawnPosition?: [number, number, number];
  hitHazard: boolean;
  reachedSummit: boolean;
  touchedDisappearingId?: string;
}

export function updateClimberPhysics({
  currentPos,
  currentVel,
  currentRotationY,
  keysDown,
  touchInputs,
  cameraAngleY,
  delta,
  elapsedSec,
  currentCheckpointIdx,
  disappearingStates,
  hasFinished,
}: {
  currentPos: [number, number, number];
  currentVel: [number, number, number];
  currentRotationY: number;
  keysDown: Set<string>;
  touchInputs: TowerTouchInputs;
  cameraAngleY: number;
  delta: number;
  elapsedSec: number;
  currentCheckpointIdx: number;
  disappearingStates: Record<string, DisappearingPlatformState>;
  hasFinished: boolean;
}): PhysicsStepResult {
  // Clamp delta to avoid tunneling or physics explosions on frame stutter
  const dt = Math.min(delta, 0.05);

  let [px, py, pz] = currentPos;
  let [vx, vy, vz] = currentVel;
  let rotY = currentRotationY;

  // 1. Calculate desired movement direction relative to camera
  let inputX = 0;
  let inputZ = 0;

  // Keyboard inputs
  if (keysDown.has("KeyW") || keysDown.has("ArrowUp")) inputZ -= 1;
  if (keysDown.has("KeyS") || keysDown.has("ArrowDown")) inputZ += 1;
  if (keysDown.has("KeyA") || keysDown.has("ArrowLeft")) inputX -= 1;
  if (keysDown.has("KeyD") || keysDown.has("ArrowRight")) inputX += 1;

  // Add touch joystick inputs
  if (touchInputs.moveX !== 0 || touchInputs.moveZ !== 0) {
    inputX += touchInputs.moveX;
    inputZ += touchInputs.moveZ;
  }

  // Normalize input vector
  const inputMag = Math.sqrt(inputX * inputX + inputZ * inputZ);
  let moveDirX = 0;
  let moveDirZ = 0;

  if (inputMag > 0.05 && !hasFinished) {
    const normX = inputX / Math.max(1, inputMag);
    const normZ = inputZ / Math.max(1, inputMag);

    // Rotate input by camera yaw
    const cosCam = Math.cos(cameraAngleY);
    const sinCam = Math.sin(cameraAngleY);

    moveDirX = normX * cosCam + normZ * sinCam;
    moveDirZ = -normX * sinCam + normZ * cosCam;

    rotY = Math.atan2(moveDirX, moveDirZ);
  }

  // 2. Horizontal Velocity Calculation
  const isMoving = inputMag > 0.05 && !hasFinished;
  const targetSpeed = isMoving ? RUN_SPEED : 0;

  // Smooth acceleration / deceleration
  const accel = 18.0;
  vx += (moveDirX * targetSpeed - vx) * accel * dt;
  vz += (moveDirZ * targetSpeed - vz) * accel * dt;

  // 3. Gravity
  vy += GRAVITY * dt;

  // 4. Proposed next position
  let nextX = px + vx * dt;
  let nextY = py + vy * dt;
  let nextZ = pz + vz * dt;

  let isGrounded = false;
  let platformRideDelta: [number, number, number] = [0, 0, 0];
  let touchedDisappearingId: string | undefined = undefined;

  // 5. Collision with STATIC platforms
  for (const plat of STATIC_PLATFORMS) {
    const halfW = plat.size[0] / 2;
    const halfH = plat.size[1] / 2;
    const halfD = plat.size[2] / 2;

    const topY = plat.position[1] + halfH;
    const bottomY = plat.position[1] - halfH;

    // Check if player's XZ bounding circle overlaps platform
    const minX = plat.position[0] - halfW - PLAYER_RADIUS;
    const maxX = plat.position[0] + halfW + PLAYER_RADIUS;
    const minZ = plat.position[2] - halfD - PLAYER_RADIUS;
    const maxZ = plat.position[2] + halfD + PLAYER_RADIUS;

    if (nextX >= minX && nextX <= maxX && nextZ >= minZ && nextZ <= maxZ) {
      // Landing on top surface
      const prevFeetY = py;
      const nextFeetY = nextY;

      if (prevFeetY >= topY - 0.25 && nextFeetY <= topY + 0.15 && vy <= 0) {
        nextY = topY;
        vy = 0;
        isGrounded = true;
      }
    }
  }

  // 6. Collision with MOVING platforms
  for (const plat of MOVING_PLATFORMS) {
    const curPos = getMovingPlatformPos(plat, elapsedSec);
    const prevPos = getMovingPlatformPos(plat, elapsedSec - dt);
    const platDelta: [number, number, number] = [
      curPos[0] - prevPos[0],
      curPos[1] - prevPos[1],
      curPos[2] - prevPos[2],
    ];

    const halfW = plat.size[0] / 2;
    const halfH = plat.size[1] / 2;
    const halfD = plat.size[2] / 2;

    const topY = curPos[1] + halfH;

    const minX = curPos[0] - halfW - PLAYER_RADIUS;
    const maxX = curPos[0] + halfW + PLAYER_RADIUS;
    const minZ = curPos[2] - halfD - PLAYER_RADIUS;
    const maxZ = curPos[2] + halfD + PLAYER_RADIUS;

    if (nextX >= minX && nextX <= maxX && nextZ >= minZ && nextZ <= maxZ) {
      if (py >= topY - 0.35 && nextY <= topY + 0.25 && vy <= 0) {
        nextY = topY;
        vy = 0;
        isGrounded = true;
        platformRideDelta = platDelta;
      }
    }
  }

  // 7. Collision with DISAPPEARING platforms
  for (const plat of DISAPPEARING_PLATFORMS) {
    const state = disappearingStates[plat.id]?.state || "intact";
    if (state === "hidden") continue; // No collision if disappeared

    const halfW = plat.size[0] / 2;
    const halfH = plat.size[1] / 2;
    const halfD = plat.size[2] / 2;

    const topY = plat.position[1] + halfH;
    const minX = plat.position[0] - halfW - PLAYER_RADIUS;
    const maxX = plat.position[0] + halfW + PLAYER_RADIUS;
    const minZ = plat.position[2] - halfD - PLAYER_RADIUS;
    const maxZ = plat.position[2] + halfD + PLAYER_RADIUS;

    if (nextX >= minX && nextX <= maxX && nextZ >= minZ && nextZ <= maxZ) {
      if (py >= topY - 0.25 && nextY <= topY + 0.15 && vy <= 0) {
        nextY = topY;
        vy = 0;
        isGrounded = true;
        touchedDisappearingId = plat.id;
      }
    }
  }

  // 8. Jump Input
  const wantsJump =
    (keysDown.has("Space") || touchInputs.jump) &&
    isGrounded &&
    !hasFinished;

  if (wantsJump) {
    vy = JUMP_VELOCITY;
    isGrounded = false;
  }

  // Apply moving platform motion
  nextX += platformRideDelta[0];
  nextY += platformRideDelta[1];
  nextZ += platformRideDelta[2];

  // 9. Hazard Collision Check (Spinning Beams)
  let hitHazard = false;
  for (const hazard of ROTATING_HAZARDS) {
    const angle = elapsedSec * hazard.speed;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const halfLen = hazard.length / 2;
    const startX = hazard.centerPos[0] - cosA * halfLen;
    const startZ = hazard.centerPos[2] - sinA * halfLen;
    const endX = hazard.centerPos[0] + cosA * halfLen;
    const endZ = hazard.centerPos[2] + sinA * halfLen;

    // Check vertical overlap
    const beamMinY = hazard.centerPos[1] - hazard.height / 2;
    const beamMaxY = hazard.centerPos[1] + hazard.height / 2;
    const playerFeet = nextY;
    const playerHead = nextY + PLAYER_HEIGHT;

    if (playerHead >= beamMinY && playerFeet <= beamMaxY) {
      // Distance from (nextX, nextZ) to line segment
      const dx = endX - startX;
      const dz = endZ - startZ;
      const lenSq = dx * dx + dz * dz;

      let t = ((nextX - startX) * dx + (nextZ - startZ) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = startX + t * dx;
      const projZ = startZ + t * dz;

      const distSq = (nextX - projX) * (nextX - projX) + (nextZ - projZ) * (nextZ - projZ);
      const hitRadius = PLAYER_RADIUS + hazard.thickness / 2;

      if (distSq < hitRadius * hitRadius) {
        hitHazard = true;
        // Apply knockback impulse
        vx += (nextX - hazard.centerPos[0]) * 12;
        vz += (nextZ - hazard.centerPos[2]) * 12;
        vy = 6.0;
        break;
      }
    }
  }

  // 10. Checkpoint Unlocks
  let unlockedCheckpointIdx: number | null = null;
  for (const cp of TOWER_CHECKPOINTS) {
    if (cp.idx > currentCheckpointIdx) {
      const dx = nextX - cp.position[0];
      const dy = nextY - cp.position[1];
      const dz = nextZ - cp.position[2];
      const distXZ = Math.sqrt(dx * dx + dz * dz);

      if (distXZ <= cp.radius && Math.abs(dy) <= 2.8) {
        unlockedCheckpointIdx = cp.idx;
      }
    }
  }

  // 11. Fall Detection
  const currentCheckpoint = TOWER_CHECKPOINTS[currentCheckpointIdx] || TOWER_CHECKPOINTS[0];
  const fallLimit = currentCheckpoint.position[1] - FALL_THRESHOLD_OFFSET;
  const hasFallen = nextY < fallLimit || nextY < -8.0;

  let respawnPosition: [number, number, number] | undefined = undefined;
  if (hasFallen) {
    respawnPosition = [...currentCheckpoint.respawnPos];
    nextX = respawnPosition[0];
    nextY = respawnPosition[1];
    nextZ = respawnPosition[2];
    vx = 0;
    vy = 0;
    vz = 0;
    isGrounded = true;
  }

  // 12. Summit Reach Check
  const summitCp = TOWER_CHECKPOINTS[TOWER_CHECKPOINTS.length - 1];
  const distToSummit = Math.sqrt(
    (nextX - summitCp.position[0]) ** 2 + (nextZ - summitCp.position[2]) ** 2
  );
  const reachedSummit =
    !hasFinished &&
    nextY >= summitCp.position[1] - 0.5 &&
    distToSummit <= summitCp.radius;

  // 13. Determine Animation State
  let animState: "idle" | "run" | "jump" | "fall" | "celebrate" = "idle";
  if (hasFinished) {
    animState = "celebrate";
  } else if (!isGrounded) {
    animState = vy > 0.5 ? "jump" : "fall";
  } else if (isMoving) {
    animState = "run";
  } else {
    animState = "idle";
  }

  return {
    newPosition: [nextX, nextY, nextZ],
    newVelocity: [vx, vy, vz],
    newRotationY: rotY,
    isGrounded,
    animState,
    unlockedCheckpointIdx,
    hasFallen,
    respawnPosition,
    hitHazard,
    reachedSummit,
    touchedDisappearingId,
  };
}
