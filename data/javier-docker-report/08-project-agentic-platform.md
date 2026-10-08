# 8. Project — Agentic Platform / AI Cloud

← [Back to index](00-index.md)

**One line:** Primary/lead designer for Docker's agent platform (Jira project APT; renamed "AI Cloud") — defined the product's primitives, IA, and journeys 0→1. His dominant current focus.

## What he did
- Owned **information architecture** (MCP/Connections, Kits, Sandboxes, Policies, Automation) and end-to-end user journeys.
- Designed **sessions vs. sandboxes** modeling, sandbox listing/creation, templates (CRUD), secrets, volumes, activity log, and the **New Session Composer** (chose the Unified Picker direction over tabs/inline/mention-token variants).
- Promoted **Kanban and Artifacts to first-class primitives** with a redesigned tabbed project-detail view ("Calmify AP Project View").
- Led multiple **self-serve onboarding** explorations (coach marks, demo, gamified, Gordon-assisted, credit-card/incentive) — Jira APT-349 — and the empty state for new users.
- Designed **Kits** (list + create), **Connectors**, **Assign a Reviewer agent to PRs**, **Create Project** revamp, new navigation/dashboard, mobile session UI, **attach-into-running-sandbox** (APT-354), **Slack integration** UX (APT-498), and the Share Session flow (APT-486).
- Designed a **Friends & Family launch prototype** and SSH integration connecting external tools (Codex/Cursor) to sandboxes.
- Authored the **"Agentic Platform Research"** plan (DRI) and facilitated the **Dagent UX Study** (~11 moderated sessions).

## "dagent" vs "cagent" — the naming, clarified
Three related names appear in the data; they are not the same thing:
- **dagent** — the *Docker Agent app* (create / run / pull / push / share agents, with an agent marketplace). This is the product layer Javier designed and researched; it is the core of the Agentic Platform / AI Cloud. Telemetry lives in Sigma's `PREP.DAGENT` schema.
- **cagent** — the *open-source CLI multi-agent runtime* (`github.com/docker/cagent`) that Gordon and agents run on.
- **Gordon** — the embedded assistant (its own section).

### dagent metrics (Sigma `L1_DAGENT__AGENT`, Aug 2025 – Jun 2026)
Early-stage/prototype numbers — consistent with his research brief calling the platform "in prototype stage":
- **3,412 agent events · 96 distinct dagent users · 369 distinct agents created**
- Actions: **2,144 runs** (89 users) · 475 pulls · 349 creates · 201 edits · 90 imports · 95 deletes · 39 pushes
- The **Dagent UX Study** Javier facilitated (~11 moderated sessions, Oct 2025) was research on *this exact product*.

## Metrics & successes
- The underlying agent runtime (**cagent**) has logged **~20.7M command events** — the scale of the platform his UX fronts.
- Drove an urgent "code red" design push (Jun 2026) that unblocked the release; delivered a locked GA scope (core AP features + sandbox listing).

## Delivery footprint
Full product definition — primitives, IA, onboarding, mobile, integrations — plus the de-risking research. This is head-of-product-design-level scope: shaping *what the product is*, not just how a screen looks.
