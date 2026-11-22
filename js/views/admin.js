// Espace coach (administrateur) : Mes clients, Messages, Business, Abonnés, Base de données.
// Présentation reprise de TB my Coach.
import { videosEnAttente, blocAdmin } from "./video-canal.js";
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as N from "../nutrition.js";
import * as RC from "../recipes.js";
import { CONFIG, OFFERS, offer, assignable } from "../config.js";
import { $app, esc, num, fr, toast, ago, routes, R, actions, forms, changes, go, I, header, seg, chips, sheet, closeSheet, fmtDate, addDays, rerender, isCoach, cloud, barChart, adminTabbar, adminBadges, hbars } from "../core.js";
import { readyList, ensureReady } from "./coach.js";
import { libraryRows, refreshLibrary } from "../library.js";
import { filterExercises, ficheSheet } from "./train.js";
import { openRecipeEditor } from "./food.js";
import { alerts as adhAlerts, STATUS } from "../adherence.js";
import { loadBibliotheque, bibliothequeBody, mountBibliotheque } from "./bibliotheque.js";
import * as RS from "../reseau.js";
import * as FA from "../factures.js";

// ---------- Données ----------
const A = { members: null, sums: {}, threads: {}, at: 0, err: null, store: { todo: [], biz: null, notes: {}, handled: {}, dismiss: {}, events: [] } };
const BIZ0 = () => ({ payments: [], cycles: [], settings: { rate: null, freq: "trimestre", goal: null } });
async function load(force = false) {
  if (!force && A.members && Date.now() - A.at < 30000) return;
  const c = await cloud(); if (!c) { A.err = "Pas de connexion au serveur."; return; }
  try {
    await (c.currentSession().then(u => u || c.ensureSession()));
    const [ms, sums, th, st, nut] = await Promise.all([c.members(), c.allSummaries().catch(() => []), c.lastMessages().catch(() => ({})), c.storeGet(["todo", "biz", "notes", "handled", "dismiss", "events", "tags", "seances"]).catch(() => ({})), c.nutriRecent(7).catch(() => [])]);
    A.members = ms.filter(m => m.name || m.email); A.sums = Object.fromEntries(sums.map(x => [x.user_id, x.summary || {}])); A.snapAt = Object.fromEntries(sums.map(x => [x.user_id, x.updated_at])); A.threads = th; A.nutri = {}; (nut || []).forEach(r => { (A.nutri[r.user_id] = A.nutri[r.user_id] || []).push(r); });
    A.store = { todo: st.todo?.items || [], biz: st.biz || BIZ0(), notes: st.notes || {}, handled: st.handled || {}, dismiss: st.dismiss || {}, events: st.events?.items || [], tags: st.tags || {}, seances: st.seances?.items || [] };
    A.store.biz.payments = A.store.biz.payments || []; A.store.biz.cycles = A.store.biz.cycles || []; A.store.biz.settings = A.store.biz.settings || {};
    A.invites = await c.invites().catch(() => []);
    window.__members = ms; A.at = Date.now(); A.err = null;
    adminBadges.msgs = A.members.reduce((a, m) => a + (A.threads[m.id]?.unread || 0), 0);
  } catch (e) { A.err = e.message; }
}
async function saveStore(key) {
  const c = await cloud(); const v = key === "todo" || key === "events" || key === "seances" ? { items: A.store[key] } : A.store[key];
  try { await c.storeSet(key, v); } catch (e) { toast("Enregistrement impossible : " + e.message); }
}
const priceOf = (id) => { const o = offer(id); return parseFloat(String(o.price).replace(/[^\d,]/g, "").replace(",", ".")) || 0; };
const daysSince = (d) => d ? Math.max(0, Math.floor((new Date(today() + "T12:00:00") - new Date(String(d).slice(0, 10) + "T12:00:00")) / 864e5)) : null;
const lastAct = (m) => A.sums[m.id]?.lastActive || m.stats?.lastWorkout?.slice(0, 10) || null;
const dotOf = (n) => n == null ? "n" : n <= 1 ? "g" : n <= 3 ? "o" : "r";
const isClient = (m) => offer(m.tier).rank >= 3;
const eur = (x) => `${(Math.round((x || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const first = (m) => (m.name || m.email || "?").trim();
// Régularité et alertes de décrochage, calculées depuis l'instantané envoyé par l'app du membre
const adhOf = (m) => A.sums[m.id]?.adh || null;
const ciExpected = (m) => isClient(m) || (A.sums[m.id]?.defi && A.sums[m.id].defi.day <= 30 && !A.sums[m.id].defi.closed);
function memberAlerts(m) {
  const s = A.sums[m.id] || {}, adh = s.adh;
  return adhAlerts({ adh, today: today(), lastActive: lastAct(m) || (m.last_seen || "").slice(0, 10) || null, lastCheckin: s.lastCheckin, checkinExpected: !!adh && ciExpected(m), agenda: s.agenda || [], lastCi: s.ci, health: s.health ? { flags: s.health } : null });
}
const RELANCE = {
  idle: "Salut {prénom}, je n'ai rien vu passer depuis quelques jours. Tout va bien ? Dis-moi ce qui coince et on ajuste ensemble 💪",
  score: "Salut {prénom}, je vois que ces deux dernières semaines ont été compliquées, ça arrive à tout le monde. On cherche ensemble ce qui bloque ? Une seule chose à remettre en place cette semaine suffit.",
  drop: "Salut {prénom}, ta semaine a été plus dure que la précédente. Qu'est-ce qui a changé ? On adapte le plan à ta vraie semaine plutôt que l'inverse.",
  checkin: "Salut {prénom}, il me manque ton bilan de la semaine : 1 minute, il est déjà pré-rempli dans l'app (Coaching → Mon bilan). Avec lui je peux ajuster ton plan.",
  missed: "Salut {prénom}, j'ai vu que deux séances ont sauté. On les déplace ou on allège la semaine ? Donne-moi tes créneaux réels.",
  energy: "Salut {prénom}, ton bilan montre une semaine fatigante. On lève le pied sur l'intensité et on mise sur le sommeil cette semaine. Comment tu te sens aujourd'hui ?",
  sleep: "Salut {prénom}, tes nuits sont courtes en ce moment. Cette semaine, on vise 30 minutes de sommeil en plus avant de pousser à la salle. Qu'est-ce qui t'empêche de te coucher plus tôt ?",
  stress: "Salut {prénom}, gros stress en ce moment d'après ton bilan. On garde les séances courtes et efficaces cette semaine. Je suis là si tu veux en parler.",
  mood: "Salut {prénom}, ton bilan montre une semaine difficile. Comment ça va vraiment ? On adapte ce qu'il faut.",
  health: "Salut {prénom}, merci pour ton point de départ. Tu as signalé un point de santé : as-tu pu en parler à ton médecin ? En attendant, on garde des séances modérées.",
};
function decrochageBlock() {
  const rows = (A.members || []).map(m => ({ m, adh: adhOf(m), al: memberAlerts(m) })).filter(x => x.al.some(a => a.level !== "info"));
  const lv = (x) => x.al.filter(a => a.level === "risk").length * 10 + x.al.filter(a => a.level === "watch").length;
  rows.sort((a, b) => lv(b) - lv(a) || (a.adh?.score ?? 100) - (b.adh?.score ?? 100));
  if (!rows.length) return `<div class="card mt12"><b class="small">🟢 Personne ne décroche</b><p class="xs muted mt4" style="margin:0">Les alertes apparaissent ici dès qu'un membre glisse : inactivité, chute de régularité, bilan manquant, séances loupées, fatigue.</p></div>`;
  return `<details class="fold" open data-fold="drop"><summary>🚨 Qui décroche <span class="cnt out">${rows.length}</span></summary><div class="fb"><div class="list">${rows.slice(0, 12).map(({ m, adh, al }) => { const st = adh ? STATUS[adh.status] : null;
    return `<div class="li" style="flex-direction:column;align-items:stretch;gap:6px"><div class="row between"><a href="#/member/${m.id}" style="color:inherit;text-decoration:none"><b>${esc(first(m))}</b></a><span>${st ? `<span class="tag ${"st-" + st.tone}">${adh.score ?? "–"} · ${st.label}</span>` : `<span class="tag">pas de score</span>`}</span></div>
      <span class="xs">${al.filter(a => a.level !== "info").slice(0, 3).map(a => `${a.level === "risk" ? "🔴" : "🟠"} ${esc(a.text)}`).join("<br>")}</span>
      <div class="row" style="gap:6px"><button class="btn btn-red btn-xs grow" data-a="adm-relance" data-id="${m.id}" data-c="${al.find(a => a.level !== "info").code}">💬 Relancer</button><a class="btn btn-line btn-xs grow" href="#/member/${m.id}">📈 Suivi</a></div></div>`; }).join("")}</div></div></details>`;
}

// ---------- Mise en page commune ----------
function frame(active, body, sub = "") {
  const email = S().profile?.email || "";
  $app.innerHTML = header("Espace coach", esc(sub || email), { actions: `<button class="pill ic" data-a="adm-refresh" aria-label="Actualiser">↻</button>` })
    + `<main class="page">${A.err ? `<div class="card" style="box-shadow:0 0 0 2px var(--warn) inset"><p class="small" style="margin:0">⚠️ ${esc(A.err === "LOGIN_REQUIRED" ? "Ta session a expiré. Reconnecte-toi pour retrouver ton espace coach." : A.err)}</p>${A.err === "LOGIN_REQUIRED" ? `<button class="btn btn-red mt8" data-a="go" data-r="account">Me connecter</button>` : ""}</div>` : ""}${body}</main>${adminTabbar(active)}`;
}
async function guard(active) {
  if (!isCoach()) { go("home"); return false; }
  if (!A.members) { frame(active, `<p class="empty">Chargement de ton espace…</p>`); await load(); }
  else load().then(() => { });
  return true;
}
actions["adm-refresh"] = async () => { toast("Actualisation…"); await Promise.all([load(true), refreshLibrary(), loadBibliotheque(true)]); rerender(); };

// =====================================================================
// MES CLIENTS
// =====================================================================
const UI = { agMode: "jour", agDay: null, sort: "prio", scope: null, q: "", open: { todo: false, cand: false, todo2: false, bulk: false, ag: true } };
function agendaRows(d) {
  const out = [];
  (A.members || []).forEach(m => {
    const s = A.sums[m.id] || {};
    (s.agenda || []).filter(a => a.d === d && a.st !== "away").forEach(a => {
      const ip = (s.inProgress && s.today === today() && d === today() && (s.inProgress.title === a.title || a.st === "planned")) || (d === today() && LIVE_LIST.some(r => r.user_id === m.id && !r.state.snap));
      out.push({ m, a, ip, name: first(m) });
    });
  });
  // Le compte coach ne suit pas sa propre séance ici : ta séance perso est sur ton compte perso (membre)
  if (false) try { const mine = E.agenda(d, d)[d]; if (mine && !["rest", "away"].includes(mine.st)) out.push({ me: true, a: { ...mine, time: mine.time || (mine.w?.[0] ? new Date(mine.w[0].start).toTimeString().slice(0, 5) : null) }, ip: !!S().current && d === today(), name: `${S().profile?.name || "Toi"} (toi)` }); } catch { }
  return out.sort((x, y) => (x.a.time || "99").localeCompare(y.a.time || "99") || x.name.localeCompare(y.name, "fr"));
}
const stLbl = (r) => r.ip ? ["⏱️ En cours", "ip"] : r.a.st === "done" ? ["✅ Faite", "dn"] : r.a.st === "missed" ? ["❌ Loupée", "ms"] : ["● Prévue", "pl"];
function agRow(r, d) {
  const [l, c] = stLbl(r), past = d < today() || (d === today() && r.a.st === "done");
  const shift = r.me ? "" : `<button class="ghost sm" data-a="ag-shift" data-m="${r.m.id}" data-d="${d}" data-t="${esc(r.a.time || "")}">↪︎ Décaler</button>`;
  return `<div class="row" style="gap:6px;align-items:stretch"><div class="grow" style="min-width:0"><button class="ag-row ${past && !r.ip ? "past" : ""}" ${r.me ? `data-a="ag-day" data-v="${d}"` : r.ip ? `data-a="go" data-r="live" data-p="${r.m.id}"` : `data-a="go" data-r="member" data-p="${r.m.id}"`}><span class="t">${esc(r.a.time || "—")}</span><span class="small"><b>${esc(r.name)}</b> · ${esc(r.a.title)}${r.a.moved ? ` <span class="muted">(déplacée)</span>` : ""}${r.a.place ? `<br><span class="xs muted">${esc(r.a.place)}${r.a.dur ? ` · ${r.a.dur} min` : ""}</span>` : ""}</span><span class="ag-st ${c}">${l}</span></button></div>${shift}</div>`;
}
actions["ag-shift"] = (b, d) => {
  const m = A.members.find(x => x.id === d.m);
  sheet(`<h2 class="h2">Décaler la séance de ${esc(first(m))}</h2><p class="xs muted">Le membre verra la nouvelle date et la nouvelle heure dans son agenda.</p>
    <form data-f="ag-shift" data-m="${esc(d.m)}" data-d="${esc(d.d)}" class="mt12"><div class="grid2"><label class="field"><span>Nouveau jour</span><input type="date" name="to" value="${esc(d.d)}" required></label><label class="field"><span>Heure</span><input type="time" name="time" value="${esc(d.t || "")}"></label></div>
    <button class="btn btn-red mt12">Enregistrer le décalage</button></form>`);
};
forms["ag-shift"] = async (v, f) => {
  const c = await cloud();
  try { await c.coachSlotSet(f.dataset.m, f.dataset.d, v.to, v.time || null); }
  catch (e) { return toast("Décalage impossible : " + e.message); }
  closeSheet(); toast("Séance décalée"); rerender();
};
function agendaBlock() {
  const t = today(), d = UI.agDay || t, mon = addDays(d, -E.dowOf(d)), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const counts = Object.fromEntries(days.map(k => [k, agendaRows(k).length]));
  let list;
  if (UI.agMode === "jour") {
    const rows = agendaRows(d), now = new Date().toTimeString().slice(0, 5);
    let html = "", placed = d !== t;
    rows.forEach(r => { if (!placed && r.a.time && r.a.time > now) { html += `<div class="nowline">${now}</div>`; placed = true; } html += agRow(r, d); });
    if (!placed && rows.length) html += `<div class="nowline">${now}</div>`;
    list = `<div class="row between mt12"><button class="icon-btn" data-a="adm-agnav" data-v="-1" aria-label="Jour précédent">${I.back}</button><b class="h3 center" style="text-transform:capitalize">${d === t ? "Aujourd'hui · " : ""}${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}</b><button class="icon-btn" data-a="adm-agnav" data-v="1" aria-label="Jour suivant" style="transform:scaleX(-1)">${I.back}</button></div>
      ${html || `<p class="empty small">Aucune séance ce jour-là.</p>`}`;
  } else list = days.map(k => { const rows = agendaRows(k); return `<div class="lbl mt16" style="text-transform:capitalize">${fmtDate(k, { weekday: "long", day: "numeric" })} · ${rows.length}</div>${rows.map(r => agRow(r, k)).join("") || `<p class="xs muted">Rien de prévu.</p>`}`; }).join("");
  return `<details class="fold" ${UI.open.ag ? "open" : ""} data-fold="ag"><summary>📅 Agenda <small>aujourd'hui : ${counts[t] ?? agendaRows(t).length} séance${(counts[t] ?? 0) > 1 ? "s" : ""}</small></summary><div class="fb">
    ${seg([["jour", "Jour"], ["semaine", "Semaine"]], UI.agMode, "adm-agmode")}
    <div class="dstrip2">${days.map((k, i) => `<button class="${k === d ? "on" : ""}" data-a="adm-agday" data-v="${k}"><small>${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][i]}</small><b>${Number(k.slice(8))}</b><i>${counts[k] || ""}</i></button>`).join("")}</div>
    ${list}</div></details>`;
}
actions["adm-agmode"] = (b, d) => { UI.agMode = d.v; rerender(); };
actions["adm-agday"] = (b, d) => { UI.agDay = d.v === today() ? null : d.v; UI.agMode = "jour"; rerender(); };
actions["adm-agnav"] = (b, d) => { UI.agDay = addDays(UI.agDay || today(), +d.v); if (UI.agDay === today()) UI.agDay = null; rerender(); };
document.addEventListener("toggle", (e) => { const f = e.target.closest?.("[data-fold]"); if (f) UI.open[f.dataset.fold] = f.open; }, true);

