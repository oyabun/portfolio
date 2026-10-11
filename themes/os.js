/* OS skin widgets: cards become draggable desktop windows.
   Grab a window by its title strip (top 36px), drag it anywhere;
   positions persist in localStorage; double-click the strip to send
   it back to its slot. Uses the CSS `translate` property so it never
   fights the skins' own transform-based hover effects. */
(function () {
  'use strict';
  var KEY = 'nan-os-win';
  var STRIP = 36;
  var widgets = [];
  var z = 10;

  function isOS() { return document.documentElement.getAttribute('data-skin') === 'os'; }
  function store() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function pos(el) {
    var t = (el.style.translate || '0px 0px').trim().split(/\s+/);
    return [parseFloat(t[0]) || 0, parseFloat(t[1] || t[0]) || 0];
  }

  function wire(el, k) {
    function down(e) {
      if (!isOS() || e.button !== 0 && e.pointerType === 'mouse') return;
      var r = el.getBoundingClientRect();
      if (e.clientY - r.top > STRIP) return;
      var t = e.target.closest('a,button,input,select,textarea');
      if (t && t !== el) return;
      e.preventDefault();
      el.classList.add('nan-win-drag');
      el.style.zIndex = ++z;
      var start = pos(el), sx = e.clientX, sy = e.clientY, moved = false;
      function move(ev) {
        var nx = start[0] + ev.clientX - sx, ny = start[1] + ev.clientY - sy;
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
        el.style.translate = nx + 'px ' + ny + 'px';
      }
      function up() {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
        el.classList.remove('nan-win-drag');
        if (moved) {
          el.addEventListener('click', function (ev) {
            ev.preventDefault(); ev.stopPropagation();
          }, { once: true, capture: true });
          var s = store(); s[k] = pos(el).map(Math.round); save(s);
        }
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', up);
    }
    function dbl(e) {
      var r = el.getBoundingClientRect();
      if (e.clientY - r.top > STRIP) return;
      if (el.tagName === 'A') return;
      el.style.translate = '';
      var s = store(); delete s[k]; save(s);
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('dblclick', dbl);
    return { el: el, down: down, dbl: dbl };
  }

  function enable() {
    if (!isOS() || widgets.length) return;
    var s = store();
    var els = document.querySelectorAll('.hero-card, .mini, .bento .tile, .usecase, .xp-banner');
    Array.prototype.forEach.call(els, function (el, i) {
      var k = location.pathname + ':' + i;
      if (s[k]) el.style.translate = s[k][0] + 'px ' + s[k][1] + 'px';
      widgets.push(wire(el, k));
    });
  }

  function disable() {
    widgets.forEach(function (w) {
      w.el.removeEventListener('pointerdown', w.down);
      w.el.removeEventListener('dblclick', w.dbl);
      w.el.style.translate = '';
      w.el.style.zIndex = '';
    });
    widgets = [];
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { requestAnimationFrame(enable); });
  } else {
    requestAnimationFrame(enable);
  }
  document.addEventListener('nanskin', function (e) {
    if (e.detail.skin === 'os') enable(); else disable();
  });
})();
