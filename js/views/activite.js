// Cardio, sport et activités : saisis depuis l'onglet Entraînement (là où on les cherche),
// stockés dans daily[jour].cardio comme avant, donc toujours comptés dans la dépense (Nutrition › Dépense).
import { S, update, today } from "../store.js";
import * as EN from "../energy.js";
import { esc, num, fr, buzz, toast, actions, forms, changes, sheet, closeSheet, rerender, I, addDays } from "../core.js";

const listOf = (d) => S().daily?.[d]?.cardio || [];
const ligne = (c, i, d) => `<div class="row between small" style="padding:7px 0;border-bottom:1px solid var(--line);gap:8px"><span class="grow">${esc(c.n)} · ${c.min} min<br><span class="xs muted">${c.kcal ? `${fr(c.kcal)} kcal ${c.kt === "actives" ? "actives" : "affichées"} · ` : ""}≈ ${fr(EN.actKcal(c))} kcal comptées${EN.cardioSteps(c) ? ` · ${fr(EN.cardioSteps(c))} pas` : ""}</span></span><button class="icon-btn" data-a="act-del" data-i="${i}" data-d="${d}" aria-label="Retirer ${esc(c.n)}">${I.close}</button></div>`;

// Carte de l'onglet Entraînement : activités du jour et de la semaine, bouton d'ajout
export function activiteCard(d = today()) {
  const l = listOf(d), mon = addDays(today(), -((new Date().getDay() + 6) % 7));
  const wkMin = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).reduce((a, k) => a + listOf(k).reduce((x, c) => x + (c.min || 0), 0), 0);
  return `<div class="card mt12"><div class="row between" style="gap:8px"><div><div class="lbl">🏃 Cardio et activités</div><div class="xs muted mt4">${l.length ? `Aujourd'hui : ${l.reduce((a, c) => a + c.min, 0)} min · ≈ ${fr(l.reduce((a, c) => a + EN.actKcal(c), 0))} kcal` : "Course, vélo, marche, foot, natation…"}${wkMin ? ` · semaine ${Math.floor(wkMin / 60)} h ${String(wkMin % 60).padStart(2, "0")}` : ""}</div></div>
    <button class="btn btn-red btn-sm" style="width:auto;flex:none" data-a="act-add">+ Ajouter</button></div>
    ${l.length ? `<div class="mt8">${l.map((c, i) => ligne(c, i, d)).join("")}</div>` : ""}</div>`;
}

// Fenêtre d'ajout : activité, durée, intensité, jour
actions["act-add"] = (b, d) => {
  const day = d.d || today();
  const opts = ["Cardio", "Sport"].map(cat => `<optgroup label="${cat === "Cardio" ? "Cardio" : "Sports"}">${EN.CARDIO.map((c, i) => c[3] === cat ? `<option value="${i}">${esc(c[0])}</option>` : "").join("")}</optgroup>`).join("");
  const last = S().lastCardio;
  sheet(`<h2 class="h2">🏃 Ajouter une activité</h2><p class="xs muted">Elle compte dans ta dépense du jour (Nutrition › Dépense). Les pas de la marche ou de la course sont retirés de tes pas pour ne pas les compter deux fois.</p>
    ${last ? `<button class="btn btn-line btn-sm mt8" style="width:100%" data-a="act-again">↺ Comme la dernière fois : ${esc(last.n)} · ${last.min} min</button>` : ""}
    <form data-f="act-add" class="mt12"><label class="field"><span>Activité</span><select name="t" data-c="act-type">${opts}</select></label>
      <div class="grid2 mt8"><label class="field"><span>Durée (min)</span><input name="min" inputmode="numeric" required placeholder="30"></label><label class="field"><span>Intensité</span><select name="int"><option value="0.85">Facile</option><option value="1" selected>Normale</option><option value="1.15">Intense</option></select></label></div>
      <details id="act-tapis" class="card soft mt8" style="padding:10px 12px"><summary class="small"><b>🏃 Tapis : pente et vitesse</b> <span class="xs muted">(facultatif, plus précis)</span></summary>
        <div class="grid2 mt8"><label class="field"><span>Pente (%)</span><input name="incl" inputmode="decimal" placeholder="12"></label><label class="field"><span>Vitesse (km/h)</span><input name="kmh" inputmode="decimal" placeholder="5"></label></div></details>
      <details class="card soft mt8" style="padding:10px 12px"><summary class="small"><b>⌚ Calories du tapis ou de la montre</b> <span class="xs muted">(facultatif, remplace l'estimation)</span></summary>
        <div class="grid2 mt8"><label class="field"><span>Calories affichées</span><input name="kcal" inputmode="numeric" placeholder="ex. 320"></label><label class="field"><span>Ce chiffre est</span><select name="kt"><option value="total">Total (tapis, machine)</option><option value="actives">Actives (montre)</option></select></label></div>
        <p class="xs muted" style="margin:6px 0 0">Total : l'app retire ce que tu aurais brûlé au repos, déjà compté dans ta dépense de base. Actives : le chiffre est gardé tel quel.</p></details>
      <label class="field mt8"><span>Jour</span><input type="date" name="d" value="${day}" max="${today()}"></label>
      <button class="btn btn-red mt12">Ajouter</button></form>`);
};
function addAct(day, a) {
  update(st => { const x = st.daily[day] = st.daily[day] || {}; (x.cardio = x.cardio || []).push(a); st.lastCardio = a; });
  buzz(); closeSheet(); toast("Activité ajoutée"); rerender();
}
forms["act-add"] = (v) => {
  const c = EN.CARDIO[+v.t], min = Math.round(num(v.min)), k = +v.int || 1; if (!c) return;
  if (!(min > 0 && min < 600)) return toast("Durée invalide");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(v.d || "") && v.d <= today() ? v.d : today();
  const kmh = num(v.kmh || ""), incl = num(v.incl || ""), kcal = Math.round(num(v.kcal || ""));
  const tm = kmh > 0 && kmh < 30 ? EN.treadmillMet(kmh, incl > 0 && incl <= 40 ? incl : 0) : null;
  const a = { n: c[0] + (tm ? ` · ${incl > 0 ? fr(incl, 1) + " % · " : ""}${fr(kmh, 1)} km/h` : k > 1 ? " (intense)" : k < 1 ? " (facile)" : ""), met: tm || Math.round(c[1] * k * 10) / 10, spm: c[2], min };
  if (tm) { a.kmh = kmh; if (incl > 0) a.incl = incl; }
  if (kcal > 0 && kcal < 5000) { a.kcal = kcal; a.kt = v.kt === "actives" ? "actives" : "total"; }
  addAct(day, a);
};
// Marche inclinée, course, tapis : on ouvre directement « pente et vitesse »
changes["act-type"] = (el) => { const c = EN.CARDIO[+el.value], d = document.getElementById("act-tapis"); if (d && c) d.open = /tapis|inclin|course|fractionn|marche/i.test(c[0]); };
actions["act-again"] = () => { const a = S().lastCardio; if (a) addAct(today(), { ...a }); };
actions["act-del"] = (b, d) => { const day = d.d || today(); update(st => st.daily[day]?.cardio?.splice(+d.i, 1)); toast("Activité retirée"); rerender(); };
