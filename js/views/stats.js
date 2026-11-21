// Statistiques sur le réalisé (décision C72) : jauges MV / MEV / MAV / MRV par muscle, équilibre (radar des 8 patterns et
// ratios), prévu face à fait, surcharge progressive et stimulus par muscle. Le calcul est dans js/stats-realise.js (pur).
// Même rendu chez le membre (Entraînement › Statistiques) et chez le coach (fiche athlète, onglet Stats, via withState).
import { S, today } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as V from "../volume.js";
import * as T from "../stats-realise.js";
import { esc, fr } from "../core.js";

X.loadExercices();
const jourDe = (iso) => today(new Date(iso));
// Muscles d'un exercice : le catalogue d'exercices d'abord (le plus complet), sinon le moteur (banque, fiches)
const musclesOfTous = (n) => { const e = X.exercice(n); return e?.muscles?.length ? e.muscles : E.musclesOf(n); };
const musclesDe = (n) => T.musclesParVolume(n, musclesOfTous);
const patternDe = (n) => { const e = X.exercice(n); return e?.pattern_principal || null; };
const lmDuClient = () => { const p = S().plan && E.program(S().plan.programId); return V.landmarks(p?.vplan?.lm); };
const v1 = (x) => fr(x, 1);

// ---------- Jauge d'un muscle ----------
function jauge(m) {
  const L = m.lm, max = Math.max(L.mrv * 1.2, m.parSem * 1.08, 4), pc = (x) => Math.max(0, Math.min(100, x / max * 100));
  const seg = [[0, L.mv, "z0"], [L.mv, L.mev, "z1"], [L.mev, L.mav[0], "z2"], [L.mav[0], L.mav[1], "z3"], [L.mav[1], L.mrv, "z4"], [L.mrv, max, "z5"]].filter(([a, b]) => b > a);
  return `<div class="jg"><div class="row between small"><b>${esc(m.nom)}${m.indicatif ? ` <span class="xs muted">(repère indicatif)</span>` : ""}</b><span><b class="num">${v1(m.parSem)}</b> <span class="xs muted">séries/sem.</span> <span class="tag jz ${m.zone.id}">${esc(m.zone.nom)}</span></span></div>
    <div class="jbar" role="img" aria-label="${esc(m.nom)} : ${v1(m.parSem)} séries par semaine, ${esc(m.zone.nom)}">${seg.map(([a, b, c]) => `<i class="${c}" style="left:${pc(a)}%;width:${pc(b) - pc(a)}%"></i>`).join("")}<b class="jmk" style="left:${pc(m.parSem)}%"></b></div>
    <div class="jlb xs muted">${[["MV", L.mv], ["MEV", L.mev], ["MAV", L.mav[0]], ["MRV", L.mrv]].filter(([, x]) => x > 0).map(([l, x]) => `<span style="left:${pc(x)}%">${l} ${fr(x)}</span>`).join("")}</div></div>`;
}
export function jaugesHtml(de, a) {
  const v = T.volumeParMuscle(S().workouts, de, a, { musclesDe, lm: lmDuClient(), jourDe });
  const tr = v.filter(m => m.total > 0), rest = v.filter(m => !m.total);
  if (!tr.length) return `<p class="empty small">Pas encore de séance sur la période.</p>`;
  return tr.sort((x, y) => y.zone.rang - x.zone.rang || y.parSem - x.parSem).map(jauge).join("")
    + (rest.length ? `<p class="xs muted mt8">Pas travaillés sur la période : ${rest.map(m => esc(m.nom)).join(", ")}.</p>` : "")
    + `<p class="xs muted mt8">Séries faites par semaine (muscle principal 1, secondaires ½), échauffements exclus. MV maintien · MEV début de progression · MAV zone optimale · MRV limite de récupération. Repères indicatifs, ajustables par le coach.</p>`;
}

