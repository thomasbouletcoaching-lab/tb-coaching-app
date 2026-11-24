// Synchronisation avec le serveur : profil, formule, compteurs (messages, notifications).
import { planApresEnvoi } from "./envoi-programme.js";
import { PARTAGE_MAX } from "./crise.js";
import { S, update, today, onSave, proxyActive } from "./store.js";
import * as E from "./engine.js";
import * as N from "./nutrition.js";
import { cloud, badges, isCoach, addDays, toast } from "./core.js";
import { nutriRow } from "./nutri-totals.js";
import { myAdherence, lastCheckin, defiDay } from "./progress.js";
import { pourCoach } from "./programme.js";
import { resume as recupResume } from "./recuperation.js";
import { detecter as detecterProfils, pourCoach as profilsPourCoach, enReprise as enRepriseProfil } from "./profils.js";
// Module hybride : seulement les tests et les jours de pause (sans leur motif), pour le calcul de l'XP côté serveur.
// Le bloc en cours a sa propre table (cxs_hyb_bloc). Rien de sensible : ni poids, ni santé.
export const hybridePourServeur = (h) => !h ? null : {
  tests: (h.tests || []).filter(t => t?.d && t?.type).slice(-40).map(t => ({ d: t.d, type: t.type })),
  pauses: Object.fromEntries(Object.keys(h.pauses || {}).filter(d => h.pauses[d]).sort().slice(-60).map(d => [d, "pause"])),
};

export async function syncProfile() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const c = await cloud(); if (!c || !S().profile) return;
  try {
    await c.ensureSession();
    const p = S().profile;
    await c.saveProfile({ ...(S().me?.isCoach ? {} : { email: p.email }), name: p.name, onboarding: { ...p, word: S().settings.word, application: S().application || null } });
    update(st => st.synced = true);
    await refreshMe();
  } catch (e) { console.warn("Synchronisation impossible :", e.message); }
}
export async function refreshMe() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const c = await cloud(); if (!c || !S().profile) return;
  try {
    if (!(await c.currentSession())) await c.ensureSession();
    if (!S().synced) return syncProfile();
    const me = await c.fetchMe();
    if (me) update(st => st.me = { id: me.id, tier: me.tier, isCoach: me.is_coach, msgsLeft: me.msgsLeft, until: me.tier_until });
    const [un, ns] = await Promise.all([c.unreadFromCoach(), c.notifications()]);
    badges.msgs = un; badges.notifs = ns.filter(n => !n.read).length;
    if (isCoach()) { const ms = await c.members(); window.__members = ms; badges.msgs = ms.reduce((a, m) => a + m.unread, 0); }
    if (!badges.msgs && !badges.notifs) { try { navigator.clearAppBadge?.(); } catch { } }
    document.querySelectorAll(".top [data-a=notifs]").forEach(b => { b.querySelector(".badge")?.remove(); if (badges.notifs) b.insertAdjacentHTML("beforeend", `<span class="badge">${badges.notifs}</span>`); });
    document.querySelectorAll('.tab[href="#/coach"]').forEach(b => { b.querySelector(".badge")?.remove(); if (badges.msgs) b.insertAdjacentHTML("beforeend", `<span class="badge">${badges.msgs}</span>`); });
  } catch (e) { console.warn(e.message); }
}
export function pushStats() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  if (proxyActive()) return;
  const d = S().daily || {}, last = Object.keys(d).sort().at(-1);
  cloud().then(c => c?.touch({ workouts: S().workouts.length, lastWorkout: S().workouts.at(-1)?.end || null, weight: (last && d[last].weight) || S().profile?.weight, program: S().plan?.programId, week: S().plan?.week })).catch(() => { });
}

