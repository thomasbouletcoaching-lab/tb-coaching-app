// Écran « Volume de la semaine » : on choisit tout le travail de la semaine, on lit le volume par muscle et par faisceau
// (MV, MEV, MAV, MRV), puis on le répartit sur les jours. Le résultat devient les séances du programme dans l'éditeur.
// Même écran pour le coach (programme d'un membre) et pour le client (son propre programme).
// Brouillon gardé sur le téléphone et dans Supabase (table programme_drafts).
import * as E from "../engine.js";
import * as V from "../volume.js";
import { S, withState } from "../store.js";
import { $app, esc, toast, routes, actions, changes, header, go, isCoach, cloud, sheet, closeSheet, rerender, num, modeBar } from "../core.js";
import { builderDraft, setBuilderDraft, blankDraft, pickExercise } from "./train.js";

const DAYS = E.DAY_NAMES, SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const TABS = [["ex", "1 · Exercices"], ["vol", "2 · Volume"], ["split", "3 · Split"], ["jours", "4 · Jours"]];
const NEXT = { ex: ["vol", "Voir le volume →"], vol: ["split", "Organiser le split →"], split: ["jours", "Répartir sur les jours →"] };
const VARIANTS = ["", "lourd", "volume", "technique", "vitesse", "léger"];
let VP = null; // { memberId, memberName, lines, days, lm, seuils, tab, open, md }
const fmt = (v) => String(V.round5(v)).replace(".", ",");
const kg = (v) => v == null ? "–" : `${String(Math.round(v * 4) / 4).replace(".", ",")} kg`;
const keyOf = (mid) => "cxs.vol." + (mid || "self");

// ---------- Contexte : 1RM estimés et poids du corps (du client, ou du membre pour le coach) ----------
const bwOfName = (n) => /lest/i.test(n) || E.isBodyweight(n);
function ctx(md = VP?.md) {
  const run = (fn) => md ? withState(md, fn) : fn();
  const bw = run(() => { const d = Object.entries(S().daily || {}).filter(([, v]) => v.weight).sort().at(-1); return +(d?.[1].weight) || +S().profile?.weight || 0; });
  return { bw, e1: (n) => { const e = run(() => E.currentE1rm(n)) || 0; return e && /lest/i.test(n) ? e + bw : e; } };
}
const musclesOf = (n) => E.musclesOf(n);
const opts = () => ({ musclesOf, ctx: ctx(), lm: lmNow() });
const lmNow = () => V.landmarks(VP?.seuils, VP?.lm);

// ---------- Sauvegarde : téléphone tout de suite, serveur après une courte pause ----------
let saveT = null;
const snapshot = () => ({ lines: VP.lines, days: VP.days, plan: VP.plan || {}, lm: VP.lm || null, name: builderDraft()?.name || "" });
// Anciennes lignes sans identifiant (avant le split)
const fixLines = (ls) => (ls || []).map(l => ({ lbl: "", ...l, id: l.id || V.newId() }));
function persist(status = "draft") {
  if (!VP) return;
  try { localStorage.setItem(keyOf(VP.memberId), JSON.stringify({ ...snapshot(), at: new Date().toISOString() })); } catch { }
  clearTimeout(saveT);
  saveT = setTimeout(async () => { try { const c = await cloud(); if (c) await c.volDraftSet(VP.memberId, snapshot().name || "Brouillon", snapshot(), status); } catch (e) { console.warn("Brouillon non envoyé :", e.message); } }, status === "publie" ? 0 : 900);
}
function localDraft(mid) { try { return JSON.parse(localStorage.getItem(keyOf(mid)) || "null"); } catch { return null; } }

// Ouvre l'écran depuis l'éditeur : le plan de volume du programme, sinon ses exercices, sinon le dernier brouillon
function weekPlanOf(r, w, p) {
  const x = r[5] ? E.migrateRow(JSON.parse(JSON.stringify(r[5]))) : null;
  return x && (x.sets?.length || Object.keys(x.weeks || {}).length) ? E.weekPlan(x, w, p) : { sets: E.parseSets(E.schemeFor(p, r, w)) };
}
function linesFromProgram(p, w = 1, days = null) {
  const on = (days || p.days || []).map((x, i) => x ? i : -1).filter(i => i >= 0);
  return V.fromProgram(p, { w, weekPlan: weekPlanOf, bwOf: bwOfName, dayIndex: (se, si) => DAYS.includes(se[1]) ? DAYS.indexOf(se[1]) : on[si] ?? null });
}
actions["vol-open"] = async () => {
  let d = builderDraft(); if (!d) { d = blankDraft(); setBuilderDraft(d); }
  const memberId = d.forMember?.id || null;
  VP = { memberId, memberName: d.forMember?.name || "", lines: [], days: Array.isArray(d.days) && d.days.length === 7 ? [...d.days] : [true, false, true, false, true, false, false], lm: null, plan: {}, seuils: null, tab: "ex", open: {}, md: null, from: "" };
  const hasEx = (d.s || []).some(s => s[2]?.length);
  if (d.vplan?.lines?.length) { VP.lines = fixLines(JSON.parse(JSON.stringify(d.vplan.lines))); VP.days = d.vplan.days || VP.days; VP.lm = d.vplan.lm || null; VP.plan = JSON.parse(JSON.stringify(d.vplan.plan || {})); VP.from = "plan"; }
  else if (hasEx) { VP.lines = linesFromProgram(d, 1, VP.days); VP.from = "prog"; }
  else { const loc = localDraft(memberId); if (loc?.lines?.length) { VP.lines = fixLines(loc.lines); VP.days = loc.days || VP.days; VP.lm = loc.lm || null; VP.plan = loc.plan || {}; VP.from = "local"; } }
  go("volume");
  // Serveur : seuils du client, données du membre (1RM, poids), brouillon plus récent
  try {
    const c = await cloud(); if (!c) return;
    const [seuils, md, cloudD] = await Promise.all([
      c.volSeuilsGet(memberId).catch(() => null),
      memberId ? c.memberData(memberId).then(r => r?.data || null).catch(() => null) : null,
      !VP.from || VP.from === "local" ? c.volDraftGet(memberId).catch(() => null) : null,
    ]);
    if (!VP) return;
    VP.seuils = seuils?.lm || null; VP.md = md;
    const loc = localDraft(memberId);
    if (cloudD?.data?.lines?.length && (!loc?.at || new Date(cloudD.updated_at) > new Date(loc.at))) { VP.lines = fixLines(cloudD.data.lines); VP.days = cloudD.data.days || VP.days; VP.lm = cloudD.data.lm || null; VP.plan = cloudD.data.plan || {}; toast("Brouillon repris"); }
    rerender();
  } catch { }
};

