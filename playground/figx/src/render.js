// Render a decoded .fig message to a standalone SVG string.
//
// Fidelity: full hierarchy, per-node affine transforms, solid + linear-gradient
// paints, opacity, visibility, text, and — the key to accuracy — real baked
// path geometry. Every shape (rects, rounded corners, ellipses, vector icons,
// curved connectors) is decoded from fillGeometry/strokeGeometry command blobs
// into SVG <path> elements. Figma bakes strokes into strokeGeometry as filled
// outline regions, so those are filled with the stroke paint, not stroked.

import { buildTree, toSvgMatrix, guidKey, mul, IDENTITY } from './tree.js';
import { decodePath, fillRule } from './path.js';
import { buildVariableIndex, resolveColorVar, resolveModeIdByCollection, buildStyleIndex, consumedStyle } from './variables.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

function colorCss(c) {
  if (!c) return null;
  const { r, g, b, a = 1 } = c;
  return `rgba(${clamp255(r)},${clamp255(g)},${clamp255(b)},${a})`;
}

// Figma BlendMode -> CSS mix-blend-mode. NORMAL/PASS_THROUGH need no blend.
const BLEND = {
  DARKEN: 'darken', MULTIPLY: 'multiply', COLOR_BURN: 'color-burn', LINEAR_BURN: 'color-burn',
  LIGHTEN: 'lighten', SCREEN: 'screen', COLOR_DODGE: 'color-dodge', LINEAR_DODGE: 'plus-lighter',
  OVERLAY: 'overlay', SOFT_LIGHT: 'soft-light', HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference', EXCLUSION: 'exclusion',
  HUE: 'hue', SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity',
};
const blendCss = (mode) => BLEND[mode] || null;
// blend mode of the first visible paint in a list (for per-fill blending)
const paintBlend = (paints) => {
  const p = Array.isArray(paints) && paints.find((x) => x.visible !== false);
  return p ? blendCss(p.blendMode) : null;
};

// Invert a 2x3 affine matrix; returns null if singular.
function invert(m) {
  const det = m.m00 * m.m11 - m.m01 * m.m10;
  if (!det) return null;
  const id = 1 / det;
  return {
    m00: m.m11 * id,
    m01: -m.m01 * id,
    m10: -m.m10 * id,
    m11: m.m00 * id,
    m02: (m.m01 * m.m12 - m.m11 * m.m02) * id,
    m12: (m.m10 * m.m02 - m.m00 * m.m12) * id,
  };
}
const applyPt = (m, x, y) => ({ x: m.m00 * x + m.m01 * y + m.m02, y: m.m10 * x + m.m11 * y + m.m12 });

const hexHash = (bytes) => {
  if (!bytes?.length) return null;
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
};

