// Totaux nutritionnels d'une journée à partir du journal alimentaire (app), et ligne pour la base (nutri_daily).
import { dayLog } from "./nutrition.js";
import { sugarStatus, sodiumStatus, kRatio } from "./nutri-rules.js";

const MIC_KEYS = { sug: "sugar", na: "sodium", k: "potassium", mg: "magnesium", zn: "zinc", vd: "vit_d", fe: "fer", ca: "calcium", vc: "vit_c", b12: "vit_b12" };

// Totaux de la journée : macros, sucre, sel, micronutriments (somme des aliments qui ont la donnée)
export function dayNutrients(date) {
  const log = dayLog(date), t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, sug: 0, na: 0, k: 0, mg: 0, zn: 0, vd: 0, fe: 0, ca: 0, vc: 0, b12: 0, known: 0, total: log.length };
  const has = {}; // au moins un aliment avec la donnée
  log.forEach(e => {
    t.kcal += e.kcal || 0; t.p += e.p || 0; t.c += e.c || 0; t.f += e.f || 0; t.fib += e.fib || 0;
    if (e.mic) { t.known++; Object.keys(MIC_KEYS).forEach(k => { if (e.mic[k] != null) { t[k] += e.mic[k]; has[k] = true; } }); }
  });
  const out = { kcal: round(t.kcal), p: round(t.p), c: round(t.c), f: round(t.f), fib: round(t.fib), coverage: t.total ? +(t.known / t.total).toFixed(2) : null };
  out.sugG = has.sug ? round(t.sug, 1) : null;
  out.naMg = has.na ? round(t.na) : null;
  out.kMg = has.k ? round(t.k) : null;
  out.salt = out.naMg != null ? round(out.naMg * 2.5 / 1000, 1) : null; // g de sel = mg de sodium × 2,5 / 1000
  Object.entries({ mg: "magnesium", zn: "zinc", vd: "vit_d", fe: "fer", ca: "calcium", vc: "vit_c", b12: "vit_b12" }).forEach(([k, code]) => { out[code] = has[k] ? round(t[k], 2) : null; });
  out.sugStatus = sugarStatus(out.sugG, out.kcal);
  out.naStatus = sodiumStatus(out.naMg, out.kMg, false);
  out.ratio = kRatio(out.naMg, out.kMg);
  return out;
}
const round = (v, d = 0) => { const k = Math.pow(10, d); return Math.round((v || 0) * k) / k; };

// Ligne envoyée à nutri_daily (les totaux vides restent null, jamais 0)
export function nutriRow(userId, date, sweat = false) {
  const t = dayNutrients(date);
  if (!t.total) return null;
  const n = (v) => (v == null ? null : v);
  return {
    user_id: userId, d: date, kcal: t.kcal, prot_g: t.p, gluc_g: t.c, lip_g: t.f, fibres_g: t.fib,
    sucres_g: n(t.sugG), sel_g: n(t.salt), sucres_ajoutes_g: null,
    sodium_mg: n(t.naMg), potassium_mg: n(t.kMg), magnesium_mg: n(t.magnesium), zinc_mg: n(t.zinc), vit_d_ug: n(t.vit_d),
    fer_mg: n(t.fer), calcium_mg: n(t.calcium), vit_c_mg: n(t.vit_c), vit_b12_ug: n(t.vit_b12), folate_ug: null,
    coverage: t.coverage, sweat_day: !!sweat, updated_at: new Date().toISOString(),
  };
}
