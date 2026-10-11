/* Nan skins — swaps the whole visual design of the site.
   Prefs live in the same 'cryz-prefs' bag as the CRYZ switches (key: skin).
   This runs synchronously from <head> right after style.css, so the skin
   paints with zero flash; cryz.js calls window.nanSkin.set() on change. */
(function () {
  'use strict';
  var ENABLED = false; /* skins hidden from CRYZ for now; flip to true to re-enable */
  var src = document.currentScript && document.currentScript.src;
  var base = src ? src.slice(0, src.lastIndexOf('/')) : 'themes';
  var link = null;
  var osScript = null;

  function apply(id) {
    var h = document.documentElement;
    if (!ENABLED) id = 'bento';
    if (!id || id === 'bento') {
      h.removeAttribute('data-skin');
      if (link) { link.remove(); link = null; }
    } else {
      h.setAttribute('data-skin', id);
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.id = 'nan-skin-css';
        document.head.appendChild(link);
      }
      link.href = base + '/' + id + '.css';
    }
    if (id === 'os' && !osScript) {
      osScript = document.createElement('script');
      osScript.src = base + '/os.js';
      document.head.appendChild(osScript);
    }
    document.dispatchEvent(new CustomEvent('nanskin', { detail: { skin: id || 'bento' } }));
  }

  var cur = 'bento';
  try {
    var p = JSON.parse(localStorage.getItem('cryz-prefs')) || {};
    if (p.skin && p.skin !== 'bento') cur = p.skin;
  } catch (e) {}
  apply(cur);

  window.nanSkin = {
    set: function (id) { cur = id; apply(id); },
    get: function () { return cur; }
  };
})();
