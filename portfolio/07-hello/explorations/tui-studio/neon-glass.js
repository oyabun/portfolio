/**
 * Neon Glass Components — vanilla JS
 *
 * Button usage:
 *   NeonGlass.initButton(document.querySelector('.ng-btn'))
 *
 * Switch usage:
 *   NeonGlass.initSwitch(document.querySelector('.ng-switch'))
 *
 * Auto-init all components on the page:
 *   NeonGlass.init()
 */

const NeonGlass = (() => {
  const COLORS = ['#ffffff', '#a7f3d0', '#67e8f9', '#4ade80', '#86efac'];

  function spawnPixel(sourceEl) {
    const rect = sourceEl.getBoundingClientRect();
    const p    = document.createElement('div');
    p.className = 'ng-pixel';
    const sz  = [2, 3, 4][Math.floor(Math.random() * 3)];
    const dur = 0.5 + Math.random() * 0.6;
    const tx  = Math.round((Math.random() - 0.5) * 40 / 4) * 4;
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.style.cssText = [
      `left:${Math.round((rect.left + Math.random() * rect.width)  / 2) * 2}px`,
      `top:${Math.round( (rect.top  + Math.random() * rect.height) / 2) * 2}px`,
      `width:${sz}px`, `height:${sz}px`,
      `background:${col}`, `box-shadow:0 0 0 1px ${col}`,
      `--tx:${tx}px`, `--dur:${dur}s`,
    ].join(';');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000);
  }

  function initButton(btn) {
    let interval = null;
    btn.addEventListener('mouseenter', () => {
      interval = setInterval(() => spawnPixel(btn), 80);
    });
    btn.addEventListener('mouseleave', () => clearInterval(interval));
    btn.addEventListener('click', () => {
      for (let i = 0; i < 20; i++) setTimeout(() => spawnPixel(btn), i * 15);
    });
  }

  function initSwitch(switchEl) {
    const input = switchEl.querySelector('input[type="checkbox"]');
    const label = switchEl.closest('.ng-switch-row')?.querySelector('.ng-switch-label');
    if (!input) return;

    input.addEventListener('change', () => {
      const on = input.checked;
      if (label) {
        label.textContent = on ? 'ON' : 'OFF';
        label.classList.toggle('is-on', on);
      }
      for (let i = 0; i < 10; i++) setTimeout(() => spawnPixel(switchEl), i * 18);
    });
  }

  function init() {
    document.querySelectorAll('.ng-btn').forEach(initButton);
    document.querySelectorAll('.ng-switch').forEach(initSwitch);
  }

  return { init, initButton, initSwitch };
})();
