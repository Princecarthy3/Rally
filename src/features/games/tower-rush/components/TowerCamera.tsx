"use client";
/* eslint-disable react-hooks/immutability */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ClimberAnimState } from "../types";

/**
 * Dynamic 3rd-person chase camera for Tower Rush.
 * - Follows the climber with velocity-aware look-ahead
 * - Widens FOV when falling / moving fast
 * - Auto-yaws toward movement when the player is running
 * - Drag / touch orbit still works for manual look
 */
export function TowerCamera({
  targetPos,
  targetVel,
  targetRotationY,
  animState,
  cameraAngleYRef,
}: {
  targetPos: [number, number, number];
  targetVel: [number, number, number];
  targetRotationY: number;
  animState: ClimberAnimState;
  cameraAngleYRef: React.MutableRefObject<number>;
}) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0.32);
  const distance = useRef(8.2);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const smoothedLook = useRef(new THREE.Vector3(targetPos[0], targetPos[1] + 1.4, targetPos[2]));
  const smoothedCam = useRef(
    new THREE.Vector3(targetPos[0], targetPos[1] + 6, targetPos[2] + 10)
  );
  const userOrbitUntil = useRef(0);
  const shakeAmp = useRef(0);

  useEffect(() => {
    const dom = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      userOrbitUntil.current = performance.now() + 2200;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      yaw.current -= dx * 0.0065;
      pitch.current = Math.max(-0.15, Math.min(0.95, pitch.current + dy * 0.0055));
      cameraAngleYRef.current = yaw.current;
      userOrbitUntil.current = performance.now() + 2200;
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distance.current = Math.max(4.5, Math.min(16, distance.current + e.deltaY * 0.012));
      userOrbitUntil.current = performance.now() + 1600;
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
      // Right half of screen = camera orbit (left half reserved for joystick)
      if (touch.clientX < window.innerWidth * 0.42) return;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      yaw.current -= dx * 0.0075;
      pitch.current = Math.max(-0.15, Math.min(0.95, pitch.current + dy * 0.006));
      cameraAngleYRef.current = yaw.current;
      userOrbitUntil.current = performance.now() + 2200;
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

    // Auto-yaw toward movement / facing when the player isn't manually orbiting
    if (performance.now() > userOrbitUntil.current && !isDragging.current) {
      let desiredYaw = yaw.current;
      if (horizSpeed > 0.6) {
        desiredYaw = Math.atan2(vx, vz) + Math.PI; // behind the movement vector
      } else {
        desiredYaw = targetRotationY + Math.PI;
      }
      // Shortest-path angle lerp
      let diff = desiredYaw - yaw.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yaw.current += diff * Math.min(1, delta * 2.4);
      cameraAngleYRef.current = yaw.current;

      // Soft pitch toward a comfortable climb angle
      const targetPitch = falling ? 0.12 : jumping ? 0.42 : 0.3;
      pitch.current += (targetPitch - pitch.current) * Math.min(1, delta * 1.8);
    }

    // Distance reacts to vertical motion (pull back on fall / jump)
    const baseDist = 7.4;
    const speedBoost = Math.min(3.2, horizSpeed * 0.35);
    const fallBoost = falling ? Math.min(4.5, Math.abs(vy) * 0.28) : 0;
    const jumpBoost = jumping ? 1.4 : 0;
    const desiredDist = baseDist + speedBoost + fallBoost + jumpBoost;
    distance.current += (desiredDist - distance.current) * Math.min(1, delta * 3.2);

    const cosPitch = Math.cos(pitch.current);
    const sinPitch = Math.sin(pitch.current);
    const cosYaw = Math.cos(yaw.current);
    const sinYaw = Math.sin(yaw.current);
    const dist = distance.current;

    const offsetX = dist * cosPitch * sinYaw;
    const offsetY = dist * sinPitch + 1.6 + (falling ? 0.4 : 0);
    const offsetZ = dist * cosPitch * cosYaw;

    // Look-ahead based on velocity
    const lookAhead = Math.min(3.5, horizSpeed * 0.45);
    const lookX = tx + (horizSpeed > 0.2 ? (vx / (horizSpeed || 1)) * lookAhead : 0);
    const lookY = ty + 1.35 + (jumping ? 0.5 : falling ? -0.35 : 0);
    const lookZ = tz + (horizSpeed > 0.2 ? (vz / (horizSpeed || 1)) * lookAhead : 0);

    const desiredCam = new THREE.Vector3(tx + offsetX, ty + offsetY, tz + offsetZ);
    // Keep camera from clipping under platforms
    if (desiredCam.y < ty + 1.2) desiredCam.y = ty + 1.2;

    const followRate = falling ? 6.5 : jumping ? 9 : 11;
    smoothedCam.current.lerp(desiredCam, Math.min(1, delta * followRate));

    // Light landing / fall shake
    if (falling && Math.abs(vy) > 8) {
      shakeAmp.current = Math.min(0.35, shakeAmp.current + delta * 0.8);
    } else {
      shakeAmp.current *= Math.max(0, 1 - delta * 6);
    }
    const shake =
      shakeAmp.current > 0.01
        ? new THREE.Vector3(
            (Math.random() - 0.5) * shakeAmp.current,
            (Math.random() - 0.5) * shakeAmp.current * 0.6,
            (Math.random() - 0.5) * shakeAmp.current
          )
        : new THREE.Vector3(0, 0, 0);

    camera.position.copy(smoothedCam.current).add(shake);

    smoothedLook.current.lerp(new THREE.Vector3(lookX, lookY, lookZ), Math.min(1, delta * 10));
    camera.lookAt(smoothedLook.current);

    if (camera instanceof THREE.PerspectiveCamera) {
      const baseFov = 52;
      const speedFov = Math.min(10, horizSpeed * 1.1);
      const fallFov = falling ? Math.min(14, Math.abs(vy) * 0.9) : 0;
      const targetFov = baseFov + speedFov + fallFov;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, delta * 4.5));
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
