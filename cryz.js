/* CRYZ mode — a side panel of style switches. Prefs live in localStorage and
   apply as classes/attributes on <html>; every page that loads cryz.js gets the panel. */
(function () {
  'use strict';
  var KEY = 'cryz-prefs';
  var SKINS_ENABLED = false; /* Theme (skins) row hidden for now; flip to true to show */
  var TOGGLES = [
    { id: 'field', label: 'Dusk field', def: false },
    { id: 'mono', label: 'Monochrome', def: false },
    { id: 'heroBg', label: 'Hero background', def: true },
    { id: 'heroIcons', label: 'Hero icons', def: true }
  ];
  var THEMES = [
    { id: 'system', label: 'System', icon: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>' },
    { id: 'light', label: 'Light', icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>' },
    { id: 'dark', label: 'Dark', icon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' }
  ];
  var ACCENTS = [
    { id: 'pink', label: 'Pink', dot: '#ea3f8b' },
    { id: 'bn', label: 'B/N', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/>' },
    { id: 'blue', label: 'Blue', dot: '#2f6fed' },
    { id: 'green', label: 'Green', dot: '#1f9d57' },
    { id: 'amber', label: 'Amber', dot: '#d98324' },
    { id: 'violet', label: 'Violet', dot: '#7c5cff' }
  ];
  var SKINS = [
    { id: 'bento', label: 'Bento (default)', icon: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>' },
    { id: 'os', label: 'OS / Desktop', icon: '<rect x="3" y="4" width="18" height="13" rx="2"/><line x1="9" x2="15" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/><circle cx="6.2" cy="7.2" r="0.9" fill="currentColor" stroke="none"/>' },
    { id: 'terminal', label: 'Terminal', icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m6.5 9 3 3-3 3"/><line x1="12" x2="17.5" y1="15" y2="15"/>' },
    { id: 'halftone', label: 'Halftone', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="0.5" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="0.5" fill="currentColor" stroke="none"/>' }
  ];
  var FIELD_DEFAULTS = { pixel: 4, noise: 1, levels: 7, speed: 1, curve: 1.35, top: 1.08, pos: -14, opacity: 1 };
  var FIELD_SLIDERS = [
    { key: 'pixel', label: 'Pixel size', min: 1, max: 12, step: 1 },
    { key: 'noise', label: 'Grain', min: 0, max: 3, step: 0.1 },
    { key: 'levels', label: 'Bands', min: 2, max: 12, step: 1 },
    { key: 'speed', label: 'Drift', min: 0, max: 4, step: 0.1 },
    { key: 'curve', label: 'Horizon curve', min: 0.4, max: 3, step: 0.05 },
    { key: 'top', label: 'Top intensity', min: 0.8, max: 1.6, step: 0.02 },
    { key: 'pos', label: 'Position', min: -40, max: 20, step: 1 },
    { key: 'opacity', label: 'Opacity', min: 0.1, max: 1, step: 0.05 }
  ];
  var CHEV = '<svg class="cryz-dd-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  function accentIcon(a) {
    var inner = a.dot
      ? '<circle cx="12" cy="12" r="8" fill="' + a.dot + '" stroke="none"/>'
      : a.icon;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  }

  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  TOGGLES.forEach(function (t) { if (typeof state[t.id] !== 'boolean') state[t.id] = t.def; });
  if (THEMES.every(function (t) { return t.id !== state.theme; })) state.theme = 'system';
  if (ACCENTS.every(function (a) { return a.id !== state.accent; })) state.accent = 'pink';
  if (SKINS.every(function (s) { return s.id !== state.skin; })) state.skin = 'bento';
  function skinIcon(s) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + s.icon + '</svg>'; }
  state.fieldParams = Object.assign({}, FIELD_DEFAULTS, state.fieldParams || {});

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function apply() {
    var h = document.documentElement;
    h.classList.toggle('cryz-mono', !!state.mono);
    h.classList.toggle('cryz-field', state.field);
    h.classList.toggle('cryz-no-tilt', state.tilt === false);
    h.classList.toggle('cryz-no-hero-bg', state.heroBg === false);
    h.classList.toggle('cryz-no-hero-icons', state.heroIcons === false);
    h.setAttribute('data-theme', state.theme);
    h.setAttribute('data-accent', state.accent);
    if (window.nanSkin) window.nanSkin.set(state.skin || 'bento');
    if (window.duskField) {
      Object.assign(window.duskField.params, state.fieldParams);
      window.duskField.apply();
    }
  }

  var segTheme, dd, ddBtn, ddList;
  var sDD, sDDBtn, sDDList;

  function closeDD() { if (dd) dd.classList.remove('open'); if (sDD) sDD.classList.remove('open'); }

  function build() {
    var panel = document.createElement('aside');
    panel.className = 'cryz-panel';
    panel.setAttribute('aria-label', 'Cryz mode');
    panel.innerHTML = '<p class="cryz-panel-title">CRYZ MODE</p>';

    /* mode: system / light / dark, as icons */
    var tRow = document.createElement('div');
    tRow.className = 'cryz-seg-row';
    var tLab = document.createElement('span');
    tLab.className = 'cryz-seg-label';
    tLab.textContent = 'Mode';
    segTheme = document.createElement('div');
    segTheme.className = 'cryz-seg';
    segTheme.setAttribute('role', 'radiogroup');
    segTheme.setAttribute('aria-label', 'Mode');
    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = t.label;
      btn.setAttribute('aria-label', t.label);
      btn.setAttribute('role', 'radio');
      btn.dataset.val = t.id;
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + t.icon + '</svg>';
      btn.addEventListener('click', function () {
        state.theme = t.id;
        save(); apply(); sync();
      });
      segTheme.appendChild(btn);
    });
    tRow.appendChild(tLab); tRow.appendChild(segTheme);
    panel.appendChild(tRow);

    /* theme: full-visual skins, in a dropdown */
    if (SKINS_ENABLED) {
    var sRow = document.createElement('div');
    sRow.className = 'cryz-seg-row cryz-dd-row';
    var sLab = document.createElement('span');
    sLab.className = 'cryz-seg-label';
    sLab.textContent = 'Theme';
    sDD = document.createElement('div');
    sDD.className = 'cryz-dd';
    sDDBtn = document.createElement('button');
    sDDBtn.type = 'button';
    sDDBtn.className = 'cryz-dd-btn';
    sDDBtn.setAttribute('aria-haspopup', 'listbox');
    sDDBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dd && dd.classList.remove('open');
      sDD.classList.toggle('open');
    });
    sDDList = document.createElement('div');
    sDDList.className = 'cryz-dd-list';
    sDDList.setAttribute('role', 'listbox');
    SKINS.forEach(function (s) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'cryz-dd-opt';
      opt.dataset.val = s.id;
      opt.setAttribute('role', 'option');
      opt.innerHTML = '<span class="cryz-dd-ic">' + skinIcon(s) + '</span>' + s.label;
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        state.skin = s.id;
        save(); apply(); sync(); closeDD();
      });
      sDDList.appendChild(opt);
    });
    sDD.appendChild(sDDBtn); sDD.appendChild(sDDList);
    sRow.appendChild(sLab); sRow.appendChild(sDD);
    panel.appendChild(sRow);
    }

    var tuneRow = null;
    TOGGLES.forEach(function (p) {
      if (p.id === 'mono') {
        var sep = document.createElement('div');
        sep.className = 'cryz-sep';
        sep.setAttribute('role', 'separator');
        panel.appendChild(sep);
      }
      var row = document.createElement('label');
      row.className = 'cryz-row';
      var txt = document.createElement('span');
      txt.textContent = p.label;
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = state[p.id];
      var sw = document.createElement('i');
      sw.setAttribute('aria-hidden', 'true');
      input.addEventListener('change', function () {
        state[p.id] = input.checked;
        if (p.id === 'field' && tuneRow) tuneRow.hidden = !input.checked;
        save(); apply();
      });
      row.appendChild(txt); row.appendChild(input); row.appendChild(sw);
      panel.appendChild(row);

      if (p.id === 'field' && window.duskField) {
        tuneRow = document.createElement('button');
        tuneRow.type = 'button';
        tuneRow.className = 'cryz-row cryz-tune-row';
        tuneRow.hidden = !state.field;
        tuneRow.innerHTML = '<span class="cryz-tune-arrow">\u21B3</span><span class="cryz-tune-txt">Tune field</span><span class="cryz-tune-go">\u203A</span>';
        tuneRow.addEventListener('click', function (e) { e.stopPropagation(); openModal(); });
        panel.appendChild(tuneRow);
      }
    });

    /* accent: monochrome + single accent colour, in an icon dropdown */
    var aRow = document.createElement('div');
    aRow.className = 'cryz-seg-row cryz-dd-row';
    var aLab = document.createElement('span');
    aLab.className = 'cryz-seg-label';
    aLab.textContent = 'Accent';
    dd = document.createElement('div');
    dd.className = 'cryz-dd';
    ddBtn = document.createElement('button');
    ddBtn.type = 'button';
    ddBtn.className = 'cryz-dd-btn';
    ddBtn.setAttribute('aria-haspopup', 'listbox');
    ddBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      sDD && sDD.classList.remove('open');
      dd.classList.toggle('open');
    });
    ddList = document.createElement('div');
    ddList.className = 'cryz-dd-list';
    ddList.setAttribute('role', 'listbox');
    ACCENTS.forEach(function (a) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'cryz-dd-opt';
      opt.dataset.val = a.id;
      opt.setAttribute('role', 'option');
      opt.innerHTML = '<span class="cryz-dd-ic">' + accentIcon(a) + '</span>' + a.label;
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        state.accent = a.id;
        save(); apply(); sync(); closeDD();
      });
      ddList.appendChild(opt);
    });
    dd.appendChild(ddBtn); dd.appendChild(ddList);
    aRow.appendChild(aLab); aRow.appendChild(dd);
    panel.appendChild(aRow);

    var reset = document.createElement('button');
    reset.className = 'cryz-reset';
    reset.textContent = 'reset';
    reset.addEventListener('click', function () {
      TOGGLES.forEach(function (t) { state[t.id] = t.def; });
      state.theme = 'system';
      state.accent = 'pink';
      state.skin = 'bento';
      state.fieldParams = Object.assign({}, FIELD_DEFAULTS);
      syncModal();
      save(); apply(); sync();
      panel.querySelectorAll('.cryz-row input').forEach(function (inp, i) {
        inp.checked = state[TOGGLES[i].id];
      });
    });
    panel.appendChild(reset);

    function sync() {
      if (segTheme) segTheme.querySelectorAll('button').forEach(function (b) {
        var on = b.dataset.val === state.theme;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      var cur = ACCENTS.filter(function (a) { return a.id === state.accent; })[0] || ACCENTS[0];
      if (ddBtn) ddBtn.innerHTML = '<span class="cryz-dd-cur"><span class="cryz-dd-ic">' + accentIcon(cur) + '</span>' + cur.label + '</span>' + CHEV;
      if (ddList) ddList.querySelectorAll('.cryz-dd-opt').forEach(function (o) {
        var on = o.dataset.val === state.accent;
        o.classList.toggle('on', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      var curS = SKINS.filter(function (s) { return s.id === (state.skin || 'bento'); })[0] || SKINS[0];
      if (sDDBtn) sDDBtn.innerHTML = '<span class="cryz-dd-cur"><span class="cryz-dd-ic">' + skinIcon(curS) + '</span>' + curS.label + '</span>' + CHEV;
      if (sDDList) sDDList.querySelectorAll('.cryz-dd-opt').forEach(function (o) {
        var on = o.dataset.val === (state.skin || 'bento');
        o.classList.toggle('on', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    sync();

    var opened = false;
    function open(v) {
      opened = v;
      panel.classList.toggle('open', v);
      if (trigger) trigger.setAttribute('aria-expanded', v ? 'true' : 'false');
      if (!v) closeDD();
    }

    var trigger = document.querySelector('a.cryz');
    if (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        open(!opened);
      });
    }

    document.body.appendChild(panel);
    document.addEventListener('click', function (e) {
      if (dd && !dd.contains(e.target)) closeDD();
      if (sDD && !sDD.contains(e.target)) closeDD();
      if (opened && !panel.contains(e.target) && !(trigger && trigger.contains(e.target))) open(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDD(); if (opened) open(false); }
    });
  }

  var modalEl = null;
  function fmtVal(k, v) { return (k === 'pixel' || k === 'levels' || k === 'pos') ? String(Math.round(v)) : v.toFixed(2); }
  function syncModal() {
    if (!modalEl) return;
    modalEl.querySelectorAll('input[type=range]').forEach(function (inp) {
      var k = inp.dataset.key;
      inp.value = state.fieldParams[k];
      var valEl = inp.parentNode.querySelector('.cryz-slider-val');
      if (valEl) valEl.textContent = fmtVal(k, state.fieldParams[k]);
    });
  }
  function closeModal() { if (modalEl) modalEl.classList.remove('open'); }
  function openModal() {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'cryz-modal-root';
      var backdrop = document.createElement('div');
      backdrop.className = 'cryz-modal-backdrop';
      backdrop.addEventListener('click', closeModal);
      var card = document.createElement('div');
      card.className = 'cryz-modal';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', 'Dusk field parameters');
      var head = document.createElement('div');
      head.className = 'cryz-modal-head';
      head.innerHTML = '<p class="cryz-modal-title">DUSK FIELD</p>';
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'cryz-modal-x'; x.setAttribute('aria-label', 'Close');
      x.innerHTML = '\u00d7';
      x.addEventListener('click', closeModal);
      head.appendChild(x); card.appendChild(head);
      var body = document.createElement('div'); body.className = 'cryz-modal-body';
      FIELD_SLIDERS.forEach(function (sl) {
        var row = document.createElement('div'); row.className = 'cryz-slider';
        var lab = document.createElement('label'); lab.textContent = sl.label;
        var val = document.createElement('span'); val.className = 'cryz-slider-val';
        var input = document.createElement('input');
        input.type = 'range'; input.min = sl.min; input.max = sl.max; input.step = sl.step; input.dataset.key = sl.key;
        input.addEventListener('input', function () {
          var v = parseFloat(input.value);
          state.fieldParams[sl.key] = v;
          val.textContent = fmtVal(sl.key, v);
          if (window.duskField) { window.duskField.params[sl.key] = v; window.duskField.apply(); }
          save();
        });
        row.appendChild(lab); row.appendChild(val); row.appendChild(input);
        body.appendChild(row);
      });
      card.appendChild(body);
      var foot = document.createElement('div'); foot.className = 'cryz-modal-foot';
      var resetBtn = document.createElement('button');
      resetBtn.type = 'button'; resetBtn.className = 'cryz-modal-reset'; resetBtn.textContent = 'Reset to defaults';
      resetBtn.addEventListener('click', function () {
        state.fieldParams = Object.assign({}, FIELD_DEFAULTS);
        if (window.duskField) { Object.assign(window.duskField.params, state.fieldParams); window.duskField.apply(); }
        save(); syncModal();
      });
      foot.appendChild(resetBtn); card.appendChild(foot);
      modalEl.appendChild(backdrop); modalEl.appendChild(card);
      document.body.appendChild(modalEl);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modalEl.classList.contains('open')) closeModal(); });
    }
    syncModal();
    requestAnimationFrame(function () { modalEl.classList.add('open'); });
  }

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
