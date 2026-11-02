// Plan alimentaire écrit par le coach : une semaine complète ou un seul jour, macros ajustables, déficit ou surplus par rapport à la maintenance du profil.
// Le coach règle, pour chaque jour : l'écart en % (− déficit, + surplus), ou directement les kcal. Protéines et lipides en g/kg, glucides = le reste.
import * as N from "../nutrition.js";
import { withState } from "../store.js";
import { sheet, closeSheet } from "../core.js";
import { $app, esc, toast, routes, actions, forms, changes, header, R, go, isCoach, cloud, buzz, fr, num } from "../core.js";

export const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
let FOOD = null;      // plan reçu du coach (côté membre)
let FD = null;        // brouillon côté coach : { memberId, memberName, maintenance, weight, pk, fk, days: [...] }

// Calcul d'une journée à partir de la maintenance du profil : kcal = maintenance × (1 + écart)
export function dayMacros(maintenance, weight, pk, fk, day) {
  const kcal = day.kcal != null && day.kcal !== "" ? Math.round(+day.kcal) : Math.round(maintenance * (1 + (+day.adj || 0) / 100) / 10) * 10;
  const p = Math.round(pk * weight), f = Math.round(fk * weight);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  return { kcal, p, c, f };
}
const emptyDay = (i) => ({ n: DAY_LABELS[i], on: false, adj: 0, kcal: null, note: "", meals: [] });
const sumK = (ml) => (ml.items || []).reduce((a, x) => a + (x.kcal || 0), 0);

// ---------- Côté membre : le plan du jour apparaît dans l'accueil ----------
export async function pullCoachFood(c) {
  const row = await c.coachFood();
  FOOD = row?.plan?.days ? row.plan : null;
}
// Ce que le coach a prévu pour aujourd'hui, ou null
export function coachFoodToday(d = new Date()) {
  if (!FOOD) return null;
  const i = (d.getDay() + 6) % 7, day = FOOD.days?.[i];
  return day?.on ? { ...day, label: DAY_LABELS[i] } : null;
}
export function coachFoodCard() {
  const t = coachFoodToday();
  if (!t) return "";
  return `<div class="card soft mt12"><div class="lbl">🍽️ Ton plan de Thomas · ${esc(t.label)}</div>
    <b class="h3">${fr(t.kcal)} kcal</b>
    <p class="small muted mt4" style="margin:0">${fr(t.p)} g de protéines · ${fr(t.c)} g de glucides · ${fr(t.f)} g de lipides</p>
    ${(t.meals || []).map(ml => `<div class="mt8"><b class="small">${esc(ml.name)}</b> <span class="xs muted">· ${fr(sumK(ml))} kcal</span><br><span class="xs muted">${(ml.items || []).map(it => `${esc(it.label)} ${fr(it.g)} g`).join(" · ")}</span></div>`).join("")}
    ${t.note ? `<p class="small mt8" style="margin:6px 0 0;white-space:pre-line">${esc(t.note)}</p>` : ""}</div>`;
}

