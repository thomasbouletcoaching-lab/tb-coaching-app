// Éditeur de programme (espace coach) : le coach compose le programme d'un membre, qui le reçoit dans l'onglet Coaching et s'y applique tout seul.
// Chaque exercice a une prescription de base, et une prescription écrite pour chaque semaine du cycle (1 à 12) : le coach règle la surcharge à la main.
// Points de départ : le programme actuel du client, un programme de la banque ou de sa bibliothèque, ou une base vierge.
import * as E from "../engine.js";
import { withState } from "../store.js";
import { convertTb } from "../tbconvert.js";
import { $app, esc, toast, routes, actions, forms, header, R, go, isCoach, cloud, buzz, sheet, closeSheet } from "../core.js";

const DAYS = E.DAY_NAMES;
const WEEKS = 12;
let D = null;        // brouillon : { memberId, memberName, name, sessions: [{ name, day, exercises: [{ name, sets, rest, note, weeks: { 1: "3x8 RPE8", ... } }] }] }
let PENDING = null;  // programme choisi depuis la fiche (banque, bibliothèque) avant l'ouverture de l'éditeur

// Sets (objets) -> texte éditable : « 3x8-10 RPE8 + 1x5@85% »
function setsToText(sets = []) {
  const groups = [];
  sets.forEach(x => {
    const k = [x.lo, x.hi, x.pct, x.kg, x.rpe].join("|"), g = groups[groups.length - 1];
    if (g && g.k === k) g.n++; else groups.push({ k, n: 1, x });
  });
  return groups.map(({ n, x }) => `${n}x${x.lo}${x.hi !== x.lo ? "-" + x.hi : ""}${x.pct ? "@" + x.pct + "%" : ""}${x.kg ? "@" + x.kg + "kg" : ""}${x.rpe ? " RPE" + x.rpe : ""}`).join(" + ");
}
// Programme (format de l'app) -> brouillon
function draftFrom(memberId, prog, name) {
  const sessions = (prog?.s || []).map(([n, day, rows]) => ({
    name: n, day: DAYS.includes(day) ? day : "Lundi",
    exercises: (rows || []).filter(r => r[0]).map(r => {
      const row = r[5] || {}, weeks = {};
      Object.entries(row.weeks || {}).forEach(([w, arr]) => { if (Array.isArray(arr) && arr.length) weeks[w] = setsToText(arr); });
      return { name: r[0], sets: setsToText(row.sets || []), rest: row.rest || 120, note: r[2] || "", weeks };
    }),
  }));
  return { memberId, name: name || prog?.name || "Programme de coaching", sessions: sessions.length ? sessions : [blankSession()] };
}
const blankEx = () => ({ name: "", sets: "3x8-10 RPE8", rest: 120, note: "", weeks: {} });
const blankSession = () => ({ name: "Séance A", day: "Lundi", exercises: [blankEx()] });

// Programme actuel d'un client, à partir de sa copie serveur (cxs_member_data) : programme de l'app, ou programme TB my Coach converti
export function memberProgram(md) {
  if (!md) return null;
  const pid = md.plan?.programId;
  const custom = (md.customPrograms || []).find(p => p.id === pid);
  if (custom?.s?.length) return custom;
  if (md.tbRaw?.sessions?.length) return convertTb(md.tbRaw, "main");
  const bank = pid ? withState(md, () => E.program(pid)) : null;
  return bank?.s?.length ? bank : null;
}

// Ouvre l'éditeur avec un programme donné (depuis la banque ou la bibliothèque de la fiche membre)
export function openProgramEditor(memberId, program) {
  PENDING = { memberId, program };
  go("member-prog", memberId);
}

