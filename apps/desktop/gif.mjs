/**
 * Assembles the frames captured by record.cjs into docs/media/demo-loop.gif
 * using gifenc (pure JS, no ffmpeg). Delays are tuned so states read clearly.
 *
 * Usage:  node gif.mjs   (after record.cjs)
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;

const here = dirname(fileURLToPath(import.meta.url));
const framesDir = process.env.OM_FRAMES_DIR || join(here, ".om-frames");
const outPath =
  process.env.OM_GIF_OUT || join(here, "..", "..", "docs", "media", "demo-loop.gif");

/** Per-frame hold time in ms; names may carry a suffix from the recorder. */
const delayFor = (name) => {
  if (name.includes("scroll")) return 220;
  if (name.includes("report-")) return 1400;
  if (name.includes("results") || name.includes("stats")) return 1500;
  if (name.includes("home-") || name.includes("objective")) return 1200;
  return 1000;
};

/** Box-filter (averaging) downscale — smooth text and edges, no aliasing. Frames are 1280x800. */
const TARGET_W = 960;
function downscale(rgba, width, height) {
  const targetH = Math.round((height * TARGET_W) / width);
  const out = Buffer.alloc(TARGET_W * targetH * 4);
  for (let y = 0; y < targetH; y += 1) {
    const y0 = Math.floor((y * height) / targetH);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / targetH));
    for (let x = 0; x < TARGET_W; x += 1) {
      const x0 = Math.floor((x * width) / TARGET_W);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / TARGET_W));
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const src = (sy * width + sx) * 4;
          r += rgba[src];
          g += rgba[src + 1];
          b += rgba[src + 2];
          count += 1;
        }
      }
      const dst = (y * TARGET_W + x) * 4;
      out[dst] = Math.round(r / count);
      out[dst + 1] = Math.round(g / count);
      out[dst + 2] = Math.round(b / count);
      out[dst + 3] = 255;
    }
  }
  return { data: out, width: TARGET_W, height: targetH };
}

const files = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
if (files.length === 0) {
  console.error(`no frames found in ${framesDir} — run record.cjs first`);
  process.exit(1);
}

const gif = GIFEncoder();
for (const file of files) {
  const png = await readFile(join(framesDir, file));
  const image = PNG.sync.read(png);
  const scaled = downscale(image.data, image.width, image.height);
  const rgba = scaled.data;
  const palette = quantize(rgba, 256, { format: "rgb565" });
  const index = applyPalette(rgba, palette, "rgb565");
  gif.writeFrame(index, scaled.width, scaled.height, { palette, delay: delayFor(file) });
  console.log(`encoded ${file} (${scaled.width}x${scaled.height})`);
}
gif.finish();

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, gif.bytes());
const sizeKb = Math.round(gif.bytes().length / 1024);
console.log(`wrote ${outPath} (${sizeKb} KB, ${files.length} frames)`);
