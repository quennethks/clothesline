/*
 * Clothesline Scan — Proof of Concept (THROWAWAY)
 * ------------------------------------------------
 * Purpose: answer ONE question — can an on-device clothing AI recognize real
 * laundry, accurately and fast, in a phone browser on a cheap Android?
 *
 * This is a rehearsal, not a foundation. Keep the ANSWER, throw the code away.
 * Do NOT copy this into the real product. See README.md and the parent
 * experiment spec for scope.
 */

const CATEGORIES = ['Shirts', 'Trousers', 'Shorts', 'Jackets', 'Dresses']; // the real product's AI subset

// Run the model a few times per second, not every frame (mimics the product; keeps the phone cool).
const THROTTLE_MS = 350;

// ---- DOM refs ----
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
const els = {
  status: document.getElementById('status'),
  backend: document.getElementById('backend'),
  ms: document.getElementById('ms'),
  fps: document.getElementById('fps'),
  tensors: document.getElementById('tensors'),
  topLabel: document.getElementById('topLabel'),
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
let inferring = false;          // guard: never run two inferences at once
let lastInferenceTs = 0;
let cocoModel = null;
let customModel = null;
let lastMs = 0, tally = { ok: 0, total: 0 };

// ================================================================
//  Camera
// ================================================================
async function startCamera() {
  stopStream();
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  // Mirror the selfie view (and the overlay with it) so it feels natural.
  const mirror = facingMode === 'user';
  video.classList.toggle('mirror', mirror);
  overlay.classList.toggle('mirror', mirror);
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
}

function stopStream() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}

// ================================================================
//  Models
// ================================================================
async function ensureModel() {
  if (modelSel.value === 'coco-ssd') {
    if (!cocoModel) {
      setStatus('loading coco-ssd…');
      // 'lite_mobilenet_v2' is the fastest base — the realistic mobile choice.
      cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }
    return 'coco-ssd';
  }
  // ---- Experiment B: your clothing model ----
  if (!customModel) {
    customModel = await loadCustomModel();
  }
  return 'custom';
}

/*
 * EXPERIMENT B — plug your clothing detector in here.
 *
 * Steps:
 *   1. Get a clothing object-detection model in TensorFlow.js graph-model format
 *      (model.json + weight *.bin shards). See README §"Experiment B".
 *   2. Put the files under ./model/ (or point the URL elsewhere).
 *   3. Fill in decodeCustom() below to turn the raw model outputs into
 *      [{ bbox:[x,y,w,h], label, score }] — output shapes are model-specific.
 *   4. Switch the Model dropdown to "custom".
 */
const CUSTOM_MODEL_URL = './model/model.json';

async function loadCustomModel() {
  setStatus('loading custom model…');
  const model = await tf.loadGraphModel(CUSTOM_MODEL_URL);
  return model;
}

// Turn ONE video frame into detections using the custom model.
// NOTE: box-decoding + non-max-suppression are model-specific — adapt this.
async function detectCustom(model) {
  const INPUT = 320; // set to your model's expected input size
  const input = tf.tidy(() =>
    tf.browser.fromPixels(video).resizeBilinear([INPUT, INPUT]).toFloat().expandDims(0)
    // some models want /255 or a specific mean/std — adjust to yours
  );
  const out = await model.executeAsync(input);
  // TODO: decode `out` (raw boxes/scores/classes) into detections, then run
  //       tf.image.nonMaxSuppression to drop overlaps. Left as an exercise
  //       because every exported model differs. See README.
  const detections = decodeCustom(out);
  tf.dispose(input);
  tf.dispose(out);
  return detections;
}

// eslint-disable-next-line no-unused-vars
function decodeCustom(_rawOutputs) {
  // Return [{ bbox:[x,y,w,h] (in video pixels), label:string, score:0..1 }]
  // Map the model's raw labels onto CATEGORIES here.
  console.warn('decodeCustom() is a stub — fill it in for Experiment B.');
  return [];
}

