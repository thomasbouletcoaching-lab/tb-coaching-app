// Affichage de l'indice de difficulté de la séance : pastille, « En savoir plus » (membre), détail INOL (coach),
// et adaptateur pour les programmes du moteur de séances (banque, programmes perso, programmes du coach).
import { esc, isCoach, sheet } from "../core.js";
import { S } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as I from "../indice.js";

// Coût nerveux de repli quand l'exercice n'est pas dans la bibliothèque par pattern (selon le type de ligne du programme)
const NERVEUX_TYPE = { F: 3, P: 2, S: 2, N: 2, I: 1, A: 1, C: 1, G: 1, K: 1, M: 1, R: 1 };
const REPOS_TYPE = { F: 180, P: 120, S: 120, N: 120, I: 75 };

// Une séance d'un programme du moteur ([titre, jour, lignes]) en lignes pour l'indice, pour la semaine w.
// La ligne est copiée avant lecture : le moteur la normalise parfois en place, et un simple affichage ne doit rien modifier.
export function lignesDuMoteur(p, se, w) {
  return (se[2] || []).map(row => {
    const nom = S().swaps?.[row[0]] || row[0], kind = row[1] || "P", spec = row[5];
    let series;
    if (spec && (Array.isArray(spec.sets) || typeof spec.sets === "number")) series = E.weekPlan(JSON.parse(JSON.stringify(spec)), w, p).sets.map(s => ({ t: s.t, lo: s.lo, hi: s.hi, rpe: s.rpe, pct: s.pct }));
    else series = E.parseScheme(E.schemeFor(p, row, w)).flatMap(g => Array.from({ length: g.sets }, () => ({ lo: g.lo, hi: g.hi, rpe: g.rpe || (g.pct ? null : 8), pct: g.pct })));
    const ex = X.exercice(nom);
    return { nom, kind, series, nerveux: ex?.cout_nerveux ?? NERVEUX_TYPE[kind] ?? 2, rest: spec?.rest || REPOS_TYPE[kind] || 60, unite: E.unitOf(nom, kind) };
  });
}
export function indiceDuMoteur(p, se, w) { try { const l = lignesDuMoteur(p, se, w); return l.length ? I.indiceSeance(l) : null; } catch { return null; } }

// Pastille : quatre barres, le nom du niveau et la durée
export const barres = (rang) => `<span class="idxbars" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= rang ? "on n" + rang : ""}"></i>`).join("")}</span>`;
export const pastilleIndice = (ind, { info = null } = {}) => ind ? `<span class="idx" aria-label="Indice de difficulté de la séance : ${esc(ind.niveau.nom)}, ${ind.minutes} minutes">${barres(ind.niveau.rang)}<b>${esc(ind.niveau.nom)}</b><span class="muted"> · ${ind.minutes} min</span>${info ? `<button class="idxinfo" data-a="${info.a}" ${info.d || ""} aria-label="En savoir plus sur l'indice de difficulté">ⓘ</button>` : ""}</span>` : "";
export const tagMoteur = (p, se, w) => { const i = indiceDuMoteur(p, se, w); return i ? `<div class="mt4">${pastilleIndice(i, { info: { a: "idx-info", d: `data-p="${esc(p.id)}" data-s="${esc(se[0])}" data-w="${w}"` } })}</div>` : ""; };

// « En savoir plus » : les trois ingrédients en mots simples ; côté coach, le détail INOL exercice par exercice
export function feuilleIndice(ind, titre = "") {
  const c = ind.composantes, pct = (x) => Math.round(x * 100);
  const barre = (nom, v, txt) => `<div class="mt8"><div class="row between small"><b>${nom}</b><span class="muted">${txt}</span></div><div class="mpbar"><i style="width:${pct(v)}%;background:var(--red)"></i></div></div>`;
  const coach = isCoach();
  sheet(`<h2 class="h2">Indice de difficulté de la séance</h2><p class="small muted">${titre ? esc(titre) + " · " : ""}${pastilleIndice(ind)}</p>
    <p class="small mt8">Un seul repère pour savoir à quel point la séance est « lourde à avaler ». Il combine trois choses :</p>
    ${barre("⏱️ La durée", c.duree, `${ind.minutes} min`)}${barre("🏋️ La charge d'intensité", c.inol, "séries lourdes et proches de l'échec")}${barre("⚡ Le coût nerveux", c.nerveux, "mouvements lourds à plusieurs articulations")}
    <p class="xs muted mt12">La charge d'intensité est inspirée de l'INOL : pour chaque série, les répétitions divisées par la distance au maximum que tu pourrais soulever. Le coût nerveux compte davantage un soulevé de terre proche de l'échec qu'une isolation au même effort. Deux séances « très exigeantes » ne sont pas proposées à la suite.</p>
    <div class="xs muted mt8">Légère moins de ${I.NIVEAUX[0].max} · Modérée moins de ${I.NIVEAUX[1].max} · Exigeante moins de ${I.NIVEAUX[2].max} · Très exigeante au-delà.${coach ? ` Indice : <b>${ind.score}</b>/100.` : ""}</div>
    ${coach ? `<h3 class="sec" style="font-size:16px">Détail coach</h3><div class="card" style="padding:4px 12px"><div class="row between xs muted" style="padding:8px 0"><span>INOL total <b style="color:var(--ink)">${ind.inol}</b> · coût nerveux <b style="color:var(--ink)">${ind.nerveux}</b></span><span>${ind.minutes} min</span></div>${ind.parLigne.map(x => `<div class="row between small" style="padding:6px 0;border-top:1px solid var(--line);gap:8px"><span class="grow">${esc(x.nom)}</span><span class="xs muted" style="white-space:nowrap">${x.series} sér. · INOL ${x.inol} · nerv. ${x.nerveux}</span></div>`).join("")}</div>
    <p class="xs muted mt8">Coefficients : durée ${Math.round(I.POIDS.duree * 100)} %, INOL ${Math.round(I.POIDS.inol * 100)} %, coût nerveux ${Math.round(I.POIDS.nerveux * 100)} %. Références : ${I.REF.dureeMin}-${I.REF.dureeMax} min, INOL ${I.REF.inol}, nerveux ${I.REF.nerveux}. Réglables dans js/indice.js.</p>` : ""}`);
}
