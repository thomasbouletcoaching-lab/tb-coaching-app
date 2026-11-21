// Fusion des données d'Apple Santé (envoyées par le Raccourci) dans le journal du jour. Pur : testé par tests/sante.test.mjs.
// Pas : la valeur de Santé remplace (elle est plus complète). Sommeil et poids : seulement si rien n'a été noté à la main ce jour-là.
export function fusionner(daily = {}, rows = []) {
  const out = { ...daily }; let n = 0;
  for (const r of rows) {
    const h = r.data || {}, x = { ...(out[r.d] || {}) }, src = { ...(x.src || {}) }; let ch = false;
    if (h.steps != null && x.steps !== h.steps && (x.steps == null || src.steps === "sante" || h.steps > x.steps)) { x.steps = h.steps; src.steps = "sante"; ch = true; }
    if (h.sleep != null && (x.sleep == null || src.sleep === "sante") && x.sleep !== h.sleep) { x.sleep = h.sleep; src.sleep = "sante"; ch = true; }
    if (h.weight != null && (x.weight == null || src.weight === "sante") && x.weight !== h.weight) { x.weight = h.weight; src.weight = "sante"; ch = true; }
    if (h.hrRest != null && x.hrRest !== h.hrRest) { x.hrRest = h.hrRest; ch = true; }
    if (h.activeKcal != null && x.activeKcal !== h.activeKcal) { x.activeKcal = h.activeKcal; ch = true; }
    if (ch) { x.src = src; out[r.d] = x; n++; }
  }
  return { daily: out, n };
}
