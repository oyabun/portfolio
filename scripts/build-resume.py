#!/usr/bin/env python3
"""
Resume builder — single source of truth: data/resume.json

Generates, from that one JSON file:
  dist/Javier-Alonso-Resume.html   ATS-safe single-column HTML (print -> PDF)
  dist/Javier-Alonso-Resume.txt    plain text for legacy ATS / forms
  dist/Javier-Alonso-Resume.pdf    if a headless chromium is available

Rules enforced here:
  - Exported artifact names are ALWAYS neutral. No employer, no date, no version.
  - Single column, no images, no tables, no icon fonts, dates as plain text.
  - Optional `tailoring` profiles in the JSON reorder/curate content; they never
    leak into filenames.

Usage: python3 scripts/build-resume.py [tailor_profile]
"""
import json, sys, os, re, shutil, subprocess, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "resume.json")
DIST = os.path.join(ROOT, "dist")
BASENAME = "Javier-Alonso-Resume"  # neutral, always. Never parameterised by target company.


# ---------------------------------------------------------------- data
def load():
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)
    profile = sys.argv[1] if len(sys.argv) > 1 else None
    tail = data.get("tailoring", {})
    if profile and profile in tail:
        conf = tail[profile]
        if "summary" in conf:
            data["basics"]["summary"] = conf["summary"]
        if "drop_highlights" in conf:
            drop = set(conf["drop_highlights"])
            for job in data["work"]:
                job["highlights"] = [h for h in job.get("highlights", [])
                                     if h[:40] not in drop]
        if "work_order" in conf:  # list of substrings matched against job names
            order = conf["work_order"]
            def rank(job):
                for i, key in enumerate(order):
                    if key.lower() in job["name"].lower():
                        return i
                return len(order)
            data["work"] = sorted(data["work"], key=rank)
        if "skill_order" in conf:
            order = conf["skill_order"]
            def rank(s):
                for i, key in enumerate(order):
                    if key.lower() in s["name"].lower():
                        return i
                return len(order)
            data["skills"] = sorted(data["skills"], key=rank)
    return data


def dates(job):
    s = (job.get("startDate") or "").strip()
    e = (job.get("endDate") or "").strip()
    if s and e:
        return f"{s} - {e}"
    if s:
        return f"{s} - Present"
    return ""


# ---------------------------------------------------------------- plain text
def as_text(data):
    b = data["basics"]
    out = []
    w = lambda s="": out.append(s)

    w(b["name"].upper())
    w(b.get("label", ""))
    contact = [b.get("email", "")]
    if b.get("url"):
        contact.append(b["url"])
    for p in b.get("profiles", []):
        contact.append(f"{p['network']}: {p['url']}")
    if b.get("location"):
        contact.append(b["location"])
    w(" | ".join(c for c in contact if c))
    w()
    w("SUMMARY")
    w("-" * 42)
    w(b.get("summary", ""))

    w()
    w("EXPERIENCE")
    w("-" * 42)
    for job in data["work"]:
        head = job["name"]
        if job.get("location"):
            head += f" — {job['location']}"
        w(head)
        w(f"{job['position']} | {dates(job)}".rstrip(" |"))
        for h in job.get("highlights", []):
            w(f"  * {h}")
        w()

    if data.get("skills"):
        w("SKILLS")
        w("-" * 42)
        for s in data["skills"]:
            kw = ", ".join(s.get("keywords", []))
            w(f"{s['name']}: {kw}" if kw else s["name"])
        w()

    if data.get("education"):
        w("EDUCATION")
        w("-" * 42)
        for e in data["education"]:
            w(f"{e['institution']} — {e['studyType']}")
        w()

    if data.get("volunteer"):
        w("COMMUNITY & SPEAKING")
        w("-" * 42)
        for v in data["volunteer"]:
            line = f"{v['position']} — {v['organization']}"
            w(line)
            if v.get("summary"):
                w(f"  {v['summary']}")
        w()

    text = "\n".join(out)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


# ---------------------------------------------------------------- ATS html
ATS_CSS = """
/* ATS-safe: one column, system serif/helvetica stacks, no grid/flex/floats. */
@page { size: A4; margin: 14mm 13mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 10.5pt; line-height: 1.42; color: #111; margin: 0; padding: 28px 34px;
  max-width: 820px;
}
h1 { font-size: 20pt; margin: 0 0 2px; letter-spacing: -0.2px; }
.label { font-size: 11pt; margin: 0 0 8px; }
.contact { font-size: 9pt; margin: 0 0 18px; color: #222; }
h2 {
  font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.1px;
  margin: 20px 0 9px; padding-bottom: 4px; border-bottom: 1px solid #111;
}
.section { page-break-inside: avoid; }
.job { page-break-inside: avoid; margin-bottom: 13px; }
.job-top { display: block; }
.company { font-weight: 700; font-size: 11pt; }
.role { font-style: italic; margin: 1px 0 4px; }
.when { font-size: 9.5pt; color: #333; }
ul { margin: 4px 0 0; padding-left: 16px; }
li { margin-bottom: 3px; }
p.sum { margin: 0; }
.skills { margin: 0; }
.skills div { margin-bottom: 3px; }
.skills b { font-weight: 700; }
.two-line { font-size: 9.5pt; margin: 0; }
@media print {
  body { padding: 0; max-width: none; }
  a { color: #111; text-decoration: none; }
}
"""