// ---------- Rendu ----------
function gauge(v, L, { small = false } = {}) {
  const st = V.statusOf(v, L), max = Math.max(L.mrv * 1.2, v * 1.05, 4), p = (x) => Math.min(100, x / max * 100);
  const z = [[0, L.mv, "#C8202B33"], [L.mv, L.mev, "#E07B1F33"], [L.mev, L.mav[0], "#1E8F4E26"], [L.mav[0], L.mav[1], "#1E8F4E55"], [L.mav[1], L.mrv, "#C99A0640"], [L.mrv, max, "#C8202B33"]];
  return `<div class="vbar${small ? " sm" : ""}" role="img" aria-label="${fmt(v)} séries, ${st.n}">${z.filter(([a, b]) => b > a).map(([a, b, c]) => `<i style="left:${p(a)}%;width:${p(b) - p(a)}%;background:${c}"></i>`).join("")}<b style="left:${p(v)}%;background:${st.c}"></b></div>`;
}
const lmTxt = (L) => `MV ${fmt(L.mv)} · MEV ${fmt(L.mev)} · MAV ${fmt(L.mav[0])}-${fmt(L.mav[1])} · MRV ${fmt(L.mrv)}`;
function gaugesHtml(lines, o, open = {}) {
  const Vol = V.computeVolume(lines, o), lm = o.lm;
  const worked = V.GROUPS.filter(g => Vol.byG[g.id] || lm[g.id].mv > 0), idle = V.GROUPS.filter(g => !worked.includes(g));
  return worked.map(g => {
    const v = Vol.byG[g.id] || 0, L = lm[g.id], st = V.statusOf(v, L), multi = g.f.length > 1;
    return `<div class="vg mt8"><button class="row between" style="width:100%;text-align:left;gap:8px" data-a="vol-g" data-v="${g.id}"><b class="small">${esc(g.n)}${multi ? ` <span class="xs muted">${open[g.id] ? "▾" : "▸"} faisceaux</span>` : ""}</b><span class="small" style="color:${st.c};font-weight:700;white-space:nowrap">${fmt(v)} · ${esc(st.n)}</span></button>
      ${gauge(v, L)}<div class="xs muted">${lmTxt(L)}${g.ind ? " · repère indicatif" : ""}</div>
      ${multi && open[g.id] ? `<div class="mt4">${g.f.map(f => { const fv = Vol.byF[f] || 0, FL = V.faisceauLm(f, lm), fs = V.statusOf(fv, FL); return `<div class="mt8" style="padding-left:10px;border-left:2px solid var(--line)"><div class="row between xs"><span>${esc(V.fLabel(f))}</span><span style="color:${fs.c};font-weight:700">${fmt(fv)} · ${esc(fs.n)}</span></div>${gauge(fv, FL, { small: true })}<div class="xs muted">indicatif · ${lmTxt(FL)}</div></div>`; }).join("")}</div>` : ""}</div>`;
  }).join("") + (idle.length ? `<p class="xs muted mt12">Non travaillés : ${idle.map(g => esc(g.n)).join(", ")}.</p>` : "");
}
function forceHtml(lines, o) {
  const fl = lines.filter(l => l.force && V.lineSets(l, o.ctx));
  if (!fl.length) return `<p class="xs muted">Coche « Force » sur un exercice (onglet 1) pour suivre ici son travail hebdomadaire.</p>`;
  return `<div class="vtab"><div class="vtab-h"><span>Mouvement</span><span>Séries</span><span>Charge</span><span>Tonnage</span></div>${fl.map(l => {
    const n = V.lineSets(l, o.ctx), ch = V.chargeOf(l, o.ctx), t = V.lineTonnage(l, o.ctx, n), it = l.it || {};
    return `<div class="vtab-r"><span><b>${esc(l.n)}</b><br><span class="muted">${l.lo}${+l.hi !== +l.lo ? "-" + l.hi : ""} reps · ${it.t === "pct" ? fmt(it.v) + " %" : it.t === "kg" ? (l.bw ? "lest " : "") + kg(+it.v) : "RPE " + fmt(it.v)}</span></span><span>${n}</span><span>${ch.total ? kg(ch.total) + (l.bw && ch.lest != null ? `<br><span class="muted">lest ${kg(ch.lest)}</span>` : "") : "–"}</span><span>${t ? (t / 1000).toFixed(1).replace(".", ",") + " t" : "–"}</span></div>`;
  }).join("")}</div><p class="xs muted mt4">Charge et tonnage calculés sur le 1RM estimé${VP?.md || !VP?.memberId ? "" : " (inconnu pour ce membre : saisis une charge en kg)"}. Lestés : % sur poids du corps + lest, puis le lest seul.</p>`;
}
const warnHtml = (list) => list.length ? `<div class="card mt12" style="box-shadow:0 0 0 2px var(--warn) inset"><div class="lbl">⚠️ À vérifier <span class="xs muted">(rien n'est bloqué)</span></div>${list.map(m => `<p class="small mt8" style="margin-bottom:0">${m.lvl === "warn" ? "🔸" : "▫️"} ${esc(m.txt)}</p>`).join("")}</div>` : "";

