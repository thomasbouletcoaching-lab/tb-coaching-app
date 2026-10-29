// Récupération : sommeil, ressenti, estimation des réserves de glycogène, conseil pour la séance.
// Porté depuis CalXsthenos (js/views/recup.js). Tout est indicatif : ce n'est pas un avis médical.
import { S, update, today } from "../state";
import * as N from "./nutrition";
import * as EN from "./energy";

export const FEEL = [
  ["energy", "Énergie", "à plat", "en forme"],
  ["well", "Bien-être", "mal", "très bien"],
  ["stress", "Stress", "calme", "très stressé"],
  ["crave", "Envies de craquer", "aucune", "très fortes"],
  ["sat", "Satiété", "affamé", "rassasié"],
];

export const addDays = (d, n) => {
  const z = new Date(d + "T12:00:00");
  z.setDate(z.getDate() + n);
  return z.toISOString().slice(0, 10);
};
export const D = (d = today()) => S().daily?.[d] || {};

export function setSleep(d, { h, q, bed, wake }) {
  update(st => {
    st.daily = st.daily || {};
    const x = st.daily[d] = st.daily[d] || {};
    x.sleep = h; x.sleepQ = q || null; x.bed = bed || null; x.wake = wake || null;
  });
}

export function setFeel(d, key, value) {
  update(st => {
    st.daily = st.daily || {};
    const x = st.daily[d] = st.daily[d] || {};
    x.feel = { ...(x.feel || {}), [key]: value };
  });
}

// Glycogène : estimation simple à partir des glucides des dernières 24 h, du jeûne et de la séance de la veille
export function glycogen(d = today()) {
  const kg = D(d).weight || S().profile?.weight || 75;
  const y = addDays(d, -1);
  const cToday = N.dayTotals(d).c || 0, cYest = N.dayTotals(y).c || 0;
  const hour = d === today() ? new Date().getHours() + new Date().getMinutes() / 60 : 24;
  const carbs24 = cToday + cYest * Math.max(0, (24 - hour) / 24);
  const need = 3 * kg; // repère : 3 g/kg/jour pour un pratiquant de musculation
  const fs = EN.fastState();
  const last = N.lastMealTime(d);
  const sinceMeal = fs ? fs.hours : last && d === today() ? Math.max(0, hour - (+last.slice(0, 2) + +last.slice(3) / 60)) : hour < 10 ? 10 : 3;
  const yLift = S().workouts
    .filter(w => (w.end || "").slice(0, 10) === y)
    .reduce((a, w) => a + Math.round((new Date(w.end) - new Date(w.start)) / 6e4), 0);
  let pct = Math.min(1.05, carbs24 / need) * 100;
  if (sinceMeal > 12) pct -= (sinceMeal - 12) * 3;
  if (yLift > 60 && cYest < need * .8) pct -= 10;
  pct = Math.max(10, Math.min(100, Math.round(pct)));
  const known = N.dayLog(d).length > 0 || N.dayLog(y).length > 0;
  const lvl = !known ? "inconnues" : pct >= 80 ? "pleines" : pct >= 55 ? "correctes" : "basses";
  return { pct: known ? pct : 0, known, lvl, carbs24: Math.round(carbs24), need: Math.round(need), sinceMeal, yLift };
}

// Conseil du jour pour la séance : sommeil + nutrition + ressenti
export function readiness(d = today()) {
  const s = D(d).sleep, s1 = D(addDays(d, -1)).sleep, f = D(d).feel || {}, g = glycogen(d);
  const short2 = s != null && s < 6 && s1 != null && s1 < 6;
  const tips = [];
  let score = 3;
  if (s == null) tips.push("Note ta nuit pour un conseil plus précis.");
  else if (short2) { score -= 2; tips.push("Deux nuits courtes : on baisse d'un cran. Séance express de 30 min ou RPE −1 sur toutes les séries."); }
  else if (s < 6) { score -= 1; tips.push("Nuit courte : garde tes charges mais arrête-toi à RPE 8, pas de série à l'échec."); }
  else if (s >= 7.5) tips.push("Bonne nuit : c'est le jour pour viser un record.");
  if (g.lvl === "basses") { score -= 1; tips.push(`Réserves de glycogène basses (≈ ${g.pct} %). Avant une séance de plus de 45 min : 30 à 60 g de glucides 1 à 2 h avant, ou choisis une séance express.`); }
  else if (g.lvl === "correctes") tips.push("Réserves correctes : une collation avec glucides 1 h avant aide pour une séance longue.");
  if (f.stress >= 8) { score -= 1; tips.push("Stress élevé : moins de séries, même intensité. Le mouvement aide, l'épuisement non."); }
  if (f.energy != null && f.energy <= 3) score -= 1;
  const lv = score >= 3
    ? ["🟢", "prêt", "Tu peux suivre ta séance comme prévu."]
    : score >= 2 ? ["🟠", "à surveiller", "Séance oui, en gardant de la marge."]
    : ["🔴", "fatigué", "Séance courte ou repos actif aujourd'hui."];
  return { icon: lv[0], label: lv[1], text: lv[2], tips, g, score, sleep: s };
}
