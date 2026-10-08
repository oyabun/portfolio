/* The simple player (player.html): theme toggle, "Open a tape" (file picker + drag-drop anywhere on the
   page), and what boots the deck (cartridge.js) with the right tape: ?demo=<id>, a tape stored by the
   studio's EJECT or by this page's own file picker (sessionStorage, the key eject.js reads too, so either
   page can hand a tape to the other), or the first demo. Also draws the preview under the deck: everything
   the tape holds, as cards (js/shared/tape-report.js), the same cards as the landing's "What's on the tape". */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const K = window.VCRCartridge;
  if (!K) return;
  const TAPE_KEY = 'vcr-ds-tape', EJECTED_KEY = 'vcr-ds-ejected';

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  const curTheme = () => root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function toggleTheme() {
    const next = curTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('vcr-ds-theme', next); } catch (e) {}
  }
  $('btnTheme').addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (e) => {
    if ((e.target.closest && e.target.closest('input, textarea')) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 't' || e.key === 'T') toggleTheme();
  });

  /* ---------------- open a tape: the picker, or drop it anywhere on the page ---------------- */
  function openTape(file) {
    if (!file) return;
    if (!/\.jsonl$/i.test(file.name)) { alert('That is not a .jsonl session log.'); return; }
    const rd = new FileReader();
    rd.onerror = () => alert('Couldn’t read ' + file.name + '.');
    rd.onload = () => {
      let tape;
      try { tape = window.parseTape(rd.result, file.name); } catch (e) { alert(e.message); return; }
      try { sessionStorage.setItem(TAPE_KEY, JSON.stringify(tape)); sessionStorage.removeItem(EJECTED_KEY); } catch (e) {}
      history.replaceState(null, '', location.pathname);   // drop any ?demo=: the dropped tape takes over
      K.loadCustom(tape);
      maybeJumpToStudio();
    };
    rd.readAsText(file);
  }
  $('pkFile').addEventListener('change', () => openTape($('pkFile').files[0]));
  (function dropAnywhere() {
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; document.body.classList.add('drop-over'); });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; document.body.classList.remove('drop-over'); } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; document.body.classList.remove('drop-over');
      openTape(e.dataTransfer.files[0]);
    });
  })();

  /* ---------------- auto-studio: a switch for what opening a tape does ----------------
     Off (default): the tape plays here, in preview. On: it jumps straight to the studio with that tape —
     the deck's own #go link already points there (cartridge.js keeps it current), so this just follows it. */
  const MODE_KEY = 'vcr-open-mode';
  const autoStudio = () => (localStorage.getItem(MODE_KEY) || 'preview') === 'studio';
  const btnAuto = $('btnAutoStudio');
  function syncAutoBtn() {
    const on = autoStudio();
    btnAuto.setAttribute('aria-pressed', String(on));
    btnAuto.querySelector('.led').classList.toggle('on', on);
  }
  btnAuto.addEventListener('click', () => {
    try { localStorage.setItem(MODE_KEY, autoStudio() ? 'preview' : 'studio'); } catch (e) {}
    syncAutoBtn();
  });
  syncAutoBtn();
  function maybeJumpToStudio() {
    const go = $('go'), href = go && go.getAttribute('href');
    if (autoStudio() && href) location.href = href;
  }
  // cartridge.js's own picker click handler runs first (same element, registered earlier) and updates
  // #go before this one fires, so the href above is already the newly-picked demo's.
  const picker = $('picker'); if (picker) picker.addEventListener('click', (e) => { if (e.target.closest('.mc-pick')) maybeJumpToStudio(); });

  /* ---------------- boot: ?demo=, a tape handed over (sessionStorage), or the deck's own default ----------------
     Waits on K.ready: the demo shelf's tapes (js/shared/demo-tapes.js) are fetched once and the deck already
     selects its own default from them, so ?demo= or a handed-over tape only need to override that choice. */
  K.ready.then(() => {
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo) { K.selectDemo(demo); maybeJumpToStudio(); return; }
    if (sessionStorage.getItem(EJECTED_KEY)) return;   // ejected in the studio: keep the deck's own default demo
    const saved = sessionStorage.getItem(TAPE_KEY);
    if (saved) { try { K.loadCustom(JSON.parse(saved)); maybeJumpToStudio(); } catch (e) { sessionStorage.removeItem(TAPE_KEY); } }
  });

  /* ---------------- the preview: everything the tape holds, as cards (same as the landing's Track 01) ---------------- */
  const { S } = K;
  const inv = $('inventory');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const short = (s, n) => { s = String(s || '').split('\n')[0]; return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const base = (p) => String(p).split('/').pop();
  const pad = (n) => String(n).padStart(2, '0');
  const dhm = (ms) => (ms >= 3600000 ? Math.floor(ms / 3600000) + 'h ' + pad(Math.round((ms % 3600000) / 60000)) + 'm' : ms >= 60000 ? Math.round(ms / 60000) + ' min' : Math.round(ms / 1000) + 's');
  const tokn = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));
  let invFor = null;
  function renderInventory() {
    if (!S.D || !S.D.tape || invFor === S.D || !window.analyzeTape) return;
    invFor = S.D;
    const R = window.analyzeTape(S.D.tape), T = R.tokens;
    $('invTitle').textContent = R.title;
    const reportHref = K.studioHref(); $('invLink').href = reportHref + (reportHref.includes('?') ? '&' : '?') + 'view=report';
    const list = (items) => items.length ? '<ul>' + items.map((x) => '<li>' + x + '</li>').join('') + '</ul>' : '';
    const none = (what) => '<p class="inv-none">' + what + '</p>';
    const card = (col, label, num, unit, body) => '<article class="inv-card" style="--k:var(' + col + ')"><p class="inv-lbl">' + label + '</p><p class="inv-num"><b class="dot">' + num + '</b>' + (unit ? '<span>' + unit + '</span>' : '') + '</p>' + body + '</article>';
    inv.innerHTML = [
      card('--c-prompt', 'Prompts &amp; replies', R.kinds.prompt, 'prompts · ' + R.kinds.text + ' replies', list([esc(short(R.prompts[0] && R.prompts[0].text, 90))])),
      card('--c-bash', 'Tool calls', R.kinds.tool, 'calls · ' + R.tools.length + ' tools', list(R.tools.slice(0, 4).map((t) => '<b>' + esc(t.name) + '</b> ×' + t.calls + (t.errors ? ' <em>' + t.errors + ' failed</em>' : '')))),
      card('--c-write', 'Files touched', R.files.length, 'read, written or edited', list(R.files.slice(0, 3).map((f) => '<code>' + esc(base(f.path)) + '</code> ' + ['read', 'write', 'edit'].filter((k) => f[k]).map((k) => k + ' ×' + f[k]).join(', ')))),
      card('--err', 'Errors', R.errors.length, R.errors.length ? 'failed calls' : 'nothing failed', list(R.errors.slice(0, 2).map((e) => '<b>' + esc(e.tool) + '</b> <code>' + esc(short(e.input, 40)) + '</code>'))),
      card('--orange', 'Tokens &amp; cost', '$' + T.cost.toFixed(2), tokn(T.input) + ' in · ' + tokn(T.out) + ' out', list(['cache hit <b>' + Math.round(T.cacheHit * 100) + '%</b>', 'peak context <b>' + tokn(T.peakContext) + '</b>'])),
      card('--c-text', 'Time', dhm(R.duration), 'long', list([dhm(R.time.active) + ' working', dhm(R.time.idle) + ' idle'])),
    ].join('');
  }
  K.onFrame(renderInventory);
})();
