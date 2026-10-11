// Minimal ANSI styling for the browse TUI's chrome — toolbar, help bar,
// labels. Deliberately NOT used anywhere near the actual rendered preview
// (rasterize/writeImage in termImage.js): those pixels are the design being
// previewed, not decorative CLI output, so they stay full color regardless
// of this setting — same reasoning an image viewer wouldn't grayscale photos
// because $NO_COLOR is set.
//
// Respects the NO_COLOR convention (https://no-color.org: "when present,
// regardless of value, prevent the addition of ANSI color") plus a
// `--no-color` flag and `TERM=dumb`.
// NO_COLOR / --no-color / TERM=dumb always win (an explicit request to turn
// color off should never be overridden). Otherwise colors are on only for a
// real terminal — piped/redirected output (`figx --help | cat`, `> file.txt`,
// CI logs) gets plain, greppable text by default, like most CLIs — unless
// FORCE_COLOR is set (the standard escape hatch for wanting color anyway,
// e.g. `figx --help | less -R`).
export function colorEnabled(flags) {
  if (flags && flags['no-color']) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.TERM === 'dumb') return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') return true;
  return !!process.stdout.isTTY;
}

// Whether to print the mascot logo at all: gated on a real terminal only
// (piped/redirected output — `figx --help | cat`, `> file.txt`, CI logs —
// skips the decorative banner), deliberately NOT on colorEnabled(). The logo
// itself is plain braille-dot Unicode text, not baked-in ANSI color, so it
// stays perfectly legible under NO_COLOR/--no-color — help.js just skips the
// accent tint in that case (via makeStyler already being a no-op then).
export function canShowLogo() {
  return !!process.stdout.isTTY;
}

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  fg_black: 30,
  fg_white: 37,
  fg_cyan: 36,
  bg_blue: 44,
  bg_cyan: 46,
};

// Returns a small set of named style functions. When `enabled` is false
// every function is the identity — callers never need their own branching.
export function makeStyler(enabled) {
  const wrap = (text, ...names) => {
    if (!enabled) return text;
    const codes = names.map((n) => CODES[n]).join(';');
    return `\x1b[${codes}m${text}\x1b[${CODES.reset}m`;
  };
  return {
    bar: (t) => wrap(t, 'bold', 'bg_blue', 'fg_white'),
    title: (t) => wrap(t, 'bold', 'fg_cyan'),
    muted: (t) => wrap(t, 'dim'),
    selected: (t) => wrap(t, 'bold', 'bg_cyan', 'fg_black'),
    key: (t) => wrap(t, 'bold'),
  };
}
