// Entry point for the browser-bundled decode+render engine (see
// scripts/build-docs-engine.mjs). decode.js/render.js/tree.js/path.js have
// no Node-specific dependencies (no fs, no Buffer-only APIs) — they take
// bytes in, hand back plain JS objects/strings — which is what makes
// docs/index.html work as a static GitHub Pages site with no backend at
// all: this same code runs client-side instead of on a server.
export { decodeFig } from './decode.js';
export { renderPages, pageList, renderSvg } from './render.js';
export { extractVariables, extractStyles, tokensToCss } from './tokens.js';
