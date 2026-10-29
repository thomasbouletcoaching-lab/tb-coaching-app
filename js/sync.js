// Synchronisation avec le serveur : profil, formule, compteurs (messages, notifications).
import { S, update, today, onSave } from "./store.js";
import * as E from "./engine.js";
import * as N from "./nutrition.js";
import { cloud, badges, isCoach } from "./core.js";

export async function syncProfile() {
  const c = await cloud(); if (!c || !S().profile) return;
  try {
    await c.ensureSession();
    const p = S().profile;
    await c.saveProfile({ email: p.email, name: p.name, onboarding: { ...p, word: S().settings.word, application: S().application || null } });
    update(st => st.synced = true);
    await refreshMe();
  } catch (e) { console.warn("Synchronisation impossible :", e.message); }
}
export async function refreshMe() {
  const c = await cloud(); if (!c || !S().profile) return;
  try {
    if (!(await c.currentSession())) await c.ensureSession();
    if (!S().synced) return syncProfile();
    const me = await c.fetchMe();
    if (me) update(st => st.me = { id: me.id, tier: me.tier, isCoach: me.is_coach, msgsLeft: me.msgsLeft, until: me.tier_until });
    const [un, ns] = await Promise.all([c.unreadFromCoach(), c.notifications()]);
    badges.msgs = un; badges.notifs = ns.filter(n => new Date(n.created_at).getTime() > S().notifSeen).length;
    if (isCoach()) { const ms = await c.members(); window.__members = ms; badges.msgs = ms.reduce((a, m) => a + m.unread, 0); }
    document.querySelectorAll(".top [data-a=notifs]").forEach(b => { b.querySelector(".badge")?.remove(); if (badges.notifs) b.insertAdjacentHTML("beforeend", `<span class="badge">${badges.notifs}</span>`); });
    document.querySelectorAll('.tab[href="#/coach"]').forEach(b => { b.querySelector(".badge")?.remove(); if (badges.msgs) b.insertAdjacentHTML("beforeend", `<span class="badge">${badges.msgs}</span>`); });
  } catch (e) { console.warn(e.message); }
}
export function pushStats() {
  const d = S().daily || {}, last = Object.keys(d).sort().at(-1);
  cloud().then(c => c?.touch({ workouts: S().workouts.length, lastWorkout: S().workouts.at(-1)?.end || null, weight: (last && d[last].weight) || S().profile?.weight, program: S().plan?.programId, week: S().plan?.week })).catch(() => { });
}

// Envoi des données au coach : après chaque changement (regroupé), au plus toutes les 20 secondes
const keep = (obj, days) => { const cut = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10); return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => k >= cut)); };
export function snapshot() {
  const st = S(), t = today();
  const lifts = Object.fromEntries(Object.entries(st.lifts || {}).map(([k, h]) => [k, h.slice(-25)]));
  const data = { v: 1, at: new Date().toISOString(), profile: st.profile, plan: st.plan, current: st.current, workouts: st.workouts.slice(-40), food: keep(st.food, 31), daily: keep(st.daily, 60), measures: (st.measures || []).slice(-40), customPrograms: st.customPrograms, moves: st.moves, skips: st.skips, swaps: st.swaps, season: st.season, goals: st.goals, lifts, settings: { pace: st.settings?.pace, sessionMin: st.settings?.sessionMin } };
  let ag = null, ns = null; try { ag = E.agenda(t, t)[t]; ns = E.nextSession(); } catch { }
  const tot = N.dayTotals(t), D = st.daily[t] || {}, lw = st.workouts.at(-1);
  const summary = { today: t, session: ag ? { st: ag.st, title: ag.title } : null, inProgress: st.current ? { title: st.current.title, start: st.current.start, done: st.current.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0) } : null,
    kcal: Math.round(tot.kcal), prot: Math.round(tot.p), meals: N.dayLog(t).length, weight: D.weight || null, steps: D.steps || null, sleep: D.sleep || null, focus: D.ritual?.focus || null,
    program: ns ? ns.p.name : null, week: ns?.week || null, lastWorkout: lw ? { title: lw.title, end: lw.end } : null, workouts: st.workouts.length };
  try {
    const from = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), to = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const ag2 = E.agenda(from, to);
    summary.agenda = Object.entries(ag2).filter(([, a]) => a.st !== "rest").map(([d, a]) => ({ d, st: a.st, title: a.title || "", time: a.time || (a.w?.[0] ? new Date(a.w[0].start).toTimeString().slice(0, 5) : null), dur: a.dur || null, place: a.place || null, moved: !!a.moved }));
    const since = Date.now() - 7 * 864e5, w7 = st.workouts.filter(w => new Date(w.end).getTime() >= since);
    const days7 = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
    const acts = [lw?.end?.slice(0, 10), ...Object.keys(st.food || {}).filter(k => (st.food[k] || []).length), ...Object.keys(st.daily || {}).filter(k => Object.keys(st.daily[k] || {}).length)].filter(Boolean).sort();
    summary.s7 = { workouts: w7.length, ex: w7.reduce((a, w) => a + w.exercises.filter(e => e.sets.some(s => s.done)).length, 0), nutri: days7.filter(k => (st.food?.[k] || []).length).length };
    summary.lastActive = acts.at(-1) || null;
    summary.alerts = [...E.stalls().map(x => `Plateau ${x.name} (${x.weeks} sem.)`), ...E.injuryAlerts().map(a => `Douleur ${a.name}`)].slice(0, 6);
  } catch { }
  return { data, summary };
}
let tmr = null, last = 0;
export function pushData(now = false) {
  if (!S().profile || !S().synced) return;
  clearTimeout(tmr);
  const wait = now ? 0 : Math.max(4000, 20000 - (Date.now() - last));
  tmr = setTimeout(async () => { const c = await cloud(); if (!c) return; try { const { data, summary } = snapshot(); await c.pushData(data, summary); last = Date.now(); } catch (e) { console.warn("Envoi au coach impossible :", e.message); } }, wait);
}
onSave(() => pushData());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") pushData(true); });