def as_html(data):
    b = data["basics"]
    esc = html.escape
    p = []
    add = p.append

    add("<!doctype html>")
    add('<html lang="en"><head><meta charset="utf-8">')
    add('<meta name="viewport" content="width=device-width, initial-scale=1">')
    # No company or personal metadata: ATS parsers and shared files stay clean.
    add(f"<title>{esc(b['name'])} — Resume</title>")
    add(f"<style>{ATS_CSS}</style></head><body>")

    add(f"<h1>{esc(b['name'])}</h1>")
    if b.get("label"):
        add(f'<p class="label">{esc(b["label"])}</p>')

    bits = []
    if b.get("email"):
        bits.append(f'<a href="mailto:{esc(b["email"])}">{esc(b["email"])}</a>')
    if b.get("url"):
        bits.append(esc(b["url"]))
    for pr in b.get("profiles", []):
        bits.append(f'{esc(pr["network"])}: {esc(pr["url"])}')
    if b.get("location"):
        bits.append(esc(b["location"]))
    add(f'<p class="contact">{" · ".join(bits)}</p>')

    add('<h2>Summary</h2>')
    add(f'<div class="section"><p class="sum">{esc(b.get("summary",""))}</p></div>')

    add("<h2>Experience</h2>")
    for job in data["work"]:
        add('<div class="job">')
        loc = f' · {esc(job["location"])}' if job.get("location") else ""
        add(f'<div class="job-top"><span class="company">{esc(job["name"])}</span>{loc}</div>')
        add(f'<div class="role">{esc(job["position"])}</div>')
        d = dates(job)
        if d:
            add(f'<div class="when">{esc(d)}</div>')
        if job.get("highlights"):
            add("<ul>")
            for h in job["highlights"]:
                add(f"<li>{esc(h)}</li>")
            add("</ul>")
        add("</div>")

    if data.get("skills"):
        add("<h2>Skills</h2>")
        add('<div class="section skills">')
        for s in data["skills"]:
            kw = ", ".join(s.get("keywords", []))
            add(f"<div><b>{esc(s['name'])}:</b> {esc(kw)}</div>" if kw
                else f"<div><b>{esc(s['name'])}</b></div>")
        add("</div>")

    if data.get("education"):
        add("<h2>Education</h2>")
        add('<div class="section">')
        for e in data["education"]:
            add(f'<div class="two-line">{esc(e["institution"])} — {esc(e["studyType"])}</div>')
        add("</div>")

    if data.get("volunteer"):
        add("<h2>Community &amp; Speaking</h2>")
        add('<div class="section">')
        for v in data["volunteer"]:
            add(f'<div class="two-line"><b>{esc(v["position"])}</b> — {esc(v["organization"])}</div>')
            if v.get("summary"):
                add(f'<p class="two-line">{esc(v["summary"])}</p>')
        add("</div>")

    add("</body></html>")
    return "\n".join(p)


# ---------------------------------------------------------------- pdf
def to_pdf(src_html, out_pdf):
    exe = (shutil.which("chromium") or shutil.which("chromium-browser")
           or shutil.which("google-chrome") or shutil.which("chrome"))
    if not exe:
        return False
    url = "file://" + os.path.abspath(src_html)
    subprocess.run([exe, "--headless", "--no-sandbox", "--disable-gpu",
                    "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", url],
                   check=True, capture_output=True)
    return os.path.exists(out_pdf)


def main():
    data = load()
    os.makedirs(DIST, exist_ok=True)
    h = os.path.join(DIST, f"{BASENAME}.html")
    t = os.path.join(DIST, f"{BASENAME}.txt")
    with open(h, "w", encoding="utf-8") as f:
        f.write(as_html(data))
    with open(t, "w", encoding="utf-8") as f:
        f.write(as_text(data))
    # keep the JSON served too, so resume.html can hydrate itself at view time
    shutil.copy(SRC, os.path.join(DIST, "resume.json"))
    ok = to_pdf(h, os.path.join(DIST, f"{BASENAME}.pdf"))
    print(f"wrote {h}")
    print(f"wrote {t}")
    print("wrote pdf" if ok else "skipped pdf (no headless chromium in PATH)")


if __name__ == "__main__":
    main()
