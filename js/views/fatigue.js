// Récupération et fatigue nerveuse (Premium) : check-in de 10 secondes, feu du jour, séance allégée, semaine de décharge, rappel de coucher.
// Le calcul est dans js/recuperation.js (pur). Ici : lecture des données de l'app et affichage. Rien n'est jamais imposé : on propose.
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as W from "../semaine.js";
import * as R from "../recuperation.js";
import { esc, toast, actions, forms, go, I, sheet, closeSheet, rerender, premium, lockVeil, isCoach, buzz, addDays, fmtDate } from "../core.js";
import { sem, lieuDefaut } from "./semaine.js";

X.loadExercices(); // en arrière-plan : sert à reconnaître les mouvements lourds et les patterns

// ---------- Ce qu'on sait du jour ----------
const D = (d) => S().daily[d] || {};
export function checkinDe(d = today()) {
  const x = D(d), f = x.feel || {}, ci = { sleep: x.sleep, sleepQ: x.sleepQ, energy: f.energy, stress: f.stress, sore: f.sore, motiv: f.motiv };
  return R.scoreCheckin(ci) ? ci : null;
}
const ctxDuJour = (d = today()) => ({
  auj: d, checkin: checkinDe(d), workouts: S().workouts, lifts: S().lifts, daily: S().daily,
  nerveuxDe: (n) => X.exercice(n)?.cout_nerveux ?? R.nerveuxParDefaut(n),
  patternDe: (n) => { const e = X.exercice(n); return e?.couche === "squelette" ? e.pattern_principal : null; },
  jourDe: (iso) => today(new Date(iso)),
});
export const etatDuJour = (d = today()) => R.etat(ctxDuJour(d));
const feuxRecents = () => Object.fromEntries(Object.entries(S().daily).filter(([, v]) => v.feu).map(([d, v]) => [d, v.feu]));
const dechargeActuelle = () => R.dechargeActive(S().decharge, today()) ? S().decharge : null;

