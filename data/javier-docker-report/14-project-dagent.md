# 14. Project — dagent (Docker Agent app)

← [Back to index](00-index.md)

**One line:** The Docker Agent app — create, run, and share AI agents with an agent marketplace/fleet. The product layer Javier designed *and* researched, and the direct core of the Agentic Platform / AI Cloud.

## What is dagent? (naming, clarified)
Three related names recur in Docker's data; they are not the same thing:

- **dagent** — the *Docker Agent application*: users create, run, pull/push, import/export, and share agents, with an agent marketplace ("Agent Fleet"). Telemetry lives in Sigma's `PREP.DAGENT` schema. This is the product Javier designed and studied.
- **cagent** — the *open-source CLI multi-agent runtime* (`github.com/docker/cagent`) that Gordon and agents run on (~20.7M command events). See [Agentic Platform](08-project-agentic-platform.md).
- **Gordon** — the embedded assistant. See [Gordon](06-project-gordon.md).

dagent is the app that matured into the Agentic Platform / AI Cloud, so this page and the [Agentic Platform page](08-project-agentic-platform.md) are two views of closely-related work: dagent = the agent-lifecycle app; the Agentic Platform = the broader productization (sessions, sandboxes, kits, IA).

## What he did
- Designed the **agent lifecycle**: create, run, edit, import/export, and pull/push agents to a shared fleet.
- Designed the **agent marketplace / fleet** discovery and sharing experience.
- **Ran the research on it himself** — facilitated the **Dagent UX Study** (~11 moderated think-aloud sessions, Oct 2025, with Chad Bercea) and set up a Qualtrics feedback form for dagent ("added a way to get the 'Agents' from users with a URL or by uploading .yaml files").

## Metrics (Sigma `L1_DAGENT__AGENT`, Aug 2025 – Jun 2026)
Early-stage/prototype scale — consistent with his research brief describing the platform as "in prototype stage":

| Metric | Value |
|---|---|
| Total agent events | **3,412** |
| Distinct dagent users | **96** |
| Distinct agents created | **369** |
| Agent **runs** | **2,144** (89 users) |
| Pulls | 475 (76 users) |
| Creates | 349 (35 users) |
| Edits | 201 (23 users) |
| Imports | 90 · Deletes 95 · Pushes 39 · Exports 19 |

*Event grain is per agent action (create/run/pull/push/import/export/edit/delete). A `dagent_uuid` user identity was added in Sep 2025, so early events may under-count distinct users.*

## Why it matters in his story
dagent is where Javier did the **hands-on product design and user research** for Docker's agent app — defining how developers create and run agents before that work scaled into the Agentic Platform. The numbers are small because it was the prototype/validation phase; the *scale* narrative belongs to the cagent runtime underneath (~20.7M events), while dagent is the **design-and-research** narrative: a real 0→1 product shaped by studies he ran.

## Delivery footprint
Agent create/run/share flows · agent marketplace (fleet) · YAML/URL agent import · Qualtrics feedback instrument · the Dagent UX Study (plan, facilitation, synthesis).

*Sources: Sigma `PREP.DAGENT` (`L1_DAGENT__AGENT`); Notion (Dagent UX Study); Slack (#team-ai-agent-private, dagent Qualtrics form). Metrics current to Jun 2026.*
