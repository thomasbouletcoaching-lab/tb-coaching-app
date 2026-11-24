// Surcharge progressive : modèles de progression prêts à appliquer (créateur de programme, coach ou client),
// méthodes de surcharge par exercice, et décision séance après séance à partir d'indicateurs (RPE réel vs prévu, reps, douleur).
// Les modèles en % s'appuient sur le 1RM estimé du client : ils s'adaptent tout seuls à son niveau de départ.

const P0 = { load: "auto", step: 2.5, every: 1, addSet: null, reps: null };
const work = (z) => z.t !== "W";
const setAll = (x, f) => x.sets.forEach(z => { if (work(z)) f(z); });
// Remet les séries de travail au format voulu (n séries de lo à hi reps, à pct % ou RPE)
function format(x, n, lo, hi, { pct = null, rpe = 8 } = {}) {
  const wu = x.sets.filter(z => z.t === "W");
  x.sets = [...wu, ...Array.from({ length: n }, () => ({ t: "N", lo, hi, rpe, pct, kg: null, tech: [] }))];
}

export const MODELES = [
  // Force
  { id: "lin5", g: "Force", n: "Linéaire 5×5", d: "5×5 à 75 % du 1RM, +2,5 % par semaine. Simple et efficace en début de cycle de force.", f: (x) => { format(x, 5, 5, 5, { pct: 75, rpe: null }); x.prog = { ...P0, load: "pct", step: 2.5 }; } },
  { id: "lin3", g: "Force", n: "3×3 progressif", d: "3×3 à 82 %, +2 % par semaine pendant 4 à 5 semaines, puis on refait un test.", f: (x) => { format(x, 3, 3, 3, { pct: 82, rpe: null }); x.prog = { ...P0, load: "pct", step: 2 }; } },
  { id: "vague3", g: "Force", n: "Vague 3 semaines", d: "4×5 : semaine 1 à 80 %, 2 à 84 %, 3 à 88 %, puis on repart 2,5 % plus haut.", f: (x) => { format(x, 4, 5, 5, { pct: 80, rpe: null }); x.prog = { ...P0, load: "auto", wave: [0, 4, 8], waveStep: 2.5 }; } },
  { id: "chargeRepsBas", g: "Force", n: "Charge ↑, reps ↓", d: "4×8 → 4×7 → 4×6… : chaque semaine +2,5 % et une rep de moins. Passage de l'hypertrophie à la force.", f: (x) => { format(x, 4, 8, 8, { pct: 70, rpe: null }); x.prog = { ...P0, load: "pct", step: 2.5, reps: { delta: -1, every: 1, min: 3 } }; } },
  { id: "rpeMonte", g: "Force", n: "Même format, RPE qui monte", d: "Le format ne bouge pas (ex. 3×5), la charge suit le RPE : 7 → 7,5 → 8 → 8,5 → 9. Idéal quand on ne connaît pas bien son 1RM.", f: (x) => { const n = x.sets.filter(work).length || 3, lo = x.sets.find(work)?.lo || 5; format(x, n, lo, lo, { rpe: 7 }); x.prog = { ...P0, load: "auto", rpeUp: 0.5, rpeMax: 9 }; } },
  // Hypertrophie
  { id: "double810", g: "Hypertrophie", n: "Double progression 3×8-10", d: "On gagne une rep par semaine jusqu'à 3×10, puis +2,5 kg et retour à 3×8.", f: (x) => { format(x, 3, 8, 8, { rpe: 8 }); x.prog = { ...P0, load: "double", to: 10, step: 2.5 }; } },
  { id: "double1215", g: "Hypertrophie", n: "Double progression 3×12-15 (isolation)", d: "Pour les petits muscles : de 12 à 15 reps, puis le plus petit saut de charge.", f: (x) => { format(x, 3, 12, 12, { rpe: 8.5 }); x.prog = { ...P0, load: "double", to: 15, step: 1 }; } },
  { id: "volume", g: "Hypertrophie", n: "Ajout de séries", d: "On commence à 2 séries et on en ajoute une toutes les 2 semaines (jusqu'à 5), charge à RPE 8.", f: (x) => { const lo = x.sets.find(work)?.lo || 10, hi = x.sets.find(work)?.hi || lo + 2; format(x, 2, lo, hi, { rpe: 8 }); x.prog = { ...P0, load: "auto", addSet: { every: 2, max: 5 } }; } },
  { id: "reps1", g: "Hypertrophie", n: "+1 rep par semaine", d: "Même charge, une rep de plus chaque semaine sur toutes les séries.", f: (x) => { x.prog = { ...P0, load: "auto", reps: { delta: 1, every: 1, min: 1 } }; } },
  // Densité, tempo, intensification
  { id: "densite", g: "Densité et tempo", n: "Repos qui raccourcit", d: "Même travail, 15 s de repos en moins chaque semaine (jusqu'à 60 s). Plus de densité, séances plus courtes.", f: (x) => { x.rest = x.rest || 120; x.prog = { ...P0, load: "auto", restDelta: 15, restMin: 60 }; } },
  { id: "tempo", g: "Densité et tempo", n: "Excentrique de plus en plus lente", d: "Tempo 2-0-1, puis 3-0-1, 4-0-1, 4-1-1 : plus de temps sous tension à charge égale.", f: (x) => { x.prog = { ...P0, load: "auto", tempos: ["2-0-1-0", "3-0-1-0", "4-0-1-0", "4-1-1-0"] }; } },
  { id: "restpause", g: "Intensification", n: "Rest-pause en fin de bloc", d: "Progression normale, puis à partir de la semaine 3 la dernière série passe en rest-pause.", f: (x) => { x.prog = { ...(x.prog || P0), techFrom: { w: 3, t: "Rest-pause" } }; } },
  { id: "dropset", g: "Intensification", n: "Dégressive sur la dernière série", d: "À partir de la semaine 2, dernière série prolongée par une dégressive (−20 %).", f: (x) => { x.prog = { ...(x.prog || P0), techFrom: { w: 2, t: "Dropset" } }; } },
];
export const modele = (id) => MODELES.find(m => m.id === id) || null;

