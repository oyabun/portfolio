# Case study — Agentic Platform / AI Cloud

← [Back to portfolio](00-README.md)

> **Defined the product 0→1 — its primitives, IA, onboarding, and journeys — for Docker's cloud agent platform** fronting a runtime with ~20.7M command events.

## Context & problem
Docker was building a platform to run and manage AI agents in the cloud, but the product had no established mental model: what is a session vs. a sandbox? what's a kit? how do users delegate work to agents and trust the result? It started as a Vercel prototype with unvalidated core flows.

## My role
Primary/lead designer. Defined primitives and IA, designed onboarding and the end-to-end journeys, ran the platform research (DRI), and drove an urgent design push to unblock release.

## Personas served
**P3 Priya** (agent engineer), **P5 Dana** (governance/cost), **P2 Marco** (safe execution), **P1 Ana** (self-serve start).

## Use cases (jobs-to-be-done)
- "Start an agent session and watch it work." → sessions, New Session Composer (Unified Picker), session detail, mobile session UI.
- "Run agents safely in isolated environments." → sandboxes (listing/creation, templates, secrets, volumes, activity log).
- "Package reusable capabilities." → Kits (list + create).
- "Connect my tools and external editors." → Connectors, MCP integration, SSH to Cursor/Codex.
- "Understand a project at a glance." → tabbed project-detail view with Kanban + Artifacts as first-class primitives.
- "Get started without hand-holding." → onboarding explorations (coach marks, demo, gamified, Gordon-assisted) + empty states.
- "Assign an agent to review my PR." → reviewer-agent flow.

## Process
Research-first: authored the **Agentic Platform Research** plan (screener survey → 6–8 moderated interviews → unmoderated Useberry usability tests with SUS/UMUX-Lite) and facilitated the **Dagent UX Study** (~11 sessions). Explored multiple directions per flow and marked the selected one; pragmatically adopted the Trident design system where it fit.

## Delivery
IA (MCP/Connections, Kits, Sandboxes, Policies, Automation) · sessions/sandboxes model · New Session Composer · project-detail (Kanban + Artifacts) · onboarding + empty states · Kits · Connectors · reviewer agent · Create Project revamp · mobile session UI · attach-into-running-sandbox · Slack integration · Share Session · F&F launch prototype · SSH integration.

## Impact
- Fronts an agent runtime (**cagent**) with **~20.7M command events**.
- Drove a "code red" design push (Jun 2026) that unblocked the release; delivered a locked GA scope.
- (Product still ramping — adoption metrics not yet mature; scope and definition are the headline here.)

## Reflection / what I'd show
This is my clearest product-definition work — shaping *what the product is*. In a portfolio I'd show the primitives model (sessions/sandboxes/kits), the composer exploration set, and the research plan that de-risked it.

*Sources: Notion (Agentic Platform Research, Dagent UX Study); Jira (APT); Slack; Sigma (cagent command events).*