// Envoi des données au coach : après chaque changement (regroupé), au plus toutes les 20 secondes
const keep = (obj, days) => { const cut = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => k >= cut)); };
export function snapshot() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const st = S(), t = today();
  const lifts = Object.fromEntries(Object.entries(st.lifts || {}).map(([k, h]) => [k, h.slice(-25)]));
  const data = { v: 1, at: new Date().toISOString(), profile: st.profile, plan: st.plan, current: st.current, workouts: st.workouts.slice(-40), food: keep(st.food, 31), daily: keep(st.daily, 60), measures: (st.measures || []).slice(-40), customPrograms: st.customPrograms, moves: st.moves, exoNotes: st.exoNotes || {}, surcharge: st.surcharge || {}, repriseAt: st.repriseAt || 0, skips: st.skips, swaps: st.swaps, season: st.season, goals: st.goals, lifts, settings: { pace: st.settings?.pace, sessionMin: st.settings?.sessionMin },
    // Suivi : bilans, anamnèse, témoignage, photos envoyées volontairement, essai
    checkins: (st.checkins || []).slice(-26), hybride: hybridePourServeur(st.hybride), anamnese: st.anamnese || null, programme: pourCoach(st.programme, !!st.anamnese?.consent), testimonial: st.testimonial || null, sharedPhotos: st.sharedPhotos || [], trialStart: st.trialStart || null, defi: st.defi || null,
    // Journal « Je craque » : uniquement avec l'accord explicite du membre ; sinon null, ce qui efface aussi une copie envoyée avant un retrait d'accord
    crises: st.criseShare ? (st.crises || []).slice(-PARTAGE_MAX) : null, criseShare: st.criseShare || null, profileCreatedAt: st.profile?.createdAt || null };
  let ag = null, ns = null; try { ag = E.agenda(t, t)[t]; ns = E.nextSession(); } catch { }
  const tot = N.dayTotals(t), D = st.daily[t] || {}, lw = st.workouts.at(-1);
  const summary = { today: t, session: ag ? { st: ag.st, title: ag.title } : null, inProgress: st.current ? { title: st.current.title, start: st.current.start, done: st.current.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0) } : null,
    kcal: Math.round(tot.kcal), prot: Math.round(tot.p), meals: N.dayLog(t).length, weight: D.weight || null, steps: D.steps || null, sleep: D.sleep || null, focus: D.ritual?.focus || null,
    rappels: { seance: st.settings?.rappels?.seance !== false, bilan: st.settings?.rappels?.bilan !== false, vide: st.settings?.rappels?.vide !== false }, program: ns ? ns.p.name : null, week: ns?.week || null, lastWorkout: lw ? { title: lw.title, end: lw.end } : null, workouts: st.workouts.length };
  try {
    const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), to = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const ag2 = E.agenda(from, to);
    summary.agenda = Object.entries(ag2).filter(([, a]) => a.st !== "rest").map(([d, a]) => ({ d, st: a.st, title: a.title || "", time: a.time || (a.w?.[0] ? new Date(a.w[0].start).toTimeString().slice(0, 5) : null), dur: a.dur || null, place: a.place || null, moved: !!a.moved }));
    const since = Date.now() - 7 * 864e5, w7 = st.workouts.filter(w => new Date(w.end).getTime() >= since);
    const days7 = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
    const acts = [lw?.end?.slice(0, 10), ...Object.keys(st.food || {}).filter(k => (st.food[k] || []).length), ...Object.keys(st.daily || {}).filter(k => Object.keys(st.daily[k] || {}).length)].filter(Boolean).sort();
    summary.s7 = { workouts: w7.length, ex: w7.reduce((a, w) => a + w.exercises.filter(e => e.sets.some(s => s.done)).length, 0), nutri: days7.filter(k => (st.food?.[k] || []).length).length };
    summary.lastActive = acts.at(-1) || null;
    try { const a = myAdherence(t), lc = lastCheckin();
      summary.adh = { score: a.score, status: a.status, trend: a.trend, week: a.week, prev: a.prevWeek, age: a.age };
      summary.lastCheckin = lc?.d || null;
      summary.ci = lc ? { d: lc.d, energy: lc.energy, sleepH: lc.sleepH, stress: lc.stress, mood: lc.mood, weight: lc.weight } : null;
      summary.health = st.anamnese?.flags || null; summary.anam = !!st.anamnese?.at;
      summary.defi = st.trialStart ? { day: defiDay(t), closed: !!st.defi?.closed } : null;
      summary.testi = st.testimonial?.ok ? { at: st.testimonial.at, photos: st.testimonial.photos } : null;
    } catch { }
    summary.alerts = [...E.stalls().map(x => `Plateau ${x.name} (${x.weeks} sem.)`), ...E.injuryAlerts().map(a => `Douleur ${a.name}${a.triage?.v === "serieux" ? " (à prendre au sérieux)" : ""}`)].slice(0, 6);
    // Profils : identifiants seulement, jamais les réponses de santé
    try { const pa = st.programme?.answers || {}; summary.profils = profilsPourCoach(detecterProfils(pa, { age: st.profile?.age, discipline: st.profile?.discipline })).ids; } catch { }
    const rc = recupResume(st.daily, t, { decharge: st.decharge }); // feu du jour (Premium) : seulement si le membre fait ses check-ins
    if (rc) { summary.recup = rc; if (rc.rouges >= 3) summary.alerts = [...summary.alerts, `Fatigue : ${rc.rouges} jours rouges sur ${rc.sur}`].slice(0, 6); }
  } catch { }
  return { data, summary };
}
let tmr = null, last = 0;
export function pushData(now = false) {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  if (!S().profile || !S().synced) return;
  clearTimeout(tmr);
  const wait = now ? 0 : Math.max(1500, (S().current ? 4000 : 20000) - (Date.now() - last));
  tmr = setTimeout(async () => { if (proxyActive()) return; const c = await cloud(); if (!c) return; try { const { data, summary } = snapshot(); await c.pushData(data, summary); last = Date.now(); await pushNutri(c).catch(() => { }); } catch (e) { console.warn("Envoi au coach impossible :", e.message); } }, wait);
}
onSave(() => pushData());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") pushData(true); });

