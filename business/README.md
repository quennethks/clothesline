# Business Research — Clothesline (Laundry Send-Out Tracker)

Business documentation for a mobile app that lets laundry-service customers itemize what they send to the laundry shop and reconcile it piece-by-piece on receipt — Metro Manila first, B2C now with a shop-side B2B phase later.

## Documents

| # | Document | Contents |
|---|---|---|
| 1 | [Problem Statement](./01-problem-statement.md) | The lost-laundry problem, who feels it, cost of the problem, current alternatives, proposed send/receive workflow, success criteria |
| 2 | [Target Customer](./02-target-customer.md) | Primary persona (demographics, goals, frustrations, online hangouts, current tools) + deep research: 10+ real people with cited quotes, their communities, and what they already pay for |
| 3 | [Market Research](./03-market-research.md) | TAM / SAM / SOM in ₱ (top-down + bottom-up), analyst reports, laundry-shop counts and average spend, 3 funded startups with raise amounts, ₱61M / ₱614M / ₱6.1B opportunity framing |
| 4 | [Competitive Analysis](./04-competitive-analysis.md) | Top 5 competitors/substitutes with ratings, complaints, pricing, and funding; a Philippine local-landscape deep-dive (local apps, PH POS ecosystem, chains/franchises, informal economy); feature gap matrix; positioning quadrants; the one thing none of them does well |
| 5 | [Competitive-Edge Features](./05-competitive-edge-features.md) | The features that define the app's edge, grouped by rollout phase (MVP → trust intelligence → two-sided B2B → network moat); summary table (edge/effort/pain per feature) then per-feature deep dives with description, expectations, pain point/gap, and a prescriptive recommendation |
| 6 | [Product Feature Roadmap](./06-product-feature-roadmap.md) | The founder's product plan (Phases 1–3) documented and compared side-by-side against the doc 05 feature recommendations — matches, simplifications, deferrals, and net-new ideas |
| 7 | [PRD — Phase 1 (MVP)](./07-prd-phase1-mvp.md) | Product requirements for the MVP: passwordless auth, create/itemize/send load, counter-side receive & reconcile, offline-first PWA, success metrics, open questions |
| 8 | [PRD — Phase 2 (AI Itemization)](./08-prd-phase2-ai.md) | Product requirements for AI clothing-type detection ("scan mode"): live-stream classification, auto-count + auto-photo, manual override, success metrics, open questions |
| 9 | [PRD — Phase 3 (Shop Reliability & Shared Validation)](./09-prd-phase3-shop-reliability.md) | Product requirements for personal per-shop reliability metrics and the zero-install shareable-load-link with shop-side intake/return confirmation |
| — | [deep-research/](./deep-research/README.md) | Archived source docs from a separate Claude deep-research run (3 Jul 2026), kept for provenance; validated content merged into docs 1–4, which supersede them where figures differ |

## Conventions & methodology

- **Currency:** Philippine pesos (₱). Foreign figures converted at **US$1 ≈ ₱61.43** (3 July 2026).
- **Diagrams:** Mermaid (rendered natively by GitHub).
- **Citations:** inline links plus a Sources list at the end of each document.
- **Tagalog sources:** quoted as written, with English translations in parentheses.
- **Research limitations (disclosed):** research was performed on 3 July 2026 from a sandboxed environment where direct page fetches are blocked by network policy and Reddit blocks automated crawling entirely. All evidence therefore comes from search-engine-indexed content of the cited pages; quotes in the target-customer doc carry fidelity tags (✅ near-verbatim as indexed / ⚠️ summarized). Store ratings or download counts that could not be verified are flagged in place. Bottom-up market-model assumptions are labeled as assumptions.
- **Deep-research merge (3 Jul 2026):** three externally generated deep-research docs (archived in [`deep-research/`](./deep-research/README.md)) were reviewed claim-by-claim; each material claim was independently re-searched before incorporation. Conflicts were resolved to the best-validated figure with the discrepancy footnoted in place (e.g., Rinse total funding, CleanCloud pricing, per-kilo rate tiers).
