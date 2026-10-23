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
  /** Fraction of the strongest nearby edge a pixel needs to count as an edge, in (0, 1]. */
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

export interface Gradient {
  dx: Float32Array;
  dy: Float32Array;
  magnitude: Float32Array;
}

export function gradient(gray: Float32Array, width: number, height: number, op: Operator): Gradient {
  const dx = new Float32Array(width * height);
  const dy = new Float32Array(width * height);
  const magnitude = new Float32Array(width * height);
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
      const i = y * width + x;
      dx[i] = sx;
      dy[i] = sy;
      magnitude[i] = Math.hypot(sx, sy);
    }
  }
  return { dx, dy, magnitude };
}

/** Keeps only pixels that peak across the edge, thinning ridges to 1px. */
export function suppressNonMaxima({ dx, dy, magnitude }: Gradient, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const m = magnitude[i]!;
      if (m === 0) continue;
      // Neighbour offset along the gradient, quantised to 0°, 45°, 90° or 135°.
      const angle = ((Math.atan2(dy[i]!, dx[i]!) * 180) / Math.PI + 180) % 180;
      const step = angle < 22.5 || angle >= 157.5 ? 1 : angle < 67.5 ? width + 1 : angle < 112.5 ? width : width - 1;
      // Strict on one side so a two-pixel plateau keeps exactly one pixel.
      if (m > magnitude[i - step]! && m >= magnitude[i + step]!) out[i] = m;
    }
  }
  return out;
}

/** Neighbourhood for local contrast, as a fraction of the longer image side. */
const LOCAL_WINDOW = 1 / 8;
/** Edges weaker than this fraction of the global maximum are noise, however quiet their surroundings. */
const NOISE_FLOOR = 0.05;

/** Max over a (2r+1)-square window, computed as two separable 1-D passes. */
export function localMax(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const rows = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(width - 1, x + radius); k++) m = Math.max(m, values[y * width + k]!);
      rows[y * width + x] = m;
    }
  }
  const out = new Float32Array(values.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(height - 1, y + radius); k++) m = Math.max(m, rows[k * width + x]!);
      out[y * width + x] = m;
    }
  }
  return out;
}

export function edgePoints(raster: Raster, config: EdgeConfig): Point[] {
  const { width, height } = raster;
  const mag = suppressNonMaxima(gradient(grayscale(raster), width, height, OPERATORS[config.operator]), width, height);
  let max = 0;
  for (const m of mag) max = Math.max(max, m);
  if (max === 0) return [];
  // Thresholding against the local maximum keeps low-contrast regions that a global cutoff would drop.
  const nearby = localMax(mag, width, height, Math.max(1, Math.round(Math.max(width, height) * LOCAL_WINDOW)));
  const floor = max * NOISE_FLOOR;
  const points: Point[] = [];
  for (let i = 0; i < mag.length; i++) {
    if (mag[i]! >= floor && mag[i]! >= nearby[i]! * config.threshold) points.push({ x: i % width, y: Math.floor(i / width) });
  }
  if (points.length <= config.maxPoints) return points;
  const stride = points.length / config.maxPoints;
  return Array.from({ length: config.maxPoints }, (_, i) => points[Math.floor(i * stride)]!);
}