function exTab() {
  const o = opts();
  if (!VP.lines.length) return `<div class="card soft mt12"><b>Commence par le travail de la semaine</b><p class="small muted mt4">Ajoute tous les exercices que tu veux faire dans la semaine et le nombre de séries de chacun. Tu verras le volume par muscle, puis tu répartiras sur tes jours.</p></div><button class="btn btn-red mt12" style="width:100%" data-a="vol-add">+ Ajouter des exercices</button>`;
  return VP.lines.map((l, i) => {
    const fx = V.faisceauxOf(l.n, musclesOf, l.fx), n = V.lineSets(l, o.ctx), t = V.lineTonnage(l, o.ctx, n), ch = V.chargeOf(l, o.ctx), it = l.it || { t: "rpe", v: 8 };
    return `<div class="card mt8" style="padding:12px"><div class="row between" style="gap:6px;align-items:flex-start"><div class="grow"><b class="small" style="color:var(--red)">${esc(V.lineName(l))}</b><br><span class="xs muted">${fx.map(x => `${esc(V.fLabel(x.f))} ×${fmt(x.c)}`).join(" · ") || "aucun muscle reconnu : règle les faisceaux"}</span></div>
      <button class="icon-btn sm" data-a="vol-dup" data-l="${i}" aria-label="Dupliquer en variante (ex. lourd + volume)">⧉</button><button class="icon-btn sm" data-a="vol-fx" data-l="${i}" aria-label="Régler les faisceaux">⚙️</button><button class="icon-btn sm" data-a="vol-del" data-l="${i}" aria-label="Retirer ${esc(l.n)}">✕</button></div>
      <div class="row mt8" style="gap:6px;flex-wrap:wrap"><button class="chip sm ${l.mode !== "ton" ? "on" : ""}" data-a="vol-mode" data-l="${i}" data-v="series">Séries</button><button class="chip sm ${l.mode === "ton" ? "on" : ""}" data-a="vol-mode" data-l="${i}" data-v="ton">Tonnage</button><button class="chip sm ${l.force ? "on" : ""}" data-a="vol-force" data-l="${i}">🏋️ Force</button><select class="chip sm" data-c="vol-f" data-l="${i}" data-k="lbl" aria-label="Variante" style="width:auto;padding:4px 8px">${VARIANTS.map(v => `<option value="${v}" ${(l.lbl || "") === v ? "selected" : ""}>${v ? "Variante : " + v : "Variante…"}</option>`).join("")}</select>${l.bw ? `<span class="tag">poids du corps${ch.lest != null ? ` · lest ${kg(ch.lest)}` : ""}</span>` : ""}</div>
      <div class="grid3 mt8">${l.mode === "ton" ? `<label class="field"><span>Tonnage / sem. (kg)</span><input data-c="vol-f" data-l="${i}" data-k="ton" inputmode="numeric" value="${l.ton ?? ""}" placeholder="ex. 3000"></label>` : `<div class="field"><span>Séries / sem.</span><div class="vstep"><button data-a="vol-sets" data-l="${i}" data-v="-1" aria-label="Moins une série">−</button><b>${n}</b><button data-a="vol-sets" data-l="${i}" data-v="1" aria-label="Plus une série">+</button></div></div>`}
        <label class="field"><span>Reps</span><input data-c="vol-f" data-l="${i}" data-k="reps" value="${l.lo}${+l.hi !== +l.lo ? "-" + l.hi : ""}" placeholder="8-12"></label>
        <label class="field"><span>Intensité</span><span class="row" style="gap:4px"><select data-c="vol-f" data-l="${i}" data-k="it.t" aria-label="Type d'intensité" style="flex:1 1 52%"><option value="rpe" ${it.t === "rpe" ? "selected" : ""}>RPE</option><option value="pct" ${it.t === "pct" ? "selected" : ""}>% 1RM</option><option value="kg" ${it.t === "kg" ? "selected" : ""}>${l.bw ? "lest kg" : "kg"}</option></select><input data-c="vol-f" data-l="${i}" data-k="it.v" inputmode="decimal" value="${it.v ?? ""}" aria-label="Valeur d'intensité" style="flex:1 1 48%"></span></label></div>
      <p class="xs muted" style="margin:6px 0 0">${l.mode === "ton" ? (+l.ton > 0 && ch.total ? `→ <b>${n} séries</b> de ${repsLbl(l)} à ${kg(ch.total)} pour ${fmt(l.ton)} kg` : "Indique le tonnage et une charge (kg, ou % avec un 1RM connu) pour en déduire les séries.") : t ? `Tonnage : ${(t / 1000).toFixed(1).replace(".", ",")} t / semaine${ch.total ? ` à ${kg(ch.total)}` : ""}` : ""}</p></div>`;
  }).join("") + `<button class="btn btn-line mt12" style="width:100%" data-a="vol-add">+ Ajouter des exercices</button>`;
}
const repsLbl = (l) => `${l.lo}${+l.hi !== +l.lo ? "-" + l.hi : ""} reps`;
function volTab() {
  const o = opts();
  return `<div class="row between mt12"><h3 class="sec" style="margin:0">Volume par muscle <small>séries / semaine</small></h3><button class="btn btn-ghost btn-xs" data-a="vol-lm" style="width:auto">Ajuster les seuils</button></div>
    <p class="xs muted">Série directe = 1, muscle secondaire = 0,5. Repères d'après Israetel (RP), à adapter : expérience, sommeil, âge, phase du bloc.${VP.lm || VP.seuils ? " <b>Seuils personnalisés actifs.</b>" : ""}</p>
    <div class="card">${gaugesHtml(VP.lines, o, VP.open)}</div>
    <h3 class="sec">Mouvements de force <small>travail hebdomadaire</small></h3><div class="card">${forceHtml(VP.lines, o)}</div>
    ${warnHtml(V.checks(VP.lines, VP.days, o).filter(m => !/placée/.test(m.txt)))}`;
}
function daysTab() {
  const o = opts(), on = VP.days.map((x, i) => x ? i : -1).filter(i => i >= 0);
  const lines = VP.lines.map((l, i) => {
    const n = V.lineSets(l, o.ctx), p = V.placed(l);
    return `<div class="card mt8" style="padding:10px 12px"><div class="row between" style="gap:6px"><b class="small">${esc(V.lineName(l))}</b><span class="tag ${p === n ? "g" : "r"}">${p}/${n} placées</span></div>
      <div class="vdays mt8" style="grid-template-columns:repeat(${Math.max(1, on.length)},1fr)">${on.map(d => `<div class="vday"><span class="xs muted">${SHORT[d]}${VP.plan?.[d]?.pins?.includes(l.id) ? " 📌" : ""}</span><div class="vstep sm"><button data-a="vol-split" data-l="${i}" data-d="${d}" data-v="-1" aria-label="Moins une série le ${DAYS[d]}">−</button><b>${+l.split?.[d] || 0}</b><button data-a="vol-split" data-l="${i}" data-d="${d}" data-v="1" aria-label="Plus une série le ${DAYS[d]}">+</button></div></div>`).join("")}</div></div>`;
  }).join("");
  const perDay = on.map(d => {
    const Vd = V.computeVolume(VP.lines, { ...o, day: d }), top = Object.entries(Vd.byG).sort((a, b) => b[1] - a[1]);
    return `<div class="li" style="align-items:flex-start"><span class="grow small"><b>${DAYS[d]}</b>${V.splitName(VP.plan, d) ? ` <span class="xs muted">(${esc(V.splitName(VP.plan, d))})</span>` : ""} · ${Vd.total} séries<br><span class="xs muted">${top.length ? top.map(([id, v]) => `<span style="${v > V.SESSION_CAP ? "color:var(--red);font-weight:700" : ""}">${esc(V.groupById(id).n)} ${fmt(v)}</span>`).join(" · ") : "repos"}</span></span></div>`;
  }).join("");
  return `<div class="lbl mt12">Jours d'entraînement</div><div class="row mt4" style="gap:4px">${E.DAY_SHORT.map((x, i) => `<button class="chip sm ${VP.days[i] ? "on" : ""}" data-a="vol-day" data-v="${i}" style="padding:6px 10px" aria-label="${DAYS[i]}">${x}</button>`).join("")}</div>
    ${hasPlan() ? `<button class="btn btn-red btn-sm mt12" style="width:100%" data-a="vol-bysplit">🗓️ Répartir selon le split</button>` : ""}
    <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="vol-auto">✨ Proposer une répartition</button><button class="btn btn-ghost btn-sm" data-a="vol-clear" style="width:auto">Tout retirer</button></div>
    <p class="xs muted mt4">La proposition étale chaque exercice (4 séries max par exercice et par séance) là où son muscle est le moins chargé. Tu ajustes ensuite à la main.</p>
    ${VP.lines.length ? lines : `<p class="empty small">Ajoute d'abord des exercices (onglet 1).</p>`}
    ${on.length ? `<h3 class="sec">Par séance</h3><div class="list">${perDay}</div>` : ""}
    ${warnHtml([...V.checks(VP.lines, VP.days, o), ...(hasPlan() ? V.splitChecks(VP.lines, VP.days, VP.plan, o) : [])])}
    <button class="btn btn-red mt16" style="width:100%" data-a="vol-build">Créer les séances du programme</button>
    <p class="xs muted mt8">Une séance par jour, mouvements de force en premier. Tu règles ensuite la surcharge semaine par semaine dans l'éditeur.</p>`;
}

