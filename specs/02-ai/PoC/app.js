/*
 * Clothesline Scan — Proof of Concept (THROWAWAY)
 * ------------------------------------------------
 * Purpose: answer ONE question — can an on-device clothing AI recognize real
 * laundry, accurately and fast, in a phone browser on a cheap Android?
 *
 * This is a rehearsal, not a foundation. Keep the ANSWER, throw the code away.
 * Do NOT copy this into the real product. See README.md.
 *
 * Design note: every failure mode is made LOUD (visible banner + status +
 * console) so the page is never silently "non-responsive".
 */

const CATEGORIES = ['Shirts', 'Trousers', 'Shorts', 'Jackets', 'Dresses']; // the real product's AI subset
const THROTTLE_MS = 350; // run the model a few times/sec, not every frame

// ---- DOM refs ----
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const banner = document.getElementById('banner');
const els = {
  status: document.getElementById('status'),
  backend: document.getElementById('backend'),
  ms: document.getElementById('ms'),
  fps: document.getElementById('fps'),
  tensors: document.getElementById('tensors'),
  topMain: document.getElementById('topMain'),
  topRaw: document.getElementById('topRaw'),
  score: document.getElementById('score'),
};
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const flipBtn = document.getElementById('flipBtn');
const modelSel = document.getElementById('modelSel');

// ---- state ----
let stream = null;
let facingMode = 'environment';
let running = false;
let inferring = false;
let lastInferenceTs = 0;
let cocoModel = null;
let mobilenetModel = null;
let customModel = null;
let lastMs = 0;
let tally = { ok: 0, total: 0 };

// ---- helpers ----
function setStatus(s) { els.status.textContent = s; console.log('[poc]', s); }
function showBanner(msg) { banner.textContent = msg; banner.className = 'show'; console.error('[poc]', msg); }
function clearBanner() { banner.className = ''; banner.textContent = ''; }

