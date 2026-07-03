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
| **Does well** | Closest feature match to our concept: item counts, vendor rates, give/receive reconciliation flows, pending-transaction check-off, date-wise reports. These apps digitize the Indian *dhobi diary* — the paper ledger households keep with their laundry person — proving the give/receive-reconcile flow is a real, recurring consumer job |
| **Falls short** | Dated UI (Dropbox/Bluetooth-export era), India-centric per-piece dhobi rate-card model rather than PH per-kilo shop workflow; no photo evidence, no discrepancy/dispute artifact; negligible traction — download counts/ratings not even surfaced in search results (flagged: could not verify store metrics from this environment); no shop directory, no evidence-export tailored to PH disputes (DTI/small claims), no Taglish localization. Note: the "laundry tracker" keyword is also contested in app stores by unrelated *machine-monitoring* apps for shared laundry rooms (PayRange, CSC GO) — an ASO consideration |
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

**Shop-POS customer apps** — [CleanCloud](https://cleancloudapp.com/) (Capterra **4.7/5**, 215 reviews; current pricing **US$75–325/store/mo ≈ ₱4,600–₱20,000/mo**, annual from US$89¹ — [CleanCloud pricing](https://cleancloudapp.com/pricing), [Merchant Maverick](https://www.merchantmaverick.com/best-laundromat-pos/)) and [Turns](https://www.turnsapp.com/) (**US$150–250/mo ≈ ₱9,215–₱15,360/mo**; now part of PayRange, [Software Finder](https://softwarefinder.com/retail/turns-pos)). Complaints: admin UX bugs (saving kicks you to home screen; promo-code lockups), barcode scanning that doesn't warn on duplicate item entry, order/item tracking inconsistencies, one-way customer texting, new customers forced to log in before seeing prices, and "tired of the lack of ownership of issues" ([Capterra reviews](https://www.capterra.com/p/133390/CleanCloud/reviews/), [Software Advice](https://www.softwareadvice.com/retail/cleancloud-profile/)); Turns users cite many small missing features ([GetApp](https://www.getapp.com/retail-consumer-services-software/a/sifabso-1/)). Two more benchmarks bracket the category: **Cents** — the venture-scale endgame (US$140M Series C, 4,500+ US locations; US-centric, hardware-heavy, quote-based pricing, no PH presence — [PR Newswire](https://www.prnewswire.com/news-releases/cents-raises-140-million-from-sumeru-equity-partners-to-support-and-drive-innovation-for-laundry-smbs-302725686.html)) and **Quick Dry Cleaning (QDC)** — the budget end (from **US$49/mo ≈ ₱3,010**, plans to US$139; Capterra ≈ 4.7/5; India-rooted, praised for WhatsApp/SMS pickup reminders — [Capterra](https://www.capterra.com/p/122528/Quick-Dry-Cleaning-Software/)). Even QDC's cheapest tier exceeds what a typical ₱30K–₱100K/month Metro Manila shop will pay, which is why the local market stays on paper.

¹ *Older Capterra/G2 listings still show US$30–110/mo; CleanCloud's own page and 2026 aggregators show US$75–325. The current-price range is used here.*

**On-demand service apps** — [Rinse](https://www.rinse.com/) (US$70M+ raised; wash-and-fold at **US$2.99/lb ≈ ₱405/kg — 5–9× Metro Manila's ₱45–80/kg**): BBB complaints of **lost items, neighbors' laundry picked up by mistake, wrong-address delivery, ₱600-equivalent token credits**, and refunds only after the customer supplies proof ([BBB](https://www.bbb.org/us/ca/san-francisco/profile/dry-cleaners/rinse-inc-1116-542458/complaints), [Honest Brand Reviews](https://www.honestbrandreviews.com/reviews/rinse-review/), [Whisk review](https://whisklaundry.com/blog/rinse-laundry-review-pricing/)). [Laundryheap](https://www.laundryheap.com/) and gig-marketplace [Poplin](https://poplin.co/) (US$10M raised as SudShare) track *order status*, not items — lost/mixed items are a common complaint class in gig laundry. **Metro Manila has no dominant on-demand laundry app**: small locals exist ([Washwell](https://www.washwell.ph/pricing), [Lalaba](https://app.lalaba.ph/), [Laundrify PH](https://play.google.com/store/apps/details?id=ph.laundrify.customer), Mr. Jeff, GoodWork — [Globe blog](https://www.globe.com.ph/blog/home-service-apps-for-chores)), but most shop pickup/delivery is improvised via **GrabExpress/Lalamove couriers and Facebook Messenger booking** ([Triple i Consulting](https://www.tripleiconsulting.com/how-start-laundromat-business-philippines/)) — a *longer* hand-off chain (customer → courier → shop) that makes item verification more valuable, with nobody providing it.

| | |
|---|---|
| **Does well** | Real order lifecycle (pickup → wash → deliver), notifications, payments; CleanCloud even offers branded customer apps for shops |
| **Falls short** | **The shop controls the record.** Itemization (if any) reflects what the *shop* logged, vanishes when you switch shops, and covers only the ~1 shop in thousands that pays for the POS. Disputes remain "your word vs. their system." And the funded services *still* lose items |
| **What makes a user switch** | Nothing to switch — 95%+ of Metro Manila's 20,000+ shops run on paper stubs ([PLO 2026](https://isitcleanph.com/2026/02/21/is-it-clean-unveils-key-findings-of-1st-philippine-laundry-outlook/)). Our app is the customer-side record that works at *every* shop, POS or not |

## 2. Deep-dive: the Philippine local landscape

> Added 3 July 2026 per follow-up research. Metro Manila-first, nationwide players noted. Small local players rarely publish ratings or funding; every teardown below is best-effort with unverifiable items flagged. Feature claims sourced from vendor sites are marked *(vendor claim)*.

### 2.1 Local consumer laundry apps & platforms (B2C)

A real, young local app scene exists — mostly **marketplaces that broker pickup/delivery between customers and existing shops**. None productizes item-level trust.

| Player | What it is | Pricing / coverage | Trust & tracking angle |
|---|---|---|---|
| **[Washwell](https://www.washwell.ph/)** | Direct-to-door laundry service, 15+ years serving 5-star hotels | Flat-rate wash & fold / wash & press / dry-cleaning subscriptions; 24–48h turnaround; **Metro Manila only** ([pricing](https://www.washwell.ph/pricing)) | Service quality positioning; no customer-side itemized manifest |
| **[Lalaba](https://app.lalaba.ph/)** | Pickup/delivery marketplace — consumer app + a **Partner/Merchant app** that digitizes orders for home-based washers and laundromats | Coverage varies by location; consumer + partner apps live on the [App Store PH](https://apps.apple.com/ph/app/lalaba/id6757118750) (recent listings — early-stage; store ratings not yet surfaced, unverified) | Order status tracking; merchant-side order management — the record belongs to the platform/shop |
| **[Laundrify PH](https://laundrify.ph/)** | Marketplace connecting customers to laundry shops via riders | **15–20% service fee** on order total; "most city neighborhoods," expanding ([Laundrify](https://laundrify.ph/), [Google Play](https://play.google.com/store/apps/details?id=ph.laundrify.customer)) | Real-time order updates, not item verification |
| **[Drop PH](https://www.drop-tech.co/how_to_use)** | "Marketplace for modern laundry" — book from nearby shops, **with shop ratings and reviews** | Cash/GCash; App Store + Google Play PH ([App Store](https://apps.apple.com/ph/app/drop-ph-laundry-booking-app/id1671172648)) | Closest local player to the trust angle — but trust = star ratings, not verified send/receive data |
| **[Mr Jeff PH](https://mrjeff.ph/)** | Spanish startup "Jeff" entered PH in 2019, announced 30 laundry hubs ([Manila Standard](https://manilastandard.net/business/biz-plus/345675/jeff-to-open-30-laundry-hubs-in-ph.html), [Manila Bulletin](https://mb.com.ph/2021/03/23/spanish-laundry-startup-expands-in-ph/)); today operates as franchise hubs (Alabang, BGC, Makati) under local franchisees | Per-kilo/per-service pricing at hub level ([Mr Jeff Alabang pricing](https://mrjeff.ph/pricing)); 2-day turnaround | Cautionary tale: a funded international app model that shrank to franchise outposts — PH laundry logistics is hard |
| **[OK Laundry PH](https://www.oklaundryph.com/)**, **GoodWork** ([Globe](https://www.globe.com.ph/blog/home-service-apps-for-chores)), **[Lavada](https://www.lavada.com.ph/)**, **[The Laundry Project](https://www.thelaundryproject.ph/)** | Smaller pickup/delivery services and premium operators in Metro Manila | Varied; mostly website/Messenger booking | Order-level only |

**Read:** local apps validate that Metro Manila customers will book laundry through an app — and every one of them stops at *order* tracking. Drop PH's shop ratings are the nearest thing to a trust layer, and they run on stars, not reconciliation data. These platforms are **potential distribution partners** (our itemized manifest rides inside their order flow) at least as much as competitors.

### 2.2 Local shop software / POS (B2B) — the finding that changes our pricing story

The original analysis assumed PH shops face a choice between paper and imported POS at ₱4,600–20,000/month. **Wrong: a local POS ecosystem already exists at radically lower prices.**

| System | Pricing | Notes |
|---|---|---|
| **[LaundryVerse](https://laundryverse.app/)** | **"Free forever"** *(vendor claim)* | PH-built: POS, order tracking, employee scheduling, payroll, multi-branch dashboard |
| **[Smart Laundry POS PH](https://play.google.com/store/apps/details?id=com.laundrypos)** | **₱299/month** (1 owner + 1 staff; +₱50/extra staff), 30-day free trial | Android-first, no lock-in contracts |
| **[SpinScale](https://spinscalepos.com/)** | **₱599/month** early-subscriber rate (rising to ₱999) | Cloud POS for Manila/Cebu/Davao |
| **[LaundromatAI](https://laundromatai.app/laundry-pos-philippines)** | Free core POS; paid from **₱2,499/month** | AI positioning; publishes PH buyer's guides |
| **[LabadaTech](https://labadatech.com/)** | Not published (flagged) | Cloud POS with pickup booking, SMS notifications, order tracking, multi-branch |
| **[EngagePOS](https://engageposph.com/laundry-pos-philippines)**, LAB System, [Focus ERP](https://www.focussoftnet.com/ph/laundry-management-erp-software) | Not published (flagged) | Per-kilo auto-pricing with local rates and minimum charges |

**Read (and honest revision of our earlier thesis):** the B2B wedge **cannot be price** — local POS is already ₱0–999/month. What none of these systems offers (per their published feature lists — flagged as vendor-sourced) is **customer-verified intake**: every one records what *the shop* keys in. The defensible B2B product is the two-sided receipt — shop confirms the *customer's* itemized manifest at drop-off — plus the "Verified Shop" badge backed by reconciliation history. Priced realistically, that's a **₱300–₱1,000/month add-on module or a badge/network fee**, not a ₱3,500 POS replacement; the doc-03 model's ₱1,200/month entry assumption should be read as the *blended* ceiling, not the floor.

### 2.3 Chains & franchises — the trust-substitutes

For a customer whose real question is "who won't lose my clothes?", the local answer today is *pick a reputable chain*:

| Chain | Scale | Trust mechanics |
|---|---|---|
| **[Metropole](https://metropolelaundry.ph/)** (since 1993) | **35+ branches** nationwide | **"One Customer, One Washing Load"** — no commingling of customers' clothes; regular laundry from **₱45/kg**, per-piece dry cleaning (shirt ₱300, coat ₱400) ([prices](https://metropolelaundry.ph/services-prices/)) — process-based trust, but still no itemized customer receipt for per-kilo loads |
| **[Suds](https://suds.com.ph/)** (since 2003) | Multi-branch + franchising: **₱2.3M investment, ₱300K franchise fee, ₱3M minimum capital** ([Suds franchise](https://suds.com.ph/franchise/suds-franchise-frequently-asked-questions/)) | Brand standards as the trust proxy |
| **[WeClean](https://weclean.com.ph/)** (since 2017) | **65+ MM branches**, ≈US$4M ARR | Per-load walk-in (≤7 kg) / per-kilo pickup, 24h turnaround, GCash/QR Ph — convenience-led; no published lost-item guarantee found (flagged) |
| **[Royal Clean](https://royalclean.ph/)** (~4 decades) | 8 branches MM + Cavite | Longevity-based trust |
| Franchise field: Quicklean (₱600K–2M), Wash N Dry (₱800K–2.5M), Laundry Lounge, [LabaBox](https://lababox.ph/) (+ [RFC financing tie-up](https://rfc.com.ph/news-and-articles/radiowealth-finance-and-laba-box-collaborate-to-boost-laundry-entrepreneurs-in-the-philippines/)) | ₱250K–2.5M entry ([RichestPH](https://richestph.com/be-your-own-boss-top-laundry-franchises-in-the-philippines-with-high-roi/), [FilipiKnow](https://filipiknow.net/laundry-business-philippines/)) | Franchise financing keeps shop supply — and hand-off volume — growing |

**The liability fine print is the kicker.** Where local operators do publish terms, they cap exposure at a multiple of the *wash fee*, not the garment value: BzBee's Laundromat limits lost-item liability to **2× the order value** and disclaims branded/valuable clothing outright ([Refunds & Damages](https://laundryshop.com.ph/refunds-damages/)); Mr Jeff requires immediate in-person/call reporting and forfeits unclaimed items after one month ([Limitations of Liability](https://mrjeff.ph/limitations-of-liability)). A ₱300 load with a ₱4,950 blazer in it is worth ₱600 in the shop's own rulebook — unless the customer can document the item and its value, which is exactly the record this app produces (and PH consumer law voids over-broad waivers, [Respicio & Co.](https://www.respicio.ph/commentaries/laundry-shop-lost-or-damaged-clothes-liability-and-small-claims-in-the-philippines)).

### 2.4 The informal economy — the deepest substitute

- **The labandera** (home laundrywoman): ₱350–₱400/day in Metro Manila for a household's wash + ironing ([Tsikot forum thread](https://www.tsikot.com/forums/miscellaneous-talk-163/salary-rate-labandera-101582/)); ~₱150/day in provinces ([DSWD feature](https://fo5.dswd.gov.ph/the-rugged-laundrywoman-with-a-big-heart/)). Trust is a personal relationship; records don't exist and aren't wanted. Largely a different (household) segment from the condo professional.
- **Condo/building laundry rooms and in-house services**: convenience without custody transfer to a third party — where available, they mute the problem rather than solve it.
- **Messenger + courier improvisation**: many single-shop operators take bookings on Facebook Messenger and move bags via GrabExpress/Lalamove ([Triple i Consulting](https://www.tripleiconsulting.com/how-start-laundromat-business-philippines/)). This is the modal "app experience" of PH laundry today — and it adds a courier hand-off with zero item records on any side.

### 2.5 What the local scan changes in our conclusions

1. **The white space holds locally.** Across apps, POS, chains, and the informal economy, no Philippine player offers a customer-owned itemized send/receive record. The nearest artifacts: Drop PH's star ratings, Metropole's one-load-per-customer process, and POS order screens the customer never sees.
2. **B2B differentiation shifts from price to data** (see §2.2) — local POS killed the price-wedge argument; customer-verified reconciliation and the trust badge are the wedge.
3. **Local marketplaces are channel, not just competition** — an SDK/integration that embeds the manifest + check-in flow inside Lalaba/Drop/Laundrify orders could be the fastest B2C2C distribution.
4. **Liability caps make the evidence artifact more valuable, not less** — the 2×-order-value convention means recovering real garment value *requires* the documentation this app generates.

```mermaid
quadrantChart
    title PH local players: who owns the record vs how granular it is
    x-axis Bulk kilo-level record --> Itemized piece-level record
    y-axis Shop-controlled record --> Customer-controlled record
    quadrant-1 White space we take
    quadrant-2 Diligent but unstructured
    quadrant-3 Paper stub world
    quadrant-4 Shop-side digitization
    "Paper stub (20k+ shops)": [0.15, 0.35]
    "Messenger + GrabExpress": [0.1, 0.25]
    "PH marketplaces (Drop, Lalaba, Laundrify)": [0.4, 0.3]
    "Local POS (LaundryVerse, SpinScale...)": [0.65, 0.15]
    "Chains (Metropole process trust)": [0.35, 0.2]
    "Labandera (personal trust)": [0.2, 0.6]
    "Clothesline target": [0.9, 0.9]
```

## 3. Feature gap matrix

| Capability | Stub + Notes | Niche trackers | Sortly | Closet apps | Shop POS / service apps | **Clothesline (target)** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Works at **any** laundry shop | ✅ | ✅ | ✅ | ✅ | ❌ shop-bound | ✅ |
| Per-load "manifest" (shop + date) | ❌ | ⚠️ partial | ❌ | ❌ | ✅ shop-side only | ✅ |
| Item + piece-count entry < 60s | ❌ | ⚠️ clunky | ❌ | ❌ hours of setup | ❌ | ✅ presets/templates |
| **Receive-side reconciliation checklist** | ❌ | ⚠️ basic | ❌ | ❌ | ❌ | ✅ core loop |
| Discrepancy flagged at the counter | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Per-shop trust history | ❌ | ⚠️ vendor rates only | ❌ | ❌ | ❌ | ✅ |
| PH-ready evidence export (DTI / small claims) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Discrepancy flag + evidence artifact (timestamped) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ core |
| Offline-first (shop counters often have no signal) | ✅ paper | ✅ | ⚠️ | ⚠️ | ❌ | ✅ |
| Taglish / ₱ / per-kilo localization | n.a. | ❌ | ❌ | ❌ | ⚠️ some local services | ✅ |
| Price for a consumer | Free | Free | ≈ ₱3,010/mo | ₱0–429/mo | n.a. (shop pays ₱4,600–20,000/mo) | ₱0 + ₱49–99/mo |

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

## 4. The one thing none of them does well

> **Closing the loop at the moment of receipt.** Every product either records inventory at rest (Sortly, closet apps), records the order for the shop (POS, service apps), or records nothing structured at all (stub, notes). **None of them puts an itemized send-out manifest in the customer's hand and then walks them through a piece-by-piece check-off at pickup, flagging the missing shirt while the customer is still standing at the counter — the only moment the dispute is still winnable.** That reconciliation event, plus the per-shop trust history and PH-ready evidence export it generates, is the whole product. It's also structurally defensible here: with 20,000+ mostly single-shop, paper-based laundromats, no shop-side player can cover the market — only a customer-owned record can.

## 5. Strategic implications

1. **Beat Notes, not Rinse.** Onboarding and per-load speed are the entire game; the competitor with 99% share is a paper stub.
2. **Price under impulse threshold**: free core loop; ₱49–99/mo premium (history, photos, exports) — 30–60× cheaper than the nearest structured tool (Sortly).
3. **Borrow closet-app polish** (photo capture, templates) without their setup burden.
4. **Acquisition moment = first lost item** (₱800–₱5,000 replacement cost). Be present in condo Facebook groups and r/adultingph right where *"nawalan ako ng damit sa laundry"* ("I lost clothes at the laundry") complaint posts appear.
5. **B2B later, from strength — but priced against local POS, not CleanCloud**: local systems already run ₱0–999/mo (§2.2), so the shop-side offer is not a cheaper POS. Sell the one thing no POS has — customer-verified counts — as a ₱300–₱1,000/mo add-on module or "Verified Shop" badge/network fee fed by reconciliation data, integrable with whatever POS (or paper) the shop already uses.

---

### Sources

- [Respicio & Co. — compensation claims for lost laundry](https://www.respicio.ph/commentaries/compensation-claim-for-laundry-service-lost-clothes-philippines)
- [Google Play — Laundry Tracker (krishnas infotech)](https://play.google.com/store/apps/details?id=com.krishnasinfotech.laundrytracker&hl=en) · [Soft112 — Laundry Tracker 2.4](https://laundry-tracker.soft112.com/) · [App Store — LaundrySpace](https://apps.apple.com/us/app/laundryspace/id6738030788) · [GitHub — Laundry-Tracker](https://github.com/Alphaspiderman/Laundry-Tracker)
- [Capterra — Sortly reviews](https://www.capterra.com/p/169199/Sortly-Pro/reviews/) · [JustUseApp — Sortly reviews](https://justuseapp.com/en/app/529353551/sortly-inventory-simplified/reviews) · [The Retail Exec — Sortly review](https://theretailexec.com/tools/sortly-review/) · [Research.com — Sortly](https://research.com/software/reviews/sortly) · [App Store — Sortly](https://apps.apple.com/us/app/sortly-inventory-simplified/id529353551)
- [Nouva — Best wardrobe apps 2026](https://www.nouva.app/blog/best-wardrobe-apps-2026-comparison) · [Indyx — wardrobe app comparisons](https://www.myindyx.com/blog/the-best-wardrobe-apps) · [Kat Sturges — Whering vs Indyx vs Style DNA](http://www.kathrynsturges.com/home/2025/4/8/comparison-between-wardrobe-apps)
- [Capterra — CleanCloud](https://www.capterra.com/p/133390/CleanCloud/) · [Capterra — CleanCloud reviews](https://www.capterra.com/p/133390/CleanCloud/reviews/) · [CleanCloud — pricing](https://cleancloudapp.com/pricing) · [G2 — CleanCloud](https://www.g2.com/products/cleancloud/reviews) · [Merchant Maverick — best laundromat POS](https://www.merchantmaverick.com/best-laundromat-pos/) · [Software Advice — CleanCloud](https://www.softwareadvice.com/retail/cleancloud-profile/)
- [PR Newswire — Cents $140M Series C](https://www.prnewswire.com/news-releases/cents-raises-140-million-from-sumeru-equity-partners-to-support-and-drive-innovation-for-laundry-smbs-302725686.html) · [Capterra — Quick Dry Cleaning Software](https://www.capterra.com/p/122528/Quick-Dry-Cleaning-Software/)
- [Poplin](https://poplin.co/) · [Tracxn — Poplin funding](https://tracxn.com/d/companies/poplin/__xIWF82jNKtIYI0TAlV15uDzDJ0vFbuc_knT7Qu2sH5A) · [Triple i Consulting — laundromat business PH (GrabExpress pattern)](https://www.tripleiconsulting.com/how-start-laundromat-business-philippines/)
- [Software Finder — Turns POS](https://softwarefinder.com/retail/turns-pos) · [GetApp — Turns](https://www.getapp.com/retail-consumer-services-software/a/sifabso-1/) · [Turns (PayRange)](https://www.turnsapp.com/)
- [BBB — Rinse complaints](https://www.bbb.org/us/ca/san-francisco/profile/dry-cleaners/rinse-inc-1116-542458/complaints) · [Honest Brand Reviews — Rinse](https://www.honestbrandreviews.com/reviews/rinse-review/) · [Whisk — Rinse review & pricing](https://whisklaundry.com/blog/rinse-laundry-review-pricing/) · [Tracxn — Rinse funding](https://tracxn.com/d/companies/rinse/__8V03iTVRvm-yJdQGEVjL8htAmc4HTnhjYRZC2eWpu-g)
- [Washwell — pricing](https://www.washwell.ph/pricing) · [Lalaba](https://app.lalaba.ph/) · [Google Play — Laundrify PH](https://play.google.com/store/apps/details?id=ph.laundrify.customer) · [Globe — home service apps](https://www.globe.com.ph/blog/home-service-apps-for-chores)
- [Is It Clean — Philippine Laundry Outlook 2026](https://isitcleanph.com/2026/02/21/is-it-clean-unveils-key-findings-of-1st-philippine-laundry-outlook/)

**Philippine local landscape (§2):**

- Local apps: [Washwell](https://www.washwell.ph/) · [Washwell pricing](https://www.washwell.ph/pricing) · [Lalaba](https://app.lalaba.ph/) · [Lalaba — App Store PH](https://apps.apple.com/ph/app/lalaba/id6757118750) · [Laundrify PH](https://laundrify.ph/) · [Laundrify — Google Play](https://play.google.com/store/apps/details?id=ph.laundrify.customer) · [Drop PH — how it works](https://www.drop-tech.co/how_to_use) · [Drop PH — App Store](https://apps.apple.com/ph/app/drop-ph-laundry-booking-app/id1671172648) · [OK Laundry PH](https://www.oklaundryph.com/) · [Lavada](https://www.lavada.com.ph/) · [The Laundry Project](https://www.thelaundryproject.ph/)
- Mr Jeff PH: [mrjeff.ph](https://mrjeff.ph/) · [Inquirer Technology — Meet Mr Jeff](https://technology.inquirer.net/96018/meet-mr-jeff-the-app-for-your-laundry-needs) · [Manila Standard — Jeff to open 30 hubs](https://manilastandard.net/business/biz-plus/345675/jeff-to-open-30-laundry-hubs-in-ph.html) · [Manila Bulletin — Spanish laundry startup expands in PH](https://mb.com.ph/2021/03/23/spanish-laundry-startup-expands-in-ph/) · [Limitations of Liability](https://mrjeff.ph/limitations-of-liability)
- Local POS: [LaundryVerse](https://laundryverse.app/) · [Smart Laundry POS PH — Google Play](https://play.google.com/store/apps/details?id=com.laundrypos) · [SpinScale](https://spinscalepos.com/) · [LaundromatAI — PH POS guide](https://laundromatai.app/laundry-pos-philippines) · [LabadaTech](https://labadatech.com/) · [EngagePOS](https://engageposph.com/laundry-pos-philippines) · [Focus ERP](https://www.focussoftnet.com/ph/laundry-management-erp-software)
- Chains & franchises: [Metropole](https://metropolelaundry.ph/) · [Metropole prices](https://metropolelaundry.ph/services-prices/) · [Metropole branches](https://metropolelaundry.ph/metropole-branches/) · [Suds franchise FAQ](https://suds.com.ph/franchise/suds-franchise-frequently-asked-questions/) · [WeClean PH](https://weclean.com.ph/) · [Royal Clean](https://royalclean.ph/blog/ultimate-laundry-guide/) · [RichestPH — top laundry franchises](https://richestph.com/be-your-own-boss-top-laundry-franchises-in-the-philippines-with-high-roi/) · [FilipiKnow — laundry business PH](https://filipiknow.net/laundry-business-philippines/) · [LabaBox](https://lababox.ph/) · [RFC × LabaBox](https://rfc.com.ph/news-and-articles/radiowealth-finance-and-laba-box-collaborate-to-boost-laundry-entrepreneurs-in-the-philippines/)
- Liability terms: [Laundry Shop PH — Refunds & Damages (BzBee's)](https://laundryshop.com.ph/refunds-damages/) · [Mr Jeff — Limitations of Liability](https://mrjeff.ph/limitations-of-liability)
- Informal economy: [Tsikot forum — labandera rates](https://www.tsikot.com/forums/miscellaneous-talk-163/salary-rate-labandera-101582/) · [DSWD FO5 — laundrywoman feature](https://fo5.dswd.gov.ph/the-rugged-laundrywoman-with-a-big-heart/) · [Triple i Consulting — laundromat business PH](https://www.tripleiconsulting.com/how-start-laundromat-business-philippines/)