// Lit le formulaire tel qu'il est (pour ne pas perdre ce qui vient d'être tapé)
function readForm() {
  const f = document.querySelector('form[data-f="prog-save"]'); if (!f || !D) return;
  const v = (n) => f.elements[n]?.value ?? "";
  D.name = v("name");
  D.sessions = D.sessions.map((s, i) => ({
    name: v(`s${i}_name`), day: v(`s${i}_day`) || s.day,
    exercises: s.exercises.map((e, j) => {
      const weeks = {};
      for (let w = 1; w <= WEEKS; w++) { const t = v(`s${i}_e${j}_w${w}`).trim(); if (t) weeks[w] = t; }
      return { name: v(`s${i}_e${j}_name`), sets: v(`s${i}_e${j}_sets`), rest: v(`s${i}_e${j}_rest`), note: v(`s${i}_e${j}_note`), weeks };
    }),
  }));
}
function program() {
  const s = D.sessions.filter(x => x.name.trim()).map(x => [x.name.trim(), DAYS.includes(x.day) ? x.day : "Lundi", x.exercises.filter(e => e.name.trim()).map(e => {
    const weeks = {};
    Object.entries(e.weeks || {}).forEach(([w, txt]) => { const arr = E.parseSets(txt); if (arr.length) weeks[w] = arr; });
    return [e.name.trim(), "S", e.note || "", null, null, { weeks, sets: E.parseSets(e.sets), rest: +e.rest || 120 }];
  })]);
  return { name: D.name.trim() || "Programme de coaching", lvl: "Tous niveaux", split: "", weeks: WEEKS, deload: { every: 5 }, days: DAYS.map(d => s.some(x => x[1] === d)), s, prof: "", desc: "", publish: false };
}
// Noms d'exercices déjà connus (banque + bibliothèque) : proposés à la saisie
function exerciseNames() {
  const set = new Set();
  E.programs().forEach(p => (p.s || []).forEach(([, , rows]) => (rows || []).forEach(r => r[0] && set.add(r[0]))));
  return [...set].sort((a, b) => a.localeCompare(b, "fr")).slice(0, 1500);
}
// Une ligne par semaine : vide = même prescription que la base
const weekInputs = (i, j, e) => `<details class="mt4"><summary class="xs muted" style="cursor:pointer">Surcharge : prescription semaine par semaine (${WEEKS} semaines)</summary>
  <p class="xs muted" style="margin:6px 0">Vide = même chose que la base. Écris « 4x6 RPE7 + 2x8 RPE8 » pour une semaine précise.</p>
  <div class="wk-grid">${Array.from({ length: WEEKS }, (_, k) => k + 1).map(w => `<label class="field" style="margin:0"><span>S${w}</span><input name="s${i}_e${j}_w${w}" value="${esc(e.weeks?.[w] || "")}" placeholder="${esc(e.sets)}" maxlength="120"></label>`).join("")}</div></details>`;

function render() {
  const sess = D.sessions.map((s, i) => `
    <div class="card mt12"><div class="row between"><b>Séance ${i + 1}</b><button type="button" class="ghost sm" data-a="prog-delS" data-v="${i}">Supprimer</button></div>
      <div class="grid2 mt8"><label class="field"><span>Nom</span><input name="s${i}_name" value="${esc(s.name)}" maxlength="60"></label>
      <label class="field"><span>Jour</span><select name="s${i}_day">${DAYS.map(d => `<option ${d === s.day ? "selected" : ""}>${d}</option>`).join("")}</select></label></div>
      ${s.exercises.map((e, j) => `<div class="card mt8" style="padding:10px"><div class="row between"><span class="xs muted">Exercice ${j + 1}</span><button type="button" class="ghost sm" data-a="prog-delE" data-v="${i},${j}">Retirer</button></div>
        <label class="field mt4"><span>Exercice</span><input name="s${i}_e${j}_name" value="${esc(e.name)}" maxlength="80" list="ex-names" placeholder="Ex. Squat barre"></label>
        <div class="grid2 mt4"><label class="field"><span>Base : séries × reps · RPE</span><input name="s${i}_e${j}_sets" value="${esc(e.sets)}" placeholder="3x8-10 RPE8"></label>
        <label class="field"><span>Repos (s)</span><input name="s${i}_e${j}_rest" inputmode="numeric" value="${esc(e.rest)}"></label></div>
        <label class="field mt4"><span>Consigne (facultatif)</span><input name="s${i}_e${j}_note" value="${esc(e.note)}" maxlength="200"></label>
        ${weekInputs(i, j, e)}</div>`).join("")}
      <button type="button" class="btn btn-line btn-sm mt8" data-a="prog-addE" data-v="${i}">+ Exercice</button></div>`).join("");
  const names = exerciseNames();
  $app.innerHTML = header("Programme", esc(D.memberName || ""), { back: "admin" })
    + `<main class="page"><div class="card soft"><div class="lbl">Partir de</div>
        <div class="row mt8" style="gap:6px;flex-wrap:wrap"><button type="button" class="btn btn-line btn-sm" data-a="prog-current">↺ Son programme actuel</button><button type="button" class="btn btn-line btn-sm" data-a="prog-bank">📚 Banque et bibliothèque</button><button type="button" class="btn btn-line btn-sm" data-a="prog-blank">＋ Base vierge</button></div>
        <p class="xs muted mt8" style="margin:6px 0 0">Ce que tu choisis remplace le brouillon ci-dessous. Rien n'est envoyé avant « Envoyer ».</p></div>
      <form data-f="prog-save">
      <label class="field mt8"><span>Nom du programme</span><input name="name" value="${esc(D.name)}" maxlength="80"></label>
      ${sess}
      <datalist id="ex-names">${names.map(n => `<option value="${esc(n)}"></option>`).join("")}</datalist>
      <button type="button" class="btn btn-line mt12" data-a="prog-addS">+ Séance</button>
      <p class="xs muted mt12">Format des séries : « 3x8-10 RPE8 », « 1x5@85% », « 4x6 RPE7 + 2x10 RPE8 ». Le programme remplace celui du client ; sa semaine en cours est conservée.</p>
      <button class="btn btn-red mt12" style="width:100%">Envoyer le programme au client</button></form></main>`;
}

