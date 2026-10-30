// Règles nutritionnelles (sans dépendance) : sucre, équilibre sodium / potassium, apports de référence.
// Repères pratiques pour le suivi, pas un avis médical.

export const SUGAR_GUARD_KCAL = 800; // sous ce seuil, le ratio sucre/calories n'a pas de sens

// Part des calories venant des sucres (sucre g × 4 kcal / kcal totales)
export function sugarPct(sugG, kcal) {
  if (sugG == null || !kcal || kcal < SUGAR_GUARD_KCAL) return null;
  return (sugG * 4) / kcal;
}
// vert < 10 %, orange 10 à 15 %, rouge > 15 % (repère OMS : sucres libres < 10 %)
export function sugarStatus(sugG, kcal) {
  const p = sugarPct(sugG, kcal); if (p == null) return null;
  return p > 0.15 ? "rouge" : p > 0.10 ? "orange" : "vert";
}
// Sodium et potassium en mg. Pas de statut sans donnée de sodium.
export function kRatio(naMg, kMg) {
  if (!naMg || naMg <= 0 || kMg == null) return null;
  return kMg / naMg;
}
export function sodiumStatus(naMg, kMg, sweat = false) {
  const r = kRatio(naMg, kMg); if (r == null) return null;
  const capOrange = sweat ? 3500 : 2300, capRed = sweat ? 4000 : 3000;
  if (r < 0.6 || naMg > capRed) return "rouge";
  if (r < 1 || naMg > capOrange) return "orange";
  return "vert";
}
// Pourcentage de l'apport de référence (AJR/NRV), arrondi
export const pctNrv = (value, nrv) => (value == null || !nrv) ? null : Math.round(value / nrv * 100);

// Micronutriments suivis : code (clé dans la base nutri_nutrients), libellé, unité, apport de référence
export const MICROS = [
  { code: "magnesium", label: "Magnésium", unit: "mg", nrv: 375 },
  { code: "zinc", label: "Zinc", unit: "mg", nrv: 10 },
  { code: "vit_d", label: "Vitamine D3", unit: "µg", nrv: 5 },
  { code: "fer", label: "Fer", unit: "mg", nrv: 14 },
  { code: "calcium", label: "Calcium", unit: "mg", nrv: 800 },
  { code: "vit_c", label: "Vitamine C", unit: "mg", nrv: 80 },
  { code: "vit_b12", label: "Vitamine B12", unit: "µg", nrv: 2.5 },
  { code: "folate", label: "Folates (B9)", unit: "µg", nrv: 200 },
];
