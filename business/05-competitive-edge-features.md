# Competitive-Edge Features — What the App Must Do to Win

> **Document date:** 3 July 2026 · **Geography:** Metro Manila first · **Currency:** ₱
> **Purpose:** Translate the problem, customer, market, and competitive findings in docs [01–04](./README.md) into the specific features that create — and defend — the app's competitive edge. Organized **by rollout phase** (MVP first, then the follow-on sets that ship easily on top of it). Prescriptive: each feature carries a recommendation, not just a description.

---

## How to read this document

Every competitor in [`04-competitive-analysis.md`](./04-competitive-analysis.md) either records **the shop's version** of the transaction (POS, service apps, chains) or records **nothing structured** (paper stub, Notes, Messenger bookings). The edge of this app is a single idea expressed through many features:

> **A consumer-owned, itemized send → receive → reconcile ledger that produces dispute-grade evidence — at every laundry shop, not just one.**

Features are graded on two axes:

- **Edge** = how much this feature differentiates vs. the field (docs 01/04). ⭐ table-stakes · ⭐⭐ differentiator · ⭐⭐⭐ moat.
- **Effort** = relative build cost. 🟢 low · 🟡 medium · 🔴 high.

The winning sequence is **high-edge / low-effort first** — which, happily, is the MVP core loop.

```mermaid
flowchart LR
    subgraph P1["Phase 1 · MVP (the wedge)"]
        F1[Fast load creation]
        F2[Piece-count itemization]
        F3[Receive reconciliation]
        F4[Counter-time discrepancy flag]
        F5[Offline-first]
        F6[Photo evidence]
        F7[Multi-shop record]
    end
    subgraph P2["Phase 2 · Trust intelligence"]
        F8[Per-shop reliability history]
        F9[Evidence-pack export]
        F10[Reminders]
        F11[Spend & load analytics]
    end
    subgraph P3["Phase 3 · Two-sided B2B"]
        F12[Shop-side manifest confirmation]
        F13[Verified Shop badge]
        F14[POS / marketplace embed]
    end
    subgraph P4["Phase 4 · Network moat"]
        F15[Shop-reliability dataset]
        F16[Payments + garment micro-insurance]
    end
    P1 --> P2 --> P3 --> P4

    style P1 fill:#d5f5d5,color:#000000
    style P3 fill:#ffe9c9,color:#000000
    style P4 fill:#e0d5f5,color:#000000
```

---

## Summary table

### Phase 1 — MVP: the core loop (the wedge that must be excellent)

| # | Feature | Edge | Effort | Pain point / gap it closes |
|---|---|:---:|:---:|---|
| F1 | **Fast load creation** (shop + send date, < 60s) | ⭐⭐ | 🟢 | Nothing today is faster than a paper stub; if logging is slow it won't happen ([doc 01 §7](./01-problem-statement.md)) |
| F2 | **Piece-count itemization** (presets + reusable templates) | ⭐⭐ | 🟡 | Stub records *kilos*, not *pieces*; a missing shirt has no record ([doc 01 §1](./01-problem-statement.md)) |
| F3 | **Receive-side reconciliation checklist** | ⭐⭐⭐ | 🟡 | *No competitor closes the loop at receipt* — the one thing none of them does ([doc 04 §4](./04-competitive-analysis.md)) |
| F4 | **Counter-time discrepancy flag** | ⭐⭐⭐ | 🟢 | Loss is found "days or weeks later," too late to win ([doc 01 §1](./01-problem-statement.md)) |
| F5 | **Offline-first operation** | ⭐⭐ | 🟡 | Shop counters often have no signal; POS/service apps are online-bound ([doc 04 gap matrix](./04-competitive-analysis.md)) |
| F6 | **Photo evidence per load / item** | ⭐⭐ | 🟢 | Legal guidance demands photos; dhobi-tracker apps have none ([doc 02 §2](./02-target-customer.md)) |
| F7 | **Shop-agnostic multi-shop record** | ⭐⭐⭐ | 🟢 | Shop POS dies when you switch shops; 20k+ shops are paper ([doc 04 §5 / §2.5](./04-competitive-analysis.md)) |

### Phase 2 — Trust intelligence (ships on Phase-1 data, low incremental effort)

