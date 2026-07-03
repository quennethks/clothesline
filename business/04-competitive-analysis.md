# Competitive Analysis — Existing Products & Substitutes

> **Document date:** 3 July 2026 · **Currency:** ₱ (US$1 ≈ ₱61.43, see [`03-market-research.md`](./03-market-research.md))
> Scope: anything a Metro Manila professional could use *today* to keep track of clothes sent to a laundry shop.

---

## 1. The top 5 competitors / substitutes

### #1 — The status quo: claim stub + memory (+ occasional notes-app list or photo)

*The real competitor. Free, universal, and the thing to beat.*

| | |
|---|---|
| **Does well** | Zero friction, zero cost, works at every shop; the stub is accepted by the shop as the claim token |
| **Falls short** | Records kilos and price, never contents; no receive-side check; photos/notes are unstructured and get abandoned; useless as dispute evidence — which is why PH law firms tell customers to reconstruct item lists *after* the loss ([Respicio & Co.](https://www.respicio.ph/commentaries/compensation-claim-for-laundry-service-lost-clothes-philippines)) |
| **Pricing / rating / funding** | Free / n.a. / n.a. |
| **What makes a user switch** | An itemizing flow faster than scribbling in Notes (< 60s with presets), plus one "gotcha" moment — the app catching a missing item at the counter once pays for years of habit |

### #2 — Niche personal laundry trackers (Laundry Tracker, LaundrySpace, hobby projects)

*Proof the need exists; execution and distribution are weak.*

| | |
|---|---|
| **Examples** | [Laundry Tracker (krishnas infotech, Google Play)](https://play.google.com/store/apps/details?id=com.krishnasinfotech.laundrytracker&hl=en) — track date, per-cloth counts, vendor rates, mark received, export reports; [Laundry Tracker 2.4 (AppsKraft)](https://laundry-tracker.soft112.com/) — same concept, manage "transactions with your laundry person"; [LaundrySpace (App Store)](https://apps.apple.com/us/app/laundryspace/id6738030788); open-source hobby builds ([GitHub example](https://github.com/Alphaspiderman/Laundry-Tracker)) |
| **Does well** | Closest feature match to our concept: item counts, vendor rates, given/received reconciliation, date-wise reports |
| **Falls short** | Dated UI, India-centric "laundry person" model rather than PH per-kilo shop workflow; negligible traction — download counts/ratings not even surfaced in search results (flagged: could not verify store metrics from this environment); no shop directory, no evidence-export tailored to PH disputes (DTI/small claims), no Taglish localization |
| **Pricing / rating / funding** | Free or ad-supported / unverified / none found |
| **What makes a user switch** | Modern UX, PH-localized flow (shop + kilos + piece counts), receive-checklist speed, trustworthy backup/sync |

### #3 — Generic inventory apps: Sortly

*Powerful, wrong-shaped, and priced for businesses.*

| | |
|---|---|
| **Does well** | Mature item cataloging: photos, folders, QR/barcode, exports; polished apps; ~90% satisfaction across 986 reviews on aggregate review sites ([Research.com](https://research.com/software/reviews/sortly)) |
| **Falls short** | Built for stockrooms, not send/receive loops — no "load", no counterparty, no reconciliation event. Top complaints: **subscription hikes of 300%+** and removal of affordable personal tiers, **data loss after updates** ("all of my items except one were completely deleted"), ads in the free tier, weak support follow-up ([JustUseApp reviews](https://justuseapp.com/en/app/529353551/sortly-inventory-simplified/reviews), [App Store reviews](https://apps.apple.com/us/app/sortly-inventory-simplified/id529353551?see-all=reviews&platform=iphone)) |
| **Pricing / rating / funding** | From **US$49/mo ≈ ₱3,010/mo** — 50× our target price ([The Retail Exec](https://theretailexec.com/tools/sortly-review/)); VC-backed inventory SaaS |
| **What makes a user switch** | Anyone using Sortly for laundry is massively over-tooled and overpaying; a ₱0–59 purpose-built loop wins on price and fit instantly |

### #4 — Wardrobe/closet apps: Stylebook, Whering, Indyx

*Adjacent job: they know what you own, not what you handed to the shop.*

| | |
|---|---|
| **Does well** | Beautiful garment catalogs with AI background removal; outfit planning, cost-per-wear analytics (Stylebook), 10M+ claimed users (Whering); Indyx free tier is generous with strong auto-tagging ([Nouva comparison](https://www.nouva.app/blog/best-wardrobe-apps-2026-comparison), [Indyx comparison](https://www.myindyx.com/blog/the-best-wardrobe-apps)) |
| **Falls short** | No concept of custody: nothing tracks garments *leaving* the house and *coming back*; cataloging a full closet is hours of upfront work (our app needs 60 seconds per load); no dispute/evidence angle |
| **Pricing / rating / funding** | Stylebook **≈ ₱368 one-time** (iOS only); Whering free + **≈ ₱429/mo** premium; Indyx free + styling services from **≈ ₱9,200/lookbook** ([Nouva](https://www.nouva.app/blog/best-wardrobe-apps-2026-comparison)); Whering is VC-backed, Indyx seed-stage |
| **What makes a user switch** | They don't need to switch — they need to *add*. Integration/import is a partnership opportunity; a user who already catalogs clothes is the easiest convert to load tracking |

### #5 — Laundry service software & service apps (shop-side POS apps + on-demand services)

*They itemize only inside their own walls — and they still lose clothes.*

**Shop-POS customer apps** — [CleanCloud](https://cleancloudapp.com/) (Capterra **4.7/5**, 215 reviews; **US$30–110/mo ≈ ₱1,840–₱6,760/mo** per store, [Capterra](https://www.capterra.com/p/133390/CleanCloud/), [pricing](https://cleancloudapp.com/pricing)) and [Turns](https://www.turnsapp.com/) (**US$150–250/mo ≈ ₱9,215–₱15,360/mo**; now part of PayRange, [Software Finder](https://softwarefinder.com/retail/turns-pos)). Complaints: admin UX bugs (saving kicks you to home screen; promo-code lockups), one-way customer texting, report-format gripes, and "tired of the lack of ownership of issues" ([Capterra reviews](https://www.capterra.com/p/133390/CleanCloud/reviews/)); Turns users cite many small missing features ([GetApp](https://www.getapp.com/retail-consumer-services-software/a/sifabso-1/)).

**On-demand service apps** — [Rinse](https://www.rinse.com/) (US$46.5M raised; wash-and-fold at **US$2.99/lb ≈ ₱405/kg — 5–9× Metro Manila's ₱45–80/kg**): BBB complaints of **lost items, neighbors' laundry picked up by mistake, wrong-address delivery, ₱600-equivalent token credits**, and refunds only after the customer supplies proof ([BBB](https://www.bbb.org/us/ca/san-francisco/profile/dry-cleaners/rinse-inc-1116-542458/complaints), [Honest Brand Reviews](https://www.honestbrandreviews.com/reviews/rinse-review/), [Whisk review](https://whisklaundry.com/blog/rinse-laundry-review-pricing/)). Metro Manila locals: [Washwell](https://www.washwell.ph/pricing), [Lalaba](https://app.lalaba.ph/), [Laundrify PH](https://play.google.com/store/apps/details?id=ph.laundrify.customer), Mr. Jeff, GoodWork ([Globe blog](https://www.globe.com.ph/blog/home-service-apps-for-chores)) — order tracking exists, item-level manifests generally don't.

| | |
|---|---|
| **Does well** | Real order lifecycle (pickup → wash → deliver), notifications, payments; CleanCloud even offers branded customer apps for shops |
| **Falls short** | **The shop controls the record.** Itemization (if any) reflects what the *shop* logged, vanishes when you switch shops, and covers only the ~1 shop in thousands that pays for the POS. Disputes remain "your word vs. their system." And the funded services *still* lose items |
| **What makes a user switch** | Nothing to switch — 95%+ of Metro Manila's 20,000+ shops run on paper stubs ([PLO 2026](https://isitcleanph.com/2026/02/21/is-it-clean-unveils-key-findings-of-1st-philippine-laundry-outlook/)). Our app is the customer-side record that works at *every* shop, POS or not |

## 2. Feature gap matrix

| Capability | Stub + Notes | Niche trackers | Sortly | Closet apps | Shop POS / service apps | **Clothesline (target)** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Works at **any** laundry shop | ✅ | ✅ | ✅ | ✅ | ❌ shop-bound | ✅ |
| Per-load "manifest" (shop + date) | ❌ | ⚠️ partial | ❌ | ❌ | ✅ shop-side only | ✅ |
| Item + piece-count entry < 60s | ❌ | ⚠️ clunky | ❌ | ❌ hours of setup | ❌ | ✅ presets/templates |
| **Receive-side reconciliation checklist** | ❌ | ⚠️ basic | ❌ | ❌ | ❌ | ✅ core loop |
| Discrepancy flagged at the counter | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Per-shop trust history | ❌ | ⚠️ vendor rates only | ❌ | ❌ | ❌ | ✅ |
| PH-ready evidence export (DTI / small claims) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Taglish / ₱ / per-kilo localization | n.a. | ❌ | ❌ | ❌ | ⚠️ some local services | ✅ |
| Price for a consumer | Free | Free | ≈ ₱3,010/mo | ₱0–429/mo | n.a. (shop pays) | ₱0 + ₱49–99/mo |

```mermaid
quadrantChart
    title Positioning: who owns the record, and how granular is it
    x-axis Bulk kilo-level record --> Itemized piece-level record
    y-axis Shop-controlled record --> Customer-controlled record
    quadrant-1 White space we take
    quadrant-2 Diligent but unstructured
    quadrant-3 Paper stub world
    quadrant-4 POS and service apps
    "Claim stub + memory": [0.15, 0.35]
    "Notes app / photos": [0.35, 0.8]
    "Sortly": [0.6, 0.75]
    "Closet apps": [0.55, 0.62]
    "Niche laundry trackers": [0.72, 0.85]
    "CleanCloud / Turns": [0.7, 0.2]
    "Rinse / PH pickup apps": [0.55, 0.3]
    "Clothesline target": [0.9, 0.9]
```

## 3. The one thing none of them does well

> **Closing the loop at the moment of receipt.** Every product either records inventory at rest (Sortly, closet apps), records the order for the shop (POS, service apps), or records nothing structured at all (stub, notes). **None of them puts an itemized send-out manifest in the customer's hand and then walks them through a piece-by-piece check-off at pickup, flagging the missing shirt while the customer is still standing at the counter — the only moment the dispute is still winnable.** That reconciliation event, plus the per-shop trust history and PH-ready evidence export it generates, is the whole product. It's also structurally defensible here: with 20,000+ mostly single-shop, paper-based laundromats, no shop-side player can cover the market — only a customer-owned record can.

## 4. Strategic implications

1. **Beat Notes, not Rinse.** Onboarding and per-load speed are the entire game; the competitor with 99% share is a paper stub.
2. **Price under impulse threshold**: free core loop; ₱49–99/mo premium (history, photos, exports) — 50–60× cheaper than the nearest structured tool (Sortly).
3. **Borrow closet-app polish** (photo capture, templates) without their setup burden.
4. **B2B later, from strength**: once customers demand itemized receipts, sell shops the counter-side confirmation at ₱1,000/mo — undercutting CleanCloud's entry tier while doing the one job POS ignores (customer-verified counts).

---

### Sources

- [Respicio & Co. — compensation claims for lost laundry](https://www.respicio.ph/commentaries/compensation-claim-for-laundry-service-lost-clothes-philippines)
- [Google Play — Laundry Tracker (krishnas infotech)](https://play.google.com/store/apps/details?id=com.krishnasinfotech.laundrytracker&hl=en) · [Soft112 — Laundry Tracker 2.4](https://laundry-tracker.soft112.com/) · [App Store — LaundrySpace](https://apps.apple.com/us/app/laundryspace/id6738030788) · [GitHub — Laundry-Tracker](https://github.com/Alphaspiderman/Laundry-Tracker)
- [Capterra — Sortly reviews](https://www.capterra.com/p/169199/Sortly-Pro/reviews/) · [JustUseApp — Sortly reviews](https://justuseapp.com/en/app/529353551/sortly-inventory-simplified/reviews) · [The Retail Exec — Sortly review](https://theretailexec.com/tools/sortly-review/) · [Research.com — Sortly](https://research.com/software/reviews/sortly) · [App Store — Sortly](https://apps.apple.com/us/app/sortly-inventory-simplified/id529353551)
- [Nouva — Best wardrobe apps 2026](https://www.nouva.app/blog/best-wardrobe-apps-2026-comparison) · [Indyx — wardrobe app comparisons](https://www.myindyx.com/blog/the-best-wardrobe-apps) · [Kat Sturges — Whering vs Indyx vs Style DNA](http://www.kathrynsturges.com/home/2025/4/8/comparison-between-wardrobe-apps)
- [Capterra — CleanCloud](https://www.capterra.com/p/133390/CleanCloud/) · [Capterra — CleanCloud reviews](https://www.capterra.com/p/133390/CleanCloud/reviews/) · [CleanCloud — pricing](https://cleancloudapp.com/pricing) · [G2 — CleanCloud](https://www.g2.com/products/cleancloud/reviews)
- [Software Finder — Turns POS](https://softwarefinder.com/retail/turns-pos) · [GetApp — Turns](https://www.getapp.com/retail-consumer-services-software/a/sifabso-1/) · [Turns (PayRange)](https://www.turnsapp.com/)
- [BBB — Rinse complaints](https://www.bbb.org/us/ca/san-francisco/profile/dry-cleaners/rinse-inc-1116-542458/complaints) · [Honest Brand Reviews — Rinse](https://www.honestbrandreviews.com/reviews/rinse-review/) · [Whisk — Rinse review & pricing](https://whisklaundry.com/blog/rinse-laundry-review-pricing/) · [Tracxn — Rinse funding](https://tracxn.com/d/companies/rinse/__8V03iTVRvm-yJdQGEVjL8htAmc4HTnhjYRZC2eWpu-g)
- [Washwell — pricing](https://www.washwell.ph/pricing) · [Lalaba](https://app.lalaba.ph/) · [Google Play — Laundrify PH](https://play.google.com/store/apps/details?id=ph.laundrify.customer) · [Globe — home service apps](https://www.globe.com.ph/blog/home-service-apps-for-chores)
- [Is It Clean — Philippine Laundry Outlook 2026](https://isitcleanph.com/2026/02/21/is-it-clean-unveils-key-findings-of-1st-philippine-laundry-outlook/)
