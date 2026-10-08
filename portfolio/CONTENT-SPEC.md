# Portfolio Content Spec — Javier Alonso

All five style directions share this exact content (translate into the style's voice where noted). Two pages per style: **Home** (`index.html`) and **Gordon detail** (`gordon.html`). Static HTML, self-contained per style folder (one `style.css`, small inline JS allowed), Google Fonts via `<link>` with system fallbacks, responsive, `prefers-reduced-motion` respected, semantic + accessible.

## Person
- Name: **Javier Alonso**
- Role line: **Principal Product Designer · Head of Design — AI & Developer Products**
- Location: Madrid, Spain · Email: javier.alonso@docker.com · LinkedIn: /in/javier-alonso (placeholder link "#")
- Positioning (hero statement): *I take AI and developer products from 0→1 — defining the primitives, running the research to de-risk them, shipping the working prototype, and moving the metrics.*
- Proof line: Proven across Docker's Gordon, Model Runner, MCP Toolkit & Catalog, and the Agentic Platform. I built Docker's first CLI Design System.
- Short bio: Principal-level product designer leading design for Docker's AI line. Grew Gordon from a 69-user prototype to ~119,700 monthly active users; designed surfaces serving ~13M MCP pulls; pairs product design with a hands-on research practice and engineering-grade prototyping (ships working HTML/Swift — his macOS app Den is live on the App Store).

## Key stats (home)
| Metric | Value | Label |
|---|---|---|
| Gordon MAU | 69 → 119,739 | Nov 2024 → Jun 2026 |
| MCP catalog pulls | ~13.1M | Dec 2024 → Jul 2026 |
| MCP activation funnel | ~2.5× | awareness → successful tool call, DD 4.45→4.46 |
| Model pulls (DMR) | ~2.1M | 91.5K users · 124.2K installs · 18.2K models |
| Agentic runtime | ~20.7M | command events behind the platform he defined |

## Work index (home) — 6 projects, in this order
1. **Gordon — Docker's AI agent** · Design lead, 0→1 → GA → monetization · 2024–2026 · 69 → ~119.7K MAU · "Interaction model, onboarding, and safety UX that made it acceptable to let an agent act on your machine." → link to gordon.html
2. **MCP Toolkit & Catalog** · Design lead, net-new · 2024–2025 · ~13.1M pulls · "Two releases, ~2.5× end-to-end conversion — the most attributable funnel win in the portfolio."
3. **Docker Model Runner** · Design lead, 0→1 · 2025 · ~2.1M pulls · "Local LLMs across Desktop, CLI and Hub; he coded the Hub model cards himself."
4. **Agentic Platform / AI Cloud** · Primary designer, 0→1 · 2025–2026 · primitives: sessions · sandboxes · kits · "Defined the product's primitives and IA before it had a name."
5. **CLI Design System** · Creator · 2023–2024 · org-wide adoption · "Docker's first CLI design language — now how every team ships terminal UX."
6. **Den** · Solo build & ship · 2026 · App Store · "A macOS tool he designed and wrote in Swift — prototyping taken to production."

## About strip (home)
- Research-led: authored/facilitated 5+ studies (Ask Gordon Continuous Research Plan · Agentic Platform Research, DRI · Model Runner Insights · DockerCon CLI Research Report · Dagent UX Study).
- Recognition: early Figma-MCP power user courted by Figma → invited to apply to speak at Config 2026; `--help-agent` concept called "genuinely novel"; conducts staff-level design interviews.
- Tools: Figma · HTML/CSS/JS prototypes on Vercel · Swift/macOS · Qualtrics, Maze, Useberry · Sigma.

## Gordon detail page (gordon.html)
- Title: **Gordon** — From a 69-user prototype to ~119,700 monthly active users.
- Meta: Docker · Design lead, end-to-end · 2024–2026 · Personas: Ana (AI-curious dev) · Sam (newcomer) · Marco (safety & governance) · Dana (plans & pricing).
- **Context:** Docker needed an AI assistant meeting developers where they work (Desktop + CLI) — no separate chat tool, and no unsafe agent actions on their machine. A true 0→1 bet: no established pattern, no existing users.
- **Role:** interaction model · onboarding · safety/permission UX · billing & GA flows · support integration · the feedback research pipeline.
- **Jobs-to-be-done (use cases):**
  - "Ask about my containers/images/compose without leaving Docker." → Gordon in global search + Containers/Images/Volumes tabs.
  - "Let the agent act — but never do something destructive without my okay." → danger classification (cautious/safer tiers), allow/deny dialog, CLI hook. **The safety pattern became the reference for other agent dialogs across Docker.**
  - "Understand what Gordon costs and which plan I need." → budget/token views, plan mode, pricing.
  - "Get started without reading docs." → onboarding + login nudge.
  - "Tell Docker when Gordon gets it wrong." → in-product Qualtrics feedback → permalink → Slack routing.
- **Process:** authored the continuous research plan; stood up the feedback pipeline; iterated free/blocked states, JIT nudges, permission tiers across releases; shipped V2 GA + pricing (Apr 2026), GA with Desktop 4.74 (May 2026), again in 4.80 (Jul 2026).
- **Impact:** 69 → ~119,739 MAU; ~13× step-up at Ask Gordon launch (Desktop 4.38: 3,637 → 46,315); requests/month ~193K → ~4.3M; ~$260 MRR shortly after monetization.
- **Honesty notes (include, styled as a small footnote/caveat block):** growth reflects many contributors — design was a necessary enabler; "requests" include background agentic calls; figures approximate, current to Jul 2026.
- **Reflection:** proudest of the safety UX — it made "let the agent act" shippable, and propagated to other products.
- Footer nav: ← back to work · next project: MCP Toolkit & Catalog (link "#").

## Taste anchors (from the owner's collection — inspiration/README.md)
Warm paper or true-black grounds (never mid-gray); grotesque body + one expressive display + monospace metadata; a single honest accent; hairline borders over shadows; print-era texture (grain, halftone, dither); physical, brief, spring-eased motion; OS/desktop metaphors; pill/squircle or zero-radius corners (two camps).
