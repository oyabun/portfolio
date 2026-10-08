/* VCR Deck Studio · the Report view (Program: Report)
   Everything the session log can tell you, laid out as a report: the numbers, the tools as a chart, the slowest
   calls, the errors, the URLs it reached, skills and MCP servers, the files it touched, the programs it ran, your
   prompts and what it all cost. Built from js/shared/tape-report.js; rows that point at a moment seek there.
   "Copy as Markdown" puts the whole report on the clipboard. */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const tc = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60); };
  const dur = (ms) => (ms < 1000 ? Math.round(ms) + 'ms' : ms < 60000 ? (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + 's' : ms < 3600000 ? Math.floor(ms / 60000) + 'm ' + pad(Math.round((ms % 60000) / 1000)) + 's' : Math.floor(ms / 3600000) + 'h ' + pad(Math.round((ms % 3600000) / 60000)) + 'm');
  const tok = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k' : String(Math.round(n)));
  const money = (c) => '$' + c.toFixed(2);
  const CVAR = { Bash: '--c-bash', Read: '--c-read', Write: '--c-write', Edit: '--c-edit', MultiEdit: '--c-edit', Skill: '--c-skill' };
  const toolColor = (name) => 'var(' + (CVAR[name] || (/^mcp__/.test(name) ? '--c-other' : '--c-other')) + ')';

  function render(el, tape, seek) {
    const R = window.analyzeTape(tape), T = R.tokens;
    const rel = (p) => (R.cwd && p.startsWith(R.cwd + '/') ? p.slice(R.cwd.length + 1) : p);
    const start = new Date(R.start);
    const when = isNaN(start) ? '' : start.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const models = T.models.map(([m]) => m).join(', ') || R.model || '—';
    const empty = (what) => '<p class="rp-empty">' + what + '</p>';
    const row = (i, cells, cls) => '<button class="rp-row' + (cls ? ' ' + cls : '') + '" data-i="' + i + '" title="Go to this moment">' + cells + '</button>';
    const maxCalls = Math.max(1, ...R.tools.map((t) => t.calls));
    const stat = (label, value, sub) => '<div class="rp-stat"><span class="rp-lbl">' + label + '</span><b class="dot">' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';

    el.innerHTML =
      '<header class="rp-head">' +
        '<div><p class="rp-kicker">SESSION REPORT</p><h2>' + esc(R.title) + '</h2>' +
        '<p class="rp-meta">' + [when, models, R.source, R.cwd].filter(Boolean).map(esc).join(' · ') + '</p></div>' +
        '<button class="tog-key" id="rpCopy" data-tip="The whole report, as Markdown, on your clipboard">COPY AS MARKDOWN</button>' +
      '</header>' +
      '<div class="rp-stats">' +
        stat('Duration', dur(R.duration), dur(R.time.active) + ' active · ' + dur(R.time.idle) + ' idle') +
        stat('Events', R.events, R.kinds.prompt + ' prompts · ' + R.kinds.text + ' replies · ' + R.kinds.thinking + ' thinking') +
        stat('Tool calls', R.kinds.tool, R.tools.length + ' tools') +
        stat('Errors', R.errors.length, R.errors.length ? 'in ' + [...new Set(R.errors.map((e) => e.tool))].join(', ') : 'none') +
        stat('Spent', money(T.cost), T.responses + ' responses') +
        stat('Tokens', tok(T.input) + ' / ' + tok(T.out), 'in / out · cache hit ' + Math.round(T.cacheHit * 100) + '%') +
        stat('Peak context', tok(T.peakContext), 'tokens in one request') +
        stat('Files touched', R.files.length, R.commands.count + ' shell commands') +
      '</div>' +

      '<section class="rp-sec rp-wide"><h3>Tools used</h3><div class="rp-bars">' +
        R.tools.map((t) => '<div class="rp-bar" style="--k:' + toolColor(t.name) + '"><span class="rp-name">' + esc(t.name) + '</span>' +
          '<span class="rp-track"><i style="width:' + (t.calls / maxCalls * 100).toFixed(1) + '%"><em style="width:' + (t.errors / t.calls * 100).toFixed(1) + '%"></em></i></span>' +
          '<span class="rp-num">' + t.calls + '</span><span class="rp-sub">' + (t.errors ? '<span class="rp-err">' + t.errors + ' failed</span> · ' : '') + dur(t.time) + '</span></div>').join('') +
      '</div></section>' +

      '<section class="rp-sec"><h3>Slowest calls</h3>' + (R.slow.length ? R.slow.map((s) =>
        row(s.i, '<span class="rp-t dot">' + tc(s.t) + '</span><span class="rp-tag" style="--k:' + toolColor(s.tool) + '">' + esc(s.tool) + '</span><span class="rp-txt">' + esc(s.input) + '</span><span class="rp-num">' + dur(s.dur) + '</span>', s.err ? 'err' : '')).join('') : empty('No timed calls.')) + '</section>' +

      '<section class="rp-sec"><h3>Errors <small>' + R.errors.length + '</small></h3>' + (R.errors.length ? R.errors.map((e) =>
        row(e.i, '<span class="rp-t dot">' + tc(e.t) + '</span><span class="rp-tag" style="--k:var(--err)">' + esc(e.tool) + '</span><span class="rp-txt">' + esc(e.input) + (e.result ? '<small>' + esc(e.result) + '</small>' : '') + '</span>', 'err')).join('') : empty('Nothing failed.')) + '</section>' +

      '<section class="rp-sec"><h3>URLs accessed <small>' + R.urls.length + '</small></h3>' + (R.urls.length ? R.urls.map((u) =>
        row(u.i, '<span class="rp-t dot">' + tc(u.first) + '</span><span class="rp-txt mono">' + esc(u.url) + '</span><span class="rp-sub">' + esc(u.tools.join(', ')) + '</span><span class="rp-num">×' + u.count + '</span>')).join('') : empty('No URLs in this session.')) +
        (R.searches.length ? '<h4>Web searches</h4>' + R.searches.map((q) => row(q.i, '<span class="rp-t dot">' + tc(q.t) + '</span><span class="rp-txt">' + esc(q.query) + '</span>')).join('') : '') + '</section>' +

      '<section class="rp-sec"><h3>Skills &amp; MCP</h3>' +
        '<h4>Skills</h4>' + (R.skills.length ? '<div class="rp-chips">' + R.skills.map(([n, c]) => '<span class="rp-chip" style="--k:var(--c-skill)">' + esc(n) + '<b>×' + c + '</b></span>').join('') + '</div>' : empty('No skills used.')) +
        '<h4>MCP servers</h4>' + (R.mcp.length ? R.mcp.map((m) => '<div class="rp-mcp"><b>' + esc(m.server) + '</b><span class="rp-num">' + m.calls + ' calls</span><div class="rp-chips">' + m.tools.map(([n, c]) => '<span class="rp-chip">' + esc(n) + '<b>×' + c + '</b></span>').join('') + '</div></div>').join('') : empty('No MCP servers called.')) +
      '</section>' +

      '<section class="rp-sec"><h3>Files touched <small>' + R.files.length + '</small></h3>' + (R.files.length ? '<div class="rp-files">' + R.files.map((f) =>
        '<div class="rp-file"><span class="rp-txt mono" title="' + esc(f.path) + '">' + esc(rel(f.path)) + '</span>' +
        ['read', 'write', 'edit'].map((k) => '<span class="rp-io ' + k + (f[k] ? '' : ' none') + '" title="' + k + '">' + k[0].toUpperCase() + (f[k] > 1 ? f[k] : '') + '</span>').join('') + '</div>').join('') + '</div>' : empty('No files read or written.')) + '</section>' +

      '<section class="rp-sec"><h3>Commands <small>' + R.commands.count + ' run</small></h3>' + (R.commands.programs.length ? '<div class="rp-chips">' + R.commands.programs.map(([p, c]) => '<span class="rp-chip" style="--k:var(--c-bash)">' + esc(p) + '<b>×' + c + '</b></span>').join('') + '</div>' : empty('No shell commands.')) + '</section>' +

      '<section class="rp-sec"><h3>Tokens &amp; cost</h3><table class="rp-table"><tbody>' +
        [['Fresh input', T.fresh], ['Cache read', T.cacheRead], ['Cache write', T.cacheWrite], ['Output', T.out]].map(([k, v]) => '<tr><th>' + k + '</th><td class="dot">' + tok(v) + '</td></tr>').join('') +
        '<tr class="tot"><th>Spent</th><td class="dot">' + money(T.cost) + '</td></tr></tbody></table>' +
        '<p class="rp-note">' + T.responses + ' responses' + (T.models.length ? ' from ' + T.models.map(([m, c]) => esc(m) + ' (' + c + ')').join(', ') : '') + '. Cost is estimated from list prices.</p></section>' +

      '<section class="rp-sec rp-wide"><h3>Prompts <small>' + R.prompts.length + '</small></h3>' + R.prompts.map((p) =>
        row(p.i, '<span class="rp-t dot">' + tc(p.t) + '</span><span class="rp-txt">' + esc(p.text.split('\n')[0].slice(0, 220)) + '</span>')).join('') + '</section>';

    el.querySelectorAll('.rp-row').forEach((b) => b.addEventListener('click', () => seek(+b.dataset.i)));
    const copy = el.querySelector('#rpCopy');
    copy.addEventListener('click', () => {
      const md = markdown(R, rel, when, models);
      const done = () => { copy.textContent = 'COPIED'; setTimeout(() => { copy.textContent = 'COPY AS MARKDOWN'; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(done, () => fallback(md, done)); else fallback(md, done);
    });
  }
  function fallback(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* nothing more to try */ }
    ta.remove();
  }
  function markdown(R, rel, when, models) {
    const T = R.tokens, L = [];
    L.push('# ' + R.title, '', [when, models, R.source].filter(Boolean).join(' · '), '');
    L.push('| Duration | Active | Idle | Events | Tool calls | Errors | Spent | Tokens in / out | Cache hit |', '|---|---|---|---|---|---|---|---|---|');
    L.push('| ' + [dur(R.duration), dur(R.time.active), dur(R.time.idle), R.events, R.kinds.tool, R.errors.length, money(T.cost), tok(T.input) + ' / ' + tok(T.out), Math.round(T.cacheHit * 100) + '%'].join(' | ') + ' |', '');
    L.push('## Tools used', '', '| Tool | Calls | Failed | Time |', '|---|---|---|---|', ...R.tools.map((t) => '| ' + t.name + ' | ' + t.calls + ' | ' + t.errors + ' | ' + dur(t.time) + ' |'), '');
    L.push('## Slowest calls', '', ...R.slow.map((s) => '- `' + tc(s.t) + '` **' + s.tool + '** ' + dur(s.dur) + ': `' + s.input.replace(/`/g, "'") + '`'), '');
    L.push('## Errors', '', ...(R.errors.length ? R.errors.map((e) => '- `' + tc(e.t) + '` **' + e.tool + '**: `' + e.input.replace(/`/g, "'") + '`' + (e.result ? ' → ' + e.result : '')) : ['None.']), '');
    L.push('## URLs accessed', '', ...(R.urls.length ? R.urls.map((u) => '- ' + u.url + ' (' + u.tools.join(', ') + ', ×' + u.count + ')') : ['None.']), '');
    L.push('## Skills', '', ...(R.skills.length ? R.skills.map(([n, c]) => '- ' + n + ' ×' + c) : ['None.']), '');
    L.push('## MCP servers', '', ...(R.mcp.length ? R.mcp.map((m) => '- **' + m.server + '** (' + m.calls + ' calls): ' + m.tools.map(([n, c]) => n + ' ×' + c).join(', ')) : ['None.']), '');
    L.push('## Files touched', '', ...(R.files.length ? R.files.map((f) => '- `' + rel(f.path) + '`: ' + ['read', 'write', 'edit'].filter((k) => f[k]).map((k) => k + ' ×' + f[k]).join(', ')) : ['None.']), '');
    L.push('## Commands', '', R.commands.count + ' shell commands. Programs: ' + (R.commands.programs.map(([p, c]) => p + ' ×' + c).join(', ') || 'none') + '.', '');
    L.push('## Tokens & cost', '', '| Fresh input | Cache read | Cache write | Output | Spent |', '|---|---|---|---|---|', '| ' + [tok(T.fresh), tok(T.cacheRead), tok(T.cacheWrite), tok(T.out), money(T.cost)].join(' | ') + ' |', '');
    L.push('## Prompts', '', ...R.prompts.map((p) => '- `' + tc(p.t) + '` ' + p.text.split('\n')[0]), '');
    return L.join('\n');
  }
  window.VCRReport = { render };
})();