// ---------- Le check-in de 10 secondes ----------
const ECHELLES = [
  ["energy", "⚡ Énergie", ["😴", "😕", "😐", "🙂", "💪"], "à plat → en forme"],
  ["stress", "😮‍💨 Stress", ["😌", "🙂", "😐", "😟", "😰"], "calme → très stressé"],
  ["sore", "💪 Courbatures", ["✨", "🙂", "😐", "😣", "🥵"], "aucune → très fortes"],
  ["motiv", "🔥 Motivation", ["😶", "😕", "😐", "🙂", "🔥"], "à plat → à fond"],
];
const VAL = [2, 4, 6, 8, 10];
const proche = (v) => v == null ? null : VAL.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, VAL[0]);
actions["fc-open"] = () => {
  if (!premium()) return;
  const x = D(today()), f = x.feel || {};
  sheet(`<h2 class="h2">☀️ Check-in du jour</h2><p class="small muted mt4">Dix secondes : touche une réponse par ligne. Ça sert à te dire si la séance doit être complète ou allégée.</p>
    <form data-f="fc-checkin" class="mt12">
      <div class="small"><b>😴 Sommeil cette nuit</b></div>
      <div class="chips wrap mt4">${[5, 6, 7, 8, 9].map(h => `<label class="chip sm pick"><input type="radio" name="sleep" value="${h}" ${x.sleep != null && Math.round(x.sleep) === h ? "checked" : ""}><span>${h} h</span></label>`).join("")}</div>
      <div class="chips wrap mt4">${[["1", "très mauvaise"], ["2", "mauvaise"], ["3", "correcte"], ["4", "bonne"], ["5", "excellente"]].map(([v, l]) => `<label class="chip sm pick"><input type="radio" name="sleepQ" value="${v}" ${String(x.sleepQ) === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>
      ${ECHELLES.map(([k, nom, ems, aide]) => `<div class="small mt12"><b>${nom}</b> <span class="xs muted">${aide}</span></div><div class="chips wrap mt4" role="radiogroup" aria-label="${nom}">${VAL.map((v, i) => `<label class="chip pick"><input type="radio" name="${k}" value="${v}" ${proche(f[k]) === v ? "checked" : ""}><span aria-label="${nom} ${i + 1} sur 5">${ems[i]}</span></label>`).join("")}</div>`).join("")}
      <button class="btn btn-red mt16" style="width:100%">Voir mon feu</button></form>`);
};
forms["fc-checkin"] = (v) => {
  const rep = ["sleep", "energy", "stress", "sore", "motiv"].filter(k => v[k] != null && v[k] !== "").length;
  if (rep < 3) return toast("Réponds à trois lignes au moins : le feu sera plus juste.");
  const d = today();
  update(st => {
    const x = st.daily[d] = st.daily[d] || {}, f = x.feel = { ...(x.feel || {}) };
    if (v.sleep) { x.sleep = +v.sleep; if (v.sleepQ) x.sleepQ = +v.sleepQ; }
    if (!v.sleep && v.sleepQ) x.sleepQ = +v.sleepQ;
    for (const k of ["energy", "stress", "sore", "motiv"]) if (v[k]) f[k] = +v[k];
    x.ciAt = new Date().toISOString();
  });
  const e = etatDuJour(); update(st => { st.daily[d].feu = e.feu.id; });
  closeSheet(); buzz();
  toast(e.feu.id === "vert" ? "🟢 Feu vert : séance comme prévue" : e.feu.id === "orange" ? "🟠 Feu orange : une version allégée est conseillée" : "🔴 Feu rouge : on y va doucement aujourd'hui");
  rerender();
};

// ---------- Séance allégée au démarrage ----------
// Choix de la personne pour la séance qui démarre (jamais imposé). Mode : décharge en cours, sinon le feu du jour.
let choix = { mode: null, on: false };
export function modeAllegement() {
  if (!premium()) return null;
  if (dechargeActuelle()) return "decharge";
  const f = etatDuJour().feu.id; // sans check-in, on se base sur les séances seulement
  return f === "orange" || f === "rouge" ? f : null;
}
export function feuStartBlock() {
  const mode = modeAllegement(); choix = { mode, on: !!mode };
  if (!mode) return "";
  const e = etatDuJour(), dec = mode === "decharge", c = R.ALLEGEMENT[mode];
  return `<div class="card soft mt8"><b class="small">${dec ? "🛌 Semaine de décharge" : `${e.feu.icone} Ton feu du jour : ${e.feu.nom.toLowerCase()}`}</b>
    <p class="xs muted" style="margin:4px 0 8px">${dec ? `Cette semaine, on allège : environ ${Math.round(c.retire * 100)} % de séries en moins, effort plafonné à RPE ${String(c.rpe).replace(".", ",")}.` : esc(e.conseil)}</p>
    <div class="chips wrap"><button class="chip on" data-a="fa-pick" data-v="1">Version allégée</button><button class="chip" data-a="fa-pick" data-v="0">Telle que prévue</button></div></div>`;
}
actions["fa-pick"] = (b, d) => { choix.on = d.v === "1"; b.parentElement.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b)); };
// Appliquée à la séance choisie, juste avant son démarrage
export function apresFeu(s) {
  if (!choix.on || !choix.mode || !premium()) return s;
  const r = R.adapterSeance(s, choix.mode); if (!r.resume) return s;
  choix = { mode: null, on: false };
  return r.seance;
}

// ---------- Rappel de coucher ----------
function rappel() {
  const h = new Date().getHours(); if (h < 17) return "";
  const dem = addDays(today(), 1), a = E.agenda(dem, dem)[dem], s = sem(), sv = W.sommeilVise(s);
  const demain = a && ["planned", "away"].includes(a.st) && a.time ? { time: a.time } : null;
  if (!demain) return "";
  const r = R.rappelCoucher({ demain, reglages: s.reglages, sommeilVise: sv, trajet: lieuDefaut() === "Maison" ? 0 : s.reglages.trajet });
  return `<div class="card mt12"><b class="small">😴 Ce soir</b><p class="small mt4" style="margin:0">${esc(r.texte)}</p></div>`;
}

const niveauCadence = () => ({ beginner: "debutant", comeback: "debutant", regular: "regulier", advanced: "avance" })[S().programme?.answers?.level || S().profile?.level] || "regulier";
// ---------- Prochaine décharge prévue par le programme ----------
function prochaineDecharge() {
  const pl = S().plan, p = pl && E.program(pl.programId); if (!p) return null;
  for (let w = pl.week; w <= E.weeksOf(p); w++) if (E.isDeload(p, w)) return w;
  return null;
}

// ---------- Bloc de l'onglet Récupération ----------
export function fatigueBlock(conseilsNutrition = []) {
  if (isCoach()) return "";
  if (!premium()) return `<div class="card locked mt8" style="position:relative;min-height:170px"><b class="small">⚡ Fatigue nerveuse</b><p class="xs muted mt4" style="margin:0">Feu du jour, charge de la semaine, séance allégée automatique, semaine de décharge.</p>${lockVeil("Bâtisseur", "Récupération et fatigue nerveuse.")}</div>`;
  const d = today(), ci = checkinDe(d), e = etatDuJour(d), dec = dechargeActuelle();
  const prop = R.dechargeConseillee(feuxRecents(), d, { actuelle: S().decharge, refusLe: S().dechargeRefus, fatigue: e.fatigue });
  const r = e.signaux.ratio, pc = (n) => String(n).replace(".", ","), pn = prochaineDecharge();
  return `<div class="card mt8 feu ${e.feu.id}"><div class="row" style="gap:12px;align-items:center"><span class="feupuce ${e.feu.id}" aria-hidden="true"></span><div class="grow"><div class="xs muted">Ton feu du jour</div><b class="h2">${esc(e.feu.nom)}</b></div><span class="tag">${e.disponibilite}/100</span></div>
      <p class="small mt8" style="margin:0"><b>${esc(e.conseil)}</b></p>
      ${e.raisons.map(t => `<p class="small muted" style="margin:6px 0 0">• ${esc(t)}</p>`).join("")}
      ${conseilsNutrition.map(t => `<p class="small muted" style="margin:6px 0 0">• ${esc(t)}</p>`).join("")}
      <button class="btn ${ci ? "btn-line" : "btn-red"} mt12" style="width:100%" data-a="fc-open">${ci ? "Modifier mon check-in" : "☀️ Faire mon check-in (10 secondes)"}</button>
      ${ci ? "" : `<p class="xs muted mt8" style="margin:8px 0 0">Sans check-in, je me base seulement sur tes séances : le feu est moins précis.</p>`}</div>
    ${dec ? `<div class="card mt12" style="box-shadow:0 0 0 1.5px var(--good) inset"><b>🛌 Semaine de décharge en cours</b><p class="small muted mt4" style="margin:0">Jusqu'au ${esc(fmtDate(dec.fin, { weekday: "long", day: "numeric", month: "long" }))}. Tes séances sont allégées pour que ton corps récupère : tu reviendras plus fort.</p><button class="btn btn-ghost btn-sm mt8" data-a="fc-decharge-stop">Arrêter la décharge</button></div>` : ""}
    ${prop.propose ? `<div class="card mt12 hl"><b>Une semaine de décharge ?</b><p class="small muted mt4" style="margin:0 0 8px">${esc(prop.raison)}. Une semaine plus légère (environ 40 % de séries en moins, effort plafonné à RPE ${String(R.ALLEGEMENT.decharge.rpe).replace(".", ",")}) aide à repartir. C'est toi qui décides.</p><div class="row" style="gap:8px"><button class="btn btn-red btn-sm grow" data-a="fc-decharge-oui">Oui, 7 jours</button><button class="btn btn-line btn-sm grow" data-a="fc-decharge-non">Pas maintenant</button></div></div>` : ""}
    <div class="card mt12"><div class="row between small"><b>Fatigue nerveuse</b><span class="tag ${e.fatigue.niveau === "faible" ? "g" : ""}">${esc(e.fatigue.niveau)}</span></div>
      <div class="mpbar"><i class="${e.fatigue.score >= 50 ? "st-bas" : e.fatigue.score >= 25 ? "st-moyen" : "st-bon"}" style="width:${Math.max(4, e.fatigue.score)}%"></i></div>
      <p class="xs muted" style="margin:0">${r.ratio != null ? `Charge des 7 derniers jours : ${pc(r.ratio)} × ta moyenne des semaines d'avant.` : "Pas encore assez de séances pour comparer ta semaine à ton habitude."}${e.signaux.lourdes ? ` ${e.signaux.lourdes} série${e.signaux.lourdes > 1 ? "s" : ""} lourde${e.signaux.lourdes > 1 ? "s" : ""} cette semaine.` : ""}</p>
      ${e.locale.length ? `<div class="row mt8" style="gap:6px;flex-wrap:wrap"><span class="xs muted">Très sollicités ces 3 jours :</span>${e.locale.map(l => `<span class="pat ${l.pattern}" title="${l.series} séries">${l.pattern}</span>`).join("")}</div>` : ""}
      <p class="xs muted mt8" style="margin:8px 0 0">${pn ? `Décharge prévue par ton programme : semaine ${pn}.` : `Pense à une semaine plus légère toutes les ${R.cadenceDecharge(niveauCadence())} semaines environ.`} Indicatif : ce n'est pas un avis médical.</p></div>
    ${rappel()}`;
}
actions["fc-decharge-oui"] = () => { update(st => { st.decharge = { debut: today(), fin: R.finDecharge(today()) }; st.dechargeRefus = null; }); buzz(); toast("Semaine de décharge lancée : tes séances seront allégées"); rerender(); };
actions["fc-decharge-non"] = () => { update(st => { st.dechargeRefus = today(); }); toast("D'accord, je te le reproposerai demain si besoin"); rerender(); };
actions["fc-decharge-stop"] = () => { update(st => { st.decharge = null; }); toast("Décharge arrêtée"); rerender(); };

// ---------- Carte de l'accueil ----------
export function feuCard() {
  if (!premium() || isCoach() || !S().profile) return "";
  const d = today(), dec = dechargeActuelle(), ci = checkinDe(d);
  const prop = R.dechargeConseillee(feuxRecents(), d, { actuelle: S().decharge, refusLe: S().dechargeRefus, fatigue: ci ? etatDuJour(d).fatigue : null });
  if (prop.propose) return `<button class="card tap mt12" data-a="go" data-r="recup" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">🛌</span><span class="grow"><b>Une semaine de décharge ?</b><br><span class="small muted">${esc(prop.raison)}. Je te propose de lever le pied.</span></span>${I.chev}</button>`;
  if (dec) return `<button class="card tap mt12" data-a="go" data-r="recup" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">🛌</span><span class="grow"><b>Semaine de décharge</b><br><span class="small muted">Jusqu'au ${esc(fmtDate(dec.fin, { weekday: "long", day: "numeric" }))} : séances allégées.</span></span>${I.chev}</button>`;
  if (!ci) return `<button class="card tap mt12" data-a="fc-open" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">☀️</span><span class="grow"><b>Check-in du jour</b><br><span class="small muted">Dix secondes pour savoir si ta séance doit être complète ou allégée.</span></span>${I.chev}</button>`;
  const e = etatDuJour(d);
  return `<button class="card tap mt12" data-a="go" data-r="recup" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span class="feupuce ${e.feu.id}" aria-hidden="true"></span><span class="grow"><b>Feu ${esc(e.feu.nom.toLowerCase())}</b><br><span class="small muted">${esc(e.feu.id === "vert" ? "Séance comme prévue." : e.feu.id === "orange" ? "Une version allégée est conseillée." : "Repos actif ou séance courte.")}</span></span>${I.chev}</button>`;
}
