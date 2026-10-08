// Extracts Figma "variables" (design tokens, per-mode) and "styles" (shared
// Fill/Text/Effect/Grid definitions) from a decoded .fig document into plain,
// serializable structures — for `figx tokens` (JSON or CSS output) and any
// future caller (the web viewer doesn't surface any of this today).

import { buildVariableIndex, buildStyleIndex, resolveVariableValue } from './variables.js';

const round4 = (n) => Math.round(n * 10000) / 10000;
const colorCss = (c) => (c ? `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${round4(c.a ?? 1)})` : null);

const slug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// { collections: [{ name, modes: [modeName...], variables: [{name, type,
//   valuesByMode: {modeName: rawValue}}] }] } — rawValue is a {r,g,b,a} for
// COLOR, a number for FLOAT, a string for STRING/BOOLEAN, or null if that
// mode's value couldn't be resolved (e.g. a broken alias).
export function extractVariables(decoded) {
  const index = buildVariableIndex(decoded.message.nodeChanges);
  const collections = [];
  for (const collection of index.collections.values()) {
    const variables = [...index.variables.values()].filter((v) => v.collectionKey === collection.key);
    collections.push({
      name: collection.name,
      modes: collection.modes.map((m) => m.name),
      variables: variables.map((v) => {
        const valuesByMode = {};
        for (const mode of collection.modes) {
          const resolved = resolveVariableValue(index, v.key, mode.id);
          valuesByMode[mode.name] = resolved ? resolved.value : null;
        }
        return { name: v.name, type: v.resolvedType, valuesByMode };
      }),
    });
  }
  return { collections };
}

// { fill: [{name,description,paints}], text: [{name,description,fontFamily,
//   fontStyle,fontSize,lineHeight,letterSpacing}], effect: [{name,
//   description,effects}], grid: [{name,description,layoutGrids}] }
export function extractStyles(decoded) {
  const styleIndex = buildStyleIndex(decoded.message.nodeChanges);
  const out = { fill: [], text: [], effect: [], grid: [] };
  for (const node of styleIndex.values()) {
    const base = { name: node.name, description: node.styleDescription || '' };
    if (node.styleType === 'FILL') out.fill.push({ ...base, paints: node.fillPaints || [] });
    else if (node.styleType === 'TEXT') {
      out.text.push({
        ...base,
        fontFamily: node.fontName?.family,
        fontStyle: node.fontName?.style,
        fontSize: node.fontSize,
        lineHeight: node.lineHeight,
        letterSpacing: node.letterSpacing,
      });
    } else if (node.styleType === 'EFFECT') out.effect.push({ ...base, effects: node.effects || [] });
    else if (node.styleType === 'GRID') out.grid.push({ ...base, layoutGrids: node.layoutGrids || [] });
  }
  return out;
}

// Enriches a node's raw token refs (from render.js's nodeTokens(), just
// {kind,slot,name}) with the actual resolved value looked up against the
// file's full extracted variables/styles — so a caller gets "Blue/500 =
// rgba(37,96,255,1)" instead of just the name they'd have to cross-reference
// themselves. `mode` picks which mode's value to report per variable's own
// collection (same matching as resolveModeIdByCollection); a style ref's
// `value` is its whole extracted style object (paints/fontFamily/etc) since
// a shared style doesn't reduce to one scalar the way a variable does.
export function resolveNodeTokens(refs, { variables, styles }, mode) {
  const needle = (mode || '').toLowerCase();
  return refs.map((r) => {
    if (r.kind === 'variable') {
      for (const c of variables.collections) {
        const v = c.variables.find((v) => v.name === r.name);
        if (!v) continue;
        const modeName = (needle && c.modes.find((m) => m.toLowerCase().includes(needle))) || c.modes[0];
        return { ...r, collection: c.name, mode: modeName, value: v.valuesByMode[modeName] };
      }
      return { ...r, value: null };
    }
    const arr = styles[r.slot === 'strokeFill' ? 'fill' : r.slot] || [];
    const def = arr.find((s) => s.name === r.name);
    return def ? { ...r, ...def } : r;
  });
}

