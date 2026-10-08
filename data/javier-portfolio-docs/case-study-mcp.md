# Case study — MCP Toolkit, Catalog & Marketplace

← [Back to portfolio](00-README.md)

> **Made Docker a hub for agent tooling — and roughly 2.5×'d end-to-end conversion across two releases.** ~13.1M catalog pulls, ~10.6M tool-call events.

## Context & problem
As agents exploded, developers needed a trusted, discoverable way to find and run MCP servers — and a safe way to connect them to clients like Cursor, Claude, and Gordon. The raw MCP ecosystem was fragmented and hard to set up.

## My role
Design lead for the MCP surfaces: the Desktop **MCP Toolkit** (discovery, add-server, credentials, client connection) and the **Hub MCP Marketplace**, plus Custom MCP Server via URL.

## Personas served
**P3 Priya** (agent engineer), **P2 Marco** (safe, governable tooling), **P1 Ana**.

## Use cases (jobs-to-be-done)
- "Discover an MCP server I can trust." → curated Catalog + Marketplace.
- "Add a server and connect it to my client in a couple of clicks." → Toolkit add-server + client-connection flow.
- "Configure credentials safely." → credential flow.
- "Bring my own server by URL." → Custom MCP Server via URL.

## Process
Owned the funnel end to end — Awareness → Acquisition → Activation → Engagement — and iterated the add-server and client-connection UX version over version, measuring conversion in Sigma.

## Delivery
Desktop MCP Toolkit · Hub MCP Marketplace (hub.docker.com/mcp) · Integrations / Custom MCP via URL · discovery, filtering, and onboarding flows.

## Impact
- **~13.1M MCP Catalog pulls** and **~10.6M tool-call events**; peak **~10,075 weekly engaged Desktop instances**.
- **Funnel improvement, Desktop 4.45 → 4.46:** acquisition rate **14.2% → 21.6% (~+52%)**, activation rate of aware users **4.8% → 9.9% (~2.1×)**, and **awareness → successful tool call 2.85% → 7.11% (~2.5×)**.
- Healthy adoption tail: dynamic-mcps (~51.9K instances), Playwright (~42.4K), Obsidian, GitHub, Fetch; top catalog images `mcp/signatures` (~12.7M), `mcp/playwright` (~8.5M), `mcp/grafana` (~7.4M).

## Reflection / what I'd show
This is the cleanest "design moved the metric" story — same product, consecutive versions, funnel I owned. In a portfolio I'd put the two funnels side by side with the specific UX changes annotated.

*Sources: Sigma "AI Tools – MCP Metrics" (funnels by DD version); MCP Catalog daily pulls.*
