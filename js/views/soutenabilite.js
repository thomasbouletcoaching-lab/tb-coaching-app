// Écran « Est-ce que ça tient dans ta vie ? » (Premium) : score de soutenabilité, version tenable, montée progressive.
// Le calcul est dans js/soutenabilite.js (pur). Ici : ce qu'on sait de la personne (temps libre réel, activité récente) et l'affichage.
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as G from "../generateur.js";
import * as W from "../semaine.js";
import * as T from "../soutenabilite.js";
import { $app, esc, toast, routes, actions, go, I, header, premium, lockVeil, isCoach, buzz } from "../core.js";
import { sem, lieuDefaut, lundiProchain, appliquerSemaineType, charger } from "./semaine.js";

const ORDRE = [["temps", "⏱️", "Le temps"], ["charge", "🏋️", "La charge"], ["saut", "📈", "Le saut"], ["historique", "🔁", "L'historique"], ["ecart", "🎯", "Ce que tu tiens"]];

// ---------- Ce qu'on sait de la personne ----------
// Séances par semaine des dernières semaines complètes (la semaine en cours n'est pas finie), si on a assez de recul
function recent() {
  const ws = S().workouts.filter(w => w.end); if (!ws.length) return null;
  const premier = today(new Date(ws.reduce((m, w) => w.end < m ? w.end : m, ws[0].end))), lundi0 = W.lundiDe(premier);
  const sem6 = E.activeWeeks(6).slice(0, -1).filter(x => today(x.start) >= lundi0).map(x => x.count);
  return sem6.length >= 2 ? sem6.slice(-4) : null;
}
// Temps libre réel : si « Ma semaine » est remplie, les créneaux libres d'une semaine type ; sinon on estime (null)
function libre() {
  const s = sem(); if (!s.fixe.length) return null;
  const jours = W.semaineDe(lundiProchain()).map(d => W.creneauxLibres({ ...s, variable: [] }, d, []).reduce((t, [a, b]) => t + (b - a >= 30 ? b - a : 0), 0));
  return T.libreUtile(jours);
}
export function contexte(answers) {
  return { answers, libre: libre(), trajet: lieuDefaut() === "Maison" ? 0 : sem().reglages.trajet, actuel: recent() };
}
export function evaluerProposition(prop, prog) {
  const answers = { ...prog.answers, ...(prop.ajust || {}) };
  return T.evaluer(T.planDe(prop), contexte(answers));
}

// ---------- Carte dans « Ma proposition » ----------
export function carteSoutenabilite(prop, prog) {
  if (!premium()) return `<div class="card locked mt12" style="position:relative;min-height:150px"><b class="small">🧭 Est-ce que ça tient dans ta vie ?</b><p class="xs muted mt4" style="margin:0">Score de soutenabilité : ton temps libre, ta récupération, la marche à franchir, ton historique.</p>${lockVeil("Bâtisseur", "Le score de soutenabilité et la version tenable.")}</div>`;
  let ev; try { ev = evaluerProposition(prop, prog); } catch { return ""; }
  return `<button class="card tap mt12" data-a="go" data-r="soutenabilite" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span class="stpuce ${ev.niveau.id}" aria-hidden="true"></span><span class="grow"><b>Est-ce que ça tient dans ta vie ? ${esc(ev.niveau.nom)}</b><br><span class="small muted">${esc(ev.message)}</span></span>${I.chev}</button>`;
}

