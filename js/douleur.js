// Traiter une alerte de blessure : quelques questions pour savoir si elle est à prendre au sérieux ou à laisser de côté.
// Pur (sans DOM ni état) : testé par tests/douleur.test.mjs. Ce n'est pas un diagnostic : en cas de doute, avis d'un professionnel de santé.
export const QUESTIONS = [
  { id: "int", q: "Quelle intensité, de 0 à 10 ?", o: [["faible", "1 à 3 : légère"], ["moyenne", "4 à 6 : gênante"], ["forte", "7 à 10 : forte"]] },
  { id: "type", q: "Ça ressemble à quoi ?", o: [["courbature", "Courbature, muscle fatigué"], ["gene", "Gêne articulaire légère"], ["vive", "Douleur vive, en coup de poignard"], ["nerf", "Fourmillements, engourdissement, décharge"]] },
  { id: "quand", q: "Quand est-ce que tu la sens ?", o: [["effort", "Seulement pendant l'effort, ça passe après"], ["apres", "Encore après la séance ou le lendemain"], ["repos", "Au repos ou la nuit"]] },
  { id: "signes", q: "Gonflement, bleu, perte de force ou de mobilité, craquement douloureux ?", o: [["non", "Non"], ["oui", "Oui"]] },
  { id: "evol", q: "Depuis, ça évolue comment ?", o: [["mieux", "Ça va mieux"], ["pareil", "C'est pareil"], ["pire", "Ça empire"]] },
];

// Verdict : "serieux" (on garde l'alerte, on consulte et on prévient le coach), "surveiller" (on adapte, l'alerte est rangée
// et revient si la douleur est de nouveau notée), "benin" (rangée).
export function verdict(r) {
  const drapeaux = [r.int === "forte" && "douleur forte", r.type === "vive" && "douleur vive", r.type === "nerf" && "signes nerveux", r.quand === "repos" && "douleur au repos ou la nuit", r.signes === "oui" && "gonflement, perte de force ou de mobilité", r.evol === "pire" && "douleur qui s'aggrave"].filter(Boolean);
  if (drapeaux.length) return { v: "serieux", drapeaux };
  if (r.int === "faible" && ["courbature", "gene"].includes(r.type) && r.quand === "effort" && r.evol !== "pire") return { v: "benin", drapeaux };
  return { v: "surveiller", drapeaux };
}
export const complet = (r) => QUESTIONS.every(q => r && r[q.id]);

// Alerte encore à afficher ? Une alerte traitée revient seulement si une douleur est notée après le traitement,
// sauf si elle a été jugée sérieuse : elle reste jusqu'à « C'est réglé ».
export function aAfficher(derniereDouleur, triage) {
  if (!triage) return true;
  if (triage.v === "serieux") return true;
  return new Date(derniereDouleur) > new Date(triage.at);
}
