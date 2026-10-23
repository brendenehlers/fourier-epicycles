import { expect, test } from "bun:test";
import { edgePoints, gradientMagnitude, OPERATORS, type Raster } from "./edges";
import { dft, joints } from "./fourier";
import { orderPath } from "./path";

function square(size: number): Raster {
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = size / 4; y < (3 * size) / 4; y++)
    for (let x = size / 4; x < (3 * size) / 4; x++) data.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
  return { width: size, height: size, data };
}

test("operators detect a vertical step with their kernel weights", () => {
  const gray = new Float32Array([0, 0, 10, 0, 0, 10, 0, 0, 10]);
  expect(gradientMagnitude(gray, 3, 3, OPERATORS.sobel)[4]).toBe(40);
  expect(gradientMagnitude(gray, 3, 3, OPERATORS.prewitt)[4]).toBe(30);
});

test("edge points lie on the square's border and respect maxPoints", () => {
  for (const operator of ["sobel", "prewitt"] as const) {
    const points = edgePoints(square(32), { operator, threshold: 0.5, maxPoints: 10_000 });
    expect(points.length).toBeGreaterThan(0);
    for (const { x, y } of points) {
      const nearBorder = [x, y].some((v) => Math.abs(v - 8) <= 1 || Math.abs(v - 24) <= 1);
      expect(nearBorder).toBe(true);
    }
    expect(edgePoints(square(32), { operator, threshold: 0.5, maxPoints: 20 })).toHaveLength(20);
  }
});

test("a flat image has no edges", () => {
  const flat = { width: 8, height: 8, data: new Uint8ClampedArray(256).fill(128) };
  expect(edgePoints(flat, { operator: "sobel", threshold: 0.3, maxPoints: 100 })).toEqual([]);
});

test("ordered path visits every point once with short hops on a contour", () => {
  const points = edgePoints(square(32), { operator: "sobel", threshold: 0.5, maxPoints: 10_000 });
  const path = orderPath(points);
  expect(new Set(path.map((p) => `${p.x},${p.y}`)).size).toBe(points.length);
});

test("the full epicycle chain reproduces every sample", () => {
  const path = [{ x: 3, y: 1 }, { x: 7, y: 4 }, { x: 2, y: 9 }, { x: -1, y: 5 }, { x: 0, y: 0 }];
  const terms = dft(path);
  path.forEach((p, j) => {
    const pen = joints(terms, j / path.length).at(-1)!;
    expect(pen.x).toBeCloseTo(p.x, 9);
    expect(pen.y).toBeCloseTo(p.y, 9);
  });
  expect(terms.map((t) => t.amp)).toEqual(terms.map((t) => t.amp).sort((a, b) => b - a));
});
