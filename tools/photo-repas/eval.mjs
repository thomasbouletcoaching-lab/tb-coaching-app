// Mesure la précision : photos de validation Food-101 (ethz/food101 sur Hugging Face) → plats de l'app (plats.json).
// IMGS = dossier contenant les photos et index.json ([[chemin, classe Food-101], …]). Ex. : node eval.mjs Xenova/siglip-base-patch16-224 q8 "This is a photo of {}."
// Résultats du 23/11/2026, 384 photos (6 par plat × 64 plats), 203 plats possibles :
//   SigLIP base q8  : 1er 86,5 %, dans les 3 premiers 97,4 %, dans les 5 premiers 99,7 %  ← retenu
//   CLIP B/16 q8    : 79,4 % / 94,8 % / 97,1 %     CLIP B/32 q8 : 76,8 % / 89,1 % / 92,7 %
import fs from "fs";
import { AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, SiglipTextModel, SiglipVisionModel, RawImage, env } from "@huggingface/transformers";

const [modelId, vdtype = "q8", tmpl = "a photo of {}, a type of food.", limit = "9999"] = process.argv.slice(2);
const L = JSON.parse(fs.readFileSync(new URL("./plats.json", import.meta.url), "utf8"));
const IDX = JSON.parse(fs.readFileSync((process.env.IMGS || "imgs") + "/index.json", "utf8")).slice(0, +limit);
const MAP = JSON.parse(fs.readFileSync(new URL("./food101-correspondance.json", import.meta.url), "utf8"));
const siglip = /siglip/.test(modelId);

const tok = await AutoTokenizer.from_pretrained(modelId);
const proc = await AutoProcessor.from_pretrained(modelId);
const TM = siglip ? SiglipTextModel : CLIPTextModelWithProjection, VM = siglip ? SiglipVisionModel : CLIPVisionModelWithProjection;
const tm = await TM.from_pretrained(modelId, { dtype: "fp32" });
const vm = await VM.from_pretrained(modelId, { dtype: vdtype });

const norm = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s); return v.map(x => x / s); };
const texts = L.map(l => tmpl.replace("{}", l[2]));
const ti = tok(texts, { padding: siglip ? "max_length" : true, truncation: true });
const to = await tm(ti);
const T = siglip ? to.pooler_output : to.text_embeds;
const D = T.dims[1], TE = []; for (let i = 0; i < L.length; i++) TE.push(norm(Array.from(T.data.slice(i * D, (i + 1) * D))));

let n = 0, h1 = 0, h3 = 0, h5 = 0; const per = {}; const t0 = Date.now();
for (const [p, cls] of IDX) {
  const ok = MAP[cls]; if (!ok) continue;
  const img = await RawImage.read(p); const out = await vm(await proc(img));
  const v = norm(Array.from((siglip ? out.pooler_output : out.image_embeds).data));
  const sc = TE.map((t, i) => [t.reduce((a, x, k) => a + x * v[k], 0), L[i][0]]).sort((a, b) => b[0] - a[0]);
  const rank = sc.findIndex(s => ok.includes(s[1]));
  n++; if (rank < 1) h1++; if (rank < 3) h3++; if (rank < 5) h5++;
  (per[cls] ||= []).push(sc[0][1]);
}
const ms = (Date.now() - t0) / n;
console.log(JSON.stringify({ modelId, vdtype, tmpl, n, top1: +(h1 / n).toFixed(3), top3: +(h3 / n).toFixed(3), top5: +(h5 / n).toFixed(3), msPerImage: Math.round(ms) }));
fs.writeFileSync(`/tmp/per_${modelId.replace(/\W/g, "_")}_${vdtype}.json`, JSON.stringify(per, null, 1));
