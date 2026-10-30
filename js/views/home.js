import { S, update, today } from "../store.js";
import { nutriLine, nutriLevel } from "./nutri-detail.js";
import * as E from "../engine.js";
import * as N from "../nutrition.js";
import * as EN from "../energy.js";
import { $app, esc, num, fr, toast, buzz, routes, R, actions, changes, go, I, header, tabbar, seg, ring, gradDef, lineChart, barChart, greet, wordOn, fmtDate, addDays, isCoach, rank, premium, badges, msgQuotaText, weekOpen, rerender, canMsg } from "../core.js";
import { pushStats } from "../sync.js";
import { agendaWeekView, agendaMonthView, agendaYearView } from "./agenda.js";
const restDayOn = (d = today()) => { const sb = S().settings?.sabbat; if (sb && sb.on === false) return false; return new Date(d + "T12:00:00").getDay() === (sb?.dow ?? 6); };
const restDayCard = () => `<div class="card"><div class="lbl">Jour de repos</div><p class="mt8" style="margin:0">Aujourd'hui, pas de performance à battre. Marche, dors, mange en famille. Le repos fait partie du plan.</p></div>`;
import { durationSheet } from "./train.js";
import { seasonTimeline, goalsMini } from "./season.js";
import { readiness } from "./recup.js";
import { FREE_WEEKS } from "../config.js";
import { gamCard } from "../quests.js";

let homeTab = "today", homeDay = null;
const WATER_GOAL = 8; // verres de 25 cl

