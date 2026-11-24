// Régularité de la semaine (nutrition et séances) : la semaine affichée et ses voisines dans un carrousel.
// Même vue pour le client (accueil) et pour le coach (fiche du client, dans withState).
import { S, today } from "../store.js";
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import { esc, fr, fmtDate, I, addDays, carrousel, ring } from "../core.js";

export function regularite({ vw = 0, act, lien = null }) {
  // Nutrition et séances : la semaine affichée (vw = 0, -1…) et ses voisines dans un carrousel qu'on fait défiler au doigt
  const t0 = today(), D = S(), lun0 = addDays(t0, -E.dowOf(t0)), t = N.targets();
  const anneau = (v, cible, l, col) => { const f = cible ? v / cible : 0; return `<div><div class="mini"><svg viewBox="0 0 66 66">${ring(Math.min(1, f), 66, 7, col)}</svg><b>${cible ? Math.round(f * 100) + "%" : "–"}</b></div><div class="l">${l}<br><span class="xs">${fr(v)}${cible ? " / " + fr(cible) : ""}</span></div></div>`; };
  const ligne = (x) => `<div class="minis" style="grid-template-columns:repeat(4,1fr);margin-top:8px">${anneau(x.kcal, t?.kcal, "kcal", "#2F6FED")}${anneau(x.p, t?.prot, "Prot. g", "#B3263A")}${anneau(x.c, t?.carbs, "Gluc. g", "#E0A93B")}${anneau(x.f, t?.fat, "Lip. g", "#1E8F4E")}</div>`;
  const ico = { done: "✅", missed: "❌", planned: "🏋️", rest: "😌", away: "↪️" };
  const semaine = (o) => {
    const lun = addDays(lun0, 7 * o), sem = Array.from({ length: 7 }, (_, i) => addDays(lun, i));
    const titre = o === 0 ? "Cette semaine" : o === -1 ? "Semaine dernière" : `Du ${fmtDate(lun, { day: "numeric", month: "short" })} au ${fmtDate(sem[6], { day: "numeric", month: "short" })}`;
    const jt = N.dayTotals(t0), jours = o === 0 ? Array.from({ length: 7 }, (_, i) => addDays(t0, -i)) : sem, notes = jours.filter(k => N.dayLog(k).length);
    const moy = (k) => notes.length ? notes.reduce((a, d) => a + (N.dayTotals(d)[k] || 0), 0) / notes.length : 0;
    const barres = `<div class="wk7s mt12">${sem.map((k, i) => { const kc = N.dayTotals(k).kcal || 0, f = t?.kcal ? Math.min(1, kc / t.kcal) : 0; return `<div class="${k === t0 ? "on" : ""}"><span>${E.DAY_SHORT[i]}</span><i style="display:block;height:34px;width:14px;margin:4px auto;border-radius:7px;background:var(--line);position:relative;overflow:hidden"><i style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(f * 100)}%;background:#2F6FED;border-radius:7px"></i></i><b class="xs">${kc ? fr(kc) : "·"}</b></div>`; }).join("")}</div>`;
    const n = `<b class="small">${esc(titre)}</b>${o === 0 ? `<div class="row between mt8"><span class="small">Aujourd'hui</span><span class="xs muted">${N.dayLog(t0).length} aliment${N.dayLog(t0).length > 1 ? "s" : ""} notés</span></div>${ligne({ kcal: jt.kcal || 0, p: jt.p || 0, c: jt.c || 0, f: jt.f || 0 })}` : ""}
      <div class="row between mt12"><span class="small">Moyenne ${o === 0 ? "7 jours" : "de la semaine"}</span><span class="xs muted">${notes.length}/7 jours notés</span></div>${ligne({ kcal: moy("kcal"), p: moy("p"), c: moy("c"), f: moy("f") })}${barres}`;
    const ag = E.agenda(sem[0], sem[6]);
    const fait = sem.filter(k => ag[k]?.st === "done").length, prevu = sem.filter(k => ag[k] && !["rest", "away"].includes(ag[k].st)).length;
    const der = (D.workouts || []).filter(w => { const k = today(new Date(w.end)); return k >= sem[0] && k <= sem[6]; }).reverse();
    const se = `<div class="row between"><b class="small">${esc(titre)}</b><span class="xs muted">${fait}/${prevu} séances</span></div><div class="wk7s mt8">${sem.map((k, i) => `<div class="${k === t0 ? "on" : ""}"><span>${E.DAY_SHORT[i]}</span><b>${ag[k] ? ico[ag[k].st] || "·" : "·"}</b></div>`).join("")}</div>
      ${der.length ? der.map(w => `<button class="li" style="width:100%;text-align:left" ${lien ? `data-a="${lien}" data-v="seances"` : `data-a="ag-day" data-v="${today(new Date(w.end))}"`}><span class="grow small"><b>${esc(w.title)}</b><br><span class="xs muted">${fmtDate(today(new Date(w.end)), { weekday: "short", day: "numeric", month: "short" })} · ${w.setsDone ?? (w.exercises || []).reduce((a, e) => a + (e.sets || []).filter(x => x.done && x.type !== "W").length, 0)} séries${w.volume ? ` · ${fr(w.volume / 1000, 1)} t` : ""}${w.records?.length ? " · 🏆" : ""}</span></span>${I.chev}</button>`).join("") : `<p class="small muted mt8" style="margin-bottom:0">Aucune séance enregistrée.</p>`}`;
    return { n, se };
  };
  const ws = [semaine(vw - 1), semaine(vw), vw < 0 ? semaine(vw + 1) : null];
  const aide = `<p class="xs muted center" style="margin:6px 0 0">← fais glisser pour changer de semaine →</p>`;
  const nutri = `<h2 class="sec">🍽️ Nutrition</h2><div class="card">${carrousel(act, ws.map(w => w && w.n))}${aide}</div>`;
  const seances = `<h2 class="sec">🏋️ Séances</h2><div class="card">${carrousel(act, ws.map(w => w && w.se))}${aide}</div>`;
  return { nutri, seances };
}