// ---------- Écran ----------
routes.soutenabilite = async () => {
  if (!premium()) {
    $app.innerHTML = header("Ça tient ?", "", { back: "monplan", offers: false }) + `<main class="page"><div class="card locked" style="position:relative;min-height:300px"><h2 class="h2">Est-ce que ça tient dans ta vie ?</h2><p class="small muted mt8">Un score qui compare ton plan à ton temps libre, ta récupération, ton activité d'aujourd'hui et ton historique, et te propose une version tenable si le plan vise trop haut.</p>${lockVeil("Bâtisseur", "Le score de soutenabilité.")}</div></main>`;
    return;
  }
  let mp = S().monplan; const prog = S().programme;
  // Ouvert avant « Ma proposition » : on génère la proposition de départ, sans cul-de-sac
  if (prog?.answers && !mp?.prop) { await X.loadExercices(); const prop = G.generer(prog, { seed: 0 }); update(st => { st.monplan = { at: new Date().toISOString(), progAt: prog.at, seed: 0, prop, adopte: null, ajust: null }; }); mp = S().monplan; }
  if (!mp?.prop || !prog?.answers) { $app.innerHTML = header("Ça tient ?", "", { back: "monplan", offers: false }) + `<main class="page"><div class="card"><h2 class="h2">Il me faut d'abord une proposition</h2><p class="small muted mt8">Réponds au questionnaire, puis regarde ton programme proposé.</p><button class="btn btn-red mt12" data-a="go" data-r="monprogramme">Commencer</button></div></main>`; return; }
  await Promise.all([charger(), X.loadExercices()]);
  const prop = mp.prop, answers = { ...prog.answers, ...(prop.ajust || {}) }, ctx = contexte(answers), ev = T.evaluer(T.planDe(prop), ctx);
  const base = { ...prog, answers: { ...prog.answers, ...(prop.ajust || {}) } };
  const v = ev.niveau.id !== "tenable" ? T.versionTenable(base, ctx, (pr) => G.generer(pr, { seed: prop.seed || 0 })) : null;
  const dep = T.depart(prop.n, answers, ctx.actuel), mo = S().montee;
  $app.innerHTML = header("Ça tient ?", "Ton plan face à ta vie", { back: "monplan", offers: false }) + `<main class="page" style="padding-bottom:40px">
    <div class="card stgauge ${ev.niveau.id}"><div class="row between" style="gap:10px"><span class="stpuce big ${ev.niveau.id}" aria-hidden="true"></span><div class="grow"><div class="xs muted">Soutenabilité</div><b class="h2">${esc(ev.niveau.nom)}</b></div><span class="tag">${ev.score}/100</span></div>
      <div class="stjauge mt12" role="img" aria-label="Soutenabilité ${ev.score} sur 100, ${esc(ev.niveau.nom)}"><i style="width:${ev.score}%"></i><b style="left:${T.SEUILS.ambitieux}%"></b><b style="left:${T.SEUILS.tenable}%"></b></div>
      <div class="stzones xs muted mt4"><span style="width:${T.SEUILS.ambitieux}%">Trop ambitieux</span><span style="width:${T.SEUILS.tenable - T.SEUILS.ambitieux}%">Ambitieux</span><span style="width:${100 - T.SEUILS.tenable}%">Tenable</span></div>
      <p class="small mt12" style="margin:0">${esc(ev.message)}</p>
      ${ev.confiance !== "bonne" ? `<p class="xs muted mt8" style="margin:8px 0 0">Score à affiner : ${ev.ingredients.temps.confiance === "estimé" ? "remplis « Ma semaine » (temps libre réel)" : ""}${ev.ingredients.temps.confiance === "estimé" && !ev.ingredients.historique.connu ? " et " : ""}${!ev.ingredients.historique.connu ? "réponds au questionnaire avancé (historique)" : ""}.</p>` : ""}</div>
    ${prop.ajust ? `<div class="card hl mt12"><b class="small">Tu regardes une version allégée de ton plan</b><p class="xs muted mt4" style="margin:0 0 8px">${prop.n} séances de ${prop.ajust.sessionMin} min au lieu de ${prog.answers.daysReal || prog.answers.daysWanted} de ${prog.answers.sessionMin}.</p><button class="btn btn-line btn-sm" data-a="st-retour">Revenir à mon plan de départ</button></div>` : ""}
    <h2 class="sec">Ce qui pèse</h2><div class="card" style="padding:4px 14px">${ORDRE.map(([k, em, nom]) => { const x = ev.ingredients[k]; return `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="row between small"><b>${em} ${nom}</b><span class="xs muted">${Math.round(x.score)}/100</span></div><div class="mpbar"><i class="st-${x.score >= 70 ? "bon" : x.score >= 45 ? "moyen" : "bas"}" style="width:${Math.round(x.score)}%"></i></div><p class="xs muted" style="margin:0">${esc(x.detail)}</p></div>`; }).join("")}</div>
    ${v ? `<h2 class="sec">Une version tenable</h2><div class="card"><b class="h3">${v.seances} séance${v.seances > 1 ? "s" : ""} de ${v.minutes} min</b> <span class="tag ${v.tenable ? "g" : ""}">${esc(v.evaluation.niveau.nom)} · ${v.evaluation.score}/100</span>
      <p class="small muted mt8" style="margin:0">${v.tenable ? `Au lieu de ${prop.n} séance${prop.n > 1 ? "s" : ""}. Les 8 patterns restent couverts : moins de séances et plus courtes, mais le même squelette.` : "C'est la version la plus légère que je peux proposer : si ça ne tient toujours pas, parle à Thomas de ton emploi du temps."}</p>
      <button class="btn btn-red mt12" data-a="st-version" data-k="${v.seances}" data-m="${v.minutes}">Voir cette version</button></div>` : ""}
    ${(dep < prop.n || mo) ? montee(prop, dep, mo) : ""}
    <div class="card mt12"><p class="xs muted" style="margin:0">Ce score aide à choisir un plan qu'on tient. Mieux vaut peu de séances tenues longtemps que beaucoup pendant trois semaines. Il ne juge pas ta motivation : il compare le plan à ta vie.</p></div></main>`;
};

