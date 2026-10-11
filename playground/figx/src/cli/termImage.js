// Render an SVG string inline in the terminal with no external process (no
// `chafa`, no ImageMagick) — rasterized in-process via a WASM build of
// resvg, then emitted as whichever terminal image format the host supports:
// Kitty's graphics protocol, iTerm2's inline-image protocol, or (universal
// fallback) 24-bit ANSI "half block" art, which needs nothing but truecolor
// support.
//
// The WASM module itself ships inside node_modules for a plain `node
// src/cli/cli.js` run; when running from the compiled SEA binary
// (scripts/build-cli.mjs embeds it as a `resvg.wasm` asset) it's pulled from
// there instead, since there is no node_modules to read at that point.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

let resvgApi = null; // lazily-initialized { Resvg }

async function loadWasmBytes() {
  try {
    const sea = await import('node:sea');
    if (sea.isSea?.()) return Buffer.from(sea.getAsset('resvg.wasm'));
  } catch {
    // not running as a single-executable-application; fall through
  }
  const require = createRequire(import.meta.url);
  return readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm'));
}

async function getResvg() {
  if (!resvgApi) {
    const { initWasm, Resvg } = await import('@resvg/resvg-wasm');
    await initWasm(await loadWasmBytes());
    resvgApi = { Resvg };
  }
  return resvgApi;
}

// Figma-canvas-ish dark backdrop transparent pixels are composited against —
// matches the fallback page background in src/render.js (renderPageSvg).
const BACKDROP = [30, 30, 30];

// Rasterize `svgString` to fit within `maxCols` terminal columns / `maxRows`
// rows (each row holds 2 pixel rows via the half-block trick, so the pixel
// budget is maxCols x maxRows*2), preserving the SVG's own aspect ratio.
export async function rasterize(svgString, { maxCols, maxRows }) {
  const { Resvg } = await getResvg();
  const wm = /<svg[^>]*\bwidth="([\d.]+)"/.exec(svgString);
  const hm = /<svg[^>]*\bheight="([\d.]+)"/.exec(svgString);
  const aspect = wm && hm ? Number(hm[1]) / Number(wm[1]) : 1;

  let pxW = maxCols;
  let pxH = Math.round(pxW * aspect);
  const maxPxH = maxRows * 2;
  if (pxH > maxPxH) {
    pxH = maxPxH;
    pxW = Math.max(1, Math.round(pxH / aspect));
  }

  const resvg = new Resvg(svgString, { fitTo: { mode: 'width', value: Math.max(1, pxW) } });
  const img = resvg.render();
  return { width: img.width, height: img.height, pixels: img.pixels, png: img.asPng() };
}

const blend = (r, g, b, a) => [
  Math.round(r * a + BACKDROP[0] * (1 - a)),
  Math.round(g * a + BACKDROP[1] * (1 - a)),
  Math.round(b * a + BACKDROP[2] * (1 - a)),
];

// Two pixel rows per terminal row via the U+2580 "upper half block": its
// foreground paints the top pixel, its background the bottom one. Returns
// one string per terminal row (no trailing newline) so a gallery grid
// (browse.js) can stitch several thumbnails' rows together side by side —
// toAnsiHalfBlocks (below) is just this joined with '\n' for the single-image
// case.
export function toAnsiHalfBlockLines({ width, height, pixels }) {
  const rows = Math.ceil(height / 2);
  const lines = [];
  for (let ry = 0; ry < rows; ry++) {
    const y0 = ry * 2;
    const y1 = Math.min(y0 + 1, height - 1);
    let line = '';
    for (let x = 0; x < width; x++) {
      const ti = (y0 * width + x) * 4;
      const bi = (y1 * width + x) * 4;
      const [tr, tg, tb] = blend(pixels[ti], pixels[ti + 1], pixels[ti + 2], pixels[ti + 3] / 255);
      const [br, bg, bb] = blend(pixels[bi], pixels[bi + 1], pixels[bi + 2], pixels[bi + 3] / 255);
      line += `\x1b[38;2;${tr};${tg};${tb}m\x1b[48;2;${br};${bg};${bb}m▀`;
    }
    lines.push(line + '\x1b[0m');
  }
  return lines;
}

function toAnsiHalfBlocks(raster) {
  return toAnsiHalfBlockLines(raster).join('\n') + '\n';
}

