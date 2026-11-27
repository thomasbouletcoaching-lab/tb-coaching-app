// Mésocycles et courbes du cycle : blocs de semaines (phase, schéma de reps, type de surcharge), volume et intensité semaine par semaine,
// séries voulues par muscle. Tout se règle sur le brouillon du programme (celui de l'éditeur) et se range avec lui.
import { $app, esc, num, toast, routes, actions, changes, forms, go, header, tabbar, sheet, closeSheet, rerender } from "../core.js";
import * as E from "../engine.js";
import * as M from "../meso.js";
import * as V from "../volume.js";
import { bdDraft, phaseKey } from "./train.js";

const fr1 = (v) => String(v).replace(".", ",");
const COL = { vol: "#2F6FED", int: "#E8832A" };
const loadName = (id) => (M.LOADS.find(l => l[0] === id) || [, id])[1];

// « 3×8 @ 70 % · poids ↑ +2,5 %/sem. »
export function blocTexte(b) {
  if (M.isDeloadBlock(b)) return "Allègement : séries et charges réduites";
  const reps = b.lo == null ? "" : b.hi != null && b.hi !== b.lo ? `${b.lo}-${b.hi}` : `${b.lo}`;
  const sc = `${b.sets ? b.sets + "×" : ""}${reps}${b.pct != null ? ` @ ${fr1(b.pct)} %` : ""}${b.rpe != null ? ` RPE ${fr1(b.rpe)}` : ""}`;
  const st = b.step && ["kg", "pct", "double", "rpe"].includes(b.load) ? ` ${b.step > 0 ? "+" : ""}${fr1(b.step)}${b.load === "rpe" ? "" : b.pct != null ? " %" : " kg"}/sem.` : "";
  return `${sc || "Séries du programme"} · ${loadName(b.load)}${st}`;
}

function syncPhases(D) {
  const W = D.weeks || 8;
  if (D.meso?.length) { D.phases = M.phasesFromBlocks(D.meso, W, "Accumulation"); delete D.deload; }
}
// Courbes types selon les phases : le volume monte en accumulation, l'intensité en intensification, tout baisse en allègement
function courbesTypes(phases) {
  const vol = {}, int = {}; let run = 0, prev = null;
  phases.forEach((ph, i) => {
    run = ph === prev ? run + 1 : 0; prev = ph; const k = run;
    const t = { Accumulation: [100 + 10 * k, 95 + 2 * k], Intensification: [Math.max(60, 90 - 5 * k), 100 + 3 * k], "Réalisation": [Math.max(50, 75 - 5 * k), 105 + 3 * k], Peak: [55, 110], Deload: [60, 90], Test: [50, 100] }[ph] || [100, 100];
    vol[i + 1] = Math.round(t[0]); int[i + 1] = Math.round(t[1]);
  });
  return { vol, int };
}