| # | Feature | Edge | Effort | Pain point / gap it closes |
|---|---|:---:|:---:|---|
| F8 | **Per-shop reliability history** ("which shop loses clothes?") | ⭐⭐⭐ | 🟡 | Customers pick shops on trust — *"hindi nawawalan ng damit"* — with no data ([doc 02 §2](./02-target-customer.md)) |
| F9 | **Evidence-pack export** (DTI / small-claims-ready) | ⭐⭐⭐ | 🟡 | Remedies hinge on itemized list + values + photos customers never keep ([doc 01 §3](./01-problem-statement.md)) |
| F10 | **Pickup-due reminders** | ⭐ | 🟢 | Forgotten/unclaimed loads; chains forfeit items after 1 month ([doc 04 §2.3](./04-competitive-analysis.md)) |
| F11 | **Spend & load analytics** | ⭐ | 🟢 | ₱500–1,200/mo spend is untracked; secondary "know your spend" goal ([doc 02 §1](./02-target-customer.md)) |

### Phase 3 — Two-sided B2B (the shop counter)

| # | Feature | Edge | Effort | Pain point / gap it closes |
|---|---|:---:|:---:|---|
| F12 | **Shop-side manifest confirmation** (two-sided receipt) | ⭐⭐⭐ | 🔴 | Every POS records the *shop's* count; none confirms the *customer's* ([doc 04 §2.2](./04-competitive-analysis.md)) |
| F13 | **"Verified Shop" trust badge** | ⭐⭐⭐ | 🟡 | Price-compressed shops need trust differentiation; none can offer it ([doc 03 §6](./03-market-research.md)) |
| F14 | **POS / marketplace embed** (SDK / integration) | ⭐⭐ | 🔴 | Local marketplaces (Drop, Lalaba, Laundrify) track orders, not items ([doc 04 §2.1](./04-competitive-analysis.md)) |

### Phase 4 — Network moat (venture-scale layers)

| # | Feature | Edge | Effort | Pain point / gap it closes |
|---|---|:---:|:---:|---|
| F15 | **Aggregated shop-reliability dataset** | ⭐⭐⭐ | 🔴 | A shop-reliability dataset nobody in PH has — the data flywheel ([doc 03 §3](./03-market-research.md)) |
| F16 | **Counter payments + garment micro-insurance** | ⭐⭐⭐ | 🔴 | Liability capped at ~2× wash fee; garment value uninsured ([doc 04 §2.3](./04-competitive-analysis.md)) |

---

## Deep dive — Phase 1: the MVP core loop

This is the wedge. It must be **faster than a paper stub and impossible to forget**, or the whole thesis fails. Features F1–F7 are not a menu — they are one continuous flow. The prescriptive priority: **F3 + F4 are the product; everything else in Phase 1 exists to make F3 + F4 happen reliably.**

### F1 — Fast load creation (shop + send-out date)

- **Description.** Start a new load in one screen: pick the laundry shop (from a saved list or quick-add) and the send-out date (defaults to today). That's the whole ceremony to begin.
- **Expectations.** Under 15 seconds to a live load. Shop is remembered for next time. No account/login wall to *start* (logging must never be gated the way CleanCloud gates customers behind a login before they see anything — [doc 04 §5](./04-competitive-analysis.md)).
- **Pain point / gap.** The competitor with 99% share is a paper stub that takes zero effort ([doc 04 §5](./04-competitive-analysis.md)). Any friction here and the user reverts to memory — "the whole problem" ([doc 02 §1](./02-target-customer.md)).
- **Prescriptive take.** Build first, keep brutally minimal. Resist adding fields (weight, price, service type) to the create step — they belong later or never. Speed *is* the feature.

### F2 — Piece-count itemization (presets + reusable templates)

