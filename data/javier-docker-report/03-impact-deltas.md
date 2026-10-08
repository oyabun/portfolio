# 3. Impact deltas — what he touched that moved the numbers

← [Back to index](00-index.md)

This page ties specific design work Javier led to measurable movements in the metrics. **Read these as strong correlations tied to releases he owned, not laboratory-proven causation** — design ships alongside other changes, and Docker's telemetry is instance/heartbeat based. Where the link is direct (e.g., a funnel he redesigned across two Desktop versions), it is called out.

## A. MCP Toolkit — activation ~doubled from Desktop 4.45 → 4.46

The MCP Toolkit funnel has four stages: **Awareness** (entered the Toolkit tab) → **Acquisition** (added a server / configured a credential / connected a client) → **Activation** (ran the MCP gateway after adding a server) → **Engagement** (successful tool call). Javier owned the Toolkit's discovery, add-server, and client-connection UX, and iterated it version-over-version. Comparing the two consecutive Desktop releases:

| Funnel stage | DD 4.45 | DD 4.46 | Change |
|---|---|---|---|
| Awareness (entered Toolkit) | 119,433 | 137,951 | +15.5% |
| Acquisition rate (of aware) | 14.2% | 21.6% | **+7.3pp (~+52% relative)** |
| Activation rate (of aware) | 4.8% | 9.9% | **~2.1× (≈+106%)** |
| Awareness → Engaged (successful tool call) | 2.85% | 7.11% | **~2.5× (≈+150%)** |
| Activation → Engaged | 59.3% | 71.7% | **+12.4pp** |

**Takeaway:** between two consecutive releases of a surface he owned, the share of aware users who successfully used an MCP tool went from ~1 in 35 to ~1 in 14 — a ~2.5× improvement in end-to-end conversion. This is the cleanest example of his UX work moving a funnel.

*(Baseline reference — all DD 4.45+ combined: 2,582,989 aware → 616,502 acquired (23.9%) → 142,276 activated → 94,486 engaged (3.66% of aware).)*

## B. Gordon — from prototype to mass adoption

Gordon's monthly active users tracked its design/launch milestones Javier worked on:

- **69 MAU (Nov 2024)** at prototype → **3,637 (Feb 2025)** as Ask Gordon shipped in Desktop 4.38 → **46,315 (Mar 2025)**, a **~13× step-up** in the two months around that release.
- Through the **V2 GA + pricing transition (Apr 2026)** and **GA with Desktop 4.74 (May 2026)** — both of which he designed the billing/feature flows for — MAU climbed **90,679 → 104,669 → 119,739 (Jun 2026)**, a peak.
- **Requests/month** grew from ~193K (Mar 2025) to **~4.3M (Jun 2026)** — a ~22× increase — as the embedded/agentic entry points he designed (global search, Containers/Images/Volumes tabs) drove background usage.

**Takeaway:** the two largest inflections in Gordon adoption line up with releases he designed for (Ask Gordon launch; GA + monetization).

## C. Docker Model Runner — discovery UX and the model catalog

- DMR reached **~10,085 monthly active model users (Apr 2026)** and **~2.1M cumulative pulls** across **~18,200 models** — evidence the model-card and CLI push/pull UX he designed drives real discovery and import.
- The model-import gaps he identified in his own "Docker Model Runner – Insights" research fed directly back into the discovery UX.

## D. Gordon feedback loop he built → research signal

Javier built Gordon's **Qualtrics feedback pipeline** (survey + `feedback.docker.com/gordon` permalink scheme + Qualtrics→Slack routing). This is an infrastructure contribution whose "metric" is qualitative throughput: it turned scattered Gordon feedback into a continuous, routed signal the team acts on. (Volume not quantified in Sigma.)

---

### Honesty notes on attribution
- Funnel comparisons (Section A) are the most defensible: same product, consecutive versions, UX he owned.
- Gordon/DMR growth (B, C) reflects many contributors (eng, PM, marketing, model availability). Javier's design work is a **necessary enabler**, not the sole cause. Framed as "coincident with releases he led."
- Some Sigma KPI tiles for agent apps are filter-dependent and returned 0 to direct queries; figures here come from raw daily-usage tables and funnel elements, which are reliable.