// Encode bytes to base64 without Node's Buffer — this module runs in the
// browser too (docs/libs/figx-engine.js), where Buffer doesn't exist.
// btoa is a global in both browsers and Node 18+, but wants a "binary
// string" (one char per byte); built in chunks so String.fromCharCode(...)
// doesn't blow the call stack on a large image.
function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Sniff enough of an image's magic bytes to pick a data: URI mime type.
function sniffMime(b) {
  if (b?.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b?.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b?.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b?.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'image/webp';
  return 'image/png';
}

// Resolve an IMAGE paint's bytes: primarily the ZIP's images/<hash> entry
// (hash is Image.hash, hex-encoded); dataBlob is a fallback for images
// embedded directly in the kiwi blob table instead of the zip. The pattern
// tile is sized in absolute userSpaceOnUse units matching the node's own
// local size (same coordinate space as its geometry <use>) — deliberately
// NOT objectBoundingBox/patternContentUnits=objectBoundingBox, which Chrome
// fails to rasterize raster <image> content inside (verified empirically).
function imagePaintValue(p, ctx, w, h) {
  const img = p.image;
  if (!img || !(w > 0) || !(h > 0)) return null;
  let bytes = null;
  const hex = hexHash(img.hash);
  if (hex) bytes = ctx.images[hex] || ctx.images[`${hex}.png`];
  if (!bytes?.length && img.dataBlob != null) bytes = ctx.blobs[img.dataBlob]?.bytes;
  if (!bytes?.length) return null;

  const mime = sniffMime(bytes);
  const b64 = bytesToBase64(bytes);
  const id = `im${ctx.uid.n++}`;
  const mode = p.imageScaleMode;
  const par = mode === 'STRETCH' ? 'none' : mode === 'FIT' ? 'xMidYMid meet' : 'xMidYMid slice';
  ctx.defs.push(
    `<pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">` +
      `<image href="data:${mime};base64,${b64}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="${par}"/>` +
      `</pattern>`
  );
  return `url(#${id})`;
}

// Resolve a paint list to an SVG paint value. Gradients/images push a <def>
// into ctx.defs and return url(#id). `w`/`h` (the node's local size) size an
// IMAGE paint's pattern tile. Returns null when nothing paintable.
function paintValue(paints, ctx, w, h) {
  if (!Array.isArray(paints)) return null;
  for (const p of paints) {
    if (p.visible === false) continue;
    if (p.type === 'SOLID' && p.color) {
      // If a variable mode was requested and this paint is actually bound to
      // a variable (not just carrying a literal colorVar mirror), use that
      // mode's resolved value instead of the file's baked-in default.
      const varColor = ctx.variableIndex && ctx.modeIdByCollection ? resolveColorVar(ctx.variableIndex, p, ctx.modeIdByCollection) : null;
      const color = varColor || p.color;
      return colorCss({ ...color, a: (color.a ?? 1) * (p.opacity ?? 1) });
    }
    if (p.type === 'GRADIENT_LINEAR' && p.stops?.length) {
      const id = `g${ctx.defs.length}`;
      // Figma's gradient transform maps normalized object space -> gradient space;
      // invert it to place the gradient line back on the object's bounding box.
      const inv = invert(p.transform || { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 });
      const a = inv ? applyPt(inv, 0, 0) : { x: 0, y: 0 };
      const b = inv ? applyPt(inv, 1, 0) : { x: 1, y: 0 };
      const stops = p.stops
        .map((s) => {
          const varColor = ctx.variableIndex && ctx.modeIdByCollection ? resolveColorVar(ctx.variableIndex, s, ctx.modeIdByCollection) : null;
          return `<stop offset="${s.position}" stop-color="${colorCss(varColor || s.color)}"/>`;
        })
        .join('');
      ctx.defs.push(
        `<linearGradient id="${id}" gradientUnits="objectBoundingBox" ` +
          `x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}">${stops}</linearGradient>`
      );
      return `url(#${id})`;
    }
    if (p.type === 'IMAGE') {
      const v = imagePaintValue(p, ctx, w, h);
      if (v) return v;
    }
  }
  return null;
}

// Shared geometry cache: a commandsBlob is decoded to an SVG path `d` at most
// once per render, stored raw (untransformed, unpainted) in <defs>. Every use
// site (fill, stroke, or mask clip) references it via <use>, applying its own
// transform/paint. This matters a lot in practice — component instances are
// the norm in real Figma files, and without this a 50-instance icon would
// otherwise embed 50 copies of the same path string in the output, bloating
// the SVG the browser has to keep rasterized during pan/zoom.
function geoDefId(blobIdx, ctx) {
  if (ctx.geoCache.has(blobIdx)) return ctx.geoCache.get(blobIdx);
  const blob = ctx.blobs[blobIdx];
  const d = blob && decodePath(blob.bytes);
  const id = d ? `p${blobIdx}` : null;
  if (id) ctx.defs.push(`<path id="${id}" d="${d}"/>`);
  ctx.geoCache.set(blobIdx, id);
  return id;
}

// Emit <use> refs for a geometry array, painting each with `paint`.
function geometryPaths(geometry, ctx, paint, blend) {
  if (!Array.isArray(geometry) || !paint) return '';
  const style = blend ? ` style="mix-blend-mode:${blend}"` : '';
  let out = '';
  for (const g of geometry) {
    const id = geoDefId(g.commandsBlob, ctx);
    if (!id) continue;
    out += `<use href="#${id}" fill="${paint}" fill-rule="${fillRule(g.windingRule)}"${style}/>`;
  }
  return out;
}

// Collect a guid -> override-props map from an instance's overrides. Keyed by
// the last guid in each guidPath (the target node). Figma also stores derived
// data in a foreign guid namespace; we merge both and match by guid where we can.
function instanceOverrides(inst) {
  const map = new Map();
  const add = (entry) => {
    const path = entry.guidPath?.guids;
    if (!path?.length) return;
    const { guidPath, ...props } = entry;
    const k = guidKey(path[path.length - 1]);
    map.set(k, { ...(map.get(k) || {}), ...props });
  };
  for (const o of inst.symbolData?.symbolOverrides || []) add(o);
  for (const d of inst.derivedSymbolData || []) add(d);
  return map;
}

const applyOverride = (node, overrides) => {
  const ov = overrides?.get(guidKey(node.guid));
  return ov ? { ...node, ...ov } : node;
};

// Render a sibling list honoring Figma masks: a child with mask=true clips all
// following siblings (until the next mask) to its shape. `idPrefix` (see
// renderNode) is threaded through unchanged — only the INSTANCE-expansion
// branch in renderNode ever extends it.
function renderChildren(children, parentWorld, ctx, overrides, depth, idPrefix) {
  let i = 0;
  while (i < children.length) {
    const node = applyOverride(children[i].node, overrides);
    if (node.mask) {
      const group = [];
      let j = i + 1;
      while (j < children.length && !applyOverride(children[j].node, overrides).mask) {
        group.push(children[j]);
        j++;
      }
      renderMaskedGroup(children[i], group, parentWorld, ctx, overrides, depth, idPrefix);
      i = j;
    } else {
      renderNode(children[i], parentWorld, ctx, overrides, depth, idPrefix);
      i++;
    }
  }
}

const hasVisibleFill = (n) =>
  Array.isArray(n.fillPaints) && n.fillPaints.some((p) => p.visible !== false);

// Accumulate a mask subtree's *painted* geometry as clipPath <path> elements
// (in world space). Frames/instances contribute their descendants' shapes;
// transparent bounding rects (no fill) are skipped so they don't square off the mask.
function collectClip(entry, parentWorld, ctx, overrides, depth, acc) {
  const n = applyOverride(entry.node, overrides);
  if (n.visible === false) return;
  const world = mul(parentWorld, n.transform || IDENTITY);
  if (hasVisibleFill(n)) {
    for (const g of n.fillGeometry || []) {
      const id = geoDefId(g.commandsBlob, ctx);
      if (id) acc.push(`<use href="#${id}" transform="${toSvgMatrix(world)}"/>`);
    }
  }
  for (const c of entry.children) collectClip(c, world, ctx, overrides, depth, acc);
  if (n.type === 'INSTANCE' && depth < 12) {
    const sym = ctx.byId.get(guidKey(n.symbolData?.symbolID || {}));
    if (sym) {
      const ov = instanceOverrides(n);
      for (const c of sym.children) collectClip(c, world, ctx, ov, depth + 1, acc);
    }
  }
}

function renderMaskedGroup(maskEntry, group, parentWorld, ctx, overrides, depth, idPrefix) {
  const mn = applyOverride(maskEntry.node, overrides);
  const acc = [];
  collectClip(maskEntry, parentWorld, ctx, overrides, depth, acc);
  // fallback: a mask with no painted geometry clips to its own bounds
  if (!acc.length && mn.size) {
    const maskWorld = mul(parentWorld, mn.transform || IDENTITY);
    acc.push(`<path d="M0 0H${mn.size.x}V${mn.size.y}H0Z" transform="${toSvgMatrix(maskWorld)}"/>`);
  }
  const sub = [];
  const subCtx = { ...ctx, out: sub };
  for (const g of group) renderNode(g, parentWorld, subCtx, overrides, depth, idPrefix);
  if (!acc.length) {
    ctx.out.push(sub.join('')); // nothing to clip against -> emit unclipped
    return;
  }
  const id = `clip${ctx.uid.n++}`;
  ctx.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse">${acc.join('')}</clipPath>`);
  ctx.out.push(`<g clip-path="url(#${id})">${sub.join('')}</g>`);
}

// Build an SVG <filter> for a node's effects (drop/inner shadow, blur) and push
// it into defs. Returns the filter id, or null if there's nothing renderable.
function buildFilter(effects, ctx) {
  const prims = [];
  let result = 'SourceGraphic';
  const merges = ['SourceGraphic'];
  for (const e of effects) {
    if (e.visible === false) continue;
    const color = colorCss(e.color) || 'rgba(0,0,0,0.25)';
    const std = Math.max(0, (e.radius || 0) / 2);
    if (e.type === 'DROP_SHADOW') {
      const id = `s${ctx.uid.n}_${prims.length}`;
      prims.push(
        `<feDropShadow in="SourceGraphic" dx="${e.offset?.x || 0}" dy="${e.offset?.y || 0}" ` +
          `stdDeviation="${std}" flood-color="${color}" result="${id}"/>`
      );
      merges.unshift(id); // shadows paint behind the source
    } else if (e.type === 'INNER_SHADOW') {
      // approximate: blur the inverse alpha, tint, composite inside the shape
      const b = `ib${ctx.uid.n}_${prims.length}`;
      const id = `is${ctx.uid.n}_${prims.length}`;
      prims.push(
        `<feGaussianBlur in="SourceAlpha" stdDeviation="${std}" result="${b}"/>` +
          `<feOffset in="${b}" dx="${e.offset?.x || 0}" dy="${e.offset?.y || 0}" result="${b}o"/>` +
          `<feComposite in="SourceAlpha" in2="${b}o" operator="out" result="${b}c"/>` +
          `<feFlood flood-color="${color}"/>` +
          `<feComposite in2="${b}c" operator="in" result="${id}"/>`
      );
      merges.push(id);
    } else if (e.type === 'FOREGROUND_BLUR') {
      prims.push(`<feGaussianBlur in="${result}" stdDeviation="${std}" result="lb"/>`);
      result = 'lb';
      merges.length = 0;
      merges.push('lb');
    }
  }
  if (!prims.length) return null;
  const id = `fx${ctx.uid.n++}`;
  const merge = merges.map((m) => `<feMergeNode in="${m}"/>`).join('');
  ctx.defs.push(
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" ` +
      `color-interpolation-filters="sRGB">${prims.join('')}<feMerge>${merge}</feMerge></filter>`
  );
  return id;
}

// Figma's per-node "Clip content" toggle. The field is inverted: true means
// clipping is OFF; the default (false, or the field absent) is clipping ON —
// matching Figma's own default for new frames. Distinct from the mask=true
// sibling-clip mechanism (renderChildren/renderMaskedGroup above), which
// clips *siblings* to one shape rather than a container clipping itself.
const CLIPPABLE_TYPES = new Set(['FRAME', 'INSTANCE', 'SYMBOL', 'COMPONENT', 'COMPONENT_SET', 'SECTION']);
const clipsOwnContent = (n) => CLIPPABLE_TYPES.has(n.type) && n.frameMaskDisabled !== true;

// The variables/styles a node directly consumes — shared styles via its
// styleIdFor* fields, variables via colorVar bindings on its own fill/stroke
// paints. Surfaced as a data-tokens attribute (see renderNode) so a client
// can show "what does this element use" without re-deriving the whole
// variable/style graph itself; empty array (not attached) when ctx has no
// index built (see prep()) or the node simply doesn't use any.
function tokenRefs(n, ctx) {
  const refs = [];
  if (ctx.styleIndex) {
    for (const slot of ['fill', 'text', 'effect', 'grid', 'strokeFill']) {
      const def = consumedStyle(ctx.styleIndex, n, slot);
      if (def) refs.push({ kind: 'style', slot, name: def.name || slot });
    }
  }
  if (ctx.variableIndex) {
    const fromPaints = (paints, slot) => {
      for (const p of paints || []) {
        const key = p?.colorVar?.value?.alias?.assetRef?.key;
        const v = key && ctx.variableIndex.variables.get(key);
        if (v) refs.push({ kind: 'variable', slot, name: v.name });
      }
    };
    fromPaints(n.fillPaints, 'fill');
    fromPaints(n.strokePaints, 'stroke');
  }
  return refs;
}

const round2 = (n) => Math.round(n * 100) / 100;
const fmtUnit = (u) => {
  if (!u) return null;
  if (u.units === 'AUTO') return 'auto';
  if (u.units === 'PERCENT') return `${round2(u.value)}%`;
  return `${round2(u.value)}px`;
};

// A CSS-like property list for a node — fill/stroke color, opacity, corner
// radius, and (for text) font family/weight/size/line-height/letter-spacing.
// `fill`/`stroke` are passed in already resolved (same paintValue() call the
// node's own geometry paints with) rather than recomputed here. Surfaced as
// a data-css attribute (see renderNode) alongside data-tokens, so a client
// can show "what does this look like" without re-deriving paint/text
// resolution itself. Not exhaustive (no effects/blend-mode yet) but covers
// what's actually visible on the canvas.
// paintValue()'s colorCss() carries alpha at full float precision (e.g.
// 0.10000000149011612, a plain artifact of the decoded value never being a
// round number in binary) — harmless as an SVG attribute a browser parses,
// but worth rounding once it's headed for a human to read.
const roundAlpha = (rgba) => rgba && rgba.replace(/,([\d.]+)\)$/, (_, a) => `,${Math.round(parseFloat(a) * 100) / 100})`);