// Catch anything that would otherwise die silently.
window.addEventListener('error', (e) => showBanner('Script error: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) =>
  showBanner('Unhandled error: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));

// ================================================================
//  Camera
// ================================================================
async function startCamera() {
  stopStream();
  setStatus('requesting camera…');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (err) {
    throw new Error('Camera denied/unavailable: ' + err.message +
      ' — allow camera access, and make sure you are on https:// or localhost.');
  }
  video.srcObject = stream;

  // Wait for real dimensions before sizing the canvas (avoids a 0×0 overlay).
  await new Promise((res) => {
    if (video.readyState >= 1 && video.videoWidth) return res();
    video.onloadedmetadata = () => res();
  });
  try { await video.play(); } catch (_) { /* autoplay attr covers most cases */ }

  const mirror = facingMode === 'user';
  video.classList.toggle('mirror', mirror);
  overlay.classList.toggle('mirror', mirror);
  overlay.width = video.videoWidth || 640;
  overlay.height = video.videoHeight || 480;
  setStatus('camera on (' + overlay.width + '×' + overlay.height + ')');
}

function stopStream() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}

// ================================================================
//  Models
// ================================================================
async function ensureModel() {
  const which = modelSel.value;
  if (which === 'none') return 'none';

  if (which === 'coco-ssd') {
    if (typeof cocoSsd === 'undefined') {
      throw new Error('coco-ssd library not loaded (CDN blocked?). Use “camera only”, or fix the network and reload.');
    }
    if (!cocoModel) {
      setStatus('loading coco-ssd model… (first time needs internet)');
      cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }
    return 'coco-ssd';
  }

  if (which === 'mobilenet') {
    if (typeof mobilenet === 'undefined') {
      throw new Error('mobilenet library not loaded (CDN blocked?). Use “camera only”, or fix the network and reload.');
    }
    if (!mobilenetModel) {
      setStatus('loading mobilenet model… (first time needs internet)');
      mobilenetModel = await mobilenet.load({ version: 2, alpha: 1.0 });
    }
    return 'mobilenet';
  }

  // Experiment B
  if (typeof tf === 'undefined') {
    throw new Error('TensorFlow.js not loaded (CDN blocked?). Use “camera only”, or fix the network and reload.');
  }
  if (!customModel) { customModel = await loadCustomModel(); }
  return 'custom';
}

/* ---------------------------------------------------------------
 * EXPERIMENT A2 — MobileNet as a rough clothing probe.
 *
 * MobileNet is an ImageNet classifier, NOT a clothing detector. Two
 * consequences to keep in mind when reading its answers:
 *   1. No bounding boxes — it labels the WHOLE frame, so a busy background
 *      competes with the garment. Fill the frame with the item.
 *   2. Its garment vocabulary is thin and uneven. Shirts/trousers/dresses are
 *      reasonably covered; SHORTS barely exist in ImageNet, so expect them to
 *      fail — that's the vocabulary's fault, not the phone's.
 * Treat a bad score here as "need a real clothing model" (already the Phase 2
 * plan), not as "on-device AI can't work".
 * --------------------------------------------------------------- */
const IMAGENET_TO_CATEGORY = [
  [/jersey|t-shirt|tee shirt|sweatshirt|cardigan|sweater|pullover/, 'Shirts'],
  [/jean|denim|pajama|pyjama|trouser|slack/, 'Trousers'],
  [/swimming trunks|bathing trunks|short/, 'Shorts'],
  [/trench coat|fur coat|lab coat|coat|windbreaker|poncho|cloak|jacket|suit/, 'Jackets'],
  [/gown|hoopskirt|crinoline|overskirt|sarong|miniskirt|abaya|kimono|vestment|robe|dress/, 'Dresses'],
];

// ImageNet homographs that look like garments to a substring match but aren't:
// "book jacket" is a dust cover, and it scores high on any book in frame.
const NOT_GARMENT = /book jacket|dust cover|dust jacket|dust wrapper/;

function mapImagenetLabel(className) {
  const s = className.toLowerCase();
  if (NOT_GARMENT.test(s)) return null;
  for (const [re, category] of IMAGENET_TO_CATEGORY) if (re.test(s)) return category;
  return null;
}

async function detectMobilenet(model) {
  const preds = await model.classify(video, 5);
  // Take the highest-ranked guess that lands in one of our 5 categories — the
  // very top guess is often the person holding the garment, or the sofa.
  for (const p of preds) {
    const category = mapImagenetLabel(p.className);
    if (category) return [{ bbox: null, label: category, score: p.probability, raw: p.className }];
  }
  // Nothing clothing-ish: still show what it *did* see, so the screen is never
  // blank and you can tell "no idea" apart from "wrong idea".
  const top = preds[0];
  return top ? [{ bbox: null, label: '(not clothing)', score: top.probability, raw: top.className }] : [];
}

/* EXPERIMENT B — plug your clothing detector in here. See README §"Experiment B". */
const CUSTOM_MODEL_URL = './model/model.json';

async function loadCustomModel() {
  setStatus('loading custom model…');
  return tf.loadGraphModel(CUSTOM_MODEL_URL);
}

async function detectCustom(model) {
  const INPUT = 320; // set to your model's expected input size
  const input = tf.tidy(() =>
    tf.browser.fromPixels(video).resizeBilinear([INPUT, INPUT]).toFloat().expandDims(0));
  const out = await model.executeAsync(input);
  const detections = decodeCustom(out); // model-specific — fill this in
  tf.dispose(input);
  tf.dispose(out);
  return detections;
}

// eslint-disable-next-line no-unused-vars
function decodeCustom(_rawOutputs) {
  // Return [{ bbox:[x,y,w,h] in video px, label:string, score:0..1 }]; map labels onto CATEGORIES.
  console.warn('decodeCustom() is a stub — fill it in for Experiment B.');
  return [];
}

// ================================================================
//  Detection loop
// ================================================================
async function detectOnce(which) {
  if (which === 'none') return [];
  if (which === 'coco-ssd') {
    const raw = await cocoModel.detect(video);
    return raw.map((d) => ({ bbox: d.bbox, label: d.class, score: d.score }));
  }
  if (which === 'mobilenet') return detectMobilenet(mobilenetModel);
  return detectCustom(customModel);
}

function loop(ts) {
  if (!running) return;
  requestAnimationFrame(loop);
  if (inferring) return;
  if (ts - lastInferenceTs < THROTTLE_MS) return;
  lastInferenceTs = ts;

  const which = modelSel.value;
  if (which === 'none') { draw([]); updateStats(); return; } // camera-only: prove responsiveness

  inferring = true;
  const t0 = performance.now();
  detectOnce(which)
    .then((dets) => { lastMs = performance.now() - t0; draw(dets); updateStats(); })
    .catch((err) => showBanner('Detection failed: ' + err.message))
    .finally(() => { inferring = false; });
}

function draw(dets) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  let dominant = null, bestArea = 0;
  for (const d of dets) {
    if (!d.bbox) { dominant = d; continue; } // whole-frame classification — no box to compare
    const area = d.bbox[2] * d.bbox[3];
    if (area > bestArea) { bestArea = area; dominant = d; }
  }
  for (const d of dets) {
    if (!d.bbox) continue;
    const [x, y, w, h] = d.bbox;
    const isDom = d === dominant;
    ctx.lineWidth = isDom ? 4 : 2;
    ctx.strokeStyle = isDom ? '#22c55e' : '#64748b';
    ctx.strokeRect(x, y, w, h);
    ctx.font = '16px system-ui';
    ctx.fillStyle = isDom ? '#22c55e' : '#94a3b8';
    ctx.fillText(`${d.label} ${(d.score * 100) | 0}%`, x + 4, y + 18);
  }
  els.topMain.textContent = dominant ? `${dominant.label}  ·  ${(dominant.score * 100) | 0}%` : '';
  els.topRaw.textContent = (dominant && dominant.raw) ? dominant.raw : '';
}

function updateStats() {
  els.ms.textContent = lastMs ? lastMs.toFixed(0) : '0';
  els.fps.textContent = lastMs > 0 ? (1000 / lastMs).toFixed(1) : '—';
  els.tensors.textContent = (typeof tf !== 'undefined') ? tf.memory().numTensors : '—';
}

// ================================================================
//  Controls
// ================================================================
startBtn.addEventListener('click', async () => {
  clearBanner();
  startBtn.disabled = true;
  try {
    if (typeof tf !== 'undefined') { await tf.ready(); els.backend.textContent = tf.getBackend(); }
    const which = await ensureModel();   // may be 'none' → no model needed
    await startCamera();
    running = true;
    setStatus('running (' + which + ')');
    stopBtn.disabled = false; flipBtn.disabled = false;
    requestAnimationFrame(loop);
  } catch (err) {
    showBanner(err.message);
    setStatus('error');
    startBtn.disabled = false;
    stopStream();
  }
});

stopBtn.addEventListener('click', () => {
  running = false; stopStream();
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  els.topMain.textContent = ''; els.topRaw.textContent = '';
  setStatus('stopped'); startBtn.disabled = false; stopBtn.disabled = true; flipBtn.disabled = true;
});

flipBtn.addEventListener('click', async () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if (running) { try { await startCamera(); } catch (err) { showBanner(err.message); } }
});

modelSel.addEventListener('change', () => { if (running) setStatus('switched model — press Stop then Start'); });

document.getElementById('okBtn').addEventListener('click', () => { tally.ok++; tally.total++; renderScore(); });
document.getElementById('badBtn').addEventListener('click', () => { tally.total++; renderScore(); });
document.getElementById('resetBtn').addEventListener('click', () => { tally = { ok: 0, total: 0 }; renderScore(); });
function renderScore() {
  const pct = tally.total ? Math.round((tally.ok / tally.total) * 100) + '%' : '—';
  els.score.textContent = `${tally.ok} / ${tally.total} (${pct})`;
}

// ---- environment sanity checks (surfaced, not silent) ----
if (!window.isSecureContext) {
  showBanner('Not a secure context — the camera will be blocked. Open via http://localhost:PORT or an https:// URL, not file://.');
}
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  showBanner('This browser/context exposes no camera API. Use a modern browser over localhost or https.');
  startBtn.disabled = true;
}
setStatus('ready — pick a model and press Start');
