// Roadmap vers un record : verdict (réaliste, ambitieux, pas réaliste), courbe, puis chaque semaine et chaque séance avec ses séries, charges et pourcentages.
// Part d'un objectif de performance existant (Entraînement > Saison et objectifs) : même charge visée, même date.
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as R from "../roadmap.js";
import { $app, esc, fr, num, toast, routes, R as ROUTE, actions, changes, go, header, buzz, rerender } from "../core.js";
import { pushStats } from "../sync.js";

const goalOf = () => (S().goals || []).find(g => String(g.id) === String(ROUTE.param));
const reglages = (g) => ({ freq: g.road?.freq || 2, niveau: g.road?.niveau || R.niveauDepuis(S().profile?.level), cur: g.road?.cur || Math.round((E.currentE1rm(g.name) || g.start || 0) * 10) / 10 });
const fmtJour = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
const fmtCourt = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const kg = (v) => fr(v, v % 1 ? 1 : 0);

function calc(g) {
  const r = reglages(g), tgt = E.goalTarget(g), jours = R.joursEntre(today(), g.date);
  const v = R.verdict({ cur: r.cur, tgt, jours, niveau: r.niveau, freq: r.freq, reps: g.reps, kg: g.kg });
  const road = r.cur > 0 && jours >= 7 ? R.construire({ nom: g.name, cur: r.cur, tgt, kg: g.kg, reps: g.reps, debut: today(), fin: g.date, freq: r.freq, niveau: r.niveau }) : null;
  return { r, tgt, jours, v, road };
}
const COUL = { realiste: ["✅", "var(--ok,#2E7D32)"], ambitieux: ["⚠️", "var(--warn,#B85C00)"], impossible: ["⛔", "var(--red)"], atteint: ["🎉", "var(--ok,#2E7D32)"], inconnu: ["ℹ️", "var(--soft)"] };
const PHASE_NOTE = { Accumulation: "On bâtit du volume", Intensification: "On monte les charges", Réalisation: "On vise lourd", Deload: "Semaine de récupération", Affûtage: "On se rend frais pour le jour J", Objectif: "Jour J" };

