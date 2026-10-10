/* VCR · landing. Vanilla JS, works from file://.
   The hero deck plays the real tape in js/shared/sample-tape.js (the same one the
   player loads), drawn as the player's LED lanes. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- theme ---------------- */
  const root = document.documentElement;
  const curTheme = () => root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function toggleTheme() {
    const next = curTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('vcr-ds-theme', next); } catch (e) { /* private mode */ }
  }
  $('btnTheme').addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 't' || e.key === 'T') toggleTheme();
  });

  /* ---------------- toast + copy ---------------- */
  const toastEl = $('toast'); let toastT = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1600); }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const txt = b.dataset.copy;
    const done = () => toast('COPIED ✓');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  });
  function fallbackCopy(txt, done) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('COPY FAILED'); }
    ta.remove();
  }

  /* ---------------- "Open a tape": pick a session log, play it in the player ----------------
     Every [data-open-tape] opens the file picker. The chosen .jsonl is read and parsed here, in the page (nothing
     is uploaded), and handed to the player the way its own eject does: stored in sessionStorage under the key
     eject.js reads, then the player opens with it. Without script the buttons are plain links to the player. */
  const TAPE_KEY = 'vcr-ds-tape', EJECTED_KEY = 'vcr-ds-ejected';
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = '.jsonl,.json,application/jsonl,application/x-ndjson,application/json'; picker.hidden = true;
  document.body.appendChild(picker);
  document.querySelectorAll('[data-open-tape]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); picker.value = ''; picker.click(); }));
  picker.addEventListener('change', () => {
    const file = picker.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onerror = () => toast('Couldn\u2019t read ' + file.name);
    rd.onload = () => {
      let tape;
      try { tape = window.parseTape(rd.result, file.name); } catch (err) { toast('Not a session log: ' + file.name); return; }
      try { sessionStorage.setItem(TAPE_KEY, JSON.stringify(tape)); sessionStorage.removeItem(EJECTED_KEY); }
      catch (err) { toast('That tape is too big to hand to the player'); return; }
      // the player's AUTO-STUDIO switch: on, it jumps straight to the studio instead of previewing it there
      const go = () => { location.href = (localStorage.getItem('vcr-open-mode') || 'preview') === 'studio' ? 'exp/deck-studio.html' : 'player.html'; };
      // picked from the closing screen: let the tape finish going into the deck first
      const outroEl = $('outro'); if (outroEl && outroEl.classList.contains('arm') && !reduce) setTimeout(go, 1300); else go();
    };
    rd.readAsText(file);
  });

  /* ---------------- the FAQ's count of demo tapes: however many the shelf actually loaded ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    const el = $('demoCount'); if (!el || !window.VCRDemoTapes) return;
    const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
    window.VCRDemoTapes.list('').then((list) => { if (list.length) el.textContent = (WORDS[list.length] || list.length) + ' real'; });
  });

  /* ---------------- the closing screen: a blank tape over the deck's slot ----------------
     Built once the page's scripts are in (cart3d.js comes after this file). Reaching for "Select a file", or for the
     tape itself, arms it: the tape slides into the slot (CSS, .arm); clicking the tape opens the picker too. */
  document.addEventListener('DOMContentLoaded', () => {
    const well = $('outroTape'), outro = $('outro'), cta = outro && outro.querySelector('[data-open-tape]');
    if (!well || !cta || !window.VCRCart3D) return;
    // With WebGL: one 3D scene (cart3d.js), the studio's front-loading deck and the real cartridge, as the studio's
    // empty deck has them (drive.js). Waiting, the tape leans back over the slot, facing you; armed, it lies flat, drops
    // to the slot and slides in through the flap; disarmed, it all runs backward. Drawn only while on screen.
    // Without WebGL, the CSS deck and a flat tape (the markup underneath).
    const rig = outro.querySelector('.rig'), C3 = window.VCRCart3D, T = window.THREE;
    let gl = null;
    try { gl = T && new T.WebGLRenderer({ antialias: true }); } catch (e) { gl = null; }
    if (gl) {
      rig.classList.add('rig-gl');
      const cv = gl.domElement; cv.className = 'rig-cv'; cv.setAttribute('aria-hidden', 'true'); rig.prepend(cv);
      cv.addEventListener('click', () => cta.click());
      const st = C3.stage(gl); st.background(outro.querySelector('.outro-screen'));
      gl.toneMappingExposure = 1.45;   // black hardware on a black screen: a little more light than the hero's stage
      const drive = C3.drive(), tape = C3.cartridge();
      const box = new T.Group(); st.scene.add(box); box.add(drive.group);
      drive.group.position.z = drive.BD / 2 - 0.3;   // square to you: a frontal view
      const FRONT = drive.group.position.z, SX = drive.SLOT_X;
      const holder = new T.Group(); box.add(holder); holder.add(tape.group); st.onTheme(tape.tintFrost);
      const orange = getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() || '#FF5B1F';
      tape.setLabel({ name: 'Your session', dur: C3.fmtDur(47 * 60), sub: '.jsonl · ready to play', color: orange });
      tape.setReel(47 * 60, 0);
      const WAIT = { y: drive.SLOT_Y + 2.25, z: FRONT + 0.7, rx: -0.5 };            // the studio's poses (drive.js)
      const MOUTH = { y: drive.SLOT_Y, z: FRONT + 1.75, rx: -Math.PI / 2 };         // flat, its top edge at the slot
      const IN = FRONT - 3.6;   // far enough that its tail is through the flap
      const cam = st.camera;
      function size() {
        const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
        gl.setSize(w, h, false); cam.aspect = w / h;
        const tv = Math.tan(T.MathUtils.degToRad(cam.fov) / 2), d = Math.max(3.55 / tv, 5.05 / (tv * cam.aspect));   // the deck and the tape over it, filling the frame
        const target = new T.Vector3(-0.15, 1.15, 0.4), dir = new T.Vector3(0, 0.1, 1).normalize();   // nearly straight on, a touch above
        cam.position.copy(target).addScaledVector(dir, d); cam.lookAt(target); cam.updateProjectionMatrix();
      }
      new ResizeObserver(size).observe(cv); size();
      const ease = (x) => x * x * (3 - 2 * x), clamp01 = (x) => Math.max(0, Math.min(1, x));
      let p = 0, last = 0, seen = false, raf = 0, lcd = '';
      function frame(ts) {
        const dt = last ? Math.min(64, ts - last) : 16; last = ts;
        const want = outro.classList.contains('arm') ? 1 : 0;
        p += Math.sign(want - p) * Math.min(Math.abs(want - p), reduce ? 1 : dt / 1300);
        const lie = ease(clamp01(p / 0.45)), slide = ease(clamp01((p - 0.45) / 0.55));
        const bob = reduce ? 0 : Math.sin(ts / 700) * 0.08 * (1 - lie);
        holder.position.set(SX, WAIT.y + (MOUTH.y - WAIT.y) * lie + bob, WAIT.z + (MOUTH.z - WAIT.z) * lie + (IN - MOUTH.z) * slide);
        holder.rotation.set(WAIT.rx + (MOUTH.rx - WAIT.rx) * lie, (reduce ? 0 : Math.sin(ts / 1900) * 0.12) * (1 - lie), 0);
        // the flap swings in as the leading edge reaches it, and falls back once the tape is past
        const lead = holder.position.z - 1.5 - FRONT, tail = holder.position.z + 1.5 - FRONT;
        drive.flap(slide > 0 ? (tail < -0.1 ? clamp01(1 + (tail + 0.1) * 4) : clamp01(-lead * 3)) : 0);
        const state = p >= 1 ? 'in' : want ? 'load' : 'wait';
        if (state !== lcd || state === 'load') {
          lcd = state;
          if (state === 'wait') { drive.setLCD('INSERT TAPE', false, { mode: '' }); drive.setLED('amber', 1); drive.setLED('off', 2); }
          else if (state === 'load') { drive.setLCD('LOADING' + '...'.slice(0, Math.floor(ts / 300) % 4), false, { tape: slide > 0 }); drive.setLED(Math.floor(ts / 160) % 2 ? 'off' : 'amber', 1); drive.setLED(slide > 0 ? 'green' : 'off', 2); }
          else { drive.setLCD('READY', false, { tape: true, mode: 'stop', counter: '0:00:00' }); drive.setLED('off', 1); drive.setLED('green', 2); }
        }
        gl.render(st.scene, cam);
        raf = seen ? requestAnimationFrame(frame) : 0;
      }
      new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen && !raf) { last = 0; raf = requestAnimationFrame(frame); } }).observe(cv);
    } else {
      well.innerHTML = '<div class="rig-slide"><div class="rig-bob">' + C3.miniCart({ name: 'Your session', sec: 47 * 60, c: 'var(--orange)', foot: ['', ''], attrs: 'tabindex="-1"' }) + '</div></div>';
      well.querySelector('.rig-bob').addEventListener('click', () => cta.click());
    }
    // the tape goes in when you ask for a file (this CTA, or a click on the deck, which presses it): .arm. If the picker
    // is closed without one it comes back out; with one, it stays in and the player opens once it's in (the picker's
    // change handler above waits for it).
    const arm = (on) => outro.classList.toggle('arm', on);
    cta.addEventListener('click', () => arm(true));
    picker.addEventListener('cancel', () => arm(false));
    // (browsers without the cancel event: back from the dialog with no file chosen)
    window.addEventListener('focus', () => { if (outro.classList.contains('arm')) setTimeout(() => { if (!picker.files.length) arm(false); }, 400); });
  });

  /* ---------------- drop a tape anywhere on the page: loads it into the hero deck right here, in place ----------------
     Unlike the file picker above (which hands off to the player), a drop stays on the page: the dropped tape
     plays in the hero immediately (cartridge.js's loadCustom), and it's also stashed in sessionStorage so the
     "open in studio" link Track 01 builds (landing-deck.js, via K.studioHref) carries it over correctly. */
  (function dropAnywhere() {
    const overlay = $('dropOverlay');
    const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    let depth = 0;
    window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; depth++; overlay.classList.add('on'); });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; overlay.classList.remove('on'); } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; overlay.classList.remove('on');
      const file = e.dataTransfer.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onerror = () => toast('Couldn’t read ' + file.name);
      rd.onload = () => {
        let tape;
        try { tape = window.parseTape(rd.result, file.name); } catch (err) { toast('Not a session log: ' + file.name); return; }
        if (!window.VCRCartridge) { toast('Still loading — try again in a moment'); return; }
        try { sessionStorage.setItem(TAPE_KEY, JSON.stringify(tape)); sessionStorage.removeItem(EJECTED_KEY); } catch (err) {}
        window.VCRCartridge.loadCustom(tape);
        document.getElementById('top').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      };
      rd.readAsText(file);
    });
  })();

  /* ---------------- the holo sticker tilts and catches a rainbow as the pointer crosses it ----------------
     The same technique as the Pokémon card effect at poke-holo.simey.me (simeydotme/pokemon-cards-css),
     simplified to plain CSS custom properties instead of their spring-physics library: percent position
     within the sticker drives a radial glare (--holo-px/py) and the rainbow shine's own position
     (--holo-bx/by), and how far off-center the pointer is drives a 3D tilt (--holo-rx/ry). CSS (not JS)
     eases the return to flat when the pointer leaves — see the sticker's transition-property. */
  (function holoTilt() {
    const el = $('holoSticker');
    if (!el) return;
    const set = (rx, ry, px, py, bx, by) => {
      el.style.setProperty('--holo-rx', rx); el.style.setProperty('--holo-ry', ry);
      el.style.setProperty('--holo-px', px); el.style.setProperty('--holo-py', py);
      el.style.setProperty('--holo-bx', bx); el.style.setProperty('--holo-by', by);
    };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      set(((px - 0.5) * 26).toFixed(2) + 'deg', (-(py - 0.5) * 26).toFixed(2) + 'deg',
        (px * 100).toFixed(1) + '%', (py * 100).toFixed(1) + '%', (px * 100).toFixed(1) + '%', (py * 100).toFixed(1) + '%');
    });
    el.addEventListener('pointerleave', () => set('0deg', '0deg', '50%', '50%', '50%', '50%'));
  })();

  /* ---------------- a link to a FAQ answer opens it ----------------
     The holo sticker's "Where do I find one?" points at #faq-paths; <details> doesn't open itself just
     because it's the scroll target, so open it by hand on load and on every further such link. */
  (function openLinkedFaq() {
    const openTarget = () => { const d = document.getElementById(location.hash.slice(1)); if (d && d.tagName === 'DETAILS') d.open = true; };
    window.addEventListener('hashchange', openTarget);
    openTarget();
  })();

  /* ---------------- agent slot ----------------
     Each agent's mark (the same paths as the root landing page) and name. The slot keeps one fixed width,
     the widest name's, so swapping names never reflows the headline. */
  const AGENTS = [
    ['CLAUDE CODE', '', 'M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z'],
    ['CODEX', 'exp', 'M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z'],
    ['GEMINI CLI', 'soon', 'M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z'],
    ['CURSOR', 'soon', 'M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z'],
    ['COPILOT', 'soon', 'M9 23l.073-.001a2.53 2.53 0 01-2.347-1.838l-.697-2.433a2.529 2.529 0 00-2.426-1.839h-.497l-.104-.002c-4.485 0-2.935-5.278-1.75-9.225l.162-.525C2.412 3.99 3.883 1 6.25 1h8.86c1.12 0 2.106.745 2.422 1.829l.715 2.453a2.53 2.53 0 002.247 1.823l.147.005.534.001c3.557.115 3.088 3.745 2.156 7.206l-.113.413c-.154.548-.315 1.089-.47 1.607l-.163.525C21.588 20.01 20.116 23 17.75 23h-8.75zm8.22-15.89l-3.856.001a2.526 2.526 0 00-2.35 1.615L9.21 15.04a2.529 2.529 0 01-2.43 1.847l3.853.002c1.056 0 1.992-.661 2.361-1.644l1.796-6.287a2.529 2.529 0 012.43-1.848z'],
    ['KIRO', 'soon', 'M4.594 6.677C6.67-2.226 18.746-2.211 21.16 6.632c.353 1.297 1.725 7.582-1.673 13.747-1.545 2.797-5.841 5.49-6.99 1.883C8.6 25.477 3.315 24.1 5.789 18.609l-.318.143c-3.57 1.305-3.863-1.208-3.173-2.513.45-.84.727-1.335.937-1.897.353-.975.458-1.568.593-2.498.27-1.837.277-3.607.765-5.167zm8.37.01a.92.92 0 00-.81.428c-.217.323-.33.825-.33 1.462 0 .705.15 1.89 1.14 1.89h.008c.757 0 1.214-.705 1.214-1.89 0-.622-.127-1.125-.367-1.455a1.014 1.014 0 00-.855-.435zm4.08 0a.92.92 0 00-.81.428c-.217.323-.33.825-.33 1.462 0 .705.15 1.89 1.14 1.89h.008c.757 0 1.215-.705 1.215-1.89 0-.622-.128-1.125-.368-1.455a1.014 1.014 0 00-.855-.435z'],
  ];
  const slot = $('agentSlot'), logo = $('agentLogo'), nameEl = $('agentName'); let ai = 0;
  // The mark, drawn in the same dots as the Doto name beside it. Doto's dots sit 0.1em apart and are 0.088em wide
  // (measured), so a cell here is 0.1 x the name's font size, snapped to whole device pixels, and every dot is that
  // cell minus a one-device-pixel gap: all the same size, all the same gap, none merging. A cell is lit when the
  // real logo covers enough of it (sampled 4 x 4 per cell), in the slot's colour.
  const SUB = 4, DOTO_PITCH = 0.1;
  function drawMark(d) {
    const r = logo.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(1, Math.round(r.width * dpr));
    if (logo.width !== W) { logo.width = W; logo.height = W; }
    const cell = Math.max(2, Math.round(parseFloat(getComputedStyle(nameEl).fontSize) * DOTO_PITCH * dpr));   // device px
    const PIX = Math.max(6, Math.floor(W / cell)), off0 = Math.floor((W - PIX * cell) / 2), dot = cell - 1;
    const n = PIX * SUB, off = document.createElement('canvas'); off.width = off.height = n;
    const g = off.getContext('2d'); g.scale(n / 24, n / 24); g.fill(new Path2D(d));
    const a = g.getImageData(0, 0, n, n).data, ctx = logo.getContext('2d');
    ctx.clearRect(0, 0, W, W); ctx.fillStyle = getComputedStyle(slot).color;
    for (let y = 0; y < PIX; y++) for (let x = 0; x < PIX; x++) {
      let cov = 0;
      for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) cov += a[(((y * SUB + sy) * n) + x * SUB + sx) * 4 + 3];
      if (cov / (SUB * SUB * 255) > 0.45) ctx.fillRect(off0 + x * cell, off0 + y * cell, dot, dot);
    }
  }
  function fitSlot() {
    slot.style.width = '';
    const keep = nameEl.textContent; let w = 0;
    for (const [n] of AGENTS) { nameEl.textContent = n; w = Math.max(w, slot.getBoundingClientRect().width); }
    nameEl.textContent = keep; slot.style.width = Math.ceil(w) + 'px';
  }
  fitSlot(); drawMark(AGENTS[0][2]);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSlot);
  addEventListener('resize', () => { fitSlot(); drawMark(AGENTS[ai][2]); });
  function showAgent(i) {
    ai = i;
    const [n, c, d] = AGENTS[ai];
    nameEl.textContent = n; slot.setAttribute('aria-label', 'Agent: ' + n + '. Show the agents');
    slot.className = 'agent-slot' + (c ? ' ' + c : '');
    drawMark(d);   // after the class, so it picks up this agent's colour
  }
  let rotating = reduce ? 0 : setInterval(() => {
    slot.classList.add('swap');
    setTimeout(() => showAgent((ai + 1) % AGENTS.length), 200);
  }, 2400);

  // click the slot: the list of agents, each with its mark and how far along support is. Picking one shows it in
  // the headline and stops the rotation.
  const menu = $('agentMenu'), STATUS = { '': ['Supported', 'ok'], exp: ['Experimental', 'exp'], soon: ['Soon', ''] };
  menu.innerHTML = AGENTS.map(([n, c, d], i) => '<button role="option" data-agent="' + i + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>' +
    '<span class="nm">' + n + '</span><span class="st ' + STATUS[c][1] + '">' + STATUS[c][0] + '</span></button>').join('');
  const setMenu = (open) => {
    menu.hidden = !open; slot.setAttribute('aria-expanded', String(open));
    menu.querySelectorAll('[data-agent]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.agent === ai)));
    if (open) menu.querySelector('[aria-selected="true"]').focus();
  };
  slot.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-agent]'); if (!b) return;
    clearInterval(rotating); rotating = 0; slot.classList.remove('swap');
    showAgent(+b.dataset.agent); setMenu(false); slot.focus();
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...menu.querySelectorAll('[data-agent]')], k = items.indexOf(document.activeElement);
    items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.agent-pick')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); slot.focus(); } });

  /* ---------------- features: each bento card's illustration plays in as it scrolls into view ---------------- */
  const bento = $('bento');
  if (bento && !reduce && 'IntersectionObserver' in window) {
    bento.classList.add('anim');
    const io = new IntersectionObserver((ens) => ens.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { threshold: 0.35 });
    bento.querySelectorAll('.bento-card').forEach((c) => io.observe(c));
  }
  // touch screens have no hover: a tap gives a card its colours (and takes them from the one that had them)
  if (bento && matchMedia('(hover: none)').matches) {
    const cards = [...bento.querySelectorAll('.bento-card')];
    cards.forEach((c) => c.addEventListener('click', () => {
      const on = !c.classList.contains('on');
      cards.forEach((o) => o.classList.toggle('on', on && o === c));
    }));
  }

  /* ---------------- terminal tabs ---------------- */
  const cmds = [...document.querySelectorAll('.cmd')], panes = [...document.querySelectorAll('.pane')];
  function showPane(id) {
    cmds.forEach((c) => { const on = c.dataset.pane === id; c.classList.toggle('on', on); c.setAttribute('aria-selected', String(on)); });
    panes.forEach((p) => p.classList.toggle('on', p.dataset.pane === id));
  }
  cmds.forEach((c) => c.addEventListener('click', () => showPane(c.dataset.pane)));
  const cmdList = document.querySelector('.cmd-list');   // the CLI section is out for now (index.html)
  if (cmdList) cmdList.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = cmds.findIndex((c) => c.classList.contains('on')), n = cmds[(i + (e.key === 'ArrowDown' ? 1 : cmds.length - 1)) % cmds.length];
    e.preventDefault(); n.focus(); showPane(n.dataset.pane);
  });

  /* ---------------- the hero's transport controls follow you into the bar ----------------
     Once .cart-keys scrolls out from under the sticky bar, its exact node (not a copy: cartridge.js
     found it by id, and moving a node keeps every listener on it) moves into the bar, before the
     "Open a tape" key; scrolling back up puts it right back where it was. */
  (function followControlsIntoBottomBar() {
    const keys = document.querySelector('.cart-keys'), dock = $('bottomBar');
    if (!keys || !dock || !('IntersectionObserver' in window)) return;
    const home = keys.parentNode;
    // a fixed marker at the controls' own spot: once they move into the fixed bottom dock, their own
    // position no longer says anything about scroll, so what's watched is this marker, left behind.
    const anchor = document.createElement('span');
    anchor.setAttribute('aria-hidden', 'true');
    home.insertBefore(anchor, keys);
    let inDock = false;
    new IntersectionObserver(([en]) => {
      const wantInDock = !en.isIntersecting;
      if (wantInDock === inDock) return;   // already where it should be
      inDock = wantInDock;
      if (inDock) dock.appendChild(keys); else home.insertBefore(keys, anchor.nextSibling);
      dock.classList.toggle('on', inDock);
    }, { rootMargin: '-78px 0px 0px 0px' }).observe(anchor);   // -78px: roughly the sticky top bar's height
  })();

  /* ---------------- nav: light the section you're in ---------------- */
  const navLinks = [...document.querySelectorAll('.nav .seg-btn')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ens) => ens.forEach((en) => {
      if (en.isIntersecting) navLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['review', 'timeline', 'features', 'faq'].forEach((id) => io.observe($(id)));
  }

})();
