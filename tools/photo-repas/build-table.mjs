// Construit data/plats-photo.json : libellés + vecteurs texte SigLIP pré-calculés (int8 + échelle par plat).
// Le téléphone n'a besoin que de la partie image du modèle : la partie texte reste ici.
// Lancement (depuis la racine) : npm i --prefix tools/photo-repas @huggingface/transformers@3.8.1 && node tools/photo-repas/build-table.mjs
// Ajouter un plat : une ligne [id, libellé, description(s) anglaise(s) pour le modèle séparées par « | », recherche dans la base] dans plats.json,
// vérifier que la recherche trouve le bon aliment dans l'app, relancer ce script, augmenter la version du service worker.
import fs from "fs";
import { AutoTokenizer, SiglipTextModel, env } from "@huggingface/transformers";

const MODEL = "Xenova/siglip-base-patch16-224", TMPL = "This is a photo of {}.";
const out = process.argv[2] || "data/plats-photo.json", dtype = process.argv[3] || "q8";
const L = JSON.parse(fs.readFileSync(new URL("./plats.json", import.meta.url), "utf8"));
const tok = await AutoTokenizer.from_pretrained(MODEL);
const tm = await SiglipTextModel.from_pretrained(MODEL, { dtype: "fp32" });
// Plusieurs descriptions pour un plat (séparées par « | ») : on fait la moyenne de leurs vecteurs
const phrases = L.flatMap((l, i) => l[2].split("|").map(t => [i, TMPL.replace("{}", t.trim())]));
const o = await tm(tok(phrases.map(p => p[1]), { padding: "max_length", truncation: true }));
const D = o.pooler_output.dims[1], raw = o.pooler_output.data, data = new Float32Array(L.length * D);
phrases.forEach(([i], k) => { const v = raw.slice(k * D, (k + 1) * D), n = Math.hypot(...v); for (let d = 0; d < D; d++) data[i * D + d] += v[d] / n; });
const q = new Int8Array(L.length * D), scale = [];
for (let i = 0; i < L.length; i++) {
  const v = Array.from(data.slice(i * D, (i + 1) * D)); const n = Math.hypot(...v); const u = v.map(x => x / n);
  const m = Math.max(...u.map(Math.abs)); scale.push(+(m / 127).toPrecision(6));
  u.forEach((x, k) => { q[i * D + k] = Math.round(x / m * 127); });
}
fs.writeFileSync(out, JSON.stringify({
  src: "Vecteurs texte du modèle SigLIP (google/siglip-base-patch16-224, Apache 2.0, version ONNX Xenova), phrase « " + TMPL + " ». Généré par tools/photo-repas/build-table.mjs.",
  model: MODEL, dtype, dim: D,
  plats: L.map(l => [l[0], l[1], l[3]]),
  scale, emb: Buffer.from(q.buffer).toString("base64"),
}));
console.log(L.length, "plats,", D, "dimensions,", fs.statSync(out).size, "octets");