function montee(prop, dep, mo) {
  const ps = T.paliers(mo?.cible || prop.n, mo?.palier || dep);
  if (mo) {
    const r = T.regulariteProuvee(semainesPrevues(mo));
    return `<h2 class="sec">Montée progressive</h2><div class="card"><b>Tu en es à ${mo.palier} séance${mo.palier > 1 ? "s" : ""} par semaine</b> <span class="small muted">· objectif ${mo.cible}</span>
      <p class="small muted mt8" style="margin:0">${r.ok ? "Tu as tenu 3 semaines d'affilée : tu peux ajouter une séance." : `Pour monter d'un cran : 3 semaines à 90 % des séances faites. En ce moment : ${esc(r.raison)}.`}</p>
      ${mo.palier < mo.cible ? `<button class="btn ${r.ok ? "btn-red" : "btn-line"} mt12" data-a="st-monter">Passer à ${mo.palier + 1} séances</button>` : ""}</div>`;
  }
  return `<h2 class="sec">Monter par étapes</h2><div class="card"><p class="small" style="margin:0">Plutôt que ${prop.n} séances dès la première semaine, démarre à <b>${dep}</b> et ajoute une séance quand la régularité est prouvée (3 semaines à 90 % des séances faites).</p>
    <div class="row mt8" style="gap:6px;flex-wrap:wrap">${ps.map(p => `<span class="tag ${p.seances === dep ? "r" : ""}">${p.seances} séance${p.seances > 1 ? "s" : ""}</span>`).join("")}</div>
    <button class="btn btn-red mt12" data-a="st-demarrer" data-k="${dep}">Démarrer à ${dep} séances</button></div>`;
}
// Semaines complètes depuis le début du palier en cours : { prevu, fait }
function semainesPrevues(mo) {
  return E.activeWeeks(10).slice(0, -1).filter(w => today(w.start) >= mo.depuis).map(w => ({ prevu: mo.palier, fait: w.count }));
}

// ---------- Actions ----------
actions["st-version"] = (b, d) => {
  update(st => { st.monplan = { ...(st.monplan || {}), ajust: { daysWanted: +d.k, daysReal: +d.k, sessionMin: +d.m } }; });
  buzz(); toast("Version tenable affichée : tu peux la remplacer, l'adopter, ou revenir à ton plan"); go("monplan");
};
actions["st-retour"] = () => { update(st => { st.monplan = { ...(st.monplan || {}), ajust: null }; }); toast("Retour à ton plan de départ"); go("monplan"); };
actions["st-demarrer"] = async (b, d) => {
  const prop = S().monplan?.prop; if (!prop) return;
  const k = +d.k; update(st => { st.montee = { cible: prop.n, palier: k, depuis: today() }; });
  const plan = await appliquerSemaineType(k);
  buzz(); toast(plan?.affectations.length ? `On démarre à ${k} séances par semaine : tes jours sont placés` : `On démarre à ${k} séances par semaine : choisis tes jours dans l'agenda`); go("semaine");
};
actions["st-monter"] = async () => {
  const mo = S().montee; if (!mo || mo.palier >= mo.cible) return;
  const k = mo.palier + 1; update(st => { st.montee = { ...mo, palier: k, depuis: today() }; });
  const plan = await appliquerSemaineType(k);
  buzz(); toast(`Une séance de plus : ${k} par semaine${plan?.affectations.length ? ", jours replacés" : ""}`); go("semaine");
};

// ---------- Carte de l'accueil : la régularité est prouvée, on peut monter ----------
export function monteeCard() {
  const mo = S().montee;
  if (!premium() || isCoach() || !mo || mo.palier >= mo.cible) return "";
  let r; try { r = T.regulariteProuvee(semainesPrevues(mo)); } catch { return ""; }
  if (!r.ok) return "";
  return `<button class="card tap mt12" data-a="go" data-r="soutenabilite" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">📈</span><span class="grow"><b>Tu as tenu 3 semaines d'affilée</b><br><span class="small muted">On ajoute une séance ? Tu passerais à ${mo.palier + 1} par semaine.</span></span>${I.chev}</button>`;
}
