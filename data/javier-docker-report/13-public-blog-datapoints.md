# 13. Public data points (Docker blog)

← [Back to index](00-index.md)

External, citable facts from Docker's official blog for the products Javier designed. These corroborate the internal metrics and are safe to use publicly (e.g., in a portfolio or interview).

## Public launch timeline

| Date | Milestone | Product |
|---|---|---|
| ~Jan 2025 | **Gordon beta** ships in **Docker Desktop 4.38** | Gordon |
| Apr 2025 | **MCP Catalog & Toolkit announced** ("Dockerizing MCP") | MCP |
| Apr 2025 | **Docker Model Runner** first **Beta** release | DMR |
| May 2025 | **MCP Catalog launches with 100+ verified tools** | MCP |
| Sep 18, 2025 | **Docker Model Runner GA** | DMR |
| Feb 23, 2026 | Gordon update in **Desktop 4.61** (still beta) | Gordon |
| May 19, 2026 | **Gordon GA** (built into Desktop 4.74+ and CLI, free with every account) | Gordon |
| May 12, 2026 | **Docker AI Governance** introduced | AI Cloud/Agents |

## Gordon (public)
- Built on **cagent**, Docker's open-source agent framework, and runs locally within Docker Desktop. Invoked via `docker ai` or the Desktop sidebar.
- **Permission model** described publicly exactly as Javier designed it: "Gordon shows you what it wants to do, you approve or reject, then it executes. Every command. Every file update. Every Docker operation." — this is his safety/permission UX, now the product's headline trust feature.
- "**9× increase in weekly active users**" cited by Docker — a conservative, quotable external stat that aligns with (and is more modest than) the internal Sigma growth (69 → ~119.7K MAU).
- GA post co-authored by Nuno Coração (Principal PM, AI agents) and Deanna Sparks.

## Docker Model Runner (public)
- Beta Apr 2025 → **GA Sep 18, 2025**; **open source and free**; repo at `github.com/docker/model-runner`.
- Built on **llama.cpp**; OpenAI-compatible APIs; models packaged as **OCI artifacts** on Docker Hub / pulled from HuggingFace.
- GA post explicitly highlights the surface Javier designed: "**The UI provides guided onboarding to help even first-time AI developers start serving models smoothly**," plus a **curated model catalog** on Docker Hub and built-in **tracing/inspect** for token usage.
- GA post co-authored by **Francesco Corti** — the same colleague Javier co-authored the internal "Docker Model Runner – Insights" research with, corroborating his involvement.

## MCP Catalog & Toolkit (public)
- Launched **May 2025 with 100+ verified tools** from partners including **Stripe, Elastic, Neo4j, Heroku, Pulumi, Grafana Labs, Kong, New Relic, Continue.dev**.
- **One-click launch** from Docker Desktop; connects to **Gordon, Claude, Cursor, VS Code, Windsurf, continue.dev, Goose**.
- Built-in **OAuth + credential management**, a **Gateway MCP Server**, the **`docker mcp` CLI**, and **memory/network/disk isolation** by default.
- Framing: "do for agentic AI what containers did for app deployment." Docker context: **20M+ developers, billions of pulls/month.**

## Agentic Platform / cagent & Sandboxes (public)
- **cagent** — Docker's **open-source multi-agent runtime**: define agents in a single **YAML** file, run with `cagent run`, distribute via **Docker Hub (OCI)**; supports **ACP** for IDE integration and multiple providers (OpenAI, Anthropic, Gemini, DMR).
- **Docker Sandboxes** — isolated, **microVM-based** environments for coding agents (the sandbox primitive Javier designed the UX around).
- **Docker AI Governance** (May 2026) — centralized control over how agents execute, what they reach, and which MCP tools they can call (the governance layer of the platform).

## How to use these
Pair each internal metric with its public counterpart: e.g., "internally Gordon grew 69→~119.7K MAU; publicly Docker reported a 9× WAU jump" — the public number makes the story defensible without disclosing internal analytics.

## Sources
- [Meet Gordon: Docker's AI Agent For Your Entire Container Workflow (GA)](https://www.docker.com/blog/meet-gordon-dockers-ai-agent-for-your-entire-container-workflow/)
- [Gordon (Beta): Docker's AI Agent Just Got an Update](https://www.docker.com/blog/gordon-dockers-ai-agent-just-got-an-update/)
- [Introducing Beta Launch of Docker AI Agent](https://www.docker.com/blog/beta-launch-docker-ai-agent/)
- [Docker Model Runner: Now Generally Available](https://www.docker.com/blog/announcing-docker-model-runner-ga/)
- [Introducing Docker Model Runner](https://www.docker.com/blog/introducing-docker-model-runner/)
- [Dockerizing MCP — Introducing MCP Catalog and Toolkit](https://www.docker.com/blog/introducing-docker-mcp-catalog-and-toolkit/)
- [Build and Distribute AI Agents and Workflows with cagent](https://www.docker.com/blog/cagent-build-and-distribute-ai-agents-and-workflows/)
- [Docker AI Governance: Unlock Agent Autonomy, Safely](https://www.docker.com/blog/docker-ai-governance-unlock-agent-autonomy-safely/)
