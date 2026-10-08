# User personas

← [Back to portfolio](00-README.md)

Five personas recur across Javier's Docker work. They're synthesized from his research (Captain interviews, Dagent UX study, Model Runner insights) and the products he designed. Use them to frame case studies and interviews.

## P1 — "Ana," the AI-curious app developer
- **Context:** Full-stack dev, comfortable with Docker, new to LLMs. Wants to add AI features without becoming an ML engineer.
- **Goals:** Try models locally, pick the *right* model quickly, keep data on her machine.
- **Pains:** Too many models, unclear tradeoffs, fear of picking wrong; cloud cost/privacy worries.
- **Served by:** Docker Model Runner, model cards, Gordon.

## P2 — "Marco," the platform / DevOps engineer
- **Context:** Owns the team's container workflows, security posture, and tooling standards.
- **Goals:** Safe, governable tooling; visibility into images/vulnerabilities; minimal surface area.
- **Pains:** Tool sprawl, unsafe agent actions, hard-to-audit setups.
- **Served by:** MCP Toolkit (credentials/clients), Gordon permission/safety UX, Docker Desktop simplification.

## P3 — "Priya," the agent / AI engineer
- **Context:** Building agents and wiring up tools; power user of MCP and sandboxes.
- **Goals:** Discover and connect MCP servers fast; run agents in isolated sandboxes; integrate external tools (Cursor/Codex).
- **Pains:** Fragmented server discovery, brittle setup, no first-class agent primitives.
- **Served by:** MCP Catalog & Marketplace, Agentic Platform (sessions/sandboxes/kits), cagent.

## P4 — "Sam," the individual developer / newcomer
- **Context:** New to Docker or to a given surface; lives in the CLI and Desktop.
- **Goals:** Get productive fast; consistent, learnable UI; help when stuck.
- **Pains:** Inconsistent CLI patterns, steep onboarding, deep scrolling / cluttered UI.
- **Served by:** CLI Design System, Gordon onboarding, Desktop simplification.

## P5 — "Dana," the enterprise admin / buyer
- **Context:** Approves and governs AI tooling for a team or org; owns budget.
- **Goals:** Policy/governance, cost visibility, safe defaults, clear plans/pricing.
- **Pains:** Ungoverned agent usage, unclear spend, compliance risk.
- **Served by:** Gordon billing/plans, AI Cloud policies & governance, budget/token-usage views.

---

*How to use:* each case study calls out which personas it serves and the specific use cases (jobs-to-be-done) it addresses.