routes.roadmap = async () => {
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  const g = goalOf();
  if (!g) { $app.innerHTML = header("Roadmap", "", { back: "train", offers: false }) + `<main class="page"><div class="card"><h2 class="h2">Pas d'objectif choisi</h2><p class="small muted mt8">Fixe d'abord un objectif de performance : une charge, un nombre de répétitions, une date.</p><button class="btn btn-red mt12" data-a="go" data-r="train" data-p="saison">Mes objectifs</button></div></main>`; return; }
  const { r, tgt, jours, v, road } = calc(g), [ico, col] = COUL[v.id] || COUL.inconnu, semEnCours = road ? R.semaineEnCours(road, today()) : 0;
  $app.innerHTML = header("Roadmap", esc(g.name), { back: "train", offers: false }) + `<main class="page" style="padding-bottom:160px">
    <div class="card"><div class="lbl">🎯 Ton objectif</div><div class="row between mt4" style="gap:8px"><span class="num" style="font-size:26px">${kg(g.kg)} kg × ${g.reps}</span><span class="small muted" style="text-align:right">avant le ${fmtJour(g.date)}<br>dans ${Math.max(0, Math.round(jours / 7))} semaine${Math.round(jours / 7) > 1 ? "s" : ""}</span></div>
      <p class="xs muted mt4" style="margin:4px 0 0">Soit un 1RM estimé de ${kg(Math.round(tgt * 10) / 10)} kg. Aujourd'hui : ${r.cur ? kg(r.cur) + " kg" : "inconnu"}.</p></div>
    <div class="card mt12" style="border-color:${col}"><div class="row" style="gap:10px;align-items:center"><span style="font-size:28px">${ico}</span><div><b class="h3" style="color:${col}">${esc(v.titre)}</b></div></div><p class="small mt8" style="margin:8px 0 0">${esc(v.texte)}</p>
      ${v.id === "impossible" && v.kgMax && jours >= 21 ? `<div class="mt12"><p class="small" style="margin:0 0 8px"><b>Deux façons de le rendre tenable :</b></p>
        <button class="btn btn-line btn-sm" style="width:100%" data-a="rm-date" data-d="${v.dateReal(today())}">Garder ${kg(g.kg)} kg et viser le ${fmtJour(v.dateReal(today()))}</button>
        <button class="btn btn-line btn-sm mt8" style="width:100%" data-a="rm-kg" data-k="${v.kgMax}">Garder la date et viser ${kg(v.kgMax)} kg × ${g.reps}</button></div>` : ""}
      ${v.id === "ambitieux" ? `<p class="xs muted mt8" style="margin:8px 0 0">Si une semaine déraille, la roadmap se recalcule : touche « Recalculer » à partir de ton 1RM du moment.</p>` : ""}</div>
    <h2 class="sec">Tes réglages</h2>
    <div class="card"><label class="field"><span>Ton 1RM estimé aujourd'hui (kg)</span><input inputmode="decimal" data-c="rm-cur" value="${r.cur || ""}" placeholder="ex. 100"></label>
      <p class="xs muted mt4" style="margin:4px 0 0">${E.currentE1rm(g.name) ? `D'après tes séances : ${kg(Math.round(E.currentE1rm(g.name) * 10) / 10)} kg.` : "Pas encore de séance sur cet exercice : indique un maximum récent."} Si tu as fait une série lourde récemment, c'est le meilleur point de départ.</p>
      <div class="field mt12"><span>Séances par semaine sur ce mouvement</span><div class="chips">${[1, 2, 3].map(n => `<button class="chip ${r.freq === n ? "on" : ""}" data-a="rm-freq" data-v="${n}" aria-pressed="${r.freq === n}">${n}</button>`).join("")}</div></div>
      <label class="field mt8"><span>Ton niveau sur ce mouvement</span><select data-c="rm-niv">${[["debutant", "Débutant (moins d'un an)"], ["regulier", "Régulier (1 à 3 ans)"], ["avance", "Avancé (plus de 3 ans)"]].map(([k, l]) => `<option value="${k}" ${r.niveau === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    ${road ? `<h2 class="sec">La courbe</h2>${courbe(road)}
    <h2 class="sec">Étape par étape <small>${road.nbSemaines} semaines</small></h2>
    ${road.semaines.map(s => semaine(s, road, semEnCours)).join("")}
    <p class="xs muted mt12">Les charges viennent de ton 1RM estimé et de l'effort visé (RPE). Si une séance est plus facile ou plus dure que prévu, ajuste la charge dans la séance : le prochain recalcul en tient compte.</p>` : `<div class="card mt12"><p class="small muted" style="margin:0">${jours < 7 ? "La date est trop proche pour bâtir une roadmap : choisis une échéance à plus d'une semaine." : "Indique ton 1RM de départ pour voir la roadmap."}</p></div>`}
  </main>${road ? `<div class="dock"><button class="btn btn-red" data-a="rm-adopter">Créer le programme de cette roadmap</button><button class="link xs mt8" data-a="rm-demarrer" style="width:100%;text-align:center">Ou le démarrer tout de suite</button></div>` : ""}`;
};

function courbe(road) {
  const W = 320, H = 150, px = 34, py = 14, pts = road.semaines.map(s => s.e1), mn = Math.min(road.cur, ...pts) * 0.97, mx = Math.max(road.tgt, ...pts) * 1.02;
  const X = (i) => px + (W - px - 8) * (road.nbSemaines === 1 ? 0 : i / (road.nbSemaines - 1)), Y = (v) => H - py - (H - 2 * py) * (v - mn) / Math.max(1, mx - mn);
  const ligne = pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" "), tY = Y(road.tgt).toFixed(1);
  const deload = road.semaines.map((s, i) => s.phase === "Deload" ? `<rect x="${(X(i) - 6).toFixed(1)}" y="${py - 6}" width="12" height="${H - 2 * py + 12}" fill="var(--line)" opacity=".5"/>` : "").join("");
  return `<div class="card" style="padding:12px"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Progression prévue du 1RM estimé, de ${kg(Math.round(road.cur))} à ${kg(Math.round(road.tgt))} kg en ${road.nbSemaines} semaines" style="width:100%;display:block">
    ${deload}<line x1="${px}" y1="${tY}" x2="${W - 8}" y2="${tY}" stroke="var(--soft)" stroke-dasharray="4 4"/><text x="${px}" y="${(+tY - 4).toFixed(1)}" font-size="10" fill="var(--soft)">cible ${kg(Math.round(road.tgt))} kg</text>
    <polyline points="${ligne}" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((v, i) => i === 0 || i === pts.length - 1 ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4" fill="var(--red)"/>` : "").join("")}
    <text x="${px - 4}" y="${Y(road.cur) + 4}" font-size="10" text-anchor="end" fill="var(--soft)">${kg(Math.round(road.cur))}</text><text x="${px}" y="${H - 2}" font-size="10" fill="var(--soft)">sem. 1</text><text x="${W - 8}" y="${H - 2}" font-size="10" text-anchor="end" fill="var(--soft)">sem. ${road.nbSemaines}</text></svg>
    <p class="xs muted" style="margin:6px 0 0">1RM estimé prévu semaine après semaine. Les bandes grises sont les semaines de récupération.</p></div>`;
}
function semaine(s, road, courante) {
  const ouvert = s.w === courante || s.w === courante + 1 || s.phase === "Objectif";
  return `<details class="card mt8" ${ouvert ? "open" : ""} style="padding:10px 14px"><summary style="cursor:pointer;list-style:none"><div class="row between" style="gap:8px"><b class="small">Semaine ${s.w}${s.w === courante ? ` <span class="tag r">Cette semaine</span>` : ""}</b><span class="xs muted">${fmtCourt(s.du)} · ${esc(s.phase)}</span></div>
    <div class="xs muted">${esc(PHASE_NOTE[s.phase] || "")} · 1RM visé ${kg(s.e1)} kg</div></summary>
    <div class="mt8">${s.seances.map(se => `<div style="padding:8px 0;border-top:1px solid var(--line)"><b class="small">${esc(se.titre)}</b>
      ${R.echauffement(se.sets).length ? `<div class="xs muted mt4">Échauffement : ${R.echauffement(se.sets).map(x => `${kg(x.kg)} × ${x.lo}`).join(" · ")}</div>` : ""}
      ${R.groupes(se.sets).map(gp => `<div class="row between small mt4" style="gap:8px"><span><b>${gp.n} × ${gp.lo}</b> @ ${kg(gp.kg)} kg</span><span class="xs muted">${gp.pct ? gp.pct + " % · " : ""}${gp.rpe === 10 ? "effort max" : "RPE " + String(gp.rpe).replace(".", ",")}</span></div>`).join("")}
      ${se.note ? `<p class="xs muted mt4" style="margin:4px 0 0">${esc(se.note)}</p>` : ""}</div>`).join("")}</div></details>`;
}

// ---------- Réglages ----------
const maj = (patch) => { const g = goalOf(); if (!g) return; update(st => { const x = st.goals.find(y => y.id === g.id); x.road = { ...(x.road || {}), ...patch }; }); rerender(); };
changes["rm-cur"] = (el) => { const v = num(el.value); if (!(v > 0)) return toast("1RM invalide"); maj({ cur: v }); };
changes["rm-niv"] = (el) => maj({ niveau: el.value });
actions["rm-freq"] = (b, d) => maj({ freq: +d.v });
actions["rm-date"] = (b, d) => { const g = goalOf(); if (!g) return; update(st => { st.goals.find(y => y.id === g.id).date = d.d; }); buzz(); toast("Date repoussée"); rerender(); };
actions["rm-kg"] = (b, d) => { const g = goalOf(); if (!g) return; update(st => { st.goals.find(y => y.id === g.id).kg = +d.k; }); buzz(); toast("Objectif ajusté"); rerender(); };

// ---------- Créer le programme ----------
// « Créer » enregistre la roadmap dans Mes programmes sans toucher au programme en cours ; « Démarrer » la lance, quand on veut.
const enregistrer = (g, road) => {
  const id = "road-" + g.id, prog = R.vers(road, { id });
  update(st => { st.customPrograms = [...(st.customPrograms || []).filter(x => x.id !== id), prog]; });
  return id;
};
actions["rm-adopter"] = () => {
  const g = goalOf(); if (!g) return;
  const { road } = calc(g); if (!road) return;
  const id = "road-" + g.id;
  if (S().plan?.programId === id && !confirm("Cette roadmap est ton programme en cours. La mettre à jour avec tes nouveaux réglages ?")) return;
  enregistrer(g, road);
  buzz(); toast("Roadmap enregistrée dans Mes programmes"); pushStats(); go("train", "programme");
};
actions["rm-demarrer"] = () => {
  const g = goalOf(); if (!g) return;
  const { road } = calc(g); if (!road) return;
  if (S().current) return toast("Termine ta séance en cours pour changer de programme.");
  const id = "road-" + g.id;
  if (S().plan?.programId && S().plan.programId !== id && !confirm("Ton programme actuel s'arrête et cette roadmap commence en semaine 1. Tes charges et ton historique sont gardés. Commencer ?")) return;
  enregistrer(g, road);
  update(st => { st.plan = { programId: id, startedAt: today(), week: 1, idx: 0, cycle: st.plan?.cycle || 1 }; });
  buzz(); toast("C'est parti : ta roadmap est ton programme"); pushStats(); go("train", "programme");
};
