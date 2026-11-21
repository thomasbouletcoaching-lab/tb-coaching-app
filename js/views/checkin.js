// Bilan hebdomadaire : poids, mensurations, sommeil, énergie, ressenti. Pré-rempli avec la semaine, en moins d'une minute.
// Enregistré sur le téléphone (S().checkins) et dans l'instantané du coach ; envoyé aussi en message à Thomas pour les coachés.
import { S, update, today, listPhotos } from "../store.js";
import * as E from "../engine.js";
import { $app, esc, num, fr, toast, routes, actions, forms, go, header, tabbar, cloud, canMsg, fmtDate, buzz, lineChart, I, rerender } from "../core.js";
import { refreshMe } from "../sync.js";
import { myAdherence, checkins, checkinThisWeek, lastCheckin, weightAvg7, dayFacts, addDays, mondayOf, defiOn, defiDay } from "../progress.js";
import { STATUS } from "../adherence.js";
import * as BR from "../bilan-reglages.js";
// Réglages du coach (jour, fréquence, questions en plus, transit et digestion)
const reglage = () => S().coachSettings?.bilan || null;

const DIGEST = [["transit", "🚽 Transit", "très perturbé", "parfait"], ["digest", "🫃 Digestion", "très inconfortable", "parfaite"]];
const MOODS = [[1, "😣", "Dur"], [2, "😕", "Bof"], [3, "😐", "Correct"], [4, "🙂", "Bien"], [5, "😄", "Top"]];
const SCALES = [
  ["energy", "⚡ Énergie dans la semaine", "à plat", "en pleine forme"],
  ["sleepQ", "😴 Qualité du sommeil", "très mauvaise", "excellente"],
  ["stress", "😮‍💨 Stress", "calme", "très stressé"],
  ["hunger", "🍽️ Faim", "aucune", "faim en permanence"],
  ["plan", "🎯 J'ai suivi mon plan", "pas du tout", "à la lettre"],
];
export const CI_MEASURES = [["waistNav", "Tour de taille (nombril)"], ["hips", "Hanches"], ["chest", "Poitrine"], ["arm_r_r", "Bras droit relâché"], ["thigh_r_r", "Cuisse droite"]];

// Ce que l'app sait déjà de la semaine
function weekFacts(t = today()) {
  const from = addDays(t, -6), f = dayFacts(from, t), days = Object.values(f);
  const done = days.filter(x => x.st === "done").length, planned = days.filter(x => ["done", "missed", "planned"].includes(x.st)).length;
  const sl = Object.entries(S().daily || {}).filter(([d, x]) => d >= from && d <= t && x.sleep).map(([, x]) => x.sleep);
  const en = Object.entries(S().daily || {}).filter(([d, x]) => d >= from && d <= t && x.feel?.energy != null).map(([, x]) => x.feel.energy);
  return { done, planned, food: days.filter(x => x.food).length, sleep: sl.length ? sl.reduce((a, b) => a + b, 0) / sl.length : null,
    energy5: en.length ? en.reduce((a, b) => a + b, 0) / en.length : null, weight: weightAvg7(t) };
}

const scale = (k, cur) => `<div class="scale" role="radiogroup">${Array.from({ length: 10 }, (_, i) => i + 1).map(v => `<label><input type="radio" name="${k}" value="${v}" ${+cur === v ? "checked" : ""}><span>${v}</span></label>`).join("")}</div>`;