// ================================================================
//  Detection loop
// ================================================================
async function detectOnce(which) {
  let dets = [];
  if (which === 'coco-ssd') {
    // coco-ssd manages its own tensors and returns pixel-space boxes.
    const raw = await cocoModel.detect(video);
    dets = raw.map((d) => ({ bbox: d.bbox, label: d.class, score: d.score }));
  } else {
    dets = await detectCustom(customModel);
  }
  return dets;
}

function loop(ts) {
  if (!running) return;
  requestAnimationFrame(loop);
  if (inferring) return;                          // no overlapping inference
  if (ts - lastInferenceTs < THROTTLE_MS) return; // throttle
  lastInferenceTs = ts;
  inferring = true;

  const which = modelSel.value;
  const t0 = performance.now();
  detectOnce(which)
    .then((dets) => {
      lastMs = performance.now() - t0;
      draw(dets);
      updateStats();
    })
    .catch((err) => { console.error(err); setStatus('error: ' + err.message); })
    .finally(() => { inferring = false; });
}

function draw(dets) {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  // Highlight the DOMINANT detection (largest area) — the product presents one item at a time.
  let dominant = null, bestArea = 0;
  for (const d of dets) {
    const area = d.bbox[2] * d.bbox[3];
    if (area > bestArea) { bestArea = area; dominant = d; }
  }
  for (const d of dets) {
    const [x, y, w, h] = d.bbox;
    const isDom = d === dominant;
    ctx.lineWidth = isDom ? 4 : 2;
    ctx.strokeStyle = isDom ? '#22c55e' : '#64748b';
    ctx.strokeRect(x, y, w, h);
    ctx.font = '16px system-ui';
    ctx.fillStyle = isDom ? '#22c55e' : '#94a3b8';
    ctx.fillText(`${d.label} ${(d.score * 100) | 0}%`, x + 4, y + 18);
  }
  els.topLabel.textContent = dominant ? `${dominant.label}  ·  ${(dominant.score * 100) | 0}%` : '';
}

function updateStats() {
  els.ms.textContent = lastMs.toFixed(0);
  els.fps.textContent = lastMs > 0 ? (1000 / lastMs).toFixed(1) : '—';
  els.tensors.textContent = tf.memory().numTensors;
}

function setStatus(s) { els.status.textContent = s; }

// ================================================================
//  Controls
// ================================================================
startBtn.addEventListener('click', async () => {
  try {
    startBtn.disabled = true;
    await tf.ready();
    els.backend.textContent = tf.getBackend();
    const which = await ensureModel();
    await startCamera();
    running = true;
    setStatus('running (' + which + ')');
    stopBtn.disabled = false; flipBtn.disabled = false;
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err); setStatus('error: ' + err.message); startBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  running = false; stopStream();
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  els.topLabel.textContent = '';
  setStatus('stopped'); startBtn.disabled = false; stopBtn.disabled = true; flipBtn.disabled = true;
});

flipBtn.addEventListener('click', async () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  if (running) await startCamera();
});

modelSel.addEventListener('change', () => { if (running) setStatus('switched model — press Stop then Start'); });

// accuracy tally (Experiment B)
document.getElementById('okBtn').addEventListener('click', () => { tally.ok++; tally.total++; renderScore(); });
document.getElementById('badBtn').addEventListener('click', () => { tally.total++; renderScore(); });
document.getElementById('resetBtn').addEventListener('click', () => { tally = { ok: 0, total: 0 }; renderScore(); });
function renderScore() {
  const pct = tally.total ? Math.round((tally.ok / tally.total) * 100) + '%' : '—';
  els.score.textContent = `${tally.ok} / ${tally.total} (${pct})`;
}

// surface obvious environment problems early
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  setStatus('this browser/context has no camera access (need https or localhost)');
  startBtn.disabled = true;
}
