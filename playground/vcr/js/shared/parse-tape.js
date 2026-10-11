// window.parseTape(text, filename): a session .jsonl, flattened into the tape
// shape the explorations read from window.TAPE. Runs in the page, so a player
// can load any session; alt/tools/make-sample.mjs runs this same file to bake
// the default tape.js.
//
// Prompts, replies and thinking are kept whole, line breaks and all: the player
// shows them in full. Tool inputs and results can be whole files, so they keep
// their formatting but stop at MAX_TOOL characters, marked as truncated. (This
// used to clip everything to a few hundred characters on one line, which cut
// long prompts off mid-word.)
(function () {
  'use strict';
  const MAX_TOOL = 20000;
  const keep = (s, n) => {
    s = String(s == null ? '' : s).replace(/\r\n?/g, '\n').trim();
    return n && s.length > n ? s.slice(0, n).trimEnd() + '\n[… truncated]' : s;
  };
  const toolInput = (input) => {
    input = input || {};
    return input.command ?? input.file_path ?? input.pattern ?? input.url ?? input.query ??
      input.description ?? input.prompt ?? JSON.stringify(input);
  };
  const resultText = (c) =>
    typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => b.text ?? '').join(' ') : '';
  /* What a response cost: list prices in $ per million tokens (in, out, cache read, 5-minute cache write), by model.
     The first key that starts the model id wins, so a longer id goes before its prefix. From Anthropic's price list,
     2026-09-25. A cache write is 1.25x input; a cache read 0.1x, except where a model's price list says otherwise.
     window.tapePricing lets a page change them: a custom rate per model, or rates fetched from a public price list
     (LiteLLM's), both kept in localStorage; recost(tape) prices a parsed tape again with whatever is in force. */
  const PRICES = [
    ['claude-fable-5-1', 10, 50, 0.25], ['claude-mythos-5-1', 10, 50, 0.25], ['claude-fable-5', 10, 50], ['claude-mythos-5', 10, 50],
    ['claude-opus-5-5', 4, 20, 0.2], ['claude-opus-5', 5, 25], ['claude-opus-4-8', 5, 25], ['claude-opus-4-7', 5, 25],
    ['claude-opus-4-6', 5, 25], ['claude-opus-4-5', 5, 25], ['claude-opus-4', 15, 75],
    ['claude-sonnet-5-5', 2, 10, 0.2], ['claude-sonnet-5', 2, 10], ['claude-sonnet-4', 3, 15], ['claude-3-7-sonnet', 3, 15], ['claude-3-5-sonnet', 3, 15],
    ['claude-haiku-4-5', 1, 5], ['claude-3-5-haiku', 0.8, 4], ['claude-3-haiku', 0.25, 1.25],
  ].map(([m, i, o, cr]) => [m, { in: i, out: o, cr: cr != null ? cr : +(i * 0.1).toFixed(4), cw: +(i * 1.25).toFixed(4) }]);
  const DEFAULT_RATE = { in: 5, out: 25, cr: 0.5, cw: 6.25 };   // an unknown model: priced as an Opus
  const PRICED_ON = '2026-09-25';
  const LIVE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
  const ls = {   // localStorage, where there is one (make-sample.mjs runs this file with no browser around it)
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const bare = (m) => String(m || '').replace(/^(anthropic\.|us\.anthropic\.|eu\.anthropic\.)/, '').replace(/-\d{8}$/, '').replace(/@.*$/, '');
  // the rate for a model, and where it came from: 'custom', 'live', 'list' or 'default'
  function rateFor(model) {
    const id = bare(model), custom = ls.get('vcr-prices-custom') || {}, live = ls.get('vcr-prices-live');
    if (custom[id]) return { rate: custom[id], source: 'custom' };
    if (live && live.rates && live.rates[id]) return { rate: live.rates[id], source: 'live', at: live.at };
    const hit = PRICES.find(([k]) => id.startsWith(k));
    return hit ? { rate: hit[1], source: 'list', at: PRICED_ON } : { rate: DEFAULT_RATE, source: 'default' };
  }
  const costOf = (r, rate) => +((r.in * rate.in + r.out * rate.out + r.cr * rate.cr + r.cw * rate.cw) / 1e6).toFixed(5);
  window.tapePricing = {
    PRICED_ON, LIVE_URL, rateFor, bare,
    // price every response again (a tape kept from an earlier visit was priced with the rates of the day)
    recost(tape) { for (const r of tape.responses || []) r.cost = costOf(r, rateFor(r.model || tape.model).rate); return tape; },
    setCustom(model, rate) { const c = ls.get('vcr-prices-custom') || {}; if (rate) c[bare(model)] = rate; else delete c[bare(model)]; ls.set('vcr-prices-custom', c); },
    // fetch current prices for Claude models from LiteLLM's public list ($ per token there, per million here)
    async fetchLive() {
      const res = await fetch(LIVE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('The price list answered ' + res.status);
      const all = await res.json(), rates = {}, per = (v) => (v == null ? null : +(v * 1e6).toFixed(4));
      for (const [k, v] of Object.entries(all)) {
        const id = bare(k);
        if (!/^claude-/.test(id) || !v || v.input_cost_per_token == null || rates[id]) continue;
        if (v.litellm_provider && v.litellm_provider !== 'anthropic') continue;
        const i = per(v.input_cost_per_token);
        rates[id] = { in: i, out: per(v.output_cost_per_token), cr: per(v.cache_read_input_token_cost) ?? +(i * 0.1).toFixed(4), cw: per(v.cache_creation_input_token_cost) ?? +(i * 1.25).toFixed(4) };
      }
      if (!Object.keys(rates).length) throw new Error('The price list had no Claude models in it.');
      ls.set('vcr-prices-live', { at: new Date().toISOString().slice(0, 10), rates });
      return rates;
    },
    clearLive() { ls.set('vcr-prices-live', null); },
  };

  window.parseTape = function parseTape(text, filename) {
    const events = [], responses = new Map(), calls = new Map();
    let title = '', model = '', cwd = '';
    for (const line of String(text).split('\n')) {
      if (!line.trim()) continue;
      let o;
      try { o = JSON.parse(line); } catch (e) { continue; }
      if (o.type === 'ai-title' && o.aiTitle) title = o.aiTitle;
      if (o.cwd) cwd = o.cwd;
      if (!o.timestamp) continue;
      const t = Date.parse(o.timestamp);
      if (isNaN(t)) continue;
      const m = o.message;

      if (o.type === 'user' && m) {
        if (typeof m.content === 'string') {
          if (!m.content.startsWith('<')) events.push({ t, kind: 'prompt', text: keep(m.content) });
          continue;
        }
        for (const b of m.content || []) {
          if (b.type === 'text' && !o.isMeta && !String(b.text).startsWith('<'))
            events.push({ t, kind: 'prompt', text: keep(b.text) });
          if (b.type === 'tool_result' && calls.has(b.tool_use_id)) {
            const c = calls.get(b.tool_use_id);
            c.dur = Math.max(0, t - c.t);
            c.err = !!b.is_error;
            c.result = keep(resultText(b.content), MAX_TOOL);
          }
        }
      }

      if (o.type === 'assistant' && m) {
        model = m.model || model;
        const u = m.usage || {};
        // A response is logged across several lines that repeat its usage: count once.
        if (m.id && !responses.has(m.id)) {
          responses.set(m.id, {
            t, model: m.model,
            in: u.input_tokens || 0, out: u.output_tokens || 0,
            cr: u.cache_read_input_tokens || 0, cw: u.cache_creation_input_tokens || 0,
          });
        }
        for (const b of m.content || []) {
          if (b.type === 'text' && String(b.text).trim()) events.push({ t, kind: 'text', text: keep(b.text) });
          if (b.type === 'thinking') events.push({ t, kind: 'thinking', text: keep(b.thinking) });
          if (b.type === 'tool_use') {
            const c = { t, kind: 'tool', tool: b.name, input: keep(toolInput(b.input), MAX_TOOL), dur: 0, err: false, result: '' };
            calls.set(b.id, c);
            events.push(c);
          }
        }
      }
    }
    if (!events.length) throw new Error('No session events found. Is this a Claude Code .jsonl?');

    events.sort((a, b) => a.t - b.t);
    const t0 = events[0].t;
    const t1 = Math.max(...events.map((e) => e.t + (e.dur || 0)));
    const resp = [...responses.values()].sort((a, b) => a.t - b.t).map((r) => Object.assign({}, r, {
      t: r.t - t0,
      cost: costOf(r, rateFor(r.model || model).rate),
    }));
    const base = String(filename || 'session.jsonl').split(/[\\/]/).pop();
    return {
      source: base,
      title: title || base.replace(/\.jsonl$/i, ''),
      model, cwd,
      start: new Date(t0).toISOString(),
      duration: t1 - t0,
      events: events.map((e) => Object.assign({}, e, { t: e.t - t0 })),
      responses: resp,
    };
  };
})();
