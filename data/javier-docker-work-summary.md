# Javier Alonso — Meaningful Work at Docker

*Staff Product Designer (principal-designer track), Product Design team. At Docker since Jan 2023. Compiled from Jira, Notion, Slack, Gmail/Calendar, Granola meeting notes, and Sigma analytics. Metrics dated as of 20–21 Jul 2026.*

Over three-plus years Javier moved from Docker Desktop/CLI UX into the lead design role for Docker's entire AI product line — **Docker Model Runner, Gordon, the MCP Toolkit & Catalog, and the Agentic Platform / AI Cloud** — while operating as a rare designer-builder who ships his own working prototypes and internal tools. The surfaces he designed now account for tens of millions of usage events and hundreds of thousands of users.

---

## Main successes at a glance

- **Designed Docker's local-AI foundation (Model Runner):** ~2.1M model pulls, ~91K distinct users, ~124K Desktop installs, peaking above 10K monthly active model users.
- **Designed the MCP surfaces that made Docker a hub for agent tooling:** ~13.1M MCP Catalog pulls and ~10.6M MCP tool-call events; the Toolkit peaked at ~10K weekly engaged Desktop instances.
- **Took Gordon from concept to GA and monetization** (Desktop 4.74, May 2026; V2 GA + pricing, Apr 2026), including the reusable permission/safety UX pattern.
- **Is the lead designer for the Agentic Platform / AI Cloud** — IA, sessions/sandboxes model, onboarding, and the "first-class Kanban + Artifacts" project view.
- **Built Docker's first CLI Design System**, now an org-wide standard.
- **Recognized as a design thought leader:** "genuinely novel" `--help-agent` concept, early Figma-MCP power user courted by Figma for Config 2026, and self-built macOS tools (Den/Vein) that previewed official product direction.

---

## Headline metrics (Sigma)

| Surface Javier designed | Metric | Value | Window |
|---|---|---|---|
| **Docker Model Runner** | Total model pulls | **~2,101,000** | Feb 2025 – Jul 2026 |
| Docker Model Runner | Distinct Hub users running models | **~91,500** | Feb 2025 – Jul 2026 |
| Docker Model Runner | Distinct Desktop instances | **~124,200** | Feb 2025 – Jul 2026 |
| Docker Model Runner | Distinct models run | **~18,200** | Feb 2025 – Jul 2026 |
| Docker Model Runner | Peak monthly active model users | **~10,085** | Apr 2026 |
| **MCP Catalog** | Total image pulls | **~13,130,000** | Dec 2024 – Jul 2026 |
| **MCP Toolkit** | MCP tool-call events | **~10,582,000** | to Jul 2026 |
| MCP Toolkit | Peak weekly engaged Desktop instances | **~10,075** | wk of 22 Feb 2026 |
| MCP Toolkit | Peak weekly engaged authenticated users | **~8,212** | wk of 22 Feb 2026 |
| **cagent** (agent CLI) | Command events | **~20,693,000** | to Jul 2026 |
| **Gordon** | Engaged uses / month (self-reported) | **~60,000** | 2025 |
| Gordon | MRR shortly after monetization | **~$260** | late May 2026 |

---

## Project deep dives

### 1. Docker Model Runner (DMR)
Led end-to-end UX for running LLMs locally through Docker Desktop — Docker's flagship "GenAI in the product" initiative.

**What he did**
- Designed the Model Runner experience across **Docker Desktop UI, the CLI (inference UX — push/pull), and Docker Hub**.
- Designed *and coded* the **AI model cards** on Docker Hub (`docker/model-cards`), including a new Model card layout.
- Owned the AI Model / provider-selection flow (handoff-documented for continuity).

**Metrics & successes**
- **~2.1M total model pulls** across **~18,200 distinct models** since launch (Feb 2025).
- **~91,500 distinct users** and **~124,200 Desktop instances** have run a model.
- **Monthly active model users** scaled quickly and stayed strong: ~9,200 (Feb 2026), **~10,085 peak (Apr 2026)**, ~6,100 (Jun 2026).
- Most-pulled models he surfaced include `ai/nomic-embed-text` (~313K), Qwen2.5-Coder variants (~304K combined), `ai/llama3.2` (~94K), and `ai/gemma3` (~170K combined) — evidence the catalog UX drives real model discovery.

### 2. Gordon — Docker's AI agent
His deepest, most sustained ownership; design lead from early interaction patterns through GA and monetization.

**What he did**
- Created Gordon's core **interaction patterns, MCP integration, and onboarding** — Gordon became the default entry point for trying MCPs.
- Designed the **permission / safety UX**: danger classification (cautious/safer tiers), allow/deny dialogs, and the CLI hook for destructive-action prevention — later reused as the pattern for other permission dialogs.
- Reviewed billing and features for the **GA launch with Docker Desktop 4.74 (May 2026)** and the **Gordon V2 GA + pricing transition (Apr 2026)**.
- Designed **budget/token-usage** views, **Plan mode**, guardrails, login nudge, model selection, free/blocked usage states, and "advertise/JIT" mockups.
- Designed **Gordon in Support** (app.docker.com/support) and contributed to the Gordon marketing webpage.

