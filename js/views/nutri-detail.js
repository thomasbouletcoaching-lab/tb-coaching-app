// Carte nutrition du journal : vue Essentielle (sucres, équilibre sodium / potassium) et détail en accordéon (qualité, électrolytes, micronutriments).
import { esc, fr, seg } from "../core.js";
import { S } from "../store.js";
import { dayNutrients } from "../nutri-totals.js";
import { MICROS, pctNrv, sugarPct } from "../nutri-rules.js";

const DOT = { vert: "#3E8E5E", orange: "#C98A2B", rouge: "#B3263A" };
const LBL = { vert: "dans la cible", orange: "au-dessus de la cible", rouge: "à surveiller" };
const dot = (s) => s ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${DOT[s]};margin-right:6px"></span>` : "";
const dash = (v, u = "") => v == null ? "—" : `${fr(v, v % 1 ? 1 : 0)}${u ? " " + u : ""}`;

// Niveau de suivi (journal) : « simple » = calories et protéines, « macros » = + glucides, lipides, fibres, « complet » = + sucres, sel, sodium / potassium, micronutriments
export const NUTRI_LEVELS = [["simple", "Calories et protéines"], ["macros", "Calories et macros"], ["complet", "Complet"]];
export function nutriLevel() {
  const v = S().settings?.nutriLevel;
  if (NUTRI_LEVELS.some(([k]) => k === v)) return v;
  return S().settings?.simpleNutri ? "simple" : "macros";
}
export function levelSelector() {
  return `<div class="mt8">${seg(NUTRI_LEVELS, nutriLevel(), "nutri-level")}</div>`;
}
export function nutriCard(d) {
  const t = dayNutrients(d);
  if (!t.total) return "";
  const sp = sugarPct(t.sugG, t.kcal);
  const fibTarget = Math.max(25, Math.round(t.kcal / 1000 * 14));
  const fibPct = Math.min(100, Math.round((t.fib || 0) / fibTarget * 100));
  const sugPct = Math.min(100, Math.round((sp || 0) / 0.15 * 100));
  // Balance Na/K : 0 = sel seul (rouge), 1 = équilibre (vert), 2 et plus = potassium largement au-dessus
  const pos = t.ratio == null ? null : Math.max(0, Math.min(100, Math.round(t.ratio / 2 * 100)));
  const balanceWord = { vert: "Équilibre bon : le potassium couvre le sodium", orange: "Sel en léger excès : surveille les plats salés et les produits transformés", rouge: "Le sel prend le dessus : rétention d'eau et crampes plus probables" };
  const coverage = t.coverage != null && t.coverage < 1 ? `<p class="xs muted" style="margin:8px 0 0">Calculé sur ${Math.round(t.coverage * t.total)} aliment${t.total > 1 ? "s" : ""} sur ${t.total} avec la donnée.</p>` : "";
  const micro = MICROS.map(m => {
    const v = t[m.code], pct = pctNrv(v, m.nrv);
    return `<div class="card" style="padding:8px"><span class="xs muted">${esc(m.label)}</span><br><b>${v == null ? "—" : dash(v, m.unit)}</b>${pct != null ? ` <span class="xs muted">· ${pct} %</span>` : ""}</div>`;
  }).join("");
  return `<div class="card mt12">
    <div class="row between xs" style="gap:8px"><span style="width:110px">🌾 Fibres <b style="color:var(--ink)">${dash(t.fib, "g")}</b></span><div class="gauge grow"><i style="width:${fibPct}%;background:#6B8E23"></i></div></div>
    <p class="xs muted" style="margin:2px 0 10px">Repère ${fibTarget} g par jour</p>
    <div class="row between xs" style="gap:8px"><span style="width:110px">🍬 Sucres <b style="color:var(--ink)">${dash(t.sugG, "g")}</b></span><div class="gauge grow"><i style="width:${sugPct}%;background:${DOT[t.sugStatus] || "#6E5A4E"}"></i></div></div>
    <p class="xs muted" style="margin:2px 0 10px">${dot(t.sugStatus)}${sp != null ? `${Math.round(sp * 100)} % des calories · ${LBL[t.sugStatus]}` : "Repère sucres dès 800 kcal dans la journée"}</p>
    <div class="row between xs" style="gap:8px;flex-wrap:wrap"><span>🧂 Sel <b style="color:var(--ink)">${dash(t.salt, "g")}</b></span><span>🥬 Potassium <b style="color:var(--ink)">${dash(t.kMg, "mg")}</b></span><span>🧂 Sodium <b style="color:var(--ink)">${dash(t.naMg, "mg")}</b></span></div>
    <div class="lbl mt12">Balance sodium / potassium</div>
    <div style="position:relative;height:14px;border-radius:999px;margin:12px 0 4px;background:linear-gradient(90deg,#B3263A 0%,#C98A2B 45%,#3E8E5E 100%)">${pos == null ? "" : `<span style="position:absolute;top:-4px;left:calc(${pos}% - 8px);width:16px;height:22px;border-radius:6px;background:var(--paper);border:2px solid var(--ink);box-shadow:0 1px 4px rgba(0,0,0,.3)"></span>`}</div>
    <div class="row between xs muted" style="gap:8px"><span>Rouge · sel dominant</span><span>Vert · équilibré</span></div>
    <p class="xs mt8" style="margin:6px 0 0">${t.naStatus ? dot(t.naStatus) : ""}${t.ratio != null ? `Rapport K/Na ${fr(t.ratio, 1)} : ${balanceWord[t.naStatus]}` : "Équilibre dès qu'un aliment a sa donnée de sodium et de potassium"}</p>
    ${coverage}
    <details class="fold mt12"><summary>Ce que disent ces chiffres</summary><div class="fb">
      <p class="xs" style="margin:0 0 8px"><b>Sucres.</b> Les sucres ajoutés (sodas, jus, sucreries, pâtisseries) apportent des calories sans nutriments. Au-delà de 10 % des calories, la qualité de l'alimentation tend à baisser. Fruits et lait en contiennent naturellement : ce n'est pas un excès. Repère indicatif, pas une interdiction.</p>
      <p class="xs" style="margin:0 0 8px"><b>Sodium et potassium.</b> Le sodium retient l'eau ; le potassium aide à l'éliminer et soutient la contraction musculaire. Quand le rapport K/Na passe sous 1, le sel prend le dessus : gonflement, tension qui peut monter à long terme, plus de risque de crampes à l'effort. C'est un facteur parmi d'autres (hydratation, magnésium, sommeil). Les jours de forte transpiration, on perd du sodium : le seuil monte.</p>
      <p class="xs muted" style="margin:0 0 8px"><b>Lecture.</b> « — » signifie une donnée absente, pas un zéro. Plus la couverture est basse, moins les totaux sont fiables.</p>
      <div class="xs mt8"><b>Micronutriments</b> <span class="muted">(% de l'apport de référence)</span></div>
      <div class="grid2 mt4" style="gap:6px">${micro}</div>
    </div></details></div>`;
}

// Ligne résumée (accueil alimentation) : sucres, sel, équilibre sodium / potassium
export function nutriLine(d) {
  const t = dayNutrients(d); if (!t.total) return "";
  const dt = (s) => s ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${DOT[s]};margin-left:4px"></span>` : "";
  return `<div class="row between xs mt8" style="gap:8px;flex-wrap:wrap"><span>🍬 Sucres <b style="color:var(--ink)">${dash(t.sugG, "g")}</b>${dt(t.sugStatus)}</span><span>🧂 Sel <b style="color:var(--ink)">${dash(t.salt, "g")}</b></span><span>⚖️ K/Na <b style="color:var(--ink)">${t.ratio == null ? "—" : fr(t.ratio, 1)}</b>${dt(t.naStatus)}</span></div>`;
}
