// Séance en direct partagée : le coach lance la séance d'un membre ; les deux la voient, la mettent à jour, et peuvent ajouter.
// Mise à jour toutes les 6 secondes quand l'écran est ouvert (pas de temps réel continu). Chaque geste est écrit tout de suite.
import * as E from "../engine.js";
import { withState } from "../store.js";
import { $app, esc, toast, routes, actions, forms, header, R, go, isCoach, cloud, buzz, fr, num, onLeave, render } from "../core.js";

const POLL_MS = 6000;
let LIVE = null;          // séance ouverte : { id, state, updated_at, timer }
export let LIVE_NOW = null; // séance active vue par le membre (bandeau de l'accueil)

const nowIso = () => new Date().toISOString();
const hm = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const setLabel = (s) => `${s.lo}${s.hi && s.hi !== s.lo ? "-" + s.hi : ""}${s.pct ? " @" + s.pct + "%" : ""}${s.kg ? " · " + fr(s.kg, 1) + " kg" : ""}${s.rpe ? " · RPE " + s.rpe : ""}`;

// Crée la séance à partir du programme du membre : la séance suivante, avec les prescriptions de sa semaine en cours
export function buildLive(D) {
  const plan = D?.plan; if (!plan) throw new Error("ce membre n'a pas encore de programme");
  const prog = withState(D, () => E.program(plan.programId));
  if (!prog?.s?.length) throw new Error("programme du membre introuvable");
  const si = Math.min(plan.idx || 0, prog.s.length - 1), [title, , rows] = prog.s[si], week = plan.week || 1;
  const exercises = (rows || []).filter(r => r[0]).map(r => {
    const wp = withState(D, () => E.weekPlan(r[5], week, prog));
    return { name: r[0], note: r[2] || "", rest: r[5]?.rest || 120, sets: (wp.sets || []).filter(s => s.t !== "W").map(s => ({ t: s.t, lo: s.lo, hi: s.hi, kg: s.kg || null, pct: s.pct || null, rpe: s.rpe || null, done: false, reps: null, load: null, by: null })) };
  });
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

// ---------- Écran de séance (les deux côtés) ----------
routes.live = async () => {
  const id = isCoach() ? R.param : await ownId();
  if (!id) return go("home");
  if (!LIVE || LIVE.id !== id) { stopPoll(); LIVE = { id, state: null, updated_at: null, timer: null }; }
  $app.innerHTML = header("Séance en direct", "", { back: isCoach() ? "admin" : "home" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  try { const r = await fetchState(id); LIVE.state = r?.state && Object.keys(r.state).length ? r.state : null; LIVE.updated_at = r?.updated_at || null; }
  catch (e) { $app.innerHTML = header("Séance en direct", "", { back: "home" }) + `<main class="page"><p class="empty">Impossible de charger la séance : ${esc(e.message)}</p></main>`; return; }
  drawLive();
  LIVE.timer = setInterval(pollLive, POLL_MS);
  onLeave(stopPoll);
};
function stopPoll() { if (LIVE?.timer) clearInterval(LIVE.timer); if (LIVE) LIVE.timer = null; }
async function pollLive() {
  if (!LIVE || !location.hash.startsWith("#/live")) return stopPoll();
  if (document.querySelector(".sheet-wrap, input:focus, textarea:focus")) return; // on ne redessine pas pendant une saisie
  try { const r = await fetchState(LIVE.id); const s = r?.state && Object.keys(r.state).length ? r.state : null; if (r?.updated_at !== LIVE.updated_at) { LIVE.state = s; LIVE.updated_at = r?.updated_at || null; drawLive(); } }
  catch { }
}
async function ownId() { const c = await cloud(); await c.ensureSession(); return c.userId(); }

function drawLive() {
  const st = LIVE.state, id = LIVE.id;
  if (!st || st.ended) {
    $app.innerHTML = header("Séance en direct", "", { back: isCoach() ? "admin" : "home" }) + `<main class="page"><div class="card center mt16"><p style="margin:0">${st?.ended ? "Cette séance est terminée." : "Aucune séance en cours."}</p>${isCoach() ? `<button class="btn btn-red mt12" data-a="live-start" data-id="${esc(id)}">▶ Lancer une séance</button>` : ""}</div></main>`;
    return;
  }
  const exs = st.exercises.map((ex, j) => `<div class="card mt12"><div class="row between"><b>${esc(ex.name)}</b><span class="xs muted">repos ${ex.rest} s</span></div>
    ${ex.note ? `<p class="xs muted" style="margin:4px 0 0">${esc(ex.note)}</p>` : ""}
    ${ex.sets.map((s, k) => `<div class="row mt8" style="gap:6px;align-items:center;${s.done ? "opacity:.75" : ""}">
      <span class="grow small"><b>Série ${k + 1}</b> · ${esc(setLabel(s))}${s.reps != null ? `<br><span class="xs muted">fait : ${s.reps} rép${s.load ? ` · ${fr(s.load, 1)} kg` : ""} · ${esc(who(s.by))}</span>` : ""}</span>
      <input class="inp" style="width:64px;padding:6px" inputmode="numeric" placeholder="reps" id="lr-${j}-${k}" value="${s.reps ?? ""}" aria-label="Répétitions">
      <input class="inp" style="width:72px;padding:6px" inputmode="decimal" placeholder="kg" id="lk-${j}-${k}" value="${s.load ?? ""}" aria-label="Charge (kg)">
      <button class="icon-btn ${s.done ? "on" : ""}" data-a="live-set" data-e="${j}" data-s="${k}" aria-label="Série faite" style="${s.done ? "background:var(--gradbtn);color:#fff;border:0" : ""}">✓</button></div>`).join("")}
    <button class="link small mt8" data-a="live-addset" data-e="${j}">+ Série</button></div>`).join("");
  const log = (st.log || []).slice(-12).reverse().map(l => `<div class="li"><span class="grow small"><b>${esc(who(l.by))}</b> · ${esc(l.text)}</span><span class="xs muted">${hm(l.at)}</span></div>`).join("");
  $app.innerHTML = header(esc(st.title), `Lancée par Thomas à ${hm(st.startedAt)}`, { back: isCoach() ? "admin" : "home" }) + `<main class="page">
    <div class="card soft mt8"><span class="tag r">● En cours</span> <span class="xs muted">Vous la voyez tous les deux et vous pouvez tout ajouter.</span></div>
    ${exs}
    <h2 class="sec">Ajouter un exercice</h2>
    <form class="card" data-f="live-add"><label class="field"><span>Exercice</span><input name="name" required maxlength="80" placeholder="Ex. Rowing buste penché"></label>
      <label class="field mt8"><span>Séries (facultatif)</span><input name="sets" maxlength="80" placeholder="3x8-10 RPE8"></label><button class="btn btn-line btn-sm mt8">Ajouter</button></form>
    <h2 class="sec">Note</h2>
    <form class="card" data-f="live-note"><label class="field"><span>Ce qui se passe</span><input name="text" required maxlength="200" placeholder="Ex. Genou douloureux, on baisse la charge"></label><button class="btn btn-line btn-sm mt8">Ajouter la note</button></form>
    ${log ? `<h2 class="sec">Journal de la séance</h2><div class="list">${log}</div>` : ""}
    <button class="btn btn-line mt16" style="width:100%;color:var(--red)" data-a="live-end">Terminer la séance</button>
  </main>`;
}

// ---------- Actions ----------
actions["live-set"] = async (b, d) => {
  const j = +d.e, k = +d.s, reps = num(document.getElementById(`lr-${j}-${k}`)?.value), load = num(document.getElementById(`lk-${j}-${k}`)?.value);
  try { await mutate(st => { const s = st.exercises[j].sets[k]; s.done = !s.done; s.reps = s.done ? (reps > 0 ? reps : (s.lo || null)) : null; s.load = s.done && load > 0 ? load : (s.done ? s.kg || null : null); s.by = s.done ? me() : null; }); buzz(); }
  catch (e) { toast("Enregistrement impossible : " + e.message); }
  drawLive();
};
actions["live-addset"] = async (b, d) => {
  try { await mutate(st => { const ex = st.exercises[+d.e], last = ex.sets.at(-1) || { t: "N", lo: 8, hi: 10 }; ex.sets.push({ t: "N", lo: last.lo, hi: last.hi, kg: last.kg || null, pct: null, rpe: last.rpe || null, done: false, reps: null, load: null, by: null }); }); }
  catch (e) { toast("Enregistrement impossible : " + e.message); }
  drawLive();
};
forms["live-add"] = async (v, f) => {
  const parsed = E.parseSets(v.sets || "3x8-10 RPE8");
  if (!parsed.length) return toast("Séries illisibles : écris par exemple « 3x8-10 RPE8 »");
  try { await mutate(st => { st.exercises.push({ name: v.name.trim(), note: "", rest: 120, sets: parsed.map(s => ({ ...s, done: false, reps: null, load: null, by: null })) }); st.log.push({ at: nowIso(), by: me(), text: `Exercice ajouté : ${v.name.trim()}` }); }); f.reset(); toast("Exercice ajouté"); }
  catch (e) { toast("Enregistrement impossible : " + e.message); }
  drawLive();
};
forms["live-note"] = async (v, f) => {
  try { await mutate(st => st.log.push({ at: nowIso(), by: me(), text: v.text.trim() })); f.reset(); }
  catch (e) { toast("Enregistrement impossible : " + e.message); }
  drawLive();
};
actions["live-end"] = async () => {
  if (!confirm("Terminer la séance pour vous deux ?")) return;
  try { await mutate(st => { st.ended = true; st.endedAt = nowIso(); st.log.push({ at: nowIso(), by: me(), text: "Séance terminée" }); }); toast("Séance terminée"); LIVE_NOW = null; }
  catch (e) { toast("Impossible : " + e.message); }
  drawLive();
};
// Coach : lance la séance du membre (ou ouvre celle qui tourne déjà)
actions["live-start"] = async (b, d) => {
  const id = d.id;
  try {
    const c = await cloud(); const cur = await c.liveGet(id);
    if (cur?.state && !cur.state.ended && Object.keys(cur.state).length) return go("live", id);
    const D = (await c.memberData(id))?.data;
    if (!D) throw new Error("données du membre indisponibles");
    await c.liveSet(id, buildLive(D));
    buzz(); toast("Séance lancée : elle apparaît chez le client"); go("live", id);
  } catch (e) { toast("Impossible de lancer : " + e.message); }
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
  if (!LIVE_NOW || isCoach()) return "";
  return `<button class="card tap mt12" data-a="go" data-r="live" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;box-shadow:0 0 0 2px var(--red) inset"><span style="font-size:26px">🔴</span><span class="grow"><b>Séance en cours avec Thomas</b><br><span class="small muted">${esc(LIVE_NOW.title)} · touche pour la suivre et ajouter</span></span></button>`;
}