// ---------- Split : quel jour pour quel muscle (et quels mouvements imposés) ----------
const hasPlan = () => VP.days.some((x, d) => x && VP.plan?.[d]?.f?.length);
const fChip = (d, f, on, short) => `<button class="chip sm ${on ? "on" : ""}" data-a="vol-sf" data-d="${d}" data-v="${esc(f)}" aria-pressed="${on}">${esc(short)}</button>`;
const F_SHORT = { "Pecs-haut": "Pecs haut", "Pecs-milieu": "Pecs milieu", "Pecs-bas": "Pecs bas", "Dos-largeur": "Dos largeur", "Dos-épaisseur": "Dos épaisseur", "Épaules-avant": "Delt. avant", "Épaules-latéral": "Delt. latéral", "Épaules-arrière": "Delt. arrière", Ischios: "Ischios" };
function freqHtml(o, lines = VP.lines) {
  const on = VP.days.map((x, i) => x ? i : -1).filter(i => i >= 0), F = V.frequency(lines, VP.days, VP.plan, o);
  const rows = V.GROUPS.filter(g => F[g.id]);
  if (!rows.length || !on.length) return `<p class="xs muted">Choisis des muscles pour tes jours : la fréquence par muscle s'affichera ici.</p>`;
  const cols = `minmax(0,1.7fr) repeat(${on.length},minmax(0,1fr)) minmax(0,.9fr)`;
  return `<div class="vfreq" style="grid-template-columns:${cols}"><span></span>${on.map(d => `<span class="h">${SHORT[d]}</span>`).join("")}<span class="h">/sem</span>
    ${rows.map(g => { const r = F[g.id]; return `<span class="m">${esc(g.n)}</span>${on.map(d => { const v = r.per[d], pl = r.planned.includes(d); return `<span class="c ${pl ? "p" : ""}" title="${pl ? "prévu" : ""}">${v ? fmt(v) : pl ? "·" : ""}</span>`; }).join("")}<span class="c f ${r.freq >= 2 && r.freq <= 3 ? "ok" : r.freq ? "lo" : ""}">${r.freq}×</span>`; }).join("")}</div>
    <p class="xs muted mt4">Aperçu si tu répartis le volume selon ce split. Case colorée = muscle prévu ce jour-là ; chiffre = séries de ce muscle ce jour-là. Visée habituelle : chaque muscle 2 à 3 fois par semaine, 48 h entre deux grosses séances.</p>`;
}
function splitTab() {
  const o = opts();
  // Aperçu : le volume réparti selon le split tel qu'il est réglé (sans toucher à la répartition actuelle)
  const res = V.distributeBySplit(VP.lines, VP.days, VP.plan, o), proj = VP.lines.map((l, i) => ({ ...l, split: res[i] }));
  const days = DAYS.map((nm, d) => {
    if (!VP.days[d]) return `<button class="li" data-a="vol-day" data-v="${d}" style="width:100%;text-align:left"><span class="grow small muted">${nm} · repos</span><span class="xs">+ jour</span></button>`;
    const P = V.dayFocus(VP.plan, d), pins = VP.lines.filter(l => P.pins?.includes(l.id));
    return `<div class="card mt8" style="padding:12px"><div class="row between" style="gap:6px"><b>${nm}</b><span class="row" style="gap:6px"><select data-c="vol-st" data-d="${d}" aria-label="Type de séance du ${nm}" style="width:auto;padding:6px 8px">${Object.entries(V.SPLIT_TPL).map(([k, t]) => `<option value="${k}" ${P.t === k ? "selected" : ""}>${esc(t.n)}</option>`).join("")}</select><button class="icon-btn sm" data-a="vol-day" data-v="${d}" aria-label="Mettre ${nm} en repos">✕</button></span></div>
      <div class="lbl mt8">Muscles du jour</div>
      ${V.GROUPS.map(g => g.f.length > 1 ? g.f.map(f => fChip(d, f, P.f.includes(f), F_SHORT[f] || f)).join("") : fChip(d, g.f[0], P.f.includes(g.f[0]), F_SHORT[g.f[0]] || g.n)).reduce((a, h) => a + h, `<div class="row" style="gap:4px;flex-wrap:wrap">`) + "</div>"}
      <div class="lbl mt8">Mouvements imposés ce jour</div>
      <div class="row" style="gap:4px;flex-wrap:wrap">${VP.lines.length ? VP.lines.map(l => `<button class="chip sm ${P.pins?.includes(l.id) ? "on" : ""}" data-a="vol-pin" data-d="${d}" data-v="${l.id}">${P.pins?.includes(l.id) ? "📌 " : ""}${esc(V.lineName(l))}</button>`).join("") : `<span class="xs muted">Ajoute des exercices (onglet 1).</span>`}</div>
      ${pins.length ? `<p class="xs muted mt4" style="margin-bottom:0">Imposé : ${pins.map(l => esc(V.lineName(l))).join(", ")} ne sera placé que sur ${pins.length > 1 ? "ses" : "son"} jour${pins.length > 1 ? "s" : ""} imposé${pins.length > 1 ? "s" : ""}.</p>` : ""}</div>`;
  }).join("");
  return `<p class="small muted mt12">Choisis quel jour travaille quel muscle (ou faisceau), et place tes mouvements lourds. Le volume de la semaine se répartit ensuite tout seul entre les jours prévus pour chaque muscle.</p>
    <div class="lbl mt8">Semaines types</div><div class="row mt4" style="gap:4px;flex-wrap:wrap">${Object.entries(V.WEEK_PRESETS).map(([k, P]) => `<button class="chip sm" data-a="vol-preset" data-v="${k}">${esc(P.n)}</button>`).join("")}</div>
    ${days}
    <h3 class="sec">Fréquence par muscle</h3><div class="card">${freqHtml(o, proj)}</div>
    ${hasPlan() ? warnHtml([...V.splitChecks(proj, VP.days, VP.plan, o), ...V.checks(proj, VP.days, o).filter(m => / dans la même séance /.test(m.txt))]) : ""}`;
}
actions["vol-preset"] = (b, d) => {
  if (hasPlan() && !confirm("Remplacer le split actuel par cette semaine type ?")) return;
  const r = V.applyPreset(d.v); if (!r) return;
  // Les mouvements imposés restent sur leur jour s'il est toujours entraîné
  Object.entries(VP.plan || {}).forEach(([k, p]) => { if (r.plan[k] && p.pins?.length) r.plan[k].pins = p.pins; });
  VP.days = r.days; VP.plan = r.plan; VP.lines.forEach(l => { Object.keys(l.split || {}).forEach(k => { if (!VP.days[k]) delete l.split[k]; }); });
  touch(); toast(V.WEEK_PRESETS[d.v].n);
};
changes["vol-st"] = (el) => { const d = +el.dataset.d, t = el.value; VP.plan = VP.plan || {}; const pins = VP.plan[d]?.pins || []; VP.plan[d] = { t, f: t === "perso" ? [...(VP.plan[d]?.f || [])] : [...V.SPLIT_TPL[t].f], pins }; touch(); };
actions["vol-sf"] = (b, d) => {
  VP.plan = VP.plan || {}; const P = VP.plan[d.d] || (VP.plan[d.d] = { t: "perso", f: [], pins: [] });
  P.f = P.f.includes(d.v) ? P.f.filter(x => x !== d.v) : [...P.f, d.v]; touch();
};
actions["vol-pin"] = (b, d) => {
  VP.plan = VP.plan || {}; const P = VP.plan[d.d] || (VP.plan[d.d] = { t: "perso", f: [], pins: [] });
  P.pins = P.pins?.includes(d.v) ? P.pins.filter(x => x !== d.v) : [...(P.pins || []), d.v];
  // Un mouvement imposé apporte son muscle principal au jour
  const l = VP.lines.find(x => x.id === d.v), f0 = l && V.faisceauxOf(l.n, musclesOf, l.fx)[0]?.f;
  if (f0 && P.pins.includes(d.v) && !P.f.includes(f0)) P.f.push(f0);
  touch();
};
actions["vol-bysplit"] = () => {
  if (!hasPlan()) return toast("Choisis d'abord les muscles de tes jours");
  if (VP.lines.some(l => V.placed(l)) && !confirm("Remplacer la répartition actuelle par celle du split ?")) return;
  const res = V.distributeBySplit(VP.lines, VP.days, VP.plan, opts()); VP.lines.forEach((l, i) => { l.split = res[i]; });
  const miss = VP.lines.filter(l => V.lineSets(l, ctx()) && !V.placed(l)).length;
  VP.tab = "jours"; touch(); window.scrollTo(0, 0);
  toast(miss ? `${miss} exercice${miss > 1 ? "s" : ""} hors split : à placer à la main` : "Volume réparti selon le split");
};
actions["vol-dup"] = (b, d) => {
  const l = line(d), c = { ...JSON.parse(JSON.stringify(l)), id: V.newId(), split: {} };
  if (!l.lbl) { l.lbl = l.force ? "lourd" : "volume"; }
  c.lbl = l.lbl === "lourd" ? "volume" : l.lbl === "volume" ? "lourd" : "variante";
  if (c.lbl === "volume") { c.lo = 8; c.hi = 10; c.it = { t: "rpe", v: 8 }; c.mode = "series"; } else if (c.lbl === "lourd") { c.lo = 3; c.hi = 3; c.sets = 3; }
  VP.lines.splice(+d.l + 1, 0, c); touch(); toast(`${V.lineName(c)} ajouté`);
};

