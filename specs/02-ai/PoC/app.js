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
let inferring = false;
let lastInferenceTs = 0;
let cocoModel = null;
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

  // Experiment B
  if (typeof tf === 'undefined') {
    throw new Error('TensorFlow.js not loaded (CDN blocked?). Use “camera only”, or fix the network and reload.');
  }
  if (!customModel) { customModel = await loadCustomModel(); }
  return 'custom';
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
  els.topLabel.textContent = '';
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
