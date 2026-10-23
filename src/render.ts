import type { Point } from "./edges";
import { joints } from "./fourier";
import type { Scene } from "./scene";

export const COLORS = { background: "#0b0d12", circle: "#5b6b8c", arm: "#c8d3ea", trail: "#ffb347" };

/** Draws the scene at the given step; the live view and the GIF export share this. */
export function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, step: number, scale: number): void {
  const { canvas } = ctx;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.lineWidth = 1 / scale;

  const points = joints(scene.terms, step / scene.trail.length);
  ctx.strokeStyle = COLORS.circle;
  for (let i = 0; i < scene.terms.length; i++) {
    const term = scene.terms[i]!;
    if (term.freq === 0 || term.amp * scale < 0.5) continue;
    const c = points[i]!;
    ctx.beginPath();
    ctx.arc(c.x, c.y, term.amp, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.strokeStyle = COLORS.arm;
  polyline(ctx, points.slice(1));

  ctx.strokeStyle = COLORS.trail;
  ctx.lineWidth = 1.5 / scale;
  polyline(ctx, scene.trail.slice(0, step + 1));
  ctx.restore();
}

function polyline(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}
