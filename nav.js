(function () {
  "use strict";
  // Mobile hamburger: collapse the primary nav into a toggle below the
  // hamburger breakpoint. Progressive enhancement — without JS the nav stays
  // wrapped and visible (no links lost).
  var inner = document.querySelector(".top-inner");
  var nav = inner && inner.querySelector("nav");
  var topEl = inner && inner.closest ? inner.closest(".top") : document.querySelector("header.top");
  if (!inner || !nav) return;

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "nav-toggle";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "primary-nav");
  btn.setAttribute("aria-label", "Menu");
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<path class="bar b1" d="M4 7h16"/><path class="bar b2" d="M4 12h16"/><path class="bar b3" d="M4 17h16"/>' +
    "</svg>";
  nav.id = "primary-nav";

  // insert right after the wordmark so the button sits at the far right
  var wordmark = inner.querySelector(".wordmark");
  if (wordmark && wordmark.nextSibling) inner.insertBefore(btn, wordmark.nextSibling);
  else inner.appendChild(btn);

  // nav before the button in layout order is not required; keep source order:
  // wordmark (left) — nav (menu) — btn (right) is handled by CSS flex order.
  inner.appendChild(nav);

  function close() {
    inner.classList.remove("nav-open");
    if (topEl) topEl.classList.remove("nav-open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", function () {
    var open = inner.classList.toggle("nav-open");
    if (topEl) topEl.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // close after choosing a link (mobile)
  nav.addEventListener("click", function (e) {
    if (e.target.closest("a") && !e.target.closest("[data-mail]")) close();
    if (e.target.closest("[data-mail]")) close();
  });

  // reset when going back to desktop widths
  if (window.matchMedia) {
    var mq = window.matchMedia("(max-width: 667px)");
    (mq.addEventListener ? mq.addEventListener("change", close) : mq.addListener(close));
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
})();
