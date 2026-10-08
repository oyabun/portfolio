# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **static landing page** for TUIStudio — a Figma-like visual editor for Terminal UI (TUI) applications. There is no build system, package manager, or framework. Everything is plain HTML, CSS, and vanilla JS served directly.

## File Structure

- `index.html` — Main landing page (self-contained: all CSS is inlined in `<style>` tags, all JS is inlined at the bottom)
- `neon-glass.css` — Reusable "Neon Glass" UI component styles (buttons, switches, pixel particles)
- `neon-glass.js` — Vanilla JS module (`NeonGlass`) that powers button hover/click pixel particle effects and toggle switch behavior
- `assets/` — Static assets: SVG logos (dark/light variants), favicons, `Computer.png` hero image, `landing.html` (a separate compiled React app entry point)
- `screenshots/` — Feature screenshots and `video.mp4` used in the landing page

## Design System

**Color palette** (CSS variables in `index.html`):
- `--bg: #13151f`, `--bg-mid: #0e1018`, `--bg-card: #1a1d2a`
- `--green: #4ade80` (primary accent), `--green-dim: #4a8a58`, `--green-mid: #7dd99a`
- `--text-hi: #eaeef6`, `--text-mid: #a0aab8`, `--text-dim: #6b7585`

**Fonts**: `VT323` (retro terminal display, via Google Fonts) + `SF Mono / Fira Code / Cascadia Code` (monospace body).

**Aesthetic**: Dark terminal/CRT theme with dot-grid background, CRT scanlines, neon green glow effects, pixel particle animations.

## Neon Glass Components

`neon-glass.css` + `neon-glass.js` implement two reusable components:

- **`.ng-btn`** — A raised keycap-style button. Wrap in `.ng-platform` for the recessed bezel effect. Use `.ng-platform--sm` / `.ng-btn--sm` for a smaller variant. Add `.ng-platform--primary` for a green glow border.
  ```html
  <div class="ng-platform ng-platform--primary">
    <button class="ng-btn">
      <span class="ng-btn-shine"></span>
      <span class="ng-btn-label">LABEL</span>
    </button>
  </div>
  ```
- **`.ng-switch`** — A toggle switch with ON/OFF glow. Wrap in `.ng-switch-row` to include the state label.

Initialize with `NeonGlass.init()` to auto-bind all `.ng-btn` and `.ng-switch` elements on the page.

## Development

No build step required. Open `index.html` directly in a browser or serve with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

The `assets/landing.html` is a compiled React app (separate project, not editable here — source not present in this repo).
