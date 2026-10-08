# 4. 0→1 projects

← [Back to index](00-index.md)

Javier's Docker record is unusually weighted toward **net-new, built-from-scratch** work. Evidence below is drawn from Notion, Slack, Gmail, and Drive.

| Project | 0→1? | Evidence |
|---|---|---|
| **Docker Model Runner** | ✅ Confirmed | His research doc set out to "assess **initial** user reactions to the Docker Model Runner." He described himself (email, Oct 2025) as "diseñando el motor de inferencia de Docker" — designing Docker's inference engine. |
| **Gordon / Ask Gordon** | ✅ Confirmed | "Ask Gordon **has been released on 4.38.0**… now critical to discover not only usability issues but also how Gordon can be adjusted to real usage." Built the feedback pipeline from the ground up. Grew 69 → ~119.7K MAU. |
| **Agentic Platform / Dagent (AI Cloud)** | ✅ Confirmed | Research brief: "The platform is currently **in prototype stage** and hosted on Vercel." Slack: "**the first time we mention sandboxes as a primitive** in that UI," "the **initial design for the empty status for new users** of AP." Designed net-new primitives (sessions, sandboxes, kits, composer). |
| **CLI Design System (DDS-CLI)** | ✅ Confirmed | "**Start Docker CLI Design System**" (2023); "Docker Design System for CLI (**First draft**)," 2023-03-27; "These are the **foundations of a CLI design system**." He created Docker's CLI design system from scratch. |
| **Den** (macOS sandbox manager) | ✅ Confirmed | "I recently **created a GUI for sbx** — useden.ai" (Jul 2026); ships his own signed `.dmg` builds. |
| **MCP Toolkit / Catalog** | ✅ Net-new product | Listed among products he designs; owns `MCP Toolkit.fig` and the content decks. Net-new surface, though with lighter explicit "MVP/first" wording than the above. |
| **Vein** (personal agent interface) | ⚠️ Unverified | Referenced in meeting notes as a personal Gordon/agent interface; no corroborating Slack/Drive hit found. Flag as unverified. |

## Why this matters at principal/head level
0→1 design demands defining the problem, the mental model, the primitives, and the first working version — not just refining an existing surface. Javier did this repeatedly and across very different layers of the stack: a developer CLI design system, a local inference product, an embedded AI assistant, and a cloud agent platform. He also **created the research to de-risk** those bets (see [page 10](10-research-practice.md)) and **built his own tools** to pressure-test the direction.

*Nuance: even on 0→1 products he pragmatically reused shared assets where sensible — e.g., adopting the existing **Trident** design system for an AI Cloud feature rather than hand-rolling components.*