// ---------- Radar des 8 patterns ----------
function radar(pat) {
  const P = T.PATTERNS, n = P.length, R = 92, c = 120, max = Math.max(4, ...P.map(([k]) => pat[k] || 0));
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const grid = [0.33, 0.66, 1].map(f => `<polygon points="${P.map((_, i) => pt(i, R * f).join(",")).join(" ")}" class="rg"/>`).join("");
  const axes = P.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" class="rg"/>`).join("");
  const poly = `<polygon points="${P.map(([k], i) => pt(i, R * (pat[k] || 0) / max).join(",")).join(" ")}" class="rv"/>`;
  const lab = P.map(([k, nom], i) => { const [x, y] = pt(i, R + 18); return `<text x="${x}" y="${y}" text-anchor="${x < c - 5 ? "end" : x > c + 5 ? "start" : "middle"}" dominant-baseline="middle" class="rl">${k} ${fr(pat[k] || 0, 1)}</text>`; }).join("");
  return `<svg viewBox="-40 0 320 240" class="radar" role="img" aria-label="Séries par semaine pour chaque pattern">${grid}${axes}${poly}${lab}</svg>
    <p class="xs muted center" style="margin:0">${P.map(([k, nom]) => `${k} ${esc(nom.toLowerCase())}`).join(" · ")}</p>`;
}
function ratioLigne(r) {
  if (r.etat === "inconnu") return "";
  const max = Math.max(2, (r.ratio ?? 0) * 1.1, r.repere[1] * 1.25), pc = (x) => Math.min(100, x / max * 100);
  const txt = r.ratio == null ? `${esc(r.texteB)} : 0 série` : `${fr(r.ratio, 1)} <span class="xs muted">(repère ${fr(r.repere[0], 1)} à ${fr(r.repere[1], 1)})</span>`;
  const msg = r.etat === "ok" ? "Équilibré" : r.etat === "bas" ? `Plus de ${esc(r.texteA.toLowerCase())}` : r.etat === "haut" ? `Plus de ${esc(r.texteB.toLowerCase())}` : "À rééquilibrer";
  return `<div class="jg"><div class="row between small"><b>${esc(r.nom)}</b><span>${txt}</span></div>
    <div class="jbar"><i class="z3" style="left:${pc(r.repere[0])}%;width:${pc(r.repere[1]) - pc(r.repere[0])}%"></i>${r.ratio != null ? `<b class="jmk" style="left:${pc(r.ratio)}%"></b>` : ""}</div>
    <p class="xs muted" style="margin:2px 0 0">${esc(r.texteA)} ${fr(r.a, 1)} · ${esc(r.texteB)} ${fr(r.b, 1)} séries/sem. · <b style="color:${r.etat === "ok" ? "var(--good)" : "#C2361F"}">${msg}</b></p></div>`;
}
export function equilibreHtml(de, a) {
  const e = T.equilibre(S().workouts, de, a, { musclesDe, patternDe, lm: lmDuClient(), jourDe });
  if (!Object.values(e.patterns).some(Boolean)) return `<p class="empty small">Pas encore de séance sur la période.</p>`;
  return radar(e.patterns) + e.ratios.map(ratioLigne).join("");
}

// ---------- Prévu et fait ----------
export function prevuFaitHtml(de, a) {
  const ag = E.agenda(de, a), prevues = Object.entries(ag).filter(([d, x]) => d <= today() && x && !["rest", "away"].includes(x.st)).length;
  const p = T.prevuFait(S().workouts, de, a, { musclesDe, patternDe, jourDe, seancesPrevues: prevues || null });
  if (!p.series.prevues) return `<p class="empty small">Pas encore de séance sur la période.</p>`;
  const barre = (x, y, l) => `<div class="jg"><div class="row between small"><b>${l}</b><span><b class="num">${fr(x, 1)}</b> / ${fr(y, 1)}${y ? ` · ${Math.round(x / y * 100)} %` : ""}</span></div><div class="mpbar"><i class="${x / y >= 0.9 ? "st-bon" : x / y >= 0.7 ? "st-moyen" : "st-bas"}" style="width:${Math.min(100, y ? x / y * 100 : 0)}%"></i></div></div>`;
  return (p.seances.prevues ? barre(p.seances.faites, p.seances.prevues, "Séances faites / prévues") : "") + barre(p.series.faites, p.series.prevues, "Séries faites / prévues")
    + (p.ecarts.length ? `<p class="small mt8" style="margin-bottom:0"><b>En retard sur le prévu :</b></p>${p.ecarts.slice(0, 6).map(m => `<p class="small" style="margin:2px 0 0">• ${esc(m.nom)} : ${fr(m.faites, 1)} séries faites sur ${fr(m.prevues, 1)} prévues (${m.pct} %)</p>`).join("")}` : `<p class="small mt8" style="margin:0">✅ Chaque muscle a reçu au moins 85 % des séries prévues.</p>`)
    + `<div class="stat3 mt12"><div><b>${p.charge ? p.charge.pct + " %" : "–"}</b><span>charge réelle / prévue</span></div><div><b>${p.reps ? p.reps.dans + " %" : "–"}</b><span>séries dans la fourchette de reps</span></div><div><b>${p.rpe ? (p.rpe.ecart > 0 ? "+" : "") + fr(p.rpe.ecart, 1) : "–"}</b><span>RPE ressenti − prévu</span></div></div>`
    + `<p class="xs muted mt8" style="margin-bottom:0">${p.reps ? `Reps : ${p.reps.sous} % sous la fourchette, ${p.reps.audessus} % au-dessus. ` : ""}${p.rpe ? (p.rpe.ecart >= 0.8 ? "Les séries sont plus dures que prévu : la charge est peut-être trop haute. " : p.rpe.ecart <= -0.8 ? "Les séries sont plus faciles que prévu : la charge peut monter. " : "Effort conforme au prévu. ") : ""}Charge prévue connue pour les séances faites depuis cette version.</p>`;
}

