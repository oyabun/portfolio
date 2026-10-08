// Interactive picker for `figx browse`: a thumbnail gallery grid you filter
// by typing and move around with arrow keys, Enter/Space to pop the
// highlighted cell into a full-screen preview (arrows there flip between
// items without leaving full-screen; Esc goes back to the grid). This is a
// human-facing convenience layered on top of the same primitives
// `export`/`preview` already expose as plain flags (--type/--name/--id/
// --list) — an agent or script should never need this file; it drives figx
// entirely through those flags instead. See the isTTY guard below, which
// refuses to run without a real terminal rather than hanging on stdin that
// will never receive a keypress.

import readline from 'node:readline';
import { listNodes, renderNodeSvg, nodeTokens, nodeStyle } from '../render.js';
import { rasterize, padRaster, toAnsiHalfBlockLines, writeImage, clearKittyImages, detectProtocol } from './termImage.js';
import { colorEnabled, makeStyler } from './style.js';

const GAP = 2; // columns between gallery cells
const CELL_ROWS = 8; // thumbnail height budget, in terminal rows (excludes the label row)

function resolveTypes(typeFlag) {
  if (!typeFlag) return new Set(['FRAME']); // no --type given -> default to frames
  return typeFlag.toUpperCase() === 'ALL' ? null : new Set(typeFlag.split(',').map((t) => t.trim().toUpperCase()));
}

const truncate = (s, w) => (s.length > w ? s.slice(0, Math.max(0, w - 1)) + '…' : s);
const padTo = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));

// A full-width single-line bar: `left` and `right` text with the gap between
// them filled so the whole line (and its background style, applied by the
// caller) spans exactly `width` columns edge to edge.
function fullWidthLine(left, right, width) {
  const gap = Math.max(1, width - left.length - right.length);
  return (left + ' '.repeat(gap) + right).slice(0, Math.max(width, left.length));
}

