import { edgePoints, type EdgeConfig, type Point, type Raster } from "./edges";
import { dft, trace, type Term } from "./fourier";
import { orderPath } from "./path";

const MAX_SIDE = 320;
const STEPS = 600;

export interface Scene {
  terms: Term[];
  /** Pen positions for one full cycle, one per step. */
  trail: Point[];
  width: number;
  height: number;
}

/** Decodes the upload and downscales it so the O(n^2) stages stay interactive. */
export async function loadRaster(file: Blob): Promise<Raster> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(3, Math.round(bitmap.width * scale));
  const height = Math.max(3, Math.round(bitmap.height * scale));
  const ctx = new OffscreenCanvas(width, height).getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

/** Full spectrum of the edge path; computed once per edge config. */
export function spectrum(raster: Raster, config: EdgeConfig): Term[] {
  return dft(orderPath(edgePoints(raster, config)));
}

export function buildScene(raster: Raster, terms: readonly Term[], harmonics: number): Scene {
  const used = terms.slice(0, harmonics);
  return { terms: used, trail: trace(used, STEPS), width: raster.width, height: raster.height };
}
