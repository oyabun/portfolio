# 6. Project — Gordon (Docker's AI agent)

← [Back to index](00-index.md)

**One line:** Design lead for Gordon from early interaction patterns through GA and monetization — a product he grew 0→1 to ~119,700 monthly active users.

## Origin — the FGPT hackathon (2023)
Gordon traces back to **"FGPT" — "Fellowship of the GPT"**, a Docker internal hackathon project Javier designed in the **first half of 2023** (he refers to it as already completed by 3 Aug 2023; a sibling concept screenshot is dated 30 Jun 2023). FGPT prototyped an **AI assistant built into Docker Desktop** — an "Ask our assistant for help" panel that turned plain-English requests ("Stop all the containers", "Pull latest NGINX image for x86", "How can I reduce the space used by Docker?") into Docker commands the user could **review or run**. The Figma frame shows Docker Desktop with an **"✦ Assistant"** entry point in the toolbar — recognizably the germ of **Ask Gordon**. Its sibling explorations, **"Docker Ask"** and **"Docker WTF (WhaleTF)"**, already described Gordon's core mechanic: *"we send the context (list of containers, images, volumes, networks…) to reduce the hallucinations of the LLM."*

**FGPT didn't win the hackathon — but it was early and right.** The concept-to-product overlap with today's Gordon is unmistakable: (1) an in-Desktop assistant entry point in the toolbar → Gordon's Desktop sidebar; (2) natural language turned into Docker commands; (3) a "View command / Run" review step → Gordon's approve/deny permission model (its headline trust feature); (4) feeding container/image/volume context to reduce hallucinations → Gordon's "it already knows your environment before you ask." Javier prototyped Docker's in-product AI-assistant pattern in 2023; that same pattern is what Gordon became — now ~119,700 monthly active users. Not winning is part of the story: conviction ahead of the curve.

Artifacts: Notion "Hackathon: Fellowship of the GPT (FGPT)" · Figma file `FGPT` (fileKey `0KyIFuXcmNuHxKEB6JvUYT`) · concept image `FGPT.png` (Drive).

## What he did
- Created Gordon's core **interaction patterns, MCP integration, and onboarding** — Gordon became the default entry point for trying MCPs.
- Designed the **permission / safety UX**: danger classification (cautious/safer tiers), allow/deny dialogs, and the CLI hook for destructive-action prevention — reused as the pattern for other agent permission dialogs.
- Reviewed billing and features for the **V2 GA + pricing transition (Apr 2026)** and **GA with Desktop 4.74 (May 2026)**; shipped again in **Desktop 4.80 (Jul 2026)**.
- Designed **budget/token-usage** views, **Plan mode**, guardrails, login nudge, model selection, free/blocked usage states, "advertise/JIT" mockups, and **Gordon in Support** (app.docker.com/support).
- Built the **Qualtrics feedback pipeline** (survey + `feedback.docker.com/gordon` permalinks + Qualtrics→Slack routing) and authored the **"Ask Gordon Continuous Research Plan."**

## Metrics & successes
- **69 → ~119,739 monthly active users** (Nov 2024 → Jun 2026); **~13× step-up** around the Ask Gordon launch (Desktop 4.38, Feb–Mar 2025).
- **Requests/month ~193K → ~4.3M** (Mar 2025 → Jun 2026) as embedded/agentic entry points he designed drove background usage.
- **~$260 MRR** shortly after monetization (late May 2026), exceeding some established Docker products at that point.
- Permission/safety UX became a **reference pattern** across Docker's agent products.

## Delivery footprint
Interaction model, onboarding, safety UX, billing/GA flows, support integration, marketing-page input, and the feedback research infrastructure — spanning product, growth, and research.