// Returns the picked { type, name, guid }, or null if the user backed out
// (Esc/Ctrl+C) without picking anything.
export async function browse(decoded, flags) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      'figx browse needs an interactive terminal (stdin/stdout must be a TTY).\n' +
        'For scripted or agent use, skip the picker entirely:\n' +
        '  figx export <file.fig> --list                 # see every match\n' +
        '  figx preview <file.fig> --name=<substring>     # or --type / --id\n' +
        '  figx export <file.fig> --id=<guid>'
    );
    process.exit(1);
  }

  const S = makeStyler(colorEnabled(flags));
  const all = listNodes(decoded, { types: resolveTypes(typeof flags.type === 'string' ? flags.type : null) });

  let query = typeof flags.name === 'string' ? flags.name : '';
  let selected = 0;
  let filtered = all;
  let mode = 'gallery'; // 'gallery' | 'full'
  let showInfo = false; // full-screen only: design tokens + style properties, toggled with 'i'
  const thumbCache = new Map(); // guid -> raster (padded to the current cell size) | null

  const recompute = () => {
    const q = query.toLowerCase();
    filtered = q ? all.filter((m) => m.name.toLowerCase().includes(q)) : all;
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
  };
  recompute();

  function gridDims() {
    const termCols = process.stdout.columns || 80;
    const termRows = process.stdout.rows || 24;
    const cols = Math.max(1, Math.min(6, Math.floor((termCols + GAP) / (24 + GAP))));
    const cellCols = Math.max(8, Math.floor((termCols - (cols - 1) * GAP) / cols));
    const availRows = Math.max(CELL_ROWS + 1, termRows - 5);
    const rowsPerPage = Math.max(1, Math.floor(availRows / (CELL_ROWS + 1)));
    return { cols, cellCols, rowsPerPage, pageSize: cols * rowsPerPage };
  }

  async function getThumb(guid, cellCols) {
    const key = `${guid}@${cellCols}`;
    if (thumbCache.has(key)) return thumbCache.get(key);
    const svg = renderNodeSvg(decoded, guid);
    if (!svg) {
      thumbCache.set(key, null);
      return null;
    }
    const raster = await rasterize(svg, { maxCols: cellCols, maxRows: CELL_ROWS });
    const padded = padRaster(raster, cellCols, CELL_ROWS * 2);
    const lines = toAnsiHalfBlockLines(padded);
    thumbCache.set(key, lines);
    return lines;
  }

  async function redrawGallery() {
    if (detectProtocol() === 'kitty') clearKittyImages();
    process.stdout.write('\x1b[2J\x1b[H');

    const termCols = process.stdout.columns || 80;
    const toolbar = fullWidthLine(' figx browse · GALLERY ', ` ${filtered.length}/${all.length} matches `, termCols);
    process.stdout.write(S.bar(toolbar) + '\n');
    process.stdout.write(' ' + S.title('Search') + ' ' + query + S.muted('▏') + '\n\n');

    if (!filtered.length) {
      process.stdout.write(S.muted(' (no matches)') + '\n');
    } else {
      const { cols, cellCols, rowsPerPage, pageSize } = gridDims();
      const page = Math.floor(selected / pageSize);
      const pageStart = page * pageSize;
      const pageItems = filtered.slice(pageStart, pageStart + pageSize);

      for (let r = 0; r < rowsPerPage; r++) {
        const rowItems = pageItems.slice(r * cols, r * cols + cols);
        if (!rowItems.length) break;
        // Sequential, not Promise.all: resvg-wasm's objects aren't safe for
        // concurrent/interleaved use — parallel rasterization here crashes
        // the WASM module ("recursive use of an object... unsafe aliasing").
        const thumbs = [];
        for (const it of rowItems) thumbs.push(await getThumb(it.guid, cellCols));

        for (let li = 0; li < CELL_ROWS; li++) {
          const parts = thumbs.map((t) => (t ? t[li] : `\x1b[0m${' '.repeat(cellCols)}`));
          process.stdout.write(parts.join(' '.repeat(GAP)) + '\n');
        }
        const labels = rowItems.map((it, ci) => {
          const idx = pageStart + r * cols + ci;
          const label = padTo(truncate(it.name, cellCols), cellCols);
          return idx === selected ? S.selected(label) : label;
        });
        process.stdout.write(labels.join(' '.repeat(GAP)) + '\n\n');
      }

      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      process.stdout.write(S.muted(`page ${page + 1}/${totalPages}`) + '\n');
    }

    process.stdout.write(
      '\n' +
        S.key('↑↓←→') +
        ' move   ' +
        S.key('Enter') +
        ' view full-screen   ' +
        S.key('Esc') +
        ' quit   ' +
        S.muted('(type to filter)') +
        '\n'
    );
  }

  // Design tokens (across the node's whole subtree) + resolved style
  // properties (of the node itself) — the TUI's answer to the web
  // Inspector's Design Tokens/Style panels, capped to a handful of lines
  // each so it fits alongside the thumbnail rather than pushing it off
  // screen entirely.
  const MAX_INFO_ROWS = 6;
  function formatInfoLines(guid, width) {
    const style = nodeStyle(decoded, guid) || [];
    const tokens = nodeTokens(decoded, guid) || [];
    const lines = [S.title('Style')];
    if (!style.length) lines.push(S.muted('  (none)'));
    else {
      for (const [k, v] of style.slice(0, MAX_INFO_ROWS)) lines.push('  ' + padTo(k, 15) + truncate(v, Math.max(10, width - 17)));
      if (style.length > MAX_INFO_ROWS) lines.push(S.muted(`  … +${style.length - MAX_INFO_ROWS} more`));
    }
    lines.push('', S.title('Design Tokens'));
    if (!tokens.length) lines.push(S.muted('  (none)'));
    else {
      for (const t of tokens.slice(0, MAX_INFO_ROWS)) lines.push('  ' + padTo(truncate(t.name, 26), 28) + S.muted(t.kind + ' · ' + t.slot));
      if (tokens.length > MAX_INFO_ROWS) lines.push(S.muted(`  … +${tokens.length - MAX_INFO_ROWS} more`));
    }
    return lines;
  }

  async function redrawFull() {
    if (detectProtocol() === 'kitty') clearKittyImages();
    process.stdout.write('\x1b[2J\x1b[H');
    const cur = filtered[selected];
    if (!cur) return redrawGallery();

    const termCols = process.stdout.columns || 80;
    const toolbar = fullWidthLine(' figx browse · FULL-SCREEN ', ` ${cur.type}: ${cur.name} `, termCols);
    process.stdout.write(S.bar(toolbar) + '\n');

    const infoLines = showInfo ? formatInfoLines(cur.guid, termCols) : [];
    const svg = renderNodeSvg(decoded, cur.guid);
    if (svg) {
      const cols = Math.max(10, termCols - 2);
      const rows = Math.max(6, (process.stdout.rows || 24) - 5 - infoLines.length);
      const raster = await rasterize(svg, { maxCols: cols, maxRows: rows });
      writeImage(raster, cols);
    }

    if (infoLines.length) process.stdout.write('\n' + infoLines.join('\n') + '\n');

    process.stdout.write(
      '\n' +
        S.key('←→') +
        ' prev/next   ' +
        S.key('Enter') +
        ' pick this one   ' +
        S.key('i') +
        (showInfo ? ' hide' : ' show') +
        ' tokens/style   ' +
        S.key('Esc') +
        ' back to grid' +
        '\n'
    );
  }

  const redraw = () => (mode === 'full' ? redrawFull() : redrawGallery());
  process.stdout.write('\x1b[?25l'); // hide the real cursor; our own UI draws its own indicators
  await redraw();

  return new Promise((resolvePick) => {
    let closed = false;
    const finish = (result) => {
      if (closed) return;
      closed = true;
      process.stdin.removeListener('keypress', onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      if (detectProtocol() === 'kitty') clearKittyImages();
      process.stdout.write('\x1b[2J\x1b[H\x1b[?25h'); // clear + restore the real cursor
      resolvePick(result);
    };

    const onKey = async (str, key) => {
      if (!key) return;
      if (key.ctrl && key.name === 'c') return finish(null);

      if (key.name === 'escape') {
        if (mode === 'full') {
          mode = 'gallery';
          return redraw();
        }
        return finish(null);
      }

      if (mode === 'full') {
        // Enter confirms/picks; arrows flip between items without leaving
        // full-screen. Typing is ignored here (except 'i') — Esc back to the
        // grid first.
        if (key.name === 'return') return finish(filtered[selected] || null);
        if (str === 'i') {
          showInfo = !showInfo;
          return redraw();
        }
        if (key.name === 'left' || key.name === 'up') {
          selected = Math.max(0, selected - 1);
          return redraw();
        }
        if (key.name === 'right' || key.name === 'down') {
          selected = Math.min(Math.max(0, filtered.length - 1), selected + 1);
          return redraw();
        }
        return;
      }

      // gallery mode — Enter drills into full-screen (doesn't exit browse
      // yet); every printable char (including space) types into the filter.
      if (key.name === 'return') {
        if (filtered[selected]) {
          mode = 'full';
          return redraw();
        }
        return;
      }
      const { cols } = gridDims();
      if (key.name === 'left') {
        selected = Math.max(0, selected - 1);
        return redraw();
      }
      if (key.name === 'right') {
        selected = Math.min(Math.max(0, filtered.length - 1), selected + 1);
        return redraw();
      }
      if (key.name === 'up') {
        selected = Math.max(0, selected - cols);
        return redraw();
      }
      if (key.name === 'down') {
        selected = Math.min(Math.max(0, filtered.length - 1), selected + cols);
        return redraw();
      }
      if (key.name === 'backspace') {
        query = query.slice(0, -1);
        recompute();
        return redraw();
      }
      if (str && str.length === 1 && !key.ctrl && !key.meta) {
        query += str;
        recompute();
        return redraw();
      }
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKey);
  });
}