export function caloriesCard(d = today(), compact = false) {
  const t = N.dayTarget(d); if (!t) return "";
  const simple = nutriLevel() === "simple";
  const tot = N.dayTotals(d), b = EN.burnedNow(d);
  const left = t.kcal - Math.round(tot.kcal);
  const big = `<div class="ring-big"><svg viewBox="0 0 170 170">${gradDef("rg")}${ring(b.now / Math.max(b.total, 1), 170, 9, "#FF9F43", "transparent")}<g transform="translate(14 14)">${ring(tot.kcal / t.kcal, 142, 13, left < -t.kcal * .05 ? "var(--warn)" : "url(#rg)")}</g></svg><div class="c"><b>${fr(Math.abs(left))}</b><span>kcal ${left < 0 ? "en trop" : "restantes"}</span></div></div>`;
  const mini = (l, a, g, col) => `<div><div class="mini"><svg viewBox="0 0 66 66">${ring(a / g, 66, 7, col)}</svg><b>${Math.round(a / g * 100)}%</b></div><div class="v">${Math.round(a)} / ${g} g</div><div class="l">${l}</div></div>`;
  return `<div class="ringwrap"><div class="side">🍽️<b>${fr(tot.kcal)}</b><span>mangées</span><span>objectif ${fr(t.kcal)}</span></div>${big}<div class="side">🔥<b>${fr(b.now)}</b><span>brûlées ${d === today() ? "à cette heure" : "dans la journée"}</span><span>sur ${fr(b.total)} prévues</span></div></div>
    ${compact ? "" : simple ? `<div class="minis" style="grid-template-columns:1fr">${mini("Protéines", tot.p, t.prot, "#B3263A")}</div>${t.notes?.length ? `<p class="xs muted center mt8" style="margin-bottom:0">${esc(t.notes.join(" · "))}</p>` : ""}` : `<div class="minis">${mini("Protéines", tot.p, t.prot, "#B3263A")}${mini("Glucides", tot.c, t.carbs, "#E0A93B")}${mini("Lipides", tot.f, t.fat, "#4F5D2A")}</div>${t.notes?.length ? `<p class="xs muted center mt8" style="margin-bottom:0">${esc(t.notes.join(" · "))}</p>` : ""}
`}${compact || nutriLevel() !== "complet" ? "" : nutriLine(d)}`;
}
function trainingCard(d) {
  const ag = E.agenda(d, d)[d], ns = E.nextSession();
  const cur = S().current;
  if (ag?.st === "done") return `<div class="card"><div class="lbl">🏋️ Entraînement</div><h2 class="h2 mt8">Séance faite ✅</h2><p class="muted mt4">${esc(ag.title)}</p><button class="btn btn-line btn-sm mt8" data-a="go" data-r="carnet">Voir le détail</button><div class="deco">💪</div></div>`;
  if ((ag?.st === "planned" && d === today()) || cur) {
    const blocked = ns && !weekOpen(ns.week);
    return `<div class="card"><div class="lbl">🏋️ Entraînement · semaine ${ns.week}/${ns.weeks} · ${esc(ns.phase)}</div><h2 class="h1 mt8">${esc(cur ? cur.title : ns.title)}</h2>${!cur && (ag?.time || ag?.place) ? `<button class="link small mt4" data-a="ag-day" data-v="${d}">🕐 ${esc([ag.time, ag.dur ? ag.dur + " min" : "", ag.place].filter(Boolean).join(" · "))} · décaler</button>` : !cur ? `<button class="link small mt4" data-a="ag-day" data-v="${d}">🕐 Fixer l'heure ou décaler</button>` : ""}<p class="small muted mt8">${ns.exercises.length} exercices · ${ns.exercises.slice(0, 3).map(e => esc(S().swaps[e[0]] || e[0])).join(", ")}…</p>
      ${blocked ? `<p class="small mt8">Tes ${FREE_WEEKS} premières semaines sont faites. La suite de ton cycle est prête.</p><button class="btn btn-red mt8" data-a="go" data-r="offers">🔓 Débloquer la suite</button>` : `<button class="btn btn-red mt8" data-a="start">${cur ? "Reprendre la séance" : "Commencer la séance"}</button>`}<div class="deco">🏋️</div></div>`;
  }
  const nx = Object.entries(E.agenda(d, addDays(d, 10))).find(([k, v]) => k > d && v.st === "planned");
  return `<div class="card"><div class="lbl">🏋️ Entraînement</div><h2 class="h1 mt8">${ag?.st === "planned" ? esc(ag.title) : ag?.st === "missed" ? "Séance loupée" : "Jour de repos"}</h2>
    <p class="muted mt8">${ag?.st === "missed" ? "Pas de rattrapage : on reprend à la prochaine séance." : nx ? `Prochaine séance : <b style="color:var(--ink)">${esc(nx[1].title)}</b> ${nx[0] === addDays(today(), 1) ? "demain" : fmtDate(nx[0], { weekday: "long" })}${nx[1].time ? ` à ${nx[1].time}` : ""}` : ""}</p>
    <div class="row mt8"><button class="btn btn-line btn-sm" data-a="home-tab" data-v="week">Voir ma semaine</button>${d === today() ? `<button class="btn btn-line btn-sm" data-a="free-session">Séance libre</button>` : ""}</div><div class="deco">🗓️</div></div>`;
}
export function routineCard(d = today()) {
  const D = S().daily[d] || {}, foodN = N.dayLog(d).length;
  const filled = [D.weight, D.steps, D.sleep, D.water, foodN].filter(x => x).length;
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6)).map(k => { const x = S().daily[k] || {}; return [x.weight, x.steps, x.sleep, x.water, N.dayLog(k).length].filter(Boolean).length >= 3; });
  const water = D.water || 0;
  return `<div class="card"><div class="row between"><div><div class="lbl">Ma routine du jour</div><div class="mt4"><b class="num" style="font-size:22px">${filled}/5</b> <span class="muted small">· 30 secondes</span></div></div><div class="dots">${last7.map(x => `<i class="${x ? "on" : ""}"></i>`).join("")}</div></div>
    <div class="rt mt12"><span class="em">⚖️</span><div class="grow"><b>Poids</b><div class="small muted">le matin, à jeun</div></div><input class="inp" inputmode="decimal" placeholder="kg" value="${D.weight ? String(D.weight).replace(".", ",") : ""}" data-c="routine" data-k="weight" data-d="${d}" aria-label="Poids en kg"></div>
    <div class="rt"><span class="em">👣</span><div class="grow"><b>Pas</b><div class="small muted">objectif ${fr(S().profile?.stepsGoal || 8000)}</div></div><input class="inp" inputmode="numeric" placeholder="pas" value="${D.steps || ""}" data-c="routine" data-k="steps" data-d="${d}" aria-label="Nombre de pas"></div>
    <div class="rt"><span class="em">😴</span><div class="grow"><b>Sommeil</b><div class="small muted">nuit dernière</div></div><input class="inp" inputmode="decimal" placeholder="heures" value="${D.sleep ? String(D.sleep).replace(".", ",") : ""}" data-c="routine" data-k="sleep" data-d="${d}" aria-label="Heures de sommeil"></div>
    <div class="rt"><span class="em">💧</span><div class="grow"><b>Eau</b><div class="small muted">${fr(water * .25, 2)} L · objectif ${fr(WATER_GOAL * .25, 1)} L</div><div class="glasses">${Array.from({ length: Math.max(WATER_GOAL, water) }, (_, i) => `<i class="${i < water ? "on" : ""}"></i>`).join("")}</div></div><div class="water"><button data-a="water" data-v="-1" data-d="${d}" aria-label="Retirer un verre">−</button><b>${water}</b><button data-a="water" data-v="1" data-d="${d}" aria-label="Ajouter un verre">+</button></div></div>
    <div class="rt"><span class="em">🍽️</span><div class="grow"><b>Nutrition</b><div class="small muted">${foodN ? `${foodN} aliment${foodN > 1 ? "s" : ""} noté${foodN > 1 ? "s" : ""} · ${fr(N.dayTotals(d).kcal)} kcal` : "pas encore noté"}</div></div><button class="btn btn-line btn-sm" data-a="go" data-r="food">Noter</button></div>
    <p class="xs muted mt8" style="margin:0">Une journée compte dans la série dès que 3 des 5 cases sont remplies. Le poids se lit en moyenne sur 7 jours : les variations d'un jour à l'autre sont normales.</p></div>`;
}
// Rituel du matin : 1 minute, l'esprit, le corps, une seule priorité
function eveningCard() { return ""; }
function stallCard() {
  const st = E.stalls(); if (!st.length) return "";
  const x = st[0];
  return `<div class="card" style="box-shadow:0 0 0 2px var(--warn) inset"><div class="lbl">📹 Plateau détecté</div><p class="mt8" style="margin-bottom:6px">Ça fait <b>${x.weeks} semaines</b> que tu bloques sur <b>${esc(x.name)}</b> (1RM estimé ${fr(x.best)} kg).</p>
    <p class="small muted">Souvent, c'est la technique ou la récupération. Envoie une vidéo de profil à Thomas : il te dit quoi corriger.</p>
    <div class="row mt8" style="gap:8px"><button class="btn btn-red btn-sm grow" data-a="stall-video" data-n="${esc(x.name)}">Envoyer une vidéo</button><button class="btn btn-line btn-sm" data-a="stall-snooze" data-n="${esc(x.name)}">Plus tard</button></div>${st.length > 1 ? `<p class="xs muted mt8" style="margin:8px 0 0">Aussi : ${st.slice(1, 4).map(s => esc(s.name)).join(", ")}.</p>` : ""}</div>`;
}
function weekStrip(sel) {
  const mon = addDays(today(), -((new Date().getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const ag = E.agenda(days[0], days[6]);
  return `<div class="card" style="padding:4px"><div class="dstrip">${days.map((k, i) => { const a = ag[k]; const c = a?.st === "done" ? "dn" : a?.st === "missed" ? "ms" : a?.st === "planned" ? "pl" : ""; return `<button class="${c} ${k === sel ? "on" : ""}" data-a="home-day" data-v="${k}"><small>${E.DAY_SHORT[i]}</small><b>${Number(k.slice(8))}</b><i></i></button>`; }).join("")}</div></div>`;
}

// Accueil v4 : le cycle en cours, les objectifs de force, le cheat meal prévu, la récupération, les offres
function cycleCard(ns) {
  if (!ns) return `<button class="card tap" data-a="go" data-r="train" data-p="banque" style="display:block;width:100%;text-align:left"><div class="lbl">🎯 Ton cycle</div><b class="h3">Choisis un programme</b></button>`;
  const blk = (E.seasonBlocks?.() || []).find(b => b.cur);
  const pct = Math.round((ns.week - 1) / Math.max(1, ns.weeks) * 100);
  return `<button class="card tap grad" data-a="go" data-r="carnet" style="display:block;width:100%;text-align:left"><div class="row between"><span class="lbl" style="color:inherit;opacity:.85">🔁 Cycle en cours${blk ? ` · bloc ${esc(E.FOCUS[blk.focus]?.[0] || "")}` : ""}</span><span class="xs" style="opacity:.85">${pct} %</span></div>
    <b class="h3 mt4" style="display:block">${esc(ns.p.name.split("·")[0].trim())}</b><div class="small" style="opacity:.9">Semaine ${ns.week} sur ${ns.weeks} · ${esc(ns.phase)}</div>
    <div class="gauge mt8" style="background:rgba(255,255,255,.25)"><i style="width:${pct}%;background:#fff"></i></div></button>`;
}
function strengthCard() {
  const gs = (S().goals || []).filter(g => g.date >= today());
  if (gs.length) return goalsMini();
  return `<button class="card tap" data-a="go" data-r="train" data-p="saison" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:26px">🎯</span><span class="grow"><b>Fixe un objectif de force</b><br><span class="small muted">Une charge, une date : l'app te dit si tu es dans les temps.</span></span>${I.chev}</button>`;
}
function cheatCard() {
  const c = N.nextCheat?.(); if (!c) return "";
  const days = Math.round((new Date(c.d + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5);
  return `<button class="card tap" data-a="go" data-r="food" data-p="semaine" style="display:block;width:100%;text-align:left"><div class="lbl">🍕 Cheat meal prévu</div><b class="h3">${days === 0 ? "C'est aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`} · ${fmtDate(c.d, { weekday: "long", day: "numeric", month: "long" })}</b>
    <div class="small muted mt4">${esc((c.items || []).join(", ") || "Plaisirs à définir")}${c.kcal ? ` · ≈ ${fr(c.kcal)} kcal, déjà compté dans ta semaine` : ""}</div></button>`;
}
function recoveryMini(d) {
  const r = readiness(d);
  return `<button class="card tap" data-a="go" data-r="recup" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">${r.icon}</span><span class="grow"><b>Récupération : ${esc(r.label)}</b><br><span class="small muted">${esc(r.short)}</span></span>${I.chev}</button>`;
}
function offersCard() {
  return `<button class="card tap mt12" data-a="go" data-r="offers" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;box-shadow:0 0 0 2px var(--red) inset"><span style="font-size:28px">🚀</span><span class="grow"><b>Accélère avec le Bâtisseur</b><br><span class="small muted">Charges calculées à chaque séance, plan alimentaire au gramme, stats complètes. 7 jours offerts.</span></span>${I.chev}</button>`;
}
function progressCard() {
  const ms = Object.entries(S().daily).filter(([, v]) => v.weight).sort().slice(-30).map(([k, v]) => ({ y: v.weight, l: k.slice(8, 10) + "/" + k.slice(5, 7) }));
  const avg = ms.map((m, i) => ({ y: ms.slice(Math.max(0, i - 6), i + 1).reduce((a, b) => a + b.y, 0) / Math.min(i + 1, 7), l: m.l }));
  const wk = E.activeWeeks(8);
  return `<h2 class="sec">📈 Mes progrès <small><a href="#/train/stats" class="link">Tout voir</a></small></h2>
    <div class="card"><div class="lbl">⚖️ Poids moyen</div>${avg.length ? `<div class="num mt4" style="font-size:28px">${fr(avg.at(-1).y, 1)} kg</div>` : ""}<div class="mt8">${lineChart(avg, { yfmt: (v) => fr(v, 1) })}</div></div>
    <div class="card"><div class="lbl">🏋️ Séances par semaine</div><div class="mt8">${barChart(wk.map(w => ({ v: w.count, l: `${w.start.getDate()}/${w.start.getMonth() + 1}` })))}</div></div>`;
}

// Triade de discipline : corps, nutrition, foi. Une journée compte dans la série dès 2 piliers sur 3.
export function triade(d = today()) {
  const st = E.agenda(d, d)[d]?.st;
  const corps = st === "done" || st === "rest" || st === "away";
  const t = N.targets(), p = N.dayTotals(d).p || 0;
  const nutriFrac = t?.prot ? Math.min(1, p / t.prot) : 0;
  const nutri = nutriFrac >= .9;
  const D = S().daily[d] || {};
  const routine = [D.weight, D.steps, D.sleep, D.water, N.dayLog(d).length].filter(Boolean).length >= 3;
  return { corps, nutri, nutriFrac, routine, score: [corps, nutri, routine].filter(Boolean).length };
}
function triadeStreak() {
  let n = 0, k = today();
  if (triade(k).score < 2) k = addDays(k, -1);
  while (triade(k).score >= 2 && n < 366) { n++; k = addDays(k, -1); }
  return n;
}
function triadeCard() {
  const x = triade(today()), s = triadeStreak();
  const item = (ico, label, on, frac, col) => `<div><div class="mini"><svg viewBox="0 0 66 66">${ring(frac, 66, 7, col)}</svg><b>${on ? "✓" : Math.round(frac * 100) + "%"}</b></div><div class="v">${ico} ${label}</div></div>`;
  return `<div class="card"><div class="row between"><div class="lbl">Triade de discipline</div><span class="xs muted">${s ? `🔥 Série : ${s} jour${s > 1 ? "s" : ""}` : "Série à démarrer"}</span></div>
    <div class="minis mt8">${item("🏋️", "Corps", x.corps, x.corps ? 1 : 0, "#B3263A")}${item("🍽️", "Nutrition", x.nutri, x.nutriFrac, "#E0A93B")}${item("📋", "Routine", x.routine, x.routine ? 1 : 0, "#4F5D2A")}</div>
    <p class="xs muted mt8" style="margin:8px 0 0">2 piliers sur 3 suffisent pour compter le jour. Un écart n'efface rien : tu reprends le lendemain.</p></div>`;
}
function quickActions() {
  return `<div class="row mt12" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="go" data-r="food">🍽️ Ajouter un repas</button><button class="btn btn-line btn-sm grow" data-a="go" data-r="carnet">🏋️ Séance</button><button class="btn btn-red btn-sm grow" data-a="go" data-r="crise">🆘 Je craque</button></div>`;
}

routes.home = async () => {
  await Promise.all([N.loadModels(), E.loadPrograms()]);
  const pr = S().profile; const d = homeDay || today();
  const ns = E.nextSession();
  const alerts = E.injuryAlerts();
  const fs = EN.fastState();
  let body;
  if (R.param && ["today", "week", "month", "year"].includes(R.param)) { homeTab = R.param; R.param = null; }
  if (homeTab === "week") body = agendaWeekView() + `<h2 class="sec">📊 Bilan de la semaine</h2>` + weekSummary();
  else if (homeTab === "month") body = agendaMonthView();
  else if (homeTab === "year") body = agendaYearView(seasonTimeline());
  else body = `${weekStrip(d)}
    ${d !== today() ? `<p class="small muted center">${fmtDate(d)} · <a href="#" data-a="home-day" data-v="${today()}" class="link">revenir à aujourd'hui</a></p>` : ""}
    ${alerts.length ? `<div class="card" style="box-shadow:0 0 0 2px var(--warn) inset"><div class="lbl">⚠️ Alerte blessure</div><p class="mt8" style="margin-bottom:6px"><b>${esc(alerts[0].name)}</b> : ${esc(alerts[0].last.note)}</p><p class="small muted">Baisse la charge ou remplace l'exercice. Si la douleur persiste, parles-en à un professionnel de santé.</p><button class="btn btn-line btn-sm" data-a="go" data-r="chat">Prévenir Thomas</button></div>` : ""}
    ${d === today() && restDayOn() ? restDayCard() : ""}
    ${d === today() ? cycleCard(ns) : ""}
    ${trainingCard(d)}
    ${d === today() ? quickActions() : ""}
    ${d === today() ? strengthCard() : ""}
    ${d === today() ? cheatCard() : ""}
    <h2 class="sec">📊 Récap du jour</h2>
    <button class="card tap" data-a="go" data-r="food">${caloriesCard(d, true)}</button>
    ${recoveryMini(d)}
    ${fs ? `<button class="card tap mt12" data-a="go" data-r="recup"><div class="row"><span style="font-size:30px">${fs.stage[1]}</span><div class="grow"><div class="lbl">⏳ Jeûne en cours</div><b class="h3">${Math.floor(fs.hours)} h ${String(Math.floor(fs.hours % 1 * 60)).padStart(2, "0")}</b><div class="xs muted">${esc(fs.stage[2])}</div></div>${I.chev}</div></button>` : ""}
    ${d === today() ? `<h2 class="sec">🎮 Quêtes et régularité</h2>` + triadeCard() + gamCard() : ""}
    ${routineCard(d)}
    ${d === today() && rank() < 1 ? offersCard() : ""}
    ${progressCard()}
    ${canMsg() || isCoach() ? `<h2 class="sec">💬 Ton coach</h2>
    <button class="card tap" data-a="go" data-r="${isCoach() ? "coach" : "chat"}" style="display:flex;align-items:center;gap:12px"><span style="width:46px;height:46px;border-radius:50%;background:var(--paper);display:grid;place-items:center;flex:none;border:1px solid var(--line);overflow:hidden"><img src="assets/icon-192-grec.png" alt="TB my Coach" width="46" height="46" style="width:100%;height:100%;object-fit:cover"></span>
      <span class="grow"><b>${isCoach() ? "Espace coach" : "Écrire à Thomas"}</b><br><span class="small muted">${isCoach() ? "Tes membres et leurs messages" : badges.msgs ? `${badges.msgs} nouveau${badges.msgs > 1 ? "x" : ""} message${badges.msgs > 1 ? "s" : ""}` : msgQuotaText()}</span></span>${I.chev}</button>` : ""}`;
  $app.innerHTML = `<main class="page">
    <div class="row between" style="padding-top:var(--safe-t)"><div></div><div class="row">${isCoach() ? "" : `<button class="pill" data-a="go" data-r="offers">🚀 ${rank() >= 2 ? "Mon coaching" : "Passer au coaching"}</button>`}<button class="pill ic" data-a="notifs" aria-label="Notifications">${I.bell}${badges.notifs ? `<span class="badge">${badges.notifs}</span>` : ""}</button></div></div>
    <p class="kicker mt12">${fmtDate(today())}${ns ? ` · semaine ${ns.week}/${ns.weeks} · ${esc(ns.phase)}` : ""}</p>
    <div class="row between" style="align-items:flex-end"><h1 class="hello">${greet()}<br>${esc(pr.name)}</h1><button class="pill ic" style="width:56px;height:56px;border-radius:50%;font-weight:800;font-size:20px" data-a="go" data-r="profile" aria-label="Profil">${esc(pr.name[0].toUpperCase())}</button></div>
    <div class="mt16">${seg([["today", "Aujourd'hui"], ["week", "Semaine"], ["month", "Mois"], ["year", "Année"]], homeTab, "home-tab")}</div>
    ${body}</main>${tabbar("home")}`;
};
function weekSummary() {
  const mon = addDays(today(), -((new Date().getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const ag = E.agenda(days[0], days[6]);
  const done = days.filter(k => ag[k]?.st === "done").length, planned = days.filter(k => ag[k] && !["away", "rest"].includes(ag[k].st)).length;
  const avg = (key) => { const v = days.map(k => S().daily[k]?.[key]).filter(Boolean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const kcal = days.map(k => ({ v: N.dayTotals(k).kcal, l: E.DAY_SHORT[days.indexOf(k)] }));
  const kd = kcal.filter(x => x.v); const t = N.targets();
  return `<div class="card"><div class="lbl">🏋️ Entraînement</div><div class="stat3 mt12"><div><b>${done}/${planned}</b><span>séances</span></div><div><b>${fr(E.activeWeeks(1)[0].volume / 1000, 1)}</b><span>tonnes</span></div><div><b>${E.streakWeeks()}</b><span>sem. d'affilée</span></div></div></div>
    <div class="card"><div class="lbl">🍽️ Calories par jour</div><div class="mt8">${barChart(kcal, { hi: (new Date().getDay() + 6) % 7 })}</div><p class="small muted" style="margin:0">Moyenne : <b style="color:var(--ink)">${kd.length ? fr(kd.reduce((a, b) => a + b.v, 0) / kd.length) : "–"} kcal</b> pour un objectif de ${fr(t?.kcal)} kcal.</p></div>
    <div class="card"><div class="lbl">📋 Routine</div><div class="stat3 mt12"><div><b>${avg("steps") ? fr(avg("steps")) : "–"}</b><span>pas / jour</span></div><div><b>${avg("sleep") ? fr(avg("sleep"), 1) : "–"}</b><span>h de sommeil</span></div><div><b>${avg("water") ? fr(avg("water") * .25, 1) : "–"}</b><span>L d'eau</span></div></div></div>`;
}

actions["home-tab"] = (b, d) => { homeTab = d.v; history.replaceState(null, "", "#/home/" + d.v); rerender(false); };
export let yearExtra = () => "";
export const setYearExtra = (f) => { yearExtra = f; };
actions["home-day"] = (b, d) => { homeDay = d.v === today() ? null : d.v; homeTab = "today"; rerender(); };
actions.water = (b, d) => {
  update(st => { const x = st.daily[d.d] = st.daily[d.d] || {}; x.water = Math.max(0, (x.water || 0) + +d.v); });
  buzz(); rerender();
};
changes.routine = (el) => {
  const k = el.dataset.k, v = num(el.value), d = el.dataset.d;
  const ok = { weight: v > 30 && v < 250, steps: v >= 0 && v < 100000, sleep: v >= 0 && v <= 16 }[k];
  if (el.value.trim() && !ok) return toast("Valeur invalide");
  update(st => {
    const x = st.daily[d] = st.daily[d] || {}; if (el.value.trim()) x[k] = k === "steps" ? Math.round(v) : v; else delete x[k];
    if (k === "weight" && ok) { st.profile.weight = v; const m = st.measures.find(m => m.d === d); if (m) m.weight = v; else st.measures.push({ d, weight: v }); }
  });
  if (k === "weight") pushStats();
  buzz(); rerender();
};
actions["free-session"] = async () => {
  await Promise.all([E.loadPrograms(), E.loadFiches()]);
  durationSheet((min) => { const s = E.freeSession(); s.target = min; update(st => st.current = s); sessionStorage.removeItem("cxs.min"); go("workout"); }, "Séance libre");
};