routes.volume = async () => {
  if (!VP) { await actions["vol-open"](); return; }
  await Promise.all([E.loadFiches(), E.loadLib()]);
  const o = opts(), Vol = V.computeVolume(VP.lines, o), lm = o.lm;
  const inZone = V.GROUPS.filter(g => ["prog", "opt"].includes(V.statusOf(Vol.byG[g.id] || 0, lm[g.id]).k)).length;
  const over = V.GROUPS.filter(g => V.statusOf(Vol.byG[g.id] || 0, lm[g.id]).k === "over").length;
  const body = VP.tab === "vol" ? volTab() : VP.tab === "split" ? splitTab() : VP.tab === "jours" ? daysTab() : exTab();
  $app.innerHTML = header("Volume de la semaine", esc(VP.memberName || builderDraft()?.name || ""), { back: "builder" }) + `<main class="page">
    ${modeBar(TABS, VP.tab, "vol-tab")}
    <div class="card soft mt8"><div class="row between small"><span><b>${VP.lines.length}</b> exercice${VP.lines.length > 1 ? "s" : ""} · <b>${Vol.total}</b> séries / sem.</span><span>${inZone} muscle${inZone > 1 ? "s" : ""} en progression${over ? ` · <b style="color:var(--red)">${over} au-delà du MRV</b>` : ""}</span></div></div>
    ${body}
    ${NEXT[VP.tab] && (VP.lines.length || VP.tab === "split") ? `<button class="btn btn-red mt16" style="width:100%" data-a="${VP.tab === "split" && hasPlan() ? "vol-bysplit" : "vol-tab"}" data-v="${NEXT[VP.tab][0]}">${VP.tab === "split" && hasPlan() ? "Répartir le volume selon ce split →" : NEXT[VP.tab][1]}</button>` : ""}
  </main>`;
};

