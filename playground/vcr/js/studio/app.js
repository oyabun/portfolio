/* ==========================================================================
   VCR Deck Studio
   Studio's workspace (bins, program monitor, inspector, multi-track timeline)
   dressed as the Deck: dot-matrix screen, chunky keys, speed menu, odometer
   gauges and a draggable tape reel. Vanilla JS, no build; reads window.TAPE.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const TAPE = window.TAPE;
  if (!TAPE || !Array.isArray(TAPE.events)) {
    document.body.innerHTML = '<p style="padding:24px;font:14px system-ui">Could not load <code>js/shared/sample-tape.js</code>.</p>';
    return;
  }

  /* ------------------------------------------------------------------ *
   * Constants & formatting
   * ------------------------------------------------------------------ */
  const EV = TAPE.events;
  const RS = TAPE.responses || [];
  const DUR = Math.max(1, TAPE.duration || (EV.length ? EV[EV.length - 1].t + 1000 : 1000));
  const FPS = 30;
  const MIN_SPAN = Math.min(5000, DUR);
  const RULER = 28, TH = 26, WH = 82;
  const LADDER = [1, 2, 5, 10, 30, 60, 120, 240, 480];
  const speedCtls = [];   // every speed control on the page (speedControl), kept in step by syncKnob
  const TAPE_ZOOMS = [2, 4, 10, 24, 60, 150]; // tape px per second
  const CWD = TAPE.cwd || '';

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mqReduce.matches;
  try { mqReduce.addEventListener('change', (e) => { reduced = e.matches; }); } catch (e) {}

  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function tcParts(ms) {
    ms = Math.max(0, ms);
    const s = Math.floor(ms / 1000);
    const f = Math.min(FPS - 1, Math.floor((ms % 1000) / (1000 / FPS)));
    return [pad(Math.floor(s / 3600)), pad(Math.floor(s / 60) % 60), pad(s % 60), pad(f)];
  }
  const fmtTC = (ms) => tcParts(ms).join(':');
  function fmtClock(ms) {
    const s = Math.floor(Math.max(0, ms) / 1000), h = Math.floor(s / 3600);
    return (h ? h + ':' + pad(Math.floor(s / 60) % 60) : pad(Math.floor(s / 60))) + ':' + pad(s % 60);
  }
  function fmtDur(ms) {
    if (ms == null || isNaN(ms)) return '—';
    if (ms < 1000) return Math.round(ms) + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(ms < 10000 ? 2 : 1) + 's';
    const m = Math.floor(ms / 60000);
    return m + 'm ' + pad(Math.floor((ms % 60000) / 1000)) + 's';
  }
  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
    return String(Math.round(n));
  }
  // odometer format: stable digit count within each magnitude so digits roll instead of reshaping
  function fmtOdo(n) {
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6) return (n / 1e3).toFixed(1) + 'K';
    return (n / 1e6).toFixed(2) + 'M';
  }
  const fmtUSD = (n) => '$' + (n || 0).toFixed(2);
  const pct = (k) => (clamp(k, 0, 1) * 100).toFixed(2) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ub(arr, v) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m + 1; else hi = m; } return lo; }
  function rgba(hex, a) {
    hex = (hex || '#888').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  function vib(ms) {
    if (reduced || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (e) {}
  }

  /* ------------------------------------------------------------------ *
   * Icons
   * ------------------------------------------------------------------ */
  const ICON = {
    prompt: '<svg viewBox="0 0 20 20"><circle cx="10" cy="7" r="3.2"/><path d="M3.8 17c.9-3.2 3.3-5 6.2-5s5.3 1.8 6.2 5"/></svg>',
    text: '<svg viewBox="0 0 20 20"><path d="M10 2.8l1.7 4.3 4.5 1.9-4.5 1.9L10 15.2l-1.7-4.3L3.8 9l4.5-1.9z"/><path d="M15.5 13.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/></svg>',
    thinking: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" stroke-dasharray="2.4 2.2"/><circle cx="10" cy="10" r="2"/></svg>',
    Bash: '<svg viewBox="0 0 20 20"><rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M6 8l2.5 2L6 12M10.5 12.5H14"/></svg>',
    Read: '<svg viewBox="0 0 20 20"><path d="M5 2.8h6.5L15 6.3V17H5z"/><path d="M11.3 3v3.5H15M7.5 10h5M7.5 13h5"/></svg>',
    Write: '<svg viewBox="0 0 20 20"><path d="M5 2.8h6.5L15 6.3V17H5z"/><path d="M10 9v5.5M7.2 11.8h5.6"/></svg>',
    Edit: '<svg viewBox="0 0 20 20"><path d="M13.5 3.5l3 3L7 16H4v-3z"/><path d="M11.5 5.5l3 3"/></svg>',
    Skill: '<svg viewBox="0 0 20 20"><path d="M11 2.5L4.5 11H10l-1 6.5L15.5 9H10z"/></svg>',
    other: '<svg viewBox="0 0 20 20"><path d="M10 2.8l6.2 3.5v7.4L10 17.2l-6.2-3.5V6.3z"/><path d="M3.8 6.3L10 10l6.2-3.7M10 10v7.2"/></svg>',
  };
  const iconFor = (key) => ICON[key] || ICON.other;

  /* ------------------------------------------------------------------ *
   * Derived data: tracks, clip spans, labels, token prefix sums
   * ------------------------------------------------------------------ */
  const KIND_LABEL = { prompt: 'Prompt', text: 'Reply', thinking: 'Thinking' };
  const CVAR = { prompt: '--c-prompt', text: '--c-text', thinking: '--c-thinking', Bash: '--c-bash', Read: '--c-read', Write: '--c-write', Edit: '--c-edit', Skill: '--c-skill' };
  const basename = (p) => String(p || '').split('/').filter(Boolean).pop() || String(p || '');
  const relPath = (p) => (CWD && p && p.indexOf(CWD + '/') === 0 ? p.slice(CWD.length + 1) : p);

  function parseInput(s) {
    s = String(s || '');
    if (!/^\s*[{[]/.test(s)) return null;
    try {
      const o = JSON.parse(s);
      if (o && o.__unparsedToolInput) {
        const raw = o.__unparsedToolInput.raw || '';
        try { return JSON.parse(raw); } catch (e) {
          const m = /"(?:file_path|command|skill)"\s*:\s*"([^"]+)"/.exec(raw);
          return m ? { _first: m[1], _raw: raw } : { _raw: raw };
        }
      }
      return o;
    } catch (e) {
      const m = /"(?:file_path|command|skill)"\s*:\s*"([^"]+)"/.exec(s);
      const a = /"args"\s*:\s*"([^"]*)/.exec(s);
      return m ? { _first: m[1], _args: a ? a[1] : '' } : null;
    }
  }

  function describe(e) {
    if (e.kind !== 'tool') {
      const txt = e.text || '';
      return { title: KIND_LABEL[e.kind] || e.kind, cmd: txt, label: txt || (e.kind === 'thinking' ? 'thinking' : '') };
    }
    const tool = e.tool || 'Tool';
    const inp = e.input || '';
    if (tool === 'Bash') return { title: 'bash — ' + (basename(CWD) || '~'), cmd: inp, label: inp };
    if (tool === 'Read' || tool === 'Write' || tool === 'Edit') {
      let path = inp;
      if (!/^\//.test(inp)) { const o = parseInput(inp); path = (o && (o.file_path || o._first)) || inp; }
      return { title: relPath(path), cmd: tool.toLowerCase() + ' ' + relPath(path), label: basename(path), path: path };
    }
    if (tool === 'Skill') {
      const o = parseInput(inp) || {};
      const name = o.skill || o._first || 'skill';
      const args = o.args || o._args || '';
      return { title: 'skill: ' + name, cmd: '/' + name + (args ? ' ' + args : ''), label: name };
    }
    const o = parseInput(inp);
    return { title: tool, cmd: inp, label: (o && (o._first || o.file_path || o.command)) || inp };
  }

  EV.forEach((e, i) => {
    e.i = i;
    e.key = e.kind === 'tool' ? (e.tool || 'Tool') : e.kind;
    if (e.kind === 'tool') e.end = e.t + Math.max(0, e.dur || 0);
    else { const n = EV[i + 1]; e.end = Math.max(e.t, Math.min(n ? n.t : DUR, e.t + 60000)); }
    e.info = describe(e);
    e.label = String(e.info.label || '').replace(/\s+/g, ' ').slice(0, 120);
    e.hay = [e.key, e.text, e.input, e.result].join(' ').toLowerCase();
    e.cat = e.kind === 'text' ? 'reply' : e.kind !== 'tool' ? e.kind : /^mcp__/.test(e.key) ? 'mcp' : e.key.toLowerCase();
  });
  const TS = EV.map((e) => e.t);
  const errCum = new Int32Array(EV.length);
  EV.forEach((e, i) => { errCum[i] = (i ? errCum[i - 1] : 0) + (e.err ? 1 : 0); });
  const TOT_ERR = EV.length ? errCum[EV.length - 1] : 0;

  const counts = {};
  EV.forEach((e) => { counts[e.key] = (counts[e.key] || 0) + 1; });
  const toolKeys = Object.keys(counts).filter((k) => !(k in KIND_LABEL)).sort((a, b) => counts[b] - counts[a]);
  const TRACKS = ['prompt', 'text', 'thinking'].filter((k) => counts[k]).concat(toolKeys).map((key, idx) => ({
    key, idx, label: KIND_LABEL[key] || key, cv: CVAR[key] || '--c-other', evs: EV.filter((e) => e.key === key), color: '#888',
  }));
  const TRACK_BY = {};
  TRACKS.forEach((t) => { TRACK_BY[t.key] = t; });
  const kcOf = (key) => 'var(' + ((TRACK_BY[key] && TRACK_BY[key].cv) || '--c-other') + ')';

  const RT = RS.map((r) => r.t);
  const cum = { cost: [0], out: [0], inp: [0], cr: [0], cw: [0] };
  RS.forEach((r, i) => {
    cum.cost.push(cum.cost[i] + (r.cost || 0));
    cum.out.push(cum.out[i] + (r.out || 0));
    cum.inp.push(cum.inp[i] + (r.in || 0));
    cum.cr.push(cum.cr[i] + (r.cr || 0));
    cum.cw.push(cum.cw[i] + (r.cw || 0));
  });
  const NR = RS.length;
  const TOT = { cost: cum.cost[NR], out: cum.out[NR], inp: cum.inp[NR], cr: cum.cr[NR], cw: cum.cw[NR] };
  const inAt = (n) => cum.inp[n] + cum.cr[n] + cum.cw[n];
  const TOT_IN = inAt(NR);
  const ctxOf = (r) => (r.in || 0) + (r.cr || 0) + (r.cw || 0);
  const PEAK_CTX = RS.reduce((m, r) => Math.max(m, ctxOf(r)), 1);
  const MAX_OUT = RS.reduce((m, r) => Math.max(m, r.out || 0), 1);
  const costAt = (t) => cum.cost[ub(RT, t)];
  const respFor = (e) => { const n = ub(RT, e.t); return n ? RS[n - 1] : null; };

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  const prefs = store.get('vcr-ds-prefs', {});
  const S = {
    t: 0, playing: false, base: LADDER.indexOf(prefs.base) >= 0 ? prefs.base : 10, rate: 10,
    cur: -1, forced: -1, sel: -1, hover: -1,
    followTL: true, followList: true, snap: true, skip: false,
    loopIn: null, loopOut: null, loopOn: false,
    v: { start: 0, span: Math.min(DUR, 6 * 60000) },
    scrollY: 0, hidden: new Set(), match: null,
    view: 'transcript', showTokens: true, metaOpen: false, inspTab: 'inspector', typing: null,
    shuttle: null, tapeDrag: false, coastV: 0, tapeZoom: 2,
  };
  S.rate = S.base;
  const D = { tl: true, ov: true, comp: true, cost: true, tape: true };

  const app = $('#app');
  if (prefs.right) app.style.setProperty('--right', prefs.right + 'px');
  if (prefs.tlh) app.style.setProperty('--tl-h', prefs.tlh + 'px');
  const savePrefs = () => store.set('vcr-ds-prefs', prefs);

  /* ------------------------------------------------------------------ *
   * Canvas colours. The timeline, tape and screen are "hardware black" in
   * both themes, so they read fixed --hw-* tokens rather than the theme.
   * ------------------------------------------------------------------ */
  let C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    C = {
      bg: g('--hw-bg'), bg2: g('--hw-bg-2'), panel: g('--hw-panel'), panel2: g('--hw-panel-2'),
      line: g('--hw-line'), line2: g('--hw-line-2'), line3: g('--hw-line-3'),
      fg: g('--hw-fg'), fg2: g('--hw-fg-2'), fg3: g('--hw-fg-3'), fg4: g('--hw-fg-4'),
      accent: g('--orange'), err: g('--err'), wave: g('--hw-wave'), waveHi: g('--hw-wave-hi'),
      prompt: g('--c-prompt'), text: g('--c-text'), thinking: g('--c-thinking'), tool: g('--c-bash'),
    };
    TRACKS.forEach((t) => { t.color = g(t.cv) || '#888'; });
  }
  function currentTheme() {
    const a = document.documentElement.getAttribute('data-theme');
    if (a) return a;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('vcr-ds-theme', next); } catch (e) {}
    readColors();
    D.tl = D.ov = D.comp = D.cost = D.tape = true;
    vib(6);
  }

  /* ------------------------------------------------------------------ *
   * Static chrome
   * ------------------------------------------------------------------ */
  document.title = (TAPE.title ? TAPE.title + ' · ' : '') + 'VCR Deck Studio';
  const startDate = new Date(TAPE.start || Date.now());
  $('#tapeTitle').textContent = TAPE.title || TAPE.source || 'Untitled session';
  $('#tapeMeta').textContent = [TAPE.source, TAPE.model, isNaN(startDate) ? '' : startDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    fmtClock(DUR) + ' long', EV.length + ' events'].filter(Boolean).join(' · ');
  $('#scCostTotal').textContent = fmtUSD(TOT.cost);

  /* ---------- Avatars ----------
     The agent's mark comes from lobe-icons (claude-color, codex), inlined so
     the page still opens from file://. The log says nothing about who the
     user is, so theirs is a plain person glyph. */
  const AGENT = /codex|gpt|openai|^o\d/i.test((TAPE.provider || '') + ' ' + (TAPE.model || ''))
    ? { key: 'codex', name: 'Codex', svg: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path clip-rule="evenodd" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"></path></svg>' }
    : { key: 'claude', name: 'Claude', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero"></path></svg>' };
  const PERSON = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="3.2"/><path d="M3.8 17c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5"/></svg>';
  const avatar = (who) => who === 'user'
    ? '<span class="av user" title="You">' + PERSON + '</span>'
    : '<span class="av agent ' + AGENT.key + '" title="' + AGENT.name + '">' + AGENT.svg + '</span>';
  const speaker = (e) => e.kind === 'prompt' ? 'user' : 'agent';

  /* ---------- Transcript ---------- */
  const transcript = $('#transcript');
  function rowSnippet(e) {
    if (e.kind === 'thinking') return e.text ? esc(e.text) : 'Reasoning (not in the log)';
    if (e.kind === 'tool') return esc(e.info.cmd);
    return esc(e.text);
  }
  transcript.innerHTML = EV.map((e) => {
    const code = e.kind === 'tool';
    const muted = e.kind === 'thinking' && !e.text;
    return '<div class="row ' + e.kind + (e.err ? ' err' : '') + ' future" data-i="' + e.i + '" style="--kc:' + kcOf(e.key) + '">' +
      '<div class="row-tc">' + (e.err ? '<span class="err-dia" title="error">◆</span>' : '') + fmtClock(e.t) + '</div>' +
      '<div class="row-av">' + avatar(speaker(e)) + '</div>' +
      '<div class="row-main"><div class="row-kind">' + esc(KIND_LABEL[e.key] || e.key) +
      (code ? '<span class="dur">' + fmtDur(e.dur) + '</span>' : '') + '</div>' +
      '<div class="row-text' + (code ? ' cmd' : '') + (muted ? ' muted' : '') + '">' + rowSnippet(e) + '</div></div></div>';
  }).join('');
  const rows = $$('.row', transcript);
  $('#binCount').textContent = EV.length + ' events';

  /* ---------- Media bin (built lazily) ---------- */
  const mediaBin = $('#mediaBin');
  let tiles = null, activeTile = null;
  function buildBin() {
    if (tiles) return;
    mediaBin.innerHTML = TRACKS.map((tr) =>
      '<div class="bin-group" data-key="' + esc(tr.key) + '" style="--kc:var(' + tr.cv + ')"><h4><i></i>' + esc(tr.label) + '<span>' + tr.evs.length + '</span></h4><div class="tiles">' +
      tr.evs.map((e) => '<div class="tile' + (e.err ? ' err' : '') + '" data-i="' + e.i + '"><div class="t-snip">' + esc(e.label || KIND_LABEL[e.kind] || '') + '</div>' +
        '<div class="t-foot"><span>' + (e.err ? '◆ ' : '') + fmtClock(e.t) + '</span><span>' + (e.kind === 'tool' ? fmtDur(e.dur) : fmtDur(e.end - e.t)) + '</span></div></div>').join('') +
      '</div></div>').join('');
    tiles = [];
    $$('.tile', mediaBin).forEach((el) => { tiles[+el.dataset.i] = el; });
    applyFilter();
    syncActiveTile();
  }
  function syncActiveTile() {
    if (!tiles) return;
    if (activeTile) activeTile.classList.remove('active');
    activeTile = tiles[S.cur] || null;
    if (activeTile) activeTile.classList.add('active');
    if (activeTile && S.followList && S.view === 'clips' && !activeTile.hidden) activeTile.scrollIntoView({ block: 'nearest', behavior: reduced || S.playing ? 'auto' : 'smooth' });
  }

  /* ---------- Track headers ---------- */
  $('#tlHeadsInner').innerHTML = TRACKS.map((tr) =>
    '<div class="th" data-key="' + esc(tr.key) + '" style="height:' + TH + 'px;--kc:var(' + tr.cv + ')"><i class="sw"></i><span class="nm">' + esc(tr.label) + '</span><span class="ct">' + tr.evs.length + '</span>' +
    '<button class="eye" data-tip="Show / hide track"><svg class="open" viewBox="0 0 20 20"><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.3"/></svg><svg class="shut" viewBox="0 0 20 20"><path d="M3 3l14 14M8.2 5a8 8 0 0 1 1.8-.3c5 0 8 5.3 8 5.3a13 13 0 0 1-2.2 2.8M5.5 6.6C3.3 8 2 10 2 10s3 5.5 8 5.5a8 8 0 0 0 3.2-.7"/></svg></button></div>'
  ).join('') +
    '<div class="th wave" style="height:' + WH + 'px"><i class="sw"></i><span class="nm">Tokens<small>▲ output per response<br>● event kind<br>▼ context size</small></span></div>';
  $('#tlHeadsInner').addEventListener('click', (ev) => {
    const b = ev.target.closest('.eye'); if (!b) return;
    const th = b.closest('.th'); const k = th.dataset.key;
    if (S.hidden.has(k)) S.hidden.delete(k); else S.hidden.add(k);
    th.classList.toggle('off', S.hidden.has(k));
    D.tl = D.ov = true;
  });

  /* ---------- Scopes (static parts) ---------- */
  const TOK_ROWS = [
    { k: 'out', label: 'Output', cv: '--c-text' },
    { k: 'inp', label: 'Input', cv: '--c-prompt' },
    { k: 'cr', label: 'Cache read', cv: '--c-read' },
    { k: 'cw', label: 'Cache write', cv: '--c-write' },
  ];
  $('#scTokens').innerHTML = TOK_ROWS.map((r) =>
    '<div class="tok-row" style="--kc:var(' + r.cv + ')"><span class="k"><i></i>' + r.label + '</span><span class="bar"><i data-tok="' + r.k + '"></i></span><span class="v"><b data-tokv="' + r.k + '">0</b> <span>/ ' + fmtNum(TOT[r.k]) + '</span></span></div>').join('');
  const tokBars = {}, tokVals = {};
  $$('[data-tok]').forEach((el) => { tokBars[el.dataset.tok] = el; });
  $$('[data-tokv]').forEach((el) => { tokVals[el.dataset.tokv] = el; });
  (function buildToolScopes() {
    const st = toolKeys.map((k) => {
      const evs = TRACK_BY[k].evs;
      return { k, calls: evs.length, time: evs.reduce((a, e) => a + (e.dur || 0), 0), errs: evs.filter((e) => e.err).length };
    });
    const maxT = Math.max(1, ...st.map((s) => s.time));
    $('#scTools').innerHTML = st.map((s) =>
      '<div class="tool-row" style="--kc:' + kcOf(s.k) + '"><span class="k">' + esc(s.k) + '</span><span class="bar"><i style="width:' + pct(s.time / maxT) + '"></i></span>' +
      '<span class="v"><b>' + s.calls + '</b> · ' + fmtDur(s.time) + (s.errs ? ' · <em>◆ ' + s.errs + '</em>' : '') + '</span></div>').join('');
  })();

  /* ---------- Help ---------- */
  const HELP = [
    ['Play / pause', 'Space'], ['Previous / next event', '←', '→'], ['Hold to rewind / fast-forward', '◀◀', '▶▶'],
    ['Shuttle reverse, faster', 'J'], ['Stop', 'K'], ['Shuttle forward, faster', 'L'],
    ['Nudge ±5 s', '⇧←', '⇧→'], ['Previous / next tool call', '↑', '↓'], ['Go to start / end', 'Home', 'End'],
    ['Speed 1× · 10× · 60× · 240×', '1', '2', '3', '4'], ['Speed: the SPEED menu, or scroll on it', '−', '+'],
    ['Mark in / out', 'I', 'O'], ['Toggle loop', '/'], ['Clear marks', 'X'], ['Skip idle gaps', 'S'],
    ['Timeline zoom in / out', '+', '−'], ['Zoom to fit', 'Z'], ['Timeline follows playhead', 'F'], ['Snap scrubbing', 'N'],
    ['Program view: transcript / event / clips / report', 'V'], ['Show / hide the tape bay', 'P'], ['Eject: load another tape', 'E'], ['Book / studio layout', 'B'], ['Customize layout', 'C'],
    ['Release the pinned event (or click PINNED)', 'Esc'], ['Theme', 'T'], ['This panel', '?'],
  ];
  $('#helpGrid').innerHTML = HELP.map((h) => '<div><span>' + h[0] + '</span><span>' + h.slice(1).map((k) => '<kbd>' + k + '</kbd>').join('') + '</span></div>').join('');
  const help = $('#help');
  const toggleHelp = (on) => { help.hidden = on == null ? !help.hidden : !on; };
  $('#btnHelp').addEventListener('click', () => toggleHelp());
  $('#helpClose').addEventListener('click', () => toggleHelp(false));
  help.addEventListener('click', (e) => { if (e.target === help) toggleHelp(false); });

  /* ------------------------------------------------------------------ *
   * Canvas plumbing
   * ------------------------------------------------------------------ */
  function mkCanvas(canvas, box, onResize) {
    const o = { c: canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1 };
    const measure = () => {
      const r = box.getBoundingClientRect();
      o.dpr = Math.min(2.5, window.devicePixelRatio || 1);
      o.w = Math.max(1, r.width); o.h = Math.max(1, r.height);
      const W = Math.round(o.w * o.dpr), H = Math.round(o.h * o.dpr);
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      if (onResize) onResize();
    };
    new ResizeObserver(measure).observe(box);
    o.measure = measure;
    return o;
  }
  function layer(o, L) {
    if (!L || L.c.width !== o.c.width || L.c.height !== o.c.height) {
      const c = document.createElement('canvas'); c.width = o.c.width; c.height = o.c.height;
      L = { c, ctx: c.getContext('2d') };
    }
    L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    L.ctx.clearRect(0, 0, L.c.width, L.c.height);
    L.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
    return L;
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function diamond(g, x, cy, r) {
    g.beginPath(); g.moveTo(x, cy - r); g.lineTo(x + r, cy); g.lineTo(x, cy + r); g.lineTo(x - r, cy); g.closePath();
  }

  /* ------------------------------------------------------------------ *
   * Timeline canvas
   * ------------------------------------------------------------------ */
  const tlCanvas = $('#tlCanvas');
  const TL = mkCanvas(tlCanvas, $('#tlWrap'), () => { clampScroll(); D.tl = true; });
  let tlS = null, tlW = null;
  const X = (t) => ((t - S.v.start) / S.v.span) * TL.w;
  const Tx = (x) => S.v.start + (x / TL.w) * S.v.span;
  const contentH = () => TRACKS.length * TH + (S.showTokens ? WH : 0);
  const trackY = (i) => RULER + i * TH - S.scrollY;
  const waveY = () => RULER + TRACKS.length * TH - S.scrollY;
  const headsInner = $('#tlHeadsInner');
  function clampScroll() {
    S.scrollY = clamp(S.scrollY, 0, Math.max(0, contentH() - (TL.h - RULER)));
    headsInner.style.transform = 'translateY(' + -S.scrollY + 'px)';
  }
  function tickStep() {
    const ppm = TL.w / S.v.span;
    const steps = [1000 / FPS, 5000 / FPS, 10000 / FPS, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000, 900000, 1800000, 3600000];
    for (const s of steps) if (s * ppm >= 96) return s;
    return 3600000;
  }

  function buildTL() {
    const W = TL.w, H = TL.h;
    tlS = layer(TL, tlS); tlW = layer(TL, tlW);
    const g = tlS.ctx;
    const v0 = S.v.start, v1 = S.v.start + S.v.span;
    const step = tickStep(), minor = step / 5;

    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    drawLanes(g, tlW.ctx);

    // token dot-matrix: unlit / upcoming dots here, the lit copy on the played
    // layer, which compTL reveals up to the playhead
    drawDots(g, false);
    drawDots(tlW.ctx, true);
    if (S.showTokens) { g.fillStyle = C.line; g.fillRect(0, waveY(), W, 1); }

    // ruler: an LED readout on the same black as the lanes
    g.fillStyle = C.bg; g.fillRect(0, 0, W, RULER);
    g.fillStyle = C.line; g.fillRect(0, RULER - 1, W, 1);
    g.font = DOT_FONT; g.textBaseline = 'alphabetic';
    for (let k = Math.floor(v0 / minor); k * minor <= v1; k++) {
      const x = Math.round(X(k * minor)); const major = k % 5 === 0;
      g.fillStyle = major ? C.fg3 : C.line3;
      if (major) { for (let r = 0; r < 3; r++) g.fillRect(x, RULER - 5 - r * 3, 2, 2); g.fillText(fmtTC(k * minor), x + 5, 13); }
      else g.fillRect(x, RULER - 5, 2, 2);
    }
    // markers: prompts as dot blocks, then errors as dot diamonds on top
    g.fillStyle = C.prompt;
    for (const e of EV) if (e.kind === 'prompt' && e.t >= v0 && e.t <= v1) dotShape(g, X(e.t), RULER - 8, PROMPT_DOTS);
    g.fillStyle = C.err;
    for (const e of EV) if (e.err && e.t >= v0 && e.t <= v1) dotShape(g, X(e.t), RULER - 8, ERR_DOTS);
  }

  /* Tokens track as the Deck's LED matrix. Columns are pinned to time (one
     column = DOT_P px of the current zoom), so panning scrolls the dots
     instead of re-bucketing them. Upper half: the biggest response's output
     tokens in the column, log-scaled. Middle row: the loudest event kind.
     Lower half: context size, carried forward between responses. */
  const DOT_P = 6, DOT_D = DOT_P - 2;
  const DOT_FONT = '900 12px Doto, "JetBrains Mono", ui-monospace, monospace';
  const DOT_OFF = '#1A1A1B';
  const LANE_ROWS = 3;
  const laneTop = (y) => y + Math.round((TH - LANE_ROWS * DOT_P) / 2) + 1;
  // Dot columns visible at the current zoom: k-th column covers [k*bw, (k+1)*bw).
  function dotCols() {
    const bw = (DOT_P / TL.w) * S.v.span;
    return { bw, k0: Math.max(0, Math.floor(S.v.start / bw) - 1), k1: Math.min(Math.ceil(DUR / bw), Math.ceil((S.v.start + S.v.span) / bw) + 1) };
  }
  const colX = (k, bw) => Math.round(X(k * bw));
  const clipCols = (e, bw) => { const a = Math.floor(e.t / bw); return [a, Math.max(a, Math.ceil(e.end / bw) - 1)]; };
  // Little pixel glyphs for the ruler: [dx, dy] in 3px steps around the anchor.
  const PROMPT_DOTS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
  const ERR_DOTS = [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
  function dotShape(g, x, y, pts) { for (const [dx, dy] of pts) g.fillRect(Math.round(x) - 1 + dx * 3, y - 1 + dy * 3, 2, 2); }

  /* Lanes as rows of LEDs. Each lane is LANE_ROWS dots tall; a clip lights the
     columns it overlaps. gS gets the dim, not-yet-played copy and gW the lit
     one, which compTL reveals up to the playhead. Wide clips get their label
     in dot type on a cut-out, like a sign. */
  function drawLanes(gS, gW) {
    const W = TL.w, H = TL.h, { bw, k0, k1 } = dotCols(), n = k1 - k0 + 1;
    const cell = new Uint8Array(n); // 0 empty, 1 filtered out, 2 lit, 3 error
    const pOff = new Path2D();
    const labels = [];
    TRACKS.forEach((tr, i) => {
      const y = trackY(i); if (y + TH < RULER || y > H) return;
      const top = laneTop(y), off = S.hidden.has(tr.key);
      cell.fill(0);
      for (const e of tr.evs) {
        if (e.end < k0 * bw || e.t > (k1 + 1) * bw) continue;
        const [a, b] = clipCols(e, bw);
        const out = S.match && !S.match.has(e.i);
        const v = out ? 1 : e.err ? 3 : 2;
        for (let k = Math.max(a, k0); k <= Math.min(b, k1); k++) if (v > cell[k - k0]) cell[k - k0] = v;
        if (!off && !out && e.label && (b - a + 1) * DOT_P >= 48) labels.push({ e, a, b, top, color: e.err ? C.err : tr.color });
      }
      const paths = [pOff, new Path2D(), new Path2D(), new Path2D()];
      for (let j = 0; j < n; j++) {
        const x = colX(k0 + j, bw); if (x < -DOT_P || x > W) continue;
        for (let r = 0; r < LANE_ROWS; r++) paths[cell[j]].rect(x, top + r * DOT_P, DOT_D, DOT_D);
      }
      const base = off ? 0.2 : tr.key === 'thinking' ? 0.65 : 1;
      for (const [g, lit] of [[gS, false], [gW, true]]) {
        g.fillStyle = tr.color;
        g.globalAlpha = base * (lit ? 1 : 0.28); g.fill(paths[2]);
        g.globalAlpha = base * (lit ? 0.3 : 0.12); g.fill(paths[1]);
        g.fillStyle = C.err;
        g.globalAlpha = base * (lit ? 1 : 0.35); g.fill(paths[3]);
      }
      gS.globalAlpha = gW.globalAlpha = 1;
    });
    gS.save(); gS.beginPath(); gS.rect(0, RULER, W, H - RULER); gS.clip();
    gS.fillStyle = DOT_OFF; gS.fill(pOff);
    gS.restore();
    for (const [g, lit] of [[gS, false], [gW, true]]) {
      g.save(); g.beginPath(); g.rect(0, RULER, W, H - RULER); g.clip();
      g.font = DOT_FONT; g.textBaseline = 'middle';
      for (const L of labels) {
        const x0 = colX(L.a, bw) + DOT_P, room = colX(L.b, bw) + DOT_D - x0 - DOT_P;
        const text = (L.e.err ? '◆ ' : '') + L.e.label;
        const tw = Math.min(room, g.measureText(text).width + 8);
        if (x0 > W || x0 + tw < 0 || tw < 24) continue;
        const h = LANE_ROWS * DOT_P - 2;
        g.fillStyle = C.bg; g.fillRect(x0 - 2, L.top - 1, tw, h + 2);
        g.save(); g.beginPath(); g.rect(x0 - 2, L.top - 1, tw, h + 2); g.clip();
        g.fillStyle = L.color; g.globalAlpha = lit ? 1 : 0.4;
        g.fillText(text, x0 + 2, L.top + h / 2 + 1);
        g.restore();
      }
      g.restore();
    }
  }
  const KIND_P = (e) => e.err ? 5 : e.kind === 'prompt' ? 4 : e.kind === 'tool' ? 3 : e.kind === 'text' ? 2 : 1;
  const OUT_LOG = Math.log1p(MAX_OUT);
  function drawDots(g, lit) {
    const W = TL.w, y0 = waveY();
    if (!S.showTokens || y0 + WH < RULER || y0 > TL.h) return;
    const rows = Math.floor((WH - 4) / DOT_P);
    const up = Math.ceil((rows - 1) / 2), down = rows - 1 - up;
    const top = y0 + Math.floor((WH - rows * DOT_P) / 2) + 1;
    const midY = top + up * DOT_P;
    const bw = (DOT_P / W) * S.v.span; // ms per column
    const k0 = Math.max(0, Math.floor(S.v.start / bw) - 1);
    const k1 = Math.min(Math.ceil(DUR / bw), Math.ceil((S.v.start + S.v.span) / bw) + 1);
    const pOff = new Path2D(), pOut = new Path2D(), pPeak = new Path2D(), pCtx = new Path2D(), pTip = new Path2D();
    const kinds = [null, new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    let ri = 0, ei = 0;
    while (ri < NR && RS[ri].t < k0 * bw) ri++;
    while (ei < EV.length && EV[ei].t < k0 * bw) ei++;
    let ctx = ri ? ctxOf(RS[ri - 1]) : 0;
    for (let k = k0; k <= k1; k++) {
      const x = Math.round(X(k * bw));
      const tEnd = (k + 1) * bw;
      let out = 0, kp = 0;
      for (; ri < NR && RS[ri].t < tEnd; ri++) { out = Math.max(out, RS[ri].out || 0); ctx = Math.max(ctx, ctxOf(RS[ri])); }
      for (; ei < EV.length && EV[ei].t < tEnd; ei++) kp = Math.max(kp, KIND_P(EV[ei]));
      if (x < -DOT_P || x > W) continue;
      const nOut = out > 0 ? Math.max(1, Math.round((Math.log1p(out) / OUT_LOG) * up)) : 0;
      const nCtx = ctx > 0 ? Math.max(1, Math.round((ctx / PEAK_CTX) * down)) : 0;
      for (let r = 0; r < up; r++) {
        const y = midY - (r + 1) * DOT_P;
        (r < nOut ? (lit && r === nOut - 1 ? pPeak : pOut) : pOff).rect(x, y, DOT_D, DOT_D);
      }
      (kp ? kinds[kp] : pOff).rect(x, midY, DOT_D, DOT_D);
      for (let r = 0; r < down; r++) {
        const y = midY + (r + 1) * DOT_P;
        (r < nCtx ? (lit && r === nCtx - 1 ? pTip : pCtx) : pOff).rect(x, y, DOT_D, DOT_D);
      }
    }
    g.save(); g.beginPath(); g.rect(0, Math.max(RULER, y0), W, WH); g.clip();
    // Clear to the track colour first so the played copy fully covers the dim one.
    g.fillStyle = C.bg; g.fillRect(0, y0, W, WH);
    g.fillStyle = DOT_OFF; g.fill(pOff);
    g.fillStyle = lit ? '#EFEDE6' : '#34322F'; g.fill(pOut);
    g.fillStyle = '#FF9A6B'; g.fill(pPeak);
    g.fillStyle = lit ? '#8E8B83' : '#2A2927'; g.fill(pCtx);
    g.fillStyle = '#B8653F'; g.fill(pTip); // muted: context carries forward, so this is a near-solid line
    const kc = KIND_BY_P();
    g.globalAlpha = lit ? 1 : 0.3;
    for (let p = 1; p <= 5; p++) { g.fillStyle = kc[p]; g.fill(kinds[p]); }
    g.globalAlpha = 1;
    g.restore();
  }

  function outlineClip(g, i, color, lw) {
    const e = EV[i]; if (!e) return;
    const tr = TRACK_BY[e.key]; if (!tr || S.hidden.has(e.key)) return;
    const y = trackY(tr.idx); if (y + TH < RULER || y > TL.h) return;
    const { bw } = dotCols(), [a, b] = clipCols(e, bw);
    const x0 = colX(a, bw), x1 = colX(b, bw) + DOT_D, top = laneTop(y);
    if (x0 > TL.w || x1 < 0) return;
    g.save(); g.beginPath(); g.rect(0, RULER, TL.w, TL.h - RULER); g.clip();
    g.strokeStyle = color; g.lineWidth = lw;
    rr(g, x0 - 2 - lw / 2, top - 2 - lw / 2, x1 - x0 + 4 + lw, LANE_ROWS * DOT_P + 2 + lw, 3); g.stroke();
    g.restore();
  }

  function compTL() {
    const g = TL.ctx, W = TL.w, H = TL.h, d = TL.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, TL.c.width, TL.c.height);
    if (tlS) g.drawImage(tlS.c, 0, 0);
    const px = X(S.t);
    const wx = Math.round(clamp(px, 0, W) * d);
    if (tlW && wx > 0) g.drawImage(tlW.c, 0, 0, wx, TL.c.height, 0, 0, wx, TL.c.height);
    g.setTransform(d, 0, 0, d, 0, 0);

    if (S.loopIn != null || S.loopOut != null) {
      const a = S.loopIn != null ? S.loopIn : 0, b = S.loopOut != null ? S.loopOut : DUR;
      const xa = X(a), xb = X(b);
      if (S.loopIn != null && S.loopOut != null) {
        g.fillStyle = rgba(C.accent, S.loopOn ? 0.1 : 0.05); g.fillRect(xa, RULER, xb - xa, H - RULER);
        g.fillStyle = rgba(C.accent, S.loopOn ? 0.9 : 0.45); g.fillRect(xa, RULER - 4, xb - xa, 3);
      }
      g.fillStyle = C.accent;
      if (S.loopIn != null) { g.fillRect(xa, 0, 1, H); g.fillRect(xa, RULER - 10, 6, 2); g.fillRect(xa, 0, 6, 2); }
      if (S.loopOut != null) { g.fillRect(xb - 1, 0, 1, H); g.fillRect(xb - 6, RULER - 10, 6, 2); g.fillRect(xb - 6, 0, 6, 2); }
    }

    if (S.cur >= 0 && S.cur !== S.sel) outlineClip(g, S.cur, rgba(C.fg, 0.9), 1.5);
    if (S.hover >= 0 && S.hover !== S.sel) outlineClip(g, S.hover, rgba(C.fg, 0.5), 1);
    if (S.sel >= 0) outlineClip(g, S.sel, C.accent, 2);

    if (px >= -8 && px <= W + 8) {
      g.fillStyle = rgba(C.accent, 0.18); g.fillRect(px - 3, RULER, 6, H - RULER);
      g.fillStyle = C.accent; g.fillRect(px - 1, RULER - 2, 2, H - RULER + 2);
      g.save(); g.shadowColor = rgba(C.accent, 0.7); g.shadowBlur = 10;
      g.beginPath(); g.moveTo(px - 6, 1); g.lineTo(px + 6, 1); g.lineTo(px + 6, RULER - 11); g.lineTo(px, RULER - 3); g.lineTo(px - 6, RULER - 11); g.closePath();
      g.fill(); g.restore();
    }
  }

  /* ------------------------------------------------------------------ *
   * Overview strip (whole session)
   * ------------------------------------------------------------------ */
  const ovCanvas = $('#ovCanvas');
  const OV = mkCanvas(ovCanvas, $('#ovWrap'), () => { D.ov = true; });
  let ovS = null, ovW = null;
  const OX = (t) => (t / DUR) * OV.w;
  function buildOV() {
    ovS = layer(OV, ovS); ovW = layer(OV, ovW);
    const gS = ovS.ctx, gW = ovW.ctx, W = OV.w, H = OV.h;
    gS.fillStyle = C.bg; gS.fillRect(0, 0, W, H);
    const P = 3, Dd = 2, n = Math.floor(W / P), rows = TRACKS.length;
    const pitch = Math.max(2, Math.min(P, Math.floor((H - 4) / rows)));
    const top = Math.floor((H - rows * pitch) / 2);
    const ms = DUR / n, cell = new Uint8Array(n), errCol = new Uint8Array(n);
    const pOff = new Path2D(), pErrCol = new Path2D();
    for (const e of EV) if (e.err) errCol[Math.min(n - 1, Math.floor(e.t / ms))] = 1;
    TRACKS.forEach((tr, i) => {
      cell.fill(0);
      for (const e of tr.evs) {
        const a = Math.min(n - 1, Math.floor(e.t / ms)), b = Math.min(n - 1, Math.max(a, Math.ceil(e.end / ms) - 1));
        for (let k = a; k <= b; k++) cell[k] = Math.max(cell[k], e.err ? 2 : 1);
      }
      const y = top + i * pitch, pOn = new Path2D(), pErr = new Path2D();
      for (let k = 0; k < n; k++) (cell[k] === 2 ? pErr : cell[k] ? pOn : errCol[k] ? pErrCol : pOff).rect(k * P, y, Dd, Dd);
      const base = S.hidden.has(tr.key) ? 0.2 : 1;
      for (const [g, lit] of [[gS, false], [gW, true]]) {
        g.globalAlpha = base * (lit ? 1 : 0.3);
        g.fillStyle = tr.color; g.fill(pOn);
        g.fillStyle = C.err; g.fill(pErr);
      }
      gS.globalAlpha = gW.globalAlpha = 1;
    });
    gS.fillStyle = DOT_OFF; gS.fill(pOff);
    gS.fillStyle = rgba(C.err, 0.3); gS.fill(pErrCol);
    gW.fillStyle = rgba(C.err, 0.6); gW.fill(pErrCol);
  }
  function compOV() {
    const g = OV.ctx, W = OV.w, H = OV.h, d = OV.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, OV.c.width, OV.c.height);
    if (ovS) g.drawImage(ovS.c, 0, 0);
    const wx = Math.round(clamp(OX(S.t), 0, W) * d);
    if (ovW && wx > 0) g.drawImage(ovW.c, 0, 0, wx, OV.c.height, 0, 0, wx, OV.c.height);
    g.setTransform(d, 0, 0, d, 0, 0);
    const a = OX(S.v.start), b = OX(S.v.start + S.v.span);
    g.fillStyle = 'rgba(8,8,9,.6)';
    g.fillRect(0, 0, a, H); g.fillRect(b, 0, W - b, H);
    if (S.loopIn != null && S.loopOut != null) { g.fillStyle = rgba(C.accent, 0.5); g.fillRect(OX(S.loopIn), H - 2, OX(S.loopOut) - OX(S.loopIn), 2); }
    g.strokeStyle = rgba(C.fg, 0.7); g.lineWidth = 1;
    rr(g, a + 0.5, 0.5, Math.max(4, b - a - 1), H - 1, 3); g.stroke();
    g.fillStyle = rgba(C.fg, 0.8); g.fillRect(a + 2, H / 2 - 5, 2, 10); g.fillRect(b - 4, H / 2 - 5, 2, 10);
    g.fillStyle = C.accent; g.fillRect(OX(S.t) - 1, 0, 2, H);
  }

  /* ------------------------------------------------------------------ *
   * Tape reel: fixed centre playhead, the tape moves under it
   * ------------------------------------------------------------------ */
  const tapeCanvas = $('#tape');
  const TP = mkCanvas(tapeCanvas, $('#tapeWrap'), () => { D.tape = true; });
  const tppm = () => TAPE_ZOOMS[S.tapeZoom] / 1000; // tape px per ms
  const RULE_STEPS = [1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000, 900000];
  function drawTape() {
    const g = TP.ctx, w = TP.w, h = TP.h;
    if (w < 4) return;
    g.setTransform(TP.dpr, 0, 0, TP.dpr, 0, 0);
    const k = tppm(), cx = w / 2, t = S.t;
    const t0 = t - cx / k, t1 = t + (w - cx) / k;
    const Xt = (tt) => cx + (tt - t) * k;
    g.fillStyle = C.bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#070708';
    if (t0 < 0) g.fillRect(0, 0, Xt(0), h);
    if (t1 > DUR) g.fillRect(Xt(DUR), 0, w - Xt(DUR), h);
    // sprocket holes travel with the tape
    const SP = 16, phase = ((t * k) % SP + SP) % SP;
    g.fillStyle = C.line2;
    for (let x = cx - phase - Math.ceil(cx / SP) * SP; x < w + SP; x += SP) { g.fillRect(x, 3, 7, 4); g.fillRect(x, h - 7, 7, 4); }
    // ruler
    let minor = RULE_STEPS[RULE_STEPS.length - 1];
    for (const s of RULE_STEPS) if (s * k >= 7) { minor = s; break; }
    let major = RULE_STEPS[RULE_STEPS.length - 1];
    for (const s of RULE_STEPS) if (s * k >= 76 && s % minor === 0) { major = s; break; }
    g.fillStyle = C.line3;
    const b = Math.min(DUR, t1);
    for (let tt = Math.max(0, Math.floor(t0 / minor) * minor); tt <= b; tt += minor) g.fillRect(Math.round(Xt(tt)), 10, 1, tt % major === 0 ? 9 : 4);
    g.fillStyle = C.fg3; g.font = '600 9.5px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'top';
    for (let tt = Math.max(0, Math.floor(t0 / major) * major); tt <= b; tt += major) g.fillText(fmtClock(tt), Math.round(Xt(tt)) + 3, 12);
    // lanes: replies on top, tools in the middle, thinking at the bottom
    const top = 27, bot = h - 11, laneH = bot - top;
    const hText = Math.round(laneH * 0.3), yTool = top + hText + 3, hTool = Math.round(laneH * 0.42);
    const yThink = yTool + hTool + 3, hThink = Math.max(3, bot - yThink);
    g.textBaseline = 'middle'; g.font = '700 9px "JetBrains Mono", ui-monospace, monospace';
    for (let i = Math.max(0, ub(TS, t0 - 180000) - 1); i < EV.length; i++) {
      const e = EV[i];
      if (e.t > t1) break;
      const x = Xt(e.t);
      const dim = S.match && !S.match.has(i);
      g.globalAlpha = dim ? 0.2 : 1;
      if (e.kind === 'tool') {
        const ww = Math.max(3, (e.dur || 0) * k);
        if (x + ww < 0) continue;
        g.fillStyle = e.err ? C.err : (TRACK_BY[e.key] ? TRACK_BY[e.key].color : C.tool);
        g.fillRect(x, yTool, ww, hTool);
        if (ww > 44) { g.fillStyle = e.err ? '#fff' : '#111'; g.fillText((e.err ? '◆ ' : '') + e.key.toUpperCase(), x + 4, yTool + hTool / 2 + 0.5); }
      } else if (e.kind === 'text') {
        g.fillStyle = C.text; g.fillRect(x, top, 3, hText);
      } else if (e.kind === 'prompt') {
        g.fillStyle = C.prompt; g.fillRect(x, top - 4, 4, laneH + 4); g.fillRect(x, top - 4, 34, 11);
        g.fillStyle = '#111'; g.fillText('YOU', x + 5, top + 1.5);
      } else {
        g.fillStyle = C.thinking; g.fillRect(x, yThink, Math.max(2, (e.end - e.t) * k), hThink);
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(12,12,13,.5)';
    g.fillRect(cx, top - 4, w - cx, laneH + 4); // the future is dimmer than the past
  }
  function setTapeZoom(i) {
    S.tapeZoom = clamp(i, 0, TAPE_ZOOMS.length - 1);
    $('#tapeZoomLab').textContent = TAPE_ZOOMS[S.tapeZoom] + 'px/s';
    D.tape = true;
  }

  const KIND_BY_P = () => [null, C.thinking, C.text, C.tool, C.prompt, C.err];

  /* ------------------------------------------------------------------ *
   * Cost chart (Scopes) — drawn on a small black screen
   * ------------------------------------------------------------------ */
  const costCanvas = $('#costChart');
  const CC = mkCanvas(costCanvas, costCanvas, () => { D.cost = true; });
  function drawCost() {
    const o = CC; if (o.w < 20 || o.h < 20 || !NR) return;
    const g = o.ctx; g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); g.clearRect(0, 0, o.w, o.h);
    const p = { l: 1, r: 1, t: 6, b: 16 }, W = o.w - p.l - p.r, H = o.h - p.t - p.b;
    const cx = (t) => p.l + (t / DUR) * W, cy = (c) => p.t + H - (c / TOT.cost) * H;
    g.fillStyle = C.line;
    for (let k = 0; k <= 4; k++) g.fillRect(p.l, Math.round(p.t + (H * k) / 4), W, 1);
    const line = new Path2D(); line.moveTo(cx(0), cy(0));
    for (let i = 0; i < NR; i++) { const x = cx(RS[i].t); line.lineTo(x, cy(cum.cost[i])); line.lineTo(x, cy(cum.cost[i + 1])); }
    line.lineTo(cx(DUR), cy(TOT.cost));
    g.strokeStyle = C.fg4; g.lineWidth = 1.25; g.stroke(line);
    const px = cx(S.t);
    g.save(); g.beginPath(); g.rect(0, 0, px, o.h); g.clip();
    const area = new Path2D(line); area.lineTo(cx(DUR), cy(0)); area.lineTo(cx(0), cy(0)); area.closePath();
    const grad = g.createLinearGradient(0, p.t, 0, p.t + H); grad.addColorStop(0, rgba(C.accent, 0.35)); grad.addColorStop(1, rgba(C.accent, 0));
    g.fillStyle = grad; g.fill(area);
    g.strokeStyle = C.accent; g.lineWidth = 1.8; g.stroke(line);
    g.restore();
    g.fillStyle = rgba(C.accent, 0.6); g.fillRect(px - 0.5, p.t, 1, H);
    g.beginPath(); g.arc(px, cy(costAt(S.t)), 3.5, 0, Math.PI * 2); g.fillStyle = C.accent; g.fill();
    g.fillStyle = C.fg3; g.font = '600 10px "JetBrains Mono", monospace';
    g.textAlign = 'left'; g.fillText('00:00', p.l + 4, o.h - 3);
    g.textAlign = 'right'; g.fillText(fmtClock(DUR), o.w - p.r - 4, o.h - 3); g.fillText(fmtUSD(TOT.cost), o.w - p.r - 4, p.t + 10);
    g.textAlign = 'left';
  }

  /* ------------------------------------------------------------------ *
   * Program monitor: event view
   * ------------------------------------------------------------------ */
  const monContent = $('#monContent'), lowerThird = $('#lowerThird'), monPanel = $('#monitorPanel');
  const M = { idx: -2, running: false, prog: null, el: null, lt: null };

  function numbered(s) {
    const toks = String(s || '').split(' ');
    let exp = 1; const lines = []; let cur = null;
    for (const tk of toks) {
      if (tk === String(exp)) { cur = []; lines.push([exp, cur]); exp++; }
      else { if (!cur) { cur = []; lines.push(['', cur]); } cur.push(tk); }
    }
    if (lines.length < 3) return '<div class="out">' + esc(s) + '</div>';
    return lines.map((l) => '<div class="ln"><b>' + l[0] + '</b><span>' + esc(l[1].join(' ')) + '</span></div>').join('');
  }

  function toolCard(e, running) {
    const st = running ? '<span class="st run"><span class="spin"></span>RUNNING</span>'
      : e.err ? '<span class="st err">◆ ERROR</span>' : '<span class="st ok">✓ DONE</span>';
    let body;
    if (e.tool === 'Read' && !running && !e.err) body = numbered(e.result);
    else {
      body = '<div class="cmd">' + esc(e.info.cmd) + '</div>' +
        (running ? '<div class="out"><span class="caret"></span></div>' : '<div class="out' + (e.err ? ' err' : '') + '">' + esc(e.result || '(no output)') + '</div>');
    }
    return '<div class="card tool"><div class="term"><div class="term-bar"><span class="tag">' + esc(e.tool) + '</span><span class="ttl">' + esc(e.info.title) +
      '</span></div><div class="term-body">' + body + '</div>' +
      '<div class="term-foot">' + st + '<span class="prog"><i></i></span><span class="elapsed dot"></span></div></div></div>';
  }

  function renderMonitor(idx, quiet) {
    const e = EV[idx];
    finishTyping();
    M.idx = idx;
    const badge = $('#monBadge');
    if (!e) {
      monContent.innerHTML = '<div class="empty-stage"><b>' + esc(TAPE.title || 'Session') + '</b>Press Space to roll tape</div>';
      lowerThird.innerHTML = ''; badge.textContent = '—'; M.prog = M.el = M.lt = null;
      $('#monIndex').textContent = '—';
      stage.dataset.kind = '';
      return;
    }
    // errors take over the accent so a failing call reads red everywhere on the screen
    const kc = e.err ? 'var(--err)' : kcOf(e.key);
    monPanel.style.setProperty('--kc', kc);
    stage.style.setProperty('--kc', kc);
    badge.innerHTML = iconFor(e.key).replace('<svg', '<svg width="12" height="12"') + esc(KIND_LABEL[e.key] || e.key);
    $('#monIndex').textContent = String(idx + 1).padStart(3, '0') + '/' + EV.length;
    M.running = e.kind === 'tool' && S.t < e.end;
    let html;
    if (e.kind === 'prompt') {
      html = '<div class="card prompt"><div class="who">' + avatar('user') + 'You<span class="t dot">' + fmtTC(e.t) + '</span></div><div class="card-body"><div class="prose">' + esc(e.text) + '</div></div></div>';
    } else if (e.kind === 'text') {
      html = '<div class="card text"><div class="who">' + avatar('agent') + AGENT.name + '<span class="t">' + esc(TAPE.model || '') + '</span></div><div class="card-body"><div class="prose" id="monProse">' + esc(e.text) + '</div></div></div>';
    } else if (e.kind === 'thinking') {
      html = '<div class="card thinking"><div class="who">' + avatar('agent') + 'Thinking<span class="t dot">' + fmtDur(e.end - e.t) + '</span></div>' +
        '<div class="prose dimmed">' + (e.text ? esc(e.text) : 'reasoning <span class="think-dots"><i></i><i></i><i></i></span>') + '</div>' +
        (e.text ? '' : '<div class="think-note">The log records that the model reasoned here, not what it thought.</div>') + '</div>';
    } else {
      html = toolCard(e, M.running);
    }
    monContent.innerHTML = html;
    if (!quiet && !reduced && monContent.firstElementChild) monContent.firstElementChild.classList.add('enter');
    lowerThird.innerHTML = '<span class="lt-idx dot">#' + (idx + 1) + '</span><span class="lt-tc dot">' + fmtTC(e.t) + '</span><span class="lt-arrow">→</span><span class="lt-tc dot">' + fmtTC(e.end) +
      '</span><span class="lt-bar"><i></i></span><span class="lt-dur dot">' + (e.kind === 'tool' ? fmtDur(e.dur) : fmtDur(e.end - e.t)) + '</span>';
    M.prog = $('.prog i', monContent); M.el = $('.elapsed', monContent); M.lt = $('.lt-bar i', lowerThird);
    if (e.kind === 'text' && S.playing && S.rate > 0 && !quiet && e.text) {
      const el = $('#monProse');
      if (el) { el.textContent = ''; S.typing = { el, text: e.text, n: 0, start: 0, ms: clamp(e.text.length * 5, 250, 1100) / (S.rate >= 60 ? 3 : 1) }; }
    }
    updateMonitorLive();
  }
  function typeStep(ts) {
    const T = S.typing; if (!T.start) T.start = ts;
    const k = Math.min(1, (ts - T.start) / T.ms);
    const n = Math.floor(T.text.length * k);
    if (n !== T.n) { T.n = n; T.el.textContent = T.text.slice(0, n); }
    if (k >= 1) S.typing = null;
  }
  // A half-typed reply must never be left behind when the view changes.
  function finishTyping() {
    if (S.typing) { S.typing.el.textContent = S.typing.text; S.typing = null; }
  }
  function updateMonitorLive() {
    const e = EV[M.idx]; if (!e) return;
    const k = clamp((S.t - e.t) / Math.max(1, e.end - e.t), 0, 1);
    if (M.lt) M.lt.style.transform = 'scaleX(' + k.toFixed(4) + ')';
    if (e.kind === 'tool') {
      const running = S.t < e.end;
      if (running !== M.running) { renderMonitor(M.idx, true); return; }
      if (M.prog) M.prog.style.transform = 'scaleX(' + (running ? k : 1).toFixed(4) + ')';
      if (M.el) M.el.textContent = running ? fmtDur(S.t - e.t) : fmtDur(e.dur);
    }
  }

  let osdTimer = 0;
  const osdEl = $('#osd');
  function osd(text) {
    osdEl.textContent = text;
    osdEl.classList.add('show');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(() => osdEl.classList.remove('show'), 700);
  }

  /* ------------------------------------------------------------------ *
   * Inspector
   * ------------------------------------------------------------------ */
  const insp = $('#inspector');
  const cell = (label, value, cls) => '<div><span class="ml">' + label + '</span><span class="mv dot' + (cls ? ' ' + cls : '') + '">' + esc(value) + '</span></div>';
  const COPY_SVG = '<svg viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 20 20"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>';
  const copyBtn = (what) => '<button class="icon-btn" data-act="copy" data-what="' + what + '" data-tip="Copy" aria-label="Copy ' + what + '">' + COPY_SVG + '</button>';
  function renderInspector() {
    const idx = S.sel >= 0 ? S.sel : S.cur;
    // Pinned: a button that lets go of the event and goes back to following the playhead
    const pin = $('#pinState'), pinned = S.sel >= 0;
    pin.textContent = pinned ? 'Pinned' : 'Following';
    pin.classList.toggle('pinned', pinned); pin.disabled = !pinned;
    pin.dataset.tip = pinned ? 'Unpin: follow the playhead again' : 'Showing the event at the playhead';
    if (pinned) pin.dataset.kbd = 'Esc'; else delete pin.dataset.kbd;
    const e = EV[idx];
    if (!e) { insp.innerHTML = '<div class="sect dim">No event at the playhead.</div>'; return; }
    const kc = kcOf(e.key);
    const wall = new Date(Date.parse(TAPE.start) + e.t);
    let h = '<div class="insp-head" style="--kc:' + kc + '"><span class="sw">' + iconFor(e.key) + '</span><div><h3>' + esc(e.kind === 'tool' ? e.tool : KIND_LABEL[e.kind] || e.kind) +
      '</h3><small>' + esc(e.kind === 'tool' ? e.info.title : fmtClock(e.t)) + '</small></div>' +
      '<button class="tog-key" data-act="seek" data-tip="Move the playhead to this event">GO TO</button></div>';
    const span = e.kind === 'tool' ? fmtDur(e.dur) : fmtDur(e.end - e.t);
    h += '<details class="acc" data-acc="meta"' + (S.metaOpen ? ' open' : '') + '><summary>Details<span class="acc-sum' + (e.err ? ' bad' : '') + '">#' + (idx + 1) + ' · ' + span +
      (e.kind === 'tool' ? ' · ' + (e.err ? '◆ error' : 'ok') : '') + '</span></summary><div class="meta-grid">' +
      cell('Event', '#' + (idx + 1) + ' / ' + EV.length) + cell('Start', fmtTC(e.t)) + cell('End', fmtTC(e.end)) +
      cell(e.kind === 'tool' ? 'Duration' : 'On screen', span) +
      cell('Wall clock', isNaN(wall) ? '—' : wall.toLocaleTimeString()) +
      (e.kind === 'tool' ? cell('Status', e.err ? '◆ ERROR' : 'OK', e.err ? 'bad' : 'ok') : '') + '</div></details>';
    const r = respFor(e);
    if (r) {
      h += '<details class="acc" data-acc="api"' + (S.apiOpen ? ' open' : '') + '><summary>API response<span class="acc-sum">' +
        fmtNum(r.out || 0) + ' out · $' + (r.cost || 0).toFixed(4) + '</span></summary><div class="meta-grid">' +
        cell('Output', fmtNum(r.out || 0)) + cell('Input', fmtNum(r.in || 0)) + cell('Cache read', fmtNum(r.cr || 0)) +
        cell('Cache write', fmtNum(r.cw || 0)) + cell('Cost', '$' + (r.cost || 0).toFixed(4)) + cell('At', fmtClock(r.t)) + '</div></details>';
    }
    if (e.kind === 'tool') {
      h += '<div class="sect"><div class="sect-h">Input' + copyBtn('input') + '</div><pre class="code">' + esc(e.input) + '</pre></div>';
      h += '<div class="sect"><div class="sect-h">' + (e.err ? 'Result · error' : 'Result') + '' + copyBtn('result') + '</div><pre class="code' + (e.err ? ' err' : '') + '">' + esc(e.result || '(no output)') + '</pre></div>';
    } else if (e.kind === 'thinking' && !e.text) {
      h += '<div class="sect"><div class="sect-h">Content</div><pre class="code prose-s dim">Reasoning content was not captured in this log.</pre></div>';
    } else {
      h += '<div class="sect"><div class="sect-h">Content' + copyBtn('text') + '</div><pre class="code prose-s">' + esc(e.text) + '</pre></div>';
    }
    insp.innerHTML = h;
    insp.dataset.idx = idx;
  }
  // `toggle` doesn't bubble, hence capture; the inspector re-renders on every event change.
  const ACC = { meta: 'metaOpen', api: 'apiOpen' };
  insp.addEventListener('toggle', (ev) => { const k = ev.target.dataset && ACC[ev.target.dataset.acc]; if (k) { S[k] = prefs[k] = ev.target.open; savePrefs(); } }, true);
  insp.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const e = EV[+insp.dataset.idx]; if (!e) return;
    if (b.dataset.act === 'seek') seek(e.t, { idx: e.i, follow: true });
    if (b.dataset.act === 'copy') {
      const txt = String(e[b.dataset.what] || '');
      const done = () => { b.innerHTML = CHECK_SVG; b.classList.add('ok'); setTimeout(() => { b.innerHTML = COPY_SVG; b.classList.remove('ok'); }, 900); };
      try { navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done)); } catch (err) { fallbackCopy(txt, done); }
    }
  });
  function fallbackCopy(txt, done) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    ta.remove();
  }

  /* ------------------------------------------------------------------ *
   * Odometer gauges (transport) + scopes numbers
   * ------------------------------------------------------------------ */
  class Odo {
    constructor(el) { this.el = el; this.v = null; this.shape = null; this.cols = []; }
    set(s) {
      if (s === this.v) return;
      const shape = s.replace(/\d/g, '0');
      if (shape !== this.shape) {
        this.shape = shape;
        this.el.classList.add('nt');
        this.el.textContent = '';
        this.cols = [];
        for (const ch of s) {
          if (/\d/.test(ch)) {
            const od = document.createElement('span'); od.className = 'od';
            const oc = document.createElement('span'); oc.className = 'oc';
            for (let d = 0; d < 10; d++) { const sp = document.createElement('span'); sp.textContent = d; oc.appendChild(sp); }
            od.appendChild(oc); this.el.appendChild(od); this.cols.push(oc);
          } else {
            const os = document.createElement('span'); os.className = 'os'; os.textContent = ch;
            this.el.appendChild(os); this.cols.push(null);
          }
        }
        requestAnimationFrame(() => requestAnimationFrame(() => this.el.classList.remove('nt')));
      }
      let j = 0;
      for (const ch of s) { const oc = this.cols[j++]; if (oc) oc.style.transform = 'translateY(' + -(+ch) * 10 + '%)'; }
      this.v = s;
      this.el.setAttribute('aria-label', s);
    }
  }
  const odo = { cost: new Odo($('#gCost')), in: new Odo($('#gIn')), out: new Odo($('#gOut')), err: new Odo($('#gErr')) };
  const gBar = { cost: $('#gCostBar'), in: $('#gInBar'), out: $('#gOutBar'), err: $('#gErrBar') };
  // the "of total" lines never change, so they're written once
  $('#gCostSub').textContent = '/ ' + fmtUSD(TOT.cost);
  $('#gInSub').textContent = '/ ' + fmtOdo(TOT_IN);
  $('#gOutSub').textContent = '/ ' + fmtOdo(TOT.out);
  $('#gErrSub').textContent = '/ ' + TOT_ERR;
  const setBar = (k, f) => { gBar[k].style.transform = 'scaleX(' + clamp(f, 0, 1).toFixed(4) + ')'; };

  let lastRN = -1, lastEN = -2;
  const scEls = { cost: $('#scCost'), costBar: $('#scCostBar'), ctx: $('#scCtx'), ctxBar: $('#scCtxBar'), burn: $('#burnRate') };
  function updateMeters(force) {
    const n = ub(RT, S.t);
    if (n !== lastRN || force) {
      lastRN = n;
      const cost = cum.cost[n], ctx = n ? ctxOf(RS[n - 1]) : 0, inTok = inAt(n);
      odo.cost.set(fmtUSD(cost)); setBar('cost', cost / (TOT.cost || 1));
      odo.in.set(fmtOdo(inTok)); setBar('in', inTok / (TOT_IN || 1));
      odo.out.set(fmtOdo(cum.out[n])); setBar('out', cum.out[n] / (TOT.out || 1));
      scEls.cost.textContent = fmtUSD(cost); scEls.costBar.style.width = pct(cost / (TOT.cost || 1));
      scEls.ctx.textContent = ctx.toLocaleString(); scEls.ctxBar.style.width = pct(ctx / PEAK_CTX);
      const w0 = Math.max(0, S.t - 300000);
      const rate = (cost - costAt(w0)) / Math.max(1, (S.t - w0) / 60000);
      scEls.burn.textContent = S.t > 0 ? '$' + rate.toFixed(2) + '/min · last 5 min' : '';
      TOK_ROWS.forEach((r) => { tokVals[r.k].textContent = fmtNum(cum[r.k][n]); tokBars[r.k].style.width = pct(cum[r.k][n] / (TOT[r.k] || 1)); });
    }
    if (S.cur !== lastEN || force) {
      lastEN = S.cur;
      const errs = S.cur >= 0 ? errCum[S.cur] : 0;
      odo.err.set(String(errs)); setBar('err', TOT_ERR ? errs / TOT_ERR : 0);
    }
  }

  /* ------------------------------------------------------------------ *
   * Clock / current event
   * ------------------------------------------------------------------ */
  const tcEls = $$('#tc span'), burnTC = $('#burnTC'), headsTC = $('#tlHeadsTC'), lcdProg = $('#lcdProg');
  $('#lcdTot').textContent = '/ ' + fmtClock(DUR);
  let lastTC = '', hoverTC = null;
  function updateClock() {
    const p = tcParts(S.t), s = p.join(':');
    if (s !== lastTC) {
      for (let i = 0; i < 4; i++) if (tcEls[i].textContent !== p[i]) tcEls[i].textContent = p[i];
      lcdProg.style.transform = 'scaleX(' + (S.t / DUR).toFixed(4) + ')';
      burnTC.textContent = s;
      if (hoverTC == null) headsTC.textContent = s;
      tapeCanvas.setAttribute('aria-valuetext', s);
      lastTC = s;
    }
    updateMeters();
    updateMonitorLive();
  }

  function setCurrent(idx) {
    const prev = S.cur; S.cur = idx;
    if (rows[prev]) rows[prev].classList.remove('active');
    if (rows[idx]) rows[idx].classList.add('active');
    const lo = Math.max(0, Math.min(prev, idx) + 1), hi = Math.min(rows.length - 1, Math.max(prev, idx));
    for (let i = lo; i <= hi; i++) rows[i].classList.toggle('future', i > idx);
    if (prev < 0 && rows[0]) rows[0].classList.toggle('future', idx < 0);
    followList(idx);
    syncActiveTile();
    renderMonitor(idx);
    if (S.sel < 0) renderInspector();
    if (S.tapeDrag && idx !== prev) vib(3);
    D.comp = true;
  }
  function followList(idx) {
    if (!S.followList || S.view !== 'transcript') return;
    const row = rows[idx]; if (!row || row.hidden) return;
    const box = transcript, top = row.offsetTop, h = box.clientHeight;
    if (top < box.scrollTop + 24 || top + row.offsetHeight > box.scrollTop + h - 24) {
      const fast = (S.playing && Math.abs(S.rate) >= 60) || S.tapeDrag || S.coastV;
      box.scrollTo({ top: top - h * 0.3, behavior: fast || reduced ? 'auto' : 'smooth' });
    }
  }

  function setTime(t, opt) {
    opt = opt || {};
    t = clamp(t, 0, DUR);
    S.t = t;
    let idx = ub(TS, t) - 1;
    if (opt.idx != null && opt.idx >= 0) { S.forced = opt.idx; idx = opt.idx; }
    else if (S.forced >= 0 && EV[S.forced] && EV[S.forced].t === t) idx = S.forced;
    else S.forced = -1;

    if (S.followTL && S.v.span < DUR) {
      const v = S.v;
      if (opt.play) {
        if (S.rate > 0 && (t > v.start + v.span * 0.97 || t < v.start)) { v.start = t - v.span * 0.06; viewChanged(); }
        else if (S.rate < 0 && (t < v.start + v.span * 0.03 || t > v.start + v.span)) { v.start = t - v.span * 0.94; viewChanged(); }
      } else if (opt.follow && (t < v.start || t > v.start + v.span)) { v.start = t - v.span / 2; viewChanged(); }
    }
    D.comp = D.tape = true;
    if (S.inspTab === 'scopes') D.cost = true;
    if (idx !== S.cur) setCurrent(idx);
    updateClock();
  }
  const seek = (t, opt) => { S.coastV = 0; setTime(t, Object.assign({ follow: true }, opt || {})); };

  /* ------------------------------------------------------------------ *
   * View (zoom / pan)
   * ------------------------------------------------------------------ */
  const zoomEl = $('#zoom');
  function clampView() {
    S.v.span = clamp(S.v.span, MIN_SPAN, DUR);
    S.v.start = clamp(S.v.start, 0, DUR - S.v.span);
  }
  function viewChanged() {
    clampView();
    D.tl = D.comp = true;
    zoomEl.value = String(Math.round((Math.log(S.v.span / DUR) / Math.log(MIN_SPAN / DUR || 0.5)) * 1000) || 0);
    $('#tlInfo').textContent = fmtClock(S.v.start) + ' – ' + fmtClock(S.v.start + S.v.span);
  }
  function zoomAround(span, anchorT, frac) {
    S.v.span = clamp(span, MIN_SPAN, DUR);
    S.v.start = anchorT - frac * S.v.span;
    viewChanged();
  }
  function zoomBy(f) {
    const ph = S.t, inView = ph >= S.v.start && ph <= S.v.start + S.v.span;
    const a = inView ? ph : S.v.start + S.v.span / 2;
    zoomAround(S.v.span * f, a, (a - S.v.start) / S.v.span);
  }
  const zoomFit = () => { S.v.start = 0; S.v.span = DUR; viewChanged(); };
  zoomEl.addEventListener('input', () => {
    const span = DUR * Math.pow(MIN_SPAN / DUR, zoomEl.value / 1000);
    const ph = S.t, inView = ph >= S.v.start && ph <= S.v.start + S.v.span;
    const a = inView ? ph : S.v.start + S.v.span / 2;
    zoomAround(span, a, (a - S.v.start) / S.v.span);
  });

  /* ------------------------------------------------------------------ *
   * Transport
   * ------------------------------------------------------------------ */
  const stage = $('#stage');
  function syncPlayUI() {
    app.classList.toggle('playing', S.playing);
    stage.classList.toggle('playing', S.playing);
    const r = S.rate, a = Math.round(Math.abs(r));
    $('#burnState').textContent = S.playing ? (r > 0 ? 'PLAY ▶ ' : 'REV ◀ ') + a + '×' : 'PAUSED';
    $('#shuttleInd').textContent = S.playing && r !== S.base ? (r > 0 ? '▶▶ ' : '◀◀ ') + a + '×' : '';
    $('#btnPrev').classList.toggle('shuttle', S.playing && r < 0);
    $('#btnNext').classList.toggle('shuttle', S.playing && r > 0 && r !== S.base);
    const pb = $('#btnPlay');
    pb.classList.toggle('on', S.playing);
    pb.setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
    syncKnob();
  }
  function play(rate) {
    S.rate = rate;
    S.coastV = 0;
    if (rate > 0 && S.t >= DUR) setTime(0);
    if (rate < 0 && S.t <= 0) setTime(DUR);
    S.playing = true;
    syncPlayUI();
  }
  function pause() { S.playing = false; finishTyping(); syncPlayUI(); }
  function togglePlay() {
    if (S.playing) pause(); else play(S.base);
    osd(S.playing ? '▶ ' + S.base + '×' : '❚❚');
    vib(S.playing ? 14 : 8);
  }
  function shuttle(dir) {
    const cur = S.playing ? S.rate : 0;
    let next;
    const up = (v) => { const i = LADDER.findIndex((x) => x > v); return i < 0 ? LADDER[LADDER.length - 1] : LADDER[i]; };
    if (dir > 0) next = cur <= 0 ? 1 : up(cur);
    else next = cur >= 0 ? -1 : -up(-cur);
    play(next);
    osd((next > 0 ? '▶▶ ' : '◀◀ ') + Math.abs(next) + '×');
    pressFx(dir > 0 ? '#btnNext' : '#btnPrev');
  }
  function setSpeed(v, silent) {
    S.base = v; prefs.base = v; savePrefs();
    if (S.playing && !S.shuttle) S.rate = S.rate < 0 ? -v : v;
    syncPlayUI();
    if (!silent) { osd(v + '×'); vib(6); }
  }
  function pressFx(sel) { const b = $(sel); if (!b) return; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 110); }
  function step(dir) {
    let i = S.cur + dir;
    if (S.cur < 0) i = dir > 0 ? 0 : -1;
    if (i < 0 || i >= EV.length) return;
    S.sel = -1;
    seek(EV[i].t, { idx: i });
    renderInspector();
  }
  function jumpTool(dir) {
    for (let i = S.cur + dir; i >= 0 && i < EV.length; i += dir) {
      if (EV[i].kind === 'tool') { S.sel = -1; seek(EV[i].t, { idx: i }); renderInspector(); return; }
    }
  }
  function markSel(i) {
    rows.forEach((r) => r.classList.remove('sel'));
    if (rows[i]) rows[i].classList.add('sel');
  }
  function selectEvent(i) { S.sel = i; renderInspector(); D.comp = true; markSel(i); }
  function unpin() { S.sel = -1; markSel(-1); renderInspector(); D.comp = true; }
  $('#pinState').addEventListener('click', unpin);

  function syncLoopUI() {
    $('#inTC').textContent = S.loopIn != null ? fmtClock(S.loopIn) + ':' + tcParts(S.loopIn)[3] : '--:--:--';
    $('#outTC').textContent = S.loopOut != null ? fmtClock(S.loopOut) + ':' + tcParts(S.loopOut)[3] : '--:--:--';
    $('#btnIn').classList.toggle('set', S.loopIn != null);
    $('#btnOut').classList.toggle('set', S.loopOut != null);
    $('#btnClearMarks').setAttribute('aria-pressed', String(S.loopOn));
    $('#btnClearMarks').disabled = S.loopIn == null && S.loopOut == null;
    $('#loopLen').textContent = S.loopIn != null && S.loopOut != null ? fmtDur(S.loopOut - S.loopIn) : '—';
    $('#loopMod').classList.toggle('on', S.loopOn);
    D.comp = true;
  }
  function markIn() { S.loopIn = S.t; if (S.loopOut != null && S.loopOut <= S.loopIn) S.loopOut = null; S.loopOn = S.loopOut != null; syncLoopUI(); pressFx('#btnIn'); osd('IN ' + fmtClock(S.t)); }
  function markOut() { S.loopOut = S.t; if (S.loopIn != null && S.loopIn >= S.loopOut) S.loopIn = null; S.loopOn = S.loopIn != null; syncLoopUI(); pressFx('#btnOut'); osd('OUT ' + fmtClock(S.t)); }
  function clearMarks() { S.loopIn = S.loopOut = null; S.loopOn = false; syncLoopUI(); }
  function toggleLoop() {
    if (S.loopIn == null || S.loopOut == null) { S.loopOn = false; syncLoopUI(); flashTip('#btnClearMarks', 'Set IN (I) and OUT (O) first'); return; }
    S.loopOn = !S.loopOn; syncLoopUI(); osd(S.loopOn ? 'LOOP ON' : 'LOOP OFF');
  }
  function setSkip(on) { S.skip = on; syncKnob(); osd(on ? '» SKIP IDLE' : 'REAL TIME'); vib(6); }
  function setToggle(sel, on) { $(sel).setAttribute('aria-pressed', String(on)); }

  // ◀◀ / ▶▶ keys: tap steps one event, hold shuttles with acceleration, release restores
  function startHold(dir) {
    S.shuttle = { dir, start: performance.now(), was: S.playing, mag: 0 };
    play(dir * 10);
    osd(dir < 0 ? '◀◀' : '▶▶');
    vib(18);
  }
  function endHold() {
    const h = S.shuttle; S.shuttle = null;
    if (!h) return;
    if (h.was) play(S.base); else pause();
  }
  function holdKey(btn, dir) {
    let timer = 0, held = false, down = false;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      down = true; held = false;
      btn.classList.add('down');
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      timer = setTimeout(() => { held = true; startHold(dir); }, 280);
    });
    const up = (cancel) => {
      if (!down) return;
      down = false;
      clearTimeout(timer);
      btn.classList.remove('down');
      if (held) endHold();
      else if (!cancel) { step(dir); vib(7); }
    };
    btn.addEventListener('pointerup', () => up(false));
    btn.addEventListener('pointercancel', () => up(true));
    btn.addEventListener('click', (e) => { if (e.detail === 0) step(dir); }); // keyboard activation
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  holdKey($('#btnPrev'), -1);
  holdKey($('#btnNext'), 1);

  $('#btnPlay').addEventListener('click', togglePlay);
  $('#monPrev').addEventListener('click', () => step(-1));
  $('#monNext').addEventListener('click', () => step(1));
  $('#btnStart').addEventListener('click', () => seek(0));
  $('#btnEnd').addEventListener('click', () => seek(DUR));
  $('#btnIn').addEventListener('click', markIn);
  $('#btnOut').addEventListener('click', markOut);
  $('#btnClearMarks').addEventListener('click', clearMarks);
  $('#btnTheme').addEventListener('click', toggleTheme);
  $('#btnZoomIn').addEventListener('click', () => zoomBy(0.5));
  $('#btnZoomOut').addEventListener('click', () => zoomBy(2));
  $('#btnFit').addEventListener('click', zoomFit);
  $('#btnSnap').addEventListener('click', () => { S.snap = !S.snap; setToggle('#btnSnap', S.snap); });
  $('#btnFollow').addEventListener('click', () => { S.followTL = !S.followTL; setToggle('#btnFollow', S.followTL); });
  $('#btnFollowList').addEventListener('click', () => { S.followList = !S.followList; setToggle('#btnFollowList', S.followList); if (S.followList) followList(S.cur); });
  $('#tapeZoomIn').addEventListener('click', () => setTapeZoom(S.tapeZoom + 1));
  $('#tapeZoomOut').addEventListener('click', () => setTapeZoom(S.tapeZoom - 1));

  /* ---------- Tabs ---------- */
  $$('[data-insptab]').forEach((b) => b.addEventListener('click', () => {
    S.inspTab = b.dataset.insptab;
    $$('[data-insptab]').forEach((x) => x.classList.toggle('on', x === b));
    insp.classList.toggle('hidden', S.inspTab !== 'inspector');
    $('#scopes').classList.toggle('hidden', S.inspTab !== 'scopes');
    if (S.inspTab === 'scopes') { CC.measure(); D.cost = true; }
  }));

  /* ---------- Transcript / bin clicks ---------- */
  function pickEvent(i) { if (!EV[i]) return; selectEvent(i); seek(EV[i].t, { idx: i }); }
  /* ---------- Return to the playhead ----------
     Scrolling the transcript or clips lets go of FOLLOW (as in the book); clicking an event pins it in the inspector.
     Either way the list has left the playhead, so a button offers the way back: unpin, FOLLOW on, scroll to it. */
  const toPh = $('#toPlayhead');
  const letGo = () => { if (S.followList) { S.followList = false; setToggle('#btnFollowList', false); } };
  [transcript, mediaBin].forEach((el) => {
    el.addEventListener('wheel', letGo, { passive: true });
    el.addEventListener('touchmove', letGo, { passive: true });
  });
  let toPhSec = -1;
  function updToPlayhead() {
    const list = S.view === 'transcript' ? transcript : S.view === 'clips' ? mediaBin : null;
    let away = false;
    if (list && S.cur >= 0) {
      const el = S.view === 'transcript' ? rows[S.cur] : tiles && tiles[S.cur];
      const box = list.getBoundingClientRect(), r = el && !el.hidden ? el.getBoundingClientRect() : null;
      const offscreen = !r || r.bottom < box.top || r.top > box.bottom;
      away = (S.sel >= 0 && S.sel !== S.cur) || (!S.followList && offscreen);
    }
    if (toPh.hidden === away) toPh.hidden = !away;
    const s = Math.floor(S.t / 1000);
    if (away && s !== toPhSec) { toPhSec = s; $('#toPlayheadT').textContent = fmtClock(S.t); }
  }
  toPh.addEventListener('click', () => {
    unpin();
    S.followList = true; setToggle('#btnFollowList', true);
    if (S.view === 'transcript' && rows[S.cur]) transcript.scrollTo({ top: rows[S.cur].offsetTop - transcript.clientHeight * 0.3, behavior: reduced ? 'auto' : 'smooth' });
    else if (S.view === 'clips' && tiles && tiles[S.cur]) tiles[S.cur].scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    toPh.hidden = true;
  });
  transcript.addEventListener('click', (e) => { const r = e.target.closest('.row'); if (r) pickEvent(+r.dataset.i); });
  mediaBin.addEventListener('click', (e) => { const r = e.target.closest('.tile'); if (r) pickEvent(+r.dataset.i); });

  /* ---------- Search + category filter ----------
     Chips are OR'd with each other ("Bash or Edit"); "Error" adds any errored
     event. The search text then narrows whatever the chips let through. */
  const search = $('#search');
  const CAT_LABEL = { prompt: 'Prompt', reply: 'Reply', thinking: 'Thinking', mcp: 'MCP', error: 'Error' };
  const CAT_CV = { prompt: '--c-prompt', reply: '--c-text', thinking: '--c-thinking', mcp: '--c-other', error: '--err' };
  const catCount = {};
  EV.forEach((e) => { catCount[e.cat] = (catCount[e.cat] || 0) + 1; if (e.err) catCount.error = (catCount.error || 0) + 1; });
  const toolCats = Object.keys(catCount).filter((c) => !(c in CAT_LABEL)).sort((a, b) => catCount[b] - catCount[a]);
  // MCP and Error always show, so it's visible they're filterable even when this tape has none.
  const CATS = ['prompt', 'reply', 'thinking'].filter((c) => catCount[c]).concat(toolCats, ['mcp', 'error']);
  S.cats = new Set();
  const chipsEl = $('#chips');
  chipsEl.innerHTML = '<button class="chip" data-cat="" aria-pressed="true">All <b>' + EV.length + '</b></button>' + CATS.map((c) => {
    const tool = toolCats.indexOf(c) >= 0 ? EV.find((e) => e.cat === c).key : null;
    const cv = CAT_CV[c] || (tool && CVAR[tool]) || '--c-other';
    const n = catCount[c] || 0;
    return '<button class="chip" data-cat="' + c + '" aria-pressed="false" style="--c:var(' + cv + ')"' + (n ? '' : ' disabled') + '>' +
      (c === 'error' ? '<span class="err-dia">◆</span>' : '<i></i>') + esc(CAT_LABEL[c] || tool) + ' <b>' + n + '</b></button>';
  }).join('');
  chipsEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip'); if (!b || b.disabled) return;
    const c = b.dataset.cat;
    if (!c) S.cats.clear();
    else if (S.cats.has(c)) S.cats.delete(c);
    else S.cats.add(c);
    $$('.chip', chipsEl).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat ? S.cats.has(x.dataset.cat) : !S.cats.size)));
    applyFilter();
    vib(5);
  });
  const catOk = (e) => !S.cats.size || S.cats.has(e.cat) || (S.cats.has('error') && e.err);
  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    S.match = q || S.cats.size ? new Set(EV.filter((e) => catOk(e) && (!q || e.hay.indexOf(q) >= 0)).map((e) => e.i)) : null;
    let n = 0;
    rows.forEach((r, i) => { const hide = !!S.match && !S.match.has(i); r.hidden = hide; if (!hide) n++; });
    if (tiles) {
      tiles.forEach((el, i) => { if (el) el.hidden = !!S.match && !S.match.has(i); });
      $$('.bin-group', mediaBin).forEach((g) => { g.hidden = !!S.match && !$('.tile:not([hidden])', g); });
    }
    $('#binCount').textContent = S.match ? n + ' / ' + EV.length : EV.length + ' events';
    D.tl = D.tape = true;
  }
  search.addEventListener('input', applyFilter);

  /* ------------------------------------------------------------------ *
   * Timeline interactions
   * ------------------------------------------------------------------ */
  const clipTip = $('#clipTip');
  function local(ev, el) { const r = el.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function hitClip(x, y) {
    if (y < RULER) return -1;
    const row = Math.floor((y - RULER + S.scrollY) / TH);
    const tr = TRACKS[row];
    if (!tr || S.hidden.has(tr.key)) return -1;
    const ly = y - trackY(row); if (ly < 3 || ly > TH - 3) return -1;
    let best = -1, bd = 1e9;
    for (const e of tr.evs) {
      const x0 = X(e.t), x1 = Math.max(X(e.end), x0 + 2.5);
      if (x >= x0 - 3 && x <= x1 + 3) { const d = x >= x0 && x <= x1 ? 0 : Math.min(Math.abs(x - x0), Math.abs(x - x1)); if (d <= bd) { bd = d; best = e.i; } }
    }
    return best;
  }
  function hitResp(x, y) {
    const wy = waveY(); if (!S.showTokens || y < wy || y > wy + WH || y < RULER) return -1;
    let best = -1, bd = 8;
    for (let i = 0; i < NR; i++) { const d = Math.abs(X(RS[i].t) - x); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function snapT(t) {
    if (!S.snap) return t;
    const i = ub(TS, t), tol = (8 / TL.w) * S.v.span;
    let best = t, bd = tol;
    for (const j of [i - 1, i]) { if (j >= 0 && j < TS.length && Math.abs(TS[j] - t) < bd) { bd = Math.abs(TS[j] - t); best = TS[j]; } }
    if (S.loopIn != null && Math.abs(S.loopIn - t) < bd) { bd = Math.abs(S.loopIn - t); best = S.loopIn; }
    if (S.loopOut != null && Math.abs(S.loopOut - t) < bd) best = S.loopOut;
    return best;
  }
  function showClipTip(ev, html, kc) {
    clipTip.innerHTML = html; clipTip.style.setProperty('--kc', kc || 'var(--ink)'); clipTip.style.display = 'block';
    const w = clipTip.offsetWidth, h = clipTip.offsetHeight;
    let x = ev.clientX + 14, y = ev.clientY + 16;
    if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
    if (y + h > innerHeight - 8) y = ev.clientY - h - 12;
    clipTip.style.left = x + 'px'; clipTip.style.top = y + 'px';
  }
  const hideClipTip = () => { clipTip.style.display = 'none'; };

  let tlDrag = null;
  function scrubTo(x) { setTime(snapT(Tx(clamp(x, 0, TL.w)))); }
  tlCanvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const p = local(ev, tlCanvas);
    const hit = hitClip(p.x, p.y);
    tlDrag = { x0: p.x, moved: false, wasPlaying: S.playing, clip: hit };
    tlCanvas.setPointerCapture(ev.pointerId);
    hideClipTip();
    S.coastV = 0;
    if (hit >= 0) { selectEvent(hit); setTime(EV[hit].t, { idx: hit }); }
    else { if (S.playing) pause(); scrubTo(p.x); tlCanvas.style.cursor = 'ew-resize'; }
  });
  tlCanvas.addEventListener('pointermove', (ev) => {
    const p = local(ev, tlCanvas);
    hoverTC = Tx(p.x); headsTC.textContent = fmtTC(clamp(hoverTC, 0, DUR));
    if (tlDrag) {
      if (Math.abs(p.x - tlDrag.x0) > 3) tlDrag.moved = true;
      if (tlDrag.clip < 0 || tlDrag.moved) {
        if (S.playing) pause();
        scrubTo(p.x);
        if (p.x > TL.w - 16) { S.v.start += S.v.span * 0.01; viewChanged(); }
        else if (p.x < 16) { S.v.start -= S.v.span * 0.01; viewChanged(); }
      }
      return;
    }
    const hit = hitClip(p.x, p.y);
    if (hit !== S.hover) { S.hover = hit; D.comp = true; }
    if (hit >= 0) {
      const e = EV[hit];
      tlCanvas.style.cursor = 'pointer';
      showClipTip(ev, '<div class="h">' + esc(KIND_LABEL[e.key] || e.key) + '<span>' + fmtClock(e.t) + ' · ' + (e.kind === 'tool' ? fmtDur(e.dur) : fmtDur(e.end - e.t)) + '</span></div>' +
        '<div class="b">' + esc(e.kind === 'tool' ? e.info.cmd : e.text || 'Reasoning (not in the log)') + '</div>' + (e.err ? '<div class="e">◆ error</div>' : ''), kcOf(e.key));
      return;
    }
    const ri = hitResp(p.x, p.y);
    if (ri >= 0) {
      const r = RS[ri];
      tlCanvas.style.cursor = 'crosshair';
      showClipTip(ev, '<div class="h">API response<span>' + fmtClock(r.t) + '</span></div><div class="b">output ' + fmtNum(r.out || 0) + ' · input ' + fmtNum(r.in || 0) +
        ' · cache read ' + fmtNum(r.cr || 0) + ' · cache write ' + fmtNum(r.cw || 0) + '<br>context ' + fmtNum(ctxOf(r)) + ' · $' + (r.cost || 0).toFixed(4) + '</div>', 'var(--hw-fg)');
      return;
    }
    tlCanvas.style.cursor = p.y < RULER ? 'ew-resize' : 'default';
    hideClipTip();
  });
  function endTlDrag() {
    if (!tlDrag) return;
    const d = tlDrag; tlDrag = null;
    tlCanvas.style.cursor = 'default';
    if (d.wasPlaying && !S.playing && (d.clip < 0 || d.moved)) play(S.rate);
  }
  tlCanvas.addEventListener('pointerup', endTlDrag);
  tlCanvas.addEventListener('pointercancel', endTlDrag);
  tlCanvas.addEventListener('pointerleave', () => {
    if (tlDrag) return;
    hoverTC = null; headsTC.textContent = lastTC;
    if (S.hover !== -1) { S.hover = -1; D.comp = true; }
    hideClipTip();
  });
  tlCanvas.addEventListener('dblclick', (ev) => {
    const p = local(ev, tlCanvas);
    const hit = hitClip(p.x, p.y);
    if (hit >= 0) { const e = EV[hit]; const span = Math.max(MIN_SPAN, (e.end - e.t) * 3); S.v.span = span; S.v.start = e.t - span / 3; viewChanged(); }
  });
  function onWheel(ev, isOverview) {
    ev.preventDefault();
    const el = isOverview ? ovCanvas : tlCanvas;
    const p = local(ev, el);
    const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    const dx = ev.deltaMode === 1 ? ev.deltaX * 16 : ev.deltaX;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || isOverview) {
      const anchor = isOverview ? clamp((p.x / OV.w) * DUR, S.v.start, S.v.start + S.v.span) : Tx(p.x);
      zoomAround(S.v.span * Math.exp(dy * 0.0025), anchor, (anchor - S.v.start) / S.v.span);
      return;
    }
    if (Math.abs(dx) > Math.abs(dy) || ev.shiftKey) {
      S.v.start += ((ev.shiftKey && !dx ? dy : dx) / TL.w) * S.v.span; viewChanged(); return;
    }
    const maxScroll = Math.max(0, contentH() - (TL.h - RULER));
    if (maxScroll > 0 && p.y > RULER) { S.scrollY += dy; clampScroll(); D.tl = true; }
    else { S.v.start += (dy / TL.w) * S.v.span; viewChanged(); }
  }
  tlCanvas.addEventListener('wheel', (e) => onWheel(e, false), { passive: false });
  ovCanvas.addEventListener('wheel', (e) => onWheel(e, true), { passive: false });
  $('#tlHeads').addEventListener('wheel', (ev) => { ev.preventDefault(); S.scrollY += ev.deltaY; clampScroll(); D.tl = true; }, { passive: false });

  /* ---------- Overview interactions ---------- */
  let ovDrag = null;
  ovCanvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev, ovCanvas);
    const a = OX(S.v.start), b = OX(S.v.start + S.v.span);
    ovCanvas.setPointerCapture(ev.pointerId);
    let mode;
    if (Math.abs(p.x - a) < 6) mode = 'l';
    else if (Math.abs(p.x - b) < 6) mode = 'r';
    else if (p.x > a && p.x < b) mode = 'pan';
    else { S.v.start = (p.x / OV.w) * DUR - S.v.span / 2; viewChanged(); mode = 'pan'; }
    ovDrag = { mode, x0: p.x, off: p.x - OX(S.v.start), end: S.v.start + S.v.span, start: S.v.start, moved: false };
    ovCanvas.classList.add('grabbing');
  });
  ovCanvas.addEventListener('pointermove', (ev) => {
    const p = local(ev, ovCanvas);
    if (!ovDrag) {
      const a = OX(S.v.start), b = OX(S.v.start + S.v.span);
      ovCanvas.style.cursor = Math.abs(p.x - a) < 6 || Math.abs(p.x - b) < 6 ? 'ew-resize' : '';
      return;
    }
    if (Math.abs(p.x - ovDrag.x0) > 2) ovDrag.moved = true;
    const t = (p.x / OV.w) * DUR;
    if (ovDrag.mode === 'pan') S.v.start = ((p.x - ovDrag.off) / OV.w) * DUR;
    else if (ovDrag.mode === 'l') { const s = Math.min(t, ovDrag.end - MIN_SPAN); S.v.start = s; S.v.span = ovDrag.end - s; }
    else { S.v.span = Math.max(MIN_SPAN, t - ovDrag.start); S.v.start = ovDrag.start; }
    viewChanged();
  });
  const endOv = (ev) => {
    if (!ovDrag) return;
    if (!ovDrag.moved && ovDrag.mode === 'pan' && ev.type === 'pointerup') seek((local(ev, ovCanvas).x / OV.w) * DUR, { follow: false });
    ovDrag = null; ovCanvas.classList.remove('grabbing');
  };
  ovCanvas.addEventListener('pointerup', endOv);
  ovCanvas.addEventListener('pointercancel', endOv);

  /* ---------- Tape drag with inertia ---------- */
  (function tapeInput() {
    const el = tapeCanvas;
    let x0 = 0, lastX = 0, moved = false, samples = [], pid = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      pid = e.pointerId;
      el.setPointerCapture(pid);
      S.tapeDrag = true; moved = false; S.coastV = 0;
      if (S.shuttle) endHold();
      x0 = lastX = e.clientX; samples = [{ x: e.clientX, t: performance.now() }];
      el.classList.add('grabbing');
    });
    el.addEventListener('pointermove', (e) => {
      if (!S.tapeDrag || e.pointerId !== pid) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      if (Math.abs(e.clientX - x0) > 4) moved = true;
      if (dx) setTime(S.t - dx / tppm(), { follow: true });
      const now = performance.now();
      samples.push({ x: e.clientX, t: now });
      while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
    });
    const end = (e, cancel) => {
      if (!S.tapeDrag || e.pointerId !== pid) return;
      S.tapeDrag = false; pid = null;
      el.classList.remove('grabbing');
      if (!moved && !cancel) {
        // tap: seek to that point, snapping to a nearby event
        const r = el.getBoundingClientRect();
        const tt = S.t + (e.clientX - r.left - TP.w / 2) / tppm();
        const snapMs = 10 / tppm();
        let best = -1, bd = Infinity;
        for (let i = Math.max(0, ub(TS, tt - snapMs) - 1); i < EV.length && EV[i].t <= tt + snapMs; i++) {
          const d = Math.abs(EV[i].t - tt);
          if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) seek(EV[best].t, { idx: best }); else seek(tt);
        vib(6);
      } else if (!reduced && samples.length > 1) {
        const a = samples[0], b = samples[samples.length - 1];
        const dtp = b.t - a.t;
        if (dtp > 0 && performance.now() - b.t < 80) {
          const vpx = (b.x - a.x) / dtp; // px per ms
          if (Math.abs(vpx) > 0.15) S.coastV = -vpx / tppm();
        }
      }
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { setTapeZoom(S.tapeZoom + (e.deltaY < 0 ? 1 : -1)); return; }
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      S.coastV = 0;
      setTime(S.t + d / tppm(), { follow: true });
    }, { passive: false });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); e.stopPropagation();
        seek(S.t + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 30000 : 5000));
      }
    });
  })();

  /* ---------- Speed control ----------
     − [10× ▾] + | SKIP IDLE: steps along LADDER, a native list of every speed in between (one click opens it,
     one picks), scroll on it to step, and SKIP IDLE always in view. The studio and the book each mount one
     (speedControl(), exported for book.js); syncKnob keeps every copy in step. */
  function speedControl() {
    const el = document.createElement('div');
    el.className = 'spd'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Playback speed');
    el.innerHTML =
      '<span class="spd-group">' +
        '<button class="spd-step" data-step="-1" aria-label="Slower" data-tip="Slower">−</button>' +
        '<span class="spd-sel"><select aria-label="Speed" data-tip="Playback speed · scroll to change">' + LADDER.map((v) => '<option value="' + v + '">' + v + '×</option>').join('') + '</select></span>' +
        '<button class="spd-step" data-step="1" aria-label="Faster" data-tip="Faster">+</button>' +
      '</span>' +
      '<span class="spd-sep" aria-hidden="true"></span>' +
      '<button class="tog-key spd-skip" aria-pressed="false" data-tip="Skip idle gaps while playing" data-kbd="S"><i class="led"></i>SKIP IDLE</button>';
    el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => nudgeSpeed(+b.dataset.step)));
    el.querySelector('select').addEventListener('change', (e) => setSpeed(+e.target.value));
    if (window.VCRDropdown) window.VCRDropdown(el.querySelector('select'));   // the deck's own list, not the OS's
    el.querySelector('.spd-skip').addEventListener('click', () => setSkip(!S.skip));
    let wheelAcc = 0;
    el.querySelector('.spd-sel').addEventListener('wheel', (e) => {
      e.preventDefault();
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(wheelAcc) >= 40) { nudgeSpeed(wheelAcc < 0 ? 1 : -1); wheelAcc = 0; }
    }, { passive: false });
    speedCtls.push(el); syncKnob();
    return el;
  }
  function ladderIdx(v) {
    let best = 0;
    LADDER.forEach((x, i) => { if (Math.abs(Math.log(x / v)) < Math.abs(Math.log(LADDER[best] / v))) best = i; });
    return best;
  }
  function syncKnob() {
    const i = ladderIdx(S.base);
    speedCtls.forEach((el) => {
      const sel = el.querySelector('select'); sel.value = String(LADDER[i]); if (sel._ddSync) sel._ddSync();
      el.querySelector('[data-step="-1"]').disabled = i === 0;
      el.querySelector('[data-step="1"]').disabled = i === LADDER.length - 1;
      el.querySelector('.spd-skip').setAttribute('aria-pressed', String(!!S.skip));
    });
  }
  function nudgeSpeed(d) {
    const v = LADDER[clamp(ladderIdx(S.base) + d, 0, LADDER.length - 1)];
    if (v !== S.base) setSpeed(v);
  }
  $('#speedMount').appendChild(speedControl());

  /* ---------- Splitters ---------- */
  $$('.splitter').forEach((sp) => {
    sp.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      sp.setPointerCapture(ev.pointerId); sp.classList.add('drag'); document.body.classList.add('resizing');
      const kind = sp.dataset.split;
      const start = {
        x: ev.clientX, y: ev.clientY,
        right: $('#inspPanel').getBoundingClientRect().width,
        tlh: $('#timeline').getBoundingClientRect().height,
      };
      const move = (e) => {
        if (kind === 'right') { prefs.right = Math.round(clamp(start.right - (e.clientX - start.x), 260, Math.min(600, innerWidth * 0.4))); app.style.setProperty('--right', prefs.right + 'px'); }
        else { prefs.tlh = Math.round(clamp(start.tlh - (e.clientY - start.y), 200, innerHeight - 360)); app.style.setProperty('--tl-h', prefs.tlh + 'px'); }
      };
      const up = () => {
        sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); sp.removeEventListener('pointercancel', up);
        sp.classList.remove('drag'); document.body.classList.remove('resizing'); savePrefs();
      };
      sp.addEventListener('pointermove', move); sp.addEventListener('pointerup', up); sp.addEventListener('pointercancel', up);
    });
    sp.addEventListener('dblclick', () => {
      const k = sp.dataset.split;
      if (k === 'right') { delete prefs.right; app.style.removeProperty('--right'); }
      else { delete prefs.tlh; app.style.removeProperty('--tl-h'); }
      savePrefs();
    });
  });

  /* ---------- Tooltips (buttons with shortcut hints) ---------- */
  const tip = $('#tip');
  let tipTimer = 0, tipEl = null;
  function placeTip(el) {
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const x = r.left + r.width / 2 - w / 2;
    let y = r.bottom + 8;
    if (y + h > innerHeight - 6) y = r.top - h - 8;
    tip.style.left = clamp(x, 6, innerWidth - w - 6) + 'px'; tip.style.top = y + 'px';
  }
  function showTip(el, text) {
    tip.innerHTML = '<span>' + esc(text || el.dataset.tip) + '</span>' + (el.dataset.kbd && !text ? '<kbd>' + esc(el.dataset.kbd) + '</kbd>' : '');
    placeTip(el); tip.classList.add('show');
  }
  function flashTip(sel, text) { const el = $(sel); if (!el) return; showTip(el, text); clearTimeout(tipTimer); tipTimer = setTimeout(() => tip.classList.remove('show'), 1600); }
  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType === 'touch') return;
    const el = ev.target.closest && ev.target.closest('[data-tip]');
    if (el === tipEl) return;
    tipEl = el; clearTimeout(tipTimer); tip.classList.remove('show');
    if (el) tipTimer = setTimeout(() => showTip(el), 420);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(tipTimer); tip.classList.remove('show'); });

  /* ------------------------------------------------------------------ *
   * Customize: program view + which panels show. Persisted with prefs.
   * ------------------------------------------------------------------ */
  const UI_DEFAULT = { view: 'transcript', overlays: true, right: true, bay: true, gauges: true, tape: false, overview: true, tokens: true };
  const UI = Object.assign({}, UI_DEFAULT, prefs.ui || {});
  const VIEWS = ['transcript', 'event', 'clips', 'report'];
  // v2: chat became the transcript, and the tape went behind SHOW, hidden by default.
  if ((prefs.uiV || 0) < 2) { UI.tape = false; prefs.uiV = 2; }
  // v3: the tape bay shows by default; a bay hidden under an older layout comes back once (P still hides it)
  if (prefs.uiV < 3) { UI.bay = true; prefs.uiV = 3; }
  if (!VIEWS.includes(UI.view)) UI.view = 'transcript';
  { const qv = new URLSearchParams(location.search).get('view'); if (VIEWS.includes(qv)) UI.view = qv; }   // ?view=report opens on that view
  delete UI.chatTools; delete UI.chatThinking; delete UI.viz; delete UI.left;
  S.metaOpen = !!prefs.metaOpen; S.apiOpen = !!prefs.apiOpen;
  const custom = $('#custom'), tlShow = $('#tlShow');
  function applyUI() {
    finishTyping();
    S.view = UI.view;
    monPanel.dataset.view = UI.view;
    ['right', 'bay', 'gauges', 'tape', 'overview', 'overlays', 'tokens'].forEach((k) => app.classList.toggle('no-' + k, !UI[k]));
    $('#btnBay').setAttribute('aria-pressed', String(UI.bay));
    $$('[data-view]').forEach((b) => { const on = b.dataset.view === UI.view; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    { const b = $('#viewPop [data-view="' + UI.view + '"] b'); if (b) $('#viewName').textContent = b.textContent; }
    $$('.pop [data-opt]').forEach((inp) => { inp.checked = !!UI[inp.dataset.opt]; });
    if (S.showTokens !== UI.tokens) { S.showTokens = UI.tokens; clampScroll(); D.tl = true; }
    if (UI.view === 'transcript') followList(S.cur);
    else if (UI.view === 'clips') syncActiveTile();
    else if (UI.view === 'report') renderReport();
    else renderMonitor(S.cur, true);
    D.tape = true;
    prefs.ui = UI; savePrefs();
  }
  // the Report view (report.js): built once, from the whole tape; its rows seek and select like a transcript line
  let reportBuilt = false;
  function renderReport() {
    if (reportBuilt || !window.VCRReport || !window.analyzeTape) return;
    window.VCRReport.render($('#report'), TAPE, (i) => pickEvent(i));
    reportBuilt = true;
  }
  function setView(v) { UI.view = v; applyUI(); }
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.view); setViewPop(false); }));
  function setUI(k, v) { UI[k] = v; applyUI(); }

  /* ---------- the program view menu: Transcript, Event, Session clips, Report ---------- */
  const viewBtn = $('#viewBtn'), viewPop = $('#viewPop');
  function setViewPop(on) {
    viewPop.hidden = !on; viewBtn.setAttribute('aria-expanded', String(on));
    if (on) { const cur = $('[data-view="' + UI.view + '"]', viewPop); (cur || viewPop.firstElementChild).focus({ preventScroll: true }); }
  }
  viewBtn.addEventListener('click', (e) => { e.stopPropagation(); setViewPop(viewPop.hidden); });
  document.addEventListener('pointerdown', (e) => { if (!viewPop.hidden && !e.target.closest('#viewMenu')) setViewPop(false); });
  viewPop.addEventListener('keydown', (e) => {
    const items = $$('[data-view]', viewPop), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setViewPop(false); viewBtn.focus(); }
    else if (e.key === 'Tab') setViewPop(false);
    else if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();   // the item's own click, not play / pause
  });

  /* ---------- pricing (Customize): the rates spend is worked out from, for this tape's model ----------
     Rates live in parse-tape.js (window.tapePricing). A change prices the tape again, which every total here is
     built from, so the page reloads at the same playhead. */
  const PR = window.tapePricing;
  if (PR) (function pricing() {
    const model = TAPE.model || (RS[0] && RS[0].model) || '';
    const inputs = $$('#priceSec [data-rate]'), msg = $('#priceMsg'), apply = $('#priceApply');
    const SRC = { custom: 'custom', live: 'fetched', list: 'list price', default: 'unknown model: Opus rates' };
    let shown = null;
    function show() {
      const r = PR.rateFor(model); shown = r.rate;
      $('#priceModel').textContent = PR.bare(model) || 'unknown model';
      $('#priceSrc').textContent = SRC[r.source] + (r.at ? ' · ' + r.at : '');
      inputs.forEach((i) => { i.value = r.rate[i.dataset.rate]; });
      apply.disabled = true;
    }
    const say = (t, err) => { msg.textContent = t; msg.hidden = !t; msg.classList.toggle('err', !!err); };
    // the rates changed: price the tape again by reloading, back at this playhead
    function reprice() { try { sessionStorage.setItem('vcr-ds-resume', JSON.stringify({ t: S.t, src: TAPE.source })); } catch (e) {} location.reload(); }
    inputs.forEach((i) => i.addEventListener('input', () => { apply.disabled = inputs.every((x) => +x.value === shown[x.dataset.rate]) || inputs.some((x) => x.value === '' || +x.value < 0); }));
    apply.addEventListener('click', () => {
      const rate = {}; inputs.forEach((i) => { rate[i.dataset.rate] = +i.value; });
      PR.setCustom(model, rate); reprice();
    });
    $('#priceReset').addEventListener('click', () => { PR.setCustom(model, null); PR.clearLive(); reprice(); });
    $('#priceFetch').addEventListener('click', async (e) => {
      const b = e.currentTarget; b.disabled = true; say('Fetching prices…');
      try {
        const rates = await PR.fetchLive();
        if (!rates[PR.bare(model)]) { say('Fetched ' + Object.keys(rates).length + ' Claude models, but not ' + (PR.bare(model) || 'this one') + ': it keeps its list price.'); show(); }
        else { PR.setCustom(model, null); reprice(); }
      } catch (err) { say('Couldn’t fetch prices: ' + (err.message || 'offline') + '.', true); }
      b.disabled = false;
    });
    show();
  })();
  for (const pop of [custom, tlShow]) pop.addEventListener('change', (ev) => { const k = ev.target.dataset.opt; if (!k) return; UI[k] = ev.target.checked; applyUI(); });
  $('#customReset').addEventListener('click', () => {
    Object.assign(UI, UI_DEFAULT);
    delete prefs.right; delete prefs.tlh;
    ['--right', '--tl-h'].forEach((p) => app.style.removeProperty(p));
    applyUI();
  });
  function toggleCustom(on) {
    custom.hidden = on == null ? !custom.hidden : !on;
    $('#btnCustom').setAttribute('aria-pressed', String(!custom.hidden));
  }
  // The timeline's SHOW menu opens above its button (the timeline sits at the bottom).
  const btnTlShow = $('#btnTlShow');
  function toggleTlShow(on) {
    tlShow.hidden = on == null ? !tlShow.hidden : !on;
    btnTlShow.setAttribute('aria-pressed', String(!tlShow.hidden));
    if (tlShow.hidden) return;
    const r = btnTlShow.getBoundingClientRect();
    Object.assign(tlShow.style, { top: 'auto', right: 'auto', bottom: (innerHeight - r.top + 8) + 'px', left: clamp(r.left, 8, innerWidth - tlShow.offsetWidth - 8) + 'px' });
  }
  $('#btnCustom').addEventListener('click', () => toggleCustom());
  btnTlShow.addEventListener('click', () => toggleTlShow());
  document.addEventListener('pointerdown', (ev) => {
    if (!custom.hidden && !custom.contains(ev.target) && !ev.target.closest('#btnCustom')) toggleCustom(false);
    if (!tlShow.hidden && !tlShow.contains(ev.target) && !ev.target.closest('#btnTlShow')) toggleTlShow(false);
  });

  /* ------------------------------------------------------------------ *
   * Keyboard
   * ------------------------------------------------------------------ */
  document.addEventListener('keydown', (e) => {
    const tgt = e.target;
    if (tgt && tgt.matches && tgt.matches('input[type=search], input[type=number], textarea')) {
      if (e.key === 'Escape') { tgt.blur(); }
      return;
    }
    // Space/Enter on a checkbox in the customize panel should tick it, not play.
    if (tgt && tgt.closest && tgt.closest('.pop') && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    let handled = true;
    switch (k) {
      case ' ':
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
        togglePlay(); pressFx('#btnPlay'); break;
      case 'k': case 'K': pause(); pressFx('#btnPlay'); break;
      case 'l': case 'L': shuttle(1); break;
      case 'j': case 'J': shuttle(-1); break;
      case 'ArrowRight': if (e.shiftKey) seek(S.t + 5000); else { step(1); pressFx('#btnNext'); } break;
      case 'ArrowLeft': if (e.shiftKey) seek(S.t - 5000); else { step(-1); pressFx('#btnPrev'); } break;
      case 'ArrowDown': jumpTool(1); break;
      case 'ArrowUp': jumpTool(-1); break;
      case 'Home': seek(0); pressFx('#btnStart'); break;
      case 'End': seek(DUR); pressFx('#btnEnd'); break;
      case 'i': case 'I': markIn(); break;
      case 'o': case 'O': markOut(); break;
      case 'x': case 'X': clearMarks(); pressFx('#btnClearMarks'); break;
      case '/': toggleLoop(); break;
      case 's': case 'S': setSkip(!S.skip); break;
      case '+': case '=': zoomBy(0.5); pressFx('#btnZoomIn'); break;
      case '-': case '_': zoomBy(2); pressFx('#btnZoomOut'); break;
      case 'z': case 'Z': zoomFit(); pressFx('#btnFit'); break;
      case 'f': case 'F': S.followTL = !S.followTL; setToggle('#btnFollow', S.followTL); break;
      case 'n': case 'N': S.snap = !S.snap; setToggle('#btnSnap', S.snap); break;
      case 't': case 'T': toggleTheme(); break;
      case 'c': case 'C': toggleCustom(); break;
      case 'v': case 'V': setView(VIEWS[(VIEWS.indexOf(UI.view) + 1) % VIEWS.length]); break;
      case 'p': case 'P': setUI('bay', !UI.bay); break;
      case '?': toggleHelp(); break;
      case '1': setSpeed(1); break;
      case '2': setSpeed(10); break;
      case '3': setSpeed(60); break;
      case '4': setSpeed(240); break;
      case 'Escape': if (!viewPop.hidden) setViewPop(false); else if (!tlShow.hidden) toggleTlShow(false); else if (!custom.hidden) toggleCustom(false); else if (!help.hidden) toggleHelp(false); else unpin(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });

  /* ------------------------------------------------------------------ *
   * Main loop — advances the clock, then redraws only what is dirty
   * ------------------------------------------------------------------ */
  // Skip idle: when the next event is more than ~1.2 s of real time away and
  // we've lingered ~0.6 s past the current one, jump to just before it.
  function applySkip(nt) {
    const a = ub(TS, nt) - 1;
    const nx = EV[a + 1];
    if (!nx) return nt;
    const cur = EV[a];
    const sp = Math.abs(S.rate);
    const curEnd = cur ? cur.t + (cur.dur || 0) : 0;
    if ((nx.t - nt) / sp > 1200 && (nt - curEnd) / sp > 600) return nx.t - 300 * sp;
    return nt;
  }
  let lastTs = 0;
  const frameHooks = []; // other views that follow the playhead (book.js) run once per frame
  function frame(ts) {
    const dt = lastTs ? Math.min(ts - lastTs, 100) : 0;
    lastTs = ts;
    if (S.shuttle) {
      const mag = Math.min(120, 10 + (ts - S.shuttle.start) * 0.045);   // 10× at first, 120× after ~2.5 s held
      const m = Math.round(mag / 10) * 10;
      if (m !== S.shuttle.mag) { S.shuttle.mag = m; S.rate = S.shuttle.dir * m; syncPlayUI(); }
    }
    if (S.coastV && !S.tapeDrag) {
      setTime(S.t + S.coastV * dt, { follow: true });
      S.coastV *= Math.exp(-dt / 325);
      if (Math.abs(S.coastV * tppm()) < 0.02 || S.t <= 0 || S.t >= DUR) S.coastV = 0;
    } else if (S.playing && !S.tapeDrag) {
      let nt = S.t + dt * S.rate;
      if (S.skip && S.rate > 0 && !S.shuttle) nt = applySkip(nt);
      const loop = S.loopOn && S.loopIn != null && S.loopOut != null && S.loopOut > S.loopIn;
      if (loop && S.rate > 0 && nt >= S.loopOut && S.t < S.loopOut + 1) nt = S.loopIn;
      else if (loop && S.rate < 0 && nt <= S.loopIn && S.t > S.loopIn - 1) nt = S.loopOut;
      // stop at whichever end we're heading for. (Only that end: pressing play at 0:00 on a frame whose time step is 0
      // gives nt = 0, which used to read as "rewound to the start" and stopped playback before it began.)
      if (nt >= DUR && S.rate > 0) { nt = DUR; S.playing = false; S.shuttle = null; syncPlayUI(); }
      else if (nt <= 0 && S.rate < 0) { nt = 0; S.playing = false; S.shuttle = null; syncPlayUI(); }
      if (nt !== S.t) setTime(nt, { play: true });
    }
    if (D.tl) { buildTL(); D.tl = false; D.comp = true; }
    if (D.ov) { buildOV(); D.ov = false; D.comp = true; }
    if (D.comp) { compTL(); compOV(); D.comp = false; }
    if (D.tape) { if (UI.tape) drawTape(); D.tape = false; }
    if (D.cost) { if (S.inspTab === 'scopes') drawCost(); D.cost = false; }
    if (S.typing) typeStep(ts);
    updToPlayhead();
    for (const h of frameHooks) h(ts);
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  readColors();
  viewChanged();
  setTapeZoom(S.tapeZoom);
  syncPlayUI();
  syncLoopUI();
  setTime(0);
  buildBin(); // the left panel is only the bin now, so build it up front
  applyUI();
  // back at the playhead we left, after the page reloaded to price the tape again (pricing, above)
  try {
    const r = JSON.parse(sessionStorage.getItem('vcr-ds-resume'));
    sessionStorage.removeItem('vcr-ds-resume');
    if (r && r.src === TAPE.source && r.t > 0) setTime(Math.min(DUR, r.t));
  } catch (e) {}
  updateMeters(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { D.tl = D.ov = D.tape = true; });
  requestAnimationFrame(frame);

  // A handle for debugging and automated checks, and for views built on top of the player (book.js):
  // they read the tape and the playhead from it, drive it through it, and get a call every frame.
  window.VCRDeckStudio = {
    S, UI, setUI, play, pause, seek, step, setSpeed, nudgeSpeed, speedControl, holdKey, zoomBy, zoomFit, togglePlay, setSkip,
    TAPE, EV, RS, DUR, LADDER, fmtClock, fmtDur, onFrame: (fn) => frameHooks.push(fn),
  };
})();
