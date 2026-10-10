#!/usr/bin/env node
// Compile `figx` (the CLI) into a single standalone binary — no `node` or
// `node_modules` required to run it. Two steps:
//   1. esbuild bundles src/cli/cli.js + everything it imports (decode.js,
//      render.js, tree.js, path.js, termImage.js, and the fflate/fzstd/
//      kiwi-schema/@resvg/resvg-wasm deps) into one CommonJS file — Node's
//      SEA feature currently only supports a single embedded CJS script.
//   2. Node's built-in "single executable application" support blobs that
//      script and postject injects the blob into a copy of the `node`
//      binary itself, producing dist/figx (dist/figx.exe on Windows).
//
// Usage: node scripts/build-cli.mjs
//
// The embedded binary must be an official Node.js build (nodejs.org, nvm,
// Homebrew, the Windows/macOS installers) — some Linux distro packages
// (e.g. Debian/Ubuntu's `nodejs` apt package) strip the SEA injection
// sentinel and can't be used as the base binary. If `node -p process.execPath`
// isn't such a build, point FIGX_BUILD_NODE at one:
//   FIGX_BUILD_NODE=/path/to/official/node npm run build:cli

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const bundlePath = join(dist, 'cli-bundle.cjs');
const blobPath = join(dist, 'sea-prep.blob');
const configPath = join(dist, 'sea-config.json');
const outName = process.platform === 'win32' ? 'figx.exe' : 'figx';
const outPath = join(dist, outName);
const embedNode = process.env.FIGX_BUILD_NODE || process.execPath;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

console.log('bundling src/cli/cli.js ->', bundlePath);
await build({
  entryPoints: [join(root, 'src/cli/cli.js')],
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
});

// `preview`'s SVG rasterizer (src/cli/termImage.js) needs its WASM module's
// bytes at runtime; there's no node_modules inside a compiled binary, so it's
// embedded as a named SEA asset instead (retrieved via node:sea's getAsset).
const wasmSrc = require.resolve('@resvg/resvg-wasm/index_bg.wasm');

writeFileSync(
  configPath,
  JSON.stringify(
    {
      main: bundlePath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      assets: { 'resvg.wasm': wasmSrc },
    },
    null,
    2
  )
);

console.log('generating SEA blob ->', blobPath);
execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' });

console.log('copying node binary ->', outPath, `(from ${embedNode})`);
copyFileSync(embedNode, outPath);
chmodSync(outPath, 0o755);

if (process.platform === 'darwin') {
  // macOS requires the executable to be unsigned before injection, then
  // re-signed (ad hoc) afterward, or the OS refuses to run it.
  try {
    execFileSync('codesign', ['--remove-signature', outPath], { stdio: 'ignore' });
  } catch {
    // fine if it wasn't signed to begin with
  }
}

console.log('injecting blob ->', outPath);
const postjectArgs = [
  join(root, 'node_modules/postject/dist/cli.js'),
  outPath,
  'NODE_SEA_BLOB',
  blobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];
if (process.platform === 'darwin') postjectArgs.push('--macho-segment-name', 'NODE_SEA');
try {
  execFileSync(process.execPath, postjectArgs, { stdio: 'inherit' });
} catch {
  console.error(
    '\nBlob injection failed — this usually means the embedded Node binary ' +
      "(the one printed above, from copying node binary ->) wasn't built with " +
      'single-executable-application support. Distro packages (Debian/Ubuntu\'s ' +
      '`nodejs` apt package, some others) commonly lack it.\n' +
      'Fix: point FIGX_BUILD_NODE at an official build instead, e.g.:\n' +
      '  FIGX_BUILD_NODE=/path/to/official/node npm run build:cli'
  );
  process.exit(1);
}

if (process.platform === 'darwin') {
  execFileSync('codesign', ['--sign', '-', outPath], { stdio: 'inherit' });
}

console.log(`\nbuilt ${outPath} — run it directly, e.g.:\n  ${outPath} export design.fig --list`);