// CSS custom properties for a node's resolved tokens — variables become
// `--slug: value;` (same slugging as tokensToCss); a style ref becomes a
// comment naming it, since a shared style is a bundle of properties rather
// than one CSS value (see tokensToCss for the file-wide version that does
// expand fill/effect styles into their own custom properties).
export function nodeTokensToCss(resolved) {
  const lines = [];
  for (const r of resolved) {
    if (r.kind === 'variable') {
      const cssVal = r.value && typeof r.value === 'object' ? colorCss(r.value) : r.value;
      if (cssVal != null) lines.push(`  --${slug(r.collection || r.slot)}-${slug(r.name)}: ${cssVal}; /* ${r.slot} */`);
    } else {
      lines.push(`  /* style: ${r.name} (${r.slot}) */`);
    }
  }
  return `:root {\n${lines.join('\n')}\n}\n`;
}

// Renders extracted variables/styles as CSS: variables + fill/effect styles
// become custom properties on :root (using each collection's first mode by
// default, or whichever mode name matches `mode` case-insensitively — same
// per-collection matching as render.js's resolveModeIdByCollection, since a
// single stylesheet can't hold every mode at once); text styles become
// .text-<name> rules (font shorthand doesn't cleanly cover line-height/
// letter-spacing, so these stay separate declarations rather than a single
// `font:` property).
export function tokensToCss({ variables, styles }, mode) {
  const needle = (mode || '').toLowerCase();
  const root = [];
  for (const collection of variables.collections) {
    const modeName = (needle && collection.modes.find((m) => m.toLowerCase().includes(needle))) || collection.modes[0];
    const decls = collection.variables
      .map((v) => {
        const val = v.valuesByMode[modeName];
        const cssVal = v.type === 'COLOR' ? colorCss(val) : val;
        return cssVal == null ? null : `  --${slug(collection.name)}-${slug(v.name)}: ${cssVal};`;
      })
      .filter(Boolean);
    if (decls.length) root.push(`  /* ${collection.name} (${modeName}) */`, ...decls);
  }
  for (const s of styles.fill) {
    const solid = s.paints.find((p) => p.type === 'SOLID' && p.color);
    if (solid) root.push(`  --fill-${slug(s.name)}: ${colorCss(solid.color)};`);
  }
  for (const s of styles.effect) {
    const shadow = s.effects.find((e) => e.type === 'DROP_SHADOW' && e.visible !== false);
    if (shadow) {
      const val = `${shadow.offset?.x || 0}px ${shadow.offset?.y || 0}px ${shadow.radius || 0}px ${colorCss(shadow.color) || 'rgba(0,0,0,.25)'}`;
      root.push(`  --effect-${slug(s.name)}: ${val};`);
    }
  }

  const parts = [`:root {\n${root.join('\n')}\n}`];
  for (const s of styles.text) {
    const decls = [];
    if (s.fontFamily) decls.push(`  font-family: "${s.fontFamily}"${s.fontStyle ? `, /* ${s.fontStyle} */` : ''};`);
    if (s.fontSize) decls.push(`  font-size: ${s.fontSize}px;`);
    if (s.lineHeight?.value != null) decls.push(`  line-height: ${s.lineHeight.value}${s.lineHeight.units === 'PERCENT' ? '%' : 'px'};`);
    if (s.letterSpacing?.value != null) decls.push(`  letter-spacing: ${s.letterSpacing.value}${s.letterSpacing.units === 'PERCENT' ? '%' : 'px'};`);
    if (decls.length) parts.push(`.text-${slug(s.name)} {\n${decls.join('\n')}\n}`);
  }
  return parts.join('\n\n') + '\n';
}
