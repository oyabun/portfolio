# Case study — Gordon (Docker's AI agent)

← [Back to portfolio](00-README.md)

> **From a 69-user prototype to ~119,700 monthly active users** — designing the interaction model, onboarding, and safety UX for Docker's AI agent through GA and monetization.

## Context & problem
Docker needed an AI assistant that met developers where they already worked — the Desktop and CLI — without forcing them into a separate chat tool, and without letting an agent take unsafe actions on their machine. The bet was 0→1: no established pattern, no existing users.

## My role
Design lead, end to end: interaction model, onboarding, safety/permission UX, billing/GA flows, support integration, and the feedback research pipeline. Partnered with the AI-agent eng team, PM, and design leadership.

## Personas served
**P1 Ana** (AI-curious dev), **P4 Sam** (newcomer), **P2 Marco** (safety/governance), **P5 Dana** (plans/pricing).

## Use cases (jobs-to-be-done)
- "Ask a question about my containers/images/compose without leaving Docker." → Gordon embedded in global search + Containers/Images/Volumes tabs.
- "Let the agent act, but never do something destructive without my okay." → danger classification (cautious/safer tiers) + allow/deny dialog + CLI hook.
- "Understand what Gordon costs me and what plan I need." → budget/token-usage views, plans/pricing.
- "Get started without reading docs." → onboarding + login nudge + plan mode.
- "Tell Docker when Gordon gets it wrong." → in-product Qualtrics feedback → Slack routing.

## Process
Research-led and iterative: authored the **Ask Gordon Continuous Research Plan**, stood up a continuous feedback loop (Qualtrics + `feedback.docker.com/gordon` + Slack routing), and iterated interaction patterns and safety UX across releases. Explored many variants (free/blocked states, "advertise/JIT" nudges) and shipped the selected directions.

## Delivery
Interaction model · onboarding · permission/safety UX (reused as the reference pattern for other agent dialogs) · budget/token views · plan mode · model selection · Gordon-in-Support · billing/GA flows (V2 GA + pricing Apr 2026; GA w/ Desktop 4.74 May 2026; shipped again in 4.80 Jul 2026) · marketing-page input.

## Impact
- **69 → ~119,739 monthly active users** (Nov 2024 → Jun 2026); **~13× step-up** around the Ask Gordon launch (Desktop 4.38).
- **Requests/month ~193K → ~4.3M** as embedded/agentic entry points drove background usage.
- **~$260 MRR** shortly after monetization, exceeding some established Docker products.

## Reflection / what I'd show
The safety-UX pattern is the piece I'm proudest of — it made "let the agent act" safe enough to ship, and it propagated to other products. In a portfolio I'd pair the MAU curve with the before/after of the permission dialog and the onboarding flow.

*Sources: Sigma `L3_GORDON__DAILY_USAGE`; Slack impact summary; Notion research plan. Metrics current to Jul 2026.*
