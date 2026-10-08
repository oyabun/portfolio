#!/usr/bin/env node
// Regenerates src/cli/logo.js — the ANSI half-block art baked into `figx
// --help` — from a source SVG. Not run automatically; the help screen reads
// the already-generated src/cli/logo.js so startup doesn't need to load the
// WASM SVG renderer just to print usage.
//
// Usage: node scripts/gen-logo.mjs <path-to-logo.svg> [widthInColumns]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rasterize, toAnsiHalfBlockLines } from '../src/cli/termImage.js';

const [svgPath, widthArg] = process.argv.slice(2);
if (!svgPath) {
  console.error('usage: node scripts/gen-logo.mjs <path-to-logo.svg> [widthInColumns]');
  process.exit(1);
}

const width = widthArg ? Number(widthArg) : 24;
const svg = readFileSync(svgPath, 'utf8');
const raster = await rasterize(svg, { maxCols: width, maxRows: 1000 });
const lines = toAnsiHalfBlockLines(raster);

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outPath = join(root, 'src/cli/logo.js');
const js = `// Precomputed ANSI half-block art for the figx mascot logo (source:
// the project's fig.svg), baked in at build time rather than rasterized at
// startup -- printing --help shouldn't need to load the WASM SVG renderer.
// Regenerate with: node scripts/gen-logo.mjs <path-to-logo.svg>
export const LOGO_LINES = ${JSON.stringify(lines, null, 2)};

export const LOGO_WIDTH = ${raster.width};
`;
writeFileSync(outPath, js);
console.log(`wrote ${lines.length} lines (width ${raster.width}) -> ${outPath}`);