// Tâches du coach
function todoBlock() {
  const t = today(), items = A.store.todo, due = items.filter(x => !x.done && (!x.due || x.due <= t));
  return `<details class="fold" ${UI.open.todo ? "open" : ""} data-fold="todo"><summary>📋 Ma to-do ${items.filter(x => !x.done).length ? `<span class="cnt">${items.filter(x => !x.done).length}</span>` : ""}${due.length ? `<span class="cnt out">à faire aujourd'hui</span>` : ""}</summary><div class="fb">
    <form data-f="adm-todo" class="row" style="gap:6px"><input class="inp grow" name="t" placeholder="Nouvelle tâche" style="text-align:left" required maxlength="140"><input class="inp" type="date" name="due" style="width:150px" value="${t}"><button class="btn btn-red btn-xs" style="width:auto">+</button></form>
    <div class="list mt8">${items.slice().sort((a, b) => (a.done - b.done) || (a.due || "9").localeCompare(b.due || "9")).map(x => `<div class="li" style="gap:8px"><button class="rk" data-a="adm-todo-t" data-id="${x.id}" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--line);background:${x.done ? "var(--gradbtn)" : "var(--paper)"};color:#fff;flex:none">${x.done ? "✓" : ""}</button><span class="grow small" style="${x.done ? "text-decoration:line-through;opacity:.55" : ""}">${esc(x.t)}${x.due ? `<br><span class="xs ${x.due < t && !x.done ? "red" : "muted"}">${x.due === t ? "aujourd'hui" : fmtDate(x.due, { day: "numeric", month: "short" })}</span>` : ""}</span><button class="icon-btn sm" data-a="adm-todo-d" data-id="${x.id}" aria-label="Supprimer">${I.close}</button></div>`).join("") || `<p class="xs muted">Aucune tâche.</p>`}</div></div></details>`;
}
forms["adm-todo"] = async (v, f) => { A.store.todo.push({ id: Date.now(), t: v.t.trim(), due: v.due || null, done: false }); UI.open.todo = true; closeSheet(); rerender(); await saveStore("todo"); };
actions["adm-todo-t"] = async (b, d) => { const x = A.store.todo.find(x => x.id === +d.id); if (x) x.done = !x.done; rerender(); await saveStore("todo"); };
actions["adm-todo-d"] = async (b, d) => { A.store.todo = A.store.todo.filter(x => x.id !== +d.id); rerender(); await saveStore("todo"); };

// Candidatures
const candidates = () => (A.members || []).filter(m => m.onboarding?.application && !A.store.handled[m.id + ":" + m.onboarding.application.at]);
function candBlock() {
  const l = candidates();
  return `<details class="fold" ${UI.open.cand ? "open" : ""} data-fold="cand"><summary>📥 Candidatures <small>(${l.length} en cours)</small></summary><div class="fb">
    ${l.map(m => { const ap = m.onboarding.application; return `<div class="card mt8"><div class="row between"><b>${esc(first(m))}</b><span class="tag r">${esc(offer(ap.offer).name)}</span></div><p class="xs muted mt4">${ago(ap.at)}${ap.phone ? ` · <a href="tel:${esc(ap.phone)}">${esc(ap.phone)}</a>` : ""}</p>
      <p class="small mt8" style="margin-bottom:4px"><b>Objectif :</b> ${esc(ap.goal || "–")}</p><p class="small" style="margin:0 0 4px"><b>Frein :</b> ${esc(ap.obstacle || "–")}</p><p class="small" style="margin:0"><b>Temps :</b> ${esc(ap.time || "–")} · <b>Urgence :</b> ${esc(ap.urgency ?? "–")}/10</p>
      ${ap.dossier?.score != null ? `<p class="xs mt8" style="margin:0">📈 Régularité <b>${ap.dossier.score}/100</b> · ${ap.dossier.sessions} séances · ${ap.dossier.checkins} bilans${ap.dossier.weight != null ? ` · ${ap.dossier.weight > 0 ? "+" : ""}${fr(ap.dossier.weight, 1)} kg` : ""}${ap.dossier.waist != null ? ` · taille ${ap.dossier.waist > 0 ? "+" : ""}${fr(ap.dossier.waist, 1)} cm` : ""}${ap.dossier.defiDay ? ` · défi jour ${ap.dossier.defiDay}` : ""}${ap.dossier.health ? ` · ⚠️ ${ap.dossier.health} point(s) santé` : ""}</p>${ap.dossier.why ? `<p class="xs muted mt4" style="margin:0">Pourquoi maintenant : ${esc(ap.dossier.why)}</p>` : ""}` : ""}
      <div class="row mt8" style="gap:6px"><a class="btn btn-red btn-xs grow" href="#/chat/${m.id}">💬 Écrire</a><button class="btn btn-line btn-xs grow" data-a="adm-tier" data-id="${m.id}">Activer la formule</button><button class="btn btn-ghost btn-xs" data-a="adm-cand-ok" data-id="${m.id}">Traitée</button></div></div>`; }).join("") || `<p class="xs muted">Aucune candidature en attente. Elles arrivent depuis « Offres » dans l'app.</p>`}</div></details>`;
}
actions["adm-cand-ok"] = async (b, d) => { const m = A.members.find(x => x.id === d.id); A.store.handled[m.id + ":" + m.onboarding.application.at] = today(); rerender(); await saveStore("handled"); };

// À traiter aujourd'hui
function todoToday() {
  const out = [], t = today(), y = addDays(t, -1);
  (A.members || []).forEach(m => {
    const th = A.threads[m.id], s = A.sums[m.id] || {}, n = daysSince(lastAct(m) || m.last_seen);
    if (th?.bilan) out.push(["📝", `Bilan de ${first(m)} à lire`, `chat/${m.id}`]);
    else if (th?.unread) out.push(["💬", `${th.unread} message${th.unread > 1 ? "s" : ""} de ${first(m)}`, `chat/${m.id}`]);
    (s.agenda || []).filter(a => a.st === "missed" && (a.d === t || a.d === y)).forEach(a => out.push(["❌", `${first(m)} a loupé ${a.title} (${a.d === t ? "aujourd'hui" : "hier"})`, `member/${m.id}`]));
    (s.alerts || []).slice(0, 2).forEach(a => out.push(["⚠️", `${first(m)} · ${a}`, `member/${m.id}`]));
    if ((isClient(m) || offer(m.tier).rank >= 1) && n != null && n >= 4) out.push(["🔔", `Relancer ${first(m)} : rien depuis ${n} j`, `relance:${m.id}`]);
    // Nutrition : alerte seulement si le dépassement revient (3 jours sur les 7 derniers), pour éviter le bruit
    const nd = (A.nutri || {})[m.id] || [];
    const sugHigh = nd.filter(r => r.sucres_g != null && r.kcal >= 800 && (r.sucres_g * 4) / r.kcal > 0.10).length;
    if (sugHigh >= 3) out.push(["🍬", `${first(m)} : sucres au-dessus du repère ${sugHigh} jours sur 7`, `member/${m.id}`]);
    const naHigh = nd.filter(r => r.sodium_mg && r.potassium_mg != null && (r.potassium_mg / r.sodium_mg < 1 || r.sodium_mg > 2300)).length;
    if (naHigh >= 3) out.push(["🧂", `${first(m)} : équilibre sodium / potassium à surveiller ${naHigh} jours sur 7`, `member/${m.id}`]);
    if (m.tier_until && m.tier_until >= t && m.tier_until <= addDays(t, 3)) out.push(["⏳", `Formule de ${first(m)} jusqu'au ${fmtDate(m.tier_until, { day: "numeric", month: "short" })}`, `member/${m.id}`]);
  });
  candidates().forEach(m => out.push(["📥", `Candidature de ${first(m)}`, `member/${m.id}`]));
  A.store.todo.filter(x => !x.done && x.due && x.due <= t).forEach(x => out.push(["📋", x.t, "todo"]));
  return out;
}
function todayBlock() {
  const l = todoToday();
  return `<details class="fold" ${UI.open.todo2 ? "open" : ""} data-fold="todo2"><summary>À traiter aujourd'hui ${l.length ? `<span class="cnt">${l.length}</span>` : ""}</summary><div class="fb"><div class="list">${l.map(([e, t, r]) => `<button class="li" data-a="adm-go" data-r="${esc(r)}"><span class="em">${e}</span><span class="grow small">${esc(t)}</span>${I.chev}</button>`).join("") || `<p class="xs muted">Tout est à jour 🙌</p>`}</div></div></details>`;
}
actions["adm-relance"] = (b, d) => { const m = A.members.find(x => x.id === d.id); if (!m) return; window.__prefill = personalize(RELANCE[d.c] || RELANCE.idle, m); go("chat", m.id); };
actions["adm-go"] = (b, d) => {
  if (d.r.startsWith("relance:")) { const m = A.members.find(x => x.id === d.r.slice(8)); window.__prefill = `Salut ${first(m)}, comment ça va ? Je n'ai pas vu passer ta semaine dans l'app. Dis-moi ce qui coince et on ajuste ensemble 💪`; return go("chat", m.id); }
  if (d.r === "todo") { UI.open.todo = true; return rerender(); }
  location.hash = "#/" + d.r;
};

