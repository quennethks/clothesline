# Product Requirements Document — Clothesline (Phase 3: Shop Reliability & Shared Validation)

> **Product:** Clothesline — a personal laundry send/receive tracker
> **Phase:** 3 of 3 (Shop Reliability Metrics + Shop-Side Shared Link)
> **Document date:** 3 July 2026
> **Platform:** Progressive Web App (PWA), building on Phase 1 (MVP) and Phase 2 (AI)

---

## 1. Problem Statement

By Phase 3, Clothesline has accumulated real per-shop history (from Phase 1's shop record-keeping) but has never surfaced it as insight, and the reconciliation loop has remained entirely one-sided — the shop has no way to confirm or dispute a count, so every mismatch is still, ultimately, the customer's word against the shop's memory.

Two distinct problems remain:

1. **The user has no way to see which of her 3–5 nearby shops is actually trustworthy** — she's accumulated loads and discrepancy data across multiple shops but has no aggregated view of it. Shop selection today is based on proximity or word-of-mouth, not her own recorded evidence.
2. **The shop is still entirely outside the loop.** Even with a discrepancy flagged at the counter, there's no shared, mutually-referenced record — it's still just the customer's app telling *her* something's wrong, with nothing the shop has actually acknowledged or countersigned.

**Phase 3's problem statement:** Customers have no personalized view of shop trustworthiness despite having the data to build one, and disputes remain one-sided because the shop never participates in creating the record — Clothesline needs to surface the trust signal it's already collecting, and give the shop a zero-friction way to countersign a load without requiring them to adopt any software.

---

## 2. Target Users

### Primary persona — same as Phase 1/2 ("Bianca")

### What she needs from Phase 3 specifically
1. A simple, personal view of which shops she's had good vs. bad experiences with, without manual tracking or memory.
2. A way to get the *shop itself* to acknowledge a count — at intake and at return — so a future dispute isn't purely her word against theirs.
3. Confidence that sharing a load link with a shop is low-effort for the shop, so they'll actually agree to use it — she doesn't want to negotiate technology adoption at the counter.

### Secondary persona — introduced for the first time: the laundry shop staff member
- Typically counter staff at a small, independently-run per-kilo laundry shop.
- Not expected to install an app, create an account, or receive any training.
- Interacts with Clothesline only through a link opened in a mobile browser, for the specific load a customer shares with them.
- Has no independent motivation to adopt new software — any friction here will cause shops to simply decline to participate, so this persona's entire interaction must be near-zero-effort.

---

## 3. Core Features

### 3.1 Personal Shop Reliability Metrics
- Aggregates each user's own historical load data (already captured since Phase 1) into a per-shop view:
  - Total loads sent to this shop.
  - Number of loads with a discrepancy (mismatch flagged at the counter).
  - Simple derived reliability indicator (e.g., "14 loads, 2 discrepancies" — a ratio, not a marketing "score," to stay honest about small sample sizes).
- Surfaced on a per-shop detail view, accessible from the shop's entry in the user's load history.
- This is **personal to the user only** — no cross-user aggregation or shared shop ratings in this phase (that's a possible future extension, not in scope here — see Out of Scope).

### 3.2 Shareable Load Link
- From an open load, the user can generate a shareable link representing that specific load's manifest.
- The link can be sent via any external channel the user already uses (SMS, Viber, Messenger) — Clothesline does not need to own the messaging channel.
- The link opens a lightweight, no-login web view scoped to that one load only — the shop never sees any other data about the user's account, history, or other loads.
- **Participation is entirely optional and never blocking.** If the shop never opens the link, the customer's own Phase 1 send/receive reconciliation proceeds exactly as it would without this feature — the shared link is pure upside, never a dependency.
- **User-set expiry:** when generating the link, the user sets her own time limit for how long it stays active (rather than the app imposing a fixed default). This gives her control appropriate to her own routine (e.g., a same-day drop-off vs. a multi-day turnaround).
- **Auto-invalidation on receipt:** once the customer confirms she has received her load back (Phase 1's receive flow), the link automatically stops working — there is no further action for the shop to take once the customer has already acknowledged receipt, so continued access serves no purpose and is closed off.

### 3.3 Shop-Side Intake Confirmation
- When the shop opens the shared link (at drop-off), they see the itemized manifest the customer created (e.g., "Shirts: 6, Trousers: 2, Socks: 8").
- The shop enters a count confirming what they've received from the customer at intake.
- If the shop's intake count matches the customer's manifest, both sides now have a mutually-referenced starting point for the load — this is the first "countersigned" moment in the product.
- If it doesn't match, the discrepancy is visible to both parties **before washing even begins** — arguably an even more valuable catch than the Phase 1 counter-time flag, since it's caught before the items are ever out of the customer's sight for long.

### 3.4 Shop-Side Return Confirmation
- After processing, when the shop is ready to return the load, they open the same link again and enter a second count confirming what they're sending back.
- This creates a second countersigned data point, independent of whatever the customer counts on her own end at pickup (Phase 1's existing receive flow).
- The customer's own Phase 1 receive-side reconciliation still happens as normal — this shop-side confirmation is additive evidence, not a replacement for the customer's own count.

### 3.5 Two-Sided Record Storage
- Both the shop's intake and return counts are stored against the load record, alongside the customer's own sent/received counts.
- This produces up to four data points per load (customer-sent, shop-intake, shop-return, customer-received), which is the richest evidence record the product produces to date — directly useful groundwork for any future evidence-export feature, even though export itself remains backlog.

### 3.6 Photo Access Consent
- If a load includes photos (bundle photo and/or per-item photos from Phase 1/2), the user must explicitly acknowledge, at the point of generating the shareable link, that anyone with the link will be able to view those photos.
- The user is given a toggle/checkbox to **choose whether photos are included** in the shared view at all — she can share a link that exposes only category-level counts (no photos) if she prefers, independent of whether the load itself has photos attached.
- This keeps photo-sharing opt-in and explicit, rather than automatically bundling potentially sensitive images into a link sent to a third party.

---

## 4. Out of Scope (Phase 3)

- **Cross-user aggregated shop ratings or a public shop directory** — Phase 3 metrics are personal to each user only; there is no shared "Shop X has a 95% reliability score across all Clothesline users" feature. This would require a much larger user base to be statistically meaningful and raises separate data/moderation questions not addressed here.
- **"Verified Shop" badges or any shop certification program** — no trust-badge system in this phase.
- **POS or shop-management software integration** — the shared-link approach is explicitly designed to avoid this; no SDK, API, or software installation is required of the shop.
- **Shop accounts or shop-side login** — the shop's entire interaction is through an unauthenticated, load-scoped link. There is no persistent shop identity or shop-side history view in this phase.
- **Payments or shop-side business management features** (scheduling, invoicing, customer management) — Clothesline remains a consumer-side reconciliation tool; it does not become a point-of-sale or shop operations product.
- **Evidence-pack export** — remains backlog. Phase 3 produces richer underlying data (the two-sided record) but does not build a formatted export feature on top of it.
- **Real-time notification to the shop** — the shop must be sent the link manually by the customer; there's no automatic notification system pinging the shop when a load is created.

---

## 5. Success Metrics

### Shop Reliability Metrics (3.1)
- **Feature engagement rate:** % of users with ≥3 loads to a given shop who view that shop's reliability detail view at least once.
- **Shop-switching correlation:** among users who view a shop's reliability metric showing a high discrepancy ratio, what % subsequently send their next load to a *different* shop? This is the real test of whether the metric is actionable, not just informational.

### Shared Load Link & Shop Validation (3.2–3.5)
- **Link share rate:** % of loads where the customer generates and sends a shareable link to the shop. Since shop participation is voluntary and outside Clothesline's control, this is fundamentally a harder number to move than any Phase 1/2 metric, and should be read accordingly.
- **Shop completion rate:** of links sent, % where the shop actually completes at least the intake confirmation. Low completion doesn't necessarily mean the feature failed — it may mean shop-side incentive design needs more thought (see open questions).
- **Intake-stage discrepancy catch rate:** % of loads where a shop's intake count differs from the customer's manifest — i.e., discrepancies caught *before* washing, which is strictly better than catching them at pickup. This is arguably the single most valuable metric in the whole product, since it demonstrates prevention rather than after-the-fact detection.
- **Two-sided record completeness:** % of loads with all four data points (customer-sent, shop-intake, shop-return, customer-received) fully populated — a proxy for how often the ideal, fully-documented flow actually happens end-to-end in practice.

---

## 6. Open Questions

1. **Shop incentive to participate** — beyond goodwill, what motivates a shop to spend even 30 seconds confirming counts on a customer's phone? Is there a value proposition for the shop itself (e.g., it also protects *them* from false claims), and if so, does that need to be communicated on the link's landing page?
2. **Dispute-handling when shop and customer counts conflict** — if the shop's intake count and the customer's manifest disagree, what does the product actually do with that moment? Is it purely informational (both parties see the conflict and resolve it themselves, in person), or does Clothesline need any structured way to record how the conflict was resolved?
3. **Reliability metric sample size handling** — how should the UI handle shops with very few loads (e.g., 1–2) where a single discrepancy would show as a dramatic percentage despite a tiny sample? Is there a minimum load count before the reliability view is shown at all, to avoid misleading the user?
4. **Future path to aggregated/public shop data** — even though it's explicitly out of scope for this phase, should the data model be designed now in a way that doesn't preclude an eventual opt-in, cross-user aggregated view later, without requiring a schema migration?

---

### Source documents
- [`01-problem-statement.md`](./01-problem-statement.md)
- [`02-target-customer.md`](./02-target-customer.md)
- [`03-market-research.md`](./03-market-research.md)
- [`06-product-feature-roadmap.md`](./06-product-feature-roadmap.md)
- [`07-prd-phase1-mvp.md`](./07-prd-phase1-mvp.md)
- [`08-prd-phase2-ai.md`](./08-prd-phase2-ai.md)
- Founder brainstorm sessions, 3 July 2026
