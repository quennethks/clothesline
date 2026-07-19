# Clothesline Scan — Proof of Concept (throwaway)

> **This is a rehearsal, not a foundation.** It exists to answer one risky question before
> the real Scan Mode is built. Keep the **answer**, throw the **code** away. Do **not** copy
> this into the product. Full context: [`../technical-implementation-spec.md`](../technical-implementation-spec.md)
> and the experiment brief you were handed.

## The one question

**Can an on-device clothing AI, running in a phone's web browser (TensorFlow.js), correctly
and quickly recognize real, everyday laundry — a single garment held to the camera in a normal
room — on an inexpensive Android phone?**

Go/no-go bar (tune as you like):

| Dimension | "Go" threshold |
|---|---|
| Accuracy | ≥ ~70–80% correct category on ~20 real garments |
| Speed | ≥ ~1.5 detections/sec (≤ ~650 ms/inference) |
| Stability | ~3 min continuous, no tab crash |
| Device | Holds on a **low/mid-range Android**, not just a laptop |

Target categories (the product's AI subset): **Shirts, Trousers, Shorts, Jackets, Dresses.**

## What's here

```
PoC/
├── index.html   # the whole UI: camera view, detection boxes, speed/tensor stats, accuracy tally
├── app.js       # camera loop + model loading + drawing (Experiment A works out of the box)
└── README.md    # this file
```

No build step, no framework, no backend. Two `<script>` tags pull TensorFlow.js + a ready
object detector from a CDN.

## How to run it

The camera only works over **`https://`** or **`localhost`** (a browser security rule).

### On a laptop/desktop (quickest — Experiment A)

Serve this folder over localhost, then open it in Chrome:

```bash
cd specs/02-ai/PoC
python3 -m http.server 8000      # or:  npx serve .
# open http://localhost:8000
```

`localhost` is exempt from the HTTPS rule, so the camera works. Click **Start**, allow the
camera. You'll see boxes + a live **ms/inference** and **tensors** readout.

> coco-ssd (the default model) does **not** know clothing categories — that's expected.
> Experiment A only proves the pipeline runs and how fast. Point it at anything to watch it work.

### On a real phone (needed for the real answer)

The camera needs HTTPS on a phone. Easiest path: start the server as above, then expose it
with an HTTPS tunnel and open that URL on the phone:

```bash
# examples — any HTTPS tunnel works
npx localtunnel --port 8000
# or: cloudflared tunnel --url http://localhost:8000
# or: ngrok http 8000
```

Open the `https://…` URL on the phone, allow the camera, tap **Start**. Use **Flip camera**
to switch front/back. **Test on a cheap Android**, not a flagship — the whole point is real-world speed.

## Troubleshooting "nothing happens / non-responsive"

The page now surfaces failures as a **red banner** and a **Status** line instead of freezing — read those first, and open the browser console (F12) for detail. Common causes:

| Symptom | Cause | Fix |
|---|---|---|
| Red banner "not a secure context" | Opened as `file://` (double-clicked the HTML) | Serve it: `python3 -m http.server 8000`, open `http://localhost:8000` |
| Status stuck on "loading coco-ssd model…" | Model weights can't download (offline/proxy/firewall) | Switch **Model → "camera only"** to confirm the camera works; fix network for the AI model |
| Red banner "could not load … from the CDN" | The TensorFlow.js CDN scripts were blocked | Check internet/proxy; "camera only" still works without them |
| Status "camera denied/unavailable" | Camera permission not granted, or not https/localhost | Allow the camera; use localhost or an https tunnel |
| Nothing on screen but no banner | — | Open the console (F12); the page logs each step with a `[poc]` prefix — tell me the last line |

**Always start with Model = "camera only" and press Start.** That needs *no* download and *no* AI — if the live camera appears, the page is responsive and the issue is only the model/network. If even that fails, it's the camera/secure-context, and the banner will say which.

## Experiment A — plumbing & speed (½–1 day)

Just run it (steps above) and read the stats:

- Is **ms/inference** low enough on the cheap phone? (watch the `Rate` counter)
- Does it stay up for ~3 minutes without crashing? (watch `Tensors` — it should stay roughly flat, not climb)

If the pipeline is too slow even here, that's an early red flag independent of the clothing model.

## Experiment B — clothing accuracy (the real test)

Swap in an actual clothing detector, then test on ~20 real garments.

1. **Get a model.** Fastest signal: grab a community clothing object-detection model
   (Roboflow Universe / Hugging Face) and get it into **TensorFlow.js graph-model** format
   (`model.json` + `*.bin`). Put the files in `PoC/model/`.
   - ⚠️ **Licence:** because this experiment is throwaway and never shipped, any model is fine
     *here* just to gauge feasibility. The **real product** must use an **open-license** model
     (Fashionpedia, CC BY 4.0) — see the parent spec. Don't blur the two.
2. **Wire it up** in `app.js`: fill in `decodeCustom()` (turn the model's raw outputs into
   `{bbox, label, score}` and map its labels onto the 5 categories), and set `INPUT`/normalization
   in `detectCustom()` to match your model. Box-decoding + `tf.image.nonMaxSuppression` are
   model-specific — that's why it's a stub.
   - If you convert your own model with `tensorflowjs_converter`, it will **fail** on the built-in
     post-processing ops (`NonMaxSuppression`, `Where`, `TopKV2`, `Assert`). Convert **truncated to
     the raw detection outputs** and do NMS in JS. (Using a model already in tfjs format avoids this.)
3. **Switch the Model dropdown to "custom"**, Stop → Start.
4. **Test:** present ~20 real garments one at a time (varied: crumpled, dark, patterned; try
   daylight and a dim room). Read the label up top; tap **✓ Correct / ✗ Wrong** to build the
   running accuracy score.

## What to deliver (then delete the code)

A one-page findings note:

- **Go / no-go** vs. the thresholds above.
- Accuracy (X/20, which categories struggled), typical ms/inference, phone(s) tested, did it stay stable.
- Failure patterns worth knowing ("dark trousers read as jacket", "bad in dim light").
- Recommendation: build as-specced / build-but-prioritize-real-training-data / don't-build-yet.

Bring that note back to the main spec conversation — the result folds into the Phase 2 plan.

---

*Smallest thing that answers the question: camera → clothing AI → is it right, is it fast, on a cheap phone. Measure. Decide. Discard.*
