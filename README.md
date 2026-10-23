# epicycle

Upload an image, pick an edge detector (Sobel or Prewitt), and watch a Fourier epicycle chain trace its edges. Export the animation as a GIF. All processing runs in the browser.

```bash
bun install
bun run dev      # dev server
bun test         # pipeline tests
bun run build    # static build to dist/
```

## Docker

```bash
docker build -t epicycle .
docker run --rm -p 8080:80 epicycle   # http://localhost:8080
```
