/* VCR Deck Studio: tape loading and the EJECT key.
   app.js reads window.TAPE once, so a tape is chosen here before app.js runs:
     player.html?demo=<id>   fetches demo-tapes/<id>.jsonl (needs http, not file://)
     ejected                 no tape: an empty deck saying INSERT TAPE
     a tape you loaded       is kept in sessionStorage and picked up on reload
     otherwise               the sample baked into js/shared/sample-tape.js
   Ejecting or loading a tape records it in sessionStorage and reloads the page. Ejecting lifts the cartridge
   out of the tape bay first (bay.js); with no tape in, a 3D drive waits for one (drive.js), and loading slides
   the tape into it before the page reloads. */
(function () {
  'use strict';
  const KEY = 'vcr-ds-tape', EJECTED = 'vcr-ds-ejected';
  // the demo shelf's tapes: read from ../demo-tapes/ at runtime (js/shared/demo-tapes.js), not hardcoded here
  const demos = () => (window.VCRDemoTapes ? window.VCRDemoTapes.list('../') : Promise.resolve([]));
  const demo1 = (id) => (window.VCRDemoTapes ? window.VCRDemoTapes.one('../', id) : Promise.resolve(null));
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmtDur = (sec) => { const m = Math.round(sec / 60); return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min'; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { sessionStorage.setItem(k, v); },        // may throw (quota, private mode): callers report it
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const here = location.pathname.split('/').pop() || 'player.html';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- choose the tape, then start the player ---------- */
  const load = (src) => { const b = document.createElement('script'); b.src = src; document.body.appendChild(b); };
  function start(tape) {
    if (tape) window.TAPE = tape;
    // price it with today's rates (a stored tape, or the baked sample, was priced when it was made)
    if (window.TAPE && window.tapePricing) window.tapePricing.recost(window.TAPE);
    const s = document.createElement('script');
    s.src = '../js/studio/app.js';
    s.onload = () => {
      addEjectKey();
      load('../js/studio/book.js');   // the book layout, built on the player
      load('../js/studio/bay.js');    // the tape bay: the tape in 3D, above the inspector
    };
    document.body.appendChild(s);
  }
  async function boot() {
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo && /^[a-z0-9-]+$/i.test(demo)) {
      const d = await demo1(demo);   // fetched and parsed on its own: the rest of the shelf doesn't hold this up
      if (d) { window.VCR_TAPE_COLOR = d.c; return start(d.tape); }
      return emptyDeck('Couldn’t load the demo tape “' + demo + '”' + (location.protocol === 'file:' ? ': demos need the page served over http.' : '.'), await demos());
    }
    if (ss.get(EJECTED)) return emptyDeck(null, await demos());
    const saved = ss.get(KEY);
    if (saved) { try { return start(JSON.parse(saved)); } catch (e) { ss.del(KEY); } }
    start();
  }

  /* ---------- loading and ejecting ---------- */
  // with the drive on screen, the tape goes in first: then go
  let drive = null;
  const through = (label, go) => { if (drive) drive.insert(label).then(go); else go(); };
  function loadFile(file, report) {
    if (!file) return;
    if (!/\.jsonl$/i.test(file.name)) { report('That is not a .jsonl session log.'); return; }
    const rd = new FileReader();
    rd.onerror = () => report('Couldn’t read ' + file.name + '.');
    rd.onload = () => {
      let tape;
      try { tape = window.parseTape(rd.result, file.name); } catch (e) { report(e.message); return; }
      try { ss.set(KEY, JSON.stringify(tape)); } catch (e) { report('This tape is too big to keep in the browser session.'); return; }
      ss.del(EJECTED);
      const secs = tape.duration / 1000;
      through({ name: tape.title, dur: fmtDur(secs), secs, sub: tape.events.length + ' events · ' + file.name, color: css('--orange') },
        () => { location.href = here; });         // drop any ?demo= so the stored tape plays
    };
    rd.readAsText(file);
  }
  function loadDemo(d) {
    ss.del(EJECTED);
    through({ name: d.name, dur: fmtDur(d.secs), secs: d.secs, sub: d.lines + ' events · ' + d.file, color: css(d.c) },
      () => { location.href = here + '?demo=' + encodeURIComponent(d.id); });
  }
  function loadSample() {
    const t = window.TAPE, secs = t ? t.duration / 1000 : 0;
    ss.del(EJECTED); ss.del(KEY);
    through({ name: t ? t.title : 'Sample session', dur: fmtDur(secs), secs, sub: 'the sample tape', color: css('--orange') }, () => { location.href = here; });
  }
  function eject() {
    if (eject.busy) return; eject.busy = true;
    ss.del(KEY);
    try { ss.set(EJECTED, '1'); } catch (e) {}
    const go = () => { location.href = here; };
    const label = document.querySelector('.tape-label');
    // the tape slides up out of the label slot (and out of the tape bay, if it's showing), then the deck comes back empty
    if (label && !reduced) label.classList.add('ejecting');
    const out = window.VCRBay && window.VCRBay.eject();
    if (out) out.then(go); else if (label && !reduced) setTimeout(go, 300); else go();
  }
  window.VCREject = eject;
  function onDrop(report, over) {
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; over(true); });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; over(false); } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; over(false);
      loadFile(e.dataTransfer.files[0], report);
    });
  }
  const typing = (e) => e.metaKey || e.ctrlKey || e.altKey || (e.target && e.target.matches && e.target.matches('input, textarea, select'));

  /* ---------- with a tape in: the EJECT key in the top bar ---------- */
  function addEjectKey() {
    const key = document.createElement('button');
    key.className = 'mini-key'; key.id = 'btnEject';
    key.setAttribute('data-tip', 'Eject the tape'); key.setAttribute('data-kbd', 'E'); key.setAttribute('aria-label', 'Eject the tape');
    key.innerHTML = EJECT_ICON;
    const custom = document.getElementById('btnCustom');
    custom.parentNode.insertBefore(key, custom);
    key.addEventListener('click', eject);
    document.addEventListener('keydown', (e) => { if (!typing(e) && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); eject(); } });
    // dropping a .jsonl on a loaded deck swaps the tape straight away
    onDrop((m) => alert(m), () => {});
  }
  const EJECT_ICON = '<svg viewBox="0 0 20 20"><path d="M10 4.5 4.5 11h11z" fill="currentColor" stroke="none"/><path d="M4.5 14.5h11"/></svg>';

  /* ---------- no tape: the empty deck ---------- */
  function emptyDeck(error, list) {
    list = list || [];
    document.getElementById('app').hidden = true;
    const key = (cls, label, svg, attrs) => '<button class="key ' + cls + '" aria-label="' + label + '" ' + (attrs || 'disabled') + '>' + svg + '</button>';
    const deck = document.createElement('div');
    deck.className = 'empty-deck'; deck.id = 'emptyDeck';
    deck.innerHTML =
      '<header class="topbar">' +
        '<a class="brand" href="../player.html" aria-label="Back to the player"><span class=\"mk\" aria-hidden=\"true\"><i class=\"sp\"></i><i class=\"st\"></i></span>vcr<span class="brand-sub">DECK STUDIO</span></a>' +
        '<div class="tape-label"><span class="tape-title">No tape</span><span class="tape-meta">Ejected</span></div>' +
        '<button class="mini-key theme-key" id="edTheme" aria-label="Toggle theme">' +
          '<svg class="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>' +
          '<svg class="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' +
        '</button>' +
      '</header>' +
      '<main class="ed-main">' +
        // the drive (drive.js): shown when it can be drawn
        '<div class="ed-drive" id="edDrive" hidden><canvas aria-label="A cartridge deck with its slot empty and INSERT TAPE on its display, the outline of a tape waiting above it. Its EJECT key or slot opens a tape."></canvas></div>' +
        '<section class="ed-screen" id="edScreen" aria-labelledby="edBig">' +
          '<p class="dot ed-big" id="edBig">INSERT TAPE</p>' +
          '<p class="ed-sub">Your agent already wrote the log. Drop it here, or open one.</p>' +
          '<div class="ed-row">' +
            '<label class="cta-key"><input type="file" accept=".jsonl,application/jsonl,application/x-ndjson" id="edFile">' +
              '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>Open a tape</label>' +
            '<button class="tog-key big" id="edSample"><i class="led on"></i>SAMPLE</button>' +
          '</div>' +
          '<p class="ed-err" id="edErr" role="alert"' + (error ? '' : ' hidden') + '>' + esc(error || '') + '</p>' +
          '<p class="ed-note">Claude Code keeps sessions under <code>.claude/projects/</code> in your home folder: ' +
            '<code>/Users/you/.claude/projects/</code> on macOS, <code>/home/you/.claude/projects/</code> on Linux, ' +
            '<code>C:\\Users\\you\\.claude\\projects\\</code> on Windows. The file is read in this page; nothing is uploaded.</p>' +
        '</section>' +
        '<div class="ed-transport">' +
          '<div class="keys">' +
            key('k-sm', 'Go to start', '<svg viewBox="0 0 24 24"><path d="M5 5h2.5v14H5zM19 5.5v13L9 12z"/></svg>') +
            key('k-rew', 'Rewind', '<svg viewBox="0 0 24 24"><path d="M11 6 3 12l8 6V6zm10 0-8 6 8 6V6z"/></svg>') +
            key('k-play', 'Play', '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>') +
            key('k-ff', 'Fast-forward', '<svg viewBox="0 0 24 24"><path d="M13 6l8 6-8 6V6zM3 6l8 6-8 6V6z"/></svg>') +
            key('k-sm', 'Go to end', '<svg viewBox="0 0 24 24"><path d="M16.5 5H19v14h-2.5zM5 5.5v13L15 12z"/></svg>') +
          '</div>' +
          '<span class="t-sep" aria-hidden="true"></span>' +
          key('k-eject on', 'Eject (open: insert a tape)', '<svg viewBox="0 0 24 24"><path d="M12 5 5 13h14zM5 16h14v2.5H5z"/></svg>', 'id="edEject" data-tip="Open a tape"') +
        '</div>' +
        '<div class="ed-shelf">' +
          '<div class="ed-h">DEMO TAPES</div>' +
          (!list.length ? '<p class="ed-sub">No demo tapes to show. Open one of your own.</p>' :
          // the demo tapes as small cartridges (cart3d.js, shelf.css), or as black label chips without it
          window.VCRCart3D
            ? '<div class="ed-demos mshelf">' + list.map((d) => window.VCRCart3D.miniCart({ name: d.name, sec: d.secs, c: 'var(' + d.c + ')', foot: [d.file, d.lines + ' events'], attrs: 'data-demo="' + d.id + '"' })).join('') + '</div>'
            : '<div class="ed-demos">' + list.map((d) =>
              '<button class="ed-tape" style="--c:var(' + d.c + ')" data-demo="' + d.id + '"><b>' + esc(d.name) + '</b><small>' + fmtDur(d.secs) + ' · ' + d.file + '</small></button>').join('') + '</div>') +
        '</div>' +
      '</main>';
    document.body.appendChild(deck);
    document.title = 'Insert tape · VCR Deck Studio';

    const err = deck.querySelector('#edErr'), file = deck.querySelector('#edFile'), screen = deck.querySelector('#edScreen');
    const report = (m) => { err.textContent = m; err.hidden = false; };
    file.addEventListener('change', () => loadFile(file.files[0], report));
    deck.querySelector('#edEject').addEventListener('click', () => file.click());
    deck.querySelector('#edSample').addEventListener('click', loadSample);
    const shelf = deck.querySelector('.ed-demos');
    if (shelf) shelf.addEventListener('click', (e) => {
      const b = e.target.closest('[data-demo]'); if (!b) return;
      shelf.querySelectorAll('[data-demo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (drive) deck.querySelector('#edDrive').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
      const d = list.find((x) => x.id === b.dataset.demo); if (d) loadDemo(d);
    });
    if (shelf && window.VCRCart3D && shelf.classList.contains('mshelf')) window.VCRCart3D.tiltShelf(shelf);
    // the drive: the 3D deck waiting for a tape. Its LCD says INSERT TAPE, so the screen's big words step aside
    const host = deck.querySelector('#edDrive');
    host.hidden = false;
    drive = window.VCRDrive ? window.VCRDrive.mount(host, { open: () => file.click() }) : null;   // its EJECT key and slot open a tape
    if (drive) deck.classList.add('has-drive');
    else host.remove();
    deck.querySelector('#edTheme').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('vcr-ds-theme', next); } catch (e) {}
    });
    document.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') { if (e.target === document.body) { e.preventDefault(); file.click(); } }
    });
    onDrop(report, (on) => { screen.classList.toggle('over', on); if (drive) drive.over(on); });
  }

  boot();
})();