routes.bilan = async () => {
  await E.loadPrograms();
  const t = today(), cur = checkinThisWeek(t), prev = checkins().filter(c => c !== cur).at(-1), wf = weekFacts(t);
  const lastM = [...(S().measures || [])].reverse().find(m => CI_MEASURES.some(([k]) => m[k] != null)) || {};
  const v = cur || { weight: wf.weight ? Math.round(wf.weight * 10) / 10 : null, sleepH: wf.sleep ? Math.round(wf.sleep * 10) / 10 : null, sessions: wf.done,
    energy: wf.energy5 != null ? Math.round(wf.energy5 * 2) : null };
  const photos = await listPhotos().catch(() => []);
  const lastPh = photos.filter(p => !["repas", "ticket"].includes(p.view)).map(p => p.d).sort().at(-1);
  const photoDue = !lastPh || lastPh < addDays(t, -13);
  const fmt = (x, d = 1) => x == null ? "" : String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",");
  $app.innerHTML = header("Bilan de la semaine", `Semaine du ${fmtDate(mondayOf(t), { day: "numeric", month: "long" })} · 1 minute`, { back: "__hist", offers: false }) + `<main class="page">
    ${cur ? `<div class="card soft"><p class="small" style="margin:0">✏️ Tu as déjà fait ton bilan cette semaine (${fmtDate(cur.d, { weekday: "long" })}). Tu peux le corriger.</p></div>` : ""}
    <div class="card mt12"><div class="lbl">📊 Ta semaine, déjà comptée</div>
      <div class="stat3 mt12"><div><b>${wf.done}${wf.planned ? `/${wf.planned}` : ""}</b><span>séances</span></div><div><b>${wf.food}/7</b><span>jours notés</span></div><div><b>${myAdherence(t).score ?? "–"}</b><span>régularité</span></div></div>
      <p class="xs muted mt8" style="margin-bottom:0">Corrige ci-dessous si quelque chose manque : le reste est déjà rempli.</p></div>
    <form data-f="bilan" class="stack mt12" id="bilan-form">
      <div class="grid2"><label class="field"><span>Poids moyen de la semaine (kg)</span><input name="weight" inputmode="decimal" value="${fmt(v.weight)}" placeholder="${fmt(prev?.weight) || "ex. 82,4"}"></label>
        <label class="field"><span>Sommeil moyen (heures / nuit)</span><input name="sleepH" inputmode="decimal" value="${fmt(v.sleepH)}" placeholder="ex. 7"></label></div>
      <details class="fold" ${cur?.measures && Object.keys(cur.measures).length ? "open" : ""}><summary>📏 Mensurations <small>facultatif</small></summary><div class="fb">
        <div class="grid2">${CI_MEASURES.map(([k, l]) => `<label class="field"><span>${l} (cm)</span><input name="m_${k}" inputmode="decimal" value="${fmt(cur?.measures?.[k])}" placeholder="${fmt(lastM[k])}"></label>`).join("")}</div>
        <p class="xs muted mt8" style="margin-bottom:0">Le matin, à jeun, au même endroit. Les chiffres gris sont tes dernières mesures.</p></div></details>
      <div class="card"><div class="lbl">🙂 Ma semaine en un mot</div><div class="moods mt8" role="radiogroup">${MOODS.map(([n, e, l]) => `<label><input type="radio" name="mood" value="${n}" ${+v.mood === n ? "checked" : ""}><span><b>${e}</b>${l}</span></label>`).join("")}</div></div>
      ${SCALES.map(([k, l, lo, hi]) => `<div class="card"><div class="row between"><b class="small">${l}</b><span class="xs muted">1 = ${lo} · 10 = ${hi}</span></div>${scale(k, v[k])}</div>`).join("")}
      ${reglage()?.digest ? DIGEST.map(([k, l, lo, hi]) => `<div class="card"><div class="row between"><b class="small">${l}</b><span class="xs muted">1 = ${lo} · 10 = ${hi}</span></div>${scale(k, v[k])}</div>`).join("") : ""}
      ${(reglage()?.questions || []).map((q, i) => `<label class="field"><span>💬 ${esc(q)}</span><textarea name="q_${i}" maxlength="600">${esc(v.answers?.[q] || "")}</textarea></label>`).join("")}
      <label class="field"><span>🏆 Ma victoire de la semaine</span><textarea name="win" maxlength="400" placeholder="Même petite : une séance de plus, un repas tenu…">${esc(v.win || "")}</textarea></label>
      <label class="field"><span>🧱 Ce qui a été difficile</span><textarea name="hard" maxlength="400">${esc(v.hard || "")}</textarea></label>
      ${canMsg() ? `<label class="field"><span>❓ Ma question pour Thomas</span><textarea name="question" maxlength="400">${esc(v.question || "")}</textarea></label>` : ""}
      ${photoDue ? `<a class="card tap" href="#/body" style="display:flex;gap:12px;align-items:center"><span style="font-size:26px">📸</span><span class="grow"><b class="small">${lastPh ? `Dernières photos le ${fmtDate(lastPh, { day: "numeric", month: "long" })}` : "Pas encore de photos de progrès"}</b><br><span class="xs muted">Une série toutes les 2 semaines suffit pour voir le changement</span></span>${I.chev}</a>` : ""}
      <button class="btn btn-red">${canMsg() ? "Enregistrer et envoyer à Thomas" : "Enregistrer mon bilan"}</button>
    </form>
  </main>${tabbar("coach")}`;
};

