"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { CHECKPOINT_INDICES, TRACK_CENTERLINE } from "./track";
import type { VehicleState } from "./vehicle";

export type RemoteRacer = {
  seat: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  finished?: boolean;
};

const CAR_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

/** Canvas 2D chase view — no Three.js (avoids flaky npm installs). */
export function RacingScene({
  localRef,
  remotes,
  localSeat,
}: {
  localRef: MutableRefObject<VehicleState>;
  remotes: RemoteRacer[];
  localSeat: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const remotesRef = useRef(remotes);

  useEffect(() => {
    remotesRef.current = remotes;
  }, [remotes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 400;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const v = localRef.current;
      const scale = 3.2;
      const camX = v.x;
      const camZ = v.z;

      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.45);
      sky.addColorStop(0, "#7dd3fc");
      sky.addColorStop(1, "#bbf7d0");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3d7a3a";
      ctx.fillRect(0, h * 0.35, w, h);

      const worldToScreen = (x: number, z: number) => {
        const dx = (x - camX) * scale;
        const dz = (z - camZ) * scale;
        const c = Math.cos(-v.rotY);
        const s = Math.sin(-v.rotY);
        const rx = dx * c - dz * s;
        const rz = dx * s + dz * c;
        return { sx: w / 2 + rx, sy: h * 0.62 + rz };
      };

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#8B7355";
      ctx.lineWidth = 28;
      ctx.beginPath();
      TRACK_CENTERLINE.forEach((p, i) => {
        const { sx, sy } = worldToScreen(p[0], p[2]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();

      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      TRACK_CENTERLINE.forEach((p, i) => {
        const { sx, sy } = worldToScreen(p[0], p[2]);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      TRACK_CENTERLINE.forEach((p, i) => {
        if (i % 2 !== 0) return;
        for (const side of [-1, 1] as const) {
          const { sx, sy } = worldToScreen(p[0] + side * 12, p[2]);
          ctx.fillStyle = "#5c4033";
          ctx.fillRect(sx - 2, sy - 10, 4, 12);
          ctx.beginPath();
          ctx.fillStyle = "#166534";
          ctx.arc(sx, sy - 14, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      CHECKPOINT_INDICES.forEach((idx, i) => {
        const p = TRACK_CENTERLINE[idx];
        const { sx, sy } = worldToScreen(p[0], p[2]);
        const finish = i === CHECKPOINT_INDICES.length - 1;
        ctx.fillStyle = finish ? "rgba(248,250,252,0.7)" : "rgba(251,191,36,0.65)";
        ctx.fillRect(sx - 18, sy - 4, 36, 8);
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(finish ? "FINISH" : `CP${i}`, sx, sy - 8);
      });

      const drawCar = (x: number, z: number, rotY: number, color: string, label?: string) => {
        const { sx, sy } = worldToScreen(x, z);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rotY - v.rotY);
        ctx.fillStyle = color;
        ctx.fillRect(-7, -12, 14, 24);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(-5, -4, 10, 10);
        ctx.fillStyle = "#111";
        ctx.fillRect(-9, -10, 3, 6);
        ctx.fillRect(6, -10, 3, 6);
        ctx.fillRect(-9, 4, 3, 6);
        ctx.fillRect(6, 4, 3, 6);
        if (label) {
          ctx.fillStyle = "#fff";
          ctx.font = "bold 9px system-ui";
          ctx.textAlign = "center";
          ctx.fillText(label, 0, -16);
        }
        ctx.restore();
      };

      remotesRef.current
        .filter((r) => r.seat !== localSeat)
        .forEach((r) => {
          drawCar(r.x, r.z, r.rotY, CAR_COLORS[(r.seat - 1) % 4], `P${r.seat}`);
        });
      drawCar(v.x, v.z, v.rotY, CAR_COLORS[(localSeat - 1) % 4], "YOU");

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [localRef, localSeat]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none"
      style={{ display: "block", background: "#87CEEB" }}
    />
  );
}
