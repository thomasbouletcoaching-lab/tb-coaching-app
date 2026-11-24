// Muscles : volume par faisceau (séance, semaine, 7 derniers jours), carte du corps, récupération,
// jauge de volume poubelle, redondances, profil étirement / contraction, et pistes pour raccourcir une séance.
// Visible par le client pour lui-même, et par le coach pour chaque client (muscles/<id>).
import * as E from "../engine.js";
import * as F from "../faisceaux.js";
import { GROUPS } from "../volume.js";
import { S, update, today, withState } from "../store.js";
import { $app, esc, fr, toast, routes, actions, header, tabbar, R, go, isCoach, cloud, sheet, closeSheet, rerender, chips, addDays } from "../core.js";

const mus = (n) => E.musclesOf(n);
// Repères hebdomadaires (zone adaptative) repris du moteur de volume de la semaine
const LMID = { pecs: "pecs", dorsal: "dos", trap: "trap", delt: "dlat", bic: "bic", tri: "tri", avb: "avb", abdo: "abs", lomb: "lomb", quad: "quad", isch: "isch", fess: "fess", add: "add", mol: "mol" };
const repere = (mid) => GROUPS.find(g => g.id === LMID[mid])?.lm || { mev: 6, mav: [10, 16], mrv: 20 };
const COUL = { zero: "var(--line)", faible: "#8FB3F5", prod: "#2F6FED", haut: "#E0A93B", max: "#E07A3B", junk: "#C8323F" };

function barre(mid, eq) {
  const j = F.jauge(mid, eq), s = F.seuils(mid);
  return `<div class="fxbar"><i style="width:${Math.min(100, j.pct * 100)}%;background:${COUL[j.k]}"></i><b style="left:${s.prod / s.junk * 100}%"></b><b style="left:${s.max / s.junk * 100}%"></b></div><div class="xs" style="color:${COUL[j.k]};font-weight:700">${j.l}${j.trop ? ` · ${j.trop} série${j.trop > 1 ? "s" : ""} de trop` : ""}</div>`;
}
const tensionTag = (t) => `<span class="tag ${t === "E" ? "r" : ""}">${t === "E" ? "↔️ Étirement" : t === "C" ? "🎯 Contraction" : "⚖️ Mixte"}</span>`;

