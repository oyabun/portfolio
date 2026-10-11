/* Shared Playground chrome: a slim fixed top bar injected into every demo so you
   can jump between demos and get back to the catalog / main site. Self-contained
   (its own scoped styles) so it never depends on a demo's CSS. It samples the page
   background to follow the demo's light/dark theme, shows the current app's logo,
   and has a Notes switch that opens a fixed top-left window with the project's
   story: what it is, why I built it, and what I was trying to learn. Include with:
   <script src="../chrome.js" data-root=".." data-name="Den" data-type="App" defer></script> */
(function () {
  'use strict';
  if (/[?&]bare=1/.test(location.search)) return;
  var sc = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var root = sc.getAttribute('data-root') || '..';
  var name = sc.getAttribute('data-name') || 'Demo';
  var type = sc.getAttribute('data-type') || '';
  var H = 54;
  var P = root + '/';
  var catalog = P + 'index.html';
  var home = root + '/../index.html';

  var DEMOS = [
    { name: 'Den', type: 'App', path: 'den/index.html',
      logo: { light: 'den/resources/icon-light.svg', dark: 'den/resources/icon-dark.svg' },
      what: 'A private microVM sandbox for each coding agent, with its own filesystem, daemon and guarded network.',
      why: 'I wanted somewhere to let agents run wild, building and rewriting freely, without ever risking my actual machine.',
      learn: 'How far a per-session VM can isolate an agent, and what a safe network policy really has to allow to stay useful.' },
    { name: 'VCR', type: 'Web', path: 'vcr/index.html',
      mark: 'VCR',
      what: 'Replay Claude Code and Codex sessions like a tape: every prompt, tool call, token and dollar on a scrubbable timeline.',
      why: 'Agent runs go opaque the moment they finish, and I kept losing the thread of what a session actually did.',
      learn: 'Whether a raw session log can become a legible, shareable recording, parsed entirely in the browser with nothing uploaded.' },
    { name: 'Figx', type: 'Web', path: 'figx/docs/index.html',
      logo: { light: 'figx/docs/assets/fig.svg', dark: 'figx/docs/assets/fig.svg' },
      what: 'An offline .fig viewer that decodes Figma’s binary format and renders the scene graph to SVG, with a token inspector.',
      why: 'I wanted to open design files without an account, the cloud, or a plugin standing between me and the file.',
      learn: 'How Figma’s proprietary format actually packs layers and tokens, and how much of a design you can faithfully reconstruct from it.' },
    { name: 'TUI Studio', type: 'Tool', path: 'tui-studio/index.html',
      logo: { light: 'tui-studio/assets/logo-tui-studio_light.svg', dark: 'tui-studio/assets/logo-tui-studio_dark.svg' },
      what: 'A Figma-like visual editor for terminal UIs, with a neon-glass component kit built for the occasion.',
      why: 'Designing terminal interfaces meant hand-editing code, and there was no real visual tool for it.',
      learn: 'How close a browser canvas can get to a true terminal layout, and what a TUI component system needs to feel native.' },
    { name: 'HarbourMaster', type: 'App', path: 'harbourmaster/index.html',
      logo: { light: 'harbourmaster/AppIcon.png', dark: 'harbourmaster/AppIcon.png' },
      what: 'A macOS menu-bar app that shows which process holds which port, so dev servers never collide in the dark.',
      why: 'Two dev servers kept fighting over the same port, and the usual way to find the culprit was a chore every time.',
      learn: 'How to read the OS socket table cheaply and surface it in the menu bar without slowing the machine down.' },
    { name: 'tinyd', type: 'CLI', path: 'tinyd/index.html',
      logo: { light: 'tinyd/logo/favicon.svg', dark: 'tinyd/logo/favicon.svg' },
      what: 'A tiny TUI for your containers: manage images, containers and volumes straight from the terminal.',
      why: 'I live in the terminal and wanted Docker under control without leaving it or opening a heavy GUI.',
      learn: 'How much of Docker’s value fits into a fast, keyboard-first CLI that adapts to your light or dark terminal.' }
  ];
  var cur = null;
  for (var i = 0; i < DEMOS.length; i++) if (DEMOS[i].name === name) cur = DEMOS[i];
  var n = DEMOS.length, idx = -1;
  for (var j = 0; j < n; j++) if (DEMOS[j].name === name) idx = j;
  var prev = idx >= 0 ? DEMOS[(idx - 1 + n) % n] : null;
  var next = idx >= 0 ? DEMOS[(idx + 1) % n] : null;

  function parseRGB(s) {
    var m = /rgba?\(([^)]+)\)/.exec(s || '');
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (p.length < 3 || isNaN(p[0])) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function pageIsDark() {
    var el = document.body, c;
    do {
      c = parseRGB(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0.05) break;
      el = el === document.body ? document.documentElement : el.parentElement;
    } while (el && el !== document.documentElement);
    if (!c || c.a <= 0.05) c = parseRGB(getComputedStyle(document.documentElement).backgroundColor);
    if (c && c.a > 0.05) return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 < 0.5;
    var scheme = (getComputedStyle(document.documentElement).colorScheme || '').toLowerCase();
    if (scheme.indexOf('dark') >= 0) return true;
    if (scheme.indexOf('light') >= 0) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  var isDark = pageIsDark();

  var style = document.createElement('style');
  style.textContent = [
    '.pgc-root{--spring:cubic-bezier(0.22,1,0.36,1);--sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--bg:rgba(18,18,24,.9);--fg:#f4f4f6;--mut:#a7a7b3;--sep:#5c5c68;--line:rgba(255,255,255,.09);--hover:rgba(255,255,255,.09);--chip:rgba(255,255,255,.10);--chipbd:rgba(255,255,255,.16);--menu:#15151c;--menuline:rgba(255,255,255,.12);--shadow:0 24px 60px -20px rgba(0,0,0,.6)}',
    '.pgc-root.pgc-light{--spring:cubic-bezier(0.22,1,0.36,1);--sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace;--bg:rgba(255,255,255,.82);--fg:#1c1c22;--mut:#5a5a66;--sep:#b6b6be;--line:rgba(0,0,0,.10);--hover:rgba(0,0,0,.06);--chip:rgba(0,0,0,.05);--chipbd:rgba(0,0,0,.13);--menu:#ffffff;--menuline:rgba(0,0,0,.10);--shadow:0 24px 60px -24px rgba(0,0,0,.28)}',
    '.pgc{position:fixed;top:0;left:0;right:0;height:' + H + 'px;z-index:2147483000;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 16px;background:var(--bg);-webkit-backdrop-filter:blur(14px) saturate(1.5);backdrop-filter:blur(14px) saturate(1.5);color:var(--fg);font:500 13.5px/1 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;border-bottom:1px solid var(--line)}',
    '.pgc *{box-sizing:border-box}',
    '.pgc a{color:inherit;text-decoration:none}',
    '.pgc-brand{display:inline-flex;align-items:center;gap:10px;white-space:nowrap;min-width:0}',
    '.pgc-logo{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:7px;flex:none;overflow:hidden}',
    '.pgc-logo img{width:26px;height:26px;object-fit:contain;display:block}',
    '.pgc-mark{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--chip);border:1px solid var(--chipbd);color:var(--fg)}',
    '.pgc-wm{font-weight:700;letter-spacing:-.2px;font-size:14px}',
    '.pgc-sub{color:var(--mut);font-weight:500}',
    '.pgc-sep{color:var(--sep)}',
    '.pgc-cur{font-weight:600;color:var(--fg);overflow:hidden;text-overflow:ellipsis}',
    '.pgc-right{display:flex;align-items:center;gap:9px;flex:none}',
    '.pgc-chip{font:600 11.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--fg);background:var(--chip);border:1px solid var(--chipbd);border-radius:999px;padding:6px 11px}',
    '.pgc-link{font-weight:500;color:var(--mut);padding:8px 9px;border-radius:9px}',
    '.pgc-link:hover{color:var(--fg);background:var(--hover)}',
    '.pgc-sw{display:inline-flex;align-items:center;gap:8px;font-weight:500;color:var(--mut);cursor:pointer;user-select:none;padding:6px 9px 6px 10px;border-radius:10px;border:1px solid var(--chipbd);background:var(--chip)}',
    '.pgc-sw:hover{color:var(--fg)}',
    '.pgc-sw input{position:absolute;opacity:0;width:0;height:0}',
    '.pgc-sw i{position:relative;width:30px;height:18px;border-radius:999px;background:var(--chipbd);transition:background .2s ease;flex:none}',
    '.pgc-sw i::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--menu);transition:transform .22s var(--spring)}',
    '.pgc-sw input:checked + i{background:var(--fg)}',
    '.pgc-sw input:checked + i::after{transform:translateX(12px);background:var(--bg)}',
    '.pgc-dd{position:relative}',
    '.pgc-ddbtn{display:inline-flex;align-items:center;gap:7px;font:inherit;font-weight:500;color:var(--fg);background:var(--chip);border:1px solid var(--chipbd);border-radius:10px;padding:8px 12px;cursor:pointer}',
    '.pgc-ddbtn:hover{background:var(--hover)}',
    '.pgc-ddbtn svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s ease}',
    '.pgc-dd.open .pgc-ddbtn svg{transform:rotate(180deg)}',
    '.pgc-ddmenu{position:absolute;top:calc(100% + 8px);right:0;min-width:240px;max-height:70vh;overflow:auto;background:var(--menu);border:1px solid var(--menuline);border-radius:14px;padding:6px;box-shadow:var(--shadow);display:none}',
    '.pgc-dd.open .pgc-ddmenu{display:block}',
    '.pgc-group{font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);padding:11px 10px 6px}',
    '.pgc-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border-radius:9px;color:var(--fg);font-weight:500}',
    '.pgc-item:hover{background:var(--hover)}',
    '.pgc-item .t{font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mut)}',
    '.pgc-item.cur{background:var(--hover)}',
    '.pgc-item.cur .t{color:var(--bg);background:var(--fg);border-radius:999px;padding:3px 7px;font-weight:600}',
    '.pgc-note{position:fixed;top:' + (H + 12) + 'px;left:16px;z-index:2147482999;width:min(372px,calc(100vw - 32px));max-height:calc(100vh - ' + (H + 28) + 'px);overflow:auto;background:var(--menu);border:1px solid var(--menuline);border-radius:16px;box-shadow:var(--shadow);color:var(--fg);font-family:var(--sans);padding:18px 18px 18px;opacity:0;transform:translateY(-10px) scale(.98);pointer-events:none;transition:opacity .22s ease,transform .3s var(--spring)}',
    '.pgc-note.open{opacity:1;transform:none;pointer-events:auto}',
    '.pgc-note .ttl{display:block;font-size:19px;font-weight:700;letter-spacing:-.3px;line-height:1.15;color:var(--fg)}',
    '.pgc-note .role{display:block;font-size:12.5px;font-weight:500;line-height:1.3;color:var(--mut);margin:3px 0 16px}',
    '.pgc-note section{margin-top:15px;padding-top:15px;border-top:1px solid var(--line)}',
    '.pgc-note section:first-of-type{margin-top:0;padding-top:0;border-top:0}',
    '.pgc-note .lbl{display:block;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}',
    '.pgc-note p{margin:0;font-size:13.5px;line-height:1.62;color:var(--fg)}',
    '.pgc-spacer{height:' + H + 'px}',
    '.pgc-nav{display:inline-flex;align-items:center;gap:2px}',
    '.pgc-arrow{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;color:var(--mut);flex:none}',
    '.pgc-arrow:hover{color:var(--fg);background:var(--hover)}',
    '.pgc-arrow svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}',
    '.pgc-namedd{font-weight:600;color:var(--fg);white-space:nowrap;max-width:190px}',
    '.pgc-namedd svg{margin-left:2px;flex:none}',
    '.pgc-vr{width:1px;height:22px;background:var(--line);margin:0 5px;flex:none}',
    '@media (max-width:640px){.pgc-sub,.pgc-sep{display:none}.pgc-link.pgc-home{display:none}}'
  ].join('\n');
  document.head.appendChild(style);

  var order = ['App', 'Web', 'Tool', 'CLI'];
  var byType = {};
  DEMOS.forEach(function (d) { (byType[d.type] = byType[d.type] || []).push(d); });
  var menu = '';
  order.forEach(function (ty) {
    if (!byType[ty]) return;
    menu += '<div class="pgc-group">' + ty + '</div>';
    byType[ty].forEach(function (d) {
      var c = d.name === name ? ' cur' : '';
      var tag = d.name === name ? '<span class="t">current</span>' : '<span class="t">' + d.type + '</span>';
      menu += '<a class="pgc-item' + c + '" href="' + P + d.path + '">' + d.name + tag + '</a>';
    });
  });

  var logoHtml = '';
  if (cur && cur.logo) {
    var lp = (isDark ? cur.logo.dark : cur.logo.light) || cur.logo.light;
    logoHtml = '<span class="pgc-logo"><img src="' + P + lp + '" alt="" width="26" height="26"></span>';
  } else if (cur && cur.mark) {
    logoHtml = '<span class="pgc-mark">' + cur.mark + '</span>';
  }

  function sec(lbl, txt) { return txt ? '<section><span class="lbl">' + lbl + '</span><p>' + txt + '</p></section>' : ''; }
  var hasNote = cur && (cur.what || cur.why || cur.learn);
  var noteHtml = hasNote
    ? '<div class="pgc-note open"><span class="ttl">' + cur.name + '</span>' + (cur.type ? '<span class="role">' + cur.type + ' experiment</span>' : '') +
      sec('What it is', cur.what) + sec('Why I built it', cur.why) + sec('What I wanted to learn', cur.learn) + '</div>'
    : '';

  var rootEl = document.createElement('div');
  rootEl.className = 'pgc-root' + (isDark ? '' : ' pgc-light');
  rootEl.innerHTML =
    '<div class="pgc">' +
      '<a class="pgc-brand" href="' + catalog + '">' + logoHtml +
        '<span class="pgc-wm">Javier Alonso</span><span class="pgc-sub">Playground</span>' +
      '</a>' +
      '<div class="pgc-right">' +
        (type ? '<span class="pgc-chip">' + type + '</span>' : '') +
        (hasNote ? '<label class="pgc-sw">Notes<input type="checkbox" checked><i aria-hidden="true"></i></label>' : '') +
        '<div class="pgc-nav">' +
          (prev ? '<a class="pgc-arrow" href="' + P + prev.path + '" aria-label="Previous: ' + prev.name + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></a>' : '') +
          '<div class="pgc-dd"><button class="pgc-ddbtn pgc-namedd" type="button" aria-expanded="false">' + name + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><div class="pgc-ddmenu" role="menu">' + menu + '</div></div>' +
          (next ? '<a class="pgc-arrow" href="' + P + next.path + '" aria-label="Next: ' + next.name + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></a>' : '') +
        '</div>' +
        '<span class="pgc-vr" aria-hidden="true"></span>' +
        '<a class="pgc-link" href="' + catalog + '">Playground</a>' +
        '<a class="pgc-link pgc-home" href="' + home + '">Home</a>' +
      '</div>' +
    '</div>' +
    noteHtml;
  document.body.insertBefore(rootEl, document.body.firstChild);

  var spacer = document.createElement('div');
  spacer.className = 'pgc-spacer';
  document.body.insertBefore(spacer, rootEl.nextSibling);

  // Nudge each demo's own fixed/sticky top header below the chrome bar.
  [].forEach.call(document.querySelectorAll('header,nav,.bar,.nav,.topbar,.masthead,[class*="nav"],[class*="header"],[class*="bar"]'), function (el) {
    if (el.closest('.pgc-root')) return;
    var cs; try { cs = getComputedStyle(el); } catch (e) { return; }
    if ((cs.position === 'fixed' || cs.position === 'sticky') && parseFloat(cs.top || '0') <= 1) el.style.top = H + 'px';
  });

  var noteBtn = rootEl.querySelector('.pgc-sw input');
  var note = rootEl.querySelector('.pgc-note');
  if (noteBtn && note) noteBtn.addEventListener('change', function () { note.classList.toggle('open', noteBtn.checked); });

  var dd = rootEl.querySelector('.pgc-dd');
  var btn = rootEl.querySelector('.pgc-ddbtn');
  function close() { dd.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); var o = dd.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
  document.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