// ---------- Actions ----------
const line = (d) => VP.lines[+d.l];
const touch = () => { persist(); rerender(); };
actions["vol-tab"] = (b, d) => { VP.tab = d.v; rerender(false); window.scrollTo(0, 0); };
actions["vol-g"] = (b, d) => { if (MINE) { MINE.open[d.v] = !MINE.open[d.v]; MINE.draw(); return; } VP.open[d.v] = !VP.open[d.v]; rerender(); };
actions["vol-add"] = async () => {
  await Promise.all([E.loadFiches(), E.loadLib()]);
  pickExercise((n) => { if (VP.lines.some(l => l.n === n)) return; VP.lines.push(V.newLine(n, { bw: bwOfName(n) })); persist(); }, "Travail de la semaine", { multi: true });
};
actions["vol-del"] = (b, d) => { VP.lines.splice(+d.l, 1); touch(); };
actions["vol-sets"] = (b, d) => { const l = line(d); l.sets = Math.max(0, Math.min(40, (+l.sets || 0) + +d.v)); touch(); };
actions["vol-mode"] = (b, d) => { const l = line(d); if (d.v === "ton" && !(+l.ton > 0)) { const t = V.lineTonnage(l, ctx()); if (t) l.ton = t; } else if (d.v === "series") l.sets = V.lineSets(l, ctx()); l.mode = d.v; touch(); };
actions["vol-force"] = (b, d) => { const l = line(d); l.force = !l.force; touch(); };
changes["vol-f"] = (el) => {
  const l = VP.lines[+el.dataset.l], k = el.dataset.k, v = el.value.trim(); if (!l) return;
  if (k === "reps") { const m = v.match(/(\d+)\s*(?:[-–à]\s*(\d+))?/); if (m) { l.lo = +m[1]; l.hi = Math.max(+m[1], +(m[2] || m[1])); } }
  else if (k === "ton") l.ton = num(v) > 0 ? Math.round(num(v)) : null;
  else if (k === "lbl") l.lbl = v;
  else if (k === "it.t") { l.it = { t: v, v: v === "rpe" ? 8 : v === "pct" ? 75 : l.bw ? 0 : 20 }; }
  else if (k === "it.v") { const n = num(v); l.it = { ...(l.it || { t: "rpe" }), v: Number.isFinite(n) ? (l.it?.t === "rpe" ? Math.min(10, Math.max(5, n)) : Math.max(0, n)) : null }; }
  touch();
};
// Faisceaux d'un exercice et leurs coefficients (1 à 3 en général)
actions["vol-fx"] = (b, d) => {
  const i = +d.l, l = VP.lines[i]; if (!l) return;
  l.fx = JSON.parse(JSON.stringify(V.faisceauxOf(l.n, musclesOf, l.fx)));
  const C = [0, 0.25, 0.33, 0.5, 0.75, 1];
  sheet(`<div class="row between"><h2 class="h2">${esc(l.n)}</h2><button class="btn btn-red btn-xs" data-a="vol-fx-ok" style="width:auto">OK</button></div>
    <p class="xs muted">Coefficient : part de chaque série comptée pour ce faisceau (principal 1, secondaire 0,5 par défaut).</p>
    ${l.fx.map((x, j) => `<div class="row mt8" style="gap:6px"><select class="grow" data-c="vol-fxf" data-l="${i}" data-j="${j}" aria-label="Faisceau">${V.FAISCEAUX.map(f => `<option value="${esc(f)}" ${f === x.f ? "selected" : ""}>${esc(V.fLabel(f))}</option>`).join("")}</select><select data-c="vol-fxc" data-l="${i}" data-j="${j}" aria-label="Coefficient" style="width:84px">${C.map(c => `<option value="${c}" ${Math.abs(c - x.c) < .01 ? "selected" : ""}>${fmt(c)}</option>`).join("")}</select></div>`).join("")}
    <div class="row mt12" style="gap:8px">${l.fx.length < 4 ? `<button class="btn btn-ghost btn-sm grow" data-a="vol-fx-add" data-l="${i}">+ Faisceau</button>` : ""}<button class="btn btn-ghost btn-sm grow" data-a="vol-fx-reset" data-l="${i}">Valeurs par défaut</button></div>`, null, { keep: true });
};
changes["vol-fxf"] = (el) => { const l = VP.lines[+el.dataset.l]; l.fx[+el.dataset.j].f = el.value; persist(); };
changes["vol-fxc"] = (el) => { const l = VP.lines[+el.dataset.l]; l.fx[+el.dataset.j].c = +el.value; l.fx = l.fx.filter(x => x.c > 0); persist(); actions["vol-fx"](null, { l: el.dataset.l }); };
actions["vol-fx-add"] = (b, d) => { const l = line(d); l.fx.push({ f: V.FAISCEAUX.find(f => !l.fx.some(x => x.f === f)), c: 0.5 }); persist(); actions["vol-fx"](b, d); };
actions["vol-fx-reset"] = (b, d) => { const l = line(d); l.fx = null; persist(); closeSheet(); rerender(); toast("Faisceaux par défaut"); };
actions["vol-fx-ok"] = () => { closeSheet(); rerender(); };

