"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export function Car3D({
  position,
  rotation,
  speed = 0,
  isDrifting = false,
  color = "#ff4d4d",
  steerAngle = 0
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  speed?: number;
  isDrifting?: boolean;
  color?: string;
  steerAngle?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const frontLeftWheelRef = useRef<THREE.Mesh>(null);
  const frontRightWheelRef = useRef<THREE.Mesh>(null);
  const rearLeftWheelRef = useRef<THREE.Mesh>(null);
  const rearRightWheelRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth transform updates
    groupRef.current.position.set(position[0], position[1], position[2]);
    groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);

    // Wheel rotation & steering angle
    const wheelRotSpeed = (speed * delta * 0.15);
    if (frontLeftWheelRef.current) {
      frontLeftWheelRef.current.rotation.x += wheelRotSpeed;
      frontLeftWheelRef.current.rotation.y = steerAngle * 0.45;
    }
    if (frontRightWheelRef.current) {
      frontRightWheelRef.current.rotation.x += wheelRotSpeed;
      frontRightWheelRef.current.rotation.y = steerAngle * 0.45;
    }
    if (rearLeftWheelRef.current) {
      rearLeftWheelRef.current.rotation.x += wheelRotSpeed;
    }
    if (rearRightWheelRef.current) {
      rearRightWheelRef.current.rotation.x += wheelRotSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Car Chassis Body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.7, 0.55, 3.2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Cabin Roof */}
      <mesh position={[0, 0.85, -0.2]} castShadow>
        <boxGeometry args={[1.3, 0.48, 1.6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Windshield Glass */}
      <mesh position={[0, 0.88, 0.5]} rotation={[0.4, 0, 0]}>
        <planeGeometry args={[1.2, 0.6]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.7} roughness={0.1} />
      </mesh>

      {/* Rally Rear Spoiler */}
      <mesh position={[0, 1.15, -1.45]} castShadow>
        <boxGeometry args={[1.6, 0.1, 0.45]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-0.6, 0.9, -1.45]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.6, 0.9, -1.45]} castShadow>
        <boxGeometry args={[0.1, 0.4, 0.2]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.6, 0.45, 1.61]}>
        <boxGeometry args={[0.3, 0.18, 0.05]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0.6, 0.45, 1.61]}>
        <boxGeometry args={[0.3, 0.18, 0.05]} />
        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={0.9} />
      </mesh>

      {/* 4 Rally Wheels */}
      {/* Front Left Wheel */}
      <mesh ref={frontLeftWheelRef} position={[-0.92, 0.25, 0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Front Right Wheel */}
      <mesh ref={frontRightWheelRef} position={[0.92, 0.25, 0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Rear Left Wheel */}
      <mesh ref={rearLeftWheelRef} position={[-0.92, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Rear Right Wheel */}
      <mesh ref={rearRightWheelRef} position={[0.92, 0.25, -0.95]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.3, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Drift Dust Trail Effect */}
      {isDrifting && (
        <group position={[0, 0.1, -1.6]}>
          <mesh position={[-0.6, 0.1, 0]}>
            <sphereGeometry args={[0.45, 8, 8]} />
            <meshBasicMaterial color="#d97706" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.6, 0.1, 0]}>
            <sphereGeometry args={[0.45, 8, 8]} />
            <meshBasicMaterial color="#d97706" transparent opacity={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
}
