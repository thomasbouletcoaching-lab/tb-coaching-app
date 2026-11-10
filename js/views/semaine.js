// Écran « Ma semaine » (Premium) : le fixe, le variable, les séances comme des rendez-vous, « Je ne peux pas ».
// Il s'appuie sur l'agenda existant : le planificateur écrit dans S().schedule (semaine type), S().moves et S().slots (cette semaine).
// Les réglages et blocs restent sur le téléphone : ils ne partent pas chez le coach (vie privée), seules les séances prévues y vont déjà.
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as W from "../semaine.js";
import { $app, esc, toast, routes, actions, forms, changes, go, I, header, sheet, closeSheet, rerender, premium, lockVeil, isCoach, fmtDate, buzz, R } from "../core.js";
import { lignesDuMoteur, indiceDuMoteur } from "./indice-ui.js";

export const sem = () => W.normaliser(S().semaine);
const touche = (fn) => update(st => { const s = W.normaliser(st.semaine); fn(s); st.semaine = s; });
const now = () => { const d = new Date(); return { date: today(), min: d.getHours() * 60 + d.getMinutes() }; };
const T0 = 6 * 60, T1 = 23 * 60;
let cible = null; // lundi de la semaine affichée

export async function charger() { await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib(), X.loadExercices()]); }
export const lundiCourant = () => W.lundiDe(today());
export const lundiProchain = () => W.addJ(lundiCourant(), 7);
// Le dimanche, on regarde déjà la semaine suivante
const lundiParDefaut = () => W.dowOf(today()) === 6 ? lundiProchain() : lundiCourant();

// ---------- Séances du programme suivi, vues par le planificateur ----------
export const lieuDefaut = () => ["home", "bodyweight"].includes(S().profile?.place) ? "Maison" : "Salle";
function patternsDe(p, se, w) {
  try {
    const par = {};
    lignesDuMoteur(p, se, w).forEach(l => { const e = X.exercice(l.nom); if (e?.couche === "squelette" && e.pattern_principal) par[e.pattern_principal] = par[e.pattern_principal] || l.nerveux >= 3; });
    const l = Object.entries(par).map(([code, lourd]) => ({ code, lourd })); return l.length ? l : null;
  } catch { return null; }
}
function seanceDe(titre, p, week) {
  const se = p?.s.find(x => x[0] === titre);
  const dur = se ? (indiceDuMoteur(p, se, week)?.minutes || S().profile?.sessionMin || 60) : (S().profile?.sessionMin || 60);
  return { titre, dur: Math.max(20, Math.ceil(dur / 5) * 5), lieu: lieuDefaut(), patterns: se ? patternsDe(p, se, week) : null };
}
const programme = () => { const pl = S().plan, p = pl && E.program(pl.programId); return p ? { p, week: pl.week } : null; };
const seancesCycle = () => { const pg = programme(); return pg ? pg.p.s.map(se => seanceDe(se[0], pg.p, pg.week)) : []; };
// Patterns des séances déjà faites ces derniers jours (pour la récupération)
function dejaFaites(depuis) {
  return S().workouts.filter(w => w.end && w.end.slice(0, 10) >= depuis).map(w => {
    const par = {}; (w.exercises || []).filter(e => e.sets?.some(s => s.done)).forEach(e => { const x = X.exercice(e.name); if (x?.couche === "squelette" && x.pattern_principal) par[x.pattern_principal] = par[x.pattern_principal] || x.cout_nerveux >= 3; });
    const l = Object.entries(par).map(([code, lourd]) => ({ code, lourd }));
    return { date: today(new Date(w.end)), patterns: l.length ? l : null };
  });
}
function prevues(from, to) {
  const ag = E.agenda(from, to), pg = programme();
  return Object.entries(ag).filter(([, a]) => a.st === "planned").sort((a, b) => a[0].localeCompare(b[0])).map(([date, a]) => {
    const titres = String(a.title).split(" + "), se = titres.length === 1 ? seanceDe(titres[0], pg?.p, pg?.week) : { ...seanceDe(titres[0], pg?.p, pg?.week), titre: a.title, patterns: null, dur: Math.max(...titres.map(t => seanceDe(t, pg?.p, pg?.week).dur)) };
    return { date, ...se };
  });
}

