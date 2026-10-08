/* VCR Deck Studio: the tape bay. The loaded tape as the 3D data cartridge (cart3d.js), above the inspector:
   its reels wound by the session's length, turning as the playhead moves (the left reel pays out, the right
   one takes up). Drag to turn it, double-click to face it. P or the top-bar key shows and hides it; EJECT
   lifts the cartridge out before eject.js empties the deck (window.VCRBay.eject). Without WebGL it shows the
   flat cartridge instead. Loaded by eject.js after app.js; reads the player through window.VCRDeckStudio. */
(function () {
  'use strict';
  const P = window.VCRDeckStudio, C3 = window.VCRCart3D, T = window.THREE;
  if (!P || !C3) return;
  const $ = (id) => document.getElementById(id);
  const app = $('app'), panel = $('bayPanel'), stageEl = $('bayStage'), cv = $('bayCv');
  const { S, TAPE, DUR } = P;
  const secs = DUR / 1000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const colorVar = window.VCR_TAPE_COLOR || '--orange';   // a demo tape's label colour (eject.js), or the deck's orange
  const model = (TAPE.model || '').replace(/^claude-/, '');
  const label = () => ({
    name: TAPE.title || TAPE.source || 'Untitled session', dur: C3.fmtDur(secs),
    sub: [P.EV.length + ' events', model, TAPE.source].filter(Boolean).join(' · '), color: css(colorVar) || '#FF5B1F',
  });

  // ---------- keys: hide (P, the top-bar key, the chevron) and eject
  $('btnBay').addEventListener('click', () => P.setUI('bay', !P.UI.bay));
  $('bayHide').addEventListener('click', () => P.setUI('bay', false));
  $('bayEject').addEventListener('click', () => { if (window.VCREject) window.VCREject(); });
  const pos = $('bayPos');
  let lastSec = -1;
  const showing = () => !app.hidden && P.UI.bay && !app.classList.contains('book-mode') && panel.offsetParent !== null;

  // ---------- no WebGL: the flat cartridge, as on the demo shelf
  function flat() {
    panel.classList.add('no-gl');
    const L = label();
    $('bayFlat').innerHTML = C3.miniCart({ name: L.name, sec: secs, c: 'var(' + colorVar + ')', foot: [model || '', C3.fmtDur(secs)], attrs: 'tabindex="-1" disabled' });
    P.onFrame(() => tick());
    window.VCRBay = { eject: () => null };
  }
  function tick() {
    const s = Math.floor(S.t / 1000);
    if (s !== lastSec) { lastSec = s; pos.textContent = P.fmtClock(S.t) + ' / ' + P.fmtClock(DUR); }
  }

  let renderer = null;
  try { renderer = T && new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { renderer = null; }
  if (!renderer) return flat();

  const st = C3.stage(renderer), scene = st.scene, camera = st.camera;
  st.background(panel);                       // the glass sees the panel it sits in, not the page
  const cart = C3.cartridge();
  scene.add(cart.group);
  cart.setLabel(label());
  let dirty = true;
  st.onTheme(() => { cart.tintFrost(); cart.setLabel(label()); dirty = true; });

  // ---------- drag to turn, with a little inertia; double-click to face it; it settles back after a while
  const REST = { x: -0.2, y: -0.4 }, pose = { x: REST.x, y: REST.y }, vel = { x: 0, y: 0 };
  let drag = null, lastInput = -1e9;
  cv.addEventListener('pointerdown', (e) => { if (e.button > 0) return; drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    vel.y = (e.clientX - drag.x) * 0.01; vel.x = (e.clientY - drag.y) * 0.008;
    pose.y += vel.y; pose.x = Math.max(-1.3, Math.min(1.3, pose.x + vel.x));
    drag.x = e.clientX; drag.y = e.clientY; lastInput = performance.now();
  });
  const end = () => { drag = null; cv.classList.remove('drag'); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('dblclick', () => { pose.y = REST.y + Math.round((pose.y - REST.y) / (Math.PI * 2)) * Math.PI * 2; pose.x = REST.x; vel.x = vel.y = 0; lastInput = -1e9; });

  // frame the cartridge's face in the stage, with a little room to turn
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const tv = Math.tan(T.MathUtils.degToRad(camera.fov) / 2);
    camera.position.set(0, 0, Math.max(2.0 / tv, 2.45 / (tv * camera.aspect)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(stageEl); resize();

  // ---------- eject: the cartridge squares up to you, dips as the drive lets go, then lifts out of the bay
  let ej = null;
  const ease = (t) => 1 - Math.pow(1 - t, 3), easeIn = (t) => t * t * t;
  function eject() {
    if (!showing() || reduce) return null;
    return new Promise((done) => { ej = { t0: performance.now(), done }; panel.classList.add('ejecting'); });
  }

  // ---------- every frame of the player: reels from the playhead, the pose, and a render only when something moved
  let lastPlayed = -1;
  P.onFrame((ts) => {
    tick();
    if (!showing()) return;
    const played = Math.max(0, Math.min(1, S.t / DUR));
    if (played !== lastPlayed) { cart.setReel(secs, played); lastPlayed = played; dirty = true; }
    const g = cart.group;
    if (ej) {
      const k = (performance.now() - ej.t0) / 900;
      pose.x = 0; pose.y = Math.round(pose.y / (Math.PI * 2)) * Math.PI * 2;
      g.rotation.x += (pose.x - g.rotation.x) * 0.25; g.rotation.y += (pose.y - g.rotation.y) * 0.25;
      g.position.y = k < 0.25 ? -0.25 * ease(k / 0.25) : -0.25 + 6.5 * easeIn((k - 0.25) / 0.75);
      renderer.render(scene, camera);
      if (k >= 1) { const d = ej.done; ej = null; d(); }
      return;
    }
    if (!drag) {
      vel.x *= 0.9; vel.y *= 0.9;
      if (Math.abs(vel.x) + Math.abs(vel.y) > 1e-4) { pose.y += vel.y; pose.x = Math.max(-1.3, Math.min(1.3, pose.x + vel.x)); }
      if (ts - lastInput > 5000) {            // back to the resting three-quarter view
        const ty = REST.y + Math.round((pose.y - REST.y) / (Math.PI * 2)) * Math.PI * 2;
        pose.y += (ty - pose.y) * 0.03; pose.x += (REST.x - pose.x) * 0.03;
      }
    }
    const dx = pose.x - g.rotation.x, dy = pose.y - g.rotation.y;
    if (Math.abs(dx) > 1e-4 || Math.abs(dy) > 1e-4) { g.rotation.x += dx * 0.2; g.rotation.y += dy * 0.2; dirty = true; }
    if (dirty) { renderer.render(scene, camera); dirty = false; }
  });
  // shown again (P, Customize, back from the book): it may have missed frames
  new MutationObserver(() => { dirty = true; resize(); }).observe(app, { attributes: true, attributeFilter: ['class'] });

  window.VCRBay = { eject };
})();
