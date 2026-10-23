import type { Point } from "./edges";

export interface Term {
  /** Signed integer frequency: rotations per cycle. */
  freq: number;
  amp: number;
  phase: number;
}

/** DFT of the path as complex samples, largest circles first. */
export function dft(path: readonly Point[]): Term[] {
  const n = path.length;
  const terms: Term[] = [];
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < n; j++) {
      const angle = (-2 * Math.PI * k * j) / n;
      const { x, y } = path[j]!;
      re += x * Math.cos(angle) - y * Math.sin(angle);
      im += x * Math.sin(angle) + y * Math.cos(angle);
    }
    re /= n;
    im /= n;
    terms.push({ freq: k <= n / 2 ? k : k - n, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  return terms.sort((a, b) => b.amp - a.amp);
}

/** Centre of every circle at time t in [0, 1); the last joint is the pen. */
export function joints(terms: readonly Term[], t: number): Point[] {
  let x = 0;
  let y = 0;
  const out: Point[] = [{ x, y }];
  for (const { freq, amp, phase } of terms) {
    const a = 2 * Math.PI * freq * t + phase;
    x += amp * Math.cos(a);
    y += amp * Math.sin(a);
    out.push({ x, y });
  }
  return out;
}

export function trace(terms: readonly Term[], steps: number): Point[] {
  return Array.from({ length: steps }, (_, i) => joints(terms, i / steps).at(-1)!);
}