// Center `raster` on a `cellPxW` x `cellPxH` canvas filled with the same
// backdrop toAnsiHalfBlockLines composites transparency against — used to
// give a gallery grid's thumbnails a uniform cell size regardless of each
// node's own aspect ratio, so the grid stays aligned.
export function padRaster(raster, cellPxW, cellPxH) {
  const pixels = new Uint8ClampedArray(cellPxW * cellPxH * 4);
  for (let i = 0; i < cellPxW * cellPxH; i++) {
    pixels[i * 4] = BACKDROP[0];
    pixels[i * 4 + 1] = BACKDROP[1];
    pixels[i * 4 + 2] = BACKDROP[2];
    pixels[i * 4 + 3] = 255;
  }
  const offX = Math.floor((cellPxW - raster.width) / 2);
  const offY = Math.floor((cellPxH - raster.height) / 2);
  for (let y = 0; y < raster.height; y++) {
    const oy = y + offY;
    if (oy < 0 || oy >= cellPxH) continue;
    for (let x = 0; x < raster.width; x++) {
      const ox = x + offX;
      if (ox < 0 || ox >= cellPxW) continue;
      const si = (y * raster.width + x) * 4;
      const di = (oy * cellPxW + ox) * 4;
      pixels[di] = raster.pixels[si];
      pixels[di + 1] = raster.pixels[si + 1];
      pixels[di + 2] = raster.pixels[si + 2];
      pixels[di + 3] = raster.pixels[si + 3];
    }
  }
  return { width: cellPxW, height: cellPxH, pixels };
}

// Delete every image Kitty has placed so far. Plain ANSI screen-clearing
// doesn't reliably drop Kitty's own image storage, so a redraw loop (e.g.
// browse.js flipping between previews) needs this before each new image or
// old ones can bleed through / pile up in the terminal's image buffer.
// Harmless no-op on terminals that don't understand the Kitty protocol.
export function clearKittyImages() {
  process.stdout.write('\x1b_Ga=d,d=A;\x1b\\');
}

// Kitty graphics protocol: transmit-and-display a PNG, base64-chunked (the
// spec caps each chunk at 4096 bytes of base64 payload).
function toKitty(png) {
  const b64 = Buffer.from(png).toString('base64');
  const CHUNK = 4096;
  let out = '';
  for (let i = 0; i < b64.length; i += CHUNK) {
    const chunk = b64.slice(i, i + CHUNK);
    const more = i + CHUNK < b64.length ? 1 : 0;
    out += i === 0 ? `\x1b_Ga=T,f=100,m=${more};${chunk}\x1b\\` : `\x1b_Gm=${more};${chunk}\x1b\\`;
  }
  return out + '\n';
}

// iTerm2 inline-image protocol: width in cells, height auto-scaled to match.
function toITerm2(png, cols) {
  const b64 = Buffer.from(png).toString('base64');
  return `\x1b]1337;File=inline=1;width=${cols};preserveAspectRatio=1;size=${png.length}:${b64}\x07\n`;
}

export function detectProtocol() {
  if (process.env.FIGX_PREVIEW_PROTOCOL) return process.env.FIGX_PREVIEW_PROTOCOL;
  if (process.env.KITTY_WINDOW_ID || /kitty|wezterm/i.test(process.env.TERM || '')) return 'kitty';
  if (process.env.TERM_PROGRAM === 'iTerm.app') return 'iterm2';
  return 'ansi';
}

// Write an already-rasterized image (from `rasterize()`) using whichever
// protocol `detectProtocol()` picks. Split out from `printImage` so callers
// that need custom sizing or a redraw loop (browse.js) can rasterize once
// and reuse this instead of duplicating the protocol dispatch.
export function writeImage(raster, cols) {
  const protocol = detectProtocol();
  if (protocol === 'kitty') process.stdout.write(toKitty(raster.png));
  else if (protocol === 'iterm2') process.stdout.write(toITerm2(raster.png, cols));
  else process.stdout.write(toAnsiHalfBlocks(raster));
}

// Render `svgString` inline in the terminal. `label` (optional) is printed
// as a heading above it — used by the CLI to name which node/page a preview
// belongs to when previewing several in one run.
export async function printImage(svgString, label) {
  if (label) process.stdout.write(`${label}\n`);
  const cols = Math.max(10, (process.stdout.columns || 80) - 2);
  const rows = Math.max(6, (process.stdout.rows || 24) - 4);
  const raster = await rasterize(svgString, { maxCols: cols, maxRows: rows });
  writeImage(raster, cols);
}