// Message à plusieurs clients
let bulkSel = new Set();
function bulkBlock() {
  const ms = A.members || [];
  return `<details class="fold" ${UI.open.bulk ? "open" : ""} data-fold="bulk"><summary>📣 Message à plusieurs clients</summary><div class="fb">
    <div class="chips wrap"><button class="chip sm" data-a="adm-bsel" data-v="all">Tous</button><button class="chip sm" data-a="adm-bsel" data-v="clients">Coaching</button><button class="chip sm" data-a="adm-bsel" data-v="late">À relancer</button><button class="chip sm" data-a="adm-bsel" data-v="none">Aucun</button></div>
    <div class="list mt8">${ms.map(m => `<label class="li" style="gap:10px"><input type="checkbox" data-c="adm-bpick" value="${m.id}" ${bulkSel.has(m.id) ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--red)"><span class="grow small">${esc(first(m))} <span class="xs muted">${esc(offer(m.tier).name)}</span></span></label>`).join("")}</div>
    <div class="lbl mt12">Message tout fait</div><div class="chips wrap mt8">${readyList().map(r => `<button class="chip sm" data-a="bulk-tpl" data-v="${esc(r.id)}">${esc(r.label)}</button>`).join("")}</div>
    <form data-f="adm-bulk" class="mt8"><label class="field"><span>Message (envoyé dans le fil de chacun)</span><textarea id="bulk-txt" name="b" required maxlength="2000" placeholder="Bonjour {prénom}…"></textarea></label>
      <div class="row" style="gap:6px;margin-top:6px"><button type="button" class="chip sm" data-a="bulk-name">+ Prénom {prénom}</button><span class="xs muted">Remplacé automatiquement par le prénom de chaque client.</span></div>
      <button class="btn btn-red btn-sm mt8" style="width:100%">Envoyer à ${bulkSel.size} membre${bulkSel.size > 1 ? "s" : ""}</button></form>
    <form data-f="broadcast" class="mt16"><div class="lbl">Ou une notification à tous les membres</div><label class="field mt8"><span>Titre</span><input name="t" required maxlength="80"></label><label class="field mt8"><span>Message</span><textarea name="b" maxlength="300"></textarea></label><button class="btn btn-line btn-sm mt8" style="width:100%">Envoyer la notification</button></form></div></details>`;
}
changes["adm-bpick"] = (el) => { if (el.checked) bulkSel.add(el.value); else bulkSel.delete(el.value); const b = document.querySelector('form[data-f="adm-bulk"] button'); if (b) b.textContent = `Envoyer à ${bulkSel.size} membre${bulkSel.size > 1 ? "s" : ""}`; };
actions["adm-bsel"] = (b, d) => { const ms = A.members || []; bulkSel = new Set(d.v === "none" ? [] : ms.filter(m => d.v === "all" || (d.v === "clients" ? isClient(m) : (daysSince(lastAct(m) || m.last_seen) ?? 0) >= 4)).map(m => m.id)); UI.open.bulk = true; rerender(); };
// Message tout fait : remplit le champ (modifiable avant envoi)
actions["bulk-tpl"] = (b, d) => { const r = readyList().find(x => x.id === d.v), t = document.getElementById("bulk-txt"); if (r && t) { t.value = r.body; t.focus(); } };
actions["bulk-name"] = () => { const t = document.getElementById("bulk-txt"); if (!t) return; const p = t.selectionStart ?? t.value.length; t.value = t.value.slice(0, p) + "{prénom}" + t.value.slice(t.selectionEnd ?? p); t.focus(); };
// Chaque message part avec le prénom du destinataire à la place de {prénom}
const prenom = (m) => ((m?.name || "").trim().split(/\s+/)[0]) || first(m || { email: "" });
const personalize = (body, m) => body.replace(/\{prénom\}/gi, prenom(m));
forms["adm-bulk"] = async (v, f) => {
  if (!bulkSel.size) return toast("Choisis au moins un membre.");
  const c = await cloud(); let ok = 0; for (const id of bulkSel) { const m = A.members.find(x => x.id === id); try { await c.send(personalize(v.b.trim(), m || { name: "" }), id); ok++; } catch { } }
  f.reset(); toast(`Message envoyé à ${ok} membre${ok > 1 ? "s" : ""}`); bulkSel = new Set(); load(true).then(rerender);
};

// Liste des clients
function clientRow(m) {
  const th = A.threads[m.id] || {}, s = A.sums[m.id] || {}, la = lastAct(m), n = daysSince(la), s7 = s.s7 || {};
  const act = n == null ? `inscrit ${ago(m.created_at)}` : n === 0 ? "actif aujourd'hui" : n === 1 ? "actif hier" : `inactif depuis ${n} j`;
  return `<div class="crow"><span class="ava">${esc(initials(m))}<i class="dt ${dotOf(n)}"></i></span><button class="grow" style="text-align:left" data-a="go" data-r="member" data-p="${m.id}"><b>${esc(first(m))}</b>${th.unread ? ` <span class="pill-b">💬 ${th.unread}</span>` : ""}${th.bilan ? ` <span class="pill-b">Bilan</span>` : ""}${adhOf(m)?.score != null ? ` <span class="tag ${"st-" + (STATUS[adhOf(m).status]?.tone || "pl")}">${adhOf(m).score}</span>` : ""}${isClient(m) ? "" : ` <span class="tag">${esc(offer(m.tier).name)}</span>`}<br><span class="xs muted">${act} · ${s7.ex ?? 0} exo${(s7.ex ?? 0) > 1 ? "s" : ""} · nutri ${s7.nutri ?? 0}/7${s.program ? ` · ${esc(s.program.split("·")[0].trim())} S${s.week}` : ""}</span></button>${I.chev}<button class="icon-btn" data-a="adm-more" data-id="${m.id}" aria-label="Actions">•••</button></div>`;
}
function clientsBlock() {
  const all = A.members || [], scope = UI.scope ?? (all.some(isClient) ? "clients" : "tous");
  const q = UI.q.toLowerCase(), list = all.filter(m => (scope === "tous" || isClient(m)) && statOk(m, UI.filt || "tous") && (!q || first(m).toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)));
  const prio = (m) => (A.threads[m.id]?.unread ? 1000 : 0) + (A.threads[m.id]?.bilan ? 500 : 0) + (adhOf(m)?.status === "risk" ? 300 : adhOf(m)?.status === "watch" ? 100 : 0) + (daysSince(lastAct(m) || m.last_seen) ?? 0);
  list.sort(UI.sort === "az" ? (a, b) => first(a).localeCompare(first(b), "fr") : (a, b) => prio(b) - prio(a));
  const late = list.filter(m => (daysSince(lastAct(m) || m.last_seen) ?? 0) >= 4).length;
  const base = all.filter(m => scope === "tous" || isClient(m)), cnt = (f) => base.filter(m => statOk(m, f)).length;
  return `<div class="card mt12"><div class="search">${I.search}<input id="adm-q" placeholder="Rechercher un athlète" value="${esc(UI.q)}" autocomplete="off"></div>
      <div class="mt8">${seg([["clients", "Coaching"], ["tous", "Tous les membres"]], scope, "adm-scope")}</div>
      <div class="chips mt8">${[["tous", "Tous"], ["actifs", "Actifs"], ["attente", "En attente"], ["alerte", "● Alerte"]].map(([v, l]) => `<button class="chip ${(UI.filt || "tous") === v ? "on" : ""}" data-a="adm-filt" data-v="${v}">${l} ${cnt(v)}</button>`).join("")}</div>
      <p class="small mt8" style="margin-bottom:6px">${late ? `<b class="red">${late} à relancer</b> · ` : ""}<span class="crow" style="display:inline-flex;border:0;padding:0;gap:4px"><span class="dt g"></span>actif · <span class="dt o"></span>2-3 j · <span class="dt r"></span>4 j et plus</span></p>
      ${seg([["prio", "Priorité"], ["az", "A → Z"]], UI.sort, "adm-sort")}
      <div class="mt8" id="adm-list">${list.map(clientRow).join("") || `<p class="empty small">${scope === "clients" ? "Pas encore de client en coaching. Active une formule de coaching dans « Abonnés » et le dossier arrive ici." : "Aucun membre."}</p>`}</div></div>`;
}
actions["adm-scope"] = (b, d) => { UI.scope = d.v; rerender(); };
actions["adm-sort"] = (b, d) => { UI.sort = d.v; rerender(); };
actions["adm-more"] = (b, d) => {
  const m = A.members.find(x => x.id === d.id);
  sheet(`<h2 class="h2">${esc(first(m))}</h2><p class="xs muted">${esc(m.email || "")} · ${esc(offer(m.tier).name)}</p>
    <div class="list mt12"><a class="li" href="#/chat/${m.id}"><span class="em">💬</span><span class="grow">Messages</span>${I.chev}</a><a class="li" href="#/member/${m.id}"><span class="em">📂</span><span class="grow">Dossier complet</span>${I.chev}</a><button class="li" data-a="adm-tier" data-id="${m.id}"><span class="em">⭐</span><span class="grow">Changer la formule</span>${I.chev}</button><button class="li" data-a="adm-task" data-id="${m.id}"><span class="em">📋</span><span class="grow">Ajouter une tâche pour ce client</span>${I.chev}</button></div>
    <form data-f="adm-note" data-id="${m.id}" class="mt12"><label class="field"><span>📝 Note privée (visible par toi seul)</span><textarea name="n" rows="3">${esc(A.store.notes[m.id] || "")}</textarea></label><button class="btn btn-line btn-sm mt8" style="width:100%">Enregistrer la note</button></form>`);
};
forms["adm-note"] = async (v, f) => { A.store.notes[f.dataset.id] = v.n; closeSheet(); toast("Note enregistrée"); await saveStore("notes"); };
actions["adm-task"] = (b, d) => { const m = A.members.find(x => x.id === d.id); sheet(`<h2 class="h2">Tâche pour ${esc(first(m))}</h2><form data-f="adm-todo" class="mt12"><label class="field"><span>Tâche</span><input name="t" value="${esc(first(m))} : " required></label><label class="field mt8"><span>Pour le</span><input type="date" name="due" value="${today()}"></label><button class="btn btn-red mt12">Ajouter</button></form>`); };
actions["adm-new"] = () => {
  const url = location.origin + location.pathname, txt = `Je t'ouvre ton espace dans TB my Coach, l'app de mon coaching. Ouvre ce lien, crée ton profil en 2 minutes avec ton e-mail, et ajoute l'app à ton écran d'accueil : ${url}`;
  sheet(`<h2 class="h2">+ Nouveau client</h2><p class="small muted mt4">Ton client crée son compte lui-même depuis le lien. Dès qu'il a fini son profil, il apparaît ici : active ensuite sa formule de coaching dans « Abonnés ».</p>
    <div class="card soft mt12"><p class="small" style="margin:0">${esc(txt)}</p></div>
    <div class="row mt12" style="gap:8px"><button class="btn btn-red grow" data-a="adm-share" data-t="${esc(txt)}">Partager l'invitation</button><button class="btn btn-line grow" data-a="adm-copy" data-t="${esc(txt)}">Copier</button></div>
    <div class="card mt16"><b class="small">🔑 Ou prépare son espace avant son inscription</b><p class="xs muted mt4">Formule, programme, bilans : tout est prêt. Il reçoit un code ; à son inscription (avec ce code ou le même e-mail), il retrouve tout.</p><button class="btn btn-line btn-sm mt8" data-a="inv-new">Préparer un athlète</button></div>`);
};
actions["adm-share"] = async (b, d) => { try { await navigator.share({ text: d.t }); } catch { navigator.clipboard?.writeText(d.t); toast("Invitation copiée"); } };
actions["adm-copy"] = (b, d) => { navigator.clipboard?.writeText(d.t); toast("Copié"); };
function rankingSheet() {
  const ms = (A.members || []).map(m => ({ m, s7: A.sums[m.id]?.s7 || {}, w: A.sums[m.id]?.workouts || 0 })).sort((a, b) => (b.s7.workouts || 0) - (a.s7.workouts || 0) || (b.s7.nutri || 0) - (a.s7.nutri || 0) || b.w - a.w);
  sheet(`<h2 class="h2">🏆 Classement des clients <small class="muted">7 derniers jours</small></h2><div class="list mt12">${ms.map((x, i) => `<a class="li" href="#/member/${x.m.id}"><span class="num" style="width:28px">${["🥇", "🥈", "🥉"][i] || i + 1}</span><span class="grow small"><b>${esc(first(x.m))}</b><br><span class="xs muted">${x.s7.workouts || 0} séance${(x.s7.workouts || 0) > 1 ? "s" : ""} · ${x.s7.ex || 0} exos · nutri ${x.s7.nutri || 0}/7 · ${x.w} séances au total</span></span></a>`).join("") || `<p class="empty small">Pas encore de données.</p>`}</div>`);
}
actions["adm-rank"] = () => rankingSheet();

// Onglet « Aujourd'hui » : qui s'entraîne aujourd'hui et à quelle heure, ce qui est en cours, à traiter
let LIVE_LIST = [];
// Séances en direct en cours chez les clients : le coach les ouvre et voit ce qui se remplit
function liveNowBlock() {
  const have = new Set(LIVE_LIST.map(r => r.user_id));
  (A.members || []).forEach(m => { const s = A.sums[m.id]; if (!have.has(m.id) && s?.inProgress && s.today === today()) LIVE_LIST.push({ user_id: m.id, state: { title: s.inProgress.title, session: { exercises: [] }, snap: s.inProgress.done }, updated_at: null }); });
  if (!LIVE_LIST.length) return "";
  return `<div class="card mt12" style="box-shadow:0 0 0 2px var(--red) inset"><div class="lbl">🔴 Séances en direct</div><div class="list mt8">${LIVE_LIST.map(r => {
    const m = (A.members || []).find(x => x.id === r.user_id), exs = r.state.session?.exercises || r.state.exercises || [], done = r.state.snap ?? exs.flatMap(e => e.sets || []).filter(x => x.done).length, tot = exs.flatMap(e => e.sets || []).filter(x => x.type !== "W").length, tt = r.state.snap != null ? `${done} séries faites` : `${done}/${tot} séries`;
    return `<button class="li" data-a="go" data-r="live" data-p="${r.user_id}"><span class="grow small"><b>${esc(m ? first(m) : "Client")}</b> · ${esc(r.state.title || "Séance")}<br><span class="xs muted">${tt} · touche pour ouvrir et remplir avec lui${r.updated_at ? ` · mis à jour ${ago(r.updated_at)}` : ""}${r.state.by === "member" ? " · lancée par le client" : ""}</span></span>${I.chev}</button>`;
  }).join("")}</div></div>`;
}
routes["admin-today"] = async () => {
  if (!(await guard("admin-today"))) return;
  if (S().current?.mirror) { E.setHist(null); update(st => { st.current = null; }); } // séance d'un client restée ouverte
  try { LIVE_LIST = await (await cloud()).liveAll(); } catch { LIVE_LIST = []; }
  // Séance terminée par le client sur son téléphone : sa copie serveur n'a plus de séance en cours et est plus récente → on la retire (et on la clôt)
  LIVE_LIST = LIVE_LIST.filter(r => {
    const s = A.sums?.[r.user_id], at = A.snapAt?.[r.user_id];
    if (s && at && !s.inProgress && new Date(at) > new Date(r.updated_at) && Date.now() - new Date(r.updated_at) > 3 * 60000) {
      cloud().then(c => c.liveSet(r.user_id, { ...r.state, ended: true, endedAt: new Date().toISOString() })).catch(() => { });
      return false;
    }
    return true;
  });
  let vids = []; try { vids = await videosEnAttente(); } catch { }
  frame("admin-today", `${homeHead()}${kpiBlock()}${liveNowBlock()}${blocAdmin(vids)}${alertsBlock()}${dayAthletes()}${eventsBlock()}${decrochageBlock()}${agendaBlock()}${todoBlock()}${fabBtn()}`, "Accueil");
};

routes.admin = async () => {
  if (!(await guard("admin"))) return;
  await ensureReady().catch(() => { });
  frame("admin", `${athletesHead()}${invitesBlock()}${clientsBlock()}${candBlock()}${bulkBlock()}<div class="adm-links mt12"><button class="adm-link" data-a="adm-rank">🏆 Classement des clients</button><button class="adm-link" data-a="go" data-r="kb">📘 Méthode & théorie</button></div>${fabBtn()}`, "Athlètes");
  const i = document.getElementById("adm-q"); i?.addEventListener("input", () => { UI.q = i.value; clearTimeout(i._t); i._t = setTimeout(() => { const box = document.getElementById("adm-list"); if (box) { const tmp = document.createElement("div"); tmp.innerHTML = clientsBlock(); box.innerHTML = tmp.querySelector("#adm-list").innerHTML; } }, 200); });
};

// =====================================================================
// MESSAGES
// =====================================================================
let msgQ = "";
routes["admin-msg"] = async () => {
  if (!(await guard("admin-msg"))) return;
  const ms = (A.members || []).map(m => ({ m, th: A.threads[m.id] })).sort((a, b) => (b.th?.last?.created_at || "").localeCompare(a.th?.last?.created_at || ""));
  const unread = ms.reduce((a, x) => a + (x.th?.unread || 0), 0);
  const q = msgQ.toLowerCase(), shown = ms.filter(x => !q || first(x.m).toLowerCase().includes(q));
  frame("admin-msg", `<h1 class="h1 mt8">Messages</h1><p class="small muted">${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""} · ${ms.length} membres</p>
    <input class="inp mt8" id="msg-q" placeholder="Rechercher un client" value="${esc(msgQ)}" style="text-align:left">
    <div class="card mt12" style="padding:4px 12px">${shown.map(({ m, th }) => { const l = th?.last, mine = l && l.sender !== m.id; return `<div class="row" style="gap:4px;align-items:center"><a class="li grow" href="#/chat/${m.id}" style="gap:12px"><span class="av ${th?.unread ? "on" : ""}">${esc(first(m)[0].toUpperCase())}</span><span class="grow" style="min-width:0"><span class="row between"><b>${esc(first(m))}</b><span class="xs muted">${l ? (l.created_at.slice(0, 10) === today() ? new Date(l.created_at).toTimeString().slice(0, 5) : fmtDate(l.created_at.slice(0, 10), { day: "numeric", month: "short" })) : ""}</span></span><span class="row between" style="gap:8px"><span class="small ${th?.unread ? "" : "muted"}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${th?.unread ? "font-weight:700" : ""}">${l ? `${mine ? "Toi : " : ""}${esc(l.body)}` : "Pas encore de message"}</span>${th?.unread ? `<span class="cnt">${th.unread}</span>` : ""}</span></span></a><button class="icon-btn" data-a="${th?.unread ? "msg-read" : "msg-unread"}" data-id="${m.id}" aria-label="${th?.unread ? "Marquer lu" : "Marquer non lu"}" title="${th?.unread ? "Marquer lu" : "Marquer non lu"}">${th?.unread ? "✓" : "●"}</button></div>`; }).join("") || `<p class="empty small">Aucun membre.</p>`}</div>`);
  const i = document.getElementById("msg-q"); i?.addEventListener("input", () => { msgQ = i.value; clearTimeout(i._t); i._t = setTimeout(() => routes["admin-msg"](), 250); });
};

// =====================================================================
// BUSINESS
// =====================================================================
let bizTab = "dash", bizYear = new Date().getFullYear();
const B = () => A.store.biz || (A.store.biz = BIZ0());
routes["admin-biz"] = async () => {
  if (!(await guard("admin-biz"))) return;
  const P = B().payments, t = today(), ym = t.slice(0, 7), y = String(bizYear);
  let body = "";
  if (bizTab === "dash") {
    const paid = P.filter(p => p.paid), month = paid.filter(p => p.d.startsWith(ym)).reduce((a, p) => a + p.amount, 0), year = paid.filter(p => p.d.startsWith(String(new Date().getFullYear()))).reduce((a, p) => a + p.amount, 0);
    const up = P.filter(p => !p.paid && p.d >= t), late = P.filter(p => !p.paid && p.d < t);
    const months = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`), byM = months.map(mk => paid.filter(p => p.d.startsWith(mk)).reduce((a, p) => a + p.amount, 0));
    const Q = [0, 1, 2, 3].map(q => byM.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0)), rate = num(B().settings.rate) || null;
    body = `<div class="kpis mt12"><div class="kpi"><b>${eur(month)}</b><span>encaissé ce mois</span></div><div class="kpi"><b>${eur(year)}</b><span>encaissé en ${new Date().getFullYear()}</span></div><div class="kpi"><b>${eur(up.reduce((a, p) => a + p.amount, 0))}</b><span>à venir (${up.length})</span></div><div class="kpi"><b class="${late.length ? "red" : ""}">${eur(late.reduce((a, p) => a + p.amount, 0))}</b><span>en retard (${late.length})</span></div></div>
      ${B().settings.goal ? `<div class="card mt12"><div class="row between small"><b>Objectif ${new Date().getFullYear()}</b><span>${eur(year)} / ${eur(+B().settings.goal)}</span></div><div class="gauge mt8"><i style="width:${Math.min(100, Math.round(year / B().settings.goal * 100))}%"></i></div></div>` : ""}
      <div class="card mt12"><div class="row between"><b class="h3">CA encaissé ${y}</b><div class="row" style="gap:6px"><button class="icon-btn sm" data-a="biz-y" data-v="-1">‹</button><button class="icon-btn sm" data-a="biz-y" data-v="1">›</button></div></div>
        <div class="mt8">${barChart(byM.map((v, i) => ({ v, l: "JFMAMJJASOND"[i] })), { fmt: (x) => Math.round(x), hi: y === t.slice(0, 4) ? new Date().getMonth() : -1 })}</div>
        <table class="qtab"><tr><th>Trimestre</th><th>T1</th><th>T2</th><th>T3</th><th>T4</th></tr><tr><td>CA à déclarer</td>${Q.map(q => `<td>${eur(q)}</td>`).join("")}</tr>${rate ? `<tr><td>Cotisations (${fr(rate, 1)} %)</td>${Q.map(q => `<td>${eur(q * rate / 100)}</td>`).join("")}</tr>` : ""}</table>
        <p class="xs muted mt8" style="margin-bottom:0">En micro-entreprise, tu déclares le CA encaissé (date de paiement), chaque mois ou chaque trimestre selon ton choix à l'URSSAF.${rate ? "" : " Renseigne ton taux de cotisations dans Réglages pour voir l'estimation."}</p></div>` + acquisitionCard();
  } else if (bizTab === "enc") {
    const l = P.slice().sort((a, b) => b.d.localeCompare(a.d));
    body = `<button class="btn btn-red btn-sm mt12" data-a="pay-new" style="width:100%">+ Ajouter un encaissement</button>
      <div class="card mt12" style="padding:4px 12px">${l.map(p => `<div class="li" style="gap:8px"><button class="grow" style="text-align:left" data-a="pay-edit" data-id="${p.id}"><b class="small">${esc(p.who || "–")}</b> <span class="xs muted">${esc(p.label || "")}</span><br><span class="xs ${!p.paid && p.d < t ? "red" : "muted"}">${fmtDate(p.d, { day: "numeric", month: "short", year: "numeric" })} · ${p.paid ? "encaissé" : p.d < t ? "en retard" : "à venir"}</span></button><b class="small">${eur(p.amount)}</b><button class="icon-btn sm" data-a="pay-tog" data-id="${p.id}" aria-label="Marquer encaissé" style="${p.paid ? "background:var(--gradbtn);color:#fff;border:0" : ""}">✓</button>${!p.paid && p.d < t && p.mid ? `<button class="icon-btn sm" data-a="pay-relance" data-id="${p.id}" aria-label="Relancer">🔔</button>` : ""}<button class="icon-btn sm" data-a="fac-from-pay" data-id="${p.id}" aria-label="Facture">🧾</button></div>`).join("") || `<p class="empty small">Aucun encaissement. Ajoute tes paiements (Stripe, virement, espèces) pour suivre ton CA.</p>`}</div>`;
  } else if (bizTab === "cyc") {
    const C = B().cycles.slice().sort((a, b) => a.start.localeCompare(b.start));
    body = `<button class="btn btn-red btn-sm mt12" data-a="cyc-new" style="width:100%">+ Nouveau cycle client</button>
      ${C.map(c => { const end = addDays(c.start, c.weeks * 7 - 1), done = Math.min(c.weeks, Math.max(0, Math.floor((new Date(t) - new Date(c.start)) / (7 * 864e5)) + (t >= c.start ? 1 : 0))), soon = end >= t && end <= addDays(t, 14); return `<div class="card mt8" style="${soon ? "box-shadow:0 0 0 2px var(--warn) inset" : ""}"><div class="row between"><b>${esc(c.who)}</b><span class="tag">${esc(cycName(c))}</span></div>
        <p class="xs muted mt4" style="margin-bottom:6px">${fmtDate(c.start, { day: "numeric", month: "short" })} → ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })} · ${c.weeks} sem. · ${eur(c.price)} ${c.split === "mois" ? "par mois" : "au total"}</p>
        ${c.detail ? `<p class="small mt4" style="margin:0 0 6px;white-space:pre-line">${esc(c.detail)}</p>` : ""}
        <div class="gauge"><i style="width:${Math.round(done / c.weeks * 100)}%"></i></div><p class="xs mt4" style="margin:4px 0 0">${t < c.start ? "Commence bientôt" : end < t ? "Terminé" : `Semaine ${done}/${c.weeks}`}${soon ? " · <b>renouvellement à proposer</b>" : ""}</p>
        <div class="row mt8" style="gap:6px"><button class="btn btn-line btn-xs grow" data-a="cyc-pay" data-id="${c.id}">Créer les encaissements</button><button class="btn btn-ghost btn-xs" data-a="cyc-del" data-id="${c.id}" style="color:var(--red)">Supprimer</button></div></div>`; }).join("") || `<p class="empty small">Suis ici les cycles de coaching de tes clients (début, durée, prix) : l'app te prévient quand un renouvellement approche.</p>`}`;
  } else if (bizTab === "off") body = offresBody();
  else if (bizTab === "fac") body = facturesBody();
  else {
    const s = B().settings;
    body = `<form data-f="biz-set" class="card mt12"><label class="field"><span>Taux de cotisations sociales (%)</span><input name="rate" inputmode="decimal" value="${s.rate ?? ""}" placeholder="vérifie ton taux sur autoentrepreneur.urssaf.fr"></label>
      <label class="field mt8"><span>Déclaration</span><select name="freq"><option value="mois" ${s.freq === "mois" ? "selected" : ""}>Mensuelle</option><option value="trimestre" ${s.freq !== "mois" ? "selected" : ""}>Trimestrielle</option></select></label>
      <label class="field mt8"><span>Objectif de CA annuel (€)</span><input name="goal" inputmode="decimal" value="${s.goal ?? ""}"></label>
      <div class="lbl mt16">Sur tes factures</div>
      <div class="grid2"><label class="field"><span>Nom</span><input name="nom" value="${esc(s.nom || "Thomas Boulet")}"></label><label class="field"><span>SIRET</span><input name="siret" value="${esc(s.siret || "")}" inputmode="numeric"></label></div>
      <label class="field mt8"><span>Activité</span><input name="activite" value="${esc(s.activite || "Coach sportif · Entrepreneur individuel")}"></label>
      <label class="field mt8"><span>Adresse</span><textarea name="adresse" rows="2">${esc(s.adresse || "")}</textarea></label>
      <div class="grid2 mt8"><label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(s.email || "")}"></label><label class="field"><span>Paiement par</span><input name="paiement" value="${esc(s.paiement || "virement ou carte")}"></label></div>
      <div class="grid2 mt8"><label class="field"><span>Échéance (jours)</span><input name="delai" inputmode="numeric" value="${s.delai ?? 15}"></label><label class="li" style="padding:6px 0;gap:8px"><input type="checkbox" name="pro" ${s.pro ? "checked" : ""}><span class="xs">Clients pros (mention 40 €)</span></label></div>
      <button class="btn btn-red btn-sm mt12" style="width:100%">Enregistrer</button></form>
      <p class="xs muted mt8">Ces données restent dans ton espace coach, sur le serveur : tu les retrouves sur tous tes appareils. Je ne suis pas expert-comptable : vérifie toujours tes taux auprès de l'URSSAF.</p>`;
  }
  frame("admin-biz", `<h1 class="h1 mt8">Mon activité</h1><div class="chips wrap mt8">${[["dash", "Tableau de bord"], ["off", "Mes offres"], ["enc", "Encaissements"], ["fac", "Factures"], ["cyc", "Cycles clients"], ["set", "Réglages"]].map(([k, l]) => `<button class="chip ${bizTab === k ? "on" : ""}" data-a="biz-tab" data-v="${k}">${l}</button>`).join("")}<button class="chip" data-a="go" data-r="admin-social">🤝 Parrainage et communauté</button></div>${body}`);
};
actions["biz-tab"] = (b, d) => { bizTab = d.v; rerender(); };
actions["biz-y"] = (b, d) => { bizYear += +d.v; rerender(); };
const memberOpts = (sel = "") => `<option value="">— Autre —</option>${(A.members || []).map(m => `<option value="${m.id}" ${m.id === sel ? "selected" : ""}>${esc(first(m))}</option>`).join("")}`;
function paySheet(p = null) {
  sheet(`<h2 class="h2">${p ? "Modifier" : "Nouvel"} encaissement</h2><form data-f="pay" data-id="${p?.id || ""}" class="mt12">
    <div class="grid2"><label class="field"><span>Client</span><select name="mid">${memberOpts(p?.mid)}</select></label><label class="field"><span>Ou nom</span><input name="who" value="${esc(p && !p.mid ? p.who : "")}" placeholder="Client hors app"></label></div>
    <div class="grid2 mt8"><label class="field"><span>Montant (€)</span><input name="amount" inputmode="decimal" required value="${p ? String(p.amount).replace(".", ",") : ""}"></label><label class="field"><span>Date</span><input type="date" name="d" required value="${p?.d || today()}"></label></div>
    ${(B().offers || []).length ? `<label class="field mt8"><span>Offre</span><select data-c="pay-off"><option value="">—</option>${B().offers.map(o => `<option value="${o.id}">${esc(o.nom)} · ${eur(o.prix)}${o.unite ? " " + esc(o.unite) : ""}</option>`).join("")}</select></label>` : ""}
    <label class="field mt8"><span>Libellé</span><input name="label" value="${esc(p?.label || "")}" placeholder="Coaching, mois 2…"></label>
    <label class="li mt8" style="gap:10px"><input type="checkbox" name="paid" ${p?.paid ?? true ? "checked" : ""} style="width:20px;height:20px;accent-color:var(--red)"><span class="grow">Déjà encaissé</span></label>
    <button class="btn btn-red mt12">Enregistrer</button>${p ? `<button type="button" class="btn btn-line mt8" data-a="pay-del" data-id="${p.id}" style="color:var(--red)">Supprimer</button>` : ""}</form>`);
}
actions["pay-new"] = () => paySheet();
actions["pay-edit"] = (b, d) => paySheet(B().payments.find(p => p.id === +d.id));
forms.pay = async (v, f) => {
  const amount = num(v.amount); if (!(amount > 0)) return toast("Montant invalide");
  const m = A.members?.find(x => x.id === v.mid), rec = { id: +f.dataset.id || Date.now(), mid: v.mid || null, who: m ? first(m) : v.who.trim() || "Client", amount, d: v.d, label: v.label.trim(), paid: !!v.paid };
  const P = B().payments, i = P.findIndex(p => p.id === rec.id); if (i >= 0) P[i] = rec; else P.push(rec);
  closeSheet(); rerender(); await saveStore("biz");
};
actions["pay-tog"] = async (b, d) => { const p = B().payments.find(p => p.id === +d.id); p.paid = !p.paid; if (p.paid && p.d > today()) p.d = today(); rerender(); await saveStore("biz"); };
actions["pay-del"] = async (b, d) => { if (!confirm("Supprimer cet encaissement ?")) return; B().payments = B().payments.filter(p => p.id !== +d.id); closeSheet(); rerender(); await saveStore("biz"); };
actions["cyc-new"] = () => sheet(`<h2 class="h2">Nouveau cycle client</h2><form data-f="cyc" class="mt12">
  <div class="grid2"><label class="field"><span>Client</span><select name="mid">${memberOpts()}</select></label><label class="field"><span>Ou nom</span><input name="who" placeholder="Client hors app"></label></div>
  <label class="field mt8"><span>Formule</span><select name="offer">${assignable().filter(o => o.rank >= 3).map(o => `<option value="${o.id}">${esc(o.name)} · ${esc(o.price)}${esc(o.per)}</option>`).join("")}<option value="custom">Offre personnalisée (à décrire)</option></select></label>
  <label class="field mt8"><span>Intitulé (si offre personnalisée)</span><input name="label" maxlength="80" placeholder="Coaching salle · 3 séances par semaine"></label>
  <label class="field mt8"><span>Détail de l'offre</span><textarea name="detail" rows="4" maxlength="1000" placeholder="Ce qui est inclus, rythme, suivi, conditions…"></textarea></label>
  <div class="grid3 mt8"><label class="field"><span>Début</span><input type="date" name="start" value="${today()}" required></label><label class="field"><span>Semaines</span><input name="weeks" inputmode="numeric" value="12"></label><label class="field"><span>Prix (€)</span><input name="price" inputmode="decimal" placeholder="890"></label></div>
  <label class="field mt8"><span>Paiement</span><select name="split"><option value="total">En une fois (au début)</option><option value="mois">Chaque mois</option></select></label>
  <button class="btn btn-red mt12">Créer le cycle</button></form>`);
