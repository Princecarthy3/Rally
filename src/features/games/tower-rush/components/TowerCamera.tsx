"use client";
/* eslint-disable react-hooks/immutability */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ClimberAnimState } from "../types";
import { SUMMIT_ALTITUDE } from "../tower-layout";

/**
 * Camera "feel" for each band of the tower.
 * Values are lerped continuously from the climber's altitude so the
 * view changes on its own as they climb — no button needed.
 */
type CamBand = {
  /** Min altitude for this band */
  y: number;
  /** Orbit distance behind the climber */
  distance: number;
  /** Pitch in radians (higher = more top-down) */
  pitch: number;
  /** Extra height above the climber */
  height: number;
  /** Base FOV */
  fov: number;
  /** How much to look *up* the tower (meters above climber) */
  lookUp: number;
  /** Slow automatic orbit speed (rad/s). 0 = stay behind player */
  autoOrbit: number;
};

/** Bands keyed by altitude — Launch Pad → Summit */
const ALTITUDE_BANDS: CamBand[] = [
  // Launch Pad / base — wide establishing shot of the whole tower start
  { y: 0, distance: 11.5, pitch: 0.48, height: 3.2, fov: 58, lookUp: 4.5, autoOrbit: 0.12 },
  // Section 1 Warm-up — comfortable chase, still see next platforms
  { y: 10, distance: 8.5, pitch: 0.36, height: 2.2, fov: 54, lookUp: 3.0, autoOrbit: 0.08 },
  // Section 2 Precision — tighter, more level so narrow pads are readable
  { y: 22, distance: 7.0, pitch: 0.28, height: 1.8, fov: 50, lookUp: 2.2, autoOrbit: 0.05 },
  // Section 3 Moving Hazards — pull back to frame moving platforms
  { y: 36, distance: 9.2, pitch: 0.34, height: 2.6, fov: 56, lookUp: 2.8, autoOrbit: 0.1 },
  // Section 4 Survival — dramatic, slightly steeper
  { y: 50, distance: 8.0, pitch: 0.4, height: 2.4, fov: 54, lookUp: 2.0, autoOrbit: 0.07 },
  // Final ascent — close and intense
  { y: 62, distance: 6.8, pitch: 0.3, height: 1.6, fov: 50, lookUp: 1.5, autoOrbit: 0.04 },
  // Summit podium — celebratory wide orbit
  { y: 69, distance: 12.0, pitch: 0.52, height: 3.8, fov: 62, lookUp: 0.5, autoOrbit: 0.22 },
];

function sampleBand(altitude: number): CamBand {
  const y = Math.max(0, altitude);
  if (y <= ALTITUDE_BANDS[0].y) return { ...ALTITUDE_BANDS[0] };
  for (let i = 0; i < ALTITUDE_BANDS.length - 1; i++) {
    const a = ALTITUDE_BANDS[i];
    const b = ALTITUDE_BANDS[i + 1];
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / Math.max(0.001, b.y - a.y);
      const smooth = t * t * (3 - 2 * t); // smoothstep
      return {
        y,
        distance: THREE.MathUtils.lerp(a.distance, b.distance, smooth),
        pitch: THREE.MathUtils.lerp(a.pitch, b.pitch, smooth),
        height: THREE.MathUtils.lerp(a.height, b.height, smooth),
        fov: THREE.MathUtils.lerp(a.fov, b.fov, smooth),
        lookUp: THREE.MathUtils.lerp(a.lookUp, b.lookUp, smooth),
        autoOrbit: THREE.MathUtils.lerp(a.autoOrbit, b.autoOrbit, smooth),
      };
    }
  }
  return { ...ALTITUDE_BANDS[ALTITUDE_BANDS.length - 1] };
}

/**
 * Fully automatic climb camera.
 * Changes framing by altitude/section, follows velocity, and only yields
 * to the player while they are actively dragging to look around.
 */
