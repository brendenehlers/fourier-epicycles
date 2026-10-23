import type { Point } from "./edges";

/** Greedy nearest-neighbour tour, so the epicycles trace contours instead of raster rows. */
export function orderPath(points: readonly Point[]): Point[] {
  if (points.length === 0) return [];
  const remaining = points.slice();
  const path: Point[] = [remaining.pop()!];
  while (remaining.length > 0) {
    const last = path[path.length - 1]!;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i]!;
      const d = (p.x - last.x) ** 2 + (p.y - last.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    path.push(remaining[best]!);
    remaining[best] = remaining[remaining.length - 1]!;
    remaining.pop();
  }
  return path;
}
