#!/usr/bin/env node
// Bundles the decode/render engine (src/browser-engine.js -> decode.js +
// render.js + tree.js + path.js + fflate/fzstd/kiwi-schema) for the browser,
// so docs/index.html can decode and render .fig files entirely client-side —
// no server, which is what makes it deployable as a static GitHub Pages (or
// Cloudflare Pages, etc.) site.
//
// The output is checked into the repo (docs/libs/figx-engine.js — libs/, not
// assets/, since it's compiled code rather than a media asset) since GitHub
// Pages serves files as-is with no build step of its own. Re-run this (and
// commit the result) whenever decode.js/render.js/tree.js/path.js/tokens.js
// change.
//
// Usage: node scripts/build-docs-engine.mjs

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outfile = join(root, 'docs/libs/figx-engine.js');

await build({
  entryPoints: [join(root, 'src/browser-engine.js')],
  outfile,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  minify: true,
});

console.log('built ->', outfile);