// Nom affiché d'un cycle : l'intitulé personnalisé, sinon le nom de la formule
const cycName = (c) => c.label || offer(c.offer).name;
forms.cyc = async (v) => {
  const m = A.members?.find(x => x.id === v.mid), price = num(v.price) || priceOf(v.offer), weeks = Math.max(1, Math.round(num(v.weeks)) || 12);
  const custom = v.offer === "custom";
  if (custom && !v.label.trim()) return toast("Donne un intitulé à l'offre personnalisée");
  if (!(price > 0)) return toast("Indique le prix");
  B().cycles.push({ id: Date.now(), mid: v.mid || null, who: m ? first(m) : v.who.trim() || "Client", offer: custom ? "custom" : v.offer, label: custom || v.label.trim() ? v.label.trim() : "", detail: (v.detail || "").trim(), start: v.start, weeks, price, split: v.split });
  closeSheet(); rerender(); await saveStore("biz");
};
actions["cyc-pay"] = async (b, d) => {
  const c = B().cycles.find(x => x.id === +d.id), P = B().payments; let n = 0;
  if (c.split === "mois") { const months = Math.max(1, Math.round(c.weeks / 4.33)); for (let i = 0; i < months; i++) { const dd = new Date(c.start + "T12:00:00"); dd.setMonth(dd.getMonth() + i); P.push({ id: Date.now() + i, mid: c.mid, who: c.who, amount: c.price, d: today(dd), label: `${cycName(c)} · mois ${i + 1}/${months}`, paid: false }); n++; } }
  else { P.push({ id: Date.now(), mid: c.mid, who: c.who, amount: c.price, d: c.start, label: `${cycName(c)} · ${c.weeks} semaines`, paid: false }); n = 1; }
  toast(`${n} encaissement${n > 1 ? "s" : ""} prévu${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`); rerender(); await saveStore("biz");
};
actions["cyc-del"] = async (b, d) => { if (!confirm("Supprimer ce cycle ?")) return; B().cycles = B().cycles.filter(x => x.id !== +d.id); rerender(); await saveStore("biz"); };
forms["biz-set"] = async (v) => { B().settings = { ...B().settings, rate: num(v.rate) || null, freq: v.freq, goal: num(v.goal) || null, nom: v.nom.trim(), siret: v.siret.trim(), activite: v.activite.trim(), adresse: v.adresse.trim(), email: v.email.trim(), paiement: v.paiement.trim(), delai: Math.max(0, Math.round(num(v.delai))) || 15, pro: !!v.pro }; toast("Réglages enregistrés"); rerender(); await saveStore("biz"); };

