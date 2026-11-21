// Récupération (onglet Entraînement) : fatigue nerveuse et ressenti, sommeil, apport alimentaire suffisant (calories, protéines,
// glycogène). Le jeûne et la sensibilité à l'insuline sont dans Nutrition. Tout est indicatif : ce n'est pas un avis médical.
import { S, update, today } from "../store.js";
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import * as EN from "../energy.js";
import { $app, esc, num, fr, toast, buzz, routes, R, actions, forms, changes, I, header, tabbar, barChart, addDays, rerender, fmtDate, seg, modeBar } from "../core.js";
import { TRAIN_MODES } from "./train.js";
import { fatigueBlock, etatDuJour } from "./fatigue.js";
import { premium } from "../core.js";

const D = (d) => S().daily[d] || {};
const FEEL = [["energy", "⚡ Énergie", "à plat", "en forme"], ["well", "🙂 Bien-être", "mal", "très bien"], ["stress", "😮‍💨 Stress", "calme", "très fort"], ["crave", "🍫 Envies de craquer", "aucune", "très fortes"], ["sat", "🍽️ Satiété", "grande faim", "plus faim du tout"], ["sore", "💪 Courbatures", "aucune", "très fortes"], ["motiv", "🔥 Motivation", "à plat", "à fond"]];

// Glycogène : estimation simple à partir des glucides des dernières 24 h, du jeûne et de la séance de la veille
export function glycogen(d = today()) {
  const kg = D(d).weight || S().profile?.weight || 75;
  const y = addDays(d, -1);
  const cToday = N.dayTotals(d).c || 0, cYest = N.dayTotals(y).c || 0;
  const hour = d === today() ? new Date().getHours() + new Date().getMinutes() / 60 : 24;
  const carbs24 = cToday + cYest * Math.max(0, (24 - hour) / 24);
  const need = 3 * kg; // repère : 3 g/kg/jour pour un pratiquant de musculation (3 à 5 g/kg selon le volume)
  const fs = EN.fastState();
  const last = N.lastMealTime(d);
  const sinceMeal = fs ? fs.hours : last && d === today() ? Math.max(0, hour - (+last.slice(0, 2) + +last.slice(3) / 60)) : hour < 10 ? 10 : 3;
  const yLift = S().workouts.filter(w => (w.end || "").slice(0, 10) === y).reduce((a, w) => a + Math.round((new Date(w.end) - new Date(w.start)) / 6e4), 0);
  let pct = Math.min(1.05, carbs24 / need) * 100;
  if (sinceMeal > 12) pct -= (sinceMeal - 12) * 3; // le glycogène du foie baisse après 12 h sans manger
  if (yLift > 60 && cYest < need * .8) pct -= 10;
  pct = Math.max(10, Math.min(100, Math.round(pct)));
  const known = N.dayLog(d).length > 0 || N.dayLog(y).length > 0;
  const lvl = !known ? "inconnues" : pct >= 80 ? "pleines" : pct >= 55 ? "correctes" : "basses";
  return { pct: known ? pct : 0, known, lvl, carbs24: Math.round(carbs24), need: Math.round(need), sinceMeal, yLift };
}

