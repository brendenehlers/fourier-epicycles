export type Kernel = readonly [number, number, number, number, number, number, number, number, number];

export interface Operator {
  readonly label: string;
  readonly gx: Kernel;
  readonly gy: Kernel;
}

export const OPERATORS = {
  sobel: {
    label: "Sobel",
    gx: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
    gy: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
  },
  prewitt: {
    label: "Prewitt",
    gx: [-1, 0, 1, -1, 0, 1, -1, 0, 1],
    gy: [-1, -1, -1, 0, 0, 0, 1, 1, 1],
  },
} as const satisfies Record<string, Operator>;

export type OperatorId = keyof typeof OPERATORS;

export interface EdgeConfig {
  operator: OperatorId;
  /** Fraction of the strongest gradient a pixel needs to count as an edge, in (0, 1]. */
  threshold: number;
  maxPoints: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Raster {
  width: number;
  height: number;
  /** RGBA bytes, row-major. */
  data: Uint8ClampedArray;
}

export function grayscale({ width, height, data }: Raster): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const a = data[i * 4 + 3]! / 255;
    // Transparent pixels read as white so cut-out images get an outline.
    const lum = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    out[i] = lum * a + 255 * (1 - a);
  }
  return out;
}

export function gradientMagnitude(gray: Float32Array, width: number, height: number, op: Operator): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sx = 0;
      let sy = 0;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const v = gray[(y + ky - 1) * width + (x + kx - 1)]!;
          sx += op.gx[ky * 3 + kx]! * v;
          sy += op.gy[ky * 3 + kx]! * v;
        }
      }
      out[y * width + x] = Math.hypot(sx, sy);
    }
  }
  return out;
}

export function edgePoints(raster: Raster, config: EdgeConfig): Point[] {
  const { width, height } = raster;
  const mag = gradientMagnitude(grayscale(raster), width, height, OPERATORS[config.operator]);
  let max = 0;
  for (const m of mag) max = Math.max(max, m);
  if (max === 0) return [];
  const cutoff = max * config.threshold;
  const points: Point[] = [];
  for (let i = 0; i < mag.length; i++) {
    if (mag[i]! >= cutoff) points.push({ x: i % width, y: Math.floor(i / width) });
  }
  if (points.length <= config.maxPoints) return points;
  const stride = points.length / config.maxPoints;
  return Array.from({ length: config.maxPoints }, (_, i) => points[Math.floor(i * stride)]!);
}