// Courbes superposées : volume (bleu) et intensité (orange), allègements en bande, repère à 100 %
function graphe(D, W) {
  const w = 340, h = 150, L = 30, R = 8, T = 10, B = 22, vals = [];
  for (let k = 1; k <= W; k++) { vals.push(D.vol?.[k] ?? 100, D.int?.[k] ?? 100); }
  const lo = Math.floor(Math.min(40, ...vals) / 10) * 10, hi = Math.ceil(Math.max(130, ...vals) / 10) * 10;
  const x = (k) => L + (W === 1 ? 0 : (k - 1) / (W - 1) * (w - L - R)), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
  const bw = (w - L - R) / Math.max(1, W - 1), line = (c) => Array.from({ length: W }, (_, i) => `${i ? "L" : "M"}${x(i + 1).toFixed(1)},${y(D[c]?.[i + 1] ?? 100).toFixed(1)}`).join(" ");
  const band = Array.from({ length: W }, (_, i) => E.isDeload(D, i + 1) ? `<rect x="${(x(i + 1) - bw / 2).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${h - T - B}" fill="#7C8B6A" opacity=".18"/>` : "").join("");
  const grid = [lo, 100, hi].filter((v, i, a) => a.indexOf(v) === i).map(v => `<line x1="${L}" x2="${w - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="currentColor" opacity="${v === 100 ? .35 : .12}" ${v === 100 ? 'stroke-dasharray="3 3"' : ""}/><text x="${L - 4}" y="${(y(v) + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="currentColor" opacity=".6">${v}</text>`).join("");
  const labs = Array.from({ length: W }, (_, i) => (W <= 12 || (i + 1) % 2 === 1 || i + 1 === W) ? `<text x="${x(i + 1).toFixed(1)}" y="${h - 6}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".6">${i + 1}</text>` : "").join("");
  const dots = (c) => Array.from({ length: W }, (_, i) => `<circle cx="${x(i + 1).toFixed(1)}" cy="${y(D[c]?.[i + 1] ?? 100).toFixed(1)}" r="2.6" fill="${COL[c]}"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Volume et intensité semaine par semaine" style="color:var(--ink)">${band}${grid}<path d="${line("vol")}" fill="none" stroke="${COL.vol}" stroke-width="2.2" stroke-linejoin="round"/><path d="${line("int")}" fill="none" stroke="${COL.int}" stroke-width="2.2" stroke-linejoin="round"/>${dots("vol")}${dots("int")}${labs}</svg>
    <div class="row xs muted" style="gap:14px;margin-top:2px"><span><i style="display:inline-block;width:10px;height:3px;background:${COL.vol};vertical-align:middle"></i> Volume (séries)</span><span><i style="display:inline-block;width:10px;height:3px;background:${COL.int};vertical-align:middle"></i> Intensité (charges)</span><span>▮ allègement</span></div>`;
}

routes["builder-meso"] = async () => {
  TG = null;
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  const D = bdDraft(); if (!D) return go("train");
  const W = D.weeks || 8, blocks = (D.meso || []).slice().sort((a, b) => a.a - b.a), weeks = Array.from({ length: W }, (_, i) => i + 1);
  const frise = blocks.length ? `<div class="frise mt8">${blocks.map(b => `<button class="fz ph-${phaseKey(b.phase)}" data-a="ms-edit" data-v="${D.meso.indexOf(b)}" title="${esc(b.phase)}" style="flex:${b.b - b.a + 1};min-width:0;overflow:hidden;border:0;text-align:left"><b>${b.b - b.a < 1 ? (b.phase === "Deload" ? "↓" : esc(b.phase.slice(0, 2))) : esc(b.phase === "Deload" ? "Allègement" : b.phase)}</b><span>S${b.a}${b.b > b.a ? "–" + b.b : ""}</span></button>`).join("")}</div>` : `<p class="small muted mt8">Aucun bloc : le programme suit les règles de surcharge de chaque exercice. Ajoute un bloc, ou charge l'exemple de 16 semaines.</p>`;
  const lastB = blocks.at(-1)?.b || 0;
  const mus = Object.keys(D.muscleSets || {});
  $app.innerHTML = header("Mésocycles et volume", esc(D.name || ""), { back: "builder" }) + `<main class="page">
    <div class="card mt12"><div class="row between"><b class="small">🧱 Mésocycles</b><span class="xs muted">${W} semaines</span></div>${frise}
      ${blocks.map(b => `<button class="li mt8" style="width:100%;text-align:left" data-a="ms-edit" data-v="${D.meso.indexOf(b)}"><span class="tag ph-${phaseKey(b.phase)}" style="min-width:52px;text-align:center">S${b.a}${b.b > b.a ? "–" + b.b : ""}</span><span class="grow small">${esc(blocTexte(b))}</span><span class="xs muted">›</span></button>`).join("")}
      <div class="row mt12" style="gap:8px;flex-wrap:wrap"><button class="btn btn-red btn-sm" data-a="ms-add" data-v="${lastB < W ? lastB + 1 : 1}" ${lastB >= W ? "disabled" : ""}>+ Bloc</button><button class="btn btn-line btn-sm" data-a="ms-add" data-v="${lastB < W ? lastB + 1 : 1}" data-dl="1" ${lastB >= W ? "disabled" : ""}>+ Allègement</button><button class="btn btn-ghost btn-sm" data-a="ms-ex16">📋 Exemple 16 semaines</button></div>
      <label class="field mt12"><span>Les blocs s'appliquent à</span><select data-c="ms-scope">${M.SCOPES.map(([k, n]) => `<option value="${k}" ${(D.mesoScope || "comp") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <p class="xs muted mt4" style="margin-bottom:0">Dans l'éditeur, chaque exercice peut suivre les blocs, les ignorer ou avoir les siens.</p></div>

    <div class="card mt12"><div class="row between"><b class="small">📈 Volume et intensité</b><button class="link xs" data-a="ms-auto">Courbes types</button></div>
      <div class="mt8">${graphe(D, W)}</div>
      <div class="hscroll mt8"><table class="ms-grid"><thead><tr><th></th>${weeks.map(k => `<th class="${E.isDeload(D, k) ? "dl" : ""}">S${k}</th>`).join("")}</tr></thead>
        <tbody><tr><th style="color:${COL.vol}">Vol. %</th>${weeks.map(k => `<td><input inputmode="numeric" data-c="ms-v" data-k="vol" data-w="${k}" value="${D.vol?.[k] ?? ""}" placeholder="100" aria-label="Volume semaine ${k}"></td>`).join("")}</tr>
        <tr><th style="color:${COL.int}">Int. %</th>${weeks.map(k => `<td><input inputmode="numeric" data-c="ms-v" data-k="int" data-w="${k}" value="${D.int?.[k] ?? ""}" placeholder="100" aria-label="Intensité semaine ${k}"></td>`).join("")}</tr></tbody></table></div>
      <p class="xs muted mt8" style="margin-bottom:0"><b>Volume</b> : 120 % = un cinquième de séries en plus sur chaque exercice, 60 % = trois séries sur cinq. <b>Intensité</b> : 90 % = charges à 90 % (ou RPE plus bas si la charge n'est pas fixée). Case vide = 100 %. Quand tu planifies les courbes, l'allègement automatique ne s'ajoute plus : c'est toi qui décides.</p>
      ${D.vol || D.int ? `<button class="link xs mt8" data-a="ms-reset">Remettre les courbes à 100 %</button>` : ""}</div>

    <div class="card mt12"><div class="row between"><b class="small">💪 Séries par muscle et par semaine</b><button class="link xs" data-a="ms-mus-add">+ Muscle</button></div>
      ${mus.length ? mus.map(g => { const G = V.groupById(g), lm = G?.lm; return `<div class="mt12"><div class="row between"><b class="small">${esc(G?.n || g)}</b><span class="xs muted">MEV ${lm?.mev ?? "–"} · MAV ${lm?.mav?.[0] ?? "–"}–${lm?.mav?.[1] ?? "–"} · MRV ${lm?.mrv ?? "–"}</span></div>
        <div class="hscroll mt4"><table class="ms-grid"><thead><tr>${weeks.map(k => `<th class="${E.isDeload(D, k) ? "dl" : ""}">S${k}</th>`).join("")}</tr></thead><tbody><tr>${weeks.map(k => `<td><input inputmode="numeric" data-c="ms-m" data-g="${g}" data-w="${k}" value="${D.muscleSets[g]?.[k] ?? ""}" placeholder="–" aria-label="${esc(G?.n || g)} semaine ${k}"></td>`).join("")}</tr></tbody></table></div>
        <div class="row" style="gap:12px"><button class="link xs" data-a="ms-mus-fill" data-g="${g}">Remplir en rampe</button><button class="link xs" data-a="ms-mus-del" data-g="${g}" style="color:var(--red)">Retirer</button></div></div>`; }).join("") : `<p class="small muted mt8">Dis combien de séries il faut pour un muscle chaque semaine (ex. dos : 14, 16, 18, puis 8 en allègement). Les séries sont réparties sur les exercices de ce muscle ; les autres ne bougent pas.</p>`}
      ${mus.length ? `<p class="xs muted mt12" style="margin-bottom:0">Case vide = pas de consigne cette semaine. Un exercice secondaire compte pour une demi-série sur son muscle ; seules les séries des exercices dont c'est le muscle principal sont ajustées.</p>` : ""}</div>
    <button class="btn btn-red mt16" data-a="go" data-r="builder" style="width:100%">Retour au programme</button>
  </main>${tabbar("train")}`;
};

// ---------- Blocs ----------
// Cible des blocs : le programme (TG = null) ou les blocs propres d'un exercice (TG = { si, ri })
let TG = null;
function holder() {
  const D = bdDraft();
  if (!TG) return { get: () => D.meso || [], set: (v) => { if (v.length) D.meso = v; else delete D.meso; syncPhases(D); } };
  const x = D.s[TG.si][2][TG.ri][5]; return { get: () => x.meso || [], set: (v) => { x.meso = v; } };
}
export function exMesoSheet(si, ri) {
  if (si != null) TG = { si, ri };
  const D = bdDraft(), r = D.s[TG.si][2][TG.ri], bl = r[5].meso || [], last = bl.reduce((m, b) => Math.max(m, b.b), 0), W = D.weeks || 8;
  sheet(`<h2 class="h2">Blocs de ${esc(r[0])}</h2><p class="xs muted">Ces blocs remplacent ceux du programme pour cet exercice seulement.</p>
    ${bl.map((b, i) => `<button class="li mt8" style="width:100%;text-align:left" data-a="ms-edit" data-v="${i}"><span class="tag ph-${phaseKey(b.phase)}" style="min-width:52px;text-align:center">S${b.a}${b.b > b.a ? "–" + b.b : ""}</span><span class="grow small">${esc(blocTexte(b))}</span><span class="xs muted">›</span></button>`).join("") || `<p class="small muted mt8">Aucun bloc.</p>`}
    <div class="row mt12" style="gap:8px;flex-wrap:wrap"><button class="btn btn-red btn-sm" data-a="ms-add" data-v="${last < W ? last + 1 : 1}">+ Bloc</button><button class="btn btn-line btn-sm" data-a="ms-add" data-v="${last < W ? last + 1 : 1}" data-dl="1">+ Allègement</button><button class="btn btn-ghost btn-sm" data-a="ms-ex-close">Terminer</button></div>`);
}
actions["ms-ex"] = (b, d) => exMesoSheet(+d.s, +d.r);
actions["ms-ex-close"] = () => { TG = null; closeSheet(); rerender(); };
function formBloc(i, b) {
  const D = bdDraft(), W = D.weeks || 8, dl = b.phase === "Deload";
  const f = (k, lab, v, ph = "", mode = "decimal") => `<label class="field"><span>${lab}</span><input name="${k}" inputmode="${mode}" value="${v ?? ""}" placeholder="${ph}"></label>`;
  return `<h2 class="h2">${i == null ? "Nouveau bloc" : "Bloc S" + b.a + (b.b > b.a ? "–" + b.b : "")}</h2>
    <form data-f="ms-blk"><input type="hidden" name="i" value="${i ?? ""}">
      <div class="grid2"><label class="field"><span>De la semaine</span><select name="a">${Array.from({ length: W }, (_, k) => `<option ${b.a === k + 1 ? "selected" : ""}>${k + 1}</option>`).join("")}</select></label><label class="field"><span>À la semaine</span><select name="b">${Array.from({ length: W }, (_, k) => `<option ${b.b === k + 1 ? "selected" : ""}>${k + 1}</option>`).join("")}</select></label></div>
      <label class="field mt8"><span>Phase</span><select name="phase" data-c="ms-ph">${M.PHASES.map(p => `<option value="${p}" ${b.phase === p ? "selected" : ""}>${p === "Deload" ? "Allègement (deload)" : p}</option>`).join("")}</select></label>
      <div id="ms-trav" ${dl ? "hidden" : ""}>
        <label class="field mt8"><span>Comment ça progresse</span><select name="load">${M.LOADS.map(([k, n]) => `<option value="${k}" ${b.load === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <div class="grid2 mt8">${f("sets", "Séries", b.sets, "ex. 3", "numeric")}${f("rpe", "RPE visé (option)", b.rpe, "ex. 8")}</div>
        <div class="grid2 mt8">${f("lo", "Reps (de)", b.lo, "ex. 8", "numeric")}${f("hi", "Reps (à)", b.hi, "= de", "numeric")}</div>
        <div class="grid2 mt8">${f("pct", "% du 1RM départ (option)", b.pct, "ex. 70")}${f("step", "Pas par semaine", b.step, "ex. 2,5")}</div>
        <p class="xs muted mt8">Singles, doubles, triples : reps de 1 à 3. « Poids ↑ » garde les reps et monte la charge du pas chaque semaine du bloc ; « Reps ↑ » garde la charge et monte les reps de 1 par semaine jusqu'à la borne haute ; « Double progression » monte les reps puis la charge. Laisse le % vide pour que la charge suive ton RPE.</p></div>
      ${dl ? `<p class="small muted mt8" id="ms-dlnote">L'allègement reprend le dernier bloc de travail avec moins de séries et de charge : règle-le dans les courbes juste en dessous.</p>` : ""}
      <button class="btn btn-red mt12" style="width:100%">Enregistrer</button>${i != null ? `<button type="button" class="btn btn-ghost mt8" data-a="ms-del" data-v="${i}" style="width:100%;color:var(--red)">Supprimer ce bloc</button>` : ""}</form>`;
}
actions["ms-add"] = (b, d) => {
  const D = bdDraft(), W = D.weeks || 8, a = Math.min(+d.v, W), dl = !!d.dl;
  sheet(formBloc(null, dl ? { a, b: a, phase: "Deload", load: "fixe" } : { a, b: Math.min(W, a + 2), phase: "Accumulation", load: "kg", sets: 3, lo: 8, hi: 8, step: 2.5 }));
};
actions["ms-edit"] = (b, d) => { const x = holder().get()[+d.v]; if (x) sheet(formBloc(+d.v, x)); };
actions["ms-del"] = (b, d) => { const h = holder(), a = h.get().slice(); a.splice(+d.v, 1); h.set(a); if (TG) return exMesoSheet(); closeSheet(); rerender(); };
const nz = (v) => { const t = String(v ?? "").trim(); return t === "" ? null : num(t); };
forms["ms-blk"] = (v) => {
  const D = bdDraft(), W = D.weeks || 8, a = +v.a, bb = +v.b;
  if (bb < a) return toast("La fin du bloc doit être après le début");
  const dl = v.phase === "Deload", o = { id: "b" + Date.now(), a, b: bb, phase: v.phase, load: dl ? "fixe" : v.load };
  if (!dl) { const sets = nz(v.sets), lo = nz(v.lo), hi = nz(v.hi), rpe = nz(v.rpe), pct = nz(v.pct), step = nz(v.step); if (sets) o.sets = Math.round(sets); if (lo != null) { o.lo = Math.round(lo); o.hi = Math.round(hi ?? lo); } if (rpe != null) o.rpe = rpe; if (pct != null) o.pct = pct; if (step != null) o.step = step; }
  const h = holder(), arr = h.get().filter((x, k) => k !== (v.i === "" ? -1 : +v.i)).filter(x => x.b < a || x.a > bb); // un bloc qui chevauche l'ancien le remplace
  arr.push(o); arr.sort((x, y) => x.a - y.a); h.set(arr);
  if (!TG && D.phases?.length !== W) D.phases = M.phasesFromBlocks(D.meso, W);
  if (TG) return exMesoSheet();
  closeSheet(); rerender();
};
changes["ms-ph"] = (el) => { const dl = el.value === "Deload"; document.getElementById("ms-trav")?.toggleAttribute("hidden", dl); document.getElementById("ms-dlnote")?.toggleAttribute("hidden", !dl); };
changes["ms-scope"] = (el) => { bdDraft().mesoScope = el.value; };
actions["ms-ex16"] = () => {
  const D = bdDraft(); if (D.meso?.length && !confirm("Remplacer tes blocs et tes courbes par l'exemple de 16 semaines ?")) return;
  const ex = M.exemple16(); D.weeks = 16; D.meso = ex.meso; D.vol = ex.vol; D.int = ex.int; syncPhases(D); toast("Exemple chargé : adapte chaque bloc"); rerender();
};

// ---------- Courbes ----------
changes["ms-v"] = (el) => {
  const D = bdDraft(), k = el.dataset.k, w = +el.dataset.w, t = String(el.value).trim(); D[k] = D[k] || {};
  if (t === "") delete D[k][w]; else D[k][w] = Math.max(10, Math.min(250, Math.round(num(t)) || 100));
  if (!Object.keys(D[k]).length) delete D[k]; rerender();
};
actions["ms-auto"] = () => {
  const D = bdDraft(), W = D.weeks || 8; if ((D.vol || D.int) && !confirm("Remplacer tes courbes par des courbes types ?")) return;
  const c = courbesTypes(Array.from({ length: W }, (_, i) => E.phaseOf(D, i + 1) === "Allègement" ? "Deload" : E.phaseOf(D, i + 1)));
  D.vol = c.vol; D.int = c.int; toast("Courbes types posées : ajuste semaine par semaine"); rerender();
};
actions["ms-reset"] = () => { const D = bdDraft(); delete D.vol; delete D.int; rerender(); };

// ---------- Séries par muscle ----------
actions["ms-mus-add"] = () => {
  const D = bdDraft(), has = Object.keys(D.muscleSets || {});
  sheet(`<h2 class="h2">Quel muscle ?</h2><div class="chips wrap mt12">${V.GROUPS.filter(g => !has.includes(g.id)).map(g => `<button class="chip" data-a="ms-mus-pick" data-g="${g.id}">${esc(g.n)}</button>`).join("")}</div>`);
};
actions["ms-mus-pick"] = (b, d) => { const D = bdDraft(); D.muscleSets = D.muscleSets || {}; D.muscleSets[d.g] = D.muscleSets[d.g] || {}; closeSheet(); actions["ms-mus-fill"](null, d); };
actions["ms-mus-del"] = (b, d) => { const D = bdDraft(); delete D.muscleSets[d.g]; if (!Object.keys(D.muscleSets).length) delete D.muscleSets; rerender(); };
changes["ms-m"] = (el) => {
  const D = bdDraft(), g = el.dataset.g, w = +el.dataset.w, t = String(el.value).trim(); D.muscleSets = D.muscleSets || {}; D.muscleSets[g] = D.muscleSets[g] || {};
  if (t === "") delete D.muscleSets[g][w]; else D.muscleSets[g][w] = Math.max(0, Math.round(num(t)) || 0);
  rerender();
};
actions["ms-mus-fill"] = (b, d) => {
  const G = V.groupById(d.g), lm = G?.lm;
  sheet(`<h2 class="h2">${esc(G?.n || d.g)} : rampe</h2><form data-f="ms-mus-fill"><input type="hidden" name="g" value="${d.g}">
    <div class="grid2"><label class="field"><span>Séries semaine 1</span><input name="start" inputmode="numeric" value="${lm?.mav?.[0] ?? 12}"></label><label class="field"><span>+ par semaine</span><input name="step" inputmode="numeric" value="1"></label></div>
    <p class="xs muted mt8">Les semaines d'allègement passent à 60 % du dernier niveau. Tu pourras corriger chaque semaine ensuite. Repères : MEV ${lm?.mev ?? "–"}, MAV ${lm?.mav?.join("–") ?? "–"}, MRV ${lm?.mrv ?? "–"}.</p>
    <button class="btn btn-red mt12" style="width:100%">Remplir</button></form>`);
};
forms["ms-mus-fill"] = (v) => {
  const D = bdDraft(), W = D.weeks || 8, start = Math.round(num(v.start)) || 10, step = Math.round(num(v.step)) || 0; D.muscleSets = D.muscleSets || {}; const o = {}; let k = 0, last = start;
  for (let w = 1; w <= W; w++) { if (E.isDeload(D, w)) { o[w] = Math.max(2, Math.round(last * .6)); k = 0; continue; } last = start + step * k; o[w] = last; k++; }
  D.muscleSets[v.g] = o; closeSheet(); rerender();
};
