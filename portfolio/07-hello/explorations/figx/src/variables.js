// Resolves Figma "variables" (design tokens: color/number/string values that
// can differ per mode, e.g. Light/Dark) and "styles" (shared FILL/TEXT/EFFECT/
// GRID definitions) out of a decoded .fig document.
//
// Variables: a VARIABLE_SET node declares a collection's modes (e.g. Light
// Mode / Dark Mode, each with a guid). A VARIABLE node belongs to one
// collection (variableSetID.assetRef.key) and carries one raw value per mode
// in variableDataValues.entries — colors as {colorValue}, numbers as
// {floatValue}, strings as {textValue}, and a variable can alias *another*
// variable per mode via {alias:{assetRef:{key}}} instead of a literal value.
//
// A node consumes a variable by putting a `colorVar`/`stopsVar` (paints) or
// an entry in `variableConsumptionMap` (other properties: width, corner
// radius, font size, ...) alongside the literal baked value Figma cached at
// export time — so rendering already works without any of this (paintValue()
// in render.js just reads the baked `color`); what this module adds is the
// ability to re-resolve to a *different* mode, and to extract variables as
// a standalone token set.
//
// Styles: a shared style (Fill/Text/Effect/Grid style) is modeled as an
// ordinary hidden node (visible:false) whose own properties *are* the style's
// definition, tagged with styleType + a shared `key`. Consuming nodes
// reference it via styleIdForFill/styleIdForText/styleIdForEffect/
// styleIdForGrid/styleIdForStrokeFill ({assetRef:{key}}), analogous to how
// paints reference variables.

import { guidKey } from './tree.js';

// A variable's raw per-mode value, normalized to one of:
//   { type: 'COLOR', value: {r,g,b,a} } | { type: 'FLOAT', value: number } |
//   { type: 'STRING', value: string } | { type: 'BOOLEAN', value: boolean } |
//   { type: 'ALIAS', key: string }  (points at another variable's key)
function normalizeValue(variableData) {
  const v = variableData?.value;
  if (!v) return null;
  if ('colorValue' in v) return { type: 'COLOR', value: v.colorValue };
  if ('floatValue' in v) return { type: 'FLOAT', value: v.floatValue };
  if ('textValue' in v) return { type: 'STRING', value: v.textValue };
  if ('boolValue' in v) return { type: 'BOOLEAN', value: v.boolValue };
  if (v.alias?.assetRef?.key) return { type: 'ALIAS', key: v.alias.assetRef.key };
  return null;
}

// Build the variable index: { collections: Map<key, {key,name,modes}>,
// variables: Map<key, {key,name,collectionKey,resolvedType,valuesByMode}> }.
// `modes` is [{id, name}]; `valuesByMode` is Map<modeId, normalizedValue>.
export function buildVariableIndex(nodeChanges) {
  const collections = new Map();
  const variables = new Map();

  for (const n of nodeChanges) {
    if (n.type !== 'VARIABLE_SET') continue;
    collections.set(n.key, {
      key: n.key,
      name: n.name,
      modes: (n.variableSetModes || []).map((m) => ({ id: guidKey(m.id), name: m.name })),
    });
  }
  for (const n of nodeChanges) {
    if (n.type !== 'VARIABLE') continue;
    const valuesByMode = new Map();
    for (const e of n.variableDataValues?.entries || []) {
      valuesByMode.set(guidKey(e.modeID), normalizeValue(e.variableData));
    }
    variables.set(n.key, {
      key: n.key,
      name: n.name,
      collectionKey: n.variableSetID?.assetRef?.key || null,
      resolvedType: n.variableResolvedType,
      valuesByMode,
    });
  }
  return { collections, variables };
}

// Resolve a variable to its final value for a given modeId, following ALIAS
// chains (a variable can point at another variable instead of a literal).
// Falls back to the variable's first defined mode if it has none for the
// requested modeId (common when a bound variable lives in a different
// collection than the one being resolved for). `seen` guards against cycles.
export function resolveVariableValue(index, key, modeId, seen = new Set()) {
  if (seen.has(key)) return null;
  seen.add(key);
  const variable = index.variables.get(key);
  if (!variable) return null;
  const entry = variable.valuesByMode.get(modeId) ?? variable.valuesByMode.values().next().value;
  if (!entry) return null;
  if (entry.type === 'ALIAS') return resolveVariableValue(index, entry.key, modeId, seen);
  return entry;
}

// A requested mode name (e.g. "dark") can mean a different modeId in every
// collection (each collection declares its own modes independently) — this
// maps every collection to whichever of its own modes matches by name
// (case-insensitive substring), falling back to that collection's first mode
// if none match, so variables in collections without a "Dark Mode" just keep
// their default value instead of resolving to nothing.
export function resolveModeIdByCollection(index, modeName) {
  const map = new Map();
  const needle = (modeName || '').toLowerCase();
  for (const [key, collection] of index.collections) {
    const mode = (needle && collection.modes.find((m) => m.name.toLowerCase().includes(needle))) || collection.modes[0];
    if (mode) map.set(key, mode.id);
  }
  return map;
}

// Resolve a paint's (or gradient stop's) colorVar binding using a per-
// collection mode map (from resolveModeIdByCollection) — returns a
// {r,g,b,a} color, or null if this paint/stop isn't actually bound to a
// variable (colorVar is present on plain literal paints too, just mirroring
// the literal value rather than pointing at one via .alias). Used by
// render.js when a specific mode is requested instead of the file's baked
// default.
export function resolveColorVar(index, colorVarHolder, modeIdByCollection) {
  const key = colorVarHolder?.colorVar?.value?.alias?.assetRef?.key;
  if (!key) return null;
  const variable = index.variables.get(key);
  if (!variable) return null;
  const modeId = modeIdByCollection.get(variable.collectionKey);
  const resolved = resolveVariableValue(index, key, modeId);
  return resolved?.type === 'COLOR' ? resolved.value : null;
}

// Every shared style (Fill/Text/Effect/Grid), keyed by its shared `key` — the
// style's *definition* node itself (see module doc comment above).
export function buildStyleIndex(nodeChanges) {
  const styles = new Map();
  for (const n of nodeChanges) if (n.styleType) styles.set(n.key, n);
  return styles;
}

// The style a node consumes for a given slot ('fill'|'text'|'effect'|'grid'|
// 'strokeFill'), or null if it doesn't use a shared style there.
const STYLE_FIELDS = {
  fill: 'styleIdForFill',
  text: 'styleIdForText',
  effect: 'styleIdForEffect',
  grid: 'styleIdForGrid',
  strokeFill: 'styleIdForStrokeFill',
};
export function consumedStyle(styleIndex, node, slot) {
  const key = node?.[STYLE_FIELDS[slot]]?.assetRef?.key;
  return key ? styleIndex.get(key) || null : null;
}
