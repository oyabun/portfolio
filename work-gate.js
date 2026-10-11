(function () {
  'use strict';

  var LS_FLAG = 'work-unlocked';
  var LS_LOG = 'work-unlock-log';

  function letterSum(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 96;
      if (c < 1 || c > 26) return -1;
      n += c;
    }
    return n;
  }

  function checkKey(raw) {
    var key = String(raw || '').trim().toLowerCase().replace(/-/g, '');
    var m = key.match(/^([a-z]{2,})(\d{7})$/);
    if (!m) return false;
    var sum = letterSum(m[1]);
    if (sum < 0 || sum > 999) return false;
    var d = m[2];
    if (String(sum).padStart(3, '0') !== d.slice(0, 3)) return false;
    var dateSum = +d.slice(3, 7);
    return dateSum >= 2002 && dateSum <= 2142;
  }

  function makeKey(company, day, month, year) {
    var c = String(company).trim().toLowerCase().replace(/[^a-z]/g, '');
    var sum = letterSum(c);
    if (sum < 0 || sum > 999) return '';
    var dateSum = day + year + month;
    if (dateSum < 2002 || dateSum > 2142) return '';
    return c + '-' + String(sum).padStart(3, '0') + '-' + String(dateSum).padStart(4, '0');
  }

  window.WorkGate = { check: checkKey, make: makeKey };

  function record(key) {
    try {
      localStorage.setItem(LS_FLAG, '1');
      var log = JSON.parse(localStorage.getItem(LS_LOG) || '[]');
      log.push({ key: key, at: new Date().toISOString() });
      localStorage.setItem(LS_LOG, JSON.stringify(log.slice(-20)));
    } catch (e) {}
    if (window.WORK_GATE_HOOK) {
      try {
        fetch(window.WORK_GATE_HOOK, { method: 'POST', mode: 'no-cors', body: key });
      } catch (e) {}
    }
  }

  function unlocked() {
    try { return localStorage.getItem(LS_FLAG) === '1'; } catch (e) { return false; }
  }

  function buildCard() {
    var card = document.createElement('div');
    card.className = 'gate-card';
    card.innerHTML =
      '<p class="eyebrow">Selected work</p>' +
      '<h2>A velvet rope.</h2>' +
      '<p>The case studies are private. If Javier gave you an access key, enter it below.</p>' +
      '<form class="gate-form" autocomplete="off">' +
      '<input type="password" name="key" placeholder="access key" spellcheck="false" aria-label="Access key">' +
      '<button type="submit">Unlock</button>' +
      '</form>' +
      '<p class="gate-err" role="alert"></p>' +
      '<p class="gate-note">No key? <a href="#" data-mail>Ask Javier.</a></p>';
    var mail = card.querySelector('a[data-mail]');
    if (mail && window.MAIL_ADDR) mail.setAttribute('href', 'mailto:' + window.MAIL_ADDR);
    return card;
  }

  function wire(card, onSuccess) {
    var form = card.querySelector('.gate-form');
    var err = card.querySelector('.gate-err');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = form.elements.key.value.trim().toLowerCase();
      if (checkKey(key)) {
        record(key);
        onSuccess();
      } else {
        err.textContent = 'That key does not work.';
        form.elements.key.select();
      }
    });
  }

  function init() {
    if (unlocked()) return;
    var bento = document.querySelector('#work .bento');
    if (bento) {
      bento.classList.add('gate-locked');
      var card = buildCard();
      bento.parentNode.insertBefore(card, bento);
      wire(card, function () {
        document.documentElement.classList.remove('work-locked');
        bento.classList.remove('gate-locked');
        card.remove();
      });
      return;
    }
    var overlay = document.createElement('div');
    overlay.className = 'gate-overlay';
    var inner = buildCard();
    overlay.appendChild(inner);
    document.body.appendChild(overlay);
    var input = inner.querySelector('input');
    if (input) input.focus();
    wire(inner, function () {
      document.documentElement.classList.remove('work-locked');
      overlay.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
