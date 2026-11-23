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
// Plusieurs zones de la même assiette : on garde le meilleur score de chaque plat
export function merge(lists, n = 8) {
  const best = new Map(); lists.flat().forEach(r => { if (!best.has(r.id) || best.get(r.id).score < r.score) best.set(r.id, r); });
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, n);
}
// Zones analysées en mode « assiette garnie » : l'image entière, puis 4 quarts et le centre (fractions [x0, y0, x1, y1])
export const ZONES = [[0, 0, 1, 1], [0, 0, 0.6, 0.6], [0.4, 0, 1, 0.6], [0, 0.4, 0.6, 1], [0.4, 0.4, 1, 1], [0.2, 0.2, 0.8, 0.8]];

// ---------- Chargement et analyse (navigateur) ----------
let TABLE = null, ENGINE = null;
export async function loadTable() { if (!TABLE) TABLE = decodeTable(await (await fetch("data/plats-photo.json")).json()); return TABLE; }
// onProgress(0..1) pendant le premier téléchargement du modèle
export function loadEngine(onProgress) {
  if (!ENGINE) ENGINE = (async () => {
    const T = await loadTable(), tf = await import(/* @vite-ignore */ LIB);
    tf.env.allowLocalModels = false;
    const files = {}; const cb = (e) => { if (e.status === "progress" && e.total) { files[e.file] = [e.loaded, e.total]; const v = Object.values(files); onProgress?.(v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0)); } };
    const [proc, model] = await Promise.all([tf.AutoProcessor.from_pretrained(T.model), tf.SiglipVisionModel.from_pretrained(T.model, { dtype: T.dtype, progress_callback: cb })]);
    return { tf, proc, model, T };
  })().catch(e => { ENGINE = null; throw e; });
  return ENGINE;
}
// Analyse une photo (Blob ou File). zones = true : plusieurs aliments dans l'assiette (plus lent).
export async function analyse(blob, { zones = false, onProgress } = {}) {
  const { tf, proc, model, T } = await loadEngine(onProgress);
  let img = await tf.RawImage.fromBlob(blob);
  if (Math.max(img.width, img.height) > 640) img = await img.resize(...(img.width >= img.height ? [640, Math.round(img.height * 640 / img.width)] : [Math.round(img.width * 640 / img.height), 640]));
  const embed = async (im) => (await model(await proc(im))).pooler_output.data;
  if (!zones) return rank(await embed(img), T);
  const lists = [];
  for (const [x0, y0, x1, y1] of ZONES) {
    const im = x1 - x0 === 1 ? img : await img.crop([Math.round(x0 * img.width), Math.round(y0 * img.height), Math.round(x1 * img.width) - 1, Math.round(y1 * img.height) - 1]);
    lists.push(rank(await embed(im), T, 4));
  }
  return merge(lists);
}
