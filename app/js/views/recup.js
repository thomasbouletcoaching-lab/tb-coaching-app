// Récupération : sommeil, ressenti (envies, satiété, bien-être), réserves de glycogène, conseil pour la séance,
// jeûne et habitudes qui favorisent la sensibilité à l'insuline. Tout est indicatif : ce n'est pas un avis médical.
import { S, update, today } from "../store.js";
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import * as EN from "../energy.js";
import { $app, esc, num, fr, toast, routes, actions, forms, changes, I, header, tabbar, barChart, addDays, rerender, fmtDate } from "../core.js";
import { fastBody } from "./food.js";

const D = (d) => S().daily[d] || {};
const FEEL = [["energy", "⚡ Énergie", "à plat", "en forme"], ["well", "🙂 Bien-être", "mal", "très bien"], ["stress", "😮‍💨 Stress", "calme", "très stressé"], ["crave", "🍫 Envies de craquer", "aucune", "très fortes"], ["sat", "🍽️ Satiété", "affamé", "rassasié"]];

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
  const lv = score >= 3 ? ["🟢", "prêt", "Tu peux suivre ta séance comme prévu."] : score >= 2 ? ["🟠", "à surveiller", "Séance oui, en gardant de la marge."] : ["🔴", "fatigué", "Séance courte ou repos actif aujourd'hui."];
  return { icon: lv[0], label: lv[1], short: s != null ? `${fr(s, 1)} h de sommeil · glycogène ${g.lvl}` : lv[2], text: lv[2], tips, g, score };
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

