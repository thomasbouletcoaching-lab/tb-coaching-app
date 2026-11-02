// Séance en direct partagée : le coach lance la séance d'un membre ; les deux la voient, la mettent à jour, et peuvent ajouter.
// Le coach peut réorganiser, changer, supprimer exercices et séries, mettre types, techniques, RPE et superset.
// Mise à jour toutes les 6 secondes quand l'écran est ouvert (pas de temps réel continu). Chaque geste est écrit tout de suite.
import * as E from "../engine.js";
import { withState, S, update, onSave, today } from "../store.js";
import { memberProgram } from "./coachprog.js";
import { RPE_INFO } from "./train.js";
import { $app, esc, toast, routes, actions, forms, header, R, go, isCoach, cloud, buzz, fr, num, onLeave, render, sheet, closeSheet, rerender } from "../core.js";

const POLL_MS = 4000;
const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
let LIVE = null;          // séance ouverte : { id, state, updated_at, timer }
export let LIVE_NOW = null; // séance active vue par le membre (bandeau de l'accueil)
let PICK = { j: -1, q: "", m: "", list: [] }; // sélecteur d'exercice (coach)
let DRAG = null;

const nowIso = () => new Date().toISOString();
const hm = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const rpeTxt = (v) => String(v).replace(".", ",");
const setLabel = (s) => `${s.lo}${s.hi && s.hi !== s.lo ? "-" + s.hi : ""}${s.pct ? " @" + s.pct + "%" : ""}${s.kg ? " · " + fr(s.kg, 1) + " kg" : ""}${s.rpe ? " · RPE " + rpeTxt(s.rpe) : ""}`;
const noteLabel = (by) => by === "coach" ? "Note du coach" : "Note du client";
const swap = (arr, a, b) => { if (a < 0 || b < 0 || a >= arr.length || b >= arr.length) return; [arr[a], arr[b]] = [arr[b], arr[a]]; };

// Crée la séance choisie (index si dans le programme) avec les prescriptions de la semaine demandée
export function buildLive(D, prog, si, week = 1) {
  if (!prog?.s?.length) throw new Error("ce client n'a pas de programme");
  const i = Math.min(Math.max(0, si || 0), prog.s.length - 1), [title, , rows] = prog.s[i];
  const exercises = (rows || []).filter(r => r[0]).map(r => {
    const wp = withState(D || {}, () => E.weekPlan(r[5], week, prog));
    return { name: r[0], note: r[2] || "", rest: r[5]?.rest || 120, ss: null, notes: [], sets: (wp.sets || []).filter(s => s.t !== "W").map(s => ({ t: s.t, lo: s.lo, hi: s.hi, kg: s.kg || null, pct: s.pct || null, rpe: s.rpe || null, tech: [], done: false, reps: null, load: null, by: null })) };
  }).filter(ex => ex.sets.length);
  return { title: String(title || "Séance").split("·")[0].trim(), startedAt: nowIso(), by: "coach", ended: false, exercises, log: [{ at: nowIso(), by: "coach", text: "Séance lancée" }] };
}

async function fetchState(id) { const c = await cloud(); const r = await c.liveGet(id); return r; }
// Écrit une modification : relit la séance d'abord, pour ne pas écraser ce que l'autre vient de noter
async function mutate(fn) {
  const c = await cloud(); const cur = await c.liveGet(LIVE.id);
  const st = cur?.state && Object.keys(cur.state).length ? JSON.parse(JSON.stringify(cur.state)) : JSON.parse(JSON.stringify(LIVE.state));
  fn(st);
  await c.liveSet(LIVE.id, st);
  LIVE.state = st; LIVE.updated_at = nowIso();
}
const who = (by) => by === "coach" ? "Thomas" : (isCoach() ? "Client" : "Toi");
const me = () => (isCoach() ? "coach" : "member");
const fail = (e) => toast("Enregistrement impossible : " + e.message);

