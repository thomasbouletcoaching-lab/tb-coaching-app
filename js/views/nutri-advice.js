// Onglet Nutrition › Conseils : ce qu'il reste à atteindre dans la journée (macros, fibres, micronutriments),
// les aliments qui comblent le manque (quantité et calories), et ce qu'il vaut mieux réduire (sucres, sel, calories).
// Repères pour adultes en bonne santé, pas un avis médical.
import { esc, fr } from "../core.js";
import * as N from "../nutrition.js";
import { dayNutrients } from "../nutri-totals.js";
import { MICROS } from "../nutri-rules.js";
import { today } from "../store.js";

// Aliments courants proposés : [nom Ciqual, libellé, portion en g, exclusions (m viande, f poisson, d laitage, e œuf, g gluten)]
const FOODS = [
  ["Lentille, bouillie/cuite à l'eau", "Lentilles cuites", 150, ""], ["Pois chiche, bouilli/cuit à l'eau", "Pois chiches cuits", 150, ""],
  ["Haricot rouge, bouilli/cuit à l'eau", "Haricots rouges cuits", 150, ""], ["Épinard, cuit", "Épinards cuits", 150, ""],
  ["Brocoli, cuit", "Brocoli cuit", 150, ""], ["Chou de Bruxelles, cuit", "Choux de Bruxelles", 150, ""], ["Asperge, bouillie/cuite à l'eau", "Asperges", 150, ""],
  ["Mâche, crue", "Mâche", 60, ""], ["Haricot vert, cuit", "Haricots verts", 150, ""], ["Betterave rouge, cuite", "Betterave cuite", 100, ""],
  ["Avocat, pulpe, cru", "Avocat", 100, ""], ["Poivron rouge, cru", "Poivron rouge cru", 100, ""], ["Kiwi, pulpe et graines, cru", "Kiwi", 100, ""],
  ["Orange, pulpe, crue", "Orange", 150, ""], ["Fraise, crue", "Fraises", 150, ""], ["Banane, pulpe, crue", "Banane", 120, ""],
  ["Pomme de terre, bouillie/cuite à l'eau", "Pommes de terre", 200, ""], ["Patate douce, cuite", "Patate douce", 200, ""],
  ["Flocon d'avoine", "Flocons d'avoine", 60, "g"], ["Pain complet ou intégral (à la farine T150)", "Pain complet", 80, "g"],
  ["Quinoa, bouilli/cuit à l'eau, non salé", "Quinoa cuit", 150, ""], ["Riz complet, cuit, non salé", "Riz complet cuit", 150, ""],
  ["Amande, mondée, émondée ou blanchie", "Amandes", 30, ""], ["Noix de cajou, grillée, non salée", "Noix de cajou", 30, ""], ["Noix, séchée, cerneaux", "Noix", 30, ""],
  ["Chocolat noir à 70% cacao minimum, extra, dégustation, tablette", "Chocolat noir 70 %", 20, ""], ["Germe de blé", "Germe de blé", 15, "g"],
  ["Levure alimentaire", "Levure alimentaire", 10, ""], ["Huile d'olive vierge extra", "Huile d'olive", 10, ""], ["Tofu nature, préemballé", "Tofu", 150, ""],
  ["Oeuf, cru", "Œufs (2)", 110, "e"], ["Oeuf, blanc (blanc d'oeuf), cuit", "Blancs d'œufs", 150, "e"],
  ["Lait demi-écrémé, UHT", "Lait demi-écrémé", 250, "d"], ["Fromage blanc nature, 0% MG", "Fromage blanc 0 %", 200, "d"], ["Skyr nature 0 %", "Skyr nature", 150, "d"],
  ["Emmental ou emmenthal", "Emmental", 30, "d"], ["Protéine whey en poudre", "Whey", 30, "d"],
  ["Sardine, à l'huile, appertisée, égouttée", "Sardines en boîte", 100, "f"], ["Saumon, cuit, sans précision (aliment moyen)", "Saumon cuit", 130, "f"],
  ["Maquereau, rôti/cuit au four", "Maquereau", 130, "f"], ["Thon, au naturel, appertisé, égoutté", "Thon au naturel", 100, "f"],
  ["Moule, bouillie/cuite à l'eau", "Moules", 150, "f"], ["Huître creuse, crue", "Huîtres (6)", 90, "f"],
  ["Boeuf, steak haché 5% MG, cuit", "Steak haché 5 %", 125, "m"], ["Poulet, filet, sans peau, sauté/poêlé", "Blanc de poulet", 150, "m"],
  ["Dinde, escalope, sautée/poêlée", "Escalope de dinde", 150, "m"], ["Foie, volaille, cuit", "Foie de volaille", 100, "m"],
];
// Nutriments suivis ici : clé dans les micronutriments des aliments, cible, unité
const nutrients = (t, kcal) => [
  ...MICROS.map(m => ({ k: { magnesium: "mg", zinc: "zn", vit_d: "vd", fer: "fe", calcium: "ca", vit_c: "vc", vit_b12: "b12", folate: "b9" }[m.code], code: m.code, label: m.label, unit: m.unit, target: m.nrv, have: t[m.code] })),
  { k: "k", code: "potassium", label: "Potassium", unit: "mg", target: 3500, have: t.kMg },
  { k: "fib", code: "fibres", label: "Fibres", unit: "g", target: Math.max(25, Math.round(kcal / 1000 * 14)), have: t.fib },
];
// Régime du profil : on ne propose pas ce que la personne ne mange pas
function allowed(ex) {
  const p = N.planPrefs(), d = p.diet || "all";
  if (ex.includes("m") && d !== "all") return false;
  if (ex.includes("f") && (d === "vegetarian" || d === "vegan")) return false;
  if ((ex.includes("d") || ex.includes("e")) && d === "vegan") return false;
  if (ex.includes("d") && p.noLactose) return false;
  if (ex.includes("g") && p.noGluten) return false;
  return true;
}
// Valeurs d'une portion : macros, fibres, micronutriments
function catalog() {
  return FOODS.filter(x => allowed(x[3])).map(([n, label, g]) => {
    const f = N.foodByName(n); if (!f) return null;
    const k = g / 100, mic = N.microOf(f, g) || {};
    return { label, g, f, kcal: Math.round(f.kcal * k), p: f.p * k, c: f.c * k, fat: f.f * k, v: { ...mic, fib: f.fib != null ? f.fib * k : 0 } };
  }).filter(Boolean);
}
const amt = (v, unit) => `${fr(v, v < 10 ? 1 : 0)} ${unit}`;

