/* VCR Deck Studio: the empty deck's tape deck. A front-loading cartridge deck in 3D (cart3d.js): slot on the left,
   the VFD saying INSERT TAPE and the transport keys on the right. Above the slot, the skeleton of a cartridge: its
   outline in glowing lines, the tape that isn't there yet. Drag a session log over the page and the skeleton
   drops toward the slot; load one (a file, the sample, a demo cartridge) and a real cartridge takes its place,
   lies flat and slides in through the flap, then the deck loads it.
   The keys work: EJECT (or the slot, or the skeleton) opens a tape; PLAY, REW, FF and STOP press in and tell you
   there's no tape. Real shadows, on the deck and on the desk under it.
     const d = VCRDrive.mount(hostEl, { open })   null without WebGL. open(): pick a file
     d.over(on)                                    a file is being dragged over the page
     d.insert({ name, dur, sub, color, secs })     → Promise, resolved once the tape is in
   Used by eject.js. */
(function () {
  'use strict';
  function mount(host, opts) {
    opts = opts || {};
    const T = window.THREE, C3 = window.VCRCart3D;
    if (!T || !C3) return null;
    const cv = host.querySelector('canvas');
    let renderer = null;
    try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch (e) { return null; }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    const dark = () => { const a = document.documentElement.getAttribute('data-theme'); return a ? a === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };

    const st = C3.stage(renderer), scene = st.scene, camera = st.camera;
    // shadows: the key light casts them, soft, onto the deck and the desk
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    const sun = st.sun;
    sun.position.set(-5, 11, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    const drive = C3.drive(), cart = C3.cartridge();
    cart.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // the rig: the deck turned a little to show its side; the tape's holder lives in its space, so the slot path stays straight
    const rig = new T.Group(); scene.add(rig);
    rig.add(drive.group);
    drive.group.position.z = drive.BD / 2 - 0.3;                         // turn about the middle of the case, not its face
    const FRONT = drive.group.position.z, SX = drive.SLOT_X;
    // the desk: shows only the shadows falling on it, so the page stays the page
    const desk = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: dark() ? 0.5 : 0.22 }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -drive.BH / 2 - 0.1; desk.receiveShadow = true; rig.add(desk);

    // the cartridge rides on a holder: leaning back to face you while it waits, flat (label up, top edge first) to go in
    const holder = new T.Group(); rig.add(holder);
    const skel = cart.skeleton(); holder.add(skel);
    holder.add(cart.group); cart.group.visible = false;
    const pick = new T.Mesh(new T.BoxGeometry(4.2, 3.2, 0.6), new T.MeshBasicMaterial({ visible: false })); holder.add(pick);   // to click the skeleton
    const WAIT = { y: drive.SLOT_Y + 2.25, z: FRONT + 0.7, rx: -0.5 };
    const MOUTH = { y: drive.SLOT_Y, z: FRONT + 1.75, rx: -Math.PI / 2 };   // flat, its top edge at the slot
    holder.position.set(SX, WAIT.y, WAIT.z); holder.rotation.x = WAIT.rx;
    st.onTheme(() => { cart.tintFrost(); skel.material.color.setStyle(css('--orange') || '#FF5B1F'); desk.material.opacity = dark() ? 0.5 : 0.22; });

    // framing: the whole deck, and the tape waiting over it
    function resize() {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      const tv = Math.tan(T.MathUtils.degToRad(camera.fov) / 2), d = Math.max(3.2 / tv, 4.25 / (tv * camera.aspect));
      const target = new T.Vector3(-0.1, 0.95, 0), dir = new T.Vector3(0, 0.3, 1).normalize();
      camera.position.copy(target).addScaledVector(dir, d); camera.lookAt(target);
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(host); resize();

    // ---- pointer: the deck turns a touch toward it; keys light up under it and press when clicked
    let aim = 0, hoverKey = null, over = false, ins = null, visible = true;
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    const targets = [...drive.keys.map((k) => k.mesh), drive.pwr, drive.mouth, drive.flapMesh, pick];
    function hit(e) {
      const r = cv.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const h = ray.intersectObjects(targets, false)[0];
      if (!h) return null;
      if (h.object.userData.key) return h.object.userData.key;
      return h.object === drive.pwr ? 'power' : 'slot';
    }
    window.addEventListener('pointermove', (e) => { aim = (e.clientX / innerWidth - 0.5) * 0.24; });
    cv.addEventListener('pointermove', (e) => { hoverKey = hit(e); cv.style.cursor = hoverKey && !ins ? 'pointer' : ''; });
    cv.addEventListener('pointerleave', () => { hoverKey = null; cv.style.cursor = ''; });
    // a message on the display for a moment
    let flash = null;
    const say = (text, mode, ms) => { flash = { text, mode, until: performance.now() + (ms || 1300) }; };
    const presses = {};   // key → when it was pressed
    cv.addEventListener('click', (e) => {
      if (ins) return;
      const k = hit(e);
      if (!k) return;
      if (k !== 'slot' && k !== 'power') presses[k] = performance.now();
      if (k === 'slot' || k === 'eject') { say('OPEN A TAPE', 'stop', 1600); if (opts.open) setTimeout(opts.open, k === 'eject' ? 180 : 0); }
      else if (k === 'power') say('STANDING BY', '', 1200);
      else say('NO TAPE', k, 1400);
    });

    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(host);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), clamp01 = (t) => Math.max(0, Math.min(1, t));

    function frame(ts) {
      if (!host.isConnected) return;
      requestAnimationFrame(frame);
      if (!visible) return;
      rig.rotation.y += (0.2 + aim - rig.rotation.y) * 0.05;
      // keys press in and spring back; the one under the pointer warms up
      for (const x of drive.keys) {
        const t0 = presses[x.name], k = t0 ? (ts - t0) / 260 : 1;
        drive.pressKey(x.name, k < 1 ? Math.sin(k * Math.PI) : 0);
        if (k >= 1) delete presses[x.name];
        x.mesh.material.emissive.setHex(hoverKey === x.name && !ins ? 0x2a1206 : 0x000000);
      }
      if (ins) insertFrame(ts);
      else {
        // waiting: the skeleton bobs and turns a little, its lines breathing; the display blinks INSERT TAPE
        const bob = reduce ? 0 : Math.sin(ts / 700) * 0.08, lean = over ? 1 : 0;
        holder.position.y += (WAIT.y - lean * 1.1 + bob - holder.position.y) * 0.12;
        holder.position.z += (WAIT.z + lean * 0.5 - holder.position.z) * 0.12;
        holder.rotation.x += (WAIT.rx - lean * 0.6 - holder.rotation.x) * 0.12;
        holder.rotation.y = reduce ? 0 : Math.sin(ts / 1900) * 0.14;
        skel.material.opacity = over ? 1 : 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(ts / 520));
        const f = flash && ts < flash.until ? flash : null;
        if (!f) flash = null;
        drive.flap(over ? 0.25 : f && f.text === 'OPEN A TAPE' ? 0.3 : 0);
        const blink = Math.floor(ts / 800) % 2 === 0;
        if (f) drive.setLCD(f.text, false, { mode: f.mode });
        else drive.setLCD(over ? 'DROP IT IN' : 'INSERT TAPE', !over && blink && !reduce, {});
        drive.setLED(f && f.text === 'NO TAPE' ? (Math.floor(ts / 150) % 2 ? 'red' : 'off') : over ? 'green' : 'off', 1);
        drive.setLED('off', 2);
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    // Loading, in steps you can follow (ms from the click):
    //   0–1600     the tape materialises over the skeleton, from its bottom edge to its top, a scan line at the edge
    //   1600–2000  the skeleton's lines fade; the tape is there
    //   2000–3200  it lies flat and drops to the slot
    //   3200–4700  it slides in, pushing the flap open
    //   4700–5500  the display shows its name and length, then the deck loads it
    const P = { reveal: 1600, fade: 2000, flat: 3200, slide: 4700, end: 5500 };
    // the reveal: every cartridge material is clipped above a plane that rises through the tape (in its own space)
    renderer.localClippingEnabled = true;
    const clipLocal = new T.Plane(new T.Vector3(0, -1, 0), -2), clip = new T.Plane();
    Object.values(cart.M).forEach((m) => { m.clippingPlanes = [clip]; m.clipShadows = true; });
    const scan = new T.Mesh(new T.BoxGeometry(4.25, 0.025, 0.62), new T.MeshBasicMaterial({ color: new T.Color(css('--orange') || '#FF5B1F'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
    scan.visible = false; holder.add(scan);
    const scanGlow = new T.Mesh(new T.PlaneGeometry(4.6, 0.5), new T.MeshBasicMaterial({ map: (() => {
      const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(255,120,50,0)'); gr.addColorStop(0.5, 'rgba(255,120,50,.85)'); gr.addColorStop(1, 'rgba(255,120,50,0)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 64);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
    scanGlow.position.z = 0.32; scan.add(scanGlow);
    function setReveal(h) {   // h: the height, in the cartridge's own units (-1.5 bottom .. 1.5 top), up to which it shows
      clipLocal.constant = h;
      holder.updateMatrixWorld(true);
      clip.copy(clipLocal).applyMatrix4(cart.group.matrixWorld);
    }
    setReveal(2);
    function insertFrame(ts) {
      const e = (ts - ins.t0) * ins.speed;
      holder.rotation.y *= 0.92;
      if (e < P.fade) {                                  // the tape appears, bottom to top, over its skeleton
        const t = clamp01(e / P.reveal), h = -1.6 + 3.25 * ease(t);
        holder.position.set(SX, WAIT.y + (reduce ? 0 : Math.sin(ts / 700) * 0.08 * (1 - t)), WAIT.z); holder.rotation.x = WAIT.rx;
        cart.group.visible = true;
        setReveal(h);
        scan.visible = t < 1; scan.position.y = h;
        scan.material.opacity = scanGlow.material.opacity = 0.6 + 0.4 * Math.sin(ts / 60);
        skel.visible = true; skel.material.opacity = e < P.reveal ? 1 : 1 - (e - P.reveal) / (P.fade - P.reveal);
      } else {
        scan.visible = false; skel.visible = false; setReveal(2);
        if (e < P.flat) {                                // lies flat and drops to the slot
          const t = ease((e - P.fade) / (P.flat - P.fade));
          holder.position.set(SX, WAIT.y + (MOUTH.y - WAIT.y) * t, WAIT.z + (MOUTH.z - WAIT.z) * t);
          holder.rotation.x = WAIT.rx + (MOUTH.rx - WAIT.rx) * t;
        } else {                                         // slides in, all the way
          const t = ease(clamp01((e - P.flat) / (P.slide - P.flat)));
          holder.position.set(SX, MOUTH.y, MOUTH.z + (FRONT - 1.9 - MOUTH.z) * t);
          holder.rotation.x = MOUTH.rx;
          // the flap swings in as the leading edge (1.5 ahead of the centre) reaches it, and falls back once the tape is past
          const lead = holder.position.z - 1.5 - FRONT, tail = holder.position.z + 1.5 - FRONT;
          drive.flap(tail < -0.1 ? clamp01(1 + (tail + 0.1) * 4) : clamp01(-lead * 3));
        }
      }
      const loading = e >= P.flat && e < P.slide, done = e >= P.slide;
      const msg = done ? (ins.label.name || 'READY').toUpperCase() : e < P.fade ? 'READING TAPE' : 'LOADING' + '...'.slice(0, Math.floor(ts / 300) % 4);
      drive.setLCD(msg, false, { tape: e >= P.fade, mode: done ? 'stop' : '', counter: done ? ins.counter : '' });
      drive.setLED(e < P.slide && !done ? (Math.floor(ts / 160) % 2 ? 'off' : 'amber') : 'off', 1);
      drive.setLED(e >= P.flat ? 'green' : 'off', 2);
      if (e >= P.end && !ins.resolved) { ins.resolved = true; ins.done(); }
    }
    function insert(label) {
      if (ins) return ins.p;
      cart.setLabel(label); cart.resetReel(); cart.setReel(label.secs || 0, 0);
      const s = Math.round(label.secs || 0), pad = (n) => String(n).padStart(2, '0');
      let done; const p = new Promise((r) => { done = r; });
      ins = { t0: performance.now(), speed: reduce ? P.end / 300 : 1, label, done, p, counter: Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) };
      host.classList.add('loading'); cv.style.cursor = '';
      return p;
    }
    return { over: (on) => { over = !!on; }, insert };
  }
  window.VCRDrive = { mount };
})();