**Metrics & successes**
- **~60K engaged uses/month** (his own impact reporting) and **~$260 MRR** shortly after monetization — exceeding some established Docker products at that point.
- Shipped in **Desktop 4.80 (Jul 2026)** with the "golden light" rollout and in-app announcements.
- Permission/safety UX became a reference pattern across Docker's agent products.

### 3. MCP Toolkit, Catalog & Marketplace
Led full UX for Docker's Model Context Protocol surfaces — the MCP team built directly from his concepts.

**What he did**
- Designed the **MCP Toolkit** in Docker Desktop: discovery/onboarding, tool filtering, remote MCPs, credential and client-connection flows.
- Designed the **Hub MCP Marketplace** (hub.docker.com/mcp) and **Custom MCP Server via URL** in Integrations.

**Metrics & successes**
- **~13.1M MCP Catalog pulls** (Dec 2024 – Jul 2026) and **~10.6M MCP tool-call events**.
- **Peaked at ~10,075 weekly engaged Desktop instances / ~8,212 authenticated users.**
- Top catalog images by pulls include `mcp/signatures` (~12.7M), `mcp/playwright` (~8.5M), `mcp/grafana` (~7.4M), `mcp/sonarqube` (~5.3M), and `mcp/docker-mcp-catalog` (~5.3M).
- Top servers used from the Toolkit include dynamic-mcps (~51.9K instances), Playwright (~42.4K), Obsidian, GitHub-official, and Fetch — a healthy long tail of real adoption.

### 4. Agentic Platform / AI Cloud (AP)
Primary/lead designer through 2026 — his dominant current focus (Jira project APT; the product was renamed "AI Cloud").

**What he did**
- Owned **information architecture** (MCP/Connections, Kits, Sandboxes, Policies, Automation) and end-to-end user journeys.
- Designed **sessions vs. sandboxes** modeling, sandbox listing/creation, templates (CRUD), secrets, volumes, activity log, and the **New Session Composer** (chose the Unified Picker direction).
- Promoted **Kanban and Artifacts to first-class primitives** with a redesigned tabbed project-detail view ("Calmify AP Project View").
- Led multiple **self-serve onboarding** explorations (coach marks, demo, gamified, Gordon-assisted, credit-card/incentive) — Jira APT-349.
- Designed **Kits** (list + create), **Connectors**, **Assign a Reviewer agent to PRs**, **Create Project** revamp, new navigation/dashboard, mobile session UI, **attach-into-running-sandbox** (APT-354), **Slack integration** UX (APT-498), and the Share Session flow (APT-486).
- Designed a **Friends & Family launch prototype** and SSH integration connecting external tools (Codex/Cursor) to sandboxes.

**Metrics & successes**
- The underlying agent runtime (**cagent**) has logged **~20.7M command events** — the scale of the platform his UX fronts.
- Delivered a locked GA scope (core AP features + sandbox listing) and drove an urgent "code red" design push (Jun 2026) that unblocked the release.

### 5. Docker Desktop simplification
Newer ownership, partnering with Ryan Taylor.

- Defining a stripped-down Desktop v1: Workloads screen (Compose Stacks + Containers), simplified container-creation flow, display-only image security badges/vuln scores, and scoped-down navigation.
- Earlier (2023–24) foundational Desktop/CLI UX: Finalized Desktop UX and CLI UX (ADUI-4/5), logged-out states, "Features in Development" locked state.

### 6. CLI Design System (DDS-CLI)
- Built **Docker's first CLI Design System** (Notion + Figma) — now adopted org-wide (e.g., Docker Offload), described internally as becoming "Docker's Organizational Standard."

### 7. Thought leadership, tooling & recognition
- Proposed a **`--help-agent` CLI flag** for machine-readable command context — praised internally as "genuinely novel."
- Built personal macOS tools **Den** (sandbox manager) and **Vein** (personal agent interface) that previewed official product direction; enrolled in the Apple Developer Program to ship them.
- **Early Figma-MCP power user** — Figma reached out to showcase his AI-agent workflow and invited him to apply to speak at **Config 2026**.
- Drove **Trident design-system adoption** ahead of the September WeAreDevelopers event.
- On the **principal-designer track**; conducting staff-level design interviews.

---

## Research reports by surface

### Jira (Atlassian)
Confirmed identity: **Javier Alonso, Staff Product Designer, PROD-Product Design**, account created 23 Jan 2023. His Jira-tracked product work concentrates in **Agentic Platform (APT)** for 2026 (onboarding APT-349, attach-to-sandbox APT-354, Share Session APT-486, Slack UX APT-498, Go-Back APT-634) and **Docker Desktop UI (ADUI-4/5)** for 2023. His actual deliverables live as Vercel prototypes and `docker/design-ja-*` GitHub repos rather than in Jira, so ticket volume understates output. As reporter he filed ~19 operational tickets (IT/tooling/Vercel access). *Confluence could not be read — the connector is not authorized for that instance (403).*