// Applique les décalages posés par le coach : séance déplacée (moves) et nouvelle heure (slots).
// Chaque décalage n'est appliqué qu'une fois par version (updated_at), pour ne pas écraser un changement fait ensuite par le membre.
export async function pullCoachSlots() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const c = await cloud(); if (!c || !S().profile) return;
  let rows; try { rows = await c.coachSlots(); } catch (e) { return; }
  if (!rows.length) return;
  update(st => {
    st.coachSeen = st.coachSeen || {}; st.moves = st.moves || {}; st.slots = st.slots || {};
    rows.forEach(r => {
      if (st.coachSeen[r.orig_d] === r.updated_at) return;
      st.coachSeen[r.orig_d] = r.updated_at;
      st.moves[r.orig_d] = r.new_d;
      if (r.new_time) st.slots[r.new_d] = { ...(st.slots[r.new_d] || {}), time: r.new_time };
    });
  });
}

// Réglages posés par le coach (bilans : jour, fréquence, questions ; échéances) : simplement copiés sur le téléphone
export async function pullCoachSettings() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const c = await cloud(); if (!c || !S().profile || !c.myCoachSettings) return;
  try { if (!(await c.currentSession())) return; } catch { return; }
  await claimInvite(c);
  try { const d = await c.myCoachSettings(); update(st => { st.coachSettings = d || null; }); } catch { }
  try { const pub = await c.coachPublic(["absence", "annonces", "sondages", "defis", "biblio"]); update(st => { st.coachPublic = pub; }); } catch { }
  try { const { syncDefis } = await import("./views/reseau.js"); await syncDefis(); } catch { }
  try { const rv = await c.myReviews(); update(st => { st.reviews = rv; }); } catch { }
  try { const { pullSante } = await import("./views/sante.js"); await pullSante(); } catch { }
}
// Espace préparé par le coach avant l'inscription : rattaché une fois, par le code reçu (lien ?coach=) ou par l'e-mail
export async function claimInvite(c, code = S().coachCode) {
  if (S().inviteDone && !code) return null;
  try {
    if (!(await c.currentSession())) return null;
    const r = await c.inviteClaim(code || null);
    update(st => { st.inviteDone = true; st.coachCode = null; });
    if (r) { toast(`🎉 Thomas a préparé ton espace${r.program ? " et ton programme" : ""}`); refreshMe(); pullCoachPlan(); }
    return r;
  } catch (e) { console.warn("Invitation coach :", e.message); return null; }
}

