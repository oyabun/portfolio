/* The demo shelf's tapes, read from demo-tapes/ at runtime instead of hardcoded in every page that shows
   a shelf — dropping a .jsonl in that folder is enough, nothing else to touch:
     1. list the folder itself (demo-tapes/) and read every *.jsonl link out of the directory index a plain
        static server returns for it — true zero-maintenance discovery, while serving over one like that.
     2. demo-tapes/index.json, a hand-kept list of filenames, for hosts that don't serve directory listings
        (most real static hosts don't) — the fallback, only used when (1) comes back empty or fails.
   Each listed file is fetched and parsed once (window.parseTape) to get its real title, length and event
   count. window.VCRDemoTapes.list(base): a cached promise of [{ id, file, name, c, secs, lines, tape }],
   base the path prefix to demo-tapes/ (e.g. '../' from exp/). Resolves to [] if nothing can be read.
   window.VCRDemoTapes.one(base, id): the same, for a single tape — fetched and parsed on its own, so a
   page showing one demo up front (the landing hero, data-demo=) doesn't wait on every other tape parsing
   first (parsing is synchronous and on the main thread: several multi-MB tapes add up). */
(function () {
  'use strict';
  const PALETTE = ['--c-text', '--orange', '--c-write', '--c-bash', '--c-read', '--c-edit', '--c-skill'];
  const manifest = {}, cache = {};
  // the directory index: an <a href> per entry, same-origin, so it's just read as a document and filtered
  function listDir(base) {
    return fetch(base + 'demo-tapes/')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then((html) => {
        const links = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a[href]')]
          .map((a) => decodeURIComponent(a.getAttribute('href')));
        const names = links.filter((h) => /\.jsonl$/i.test(h) && !h.includes('/'));
        if (!names.length) throw new Error('no .jsonl entries');
        return names;
      });
  }
  function files(base) {
    return manifest[base] || (manifest[base] = listDir(base)
      .catch(() => fetch(base + 'demo-tapes/index.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })));
  }
  function toId(file) { return file.replace(/\.jsonl$/i, '').replace(/^tape-/, ''); }   // clean id, independent of the file's own name
  function fetchOne(base, file, i) {
    return fetch(base + 'demo-tapes/' + file)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then((text) => {
        const tape = window.parseTape(text, file);
        return { id: toId(file), file, name: tape.title, c: PALETTE[i % PALETTE.length], secs: tape.duration / 1000, lines: tape.events.length, tape };
      });
  }
  function list(base) {
    base = base || '';
    if (cache[base]) return cache[base];
    const p = files(base)
      .then((list) => Promise.all(list.map((file, i) => fetchOne(base, file, i).catch(() => null))))
      .then((items) => items.filter(Boolean))
      .catch(() => []);
    cache[base] = p;
    return p;
  }
  function one(base, id) {
    base = base || '';
    return files(base)
      .then((list) => {
        const i = id ? list.findIndex((f) => toId(f) === id) : 0;
        if (i < 0 || !list.length) throw new Error('not found');
        return fetchOne(base, list[i], i);
      })
      .catch(() => null);
  }
  window.VCRDemoTapes = { list, one };
})();
