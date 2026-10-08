/* window.VCRDropdown(select): the deck's own dropdown in place of a native <select>'s list (which looks like the OS,
   not the deck). The select stays in the page, hidden, as the source of truth: picking an item sets its value and
   fires 'change', so the code that listens to it doesn't change. Code that sets select.value itself calls
   select._ddSync() after, to update the button. The list opens up, or down when there's no room above. */
(function () {
  'use strict';
  window.VCRDropdown = function (sel) {
    if (!sel || sel._ddSync) return sel;
    const wrap = document.createElement('span'); wrap.className = 'dd';
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel); sel.classList.add('dd-native'); sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dd-btn'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="dd-val"></span><i class="dd-chev" aria-hidden="true"></i>';
    if (sel.title || sel.dataset.tip) btn.title = sel.title || sel.dataset.tip;
    const list = document.createElement('div'); list.className = 'dd-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
    list.setAttribute('aria-label', sel.getAttribute('aria-label') || 'Options');
    list.innerHTML = [...sel.options].map((o) => '<button type="button" role="option" data-v="' + o.value + '">' + o.textContent + '</button>').join('');
    wrap.append(btn, list);
    function sync() {
      const o = sel.selectedOptions[0];
      btn.querySelector('.dd-val').textContent = o ? o.textContent : '';
      btn.setAttribute('aria-label', (sel.getAttribute('aria-label') || '') + ': ' + (o ? o.textContent : ''));
      list.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === sel.value)));
    }
    function open(on) {
      if (on) {
        list.hidden = false;
        const r = btn.getBoundingClientRect();
        list.classList.toggle('down', r.top < list.offsetHeight + 16);
        (list.querySelector('[aria-selected="true"]') || list.querySelector('button')).focus();
      } else list.hidden = true;
      btn.setAttribute('aria-expanded', String(on));
    }
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(list.hidden); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      e.stopPropagation();
      sel.value = b.dataset.v; sel.dispatchEvent(new Event('change', { bubbles: true }));
      sync(); open(false); btn.focus();
    });
    list.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('[data-v]')], k = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); open(false); btn.focus(); }
      else if (e.key === 'Tab') open(false);
    });
    document.addEventListener('click', (e) => { if (!list.hidden && !wrap.contains(e.target)) open(false); });
    sel.addEventListener('change', sync);
    sel._ddSync = sync; sync();
    return sel;
  };
})();
