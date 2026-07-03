# Product Requirements Document — Clothesline (Phase 2: AI-Assisted Itemization)

> **Product:** Clothesline — a personal laundry send/receive tracker
> **Phase:** 2 of 3 (AI Clothing Detection)
> **Document date:** 3 July 2026
> **Platform:** Progressive Web App (PWA), building on Phase 1 (MVP)

---

## 1. Problem Statement

Phase 1 solved the core reconciliation problem, but manual itemization still has friction: tapping a category multiple times is fast, but attaching a photo per item is tedious enough that most users will skip it — which means the evidence layer (photos tied to specific garments) stays underused even when the counting itself is quick.

**Phase 2's problem statement:** Manual, per-item photo capture is too slow to be adopted voluntarily, so most loads will never build the kind of granular, photo-backed record that makes a future dispute easy to win. Clothesline needs a way to capture *both* an accurate item count *and* a photo per item, without adding manual effort — otherwise the richer evidence layer this app promises will simply never get used.

This phase doesn't change *what* problem the user has (still: prove what was sent) — it changes *how easily* they can build a complete, photo-backed record of it.

---

## 2. Target Users

Same primary persona as Phase 1 ("Bianca") — this phase does not introduce a new user type. The relevant shift is in behavior, not persona:

### What she needs from Phase 2 specifically
1. A way to build a photo-documented itemized load **without** the tedium of manually photographing and tagging each piece of clothing.
2. Confidence that the AI-assisted count is at least as accurate as her own manual tap-counting — she won't trust or keep using a feature that undercounts or miscategorizes her clothes.
3. A fallback to manual entry at any time — she should never be blocked from itemizing a load just because AI detection fails or misfires on an unusual garment.

### Users most likely to adopt this feature early
Users who are already attaching optional photos in Phase 1 (per the photo-attachment-rate metric) are the best early signal group — they've already shown willingness to invest extra effort in documentation, so AI-assisted capture is a direct efficiency upgrade for them specifically.

---

## 3. Core Features

### 3.1 AI Clothing-Type Detection ("Scan Mode")
- A new "scan" mode, entered from the itemize screen, activates the device camera as a **live, real-time video stream** — not a single-shot photo trigger.
- The user drags/pans the camera across her pile of clothes, and the app continuously detects and classifies garments as they pass through frame.
- On each successful detection:
  1. The relevant category's count auto-increments by one.
  2. A photo (frame capture at the moment of detection) is automatically saved and filed under that category.
- Detected items are tracked within the session so the same physical garment isn't double-counted as the camera lingers or passes over it more than once (see open questions on tracking approach).
- The user can keep moving the camera across the pile continuously — shirt → shirt → trousers → socks — building the manifest live, without stopping to trigger each capture manually.

### 3.2 Manual Correction / Override
- If the AI misclassifies an item (e.g., tags a blouse as a shirt when the user wants it separate), the user can manually reassign the captured photo to the correct category.
- If detection fails outright (low confidence, poor lighting, unusual garment), the app falls back to a manual "which category is this?" prompt rather than silently discarding the scan.