forms.bilan = async (v) => {
  const t = today(), wk = mondayOf(t), cur = checkinThisWeek(t);
  const n = (x, lo, hi) => { const y = num(x); return y >= lo && y <= hi ? Math.round(y * 10) / 10 : null; };
  const measures = {}; CI_MEASURES.forEach(([k]) => { const y = n(v["m_" + k], 10, 250); if (y != null) measures[k] = y; });
  const ci = { d: cur?.d || t, at: new Date().toISOString(), week: wk, weight: n(v.weight, 30, 250), sleepH: n(v.sleepH, 2, 14), measures,
    mood: v.mood ? +v.mood : null, energy: v.energy ? +v.energy : null, sleepQ: v.sleepQ ? +v.sleepQ : null, stress: v.stress ? +v.stress : null,
    hunger: v.hunger ? +v.hunger : null, plan: v.plan ? +v.plan : null, transit: v.transit ? +v.transit : null, digest: v.digest ? +v.digest : null,
    answers: Object.fromEntries((reglage()?.questions || []).map((q, i) => [q, (v["q_" + i] || "").trim()]).filter(([, a]) => a)), win: (v.win || "").trim(), hard: (v.hard || "").trim(), question: (v.question || "").trim() };
  if (ci.weight == null && String(v.weight || "").trim()) return toast("Vérifie ton poids.");
  const wf = weekFacts(t); ci.sessions = wf.done; ci.planned = wf.planned; ci.foodDays = wf.food;
  update(st => {
    st.checkins = [...(st.checkins || []).filter(c => (c.week || mondayOf(c.d)) !== wk), ci].sort((a, b) => a.d.localeCompare(b.d));
    if (Object.keys(measures).length) { let m = st.measures.find(x => x.d === t); if (!m) { m = { d: t }; st.measures.push(m); } Object.assign(m, measures); }
  });
  ci.score = myAdherence(t).score;
  update(st => { const x = st.checkins.find(c => c.week === wk); if (x) x.score = ci.score; });
  buzz(20);
  let sent = false;
  if (canMsg()) { try { const c = await cloud(); await c.ensureSession(); await c.send(checkinText(ci)); sent = true; refreshMe(); } catch { toast("Bilan enregistré. Envoi à Thomas impossible pour l'instant : réessaie plus tard."); } }
  done(ci, sent);
};

export function checkinText(c) {
  const f = (x, d = 1) => x == null ? "–" : String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",");
  const ms = Object.entries(c.measures || {}).map(([k, x]) => `${(CI_MEASURES.find(m => m[0] === k) || [k, k])[1]} ${f(x)} cm`).join(" · ");
  return `📝 Bilan du ${new Date(c.d + "T12:00:00").toLocaleDateString("fr-FR")}\nPoids moyen : ${f(c.weight)} kg · Séances : ${c.sessions ?? "–"}${c.planned ? "/" + c.planned : ""} · Repas notés : ${c.foodDays ?? "–"}/7 · Régularité : ${c.score ?? "–"}/100`
    + (ms ? `\nMensurations : ${ms}` : "")
    + `\nMoral ${MOODS.find(m => m[0] === c.mood)?.[1] || "–"} · Énergie ${c.energy ?? "–"}/10 · Sommeil ${f(c.sleepH)} h (qualité ${c.sleepQ ?? "–"}/10) · Stress ${c.stress ?? "–"}/10 · Faim ${c.hunger ?? "–"}/10 · Plan suivi ${c.plan ?? "–"}/10`
    + (c.transit != null || c.digest != null ? `\nTransit ${c.transit ?? "–"}/10 · Digestion ${c.digest ?? "–"}/10` : "")
    + `\nVictoire : ${c.win || "–"}\nDifficulté : ${c.hard || "–"}` + (c.question ? `\nQuestion : ${c.question}` : "")
    + Object.entries(c.answers || {}).map(([q, a]) => `\n${q} → ${a}`).join("");
}

