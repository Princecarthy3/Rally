"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export function TowerCamera({
  targetPos,
  cameraAngleYRef,
}: {
  targetPos: [number, number, number];
  cameraAngleYRef: React.MutableRefObject<number>;
}) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0.25);
  const distance = useRef(7.0);

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const dom = gl.domElement;

    const onMouseDown = (e: MouseEvent) => {
      // Allow mouse drag for camera look
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      yaw.current -= dx * 0.006;
      pitch.current = Math.max(-0.35, Math.min(0.85, pitch.current + dy * 0.005));

      cameraAngleYRef.current = yaw.current;
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    // Touch orbit support
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        // Only drag if not touching virtual joystick (bottom-left)
        if (touch.clientX > window.innerWidth * 0.45) {
          const dx = touch.clientX - touchStartX;
          const dy = touch.clientY - touchStartY;
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;

          yaw.current -= dx * 0.007;
          pitch.current = Math.max(-0.35, Math.min(0.85, pitch.current + dy * 0.006));
          cameraAngleYRef.current = yaw.current;
        }
      }
    };

    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      dom.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [gl.domElement, cameraAngleYRef]);

  useFrame((_, delta) => {
    const [tx, ty, tz] = targetPos;

    // Spherical coordinate offset
    const cosPitch = Math.cos(pitch.current);
    const sinPitch = Math.sin(pitch.current);
    const cosYaw = Math.cos(yaw.current);
    const sinYaw = Math.sin(yaw.current);

    const dist = distance.current;
    const offsetX = dist * cosPitch * sinYaw;
    const offsetY = dist * sinPitch + 1.8;
    const offsetZ = dist * cosPitch * cosYaw;

    const desiredCamPos = new THREE.Vector3(tx + offsetX, ty + offsetY, tz + offsetZ);

    // Smooth camera lerp
    camera.position.lerp(desiredCamPos, delta * 12);
    camera.lookAt(new THREE.Vector3(tx, ty + 1.2, tz));
  });

  return null;
}
