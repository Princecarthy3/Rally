import { CarTransform, TouchInputState } from "./types";
import { CHECKPOINTS, getDistanceToTrack, getTerrainHeight, SURFACE_FRICTION, TOTAL_LAPS } from "./track-data";

export interface KeyInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

/**
 * Arcade vehicle physics inspired by Trigger Rally:
 * - Powerband-style acceleration (strong mid-range, softens near top speed)
 * - Lateral slip / drift when steering or handbraking
 * - Surface grip from asphalt / gravel / grass
 * - Light suspension pitch & roll from terrain samples
 * - Sequential checkpoint + lap progress
 */
export class ArcadeVehiclePhysics {
  public position: [number, number, number];
  public rotation: [number, number, number]; // [pitch, yaw, roll]
  public speed: number = 0; // km/h (forward component)
  public isDrifting: boolean = false;
  public currentCheckpoint: number = 0;
  public currentLap: number = 1;
  public progressDistance: number = 0;
  public finished: boolean = false;
  public finishTime: number = 0;
  /** Engine RPM 0–1 for HUD / audio (Trigger Rally style) */
  public rpmNorm: number = 0;
  /** Simulated gear 1–5 */
  public gear: number = 1;

  private maxSpeed: number = 138;
  private maxReverseSpeed: number = -32;
  private accelPower: number = 82;
  private brakePower: number = 115;
  private friction: number = 22;
  private turnSpeed: number = 2.55;
  /** Lateral (sideways) velocity in m/s — enables real drift feel */
  private lateralVel = 0;

  constructor(initialPos: [number, number, number], initialYaw: number) {
    this.position = [...initialPos];
    this.rotation = [0, initialYaw, 0];
  }

  public update(
    dt: number,
    keys: KeyInputState,
    touch: TouchInputState,
    controlsEnabled: boolean
  ): {
    position: [number, number, number];
    rotation: [number, number, number];
    speed: number;
    isDrifting: boolean;
  } {
    if (!controlsEnabled) {
      this.speed = Math.max(0, this.speed - this.friction * dt * 2);
      this.lateralVel *= Math.max(0, 1 - 4 * dt);
      this.rpmNorm = Math.max(0, this.rpmNorm - dt * 1.5);
      return {
        position: this.position,
        rotation: this.rotation,
        speed: this.speed,
        isDrifting: false,
      };
    }

    const forwardInput =
      (keys.forward || touch.accelerate ? 1 : 0) -
      (keys.backward || touch.brake ? 1 : 0);
    const steerInput =
      (keys.left || touch.steerLeft ? 1 : 0) -
      (keys.right || touch.steerRight ? 1 : 0);
    const handbrake = keys.handbrake || touch.handbrake;

    const surfaceInfo = getDistanceToTrack(this.position[0], this.position[2]);
    const frictionData = SURFACE_FRICTION[surfaceInfo.surface];
    const topSpeed = this.maxSpeed * frictionData.topSpeedRatio;
    const grip = frictionData.grip;

    // --- Trigger Rally–style powerband: strong mid, soft near redline ---
    const speedRatio = Math.min(1, Math.abs(this.speed) / Math.max(1, topSpeed));
    const powerband =
      speedRatio < 0.15
        ? 0.55 + speedRatio * 3
        : speedRatio < 0.7
          ? 1.0
          : 1.0 - (speedRatio - 0.7) * 1.4;

    if (forwardInput > 0) {
      this.speed = Math.min(
        topSpeed,
        this.speed + this.accelPower * grip * powerband * dt
      );
    } else if (forwardInput < 0) {
      if (this.speed > 5) {
        this.speed = Math.max(0, this.speed - this.brakePower * dt);
      } else {
        this.speed = Math.max(
          this.maxReverseSpeed,
          this.speed - this.accelPower * 0.55 * grip * dt
        );
      }
    } else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    }