- **Description.** Add items to the load as *type × count* (e.g., "Office shirt × 6", "Socks (pair) × 8"), with tappable presets and a saved "my usual load" template the user can drop in and adjust.
- **Expectations.** A typical 6–8 item load logged in under 60 seconds ([doc 01 §7](./01-problem-statement.md)). Templates make the *second* load a 10-second job. Optional per-item value (pre-fills the evidence pack later, F9).
- **Pain point / gap.** The stub records "7.5 kg / 32 pcs" — useless for identifying *which* pieces ([doc 02 §1](./02-target-customer.md)). Notes-app lists work but are unstructured and abandoned after two loads ([doc 01 §4](./01-problem-statement.md)). Dhobi-tracker apps count but use an India per-piece rate-card model, not PH per-kilo reality ([doc 04 §1 #2](./04-competitive-analysis.md)).
- **Prescriptive take.** Templates are the anti-abandonment mechanism — the single most important retention lever in Phase 1. Localize presets to the PH wardrobe (barong, office polo, uniform, "panti/bra" delicates that shops disclaim — [doc 04 §2.3](./04-competitive-analysis.md)).

### F3 — Receive-side reconciliation checklist  ⭐⭐⭐ *core moat*

- **Description.** On pickup, open the load and check off each item and count against what was sent. The app tallies matches and surfaces shortfalls.
- **Expectations.** Full reconciliation in under 90 seconds at the counter ([doc 01 §7](./01-problem-statement.md)). One tap per line; running "X of Y items accounted for."
- **Pain point / gap.** **This is the one thing no competitor does** — shop POS records what the shop received, service apps track order status, general/closet tools have no reconciliation event, dhobi trackers stop at counting ([doc 04 §4](./04-competitive-analysis.md)). It is the entire reason the product exists ([doc 01 §5–6](./01-problem-statement.md)).
- **Prescriptive take.** This is the defensible core. Every design decision should optimize the *receive moment*. If reconciliation is even slightly awkward at a crowded counter, users skip it and the loss reverts to "discovered weeks later." Consider a "quick reconcile" (tap only the missing ones) as the default fast path.

### F4 — Counter-time discrepancy flag  ⭐⭐⭐ *core moat*

- **Description.** The instant reconciliation finds a shortfall, the app raises a clear, timestamped flag — *while the customer is still at the counter* — capturing what's missing, the send/receive dates, and the shop.
- **Expectations.** Unmissable in-the-moment alert; one tap to attach a photo or note; the flag becomes the seed of an evidence pack (F9).
- **Pain point / gap.** Today the missing shirt is found "days or weeks later," at which point the claim is unprovable and the shop says "wala kaming nakita" ([doc 01 §1](./01-problem-statement.md), [doc 02 §1](./02-target-customer.md)). The dispute is only winnable at the counter ([doc 04 §4](./04-competitive-analysis.md)).
- **Prescriptive take.** Low effort, maximum edge — this is the "gotcha" moment that earns word-of-mouth and justifies the subscription ([doc 02 §1 WTP](./02-target-customer.md)). Market the app on this single screenshot.

### F5 — Offline-first operation

- **Description.** Create loads, itemize, and reconcile with no connectivity; sync when back online.
- **Expectations.** Zero features blocked at a dead-signal counter; no data loss on sync (explicitly *not* the Sortly "items deleted after update" failure — [doc 04 §1 #3](./04-competitive-analysis.md)).
- **Pain point / gap.** Shop counters frequently have poor/no signal; service and POS apps are online-bound ([doc 04 gap matrix](./04-competitive-analysis.md)). Paper works offline — the app must match that floor.
- **Prescriptive take.** Architectural, so decide in Phase 1 even though users won't "see" it. Local-first storage also de-risks the trust promise: their record can't evaporate because a server did.

### F6 — Photo evidence per load / item

- **Description.** Attach photos to a load or individual items at send-out and at the discrepancy flag.
- **Expectations.** Two-tap capture; photos travel into the evidence pack (F9). Optional, never mandatory (keeps F1–F3 fast).
- **Pain point / gap.** PH legal guidance explicitly lists *"photographs or purchase receipts of garments"* as required evidence ([doc 01 §1](./01-problem-statement.md), [doc 02 §2](./02-target-customer.md)); dhobi-tracker apps have no photo capability ([doc 04 §1 #2](./04-competitive-analysis.md)); Notes-app photos are unstructured.
- **Prescriptive take.** Borrow closet-app polish (auto-crop/background clean) *without* their hours-long full-wardrobe setup burden ([doc 04 §1 #4](./04-competitive-analysis.md)). Photos are the difference between a list and courtroom-grade proof.

### F7 — Shop-agnostic multi-shop record  ⭐⭐⭐

- **Description.** One personal ledger spanning every shop the user has ever used, with a per-shop view.
- **Expectations.** Add unlimited shops; switch shops without losing history; the record is the *customer's*, portable across the 20,000+ mostly-paper shops.
- **Pain point / gap.** Shop POS/service records are shop-bound and vanish when you switch ([doc 04 §5](./04-competitive-analysis.md)); 95%+ of Metro Manila shops run on paper anyway ([doc 04 §2.2/§2.5](./04-competitive-analysis.md)). Customers shop-hop after one bad experience ([doc 01 §3](./01-problem-statement.md)).
- **Prescriptive take.** This is *why* consumer-owned beats shop-owned structurally — no shop-side player can ever cover the fragmented market ([doc 03 §5](./03-market-research.md)). It also quietly generates the data that powers F8 and F15.

---

## Deep dive — Phase 2: trust intelligence

These ship on data the MVP already collects, so effort is low relative to edge. Prescriptive priority: **F8 and F9 first** — they convert the tool into something users *talk about* and *can't get anywhere else*.

### F8 — Per-shop reliability history  ⭐⭐⭐

- **Description.** For each shop, show the user's own track record: loads sent, discrepancies, resolution — a personal "Shop X: 2 missing items across 14 loads."
- **Expectations.** Auto-generated from F3/F4 data; at-a-glance reliability per shop after ≥3 loads ([doc 01 §7](./01-problem-statement.md)).
- **Pain point / gap.** Customers already select shops on trustworthiness — *"hindi nawawalan ng damit"* ("doesn't lose clothes") — but have only memory to go on ([doc 02 §2](./02-target-customer.md)). Drop PH offers shop *star ratings*, not verified reconciliation data ([doc 04 §2.1](./04-competitive-analysis.md)).
- **Prescriptive take.** Personal-scale now; the aggregate version is the Phase-4 moat (F15). Even the single-user view is a retention hook — it makes the history worth keeping.

### F9 — Evidence-pack export (DTI / small-claims-ready)  ⭐⭐⭐

- **Description.** One-tap export of a load's itemized manifest + dates + shop + photos + estimated values, formatted for a demand letter, DTI complaint, or small-claims filing.
- **Expectations.** Produces exactly the artifact PH legal guidance requires: receipt/ticket with date/count/description/value, photos, demand-letter-ready itemization ([doc 01 §1](./01-problem-statement.md), [doc 02 §2](./02-target-customer.md)).
- **Pain point / gap.** Every remedy hinges on documentation customers usually lack ([doc 01 §3–4](./01-problem-statement.md)); the Respicio sample claim itemizes a ₱4,950 blazer + ₱1,290 shirts totaling ₱9,720 ([doc 02 §1](./02-target-customer.md)). Shops cap liability at ~2× the wash fee unless the customer can prove item value ([doc 04 §2.3](./04-competitive-analysis.md)).
- **Prescriptive take.** This is the feature that makes the value *tangible and defensible* — no competitor, local or global, produces it. It also directly attacks the liability-cap fine print: proof is what unlocks real garment value. Pre-fill from F2 values and F6 photos so export is genuinely one tap.

### F10 — Pickup-due reminders

- **Description.** Notify when a load has been out beyond its expected turnaround (e.g., 24–48h).
- **Expectations.** Gentle, dismissable; configurable per shop's typical turnaround.
- **Pain point / gap.** Forgotten loads become forfeited property — chains forfeit unclaimed items after one month ([doc 04 §2.3](./04-competitive-analysis.md)).
- **Prescriptive take.** Table-stakes utility that every category has; include it for parity, don't over-invest. Cheap retention nudge that also drives users back to the reconcile flow (F3).

### F11 — Spend & load analytics

- **Description.** Simple trends: spend per shop, per month; load frequency; item mix.
- **Expectations.** Auto-derived; no manual entry beyond what F1/F2 already capture.
- **Pain point / gap.** ₱500–₱1,200/month laundry spend is invisible today; "know your spend / most reliable shop" is a stated secondary goal ([doc 02 §1](./02-target-customer.md)).
- **Prescriptive take.** A premium-tier sweetener, not an acquisition driver. Good for justifying the ₱49–99/mo upgrade alongside history and exports.

---

## Deep dive — Phase 3: two-sided B2B (the shop counter)

This is where the model turns from indie-scale to company-scale ([doc 03 §3 scenarios](./03-market-research.md)). **Critical correction from the local scan:** the shop-side offer is *not* a cheaper POS — local PH POS already runs ₱0–999/month ([doc 04 §2.2](./04-competitive-analysis.md)). The wedge is the one thing no POS has: **customer-verified counts**.

### F12 — Shop-side manifest confirmation (two-sided receipt)  ⭐⭐⭐

- **Description.** At drop-off, the shop confirms the customer's itemized manifest (a tap, a QR scan of the customer's load, or a lightweight shop screen), creating a *mutually agreed* record before washing.
- **Expectations.** Adds seconds to intake, not minutes; works alongside whatever the shop already uses (paper or POS); produces a receipt both sides trust.
- **Pain point / gap.** Every POS and service app records only what the *shop* keyed in; none confirms the *customer's* list ([doc 04 §2.2](./04-competitive-analysis.md)). The hand-off is "he said, she said" by construction ([doc 01 §1](./01-problem-statement.md)).
- **Prescriptive take.** Highest B2B edge, highest effort — sequence it *after* consumer demand exists, so shops adopt to satisfy customers already asking ("owning the counter" is the ₱614M-milestone requirement, [doc 03 §4](./03-market-research.md)). Keep it POS-agnostic and paper-compatible; most shops won't switch systems.

### F13 — "Verified Shop" trust badge  ⭐⭐⭐

- **Description.** Shops that participate in F12 (and maintain a clean reconciliation record) earn a badge surfaced to customers in-app and on marketing.
- **Expectations.** Badge is *earned and revocable*, backed by real reconciliation history — not pay-to-display.
- **Pain point / gap.** In a price-compressed market of 20,000+ shops, owners actively seek differentiation and better complaint handling ([doc 03 §6](./03-market-research.md), [doc 01 §2](./01-problem-statement.md)); trust is the one axis they can't currently prove. Only WeClean-style scale or Metropole's "one load per customer" process gestures at it today ([doc 04 §2.3](./04-competitive-analysis.md)).
- **Prescriptive take.** This is the monetization key — price it as a ₱300–₱1,000/mo add-on/badge fee, *not* a POS replacement ([doc 04 §5 impl. 5](./04-competitive-analysis.md)). The badge is what shops actually pay for; F12 is how they earn it.

### F14 — POS / marketplace embed (SDK / integration)

- **Description.** Offer the manifest + reconcile flow as an embeddable module inside local marketplaces (Drop PH, Lalaba, Laundrify) and local POS (LaundryVerse, SpinScale, etc.).
- **Expectations.** Order flow in those apps gains an item-level manifest and receive-check; the customer's record still syncs to their own ledger (F7).
- **Pain point / gap.** Local marketplaces track *order status*, not items, and add a courier hand-off with zero item records ([doc 04 §2.1/§2.4](./04-competitive-analysis.md)); local POS omit customer-verified intake ([doc 04 §2.2](./04-competitive-analysis.md)).
- **Prescriptive take.** Treat local platforms as **channel, not just competition** ([doc 04 §2.5 #3](./04-competitive-analysis.md)) — an embed is the fastest B2C2C distribution. Higher effort and partner-dependent, so pursue opportunistically once F12/F13 prove the value.

---

## Deep dive — Phase 4: the network moat

Venture-scale layers ([doc 03 §4](./03-market-research.md)). Listed for completeness and to guide earlier architectural choices; not near-term build targets.

### F15 — Aggregated shop-reliability dataset  ⭐⭐⭐

- **Description.** Anonymized, aggregated reconciliation data across all users → a genuine "which shops lose clothes, and how often" dataset, powering rankings, shop discovery, and B2B insights.
- **Expectations.** Privacy-safe aggregation; statistically meaningful only at scale; feeds F8's personal view and F13's badge integrity.
- **Pain point / gap.** *"A shop-reliability dataset nobody in the Philippines has"* — the hidden asset that converts the B2C tool into B2B leverage ([doc 03 §3 flywheel](./03-market-research.md)).
- **Prescriptive take.** The real long-term moat: it compounds with every reconciled load (F3) and cannot be bought or copied, only accumulated. Design F3/F7 data models now so this is possible later — the single most important architectural forethought in the roadmap.

### F16 — Counter payments + garment micro-insurance

- **Description.** Add payments at the counter and optional micro-insurance that covers *garment value* (not just the wash fee) on reconciled loads.
- **Expectations.** Take-rate revenue (the Cents/Laundrygo playbook) and an insurance product priced off reconciliation-verified item values.
- **Pain point / gap.** Shops cap liability at ~2× the wash fee and disclaim branded items ([doc 04 §2.3](./04-competitive-analysis.md)); the garment's real value is uninsured. Payments are where laundry-tech scale actually lives — Cents processes US$1B/yr ([doc 03 §4](./03-market-research.md)).
- **Prescriptive take.** Only credible as a regional platform play with funding ([doc 03 §4](./03-market-research.md)); the reconciliation ledger (F3/F9/F15) is the *underwriting data* that makes garment insurance possible — a defensible reason this app, not an incumbent, could offer it.

---

## The edge, in one line

> Competitors optimize the shop's operations or the order's logistics. **This app is the only one that gives the customer a portable, itemized, photo-backed, dispute-grade record of the hand-off — and flags the loss while it can still be fixed.** F3 + F4 win the user; F8 + F9 make them stay and evangelize; F12 + F13 monetize the shops; F15 makes it uncopyable.

---

### Source documents

- [`01-problem-statement.md`](./01-problem-statement.md) — the workflow, cost of the problem, success criteria
- [`02-target-customer.md`](./02-target-customer.md) — persona goals/frustrations, willingness to pay, real voices
- [`03-market-research.md`](./03-market-research.md) — SOM scenarios, phase roadmap, data-flywheel, funded-startup playbooks
- [`04-competitive-analysis.md`](./04-competitive-analysis.md) — competitor gaps, PH local landscape, the one thing none of them does well
