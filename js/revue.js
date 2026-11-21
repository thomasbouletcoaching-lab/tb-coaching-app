// Correction d'une séance par le coach : critères notés de 1 à 5, réaction, commentaires par exercice et par série.
// Pur (sans DOM ni état) : testé par tests/revue.test.mjs.
// data = { reaction: "🔥", note: "texte", grades: { technique: 4, … }, ex: { "0": { c: "texte", sets: { "1": "texte" } } }, at }
export const CRITERES = [["technique", "Technique"], ["intensite", "Intensité (proche de l'échec)"], ["plan", "Respect du plan"], ["charges", "Progression des charges"], ["tempo", "Tempo et contrôle"]];
export const REACTIONS = ["👀", "👍", "🔥", "💪", "👏", "🏆", "⚠️"];
export function moyenne(grades = {}) { const v = Object.values(grades).map(Number).filter(n => n >= 1 && n <= 5); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; }
export const verdict = (m) => m == null ? "" : m >= 4.5 ? "Excellent" : m >= 3.5 ? "Très bien" : m >= 2.5 ? "Correct, à affiner" : "À retravailler";
export function nbCommentaires(d = {}) { return Object.values(d.ex || {}).reduce((a, e) => a + (e.c ? 1 : 0) + Object.values(e.sets || {}).filter(Boolean).length, 0) + (d.note ? 1 : 0); }
export const vide = (d = {}) => !d.reaction && !d.note && !moyenne(d.grades) && !nbCommentaires(d) && !d.vu;
// Résumé d'une ligne (notification, liste)
export function resumeRevue(d = {}) {
  const m = moyenne(d.grades), n = nbCommentaires(d);
  return [d.reaction || "✅", "Vue par Thomas", m != null ? `${String(m).replace(".", ",")}/5` : "", n ? `${n} commentaire${n > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
}
// Nettoie la saisie : notes entières 1–5, textes coupés, commentaires vides retirés
export function nettoyer(d = {}) {
  const out = { vu: true, at: d.at || new Date().toISOString() };
  if (d.reaction && REACTIONS.includes(d.reaction)) out.reaction = d.reaction;
  const note = String(d.note || "").trim().slice(0, 1500); if (note) out.note = note;
  const g = {}; CRITERES.forEach(([k]) => { const v = Math.round(+d.grades?.[k]); if (v >= 1 && v <= 5) g[k] = v; }); if (Object.keys(g).length) out.grades = g;
  const ex = {}; Object.entries(d.ex || {}).forEach(([i, e]) => { const c = String(e?.c || "").trim().slice(0, 600), sets = {};
    Object.entries(e?.sets || {}).forEach(([j, t]) => { const x = String(t || "").trim().slice(0, 300); if (x) sets[j] = x; });
    if (c || Object.keys(sets).length) ex[i] = { ...(c ? { c } : {}), ...(Object.keys(sets).length ? { sets } : {}) }; });
  if (Object.keys(ex).length) out.ex = ex;
  return out;
}
