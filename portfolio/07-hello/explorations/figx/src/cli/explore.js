// Poke at a .fig file's decoded structure to understand what we're rendering.
import { readFileSync } from 'node:fs';
import { decodeFig } from '../decode.js';

const file = process.argv[2];
if (!file) { console.error('usage: node src/cli/explore.js <file.fig>'); process.exit(1); }

const { magic, version, message, images, meta, blobChunks } = decodeFig(new Uint8Array(readFileSync(file)));

console.log('magic       :', magic);
console.log('version     :', version);
console.log('images      :', Object.keys(images));
console.log('blob chunks :', blobChunks.length);
console.log('meta        :', meta);
console.log('message keys:', Object.keys(message));

const nc = message.nodeChanges || [];
console.log('\nnodeChanges :', nc.length);

// count node types
const byType = {};
for (const n of nc) byType[n.type] = (byType[n.type] || 0) + 1;
console.log('types       :', byType);

// show the shape of a few representative nodes
const seen = new Set();
console.log('\n--- sample of each node type ---');
for (const n of nc) {
  if (seen.has(n.type)) continue;
  seen.add(n.type);
  const keys = Object.keys(n);
  console.log(`\n[${n.type}] name=${JSON.stringify(n.name)} keys(${keys.length}):`, keys.join(', '));
}

// dump the root-ish node fully so we can see id/parent linkage + geometry
console.log('\n--- first node (full) ---');
console.log(JSON.stringify(nc[0], (k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v), 2).slice(0, 3000));
