# Product Feature Roadmap — Founder's MVP Plan vs. Doc 05 Research Recommendations

> **Document date:** 3 July 2026
> **Purpose:** Part 1 documents the founder's product plan as defined across brainstorm sessions. Part 2 compares that plan side-by-side against the feature recommendations in [`05-competitive-edge-features.md`](./05-competitive-edge-features.md) — flagging matches, simplifications, deferrals, and net-new ideas — so the founder can make an informed call on what (if anything) to pull forward.

---

# PART 1 — The Founder's Plan

## 1.1 Phase 1 (MVP)

**Authentication**
- Passwordless email sign-in — OTP or magic link. No passwords, no manual account setup.

**Create a load**
- Enter shop name, shop location, and send date.

**Itemize**
- Category-based tap counter (e.g., tap "Shirts" three times → count = 3). No per-item entry required at this stage — just category + count.
- Running total counter across all categories, visible as the load's manifest summary.

**Photos (optional, both types)**
- One optional bundle photo per load — doubles as the load's thumbnail/icon.
- Optional per-item-category photos, if the user wants to attach them manually.
- Neither is required to complete a load — pure nice-to-have for evidence.

**Duplicate load (the "template" mechanic)**
- From the home screen or an open load, a triple-dot menu offers "Duplicate."
- Duplicating a load creates a new load carrying over the **same categories only**.
- All counts reset to zero, all photos are cleared, and any item-level data is wiped.
- This gives users a fast way to reuse a familiar load structure (e.g., "my usual weekly wash") without a separate templates feature or extra data model — a duplicated-and-reset load *is* the template.
- **Shop and location also reset** on duplicate, along with everything else — only the clothing categories carry over. A duplicated load is a genuinely new load (new shop, new date, new counts) that simply starts with a familiar category list instead of an empty one.

**Send**
- Load is marked "sent," locking in the manifest as sent-state.

**Receive (counter-side, required)**
- User opens the load and enters the **total count received** — a single number, not item-by-item.
- App compares total received vs. total sent:
  - **Match** → load closes immediately, done in seconds.
  - **Mismatch** → app automatically prompts the user into an item-by-item check-off, right at the counter, so she can dispute specifics with the shop while still present.

**Reconcile (home-side, optional)**
- After leaving the counter, the user can optionally return to the load and check off items category-by-category for her own records — not required to close the load, purely optional diligence.

**Offline-first**
- Built as a PWA — installable, works without signal (relevant since shop counters often have poor connectivity).

**Shop record-keeping**
- Every load stores which shop + location it went to. This is pure data capture in Phase 1 — no analytics or scoring yet, just accumulating the history that later phases will use.

## 1.2 Phase 2

- **AI clothing-type detection.** Point the camera at a garment; the app identifies its category (shirt, pants, underwear, etc.), auto-increments that category's count, and automatically captures and files a photo under that category — removing the manual tap-and-photograph friction entirely.
- This is treated as the primary, near-exclusive focus of Phase 2 given its build complexity.

## 1.3 Phase 3

- **Shop reliability metrics (personal).** Surface the user's own track record per shop — how many loads sent, how many discrepancies — derived from Phase 1 data already being captured.
- **Shareable load link + shop-side validation.** The consumer generates a shareable link for a specific load and sends it to the shop (via SMS, messaging app, etc.). The shop doesn't need to install anything — they simply open the link and:
  1. Enter a count confirming what they received from the customer at intake.
  2. Later, enter a second count confirming what they're returning to the customer.
- This creates a lightweight, mutually-referenced record on both ends without requiring the shop to adopt any software, train staff, or integrate a POS.

## 1.4 Backlog (explicitly deprioritized, not scheduled)

- Evidence-pack export (DTI/small-claims-ready formatted export).
- Pickup-due reminders.

---

# PART 2 — Comparison Against Doc 05 Research

## 2.1 Phase 1 (MVP) — Founder Plan vs. Doc 05 (F1–F7)

