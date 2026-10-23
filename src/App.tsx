import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { OPERATORS, type EdgeConfig, type OperatorId, type Raster } from "./edges";
import { encodeGif } from "./gif";
import { drawFrame } from "./render";
import { buildScene, loadRaster, spectrum } from "./scene";

const DISPLAY_SIDE = 560;

type Export = { status: "idle" } | { status: "encoding"; progress: number } | { status: "failed"; message: string };

export function App() {
  const [raster, setRaster] = useState<Raster | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<EdgeConfig>({ operator: "sobel", threshold: 0.3, maxPoints: 1500 });
  const [harmonics, setHarmonics] = useState(400);
  const [exportState, setExportState] = useState<Export>({ status: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const deferredConfig = useDeferredValue(config);
  const terms = useMemo(() => (raster ? spectrum(raster, deferredConfig) : []), [raster, deferredConfig]);
  const used = Math.min(harmonics, terms.length);
  const deferredUsed = useDeferredValue(used);
  const scene = useMemo(() => (raster && terms.length > 0 ? buildScene(raster, terms, deferredUsed) : null), [raster, terms, deferredUsed]);
  const scale = scene ? DISPLAY_SIDE / Math.max(scene.width, scene.height) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!scene || !canvas) return;
    canvas.width = Math.round(scene.width * scale);
    canvas.height = Math.round(scene.height * scale);
    const ctx = canvas.getContext("2d")!;
    let step = 0;
    let frame = requestAnimationFrame(function tick() {
      drawFrame(ctx, scene, step, scale);
      step = (step + 1) % scene.trail.length;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [scene, scale]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setRaster(await loadRaster(file));
      setLoadError(null);
    } catch {
      setLoadError("Could not read that file as an image.");
    }
  }

  async function onDownload() {
    if (!scene) return;
    setExportState({ status: "encoding", progress: 0 });
    try {
      const blob = await encodeGif(scene, scale, (progress) => setExportState({ status: "encoding", progress }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "epicycle.gif";
      a.click();
      URL.revokeObjectURL(url);
      setExportState({ status: "idle" });
    } catch (e) {
      setExportState({ status: "failed", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <main>
      <h1>Epicycle</h1>
      <form onSubmit={(e) => e.preventDefault()}>
        <label>
          Image
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {loadError && <p className="hint">{loadError}</p>}
        <fieldset>
          <legend>Edge operator</legend>
          {(Object.keys(OPERATORS) as OperatorId[]).map((id) => (
            <label key={id}>
              <input
                type="radio"
                name="operator"
                checked={config.operator === id}
                onChange={() => setConfig({ ...config, operator: id })}
              />
              {OPERATORS[id].label}
            </label>
          ))}
        </fieldset>
        <label>
          Threshold: {Math.round(config.threshold * 100)}% of strongest nearby edge
          <input
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={config.threshold}
            onChange={(e) => setConfig({ ...config, threshold: Number(e.target.value) })}
          />
        </label>
        <label>
          Max edge points: {config.maxPoints}
          <input
            type="range"
            min={100}
            max={3000}
            step={50}
            value={config.maxPoints}
            onChange={(e) => setConfig({ ...config, maxPoints: Number(e.target.value) })}
          />
        </label>
        <label>
          Epicycles: {used} of {terms.length}
          <input
            type="range"
            min={1}
            max={Math.max(1, terms.length)}
            value={used}
            disabled={terms.length === 0}
            onChange={(e) => setHarmonics(Number(e.target.value))}
          />
        </label>
        <button type="button" disabled={!scene || exportState.status === "encoding"} onClick={onDownload}>
          {exportState.status === "encoding" ? `Encoding ${Math.round(exportState.progress * 100)}%` : "Download GIF"}
        </button>
        {exportState.status === "failed" && <p className="hint">GIF export failed: {exportState.message}</p>}
      </form>
      <section className="stage">
        {scene ? (
          <canvas ref={canvasRef} />
        ) : (
          <p className="hint">
            {raster ? "No edges at this threshold. Lower it." : "Upload an image to start. It never leaves your machine."}
          </p>
        )}
      </section>
    </main>
  );
}
