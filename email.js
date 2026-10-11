(function () {
  "use strict";
  var u = "he" + "llo";
  var d = "javier" + "alonso";
  var t = "co" + "m";
  var addr = u + "@" + d + "." + t;
  window.MAIL_ADDR = addr;
  function wire() {
    var links = document.querySelectorAll("a[data-mail]");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("href") === "#") links[i].setAttribute("href", "mailto:" + addr);
    }
    var texts = document.querySelectorAll("[data-mail-text]");
    for (var j = 0; j < texts.length; j++) {
      if (!texts[j].textContent.trim()) texts[j].textContent = addr;
    }
  }
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[data-mail]") : null;
    if (!a) return;
    if (!/^mailto:/.test(a.getAttribute("href") || "")) {
      e.preventDefault();
      window.location.href = "mailto:" + addr;
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
  window.WIRE_MAIL = wire;
})();