function done(ci, sent) {
  const prev = checkins().filter(c => c.week !== ci.week).at(-1), adh = myAdherence();
  const diff = (k, unit, d = 1, good = -1) => { if (ci[k] == null || prev?.[k] == null) return ""; const x = ci[k] - prev[k]; if (Math.abs(x) < 0.05) return `<div class="li"><span class="grow small">${unit}</span><b class="small">stable</b></div>`;
    return `<div class="li"><span class="grow small">${unit}</span><b class="small" style="color:${Math.sign(x) === good ? "var(--good)" : "var(--ink)"}">${x > 0 ? "+" : ""}${fr(x, d)}</b></div>`; };
  const st = STATUS[adh.status];
  $app.innerHTML = `<section class="convo" style="justify-content:center"><div style="font-size:54px">✅</div>
    <h1 class="q">Bilan enregistré${sent ? " et envoyé à Thomas" : ""}.</h1>
    <p class="q-sub">${sent ? "Il te répond avec tes ajustements." : "Il compte dans ta régularité et dans ton rapport de progression."}</p>
    <div class="card mt16"><div class="row between"><b>Régularité sur 14 jours</b><span class="tag ${"st-" + st.tone}">${st.label}</span></div><div class="num mt4" style="font-size:34px">${adh.score ?? "–"}<small class="muted" style="font-size:16px"> / 100</small></div></div>
    ${prev ? `<div class="list mt12"><div class="li"><b class="small grow">Depuis ton bilan du ${fmtDate(prev.d, { day: "numeric", month: "long" })}</b></div>${diff("weight", "Poids moyen (kg)")}${diff("energy", "Énergie /10", 0, 1)}${diff("sleepH", "Sommeil (h)", 1, 1)}${diff("stress", "Stress /10", 0, -1)}</div>` : ""}
    <div class="stack mt24">${defiOn() ? `<button class="btn btn-red" data-a="go" data-r="defi">Retour à mon défi · jour ${defiDay()}</button>` : `<button class="btn btn-red" data-a="go" data-r="regularite">Voir ma régularité</button>`}<button class="btn btn-line" data-a="go" data-r="home">Accueil</button></div></section>`;
}

// ---------- Historique des bilans ----------
routes.bilans = () => {
  const l = checkins().slice().reverse();
  const ser = (k) => checkins().filter(c => c[k] != null).map(c => ({ y: c[k], l: c.d.slice(8, 10) + "/" + c.d.slice(5, 7) }));
  $app.innerHTML = header("Mes bilans", `${l.length} bilan${l.length > 1 ? "s" : ""}`, { back: "__hist", offers: false }) + `<main class="page">
    <button class="btn btn-red mt8" data-a="go" data-r="bilan">${checkinThisWeek() ? "Corriger mon bilan de la semaine" : "Faire mon bilan de la semaine"}</button>
    ${l.length >= 2 ? `<div class="card mt12"><div class="lbl">⚖️ Poids moyen</div>${lineChart(ser("weight"), { yfmt: (x) => fr(x, 1) })}</div>
      <div class="card mt12"><div class="lbl">⚡ Énergie /10</div>${lineChart(ser("energy"))}</div>` : ""}
    ${l.map(c => `<details class="card mt8"><summary style="list-style:none;cursor:pointer"><div class="row between"><b>${fmtDate(c.d, { weekday: "short", day: "numeric", month: "short" })}</b><span class="xs muted">${MOODS.find(m => m[0] === c.mood)?.[1] || ""} ${c.weight ? fr(c.weight, 1) + " kg" : ""} · ${c.score ?? "–"}/100</span></div></summary>
      <pre class="small" style="white-space:pre-wrap;font-family:inherit;margin:8px 0 0">${esc(checkinText(c).split("\n").slice(1).join("\n"))}</pre></details>`).join("") || `<p class="empty">Ton premier bilan apparaîtra ici.</p>`}
    <div id="old-bilans"></div>
  </main>${tabbar("coach")}`;
  loadOldBilans();
};