// Répartition
actions["vol-day"] = (b, d) => { VP.days[+d.v] = !VP.days[+d.v]; if (VP.days[+d.v]) { VP.plan = VP.plan || {}; VP.plan[d.v] = VP.plan[d.v] || { t: "perso", f: [], pins: [] }; } if (!VP.days[+d.v]) VP.lines.forEach(l => { delete l.split?.[d.v]; }); touch(); };
actions["vol-split"] = (b, d) => { const l = line(d); l.split = l.split || {}; const n = Math.max(0, (+l.split[d.d] || 0) + +d.v); if (n) l.split[d.d] = n; else delete l.split[d.d]; touch(); };
actions["vol-auto"] = () => {
  if (!VP.days.some(Boolean)) return toast("Choisis d'abord tes jours");
  if (VP.lines.some(l => V.placed(l)) && !confirm("Remplacer la répartition actuelle par la proposition ?")) return;
  const res = V.distribute(VP.lines, VP.days, opts()); VP.lines.forEach((l, i) => { l.split = res[i]; }); touch(); toast("Proposition appliquée : ajuste à la main si besoin");
};
actions["vol-clear"] = () => { if (!confirm("Retirer toutes les séries des jours ?")) return; VP.lines.forEach(l => { l.split = {}; }); touch(); };
actions["vol-build"] = () => {
  const d = builderDraft(); if (!d) return go("builder");
  const o = opts(), sessions = V.toSessions(VP.lines, VP.days, o);
  if (!sessions.length) return toast("Place au moins une série sur un jour");
  const miss = VP.lines.filter(l => V.placed(l) !== V.lineSets(l, o.ctx));
  if (miss.length && !confirm(`${miss.length} exercice${miss.length > 1 ? "s n'ont" : " n'a"} pas toutes ${miss.length > 1 ? "leurs" : "ses"} séries placées. Créer quand même les séances avec ce qui est placé ?`)) return;
  if ((d.s || []).some(s => s[2]?.length) && !confirm("Les séances actuelles du programme seront remplacées par cette répartition. Continuer ?")) return;
  // Règles déjà écrites pour un exercice (surcharge, repos, tempo, consigne) : gardées ; le nombre de séries vient du volume
  const old = new Map(); (d.s || []).forEach(se => (se[2] || []).forEach(r => { if (r?.[0] && !old.has(r[0])) old.set(r[0], r); }));
  d.s = sessions.map(([n, day, rows]) => [n, day, rows.map(r => {
    r[5] = E.migrateRow(r[5]); const o = old.get(r[0]);
    if (o) { const x = o[5] || {}; r[1] = o[1] || r[1]; r[2] = o[2] || ""; r[4] = o[4] || null; if (x.prog) r[5].prog = JSON.parse(JSON.stringify(x.prog)); if (x.rest) r[5].rest = x.rest; }
    return r; })]);
  d.days = DAYS.map(x => sessions.some(s => s[1] === x));
  d.s.forEach((se, k) => { const nm = V.splitName(VP.plan, DAYS.indexOf(se[1])); if (nm) se[0] = `Séance ${String.fromCharCode(65 + k)} · ${nm}`; });
  d.vplan = { lines: JSON.parse(JSON.stringify(VP.lines)), days: [...VP.days], plan: JSON.parse(JSON.stringify(VP.plan || {})), lm: VP.lm || null };
  persist("publie"); toast(`${sessions.length} séance${sessions.length > 1 ? "s" : ""} créée${sessions.length > 1 ? "s" : ""} : règle la progression puis enregistre`);
  VP = null; go("builder");
};