// Conseil du jour pour la séance : UN seul calcul dans toute l'app, celui de la forme du jour (js/recuperation.js).
// Le glycogène n'ajoute qu'un conseil pratique, jamais une baisse de note (décision C72).
export function readiness(d = today()) {
  const e = etatDuJour(d), s = D(d).sleep, g = glycogen(d);
  const tips = [...e.raisons.filter(t => !/Tout va bien|Rien d'inquiétant/.test(t))];
  if (g.lvl === "basses") tips.push(`Réserves de glycogène basses (≈ ${g.pct} %). Avant une séance de plus de 45 min : 30 à 60 g de glucides 1 à 2 h avant.`);
  else if (g.lvl === "correctes") tips.push("Réserves correctes : une collation avec glucides 1 h avant aide pour une séance longue.");
  if (s == null) tips.push("Note ta nuit pour un conseil plus précis.");
  const score = { vert: 3, orange: 2, rouge: 1 }[e.feu.id];
  return { icon: e.feu.icone, label: e.feu.nom.toLowerCase(), short: s != null ? `${fr(s, 1)} h de sommeil · glycogène ${g.lvl}` : e.conseil, text: e.conseil, tips, g, score, etat: e };
}

// Habitudes qui améliorent la sensibilité à l'insuline (repères de la littérature, pas un diagnostic)
function insulinHabits(d) {
  const x = D(d), t = N.dayTotals(d), p = S().profile, ag = E.agenda(d, d)[d];
  return [
    ["Séance de musculation ou sport", ag?.st === "done" || (x.cardio || []).length > 0, "Le muscle qui travaille capte le glucose sans avoir besoin d'insuline."],
    ["Au moins 7 000 pas", (x.steps || 0) >= 7000, "La marche quotidienne est l'un des leviers les plus efficaces."],
    ["10 min de marche après un repas", !!x.walkAfter, "Elle réduit nettement le pic de glycémie du repas."],
    ["7 h de sommeil ou plus", (x.sleep || 0) >= 7, "Une seule nuit courte suffit à baisser la sensibilité à l'insuline le lendemain."],
    ["25 g de fibres ou plus", (t.fib || 0) >= 25, "Les fibres ralentissent l'absorption des glucides."],
    ["Protéines à chaque repas", N.dayLog(d).length > 0 && (t.p || 0) >= (p?.weight || 75) * 1.4, "Elles limitent les envies et stabilisent la glycémie."],
  ];
}

let rDay = null, rTab = "fatigue";
// Échelle à 5 visages (comme le check-in) au lieu d'un curseur : un geste, pas de réglage fin inutile
const EMO = { energy: ["😴", "😕", "😐", "🙂", "💪"], well: ["😣", "😕", "😐", "🙂", "😄"], stress: ["😌", "🙂", "😐", "😟", "😰"], crave: ["✨", "🙂", "😐", "🤤", "🍫"], sat: ["😩", "😕", "😐", "🙂", "😌"], sore: ["✨", "🙂", "😐", "😣", "🥵"], motiv: ["😶", "😕", "😐", "🙂", "🔥"] };
const VAL5 = [2, 4, 6, 8, 10], near5 = (v) => v == null ? null : VAL5.reduce((b, x) => Math.abs(x - v) < Math.abs(b - v) ? x : b, VAL5[0]);
const feelRow = ([k, l, lo, hi], f) => `<div class="feelrow"><div class="small"><b>${l}</b> <span class="xs muted">${lo} → ${hi}</span></div><div class="emo5 mt4" role="radiogroup" aria-label="${esc(l)}">${(EMO[k] || EMO.energy).map((e, i) => `<button class="${near5(f[k]) === VAL5[i] ? "on" : ""}" data-a="feel-set" data-k="${k}" data-v="${VAL5[i]}" aria-label="${esc(l)} ${i + 1} sur 5" role="radio" aria-checked="${near5(f[k]) === VAL5[i]}">${e}</button>`).join("")}</div></div>`;

// Apport alimentaire suffisant pour récupérer : calories des 3 derniers jours, protéines, glucides
function apportBody(d) {
  const t = N.targets(), days = [0, 1, 2].map(i => addDays(d, -i)), noted = days.filter(k => N.dayLog(k).length);
  const kg = D(d).weight || S().profile?.weight || 75, tot = N.dayTotals(d), g = glycogen(d);
  const avgK = noted.length ? noted.reduce((a, k) => a + N.dayTotals(k).kcal, 0) / noted.length : null;
  const ratio = avgK != null && t?.maintenance ? avgK / t.maintenance : null;
  const pTarget = Math.round(kg * 1.6), pPct = Math.min(100, Math.round((tot.p || 0) / pTarget * 100));
  const verdict = ratio == null ? ["⚪", "Note tes repas dans Nutrition pour voir si tu manges assez pour récupérer."] : ratio < .7 ? ["🔴", "Apport trop bas pour bien récupérer : tes séances et ton sommeil vont en souffrir. Remonte vers ton objectif."] : ratio < .85 ? ["🟠", "Déficit marqué : garde des protéines hautes et mets tes glucides autour de l'entraînement."] : ["🟢", "Apport suffisant pour récupérer."];
  return `<div class="card mt12"><div class="lbl">🍽️ Manges-tu assez pour récupérer ?</div><b class="h3 mt4" style="display:block">${verdict[0]} ${esc(verdict[1])}</b>
      ${ratio != null ? `<p class="small muted mt8" style="margin-bottom:0">Moyenne sur ${noted.length} jour${noted.length > 1 ? "s" : ""} notés : <b>${fr(avgK)} kcal</b> pour un maintien estimé à ${fr(t.maintenance)} kcal (${Math.round(ratio * 100)} %).</p>` : ""}</div>
    <div class="card mt12"><div class="row between"><b>🥩 Protéines aujourd'hui</b><span class="small">${fr(tot.p || 0)} / ${pTarget} g</span></div><div class="gauge mt8"><i style="width:${pPct}%"></i></div><p class="xs muted" style="margin:6px 0 0">Repère pour récupérer : 1,6 g par kg de poids de corps et par jour, réparti sur 3 à 5 repas.</p></div>
    <h2 class="sec">🔋 Réserves de glycogène <small>estimation</small></h2>
    <div class="card"><div class="row between"><b>${g.pct} % · réserves ${g.lvl}</b><span class="xs muted">${fr(g.carbs24)} g de glucides / ${fr(g.need)} g repère</span></div>
      <div class="gly mt8"><i style="width:${g.pct}%"></i></div>
      <p class="small mt8" style="margin-bottom:0">${!g.known ? "Note tes repas dans Nutrition : l'estimation apparaît dès le premier repas." : g.lvl === "pleines" ? "Assez de carburant pour une séance longue et lourde." : g.lvl === "correctes" ? "Suffisant pour une séance normale. Pour plus d'1 h, ajoute une collation glucidique avant." : "Réserves basses : 30 à 60 g de glucides 1 à 2 h avant ta séance, ou une séance plus courte."}</p>
      <p class="xs muted" style="margin:6px 0 0">Calcul : glucides des dernières 24 h comparés à 3 g/kg, moins le jeûne au-delà de 12 h (${fr(g.sinceMeal, 1)} h depuis ton dernier repas) et la séance d'hier (${g.yLift} min). Repère indicatif.</p></div>
    <button class="btn btn-line btn-sm mt12" style="width:100%" data-a="go" data-r="food">Ouvrir mon journal alimentaire</button>`;
}
function sommeilBody(d) {
  const x = D(d), days = Array.from({ length: 14 }, (_, i) => addDays(d, i - 13));
  const sl = days.map(k => ({ l: k.slice(8, 10), v: D(k).sleep || 0 })), withSleep = sl.filter(z => z.v), avg = withSleep.length ? withSleep.reduce((a, z) => a + z.v, 0) / withSleep.length : null;
  return `<div class="card mt12"><form data-f="sleep" class="grid2"><label class="field"><span>Heures dormies</span><input name="h" inputmode="decimal" value="${x.sleep != null ? String(x.sleep).replace(".", ",") : ""}" placeholder="ex. 7,5"></label>
      <label class="field"><span>Qualité</span><select name="q" class="inp">${["", "1 · très mauvaise", "2 · mauvaise", "3 · correcte", "4 · bonne", "5 · excellente"].map((l, i) => `<option value="${i || ""}" ${x.sleepQ === i ? "selected" : ""}>${l || "–"}</option>`).join("")}</select></label>
      <label class="field"><span>Coucher</span><input name="bed" type="time" value="${x.bed || ""}"></label><label class="field"><span>Lever</span><input name="wake" type="time" value="${x.wake || ""}"></label>
      <button class="btn btn-red btn-sm" style="grid-column:1/-1">Enregistrer ma nuit</button></form></div>
    <div class="card mt12"><b class="small">14 dernières nuits</b><div class="mt8">${barChart(sl, { fmt: (v) => fr(v, 1) })}</div>
      <p class="xs muted" style="margin:4px 0 0">${avg ? `Moyenne : <b>${fr(avg, 1)} h</b>. ` : ""}Repère : 7 à 9 h pour progresser. Une seule nuit courte baisse la force et la récupération du lendemain ; deux d'affilée, on allège la séance.</p></div>`;
}
routes.recup = () => {
  if (["fatigue", "sommeil", "apport"].includes(R.param)) rTab = R.param;
  const d = rDay || today(), r = readiness(d), f = D(d).feel || {};
  const sub = `<div class="mt12">${seg([["fatigue", "⚡ Fatigue"], ["sommeil", "😴 Sommeil"], ["apport", "🍽️ Apport"]], rTab, "r-tab")}</div>`;
  let body;
  if (rTab === "sommeil") body = sommeilBody(d);
  else if (rTab === "apport") body = apportBody(d);
  else body = (d === today() && premium() ? fatigueBlock(r.tips) : `<div class="card mt8 ${r.score >= 3 ? "grad" : ""}"><div class="lbl" ${r.score >= 3 ? 'style="color:inherit;opacity:.85"' : ""}>🏋️ Pour ta séance ${d === today() ? "du jour" : "de ce jour-là"}</div><b class="h2 mt4" style="display:block">${r.icon} ${esc(r.text)}</b>${r.tips.map(t => `<p class="small mt8" style="margin-bottom:0">• ${esc(t)}</p>`).join("")}</div>${d === today() ? fatigueBlock(r.tips) : ""}`)
    + `<h2 class="sec">🧠 Ressenti du jour</h2><div class="card">${FEEL.map(row => feelRow(row, f)).join("")}<p class="xs muted" style="margin:8px 0 0">Si les envies montent, on regarde d'abord ton sommeil, tes protéines et ton déficit avant d'accuser ta volonté.</p></div>`;
  $app.innerHTML = header("Entraînement", "") + `<main class="page">${modeBar(TRAIN_MODES, "recup", "train-mode")}
    <div class="row between mt12"><button class="icon-btn" data-a="r-day" data-v="-1" aria-label="Jour précédent">${I.back}</button><b class="h3">${d === today() ? "Aujourd'hui" : fmtDate(d)}</b><button class="icon-btn" data-a="r-day" data-v="1" aria-label="Jour suivant" style="transform:scaleX(-1);${d >= today() ? "visibility:hidden" : ""}">${I.back}</button></div>
    ${sub}${body}
    <p class="xs muted mt12">Indicatif : ce n'est pas un avis médical.</p></main>${tabbar("carnet")}`;
};
actions["r-tab"] = (b, d) => { rTab = d.v; history.replaceState(null, "", "#/recup/" + d.v); rerender(false); window.scrollTo(0, 0); };
actions["feel-set"] = (b, d) => { const day = rDay || today(); update(st => { const x = st.daily[day] = st.daily[day] || {}; x.feel = { ...(x.feel || {}), [d.k]: +d.v }; }); buzz(8); rerender(); };
// Sensibilité à l'insuline : carte rangée dans Nutrition › Conseils
export function insulinCard(d = today()) {
  const ih = insulinHabits(d), ok = ih.filter(h => h[1]).length;
  return `<h2 class="sec">📈 Sensibilité à l'insuline <small>${ok}/6 aujourd'hui</small></h2>
    <div class="list">${ih.map(([n, ok2, why], i) => `<div class="li">${i === 2 ? `<button class="switch ${ok2 ? "on" : ""}" data-a="walk-after" data-d="${d}" aria-label="Marche après repas"></button>` : `<span class="em">${ok2 ? "✅" : "⬜"}</span>`}<span class="grow small"><b>${esc(n)}</b><br><span class="xs muted">${esc(why)}</span></span></div>`).join("")}</div>
    <p class="xs muted mt8">Ces habitudes améliorent la sensibilité à l'insuline chez la plupart des gens. Pour un diagnostic (glycémie, HbA1c), parle-en à ton médecin.</p>`;
}
actions["r-day"] = (b, d) => { const n = addDays(rDay || today(), +d.v); rDay = n >= today() ? null : n; rerender(); };
forms.sleep = (v) => {
  let h = num(v.h);
  if (!(h > 0) && v.bed && v.wake) { const [a, b] = v.bed.split(":").map(Number), [c, e] = v.wake.split(":").map(Number); h = ((c * 60 + e) - (a * 60 + b) + 1440) % 1440 / 60; h = Math.round(h * 4) / 4; }
  if (!(h > 0 && h < 16)) return toast("Indique tes heures de sommeil, ou ton coucher et ton lever");
  const d = rDay || today();
  update(st => { const x = st.daily[d] = st.daily[d] || {}; x.sleep = h; x.sleepQ = +v.q || null; x.bed = v.bed || null; x.wake = v.wake || null; });
  toast("Nuit enregistrée"); rerender();
};
actions["walk-after"] = (b, dd) => { const d = dd?.d || rDay || today(); update(st => { const x = st.daily[d] = st.daily[d] || {}; x.walkAfter = !x.walkAfter; }); rerender(); };
