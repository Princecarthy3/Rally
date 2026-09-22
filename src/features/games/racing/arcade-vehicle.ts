import { CarTransform, TouchInputState } from "./types";
import { CHECKPOINTS, getDistanceToTrack, getTerrainHeight, SURFACE_FRICTION, TRACK_WAYPOINTS } from "./track-data";

export interface KeyInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
}

export class ArcadeVehiclePhysics {
  public position: [number, number, number];
  public rotation: [number, number, number]; // [pitch, yaw, roll]
  public speed: number = 0; // km/h
  public isDrifting: boolean = false;
  public currentCheckpoint: number = 0;
  public progressDistance: number = 0;
  public finished: boolean = false;
  public finishTime: number = 0;

  private maxSpeed: number = 135; // km/h
  private maxReverseSpeed: number = -35;
  private accelPower: number = 75;
  private brakePower: number = 110;
  private friction: number = 24;
  private turnSpeed: number = 2.4;

  constructor(initialPos: [number, number, number], initialYaw: number) {
    this.position = [...initialPos];
    this.rotation = [0, initialYaw, 0];
  }

  public update(
    dt: number,
    keys: KeyInputState,
    touch: TouchInputState,
    controlsEnabled: boolean
  ): { position: [number, number, number]; rotation: [number, number, number]; speed: number; isDrifting: boolean } {
    if (!controlsEnabled) {
      this.speed = Math.max(0, this.speed - this.friction * dt * 2);
      return { position: this.position, rotation: this.rotation, speed: this.speed, isDrifting: false };
    }

    const forwardInput = (keys.forward || touch.accelerate ? 1 : 0) - (keys.backward || touch.brake ? 1 : 0);
    // Positive is left and negative is right. The previous right-hand term was
    // negative before subtraction, so both directions turned the car left.
    const steerInput = (keys.left || touch.steerLeft ? 1 : 0) - (keys.right || touch.steerRight ? 1 : 0);
    const handbrake = keys.handbrake || touch.handbrake;

    // Track surface lookup
    const surfaceInfo = getDistanceToTrack(this.position[0], this.position[2]);
    const frictionData = SURFACE_FRICTION[surfaceInfo.surface];
    const topSpeed = this.maxSpeed * frictionData.topSpeedRatio;

    // 1. Acceleration / Braking
    if (forwardInput > 0) {
      this.speed = Math.min(topSpeed, this.speed + this.accelPower * frictionData.grip * dt);
    } else if (forwardInput < 0) {
      if (this.speed > 5) {
        this.speed = Math.max(0, this.speed - this.brakePower * dt);
      } else {
        this.speed = Math.max(this.maxReverseSpeed, this.speed - this.accelPower * 0.6 * dt);
      }
    } else {
      // Natural deceleration / coasting friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.friction * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.friction * dt);
      }
    }

    // 2. Handbrake Drifting
    this.isDrifting = handbrake && Math.abs(this.speed) > 30 && Math.abs(steerInput) > 0.2;
    if (this.isDrifting) {
      this.speed *= (1 - 0.15 * dt);
    }

    // 3. Steering & Yaw Rotation
    if (Math.abs(this.speed) > 1) {
      const speedRatio = Math.min(1, Math.abs(this.speed) / topSpeed);
      const speedFactor = 1 - speedRatio * 0.35;
      const driftMultiplier = this.isDrifting ? 1.55 : 1.0;
      const turnDir = this.speed >= 0 ? 1 : -1;

      this.rotation[1] += steerInput * this.turnSpeed * turnDir * speedFactor * driftMultiplier * dt;
    }

    // 4. Position movement along facing vector
    const speedMS = (this.speed * 1000) / 3600; // convert km/h to m/s
    const dx = Math.sin(this.rotation[1]) * speedMS * dt;
    const dz = Math.cos(this.rotation[1]) * speedMS * dt;

    this.position[0] += dx;
    this.position[2] += dz;

    // 5. Terrain Height Snapping & Pitch/Roll Suspensions
    const groundY = getTerrainHeight(this.position[0], this.position[2]);
    this.position[1] = groundY + 0.35;

    // Sample nearby points for realistic pitch and roll
    const frontY = getTerrainHeight(this.position[0] + Math.sin(this.rotation[1]) * 1.5, this.position[2] + Math.cos(this.rotation[1]) * 1.5);
    const rightY = getTerrainHeight(this.position[0] + Math.cos(this.rotation[1]) * 1.5, this.position[2] - Math.sin(this.rotation[1]) * 1.5);
    
    this.rotation[0] = Math.atan2(groundY - frontY, 1.5) * 0.4; // Pitch
    this.rotation[2] = Math.atan2(groundY - rightY, 1.5) * 0.3; // Roll

    // 6. Checkpoint Progress Tracking
    this.updateProgress();

    return {
      position: this.position,
      rotation: this.rotation,
      speed: this.speed,
      isDrifting: this.isDrifting
    };
  }

  private updateProgress() {
    const nextCpIndex = (this.currentCheckpoint % CHECKPOINTS.length) + 1;
    const nextCp = CHECKPOINTS.find(c => c.index === nextCpIndex);
    
    if (nextCp) {
      const dx = this.position[0] - nextCp.position[0];
      const dz = this.position[2] - nextCp.position[2];
      const dist = Math.hypot(dx, dz);
      
      if (dist <= nextCp.radius) {
        this.currentCheckpoint = nextCp.index;
      }
    }

    // Total distance metric for live rank position
    this.progressDistance = this.currentCheckpoint * 10000 + (this.speed > 0 ? this.position[2] : 0);
  }
}