// Seuils MV / MEV / MAV / MRV : pour ce programme (bloc), ou pour le client (coach)
actions["vol-lm"] = () => {
  const lm = lmNow(), inp = (g, k, v) => `<input data-c="vol-lmi" data-g="${g}" data-k="${k}" inputmode="decimal" value="${fmt(v)}" aria-label="${k} ${g}" style="padding:6px 4px;text-align:center">`;
  sheet(`<h2 class="h2">Seuils de volume</h2><p class="xs muted">Séries par semaine. Valeurs par défaut d'après Israetel (RP) ; les seuils du bloc priment sur ceux du client.</p>
    <div class="vlm mt8"><span></span><span>MV</span><span>MEV</span><span>MAV</span><span></span><span>MRV</span>${V.GROUPS.map(g => `<span class="xs">${esc(g.n)}</span>${inp(g.id, "mv", lm[g.id].mv)}${inp(g.id, "mev", lm[g.id].mev)}${inp(g.id, "mav0", lm[g.id].mav[0])}${inp(g.id, "mav1", lm[g.id].mav[1])}${inp(g.id, "mrv", lm[g.id].mrv)}`).join("")}</div>
    <button class="btn btn-red mt12" style="width:100%" data-a="vol-lm-save" data-v="bloc">Pour ce programme (bloc)</button>
    ${VP.memberId && isCoach() ? `<button class="btn btn-line mt8" style="width:100%" data-a="vol-lm-save" data-v="client">Par défaut pour ${esc(VP.memberName || "ce client")}</button>` : ""}
    <button class="btn btn-ghost mt8" style="width:100%" data-a="vol-lm-save" data-v="reset">Revenir aux valeurs par défaut</button>`, (w) => { VP._lmEdit = JSON.parse(JSON.stringify(lm)); });
};
changes["vol-lmi"] = (el) => { const L = VP._lmEdit?.[el.dataset.g], k = el.dataset.k, n = num(el.value); if (!L || !Number.isFinite(n)) return; if (k === "mav0") L.mav[0] = n; else if (k === "mav1") L.mav[1] = n; else L[k] = n; };
actions["vol-lm-save"] = async (b, d) => {
  const ed = VP._lmEdit; delete VP._lmEdit;
  if (d.v === "reset") { VP.lm = null; if (VP.memberId && isCoach()) { try { const c = await cloud(); await c.volSeuilsSet(VP.memberId, { lm: null }); VP.seuils = null; } catch { } } }
  else if (ed) {
    const bad = Object.entries(ed).find(([, L]) => !(L.mv <= L.mev && L.mev <= L.mav[0] && L.mav[0] <= L.mav[1] && L.mav[1] <= L.mrv));
    if (bad) return toast(`${V.groupById(bad[0]).n} : il faut MV ≤ MEV ≤ MAV ≤ MRV`);
    if (d.v === "client") { try { const c = await cloud(); await c.volSeuilsSet(VP.memberId, { lm: ed }); VP.seuils = ed; VP.lm = null; toast("Seuils enregistrés pour ce client"); } catch (e) { return toast("Enregistrement impossible : " + e.message); } }
    else { VP.lm = ed; toast("Seuils de ce programme enregistrés"); }
  }
  persist(); closeSheet(); rerender();
};

// ---------- Client : volume de son programme (semaine affichée), avec les seuils réglés par son coach ----------
let mySeuils, MINE = null; // MINE : fenêtre « mon volume » ouverte
actions["vol-mine"] = async (b, d) => {
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  const ns = E.nextSession(); if (!ns?.p) return toast("Choisis d'abord un programme");
  const w = +d.w || ns.week, p = ns.p;
  if (mySeuils === undefined) { mySeuils = null; try { const c = await cloud(); mySeuils = (await c?.volSeuilsGet(null))?.lm || null; } catch { } }
  const lines = linesFromProgram(p, w), o = { musclesOf, ctx: ctx(null), lm: V.landmarks(mySeuils, p.vplan?.lm) };
  const open = {};
  const draw = () => sheet(`<h2 class="h2">Volume · semaine ${w}</h2><p class="xs muted">${esc(String(p.name).split("·")[0].trim())} · séries par muscle (direct = 1, secondaire = 0,5).${mySeuils ? " Seuils réglés par ton coach." : ""}</p>
    <div class="card">${gaugesHtml(lines, o, open)}</div><h3 class="sec">Mouvements de force</h3><div class="card">${forceHtml(lines.map(l => ({ ...l })), o)}</div>
    <p class="xs muted mt8">MV maintien · MEV début de progression · MAV zone optimale · MRV limite de récupération. Repères indicatifs : ils varient selon toi.</p>`, null, { keep: !!MINE });
  MINE = { open, draw };
  const obs = new MutationObserver(() => { if (!document.getElementById("sheet")) { MINE = null; obs.disconnect(); } }); obs.observe(document.body, { childList: true });
  draw();
};