### Notion
Javier maintains a personal workspace with continuous **weekly status updates (Week 19 → Week 28, ~May–Jul 2026)**, a **UX Backlog** database, and a "work awareness" tracker of his Slack/GitHub activity. Notion documents his two parallel tracks — **Gordon** (budget/token usage, GA, plan mode, guardrails, permissions, support integration) and the **Agentic Platform** (TUI, onboarding variants, sandboxes, sessions/terminal, Kits, connectors, project-creation, reviewer agent, Kanban, navigation). Confirms the design-engineering hybrid pattern: Figma explorations plus deployed HTML prototypes tied to specific issues/PRs. Also surfaced a 2024 hackathon ("NaN / Run TUI") and 2023 Desktop UX work, indicating a multi-year tenure.

### Slack
Most active in **#design, #team-agentic-platform, #group-design-private**, and product-feedback channels. His **self-authored impact summary** (DM, 27 Oct 2025) is the single best accomplishment record — it lays out DMR, Gordon, MCP Toolkit, and the CLI Design System with usage metrics and Figma links. Notable threads: "Calmify AP Project View" (tabbed layout, May 2026), Gordon prototype showcase (Jul 2026), onboarding explorations with engineers (Jun 2026), "code red for AP-design" (Jun 2026), and Project-Level Artifacts delivery (May 2026). Slack also documents team friction in 2026 (design-ownership consolidation, Trident mandate) — context, not deliverables.

### Gmail, Calendar & Granola
Recurring meetings reveal his embedded, cross-functional role: **Agentic Platform Weekly Planning**, **AI Cloud UX weekly journey review**, **Gordon UX-Review**, **GA UX Designs Review**, **UX Office Hour (IC)** and **Designers Only Sync**, plus 1:1s with managers/leads (Arnaud Héritier, Earl Carlson, Roberta Carraro) and PMs. Email milestones: **Gordon V2 GA + pricing (Apr 2026)**, Gordon webpage collaboration (May 2026), and Figma's outreach about his early MCP usage (Sep–Oct 2025). Granola notes capture concrete decisions: AP→AI Cloud rename, permission/safety UX, Desktop-simplification scope with Ryan Taylor, and the Trident-before-September mandate.

### Sigma (analytics)
Primary source for the hard numbers above. Relevant workbooks/tables: **Docker Model Runner**, **AI Tools – MCP Metrics**, **AI Agent Apps**, **Docker AI Usage Report**, and `PRES_PRODUCT__DESKTOP_MODEL_RUNNER_PULLS_DAILY`. DMR and MCP figures were queried directly and are reliable. *Caveat: several single-value KPI tiles in the "AI Agent Apps" workbook (total sessions, total agent runs, active users) returned 0 to direct SQL because they depend on in-dashboard filters; Gordon per-month figures therefore come from Javier's own reporting rather than a live query.*

---

## Ways of working
- **Designer + builder:** ships working HTML/Vercel prototypes (`docker/design-ja-*` repos) tied directly to GitHub issues/PRs, not just Figma mockups.
- **Exploration-heavy:** routinely produces multiple labeled variants and marks the selected direction.
- **Embedded cross-functional partner:** weekly AP planning, AI Cloud UX journey reviews, Gordon UX reviews, IC design syncs, and leadership 1:1s.
- **Design philosophy:** calmer, simplified layouts; reduced vertical scroll; consistency across surfaces; pragmatic prototyping.

---

## Data caveats
- **Confluence** was not readable (connector not authorized for that instance), so Confluence-authored docs are not reflected.
- **Gordon monthly usage / MRR** come from Javier's own impact reporting (Slack/meetings); the Sigma KPI tiles for agent apps were filter-dependent and returned 0 to direct queries.
- All Sigma figures are approximate and current to 20–21 Jul 2026.

## Sources
- Sigma: [Docker Model Runner](https://app.sigmacomputing.com/docker/workbook/Docker-Model-Runner-1GD2Igh5b8zsHd4m8gFxxJ) · [AI Tools – MCP Metrics](https://app.sigmacomputing.com/docker/workbook/AI-Tools-MCP-Metrics-4LQVzm0Yoi7lucpO3m9647) · [AI Agent Apps](https://app.sigmacomputing.com/docker/workbook/AI-Agent-Apps-73I6iZInWLYNLuW1azrriJ) · [Docker AI Usage Report](https://app.sigmacomputing.com/docker/workbook/Docker-AI-Usage-Report-4K7NJ0ty7SUcPlQNS68fcD)
- Slack impact summary (DM to Earl Carlson, 27 Oct 2025): `docker.enterprise.slack.com/archives/D06R99WMHUN/p1761592495691059`
