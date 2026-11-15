// Série de jours actifs : logique pure (aucun accès à l'écran ni au stockage), testée dans tests/serie.test.mjs.
// Un jour compte dès 2 piliers sur 3. Un jour de repos prévu ne compte pas et ne casse rien. Une absence n'est jamais reprochée.
const shift = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const active = (x) => !!x && (x.score || 0) >= 2;
const touched = (x) => !!x && !!(x.done || x.nutri || x.routine || x.crise);

// byDay : { "2026-11-15": { score, rest, done, nutri, routine, crise } }
export function streakOf(byDay, today) {
  let n = 0, k = today;
  if (!active(byDay[k])) k = shift(k, -1); // la journée en cours n'est pas finie : elle ne casse pas la série
  for (let i = 0; byDay[k] && i < 800; i++, k = shift(k, -1)) {
    if (active(byDay[k])) n++;
    else if (!byDay[k].rest) break; // repos prévu : on passe par-dessus
  }
  return n;
}

// Nombre de jours sans aucun geste noté juste avant aujourd'hui (0 si hier a été actif ou s'il n'y a pas d'historique)
export function awayDays(byDay, today) {
  const before = Object.keys(byDay).filter(k => k < today && touched(byDay[k])).sort();
  if (!before.length) return 0;
  return Math.max(0, Math.round((new Date(today + "T12:00:00") - new Date(before.at(-1) + "T12:00:00")) / 864e5) - 1);
}

// Message de retour : positif, jamais de reproche. Rien si la personne n'est pas partie (moins de 3 jours).
export function retourMessage(away, todayActive) {
  if (away < 3) return "";
  return todayActive ? "👋 On reprend : ta série est relancée." : "👋 On reprend. Un seul geste aujourd'hui suffit pour relancer ta série.";
}