export async function pullCoachPlan() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const c = await cloud(); if (!c || !S().profile) return;
  let row; try { row = await c.coachPlan(); } catch (e) { return; }
  if (!row || !Array.isArray(row.program?.s) || !row.program.s.length) return;
  update(st => {
    if (st.coachPlanSeen === row.updated_at) return;
    st.coachPlanSeen = row.updated_at;
    const prog = { ...row.program, id: "coach-plan" };
    st.customPrograms = [...(st.customPrograms || []).filter(x => x.id !== "coach-plan"), prog];
    st.plan = planApresEnvoi(st.plan, prog, today());
  });
}

// Totaux nutritionnels des 14 derniers jours, écrits dans nutri_daily (le coach les lit pour les alertes)
async function pushNutri(c) {
  if (proxyActive()) return;
  await c.ensureSession(); const uid = c.userId(); if (!uid) return;
  const rows = []; for (let i = 0; i < 14; i++) { const r = nutriRow(uid, addDays(today(), -i), false); if (r) rows.push(r); }
  if (rows.length) await c.pushNutri(rows);
}

// Séances et repas saisis par le coach à ma place : appliqués ici une fois, puis marqués comme reçus
export async function pullSaisies() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  const c = await cloud(); if (!c?.mesSaisies || !S().profile || S().me?.isCoach) return;
  try { if (!(await c.currentSession())) return; } catch { return; }
  let rows; try { rows = await c.mesSaisies(); } catch { return; }
  if (!rows.length) return;
  update(st => {
    for (const r of rows) {
      const p = r.payload || {};
      st.workouts = (st.workouts || []).filter(w => !(p.wDel || []).includes(String(w.id)) && !(p.workouts || []).some(x => String(x.id) === String(w.id)));
      if (st.current && (p.workouts || []).some(x => String(x.id) === String(st.current.id))) st.current = null; // séance terminée par le coach
      st.workouts.push(...(p.workouts || [])); st.workouts.sort((a, b) => String(a.start).localeCompare(String(b.start)));
      for (const [d, l] of Object.entries(p.foodDel || {})) st.food[d] = (st.food[d] || []).filter(e => !l.includes(String(e.id)));
      for (const [d, l] of Object.entries(p.food || {})) st.food[d] = [...(st.food[d] || []).filter(e => !l.some(x => String(x.id) === String(e.id))), ...l];
      for (const [n, l] of Object.entries(p.lifts || {})) { const h = st.lifts[n] = st.lifts[n] || []; for (const x of l) if (!h.some(y => y.d === x.d && y.e1rm === x.e1rm)) h.push(x); h.sort((a, b) => String(a.d).localeCompare(String(b.d))); }
    }
  });
  await c.saisiesAppliquees(rows.map(r => r.id)).catch(() => { });
}

// Appareil sans suivi (nouveau téléphone, ou app coach qui n'a jamais eu le sien) alors que le compte en a un côté serveur : on le retrouve,
// au lieu de repartir de zéro et d'écraser la copie du serveur avec un suivi vide.
const REPRISE = ["settings", "profile", "plan", "workouts", "food", "daily", "measures", "customPrograms", "moves", "exoNotes", "surcharge", "skips", "swaps", "season", "goals", "lifts", "checkins", "anamnese", "trialStart"];
let repriseFaite = false;
export async function retrouverSuivi() {
  if (proxyActive()) return; // saisie pour un client en cours : rien ne part ni n'arrive sur mon compte
  if (repriseFaite || proxyActive()) return; const st0 = S();
  repriseFaite = true;
  try {
    const c = await cloud(); if (!c || !(await c.currentSession?.())) return;
    const d = await c.fetchMigrated(); if (!d) return;
    // Le serveur impose sa version (compte réparé ou fusionné) : ce téléphone la reprend, même s'il avait déjà un suivi
    const force = d.forceReprise && d.forceReprise > (st0.repriseAt || 0);
    if (!force && (st0.workouts?.length || Object.keys(st0.food || {}).length || st0.current || !d.workouts?.length)) return;
    update(st => { for (const k of REPRISE) if (d[k] != null) st[k] = d[k]; if (force) { st.current = null; st.repriseAt = d.forceReprise; } st.synced = true; });
    const { toast } = await import("./core.js"); toast("Ton suivi a été retrouvé (" + d.workouts.length + " séances)"); location.reload();
  } catch { }
}