// =====================================================================
// ABONNÉS
// =====================================================================
let subF = "all";
routes["admin-subs"] = async () => {
  if (!(await guard("admin-subs"))) return;
  const ms = A.members || [], t = today();
  const trial = (m) => m.tier_until && m.tier_until >= t;
  const mrr = ms.filter(m => offer(m.tier).rank >= 1 && !trial(m)).reduce((a, m) => a + priceOf(m.tier), 0);
  const list = ms.filter(m => subF === "all" || (subF === "trial" ? trial(m) : m.tier === subF)).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const stripe = OFFERS.some(o => o.pay?.month);
  frame("admin-subs", `<h1 class="h1 mt8">Abonnés</h1>
    <div class="card mt8"><div class="grid3">${assignable().map(o => `<div><span class="xs muted">${esc(o.name)}</span><br><b class="num" style="font-size:24px">${ms.filter(m => m.tier === o.id).length}</b></div>`).join("")}<div><span class="xs muted">En essai</span><br><b class="num" style="font-size:24px">${ms.filter(trial).length}</b></div></div>
      <div class="lbl mt16">Revenu mensuel récurrent estimé</div><b class="num" style="font-size:30px">${eur(mrr)}</b><p class="xs muted" style="margin:4px 0 0">Formules actives × prix mensuel, hors frais Stripe ; les essais et les formules avec date de fin ne comptent pas.</p></div>
    <div class="card mt12"><b>Paiement en ligne (Stripe) : ${stripe ? "🟢 liens actifs" : "🟠 à configurer"}</b><p class="small muted mt4" style="margin-bottom:0">${stripe ? "Les boutons de paiement de l'app ouvrent tes liens Stripe." : "Crée dans Stripe un lien de paiement par formule (Bâtisseur mensuel et annuel), puis envoie-les-moi : je les branche dans l'app. En attendant, active les formules à la main ci-dessous."}</p></div>
    <div class="card mt12"><b class="h3">Liste (${list.length})</b><div class="mt8">${chips([["all", "Tous"], ...assignable().map(o => [o.id, o.name]), ["trial", "Essai"]], subF, "sub-f")}</div>
      ${list.map(m => { const s = A.sums[m.id] || {}; return `<div style="border-top:1px solid var(--line);padding:12px 0;margin-top:8px"><div class="row between"><b>${esc(first(m))}</b><span class="tag ${offer(m.tier).rank ? "r" : ""}">${esc(offer(m.tier).name)}</span></div>
        <p class="xs muted mt4" style="margin-bottom:8px">${esc(m.email || "e-mail non renseigné")}${trial(m) ? ` · jusqu'au ${fmtDate(m.tier_until, { day: "numeric", month: "short", year: "numeric" })}` : ""}<br>Inscrit le ${fmtDate(m.created_at.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })} · vu ${ago(m.last_seen)} · ${s.lastWorkout ? `dernière séance ${ago(s.lastWorkout.end)}` : "aucune séance notée"}</p>
        <div class="row" style="gap:6px"><select class="inp grow" id="t-${m.id}" style="text-align:left">${assignable(m.tier).map(o => `<option value="${o.id}" ${o.id === m.tier ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select><input class="inp" type="date" id="u-${m.id}" value="${m.tier_until || ""}" style="width:150px" aria-label="Jusqu'au"></div>
        <button class="btn btn-line btn-sm mt8" data-a="sub-apply" data-id="${m.id}">Appliquer</button></div>`; }).join("") || `<p class="empty small">Aucun membre dans ce filtre.</p>`}
      <p class="xs muted mt8">Changer la formule ici l'offre (activation manuelle, sans paiement). Date vide = sans fin. Une formule de coaching fait entrer le dossier dans « Mes clients ».</p></div>`);
};
actions["sub-f"] = (b, d) => { subF = d.v; rerender(); };
actions["sub-apply"] = async (b, d) => {
  const t = document.getElementById("t-" + d.id).value, u = document.getElementById("u-" + d.id).value || null, c = await cloud();
  try { await c.setTier(d.id, t, u); const m = A.members.find(x => x.id === d.id); m.tier = t; m.tier_until = u; toast(`${first(m)} : ${offer(t).name}${u ? ` jusqu'au ${fmtDate(u, { day: "numeric", month: "short" })}` : ""}`); rerender(); } catch (e) { toast(e.message); }
};
actions["adm-tier"] = (b, d) => { const m = A.members.find(x => x.id === d.id); subF = "all"; closeSheet(); go("admin-subs"); setTimeout(() => document.getElementById("t-" + m.id)?.scrollIntoView({ block: "center" }), 600); };

// =====================================================================
// BASE DE DONNÉES
// =====================================================================
let dbTab = "food", dbQ = "", dbCat = "", dbMus = "";
const LIB = (k) => libraryRows().filter(r => r.kind === k);
routes["admin-db"] = async () => {
  if (!(await guard("admin-db"))) return;
  await Promise.all([N.loadCiqual(), E.loadPrograms(), E.loadFiches(), E.loadLib(), loadBibliotheque()]);
  let body = "";
  if (dbTab === "food") {
    const CQ = N.ciqual() || [], cats = {}; CQ.forEach(f => { cats[f.cat] = (cats[f.cat] || 0) + 1; });
    const mine = LIB("food");
    const res = dbQ ? N.searchFoods(dbQ, 60) : dbCat ? CQ.filter(f => f.cat === dbCat).slice(0, 200) : null;
    body = `<button class="btn btn-red btn-sm mt12" data-a="food-new" style="width:auto">+ Nouvel aliment</button>
      <p class="small muted mt12" style="margin-bottom:4px">Rechercher parmi ${fr(CQ.length)} aliments</p><input class="inp" id="db-q" value="${esc(dbQ)}" style="text-align:left" placeholder="poulet, skyr, riz…">
      ${mine.length && !res ? `<h2 class="sec">Tes aliments <small>visibles par tous les membres</small></h2><div class="card" style="padding:4px 12px">${mine.map(r => `<div class="li"><span class="grow small"><b>${esc(r.name)}</b><br><span class="xs muted">${r.data.kcal} kcal · P ${fr(r.data.p, 1)} · G ${fr(r.data.c, 1)} · L ${fr(r.data.f, 1)} / 100 g</span></span><button class="icon-btn sm" data-a="lib-del" data-id="${r.id}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>` : ""}
      ${res ? `${dbCat && !dbQ ? `<div class="row between mt12"><b>${esc(dbCat)}</b><button class="link small" data-a="db-cat" data-v="">← Catégories</button></div>` : ""}<div class="card mt8" style="padding:4px 12px">${res.map(f => `<div class="li"><span class="grow small">${esc(f.n)}${f.coach ? ` <span class="tag r">perso</span>` : ""}<br><span class="xs muted">${f.kcal} kcal · P ${fr(f.p, 1)} · G ${fr(f.c, 1)} · L ${fr(f.f, 1)} / 100 g</span></span></div>`).join("") || `<p class="empty small">Rien trouvé.</p>`}</div>`
      : `<div class="catgrid mt12">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<button data-a="db-cat" data-v="${esc(c)}">${esc(c)}<span>${n}</span></button>`).join("")}</div>`}`;
  } else if (dbTab === "recipe") {
    const q = N.norm(dbQ), l = RC.RECIPES.filter(r => !q || N.norm(r.n).includes(q));
    body = `<button class="btn btn-red btn-sm mt12" data-a="rec-new2" style="width:auto">+ Nouveau plat</button>
      <input class="inp mt12" id="db-q" value="${esc(dbQ)}" style="text-align:left" placeholder="Rechercher parmi ${RC.RECIPES.length} recettes">
      <div class="card mt12" style="padding:4px 12px">${l.map(r => `<div class="li" style="gap:8px"><button class="grow" style="text-align:left" data-a="rc-open" data-id="${r.id}"><span class="small"><b>${r.e} ${esc(r.n)}</b>${r.coach ? ` <span class="tag r">perso</span>` : ""}</span><br><span class="xs muted">${esc(r.cat)} · ${r.portions} portion${r.portions > 1 ? "s" : ""} · ${r.m.kcal} kcal · ${r.m.p} g P / portion</span></button>${r.coach ? `<button class="icon-btn sm" data-a="lib-del" data-id="${String(r.id).replace("lib-", "")}" aria-label="Supprimer">${I.close}</button>` : ""}</div>`).join("")}</div>`;
  } else if (dbTab === "ex") {
    const l = filterExercises(dbQ, dbMus, "");
    body = `<button class="btn btn-red btn-sm mt12" data-a="exo-new2" style="width:auto">+ Nouvel exercice</button>
      <input class="inp mt12" id="db-q" value="${esc(dbQ)}" style="text-align:left" placeholder="Nom ou muscle parmi ${E.allExercises().length} exercices">
      <div class="mt8">${chips([["", "Tous les muscles"], ...E.MUSCLES.map(m => [m, m])], dbMus, "db-mus")}</div>
      <p class="xs muted mt8">${l.length} exercices · ${Object.keys(E.extra.videos).length + Object.values(E.extra.exercises).filter(x => x.video).length} avec vidéo. Touche un exercice pour ajouter ta vidéo.</p>
      <div class="card" style="padding:4px 12px">${l.slice(0, 200).map(n => `<button class="li" data-a="exo-edit" data-n="${esc(n)}"><span class="grow small"><b>${esc(n)}</b>${E.videoOf(n) ? " 🎥" : ""}${E.extra.exercises[n] ? ` <span class="tag r">perso</span>` : ""}<br><span class="xs muted">${esc(E.musclesOf(n).join(" · "))} · ${esc(E.equipOf(n))}</span></span>${I.chev}</button>`).join("")}</div>`;
  } else if (dbTab === "pat") {
    body = bibliothequeBody();
  } else {
    const libP = E.extra.programs, bank = E.programs().filter(p => !p.custom && !p.lib);
    body = `<button class="btn btn-red btn-sm mt12" data-a="prog-new2" style="width:auto">+ Nouveau programme</button>
      <h2 class="sec">Publiés par toi <small>visibles par tous les membres</small></h2>${libP.length ? libP.map(p => `<div class="card mt8"><b>${esc(p.name)}</b><p class="xs muted mt4">${p.s.length} séances · ${E.weeksOf(p)} semaines</p><div class="row mt8" style="gap:6px"><button class="btn btn-line btn-xs grow" data-a="go" data-r="builder" data-p="lib/${p.lib}">Modifier</button><button class="btn btn-ghost btn-xs" data-a="lib-del" data-id="${p.lib}" style="color:var(--red)">Retirer</button></div></div>`).join("") : `<p class="small muted">Rien pour l'instant. Crée un programme ou publie un des tiens.</p>`}
      ${(S().customPrograms || []).length ? `<h2 class="sec">Mes programmes perso</h2>${S().customPrograms.map(p => `<div class="card mt8 row between"><b class="small grow">${esc(p.name)}</b><button class="btn btn-line btn-xs" data-a="prog-pub" data-id="${p.id}" style="width:auto">📤 Publier</button></div>`).join("")}` : ""}
      <h2 class="sec">La banque <small>${bank.length} programmes</small></h2>${bank.map(p => `<div class="card mt8"><div class="row between"><b class="small grow">${esc(p.name)}</b><span class="tag">${esc(p.lvl || "")}</span></div><p class="xs muted mt4">${p.s.length} séances · ${E.weeksOf(p)} semaines${p.src ? ` · ${esc(p.src)}` : ""}</p><button class="btn btn-line btn-xs mt8" data-a="bd-copy" data-id="${p.id}">Créer une version à partir de celui-ci</button></div>`).join("")}`;
  }
  frame("admin-db", `<h1 class="h1 mt8">Base de données</h1><div class="chips wrap mt8">${[["food", "Aliments"], ["recipe", "Repas & plats"], ["ex", "Exercices & vidéos"], ["pat", "8 patterns"], ["prog", "Programmes"]].map(([k, l]) => `<button class="chip ${dbTab === k ? "on" : ""}" data-a="db-tab" data-v="${k}">${l}</button>`).join("")}</div>${body}`);
  const i = document.getElementById("db-q"); i?.addEventListener("input", () => { dbQ = i.value; clearTimeout(i._t); i._t = setTimeout(() => rerender(), 250); });
  mountBibliotheque();
};
actions["db-tab"] = (b, d) => { dbTab = d.v; dbQ = ""; dbCat = ""; rerender(false); };
actions["db-cat"] = (b, d) => { dbCat = d.v; rerender(); };
actions["db-mus"] = (b, d) => { dbMus = d.v; rerender(); };
async function libAdd(kind, name, data) { const c = await cloud(); try { await c.libraryAdd(kind, name, data); await refreshLibrary(); return true; } catch (e) { toast("Impossible : " + e.message); return false; } }
actions["lib-del"] = async (b, d) => { if (!confirm("Retirer de la bibliothèque des membres ?")) return; const c = await cloud(); try { await c.libraryDel(+d.id); await refreshLibrary(); toast("Retiré"); closeSheet(); rerender(); } catch (e) { toast(e.message); } };
actions["food-new"] = () => sheet(`<h2 class="h2">Nouvel aliment</h2><p class="xs muted">Valeurs pour 100 g, lues sur l'étiquette. Il apparaîtra dans la recherche de tous tes membres.</p><form data-f="food-new" class="mt12">
  <label class="field"><span>Nom</span><input name="n" required maxlength="80" placeholder="Skyr vanille marque X"></label><label class="field mt8"><span>Catégorie</span><input name="cat" value="Ajouts du coach"></label>
  <div class="grid2 mt8"><label class="field"><span>kcal</span><input name="kcal" inputmode="decimal" required></label><label class="field"><span>Protéines (g)</span><input name="p" inputmode="decimal" required></label><label class="field"><span>Glucides (g)</span><input name="c" inputmode="decimal" required></label><label class="field"><span>Lipides (g)</span><input name="f" inputmode="decimal" required></label></div>
  <button class="btn btn-red mt12">Ajouter</button></form>`);
forms["food-new"] = async (v) => { const d = { cat: v.cat.trim() || "Ajouts du coach", kcal: Math.round(num(v.kcal)), p: num(v.p), c: num(v.c), f: num(v.f) }; if ([d.kcal, d.p, d.c, d.f].some(x => isNaN(x))) return toast("Valeurs invalides"); if (await libAdd("food", v.n.trim(), d)) { closeSheet(); toast("Aliment ajouté pour tous"); rerender(); } };
actions["rec-new2"] = () => openRecipeEditor(async (r) => { const { id, ...data } = r; if (await libAdd("recipe", r.n, data)) { closeSheet(); toast("Plat publié pour tous"); rerender(); } });
actions["exo-edit"] = (b, d) => {
  const n = d.n, f = E.ficheOf(n), lib = libraryRows().find(r => r.kind === "exercise" && r.name === n), vid = libraryRows().find(r => r.kind === "video" && r.name === n);
  sheet(`<h2 class="h2" style="color:var(--red)">${esc(n)}</h2><p class="xs muted">${esc(E.musclesOf(n).join(" · "))} · ${esc(E.equipOf(n))}</p>
    ${f?.cues?.length ? `<ul class="small" style="padding-left:18px">${f.cues.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
    <form data-f="exo-video" data-n="${esc(n)}" class="mt12"><label class="field"><span>🎥 Lien de ta vidéo (YouTube, Instagram, Drive…)</span><input name="url" type="url" value="${esc(E.videoOf(n) || "")}" placeholder="https://"></label><button class="btn btn-red btn-sm mt8" style="width:100%">Enregistrer la vidéo</button></form>
    <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="fiche-sheet" data-n="${esc(n)}">Voir la fiche</button>${lib ? `<button class="btn btn-ghost btn-sm" data-a="lib-del" data-id="${lib.id}" style="color:var(--red)">Supprimer l'exercice</button>` : vid ? `<button class="btn btn-ghost btn-sm" data-a="lib-del" data-id="${vid.id}">Retirer la vidéo</button>` : ""}</div>`);
};
forms["exo-video"] = async (v, f) => {
  const n = f.dataset.n, url = v.url.trim(), c = await cloud();
  const lib = libraryRows().find(r => r.kind === "exercise" && r.name === n), vid = libraryRows().find(r => r.kind === "video" && r.name === n);
  try { if (lib) await c.libraryUpdate(lib.id, { data: { ...lib.data, video: url || null } }); else if (vid) url ? await c.libraryUpdate(vid.id, { data: { url } }) : await c.libraryDel(vid.id); else if (url) await c.libraryAdd("video", n, { url }); await refreshLibrary(); closeSheet(); toast(url ? "Vidéo enregistrée : tes membres la voient dans la fiche" : "Vidéo retirée"); rerender(); } catch (e) { toast(e.message); }
};
actions["exo-new2"] = () => sheet(`<h2 class="h2">Nouvel exercice</h2><p class="xs muted">Il rejoint la bibliothèque de tous tes membres.</p><form data-f="exo-new2" class="mt12">
  <label class="field"><span>Nom</span><input name="n" required maxlength="70"></label>
  <div class="grid2 mt8"><label class="field"><span>Muscle principal</span><select name="m1">${E.MUSCLES.map(m => `<option>${m}</option>`).join("")}</select></label><label class="field"><span>Muscle secondaire</span><select name="m2"><option value="">Aucun</option>${E.MUSCLES.map(m => `<option>${m}</option>`).join("")}</select></label></div>
  <div class="grid2 mt8"><label class="field"><span>Matériel</span><select name="eq">${E.EQUIP.map(m => `<option>${m}</option>`).join("")}</select></label><label class="field"><span>Mesuré en</span><select name="unit"><option value="reps">Répétitions</option><option value="s">Secondes</option></select></label></div>
  <label class="field mt8"><span>Installation</span><textarea name="setup" rows="2"></textarea></label><label class="field mt8"><span>Points clés (un par ligne)</span><textarea name="cues" rows="3"></textarea></label>
  <label class="field mt8"><span>🎥 Lien vidéo</span><input name="video" type="url" placeholder="https://"></label>
  <button class="btn btn-red mt12">Ajouter</button></form>`);
forms["exo-new2"] = async (v) => {
  const n = v.n.trim(); if (E.allExercises().some(x => x.toLowerCase() === n.toLowerCase())) return toast("Cet exercice existe déjà");
  const data = { mus: [v.m1, v.m2].filter(Boolean), eq: v.eq, ...(v.unit === "s" ? { unit: "s" } : {}), setup: v.setup.trim(), cues: v.cues.split("\n").map(x => x.trim()).filter(Boolean), video: v.video.trim() || null };
  if (await libAdd("exercise", n, data)) { closeSheet(); toast("Exercice ajouté pour tous"); rerender(); }
};
actions["prog-new2"] = () => { window.__bdPublish = true; go("builder"); };
actions["prog-pub"] = async (b, d) => { const p = S().customPrograms.find(x => x.id === d.id); if (!p) return; const { id, from, ...data } = JSON.parse(JSON.stringify(p)); if (await libAdd("program", p.name, data)) { toast("Programme publié dans la banque des membres"); rerender(); } };

// Acquisition : d'où viennent les inscrits (onboarding) et ce qu'ils cherchent en premier
const SRC = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", friend: "Bouche-à-oreille", gym: "En salle", thomas: "Thomas directement", google: "Google ou App Store", other: "Autre" };
const PRIO = { strength: "Force sans stagner", fat: "Perdre du gras", time: "Peu de temps", regular: "Tenir dans la durée", food: "Savoir quoi manger", coach: "Être coaché" };
const WHO = { student: "Aux études", employee: "Emploi salarié", freelance: "À son compte", parent: "Parent", shift: "Horaires décalés", retired: "À la retraite", other: "Autre" };
function acquisitionCard() {
  const ms = window.__members || []; if (!ms.length) return "";
  const count = (k, map) => { const o = {}; ms.forEach(m => { const v = m.onboarding?.[k]; if (v) o[v] = (o[v] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ l: map[v] || v, v: n })); };
  const src = count("source", SRC), pr = count("priority", PRIO), who = count("who", WHO);
  if (!src.length && !pr.length) return `<div class="card mt12"><b class="h3">📣 Acquisition</b><p class="small muted mt4" style="margin:0">Les nouveaux inscrits répondent à 3 questions (qui, priorité, source) : les résultats s'afficheront ici.</p></div>`;
  return `<div class="card mt12"><b class="h3">📣 Comment ils ont connu l'app</b><div class="mt8">${hbars(src, (v) => String(v))}</div></div>
    <div class="card mt12"><b class="h3">🎯 Ce qu'ils cherchent en premier</b><div class="mt8">${hbars(pr, (v) => String(v))}</div></div>
    ${who.length ? `<div class="card mt12"><b class="h3">👤 Qui ils sont</b><div class="mt8">${hbars(who, (v) => String(v))}</div></div>` : ""}`;
}

// =====================================================================
// REFONTE (21/11/2026) : accueil en un écran, athlètes filtrés, programmes, profil coach
// =====================================================================
const initials = (m) => (first(m).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("") || "?").toUpperCase();
const weekNo = (d) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + 3 - (x.getDay() + 6) % 7); const y = new Date(x.getFullYear(), 0, 4); return 1 + Math.round(((x - y) / 864e5 - 3 + (y.getDay() + 6) % 7) / 7); };
const alertLevel = (m) => { const al = memberAlerts(m); return al.some(a => a.level === "risk") ? 2 : al.some(a => a.level === "watch") ? 1 : 0; };
// Statut d'un athlète pour les filtres : actif (3 derniers jours), en attente (aucune activité), en alerte (décrochage)
function statOk(m, f) {
  const n = daysSince(lastAct(m));
  if (f === "actifs") return n != null && n <= 3;
  if (f === "attente") return n == null || !!(m.onboarding?.application && !A.store.handled[m.id + ":" + m.onboarding.application.at]);
  if (f === "alerte") return alertLevel(m) > 0;
  return true;
}
actions["adm-filt"] = (b, d) => { UI.filt = d.v; rerender(); };
function athletesHead() {
  const all = A.members || [], team = all.filter(isClient), base = team.length ? team : all;
  const actToday = base.filter(m => daysSince(lastAct(m)) === 0).length, al = base.filter(m => alertLevel(m) > 0).length;
  return `<div class="xs muted mt8" style="letter-spacing:.08em;text-transform:uppercase">${fmtDate(today(), { weekday: "short", day: "numeric", month: "short" })} · S${weekNo(today())}</div>
    <h1 class="h1" style="margin:2px 0 0">Mes athlètes,<br><span class="muted" style="font-weight:600">${base.length} au programme</span></h1>
    <div class="kpi3 mt12"><div><b>${base.length}</b><span>${team.length ? "en coaching" : "membres"}</span></div><div><b>${actToday}<small>/${base.length}</small></b><span>actifs aujourd'hui</span></div><div class="${al ? "warn" : ""}"><b>${al}</b><span>en alerte</span></div></div>`;
}
// En-tête de l'accueil : bonjour, semaine en pastilles
function homeHead() {
  const t = today(), d = UI.agDay || t, mon = addDays(t, -E.dowOf(t)), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const name = (S().profile?.name || "Thomas").split(" ")[0];
  return `<div class="xs muted mt8" style="letter-spacing:.08em;text-transform:uppercase">${fmtDate(t, { weekday: "short", day: "numeric", month: "short" })} · S${weekNo(t)}</div>
    <h1 class="h1" style="margin:2px 0 0">Bonjour ${esc(name)},<br><span class="muted" style="font-weight:600">on coache ?</span></h1>
    <div class="wk7 mt12">${days.map((k, i) => { const n = agendaRows(k).length; return `<button class="${k === d ? "on" : ""} ${k === t ? "today" : ""}" data-a="adm-agday" data-v="${k}"><small>${["L", "M", "M", "J", "V", "S", "D"][i]}</small><b>${Number(k.slice(8))}</b><i>${n ? "•" : ""}</i></button>`; }).join("")}</div>`;
}
function kpiBlock() {
  const all = A.members || [], base = all.filter(isClient).length ? all.filter(isClient) : all;
  const act = base.filter(m => { const n = daysSince(lastAct(m)); return n != null && n <= 7; }).length;
  const rows = agendaRows(today()), done = rows.filter(r => r.a.st === "done").length;
  return `<div class="kpi3 mt12"><div><b>${act}</b><span>athlètes actifs (7 j)</span></div><div><b>${done}<small>/${rows.length}</small></b><span>séances faites</span></div><div><b>${LIVE_LIST.length}</b><span>en cours</span></div></div>`;
}
// Notifications et alertes : chacune se ferme d'un ×, et ne revient que si elle change (ou après 7 jours)
const alertKey = (e, t) => (e + " " + t).slice(0, 160);
function alertsBlock() {
  const t = today(), dis = A.store.dismiss || {};
  const l = todoToday().filter(([e, tx]) => { const k = alertKey(e, tx); return !dis[k] || dis[k] < addDays(t, -7); });
  return `<div class="row between mt16"><b class="lbl" style="margin:0">Notifs & alertes</b><span class="xs muted">${l.length || "rien"} à traiter</span></div>
    ${l.length ? `<div class="card mt4" style="padding:4px 8px">${l.map(([e, tx, r]) => `<div class="li" style="gap:8px"><span class="em">${e}</span><button class="grow small" style="text-align:left" data-a="adm-go" data-r="${esc(r)}">${esc(tx)}</button><button class="icon-btn sm" data-a="adm-dismiss" data-k="${esc(alertKey(e, tx))}" aria-label="Fermer l'alerte">${I.close}</button></div>`).join("")}</div>`
    : `<div class="card mt4"><p class="small" style="margin:0">✅ Tout est traité pour aujourd'hui.</p></div>`}`;
}
actions["adm-dismiss"] = async (b, d) => { A.store.dismiss = A.store.dismiss || {}; A.store.dismiss[d.k] = today(); Object.keys(A.store.dismiss).forEach(k => { if (A.store.dismiss[k] < addDays(today(), -30)) delete A.store.dismiss[k]; }); rerender(); await saveStore("dismiss"); };
// Athlètes du jour : qui s'entraîne, à quelle heure, où il en est
function dayAthletes() {
  const d = UI.agDay || today(), rows = agendaRows(d);
  if (!rows.length) return "";
  const tag = (r) => { const [l, c] = stLbl(r); return `<span class="tag st-${c}">${l}</span>`; };
  return `<div class="row between mt16"><b class="lbl" style="margin:0">Athlètes ${d === today() ? "du jour" : "du " + fmtDate(d, { weekday: "long", day: "numeric" })}</b><span class="xs muted">${rows.filter(r => r.a.st === "done").length}/${rows.length} séances faites</span></div>
    <div class="card mt4" style="padding:4px 8px">${rows.map(r => `<button class="li" style="gap:10px;width:100%;text-align:left" ${r.ip ? `data-a="go" data-r="live" data-p="${r.m.id}"` : `data-a="go" data-r="member" data-p="${r.m.id}"`}><span class="ava">${esc(initials(r.m))}</span><span class="grow small"><b>${esc(r.name)}</b><br><span class="xs muted">${r.a.time || "heure libre"} · ${esc(r.a.title || "Séance")}</span></span>${tag(r)}</button>`).join("")}</div>`;
}
// Mon agenda : rendez-vous du coach (visio, séance, cours collectif, 1-to-1, évaluation…)
const EV_TYPES = [["visio", "Visio", "#2F6F8F"], ["seance", "Séance", "#22A45D"], ["cours", "Cours collectif", "#E5484D"], ["presentiel", "1-to-1 présentiel", "#3557C9"], ["eval", "Évaluation", "#8F3510"], ["autre", "Autre", "#6E5A4E"]];
const evType = (k) => EV_TYPES.find(x => x[0] === k) || EV_TYPES.at(-1);
function eventsBlock() {
  const d = UI.agDay || today(), l = (A.store.events || []).filter(e => e.d === d).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  return `<div class="row between mt16"><b class="lbl" style="margin:0">Mon agenda · ${d === today() ? "aujourd'hui" : fmtDate(d, { weekday: "long", day: "numeric" })}</b><button class="link xs" data-a="ev-new" data-d="${d}">+ Rendez-vous</button></div>
    ${l.length ? `<div class="card mt4" style="padding:4px 8px">${l.map(e => { const [, lab, col] = evType(e.type), m = (A.members || []).find(x => x.id === e.member); return `<div class="li" style="gap:10px"><span style="width:4px;align-self:stretch;border-radius:2px;background:${col}"></span><span style="min-width:46px"><b class="small">${esc(e.time || "–")}</b><br><span class="xs muted">${e.dur ? e.dur + " min" : ""}</span></span><span class="grow small"><b>${esc(e.title || lab)}</b><br><span class="xs muted">${m ? esc(first(m)) + " · " : ""}<span style="color:${col}">${lab}</span></span></span><button class="icon-btn sm" data-a="ev-del" data-id="${e.id}" aria-label="Supprimer le rendez-vous">${I.close}</button></div>`; }).join("")}</div>`
    : `<p class="xs muted mt4">Aucun rendez-vous. Ajoute tes visios, bilans et cours ici.</p>`}`;
}
actions["ev-new"] = (b, d) => {
  const day = d.d || UI.agDay || today();
  sheet(`<h2 class="h2">📅 Nouveau rendez-vous</h2><form data-f="ev-new" class="mt12"><label class="field"><span>Titre</span><input name="title" maxlength="80" placeholder="Visio bilan, cours renfo…" required></label>
    <div class="grid2 mt8"><label class="field"><span>Jour</span><input type="date" name="d" value="${day}" required></label><label class="field"><span>Heure</span><input type="time" name="time" required></label></div>
    <div class="grid2 mt8"><label class="field"><span>Durée</span><select name="dur">${[15, 30, 45, 60, 75, 90, 120].map(x => `<option value="${x}" ${x === 60 ? "selected" : ""}>${x} min</option>`).join("")}</select></label><label class="field"><span>Type</span><select name="type">${EV_TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label></div>
    <label class="field mt8"><span>Athlète (facultatif)</span><select name="member"><option value="">–</option>${(A.members || []).map(m => `<option value="${m.id}">${esc(first(m))}</option>`).join("")}</select></label>
    <button class="btn btn-red mt12">Ajouter</button></form>`);
};
forms["ev-new"] = async (v) => { A.store.events = [...(A.store.events || []).filter(e => e.d >= addDays(today(), -60)), { id: Date.now(), d: v.d, time: v.time, dur: +v.dur || null, type: v.type, title: v.title.trim(), member: v.member || null }]; UI.agDay = v.d === today() ? null : v.d; closeSheet(); toast("Rendez-vous ajouté"); rerender(); await saveStore("events"); };
actions["ev-del"] = async (b, d) => { if (!confirm("Supprimer ce rendez-vous ?")) return; A.store.events = (A.store.events || []).filter(e => e.id !== +d.id); rerender(); await saveStore("events"); };
// Bouton + : les gestes les plus fréquents, depuis n'importe quel écran du coach
const fabBtn = () => `<button class="fab" data-a="adm-fab" aria-label="Ajouter">${I.plus}</button>`;
actions["adm-fab"] = () => sheet(`<h2 class="h2">Ajouter</h2><div class="list mt12">
  <button class="li" data-a="ev-new"><span class="em">📅</span><span class="grow"><b>Un rendez-vous</b><br><span class="xs muted">Visio, séance, cours, évaluation</span></span>${I.chev}</button>
  <button class="li" data-a="adm-new"><span class="em">➕</span><span class="grow"><b>Un athlète</b><br><span class="xs muted">Lien d'invitation à partager</span></span>${I.chev}</button>
  <button class="li" data-a="fab-todo"><span class="em">📋</span><span class="grow"><b>Une tâche</b><br><span class="xs muted">Dans ta to-do</span></span>${I.chev}</button>
  <button class="li" data-a="fab-bulk"><span class="em">📣</span><span class="grow"><b>Un message à plusieurs athlètes</b></span>${I.chev}</button>
  <button class="li" data-a="go" data-r="admin-prog"><span class="em">🗂️</span><span class="grow"><b>Un programme à assigner</b></span>${I.chev}</button></div>`);
actions["fab-todo"] = () => sheet(`<h2 class="h2">📋 Nouvelle tâche</h2><form data-f="adm-todo" class="mt12"><label class="field"><span>Tâche</span><input name="t" required maxlength="140"></label><label class="field mt8"><span>Pour le</span><input type="date" name="due" value="${today()}"></label><button class="btn btn-red mt12">Ajouter</button></form>`);
actions["fab-bulk"] = () => { closeSheet(); UI.open.bulk = true; go("admin"); setTimeout(() => document.querySelector('[data-fold="bulk"]')?.scrollIntoView({ block: "start" }), 400); };

// ---------- Programmes : modèles prêts à assigner ----------
let PQ = "", PTAB = "sport", TAGF = "";
const progOf = (r) => r.data?.s ? r.data : r.data?.program || r.data;
routes["admin-prog"] = async () => {
  if (!(await guard("admin-prog"))) return;
  await Promise.all([E.loadPrograms(), refreshLibrary().catch(() => { })]);
  const q = N.norm(PQ);
  let body;
  if (PTAB === "diete") {
    const plans = LIB("plan").filter(r => !q || N.norm(r.name).includes(q));
    body = `<button class="card tap grad mt12" data-a="go" data-r="admin" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:26px">＋</span><span class="grow"><b>Nouveau plan diète</b><br><span class="small" style="opacity:.85">Depuis la fiche d'un athlète : « Plan alimentaire »</span></span></button>
      <div class="row between mt16"><b class="lbl" style="margin:0">Plans envoyés</b><span class="xs muted">${plans.length}</span></div>
      ${plans.length ? plans.map(r => { const k = (r.data?.meals || []).flatMap(m => m.items || []).reduce((a, x) => a + (x.kcal || 0), 0), m = (A.members || []).find(x => x.id === r.data?.for); return `<div class="card mt8"><b class="small">${esc(r.name)}</b><div class="xs muted mt4">${fr(k)} kcal · ${(r.data?.meals || []).length} repas${m ? " · pour " + esc(first(m)) : ""}</div><button class="btn btn-line btn-sm mt8" style="width:100%" data-a="plan-assign" data-id="${r.id}">Assigner à un athlète</button></div>`; }).join("") : `<p class="empty small">Tes plans alimentaires envoyés apparaîtront ici, réutilisables.</p>`}`;
  } else {
    const tagOk = (id) => !TAGF || tagsOf(id).includes(TAGF);
    const mine = LIB("program").filter(r => (!q || N.norm(r.name).includes(q)) && tagOk((E.extra.programs.find(x => x.lib === r.id) || {}).id || "lib:" + r.id));
    const bank = E.programs().filter(p => !p.custom && !p.lib && (!q || N.norm(p.name + " " + (p.cat || "")).includes(q)) && tagOk(p.id)).slice(0, q || TAGF ? 40 : 10);
    const allTags = [...new Set(Object.values(A.store.tags || {}).flat())].sort((a, b) => a.localeCompare(b, "fr"));
    const seances = (A.store.seances || []).filter(x => !q || N.norm(x.name).includes(q));
    const card = (p, id, libId) => { const w = E.weeksOf(p) || p.weeks || 0, n = p.s?.length || 0; return `<div class="card mt8"><div class="row" style="gap:12px;align-items:center"><div style="text-align:center;min-width:42px"><b class="num" style="font-size:24px;color:var(--good,#22A45D)">${w || "–"}</b><div class="xs muted">sem.</div></div><div class="grow" style="min-width:0"><b class="small">${esc(p.name)}</b><div class="xs muted mt4">${n} séance${n > 1 ? "s" : ""} · ${p.days?.filter?.(Boolean).length || n}/sem.${p.cat ? " · " + esc(p.cat) : ""}</div>${tagsOf(id).length ? `<div class="mt4">${tagsOf(id).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}</div><button class="icon-btn sm" data-a="tag-edit" data-id="${esc(id)}" aria-label="Étiquettes">🏷️</button></div>
      <div class="row mt8" style="gap:8px"><button class="btn btn-red btn-sm grow" data-a="prog-assign" data-id="${esc(id)}">Assigner à un athlète</button>${libId ? `<button class="btn btn-line btn-sm" style="width:auto" data-a="go" data-r="builder" data-p="lib/${libId}">Modifier</button>` : ""}</div></div>`; };
    body = `<button class="card tap grad mt12" data-a="go" data-r="builder" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:26px">＋</span><span class="grow"><b>Nouveau programme</b><br><span class="small" style="opacity:.85">Séances, exercices, cycles : tu composes</span></span></button>
      ${allTags.length ? `<div class="mt12">${chips([["", "Toutes"], ...allTags.map(t => [t, esc(t)])], TAGF, "tag-filter")}</div>` : ""}
      <div class="row between mt16"><b class="lbl" style="margin:0">Mes modèles</b><span class="xs muted">${mine.length}</span></div>
      ${mine.length ? mine.map(r => { const p = E.extra.programs.find(x => x.lib === r.id) || progOf(r); return p?.s ? card(p, p.id || "lib:" + r.id, r.id) : ""; }).join("") : `<p class="xs muted mt4">Crée un programme avec « Nouveau programme » : il sera réutilisable pour tous tes athlètes.</p>`}
      <div class="row between mt16"><b class="lbl" style="margin:0">Mes séances modèles</b><span class="xs muted">${seances.length}</span></div>
      ${seances.length ? `<div class="card mt4" style="padding:4px 8px">${seances.map(x => `<div class="li" style="gap:8px"><span class="grow small"><b>${esc(x.name)}</b><br><span class="xs muted">${x.rows.length} exercice${x.rows.length > 1 ? "s" : ""} · ${esc(x.rows.slice(0, 3).map(r => r[0]).join(", "))}${x.rows.length > 3 ? "…" : ""}</span></span><button class="icon-btn sm" data-a="seance-del" data-id="${x.id}" aria-label="Supprimer le modèle">${I.close}</button></div>`).join("")}</div>` : `<p class="xs muted mt4">Dans l'éditeur de programme, « 💾 Modèle » sur une séance la range ici ; « + Séance depuis un modèle » la réutilise.</p>`}
      <div class="row between mt16"><b class="lbl" style="margin:0">La banque</b><span class="xs muted">${E.programs().filter(p => !p.custom && !p.lib).length} programmes</span></div>
      ${bank.map(p => card(p, p.id)).join("")}`;
  }
  frame("admin-prog", `<div class="xs muted mt8" style="letter-spacing:.08em;text-transform:uppercase">Bibliothèque</div><h1 class="h1" style="margin:2px 0 0">Programmes,<br><span class="muted" style="font-weight:600">prêts à assigner.</span></h1>
    <div class="mt12">${seg([["sport", "🏋️ Sport"], ["diete", "🍽️ Diète"]], PTAB, "prog-tab")}</div>
    <div class="search mt8">${I.search}<input id="pq" placeholder="Rechercher un programme…" value="${esc(PQ)}" autocomplete="off"></div>${body}${fabBtn()}`, "Programmes");
  const i = document.getElementById("pq"); i?.addEventListener("change", () => { PQ = i.value; rerender(); });
};
actions["prog-tab"] = (b, d) => { PTAB = d.v; rerender(); };
// Étiquettes des programmes (Force, Débutant, Perte de poids…) : rangées dans l'espace coach, filtrables
const tagsOf = (id) => (A.store?.tags || {})[id] || [];
actions["tag-filter"] = (b, d) => { TAGF = d.v; rerender(); };
actions["tag-edit"] = (b, d) => {
  const all = [...new Set([...Object.values(A.store.tags || {}).flat(), "Force", "Hypertrophie", "Perte de poids", "Débutant", "Reprise", "Hybride"])].sort((a, b) => a.localeCompare(b, "fr"));
  sheet(`<h2 class="h2">🏷️ Étiquettes</h2><form data-f="tag-save" class="mt12"><input type="hidden" name="id" value="${esc(d.id)}">
    <div class="chips wrap">${all.map(t => `<label class="chip ${tagsOf(d.id).includes(t) ? "on" : ""}"><input type="checkbox" name="t" value="${esc(t)}" ${tagsOf(d.id).includes(t) ? "checked" : ""} style="display:none" onchange="this.parentNode.classList.toggle('on',this.checked)">${esc(t)}</label>`).join("")}</div>
    <label class="field mt12"><span>Nouvelle étiquette</span><input name="nw" maxlength="24" placeholder="Ex. Prépa compétition"></label>
    <button class="btn btn-red mt12">Enregistrer</button></form>`);
};
forms["tag-save"] = async (v) => {
  const f = document.querySelector('form[data-f="tag-save"]'), list = [...f.querySelectorAll('input[name="t"]:checked')].map(x => x.value);
  if ((v.nw || "").trim()) list.push(v.nw.trim());
  A.store.tags = { ...(A.store.tags || {}) }; if (list.length) A.store.tags[v.id] = [...new Set(list)]; else delete A.store.tags[v.id];
  await saveStore("tags"); closeSheet(); rerender();
};
actions["seance-del"] = async (b, d) => { if (!confirm("Supprimer ce modèle de séance ?")) return; A.store.seances = (A.store.seances || []).filter(x => x.id !== +d.id); await saveStore("seances"); rerender(); };
const pickMember = (title, act, id) => sheet(`<h2 class="h2">${esc(title)}</h2><p class="xs muted">Choisis l'athlète : tu pourras encore tout ajuster avant d'envoyer.</p><div class="list mt12">${(A.members || []).filter(isClient).concat((A.members || []).filter(m => !isClient(m))).map(m => `<button class="li" data-a="${act}" data-id="${esc(id)}" data-m="${m.id}"><span class="ava">${esc(initials(m))}</span><span class="grow"><b class="small">${esc(first(m))}</b><br><span class="xs muted">${esc(offer(m.tier).name)}</span></span>${I.chev}</button>`).join("")}</div>`);
actions["prog-assign"] = (b, d) => pickMember("Assigner ce programme", "prog-assign-go", d.id);
actions["prog-assign-go"] = async (b, d) => {
  const { openProgramEditor } = await import("./coachprog.js");
  const p = d.id.startsWith("lib:") ? progOf(libraryRows().find(r => r.id === +d.id.slice(4))) : E.program(d.id); if (!p) return toast("Programme introuvable");
  window.__members = window.__members || A.members; closeSheet(); openProgramEditor(d.m, JSON.parse(JSON.stringify(p)));
};
actions["plan-assign"] = (b, d) => pickMember("Assigner ce plan", "plan-assign-go", String(d.id));
actions["plan-assign-go"] = async (b, d) => {
  const r = libraryRows().find(x => x.id === +d.id), m = (A.members || []).find(x => x.id === d.m); if (!r || !m) return;
  try { const c = await cloud(); await c.libraryAdd("plan", `Plan alimentaire · ${m.name || "client"}`, { ...r.data, for: m.id }); await c.notify("🍽️ Ton plan alimentaire", "Thomas t'a envoyé ton plan. Ouvre l'onglet Coaching pour l'appliquer.", m.id).catch(() => { }); await refreshLibrary(); closeSheet(); toast(`Plan envoyé à ${first(m)}`); }
  catch (e) { toast("Envoi impossible : " + e.message); }
};

// ---------- Profil coach : ton espace et les outils d'administration ----------
routes["admin-profile"] = async () => {
  if (!(await guard("admin-profile"))) return;
  const p = S().profile || {}, all = A.members || [], team = all.filter(isClient);
  const tile = (r, ic, l, sub) => `<button class="tile" data-a="go" data-r="${r}"><span class="tile-ic">${ic}</span><span><b>${l}</b><br><span class="xs muted">${sub}</span></span></button>`;
  frame("admin-profile", `<div class="card grad mt12"><div class="xs" style="opacity:.8;letter-spacing:.08em;text-transform:uppercase">Coach</div><div class="row mt8" style="gap:14px;align-items:center"><span class="ava big">${esc(((p.name || "T B").split(" ").map(x => x[0]).join("") || "TB").slice(0, 2).toUpperCase())}</span><div><b class="h2">${esc(p.name || "Thomas Boulet")}</b><div class="small" style="opacity:.9">${team.length} athlète${team.length > 1 ? "s" : ""} en coaching · ${all.length} membres</div></div></div></div>
    <h2 class="sec">Pilotage</h2>
    <div class="tiles">${tile("admin-biz", "📈", "Mon activité", "Offres, encaissements, factures, retards")}${tile("admin-subs", "⭐", "Abonnés", "Formules et abonnements")}${tile("admin-db", "🗄️", "Base de données", "Aliments, recettes, exercices")}${tile("admin-reseau", "📣", "Réseau privé", "Annonces, sondages, défis, absence")}${tile("admin-social", "🏟️", "Communauté", "Modération, parrainage")}</div>
    <h2 class="sec">Mon compte</h2>
    <div class="list">${[["settings", "⚙️", "Réglages"], ["kb", "📘", "Méthode & théorie"], ["account", "👤", "Mon compte"]].map(([r, e, l]) => `<button class="li" data-a="go" data-r="${r}"><span class="em">${e}</span><span class="grow">${l}</span>${I.chev}</button>`).join("")}
      <a class="li" href="./"><span class="em">🏋️</span><span class="grow">Mon espace athlète<br><span class="xs muted">Ton propre suivi, séparé de ton espace coach</span></span>${I.chev}</a></div>`, "Profil");
};

// ---------- Athlète préparé avant son inscription (code coach) ----------
function invitesBlock() {
  const l = (A.invites || []).filter(x => !x.used_by); if (!l.length) return "";
  return `<div class="row between mt12"><b class="lbl" style="margin:0">🔑 Préparés, pas encore inscrits</b><span class="xs muted">${l.length}</span></div>
    <div class="card mt4" style="padding:4px 8px">${l.map(x => `<div class="li" style="gap:8px"><span class="grow small"><b>${esc(x.name || x.email || x.code)}</b><br><span class="xs muted">${esc(x.code)}${x.tier ? " · " + esc(offer(x.tier).name) : ""}${x.program ? " · programme prêt" : ""} · créé ${ago(x.created_at)}</span></span><button class="icon-btn sm" data-a="inv-share" data-code="${esc(x.code)}" aria-label="Partager">📤</button><button class="icon-btn sm" data-a="inv-del" data-code="${esc(x.code)}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>`;
}
const invLink = (code) => location.origin + location.pathname.replace(/coach\.html$/, "") + "?coach=" + code;
actions["inv-new"] = async () => {
  await E.loadPrograms(); await refreshLibrary().catch(() => { });
  const progs = [...LIB("program").map(r => ["lib:" + r.id, r.name]), ...E.programs().filter(p => !p.custom && !p.lib).slice(0, 60).map(p => [p.id, String(p.name).split("·")[0].trim()])];
  sheet(`<h2 class="h2">🔑 Préparer un athlète</h2><form data-f="inv-new" class="mt12">
    <div class="grid2"><label class="field"><span>Prénom et nom</span><input name="name" maxlength="60" required></label><label class="field"><span>E-mail (facultatif)</span><input name="email" type="email" maxlength="120"></label></div>
    <div class="grid2 mt8"><label class="field"><span>Formule</span><select name="tier"><option value="">À choisir plus tard</option>${assignable().filter(o => o.rank >= 1).map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select></label><label class="field"><span>Jusqu'au (facultatif)</span><input type="date" name="until" min="${today()}"></label></div>
    <label class="field mt8"><span>Programme prêt (facultatif)</span><select name="prog"><option value="">Aucun pour l'instant</option>${progs.map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")}</select></label>
    <label class="li mt8" style="padding:6px 0"><span class="grow small">Bilan chaque dimanche dès son arrivée</span><input type="checkbox" name="bilan" checked></label>
    <label class="field mt8"><span>Note pour toi</span><input name="note" maxlength="200" placeholder="Ex. rencontré au club, reprise après blessure"></label>
    <button class="btn btn-red mt12">Créer son code</button></form>`);
};
forms["inv-new"] = async (v) => {
  const code = RS.codeInvitation();
  let program = null;
  if (v.prog) { program = v.prog.startsWith("lib:") ? progOf(libraryRows().find(r => r.id === +v.prog.slice(4))) : E.program(v.prog); program = program ? JSON.parse(JSON.stringify(program)) : null; if (program) { program.custom = true; program.id = "coach-" + Date.now(); } }
  const row = { code, name: v.name.trim(), email: (v.email || "").trim().toLowerCase() || null, tier: v.tier || null, tier_until: v.until || null, program, settings: v.bilan ? { bilan: { on: true, dow: 6, every: 1, from: today(), questions: [], digest: false } } : null, note: (v.note || "").trim() || null };
  try { const c = await cloud(); await c.inviteSave(row); A.invites = [row, ...(A.invites || [])]; closeSheet(); invShareSheet(row); }
  catch (e) { toast("Création impossible : " + e.message); }
};
function invShareSheet(x) {
  const txt = `${String(x.name || "").split(" ")[0] || "Salut"}, ton espace TB my Coach est prêt${x.program ? " avec ton programme" : ""}. Ouvre ce lien et crée ton compte : tout sera là. Ton code : ${x.code}\n${invLink(x.code)}`;
  sheet(`<h2 class="h2">✅ Espace prêt</h2><div class="card soft mt12 center"><div class="xs muted">Code</div><b class="num" style="font-size:30px;letter-spacing:.08em">${esc(x.code)}</b></div><div class="card mt8"><p class="small" style="margin:0;white-space:pre-wrap">${esc(txt)}</p></div>
    <div class="row mt12" style="gap:8px"><button class="btn btn-red grow" data-a="adm-share" data-t="${esc(txt)}">Partager</button><button class="btn btn-line grow" data-a="adm-copy" data-t="${esc(txt)}">Copier</button></div>`);
  rerender();
}
actions["inv-share"] = (b, d) => { const x = (A.invites || []).find(i => i.code === d.code); if (x) invShareSheet(x); };
actions["inv-del"] = async (b, d) => { if (!confirm("Supprimer cette invitation ?")) return; try { const c = await cloud(); await c.inviteDel(d.code); A.invites = (A.invites || []).filter(i => i.code !== d.code); rerender(); } catch (e) { toast("Impossible : " + e.message); } };

// ---------- Mon activité : offres et factures ----------
function offresBody() {
  const O = B().offers || [];
  return `<button class="btn btn-red btn-sm mt12" data-a="off-new" style="width:100%">+ Nouvelle offre</button>
    ${FA.TYPES_OFFRE.map(([k, l]) => { const l2 = O.filter(o => o.type === k); return l2.length ? `<h2 class="sec">${l}</h2><div class="card" style="padding:4px 12px">${l2.map(o => `<button class="li" data-a="off-edit" data-id="${o.id}" style="width:100%"><span class="grow small"><b>${esc(o.nom)}</b>${o.detail ? `<br><span class="xs muted">${esc(o.detail)}</span>` : ""}</span><b class="small">${eur(o.prix)}<span class="xs muted"> ${esc(o.unite || "")}</span></b></button>`).join("")}</div>` : ""; }).join("") || `<p class="empty small">Tes tarifs : séance à l'unité, carnet, accompagnement, présentiel, distanciel. Ils pré-remplissent tes encaissements et tes factures.</p>`}`;
}
const offSheet = (o = {}) => sheet(`<h2 class="h2">${o.id ? "Modifier l'offre" : "Nouvelle offre"}</h2><form data-f="off" data-id="${o.id || ""}" class="mt12">
  <label class="field"><span>Nom</span><input name="nom" required maxlength="80" value="${esc(o.nom || "")}" placeholder="Séance en salle 1 h"></label>
  <div class="grid2 mt8"><label class="field"><span>Type</span><select name="type">${FA.TYPES_OFFRE.map(([k, l]) => `<option value="${k}" ${o.type === k ? "selected" : ""}>${l}</option>`).join("")}</select></label><label class="field"><span>Prix (€)</span><input name="prix" inputmode="decimal" required value="${o.prix != null ? String(o.prix).replace(".", ",") : ""}"></label></div>
  <label class="field mt8"><span>Unité</span><select name="unite">${FA.UNITES.map(u => `<option value="${u}" ${o.unite === u ? "selected" : ""}>${u || "—"}</option>`).join("")}</select></label>
  <label class="field mt8"><span>Détail (facultatif)</span><textarea name="detail" rows="2" maxlength="300">${esc(o.detail || "")}</textarea></label>
  <button class="btn btn-red mt12">Enregistrer</button>${o.id ? `<button type="button" class="btn btn-ghost mt8" data-a="off-del" data-id="${o.id}">Supprimer</button>` : ""}</form>`);
actions["off-new"] = () => offSheet();
actions["off-edit"] = (b, d) => offSheet((B().offers || []).find(o => o.id === +d.id));
forms.off = async (v, f) => { const prix = num(v.prix); if (!(prix >= 0)) return toast("Prix invalide"); const o = { id: +f.dataset.id || Date.now(), nom: v.nom.trim(), type: v.type, prix, unite: v.unite, detail: v.detail.trim() }; const O = B().offers = B().offers || [], i = O.findIndex(x => x.id === o.id); if (i >= 0) O[i] = o; else O.push(o); closeSheet(); rerender(); await saveStore("biz"); };
actions["off-del"] = async (b, d) => { if (!confirm("Supprimer cette offre ?")) return; B().offers = (B().offers || []).filter(o => o.id !== +d.id); closeSheet(); rerender(); await saveStore("biz"); };
changes["pay-off"] = (el) => { const o = (B().offers || []).find(x => x.id === +el.value); const f = el.closest("form"); if (!o || !f) return; f.elements.amount.value = String(o.prix).replace(".", ","); if (!f.elements.label.value) f.elements.label.value = o.nom; };
actions["pay-relance"] = async (b, d) => {
  const p = B().payments.find(x => x.id === +d.id); if (!p?.mid) return;
  if (!confirm(`Envoyer un rappel de paiement à ${p.who} dans la conversation ?`)) return;
  try { const c = await cloud(); await c.send(`Petit rappel 🙂 : le paiement de ${eur(p.amount)}${p.label ? ` (${p.label})` : ""} prévu le ${fmtDate(p.d, { day: "numeric", month: "long" })} n'est pas encore arrivé. Tu me dis si tout va bien ?`, p.mid); p.relance = today(); await saveStore("biz"); toast("Rappel envoyé"); rerender(); } catch (e) { toast("Envoi impossible : " + e.message); }
};
function facturesBody() {
  const F = (B().invoices || []).slice().sort((a, b) => b.num.localeCompare(a.num)), t = today();
  const du = F.filter(f => !f.payeLe).reduce((a, f) => a + FA.totalLignes(f.lignes), 0), ret = F.filter(f => FA.statut(f, t).k === "retard");
  return `<div class="kpis mt12"><div class="kpi"><b>${F.length}</b><span>factures</span></div><div class="kpi"><b>${eur(du)}</b><span>à encaisser</span></div><div class="kpi"><b>${ret.length}</b><span>en retard</span></div></div>
    <button class="btn btn-red btn-sm mt12" data-a="fac-new" style="width:100%">+ Nouvelle facture</button>
    ${!B().settings.siret ? `<p class="xs mt8" style="color:var(--warn)">Ajoute ton SIRET et ton adresse dans Réglages : ils sont obligatoires sur tes factures.</p>` : ""}
    <div class="card mt12" style="padding:4px 12px">${F.map(f => { const st = FA.statut(f, t); return `<div class="li" style="gap:8px"><button class="grow" style="text-align:left" data-a="fac-edit" data-id="${f.id}"><b class="small">${esc(f.num)} · ${esc(f.client)}</b><br><span class="xs ${st.k === "retard" ? "red" : "muted"}">${fmtDate(f.d, { day: "numeric", month: "short" })} · ${st.l}${st.k === "retard" ? ` depuis ${FA.joursRetard(f, t)} j` : f.payeLe ? ` le ${fmtDate(f.payeLe, { day: "numeric", month: "short" })}` : f.echeance ? ` avant le ${fmtDate(f.echeance, { day: "numeric", month: "short" })}` : ""}</span></button><b class="small">${eur(FA.totalLignes(f.lignes))}</b><button class="icon-btn sm" data-a="fac-print" data-id="${f.id}" aria-label="Voir et imprimer">🖨️</button></div>`; }).join("") || `<p class="empty small">Aucune facture. Crée-en une, ou touche 🧾 sur un encaissement.</p>`}</div>
    <p class="xs muted mt8">Numérotation continue par année. Mention « TVA non applicable, art. 293 B du CGI » ajoutée automatiquement. Je ne suis pas expert-comptable : fais valider ton modèle si tu as un doute.</p>`;
}
function facSheet(f) {
  const l = f.lignes?.length ? f.lignes : [{ label: "", qte: 1, pu: "" }];
  sheet(`<h2 class="h2">Facture ${esc(f.num)}</h2><form data-f="fac" data-id="${f.id}" class="mt12">
    <div class="grid2"><label class="field"><span>Client</span><input name="client" required value="${esc(f.client || "")}"></label><label class="field"><span>Date</span><input type="date" name="d" value="${f.d}"></label></div>
    <label class="field mt8"><span>Adresse du client (facultatif)</span><textarea name="adresse" rows="2">${esc(f.adresse || "")}</textarea></label>
    <div class="lbl mt12">Lignes</div>${l.map((x, i) => `<div class="grid3 mt4" style="grid-template-columns:2fr .7fr 1fr"><input name="l${i}" value="${esc(x.label)}" placeholder="Désignation"><input name="q${i}" inputmode="decimal" value="${x.qte}"><input name="p${i}" inputmode="decimal" value="${String(x.pu).replace(".", ",")}" placeholder="Prix €"></div>`).join("")}
    <input type="hidden" name="n" value="${l.length}"><button type="button" class="link xs mt4" data-a="fac-line">+ Ligne</button>
    <div class="grid2 mt8"><label class="field"><span>Échéance</span><input type="date" name="echeance" value="${f.echeance || ""}"></label><label class="field"><span>Payée le</span><input type="date" name="payeLe" value="${f.payeLe || ""}"></label></div>
    <label class="field mt8"><span>Moyen de paiement (si payée)</span><input name="moyen" value="${esc(f.moyen || "")}" placeholder="virement, carte, espèces"></label>
    <button class="btn btn-red mt12">Enregistrer</button><button type="button" class="btn btn-line mt8" data-a="fac-print" data-id="${f.id}">🖨️ Voir et imprimer (PDF)</button></form>`, null, { keep: !!document.getElementById("sheet") });
}
let FDRAFT = null;
const nouvelle = (extra = {}) => { const t = today(), s = B().settings; return { id: Date.now(), num: FA.numeroSuivant(B().invoices || [], t.slice(0, 4)), d: t, echeance: addDays(t, s.delai ?? 15), lignes: [], ...extra }; };
actions["fac-new"] = () => { FDRAFT = nouvelle(); facSheet(FDRAFT); };
actions["fac-edit"] = (b, d) => { FDRAFT = JSON.parse(JSON.stringify((B().invoices || []).find(f => f.id === +d.id))); facSheet(FDRAFT); };
actions["fac-from-pay"] = (b, d) => {
  const p = B().payments.find(x => x.id === +d.id); if (!p) return;
  const ex = (B().invoices || []).find(f => f.payId === p.id); if (ex) { FDRAFT = JSON.parse(JSON.stringify(ex)); return facSheet(FDRAFT); }
  FDRAFT = nouvelle({ payId: p.id, client: p.who, lignes: [{ label: p.label || "Coaching sportif", qte: 1, pu: p.amount }], ...(p.paid ? { payeLe: p.d } : { echeance: p.d }) }); facSheet(FDRAFT);
};
const lireFac = () => { const f = document.querySelector('form[data-f="fac"]'); if (!f || !FDRAFT) return; const v = Object.fromEntries(new FormData(f)); const n = +v.n;
  Object.assign(FDRAFT, { client: v.client.trim(), d: v.d, adresse: v.adresse.trim(), echeance: v.echeance || null, payeLe: v.payeLe || null, moyen: v.moyen.trim(), lignes: Array.from({ length: n }, (_, i) => ({ label: (v["l" + i] || "").trim(), qte: num(v["q" + i]) || 0, pu: num(v["p" + i]) || 0 })).filter(x => x.label || x.pu) }); };
actions["fac-line"] = () => { lireFac(); FDRAFT.lignes.push({ label: "", qte: 1, pu: "" }); facSheet(FDRAFT); };
forms.fac = async () => {
  lireFac(); if (!FDRAFT.lignes.length) return toast("Ajoute au moins une ligne");
  const I2 = B().invoices = B().invoices || [], i = I2.findIndex(f => f.id === FDRAFT.id); if (i >= 0) I2[i] = FDRAFT; else I2.push(FDRAFT);
  if (FDRAFT.payId && FDRAFT.payeLe) { const p = B().payments.find(x => x.id === FDRAFT.payId); if (p) { p.paid = true; p.d = FDRAFT.payeLe; } }
  closeSheet(); toast("Facture enregistrée"); rerender(); await saveStore("biz");
};
actions["fac-print"] = (b, d) => {
  if (document.querySelector('form[data-f="fac"]')) lireFac();
  const f = FDRAFT && FDRAFT.id === +d.id ? FDRAFT : (B().invoices || []).find(x => x.id === +d.id); if (!f) return;
  const w = window.open("", "_blank"); if (!w) return toast("Autorise les fenêtres pour imprimer");
  w.document.write(FA.htmlFacture(f, B().settings)); w.document.close();
};
