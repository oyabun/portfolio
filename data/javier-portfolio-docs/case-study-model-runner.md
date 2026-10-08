# Case study — Docker Model Runner & the model cards

← [Back to portfolio](00-README.md)

> **Designed Docker's local-inference product 0→1 — and coded the Hub model cards that help developers pick the right model.** ~2.1M pulls, ~91K users.

## Context & problem
Developers wanted to run LLMs locally through Docker, but faced two problems: (1) local inference had no first-class UX in Docker Desktop/CLI, and (2) with ~18K models available, **choosing the right model was overwhelming** — unclear size, quantization, task fit, and hardware requirements. Picking wrong wastes a big download and erodes trust.

## My role
Design lead across Docker Desktop, the CLI, and Docker Hub. I designed *and coded* the Hub AI **model cards** (`docker/model-cards`) and the AI Model Flow selector, and authored the discovery research.

## Personas served
**P1 Ana** (AI-curious dev, "pick the right model"), **P3 Priya** (agent engineer), **P4 Sam** (newcomer).

## Use cases (jobs-to-be-done)
- "Find a model that fits my task and my hardware." → model cards surfacing size, quantization, and fit; comparable at a glance.
- "Pull and run a model from the CLI like any image." → inference UX (push/pull) consistent with Docker's mental model.
- "Manage local models inside Desktop." → Model Runner UI.
- "Decide between similar models without trial-and-error downloads." → model-selection flow designed to reduce wrong picks.

## Process
Ran his own discovery — **"Docker Model Runner – Insights"** (co-authored with Francesco Corti): Captain interviews + Slack-sentiment synthesis surfaced concrete model discovery/import gaps. Those findings drove the model-card content and the selection flow. Designed across three surfaces and hand-coded the model cards for fidelity, documenting the handoff (Miro + a Python model-selector repo) for continuity.

## Delivery
Desktop Model Runner UI · CLI inference UX (push/pull) · **coded Hub model cards + new Model card layout** · AI Model Flow selector · research report · handoff artifacts.

## Impact
- **~2.1M total model pulls** across **~18,200 distinct models** since launch (Feb 2025).
- **~91,500 distinct users**, **~124,200 Desktop instances**.
- Peak **~10,085 monthly active model users** (Apr 2026).
- Top models discovered via the catalog: `ai/nomic-embed-text` (~313K), Qwen2.5-Coder variants (~304K), `ai/gemma3` (~170K), `ai/llama3.2` (~94K) — evidence the cards drive real, varied discovery rather than one default.

## Reflection / what I'd show
The model card is a small surface with outsized leverage: it's where a developer commits to a model. In a portfolio I'd show the card layout, the decision criteria it exposes, and the pull distribution across many models as proof the selection UX works.

> **Verification note:** the code-level contribution (`docker/model-cards`, and any Moby/model-runner commits) is evidenced here from Slack and Notion, **not** from GitHub directly — I don't have access to Docker's internal repos. Connect a GitHub source to confirm commit-level authorship.

*Sources: Sigma `PRES_PRODUCT__DESKTOP_MODEL_RUNNER_PULLS_DAILY`; Slack impact summary; Notion / Drive research doc.*
