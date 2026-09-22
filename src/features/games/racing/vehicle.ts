/** Arcade vehicle physics (lightweight, mobile-friendly). */

export type VehicleInput = {
  accelerate: boolean;
  brake: boolean;
  steer: number;
  handbrake: boolean;
};

export type VehicleState = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  vx: number;
  vz: number;
};

const MAX_SPEED = 42;
const ACCEL = 28;
const BRAKE = 36;
const DRAG = 4.5;
const STEER_RATE = 2.4;
const LATERAL_GRIP = 8;

export function createVehicle(x: number, y: number, z: number, rotY: number): VehicleState {
  return { x, y, z, rotY, speed: 0, vx: 0, vz: 0 };
}

export function stepVehicle(v: VehicleState, input: VehicleInput, dt: number): VehicleState {
  const next = { ...v };
  const forwardX = Math.sin(next.rotY);
  const forwardZ = -Math.cos(next.rotY);

  if (input.accelerate) next.speed += ACCEL * dt;
  if (input.brake) {
    if (next.speed > 0.5) next.speed -= BRAKE * dt;
    else next.speed -= ACCEL * 0.6 * dt;
  }
  if (input.handbrake) next.speed *= Math.max(0, 1 - 2.2 * dt);

  next.speed -= Math.sign(next.speed) * DRAG * dt;
  if (Math.abs(next.speed) < 0.15) next.speed = 0;
  next.speed = Math.max(-MAX_SPEED * 0.35, Math.min(MAX_SPEED, next.speed));

  const steerScale = Math.min(1, Math.abs(next.speed) / 8);
  next.rotY += input.steer * STEER_RATE * steerScale * dt * (next.speed >= 0 ? 1 : -1);

  const targetVx = forwardX * next.speed;
  const targetVz = forwardZ * next.speed;
  const grip = input.handbrake ? LATERAL_GRIP * 0.35 : LATERAL_GRIP;
  next.vx += (targetVx - next.vx) * Math.min(1, grip * dt);
  next.vz += (targetVz - next.vz) * Math.min(1, grip * dt);

  next.x += next.vx * dt;
  next.z += next.vz * dt;
  next.y = 0.35;
  return next;
}
