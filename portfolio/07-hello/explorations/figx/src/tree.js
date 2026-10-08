// Reassemble the flat nodeChanges list into a hierarchy with world transforms.
//
// Each node has:
//   guid: {sessionID, localID}            -- identity
//   parentIndex: {guid, position}         -- parent + fractional-index sibling order
//   transform: {m00,m01,m02,m10,m11,m12}  -- affine, relative to parent
//   size: {x, y}                          -- width/height (absent on DOCUMENT/CANVAS)

export const guidKey = (g) => `${g.sessionID}:${g.localID}`;

// 2D affine matrix helpers. Layout: [m00 m01 m02 ; m10 m11 m12] (row-major, last row 0 0 1)
export const IDENTITY = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

export function mul(a, b) {
  return {
    m00: a.m00 * b.m00 + a.m01 * b.m10,
    m01: a.m00 * b.m01 + a.m01 * b.m11,
    m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
    m10: a.m10 * b.m00 + a.m11 * b.m10,
    m11: a.m10 * b.m01 + a.m11 * b.m11,
    m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12,
  };
}

export const toSvgMatrix = (m) =>
  `matrix(${m.m00} ${m.m10} ${m.m01} ${m.m11} ${m.m02} ${m.m12})`;

// position is a fractional-index string; lexicographic compare gives sibling order.
const byPosition = (a, b) => {
  const pa = a.parentIndex?.position ?? '';
  const pb = b.parentIndex?.position ?? '';
  return pa < pb ? -1 : pa > pb ? 1 : 0;
};

export function buildTree(nodeChanges) {
  const byId = new Map();
  for (const n of nodeChanges) byId.set(guidKey(n.guid), { node: n, children: [] });

  let root = null;
  for (const entry of byId.values()) {
    const p = entry.node.parentIndex;
    if (!p || !p.guid) { root = root || entry; continue; }
    const parent = byId.get(guidKey(p.guid));
    if (parent) parent.children.push(entry);
    else root = root || entry; // orphan -> treat as a root
  }

  // sort each sibling group and attach cumulative world transforms
  const walk = (entry, parentWorld) => {
    entry.children.sort((a, b) => byPosition(a.node, b.node));
    const local = entry.node.transform || IDENTITY;
    entry.world = mul(parentWorld, local);
    for (const c of entry.children) walk(c, entry.world);
  };
  if (root) walk(root, IDENTITY);
  return { root, byId };
}
