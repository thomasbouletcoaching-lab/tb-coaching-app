// Photo du repas : reconnaissance des plats SUR LE TÉLÉPHONE, sans serveur ni API payante.
// Modèle de vision SigLIP (Google, Apache 2.0), version ONNX compressée, téléchargé une fois puis gardé par le navigateur.
// La photo n'est ni envoyée ni enregistrée : elle est lue en mémoire, analysée, puis oubliée.
// Les vecteurs des plats (data/plats-photo.json) sont calculés à l'avance : seule la partie image du modèle est chargée.

const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
export const MODEL_MO = 94; // taille approximative du téléchargement (une seule fois)

// ---------- Partie pure (testée par tests/photo-repas.test.mjs) ----------
export function decodeTable(j) {
  const bin = typeof atob === "function" ? Uint8Array.from(atob(j.emb), c => c.charCodeAt(0)) : new Uint8Array(Buffer.from(j.emb, "base64"));
  const q = new Int8Array(bin.buffer, bin.byteOffset, bin.byteLength), D = j.dim;
  const vecs = j.plats.map((_, i) => { const v = new Float32Array(D), s = j.scale[i]; for (let k = 0; k < D; k++) v[k] = q[i * D + k] * s; return v; });
  return { model: j.model, dtype: j.dtype, dim: D, plats: j.plats.map(([id, fr, q]) => ({ id, fr, q })), vecs };
}
const unit = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Float32Array.from(v, x => x / s); };
// Plats classés du plus probable au moins probable : [{ id, fr, q, score }]
export function rank(imgVec, T, n = 6) {
  const v = unit(imgVec), out = T.plats.map((p, i) => { const t = T.vecs[i]; let s = 0; for (let k = 0; k < v.length; k++) s += v[k] * t[k]; return { ...p, score: s }; });
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}
// Zone analysée autour d'un toucher : carré de 28 % du petit côté de la photo, recentré pour rester dans l'image
// (taille retenue après essais sur de vraies assiettes de buffet). Renvoie [x0, y0, x1, y1] en pixels.
export const TAP = 0.28;
export function tapBox(w, h, fx, fy, f = TAP) {
  const s = Math.max(16, Math.round(Math.min(w, h) * f)), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const x0 = cl(Math.round(fx * w - s / 2), 0, w - s), y0 = cl(Math.round(fy * h - s / 2), 0, h - s);
  return [x0, y0, x0 + s - 1, y0 + s - 1];
}

// ---------- Chargement et analyse (navigateur) ----------
let TABLE = null, ENGINE = null, READY = false, PROG = null;
export const engineReady = () => READY; // moteur déjà prêt (préchargé ou déjà utilisé)
export async function loadTable() { if (!TABLE) TABLE = decodeTable(await (await fetch("data/plats-photo.json")).json()); return TABLE; }
// onProgress(0..1) pendant le premier téléchargement du modèle
export function loadEngine(onProgress) {
  if (onProgress) PROG = onProgress; // le dernier écran qui attend reçoit l'avancement (même si le préchargement a commencé avant)
  if (!ENGINE) ENGINE = (async () => {
    const T = await loadTable(), tf = await import(/* @vite-ignore */ LIB);
    tf.env.allowLocalModels = false;
    const files = {}; const cb = (e) => { if (e.status === "progress" && e.total) { files[e.file] = [e.loaded, e.total]; const v = Object.values(files); PROG?.(v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0)); } };
    const [proc, model] = await Promise.all([tf.AutoProcessor.from_pretrained(T.model), tf.SiglipVisionModel.from_pretrained(T.model, { dtype: T.dtype, progress_callback: cb })]);
    READY = true; return { tf, proc, model, T };
  })().catch(e => { ENGINE = null; throw e; });
  return ENGINE;
}
// Photo → image en mémoire (réduite à 1024 px), sans rien envoyer ni enregistrer
export async function decode(blob, onProgress) {
  const { tf } = await loadEngine(onProgress);
  let img = await tf.RawImage.fromBlob(blob); const m = Math.max(img.width, img.height);
  if (m > 1024) img = await img.resize(Math.round(img.width * 1024 / m), Math.round(img.height * 1024 / m));
  return img;
}
const embed = async (im) => { const { proc, model } = await loadEngine(); return (await model(await proc(im))).pooler_output.data; };
// Plats les plus probables sur toute la photo
export async function analyse(img) { const { T } = await loadEngine(); return rank(await embed(img), T); }
// Plats les plus probables à l'endroit touché (fx, fy entre 0 et 1)
export async function analyseAt(img, fx, fy) { const { T } = await loadEngine(); return rank(await embed(await img.crop(tapBox(img.width, img.height, fx, fy))), T); }