routes["member-prog"] = async () => {
  if (!isCoach()) return go("home");
  const memberId = R.param, pending = PENDING && PENDING.memberId === memberId ? PENDING : null; PENDING = null;
  $app.innerHTML = header("Programme", "", { back: "admin" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  try {
    const c = await cloud(); const m = (window.__members || []).find(x => x.id === memberId);
    let src = pending ? pending.program : null;
    if (!src) {
      const md = await c.memberData(memberId).catch(() => null);
      const cur = await c.coachPlanGet(memberId).catch(() => null);
      src = cur?.program?.s?.length ? cur.program : memberProgram(md?.data);
    }
    D = draftFrom(memberId, src, src?.name);
    D.memberName = m?.name || m?.email || "";
    render();
  } catch (e) { $app.innerHTML = header("Programme", "", { back: "admin" }) + `<main class="page"><p class="empty">Chargement impossible : ${esc(e.message)}</p></main>`; }
};

// Ouvre la liste de la banque et de la bibliothèque : un tap charge le programme dans le brouillon
actions["prog-bank"] = () => {
  readForm();
  const all = E.programs().filter(p => p.s?.length);
  const li = (p) => `<button class="li" data-a="prog-pick" data-id="${esc(p.id)}"><span class="grow small"><b>${esc(String(p.name).split("·")[0].trim())}</b><br><span class="xs muted">${p.s.length} séances / sem. · ${esc(p.lvl || "")}${p.custom ? " · ta bibliothèque" : ""}</span></span></button>`;
  sheet(`<h2 class="h2">Banque et bibliothèque</h2><p class="xs muted">Touche un programme : tu verras chaque séance, chaque exercice et chaque semaine, puis tu le modifies avant envoi.</p>
    <div class="list mt8">${all.filter(p => p.custom).map(li).join("")}${all.filter(p => !p.custom).map(li).join("")}</div>`);
};
actions["prog-pick"] = (b, d) => {
  readForm();
  const p = E.program(d.id); if (!p) return toast("Programme indisponible");
  const src = draftFrom(D.memberId, JSON.parse(JSON.stringify(p)), p.name);
  D.sessions = src.sessions; D.name = String(p.name).split("·")[0].trim() + (D.memberName ? ` · ${D.memberName}` : "");
  closeSheet(); render(); toast("Programme chargé : modifie-le puis envoie-le");
};
actions["prog-current"] = async () => {
  readForm();
  try { const c = await cloud(); const md = await c.memberData(D.memberId).catch(() => null); const cur = await c.coachPlanGet(D.memberId).catch(() => null);
    const src = cur?.program?.s?.length ? cur.program : memberProgram(md?.data);
    if (!src) return toast("Pas de programme actuel pour ce client");
    D.sessions = draftFrom(D.memberId, src).sessions; render(); toast("Programme actuel chargé");
  } catch (e) { toast("Chargement impossible : " + e.message); }
};
actions["prog-blank"] = () => { readForm(); D.name = "Programme de coaching"; D.sessions = [blankSession()]; render(); };

// Lit tout avant de redessiner, pour que rien de ce qui est tapé ne soit perdu
actions["prog-addS"] = () => { readForm(); D.sessions.push({ name: `Séance ${String.fromCharCode(65 + D.sessions.length)}`, day: "Mardi", exercises: [blankEx()] }); render(); };
actions["prog-delS"] = (b, d) => { readForm(); if (D.sessions.length > 1) D.sessions.splice(+d.v, 1); render(); };
actions["prog-addE"] = (b, d) => { readForm(); D.sessions[+d.v].exercises.push(blankEx()); render(); };
actions["prog-delE"] = (b, d) => { readForm(); const [i, j] = d.v.split(",").map(Number); D.sessions[i].exercises.splice(j, 1); render(); };

forms["prog-save"] = async () => {
  readForm();
  if (!D.sessions.some(s => s.exercises.some(e => e.name.trim()))) return toast("Ajoute au moins un exercice");
  const bad = D.sessions.flatMap(s => s.exercises).find(e => e.name.trim() && !E.parseSets(e.sets).length);
  if (bad) return toast(`Séries illisibles pour « ${bad.name} » : écris par exemple « 3x8-10 RPE8 »`);
  const badW = D.sessions.flatMap(s => s.exercises.filter(e => e.name.trim()).map(e => ({ e, w: Object.entries(e.weeks || {}).find(([, t]) => !E.parseSets(t).length) }))).find(x => x.w);
  if (badW) return toast(`Semaine ${badW.w[0]} illisible pour « ${badW.e.name} » : écris par exemple « 3x8-10 RPE8 »`);
  const prog = program();
  try {
    const c = await cloud();
    await c.coachPlanSet(D.memberId, prog);
    await c.notify("📋 Ton programme", `Thomas a mis à jour ton programme : « ${prog.name} ». Il s'applique dans l'onglet Coaching.`, D.memberId).catch(() => { });
    buzz(); toast("Programme envoyé : il s'applique chez le client à sa prochaine ouverture"); go("member", D.memberId);
  }
  catch (e) { toast("Envoi impossible : " + e.message); }
};