    const absSpeed = Math.abs(this.speed);
    this.gear = Math.min(5, Math.max(1, Math.floor(absSpeed / 28) + 1));
    const gearFloor = (this.gear - 1) * 28;
    const gearCeil = this.gear * 28;
    this.rpmNorm = Math.min(
      1,
      Math.max(0.08, (absSpeed - gearFloor) / Math.max(8, gearCeil - gearFloor))
    );
    if (forwardInput <= 0) this.rpmNorm *= 0.85;

    const wantDrift =
      (handbrake && absSpeed > 28 && Math.abs(steerInput) > 0.15) ||
      (surfaceInfo.surface !== "asphalt" && absSpeed > 45 && Math.abs(steerInput) > 0.5);
    this.isDrifting = wantDrift;

    if (handbrake && absSpeed > 8) {
      this.speed *= 1 - 0.22 * dt;
    }

    if (absSpeed > 1) {
      const speedFactor = 1 - Math.min(0.45, speedRatio * 0.42);
      const driftMul = this.isDrifting ? 1.65 : 1.0;
      const turnDir = this.speed >= 0 ? 1 : -1;
      this.rotation[1] +=
        steerInput * this.turnSpeed * turnDir * speedFactor * driftMul * grip * dt;
    }

    const targetLateral =
      steerInput *
      (this.isDrifting ? 9.5 : 3.2) *
      Math.min(1, absSpeed / 60) *
      (this.speed >= 0 ? 1 : -1);
    const latGrip = this.isDrifting ? 1.8 * grip : 7.5 * grip;
    this.lateralVel += (targetLateral - this.lateralVel) * Math.min(1, latGrip * dt);
    if (Math.abs(steerInput) < 0.05 && !handbrake) {
      this.lateralVel *= Math.max(0, 1 - 6 * grip * dt);
    }

    const speedMS = (this.speed * 1000) / 3600;
    const yaw = this.rotation[1];
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    this.position[0] += (forwardX * speedMS + rightX * this.lateralVel) * dt;
    this.position[2] += (forwardZ * speedMS + rightZ * this.lateralVel) * dt;

    const groundY = getTerrainHeight(this.position[0], this.position[2]);
    this.position[1] = groundY + 0.35;

    const frontY = getTerrainHeight(
      this.position[0] + forwardX * 1.5,
      this.position[2] + forwardZ * 1.5
    );
    const rightY = getTerrainHeight(
      this.position[0] + rightX * 1.5,
      this.position[2] + rightZ * 1.5
    );
    this.rotation[0] = Math.atan2(groundY - frontY, 1.5) * 0.45;
    this.rotation[2] = Math.atan2(groundY - rightY, 1.5) * 0.35;

    this.updateProgress();

    return {
      position: this.position,
      rotation: this.rotation,
      speed: this.speed,
      isDrifting: this.isDrifting,
    };
  }

  private updateProgress() {
    const nextCpIndex = (this.currentCheckpoint % CHECKPOINTS.length) + 1;
    const nextCp = CHECKPOINTS.find((c) => c.index === nextCpIndex);

    if (nextCp) {
      const dx = this.position[0] - nextCp.position[0];
      const dz = this.position[2] - nextCp.position[2];
      if (Math.hypot(dx, dz) <= nextCp.radius) {
        this.currentCheckpoint = nextCp.index;
      }
    }

    if (this.currentCheckpoint === CHECKPOINTS.length && this.currentLap < TOTAL_LAPS) {
      this.currentLap += 1;
      this.currentCheckpoint = 0;
    } else if (
      this.currentCheckpoint === CHECKPOINTS.length &&
      this.currentLap === TOTAL_LAPS
    ) {
      this.finished = true;
    }

    this.progressDistance =
      (this.currentLap - 1) * CHECKPOINTS.length * 10000 +
      this.currentCheckpoint * 10000 +
      Math.abs(this.speed);
  }
}