// ---------- Écran ----------
routes.semaine = async () => {
  if (!premium()) return teaser();
  await charger();
  if (R.param === "revue" && !cible) cible = lundiProchain();
  if (!cible) cible = lundiParDefaut();
  const s = sem(), lundi = cible, jours = W.semaineDe(lundi), t = today();
  const sv = W.sommeilVise(s), sh = `${Math.floor(sv / 60)} h${sv % 60 ? " " + String(sv % 60).padStart(2, "0") : ""}`;
  const rdv = prevues(jours[0] > t ? jours[0] : t, jours[6]);
  const vars = s.variable.filter(b => b.date >= jours[0] && b.date <= jours[6]).sort((a, b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));
  const pg = programme();
  $app.innerHTML = header("Ma semaine", "Tes séances, calées dans ta vie", { back: "profile", offers: false }) + `<main class="page" style="padding-bottom:40px">
    <div class="chips mt8"><button class="chip ${lundi === lundiCourant() ? "on" : ""}" data-a="sm-sem" data-v="${lundiCourant()}">Cette semaine</button><button class="chip ${lundi === lundiProchain() ? "on" : ""}" data-a="sm-sem" data-v="${lundiProchain()}">La semaine prochaine</button></div>
    ${W.dowOf(t) === 6 && lundi === lundiProchain() && !s.revues?.[lundi] ? `<div class="card hl mt12"><b>Ta revue du dimanche</b><p class="small muted mt4" style="margin:0">Deux minutes : qu'est-ce qui change cette semaine ? Un déplacement, une réunion tardive, un enfant malade, une soirée… Ajoute-le, puis je replace tes séances.</p></div>` : ""}
    <h2 class="sec">🗓️ ${esc(fmtDate(jours[0], { day: "numeric", month: "long" }))} – ${esc(fmtDate(jours[6], { day: "numeric", month: "long" }))}</h2>
    ${grille(jours, s)}
    <div class="row mt8" style="gap:10px;flex-wrap:wrap">${[["seance", "Séance"], ["travail", "Travail"], ["famille", "Famille"], ["trajet", "Trajet"], ["autre", "Autre"]].map(([k, l]) => `<span class="xs muted"><i class="swkey sw-${k}"></i>${l}</span>`).join("")}</div>
    <h2 class="sec">🏋️ Mes rendez-vous <small>${rdv.length} séance${rdv.length > 1 ? "s" : ""}</small></h2>
    ${rdv.length ? rdv.map(r => rdvCard(r)).join("") : `<div class="card"><p class="small muted" style="margin:0">${pg ? "Aucune séance prévue sur cette période." : "Choisis d'abord un programme : tes séances apparaîtront ici comme des rendez-vous."}</p></div>`}
    ${pg ? `<div class="stack mt12"><button class="btn btn-red" data-a="sm-replacer">📍 ${lundi === lundiCourant() ? "Replacer mes séances cette semaine" : "Caler mes séances sur cette semaine"}</button><button class="btn btn-line" data-a="ics-export">⬇️ Les ajouter à mon calendrier</button></div><p class="xs muted mt8">Dans ton calendrier, un rappel te prévient 30 minutes avant chaque séance.</p>` : ""}
    <h2 class="sec">⚡ Ce qui change cette semaine</h2>
    ${vars.length ? `<div class="card" style="padding:4px 14px">${vars.map(b => `<div class="li" style="padding:10px 0;gap:8px"><span>${W.TYPE_ICONE[b.type]}</span><span class="grow small"><b>${esc(b.label || W.TYPES.find(x => x[0] === b.type)?.[1])}</b><br><span class="xs muted">${esc(fmtDate(b.date, { weekday: "long", day: "numeric" }))} · ${b.debut}–${b.fin}</span></span><button class="icon-btn sm" data-a="sm-var-del" data-id="${b.id}" aria-label="Retirer">${I.close}</button></div>`).join("")}</div>` : `<p class="small muted">Rien de particulier pour l'instant.</p>`}
    <button class="btn btn-line btn-sm mt8" style="width:100%" data-a="sm-imprevu">+ Un imprévu cette semaine</button>
    <h2 class="sec">📌 Ce qui revient chaque semaine</h2>
    ${s.fixe.length ? `<div class="card" style="padding:4px 14px">${s.fixe.map(b => `<button class="li" data-a="sm-bloc" data-id="${b.id}" style="padding:10px 0;gap:8px;width:100%"><span>${W.TYPE_ICONE[b.type]}</span><span class="grow small" style="text-align:left"><b>${esc(b.label || W.TYPES.find(x => x[0] === b.type)?.[1])}</b><br><span class="xs muted">${b.jours.map(j => E.DAY_SHORT[j]).join(" ")} · ${b.debut}–${b.fin}</span></span>${I.chev}</button>`).join("")}</div>` : `<p class="small muted">Travail, enfants, trajets, repas, autre sport… Ajoute ce qui revient chaque semaine : je chercherai les créneaux libres autour.</p>`}
    <button class="btn btn-line btn-sm mt8" style="width:100%" data-a="sm-bloc" data-id="">+ Ajouter à ma semaine type</button>
    ${pg ? `<button class="btn btn-line btn-sm mt8" style="width:100%" data-a="sm-type">📍 Proposer mes jours et heures d'entraînement</button>` : ""}
    <h2 class="sec">😴 Sommeil et trajet</h2>
    <button class="card tap" data-a="sm-reglages" style="display:block;width:100%;text-align:left"><b>Lever ${esc(s.reglages.lever)} · coucher ${esc(s.reglages.coucher)}</b><br><span class="small muted">${sh} de sommeil visées · trajet ${s.reglages.trajet} min · séances plutôt ${esc(W.PREFERENCES.find(p => p[0] === s.reglages.pref)?.[1].toLowerCase() || "le soir")}</span></button>
    <div class="card mt12"><p class="xs muted" style="margin:0">Une séance décalée n'est pas un échec : ta régularité compte les séances faites dans la semaine, pas les jours exacts. Ces informations restent sur ton téléphone.</p></div>
  </main>`;
};
function teaser() {
  $app.innerHTML = header("Ma semaine", "", { back: "profile", offers: false }) + `<main class="page"><div class="card locked" style="position:relative;min-height:320px"><h2 class="h2">Tes séances calées dans ta vraie semaine</h2>
    <p class="small muted mt8">Ajoute ce qui revient chaque semaine et ce qui change, et je place tes séances dans les créneaux libres : récupération respectée, sommeil protégé, un créneau de rechange. Un imprévu ? « Je ne peux pas » te propose tout de suite les prochains créneaux.</p>${lockVeil("Bâtisseur", "Agenda « Ma semaine type », placement des séances et replanification.")}</div>
    <p class="small muted mt12">Tu peux déjà choisir tes jours et heures dans l'agenda : Accueil › Agenda › Ma semaine type.</p></main>`;
}
const rdvCard = (r) => { const sl = E.slotOf(r.date); return `<div class="card mt8"><div class="row between" style="gap:8px"><div><b class="h3">${esc(r.titre)}</b><div class="xs muted">${esc(fmtDate(r.date, { weekday: "long", day: "numeric", month: "long" }))}</div></div><span class="tag r">${esc(sl.time || "—")}</span></div>
  <p class="small muted mt4" style="margin:0">${sl.dur ? sl.dur + " min" : ""}${sl.place ? " · " + esc(sl.place) : ""}</p><button class="btn btn-ghost btn-sm mt8" data-a="jnp" data-v="${r.date}">🙅 Je ne peux pas</button></div>`; };

