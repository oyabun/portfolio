# 2. Metrics dashboard

← [Back to index](00-index.md)

All figures queried from Sigma unless noted. Approximate; current to 22 Jul 2026.

## Headline table

| Surface | Metric | Value | Window |
|---|---|---|---|
| **Gordon** | Monthly active users, launch → peak | **69 → ~119,700** | Nov 2024 → Jun 2026 |
| Gordon | Requests / month at peak | **~4.30M** | Jun 2026 |
| Gordon | Total requests / month at launch | ~2,300 | Nov 2024 |
| **Docker Model Runner** | Total model pulls | **~2,101,000** | Feb 2025 → Jul 2026 |
| Docker Model Runner | Distinct users running models | **~91,500** | Feb 2025 → Jul 2026 |
| Docker Model Runner | Distinct Desktop instances | **~124,200** | Feb 2025 → Jul 2026 |
| Docker Model Runner | Distinct models run | **~18,200** | Feb 2025 → Jul 2026 |
| Docker Model Runner | Peak monthly active model users | **~10,085** | Apr 2026 |
| **MCP Catalog** | Total image pulls | **~13,130,000** | Dec 2024 → Jul 2026 |
| **MCP Toolkit** | Tool-call events | **~10,582,000** | to Jul 2026 |
| MCP Toolkit | Peak weekly engaged Desktop instances | **~10,075** | wk of 22 Feb 2026 |
| MCP Toolkit | Peak weekly engaged authenticated users | **~8,212** | wk of 22 Feb 2026 |
| **cagent** (agent CLI) | Command events | **~20,693,000** | to Jul 2026 |

## Gordon monthly active users (Sigma, L3_GORDON__DAILY_USAGE)

| Month | MAU | Requests |
|---|---|---|
| Nov 2024 | 69 | 2,323 |
| Jan 2025 | 112 | 2,578 |
| Feb 2025 | 3,637 | 18,627 |
| Mar 2025 | 46,315 | 192,978 |
| Apr 2025 | 62,830 | 291,091 |
| Jul 2025 | 59,134 | 257,733 |
| Oct 2025 | 76,958 | 336,438 |
| Jan 2026 | 52,597 | 531,492 |
| Mar 2026 | 72,978 | 3,327,786 |
| Apr 2026 | 90,679 | 3,663,239 |
| May 2026 | 104,669 | 3,898,027 |
| **Jun 2026** | **119,739** | **4,304,534** |
| Jul 2026 (partial) | 81,718 | 2,943,182 |

Two curves worth noting: **users** stepped up ~13× in Feb–Mar 2025 (Ask Gordon shipping in Desktop 4.38) and then roughly doubled again through 2026; **requests** exploded from early 2026 as Gordon became embedded/agentic (background calls from global search and tab integrations), growing far faster than user count.

## Docker Model Runner — monthly active model users

| Month | Active model users |
|---|---|
| Feb 2026 | 9,205 |
| Mar 2026 | 8,766 |
| **Apr 2026** | **10,085** |
| May 2026 | 6,438 |
| Jun 2026 | 6,135 |
| Jul 2026 (partial) | 4,358 |

## MCP — top catalog images by pulls

`mcp/signatures` ~12.7M · `mcp/playwright` ~8.5M · `mcp/grafana` ~7.4M · `mcp/sonarqube` ~5.3M · `mcp/docker-mcp-catalog` ~5.3M · `mcp/fetch` ~3.1M · `mcp/kubernetes` ~3.0M · `mcp/brave-search` ~3.0M.

## MCP — top servers used from the Toolkit (by Desktop instances)

dynamic-mcps ~51,900 · Playwright ~42,400 · Obsidian ~19,100 · GitHub-official ~13,600 · Fetch ~13,600 · DuckDuckGo ~12,100 · Context7 ~10,100.

*See [Impact deltas](03-impact-deltas.md) for the before/after conversion analysis.*