// ---------- Côté coach : éditeur ----------
routes["member-food"] = async () => {
  if (!isCoach()) return go("home");
  const memberId = R.param;
  $app.innerHTML = header("Plan alimentaire", "", { back: "admin" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  try {
    const c = await cloud();
    const m = (window.__members || []).find(x => x.id === memberId);
    const md = await c.memberData(memberId).catch(() => null);
    const prof = md?.data?.profile;
    if (!prof) throw new Error("profil du client indisponible : il doit ouvrir l'app une fois à jour");
    const T = withState(md.data, () => N.targets());
    const weight = +prof.weight || 70;
    const saved = (await c.coachFoodGet(memberId).catch(() => null))?.plan || null;
    const pk = saved?.pk ?? +(T.prot / weight).toFixed(2);
    const fk = saved?.fk ?? +(T.fat / weight).toFixed(2);
    const days = Array.from({ length: 7 }, (_, i) => ({ ...emptyDay(i), ...(saved?.days?.[i] || {}), n: DAY_LABELS[i] }));
    FD = { memberId, memberName: m?.name || m?.email || "", maintenance: T.maintenance, weight, pk, fk, days, ref: { kcal: T.kcal, prot: T.prot, fat: T.fat, carbs: T.carbs, model: T.model?.name } };
    render();
  } catch (e) { $app.innerHTML = header("Plan alimentaire", "", { back: "admin" }) + `<main class="page"><p class="empty">Impossible : ${esc(e.message)}</p></main>`; }
};

// Lit le formulaire tel qu'il est, pour ne pas perdre une saisie quand on recalcule
function readForm() {
  const f = document.querySelector('form[data-f="food-save"]'); if (!f || !FD) return;
  const v = (n) => f.elements[n]?.value ?? "";
  FD.pk = num(v("pk")) || FD.pk; FD.fk = num(v("fk")) || FD.fk;
  FD.days = FD.days.map((d, i) => ({
    ...d, on: !!f.elements[`on${i}`]?.checked, adj: num(v(`adj${i}`)) || 0,
    kcal: v(`kcal${i}`).trim() === "" ? null : num(v(`kcal${i}`)), note: v(`note${i}`),
  }));
}
function render() {
  const rows = FD.days.map((d, i) => {
    const m = dayMacros(FD.maintenance, FD.weight, FD.pk, FD.fk, d);
    return `<div class="card mt8" style="padding:10px ${d.on ? "" : "; opacity:.6"}">
      <div class="row between"><label class="row" style="gap:8px"><input type="checkbox" name="on${i}" ${d.on ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--red)"><b>${esc(d.n)}</b></label>
        <button type="button" class="ghost sm" data-a="fp-copy" data-v="${i}">Copier sur tous les jours</button></div>
      <div class="grid2 mt4"><label class="field"><span>Écart vs maintenance (%)</span><input name="adj${i}" inputmode="decimal" value="${fr(d.adj, 1)}" placeholder="−15 ou +10"></label>
      <label class="field"><span>Kcal (vide = calcul)</span><input name="kcal${i}" inputmode="numeric" value="${d.kcal != null ? Math.round(d.kcal) : ""}" placeholder="${m.kcal}"></label></div>
      <p class="xs muted mt4" style="margin:0"><b>${fr(m.kcal)} kcal</b> · P ${fr(m.p)} g · G ${fr(m.c)} g · L ${fr(m.f)} g</p>
      ${(d.meals || []).map((ml, mi) => `<div class="mt8" style="border-top:1px solid var(--line,#2a3340);padding-top:6px"><div class="row between"><b class="small">${esc(ml.name)}</b><span class="xs muted">${fr(sumK(ml))} kcal</span></div>
        ${(ml.items || []).map((it, ii) => `<div class="row" style="gap:6px;align-items:center"><span class="grow xs">${esc(it.label)} · ${fr(it.g)} g · ${fr(it.kcal)} kcal</span><button type="button" class="icon-btn sm" data-a="cf-del" data-d="${i}" data-m="${mi}" data-i="${ii}" aria-label="Retirer">✕</button></div>`).join("")}
        <div class="row" style="gap:12px"><button type="button" class="link xs" data-a="cf-add" data-d="${i}" data-m="${mi}">+ Aliment</button><button type="button" class="link xs" data-a="cf-mdel" data-d="${i}" data-m="${mi}" style="color:var(--red)">Supprimer le repas</button></div></div>`).join("")}
      <div class="row mt8" style="gap:8px"><button type="button" class="ghost sm" data-a="cf-meal" data-d="${i}">+ Repas</button>${(d.meals || []).length ? `<button type="button" class="ghost sm" data-a="cf-mcopy" data-d="${i}">Copier les repas sur les autres jours</button>` : ""}</div>
      <label class="field mt4"><span>Consignes du jour (facultatif)</span><textarea name="note${i}" rows="2" maxlength="600" placeholder="Ex. Petit-déj : 80 g flocons + 200 g skyr. Déjeuner : 150 g riz, 180 g poulet…">${esc(d.note)}</textarea></label></div>`;
  }).join("");
  $app.innerHTML = header("Plan alimentaire", esc(FD.memberName), { back: "admin" }) + `<main class="page"><form data-f="food-save" data-c="fp">
    <div class="card soft"><div class="lbl">Base du profil</div><p class="small mt4" style="margin:4px 0 0">Maintenance estimée : <b>${fr(FD.maintenance)} kcal</b> · ${esc(FD.ref.model || "")}<br><span class="xs muted">Repère du moteur : ${fr(FD.ref.kcal)} kcal · P ${fr(FD.ref.prot)} g · G ${fr(FD.ref.carbs)} g · L ${fr(FD.ref.fat)} g</span></p>
      <div class="grid2 mt8"><label class="field"><span>Protéines (g/kg)</span><input name="pk" inputmode="decimal" value="${fr(FD.pk, 2)}"></label><label class="field"><span>Lipides (g/kg)</span><input name="fk" inputmode="decimal" value="${fr(FD.fk, 2)}"></label></div>
      <p class="xs muted mt4" style="margin:0">Les glucides sont le reste des kcal. Poids de référence : ${fr(FD.weight, 1)} kg.</p></div>
    <h2 class="sec">Semaine</h2>
    <p class="xs muted">Coche les jours à envoyer : tu peux ne faire qu'un seul jour, les autres restent sans consigne.</p>
    ${rows}
    <button class="btn btn-red mt12" style="width:100%">Envoyer le plan au client</button></form></main>`;
}
changes.fp = () => { readForm(); render(); };
actions["fp-copy"] = (b, d) => {
  readForm(); const src = FD.days[+d.v];
  FD.days = FD.days.map((x, i) => i === +d.v ? x : { ...x, on: true, adj: src.adj, kcal: src.kcal, note: src.note });
  render(); toast("Copié sur tous les jours");
};
forms["food-save"] = async () => {
  readForm();
  if (!FD.days.some(d => d.on)) return toast("Coche au moins un jour");
  const days = FD.days.map(d => {
    const m = dayMacros(FD.maintenance, FD.weight, FD.pk, FD.fk, d);
    return { n: d.n, on: !!d.on, adj: +d.adj || 0, kcal: m.kcal, p: m.p, c: m.c, f: m.f, note: (d.note || "").trim(), meals: d.meals || [] };
  });
  try { const c = await cloud(); await c.coachFoodSet(FD.memberId, { pk: FD.pk, fk: FD.fk, maintenance: FD.maintenance, days }); buzz(); toast("Plan envoyé au client"); go("member", FD.memberId); }
  catch (e) { toast("Envoi impossible : " + e.message); }
};

// ---------- Repas et aliments écrits par le coach ----------
let CFRES = [];
actions["cf-meal"] = (b, d) => {
  readForm(); const day = FD.days[+d.d], std = ["Petit-déjeuner", "Déjeuner", "Collation", "Dîner", "Collation du soir"];
  const n = prompt("Nom du repas", std[(day.meals || []).length] || "Repas"); if (!n?.trim()) return;
  day.meals = [...(day.meals || []), { name: n.trim(), items: [] }]; render();
};
actions["cf-mdel"] = (b, d) => { readForm(); FD.days[+d.d].meals.splice(+d.m, 1); render(); };
actions["cf-del"] = (b, d) => { readForm(); FD.days[+d.d].meals[+d.m].items.splice(+d.i, 1); render(); };
actions["cf-mcopy"] = (b, d) => {
  readForm(); const src = JSON.parse(JSON.stringify(FD.days[+d.d].meals || []));
  FD.days = FD.days.map((x, i) => i === +d.d ? x : { ...x, on: true, meals: JSON.parse(JSON.stringify(src)) }); render(); toast("Repas copiés sur tous les jours");
};
actions["cf-add"] = async (b, d) => {
  readForm(); const di = +d.d, mi = +d.m;
  await N.loadCiqual().catch(() => { });
  sheet(`<h2 class="h2">Ajouter un aliment</h2><input class="inp mt8" id="cfq" placeholder="Chercher : riz, poulet, skyr…" autocomplete="off" style="text-align:left"><div class="list mt8" id="cfl"></div>`);
  const q = document.getElementById("cfq"), box = document.getElementById("cfl");
  q.oninput = () => { CFRES = N.searchFoods(q.value, 15); box.innerHTML = CFRES.length ? CFRES.map((f, k) => `<button class="li" data-a="cf-pick" data-d="${di}" data-m="${mi}" data-v="${k}"><span class="grow small"><b>${esc(f.n)}</b></span></button>`).join("") : `<p class="empty small">Aucun aliment.</p>`; };
  q.focus();
};
actions["cf-pick"] = (b, d) => {
  const f = CFRES[+d.v]; if (!f) return;
  const g = num(prompt(`Quantité de « ${f.n} » en g ou ml`, "100")); if (!g) return;
  const e = N.entryFromFood(f, g, "Repas");
  readForm(); FD.days[+d.d].meals[+d.m].items.push({ label: e.label, g, kcal: e.kcal, p: e.p, c: e.c, f: e.f });
  closeSheet(); render();
};
