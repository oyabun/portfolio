(function () {
  "use strict";
  // resume-live.js — hydrates resume.html from data/resume.json at view time,
  // and renders an ATS-safe single-column view when ?format=ats is present.
  // The static markup stays as the no-JS fallback.

  var params = new URLSearchParams(location.search);
  var fmt = params.get("format");
  var tailor = params.get("tailor");

  fetch("data/resume.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      if (fmt === "ats") renderAts(data);
      else hydrate(data);
    })
    .catch(function () { /* offline or missing json: keep static content */ });

  function applyTailoring(data) {
    var t = data.tailoring && tailor && data.tailoring[tailor];
    if (!t) return data;
    if (t.summary) data.basics.summary = t.summary;
    if (t.skill_order) {
      data.skills.sort(function (a, b) {
        return t.skill_order.indexOf(a.name) - t.skill_order.indexOf(b.name);
      });
    }
    if (t.work_order) {
      data.work.sort(function (a, b) {
        function rank(j) {
          for (var i = 0; i < t.work_order.length; i++)
            if (j.name.toLowerCase().indexOf(t.work_order[i].toLowerCase()) > -1) return i;
          return 99;
        }
        return rank(a) - rank(b);
      });
    }
    return data;
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function dates(job) {
    var s = (job.startDate || "").trim(), e = (job.endDate || "").trim();
    if (s && e) return s + " - " + e;
    if (s) return s + " - Present";
    return "";
  }

  // ---- normal view: replace static text nodes with JSON content ----
  function hydrate(data) {
    data = applyTailoring(data);
    var b = data.basics;
    var q = function (sel) { return document.querySelector(sel); };
    if (q(".cv-id h1")) q(".cv-id h1").textContent = b.name;
    if (q(".cv-id .sub")) q(".cv-id .sub").textContent = b.label;
    if (q(".cv-summary")) q(".cv-summary").textContent = b.summary;

    var tl = q(".cv-timeline");
    if (tl) {
      var htmlOut = "";
      data.work.forEach(function (job, i) {
        var cls = "cv-job" + (i === 0 ? " now" : "");
        htmlOut += '<article class="' + cls + '">' +
          '<div class="cv-job-top"><h3>' + esc(job.name) + '</h3>' +
          '<span class="cv-dates">' + esc(dates(job) || job.location || "Remote") + '</span></div>' +
          '<p class="cv-role">' + esc(job.position) + '</p><ul>';
        (job.highlights || []).forEach(function (h) { htmlOut += "<li>" + esc(h) + "</li>"; });
        htmlOut += "</ul></article>";
      });
      tl.innerHTML = htmlOut;
    }
  }

  // ---- ATS view: same JSON, strict single-column, print-to-PDF ready ----
  function renderAts(data) {
    data = applyTailoring(data);
    var b = data.basics;
    var css = '@page{size:A4;margin:14mm 13mm}body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:10.5pt;line-height:1.42;color:#111;margin:0;padding:28px 34px;max-width:820px}h1{font-size:20pt;margin:0 0 2px}p.label{font-size:11pt;margin:0 0 8px}p.contact{font-size:9pt;margin:0 0 18px}h2{font-size:9.5pt;text-transform:uppercase;letter-spacing:1.1px;margin:20px 0 9px;padding-bottom:4px;border-bottom:1px solid #111}div.job,div.section{page-break-inside:avoid;margin-bottom:13px}.company{font-weight:700;font-size:11pt}.role{font-style:italic;margin:1px 0 4px}.when{font-size:9.5pt;color:#333}ul{margin:4px 0 0;padding-left:16px}li{margin-bottom:3px}.skills div,.two-line{font-size:9.5pt;margin:0 0 3px}@media print{body{padding:0;max-width:none}a{color:#111;text-decoration:none}}';

    var out = [];
    out.push("<h1>" + esc(b.name) + "</h1>");
    out.push('<p class="label">' + esc(b.label) + "</p>");
    var contact = [];
    if (b.email) contact.push('<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + "</a>");
    if (b.url) contact.push(esc(b.url));
    (b.profiles || []).forEach(function (p) { contact.push(esc(p.network) + ": " + esc(p.url)); });
    if (b.location) contact.push(esc(b.location));
    out.push('<p class="contact">' + contact.join(" · ") + "</p>");

    out.push("<h2>Summary</h2><div class=\"section\"><p style=\"margin:0\">" + esc(b.summary) + "</p></div>");
    out.push("<h2>Experience</h2>");
    data.work.forEach(function (job) {
      out.push('<div class="job"><span class="company">' + esc(job.name) +
        (job.location ? "</span> · " + esc(job.location) : "</span>") +
        '<div class="role">' + esc(job.position) + "</div>" +
        '<div class="when">' + esc(dates(job)) + "</div><ul>");
      (job.highlights || []).forEach(function (h) { out.push("<li>" + esc(h) + "</li>"); });
      out.push("</ul></div>");
    });
    out.push('<h2>Skills</h2><div class="section skills">');
    (data.skills || []).forEach(function (s) {
      out.push("<div><b>" + esc(s.name) + ":</b> " + esc((s.keywords || []).join(", ")) + "</div>");
    });
    out.push("</div>");
    if (data.education && data.education.length) {
      out.push("<h2>Education</h2><div class=\"section\">");
      data.education.forEach(function (e) {
        out.push('<div class="two-line">' + esc(e.institution) + " — " + esc(e.studyType) + "</div>");
      });
      out.push("</div>");
    }
    if (data.volunteer && data.volunteer.length) {
      out.push("<h2>Community &amp; Speaking</h2><div class=\"section\">");
      data.volunteer.forEach(function (v) {
        out.push('<div class="two-line"><b>' + esc(v.position) + "</b> — " + esc(v.organization) + "</div>");
        if (v.summary) out.push('<p class="two-line">' + esc(v.summary) + "</p>");
      });
      out.push("</div>");
    }

    document.title = b.name + " — Resume";
    document.body.innerHTML =
      '<style>' + css + "</style>" +
      '<div style="max-width:820px;margin:0 auto">' + out.join("") + "</div>" +
      '<p style="text-align:center;font-size:9pt;color:#777;margin:24px 0">' +
      'Press Ctrl/Cmd+P for a clean PDF · <a href="resume.html">styled version</a> · ' +
      '<a href="dist/Javier-Alonso-Resume.txt">plain text</a></p>';
    // hide site chrome
    ["header.top", "footer.bottom"].forEach(function (s) {
      var el = document.querySelector(s);
      if (el) el.style.display = "none";
    });
  }
})();