function cssProps(n, fill, stroke) {
  const props = [];
  if (fill) props.push(['fill', roundAlpha(fill)]);
  if (stroke && n.strokeWeight) props.push(['stroke', `${roundAlpha(stroke)} / ${n.strokeWeight}px`]);
  if (n.opacity != null && n.opacity !== 1) props.push(['opacity', String(n.opacity)]);
  if (n.cornerRadius) props.push(['corner-radius', `${n.cornerRadius}px`]);
  if (n.type === 'TEXT') {
    if (n.fontName?.family) props.push(['font-family', n.fontName.family]);
    const weight = n.derivedTextData?.fontMetaData?.[0]?.fontWeight;
    if (weight) props.push(['font-weight', String(weight)]);
    else if (n.fontName?.style) props.push(['font-weight', n.fontName.style]);
    if (n.fontSize) props.push(['font-size', `${n.fontSize}px`]);
    const lh = fmtUnit(n.lineHeight);
    if (lh) props.push(['line-height', lh]);
    const ls = fmtUnit(n.letterSpacing);
    if (ls) props.push(['letter-spacing', ls]);
  }
  return props;
}

// `parentWorld` is the transform of this node's container; `overrides` (optional)
// is an instance-override map applied by node guid. `depth` guards symbol cycles.
// `idPrefix` disambiguates data-id across repeated component instances: a
// shared master symbol's descendant guids are identical no matter which
// instance renders them, so without a per-instance prefix every occurrence
// of a reused component would collide onto the same data-id — breaking
// selection/highlight/export (a click on one card would pull in every other
// card that happens to share a component). Empty at the page root; extended
// with the enclosing instance's own id each time we expand into a symbol.
function renderNode(entry, parentWorld, ctx, overrides, depth = 0, idPrefix = '') {
  const raw = entry.node;
  const n = applyOverride(raw, overrides); // shallow-merge instance overrides
  if (n.visible === false) return;
  const { out, byId } = ctx;
  const ownId = idPrefix ? `${idPrefix}>${guidKey(raw.guid)}` : guidKey(raw.guid);

  const world = mul(parentWorld, n.transform || IDENTITY);

  if (n.type === 'DOCUMENT' || n.type === 'CANVAS') {
    renderChildren(entry.children, world, ctx, overrides, depth, idPrefix);
    return;
  }

  const w = n.size?.x ?? 0;
  const h = n.size?.y ?? 0;
  const opacity = n.opacity ?? 1;
  const fill = paintValue(n.fillPaints, ctx, w, h);
  const stroke = paintValue(n.strokePaints, ctx, w, h);
  const attrs = [`transform="${toSvgMatrix(world)}"`];
  if (opacity !== 1) attrs.push(`opacity="${opacity}"`);
  const nodeBlend = blendCss(n.blendMode);
  if (nodeBlend) attrs.push(`style="mix-blend-mode:${nodeBlend}"`);
  const effects = Array.isArray(n.effects) ? n.effects.filter((e) => e.visible !== false) : null;
  if (effects?.length) {
    const fid = buildFilter(effects, ctx);
    if (fid) attrs.push(`filter="url(#${fid})"`);
  }
  const title = `<title>${esc(n.type)}: ${esc(n.name)}</title>`;

  let body = title;

  // 1) baked fill geometry (accurate shape incl. rounded corners / vectors)
  body += geometryPaths(n.fillGeometry, ctx, fill, paintBlend(n.fillPaints));
  // 2) baked stroke geometry — Figma stores strokes as filled outline regions
  body += geometryPaths(n.strokeGeometry, ctx, stroke || fill, paintBlend(n.strokePaints));

  // 3) text
  if (n.type === 'TEXT') {
    const chars = n.textData?.characters ?? '';
    const size = n.fontSize ?? 12;
    const family = n.fontName?.family ?? 'Inter';
    body +=
      `<text x="0" y="${size * 0.82}" font-family="${esc(family)}, sans-serif" ` +
      `font-size="${size}" fill="${fill || '#000'}" xml:space="preserve">${esc(chars)}</text>`;
  }

  // 4) fallback for nodes with no geometry and no text (keep something visible)
  const hadGeometry = n.fillGeometry?.length || n.strokeGeometry?.length;
  if (!hadGeometry && n.type !== 'TEXT' && w > 0 && h > 0 && (fill || stroke)) {
    const sw = n.strokeWeight ?? 0;
    const sa = stroke && sw ? ` stroke="${stroke}" stroke-width="${sw}"` : '';
    body += `<rect x="0" y="0" width="${w}" height="${h}" fill="${fill || 'none'}"${sa}/>`;
  }

  attrs.push(`data-id="${ownId}"`);
  const tokens = tokenRefs(n, ctx);
  if (tokens.length) attrs.push(`data-tokens="${esc(JSON.stringify(tokens))}"`);
  const style = cssProps(n, fill, stroke);
  if (style.length) attrs.push(`data-css="${esc(JSON.stringify(style))}"`);
  out.push(`<g ${attrs.join(' ')}>${body}</g>`);

  // Frames/instances/sections clip their own children to their own bounds by
  // default (Figma's "Clip content"). Render children into a side buffer so
  // they can be wrapped in a <clipPath> — preferring the node's own fill
  // geometry (so a rounded-rect card clips to its rounded shape, not a
  // sharp box) with a plain-rect fallback when it has no fill of its own.
  const clipping = clipsOwnContent(n);
  const childCtx = clipping ? { ...ctx, out: [] } : ctx;

  // real children (present for frames, groups, master symbols…)
  renderChildren(entry.children, world, childCtx, overrides, depth, idPrefix);

  // 5) INSTANCE expansion: instances store no children of their own — their
  // content lives in the referenced master symbol. Instantiate that subtree
  // re-rooted at this instance's transform, applying instance overrides, and
  // scope every descendant's data-id to this instance (see idPrefix above).
  if (n.type === 'INSTANCE' && depth < 12) {
    const sym = byId.get(guidKey(n.symbolData?.symbolID || {}));
    if (sym) {
      const ovMap = instanceOverrides(n);
      renderChildren(sym.children, world, childCtx, ovMap, depth + 1, ownId);
    }
  }

  if (clipping) {
    const acc = [];
    for (const g of n.fillGeometry || []) {
      const id = geoDefId(g.commandsBlob, ctx);
      if (id) acc.push(`<use href="#${id}" transform="${toSvgMatrix(world)}"/>`);
    }
    if (!acc.length && w > 0 && h > 0) {
      acc.push(`<path d="M0 0H${w}V${h}H0Z" transform="${toSvgMatrix(world)}"/>`);
    }
    if (acc.length) {
      const cid = `clip${ctx.uid.n++}`;
      ctx.defs.push(`<clipPath id="${cid}" clipPathUnits="userSpaceOnUse">${acc.join('')}</clipPath>`);
      ctx.out.push(`<g clip-path="url(#${cid})">${childCtx.out.join('')}</g>`);
    } else {
      ctx.out.push(childCtx.out.join(''));
    }
  }
}

