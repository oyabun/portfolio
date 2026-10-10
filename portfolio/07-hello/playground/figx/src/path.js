// Decode a Figma baked-geometry blob (fillGeometry/strokeGeometry commandsBlob)
// into an SVG path `d` string.
//
// The blob is a tagless-header stream of commands: [uint8 tag][float32 ...],
// coordinates in the node's local space. Verified against known shapes:
//   0x00 CLOSE  (0 floats)
//   0x01 MOVE   (x, y)
//   0x02 LINE   (x, y)
//   0x03 QUAD   (cx, cy, x, y)                    -- quadratic (inferred)
//   0x04 CUBIC  (c1x, c1y, c2x, c2y, x, y)        -- cubic bezier
// e.g. a 100x100 rect -> "M0 0L100 0L100 100L0 100L0 0Z"; an 8x8 circle ->
// "M8 4C8 6.21 6.21 8 4 8 ..." (control offset 4*0.5523 = 2.209).

const ARITY = { 0: 0, 1: 2, 2: 2, 3: 4, 4: 6 };
const LETTER = { 0: 'Z', 1: 'M', 2: 'L', 3: 'Q', 4: 'C' };

// round to 3 decimals, drop trailing zeros, keep output compact
const num = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export function decodePath(bytes) {
  if (!bytes || !bytes.length) return '';
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  let d = '';
  while (off < bytes.length) {
    const tag = bytes[off++];
    const arity = ARITY[tag];
    if (arity === undefined) break; // unknown tag -> stop cleanly
    if (off + arity * 4 > bytes.length) break; // truncated -> stop
    const coords = [];
    for (let i = 0; i < arity; i++) {
      coords.push(num(dv.getFloat32(off, true)));
      off += 4;
    }
    d += LETTER[tag] + coords.join(' ');
  }
  return d;
}

export const fillRule = (windingRule) => (windingRule === 'ODD' ? 'evenodd' : 'nonzero');