export function TowerCamera({
  targetPos,
  targetVel,
  targetRotationY,
  animState,
  checkpointIdx = 0,
  cameraAngleYRef,
}: {
  targetPos: [number, number, number];
  targetVel: [number, number, number];
  targetRotationY: number;
  animState: ClimberAnimState;
  checkpointIdx?: number;
  cameraAngleYRef: React.MutableRefObject<number>;
}) {
  const { camera, gl } = useThree();
  const yaw = useRef(Math.PI);
  const pitch = useRef(0.36);
  const distance = useRef(9);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const smoothedLook = useRef(new THREE.Vector3(targetPos[0], targetPos[1] + 2, targetPos[2]));
  const smoothedCam = useRef(new THREE.Vector3(targetPos[0], targetPos[1] + 6, targetPos[2] + 10));
  const userOrbitUntil = useRef(0);
  const shakeAmp = useRef(0);
  const smoothedBand = useRef(sampleBand(targetPos[1]));

  useEffect(() => {
    const dom = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      userOrbitUntil.current = performance.now() + 2800;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      yaw.current -= dx * 0.0065;
      pitch.current = Math.max(-0.1, Math.min(1.05, pitch.current + dy * 0.0055));
      cameraAngleYRef.current = yaw.current;
      userOrbitUntil.current = performance.now() + 2800;
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distance.current = Math.max(4.2, Math.min(18, distance.current + e.deltaY * 0.012));
      userOrbitUntil.current = performance.now() + 2000;
    };

    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientX < window.innerWidth * 0.42) return;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      yaw.current -= dx * 0.0075;
      pitch.current = Math.max(-0.1, Math.min(1.05, pitch.current + dy * 0.006));
      cameraAngleYRef.current = yaw.current;
      userOrbitUntil.current = performance.now() + 2800;
    };

    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [gl.domElement, cameraAngleYRef]);

  useFrame((_, delta) => {
    const [tx, ty, tz] = targetPos;
    const [vx, vy, vz] = targetVel;
    const horizSpeed = Math.hypot(vx, vz);
    const falling = animState === "fall" || vy < -4;
    const jumping = animState === "jump" || vy > 2;
    const celebrating = animState === "celebrate" || ty >= SUMMIT_ALTITUDE - 0.5;

    // --- Altitude / section driven camera profile ---
    const targetBand = sampleBand(celebrating ? SUMMIT_ALTITUDE : ty);
    const sectionBoost = Math.min(1, checkpointIdx / 5);
    targetBand.distance += sectionBoost * 0.4;
    targetBand.lookUp += sectionBoost * 0.3;

    const band = smoothedBand.current;
    const bandLerp = Math.min(1, delta * 1.6);
    band.distance = THREE.MathUtils.lerp(band.distance, targetBand.distance, bandLerp);
    band.pitch = THREE.MathUtils.lerp(band.pitch, targetBand.pitch, bandLerp);
    band.height = THREE.MathUtils.lerp(band.height, targetBand.height, bandLerp);
    band.fov = THREE.MathUtils.lerp(band.fov, targetBand.fov, bandLerp);
    band.lookUp = THREE.MathUtils.lerp(band.lookUp, targetBand.lookUp, bandLerp);
    band.autoOrbit = THREE.MathUtils.lerp(band.autoOrbit, targetBand.autoOrbit, bandLerp);

    const userControlling =
      isDragging.current || performance.now() < userOrbitUntil.current;

    if (!userControlling) {
      // Face outward from tower center so structure stays readable
      const radialLen = Math.hypot(tx, tz) || 1;
      const outwardYaw = Math.atan2(tx / radialLen, tz / radialLen);

      let desiredYaw = outwardYaw;
      if (horizSpeed > 0.7) {
        const moveYaw = Math.atan2(vx, vz) + Math.PI;
        desiredYaw = THREE.MathUtils.lerp(outwardYaw, moveYaw, 0.45);
      } else if (celebrating) {
        desiredYaw = yaw.current + band.autoOrbit;
      }

      // Continuous slow orbit while climbing so the view never feels static
      desiredYaw += band.autoOrbit * delta * (falling ? 0.3 : 1);

      let diff = desiredYaw - yaw.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yaw.current += diff * Math.min(1, delta * (celebrating ? 1.2 : 2.0));
      cameraAngleYRef.current = yaw.current;

      let desiredPitch = band.pitch;
      if (falling) desiredPitch = Math.max(0.08, band.pitch - 0.18);
      if (jumping) desiredPitch = band.pitch + 0.12;
      pitch.current += (desiredPitch - pitch.current) * Math.min(1, delta * 2.2);
    }

    let desiredDist = band.distance;
    desiredDist += Math.min(2.8, horizSpeed * 0.28);
    if (falling) desiredDist += Math.min(4.0, Math.abs(vy) * 0.25);
    if (jumping) desiredDist += 1.1;
    if (!userControlling) {
      distance.current += (desiredDist - distance.current) * Math.min(1, delta * 2.8);
    }

    const cosPitch = Math.cos(pitch.current);
    const sinPitch = Math.sin(pitch.current);
    const cosYaw = Math.cos(yaw.current);
    const sinYaw = Math.sin(yaw.current);
    const dist = distance.current;

    const offsetX = dist * cosPitch * sinYaw;
    const offsetY = dist * sinPitch + band.height + (falling ? 0.5 : 0);
    const offsetZ = dist * cosPitch * cosYaw;

    const lookAhead = Math.min(3.2, horizSpeed * 0.4);
    const dirX = horizSpeed > 0.2 ? vx / horizSpeed : -Math.sin(targetRotationY);
    const dirZ = horizSpeed > 0.2 ? vz / horizSpeed : -Math.cos(targetRotationY);
    const lookX = tx + dirX * lookAhead;
    const lookY = ty + 1.2 + band.lookUp + (jumping ? 0.4 : falling ? -0.4 : 0);
    const lookZ = tz + dirZ * lookAhead;

    const desiredCam = new THREE.Vector3(tx + offsetX, ty + offsetY, tz + offsetZ);
    if (desiredCam.y < ty + 1.4) desiredCam.y = ty + 1.4;

    const followRate = falling ? 5.5 : jumping ? 8 : 10;
    smoothedCam.current.lerp(desiredCam, Math.min(1, delta * followRate));

    if (falling && Math.abs(vy) > 8) {
      shakeAmp.current = Math.min(0.32, shakeAmp.current + delta * 0.75);
    } else {
      shakeAmp.current *= Math.max(0, 1 - delta * 6);
    }
    const shake =
      shakeAmp.current > 0.01
        ? new THREE.Vector3(
            (Math.random() - 0.5) * shakeAmp.current,
            (Math.random() - 0.5) * shakeAmp.current * 0.55,
            (Math.random() - 0.5) * shakeAmp.current
          )
        : new THREE.Vector3(0, 0, 0);

    camera.position.copy(smoothedCam.current).add(shake);

    smoothedLook.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1, delta * 9));
    camera.lookAt(smoothedLook.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      let targetFov = band.fov;
      targetFov += Math.min(9, horizSpeed * 0.9);
      if (falling) targetFov += Math.min(12, Math.abs(vy) * 0.85);
      if (celebrating) targetFov = Math.max(targetFov, 62);
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, delta * 4));
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
