// Bilan hebdomadaire : poids, mensurations, sommeil, énergie, ressenti. Pré-rempli avec la semaine, en moins d'une minute.
// Enregistré sur le téléphone (S().checkins) et dans l'instantané du coach ; envoyé aussi en message à Thomas pour les coachés.
import { S, update, today, listPhotos } from "../store.js";
import * as E from "../engine.js";
import { $app, esc, num, fr, toast, routes, actions, forms, go, header, tabbar, cloud, canMsg, fmtDate, buzz, lineChart, I } from "../core.js";
import { refreshMe } from "../sync.js";
import { myAdherence, checkins, checkinThisWeek, lastCheckin, weightAvg7, dayFacts, addDays, mondayOf, defiOn, defiDay } from "../progress.js";
import { STATUS } from "../adherence.js";

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
    hunger: v.hunger ? +v.hunger : null, plan: v.plan ? +v.plan : null, win: (v.win || "").trim(), hard: (v.hard || "").trim(), question: (v.question || "").trim() };
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
    + `\nVictoire : ${c.win || "–"}\nDifficulté : ${c.hard || "–"}` + (c.question ? `\nQuestion : ${c.question}` : "");
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
  </main>${tabbar("coach")}`;
};

// Carte d'accueil : du vendredi au lundi, si le bilan de la semaine n'est pas fait
export function checkinCard(t = today()) {
  const dow = (new Date(t + "T12:00:00").getDay() + 6) % 7; // 0 = lundi
  if (checkinThisWeek(t) || dow < 4 || !S().profile) return "";
  const last = lastCheckin();
  return `<button class="card tap hl mt12" data-a="go" data-r="bilan" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:30px">📝</span><span class="grow"><b>Ton bilan de la semaine</b><br><span class="small muted">${dow === 6 ? "Semaine terminée : 1 minute pour faire le point" : "Déjà pré-rempli, 1 minute"}${last ? ` · dernier le ${fmtDate(last.d, { day: "numeric", month: "short" })}` : ""}</span></span>${I.chev}</button>`;
}
