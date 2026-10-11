#!/usr/bin/env node
// figx — decode & preview Figma .fig files. Run `figx --help` for the full
// command reference with examples (src/cli/help.js).

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, resolve, join } from 'node:path';
import { decodeFig } from '../decode.js';
import { renderSvg, listNodes, renderNodeSvg, nodeTokens, nodeStyle } from '../render.js';
import { extractVariables, extractStyles, tokensToCss, resolveNodeTokens, nodeTokensToCss } from '../tokens.js';
import { printImage } from './termImage.js';
import { browse } from './browse.js';
import { renderHelp } from './help.js';

// Resolve --id/--type/--name against the document, shared by `export` and
// `preview` so the two commands pick the same nodes given the same flags.
function matchNodes(decoded, flags) {
  if (flags.id) return listNodes(decoded, {}).filter((m) => m.guid === flags.id);
  const typeFlag = typeof flags.type === 'string' ? flags.type : null;
  const types =
    typeFlag && typeFlag.toUpperCase() !== 'ALL'
      ? new Set(typeFlag.split(',').map((t) => t.trim().toUpperCase()))
      : typeFlag
        ? null // --type=ALL / --type=all -> every node type
        : new Set(['FRAME']); // no --type given -> default to frames
  return listNodes(decoded, { types, name: typeof flags.name === 'string' ? flags.name : undefined });
}