| # | Feature | Doc 05 Edge/Effort | Founder's MVP | Status |
|---|---|:---:|---|---|
| F1 | Fast load creation (shop + date, <60s) | ⭐⭐ 🟢 | ✅ Create load: shop + date + shop location | **Match** |
| F2 | Piece-count itemization (presets + reusable templates) | ⭐⭐ 🟡 | ✅ Tap-counter by category; **templates achieved via "duplicate load" mechanic** (see 1.1) | **Match, via a simpler mechanism than doc 05 envisioned** |
| F3 | Receive-side reconciliation checklist (full item-by-item) | ⭐⭐⭐ 🟡 | ⚠️ Total count entry only at counter; full item-by-item is **conditional (on mismatch) or optional (at home)** | **Simplified** |
| F4 | Counter-time discrepancy flag | ⭐⭐⭐ 🟢 | ✅ Mismatch on total count triggers immediate item-by-item prompt **at the counter** | **Match (and arguably sharper)** |
| F5 | Offline-first operation | ⭐⭐ 🟡 | ✅ PWA, installable, offline-capable | **Match** |
| F6 | Photo evidence per load/item | ⭐⭐ 🟢 | ✅ Optional bundle photo (load thumbnail) + optional per-item photos | **Match** |
| F7 | Shop-agnostic multi-shop record | ⭐⭐⭐ 🟢 | ✅ Shop + location captured per load | **Match** |

**Net read:** MVP hits F1, F4, F5, F6, F7 squarely, and now also resolves F2's "reusable templates" ask via the duplicate-load mechanic — a lighter-weight solution than a dedicated templates feature, requiring no new data entity (a template is just a stripped-down clone of an existing load). F3 remains the one deliberate simplification: full item-by-item at the counter is replaced by total-count-first, with item-by-item only triggered on mismatch or done voluntarily at home.

---

## 2.2 Phase 2 — Founder Plan vs. Doc 05 (F8–F11)

| # | Feature | Doc 05 Edge/Effort | Founder's Phase 2 | Status |
|---|---|:---:|---|---|
| F8 | Per-shop reliability history (personal) | ⭐⭐⭐ 🟡 | ❌ Moved to Phase 3 | **Deferred** |
| F9 | Evidence-pack export (DTI/small-claims-ready) | ⭐⭐⭐ 🟡 | ❌ Backlog, low priority | **Deprioritized** |
| F10 | Pickup-due reminders | ⭐ 🟢 | ❌ Backlog, low priority | **Deprioritized** |
| F11 | Spend & load analytics | ⭐ 🟢 | ❌ Moved to Phase 3 | **Deferred** |
| — | AI clothing-type detection (camera scan → auto-count + auto-photo-file) | *(not in doc 05)* | ✅ Core of Phase 2 | **Net-new addition** |

**Net read:** Founder's Phase 2 is a single-minded AI push — nothing from doc 05's Phase 2 (trust intelligence) ships here. This is the biggest structural divergence from the research doc: doc 05 recommended F8–F11 specifically *because* they're cheap to build on top of Phase 1 data, while the founder is spending Phase 2 entirely on a harder technical bet instead.

---

## 2.3 Phase 3 — Founder Plan vs. Doc 05 (F12–F16)

| # | Feature | Doc 05 Edge/Effort | Founder's Phase 3 | Status |
|---|---|:---:|---|---|
| F12 | Shop-side manifest confirmation (two-sided receipt via POS/QR) | ⭐⭐⭐ 🔴 | ✅ Reimagined as: **shareable load link** + shop enters intake count + shop enters return count | **Reimagined, much lower effort** |
| F13 | "Verified Shop" trust badge | ⭐⭐⭐ 🟡 | ❌ Not on roadmap | **Not planned** |
| F14 | POS / marketplace embed (SDK/integration) | ⭐⭐ 🔴 | ❌ Not on roadmap | **Not planned** |
| — | Per-shop reliability metrics (personal) | *(F8, deferred from Phase 2)* | ✅ Now placed here | **Rephrased/relocated** |
| F15 | Aggregated shop-reliability dataset (cross-user) | ⭐⭐⭐ 🔴 | ⚠️ Possible implicit byproduct, not explicitly planned | **Not explicitly planned** |
| F16 | Counter payments + garment micro-insurance | ⭐⭐⭐ 🔴 | ❌ Not on roadmap | **Not planned** |

**Net read:** The founder's shared-load-link idea achieves the strategic goal of F12 — a mutually-referenced, two-sided record — without requiring shop software adoption, staff training, or POS integration. This is a legitimately clever de-risking of doc 05's highest-effort, highest-edge feature.

---

## 2.4 Backlog (Explicitly Deprioritized by Founder)

| Feature | Doc 05 Edge | Why doc 05 flagged it as important |
|---|:---:|---|
| Evidence-pack export (F9) | ⭐⭐⭐ | *"Remedies hinge on itemized list + values + photos customers never keep."* Directly answers the legal/dispute angle that is central to the problem statement (doc 01) and target customer frustrations (doc 02). |
| Pickup-due reminders (F10) | ⭐ | Low edge per doc 05 itself — "table-stakes utility... don't over-invest." Founder's deprioritization is well-supported by the research. |

---

