import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { drawFrame } from "./render";
import type { Scene } from "./scene";

const FRAMES = 150;
const DELAY_MS = 40;

/** Renders one full cycle offscreen and encodes it; yields between frames to keep the UI live. */
export async function encodeGif(scene: Scene, scale: number, onProgress: (fraction: number) => void): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(scene.width * scale);
  canvas.height = Math.round(scene.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const gif = GIFEncoder();
  for (let f = 0; f < FRAMES; f++) {
    const step = Math.min(scene.trail.length - 1, Math.round(((f + 1) / FRAMES) * scene.trail.length));
    drawFrame(ctx, scene, step, scale);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 64);
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay: DELAY_MS });
    onProgress((f + 1) / FRAMES);
    await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
