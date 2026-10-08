/* The landing: the parts of the page that follow the demo tape in the hero (cartridge.js), through
   window.VCRCartridge: the eyebrow's status (paused, playing, FF, REW…) and Track 01's preview of the
   player's lanes and tape, which also seeks the hero tape when clicked. */
(function () {
  'use strict';
  const K = window.VCRCartridge;
  if (!K) return;
  const { S } = K;
  const $ = (id) => document.getElementById(id);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60); };
  const dur = () => (S.D ? S.D.DUR : K.DUR());

  /* ---------------- the eyebrow follows the tape ---------------- */
  const status = $('heroStatus'), stateEl = $('heroState');
  let lastState = '';
  function updStatus() {
    const st = S.shuttle < 0 ? 'rew' : S.shuttle > 0 ? 'ff' : S.dragging || S.coast ? 'scrub' : S.playing ? 'play' : S.played >= 1 ? 'end' : 'pause';
    const label = { rew: '◀◀ REWIND', ff: 'FAST FORWARD ▶▶', scrub: 'SCRUBBING', play: 'PLAYING ' + K.speed() + '×', end: 'END OF TAPE', pause: 'PAUSED' }[st];
    if (label === lastState) return;
    lastState = label; status.dataset.state = st; stateEl.textContent = label;
    const led = $('lanesLed'); if (led) led.classList.toggle('on', st !== 'pause' && st !== 'end');   // Track 02's note: lit while the tape moves
    const lp = $('lanesPlay'); if (lp) lp.hidden = st !== 'pause' && st !== 'end';                     // Track 02's CTA: only while it's stopped
  }


  /* ---------------- Track 01: what's on the tape ----------------
     Everything the session log holds, as cards with live counts and an example each, for the tape in the hero
     (js/shared/tape-report.js). Redrawn when another demo tape is loaded. */
  const inv = $('inventory');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = (s, n) => { s = String(s || '').split('\n')[0]; return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const base = (p) => String(p).split('/').pop();
  const dhm = (ms) => (ms >= 3600000 ? Math.floor(ms / 3600000) + 'h ' + pad(Math.round((ms % 3600000) / 60000)) + 'm' : ms >= 60000 ? Math.round(ms / 60000) + ' min' : Math.round(ms / 1000) + 's');
  const tokn = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));
  let invFor = null;
  let pagers = {};
  function pagerBody(k) {
    const P = pagers[k], x = P.items[P.i], n = P.items.length;
    return '<button class="inv-item" data-at="' + x.t + '" title="Go there on the tape"><span class="tc">' + fmt(x.t) + '</span>' + P.fmt(x) + '</button>' +
      (n > 1 ? '<div class="inv-pg-nav"><button data-pg="-1" aria-label="Previous">‹</button><span>' + (P.i + 1) + ' / ' + n + '</span><button data-pg="1" aria-label="Next">›</button></div>' : '');
  }
  inv && inv.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-pg]'), item = e.target.closest('.inv-item');
    if (nav) {
      const box = nav.closest('.inv-pg'), P = pagers[box.dataset.pgK]; if (!P) return;
      P.i = (P.i + +nav.dataset.pg + P.items.length) % P.items.length; box.innerHTML = pagerBody(box.dataset.pgK);
    } else if (item) K.seek(+item.dataset.at / dur());
  });
  function renderInventory() {
    if (!inv || !S.D || !S.D.tape || invFor === S.D || !window.analyzeTape) return;
    invFor = S.D;
    const R = window.analyzeTape(S.D.tape), T = R.tokens;
    $('invTitle').textContent = R.title;
    // K.studioHref(): the current tape's own studio link — a demo's ?demo=id, or (a custom tape) just the
    // studio's own URL, relying on sessionStorage the way a dropped tape (below) hands it over.
    const studio = K.studioHref();
    $('invLink').href = studio + (studio.includes('?') ? '&' : '?') + 'view=report';
    const list = (items) => items.length ? '<ul>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ul>' : '';
    const none = (what) => '<p class="inv-none">' + what + '</p>';
    const card = (col, label, num, unit, body) => '<article class="inv-card" style="--k:var(' + col + ')"><p class="inv-lbl">' + label + '</p><p class="inv-num"><b class="dot">' + num + '</b>' + (unit ? '<span>' + unit + '</span>' : '') + '</p>' + body + '</article>';
    // a card's items one at a time, in full (wrapped), with ‹ n / N › to step through them; an item is a jump to its
    // moment on the hero's tape (the clicks are handled once, below)
    pagers = {};
    const pager = (k, items, fmt) => {
      if (!items.length) return '';
      pagers[k] = { items, fmt, i: 0 };
      return '<div class="inv-pg" data-pg-k="' + k + '">' + pagerBody(k) + '</div>';
    };
    inv.innerHTML = [
      card('--c-text', 'Prompts &amp; replies', R.kinds.prompt, 'prompts · ' + R.kinds.text + ' replies', pager('prompts', R.prompts, (x) => '<span class="txt">' + esc(x.text) + '</span>')),
      card('--c-thinking', 'Thinking', R.kinds.thinking, 'times it stopped to reason', none('Shown where it happened, between the calls.')),
      card('--c-bash', 'Tool calls', R.kinds.tool, 'calls · ' + R.tools.length + ' tools', list(R.tools.slice(0, 4).map((t) => '<b>' + esc(t.name) + '</b> ×' + t.calls + (t.errors ? ' <em>' + t.errors + ' failed</em>' : '')))),
      card('--c-bash', 'Commands run', R.commands.count, 'shell commands', R.commands.programs.length ? '<p class="inv-chips">' + R.commands.programs.slice(0, 7).map(([p, c]) => '<span>' + esc(p) + ' ×' + c + '</span>').join('') + '</p>' : none('None.')),
      card('--c-write', 'Files touched', R.files.length, 'read, written or edited', list(R.files.slice(0, 3).map((f) => '<code>' + esc(base(f.path)) + '</code> ' + ['read', 'write', 'edit'].filter((k) => f[k]).map((k) => k + ' ×' + f[k]).join(', ')))),
      card('--c-read', 'URLs accessed', R.urls.length, 'URLs', R.urls.length ? list(R.urls.slice(0, 3).map((u) => '<code>' + esc(short(u.url, 44)) + '</code>')) : none('None in this tape.')),
      card('--c-skill', 'Skills', R.skills.reduce((a, s) => a + s[1], 0), 'skill calls', R.skills.length ? '<p class="inv-chips">' + R.skills.map(([n, c]) => '<span>' + esc(n) + ' ×' + c + '</span>').join('') + '</p>' : none('None in this tape.')),
      card('--c-other', 'MCP calls', R.mcp.reduce((a, m) => a + m.calls, 0), R.mcp.length + ' servers', R.mcp.length ? list(R.mcp.slice(0, 3).map((m) => '<b>' + esc(m.server) + '</b> ×' + m.calls)) : none('None in this tape. Every MCP server and tool it calls shows here.')),
      card('--err', 'Errors', R.errors.length, R.errors.length ? 'failed calls' : 'nothing failed', pager('errors', R.errors, (x) => '<b>' + esc(x.tool) + '</b> <code>' + esc(x.input) + '</code>' + (x.result ? '<em>' + esc(x.result) + '</em>' : ''))),
      card('--c-edit', 'Slowest calls', R.slow[0] ? dhm(R.slow[0].dur) : '—', 'the longest one', pager('slow', R.slow, (x) => '<b>' + esc(x.tool) + '</b> ' + dhm(x.dur) + ' <code>' + esc(x.input) + '</code>')),
      card('--c-cost', 'Tokens &amp; cost', '$' + T.cost.toFixed(2), tokn(T.input) + ' in · ' + tokn(T.out) + ' out', list(['cache hit <b>' + Math.round(T.cacheHit * 100) + '%</b>', 'peak context <b>' + tokn(T.peakContext) + '</b>', T.responses + ' responses from <b>' + esc(T.models.map((m) => m[0]).join(', ') || R.model) + '</b>'])),
      card('--ink-3', 'Time', dhm(R.duration), 'long', list([dhm(R.time.active) + ' working', dhm(R.time.idle) + ' idle' + (R.time.longestIdle.ms ? ', the longest stretch ' + dhm(R.time.longestIdle.ms) : '')])),
    ].join('');
    // each card's own lane: when in the session it happened, as a row of LEDs (bright where there was most of it),
    // the way the player's lanes show it; the card's colour is the lane's
    const EVS = S.D.tape.events || [], RSP = S.D.tape.responses || [], SPAN = Math.max(1, R.duration), NB = 40;
    const lane = (items, w) => {
      const b = new Float32Array(NB);
      items.forEach((x) => { b[Math.min(NB - 1, Math.max(0, Math.floor((x.t / SPAN) * NB)))] += w ? w(x) : 1; });
      const mx = Math.max(...b) || 1;
      return '<p class="inv-strip" aria-hidden="true">' + Array.from(b, (v) => '<i' + (v ? ' class="on" style="--o:' + (0.4 + 0.6 * v / mx).toFixed(2) + '"' : '') + '></i>').join('') + '</p>';
    };
    const ev = (f) => EVS.filter(f), tool = (re) => (e) => e.kind === 'tool' && re.test(e.tool || '');
    const lanes = [
      lane(ev((e) => e.kind === 'prompt' || e.kind === 'text')),
      lane(ev((e) => e.kind === 'thinking')),
      lane(ev((e) => e.kind === 'tool')),
      lane(ev(tool(/^Bash$/))),
      lane(ev(tool(/^(Read|Write|Edit|MultiEdit|NotebookEdit)$/))),
      lane(ev((e) => e.kind === 'tool' && /https?:\/\//.test(e.input || ''))),
      lane(ev(tool(/^Skill$/))),
      lane(ev(tool(/^mcp__/))),
      lane(ev((e) => e.err)),
      lane(R.slow.map((x) => EVS[x.i]).filter(Boolean), (e) => e.dur || 1),
      lane(RSP, (r) => r.cost || 0),
      lane(ev(() => true)),
    ];
    inv.querySelectorAll('.inv-card').forEach((c, k) => { if (lanes[k]) c.insertAdjacentHTML('beforeend', lanes[k]); });
  }
  K.onFrame(renderInventory);

  /* ---------------- Track 01: the player's lanes and its tape ----------------
     The player's timeline in miniature, in its dot style: every lane is three rows of LEDs, a clip lights the
     columns it covers (bright once played, dim ahead of the playhead), errors light red. A lane per kind of
     event (prompt, reply, thinking, each tool, skills, MCP calls, and every error on a lane of its own), a
     window of the session around the playhead, and under it the whole tape with that window marked. Click a
     lane's eye to hide it (it keeps its row, empty); click a lane or the tape to seek the tape in the hero. */
  const cv = $('lanesCv');
  const WIN = 5 * 60000;                        // the lanes show five minutes at a time
  const DOT_P = 6, DOT_D = 4, ROWS = 3;         // the player's LED grid: 6 px pitch, 4 px dots, 3 rows a lane
  const LANE_H = ROWS * DOT_P + 10;
  const RH = 24, TH = 54, GAP = 12;             // ruler, tape strip, the gap above the tape
  const DOT_OFF = '#1A1A1B', DOT_FONT = '900 12px Doto, "JetBrains Mono", ui-monospace, monospace';
  let W = 0, H = 0, dpr = 1, on = true, lanes = null, laneD = null, lastKey = '';
  const hidden = new Set();
  const C = {};
  function readColors() {
    ['--c-prompt', '--c-text', '--c-thinking', '--c-bash', '--c-read', '--c-write', '--c-edit', '--c-skill', '--c-other', '--err', '--orange',
      '--hw-bg', '--hw-bg-2', '--hw-panel', '--hw-panel-2', '--hw-line', '--hw-line-2', '--hw-fg', '--hw-fg-2', '--hw-fg-3', '--hw-fg-4'].forEach((v) => { C[v] = css(v); });
  }
  // The lanes: what the player tracks. Prompt, reply, thinking; the built-in tools; skills; MCP calls (mcp__ tools);
  // anything else; and errors, from any lane, gathered on one. Skill and MCP show even when a tape has none.
  const BUILTIN = ['Bash', 'Read', 'Write', 'Edit'];
  function buildLanes(D) {
    const ev = D.EV, isMcp = (e) => e.kind === 'tool' && /^mcp__/.test(e.tool);
    const other = (e) => e.kind === 'tool' && !BUILTIN.includes(e.tool) && e.tool !== 'Skill' && e.tool !== 'MultiEdit' && !isMcp(e);
    ev.forEach((e, i) => {   // how long each event holds its lane: a tool for its run, the rest until the next event (60 s at most)
      if (e.end == null) { const nx = ev[i + 1]; e.end = e.kind === 'tool' ? e.t + (e.dur || 0) : Math.max(e.t, Math.min(nx ? nx.t : D.DUR, e.t + 60000)); }
    });
    const L = [
      { key: 'prompt', name: 'PROMPT', col: '--c-prompt', test: (e) => e.kind === 'prompt' },
      { key: 'text', name: 'REPLY', col: '--c-text', test: (e) => e.kind === 'text' },
      { key: 'thinking', name: 'THINKING', col: '--c-thinking', test: (e) => e.kind === 'thinking', dim: 0.65 },
      { key: 'Bash', name: 'BASH', col: '--c-bash', test: (e) => e.tool === 'Bash' },
      { key: 'Read', name: 'READ', col: '--c-read', test: (e) => e.tool === 'Read' },
      { key: 'Write', name: 'WRITE', col: '--c-write', test: (e) => e.tool === 'Write' },
      { key: 'Edit', name: 'EDIT', col: '--c-edit', test: (e) => e.tool === 'Edit' || e.tool === 'MultiEdit' },
      { key: 'Skill', name: 'SKILL', col: '--c-skill', test: (e) => e.tool === 'Skill' },
      { key: 'mcp', name: 'MCP', col: '--c-other', test: isMcp },
      { key: 'other', name: 'OTHER', col: '--hw-fg-3', test: other, onlyIfAny: true },
      { key: 'err', name: 'ERRORS', col: '--err', test: (e) => !!e.err },
    ];
    L.forEach((l) => { l.evs = ev.filter(l.test); l.n = l.evs.length; });
    return L.filter((l) => !(l.onlyIfAny && !l.n));
  }
  const HW = () => (W < 560 ? 94 : 128);   // the header column
  function layout() {                      // lane tops: a hidden lane keeps its row, so nothing jumps
    let y = RH; const tops = [];
    for (const l of lanes || []) { tops.push(y); y += LANE_H; }
    return { tops, bottom: y };
  }
  // the show / hide toggle: an eye centred on (x, y), the same shape either way; hidden, a slash crosses it
  function eye(g, x, y, col, slashed) {
    g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 6.5, y); g.quadraticCurveTo(x, y - 7, x + 6.5, y); g.quadraticCurveTo(x, y + 7, x - 6.5, y); g.stroke();
    g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
    if (slashed) {
      g.strokeStyle = C['--hw-bg-2']; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x - 6, y + 6); g.lineTo(x + 6, y - 6); g.stroke();   // cut a gap so the slash reads
      g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x - 6, y + 6); g.lineTo(x + 6, y - 6); g.stroke();
    }
    g.restore();
  }
  // the note above the lanes: which tape this is, so it reads as real data, not a mock-up
  function noteLanes(D) {
    const T = D.tape || {}, title = $('lanesTitle'), meta = $('lanesMeta'), link = $('lanesLink');
    if (title) title.textContent = T.title || T.source || 'Untitled session';
    if (meta) meta.textContent = '· ' + D.EV.length + ' events · ' + fmt(D.DUR);
    if (link) link.href = K.studioHref();
  }
  function size() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width;
    H = (lanes ? layout().bottom : RH + 10 * LANE_H) + GAP + TH;
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    lastKey = '';
  }
  const view = () => { const d = dur(), win = Math.min(WIN, d); return { win, t0: Math.max(0, Math.min(d - win, S.played * d - win * 0.3)) }; };
  function draw() {
    const D = S.D, t = S.played * dur();
    if (D && laneD !== D) { lanes = buildLanes(D); laneD = D; size(); noteLanes(D); }
    const key = W + ':' + H + ':' + Math.round(t / 250) + ':' + (D ? D.N : 0) + ':' + [...hidden].join() + ':' + document.documentElement.dataset.theme;
    if (key === lastKey || !W) return;
    lastKey = key;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C['--hw-bg']; g.fillRect(0, 0, W, H);
    const hw = HW(), x0 = hw + 8, lw = W - x0 - 10, d = dur();
    g.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
    if (!D) { g.fillStyle = C['--hw-fg-3']; g.fillText(location.protocol === 'file:' ? 'NO SIGNAL · SERVE OVER HTTP TO READ THE TAPE' : 'READING THE TAPE…', x0 + 14, H / 2); return; }
    const { win, t0 } = view(), X = (tt) => x0 + ((tt - t0) / win) * lw, { tops, bottom } = layout();
    const bw = (DOT_P / lw) * win, k0 = Math.floor(t0 / bw), k1 = Math.ceil((t0 + win) / bw), n = k1 - k0 + 1, kNow = Math.floor(t / bw);
    // header column: the lane's colour (a filled square, hollow when hidden), the name, the count, and on the right
    // a grey eye to show / hide it (slashed when hidden)
    const narrow = W < 560, sqX = narrow ? 6 : 10, nameX = narrow ? 18 : 25, eyeX = hw - (narrow ? 10 : 14);
    g.fillStyle = C['--hw-bg-2']; g.fillRect(0, 0, hw, H);
    lanes.forEach((l, i) => {
      const y = tops[i], off = hidden.has(l.key), cy = y + LANE_H / 2;
      g.fillStyle = C['--hw-line']; g.fillRect(0, Math.round(y + LANE_H) - 0.5, W, 1);
      if (off) { g.strokeStyle = C[l.col]; g.lineWidth = 1; g.strokeRect(sqX + 0.5, cy - 3.5, 7, 7); } else { g.fillStyle = C[l.col]; g.fillRect(sqX, cy - 4, 8, 8); }
      g.font = (off ? '500 ' : '700 ') + '9.5px "JetBrains Mono", ui-monospace, monospace';
      g.fillStyle = off ? C['--hw-fg-4'] : C['--hw-fg-2']; g.fillText(l.name, nameX, cy + 0.5);
      if (!narrow) { g.fillStyle = l.n ? C['--hw-fg-4'] : '#3a3836'; g.textAlign = 'right'; g.fillText(String(l.n), eyeX - 13, cy + 0.5); g.textAlign = 'left'; }
      eye(g, eyeX, cy, off ? C['--hw-fg-4'] : C['--hw-fg-3'], off);
    });
    g.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
    // ruler: a tick every 15 s, a label every minute
    g.fillStyle = C['--hw-line-2'];
    for (let tt = Math.ceil(t0 / 15000) * 15000; tt <= t0 + win; tt += 15000) {
      const x = Math.round(X(tt)) + 0.5, maj = tt % 60000 === 0;
      g.fillRect(x, maj ? 6 : 14, 1, maj ? RH - 6 : RH - 14);
      if (maj) { g.fillStyle = C['--hw-fg-3']; g.fillText(fmt(tt), x + 4, 10); g.fillStyle = C['--hw-line-2']; }
    }
    // the lanes, as rows of LEDs
    g.save(); g.beginPath(); g.rect(x0, RH, lw + 4, bottom - RH); g.clip();
    const cell = new Uint8Array(n), labels = [];
    lanes.forEach((l, i) => {
      if (hidden.has(l.key)) return;
      const top = tops[i] + Math.round((LANE_H - ROWS * DOT_P) / 2) + 1, errLane = l.key === 'err';
      cell.fill(0);
      for (const e of l.evs) {
        const end = errLane ? e.t : e.end; if (end < k0 * bw || e.t > (k1 + 1) * bw) continue;
        const a = Math.floor(e.t / bw), b = Math.max(a, Math.ceil(end / bw) - 1), v = e.err ? 2 : 1;
        for (let k = Math.max(a, k0); k <= Math.min(b, k1); k++) if (v > cell[k - k0]) cell[k - k0] = v;
        if (!errLane && (b - a + 1) * DOT_P >= 54 && (e.kind === 'tool' || e.kind === 'prompt')) labels.push({ e, a, b, top, col: e.err ? C['--err'] : C[l.col] });
      }
      const pOff = new Path2D(), pPast = new Path2D(), pFut = new Path2D(), pErrP = new Path2D(), pErrF = new Path2D();
      for (let j = 0; j < n; j++) {
        const k = k0 + j, x = Math.round(x0 + ((k * bw - t0) / win) * lw); if (x < x0 - DOT_P || x > x0 + lw) continue;
        const past = k <= kNow, pth = cell[j] === 0 ? pOff : cell[j] === 2 ? (past ? pErrP : pErrF) : (past ? pPast : pFut);
        for (let r = 0; r < ROWS; r++) pth.rect(x, top + r * DOT_P, DOT_D, DOT_D);
      }
      g.fillStyle = DOT_OFF; g.fill(pOff);
      const base = l.dim || 1;
      g.fillStyle = C[l.col]; g.globalAlpha = base; g.fill(pPast); g.globalAlpha = base * 0.28; g.fill(pFut);
      g.fillStyle = C['--err']; g.globalAlpha = 1; g.fill(pErrP); g.globalAlpha = 0.35; g.fill(pErrF);
      g.globalAlpha = 1;
    });
    // wide clips carry their label in dot type on a cut-out, like a sign (as in the player)
    g.font = DOT_FONT; g.textBaseline = 'middle';
    for (const L of labels) {
      const xa = Math.round(x0 + ((L.a * bw - t0) / win) * lw) + DOT_P, xb = Math.round(x0 + ((L.b * bw - t0) / win) * lw) + DOT_D;
      const text = L.e.kind === 'prompt' ? 'YOU' : (L.e.err ? '◆ ' : '') + String(L.e.input || L.e.tool).replace(/\s+/g, ' ');
      const tw = Math.min(xb - xa - DOT_P, g.measureText(text).width + 8), hgt = ROWS * DOT_P - 2;
      if (tw < 24) continue;
      g.fillStyle = C['--hw-bg']; g.fillRect(xa - 2, L.top - 1, tw, hgt + 2);
      g.save(); g.beginPath(); g.rect(xa - 2, L.top - 1, tw, hgt + 2); g.clip();
      g.fillStyle = L.col; g.globalAlpha = L.a <= kNow ? 1 : 0.4; g.fillText(text, xa + 2, L.top + hgt / 2 + 1);
      g.restore();
    }
    g.restore();
    // the playhead
    const px = X(t);
    g.fillStyle = C['--orange']; g.fillRect(Math.round(px) - 1, 2, 2, bottom - 2);
    g.beginPath(); g.moveTo(px - 6, 0); g.lineTo(px + 6, 0); g.lineTo(px, 8); g.closePath(); g.fill();

    // the tape: the whole session, sprockets top and bottom, the lanes' window marked, played part brighter
    const ty = H - TH, TX = (tt) => x0 + (tt / d) * lw;
    g.font = '700 9.5px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = '#121212'; g.fillRect(x0, ty, lw, TH);
    g.fillStyle = '#262626';
    const SP = 14, ph = ((t * lw / d) % SP + SP) % SP;
    for (let x = x0 - ph; x < x0 + lw; x += SP) { if (x < x0) continue; g.fillRect(x, ty + 3, 6, 4); g.fillRect(x, ty + TH - 7, 6, 4); }
    const laneOfEv = (e) => lanes.find((l) => l.key !== 'err' && !hidden.has(l.key) && l.test(e));
    for (const e of D.EV) {
      const l = e.err ? null : laneOfEv(e); if (!e.err && !l) continue;
      g.fillStyle = e.err ? C['--err'] : C[l.col]; g.globalAlpha = e.t <= t ? 0.95 : 0.35;
      const hh = e.kind === 'prompt' ? TH - 18 : e.kind === 'tool' ? (TH - 18) * 0.7 : (TH - 18) * 0.4;
      g.fillRect(Math.floor(TX(e.t)), ty + TH - 9 - hh, e.kind === 'prompt' || e.err ? 2 : 1, hh);
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.strokeRect(Math.round(TX(t0)) + 0.5, ty + 1.5, Math.max(6, Math.round(TX(t0 + win) - TX(t0))), TH - 3);
    g.fillStyle = C['--orange']; g.fillRect(Math.round(TX(t)) - 1, ty, 2, TH);
    g.fillStyle = C['--hw-bg-2']; g.fillRect(0, ty, hw, TH);
    g.fillStyle = C['--hw-fg-2']; g.fillText('TAPE', 25, ty + TH / 2 - 7);
    g.fillStyle = C['--hw-fg-4']; g.fillText(fmt(t) + (W >= 560 ? ' / ' + fmt(d) : ''), 25, ty + TH / 2 + 8);
    cv.setAttribute('aria-valuenow', Math.round(S.played * 100)); cv.setAttribute('aria-valuetext', fmt(t));
  }
  // a lane's name hides or shows it; a lane or the tape seeks (drag along the tape to scrub)
  let drag = null;
  function laneAt(y) { if (!lanes) return -1; const { tops } = layout(); for (let i = lanes.length - 1; i >= 0; i--) if (y >= tops[i]) return y < tops[i] + LANE_H ? i : -1; return -1; }
  function seekAt(ev) {
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, x0 = HW() + 8, lw = W - x0 - 10;
    const f = Math.max(0, Math.min(1, (x - x0) / lw)), d = dur();
    if (drag === 'tape' || (drag == null && y >= H - TH)) { drag = 'tape'; K.seek(f); }
    else { drag = 'lanes'; const { win, t0 } = view(); K.seek((t0 + f * win) / d); }
  }
  cv.addEventListener('pointerdown', (ev) => {
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (x < HW() && y < H - TH) { const i = laneAt(y); if (i >= 0) { const k = lanes[i].key; hidden.has(k) ? hidden.delete(k) : hidden.add(k); size(); } return; }
    drag = null; cv.setPointerCapture(ev.pointerId); seekAt(ev);
  });
  // hover a clip: a small preview of it (what kind, when, how long, the start of what it said or ran, and an error's
  // first line). Found by the lane under the pointer and the time under it, give or take a column of dots.
  const tip = $('lanesTip');
  const durTxt = (ms) => (ms < 1000 ? Math.round(ms) + 'ms' : ms < 60000 ? (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + 's' : Math.floor(ms / 60000) + 'm ' + pad(Math.round((ms % 60000) / 1000)) + 's');
  const firstLines = (str, n) => String(str || '').trim().split('\n').slice(0, n).join('\n').slice(0, 280);
  function clipAt(x, y) {
    const i = laneAt(y); if (i < 0 || hidden.has(lanes[i].key)) return null;
    const x0 = HW() + 8, lw = W - x0 - 10; if (x < x0 || x > x0 + lw) return null;
    const { win, t0 } = view(), t = t0 + ((x - x0) / lw) * win, slack = (DOT_P / lw) * win * 1.5, l = lanes[i];
    let best = null, gap = Infinity;
    for (const e of l.evs) {
      const a = e.t, b = l.key === 'err' ? e.t : Math.max(e.end, e.t);
      const d = t < a ? a - t : t > b ? t - b : 0;
      if (d <= slack && d < gap) { gap = d; best = e; }
    }
    return best && { e: best, l };
  }
  function showTip(hit, x, y) {
    if (!hit) { tip.hidden = true; return; }
    const { e, l } = hit, tool = e.kind === 'tool';
    const name = e.kind === 'prompt' ? 'You' : e.kind === 'text' ? 'Reply' : e.kind === 'thinking' ? 'Thinking' : e.tool;
    tip.style.setProperty('--k', C[e.err ? '--err' : l.key === 'err' ? '--err' : l.col] || C['--hw-fg-3']);
    tip.innerHTML = '<div class="h">' + esc(name) + '<span>' + fmt(e.t) + (tool && e.dur ? ' · ' + durTxt(e.dur) : '') + '</span></div>' +
      '<div class="b' + (tool ? ' mono' : e.kind === 'thinking' ? ' think' : '') + '">' + esc(firstLines(tool ? e.input : e.text, 4) || (e.kind === 'thinking' ? 'Reasoning (not in the log)' : '…')) + '</div>' +
      (e.err ? '<div class="e">◆ ' + esc(firstLines(e.result, 1) || 'failed') + '</div>' : '');
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(W - tw - 8, x + 14)) + 'px';
    tip.style.top = (y + 16 + th > H - 8 ? y - th - 12 : y + 16) + 'px';
  }
  cv.addEventListener('pointermove', (ev) => {
    if (drag) { tip.hidden = true; seekAt(ev); return; }
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, i = x < HW() && y < H - TH ? laneAt(y) : -1;
    cv.style.cursor = i >= 0 ? 'pointer' : x < HW() ? 'default' : 'crosshair';
    cv.title = i >= 0 ? (hidden.has(lanes[i].key) ? 'Show ' : 'Hide ') + lanes[i].name.toLowerCase() : '';
    showTip(ev.pointerType !== 'touch' && lanes && x >= HW() && y < H - TH ? clipAt(x, y) : null, x, y);
  });
  cv.addEventListener('pointerleave', () => { tip.hidden = true; });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault(); K.seek(S.played + (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 60000 : 5000) / dur());
  });

  // Track 02's CTA presses the hero's play key (wherever it is: it follows into the bottom bar), from the start if it ended
  $('lanesPlay').addEventListener('click', () => { if (S.played >= 1) K.seek(0); const p = $('playBtn'); if (p) p.click(); });
  readColors(); size();
  new ResizeObserver(size).observe(cv);
  new MutationObserver(() => { readColors(); lastKey = ''; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { on = en.isIntersecting; }).observe(cv);
  K.onFrame(() => { updStatus(); if (on) draw(); });
})();