## 2.5 Items Doc 05 Flagged as Critical/High-Edge That Founder Is Deferring or Skipping

These are worth a deliberate, informed decision — not necessarily reversals, just flagged for visibility:

### 2.5.1 — Evidence-pack export (F9) — ⭐⭐⭐, backlog
- **Doc 05's case:** This is the feature that makes the app's value "tangible and defensible." It's what actually helps a user win a DTI complaint or small-claims case, unlocking real garment value instead of the shop's liability cap (~2× wash fee).
- **Founder's current call:** Backlog, low priority.
- **Open question:** Is this genuinely low-priority for initial validation, or does it belong in Phase 2/3 once there's usage data to justify the build?

### 2.5.2 — Per-shop reliability history (F8) — ⭐⭐⭐, moved to Phase 3
- **Doc 05's case:** Called a "retention hook" — even a single-user view of "Shop X: 2 missing items across 14 loads" is described as what "makes the history worth keeping." Doc 05 recommended this ship in Phase 2, on the grounds it's nearly free (auto-derived from data the MVP already collects).
- **Founder's current call:** Deferred to Phase 3, alongside AI in Phase 2 as the sole focus.
- **Open question:** Since this is auto-generated from Phase 1 data with low incremental engineering effort (per doc 05), is there a case for shipping it early — even as a stripped-down view — before or alongside the Phase 2 AI work, rather than waiting for Phase 3?

*(Note: the reusable-templates question from the prior draft of this document is now fully resolved — see §1.1/§2.1 "duplicate load" mechanic, including the shop/location reset behavior.)*

---

## 2.6 What the Founder Added That Doc 05 Didn't Explicitly Propose

| Addition | Phase | Value |
|---|---|---|
| **Duplicate-load-as-template** (triple-dot → duplicate → categories carry over, counts/photos reset) | Phase 1 | Solves doc 05's F2 "reusable templates" ask without a new data entity — a template is just a cloned-and-cleared load. Simpler to build than a dedicated template object. |
| **AI clothing-type detection** (camera scan → auto-increment count → auto-file photo by category) | Phase 2 | Solves doc 05's own acknowledged tension — "photo evidence is valuable but taking one per item is tedious" — without asking the user to do more manual work. Turns a friction point into a differentiator. |
| **Shared load link + shop-side dual counters** (intake confirm + return confirm) | Phase 3 | Achieves the *spirit* of F12 (mutual, two-sided record) without requiring shop software adoption, training, or a dedicated shop app — dramatically lower effort than doc 05's proposed POS/QR integration. |
| **Passwordless email auth (OTP/magic link)** | Phase 1 | Not addressed in doc 05 at all (which focuses on product/market fit, not auth architecture) — but a sound, low-friction onboarding choice for a fast, install-and-go PWA. |
| **Shop + location captured at load creation** | Phase 1 | Slight scope addition to F7 — storing location, not just shop name, sets up future geo-based discovery/recommendation features not discussed in doc 05. |

---

## 2.7 Summary Judgment

- **Phase 1 MVP is well-aligned** with doc 05's highest-edge, lowest-effort features (F4, F5, F6, F7), resolves F2's templates ask via a simpler mechanism (duplicate load), and makes one deliberate, speed-motivated simplification (F3: total-count-first instead of full item-by-item at the counter).
- **Phase 2's AI-only focus is a deliberate trade-off** — doc 05's trust-intelligence features (F8, F9, F11) are pushed out in favor of a single hard technical bet. This concentrates Phase 2 risk/effort on one initiative rather than spreading it across several lower-effort wins doc 05 flagged as "ship on Phase 1 data, low incremental effort."
- **Phase 3's shop-link idea is a genuine improvement** on doc 05's F12 — same strategic goal (two-sided record), far less implementation risk.
- **The one item worth a second look** is F8 (per-shop reliability history) given doc 05's explicit claim that it's near-free to build on Phase 1 data alone — it's a candidate for pulling into Phase 2 or an early Phase 3 slice, independent of the AI work.
- **F9 (evidence export) and F13/F14/F15/F16** remain legitimately out of scope for a solo build at this stage — these are correctly identified in doc 05 itself as higher-effort or venture-scale layers.

---

### Source documents
- [`05-competitive-edge-features.md`](./05-competitive-edge-features.md) — feature framework (F1–F16), edge/effort ratings
- [`01-problem-statement.md`](./01-problem-statement.md) — problem framing, success criteria
- [`02-target-customer.md`](./02-target-customer.md) — persona goals, frustrations, willingness to pay
- Founder brainstorm sessions, 3 July 2026 — MVP and roadmap as described in conversation