// Bilans de l'ancienne app (migrés, en lecture seule) : chargés à part, la liste actuelle ne dépend pas d'eux
const OLD_LABELS = { stress: "Stress", motiv: "Motivation", courb: "Courbatures", douleur: "Douleur", hard: "Séance difficile", q: "Question", q5: "Question", msg: "Message" };
async function loadOldBilans() {
  try {
    const c = await cloud(); if (!c || !c.legacyCheckins) return;
    const l = await c.legacyCheckins(); const box = document.getElementById("old-bilans"); if (!l.length || !box) return;
    const row = (k, v) => v == null || v === "" ? "" : `<p class="small" style="margin:4px 0 0"><b>${esc(k)} :</b> ${esc(String(v))}</p>`;
    box.innerHTML = `<div class="lbl mt16">🗂️ Bilans de l'ancienne app</div>` + l.map(b => {
      const extra = Object.entries(b.legacy || {}).filter(([k, v]) => OLD_LABELS[k] && typeof v !== "object").map(([k, v]) => row(OLD_LABELS[k], v)).join("");
      return `<details class="card mt8"><summary style="list-style:none;cursor:pointer"><div class="row between"><b>${fmtDate(b.d, { day: "numeric", month: "short", year: "numeric" })}${b.date_source === "updated_at" ? " <small class=\"muted\">(date approximative)</small>" : ""}</b><span class="xs muted">Semaine ${esc(String(b.week))}${b.weight ? " · " + fr(b.weight, 1) + " kg" : ""}</span></div></summary>
        <div style="margin-top:8px">${row("Qualité du sommeil", b.sleep_q != null ? b.sleep_q + "/5" : null)}${row("Victoire de la semaine", b.win)}${extra}${row("Réponse de Thomas", b.coach_reply)}</div></details>`;
    }).join("");
  } catch (e) { /* silencieux : la liste actuelle reste affichée */ }
}

// Carte d'accueil : le dimanche, si le bilan de la semaine n'est pas fait
export function checkinCard(t = today()) {
  const dow = (new Date(t + "T12:00:00").getDay() + 6) % 7; // 0 = lundi
  const rg = reglage();
  if (rg) { if (!S().profile || !BR.bilanAFaire(rg, t, lastCheckin()?.d).due) return ""; }
  else if (checkinThisWeek(t) || dow !== 6 || !S().profile) return ""; // le dimanche seulement
  const last = lastCheckin();
  return `<button class="card tap hl mt12" data-a="go" data-r="bilan" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:30px">📝</span><span class="grow"><b>Ton bilan de la semaine</b><br><span class="small muted">Semaine terminée : déjà pré-rempli, 1 minute${last ? ` · dernier le ${fmtDate(last.d, { day: "numeric", month: "short" })}` : ""}</span></span>${I.chev}</button>`;
}

