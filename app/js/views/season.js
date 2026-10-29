// Saison (macrocycle d'un an en blocs) et objectifs de performance.
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import { esc, num, fr, toast, actions, forms, changes, go, I, sheet, closeSheet, fmtDate, addDays, rerender } from "../core.js";
import { pickExercise } from "./train.js";

const monday = (d = today()) => addDays(d, -E.dowOf(d));
const fmtD = (d) => fmtDate(d, { day: "numeric", month: "short" });
const progName = (p) => p ? p.name.split("·")[0].trim() : "Programme supprimé";

// Modèles de saison : l'année découpée en blocs
const TEMPLATES = [
  ["Prise de muscle et force (1 an)", [["hyper", "tb-int4", 12], ["deload", "tb-dos4", 1], ["force", "tb-pb4", 8], ["hyper", "tb-int4", 12], ["deload", "tb-dos4", 1], ["force", "tbm-pl4", 12], ["test", "tbm-pl4", 2]]],
  ["Powerlifting : vers un test de maxima", [["hyper", "tbm-pb4", 12], ["force", "tbm-pl4", 12], ["power", "tbm-531", 12], ["test", "tbm-pl4", 2]]],
  ["Street lifting : tractions et dips lestés", [["hyper", "tb-int4", 8], ["force", "tbm-street", 12], ["force", "tb-ml4", 12], ["test", "tbm-street", 2]]],
  ["Reprise puis recomposition", [["reprise", "tb-rep3", 12], ["hyper", "tb-int3", 12], ["hyper", "tb-int4", 12]]],
];