// World-space bounding box of an entry + all its descendants (uses
// precomputed entry.world). Shared by page-level and single-node export.
function boundsOf(rootEntry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (e) => {
    const n = e.node;
    const w = n.size?.x, h = n.size?.y;
    if (w && h && e.world && n.visible !== false) {
      for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
        const p = applyPt(e.world, cx, cy);
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    for (const c of e.children) visit(c);
  };
  visit(rootEntry);
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function pageBounds(pageEntry) {
  const b = boundsOf(pageEntry);
  if (!b) return null;
  const pad = 48;
  return { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 };
}

function nodeBounds(entry) {
  const b = boundsOf(entry);
  if (!b) return null;
  const pad = 8;
  return { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + pad * 2, h: b.maxY - b.minY + pad * 2 };
}

function renderPageSvg(pageEntry, byId, blobs, meta, isFirst, images, variableCtx) {
  const ctx = { out: [], defs: [], blobs, byId, uid: { n: 0 }, geoCache: new Map(), images: images || {}, ...variableCtx };
  renderNode(pageEntry, IDENTITY, ctx);

  // viewBox: computed content bounds; page 1 falls back to the exported coords.
  const rc = meta?.client_meta?.render_coordinates;
  const vb =
    pageBounds(pageEntry) ||
    (isFirst && rc ? { x: rc.x, y: rc.y, w: rc.width, h: rc.height } : { x: 0, y: 0, w: 1000, h: 1000 });
  const bgCss =
    colorCss(pageEntry.node.backgroundColor) ||
    colorCss(meta?.client_meta?.background_color) ||
    '#1e1e1e';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" ` +
    `width="${vb.w}" height="${vb.h}">` +
    `<defs>${ctx.defs.join('')}</defs>` +
    `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${bgCss}"/>` +
    ctx.out.join('') +
    `</svg>`
  );
}

// `mode` (a mode name like "dark", matched case-insensitively per variable
// collection — see resolveModeIdByCollection) opts into resolving
// colorVar-bound paints against that mode instead of the file's baked
// default; omitted, rendering is unchanged from before variables existed.
function prep(decoded, { mode } = {}) {
  const { root, byId } = buildTree(decoded.message.nodeChanges);
  const blobs = decoded.message.blobs || [];
  const meta = decoded.meta;
  const images = decoded.images || {};
  const canvases = root ? root.children.filter((c) => c.node.type === 'CANVAS') : [];
  // Hide Figma's internal/hidden pages (e.g. design-token "Internal Only Canvas").
  const real = canvases.filter((c) => c.node.visible !== false && !c.node.internalOnly);
  const pages = (real.length ? real : canvases).length ? (real.length ? real : canvases) : root ? [root] : [];
  // variableIndex/styleIndex are built unconditionally (cheap — one pass over
  // nodeChanges) so every render can attach data-tokens (see tokenRefs) even
  // without a mode requested; modeIdByCollection is the only piece that's
  // actually mode-specific, gating whether paintValue() resolves colorVar
  // bindings against a mode or leaves the file's baked default alone.
  const variableIndex = buildVariableIndex(decoded.message.nodeChanges);
  const styleIndex = buildStyleIndex(decoded.message.nodeChanges);
  const variableCtx = { variableIndex, styleIndex, modeIdByCollection: mode ? resolveModeIdByCollection(variableIndex, mode) : undefined };
  return { byId, blobs, meta, images, pages, variableCtx };
}

const countNodes = (e) => 1 + e.children.reduce((s, c) => s + countNodes(c), 0);

// Compact layer tree for the sidebar. Mirrors the real node hierarchy AND
// the same instance-expansion the renderer does (renderNode's INSTANCE
// branch) — an instance stores no children of its own, its visible content
// lives in the referenced master symbol, so without this an instance's row
// would falsely show as a childless leaf even though it renders content.
// `idPrefix` mirrors renderNode's: it must produce the exact same ids as the
// SVG's data-id attributes (same prefixing scheme) or the client's id-based
// lookups (selection/highlight/export) silently stop matching the DOM.
function layerTree(entry, byId, overrides, depth = 0, idPrefix = '') {
  const out = [];
  for (const c of entry.children) {
    const n = applyOverride(c.node, overrides);
    const ownId = idPrefix ? `${idPrefix}>${guidKey(c.node.guid)}` : guidKey(c.node.guid);
    let kids = c.children.length ? layerTree(c, byId, overrides, depth, idPrefix) : [];
    if (n.type === 'INSTANCE' && depth < 12) {
      const sym = byId.get(guidKey(n.symbolData?.symbolID || {}));
      if (sym) kids = kids.concat(layerTree(sym, byId, instanceOverrides(n), depth + 1, ownId));
    }
    out.push({
      id: ownId,
      name: n.name || n.type,
      type: n.type,
      hidden: n.visible === false,
      children: kids.length ? kids : undefined,
    });
  }
  return out;
}

// Page metadata (name, node count, layer tree) WITHOUT rendering any page's
// SVG — layerTree/countNodes just walk the already-built tree, so this is
// cheap even for a huge file, unlike renderPages() below (which bakes every
// page's full SVG, the expensive part). Lets a caller populate a page list /
// sidebar and decide which single page's SVG is actually worth rendering
// right now, instead of eagerly rendering every page up front.
export function pageList(decoded) {
  const { byId, pages } = prep(decoded);
  return pages.map((p, i) => ({
    name: p.node.name || `Page ${i + 1}`,
    nodes: countNodes(p),
    layers: layerTree(p, byId),
  }));
}

// One SVG per page (CANVAS). Fixes multiple pages overlapping in a single view.
// `mode` (e.g. "dark") re-resolves variable-bound paints against that mode
// instead of the file's baked default — see prep()'s doc comment.
export function renderPages(decoded, { mode } = {}) {
  const { byId, blobs, meta, images, pages, variableCtx } = prep(decoded, { mode });
  return pages.map((p, i) => ({
    name: p.node.name || `Page ${i + 1}`,
    nodes: countNodes(p),
    svg: renderPageSvg(p, byId, blobs, meta, i === 0, images, variableCtx),
    layers: layerTree(p, byId),
  }));
}

// Render a single page (default: the first). Kept for the CLI / simple callers.
export function renderSvg(decoded, { page = 0, mode } = {}) {
  const { byId, blobs, meta, images, pages, variableCtx } = prep(decoded, { mode });
  const p = pages[page] || pages[0];
  return p ? renderPageSvg(p, byId, blobs, meta, (pages[page] ? page : 0) === 0, images, variableCtx) : '<svg xmlns="http://www.w3.org/2000/svg"/>';
}

// Enumerate nodes across the whole document (every page), optionally filtered
// by `types` (a Set of node-type strings, e.g. new Set(['FRAME'])) and/or
// `name` (case-insensitive substring/regex match against node.name). Hidden
// nodes (visible:false) are excluded. Used by the CLI's `export` command to
// resolve "which nodes match" before rendering each one.
export function listNodes(decoded, { types, name } = {}) {
  const { byId } = prep(decoded);
  const nameRe = name ? new RegExp(name, 'i') : null;
  const out = [];
  for (const entry of byId.values()) {
    const n = entry.node;
    if (n.visible === false) continue;
    if (types && !types.has(n.type)) continue;
    if (nameRe && !nameRe.test(n.name || '')) continue;
    out.push({ guid: guidKey(n.guid), type: n.type, name: n.name || n.type });
  }
  return out;
}

// Render a single node (+ its descendants) as a standalone, tightly-cropped
// SVG — the CLI/API equivalent of the viewer's per-node "Export" action.
// `guid` is the `${sessionID}:${localID}` key returned by listNodes/guidKey.
// Returns null if the guid isn't found.
export function renderNodeSvg(decoded, guid, { mode } = {}) {
  const { byId, blobs, images, variableCtx } = prep(decoded, { mode });
  const entry = byId.get(guid);
  if (!entry) return null;

  const parentGuid = entry.node.parentIndex?.guid;
  const parentEntry = parentGuid && byId.get(guidKey(parentGuid));
  const parentWorld = parentEntry ? parentEntry.world : IDENTITY;

  const ctx = { out: [], defs: [], blobs, byId, uid: { n: 0 }, geoCache: new Map(), images: images || {}, ...variableCtx };
  renderNode(entry, parentWorld, ctx);

  const vb = nodeBounds(entry) || { x: 0, y: 0, w: entry.node.size?.x || 100, h: entry.node.size?.y || 100 };
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" ` +
    `width="${Math.round(vb.w)}" height="${Math.round(vb.h)}">` +
    `<defs>${ctx.defs.join('')}</defs>` +
    ctx.out.join('') +
    `</svg>`
  );
}