// Détail par muscle et faisceau pour une liste d'exercices { name, sets }
function detail(items, { semaine = null } = {}) {
  const c = F.countSets(items, mus), red = F.redondances(items, mus);
  const rows = F.MUSCLES_FX.filter(m => c.muscles[m.id]).map(m => {
    const v = c.muscles[m.id], heads = m.f.filter(([h]) => c.heads[h]);
    const tens = items.filter(it => F.headsOf(it.name, mus).d.some(h => F.HEAD[h].m === m.id)).map(it => F.headsOf(it.name, mus).t);
    const nE = tens.filter(t => t === "E").length, nC = tens.filter(t => t === "C").length;
    return `<div class="card mt8"><div class="row between"><b>${esc(m.n)}</b><span class="small"><b>${fr(v.d)}</b> directes${v.i ? ` · ${fr(v.i)} indirectes` : ""}</span></div>
      ${barre(m.id, v.eq)}
      <div class="mt8">${heads.map(([h, n]) => `<div class="row between xs" style="padding:2px 0"><span class="muted">${esc(n)}</span><span>${c.heads[h].d ? `<b>${fr(c.heads[h].d)}</b> dir.` : ""}${c.heads[h].i ? ` ${fr(c.heads[h].i)} ind.` : ""}</span></div>`).join("")}</div>
      ${tens.length > 1 && (!nE || !nC) ? `<p class="xs muted mt4" style="margin-bottom:0">${!nE ? "Aucun exercice en étirement : pense à en varier un (ex. version inclinée, poulie derrière)." : "Que des exercices en étirement : un exercice en contraction compléterait."}</p>` : ""}
      ${semaine?.[m.id] != null ? `<p class="xs muted mt4" style="margin-bottom:0">Cette semaine avant cette séance : ${fr(semaine[m.id])} séries · repère ${repere(m.id).mav[0]}–${repere(m.id).mav[1]}</p>` : ""}</div>`;
  }).join("");
  return `${red.length ? `<div class="card soft mt8" style="box-shadow:0 0 0 1.5px var(--warn) inset"><b class="small">♻️ Redondances</b>${red.map(r => `<p class="xs mt4" style="margin:4px 0 0"><b>${esc(r.a)}</b> et <b>${esc(r.b)}</b> travaillent les mêmes faisceaux (${r.heads.map(h => F.HEAD[h].n.toLowerCase()).join(", ")}) avec la même tension : remplace l'un par une variante ${r.t === "E" ? "en contraction" : "en étirement"}.</p>`).join("")}</div>` : ""}
    ${rows || `<p class="empty">Aucune série de travail pour l'instant.</p>`}
    <p class="xs muted mt12">Une série compte 1 pour les faisceaux principaux et 0,5 pour les secondaires. Repères de séance : au-delà d'environ 8 à 10 séries pour un muscle (6 à 8 pour un petit muscle), les séries suivantes rapportent peu et fatiguent : c'est le volume poubelle.</p>`;
}
// Séries équivalentes par muscle sur une période
function totaux(workouts, from, to = today()) {
  const items = [];
  for (const w of workouts) { const k = today(new Date(w.end || w.start)); if (k < from || k > to) continue; (w.exercises || []).forEach(e => items.push({ name: e.name, sets: (e.sets || []).filter(s => s.done && s.type !== "W").length })); }
  return F.countSets(items, mus);
}
const lundi = (d = today()) => addDays(d, -((new Date(d + "T12:00:00").getDay() + 6) % 7));

// ---------- Pendant la séance ----------
const itemsSeance = (cur, fait) => (cur?.exercises || []).map(e => ({ name: e.name, sets: e.sets.filter(s => s.type !== "W" && (!fait || s.done)).length }));
actions["fx-live"] = async () => {
  await E.loadLib?.().catch(() => { });
  const cur = S().current; if (!cur) return;
  const sem = Object.fromEntries(Object.entries(totaux(S().workouts, lundi()).muscles).map(([k, v]) => [k, v.eq]));
  sheet(`<h2 class="h2">💪 Volume de la séance</h2><p class="small muted">Prévu dans la séance (séries de travail). Les séries d'échauffement ne comptent pas.</p>${detail(itemsSeance(cur), { semaine: sem })}<button class="btn btn-red mt12" data-a="set-close">OK</button>`);
};
actions["fx-presse"] = () => {
  const cur = S().current; if (!cur) return;
  const sem = Object.fromEntries(Object.entries(totaux(S().workouts, lundi()).muscles).map(([k, v]) => [k, v.eq]));
  const r = F.raccourcir(cur.exercises, { musclesOf: mus, semaine: sem });
  const vide = !r.ss.length && !r.echauf.length && !r.retirer.length;
  sheet(`<h2 class="h2">⚡ Pressé ? Gagner du temps</h2><p class="small muted">D'après les muscles de ta séance et ce que tu as déjà fait cette semaine.</p>
    ${r.ss.length ? `<div class="lbl mt12">🔗 En superset</div>${r.ss.map(p => `<div class="li"><span class="grow small"><b>${esc(p.a)}</b> + <b>${esc(p.b)}</b><br><span class="xs muted">${p.anta ? "Muscles opposés : aucune perte de performance" : "Muscles différents"} · ≈ ${p.gain} min gagnées</span></span><button class="btn btn-line btn-xs" data-a="fx-ss" data-a1="${p.xa}" data-b1="${p.xb}">Lier</button></div>`).join("")}` : ""}
    ${r.echauf.length ? `<div class="lbl mt12">🔥 Échauffement à alléger</div>${r.echauf.map(e => `<div class="li"><span class="grow small"><b>${esc(e.name)}</b><br><span class="xs muted">Muscles déjà chauds : 1 série d'approche suffit</span></span><button class="btn btn-line btn-xs" data-a="fx-wu" data-x="${e.xi}">Retirer ${e.retirer}</button></div>`).join("")}` : ""}
    ${r.retirer.length ? `<div class="lbl mt12">✂️ Séries que tu peux enlever</div>${r.retirer.map(e => `<div class="li"><span class="grow small"><b>${esc(e.name)}</b> : ${e.n} série${e.n > 1 ? "s" : ""}<br><span class="xs muted">${esc(F.MUSCLES_FX.find(m => m.id === e.mid).n)} : ${esc(e.pourquoi)}</span></span><button class="btn btn-line btn-xs" data-a="fx-cut" data-n="${esc(e.name)}" data-v="${e.n}">Enlever</button></div>`).join("")}` : ""}
    ${r.garder.length ? `<div class="lbl mt12">🛡️ À garder</div><p class="xs muted" style="margin:4px 0 0">${r.garder.map(g => `<b>${esc(g.name)}</b> (seul exercice pour ${esc(F.HEAD[g.h].n.toLowerCase())})`).join(" · ")}</p>` : ""}
    ${vide ? `<p class="empty">Ta séance est déjà compacte : garde-la telle quelle, ou raccourcis tes repos de 30 s.</p>` : ""}
    <button class="btn btn-red mt16" data-a="set-close">Fermer</button>`);
};
actions["fx-ss"] = (b, d) => { update(st => { const a = st.current.exercises, used = a.map(e => e.ss).filter(Boolean), l = "ABCDEFGH".split("").find(x => !used.includes(x)) || "A"; a[+d.a1].ss = l; a[+d.b1].ss = l; const [x] = a.splice(+d.b1, 1); a.splice(+d.a1 + 1, 0, x); }); closeSheet(); toast("Superset créé"); rerender(); };
actions["fx-wu"] = (b, d) => { update(st => { const e = st.current.exercises[+d.x]; let n = e.sets.filter(s => s.type === "W" && !s.done).length - 1; e.sets = e.sets.filter(s => !(s.type === "W" && !s.done && n-- > 0)); }); closeSheet(); toast("Échauffement allégé"); rerender(); };
actions["fx-cut"] = (b, d) => { update(st => { const e = st.current.exercises.find(x => x.name === d.n); if (!e) return; for (let k = 0; k < +d.v; k++) { const i = e.sets.map(s => !s.done && s.type !== "W").lastIndexOf(true); if (i > 0) e.sets.splice(i, 1); } }); closeSheet(); toast("Séries retirées"); rerender(); };

