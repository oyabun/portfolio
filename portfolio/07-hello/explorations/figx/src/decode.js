// Decode a Figma .fig file into a plain JS object (the scene graph "message").
//
// Format (reverse-engineered, self-describing):
//   optional ZIP wrapper  -> contains `canvas.fig` + `images/` + `meta.json`
//   canvas.fig:
//     [8 bytes ] ASCII magic  "fig-kiwi" | "fig-jam." | "fig-deck"
//     [uint32  ] version (little-endian)
//     repeated chunks, each: [uint32 length][compressed body]
//       chunk 0 -> binary Kiwi SCHEMA
//       chunk 1 -> the document MESSAGE, encoded with that schema
//       chunk 2+ -> image/PNG blobs (referenced by hash from paints)
//
// Chunk bodies are DEFLATE (raw or zlib-wrapped) or, in newer files, Zstandard.

import { unzipSync, inflateSync, unzlibSync } from 'fflate';
import { decompress as zstdDecompress } from 'fzstd';
import { decodeBinarySchema, compileSchema } from 'kiwi-schema';

const MAGICS = ['fig-kiwi', 'fig-jam.', 'fig-deck'];
const ZIP_MAGIC = [0x50, 0x4b]; // "PK"
const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function startsWith(buf, bytes, offset = 0) {
  return bytes.every((b, i) => buf[offset + i] === b);
}

// Pull `canvas.fig` (and any images) out of a .fig that is actually a ZIP.
function unwrap(bytes) {
  if (!startsWith(bytes, ZIP_MAGIC)) {
    return { fig: bytes, images: {}, meta: null };
  }
  const files = unzipSync(bytes);
  const fig = files['canvas.fig'];
  if (!fig) throw new Error('ZIP wrapper has no canvas.fig entry');
  const images = {};
  for (const [name, data] of Object.entries(files)) {
    if (name.startsWith('images/') && data.length) {
      images[name.slice('images/'.length)] = data;
    }
  }
  let meta = null;
  if (files['meta.json']) {
    try { meta = JSON.parse(new TextDecoder().decode(files['meta.json'])); } catch {}
  }
  return { fig, images, meta };
}

function decompressChunk(body) {
  if (body.length === 0) return body;
  if (startsWith(body, ZSTD_MAGIC)) return zstdDecompress(body);
  // DEFLATE: zlib-wrapped starts with 0x78; otherwise raw.
  try {
    return body[0] === 0x78 ? unzlibSync(body) : inflateSync(body);
  } catch {
    // last resort: try the other variant
    try { return unzlibSync(body); } catch { return inflateSync(body); }
  }
}

// Split the kiwi payload into its raw (decompressed) chunks.
export function splitChunks(fig) {
  let magic = null;
  for (const m of MAGICS) {
    if (startsWith(fig, [...m].map((c) => c.charCodeAt(0)))) { magic = m; break; }
  }
  if (!magic) throw new Error('Not a fig-kiwi payload (bad magic)');

  const view = new DataView(fig.buffer, fig.byteOffset, fig.byteLength);
  let off = 8;
  const version = view.getUint32(off, true); off += 4;

  const chunks = [];
  while (off + 4 <= fig.length) {
    const len = view.getUint32(off, true); off += 4;
    if (len === 0 || off + len > fig.length) break;
    const raw = fig.subarray(off, off + len); off += len;
    chunks.push(raw);
  }
  return { magic, version, chunks };
}

// Full decode -> { magic, version, schema, message, images, meta, rawChunks }
// `bytes` must be a Uint8Array (or Buffer) of the raw .fig file contents —
// reading it from disk/network/File API is the caller's job, so this stays
// platform-agnostic (no node:fs), safe to bundle for the browser.
export function decodeFig(bytes) {
  const { fig, images, meta } = unwrap(bytes);
  const { magic, version, chunks } = splitChunks(fig);
  if (chunks.length < 2) throw new Error(`expected >=2 chunks, got ${chunks.length}`);

  const schemaBytes = decompressChunk(chunks[0]);
  const dataBytes = decompressChunk(chunks[1]);

  const schema = decodeBinarySchema(schemaBytes);
  const compiled = compileSchema(schema);
  const message = compiled.decodeMessage(dataBytes);

  // Later chunks are image blobs, in order matching message.blobs (if present).
  const blobChunks = chunks.slice(2).map(decompressChunk);

  return { magic, version, schema, compiled, message, images, meta, blobChunks };
}