// Méthodes de surcharge choisies pour un exercice, appliquées séance après séance
export const METHODES = [
  ["charge", "🏋️ Charge (même format, RPE contrôlé)"], ["reps", "➕ Répétitions"], ["series", "📚 Séries"], ["chargeReps", "⬆️ Charge ↑ et reps ↓"],
  ["chargeRpe", "🔥 Charge ↑, même format, RPE plus haut"], ["tempo", "🐢 Tempo plus lent"], ["repos", "⏱️ Repos plus court"],
  ["technique", "🎯 Technique d'exécution (amplitude, pause, contrôle)"], ["intensif", "⚡ Technique d'intensification"],
];
export const INTENSIF = ["Dropset", "Rest-pause", "Cluster", "Isométrie", "Partielles", "Myo-reps"];

// Indicateurs de la dernière fois → décision pour aujourd'hui
// last : séries faites { kg, reps, rpe, trpe, lo, hi, pain }, cible : { lo, hi, rpe }
export function decider(meth, last, cible, { step = 2.5, rest } = {}) {
  rest = rest ?? 120;
  const w = (last || []).filter(s => s.kg != null || s.reps != null); if (!w.length) return null;
  const rpe = w.reduce((a, s) => a + (s.rpe ?? s.trpe ?? cible.rpe ?? 8), 0) / w.length, ecart = rpe - (cible.rpe || 8);
  const repsOk = w.every(s => (s.reps || 0) >= (cible.hi || cible.lo || 8)), repsBas = w.some(s => (s.reps || 0) < (cible.lo || 8)), douleur = w.some(s => s.pain);
  const best = w.reduce((a, b) => ((b.kg || 0) > (a.kg || 0) ? b : a));
  const etat = douleur ? "douleur" : ecart >= 1 || repsBas ? "dur" : ecart <= -1 || repsOk ? "facile" : "cible";
  const lu = `RPE moyen ${String(Math.round(rpe * 2) / 2).replace(".", ",")} pour ${String(cible.rpe || 8).replace(".", ",")} prévu${repsBas ? ", reps sous la fourchette" : repsOk ? ", haut de la fourchette atteint" : ""}`;
  if (etat === "douleur") return { etat, lu, txt: "Douleur la dernière fois : on garde tout pareil, amplitude sans douleur, ou on change de variante.", kg: 0 };
  if (etat === "dur") return { etat, lu, txt: "C'était plus dur que prévu : même charge aujourd'hui, objectif des reps plus propres. Si la forme du jour est basse, −5 %.", kg: 0 };
  const fort = etat === "facile";
  const D = {
    charge: { txt: `+${fort ? step * 2 : step} kg, même format`, kg: fort ? step * 2 : step },
    reps: { txt: `Même charge, +${fort ? 2 : 1} rep sur chaque série`, reps: fort ? 2 : 1 },
    series: { txt: "Même charge et mêmes reps, +1 série", sets: 1 },
    chargeReps: { txt: `+${step * 2} kg et 1 rep de moins par série`, kg: step * 2, reps: -1 },
    chargeRpe: { txt: `+${step} kg, même format : le RPE monte d'un demi-point`, kg: step, rpe: 0.5 },
    tempo: { txt: "Même charge, descente en 4 secondes et pause d'1 s en bas", tempo: "4-1-1-0" },
    repos: { txt: `Même travail avec ${Math.max(45, rest - 15)} s de repos au lieu de ${rest} s`, rest: -15 },
    technique: { txt: "Même charge : amplitude complète, pause d'1 s en position étirée, zéro élan", tempo: "3-1-1-0" },
    intensif: { txt: "Même charge, dernière série prolongée par une technique d'intensification", tech: "Rest-pause" },
  }[meth] || { txt: `+${step} kg`, kg: step };
  return { etat, lu, ...D, txt: (etat === "cible" && !fort ? "Dans la cible : petite progression. " : "Marge disponible : ") + D.txt, best };
}

// Ajustement pendant la séance, après une série de travail : RPE réel vs prévu
export function ajusterEnDirect(s, step = 2.5) {
  if (s.rpe == null || s.trpe == null || !s.kg) return null;
  const d = s.rpe - s.trpe;
  if (d >= 1.5) return { pct: -7.5, txt: `RPE ${String(s.rpe).replace(".", ",")} pour ${String(s.trpe).replace(".", ",")} prévu : enlève environ 7,5 % sur les séries suivantes.` };
  if (d >= 1) return { pct: -5, txt: `RPE ${String(s.rpe).replace(".", ",")} pour ${String(s.trpe).replace(".", ",")} prévu : enlève environ 5 % pour rester dans la cible.` };
  if (d <= -2) return { pct: 5, txt: `RPE ${String(s.rpe).replace(".", ",")} pour ${String(s.trpe).replace(".", ",")} prévu : tu as de la marge, +5 % sur les séries suivantes.` };
  if (d <= -1.5) return { pct: 2.5, txt: `Plus facile que prévu : +${step} kg possible sur la suite.` };
  return null;
}