// Grille : 7 lignes, de 6 h à 23 h ; blocs du fixe et du variable, séances prévues
function grille(jours, s) {
  const ag = E.agenda(jours[0], jours[6]), f = W.fenetre(s), pc = (m) => Math.max(0, Math.min(100, (m - T0) / (T1 - T0) * 100)).toFixed(1);
  const seg = (a, b, cls, label) => b > a ? `<i class="swseg sw-${cls}" style="left:${pc(a)}%;width:${(pc(b) - pc(a)).toFixed(1)}%" title="${esc(label)}"></i>` : "";
  return `<div class="swgrid" role="table" aria-label="Ma semaine">${jours.map((d, i) => {
    const blocs = W.blocsDuJour(s, d, S().busy || []), a = ag[d], est = a && ["planned", "done"].includes(a.st);
    const sl = est ? E.slotOf(d) : null, deb = sl?.time ? W.min(sl.time) : null;
    const txt = [`${E.DAY_NAMES[i]} ${d.slice(8)}`, ...blocs.map(b => `${b.label || b.type} ${W.hhmm(b.debut)}-${W.hhmm(b.fin)}`), est ? `séance ${a.title}${sl.time ? " à " + sl.time : ""}` : ""].filter(Boolean).join(", ");
    return `<div class="swrow ${d === today() ? "today" : ""}" role="row" aria-label="${esc(txt)}"><span class="swday"><b>${E.DAY_SHORT[i]}</b><span class="xs muted">${d.slice(8)}</span></span><div class="swtrack">${seg(T0, f.a, "nuit", "Sommeil")}${seg(f.b, T1, "nuit", "Sommeil")}${blocs.map(b => seg(b.debut, b.fin, b.type in W.TYPE_ICONE ? b.type : "autre", b.label || b.type)).join("")}${est && deb != null ? seg(deb, deb + (+sl.dur || 60), a.st === "done" ? "fait" : "seance", a.title) : est ? `<span class="swdot" title="${esc(a.title)}"></span>` : ""}</div></div>`;
  }).join("")}<div class="swaxis"><span></span><div>${[6, 9, 12, 15, 18, 21].map(h => `<span style="left:${pc(h * 60)}%">${h} h</span>`).join("")}</div></div></div>`;
}
actions["sm-sem"] = (b, d) => { cible = d.v; rerender(); };