// ---------- Dans le créateur de programme : analyse d'une séance ou de la semaine ----------
export function analyseProgramme(p, si = null) {
  const se = si == null ? p.s : [p.s[si]];
  const items = se.flatMap(s => s[2].map(r => ({ name: r[0], sets: Array.isArray(r[5]?.sets) ? r[5].sets.filter(x => x.t !== "W").length : +r[5]?.sets || 3 })));
  sheet(`<h2 class="h2">💪 ${si == null ? "Volume de la semaine" : esc(p.s[si][0])}</h2><p class="small muted">${si == null ? "Toutes les séances du programme sur une semaine, face aux repères de volume." : "Séries de travail prévues dans la séance, par faisceau."}</p>
    ${si == null ? semaineProg(items) : detail(items)}<button class="btn btn-red mt12" data-a="set-close">OK</button>`);
}
function semaineProg(items) {
  const c = F.countSets(items, mus);
  return F.MUSCLES_FX.map(m => { const v = c.muscles[m.id]?.eq || 0, L = repere(m.id), st = v < L.mev ? ["Sous le minimum", "#8FB3F5"] : v <= L.mav[1] ? ["Zone productive", "#2F6FED"] : v <= L.mrv ? ["Haut", "#E0A93B"] : ["Au-delà de la récupération", "#C8323F"];
    return `<div class="li"><span class="grow small"><b>${esc(m.n)}</b><br><span class="xs" style="color:${st[1]};font-weight:700">${st[0]}</span><span class="xs muted"> · repère ${L.mav[0]}–${L.mav[1]}</span></span><b class="num">${fr(v)}</b></div>`; }).join("");
}
actions["fx-bd"] = async (b, d) => { const { bdDraft } = await import("./train.js"); const p = bdDraft(); if (p) analyseProgramme(p, d.s != null && d.s !== "" ? +d.s : null); };