// Wrapped in an async IIFE (rather than top-level await) so this file can be
// esbuild-bundled to CommonJS for the compiled binary (scripts/build-cli.mjs)
// — Node's single-executable-application support only embeds CJS scripts,
// and CJS disallows top-level await.
(async () => {
const rawArgs = process.argv.slice(2);
const flags = {};
const pos = [];
for (const a of rawArgs) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const [cmd, file, out] = pos;

// -h is a single-dash flag, which the --flag regex above never matches (it
// only matches double-dash), so it falls through as an ordinary positional
// and lands in `cmd` — recognized here rather than in the parser, to keep
// that parser itself simple (no need to special-case single-dash anywhere
// else; every other flag in this CLI is --long-form).
const wantsHelp = flags.help || flags.h || cmd === 'help' || cmd === '-h';
if (wantsHelp || !cmd || !file) {
  console.log(renderHelp(flags));
  process.exit(wantsHelp ? 0 : 1);
}

const decoded = decodeFig(new Uint8Array(readFileSync(file)));
const name = basename(file).replace(/\.fig$/i, '');

if (cmd === 'decode') {
  const target = out || `${name}.json`;
  const json = JSON.stringify(
    decoded.message,
    (k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v),
    2
  );
  writeFileSync(target, json);
  console.log(`decoded ${decoded.message.nodeChanges.length} nodes -> ${resolve(target)}`);
} else if (cmd === 'render') {
  const mode = typeof flags.mode === 'string' ? flags.mode : undefined;
  const svg = renderSvg(decoded, { mode });
  const target = out || `${name}.html`;
  const html = htmlShell(name, svg, decoded);
  writeFileSync(target, html);
  console.log(`rendered ${decoded.message.nodeChanges.length} nodes -> ${resolve(target)}`);
} else if (cmd === 'export') {
  const matches = matchNodes(decoded, flags);

  if (flags.list) {
    for (const m of matches) console.log(`${m.type}\t${m.name}\t${m.guid}`);
    console.log(`${matches.length} match(es)`);
    process.exit(0);
  }

  if (!matches.length) {
    console.error('no matching nodes (try --type=ALL or --list to see what exists)');
    process.exit(1);
  }

  const mode = typeof flags.mode === 'string' ? flags.mode : undefined;
  const outDir = out || `${name}-frames`;
  mkdirSync(outDir, { recursive: true });
  const used = new Map();
  let count = 0;
  for (const m of matches) {
    const svg = renderNodeSvg(decoded, m.guid, { mode });
    if (!svg) continue;
    const base = m.name.replace(/[\/\\?%*:|"<>]/g, '-').trim() || m.type;
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    writeFileSync(join(outDir, n > 1 ? `${base}-${n}.svg` : `${base}.svg`), svg);
    count++;
  }
  console.log(`exported ${count} node(s) -> ${resolve(outDir)}`);
} else if (cmd === 'preview') {
  const mode = typeof flags.mode === 'string' ? flags.mode : undefined;
  const hasSelector = flags.id || flags.type || flags.name;
  if (hasSelector) {
    const matches = matchNodes(decoded, flags);
    if (!matches.length) {
      console.error('no matching nodes (try `figx export ... --list` to see what exists)');
      process.exit(1);
    }
    for (const m of matches) {
      const svg = renderNodeSvg(decoded, m.guid, { mode });
      if (svg) await printImage(svg, `${m.type}: ${m.name}`);
    }
  } else {
    const page = flags.page ? Number(flags.page) : 0;
    await printImage(renderSvg(decoded, { page, mode }), name);
  }
} else if (cmd === 'tokens') {
  const format = typeof flags.format === 'string' ? flags.format.toLowerCase() : 'json';
  if (format !== 'json' && format !== 'css') {
    console.error(`unknown --format: ${flags.format} (expected json or css)`);
    process.exit(1);
  }
  const mode = typeof flags.mode === 'string' ? flags.mode : undefined;
  const variables = extractVariables(decoded);
  const styles = extractStyles(decoded);

  // --id/--type/--name (same selector export/preview use) scopes the dump
  // to just what the matched node(s) actually consume, instead of the
  // file's whole palette — "design tokens by component" from the terminal.
  const hasSelector = flags.id || flags.type || flags.name;
  if (hasSelector) {
    const matches = matchNodes(decoded, flags);

    if (flags.list) {
      for (const m of matches) console.log(`${m.type}\t${m.name}\t${m.guid}`);
      console.log(`${matches.length} match(es)`);
      process.exit(0);
    }
    if (!matches.length) {
      console.error('no matching nodes (try --type=ALL or --list to see what exists)');
      process.exit(1);
    }

    const perNode = matches.map((m) => ({
      id: m.guid,
      type: m.type,
      name: m.name,
      tokens: resolveNodeTokens(nodeTokens(decoded, m.guid, { mode }) || [], { variables, styles }, mode),
    }));
    const totalRefs = perNode.reduce((s, n) => s + n.tokens.length, 0);

    const target = out || `${name}-tokens.${format}`;
    const content =
      format === 'css'
        ? perNode.map((n) => `/* ${n.type}: ${n.name} (${n.id}) */\n${nodeTokensToCss(n.tokens)}`).join('\n')
        : JSON.stringify(matches.length === 1 ? perNode[0] : perNode, null, 2);
    writeFileSync(target, content);
    console.log(`extracted ${totalRefs} token reference(s) across ${matches.length} node(s) -> ${resolve(target)}`);
  } else {
    const totalVars = variables.collections.reduce((s, c) => s + c.variables.length, 0);
    const totalStyles = styles.fill.length + styles.text.length + styles.effect.length + styles.grid.length;

    const target = out || `${name}-tokens.${format}`;
    const content = format === 'css' ? tokensToCss({ variables, styles }, mode) : JSON.stringify({ variables, styles }, null, 2);
    writeFileSync(target, content);
    console.log(
      `extracted ${totalVars} variable(s) across ${variables.collections.length} collection(s) and ${totalStyles} style(s) -> ${resolve(target)}`
    );
  }
} else if (cmd === 'style') {
  const format = typeof flags.format === 'string' ? flags.format.toLowerCase() : 'json';
  if (format !== 'json' && format !== 'css') {
    console.error(`unknown --format: ${flags.format} (expected json or css)`);
    process.exit(1);
  }
  const mode = typeof flags.mode === 'string' ? flags.mode : undefined;
  const matches = matchNodes(decoded, flags);

  if (flags.list) {
    for (const m of matches) console.log(`${m.type}\t${m.name}\t${m.guid}`);
    console.log(`${matches.length} match(es)`);
    process.exit(0);
  }
  if (!matches.length) {
    console.error('no matching nodes (try --type=ALL or --list to see what exists)');
    process.exit(1);
  }

  const perNode = matches.map((m) => ({
    id: m.guid,
    type: m.type,
    name: m.name,
    style: nodeStyle(decoded, m.guid, { mode }) || [],
  }));

  const target = out || `${name}-style.${format}`;
  let content;
  if (format === 'css') {
    content = perNode
      .map(({ type, name: nm, style }) => {
        if (!style.length) return '';
        const decls = style.map(([k, v]) => {
          if (k === 'stroke') {
            const [color, width] = v.split(' / ');
            return `  stroke: ${color};\n  stroke-width: ${width};`;
          }
          if (k === 'corner-radius') return `  border-radius: ${v};`;
          return `  ${k}: ${v};`;
        });
        return `/* ${type}: ${nm} */\n.style-${nm.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')} {\n${decls.join('\n')}\n}\n`;
      })
      .filter(Boolean)
      .join('\n');
  } else {
    content = JSON.stringify(matches.length === 1 ? perNode[0] : perNode, null, 2);
  }
  writeFileSync(target, content);
  console.log(`extracted style properties for ${perNode.length} node(s) -> ${resolve(target)}`);
} else if (cmd === 'browse') {
  const picked = await browse(decoded, flags);
  if (!picked) process.exit(1);
  console.log(`${picked.type}\t${picked.name}\t${picked.guid}`);
} else {
  console.error(`unknown command: ${cmd}\nRun 'figx --help' for usage.`);
  process.exit(1);
}
})();

function htmlShell(title, svg, decoded) {
  const meta = decoded.meta || {};
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title} — figx</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #111; color: #ddd; font: 13px/1.4 -apple-system, system-ui, sans-serif; }
  header { padding: 10px 16px; background: #1b1b1b; border-bottom: 1px solid #2a2a2a; display:flex; gap:16px; align-items:center; }
  header b { color:#fff; } header .muted { color:#888; }
  .stage { padding: 24px; overflow: auto; }
  .stage svg { max-width: 100%; height: auto; box-shadow: 0 8px 40px rgba(0,0,0,.6); border-radius: 4px; }
</style></head>
<body>
  <header>
    <b>${title}</b>
    <span class="muted">fig v${decoded.version} · ${decoded.message.nodeChanges.length} nodes · exported ${meta.exported_at || 'n/a'}</span>
    <span class="muted" style="margin-left:auto">figx POC</span>
  </header>
  <div class="stage">${svg}</div>
</body></html>`;
}
