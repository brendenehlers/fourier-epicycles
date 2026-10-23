import { useEffect, useMemo, useRef } from "react";
import { edgeMaps, edgeMask, OPERATORS, type EdgeConfig, type Raster } from "./edges";

/** Shows each edge-detection stage as a grayscale image. */
export function EdgeStages({ raster, config }: { raster: Raster; config: EdgeConfig }) {
  const maps = useMemo(() => edgeMaps(raster, config.operator), [raster, config.operator]);
  const mask = useMemo(() => edgeMask(maps, config.threshold), [maps, config.threshold]);
  return (
    <section className="stages">
      <MapCanvas title={`${OPERATORS[config.operator].label} magnitude`} values={maps.magnitude} width={maps.width} />
      <MapCanvas title="Thinned, normalized to nearby max" values={maps.normalized} width={maps.width} />
      <MapCanvas title={`Edges at ${Math.round(config.threshold * 100)}%`} values={mask} width={maps.width} />
    </section>
  );
}

function MapCanvas({ title, values, width }: { title: string; values: ArrayLike<number>; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const height = values.length / width;
    canvas.width = width;
    canvas.height = height;
    let max = 0;
    for (let i = 0; i < values.length; i++) max = Math.max(max, values[i]!);
    const image = new ImageData(width, height);
    for (let i = 0; i < values.length; i++) {
      const v = max > 0 ? (values[i]! / max) * 255 : 0;
      image.data.set([v, v, v, 255], i * 4);
    }
    canvas.getContext("2d")!.putImageData(image, 0, 0);
  }, [values, width]);
  return (
    <figure>
      <canvas ref={ref} />
      <figcaption>{title}</figcaption>
    </figure>
  );
}