const unescapeAttr = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Every variable/style used anywhere in a node's subtree (itself included) —
// the CLI/web-Inspector-panel equivalent of "what design tokens does this
// component use". Rather than re-walking the tree a second time (risking
// drift from renderNode's own instance-expansion/id-prefixing rules), this
// renders the node exactly like renderNodeSvg does and reads back the same
// data-tokens attributes a client in a browser would — renderNodeSvg's
// output *is* the subtree, so every occurrence in it belongs to the
// selection, no id-prefix bookkeeping needed. Returns null if guid isn't
// found, else a deduped array of {kind, slot, name}.
export function nodeTokens(decoded, guid, { mode } = {}) {
  const svg = renderNodeSvg(decoded, guid, { mode });
  if (svg == null) return null;
  const seen = new Set();
  const out = [];
  for (const m of svg.matchAll(/data-tokens="([^"]*)"/g)) {
    const refs = JSON.parse(unescapeAttr(m[1]));
    for (const r of refs) {
      const key = `${r.kind}|${r.slot}|${r.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

// The resolved CSS-like properties (see cssProps()) of exactly this node —
// not its descendants, since "what does this shape look like" only makes
// sense per-shape. Same read-back-the-render approach as nodeTokens(): the
// node's own <g> is the one whose data-id equals `guid` exactly (a fresh
// render's root carries no idPrefix). Returns null if guid isn't found, else
// an array of [property, value] pairs (possibly empty).
export function nodeStyle(decoded, guid, { mode } = {}) {
  const svg = renderNodeSvg(decoded, guid, { mode });
  if (svg == null) return null;
  const tagMatch = svg.match(new RegExp(`<g[^>]*\\bdata-id="${guid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`));
  if (!tagMatch) return [];
  const styleMatch = tagMatch[0].match(/data-css="([^"]*)"/);
  return styleMatch ? JSON.parse(unescapeAttr(styleMatch[1])) : [];
}
