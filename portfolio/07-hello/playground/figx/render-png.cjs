const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const CSS = "@font-face{font-family:Roboto;src:url(file:///tmp/opencode/fonts/roboto.zip.d/Roboto-Regular.ttf)}"
  + "@font-face{font-family:Roboto;font-weight:500;src:url(file:///tmp/opencode/fonts/roboto.zip.d/Roboto-Medium.ttf)}"
  + "@font-face{font-family:Roboto;font-weight:700;src:url(file:///tmp/opencode/fonts/roboto.zip.d/Roboto-Bold.ttf)}"
  + "@font-face{font-family:Inter;src:url(file:///tmp/opencode/fonts/inter.zip.d/extras/ttf/Inter-Regular.ttf)}"
  + "@font-face{font-family:Inter;font-weight:500;src:url(file:///tmp/opencode/fonts/inter.zip.d/extras/ttf/Inter-Medium.ttf)}"
  + "@font-face{font-family:Inter;font-weight:600;src:url(file:///tmp/opencode/fonts/inter.zip.d/extras/ttf/Inter-SemiBold.ttf)}"
  + "@font-face{font-family:Inter;font-weight:700;src:url(file:///tmp/opencode/fonts/inter.zip.d/extras/ttf/Inter-Bold.ttf)}"
  + "@font-face{font-family:'Open Sans';src:url(file:///tmp/opencode/fonts/roboto.zip.d/Roboto-Regular.ttf)}"
  + "@font-face{font-family:'Open Sans';font-weight:700;src:url(file:///tmp/opencode/fonts/roboto.zip.d/Roboto-Bold.ttf)}"
  + "html,body{margin:0;padding:0;background:#fff}";
(async () => {
  const src = process.argv[2];
  const scale = +(process.argv[3] || 1);
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const f of fs.readdirSync(src).filter(x => x.endsWith(".svg"))) {
    const svg = fs.readFileSync(path.join(src, f), "utf8");
    const m = svg.match(/<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/);
    if (!m) { console.log("skip (no size):", f); continue; }
    const w = Math.ceil(+m[1] * scale), h = Math.ceil(+m[2] * scale);
    await p.setViewportSize({ width: Math.min(w, 4000), height: Math.min(h, 4000) });
    const scaled = scale !== 1 ? svg.replace(/<svg([^>]*)width="([\d.]+)" height="([\d.]+)"/, (s, a, ww, hh) => `<svg${a}width="${ww * scale}" height="${hh * scale}"`) : svg;
    await p.setContent("<style>" + CSS + "</style>" + scaled);
    await p.waitForFunction(() => document.fonts.status === "loaded").catch(() => {});
    await p.waitForTimeout(100);
    await p.screenshot({ path: path.join(src, f.replace(/\.svg$/, ".png")), fullPage: true });
    console.log("png:", f, w + "x" + h);
  }
  await b.close();
})();
