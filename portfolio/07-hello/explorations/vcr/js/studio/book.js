/* VCR Deck Studio · Book layout
   alt/2's reading layout, in the Deck Studio's own look: the session told as a document that inks in as
   the tape plays. Contents on the left (a chapter per prompt, a section per reply), the reading column in
   the middle (prompts, replies, thinking, runs of tool calls), a margin of running stats on the right, a
   minimap down the edge to scrub, and a floating transport. It is a view on the player, not a second one:
   it reads the tape and the playhead from window.VCRDeckStudio and drives the player through it.
   B (or the STUDIO / BOOK switch in the top bar) flips layouts; the choice is remembered. */
(function () {
  'use strict';
  const P = window.VCRDeckStudio;
  if (!P) return;
  const { S, EV, RS, DUR, TAPE, fmtClock, fmtDur } = P;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const app = $('app'), book = $('book');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAPSE_MS = 90000; // a gap this long between events gets a "12 min pass" marker
  const CVAR = { prompt: '--c-prompt', text: '--c-text', thinking: '--c-thinking', Bash: '--c-bash', Read: '--c-read', Write: '--c-write', Edit: '--c-edit', MultiEdit: '--c-edit', Skill: '--c-skill' };
  const kcol = (e) => (e.err ? '--err' : CVAR[e.kind === 'tool' ? e.tool : e.kind] || '--c-other');
  const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmtCost = (c) => '$' + (c < 100 ? c.toFixed(2) : c.toFixed(0));
  const fmtTok = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(Math.round(n)));
  const pad2 = (n) => String(n).padStart(2, '0');
  function lastLE(arr, t) { let lo = 0, hi = arr.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].t <= t) { a = m; lo = m + 1; } else hi = m - 1; } return a; }
  // light markdown: paragraphs, `code`, **bold**; everything else as text
  function prose(s) {
    return String(s || '').trim().split(/\n{2,}/).map((p) => esc(p).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')).join('</span><span class="para">');
  }
  function firstSentence(s, max) {
    const t = String(s || '').replace(/[`*#>]/g, '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(.{12,}?[.!?])(\s|$)/);
    const f = m ? m[1] : t;
    return f.length > max ? f.slice(0, max - 1).trimEnd() + '…' : f;
  }
  const toolSummary = (e) => String((e.info && e.info.label) || e.input || '').replace(/\s+/g, ' ').slice(0, 90);

  // a folded row of the margin: its name, its count, and the list under it
  function acc(id, label, nId) { return '<details class="bk-acc" data-acc="' + id + '"><summary><span>' + label + '</span><b id="' + nId + '">0</b></summary><div id="' + id + '"></div></details>'; }

  // ---------------------------------------------------------------- precompute: money, tokens, chapters
  const cum = { cost: [], out: [], inp: [], cr: [], cw: [] };
  RS.reduce((a, r) => { a.c += r.cost || 0; a.o += r.out || 0; a.i += r.in || 0; a.r += r.cr || 0; a.w += r.cw || 0; cum.cost.push(a.c); cum.out.push(a.o); cum.inp.push(a.i); cum.cr.push(a.r); cum.cw.push(a.w); return a; }, { c: 0, o: 0, i: 0, r: 0, w: 0 });
  const NR = RS.length, TOTAL_COST = NR ? cum.cost[NR - 1] : 0, TOTAL_OUT = NR ? cum.out[NR - 1] : 0;
  const TOTAL_IN = NR ? cum.inp[NR - 1] + cum.cr[NR - 1] + cum.cw[NR - 1] : 0;
  const costBefore = (t) => { let k = -1, lo = 0, hi = NR - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (RS[m].t < t) { k = m; lo = m + 1; } else hi = m - 1; } return k < 0 ? 0 : cum.cost[k]; };
  const TOOLS = [], toolCum = {};
  EV.forEach((e) => { if (e.kind === 'tool' && !TOOLS.includes(e.tool)) TOOLS.push(e.tool); });
  TOOLS.forEach((tn) => { toolCum[tn] = new Int32Array(EV.length); });
  { const cnt = {}; EV.forEach((e, i) => { if (e.kind === 'tool') cnt[e.tool] = (cnt[e.tool] || 0) + 1; TOOLS.forEach((tn) => { toolCum[tn][i] = cnt[tn] || 0; }); }); }
  const TOOL_TOTAL = {}; TOOLS.forEach((tn) => { TOOL_TOTAL[tn] = EV.length ? toolCum[tn][EV.length - 1] : 0; });
  TOOLS.sort((a, b) => TOOL_TOTAL[b] - TOOL_TOTAL[a]);
  const ERRS = EV.map((e, i) => (e.err ? i : -1)).filter((i) => i >= 0);

  // a chapter per prompt, a section per reply ("beat") inside it
  const chapters = [], sections = [], secOf = new Int32Array(EV.length), chOf = new Int32Array(EV.length);
  {
    let ch = null, sec = null;
    EV.forEach((e, i) => {
      if (e.kind === 'prompt' || !ch) {
        ch = { i0: i, t0: e.t, secs: [], title: e.kind === 'prompt' ? firstSentence(e.text, 80) : 'Session' };
        chapters.push(ch); sec = null;
        if (e.kind === 'prompt') { chOf[i] = chapters.length - 1; secOf[i] = -1; return; }
      }
      if (!sec || (e.kind === 'text' && sec.hasText)) { sec = { i0: i, t0: e.t, ch: chapters.length - 1, hasText: false, title: '', err: false }; sections.push(sec); ch.secs.push(sections.length - 1); }
      if (e.kind === 'text' && !sec.hasText) { sec.hasText = true; sec.title = firstSentence(e.text, 72); }
      if (e.kind === 'tool' && !sec.title0) sec.title0 = e.tool + ': ' + toolSummary(e);
      if (e.err) sec.err = true;
      chOf[i] = chapters.length - 1; secOf[i] = sections.length - 1;
    });
    chapters.forEach((c, k) => { c.t1 = k + 1 < chapters.length ? chapters[k + 1].t0 : DUR; c.cost = costBefore(k + 1 < chapters.length ? c.t1 : Infinity) - costBefore(c.t0); });
    sections.forEach((s, k) => {
      const nx = sections[k + 1];
      s.t1 = nx && nx.ch === s.ch ? nx.t0 : chapters[s.ch].t1;
      s.cost = costBefore(!nx && s.ch === chapters.length - 1 ? Infinity : s.t1) - costBefore(s.t0);
      if (!s.title) s.title = s.title0 || 'Working';
    });
    EV.forEach((e, j) => { if (secOf[j] === -1) { const cs = chapters[chOf[j]].secs; secOf[j] = cs.length ? cs[0] : 0; } });
  }

  // ---------------------------------------------------------------- skeleton
  book.innerHTML =
    '<nav class="bk-outline panel" aria-label="Contents"><div class="bk-ol" id="bkOl"></div></nav>' +
    '<div class="bk-center">' +
      '<div class="bk-scroll" id="bkScroll"><div class="bk-col"><header class="bk-mast" id="bkMast"></header><article class="bk-doc" id="bkDoc"></article><footer class="bk-end" id="bkEnd"></footer></div></div>' +
      '<button class="bk-return" id="bkReturn" hidden><span>Return to the playhead</span><b class="dot" id="bkReturnT">00:00</b></button>' +
      '<div class="bk-pill" id="bkPill" role="toolbar" aria-label="Playback">' +
        // the studio's keys: start, ◀◀ (tap: previous event, hold: rewind), play, ▶▶ (tap: next event, hold: fast-forward), end
        '<button class="mini-key" id="bkStart" aria-label="Go to start" title="Go to start (Home)"><svg viewBox="0 0 24 24"><path d="M5 5h2.5v14H5zM19 5.5v13L9 12z"/></svg></button>' +
        '<button class="mini-key" id="bkPrev" aria-label="Previous event, hold to rewind" title="Previous event · hold to rewind (←)"><svg viewBox="0 0 24 24"><path d="M11 6 3 12l8 6V6zm10 0-8 6 8 6V6z"/></svg></button>' +
        '<button class="mini-key bk-play" id="bkPlay" aria-label="Play" title="Play / pause (Space)"><svg class="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/></svg></button>' +
        '<button class="mini-key" id="bkNext" aria-label="Next event, hold to fast-forward" title="Next event · hold to fast-forward (→)"><svg viewBox="0 0 24 24"><path d="M13 6l8 6-8 6V6zM3 6l8 6-8 6V6z"/></svg></button>' +
        '<button class="mini-key" id="bkEnd" aria-label="Go to end" title="Go to end (End)"><svg viewBox="0 0 24 24"><path d="M16.5 5H19v14h-2.5zM5 5.5v13L15 12z"/></svg></button>' +
        '<span class="bk-time dot"><span id="bkNow">00:00</span><small>/' + fmtClock(DUR) + '</small></span>' +
        // speed: the studio's own control (− [10× ▾] + | SKIP IDLE), mounted below
        '<span id="bkSpeedMount"></span>' +
      '</div>' +
    '</div>' +
    '<aside class="bk-margin panel" aria-label="Session statistics" id="bkMargin">' +
      // the meter: money and tokens, on the deck's dark hardware
      '<section class="bk-meter">' +
        // one chart, three views: what it cost so far, the context window in use, the output of each response
        '<div class="bk-tabs" role="tablist" aria-label="Chart" id="bkTabs">' +
          '<button role="tab" data-tab="cost">Spend</button><button role="tab" data-tab="ctx">Context</button><button role="tab" data-tab="out">Output</button>' +
        '</div>' +
        '<div class="bk-lbl"><span id="bkMLbl">Spent</span><small id="bkMSub"></small></div>' +
        '<div class="bk-big dot" id="bkBig">$0.00</div>' +
        '<div class="bk-chart"><canvas class="bk-spark" id="spMain" aria-hidden="true"></canvas></div>' +
        '<div class="bk-gauges">' +
          '<div><span>Tokens in</span><b class="dot" id="bkIn">0</b></div><div><span>Tokens out</span><b class="dot" id="bkOut">0</b></div>' +
          '<div><span>Context</span><b class="dot" id="bkCtx">0</b></div><div><span>Cache hit</span><b class="dot" id="bkCache">0%</b></div>' +
        '</div>' +
        '<div class="bk-split" id="bkSplit"></div>' +
      '</section>' +
      // what happened so far, as counts; then the tools
      '<section><div class="bk-lbl">So far</div><div class="bk-stats" id="bkTalk"></div></section>' +
      '<section><div class="bk-lbl">Tools</div><div class="bk-tally" id="bkTally"></div></section>' +
      // the rest of what the report measures (js/shared/tape-report.js), folded: a row each with its count
      '<section class="bk-accs">' +
        acc('bkErrList', 'Errors', 'nErr') + acc('bkCmds', 'Commands', 'nCmd') + acc('bkFiles', 'Files', 'nFiles') +
        acc('bkExt', 'Skills &amp; MCP', 'nExt') + acc('bkWeb', 'Web', 'nWeb') + acc('bkSlow', 'Slowest call', 'nSlow') +
      '</section>' +
      '<section class="bk-facts">' +
        '<div><span>Model</span><b>' + esc(TAPE.model || '—') + '</b></div><div><span>Source</span><b title="' + esc(TAPE.source) + '">' + esc(TAPE.source || '—') + '</b></div>' +
        '<div><span>Started</span><b>' + esc(TAPE.start ? new Date(TAPE.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—') + '</b></div>' +
        '<div><span>Length</span><b>' + fmtClock(DUR) + '</b></div>' +
        '<div><span>Active so far</span><b id="bkActive">—</b></div><div><span>Idle so far</span><b id="bkIdle">—</b></div>' +
        '<div><span>Responses</span><b>' + NR + '</b></div><div><span>Events</span><b>' + EV.length + '</b></div>' +
      '</section>' +
    '</aside>' +
    '<div class="bk-mm" id="bkMm" role="slider" tabindex="0" aria-label="Session map: drag to seek" aria-valuemin="0" aria-valuemax="100"><canvas id="mmBase"></canvas><canvas id="mmOver"></canvas><div class="bk-mmtip" id="mmTip" hidden></div></div>';
  const scroller = $('bkScroll');

  // ---------------------------------------------------------------- masthead
  {
    const st = new Date(TAPE.start), nTools = EV.filter((e) => e.kind === 'tool').length;
    const date = isNaN(st) ? '' : st.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' · ' + st.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    $('bkMast').innerHTML =
      '<p class="bk-kicker"><span class="rec"></span>A session, replayed</p>' +
      '<h1>' + esc(TAPE.title || TAPE.source || 'Untitled session') + '</h1>' +
      '<p class="bk-dek">A <b>' + fmtDur(DUR) + '</b> working session with <b>' + esc(TAPE.model || 'an agent') + '</b>: ' + chapters.length + ' prompt' + (chapters.length === 1 ? '' : 's') + ', ' +
        sections.length + ' beats, ' + nTools + ' tool calls and <b>' + fmtCost(TOTAL_COST) + '</b> of tokens, in the order it happened.</p>' +
      '<p class="bk-by"><span>' + esc(date) + '</span><code>' + esc(TAPE.source || '') + '</code><code>' + esc(String(TAPE.cwd || '').replace(/^\/Users\/[^/]+/, '~')) + '</code></p>' +
      '<p class="bk-hint">Unread passages are ghosted; they ink in as the tape reaches them. <kbd>Space</kbd> plays, <kbd>←</kbd><kbd>→</kbd> step, <kbd>B</kbd> goes back to the studio.</p>';
    $('bkEnd').innerHTML = '<span class="dot">END OF TAPE</span> · ' + fmtDur(DUR) + ' · ' + fmtCost(TOTAL_COST);
  }

  // ---------------------------------------------------------------- the document
  const THINK = '<svg viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="9.5" cy="6.3" rx="5" ry="3.8"/><circle cx="4.5" cy="11.6" r="1.3"/><circle cx="2.3" cy="14.1" r=".85" class="f"/></svg>';
  const evEl = new Array(EV.length), blockEl = new Array(EV.length), runFirst = {};
  {
    const frag = document.createDocumentFragment();
    let chEl = null, run = null, chips = null;
    EV.forEach((e, i) => {
      const prev = EV[i - 1], c = chOf[i];
      if (!chEl || (e.kind === 'prompt' && chapters[c].i0 === i)) {
        const C = chapters[c];
        chEl = document.createElement('section'); chEl.className = 'bk-ch'; chEl.id = 'bk-ch-' + c;
        chEl.innerHTML = '<div class="bk-chhead"><span class="num dot">' + pad2(c + 1) + '</span><span class="lbl">Chapter</span><span class="meta">' + fmtClock(C.t0) + ' · ' + fmtDur(C.t1 - C.t0) + ' · ' + fmtCost(C.cost) + '</span></div>';
        frag.appendChild(chEl); run = null;
      }
      if (prev && e.kind !== 'prompt' && e.t - prev.t > LAPSE_MS) { const l = document.createElement('div'); l.className = 'bk-lapse'; l.textContent = fmtDur(e.t - prev.t) + ' pass'; chEl.appendChild(l); run = null; }
      const stamp = '<button class="bk-stamp" data-seek="' + i + '" tabindex="-1" title="Seek here">' + fmtClock(e.t) + '</button>';
      let node;
      if (e.kind === 'prompt') {
        node = document.createElement('blockquote'); node.className = 'bk-ev bk-prompt';
        node.innerHTML = stamp + '<span class="who">You asked</span><div class="body"><span class="para">' + prose(e.text) + '</span></div>' +
          (String(e.text || '').length > 280 ? '<button class="bk-more" data-more="' + i + '">Read the full prompt</button>' : '');
      } else if (e.kind === 'text') {
        node = document.createElement('div'); node.className = 'bk-ev bk-reply';
        node.innerHTML = stamp + '<div class="body"><span class="para">' + prose(e.text) + '</span></div>';
      } else if (e.kind === 'thinking') {
        const since = prev ? Math.max(0, e.t - (prev.t + (prev.dur || 0))) : e.t, has = !!String(e.text || '').trim();
        node = document.createElement('aside'); node.className = 'bk-ev bk-think';
        node.innerHTML = stamp + '<button class="t-btn" data-think="' + i + '">' + THINK + '<span>' + (since > 1500 ? 'Thought for ' + fmtDur(since) : 'A brief thought') + '</span><em>' + (has ? 'expand' : 'reasoning not logged') + '</em></button>' +
          '<div class="t-body">' + (has ? '<span class="para">' + prose(e.text) + '</span>' : '<em>The log records that the model reasoned here, but not what it thought.</em>') + '</div>';
      }
      if (node) { chEl.appendChild(node); run = null; blockEl[i] = node; }
      else {
        // tool calls in a row form a run of chips; click one for its input and result
        if (!run) { run = document.createElement('div'); run.className = 'bk-run'; run.innerHTML = stamp; chips = document.createElement('div'); chips.className = 'bk-chips'; run.appendChild(chips); chEl.appendChild(run); runFirst[i] = run; }
        node = document.createElement('button'); node.className = 'bk-ev bk-chip' + (e.err ? ' err' : '');
        node.style.setProperty('--k', 'var(' + kcol(e) + ')');
        node.innerHTML = '<i></i><span class="tn">' + esc(e.tool) + '</span><span class="ts">' + esc(toolSummary(e)) + '</span>' + (e.dur != null ? '<span class="td">' + fmtDur(e.dur) + '</span>' : '');
        node.dataset.chip = i; node.title = e.tool + (e.err ? ' (error)' : '') + ': click to see the call';
        chips.appendChild(node); blockEl[i] = run;
      }
      node.dataset.i = i; node.classList.add('fut'); evEl[i] = node;
    });
    $('bkDoc').appendChild(frag);
    for (const k in runFirst) runFirst[k].classList.add('fut-run');
  }

  // ---------------------------------------------------------------- contents
  const secBtn = [], secBar = [];
  {
    let h = '<div class="bk-oltitle"><span>Contents</span><span class="dot">' + fmtClock(DUR) + '</span></div>';
    chapters.forEach((C, c) => {
      h += '<div class="bk-olch"><button class="bk-olchbtn" data-ch="' + c + '"><span class="num dot">' + pad2(c + 1) + '</span><span class="ttl">' + esc(C.title) + '</span><span class="meta">' + fmtDur(C.t1 - C.t0) + ' · ' + fmtCost(C.cost) + '</span></button><ol>';
      C.secs.forEach((s) => { const Sx = sections[s]; h += '<li><button class="bk-olsec' + (Sx.err ? ' err' : '') + '" data-sec="' + s + '" title="' + esc(Sx.title) + '"><span class="ttl">' + esc(Sx.title) + '</span><span class="meta">' + fmtDur(Sx.t1 - Sx.t0) + '</span><i class="bar"></i></button></li>'; });
      h += '</ol></div>';
    });
    $('bkOl').innerHTML = h;
    $('bkOl').querySelectorAll('.bk-olsec').forEach((b) => { secBtn[+b.dataset.sec] = b; secBar[+b.dataset.sec] = b.querySelector('.bar'); });
  }
  // tool tally
  const tally = {};
  $('bkTally').innerHTML = TOOLS.map((tn) => '<div class="bk-trow" style="--k:var(' + (CVAR[tn] || '--c-other') + ')"><span>' + esc(tn) + '</span><span class="tb"><i data-t="' + esc(tn) + '"></i></span><span class="bk-tc" data-c="' + esc(tn) + '">0/' + TOOL_TOTAL[tn] + '</span></div>').join('');
  TOOLS.forEach((tn) => { tally[tn] = { bar: $('bkTally').querySelector('i[data-t="' + tn + '"]'), c: $('bkTally').querySelector('[data-c="' + tn + '"]') }; });

  // ---------------------------------------------------------------- the rest of the margin: the report, so far
  // analyzeTape (js/shared/tape-report.js) over the events up to the playhead; at most every 250 ms while it plays
  const fileOf = (p) => String(p).split('/').pop();
  const none = (t) => '<p class="bk-none">' + t + '</p>';
  const rows = (items) => '<ul class="bk-list">' + items.join('') + '</ul>';
  const chips = (items) => '<p class="bk-chipset">' + items.join('') + '</p>';
  let statsFor = -2, statsAt = 0, cmdFilter = '';
  function renderStats(force) {
    if (!window.analyzeTape || cur === statsFor) return;
    const now = performance.now(); if (!force && now - statsAt < 250) return;
    statsFor = cur; statsAt = now;
    const n = cur, tEnd = n >= 0 ? EV[n].t + (EV[n].dur || 0) : 0;
    const R = window.analyzeTape({ title: TAPE.title, source: TAPE.source, model: TAPE.model, events: EV.slice(0, n + 1), responses: RS.filter((r) => r.t <= tEnd), duration: Math.max(1, tEnd) });
    const cells = [[R.kinds.prompt, 'prompts'], [R.kinds.text, 'replies'], [R.kinds.thinking, 'thinking'], [R.kinds.tool, 'tool calls'], [R.errors.length, 'errors', R.errors.length ? 'bad' : ''], [R.files.length, 'files']];
    $('bkTalk').innerHTML = cells.map(([v, l, c]) => '<div' + (c ? ' class="' + c + '"' : '') + '><b class="dot">' + v + '</b><span>' + l + '</span></div>').join('');
    const count = (id, v, bad) => { const el = $(id); el.textContent = v; el.classList.toggle('bad', !!bad); };
    count('nErr', R.errors.length, R.errors.length); count('nCmd', R.commands.count); count('nFiles', R.files.length);
    count('nExt', R.skills.reduce((a, x) => a + x[1], 0) + R.mcp.reduce((a, m) => a + m.calls, 0)); count('nWeb', R.urls.length + R.searches.length);
    const sl = R.slow[0]; count('nSlow', sl ? fmtDur(sl.dur) : '—');
    $('bkErrList').innerHTML = R.errors.length ? rows(R.errors.slice(-3).reverse().map((e) => '<li><button data-seek="' + e.i + '"><em>' + fmtClock(e.t) + '</em><b>' + esc(e.tool) + '</b> ' + esc(e.input) + '</button></li>')) : none('Nothing has failed.');
    // every command so far, newest first, each a jump to its moment; the program chips filter them (again: all)
    const progs = R.commands.programs.map(([p2]) => p2);
    if (cmdFilter && !progs.includes(cmdFilter)) cmdFilter = '';
    const want = cmdFilter ? new RegExp('(^|[\\s/;&|(])' + cmdFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)') : null;
    const cmdRows = [];
    for (let i = n; i >= 0; i--) {
      const e = EV[i]; if (e.kind !== 'tool' || e.tool !== 'Bash') continue;
      const line = String(e.input || '').split('\n')[0];
      if (want && !want.test(line)) continue;
      cmdRows.push('<li><button data-seek="' + i + '"' + (e.err ? ' class="err"' : '') + ' title="' + esc(line) + '"><em>' + fmtClock(e.t) + '</em>' + esc(line) + '</button></li>');
    }
    const prevList = $('bkCmds').querySelector('.bk-cmdlist'), keep = prevList ? prevList.scrollTop : 0;
    $('bkCmds').innerHTML = R.commands.count
      ? '<p class="bk-chipset">' + R.commands.programs.map(([p2, c]) => '<button data-prog="' + esc(p2) + '"' + (p2 === cmdFilter ? ' class="on"' : '') + '>' + esc(p2) + ' <i>×' + c + '</i></button>').join('') + '</p>' +
        '<ul class="bk-list bk-cmdlist">' + cmdRows.join('') + '</ul>'
      : none('No commands yet.');
    const list = $('bkCmds').querySelector('.bk-cmdlist'); if (list) list.scrollTop = keep;
    $('bkFiles').innerHTML = R.files.length ? rows(R.files.slice(0, 6).map((f) => '<li title="' + esc(f.path) + '"><b>' + esc(fileOf(f.path)) + '</b><span class="rwe">' + [['R', f.read, '--c-read'], ['W', f.write, '--c-write'], ['E', f.edit, '--c-edit']].filter((x) => x[1]).map(([k, v, c]) => '<i style="--k:var(' + c + ')">' + k + v + '</i>').join('') + '</span></li>')) : none('No files yet.');
    const sk = R.skills.map(([nm, c]) => '<span class="sk">' + esc(nm) + ' <i>×' + c + '</i></span>'), mc = R.mcp.map((m) => '<span title="' + esc(m.tools.map(([t, c]) => t + ' ×' + c).join(', ')) + '">' + esc(m.server) + ' <i>×' + m.calls + '</i></span>');
    $('bkExt').innerHTML = sk.length || mc.length ? chips(sk.concat(mc)) : none('No skills or MCP servers yet.');
    $('bkWeb').innerHTML = R.urls.length || R.searches.length ? rows(R.urls.slice(0, 4).map((u) => '<li title="' + esc(u.url) + '"><em>×' + u.count + '</em>' + esc(u.url.replace(/^https?:\/\//, '')) + '</li>').concat(R.searches.slice(-2).map((q) => '<li><em>search</em>' + esc(q.query) + '</li>'))) : none('Nothing fetched yet.');
    $('bkSlow').innerHTML = sl ? rows(['<li><button data-seek="' + sl.i + '"><em>' + fmtClock(sl.t) + '</em><b>' + esc(sl.tool) + '</b> ' + esc(sl.input) + '</button></li>']) : none('No calls yet.');
    $('bkActive').textContent = fmtDur(R.time.active); $('bkIdle').textContent = fmtDur(R.time.idle);   // idle: gaps over a minute
  }

  // ---------------------------------------------------------------- cursor: ghost the future, mark now
  let cur = -2, lastSec = -1, follow = true, tops = null, scrollTarget = null;
  const measure = () => { const base = scroller.getBoundingClientRect().top - scroller.scrollTop; tops = evEl.map((n) => n.getBoundingClientRect().top - base); };
  const topOf = (i) => { if (!tops) measure(); return tops[i]; };
  function setCursor(n) {
    if (n === cur) return;
    const old = cur, a = Math.min(old, n), b = Math.max(old, n);
    for (let i = Math.max(a + 1, 0); i <= b; i++) { evEl[i].classList.toggle('fut', i > n); if (runFirst[i]) runFirst[i].classList.toggle('fut-run', i > n); }
    if (old >= 0 && evEl[old]) { evEl[old].classList.remove('now'); if (blockEl[old] !== evEl[old]) blockEl[old].classList.remove('now-run'); }
    cur = n;
    if (n >= 0) { evEl[n].classList.add('now'); if (blockEl[n] !== evEl[n]) blockEl[n].classList.add('now-run'); }
    // contents: done / current section
    const s = n >= 0 ? secOf[n] : -1;
    if (s !== lastSec) {
      for (let k = Math.max(Math.min(s, lastSec), 0); k <= Math.max(s, lastSec); k++) { if (!secBtn[k]) continue; secBtn[k].classList.toggle('done', k < s); secBtn[k].classList.toggle('on', k === s); if (k !== s) secBar[k].style.transform = 'scaleX(0)'; }
      lastSec = s;
      if (s >= 0 && secBtn[s]) keepVisible(secBtn[s]);
    }
    TOOLS.forEach((tn) => { const v = n >= 0 ? toolCum[tn][n] : 0; tally[tn].bar.style.transform = 'scaleX(' + (TOOL_TOTAL[tn] ? v / TOOL_TOTAL[tn] : 0) + ')'; tally[tn].c.textContent = v + '/' + TOOL_TOTAL[tn]; });
    if (follow) scrollToCursor();
    mmDirty = true;
  }
  function keepVisible(btn) {
    const box = $('bkOl'), bt = btn.offsetTop, bh = btn.offsetHeight, st = box.scrollTop, h = box.clientHeight;
    let target = null;
    if (bt < st + 50) target = bt - 60; else if (bt + bh > st + h - 50) target = bt - h * 0.4;
    if (target != null) box.scrollTo({ top: Math.max(0, target), behavior: reduced || (S.playing && S.base > 30) ? 'auto' : 'smooth' });
  }

  // ---------------------------------------------------------------- follow the playhead (and let go when you scroll)
  function scrollToCursor(instant) {
    if (cur < 0) { scrollTarget = 0; return; }
    const h = scroller.clientHeight;
    let y = topOf(cur) - h * (EV[cur].kind === 'prompt' ? 0.22 : 0.36);
    y = Math.max(0, Math.min(scroller.scrollHeight - h, y));
    if (instant || reduced) { scrollTarget = null; progScroll(y); } else scrollTarget = y;
  }
  let progScrolling = false;
  function progScroll(y) { progScrolling = true; scroller.scrollTop = y; }
  function stepScroll() {
    if (scrollTarget == null) return;
    const y = scroller.scrollTop, d = scrollTarget - y;
    if (Math.abs(d) < 1.2) { progScroll(scrollTarget); scrollTarget = null; return; }
    let s = d * 0.16; if (Math.abs(s) < 1) s = d > 0 ? 1 : -1;
    progScroll(y + s);
  }
  function setFollow(on) {
    follow = on; $('bkReturn').hidden = on;
    if (on) scrollToCursor(); else { scrollTarget = null; updReturn(); }
  }
  const userScrolled = () => { if (follow) setFollow(false); };
  scroller.addEventListener('wheel', userScrolled, { passive: true });
  scroller.addEventListener('touchmove', userScrolled, { passive: true });
  scroller.addEventListener('keydown', (e) => { if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown'].includes(e.key)) userScrolled(); });
  scroller.addEventListener('scroll', () => { if (progScrolling) progScrolling = false; mmView = true; updReturn(); }, { passive: true });
  function updReturn() {
    if (follow || cur < 0) return;
    $('bkReturn').classList.toggle('up', topOf(cur) - scroller.scrollTop < 0);
    $('bkReturnT').textContent = fmtClock(EV[cur].t);
  }
  $('bkReturn').addEventListener('click', () => setFollow(true));

  // ---------------------------------------------------------------- clicks in the document and the contents
  book.addEventListener('click', (e) => {
    // a click on anything in the text pauses there and moves the playhead (and the scroll) to it; then the click
    // still does its own thing (a chip opens its call, a thought unfolds). Selecting text or following a link doesn't.
    const item = e.target.closest('#bkDoc [data-i]');
    if (item && !e.target.closest('a') && !String(getSelection()).trim()) {
      const i = +item.dataset.i;
      if (S.playing) P.pause();
      P.seek(EV[i].t, { idx: i }); setFollow(true);
    }
    const prog = e.target.closest('[data-prog]');
    if (prog) { cmdFilter = cmdFilter === prog.dataset.prog ? '' : prog.dataset.prog; statsFor = -2; renderStats(true); return; }
    const t = e.target.closest('[data-seek],[data-think],[data-more],[data-chip],[data-ch],[data-sec],#bkStart,#bkEnd,#bkPlay');
    if (!t) return;
    const d = t.dataset;
    if (d.seek != null) { if (S.playing && t.closest('#bkDoc')) P.pause(); P.seek(EV[+d.seek].t, { idx: +d.seek }); setFollow(true); }
    else if (d.think != null) { t.parentNode.classList.toggle('open'); tops = null; }
    else if (d.more != null) { const q = t.parentNode; q.classList.toggle('full'); t.textContent = q.classList.contains('full') ? 'Show less' : 'Read the full prompt'; tops = null; }
    else if (d.chip != null) { openCall(+d.chip, t); }
    else if (d.ch != null) { P.seek(chapters[+d.ch].t0, { idx: chapters[+d.ch].i0 }); setFollow(true); }
    else if (d.sec != null) { const Sx = sections[+d.sec]; P.seek(Sx.t0, { idx: Sx.i0 }); setFollow(true); }
    else if (t.id === 'bkStart') { P.seek(0); setFollow(true); }
    else if (t.id === 'bkEnd') { P.seek(DUR); setFollow(true); }
    else if (t.id === 'bkPlay') P.togglePlay();
  });
  // a tool call's input and result, opened under its run
  function openCall(i, chip) {
    const run = chip.closest('.bk-run'), open = run.querySelector('.bk-call');
    if (open && +open.dataset.i === i) { open.remove(); chip.classList.remove('open'); tops = null; return; }
    if (open) { open.remove(); run.querySelectorAll('.bk-chip.open').forEach((c) => c.classList.remove('open')); }
    const e = EV[i], card = document.createElement('div');
    card.className = 'bk-call' + (e.err ? ' err' : ''); card.dataset.i = i; card.style.setProperty('--k', 'var(' + kcol(e) + ')');
    card.innerHTML = '<div class="bk-callhead"><b>' + esc(e.tool) + '</b><span>' + fmtClock(e.t) + (e.dur != null ? ' · ' + fmtDur(e.dur) : '') + (e.err ? ' · error' : '') + '</span>' +
      '<button class="nano-key" data-seek="' + i + '" title="Seek here">▶</button></div>' +
      '<pre>' + esc((e.info && e.info.cmd) || e.input || '') + '</pre>' + (e.result ? '<div class="bk-lbl">Result</div><pre class="res">' + esc(e.result) + '</pre>' : '');
    run.appendChild(card); chip.classList.add('open'); tops = null;
  }

  // ---------------------------------------------------------------- margin: the meter's figures and its chart
  // The meter's chart shows one view at a time (the tabs): spend so far (a step line), the context window in use
  // (a line), or each response's output (thin columns). Played part in the accent with a soft wash, the rest dim;
  // hover for a crosshair at the nearest response (the big figure above reads its value, "at 07:42"), click to go there. The view and which folded rows
  // are open are remembered (localStorage), per browser.
  const SIDE_KEY = 'vcr-bk-side';
  let side = {}; try { side = JSON.parse(localStorage.getItem(SIDE_KEY)) || {}; } catch (e) {}
  const saveSide = () => { try { localStorage.setItem(SIDE_KEY, JSON.stringify(side)); } catch (e) {} };
  const CTX = RS.map((r) => (r.in || 0) + (r.cr || 0) + (r.cw || 0)), PEAK_CTX = Math.max(0, ...CTX);
  const VIEWS = {
    cost: { lbl: 'Spent', kind: 'step', v: RS.map((r, k) => cum.cost[k]), fmt: fmtCost, now: (ri) => (ri >= 0 ? cum.cost[ri] : 0), sub: 'of ' + fmtCost(TOTAL_COST) },
    ctx: { lbl: 'Context in use', kind: 'line', v: CTX, fmt: fmtTok, now: (ri) => (ri >= 0 ? CTX[ri] : 0), sub: 'peak ' + fmtTok(PEAK_CTX) },
    out: { lbl: 'Output', kind: 'bars', v: RS.map((r) => r.out || 0), fmt: fmtTok, now: (ri) => (ri >= 0 ? cum.out[ri] : 0), sub: 'of ' + fmtTok(TOTAL_OUT) },
  };
  let view = VIEWS[side.view] ? side.view : 'cost';
  const chart = $('spMain'), CH = 64, PAD_T = 6, PAD_B = 3;
  let respIdx = -2, lastNow = -1, sparkW = 0, lastSpark = -1, dpr = 1, hover = -1;
  function setView(v) {
    view = v; side.view = v; saveSide();
    $('bkTabs').querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    $('bkMLbl').textContent = VIEWS[v].lbl; $('bkMSub').textContent = VIEWS[v].sub;
    respIdx = -2; lastSpark = -1; hover = -1;
  }
  $('bkTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { setView(b.dataset.tab); renderFigures(); } });
  // folded rows: remember which are open
  book.querySelectorAll('.bk-acc').forEach((d) => {
    if ((side.open || ['bkErrList']).includes(d.dataset.acc)) d.open = true;
    d.addEventListener('toggle', () => { side.open = [...book.querySelectorAll('.bk-acc[open]')].map((x) => x.dataset.acc); saveSide(); });
  });
  function sizeSparks() {
    dpr = Math.min(2, devicePixelRatio || 1);
    sparkW = chart.parentNode.clientWidth;
    chart.style.height = CH + 'px'; chart.width = Math.round(sparkW * dpr); chart.height = Math.round(CH * dpr);
    lastSpark = -1;
  }
  const xOf = (k) => (RS[k].t / DUR) * sparkW;
  function drawSparks() {
    if (!sparkW) return;
    const g = chart.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, sparkW, CH);
    const V = VIEWS[view], v = V.v, base = CH - PAD_B, mx = Math.max(1e-9, ...v), yOf = (x) => base - (x / mx) * (base - PAD_T);
    const px = (S.t / DUR) * sparkW, accent = cssv('--orange'), dim = cssv('--hw-fg-4'), surf = cssv('--hw-bg'), line = cssv('--hw-line-2');
    g.fillStyle = line; g.fillRect(0, base, sparkW, 1);   // the baseline
    if (!NR) return;
    if (V.kind === 'bars') {
      const bw = Math.max(1, Math.min(3, (sparkW / NR) * 0.55));
      RS.forEach((r, k) => {
        const x = Math.round(xOf(k) - bw / 2), y = yOf(v[k]); if (base - y < 0.5) return;
        g.fillStyle = r.t <= S.t ? accent : dim; g.globalAlpha = r.t <= S.t ? 1 : 0.55; g.fillRect(x, y, bw, base - y);
      });
      g.globalAlpha = 1;
    } else {
      const trace = () => {
        g.beginPath(); g.moveTo(0, V.kind === 'step' ? base : yOf(v[0]));
        RS.forEach((r, k) => { const x = xOf(k), y = yOf(v[k]); if (V.kind === 'step') g.lineTo(x, k ? yOf(v[k - 1]) : base); g.lineTo(x, y); });
        g.lineTo(sparkW, yOf(v[NR - 1]));
      };
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.save(); g.beginPath(); g.rect(px, 0, sparkW - px, CH); g.clip();   // ahead of the playhead: dim
      trace(); g.strokeStyle = dim; g.globalAlpha = 0.7; g.lineWidth = 1.5; g.stroke(); g.restore();
      g.save(); g.beginPath(); g.rect(0, 0, px, CH); g.clip();              // played: the accent, over a wash
      trace(); g.lineTo(sparkW, base); g.lineTo(0, base); g.closePath(); g.fillStyle = accent; g.globalAlpha = 0.14; g.fill();
      g.globalAlpha = 1; trace(); g.strokeStyle = accent; g.lineWidth = 2; g.stroke(); g.restore();
    }
    // the playhead, and where the value stands at it
    g.fillStyle = accent; g.globalAlpha = 0.45; g.fillRect(Math.round(px) - 0.5, 0, 1, base); g.globalAlpha = 1;
    const ri = lastLE(RS, S.t);
    if (V.kind !== 'bars' && ri >= 0) dotAt(g, Math.min(px, sparkW - 4), yOf(v[ri]), accent, surf);
    // hover: a crosshair at the nearest response, its point, and the tooltip
    if (hover >= 0) {
      const hx = xOf(hover), hy = yOf(v[hover]);
      g.fillStyle = cssv('--hw-fg-3'); g.fillRect(Math.round(hx) - 0.5, 0, 1, base);
      dotAt(g, hx, hy, RS[hover].t <= S.t ? accent : cssv('--hw-fg-2'), surf);
    }
  }
  function dotAt(g, x, y, fill, ring) { g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = ring; g.stroke(); }
  function nearest(x) {
    const k = lastLE(RS, (x / sparkW) * DUR); if (k < 0) return NR ? 0 : -1;
    return k + 1 < NR && Math.abs(xOf(k + 1) - x) < Math.abs(xOf(k) - x) ? k + 1 : k;
  }
  chart.addEventListener('pointermove', (e) => {
    const r = chart.getBoundingClientRect(), k = nearest(e.clientX - r.left);
    if (k === hover) return;
    hover = k; lastSpark = -1; respIdx = -2;
  });
  chart.addEventListener('pointerleave', () => { hover = -1; lastSpark = -1; respIdx = -2; });
  chart.addEventListener('click', () => { if (hover >= 0) { P.seek(RS[hover].t); setFollow(true); } });
  function renderFigures() {
    const ri = lastLE(RS, S.t);
    if (ri !== respIdx) {
      respIdx = ri;
      const o = ri >= 0 ? cum.out[ri] : 0, readAll = ri >= 0 ? cum.inp[ri] + cum.cr[ri] + cum.cw[ri] : 0;
      // the big figure: the value at the playhead, or (hovering the chart) at the response under the pointer
      const V = VIEWS[view], hv = hover >= 0;
      $('bkBig').textContent = V.fmt(hv ? V.v[hover] : V.now(ri)); $('bkBig').classList.toggle('hov', hv);
      $('bkMLbl').textContent = hv && view === 'out' ? 'That response' : V.lbl;
      $('bkMSub').textContent = hv ? 'at ' + fmtClock(RS[hover].t) : V.sub;
      $('bkOut').textContent = fmtTok(o); $('bkIn').textContent = fmtTok(readAll);
      $('bkCtx').textContent = fmtTok(ri >= 0 ? CTX[ri] : 0);
      $('bkCache').textContent = (readAll ? Math.round(cum.cr[ri] / readAll * 100) : 0) + '%';
      $('bkSplit').innerHTML = ri >= 0 ? '<span>fresh <b>' + fmtTok(cum.inp[ri]) + '</b></span><span>cache read <b>' + fmtTok(cum.cr[ri]) + '</b></span><span>cache write <b>' + fmtTok(cum.cw[ri]) + '</b></span>' : '';
    }
    const spx = Math.round((S.t / DUR) * sparkW * 2);   // half-pixel steps, so the line creeps smoothly
    if (spx !== lastSpark) { lastSpark = spx; drawSparks(); }
  }
  setView(view);

  // ---------------------------------------------------------------- minimap: the whole session down the edge
  const mm = $('bkMm'), mmBase = $('mmBase'), mmOver = $('mmOver'), MM_TOP = 30, MM_BOT = 26;
  let mmW = 0, mmH = 0, mmDirty = true, mmView = true, lastPlayY = -1, lastViewKey = '';
  const mmY = (t) => MM_TOP + (t / DUR) * (mmH - MM_TOP - MM_BOT);
  const mmT = (y) => Math.max(0, Math.min(DUR, ((y - MM_TOP) / (mmH - MM_TOP - MM_BOT)) * DUR));
  function sizeMinimap() {
    mmW = mm.clientWidth; mmH = mm.clientHeight;
    [mmBase, mmOver].forEach((c) => { c.width = Math.round(mmW * dpr); c.height = Math.round(mmH * dpr); });
    drawBase(); lastPlayY = -1; lastViewKey = ''; drawOverlay(true);
  }
  function drawBase() {
    const g = mmBase.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, mmW, mmH);
    const x0 = 8, x1 = mmW - 10, lane = x1 - x0;
    g.fillStyle = cssv('--hw-line-2');
    for (let m = 0; m * 60000 <= DUR; m += 5) g.fillRect(0, Math.round(mmY(m * 60000)), m % 10 === 0 ? 6 : 3, 1);
    // the output-token burn, as a thin bar on the right edge
    const nb = Math.ceil((mmH - MM_TOP - MM_BOT) / 3), sums = new Float64Array(nb); let mx = 0;
    RS.forEach((r) => { const b = Math.min(nb - 1, Math.floor((mmY(r.t) - MM_TOP) / 3)); sums[b] += r.out || 0; mx = Math.max(mx, sums[b]); });
    g.fillStyle = cssv('--orange'); g.globalAlpha = 0.55;
    for (let b = 0; b < nb; b++) if (sums[b]) { const w = Math.max(1, Math.sqrt(sums[b] / mx) * 6); g.fillRect(mmW - 2 - w, MM_TOP + b * 3, w, 2.5); }
    g.globalAlpha = 1;
    EV.forEach((e, i) => {
      const y = mmY(e.t);
      g.fillStyle = cssv(kcol(e));
      if (e.kind === 'prompt') g.fillRect(0, y - 1.5, mmW - 10, 3);
      else if (e.kind === 'text') g.fillRect(x0, y - 1, Math.max(4, lane * (0.3 + Math.min(0.6, String(e.text || '').length / 500))), 2);
      else if (e.kind === 'thinking') g.fillRect(x0 - 4, y - 1, 3, 2);
      else g.fillRect(x0 + lane * 0.28, y - 0.75, Math.max(3, Math.min(lane * 0.6, 3 + String(e.input || '').length / 8)), Math.max(1.5, ((e.dur || 0) / DUR) * (mmH - MM_TOP - MM_BOT)));
    });
  }
  function visibleRange() {
    if (!tops) measure();
    const top = scroller.scrollTop, bot = top + scroller.clientHeight;
    let first = EV.length - 1, last = 0;
    for (let lo = 0, hi = EV.length - 1; lo <= hi;) { const m = (lo + hi) >> 1; if (tops[m] >= top) { first = m; hi = m - 1; } else lo = m + 1; }
    for (let lo = 0, hi = EV.length - 1; lo <= hi;) { const m = (lo + hi) >> 1; if (tops[m] <= bot) { last = m; lo = m + 1; } else hi = m - 1; }
    if (last < first) { first = Math.max(0, first - 1); last = first; }
    return [EV[first] ? EV[first].t : 0, last + 1 < EV.length ? EV[last + 1].t : DUR];
  }
  function drawOverlay(force) {
    if (!mmW) return;
    const py = Math.round(mmY(S.t) * 2) / 2, vr = visibleRange(), key = Math.round(mmY(vr[0])) + ':' + Math.round(mmY(vr[1]));
    mmDirty = mmView = false;
    if (!force && py === lastPlayY && key === lastViewKey) return;
    lastPlayY = py; lastViewKey = key;
    const g = mmOver.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, mmW, mmH);
    g.fillStyle = 'rgba(12,12,13,.6)'; g.fillRect(0, py, mmW, mmH - py);                         // the unplayed future, veiled
    const y0 = mmY(vr[0]), y1 = Math.max(y0 + 6, mmY(vr[1]));                                      // what the column shows now
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(1, y0, mmW - 2, y1 - y0);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(1.5, y0 + 0.5, mmW - 3, y1 - y0 - 1);
    g.fillStyle = cssv('--err');
    ERRS.forEach((i) => { const ey = mmY(EV[i].t), ex = mmW - 6; g.beginPath(); g.moveTo(ex, ey - 4); g.lineTo(ex + 4, ey); g.lineTo(ex, ey + 4); g.lineTo(ex - 4, ey); g.closePath(); g.fill(); });
    g.fillStyle = cssv('--orange'); g.fillRect(0, py - 1, mmW, 2);
    g.beginPath(); g.moveTo(0, py - 5); g.lineTo(5, py); g.lineTo(0, py + 5); g.closePath(); g.fill();
    g.font = '700 9px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.fillStyle = cssv('--hw-fg-3');
    g.fillText(fmtClock(S.t), mmW / 2, MM_TOP - 12); g.fillText(fmtClock(DUR), mmW / 2, mmH - 9); g.textAlign = 'start';
  }
  {
    let drag = false, was = false;
    const at = (ev) => { const r = mm.getBoundingClientRect(); P.seek(mmT(ev.clientY - r.top)); setFollow(true); };
    const tip = (ev) => {
      if (ev.pointerType === 'touch' && !drag) return;
      const r = mm.getBoundingClientRect(), y = ev.clientY - r.top, t = mmT(y), i = lastLE(EV, t), el = $('mmTip');
      el.innerHTML = '<b>' + fmtClock(t) + '</b>' + esc(i >= 0 ? (EV[i].kind === 'tool' ? EV[i].tool + ': ' + toolSummary(EV[i]) : firstSentence(EV[i].text, 60) || EV[i].kind) : 'Start of tape');
      el.style.top = Math.max(16, Math.min(mmH - 16, y)) + 'px'; el.hidden = false;
    };
    mm.addEventListener('pointerdown', (ev) => { drag = true; was = S.playing; if (was) P.pause(); mm.setPointerCapture(ev.pointerId); at(ev); tip(ev); ev.preventDefault(); });
    mm.addEventListener('pointermove', (ev) => { if (drag) at(ev); tip(ev); });
    const end = () => { if (!drag) return; drag = false; if (was) P.togglePlay(); };
    mm.addEventListener('pointerup', end); mm.addEventListener('pointercancel', end);
    mm.addEventListener('pointerleave', () => { if (!drag) $('mmTip').hidden = true; });
    mm.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); P.seek(S.t + (ev.key === 'ArrowUp' ? -1 : 1) * DUR / 100); setFollow(true); } });
  }

  // ---------------------------------------------------------------- the pill: play state, clock, speed, skip
  P.holdKey($('bkPrev'), -1); P.holdKey($('bkNext'), 1);   // tap steps an event, hold shuttles: the studio's own keys
  $('bkSpeedMount').replaceWith(P.speedControl());
  let lastPill = '';
  function renderPill() {
    const key = S.playing + '|' + S.base + '|' + S.skip;
    if (key !== lastPill) {
      lastPill = key;
      $('bkPlay').classList.toggle('on', S.playing); $('bkPlay').setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
    }
    const s = Math.floor(S.t / 1000);
    if (s !== lastNow) { lastNow = s; $('bkNow').textContent = fmtClock(S.t); mm.setAttribute('aria-valuenow', Math.round((S.t / DUR) * 100)); }
    // the current section's progress bar in the contents
    if (lastSec >= 0 && secBar[lastSec]) { const Sx = sections[lastSec]; secBar[lastSec].style.transform = 'scaleX(' + Math.max(0, Math.min(1, (S.t - Sx.t0) / Math.max(1, Sx.t1 - Sx.t0))).toFixed(3) + ')'; }
  }

  // ---------------------------------------------------------------- mode switch
  let on = false;
  const modeBtns = document.querySelectorAll('[data-mode]');
  function setMode(m) {
    on = m === 'book';
    app.classList.toggle('book-mode', on); book.hidden = !on;
    modeBtns.forEach((b) => { const sel = b.dataset.mode === m; b.classList.toggle('on', sel); b.setAttribute('aria-checked', String(sel)); });
    try { localStorage.setItem('vcr-ds-mode', m); } catch (e) {}
    if (on) {
      requestAnimationFrame(() => { sizeSparks(); sizeMinimap(); tops = null; cur = -2; setCursor(S.cur); scrollToCursor(true); renderFigures(); drawSparks(); });
    }
  }
  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.matches && e.target.matches('input, textarea, select'))) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); setMode(on ? 'studio' : 'book'); }
    else if (on && (e.key === 'f' || e.key === 'F')) setFollow(true);   // in the book, F returns to the playhead
  });
  new ResizeObserver(() => { if (!on) return; sizeSparks(); sizeMinimap(); tops = null; if (follow) scrollToCursor(true); }).observe(book);

  // ---------------------------------------------------------------- every frame, while the book is showing
  P.onFrame(() => {
    if (!on) return;
    if (S.cur !== cur) setCursor(S.cur);
    renderPill(); renderFigures(); renderStats(); stepScroll();
    if (mmDirty || mmView || Math.round(mmY(S.t) * 2) / 2 !== lastPlayY) drawOverlay();
  });

  let saved = null; try { saved = localStorage.getItem('vcr-ds-mode'); } catch (e) {}
  setMode(saved === 'book' ? 'book' : 'studio');
})();