export function adviceBody(d, target) {
  const t = dayNutrients(d), log = N.dayLog(d);
  if (!log.length) return `<div class="card mt12"><b>💡 Conseils du jour</b><p class="small muted" style="margin:6px 0 0">Note ce que tu manges dans le Journal : ici, l'app te dira ce qu'il te reste à atteindre et quels aliments le comblent, au fil de la journée.</p></div>`;
  const kcal = target?.kcal || t.kcal || 2000, kcalLeft = Math.max(0, (target?.kcal || 0) - t.kcal);
  const all = catalog();
  // ---------- Micronutriments et fibres : ce qui manque ----------
  const ns = nutrients(t, kcal).map(n => { const have = n.have ?? 0; return { ...n, have, pct: have / n.target, left: Math.max(0, n.target - have) }; });
  const gaps = ns.filter(n => n.pct < 0.9).sort((a, b) => a.pct - b.pct);
  // Pénalité calorique : un aliment calorique compte moins quand il reste peu de calories
  const kcalW = (k) => 1 + k / Math.max(200, kcalLeft || 200);
  const best = (n) => all.map(x => ({ x, a: x.v[n.k] || 0 })).filter(o => o.a > n.left * 0.08).map(o => ({ ...o, s: Math.min(1, o.a / n.left) / kcalW(o.x.kcal) })).sort((a, b) => b.s - a.s).slice(0, 3);
  // Combo : 3 aliments choisis l'un après l'autre pour boucher le plus de trous à la fois
  const rem = Object.fromEntries(gaps.map(n => [n.k, n.left])), combo = [];
  for (let i = 0; i < 3 && gaps.length; i++) {
    const pick = all.filter(x => !combo.includes(x)).map(x => ({ x, s: gaps.reduce((a, n) => a + Math.min(x.v[n.k] || 0, rem[n.k]) / n.left, 0) / kcalW(x.kcal) })).sort((a, b) => b.s - a.s)[0];
    if (!pick || pick.s < 0.05) break; combo.push(pick.x); gaps.forEach(n => { rem[n.k] = Math.max(0, rem[n.k] - (pick.x.v[n.k] || 0)); });
  }
  const comboCover = gaps.map(n => ({ n, after: Math.min(100, Math.round((n.have + combo.reduce((a, x) => a + (x.v[n.k] || 0), 0)) / n.target * 100)) }));
  const bar = (pct) => `<div class="gauge grow" style="min-width:60px"><i style="width:${Math.min(100, Math.round(pct * 100))}%;background:${pct >= 0.9 ? "#3E8E5E" : pct >= 0.5 ? "#C98A2B" : "#B3263A"}"></i></div>`;

  // ---------- Macros : ce qu'il reste ----------
  const left = target ? { kcal: target.kcal - t.kcal, p: target.prot - t.p, c: (target.carbs ?? 0) - t.c, f: (target.fat ?? 0) - t.f } : null;
  const fill = (key, need, labels) => {
    const l = all.filter(x => labels.includes(x.label) && x[key] > 0);
    return l.map(x => { const per100 = x[key] / x.g * 100, g = Math.max(10, Math.min(x.g * 2, Math.round(need / per100 * 100 / 10) * 10)); return { x, g, got: per100 * g / 100, kc: Math.round(x.f.kcal * g / 100) }; })
      .sort((a, b) => a.kc / a.got - b.kc / b.got).slice(0, 3);
  };
  const macroRows = [];
  if (left) {
    if (left.p > 10) macroRows.push(["🥩 Protéines", left.p, "g", fill("p", left.p, ["Blanc de poulet", "Escalope de dinde", "Thon au naturel", "Blancs d'œufs", "Fromage blanc 0 %", "Skyr nature", "Whey", "Tofu", "Lentilles cuites", "Saumon cuit"])]);
    if (left.c > 25) macroRows.push(["🍚 Glucides", left.c, "g", fill("c", left.c, ["Riz complet cuit", "Quinoa cuit", "Pommes de terre", "Patate douce", "Flocons d'avoine", "Pain complet", "Banane"])]);
    if (left.f > 8) macroRows.push(["🥑 Lipides", left.f, "g", fill("fat", left.f, ["Amandes", "Noix", "Avocat", "Huile d'olive", "Noix de cajou", "Saumon cuit"])]);
  }

  // ---------- À réduire ----------
  const less = [], top = (fn, n = 3) => log.map(e => ({ e, v: fn(e) || 0 })).filter(o => o.v > 0).sort((a, b) => b.v - a.v).slice(0, n);
  const src = (l, unit, fmt = (v) => fr(v, 0)) => l.length ? `<p class="xs muted" style="margin:4px 0 0">Ce qui en apporte le plus aujourd'hui : ${l.map(o => `${esc(o.e.label.split(",")[0])} (${fmt(o.v)} ${unit})`).join(", ")}.</p>` : "";
  if (left && left.kcal < -100) less.push(`<b>Calories : +${fr(-left.kcal)} kcal au-dessus de ta cible.</b> Sur les prochains repas, garde les protéines et les légumes, réduis les féculents, les matières grasses ajoutées et les sucreries.${src(top(e => e.kcal), "kcal")}`);
  if (t.sugStatus === "rouge" || t.sugStatus === "orange") less.push(`<b>Sucres : ${fr(t.sugG)} g (${Math.round(t.sugG * 4 / t.kcal * 100)} % des calories).</b> Remplace sodas, jus et biscuits par un fruit entier, un yaourt nature ou une poignée d'oléagineux.${src(top(e => e.mic?.sug), "g", v => fr(v, 1))}`);
  if (t.naStatus === "rouge" || t.naStatus === "orange") less.push(`<b>Sel : ${fr(t.salt, 1)} g, rapport K/Na ${t.ratio != null ? fr(t.ratio, 1) : "—"}.</b> Limite charcuterie, plats préparés, fromages et sauces ; ajoute des légumes, légumineuses, banane ou pommes de terre pour remonter le potassium.${src(top(e => e.mic?.na), "mg de sodium")}`);
  if (left && left.f < -15) less.push(`<b>Lipides : +${fr(-left.f)} g au-dessus de ta cible.</b> Mesure l'huile à la cuillère, choisis des viandes et laitages plus maigres.${src(top(e => e.f), "g", v => fr(v, 1))}`);

  const now = new Date().getHours(), early = d === today() && now < 18;
  return `<div class="card mt12"><b>💡 Conseils du jour</b>
      <p class="xs muted" style="margin:4px 0 0">${early ? "La journée n'est pas finie : ces écarts se comblent souvent aux prochains repas. " : ""}Calculé sur ${t.known} aliment${t.known > 1 ? "s" : ""} sur ${t.total} avec les données détaillées${t.known < t.total ? " : les manques peuvent être surestimés" : ""}.</p></div>
    ${left ? `<h2 class="sec">🎯 Il te reste aujourd'hui</h2><div class="card"><div class="stat3"><div><b>${fr(Math.max(0, left.kcal))}</b><span>kcal</span></div><div><b>${fr(Math.max(0, Math.round(left.p)))} g</b><span>protéines</span></div><div><b>${fr(Math.max(0, Math.round(left.c)))} / ${fr(Math.max(0, Math.round(left.f)))}</b><span>gluc. / lip. (g)</span></div></div>
      ${macroRows.map(([lab, need, u, l]) => `<div class="mt12"><div class="small"><b>${lab}</b> · il manque ${fr(Math.round(need))} ${u}</div>${l.map(o => `<div class="row between xs mt4" style="gap:8px"><span class="grow">${fr(o.g)} g ${esc(o.x.label.toLowerCase())}</span><span class="muted">+${fr(Math.round(o.got))} ${u} · ${fr(o.kc)} kcal</span></div>`).join("")}</div>`).join("") || `<p class="small muted mt8">Tes macros sont atteintes ou presque. 👌</p>`}</div>` : ""}
    <h2 class="sec">🧪 Vitamines, minéraux et fibres</h2>
    <div class="card">${ns.map(n => `<div class="row between xs mt4" style="gap:8px"><span style="width:104px">${esc(n.label)}</span>${bar(n.pct)}<span style="width:120px;text-align:right;white-space:nowrap">${n.pct >= 0.9 ? "✅" : `il manque ${amt(n.left, n.unit)}`}</span></div>`).join("")}
      <p class="xs muted" style="margin:8px 0 0">Cible : apport de référence européen pour un adulte (potassium 3 500 mg, fibres selon tes calories).</p></div>
    ${gaps.length ? `${combo.length ? `<h2 class="sec">⚡ Le combo pour boucher les trous</h2><div class="card">${combo.map(x => `<div class="row between small mt4" style="gap:8px"><span class="grow"><b>${fr(x.g)} g</b> ${esc(x.label.toLowerCase())}</span><span class="xs muted">${fr(x.kcal)} kcal</span></div>`).join("")}
        <p class="xs mt8" style="margin-bottom:0">Avec ces ${combo.length} aliments : ${comboCover.map(o => `${esc(o.n.label)} ${o.after} %`).join(" · ")} <span class="muted">(+${fr(combo.reduce((a, x) => a + x.kcal, 0))} kcal)</span></p></div>` : ""}
      <h2 class="sec">🥦 À manger plus, nutriment par nutriment</h2>
      ${gaps.slice(0, 6).map(n => { const l = best(n); return `<div class="card"><div class="row between small"><b>${esc(n.label)}</b><span class="xs muted">${Math.round(n.pct * 100)} % · il manque ${amt(n.left, n.unit)}</span></div>
        ${l.length ? l.map(o => `<div class="row between xs mt4" style="gap:8px"><span class="grow">${fr(o.x.g)} g ${esc(o.x.label.toLowerCase())}</span><span class="muted">+${amt(o.a, n.unit)} (${Math.min(100, Math.round(o.a / n.left * 100))} %) · ${fr(o.x.kcal)} kcal</span></div>`).join("") : `<p class="xs muted" style="margin:4px 0 0">${n.k === "vd" || n.k === "b12" ? "Peu d'aliments compatibles avec ton régime en apportent assez : parles-en à ton coach (complément possible, voir l'onglet Compléments)." : "Pas d'aliment adapté dans la liste."}</p>`}</div>`; }).join("")}` : `<div class="card mt8"><p class="small" style="margin:0">✅ Tous tes micronutriments suivis sont couverts aujourd'hui.</p></div>`}
    <h2 class="sec">🔻 À manger moins</h2>
    ${less.length ? less.map(x => `<div class="card small">${x}</div>`).join("") : `<div class="card"><p class="small" style="margin:0">Rien à réduire aujourd'hui : sucres, sel et calories sont dans les repères. 👌</p></div>`}
    <p class="xs muted mt12">Repères généraux pour un adulte, pas un avis médical. Grossesse, traitement ou pathologie : suis les consignes de ton médecin. Valeurs : table Ciqual (Anses).</p>`;
}