// ---------- Réglages ----------
actions["sm-reglages"] = () => { const r = sem().reglages;
  sheet(`<h2 class="h2">😴 Sommeil et trajet</h2><p class="small muted mt4">Je ne propose jamais de séance dans l'heure qui précède ton coucher.</p><form data-f="sm-reglages" class="mt12">
    <div class="grid2"><label class="field"><span>Lever</span><input type="time" name="lever" value="${esc(r.lever)}" required></label><label class="field"><span>Coucher</span><input type="time" name="coucher" value="${esc(r.coucher)}" required></label></div>
    <div class="grid2 mt8"><label class="field"><span>Trajet jusqu'à la salle (min, aller)</span><input name="trajet" inputmode="numeric" value="${r.trajet}"></label>
    <label class="field"><span>Je m'entraîne plutôt</span><select name="pref">${W.PREFERENCES.map(([k, l]) => `<option value="${k}" ${r.pref === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <button class="btn btn-red mt12" style="width:100%">Enregistrer</button></form>`);
};
forms["sm-reglages"] = (v) => {
  const tr = Math.round(+v.trajet); if (!(tr >= 0 && tr <= 120)) return toast("Trajet : entre 0 et 120 minutes.");
  touche(s => { s.reglages = { lever: v.lever, coucher: v.coucher, trajet: tr, pref: v.pref }; });
  closeSheet(); toast("Enregistré"); rerender();
};

// ---------- Le fixe ----------
actions["sm-bloc"] = (b, d) => {
  const x = sem().fixe.find(y => y.id === d.id) || { type: "travail", label: "", jours: [0, 1, 2, 3, 4], debut: "09:00", fin: "18:00" };
  sheet(`<h2 class="h2">${d.id ? "Modifier" : "Ajouter à ma semaine type"}</h2><form data-f="sm-bloc" data-id="${esc(d.id || "")}" class="mt12">
    <label class="field"><span>Type</span><select name="type">${W.TYPES.map(([k, l]) => `<option value="${k}" ${x.type === k ? "selected" : ""}>${W.TYPE_ICONE[k]} ${l}</option>`).join("")}</select></label>
    <label class="field mt8"><span>Précision (facultatif)</span><input name="label" maxlength="40" value="${esc(x.label || "")}" placeholder="Bureau, école des enfants…"></label>
    <div class="mt8"><span class="xs muted">Jours</span><div class="chips wrap">${E.DAY_NAMES.map((n, i) => `<label class="chip sm pick"><input type="checkbox" name="j" value="${i}" ${x.jours.includes(i) ? "checked" : ""}><span>${n.slice(0, 3)}.</span></label>`).join("")}</div></div>
    <div class="grid2 mt8"><label class="field"><span>De</span><input type="time" name="debut" value="${esc(x.debut)}" required></label><label class="field"><span>À</span><input type="time" name="fin" value="${esc(x.fin)}" required></label></div>
    <button class="btn btn-red mt12" style="width:100%">Enregistrer</button>${d.id ? `<button type="button" class="btn btn-ghost mt8" style="width:100%;color:var(--red)" data-a="sm-bloc-del" data-id="${esc(d.id)}">Supprimer</button>` : ""}</form>`);
};
forms["sm-bloc"] = (v, f) => {
  const r = W.validerBloc({ id: f.dataset.id || undefined, type: v.type, label: v.label, jours: new FormData(f).getAll("j"), debut: v.debut, fin: v.fin });
  if (!r.ok) return toast(r.msg);
  touche(s => { const i = s.fixe.findIndex(b => b.id === r.bloc.id); if (i >= 0) s.fixe[i] = r.bloc; else s.fixe.push(r.bloc); });
  closeSheet(); buzz(); toast("Ajouté à ta semaine type"); rerender();
};
actions["sm-bloc-del"] = (b, d) => { touche(s => { s.fixe = s.fixe.filter(x => x.id !== d.id); }); closeSheet(); toast("Retiré"); rerender(); };

// ---------- Le variable : ce qui change cette semaine ----------
actions["sm-imprevu"] = () => {
  const jours = W.semaineDe(cible || lundiParDefaut()), t = today();
  sheet(`<h2 class="h2">Qu'est-ce qui change ?</h2><p class="small muted mt4">Touche ce qui s'applique, je règle l'heure ; tu peux la modifier.</p>
    <div class="chips wrap mt8">${W.IMPREVUS.map(([k, l, ty, a, b]) => `<button class="chip sm" type="button" data-a="sm-imp-pick" data-t="${ty}" data-l="${esc(l)}" data-d="${a}" data-f="${b}">${esc(l)}</button>`).join("")}</div>
    <form data-f="sm-imprevu" class="mt12"><input type="hidden" name="type" value="autre"><label class="field"><span>Quoi</span><input name="label" maxlength="40" placeholder="Réunion tardive"></label>
    <label class="field mt8"><span>Quel jour</span><select name="date">${jours.map(d => `<option value="${d}" ${d === (jours.find(x => x >= t) || jours[0]) ? "selected" : ""}>${esc(fmtDate(d, { weekday: "long", day: "numeric" }))}</option>`).join("")}</select></label>
    <div class="grid2 mt8"><label class="field"><span>De</span><input type="time" name="debut" value="17:00" required></label><label class="field"><span>À</span><input type="time" name="fin" value="20:00" required></label></div>
    <button class="btn btn-red mt12" style="width:100%">Ajouter</button></form>`);
};
actions["sm-imp-pick"] = (b, d) => { const f = document.querySelector('form[data-f="sm-imprevu"]'); if (!f) return; f.type.value = d.t; f.label.value = d.l; f.debut.value = d.d; f.fin.value = d.f; document.querySelectorAll('[data-a="sm-imp-pick"]').forEach(x => x.classList.toggle("on", x === b)); };
forms["sm-imprevu"] = (v) => {
  const r = W.validerBloc({ type: v.type, label: v.label, date: v.date, debut: v.debut, fin: v.fin }); if (!r.ok) return toast(r.msg);
  touche(s => { s.variable.push(r.bloc); s.variable = s.variable.filter(b => b.date >= W.addJ(today(), -14)); });
  closeSheet(); buzz(); toast("Noté pour cette semaine"); rerender();
};
actions["sm-var-del"] = (b, d) => { touche(s => { s.variable = s.variable.filter(x => x.id !== d.id); }); rerender(); };

// ---------- Placer les séances ----------
// Sans date de semaine : semaine type (le fixe seulement). Pour cette semaine ou la suivante : le fixe, le variable et le calendrier importé.
actions["sm-replacer"] = async () => {
  await charger();
  const pg = programme(); if (!pg) return toast("Choisis d'abord un programme.");
  const lundi = cible || lundiParDefaut(), jours = W.semaineDe(lundi), t = today(), n = now();
  const dates = jours.filter(d => d >= t), liste = prevues(dates[0] || t, jours[6]);
  if (!liste.length) return toast("Aucune séance prévue à replacer sur cette période.");
  const courant = Object.fromEntries(liste.map((r, i) => [i, r.date]));
  const plan = W.planifier(sem(), lundi, liste, { busy: S().busy || [], dates, now: n, courant, fixes: dejaFaites(W.addJ(dates[0] || t, -3)) });
  apercu(plan, liste, { lundi, semaineType: false });
};
// Semaine type pour k séances par semaine (montée progressive : le palier en cours), à partir du fixe seulement
export function planType(k = null) {
  let seances = seancesCycle(); if (!seances.length) return null;
  if (k && k < seances.length) seances = seances.slice(0, k);
  const lundi = lundiCourant(), sc = E.schedule(), actifs = sc ? sc.days.map((d, i) => d.on ? i : -1).filter(i => i >= 0) : [];
  const courant = Object.fromEntries(seances.map((_, i) => [i, actifs[i] != null ? W.addJ(lundi, actifs[i]) : null]).filter(([, d]) => d));
  return { plan: W.planifier({ ...sem(), variable: [] }, lundi, seances, { cyclique: true, courant }), seances, lundi };
}
export async function appliquerSemaineType(k) {
  await charger(); const r = planType(k); if (!r) return null;
  if (r.plan.affectations.length) update(st => { st.schedule = W.versSchedule(r.plan, st.schedule); });
  return r.plan;
}
actions["sm-type"] = async () => {
  await charger();
  const r = planType(S().montee?.palier || null); if (!r) return toast("Choisis d'abord un programme.");
  apercu(r.plan, r.seances, { lundi: r.lundi, semaineType: true });
};
function apercu(plan, seances, { lundi, semaineType }) {
  const c = W.controles(plan, sem(), seances);
  sheet(`<h2 class="h2">${semaineType ? "Ma semaine type proposée" : "Mes séances replacées"}</h2><p class="small muted mt4">${semaineType ? "Elle revient chaque semaine. Tu pourras toujours décaler une séance." : "Seule cette période change. Une séance décalée n'est pas un échec."}</p>
    <div class="card mt12" style="padding:4px 14px">${plan.affectations.map(a => `<div class="li" style="padding:10px 0;gap:8px"><span>🏋️</span><span class="grow small"><b>${esc(a.titre)}</b><br><span class="xs muted">${esc(semaineType ? E.DAY_NAMES[a.dow] : fmtDate(a.date, { weekday: "long", day: "numeric" }))} · ${W.hhmm(a.debut)}–${W.hhmm(a.fin)} · ${esc(a.lieu)}</span></span></div>`).join("") || `<p class="small muted" style="padding:10px 0;margin:0">Aucun créneau libre trouvé.</p>`}</div>
    <div class="card mt8" style="padding:4px 14px">${c.map(x => `<div class="li" style="padding:10px 0;gap:10px"><span>${x.niveau === "ok" ? "✅" : x.niveau === "alerte" ? "⚠️" : "ℹ️"}</span><span class="grow small">${esc(x.texte)}</span></div>`).join("")}</div>
    ${plan.affectations.length ? `<button class="btn btn-red mt12" style="width:100%" data-a="sm-valider" data-m="${semaineType ? "type" : "semaine"}">${semaineType ? "Adopter cette semaine type" : "Valider ces créneaux"}</button>` : ""}
    <button class="btn btn-ghost mt8" style="width:100%" data-a="sm-modifier">Je préfère régler moi-même</button>`, (w) => { w._plan = plan; w._seances = seances; });
}
actions["sm-modifier"] = () => { closeSheet(); go("home", "month"); toast("Touche une séance pour la décaler à la main"); };
actions["sm-valider"] = (b, d) => {
  const w = document.getElementById("sheet"), plan = w?._plan; if (!plan) return;
  if (d.m === "type") update(st => { st.schedule = W.versSchedule(plan, st.schedule); });
  else {
    const t = today();
    plan.affectations.forEach(a => {
      const orig = w._seances[a.i].date;
      if (orig && orig !== a.date) E.moveSession(orig, a.date, W.hhmm(a.debut));
      E.setSlot(a.date, { time: W.hhmm(a.debut), dur: a.fin - a.debut, place: a.lieu });
    });
    touche(s => { s.revues = { ...(s.revues || {}), [W.lundiDe(plan.affectations[0].date)]: t }; });
  }
  closeSheet(); buzz(); toast(d.m === "type" ? "Semaine type enregistrée" : "Séances replacées"); rerender();
};

// ---------- Je ne peux pas ----------
actions.jnp = async (b, d) => {
  if (!premium()) return sheet(`<h2 class="h2">🙅 Je ne peux pas</h2><div class="card locked" style="position:relative;min-height:220px"><p class="small muted">Un imprévu ? Je te propose tout de suite les prochains créneaux libres, en respectant ta récupération. Sinon une version courte, ou la fusion avec ta prochaine séance.</p>${lockVeil("Bâtisseur", "Replanification en un geste.")}</div><p class="small muted mt12">Tu peux toujours décaler la séance à la main depuis l'agenda.</p>`);
  await charger();
  const k = d.v, a = E.agenda(k, k)[k], pg = programme(); if (!a || !["planned", "missed"].includes(a.st)) return;
  const titres = String(a.title).split(" + "), base = seanceDe(titres[0], pg?.p, pg?.week), t = today();
  const seance = titres.length > 1 ? { ...base, titre: a.title, patterns: null, dur: Math.max(...titres.map(x => seanceDe(x, pg?.p, pg?.week).dur)) } : base;
  const autres = prevues(t, W.addJ(t, 14)).filter(x => x.date !== k).map(x => ({ date: x.date, patterns: x.patterns, titre: x.titre }));
  const r = W.jeNePeuxPas(sem(), k, seance, { aujourdhui: t, now: now(), autres, faites: dejaFaites(W.addJ(t, -3)), busy: S().busy || [] });
  const quand = (x) => `${esc(fmtDate(x.date, { weekday: "long", day: "numeric" }))} · ${W.hhmm(x.debut)}–${W.hhmm(x.fin)}`;
  sheet(`<h2 class="h2">🙅 Je ne peux pas</h2><p class="small muted mt4">${esc(a.title)} · ${esc(fmtDate(k, { weekday: "long", day: "numeric" }))}. Pas de souci : une séance décalée n'est pas un échec.</p>
    ${r.propositions.length ? `<h3 class="sec" style="font-size:17px">Les prochains créneaux possibles</h3><div class="list">${r.propositions.map(p => `<button class="li" data-a="jnp-go" data-f="${k}" data-t="${p.date}" data-h="${W.hhmm(p.debut)}" data-u="${p.fin - p.debut}" style="gap:10px"><span class="grow small"><b>${quand(p)}</b><br><span class="xs muted">${esc(p.raison)}</span></span>${I.chev}</button>`).join("")}</div>`
      : `<div class="card mt12"><p class="small" style="margin:0">Aucun créneau libre ne tient avec ta récupération et ton emploi du temps cette semaine.</p></div>
        ${r.courte ? `<button class="btn btn-red mt12" style="width:100%" data-a="jnp-go" data-f="${k}" data-t="${r.courte.date}" data-h="${W.hhmm(r.courte.debut)}" data-u="20">⚡ Version de 20 minutes · ${quand(r.courte)}</button><p class="xs muted mt4">Au moment de commencer, touche « Séance express » : tu gardes les mouvements de base.</p>` : ""}
        ${r.fusion ? `<button class="btn btn-line mt8" style="width:100%" data-a="jnp-fusion" data-f="${k}" data-t="${r.fusion.date}">🔗 Fusionner avec « ${esc(r.fusion.titre)} » le ${esc(fmtDate(r.fusion.date, { weekday: "long", day: "numeric" }))}</button><p class="xs muted mt4">Une seule séance prioritaire, mouvements en double regroupés.</p>` : ""}`}
    <button class="btn btn-ghost mt12" style="width:100%" data-a="ag-day" data-v="${k}">Choisir moi-même</button>`);
};
actions["jnp-go"] = (b, d) => {
  E.moveSession(d.f, d.t, d.h); E.setSlot(d.t, { time: d.h, ...(d.u ? { dur: +d.u } : {}) });
  closeSheet(); buzz(); toast(`Décalée au ${fmtDate(d.t, { weekday: "long", day: "numeric" })} à ${d.h} : pas un échec`); rerender();
};
actions["jnp-fusion"] = (b, d) => { E.moveSession(d.f, d.t); closeSheet(); buzz(); toast(`Fusionnée le ${fmtDate(d.t, { weekday: "long", day: "numeric" })}`); rerender(); };

// ---------- Carte de l'accueil : la revue du dimanche (Premium) ----------
export function revueCard() {
  if (!premium() || isCoach() || !S().profile || W.dowOf(today()) !== 6) return "";
  const lundi = lundiProchain(), s = sem();
  if (s.revues?.[lundi]) return "";
  return `<button class="card tap mt12" data-a="go" data-r="semaine" data-p="revue" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">🗓️</span><span class="grow"><b>Ta revue de la semaine</b><br><span class="small muted">Deux minutes : qu'est-ce qui change cette semaine ?</span></span>${I.chev}</button>`;
}