// ---------- Carte du corps ----------
const ZONES = {
  face: [["delt", 62, 80, 13, 11], ["delt", 138, 80, 13, 11], ["pecs", 83, 102, 18, 12], ["pecs", 117, 102, 18, 12], ["bic", 54, 125, 8, 17], ["bic", 146, 125, 8, 17], ["avb", 47, 165, 7, 18], ["avb", 153, 165, 7, 18], ["abdo", 100, 152, 15, 30], ["quad", 86, 250, 13, 40], ["quad", 114, 250, 13, 40], ["add", 100, 236, 5, 20], ["mol", 85, 330, 8, 24], ["mol", 115, 330, 8, 24]],
  dos: [["trap", 100, 74, 26, 12], ["delt", 62, 84, 12, 10], ["delt", 138, 84, 12, 10], ["dorsal", 81, 124, 16, 27], ["dorsal", 119, 124, 16, 27], ["lomb", 100, 165, 13, 15], ["tri", 54, 125, 8, 17], ["tri", 146, 125, 8, 17], ["avb", 47, 165, 7, 18], ["avb", 153, 165, 7, 18], ["fess", 88, 205, 14, 15], ["fess", 112, 205, 14, 15], ["isch", 86, 262, 12, 34], ["isch", 114, 262, 12, 34], ["mol", 85, 332, 9, 25], ["mol", 115, 332, 9, 25]],
};
function corps(vals, cote) {
  const col = (mid) => { const v = vals[mid] || 0, L = repere(mid); if (!v) return "var(--line)"; const r = v / L.mav[0]; return v > L.mrv ? "#C8323F" : `rgba(47,111,237,${Math.min(1, .25 + r * .6).toFixed(2)})`; };
  return `<svg viewBox="20 0 160 370" class="corps" role="img" aria-label="Muscles travaillés, vue ${cote === "face" ? "de face" : "de dos"}">
    <path d="M100 12a17 17 0 1 1 0 34a17 17 0 1 1 0-34zM70 56h60l18 14 14 60 -4 60 -12 -2 -6-48-6 56-2 70 -4 80h-18l-4-78-6-50-6 50-4 78h-18l-4-80-2-70-6-56-6 48-12 2-4-60 14-60z" fill="var(--input)" stroke="var(--line)"/>
    ${ZONES[cote].map(([m, x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${col(m)}"><title>${esc(F.MUSCLES_FX.find(z => z.id === m).n)} : ${fr(vals[m] || 0)} séries</title></ellipse>`).join("")}</svg>`;
}

// ---------- Page « Mes muscles » (client) et muscles d'un client (coach) ----------
let PER = "7j";
routes.muscles = async () => {
  const id = isCoach() ? R.param : null;
  await E.loadLib?.().catch(() => { });
  let data = null, nom = "";
  if (id) {
    $app.innerHTML = header("Muscles", "", { back: "member/" + id }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
    try { const c = await cloud(), r = await c.memberData(id); data = r?.data || {}; nom = (window.__members || []).find(m => m.id === id)?.name || ""; } catch (e) { return toast(e.message); }
  }
  const vue = () => {
    const ws = S().workouts || [], from = PER === "sem" ? lundi() : addDays(today(), -6);
    const t = totaux(ws, from), vals = Object.fromEntries(Object.entries(t.muscles).map(([k, v]) => [k, v.eq]));
    const rec = F.recuperation(ws, mus);
    const pret = F.MUSCLES_FX.filter(m => !rec[m.id] || !rec[m.id].reste), pasPret = F.MUSCLES_FX.filter(m => rec[m.id]?.reste);
    return `<div class="mt8">${chips([["7j", "7 derniers jours"], ["sem", "Semaine en cours"]], PER, "fx-per")}</div>
      <div class="card mt12"><div class="corps2">${corps(vals, "face")}${corps(vals, "dos")}</div><p class="xs muted center" style="margin:4px 0 0">Plus c'est foncé, plus le muscle a reçu de séries · rouge : au-delà de ce qu'il récupère</p></div>
      <h2 class="sec">🔋 Récupération</h2>
      <div class="card">${pasPret.length ? `<div class="lbl">Encore en récupération</div>${pasPret.map(m => `<div class="li"><span class="grow small"><b>${esc(m.n)}</b><br><span class="xs muted">${fr(rec[m.id].eq)} séries le ${new Date(rec[m.id].le).toLocaleDateString("fr-FR", { weekday: "long" })}</span></span><span class="tag">encore ${rec[m.id].reste} h</span></div>`).join("")}` : `<p class="small" style="margin:0">Tous tes muscles sont récupérés.</p>`}
        <div class="lbl mt12">Prêts à être travaillés</div><p class="small" style="margin:4px 0 0">${pret.map(m => esc(m.n)).join(" · ") || "—"}</p>
        <p class="xs muted mt8" style="margin-bottom:0">Estimation : 1 à 2,5 jours selon le muscle, plus long après beaucoup de séries ou des séries à l'échec. Fie-toi aussi aux courbatures et à tes sensations.</p></div>
      <h2 class="sec">📊 Séries par faisceau <small>${PER === "sem" ? "semaine en cours" : "7 derniers jours"}</small></h2>
      ${F.MUSCLES_FX.map(m => { const v = t.muscles[m.id], L = repere(m.id); if (!v) return ""; const heads = m.f.filter(([h]) => t.heads[h]);
        return `<div class="card mt8"><div class="row between"><b>${esc(m.n)}</b><span class="small"><b>${fr(v.eq)}</b> <span class="xs muted">/ repère ${L.mav[0]}–${L.mav[1]}</span></span></div><div class="fxbar mt4"><i style="width:${Math.min(100, v.eq / L.mrv * 100)}%;background:${v.eq > L.mrv ? "#C8323F" : v.eq >= L.mav[0] ? "#2F6FED" : "#8FB3F5"}"></i></div>
          ${heads.map(([h, n]) => `<div class="row between xs" style="padding:2px 0"><span class="muted">${esc(n)}</span><span>${fr(t.heads[h].d)} dir.${t.heads[h].i ? ` · ${fr(t.heads[h].i)} ind.` : ""}</span></div>`).join("")}</div>`; }).join("") || `<p class="empty">Aucune séance sur cette période.</p>`}`;
  };
  const body = data ? withState(data, vue) : vue();
  $app.innerHTML = header(id ? `Muscles · ${esc(nom.split(" ")[0])}` : "Mes muscles", "Volume, faisceaux et récupération", { back: id ? "member/" + id : "profile" }) + `<main class="page">${body}</main>${id ? "" : tabbar("profile")}`;
};
actions["fx-per"] = (b, d) => { PER = d.v; rerender(); };
