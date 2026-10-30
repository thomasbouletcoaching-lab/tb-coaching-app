// Carte nutrition du journal : vue Essentielle (sucres, équilibre sodium / potassium) et détail en accordéon (qualité, électrolytes, micronutriments).
import { esc, fr } from "../core.js";
import { dayNutrients } from "../nutri-totals.js";
import { MICROS, pctNrv, sugarPct } from "../nutri-rules.js";

const DOT = { vert: "#3E8E5E", orange: "#C98A2B", rouge: "#B3263A" };
const LBL = { vert: "dans la cible", orange: "au-dessus de la cible", rouge: "à surveiller" };
const dot = (s) => s ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${DOT[s]};margin-right:6px"></span>` : "";
const dash = (v, u = "") => v == null ? "—" : `${fr(v, v % 1 ? 1 : 0)}${u ? " " + u : ""}`;

export function nutriCard(d) {
  const t = dayNutrients(d);
  if (!t.total) return "";
  const sp = sugarPct(t.sugG, t.kcal);
  const sugarBar = `<div class="gauge grow"><i style="width:${Math.min(100, Math.round((sp || 0) / 0.15 * 100))}%;background:${DOT[t.sugStatus] || "#6E5A4E"}"></i></div>`;
  const naBar = t.ratio == null ? "" : `<div class="gauge grow"><i style="width:${Math.min(100, Math.round(Math.min(t.ratio, 2) / 2 * 100))}%;background:${DOT[t.naStatus] || "#6E5A4E"}"></i></div>`;
  const note = t.coverage != null && t.coverage < 1 ? `<p class="xs muted" style="margin:8px 0 0">Calculé sur ${Math.round(t.coverage * t.total)} aliment${t.total > 1 ? "s" : ""} sur ${t.total} avec la donnée. Les aliments sans donnée ne sont pas comptés à zéro.</p>` : "";
  const micro = MICROS.map(m => {
    const v = t[m.code], pct = pctNrv(v, m.nrv);
    return `<div class="card" style="padding:8px"><span class="xs muted">${esc(m.label)}</span><br><b>${v == null ? "—" : dash(v, m.unit)}</b>${pct != null ? ` <span class="xs muted">· ${pct} %</span>` : ""}</div>`;
  }).join("");
  return `<div class="card mt12">
    <div class="row between xs" style="gap:8px"><span style="width:110px">🍬 Sucres <b style="color:var(--ink)">${dash(t.sugG, "g")}</b></span>${sugarBar}</div>
    <p class="xs muted" style="margin:4px 0 10px">${dot(t.sugStatus)}${sp != null ? `${Math.round(sp * 100)} % des calories · ${LBL[t.sugStatus]}` : "Repère sucres dès 800 kcal dans la journée"}</p>
    <div class="row between xs" style="gap:8px"><span style="width:110px">⚖️ Na / K <b style="color:var(--ink)">${dash(t.naMg, "mg")}</b></span>${naBar}</div>
    <p class="xs muted" style="margin:4px 0 0">${dot(t.naStatus)}${t.ratio != null ? `Potassium ${dash(t.kMg, "mg")} · rapport K/Na ${fr(t.ratio, 1)} · ${LBL[t.naStatus]}` : "Équilibre dès qu'un aliment a sa donnée de sodium"}</p>
    <details class="fold mt12"><summary>Détail : sucres, électrolytes, micronutriments</summary><div class="fb">
      <div class="xs muted">Sucres ajoutés : données non disponibles dans la base actuelle. Le total de sucres sert de repère.</div>
      <div class="xs mt8"><b>Électrolytes</b> · sodium ${dash(t.naMg, "mg")} (repère 2 300 mg, 3 500 mg les jours de forte transpiration) · potassium ${dash(t.kMg, "mg")} · sel ${dash(t.salt, "g")}</div>
      <div class="xs mt8"><b>Micronutriments</b> <span class="muted">(% de l'apport de référence)</span></div>
      <div class="grid2 mt4" style="gap:6px">${micro}</div>
      ${note}
    </div></details></div>`;
}

// Ligne résumée (accueil alimentation) : sucres, sel, équilibre sodium / potassium
export function nutriLine(d) {
  const t = dayNutrients(d); if (!t.total) return "";
  const dt = (s) => s ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${DOT[s]};margin-left:4px"></span>` : "";
  return `<div class="row between xs mt8" style="gap:8px;flex-wrap:wrap"><span>🍬 Sucres <b style="color:var(--ink)">${dash(t.sugG, "g")}</b>${dt(t.sugStatus)}</span><span>🧂 Sel <b style="color:var(--ink)">${dash(t.salt, "g")}</b></span><span>⚖️ K/Na <b style="color:var(--ink)">${t.ratio == null ? "—" : fr(t.ratio, 1)}</b>${dt(t.naStatus)}</span></div>`;
}