// Échéances posées par le coach (compétition, bilan, fin de cycle…) : les 60 prochains jours, sur l'accueil
export function echeancesCard(t = today()) {
  const l = (S().coachSettings?.deadlines || []).filter(e => e.visible !== false && e.d >= t && e.d <= addDays(t, 60)).sort((a, b) => a.d.localeCompare(b.d));
  if (!l.length) return "";
  const j = (d) => Math.round((new Date(d + "T12:00:00") - new Date(t + "T12:00:00")) / 864e5);
  return `<div class="card mt12"><div class="lbl">🎯 Échéances fixées par Thomas</div>${l.slice(0, 3).map(e => `<div class="row between mt8"><span class="small"><b>${esc(e.title)}</b><br><span class="xs muted">${fmtDate(e.d, { weekday: "long", day: "numeric", month: "long" })}</span></span><span class="tag r">${j(e.d) === 0 ? "aujourd'hui" : "J-" + j(e.d)}</span></div>`).join("")}</div>`;
}

// Mot du coach (retour sur la semaine, consigne) : en haut de l'accueil jusqu'à ce que le membre le masque
export function coachMotCard() {
  const fb = S().coachSettings?.feedback; if (!fb?.txt || S().fbHidden === fb.d + fb.txt.length) return "";
  return `<div class="card mt12" style="box-shadow:0 0 0 1.5px var(--red) inset"><div class="row between"><b class="small">💬 Le mot de Thomas</b><button class="icon-btn sm" data-a="fb-hide" aria-label="Masquer">✓</button></div><p class="small mt8" style="margin-bottom:0;white-space:pre-wrap">${esc(fb.txt)}</p><div class="xs muted mt4">${fmtDate(fb.d, { weekday: "long", day: "numeric", month: "long" })}</div></div>`;
}
actions["fb-hide"] = () => { const fb = S().coachSettings?.feedback; update(st => { st.fbHidden = fb.d + fb.txt.length; }); rerender(); };

// Séances corrigées par Thomas et pas encore ouvertes
export function revuesCard() {
  const l = Object.entries(S().reviews || {}).filter(([, r]) => !r.seen_at).map(([id, r]) => ({ w: (S().workouts || []).find(w => String(w.id) === id), r })).filter(x => x.w);
  if (!l.length) return "";
  return `<div class="card mt12" style="box-shadow:0 0 0 1.5px #2F6FED inset"><b class="small">✍️ Thomas a corrigé ${l.length > 1 ? l.length + " séances" : "ta séance"}</b>${l.slice(0, 3).map(x => `<button class="li" data-a="w-detail" data-id="${x.w.id}" style="width:100%"><span class="grow small"><b>${esc(x.w.title)}</b><br><span class="xs muted">${esc((x.r.data.reaction || "✅") + " " + fmtDate(today(new Date(x.w.end)), { weekday: "long", day: "numeric", month: "short" }))}</span></span>${I.chev}</button>`).join("")}</div>`;
}

// Objectif de la période fixé par Thomas : en haut de l'accueil, avec l'avancement du temps
export function objectifCard(t = today()) {
  const o = S().coachSettings?.objectif; if (!o?.titre || !o.du || !o.au || t > addDays(o.au, 7)) return "";
  const tot = Math.max(1, (new Date(o.au) - new Date(o.du)) / 864e5), fait = Math.min(tot, Math.max(0, (new Date(t) - new Date(o.du)) / 864e5)), reste = Math.max(0, Math.round((new Date(o.au) - new Date(t)) / 864e5));
  return `<div class="card grad mt12"><div class="xs" style="opacity:.85">🎯 MON OBJECTIF · ${fmtDate(o.du, { day: "numeric", month: "short" })} → ${fmtDate(o.au, { day: "numeric", month: "short" })}</div><b class="h3 mt4" style="display:block">${esc(o.titre)}</b>${o.detail ? `<div class="xs mt4" style="opacity:.9;white-space:pre-wrap">${esc(o.detail)}</div>` : ""}
    <div class="gauge mt8" style="background:rgba(255,255,255,.25)"><i style="width:${Math.round(fait / tot * 100)}%;background:#fff"></i></div><div class="xs mt4" style="opacity:.9">${t > o.au ? "Période terminée : on fait le point avec Thomas." : reste === 0 ? "C'est le dernier jour !" : `Encore ${reste} jour${reste > 1 ? "s" : ""}`}</div></div>`;
}