### 3.3 Mixed-Mode Itemization
- Scan mode and the Phase 1 manual tap-counter coexist on the same itemize screen — a user can scan some items and manually tap-count others within the same load (e.g., scan all shirts individually for photo evidence, but tap-count socks in bulk since photographing each sock isn't worth the time).

### 3.4 Confidence Threshold & Review
- Detections below a set confidence threshold are flagged for user review before being added to the count, to avoid silently polluting the manifest with wrong categorizations.
- The user sees a lightweight "confirm this is a [category]?" step only for low-confidence detections — high-confidence detections proceed automatically to keep the scanning flow fast.

### 3.5 Photo Storage Per Category (Data Model Extension)
- Builds on Phase 1's data model: where Phase 1 stored only a category + count, Phase 2 introduces an underlying **items** relation — each detected (or manually added) photo becomes an item record linked to its parent category.
- This preserves the Phase 1 summary view ("Shirts: 6") while enabling an expandable detail view ("Shirts: 6" → 6 individual photographed items) for users who want it.

### 3.6 First-Time Onboarding & Persistent Help
- **First-time use:** the first time a user enters scan mode, a full-screen instructional overlay or short walkthrough explains how the live scanning works — e.g., how to pan the camera, what the detection indicator looks like, how counting happens automatically, and how to correct a misclassification.
- This overlay is shown once, automatically, without the user needing to seek it out.
- **Subsequent use:** once the user has seen the onboarding, it does not reappear automatically. Instead, a persistent help icon (a "?" in the top-left or top-right of the scan mode screen) remains available at all times.
- Tapping the help icon re-displays the same instructional content on demand, so a user who forgets how scanning works (e.g., after not using the feature for a while) can quickly refresh her memory without hunting through settings or documentation.

---

## 4. Out of Scope (Phase 2)

- **Garment attribute detection beyond category** — no color, brand, size, or value estimation. The AI's only job is classifying clothing *type* (shirt vs. trousers vs. socks), not describing the garment further.
- **Shop-side AI or shop-side scanning** — this feature is consumer-side only; no version of this ships to laundry shops in this phase.
- **Per-shop reliability metrics or analytics** — still deferred to Phase 3, unaffected by this phase's AI work.
- **Evidence-pack export** — remains backlog; Phase 2 improves the *raw material* (photos per item) available for a future export feature, but does not build the export itself.
- **Offline AI detection guarantee** — if on-device model constraints make full offline scanning infeasible, this phase may require a data connection for scan mode specifically, even though the rest of the app remains offline-first. (See open questions.)
- **Multi-item simultaneous detection in one frame** — the live stream is designed around one garment passing through frame at a time; detecting and separately counting multiple distinct garments visible together in a single frame (e.g., an entire pile at once) is not required for this phase.

---

## 5. Success Metrics

### Accuracy & Trust
- **Classification accuracy rate:** % of scanned items correctly categorized without manual correction, measured against the fixed category list. This is the single most important metric — if accuracy is low, users will abandon scan mode and revert to manual tap-counting.
- **Manual override rate:** % of AI-detected items that the user manually reassigns to a different category. A high override rate signals either poor model performance or category-list problems (e.g., categories that are visually too similar to reliably distinguish).
- **Low-confidence flag rate:** % of scans that fall below the confidence threshold and require user confirmation — useful for tuning the threshold itself over time (too high a rate defeats the speed purpose; too low risks silent miscategorization).

### Adoption
- **Scan-mode adoption rate:** % of active Phase 1 users who use scan mode at least once after it ships.
- **Scan-mode retention:** % of users who use scan mode on a second load after their first use — the real test of whether it's actually faster/better than manual tap-counting, not just a novelty tried once.
- **Photo-per-item rate uplift:** compare the Phase 1 "photo attachment rate" metric before and after Phase 2 ships. A successful Phase 2 should show a meaningful increase in loads with photo-documented items, since the friction that suppressed this behavior in Phase 1 is what Phase 2 directly targets.

### Efficiency
- **Time to itemize via scan mode vs. manual tap-counting:** for a load of comparable size, does scan mode actually save time once camera setup and occasional corrections are factored in? This should be measured honestly — if scan mode isn't meaningfully faster (or if it's slower due to correction overhead), that's an important signal to know quickly.

---

## 6. Open Questions

1. **On-device vs. API-based classification** — does detection run locally (faster, works offline, but constrained model size/accuracy) or via a cloud API call (likely higher accuracy, but breaks the offline-first principle for this specific feature, and introduces per-scan cost)? This is the single biggest architecture decision for this phase and affects nearly every other requirement above.
2. **Category list stability** — does the fixed category list from Phase 1 need to expand or change to be AI-classifiable (e.g., are "shirts" and "blouses" visually distinct enough for a model to separate reliably, or should they be merged/split based on what's actually achievable)?
3. **Cost model** — if using a third-party AI/vision API, what's the expected per-scan cost, and how does that scale with active usage? Is this sustainable for a free or low-cost consumer app at Metro Manila price sensitivity?
4. **Handling ambiguous or overlapping garments in frame** — what happens if the camera sees multiple items at once (e.g., a pile of clothes) rather than one item held up individually? Is single-item-at-a-time framing a hard requirement communicated to the user, or does the model need to be more robust than that?
5. **Training/fine-tuning data source** — is a general-purpose, off-the-shelf clothing classification model sufficient, or will this require custom training data reflecting the specific category list and typical Philippine wardrobe items (e.g., school uniforms, barong, specific fabric types)?
6. **Fallback UX when detection repeatedly fails** — if a user's environment (poor lighting, cluttered background) causes frequent detection failures, at what point does the app suggest switching back to manual tap-counting rather than repeatedly prompting for confirmation?
7. **Duplicate-detection / object tracking in live stream mode** — since the camera is now a continuous feed rather than a single trigger, how does the app avoid counting the same physical garment twice if it lingers in frame or the camera passes over it again? Does this require frame-to-frame object tracking (not just per-frame classification), and if so, what's the added model complexity and on-device performance cost of that?
8. **Session boundaries for live scanning** — does the user explicitly start and stop a scanning session (e.g., tap to begin, tap to end), or does the app infer when scanning is "done" from inactivity? This affects both the UX and how double-counting risk (open question 7) is managed at the edges of a session.

---

### Source documents
- [`01-problem-statement.md`](./01-problem-statement.md)
- [`02-target-customer.md`](./02-target-customer.md)
- [`06-product-feature-roadmap.md`](./06-product-feature-roadmap.md)
- [`07-prd-phase1-mvp.md`](./07-prd-phase1-mvp.md)
- Founder brainstorm sessions, 3 July 2026