let rDay = null;
routes.recup = () => {
  const d = rDay || today(), x = D(d), r = readiness(d), g = r.g, f = x.feel || {};
  const days = Array.from({ length: 14 }, (_, i) => addDays(d, i - 13));
  const sl = days.map(k => ({ l: k.slice(8, 10), v: D(k).sleep || 0 }));
  const withSleep = sl.filter(z => z.v), avg = withSleep.length ? withSleep.reduce((a, z) => a + z.v, 0) / withSleep.length : null;
  const ih = insulinHabits(d), ihOk = ih.filter(h => h[1]).length;
  $app.innerHTML = header("Récupération", d === today() ? "Sommeil, énergie, jeûne" : fmtDate(d)) + `<main class="page">
    <div class="row between mt12"><button class="icon-btn" data-a="r-day" data-v="-1" aria-label="Jour précédent">${I.back}</button><b class="h3">${d === today() ? "Aujourd'hui" : fmtDate(d)}</b><button class="icon-btn" data-a="r-day" data-v="1" aria-label="Jour suivant" ${d >= today() ? "disabled" : ""} style="transform:rotate(180deg)">${I.back}</button></div>

    <div class="card mt8 ${r.score >= 3 ? "grad" : ""}"><div class="lbl" ${r.score >= 3 ? 'style="color:inherit;opacity:.85"' : ""}>🏋️ Pour ta séance du jour</div>
      <b class="h2 mt4" style="display:block">${r.icon} ${esc(r.text)}</b>
      ${r.tips.map(t => `<p class="small mt8" style="margin-bottom:0">• ${esc(t)}</p>`).join("")}</div>

    <h2 class="sec">😴 Sommeil</h2>
    <div class="card"><form data-f="sleep" class="grid2"><label class="field"><span>Heures dormies</span><input name="h" inputmode="decimal" value="${x.sleep != null ? String(x.sleep).replace(".", ",") : ""}" placeholder="ex. 7,5"></label>
      <label class="field"><span>Qualité</span><select name="q" class="inp">${["", "1 · très mauvaise", "2 · mauvaise", "3 · correcte", "4 · bonne", "5 · excellente"].map((l, i) => `<option value="${i || ""}" ${x.sleepQ === i ? "selected" : ""}>${l || "–"}</option>`).join("")}</select></label>
      <label class="field"><span>Coucher</span><input name="bed" type="time" value="${x.bed || ""}"></label><label class="field"><span>Lever</span><input name="wake" type="time" value="${x.wake || ""}"></label>
      <button class="btn btn-red btn-sm" style="grid-column:1/-1">Enregistrer ma nuit</button></form>
      <div class="mt12">${barChart(sl, { fmt: (v) => fr(v, 1) })}</div>
      <p class="xs muted" style="margin:4px 0 0">${avg ? `Moyenne sur 14 jours : <b>${fr(avg, 1)} h</b>. ` : ""}Repère : 7 à 9 h pour progresser. Les heures de coucher et lever calculent la durée si tu ne la notes pas.</p></div>

    <h2 class="sec">🧠 Ressenti</h2>
    <div class="card">${FEEL.map(([k, l, lo, hi]) => `<div class="slider-row"><span class="small" style="width:44%">${l}<br><span class="xs muted">${lo} → ${hi}</span></span><input type="range" min="1" max="10" value="${f[k] ?? 5}" data-c="feel" data-k="${k}" aria-label="${l}"><b>${f[k] ?? "–"}</b></div>`).join("")}
      <p class="xs muted" style="margin:6px 0 0">Envies et satiété suivies chaque jour : si les envies montent, on regarde ton sommeil, tes protéines et ton déficit avant d'accuser ta volonté.</p></div>

    <h2 class="sec">🔋 Réserves de glycogène <small>estimation</small></h2>
    <div class="card"><div class="row between"><b>${g.pct} % · réserves ${g.lvl}</b><span class="xs muted">${fr(g.carbs24)} g de glucides / ${fr(g.need)} g repère</span></div>
      <div class="gly mt8"><i style="width:${g.pct}%"></i></div>
      <p class="small mt8" style="margin-bottom:0">${!g.known ? "Note tes repas dans Nutrition : l'estimation apparaît dès le premier repas." : g.lvl === "pleines" ? "Assez de carburant pour une séance longue et lourde." : g.lvl === "correctes" ? "Suffisant pour une séance normale. Pour plus d'1 h, ajoute une collation glucidique avant." : "Peu de carburant : séance express (20 à 30 min) ou 30 à 60 g de glucides 1 à 2 h avant."}</p>
      <p class="xs muted" style="margin:6px 0 0">Calcul : glucides des dernières 24 h comparés à 3 g/kg, moins le jeûne au-delà de 12 h (${fr(g.sinceMeal, 1)} h depuis ton dernier repas) et la séance d'hier (${g.yLift} min). Repère indicatif.</p></div>

    <h2 class="sec">📈 Sensibilité à l'insuline <small>${ihOk}/6 aujourd'hui</small></h2>
    <div class="list">${ih.map(([n, ok, why], i) => `<div class="li">${i === 2 ? `<button class="switch ${ok ? "on" : ""}" data-a="walk-after" aria-label="Marche après repas"></button>` : `<span class="em">${ok ? "✅" : "⬜"}</span>`}<span class="grow small"><b>${esc(n)}</b><br><span class="xs muted">${esc(why)}</span></span></div>`).join("")}</div>
    <p class="xs muted mt8">Ces habitudes améliorent la sensibilité à l'insuline chez la plupart des gens. Pour un diagnostic (glycémie, HbA1c), parle-en à ton médecin.</p>

    <h2 class="sec">⏳ Jeûne</h2>
    ${fastBody()}
  </main>${tabbar("recup")}`;
};
actions["r-day"] = (b, d) => { const n = addDays(rDay || today(), +d.v); rDay = n >= today() ? null : n; rerender(); };
forms.sleep = (v) => {
  let h = num(v.h);
  if (!(h > 0) && v.bed && v.wake) { const [a, b] = v.bed.split(":").map(Number), [c, e] = v.wake.split(":").map(Number); h = ((c * 60 + e) - (a * 60 + b) + 1440) % 1440 / 60; h = Math.round(h * 4) / 4; }
  if (!(h > 0 && h < 16)) return toast("Indique tes heures de sommeil, ou ton coucher et ton lever");
  const d = rDay || today();
  update(st => { const x = st.daily[d] = st.daily[d] || {}; x.sleep = h; x.sleepQ = +v.q || null; x.bed = v.bed || null; x.wake = v.wake || null; });
  toast("Nuit enregistrée"); rerender();
};
changes.feel = (el) => { const d = rDay || today(); update(st => { const x = st.daily[d] = st.daily[d] || {}; x.feel = { ...(x.feel || {}), [el.dataset.k]: +el.value }; }); el.nextElementSibling.textContent = el.value; };
actions["walk-after"] = () => { const d = rDay || today(); update(st => { const x = st.daily[d] = st.daily[d] || {}; x.walkAfter = !x.walkAfter; }); rerender(); };