export function seasonTimeline() {
  const bl = E.seasonBlocks(); if (!bl.length) return `<div class="card mt12"><div class="lbl">🗓️ Ma saison</div><p class="small muted mt4">Planifie ton année en blocs : hypertrophie, force, allègement, test.</p><button class="btn btn-line btn-sm mt8" data-a="go" data-r="train" data-p="saison">Planifier ma saison</button></div>`;
  const y0 = bl[0].from, y1 = bl.at(-1).to, span = Math.max(1, (new Date(y1) - new Date(y0)) / 864e5);
  const pos = (d) => Math.max(0, Math.min(100, (new Date(d) - new Date(y0)) / 864e5 / span * 100));
  const t = pos(today()), ticks = [];
  for (let d = new Date(y0 + "T12:00:00"); today(d) <= y1; d.setMonth(d.getMonth() + 3)) ticks.push(d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }));
  return `<div class="card mt12"><div class="row between"><span class="lbl">🗓️ Ma saison · ${fmtD(y0)} → ${fmtD(y1)}</span><button class="link xs" data-a="go" data-r="train" data-p="saison">Modifier</button></div>
    <div class="season-bar mt8">${bl.map(b => `<i style="left:${pos(b.from)}%;width:${Math.max(1, pos(b.to) - pos(b.from))}%;background:${E.FOCUS[b.focus]?.[1] || "#999"}" title="${esc(E.FOCUS[b.focus]?.[0] || "")}"></i>`).join("")}<b style="left:${t}%"></b></div>
    <div class="row between xs muted mt4">${ticks.map(x => `<span>${x}</span>`).join("")}</div>
    <div class="season-key mt8">${[...new Set(bl.map(b => b.focus))].map(f => `<span><i style="background:${E.FOCUS[f]?.[1]}"></i>${E.FOCUS[f]?.[0]}</span>`).join("")}</div>
    ${bl.find(b => b.cur) ? `<p class="xs muted mt8" style="margin-bottom:0">En cours : <b style="color:var(--ink)">${esc(E.FOCUS[bl.find(b => b.cur).focus]?.[0])}</b> jusqu'au ${fmtD(bl.find(b => b.cur).to)}</p>` : ""}</div>`;
}

export function goalsMini() {
  const gs = (S().goals || []).filter(g => g.date >= today()); if (!gs.length) return "";
  return `<button class="card tap" data-a="go" data-r="train" data-p="saison" style="display:block;width:100%;text-align:left"><div class="lbl">🎯 Mes objectifs</div>${gs.slice(0, 3).map(g => { const st = E.goalStatus(g); return `<div class="mt8"><div class="row between small"><b>${esc(g.name)}</b><span>${fr(st.cur, 1)} → ${fr(st.tgt, 1)} kg</span></div><div class="gauge mt4"><i style="width:${Math.round(st.pct * 100)}%"></i></div><div class="xs muted mt4">${goalLine(g, st)}</div></div>`; }).join("")}</button>`;
}
function goalLine(g, st) {
  if (st.done) return "Objectif atteint 🎉";
  const when = fmtDate(g.date, { day: "numeric", month: "long", year: "numeric" });
  const r = st.rate ? `${st.rate > 0 ? "+" : ""}${fr(st.rate, 2)} kg/sem. ces 8 semaines` : "rythme connu après quelques séances";
  return `${fr(g.kg, 1)} kg × ${g.reps} le ${when} · il faut +${fr(Math.max(0, st.need), 2)} kg/sem. · ${r}${st.eta ? ` · à ce rythme : ${st.eta} sem.` : ""}`;
}

export function seasonBody() {
  const se = S().season, bl = E.seasonBlocks(), goals = S().goals || [];
  return `<h2 class="sec">🎯 Mes objectifs de performance</h2>
    ${goals.length ? goals.map((g, i) => { const st = E.goalStatus(g); return `<div class="card mt8"><div class="row between"><b>${esc(g.name)}</b><button class="link xs" data-a="goal-del" data-i="${i}" style="color:var(--red)">Supprimer</button></div>
      <div class="row between mt8"><span class="num" style="font-size:24px">${fr(g.kg, 1)} kg × ${g.reps}</span><span class="small muted">avant le ${fmtD(g.date)} ${new Date(g.date).getFullYear()}</span></div>
      <div class="gauge mt8"><i style="width:${Math.round(st.pct * 100)}%"></i></div>
      <div class="row between xs muted mt4"><span>départ ${fr(st.start, 1)}</span><span>aujourd'hui <b style="color:var(--ink)">${fr(st.cur, 1)}</b></span><span>cible ${fr(st.tgt, 1)} (1RM est.)</span></div>
      <p class="small mt8" style="margin-bottom:0">${st.done ? "Objectif atteint 🎉 Fixe la marche suivante." : st.ahead ? `✅ En avance sur ta trajectoire (${fr(st.traj, 1)} kg prévu aujourd'hui).` : `⏳ Trajectoire du jour : ${fr(st.traj, 1)} kg. Il faut gagner ${fr(Math.max(0, st.need), 2)} kg de 1RM par semaine.`}</p>
      <p class="xs muted mt4" style="margin-bottom:0">${st.rate != null ? `Ton rythme réel : ${st.rate > 0 ? "+" : ""}${fr(st.rate, 2)} kg/semaine${st.eta ? `, objectif atteint dans ~${st.eta} semaines` : ""}.` : "Ton rythme réel s'affiche après 3 séances sur cet exercice."} Quand une séance est facile, le saut de charge proposé tient compte de cet objectif.</p></div>`; }).join("") : `<p class="small muted">Ex. 60 kg aux tractions lestées, 140 kg au squat. L'objectif fixe le rythme à tenir et guide les sauts de charge.</p>`}
    <button class="btn btn-line btn-sm mt8" data-a="goal-add" style="width:100%">+ Ajouter un objectif</button>

    <h2 class="sec">🗓️ Ma saison <small>${bl.length ? `${bl.reduce((a, b) => a + b.weeks, 0)} semaines` : "planifie ton année"}</small></h2>
    ${bl.length ? `<div class="card"><label class="field"><span>Début de la saison</span><input type="date" value="${se.start}" data-c="season-start"></label></div>
      ${seasonTimeline()}
      <div class="list mt12">${bl.map(b => `<div class="li" style="gap:8px;align-items:flex-start;${b.cur ? "box-shadow:inset 3px 0 0 var(--red);padding-left:10px" : ""}"><i class="dot" style="background:${E.FOCUS[b.focus]?.[1]};margin-top:6px"></i><span class="grow"><b class="small">${esc(E.FOCUS[b.focus]?.[0] || "Bloc")} · ${b.weeks} sem.</b>${b.cur ? ` <span class="tag r">en cours</span>` : ""}<br><span class="xs">${esc(progName(b.p))}</span><br><span class="xs muted">${fmtD(b.from)} → ${fmtD(b.to)}</span></span>
        <span class="col" style="gap:4px"><button class="icon-btn sm" data-a="blk-mv" data-i="${b.i}" data-v="-1" ${b.i ? "" : "disabled style=\"opacity:.3\""} aria-label="Monter">↑</button><button class="icon-btn sm" data-a="blk-edit" data-i="${b.i}" aria-label="Modifier">✏️</button></span></div>`).join("")}</div>
      <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="blk-add">+ Ajouter un bloc</button><button class="btn btn-ghost btn-sm" data-a="season-clear" style="color:var(--red)">Effacer</button></div>
      <p class="xs muted mt8">À la fin d'un bloc, ton programme passe tout seul au bloc suivant. Tu peux toujours changer de programme à la main.</p>`
    : `<div class="card"><p class="small" style="margin-top:0">Une saison, c'est ton année découpée en blocs : un bloc d'hypertrophie de 12 semaines, une semaine d'allègement, un bloc de force de 5 à 8 semaines, puis un test. Chaque bloc suit un programme ; l'app enchaîne les blocs pour toi.</p>
      <div class="lbl mt12">Partir d'un modèle</div><div class="list mt8">${TEMPLATES.map(([n, b], i) => `<button class="li" data-a="season-tpl" data-i="${i}"><span class="grow small"><b>${esc(n)}</b><br><span class="xs muted">${b.map(([f, , w]) => `${E.FOCUS[f][0]} ${w} sem.`).join(" → ")}</span></span>${I.chev}</button>`).join("")}</div>
      <button class="btn btn-line btn-sm mt12" data-a="season-new" style="width:100%">Ou commencer avec mon programme actuel</button></div>`}`;
}

// ---------- Actions : saison ----------
actions["season-tpl"] = (b, d) => {
  const [, blocks] = TEMPLATES[+d.i];
  const ok = blocks.filter(([, id]) => E.program(id));
  update(st => { st.season = { start: monday(), cur: 0, blocks: ok.map(([focus, programId, weeks], k) => ({ id: Date.now() + k, focus, programId, weeks })) }; });
  if (!S().current && ok[0] && S().plan?.programId !== ok[0][1] && confirm(`Commencer maintenant le premier bloc (${progName(E.program(ok[0][1]))}) ?`)) update(st => st.plan = { programId: ok[0][1], startedAt: today(), week: 1, idx: 0, cycle: 1 });
  toast("Saison créée"); rerender();
};
actions["season-new"] = () => { const pl = S().plan; update(st => st.season = { start: monday(pl?.startedAt || today()), cur: 0, blocks: [{ id: Date.now(), focus: "hyper", programId: pl?.programId || "tb-int4", weeks: E.weeksOf(E.program(pl?.programId || "tb-int4")) }] }); rerender(); };
actions["season-clear"] = () => { if (!confirm("Effacer toute la saison ? Ton programme actuel ne change pas.")) return; update(st => st.season = null); rerender(); };
actions["blk-mv"] = (b, d) => { update(st => { const a = st.season.blocks, i = +d.i, j = i - 1; if (j < 0) return; [a[i], a[j]] = [a[j], a[i]]; }); rerender(); };
actions["blk-add"] = () => blockSheet(null);
actions["blk-edit"] = (b, d) => blockSheet(+d.i);
function blockSheet(i) {
  const b = i == null ? { focus: "force", programId: S().plan?.programId || "tb-pb4", weeks: 8 } : S().season.blocks[i];
  sheet(`<h2 class="h2">${i == null ? "Nouveau bloc" : "Modifier le bloc"}</h2>
    <form data-f="blk" data-i="${i ?? ""}" class="mt12"><label class="field"><span>Objectif du bloc</span><select name="focus">${Object.entries(E.FOCUS).map(([k, [l]]) => `<option value="${k}" ${b.focus === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field mt8"><span>Programme suivi</span><select name="programId">${E.programs().map(p => `<option value="${p.id}" ${p.id === b.programId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
    <label class="field mt8"><span>Durée (semaines)</span><input name="weeks" inputmode="numeric" value="${b.weeks}"></label>
    <button class="btn btn-red mt12">Enregistrer</button>${i != null ? `<button type="button" class="btn btn-line mt8" data-a="blk-del" data-i="${i}" style="color:var(--red)">Supprimer ce bloc</button>` : ""}</form>`);
}
forms.blk = (v, f) => {
  const w = Math.round(num(v.weeks)); if (!(w >= 1 && w <= 52)) return toast("Durée invalide");
  const i = f.dataset.i === "" ? null : +f.dataset.i;
  update(st => { const blk = { id: Date.now(), focus: v.focus, programId: v.programId, weeks: w }; if (i == null) st.season.blocks.push(blk); else st.season.blocks[i] = { ...st.season.blocks[i], ...blk, id: st.season.blocks[i].id }; });
  closeSheet(); rerender();
};
actions["blk-del"] = (b, d) => { update(st => { st.season.blocks.splice(+d.i, 1); if ((st.season.cur || 0) >= st.season.blocks.length) st.season.cur = Math.max(0, st.season.blocks.length - 1); }); closeSheet(); rerender(); };
changes["season-start"] = (el) => { if (el.value) update(st => st.season.start = el.value); rerender(); };

// ---------- Actions : objectifs ----------
actions["goal-add"] = async () => {
  await Promise.all([E.loadFiches(), E.loadLib()]);
  pickExercise((n) => goalSheet(n), "Objectif sur quel exercice ?");
};
function goalSheet(name) {
  const cur = Math.round(E.currentE1rm(name) * 10) / 10;
  sheet(`<h2 class="h2">🎯 ${esc(name)}</h2><p class="small muted">${cur ? `Ton 1RM estimé aujourd'hui : <b>${fr(cur, 1)} kg</b>${/lest/i.test(name) ? " de lest" : ""}.` : "Pas encore de séance sur cet exercice : l'objectif se calera dès la première."}</p>
    <form data-f="goal" data-n="${esc(name)}" class="mt12"><div class="grid2"><label class="field"><span>Charge visée (kg${/lest/i.test(name) ? " de lest" : ""})</span><input name="kg" inputmode="decimal" required placeholder="ex. 60"></label><label class="field"><span>Pour combien de reps</span><input name="reps" inputmode="numeric" value="1"></label></div>
    <label class="field mt8"><span>Avant le</span><input type="date" name="date" value="${addDays(today(), 7 * 24)}" min="${addDays(today(), 7)}" required></label>
    <button class="btn btn-red mt12">Fixer l'objectif</button></form>`);
}
forms.goal = (v, f) => {
  const kg = num(v.kg), reps = Math.max(1, Math.min(20, Math.round(num(v.reps)) || 1));
  if (!(kg > 0)) return toast("Charge invalide");
  const name = f.dataset.n, start = Math.round(E.currentE1rm(name) * 10) / 10 || 0;
  update(st => (st.goals = st.goals || []).push({ id: Date.now(), name, kg, reps, date: v.date, start, created: today() }));
  closeSheet(); toast("Objectif fixé"); go("train", "saison");
};
actions["goal-del"] = (b, d) => { if (!confirm("Supprimer cet objectif ?")) return; update(st => st.goals.splice(+d.i, 1)); rerender(); };
