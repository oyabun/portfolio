// window.analyzeTape(tape): everything a session log can tell you, from a parsed tape (parse-tape.js /
// window.TAPE). Used by the studio's Report view and the landing's "What's on the tape".
//
//   kinds     counts of prompts, replies, thinking, tool calls
//   tools     per tool: calls, errors, time spent, slowest run (sorted by calls)
//   commands  Bash: how many, and the programs run most (npm, git, ls…)
//   files     every path read, written or edited, with how often each
//   skills    each skill invoked, and how often
//   mcp       MCP servers called (mcp__<server>__<tool>), their tools and calls
//   urls      every URL fetched or found in a tool's input, with how often and by which tool; web searches
//   slow      the slowest tool calls
//   errors    every failed call: when, which tool, what it ran, the first line of what came back
//   prompts   what you asked
//   tokens    fresh input, cache read, cache write, output; cost; responses; models; peak context
//   time      duration, active and idle time (gaps over a minute), the longest idle stretch
(function () {
  'use strict';
  const IDLE_MS = 60000;
  const URL_RE = /\bhttps?:\/\/[^\s"'<>()`\]]+/g;
  const firstLine = (s, n) => { const l = String(s || '').trim().split('\n')[0]; return l.length > n ? l.slice(0, n - 1) + '…' : l; };
  const parseJSON = (s) => { if (!s || s[0] !== '{') return null; try { return JSON.parse(s); } catch (e) { return null; } };
  const bump = (m, k, by) => { m.set(k, (m.get(k) || 0) + (by || 1)); return m; };

  // the program a shell command actually runs: past cd / export / loops, sudo / timeout / env, VAR=… and brackets
  const SHELL = new Set(['cd', 'export', 'set', 'for', 'do', 'done', 'if', 'then', 'else', 'fi', 'while', 'until', 'true', 'false', 'sleep', 'source', '.']);
  function programOf(cmd) {
    for (let seg of String(cmd).split(/&&|\|\||;|\||\n/)) {
      seg = seg.trim().replace(/^[({\s!]+/, '');
      for (;;) { const t = seg.replace(/^(sudo|env|nohup|time|timeout\s+\S+|[A-Za-z_][A-Za-z0-9_]*=\S*)\s+/, ''); if (t === seg) break; seg = t; }
      const w = seg.split(/\s/)[0].replace(/^["']|["']$/g, '');
      if (w && !SHELL.has(w) && /^[\w./@-]+$/.test(w)) return w.split('/').pop();
    }
    return '';
  }
  window.analyzeTape = function analyzeTape(tape) {
    const EV = tape.events || [], RS = tape.responses || [], DUR = Math.max(1, tape.duration || 0);
    const kinds = { prompt: 0, text: 0, thinking: 0, tool: 0 };
    const tools = new Map(), files = new Map(), skills = new Map(), mcp = new Map(), urls = new Map(), programs = new Map();
    const searches = [], errors = [], prompts = [];
    let bash = 0;

    EV.forEach((e, i) => {
      kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      if (e.kind === 'prompt') prompts.push({ i, t: e.t, text: e.text || '' });
      if (e.kind !== 'tool') return;
      const name = e.tool || 'Tool';
      let input = String(e.input || ''), o = parseJSON(input);
      // Claude Code logs an input it couldn't parse as {"__unparsedToolInput":{"raw":"…"}}: read the fields out of the raw text
      if (o && o.__unparsedToolInput) {
        const raw = String(o.__unparsedToolInput.raw || '');
        o = parseJSON(raw.trim()) || Object.fromEntries([...raw.matchAll(/"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => [m[1], m[2].replace(/\\(.)/g, '$1')]));
        input = o.command || o.file_path || o.notebook_path || o.pattern || o.url || o.query || raw;
      }
      const T = tools.get(name) || { name, calls: 0, errors: 0, time: 0, slowest: null };
      T.calls++; T.time += e.dur || 0; if (e.err) T.errors++;
      if (!T.slowest || (e.dur || 0) > T.slowest.dur) T.slowest = { i, dur: e.dur || 0 };
      tools.set(name, T);

      if (name === 'Bash') { bash++; const prog = programOf(input); if (prog) bump(programs, prog); }
      if (/^(Read|Write|Edit|MultiEdit|NotebookEdit)$/.test(name)) {
        const path = (o && (o.file_path || o.notebook_path)) || input.split('\n')[0];
        const F = files.get(path) || { path, read: 0, write: 0, edit: 0 };
        if (name === 'Read') F.read++; else if (name === 'Write') F.write++; else F.edit++;
        files.set(path, F);
      }
      if (name === 'Skill') bump(skills, (o && (o.skill || o.name)) || firstLine(input, 60) || 'skill');
      const m = /^mcp__(.+?)__(.+)$/.exec(name);
      if (m) {
        const S = mcp.get(m[1]) || { server: m[1], calls: 0, tools: new Map() };
        S.calls++; bump(S.tools, m[2]); mcp.set(m[1], S);
      }
      if (name === 'WebSearch') searches.push({ i, t: e.t, query: (o && o.query) || input });
      const found = new Set(input.match(URL_RE) || []);
      if (name === 'WebFetch' && o && o.url) found.add(o.url);
      found.forEach((u) => {
        u = u.replace(/[.,;:]+$/, '');
        if (/[$`{}]/.test(u)) return;   // a shell template (…$path), not an address
        const U = urls.get(u) || { url: u, count: 0, tools: new Set(), first: e.t, i };
        U.count++; U.tools.add(name); urls.set(u, U);
      });
      if (e.err) errors.push({ i, t: e.t, tool: name, input: firstLine(input, 140), result: firstLine(e.result, 160) });
    });

    // tokens and money
    const tok = { fresh: 0, cacheRead: 0, cacheWrite: 0, out: 0, cost: 0, responses: RS.length, peakContext: 0, models: new Map() };
    RS.forEach((r) => {
      tok.fresh += r.in || 0; tok.cacheRead += r.cr || 0; tok.cacheWrite += r.cw || 0; tok.out += r.out || 0; tok.cost += r.cost || 0;
      tok.peakContext = Math.max(tok.peakContext, (r.in || 0) + (r.cr || 0) + (r.cw || 0));
      if (r.model) bump(tok.models, r.model);
    });
    tok.input = tok.fresh + tok.cacheRead + tok.cacheWrite;
    tok.cacheHit = tok.input ? tok.cacheRead / tok.input : 0;

    // time: an event holds the floor until it ends (a tool) or for a moment (the rest); gaps over a minute are idle
    let idle = 0, longestIdle = { ms: 0, at: 0 }, end = 0;
    EV.forEach((e) => {
      const gap = e.t - end;
      if (gap > IDLE_MS) { idle += gap; if (gap > longestIdle.ms) longestIdle = { ms: gap, at: end }; }
      end = Math.max(end, e.t + (e.dur || 0));
    });

    const byCount = (m) => [...m].sort((a, b) => b[1] - a[1]);
    return {
      title: tape.title || tape.source || 'Untitled session', source: tape.source || '', model: tape.model || '', cwd: tape.cwd || '',
      start: tape.start, duration: DUR, events: EV.length,
      kinds,
      tools: [...tools.values()].sort((a, b) => b.calls - a.calls),
      commands: { count: bash, programs: byCount(programs) },
      files: [...files.values()].sort((a, b) => (b.read + b.write + b.edit) - (a.read + a.write + a.edit)),
      skills: byCount(skills),
      mcp: [...mcp.values()].map((S) => ({ server: S.server, calls: S.calls, tools: byCount(S.tools) })).sort((a, b) => b.calls - a.calls),
      urls: [...urls.values()].map((U) => ({ url: U.url, count: U.count, tools: [...U.tools], first: U.first, i: U.i })).sort((a, b) => b.count - a.count || a.first - b.first),
      searches,
      slow: EV.map((e, i) => ({ e, i })).filter(({ e }) => e.kind === 'tool' && e.dur > 0).sort((a, b) => b.e.dur - a.e.dur).slice(0, 10)
        .map(({ e, i }) => ({ i, t: e.t, tool: e.tool, dur: e.dur, err: !!e.err, input: firstLine(e.input, 140) })),
      errors, prompts,
      tokens: Object.assign(tok, { models: byCount(tok.models) }),
      time: { idle, active: Math.max(0, DUR - idle), longestIdle },
    };
  };
})();