// ---------- Écran de séance (les deux côtés) ----------
routes.live = async () => {
  const id = isCoach() ? R.param : await ownId();
  if (!id) return go("home");
  if (!LIVE || LIVE.id !== id) { stopPoll(); LIVE = { id, state: null, updated_at: null, timer: null }; }
  $app.innerHTML = header("Séance en direct", "", { back: isCoach() ? "admin" : "home" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  try { const r = await fetchState(id); LIVE.state = r?.state && Object.keys(r.state).length ? r.state : null; LIVE.updated_at = r?.updated_at || null; }
  catch (e) { $app.innerHTML = header("Séance en direct", "", { back: "home" }) + `<main class="page"><p class="empty">Impossible de charger la séance : ${esc(e.message)}</p></main>`; return; }
  // Coach : séance en cours chez le client mais jamais partagée → on la lit dans ses données synchronisées, sans rien lui demander
  if (isCoach() && (!LIVE.state || LIVE.state.ended || !LIVE.state.session)) {
    try {
      const seeded = await seedFromSnapshot(id, LIVE.state);
      if (seeded) { LIVE.state = seeded.state; LIVE.updated_at = seeded.updated_at; }
    } catch (e) { console.warn("seed live", e.message); }
  }
  // Séance au format « interface client » : on ouvre exactement l'écran de séance du client, partagé en direct
  if (LIVE.state?.session && !LIVE.state.ended) { stopPoll(); return enterMirror(id, LIVE.state, LIVE.updated_at); }
  drawLive();
  LIVE.timer = setInterval(pollLive, POLL_MS);
  onLeave(stopPoll);
};
async function seedFromSnapshot(id, old) {
  const c = await cloud(); const md = await c.memberData(id); const cur = md?.data?.current;
  if (!cur?.exercises?.length) return null;
  const start = cur.start || md.data.at || nowIso();
  if (old?.ended && old.endedAt && new Date(old.endedAt) >= new Date(start)) return null; // cette séance est déjà terminée
  const session = JSON.parse(JSON.stringify(cur)); delete session.mirror;
  const st = { title: cur.title, startedAt: start, by: "member", ended: false, session, log: [{ at: nowIso(), by: "coach", text: "Séance ouverte par le coach" }] };
  const stamp = await c.liveSet(id, st);
  return { state: st, updated_at: stamp };
}
function stopPoll() { if (LIVE?.timer) clearInterval(LIVE.timer); if (LIVE) LIVE.timer = null; }
async function pollLive() {
  if (!LIVE || !location.hash.startsWith("#/live")) return stopPoll();
  if (DRAG || document.querySelector(".sheet-wrap, input:focus, textarea:focus")) return; // on ne redessine pas pendant une saisie
  try { const r = await fetchState(LIVE.id); const s = r?.state && Object.keys(r.state).length ? r.state : null; if (r?.updated_at !== LIVE.updated_at) { LIVE.state = s; LIVE.updated_at = r?.updated_at || null; drawLive(); } }
  catch { }
}
async function ownId() { const c = await cloud(); await c.ensureSession(); return c.userId(); }

function drawLive() {
  const st = LIVE.state, id = LIVE.id;
  if (!st || st.ended) {
    $app.innerHTML = header("Séance en direct", "", { back: isCoach() ? "admin" : "home" }) + `<main class="page"><div class="card center mt16"><p style="margin:0">${st?.ended ? "Cette séance est terminée." : "Aucune séance en cours."}</p>${isCoach() ? `<button class="btn btn-red mt12" data-a="live-start" data-id="${esc(id)}">▶ Lancer une séance</button>` : `<button class="btn btn-red mt12" data-a="live-self">▶ Lancer ma séance du jour</button>`}</div></main>`;
    return;
  }
  const C = isCoach();
  const exs = st.exercises.map((ex, j) => {
    const ssOn = !!ex.ss && st.exercises[j + 1]?.ss === ex.ss;
    const ssTag = ex.ss ? `<span class="tag r">Superset</span>` : "";
    const ctl = C ? `<div class="row mt8" style="gap:6px;flex-wrap:wrap">
        <button class="ghost sm" data-a="live-ex-move" data-e="${j}" data-v="-1" aria-label="Monter l'exercice">↑</button>
        <button class="ghost sm" data-a="live-ex-move" data-e="${j}" data-v="1" aria-label="Descendre l'exercice">↓</button>
        <button class="ghost sm" data-a="live-ex-pick" data-e="${j}">Changer</button>
        ${j < st.exercises.length - 1 ? `<button class="ghost sm" data-a="live-ss" data-e="${j}">${ssOn ? "Retirer le superset" : "Superset avec le suivant"}</button>` : ""}
        <button class="ghost sm" data-a="live-ex-del" data-e="${j}" style="color:var(--red)">Supprimer</button></div>` : "";
    const sets = ex.sets.map((s, k) => {
      const type = s.t && s.t !== "N" ? `<span class="tag r">${esc(E.SET_TYPES[s.t] || s.t)}</span>` : "";
      const techs = (s.tech || []).map(t => `<span class="tag">${esc(t)}</span>`).join(" ");
      const sctl = C ? `<div class="row mt4" style="gap:10px;flex-wrap:wrap">
          <button class="link xs" data-a="live-set-move" data-e="${j}" data-s="${k}" data-v="-1">↑</button>
          <button class="link xs" data-a="live-set-move" data-e="${j}" data-s="${k}" data-v="1">↓</button>
          <button class="link xs" data-a="live-set-type" data-e="${j}" data-s="${k}">Type</button>
          <button class="link xs" data-a="live-tech" data-e="${j}" data-s="${k}">Techniques</button>
          <button class="link xs" data-a="live-set-del" data-e="${j}" data-s="${k}" style="color:var(--red)">Supprimer</button></div>` : "";
      const sn = s.note ? `<div class="xs mt4"><b>${esc(noteLabel(s.note.by))}</b> : ${esc(s.note.text)}</div>` : "";
      return `<div class="card mt8" data-ds="${j}-${k}" style="padding:10px;${s.done ? "opacity:.75" : ""}">
        <div class="row" style="gap:6px;align-items:center">
          ${C ? `<span data-drag="set" data-j="${j}" data-k="${k}" style="touch-action:none;cursor:grab;font-size:20px" aria-label="Glisser la série">⠿</span>` : ""}
          <span class="grow small"><b>Série ${k + 1}</b> · ${esc(setLabel(s))} ${type}${techs ? `<br>${techs}` : ""}${s.reps != null ? `<br><span class="xs muted">fait : ${s.reps} rép${s.load ? ` · ${fr(s.load, 1)} kg` : ""} · ${esc(who(s.by))}</span>` : ""}</span>
          <input class="inp" style="width:58px;padding:6px" inputmode="numeric" placeholder="reps" id="lr-${j}-${k}" value="${s.reps ?? ""}" aria-label="Répétitions">
          <input class="inp" style="width:66px;padding:6px" inputmode="decimal" placeholder="kg" id="lk-${j}-${k}" value="${s.load ?? ""}" aria-label="Charge (kg)">
          <button class="rpe-btn ${s.rpe == null ? "ph" : ""}" data-a="live-rpe" data-e="${j}" data-s="${k}" aria-label="RPE de la série">RPE ${s.rpe != null ? rpeTxt(s.rpe) : "–"}</button>
          <button class="icon-btn ${s.done ? "on" : ""}" data-a="live-set" data-e="${j}" data-s="${k}" aria-label="Série faite" style="${s.done ? "background:var(--gradbtn);color:#fff;border:0" : ""}">✓</button></div>${sn}<div class="row mt4" style="gap:12px"><button class="link xs" data-a="live-setnote" data-e="${j}" data-s="${k}">📝 ${s.note ? "Modifier la note" : "Note sur la série"}</button></div>${sctl}</div>`;
    }).join("");
    const notes = (ex.notes || []).map(n => `<div class="xs mt8"><b>${esc(noteLabel(n.by))}</b> · ${hm(n.at)}<br>${esc(n.text)}</div>`).join("");
    return `<div class="card mt12" data-dx="${j}">
      <div class="row between" style="gap:8px"><span class="row" style="gap:4px;align-items:center">${C ? `<span data-drag="ex" data-j="${j}" style="touch-action:none;cursor:grab;padding:0 8px 0 0;font-size:22px" aria-label="Glisser pour réordonner">⠿</span>` : ""}<b>${esc(ex.name)}</b></span><span class="xs muted">repos ${ex.rest} s ${ssTag}</span></div>
      <p class="xs muted" style="margin:2px 0 0">${esc(E.musclesOf(ex.name).join(" · "))}</p>
      ${ex.note ? `<p class="xs muted" style="margin:4px 0 0">${esc(ex.note)}</p>` : ""}
      ${ctl}
      ${sets}
      <button class="link small mt8" data-a="live-addset" data-e="${j}">+ Série</button>
      ${notes}
      <form class="row mt8" style="gap:6px" data-f="live-exnote" data-e="${j}"><input class="inp grow" name="text" required maxlength="200" placeholder="Note sur cet exercice"><button class="btn btn-line btn-sm">Noter</button></form>
    </div>`;
  }).join("");
  const log = (st.log || []).slice(-12).reverse().map(l => `<div class="li"><span class="grow small"><b>${esc(who(l.by))}</b> · ${esc(l.text)}</span><span class="xs muted">${hm(l.at)}</span></div>`).join("");
  $app.innerHTML = header(esc(st.title), `Lancée par ${st.by === "member" ? "le client" : "Thomas"} à ${hm(st.startedAt)}`, { back: isCoach() ? "admin" : "home" }) + `<main class="page">
    <div class="card soft mt8"><span class="tag r">● En cours</span> <span class="xs muted">Vous la voyez tous les deux et vous pouvez tout ajouter. Mise à jour toutes les 6 secondes.</span></div>
    ${exs}
    <h2 class="sec">Ajouter un exercice</h2>
    <form class="card" data-f="live-add"><label class="field"><span>Exercice</span><input name="name" required maxlength="80" placeholder="Ex. Rowing buste penché"></label>
      <label class="field mt8"><span>Séries (facultatif)</span><input name="sets" maxlength="80" placeholder="3x8-10 RPE8"></label>
      <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm">Ajouter</button>${C ? `<button type="button" class="btn btn-line btn-sm" data-a="live-ex-pick" data-e="-1">Choisir dans la liste</button>` : ""}</div></form>
    <h2 class="sec">Note générale</h2>
    <form class="card" data-f="live-note"><label class="field"><span>Ce qui se passe</span><input name="text" required maxlength="200" placeholder="Ex. Genou douloureux, on baisse la charge"></label><button class="btn btn-line btn-sm mt8">Ajouter la note</button></form>
    ${log ? `<h2 class="sec">Journal de la séance</h2><div class="list">${log}</div>` : ""}
    <button class="btn btn-line mt16" style="width:100%;color:var(--red)" data-a="live-end">Terminer la séance</button>
  </main>`;
}

// ---------- Sélecteur d'exercice (coach) : recherche par nom ou par muscle ----------
function catalog() {
  const F = E.fiches()?.ex || {};
  const names = new Set([...Object.keys(F), ...Object.keys(E.extra.exercises || {}), ...((E.lib()?.BASE || []).map(r => r[0]))]);
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
}
function openPicker(j) {
  PICK = { j, q: "", m: "", list: catalog() };
  sheet(`<h2 class="h2">${j < 0 ? "Ajouter un exercice" : "Changer d'exercice"}</h2>
    <input class="inp mt8" id="xq" placeholder="Chercher un exercice…" autocomplete="off">
    <div class="row mt8" style="gap:6px;flex-wrap:wrap">${["Tous", ...E.MUSCLES].map(m => `<button class="tag ${m === "Tous" ? "r" : ""}" data-a="live-muscle" data-m="${esc(m === "Tous" ? "" : m)}">${esc(m)}</button>`).join("")}</div>
    <div class="list mt8" id="xl"></div>`);
  drawPicker();
  const q = document.getElementById("xq");
  if (q) q.oninput = () => { PICK.q = q.value; drawPicker(); };
}
function drawPicker() {
  const el = document.getElementById("xl"); if (!el) return;
  const qq = PICK.q.trim().toLowerCase();
  const rows = PICK.list.map((n, i) => ({ n, i })).filter(({ n }) => (!qq || n.toLowerCase().includes(qq)) && (!PICK.m || E.musclesOf(n).includes(PICK.m))).slice(0, 80);
  el.innerHTML = rows.length ? rows.map(({ n, i }) => `<button class="li" data-a="live-pick" data-v="${i}"><span class="grow small"><b>${esc(n)}</b><br><span class="xs muted">${esc(E.musclesOf(n).join(" · "))}</span></span></button>`).join("")
    : `<p class="empty small">Aucun exercice trouvé : écris-le dans « Ajouter un exercice ».</p>`;
}
actions["live-muscle"] = (b, d) => { PICK.m = d.m || ""; drawPicker(); };
actions["live-pick"] = async (b, d) => {
  const name = PICK.list[+d.v], j = PICK.j;
  if (!name) return;
  try {
    if (j < 0) await mutate(st => { st.exercises.push({ name, note: "", rest: 120, ss: null, notes: [], sets: [{ t: "N", lo: 8, hi: 10, kg: null, pct: null, rpe: 8, tech: [], done: false, reps: null, load: null, by: null }] }); st.log.push({ at: nowIso(), by: me(), text: `Exercice ajouté : ${name}` }); });
    else await mutate(st => { const ex = st.exercises[j]; if (!ex) return; st.log.push({ at: nowIso(), by: me(), text: `${ex.name} remplacé par ${name}` }); ex.name = name; });
    closeSheet(); toast(j < 0 ? "Exercice ajouté" : "Exercice changé");
  } catch (e) { fail(e); }
  drawLive();
};

// ---------- Actions ----------
const coachOnly = (fn) => (b, d) => isCoach() ? fn(b, d) : toast("Réservé au coach");
actions["live-set"] = async (b, d) => {
  const j = +d.e, k = +d.s, reps = num(document.getElementById(`lr-${j}-${k}`)?.value), load = num(document.getElementById(`lk-${j}-${k}`)?.value);
  try { await mutate(st => { const s = st.exercises[j].sets[k]; s.done = !s.done; s.reps = s.done ? (reps > 0 ? reps : (s.lo || null)) : null; s.load = s.done && load > 0 ? load : (s.done ? s.kg || null : null); s.by = s.done ? me() : null; }); buzz(); }
  catch (e) { toast("Enregistrement impossible : " + e.message); }
  drawLive();
};
actions["live-addset"] = async (b, d) => {
  try { await mutate(st => { const ex = st.exercises[+d.e], last = ex.sets.at(-1) || { t: "N", lo: 8, hi: 10 }; ex.sets.push({ t: "N", lo: last.lo, hi: last.hi, kg: last.kg || null, pct: null, rpe: last.rpe || null, tech: [], done: false, reps: null, load: null, by: null }); }); }
  catch (e) { fail(e); }
  drawLive();
};
// Réorganiser, supprimer, changer (coach)
actions["live-ex-move"] = coachOnly(async (b, d) => {
  try { await mutate(st => swap(st.exercises, +d.e, +d.e + +d.v)); } catch (e) { fail(e); }
  drawLive();
});
actions["live-ex-del"] = coachOnly(async (b, d) => {
  if (!confirm("Retirer cet exercice de la séance ?")) return;
  try { await mutate(st => { const [x] = st.exercises.splice(+d.e, 1); st.log.push({ at: nowIso(), by: me(), text: `Exercice retiré : ${x?.name || ""}` }); }); } catch (e) { fail(e); }
  drawLive();
});
actions["live-ex-pick"] = coachOnly((b, d) => openPicker(+d.e));
actions["live-ss"] = coachOnly(async (b, d) => {
  const j = +d.e;
  try {
    await mutate(st => {
      const a = st.exercises[j], n = st.exercises[j + 1];
      if (!a || !n) throw new Error("il faut un exercice suivant");
      if (a.ss && a.ss === n.ss) { a.ss = null; n.ss = null; }
      else { const g = "ss" + j; a.ss = g; n.ss = g; }
    });
  } catch (e) { toast(e.message); }
  drawLive();
});
actions["live-set-move"] = coachOnly(async (b, d) => {
  try { await mutate(st => swap(st.exercises[+d.e].sets, +d.s, +d.s + +d.v)); } catch (e) { fail(e); }
  drawLive();
});
actions["live-set-del"] = coachOnly(async (b, d) => {
  try { await mutate(st => { st.exercises[+d.e].sets.splice(+d.s, 1); }); } catch (e) { fail(e); }
  drawLive();
});
// Type de série
actions["live-set-type"] = coachOnly((b, d) => sheet(`<h2 class="h2">Type de série</h2><div class="list mt8">${Object.entries(E.SET_TYPES).map(([k, l]) => `<button class="li" data-a="live-set-type-set" data-e="${d.e}" data-s="${d.s}" data-v="${k}"><span class="grow small"><b>${esc(l)}</b></span></button>`).join("")}</div>`));
actions["live-set-type-set"] = async (b, d) => {
  try { await mutate(st => { st.exercises[+d.e].sets[+d.s].t = d.v; }); } catch (e) { fail(e); }
  closeSheet(); drawLive();
};
// Techniques d'intensification (plusieurs possibles par série)
actions["live-tech"] = coachOnly((b, d) => {
  const cur = LIVE.state?.exercises?.[+d.e]?.sets?.[+d.s]?.tech || [];
  sheet(`<h2 class="h2">Techniques d'intensification</h2><p class="xs muted">Touche pour cocher ou décocher.</p><div class="list mt8">${E.TECHS.map(([ic, n]) => `<button class="li" data-a="live-tech-set" data-e="${d.e}" data-s="${d.s}" data-v="${esc(n)}"><span class="grow small">${ic} ${esc(n)}</span><span>${cur.includes(n) ? "✓" : ""}</span></button>`).join("")}</div>`);
});
actions["live-tech-set"] = async (b, d) => {
  try { await mutate(st => { const s = st.exercises[+d.e].sets[+d.s]; const t = new Set(s.tech || []); if (t.has(d.v)) t.delete(d.v); else t.add(d.v); s.tech = [...t]; }); } catch (e) { fail(e); }
  closeSheet(); actions["live-tech"](null, d); drawLive();
};
// RPE de 6 à 10 par demi-points, avec le libellé d'effort
actions["live-rpe"] = (b, d) => {
  const cur = LIVE.state?.exercises?.[+d.e]?.sets?.[+d.s]?.rpe;
  sheet(`<h2 class="h2">RPE de la série</h2><p class="xs muted">Effort ressenti : 10 = maximal, 6 = facile.</p><div class="list mt8">${RPE_VALUES.map(v => `<button class="li" data-a="live-rpe-set" data-e="${d.e}" data-s="${d.s}" data-v="${v}"><span class="grow small"><b>RPE ${rpeTxt(v)} · ${esc(RPE_INFO[v][0])}</b><br><span class="xs muted">${esc(RPE_INFO[v][1])}</span></span><span>${cur === v ? "✓" : ""}</span></button>`).join("")}
    <button class="li" data-a="live-rpe-set" data-e="${d.e}" data-s="${d.s}" data-v="0"><span class="grow small">Sans RPE</span></button></div>`);
};
actions["live-rpe-set"] = async (b, d) => {
  try { await mutate(st => { st.exercises[+d.e].sets[+d.s].rpe = +d.v || null; }); } catch (e) { fail(e); }
  closeSheet(); drawLive();
};
// Notes par exercice, étiquetées coach ou client
forms["live-exnote"] = async (v, f) => {
  const j = +f.dataset.e;
  try { await mutate(st => { const ex = st.exercises[j]; ex.notes = [...(ex.notes || []), { by: me(), at: nowIso(), text: v.text.trim() }]; }); f.reset(); }
  catch (e) { fail(e); }
  drawLive();
};
forms["live-add"] = async (v, f) => {
  const parsed = E.parseSets(v.sets || "3x8-10 RPE8");
  if (!parsed.length) return toast("Séries illisibles : écris par exemple « 3x8-10 RPE8 »");
  try { await mutate(st => { st.exercises.push({ name: v.name.trim(), note: "", rest: 120, ss: null, notes: [], sets: parsed.map(s => ({ ...s, tech: [], done: false, reps: null, load: null, by: null })) }); st.log.push({ at: nowIso(), by: me(), text: `Exercice ajouté : ${v.name.trim()}` }); }); f.reset(); toast("Exercice ajouté"); }
  catch (e) { fail(e); }
  drawLive();
};
forms["live-note"] = async (v, f) => {
  try { await mutate(st => st.log.push({ at: nowIso(), by: me(), text: v.text.trim() })); f.reset(); }
  catch (e) { fail(e); }
  drawLive();
};
actions["live-end"] = async () => {
  if (!confirm("Terminer la séance pour vous deux ?")) return;
  try { await mutate(st => { st.ended = true; st.endedAt = nowIso(); st.log.push({ at: nowIso(), by: me(), text: "Séance terminée" }); }); toast("Séance terminée"); LIVE_NOW = null; }
  catch (e) { toast("Impossible : " + e.message); }
  drawLive();
};
// Coach : choisit la séance du programme à lancer (ou ouvre celle qui tourne déjà)
actions["live-start"] = async (b, d) => {
  const id = d.id;
  try {
    const c = await cloud(); const cur = await c.liveGet(id);
    if (cur?.state && !cur.state.ended && Object.keys(cur.state).length) return go("live", id);
    const md = (await c.memberData(id))?.data, cp = await c.coachPlanGet(id).catch(() => null);
    if (md?.current?.exercises?.length) return go("live", id);
    const prog = cp?.program?.s?.length ? cp.program : memberProgram(md);
    if (!prog) return toast("Ce client n'a pas encore de programme : envoie-lui un programme d'abord");
    const week = md?.plan?.week || 1;
    sheet(`<h2 class="h2">Quelle séance lancer ?</h2><p class="xs muted">Semaine ${week} · touche la séance, elle s'ouvre pour vous deux.</p>
      <div class="list mt8">${prog.s.map(([n, day], i) => `<button class="li" data-a="live-launch" data-id="${esc(id)}" data-v="${i}"><span class="grow small"><b>${esc(String(n).split("·")[0].trim())}</b><br><span class="xs muted">${esc(day || "")}</span></span></button>`).join("")}</div>`);
  } catch (e) { toast("Impossible de lancer : " + e.message); }
};
actions["live-launch"] = async (b, d) => {
  try {
    const c = await cloud(); const md = (await c.memberData(d.id))?.data, cp = await c.coachPlanGet(d.id).catch(() => null);
    const prog0 = cp?.program?.s?.length ? cp.program : memberProgram(md);
    if (!prog0) throw new Error("ce client n'a pas de programme");
    await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
    const prog = { ...prog0, id: prog0.id || "coach-plan", custom: true }, week = md?.plan?.week || 1;
    const D2 = { ...(md || {}), customPrograms: [prog, ...((md?.customPrograms || []).filter(x => x.id !== prog.id))], plan: { programId: prog.id, startedAt: today(), week, idx: +d.v, cycle: 1 } };
    const ses = withState(D2, () => E.buildSession(+d.v));
    if (!ses) throw new Error("séance introuvable");
    ses.start = nowIso(); ses.free = false;
    await c.liveSet(d.id, { title: ses.title, startedAt: ses.start, by: "coach", ended: false, session: ses, log: [{ at: nowIso(), by: "coach", text: "Séance lancée" }] });
    closeSheet(); buzz(); toast("Séance lancée : le client la voit aussi"); go("live", d.id);
  } catch (e) { toast("Impossible de lancer : " + e.message); }
};

// Membre : lance sa propre séance partagée (le coach la voit remplir en direct)
// Membre : partage la séance en cours (ou celle du jour) avec le coach. Garde la progression si la séance a déjà commencé.
async function shareSession(silent = false) {
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  const c = await cloud(); await c.ensureSession(); const uid = c.userId();
  let cur = S().current;
  if (!cur) {
    const ses = E.buildSession(); if (!ses) { if (!silent) toast("Pas de séance prévue : choisis un programme d'abord"); return false; }
    ses.start = nowIso(); cur = ses;
  }
  update(st => { st.current = { ...cur, mirror: { id: uid } }; });
  MIRROR = { id: uid, stamp: null, quiet: false };
  await pushMirror();
  if (!silent) { buzz(); toast("Séance partagée : Thomas peut la suivre"); }
  return true;
}
actions["live-self"] = async () => {
  try {
    const was = !!S().current;
    if (!(await shareSession(false))) return;
    if (!was) { sessionStorage.removeItem("cxs.min"); go("workout"); } else rerender();
  } catch (e) { toast("Impossible de partager : " + e.message); }
};

// Membre : bandeau sur l'accueil quand une séance tourne
export async function pullLive() {
  if (isCoach()) return;
  try {
    const c = await cloud(); await c.ensureSession(); const r = await c.liveGet(c.userId());
    const active = r?.state && !r.state.ended && Object.keys(r.state).length ? r.state : null;
    const changed = !!active !== !!LIVE_NOW;
    LIVE_NOW = active ? { ...active, id: c.userId() } : null;
    if (changed && R.route === "home") render();
  } catch { }
}
export function liveBanner() {
  if (isCoach()) return "";
  if (!LIVE_NOW) return `<button class="btn btn-line btn-sm mt12" data-a="live-self" style="width:100%">🔴 Partager ma séance en direct avec Thomas</button>`;
  return `<button class="card tap mt12" data-a="go" data-r="live" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;box-shadow:0 0 0 2px var(--red) inset"><span style="font-size:26px">🔴</span><span class="grow"><b>Séance en cours avec Thomas</b><br><span class="small muted">${esc(LIVE_NOW.title)} · touche pour la suivre et ajouter</span></span></button>`;
}

// Note sur une série : étiquetée « Note du coach » ou « Note du client » selon l'auteur
actions["live-setnote"] = async (b, d) => {
  const cur = LIVE.state?.exercises?.[+d.e]?.sets?.[+d.s]?.note?.text || "";
  const t = prompt("Note sur cette série (gêne, sensation, consigne…)", cur); if (t == null) return;
  try { await mutate(st => { const s = st.exercises[+d.e].sets[+d.s]; if (t.trim()) s.note = { by: me(), at: nowIso(), text: t.trim() }; else delete s.note; }); } catch (e) { fail(e); }
  drawLive();
};
// Glisser-déposer (coach) : exercices et séries, par la poignée ⠿
document.addEventListener("pointerdown", (e) => {
  const h = e.target.closest?.("[data-drag]"); if (!h || !isCoach() || !LIVE?.state) return;
  e.preventDefault();
  DRAG = { kind: h.dataset.drag, j: +h.dataset.j, k: +(h.dataset.k ?? -1), to: null, el: h.closest("[data-dx],[data-ds]") };
  DRAG.el?.classList.add("dragging");
});
document.addEventListener("pointermove", (e) => {
  if (!DRAG) return;
  const t = document.elementFromPoint(e.clientX, e.clientY)?.closest(DRAG.kind === "ex" ? "[data-dx]" : `[data-ds^="${DRAG.j}-"]`);
  document.querySelectorAll(".drop-t").forEach(x => x.classList.remove("drop-t"));
  if (t) { t.classList.add("drop-t"); DRAG.to = DRAG.kind === "ex" ? +t.dataset.dx : +t.dataset.ds.split("-")[1]; }
});
const endDrag = async () => {
  if (!DRAG) return; const D = DRAG; DRAG = null;
  document.querySelectorAll(".drop-t,.dragging").forEach(x => x.classList.remove("drop-t", "dragging"));
  const from = D.kind === "ex" ? D.j : D.k;
  if (D.to == null || D.to === from) return;
  try { await mutate(st => { const arr = D.kind === "ex" ? st.exercises : st.exercises[D.j].sets; const [x] = arr.splice(from, 1); arr.splice(D.to, 0, x); }); } catch (e) { fail(e); }
  drawLive();
};
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

// =====================================================================
// SÉANCE EN DIRECT = la même interface que le client
// La séance est un objet « séance du client » partagé dans le cloud. Le coach (ou le client) l'ouvre dans l'écran de séance
// habituel : chaque modification est envoyée en direct, et ce que l'autre modifie arrive toutes les 6 secondes.
// =====================================================================
let MIRROR = null; // { id, stamp, timer, quiet, name }
let pushT = null;
const strip = (cur) => { const c = JSON.parse(JSON.stringify(cur)); delete c.mirror; return c; };
async function pushMirror() {
  const cur = S().current; if (!MIRROR || !cur?.mirror) return;
  try {
    const c = await cloud(); const r = await c.liveGet(MIRROR.id), base = r?.state || {};
    if (base.ended) return;
    const st = { log: [], ...base, title: cur.title, startedAt: base.startedAt || cur.start || nowIso(), by: base.by || (isCoach() ? "coach" : "member"), ended: false, session: strip(cur) };
    MIRROR.stamp = await c.liveSet(MIRROR.id, st);
  } catch { }
}
onSave(() => { if (!MIRROR || MIRROR.quiet || !S().current?.mirror) return; clearTimeout(pushT); pushT = setTimeout(pushMirror, 600); });
function enterMirror(id, state, stamp) {
  if (S().current && !S().current.mirror) { toast("Termine d'abord ta séance en cours"); return go("workout"); }
  const m = (window.__members || []).find(x => x.id === id);
  clearInterval(MIRROR?.timer);
  MIRROR = { id, stamp, quiet: true, name: m ? (m.name || m.email || "client").split(" ")[0] : "" };
  sessionStorage.removeItem("cxs.min");
  update(st => { st.current = { ...state.session, start: state.session.start || state.startedAt, mirror: { id } }; });
  MIRROR.quiet = false;
  if (isCoach()) { E.setHist(null); cloud().then(c => c.memberData(id)).then(md => { if (MIRROR?.id === id && md?.data?.workouts) { E.setHist(md.data.workouts); if (R.route === "workout") rerender(); } }).catch(() => { }); }
  go("workout");
}
function leaveMirror(msg) {
  clearInterval(MIRROR?.timer); clearTimeout(pushT); const id = MIRROR?.id; MIRROR = null; E.setHist(null);
  update(st => { st.current = null; });
  if (msg) toast(msg);
  if (isCoach()) go("member", id); else go("home");
}
const baseWorkout = routes.workout, baseFinish = actions.finish, baseMin = actions.minimize;
routes.workout = async () => {
  // Toute séance d'un client est partagée automatiquement avec le coach dès qu'elle est ouverte
  if (!isCoach() && S().current && !S().current.mirror) { try { await shareSession(true); } catch { } }
  const c0 = S().current;
  if (c0?.mirror && !MIRROR) { if (isCoach()) { update(st => { st.current = null; }); return go("admin-today"); } MIRROR = { id: c0.mirror.id, stamp: null }; }
  await baseWorkout();
  if (!MIRROR || !S().current?.mirror) return;
  const main = document.querySelector("main.page");
  main?.insertAdjacentHTML("afterbegin", `<div class="card soft mt8"><span class="tag r">● En direct</span> <span class="xs muted">${isCoach() ? `Tu vois et modifies la séance${MIRROR.name ? " de " + esc(MIRROR.name) : ""} : tout est partagé.` : "Séance partagée avec Thomas : il voit tes séries en direct et peut modifier."}</span></div>`);
  clearInterval(MIRROR.timer);
  MIRROR.timer = setInterval(pollMirror, POLL_MS);
};
// Coach : reprend dans sa copie tout ce que le client valide sur son téléphone (lu dans ses données synchronisées),
// sans écraser ce que le coach a modifié sur des séries non faites.
async function mergeClientProgress() {
  const c = await cloud(), md = await c.memberData(MIRROR.id), snap = md?.data?.current, cur = S().current;
  if (!snap?.exercises || !cur || md.updated_at === MIRROR.snapStamp) return;
  MIRROR.snapStamp = md.updated_at;
  if (snap.start && cur.start && new Date(snap.start).getTime() !== new Date(cur.start).getTime()) return; // autre séance
  let changed = false; const F = ["kg", "reps", "rpe", "done", "note", "pain", "tech", "type", "trpe", "tq"];
  const next = JSON.parse(JSON.stringify(cur));
  snap.exercises.forEach(se => {
    let le = next.exercises.find(e => e.name === se.name && e.orig === se.orig) || next.exercises.find(e => e.name === se.name);
    if (!le) { next.exercises.push(JSON.parse(JSON.stringify(se))); changed = true; return; }
    se.sets.forEach((cs, k) => {
      const ls = le.sets[k];
      if (!ls) { le.sets.push(JSON.parse(JSON.stringify(cs))); changed = true; return; }
      if (cs.done && JSON.stringify(F.map(f => cs[f])) !== JSON.stringify(F.map(f => ls[f]))) { F.forEach(f => { if (cs[f] !== undefined) ls[f] = cs[f]; }); changed = true; }
    });
  });
  if (!changed) return;
  MIRROR.quiet = true; update(st => { st.current = { ...next, mirror: cur.mirror }; }); MIRROR.quiet = false;
  try { await pushMirror(); } catch { }
  rerender();
}
async function pollMirror() {
  if (!MIRROR || R.route !== "workout" || !S().current?.mirror) { clearInterval(MIRROR?.timer); return; }
  if (DRAG || document.querySelector(".sheet-wrap, input:focus, textarea:focus, select:focus")) return;
  try {
    const r = await (await cloud()).liveGet(MIRROR.id);
    if (!r?.state || r.state.ended) {
      if (!isCoach() && S().current.exercises.some(e => e.sets.some(x => x.done))) { const cur = S().current; E.finishSession(cur); MIRROR = null; clearInterval(0); toast("Thomas a terminé la séance : elle est enregistrée"); return go("done"); }
      return leaveMirror("Séance terminée");
    }
    if (isCoach()) await mergeClientProgress();
    if (r.updated_at !== MIRROR.stamp && r.state.session) {
      MIRROR.stamp = r.updated_at; MIRROR.quiet = true;
      update(st => { st.current = { ...r.state.session, start: r.state.session.start || r.state.startedAt, mirror: { id: MIRROR.id } }; });
      MIRROR.quiet = false; rerender();
    }
  } catch { }
}
actions.finish = async () => {
  if (!MIRROR || !S().current?.mirror) return baseFinish();
  if (isCoach()) {
    if (!confirm("Terminer la séance en direct de ce client ?")) return;
    try { const c = await cloud(); const r = await c.liveGet(MIRROR.id); await c.liveSet(MIRROR.id, { ...(r?.state || {}), ended: true, endedAt: nowIso(), session: strip(S().current) }); } catch (e) { return toast("Impossible : " + e.message); }
    return leaveMirror("Séance terminée");
  }
  const id = MIRROR.id; baseFinish();
  if (!S().current) { clearInterval(MIRROR?.timer); MIRROR = null; E.setHist(null); try { const c = await cloud(); const r = await c.liveGet(id); await c.liveSet(id, { ...(r?.state || {}), ended: true, endedAt: nowIso() }); } catch { } LIVE_NOW = null; }
};
actions.minimize = () => {
  if (MIRROR && S().current?.mirror && isCoach()) return leaveMirror();
  baseMin();
};