// ---------- Surcharge progressive et stimulus ----------
const PUCE = { progresse: "📈", stable: "➖", stagne: "⏸️", regresse: "📉", inconnu: "·" };
export function surchargeHtml() {
  const auj = today(), st = T.stimulus(S().workouts, auj, { musclesDe, lm: lmDuClient(), jourDe });
  const sc = T.surcharge(S().workouts, auj, { jourDe }).filter(x => x.verdict.id !== "inconnu");
  if (!st.length && !sc.length) return `<p class="empty small">Il faut au moins 4 à 6 semaines de séances pour juger la progression.</p>`;
  const crit = (ok, l) => `<span class="tag ${ok === true ? "g" : ok === false ? "st-r" : ""}">${ok === true ? "✓" : ok === false ? "✗" : "?"} ${l}</span>`;
  return `<p class="small"><b>A-t-on donné au corps des raisons de progresser ?</b> Trois conditions sur les 3 dernières semaines : assez de volume (entre MEV et MRV), assez d'intensité (2/3 des séries à RPE 7 ou plus) et au moins un exercice qui progresse.</p>
    ${st.map(m => `<div class="card soft mt8"><div class="row between small"><b>${esc(m.nom)}</b><b>${esc(m.verdict)}</b></div>
      <div class="row mt4" style="gap:6px;flex-wrap:wrap">${crit(m.volume, `${fr(m.parSem, 1)} séries/sem.`)}${crit(m.intensite, m.part != null ? `${m.part} % à RPE 7+` : "intensité")}${crit(m.progression, "progression")}</div>
      ${m.manque.length ? `<p class="xs mt4" style="margin-bottom:0">👉 ${m.manque.map(esc).join(" · ")}</p>` : ""}</div>`).join("")}
    ${sc.length ? `<h3 class="h3 mt16">Par exercice <span class="xs muted">3 dernières semaines face aux 3 d'avant</span></h3>
    <div class="list mt8">${sc.slice(0, 20).map(x => { const d = x.h.at(-1); return `<div class="li"><span class="em">${PUCE[x.verdict.id]}</span><span class="grow small"><b>${esc(x.nom)}</b> · ${esc(x.verdict.nom)}<br><span class="xs muted">${x.verdict.signes.length ? esc(x.verdict.signes.join(" · ")) : d ? `Dernière séance : ${d.series} × ${d.charge ? `${fr(d.top, 1)} kg, ` : ""}${d.repsTop} reps${d.charge ? ` · 1RM estimé ${fr(d.e1rm)} kg` : ""}` : ""}${x.conseil ? `<br>👉 ${esc(x.conseil)}` : ""}</span></span></div>`; }).join("")}</div>` : ""}`;
}

// ---------- Bloc complet ----------
export function analyseHtml(periode = "month") {
  const a = today(), de = debutPeriode(periode, a);
  return `<h2 class="sec">🎚️ Volume par muscle</h2><div class="card">${jaugesHtml(de, a)}</div>
    ${suiteHtml(de, a)}`;
}
export const debutPeriode = (periode, a = today()) => T.addJ(a, periode === "week" ? -6 : periode === "quarter" ? -83 : -27);
export function suiteHtml(de, a) {
  return `<h2 class="sec">⚖️ Équilibre</h2><div class="card">${equilibreHtml(de, a)}</div>
    <h2 class="sec">📋 Prévu et fait</h2><div class="card">${prevuFaitHtml(de, a)}</div>
    <h2 class="sec">📈 Surcharge progressive</h2><div class="card">${surchargeHtml()}</div>`;
}
