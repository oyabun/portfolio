// Builds figx's --help / usage screen: a mascot logo (color+TTY permitting),
// then a colorized command reference with worked examples. All styling goes
// through style.js, so NO_COLOR / --no-color / non-TTY output degrade to
// plain, greppable text automatically — nothing here special-cases that.

import { colorEnabled, canShowLogo, makeStyler } from './style.js';
import { LOGO_LINES } from './logo.js';

const COMMANDS = [
  {
    name: 'decode',
    desc: 'Dump the decoded scene graph as JSON (blobs elided)',
    usage: 'figx decode <file.fig> [out.json]',
    examples: ['figx decode design.fig', 'figx decode design.fig out.json'],
  },
  {
    name: 'render',
    desc: 'Standalone HTML preview (inline SVG)',
    usage: 'figx render <file.fig> [out.html] [--mode=<name>]',
    examples: ['figx render design.fig', 'figx render design.fig preview.html', 'figx render design.fig --mode=dark'],
  },
  {
    name: 'export',
    desc: 'Export matching nodes (frames by default) as standalone .svg files',
    usage: 'figx export <file.fig> [outDir] [--type=FRAME] [--name=<substring>] [--id=<guid>] [--list] [--mode=<name>]',
    examples: [
      'figx export design.fig                        # every frame -> design-frames/',
      'figx export design.fig icons/ --type=ALL --name=icon',
      'figx export design.fig --id=1:172',
      'figx export design.fig --list                  # preview matches, write nothing',
      'figx export design.fig --mode=dark             # resolve variable-bound fills for Dark Mode',
    ],
  },
  {
    name: 'preview',
    desc: 'Render inline in the terminal (Kitty/iTerm2/ANSI — no external tools)',
    usage: 'figx preview <file.fig> [--page=<n>] [--type=FRAME] [--name=<substring>] [--id=<guid>] [--mode=<name>]',
    examples: ['figx preview design.fig', 'figx preview design.fig --name="Icon Button"', 'figx preview design.fig --mode=dark'],
  },
  {
    name: 'tokens',
    desc: 'Extract variables + shared styles as design tokens (JSON or CSS)',
    usage: 'figx tokens <file.fig> [out] [--format=json|css] [--mode=<name>] [--type=] [--name=] [--id=] [--list]',
    examples: [
      'figx tokens design.fig                         # whole file, as JSON (all modes per variable)',
      'figx tokens design.fig tokens.css --format=css  # CSS custom properties, default mode',
      'figx tokens design.fig dark.css --format=css --mode=dark',
      'figx tokens design.fig --id=1:172               # just what that node (+ its subtree) uses',
      'figx tokens design.fig --type=COMPONENT         # same, once per matching component',
    ],
  },
  {
    name: 'style',
    desc: 'Resolved CSS-like properties per node — fill, stroke, opacity, corner-radius, font-*',
    usage: 'figx style <file.fig> [out] [--type=FRAME] [--name=<substring>] [--id=<guid>] [--format=json|css] [--mode=<name>] [--list]',
    examples: [
      'figx style design.fig --id=1:172                # one node',
      'figx style design.fig --type=COMPONENT           # one entry per matching component',
      'figx style design.fig --name="Button" --format=css',
    ],
  },
  {
    name: 'browse',
    desc: 'Interactive gallery picker with a full-screen preview (needs a real TTY)',
    usage: 'figx browse <file.fig> [--type=FRAME] [--name=<substring>] [--no-color]',
    examples: [
      'figx browse design.fig',
      'figx browse design.fig --type=ALL --name=icon',
      "figx browse design.fig  # in full-screen, press 'i' for that node's tokens/style",
    ],
  },
];

export function renderHelp(flags) {
  const S = makeStyler(colorEnabled(flags));
  const lines = [];

  if (canShowLogo()) {
    for (const l of LOGO_LINES) lines.push(S.title(l));
    lines.push('');
  }

  lines.push(`${S.title('figx')} — offline .fig file viewer, decoder & renderer`);
  lines.push('');
  lines.push(S.title('USAGE'));
  lines.push('  figx <command> <file.fig> [options]');
  lines.push('');

  lines.push(S.title('COMMANDS'));
  for (const c of COMMANDS) lines.push(`  ${S.key(c.name.padEnd(9))}${c.desc}`);
  lines.push('');

  lines.push(S.title('EXAMPLES'));
  for (const c of COMMANDS) for (const ex of c.examples) lines.push(`  ${S.muted(ex)}`);
  lines.push('');

  lines.push(S.title('FULL SYNTAX'));
  for (const c of COMMANDS) lines.push(`  ${c.usage}`);
  lines.push('');

  lines.push(S.muted('npm run build:cli') + ' compiles a standalone binary — see README.md.');
  lines.push(S.muted('NO_COLOR=1') + ' or ' + S.muted('--no-color') + ' disables this screen\'s styling (browse\'s TUI too).');

  return lines.join('\n');
}
