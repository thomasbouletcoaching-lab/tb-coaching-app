// Entraînement : programme et cycle, banque, programme perso, carnet de séance, stats, records, simulateur, fiches.
import { S, update, save, today } from "../store.js";
import * as E from "../engine.js";
import { CONFIG } from "../config.js";
import { $app, esc, num, fr, buzz, toast, routes, R, actions, changes, forms, go, I, header, tabbar, chips, seg, sheet, closeSheet, lockVeil, lineChart, barChart, hbars, wordOn, premium, rank, programOpen, weekOpen, fmtDate, addDays, rerender, onLeave, isCoach, cloud, modeBar } from "../core.js";
import { kbSection } from "./more.js";
import { pushStats } from "../sync.js";
import { seasonBody } from "./season.js";

const kgTxt = (v) => v == null || v === "" ? "" : E.fmtKg(v);
const adv = () => S().settings.adv ?? (S().profile?.level === "advanced");
let tab = "programme";
const TABS = [["programme", "🎯 Programme"], ["saison", "🗓️ Saison et objectifs"], ["outils", "🧮 Records et outils"], ["exos", "📖 Exercices"], ["banque", "🗂️ Banque"], ["stats", "📈 Statistiques"], ["historique", "🕘 Historique"]];
const MAIN = [["mine", "Mes entraînements"], ["banque", "Banque"], ["stats", "Statistiques"]];
const mainOf = (t) => t === "banque" ? "banque" : t === "stats" ? "stats" : "mine";

// =====================================================================
// PAGE ENTRAÎNEMENT
// =====================================================================
routes.train = async () => {
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  if (R.param && TABS.some(t => t[0] === R.param)) tab = R.param;
  if (tab === "historique") { carnetTab = "faites"; carnetMain = "seances"; return go("carnet"); }
  const ns = E.nextSession();
  let body = "";
  if (tab === "programme") body = programBody(ns);
  else if (tab === "stats") body = statsBody();
  else if (tab === "outils") body = toolsBody();
  else if (tab === "exos") body = exosBody();
  else if (tab === "banque") body = bankBody();
  else if (tab === "saison") body = seasonBody();
  else body = historyBody();
  $app.innerHTML = header("Entraînement", ns ? esc(ns.p.name.split("·")[0].trim()) : "", { back: "carnet" }) + `<main class="page"><div class="mt12">${seg(MAIN, mainOf(tab), "train-main")}</div>${mainOf(tab) === "mine" ? `<div class="mt8">${chips([...TABS.slice(0, 4), ["learn", "📚 Apprendre"]], tab, "train-tab")}</div>` : ""}${body}</main>${tabbar("train")}`;
  if (tab === "exos") bindExoSearch();
  if (tab === "banque") bindBankSearch();
};
actions["train-main"] = (b, d) => actions["train-tab"](b, { v: d.v === "mine" ? "programme" : d.v });
// ---------- Carnet : séances à remplir, séances faites, progrès ----------
let carnetMain = "seances", carnetTab = "remplir";
let tMode = "carnet";
routes.carnet = async () => {
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  if (["carnet", "explorer", "savoir"].includes(R.param)) tMode = R.param;
  const ns = E.nextSession();
  let body;
  if (tMode === "explorer") body = `<h2 class="sec">🗂️ Programmes</h2>${bankBody()}<h2 class="sec">📖 Exercices</h2>${exosBody()}`;
  else if (tMode === "savoir") body = await kbSection("train");
  else {
    const inner = carnetMain === "progres" ? statsBody() : carnetTab === "faites" ? historyBody() : programBody(ns);
    body = `<div class="card mt12"><div class="row between"><b class="small">⚡ Séance express</b><span class="xs muted">mouvements principaux gardés</span></div><div class="chips wrap mt8">${[10, 20, 30, 45].map(m => `<button class="chip" data-a="express-go" data-v="${m}">${m} min</button>`).join("")}</div></div>
      <div class="tiles mt12">
        <button class="tile" data-a="go" data-r="train" data-p="saison"><span class="tile-ic">🗓️</span><span><b>Mes cycles</b><br><span class="xs muted">Blocs sur plusieurs semaines, objectifs</span></span></button>
        <button class="tile" data-a="go" data-r="builder"><span class="tile-ic">✍️</span><span><b>Créer</b><br><span class="xs muted">Séances, programmes, cycles${premium() ? "" : " · 1 en gratuit"}</span></span></button>
      </div>
      <div class="mt12">${seg([["seances", "Séances"], ["progres", "Graphiques"]], carnetMain, "carnet-main")}</div>
      ${carnetMain === "seances" ? `<div class="mt8">${chips([["remplir", "✍️ À remplir"], ["faites", "🕘 Historique"]], carnetTab, "carnet-tab")}</div>` : ""}${inner}
      <button class="link small mt12" data-a="go" data-r="train" data-p="outils">🧮 Records, 1RM et outils →</button>`;
  }
  $app.innerHTML = header("Entraînement", ns ? `Semaine ${ns.week}/${ns.weeks} · ${esc(ns.phase)}` : "") + `<main class="page">${modeBar([["carnet", "Carnet"], ["explorer", "Explorer"], ["savoir", "Connaissances"]], tMode, "train-mode")}${body}</main>${tabbar("carnet")}`;
  if (tMode === "explorer") { bindBankSearch(); bindExoSearch(); }
};
actions["train-mode"] = (b, d) => { tMode = d.v; R.param = null; history.replaceState(null, "", "#/carnet" + (d.v === "carnet" ? "" : "/" + d.v)); rerender(false); window.scrollTo(0, 0); };
actions["express-go"] = async (b, d) => {
  const min = +d.v, ns = E.nextSession();
  if (S().current) return go("workout");
  if (ns && !weekOpen(ns.week)) return go("offers");
  const s0 = E.buildSession(); if (!s0) return toast("Choisis d'abord un programme.");
  const s = E.expressSession(s0, min); s.target = min; s.start = new Date().toISOString();
  update(st => { st.current = s; st.settings.sessionMin = min; }); toast(`⚡ ${min} min : ${s.expressNote}`); go("workout");
};
actions["carnet-main"] = (b, d) => { carnetMain = d.v; rerender(false); window.scrollTo(0, 0); };
actions["carnet-tab"] = (b, d) => { carnetTab = d.v; rerender(false); };
actions["train-tab"] = (b, d) => { if (d.v === "learn") return go("kb"); tab = d.v; R.param = d.v; history.replaceState(null, "", "#/train/" + d.v); rerender(false); window.scrollTo(0, 0); };

let viewWeek = null;
function programBody(ns) {
  if (!ns) return `<p class="empty">Choisis un programme dans la banque.</p>`;
  const { p } = ns, cur = S().current, cyc = ns.cycle;
  if (viewWeek == null || viewWeek > ns.weeks) viewWeek = ns.week;
  const vw = viewWeek, blocked = !weekOpen(vw), done = E.doneIn(p.id, cyc, vw);
  const alerts = E.injuryAlerts(), pc = S().settings.pace || "normal";
  const weekDone = (w) => E.doneIn(p.id, cyc, w).size;
  const chipsW = Array.from({ length: ns.weeks }, (_, i) => i + 1).map(w => { const n = weekDone(w), all = n >= p.s.length;
    return `<button class="chip ${w === vw ? "on" : ""}" data-a="cy-week" data-v="${w}" style="${w === ns.week && w !== vw ? "box-shadow:0 0 0 2px var(--red) inset" : ""}">S${w}${all ? " ✓" : n ? ` ${n}/${p.s.length}` : ""}</button>`; }).join("");
  return `<div class="card grad mt12"><div class="lbl">🎯 Ton programme · cycle ${cyc}</div><h2 class="h2 mt4">${esc(p.name)}</h2>
      <p class="small mt8">Tu es en <b>semaine ${ns.week}</b> sur ${ns.weeks} · ${esc(ns.phase)}</p><div class="gauge mt8" style="background:rgba(255,255,255,.25)"><i style="width:${Math.round((ns.week - 1 + weekDone(ns.week) / p.s.length) / ns.weeks * 100)}%;background:#fff"></i></div></div>
    ${alerts.length ? `<div class="card mt12" style="box-shadow:0 0 0 2px var(--warn) inset"><div class="lbl">⚠️ Alertes blessure</div>${alerts.map(a => `<p class="small mt8" style="margin-bottom:0"><b>${esc(a.name)}</b> · ${a.count} fois en 3 semaines<br><span class="muted">${esc(a.last.note)}</span></p>`).join("")}<p class="xs muted mt8">Réduis la charge, change d'exercice (🔄 dans la séance) ou parles-en à Thomas. Si la douleur persiste, consulte un professionnel de santé.</p></div>` : ""}
    <h2 class="sec">🗓️ Mon cycle <small>touche une semaine</small></h2>
    <div class="chips">${chipsW}</div>
    <div class="card mt8"><div class="row between"><div><b class="h3">Semaine ${vw}</b> <span class="tag ${vw === ns.week ? "r" : ""}">${vw === ns.week ? "en cours" : vw < ns.week ? "passée" : "à venir"}</span><div class="xs muted mt4">${esc(E.phaseOf(p, vw))} · ${done.size}/${p.s.length} séances faites</div></div>
      ${vw !== ns.week ? `<button class="btn btn-line btn-xs" data-a="cy-place" data-v="${vw}">Me placer ici</button>` : ""}</div>
      ${p.s.map((se, i) => { const isNext = vw === ns.week && i === ns.idx % p.s.length, isDone = done.has(i);
        return `<div class="mt12" style="border-top:1px solid var(--line);padding-top:12px${isNext ? ";box-shadow:inset 3px 0 0 var(--red);padding-left:10px" : ""}">
          <div class="row between"><b>${isDone ? "✅ " : isNext ? "👉 " : ""}${esc(se[0])}</b><span class="xs muted">${esc(se[1] || "")}</span></div>
          ${se[2].map(e => `<div class="row between xs" style="padding:3px 0;gap:8px"><span class="grow muted">${esc(S().swaps[e[0]] || e[0])}</span><span style="white-space:nowrap">${esc(E.schemeFor(p, e, vw).replace(/x/i, "×"))}</span></div>`).join("")}
          ${blocked ? "" : isDone ? `<button class="link xs mt4" data-a="cy-do" data-w="${vw}" data-i="${i}">Refaire cette séance</button>` : `<button class="btn ${isNext ? "btn-red" : "btn-line"} btn-sm mt8" data-a="cy-do" data-w="${vw}" data-i="${i}">${cur ? "Reprendre ma séance en cours" : isNext ? "Commencer cette séance" : "Faire cette séance"}</button>`}</div>`; }).join("")}
      ${blocked ? `<button class="btn btn-red mt12" data-a="go" data-r="offers">🔓 Débloquer la semaine ${vw}</button>` : ""}</div>
    <button class="btn btn-line btn-sm mt8" data-a="free-session" style="width:100%">Séance libre (hors programme)</button>

    <h2 class="sec">📈 Ma surcharge progressive</h2>
    <div class="card"><div class="lbl">Rythme de progression</div>${chips(Object.entries(E.PROG_PACE).map(([k, v]) => [k, v.n]), pc, "pace-set")}
      <p class="xs muted mt8" style="margin-bottom:0">${{ prudent: "Charges calculées 5 % plus légères, et petits sauts quand c'est facile. Idéal en reprise ou avec une gêne.", normal: "Charges calculées sur ton 1RM estimé, un saut de charge quand tu es sous le RPE prévu.", ambitieux: "Charges 3 % plus lourdes et sauts plus grands. Pour les périodes où tout va bien (sommeil, nutrition)." }[pc]}</p>
      <p class="xs muted mt8" style="margin-bottom:0">Pendant la séance, le bouton <b>📈 Progression</b> de chaque exercice permet d'ajuster la charge, les reps ou ton 1RM estimé.</p></div>
    ${p.rules?.length ? `<h2 class="sec">📏 Les règles</h2><div class="card"><ul style="margin:0;padding-left:18px" class="small">${p.rules.map(r => `<li style="margin-bottom:8px">${esc(r)}</li>`).join("")}</ul></div>` : ""}
    ${p.desc ? `<p class="small muted mt12">${esc(p.desc)}</p>` : ""}
    <div class="row mt12" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="bd-copy" data-id="${p.id}">✏️ ${p.custom ? "Modifier" : "Personnaliser"} ce programme</button><button class="btn btn-line btn-sm grow" data-a="go" data-r="kb">📚 Connaissances</button></div>`;
}
actions["cy-week"] = (b, d) => { viewWeek = +d.v; rerender(); };
actions["cy-place"] = (b, d) => { if (S().current) return toast("Termine d'abord ta séance en cours."); E.placeIn(+d.v); viewWeek = +d.v; toast(`Tu es maintenant en semaine ${d.v}`); rerender(); };
actions["cy-do"] = async (b, d) => {
  if (S().current) { sessionStorage.removeItem("cxs.min"); return go("workout"); }
  E.placeIn(+d.w, +d.i); viewWeek = +d.w; await actions.start();
};
actions["pace-set"] = (b, d) => { update(st => st.settings.pace = d.v); toast(`Rythme ${E.PROG_PACE[d.v].n.toLowerCase()} : appliqué dès ta prochaine séance`); rerender(); };

// Banque : plus de 100 programmes, filtrés par type, niveau, public, durée et jours
const BF = { cat: "", lvl: "", pub: "", dur: 0, days: 0, q: "" };
const BCATS = ["Bodybuilding", "Powerbuilding", "Powerlifting", "Street lifting", "Street workout", "CrossFit & fonctionnel", "Maison", "Femmes", "Grossesse & post-partum", "Parents", "Santé", "Perte de poids", "Vacances & voyage"];
const BCAT_E = { "Bodybuilding": "💪", "Powerbuilding": "🏋️", "Powerlifting": "🥇", "Street lifting": "⛓️", "Street workout": "🤸", "CrossFit & fonctionnel": "🔥", "Maison": "🏠", "Femmes": "🍑", "Grossesse & post-partum": "🤰", "Parents": "👨‍👩‍👧", "Santé": "🩺", "Perte de poids": "📉", "Vacances & voyage": "🏖️" };
function bankList() {
  const q = (BF.q || "").toLowerCase();
  return E.programs().filter(p => !p.custom && !p.lib)
    .filter(p => !BF.cat || p.cat === BF.cat).filter(p => !BF.lvl || p.lvl === BF.lvl || p.lvl === "Tous niveaux")
    .filter(p => !BF.pub || (p.pub || ["Tous"]).includes(BF.pub)).filter(p => !BF.dur || (p.dur || 60) === BF.dur)
    .filter(p => !BF.days || p.days.filter(Boolean).length === BF.days).filter(p => !q || (p.name + " " + (p.prof || "") + " " + (p.cat || "")).toLowerCase().includes(q));
}
function bankBody() {
  const mine = S().customPrograms || [], l = bankList(), all = E.programs().filter(p => !p.custom && !p.lib);
  const sel = (k, opts, lab) => `<label class="field"><span>${lab}</span><select data-c="bf" data-k="${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(BF[k]) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  return `<p class="small muted mt12">${all.length} programmes de ${esc(CONFIG.coachName)}. Changer de programme repart en semaine 1 ; tes charges sont conservées.</p>
    <button class="card tap mt8" data-a="go" data-r="builder" style="display:flex;align-items:center;gap:12px"><span style="font-size:28px">✏️</span><span class="grow"><b>Créer mon programme</b><br><span class="small muted">Tes séances, tes séries, ta progression</span></span>${I.chev}</button>
    ${mine.length ? `<h2 class="sec">Mes programmes</h2>${mine.map(pg => progCard(pg, true)).join("")}` : ""}
    ${E.extra.programs.length ? `<h2 class="sec">Nouveaux programmes de Thomas</h2>${E.extra.programs.map(pg => progCard(pg)).join("")}` : ""}
    <h2 class="sec">🗂️ La banque</h2>
    <div class="catgrid">${BCATS.map(c => `<button class="chip ${BF.cat === c ? "on" : ""}" data-a="bf-cat" data-v="${esc(c)}">${BCAT_E[c]} ${esc(c)} <span class="muted xs">${all.filter(p => p.cat === c).length}</span></button>`).join("")}</div>
    <div class="search mt12">${I.search}<input id="bfq" placeholder="Chercher : dos, TRX, muscle-up…" value="${esc(BF.q)}" autocomplete="off"></div>
    <div class="grid2 mt8">${sel("lvl", [["", "Tous"], ["Débutant", "Débutant"], ["Intermédiaire", "Intermédiaire"], ["Avancé", "Avancé"]], "Niveau")}${sel("pub", [["", "Tout le monde"], ["Femme", "Femmes"], ["Papa", "Papas"], ["Maman", "Mamans"], ["Femme enceinte", "Femmes enceintes"], ["Post-partum", "Post-partum"], ["Senior", "Seniors"]], "Pour qui")}
      ${sel("dur", [[0, "Toutes"], [20, "20 min"], [30, "30 min"], [45, "45 min"], [60, "1 h"], [75, "1 h 15"]], "Durée d'une séance")}${sel("days", [[0, "Tous"], [2, "2 jours"], [3, "3 jours"], [4, "4 jours"], [5, "5 jours"], [6, "6 jours"]], "Jours par semaine")}</div>
    <div class="row between mt12"><b class="small">${l.length} programme${l.length > 1 ? "s" : ""}</b>${BF.cat || BF.lvl || BF.pub || BF.dur || BF.days || BF.q ? `<button class="link xs" data-a="bf-reset">Tout effacer</button>` : ""}</div>
    <div id="bfl">${l.slice(0, bankN).map(pg => progCard(pg)).join("") || `<p class="empty small">Aucun programme avec ces filtres.</p>`}</div>
    ${l.length > bankN ? `<button class="btn btn-line btn-sm mt12" data-a="bf-more" style="width:100%">Voir ${Math.min(20, l.length - bankN)} de plus</button>` : ""}`;
}
let bankN = 20;
actions["bf-cat"] = (b, d) => { BF.cat = BF.cat === d.v ? "" : d.v; bankN = 20; rerender(); };
actions["bf-reset"] = () => { Object.assign(BF, { cat: "", lvl: "", pub: "", dur: 0, days: 0, q: "" }); bankN = 20; rerender(); };
actions["bf-more"] = () => { bankN += 20; rerender(); };
changes.bf = (el) => { const k = el.dataset.k; BF[k] = ["dur", "days"].includes(k) ? +el.value : el.value; bankN = 20; rerender(); };
function bindBankSearch() { const i = document.getElementById("bfq"); let t; i?.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { BF.q = i.value; const l = bankList(); document.getElementById("bfl").innerHTML = l.slice(0, 40).map(pg => progCard(pg)).join("") || `<p class="empty small">Aucun programme.</p>`; }, 200); }); }
function progCard(pg, mine = false) {
  const open = programOpen(pg.id), cur = pg.id === S().plan?.programId;
  return `<div class="card ${cur ? "hl" : ""} mt8"><div class="row between"><span>${cur ? '<span class="tag r">En cours</span>' : ""}<span class="tag">${esc(pg.lvl || "Perso")}</span><span class="tag">${pg.days.filter(Boolean).length} j</span>${pg.dur ? `<span class="tag">⏱️ ${pg.dur} min</span>` : ""}${pg.cat ? `<span class="tag">${BCAT_E[pg.cat] || ""} ${esc(pg.cat)}</span>` : ""}</span>${open ? "" : `<span class="lock">🔒 Premium</span>`}</div>
    <h3 class="h3 mt8">${esc(pg.name)}</h3>${pg.prof ? `<p class="small muted mt4">${esc(pg.prof)}</p>` : ""}${pg.equip?.length ? `<p class="xs muted" style="margin:2px 0 0">Matériel : ${esc(pg.equip.join(", "))}</p>` : ""}<button class="link xs mt4" data-a="pg-see" data-id="${pg.id}">Voir les séances</button>
    <div class="row mt8" style="gap:8px">${cur ? "" : open ? `<button class="btn btn-line btn-sm" data-a="set-program" data-id="${pg.id}">Choisir</button>` : `<button class="btn btn-line btn-sm" data-a="go" data-r="offers">Débloquer</button>`}${mine ? `<button class="btn btn-ghost btn-sm" data-a="go" data-r="builder" data-p="${pg.id}">Modifier</button>` : `<button class="btn btn-ghost btn-sm" data-a="bd-copy" data-id="${pg.id}">Personnaliser</button>`}</div></div>`;
}
actions["pg-see"] = (b, d) => { const p = E.program(d.id); if (!p) return;
  sheet(`<h2 class="h2">${esc(p.name)}</h2>${p.desc ? `<p class="small muted mt4">${esc(p.desc)}</p>` : ""}${p.s.map(se => `<div class="card mt12"><div class="row between"><b>${esc(se[0])}</b><span class="xs muted">${esc(se[1] || "")}</span></div>${se[2].map(e => `<div class="row between xs" style="padding:3px 0;gap:8px"><span class="grow muted">${esc(e[0])}</span><span style="white-space:nowrap">${esc(E.schemeFor(p, e, 1).replace(/x/i, "×"))}</span></div>`).join("")}</div>`).join("")}
    ${p.rules?.length ? `<h3 class="sec">Règles</h3><ul class="small" style="padding-left:18px">${p.rules.map(r => `<li style="margin-bottom:6px">${esc(r)}</li>`).join("")}</ul>` : ""}
    ${programOpen(p.id) ? (p.id === S().plan?.programId ? "" : `<button class="btn btn-red mt12" data-a="set-program" data-id="${p.id}">Choisir ce programme</button>`) : `<button class="btn btn-red mt12" data-a="go" data-r="offers">🔓 Débloquer</button>`}`); };
actions["bd-copy"] = (b, d) => { const p = E.program(d.id); if (p?.custom && (S().customPrograms || []).some(x => x.id === p.id)) return go("builder", p.id); draft = null; location.hash = "#/builder/copie/" + encodeURIComponent(d.id); };
actions["set-program"] = (b, d) => {
  if (S().current) return toast("Termine d'abord ta séance en cours.");
  if (!programOpen(d.id)) return go("offers");
  update(st => st.plan = { programId: d.id, startedAt: today(), week: 1, idx: 0, cycle: 1 });
  tab = "programme"; closeSheet(); toast("Programme changé"); pushStats(); routes.train();
};

function historyBody() {
  const ws = S().workouts.slice().reverse();
  return ws.length ? `<div class="list mt12">${ws.slice(0, 60).map(w => `<button class="li" data-a="ag-day" data-v="${today(new Date(w.end))}"><span class="em">${w.free ? "🤸" : "🏋️"}</span><span class="grow"><b>${esc(w.title)}</b><br><span class="xs muted">${new Date(w.end).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · ${w.setsDone} séries · ${(w.volume / 1000).toFixed(1).replace(".", ",")} t</span></span><span class="small muted">${Math.round((new Date(w.end) - new Date(w.start)) / 6e4)} min</span></button>`).join("")}</div><p class="xs muted mt8">Touche une séance pour la corriger ou la supprimer.</p>` : `<p class="empty">Tes séances terminées apparaîtront ici.</p>`;
}

// ---------- Statistiques ----------
let period = "month", liftSel = null, volView = "muscle";
function statsBody() {
  const from = { week: addDays(today(), -6), month: addDays(today(), -29), quarter: addDays(today(), -89) }[period];
  const v = E.volumeStats(from);
  const wk = E.activeWeeks(8);
  const free = `<div class="card mt12"><div class="lbl">🔥 Régularité · ${E.streakWeeks()} semaine${E.streakWeeks() > 1 ? "s" : ""} d'affilée</div><div class="mt8">${barChart(wk.map(w => ({ v: w.count, l: `${w.start.getDate()}/${w.start.getMonth() + 1}` })))}</div><p class="xs muted" style="margin:0">Séances par semaine, 8 dernières semaines.</p></div>`;
  const lifts = Object.entries(S().lifts).filter(([, h]) => h.length).sort((a, b) => b[1].length - a[1].length);
  if (!liftSel || !S().lifts[liftSel]) liftSel = lifts[0]?.[0];
  const h = liftSel ? S().lifts[liftSel] : [];
  const mv = E.monthlyVolume(6);
  let volHtml;
  if (volView === "muscle") { const it = Object.entries(v.byMuscle).map(([l, x]) => ({ l, v: x.sets })).sort((a, b) => b.v - a.v); volHtml = it.length ? hbars(it, (x) => fr(x, 1) + " s.") + `<p class="xs muted">Séries effectives : muscle principal = 1, secondaires = ½. Repère : 10 à 20 séries par muscle et par semaine pour progresser.</p>` : `<p class="empty small">Pas encore de séance sur la période.</p>`; }
  else if (volView === "exo") { const it = Object.entries(v.byExercise).map(([l, x]) => ({ l, v: x.ton })).sort((a, b) => b.v - a.v).slice(0, 12); volHtml = it.length ? hbars(it, (x) => fr(x / 1000, 1) + " t") : `<p class="empty small">Pas encore de séance sur la période.</p>`; }
  else if (volView === "seance") volHtml = v.sessions.length ? hbars(v.sessions.slice(-12).map(s => ({ l: `${s.d.slice(8)}/${s.d.slice(5, 7)} ${s.title}`, v: s.ton })), (x) => fr(x / 1000, 1) + " t") : `<p class="empty small">Pas encore de séance sur la période.</p>`;
  else if (volView === "semaine") volHtml = barChart(wk.map(w => ({ v: w.volume / 1000, l: `${w.start.getDate()}/${w.start.getMonth() + 1}` })), { fmt: (x) => fr(x, 1) }) + `<p class="xs muted">Tonnage par semaine (tonnes).</p>`;
  else volHtml = barChart(mv.map(m => ({ v: m.volume / 1000, l: m.label })), { fmt: (x) => fr(x, 1) }) + `<p class="xs muted">Tonnage par mois (tonnes).</p>`;
  const recs = lifts.map(([n, hh]) => [n, Math.max(...hh.map(x => x.e1rm))]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const locked = !premium();
  return free + `<div class="${locked ? "locked" : ""}" style="position:relative">
    <h2 class="sec">💪 Volume</h2>
    ${chips([["week", "7 jours"], ["month", "30 jours"], ["quarter", "3 mois"]], period, "st-period")}
    <div class="card mt8">${chips([["muscle", "Par muscle"], ["exo", "Par exercice"], ["seance", "Par séance"], ["semaine", "Par semaine"], ["mois", "Par mois"]], volView, "st-vol")}<div class="mt12">${volHtml}</div></div>
    <h2 class="sec">📈 Force estimée (e1RM)</h2>
    ${lifts.length ? `<div class="card">${chips(lifts.slice(0, 12).map(([n]) => [n, esc(n)]), liftSel, "st-lift")}
      <div class="row between mt12"><b class="num" style="font-size:28px">${fr(h.at(-1)?.e1rm, 1)} kg</b><span class="small muted">meilleur ${fr(Math.max(...h.map(x => x.e1rm)), 1)} kg</span></div>
      <div class="mt8">${lineChart(h.map(x => ({ y: x.e1rm, l: x.d.slice(8, 10) + "/" + x.d.slice(5, 7) })), { yfmt: (x) => fr(x) })}</div><p class="xs muted" style="margin:0">1RM estimé à partir de tes séries (charge, reps et RPE).</p></div>` : `<p class="empty small">Tes courbes apparaissent après tes premières séances.</p>`}
    ${recs.length ? `<h2 class="sec">🏆 Records</h2><div class="list">${recs.map(([n, x]) => `<div class="li"><span class="grow small">${esc(n)}</span><span class="num">${fr(x)} kg</span></div>`).join("")}</div>` : ""}
    ${locked ? lockVeil("Bâtisseur", "Volume par muscle, par exercice, par séance, par semaine et par mois, courbes de force et records.") : ""}</div>`;
}
actions["st-period"] = (b, d) => { period = d.v; rerender(); };
actions["st-vol"] = (b, d) => { volView = d.v; rerender(); };
actions["st-lift"] = (b, d) => { liftSel = d.v; rerender(); };

// ---------- Records et outils ----------
let simu = { kg: 100, reps: 5, rpe: 9 }, goal = { lift: "squat", target: null };
function toolsBody() {
  const recs = S().profile?.records || {};
  const e = E.e1rm(simu.kg, simu.reps, simu.rpe);
  const gl = E.MAIN_LIFTS.find(m => m[0] === goal.lift);
  const curE = gl ? Math.round(E.currentE1rm(gl[1]) || recs[goal.lift]?.e1rm || 0) : 0;
  const cg = goal.target ? E.cyclesToGoal(curE, goal.target, S().profile?.level) : null;
  return `<h2 class="sec">🏆 Mes records <small>servent à calculer tes charges</small></h2>
    <div class="list">${E.MAIN_LIFTS.map(([k, n]) => { const r = recs[k], cur = Math.round(E.currentE1rm(n)); return `<button class="li" data-a="rec-edit" data-k="${k}"><span class="grow"><b class="small">${esc(n)}</b><br><span class="xs muted">${r ? `saisi : ${E.fmtKg(r.k)} kg × ${r.r}${r.rpe && r.rpe < 10 ? ` à RPE ${r.rpe}` : ""}` : "non renseigné"}</span></span><span class="num">${cur ? cur + " kg" : "–"}</span>${I.chev}</button>`; }).join("")}</div>
    <p class="xs muted mt8">Le chiffre à droite est ton 1RM estimé actuel : il part de ton record saisi, puis se recalcule à chaque séance du carnet.</p>
    <h2 class="sec">🧮 Simulateur de 1RM</h2>
    <div class="card"><div class="grid3"><label class="field"><span>Charge (kg)</span><input inputmode="decimal" value="${E.fmtKg(simu.kg)}" data-c="simu" data-k="kg"></label><label class="field"><span>Reps</span><input inputmode="numeric" value="${simu.reps}" data-c="simu" data-k="reps"></label><label class="field"><span>RPE</span><input inputmode="decimal" value="${String(simu.rpe).replace(".", ",")}" data-c="simu" data-k="rpe"></label></div>
      <div class="center mt12"><div class="lbl">1RM estimé</div><b class="num" style="font-size:42px">${fr(e, 1)} kg</b></div>
      <table class="mt12" style="width:100%;font-size:14px;border-collapse:collapse"><tr class="muted"><th style="text-align:left">Reps</th><th>RPE 10</th><th>RPE 8</th><th>%</th></tr>
      ${[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map(r => `<tr style="border-top:1px solid var(--line)"><td style="padding:6px 0"><b>${r}</b></td><td class="center">${E.fmtKg(E.roundTo(E.loadFor(e, r, 10), 2.5))} kg</td><td class="center">${E.fmtKg(E.roundTo(E.loadFor(e, r, 8), 2.5))} kg</td><td class="center muted">${Math.round(E.pctFor(r, 10))} %</td></tr>`).join("")}</table>
      <p class="xs muted mt8">Formule d'Epley corrigée par les répétitions en réserve (RPE). Fiable entre 1 et 10 reps.</p></div>
    <h2 class="sec">🎯 Mes objectifs de performance</h2>
    <div class="card"><p class="small" style="margin-top:0">Fixe une charge à atteindre avant une date (ex. 60 kg aux tractions lestées) : l'app calcule le rythme à tenir et guide tes sauts de charge.</p><button class="btn btn-line btn-sm" data-a="train-tab" data-v="saison">Voir mes objectifs</button></div>`;
}
changes.simu = (el) => { const v = num(el.value); if (v > 0) { simu[el.dataset.k] = v; rerender(); } };
changes.goal = (el) => { if (el.dataset.k === "lift") goal.lift = el.value; else goal.target = num(el.value) || null; rerender(); };
actions["rec-edit"] = (b, d) => {
  const n = E.MAIN_LIFTS.find(m => m[0] === d.k)[1], r = S().profile.records?.[d.k];
  sheet(`<h2 class="h2">${esc(n)}</h2><p class="small muted mt4">Une série récente et honnête : la charge, le nombre de reps, et le RPE si tu n'étais pas à l'échec.</p>
    <form data-f="rec" data-k="${d.k}" class="mt12"><div class="grid3"><label class="field"><span>Charge (kg)</span><input name="kg" inputmode="decimal" value="${r ? E.fmtKg(r.k) : ""}" required></label><label class="field"><span>Reps</span><input name="reps" inputmode="numeric" value="${r?.r ?? 1}" required></label><label class="field"><span>RPE</span><input name="rpe" inputmode="decimal" value="${r?.rpe ?? 10}"></label></div>
    <button class="btn btn-red mt12">Enregistrer</button></form>`);
};
forms.rec = (v, f) => {
  const kg = num(v.kg), reps = Math.round(num(v.reps)), rpe = num(v.rpe) || 10;
  if (!(kg > 0 && reps >= 1 && reps <= 20)) return toast("Valeurs invalides");
  E.setRecord(f.dataset.k, kg, reps, rpe); closeSheet(); toast("Record enregistré, charges recalculées"); pushStats(); rerender();
};
routes.simu = async () => { await E.loadPrograms(); $app.innerHTML = header("Records et outils", "", { back: S().current ? "workout" : "train" }) + `<main class="page">${toolsBody()}</main>`; };

// ---------- Exercices et fiches techniques ----------
let exoQ = "", exoMus = "", exoEq = "";
function exosBody() {
  return `<div class="search mt12">${I.search}<input id="exq" placeholder="Nom ou muscle parmi ${E.allExercises().length} exercices" value="${esc(exoQ)}" autocomplete="off"></div>
    <div class="mt8">${chips([["", "Tous les muscles"], ...E.MUSCLES.map(m => [m, m])], exoMus, "exo-mus")}</div>
    <div class="mt4">${chips([["", "Tout le matériel"], ...E.EQUIP.map(m => [m, m])], exoEq, "exo-eq")}</div><div id="exlist" class="mt12">${exoList()}</div>`;
}
function exoList() {
  const names = filterExercises(exoQ, exoMus, exoEq);
  return `<p class="xs muted">${names.length} exercice${names.length > 1 ? "s" : ""}</p>` + (names.length ? `<div class="list">${names.slice(0, 200).map(n => `<button class="li" ${E.isCustomExercise(n) ? `data-a="fiche-sheet" data-n="${esc(n)}"` : `data-a="go" data-r="fiche" data-p="${esc(n)}"`}><span class="grow"><span class="small"><b>${esc(n)}</b></span><br><span class="xs muted">${esc(E.musclesOf(n).join(" · "))} · ${esc(E.equipOf(n))}</span></span>${I.chev}</button>`).join("")}</div>` : `<p class="empty small">Aucun exercice trouvé.</p>`);
}
function bindExoSearch() {
  const i = document.getElementById("exq"); if (!i) return;
  i.addEventListener("input", () => { exoQ = i.value; document.getElementById("exlist").innerHTML = exoList(); });
}
actions["exo-mus"] = (b, d) => { exoMus = d.v; rerender(); };
actions["exo-eq"] = (b, d) => { exoEq = d.v; rerender(); };

const FIELD = [["exec", "▶️ Exécution"], ["resp", "🌬️ Respiration"], ["erreurs", "⚠️ Erreurs fréquentes"], ["muscles", "💪 Muscles"], ["artic", "🦴 Articulations"], ["plan", "📐 Plan"], ["type", "🏷️ Type"], ["moment", "⚙️ Biomécanique : moments"], ["courbe", "📈 Courbe de résistance"], ["levier", "📏 Leviers et morphologie"], ["conseils", "💡 Conseils de coach"], ["progresser", "🚀 Progresser"], ["prog", "🪜 Progressions"], ["access", "♿ Adaptations"]];
const FREE_FIELDS = ["exec", "resp", "erreurs", "muscles"];
const block = (v) => Array.isArray(v) ? `<ul class="small" style="padding-left:18px;margin:6px 0">${v.map(x => `<li>${esc(typeof x === "string" ? x : Object.values(x).join(" : "))}</li>`).join("")}</ul>` : typeof v === "object" && v ? `<ul class="small" style="padding-left:18px;margin:6px 0">${Object.entries(v).map(([k, x]) => `<li><b>${esc(k)}</b> : ${esc(Array.isArray(x) ? x.join(", ") : x)}</li>`).join("")}</ul>` : `<p class="small" style="margin:6px 0">${esc(v)}</p>`;
routes.fiche = async () => {
  await Promise.all([E.loadFiches(), E.loadLib()]);
  const f = E.ficheOf(R.param);
  const back = "__hist";
  if (!f) { $app.innerHTML = header("Fiche", "", { back }) + `<main class="page"><p class="empty">Fiche introuvable.</p></main>`; return; }
  const fam = f.fam || {}, alts = E.alternatives(f.name).slice(0, 10), deep = premium();
  const recordE = Math.round(E.currentE1rm(f.name));
  $app.innerHTML = header("Fiche technique", "", { back }) + `<main class="page">
    <h1 class="h1 mt8" style="color:var(--red)">${esc(f.name)}</h1><p class="small muted">${esc(E.musclesOf(f.name).join(" · "))}${fam.nom ? ` · ${esc(fam.nom)}` : ""}</p>
    ${f.video ? `<a class="btn btn-red btn-sm mt12" href="${esc(f.video)}" target="_blank" rel="noopener" style="width:100%">▶️ Voir la vidéo de Thomas</a>` : ""}
    ${recordE ? `<div class="card mt12"><div class="lbl">📈 Ton 1RM estimé</div><b class="num" style="font-size:26px">${recordE} kg</b></div>` : ""}
    <div class="card mt12">${f.setup ? `<div class="lbl">🛠️ Installation</div><p class="small mt4">${esc(f.setup)}</p>` : ""}${f.cues?.length ? `<div class="lbl mt12">🎯 Points clés</div>${block(f.cues)}` : ""}${f.note ? `<p class="small muted mt8" style="margin-bottom:0">${esc(f.note)}</p>` : ""}</div>
    ${FIELD.filter(([k]) => fam[k] && (deep || FREE_FIELDS.includes(k))).map(([k, l]) => `<div class="card mt12"><div class="lbl">${l}</div>${block(fam[k])}</div>`).join("")}
    ${deep ? "" : (() => { const lk = FIELD.filter(([k]) => fam[k] && !FREE_FIELDS.includes(k)); return lk.length ? `<div class="card mt12 locked" style="position:relative;min-height:220px"><div class="lbl">🔬 Biomécanique complète</div><p class="small muted mt4">${lk.map(([, l]) => l).join(" · ")}</p>${lockVeil("Bâtisseur", "Moments, courbe de résistance, leviers, conseils de coach et progressions.")}</div>` : ""; })()}
    ${alts.length ? `<h2 class="sec">🔄 Variantes du même mouvement</h2><div class="list">${alts.map(n => `<button class="li" data-a="go" data-r="fiche" data-p="${esc(n)}"><span class="grow">${esc(n)}</span>${I.chev}</button>`).join("")}</div>` : ""}
  </main>`;
};

// =====================================================================
// CARNET DE SÉANCE
// =====================================================================
let restT = null, restEnd = 0, restTotal = 0, clockT = null;
actions.start = async () => {
  const cur = S().current, ns = E.nextSession();
  if (ns && !weekOpen(ns.week) && !cur) return go("offers");
  sessionStorage.removeItem("cxs.min");
  if (cur) return go("workout");
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  const s0 = E.buildSession(); if (!s0) return toast("Choisis d'abord un programme.");
  durationSheet((min, mode) => { let s = mode === "adapt" ? E.buildMerged(true) : mode === "full" ? E.buildMerged(false) : s0; if (mode === "express") s = E.expressSession(s, min); s.target = min; s.start = new Date().toISOString(); update(st => st.current = s); if (s.expressNote) toast(`⚡ Séance express ${min} min : ${s.expressNote}`); go("workout"); }, s0.title, E.mergeCandidate());
};
// Durée visée de la séance : compte à rebours pendant toute la séance
export function durationSheet(onGo, title = "Ta séance", merge = null) {
  const last = S().settings.sessionMin ?? (S().profile?.sessionMin || 45);
  sheet(`<h2 class="h2">${esc(title)}</h2>${merge ? `<div class="card soft mt8"><b class="small">🔗 Une séance à rattraper ?</b><p class="xs muted" style="margin:4px 0 8px">Tu peux faire aujourd'hui « ${esc(title)} » et « ${esc(merge.title)} » en une seule séance. Ce n'est pas obligatoire : souvent, mieux vaut simplement reprendre le fil.</p>
      <div class="chips wrap"><button class="chip on" data-a="mg-pick" data-v="">Seulement celle-ci</button><button class="chip" data-a="mg-pick" data-v="adapt">Fusionner, version adaptée</button><button class="chip" data-a="mg-pick" data-v="full">Fusionner tout</button></div>
      <p class="xs muted" style="margin:6px 0 0">Adaptée : exercices en double regroupés, environ un tiers de séries en moins. Tu peux ensuite retirer ou changer des exercices.</p></div>` : ""}<div class="card soft mt12"><b class="small">⚡ Séance express</b><p class="xs muted" style="margin:4px 0 8px">Peu de temps ? Les mouvements principaux sont gardés, l'isolation et les dernières séries sautent, les repos raccourcissent.</p>
      <div class="chips wrap">${[10, 20, 30, 45].map(m => `<button class="chip" data-a="dur-express" data-v="${m}">${m} min</button>`).join("")}</div></div>
    <p class="small muted mt12">Ou la séance complète : combien de temps as-tu ? Le compte à rebours te dit si tu es dans les temps.</p>
    <div class="chips wrap mt12">${[30, 40, 45, 50, 60, 75, 90].map(m => `<button class="chip ${m === last ? "on" : ""}" data-a="dur-pick" data-v="${m}">${m} min</button>`).join("")}<button class="chip ${last === 0 ? "on" : ""}" data-a="dur-pick" data-v="0">Sans chrono</button></div>
    <label class="field mt12"><span>Ou une durée précise (minutes)</span><input id="dur-x" inputmode="numeric" placeholder="ex. 35"></label>
    <button class="btn btn-red mt16" data-a="dur-go">C'est parti</button>`, (w) => { w._go = onGo; w._min = last; });
}
actions["dur-express"] = (b, d) => { const w = document.getElementById("sheet"), go2 = w._go; update(st => st.settings.sessionMin = +d.v); closeSheet(); go2(+d.v, "express"); };
actions["dur-pick"] = (b, d) => { const w = document.getElementById("sheet"); w._min = +d.v; w.querySelectorAll('[data-a="dur-pick"]').forEach(x => x.classList.toggle("on", x === b)); w.querySelector("#dur-x").value = ""; };
actions["dur-go"] = () => { const w = document.getElementById("sheet"), x = num(w.querySelector("#dur-x").value); const min = x > 0 && x < 300 ? Math.round(x) : w._min; update(st => st.settings.sessionMin = min); const go2 = w._go, mode = w._mode || ""; closeSheet(); go2(min, mode); };
actions["mg-pick"] = (b, d) => { const w = document.getElementById("sheet"); w._mode = d.v; w.querySelectorAll('[data-a="mg-pick"]').forEach(x => x.classList.toggle("on", x === b)); if (d.v) w._min = Math.max(w._min || 0, d.v === "full" ? 90 : 75); w.querySelectorAll('[data-a="dur-pick"]').forEach(x => x.classList.toggle("on", +x.dataset.v === w._min)); };
// ---------- Corriger ou supprimer une séance faite ----------
let wEdit = null;
actions["w-edit"] = (b, d) => { const w = S().workouts.find(x => x.id === +d.id); if (!w) return; wEdit = JSON.parse(JSON.stringify(w)); wEditSheet(); };
function wEditSheet() {
  const w = wEdit, dt = new Date(w.end), loc = new Date(dt.getTime() - dt.getTimezoneOffset() * 6e4).toISOString();
  sheet(`<h2 class="h2">✏️ Corriger la séance</h2><input class="inp mt8" style="text-align:left;font-weight:700" value="${esc(w.title)}" data-c="we-title" aria-label="Nom de la séance">
    <div class="grid2 mt8"><label class="field"><span>Date</span><input type="date" value="${loc.slice(0, 10)}" data-c="we-date" max="${today()}"></label><label class="field"><span>Fin à</span><input type="time" value="${loc.slice(11, 16)}" data-c="we-time"></label></div>
    ${w.exercises.map((ex, ei) => `<div class="card mt12"><div class="row between"><b class="small">${esc(ex.name)}</b><button class="icon-btn sm" data-a="we-exdel" data-e="${ei}" aria-label="Retirer l'exercice">${I.close}</button></div>
      ${ex.sets.map((st, si) => st.type === "W" && !st.done ? "" : `<div class="row mt8" style="gap:5px"><button class="rk" data-a="we-done" data-e="${ei}" data-s="${si}" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--line);background:${st.done ? "var(--gradbtn)" : "var(--paper)"};color:#fff;flex:none" aria-label="Série faite">${st.done ? "✓" : ""}</button><span class="xs muted" style="width:18px;text-align:center">${st.type === "W" ? "É" : ex.sets.slice(0, si + 1).filter(x => x.type !== "W").length}</span>${ex.bw ? "" : `<input class="inp" style="width:74px" inputmode="decimal" value="${st.kg ?? ""}" data-c="we-kg" data-e="${ei}" data-s="${si}" aria-label="Charge"><span class="xs muted">kg</span>`}<input class="inp" style="width:60px" inputmode="numeric" value="${st.reps ?? ""}" data-c="we-reps" data-e="${ei}" data-s="${si}" aria-label="Répétitions"><span class="xs muted">${ex.unit === "s" ? "s" : "rép."}</span><button class="icon-btn sm" data-a="we-sdel" data-e="${ei}" data-s="${si}" aria-label="Retirer la série" style="margin-left:auto">${I.close}</button></div>`).join("")}
      <button class="link xs mt8" data-a="we-sadd" data-e="${ei}">+ Ajouter une série</button></div>`).join("")}
    <button class="btn btn-red mt16" data-a="we-save">Enregistrer les corrections</button><button class="btn btn-ghost mt8" data-a="w-del" data-id="${w.id}" style="color:var(--red)">🗑️ Supprimer la séance</button>`, null, { keep: true });
}
const weSet = (el) => wEdit.exercises[+el.dataset.e].sets[+el.dataset.s];
changes["we-title"] = (el) => { wEdit.title = el.value.trim() || wEdit.title; };
changes["we-kg"] = (el) => { const v = num(el.value); weSet(el).kg = v > 0 ? v : null; };
changes["we-reps"] = (el) => { const v = num(el.value); weSet(el).reps = v > 0 ? Math.round(v) : null; };
const weMove = () => { const d = document.querySelector('[data-c="we-date"]')?.value, t = document.querySelector('[data-c="we-time"]')?.value || "12:00"; if (!d) return; const dur = new Date(wEdit.end) - new Date(wEdit.start), end = new Date(`${d}T${t}:00`); wEdit.end = end.toISOString(); wEdit.start = new Date(end - dur).toISOString(); };
changes["we-date"] = weMove; changes["we-time"] = weMove;
actions["we-done"] = (b, d) => { const s = wEdit.exercises[+d.e].sets[+d.s]; s.done = !s.done; wEditSheet(); };
actions["we-sdel"] = (b, d) => { wEdit.exercises[+d.e].sets.splice(+d.s, 1); wEditSheet(); };
actions["we-sadd"] = (b, d) => { const ex = wEdit.exercises[+d.e], l = ex.sets.filter(s => s.type !== "W").at(-1) || { kg: null, reps: 8 }; ex.sets.push({ ...l, type: "N", done: true, tech: [], note: "" }); wEditSheet(); };
actions["we-exdel"] = (b, d) => { if (!confirm("Retirer cet exercice de la séance ?")) return; wEdit.exercises.splice(+d.e, 1); wEditSheet(); };
actions["we-save"] = () => { weMove(); E.saveWorkout(wEdit); wEdit = null; closeSheet(); pushStats(); toast("Séance corrigée"); rerender(); };
actions["w-del"] = (b, d) => { if (!confirm("Supprimer cette séance ? Ses séries seront effacées de ton historique.")) return; E.deleteWorkout(+d.id); wEdit = null; closeSheet(); pushStats(); toast("Séance supprimée"); rerender(); };
actions["dur-change"] = () => durationSheet((min) => { update(st => st.current.target = min); rerender(); }, "Changer la durée");
actions.resume = () => { sessionStorage.removeItem("cxs.min"); go("workout"); };
actions.minimize = () => { sessionStorage.setItem("cxs.min", "1"); go("home"); };

routes.workout = async () => {
  const cur = S().current; if (!cur) return go("train");
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  sessionStorage.removeItem("cxs.min");
  const doneSets = cur.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0), all = cur.exercises.reduce((a, e) => a + e.sets.length, 0);
  $app.innerHTML = `<header class="top"><div class="row1"><button class="icon-btn" data-a="minimize" aria-label="Réduire">${I.back}</button><h1 style="font-size:20px">${esc(cur.title)}</h1><button class="btn btn-red btn-sm" data-a="finish" style="width:auto">Terminer</button></div>
      <div class="sub">${cur.target ? `<button class="link" data-a="dur-change" style="color:inherit">⏳ <span id="clock">0:00</span></button>` : `⏱️ <span id="clock">0:00</span>`} · ${doneSets}/${all} séries${cur.free ? "" : ` · semaine ${cur.week} · ${esc(cur.phase)}`}</div>
      ${cur.target ? `<div class="tbar"><i id="tbar"></i></div><div class="xs" id="tpace" style="margin-top:4px"></div>` : ""}</header>
    <main class="page" style="padding-bottom:200px">
    ${cur.comeback ? `<p class="small red">Reprise après une pause : charges allégées de 10 % aujourd'hui.</p>` : ""}
    <div class="row between small muted"><span>${adv() ? "Mode avancé : % et RPE visibles" : "RPE visible · % masqués"}</span><button class="link" data-a="adv-toggle">${adv() ? "Simplifier" : "Afficher les %"}</button></div>
    ${cur.exercises.length > 1 ? `<button class="btn btn-line btn-sm mt8" data-a="ex-order" style="width:100%">↕️ Réorganiser les exercices</button>` : ""}
    ${cur.exercises.map((ex, xi) => exerciseBlock(ex, xi)).join("")}
    ${cur.exercises.length ? "" : `<p class="empty">Ajoute ton premier exercice.</p>`}
    <button class="btn btn-line mt16" data-a="add-ex">${I.plus.replace("<svg", '<svg width="20"')} Ajouter un exercice</button>
    <button class="btn btn-red mt12" data-a="finish">Terminer la séance</button></main>`;
  tickClock(); clearInterval(clockT); clockT = setInterval(tickClock, 1000);
  if (restEnd > Date.now()) showRest();
};
const mmss = (s) => `${s < 0 ? "−" : ""}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, "0")}`;
function tickClock() {
  const c = document.getElementById("clock"), cur = S().current; if (!c || !cur) return clearInterval(clockT);
  const s = Math.floor((Date.now() - new Date(cur.start)) / 1000);
  if (!cur.target) { c.textContent = mmss(s); return; }
  const left = cur.target * 60 - s; c.textContent = left >= 0 ? `${mmss(left)} restantes` : `${mmss(left)} de dépassement`;
  const bar = document.getElementById("tbar"); if (bar) { bar.style.width = `${Math.min(100, s / (cur.target * 60) * 100)}%`; bar.style.background = left < 0 ? "var(--warn)" : ""; }
  const sets = cur.exercises.flatMap(e => e.sets.filter(x => x.type !== "W")), done = sets.filter(x => x.done).length;
  const p = document.getElementById("tpace"); if (p && sets.length) { const should = Math.round(sets.length * s / (cur.target * 60)), diff = done - should; const perSet = cur.target * 60 / sets.length; p.textContent = diff >= 1 ? `En avance de ${Math.round(diff * perSet / 60)} min` : diff <= -1 ? `En retard de ${Math.round(-diff * perSet / 60)} min · raccourcis tes repos` : "Dans les temps"; p.style.color = diff <= -2 ? "var(--warn)" : ""; }
}
function targetTxt(ex) {
  return E.parseScheme(ex.scheme).map(g => `${g.sets}×${g.lo}${g.hi !== g.lo ? "-" + g.hi : ""}${g.pct && adv() ? ` à ${g.pct} %` : ""}${g.rpe ? ` RPE ${String(g.rpe).replace(".", ",")}` : ""}${g.ds ? " + dégressive" : ""}`).join(" puis ");
}
function exerciseBlock(ex, xi) {
  const unit = ex.unit === "s" ? "Sec" : "Reps";
  let n = 0;
  const L = E.lastExercise(ex.name), prevW = L ? L.ex.sets.filter(s => s.done && s.type !== "W") : [], prevWu = L ? L.ex.sets.filter(s => s.done && s.type === "W") : [];
  const prevTxt = (s) => s ? `${s.kg ? kgTxt(s.kg) + " kg × " : ""}${s.reps ?? "–"}${ex.unit === "s" ? " s" : ""}${s.rpe != null ? ` @${String(s.rpe).replace(".", ",")}` : ""}${s.type && s.type !== "N" && s.type !== "W" ? ` · ${E.SET_TYPES[s.type]}` : ""}${(s.tech || []).length ? ` · ${s.tech.join(", ")}` : ""}${s.note ? ` · « ${s.note} »` : ""}` : "";
  let wi = 0, wu = 0;
  const stall = E.stalls().find(x => x.name === ex.name);
  const sugBox = ex.sug ? (premium() ? `<div class="sug">💡 <b>Suggestion</b> · ${esc(ex.sug.txt)}<br><span class="xs muted">Dernière fois : ${esc(ex.sug.last)}</span></div>` : `<div class="sug">💡 Dernière fois : <b>${esc(ex.sug.last)}</b> <button class="lock" data-a="go" data-r="offers" style="margin-left:4px">🔒 Suggestion Premium</button></div>`) : "";
  return `<article class="card ex"><div class="head"><div class="grow">
      <div>${ex.ss ? `<span class="tag r">Superset ${esc(ex.ss)}</span>` : ""}<span class="tag">${E.KIND_LABEL[ex.kind] || ex.kind}</span>${ex.tempo ? `<span class="tag">Tempo ${esc(ex.tempo)}</span>` : ""}<span class="tag">⏱️ ${Math.floor(ex.rest / 60)}:${String(ex.rest % 60).padStart(2, "0")}</span></div>
      <h3 class="mt8">${esc(ex.name)}</h3><div class="xs muted mt4">🎯 ${targetTxt(ex)}${ex.name !== ex.orig ? ` · remplace ${esc(ex.orig)}` : ""}${adv() && ex.e1 ? ` · e1RM ${fr(ex.e1)} kg` : ""}</div>
      ${!ex.bw && ex.sets.every(s => !s.kg) ? `<div class="xs mt8 red">Première fois : choisis une charge qui te laisse 2 à 3 répétitions en réserve. L'app calcule la suite.</div>` : ""}
      ${ex.note ? `<div class="xs mt8">📝 ${esc(ex.note)}</div>` : ""}</div></div>
    <div class="acts"><button data-a="go" data-r="fiche" data-p="${esc(ex.name)}">📖 Fiche</button><button data-a="ex-swap" data-x="${xi}">🔄 Remplacer</button><button data-a="ex-prog" data-x="${xi}">📈 Progression</button><button data-a="ex-rest" data-x="${xi}">⏱️ Repos</button><button data-a="ex-more" data-x="${xi}">${I.dots.replace("<svg", '<svg width="18"')}</button></div>
    ${sugBox}
    ${L ? `<details class="prevbox"><summary>↺ La dernière fois · ${fmtDate(today(new Date(L.date)), { weekday: "short", day: "numeric", month: "short" })}${L.week ? ` · semaine ${L.week}` : ""}</summary><div class="xs mt4">${L.ex.sets.filter(s => s.done).map((s, i) => `<div>${s.type === "W" ? "Échauf." : "Série " + (L.ex.sets.filter(x => x.done && x.type !== "W").indexOf(s) + 1)} : ${esc(prevTxt(s))}</div>`).join("")}${L.ex.myNote ? `<div class="mt4">📝 ${esc(L.ex.myNote)}</div>` : ""}</div></details>` : ""}
    ${stall ? `<div class="sug" style="box-shadow:0 0 0 1.5px var(--warn) inset">📹 <b>Tu bloques sur cet exercice depuis ${stall.weeks} semaines.</b> Filme une série de profil et envoie-la à Thomas : il corrige ta technique et ajuste ta progression. <button class="link xs" data-a="stall-video" data-n="${esc(ex.name)}">Envoyer une vidéo</button></div>` : ""}
    <div class="sethead"><span>Série</span><span>${ex.bw ? "Lest" : "Kg"}</span><span>${unit}</span><span>RPE</span><span></span></div>
    ${ex.sets.map((s, si) => {
      const lab = s.type === "W" ? "É" : String(++n);
      const pv = s.type === "W" ? prevWu[wu++] : prevW[wi++];
      const meta = [s.type !== "N" ? `<span class="tag ${s.type === "W" ? "" : "r"}">${E.SET_TYPES[s.type]}</span>` : "", ...(s.tech || []).map(t => `<span class="tag">${(E.TECHS.find(x => x[1] === t) || ["⚡"])[0]} ${esc(t)}</span>`), `<span>${s.lo !== s.hi ? `${s.lo}-${s.hi}` : s.lo} ${unit.toLowerCase()} · RPE ${String(s.trpe).replace(".", ",")}${adv() && s.pct ? ` · ${s.pct} %` : ""}</span>`, s.pain ? `<span class="tag" style="background:var(--warn);color:#fff">Douleur</span>` : "", s.note ? `<span>📝 ${esc(s.note)}</span>` : "", pv ? `<span class="prev">↺ ${esc(prevTxt(pv))}</span>` : ""].filter(Boolean).join("");
      return `<div class="set ${s.done ? "done" : ""} ${s.type === "W" ? "w" : ""}"><button class="n" data-a="set-menu" data-x="${xi}" data-s="${si}" aria-label="Options de la série">${lab}${s.type !== "N" ? `<small>${s.type === "W" ? "échauf." : E.SET_TYPES[s.type].split(" ")[0].toLowerCase()}</small>` : ""}</button>
        <input inputmode="decimal" data-i="set" data-k="kg" data-x="${xi}" data-s="${si}" value="${ex.bw ? kgTxt(s.kg || "") : kgTxt(s.kg)}" placeholder="${ex.bw ? "PDC" : "kg"}" aria-label="Charge">
        <input inputmode="numeric" data-i="set" data-k="reps" data-x="${xi}" data-s="${si}" value="${s.reps ?? ""}" placeholder="${s.lo}" aria-label="${unit}">
        <button class="rpe-btn ${s.rpe == null ? "ph" : ""}" data-a="rpe-pick" data-x="${xi}" data-s="${si}" aria-label="RPE de la série">${s.rpe != null ? String(s.rpe).replace(".", ",") : String(s.trpe).replace(".", ",")}</button>
        <button class="tick" data-a="tick" data-x="${xi}" data-s="${si}" aria-label="Valider la série">${I.check}</button>
        <div class="setmeta">${meta}</div></div>`;
    }).join("")}
    <div class="row mt8" style="gap:8px"><button class="btn btn-ghost btn-xs" data-a="add-set" data-x="${xi}">+ Série</button><button class="btn btn-ghost btn-xs" data-a="add-set" data-x="${xi}" data-t="W">+ Échauffement</button></div>
    <label class="field mt8"><span>📝 Note sur l'exercice (réglages, sensations, douleur…)</span><textarea rows="1" data-i="exnote" data-x="${xi}" placeholder="Ex. siège cran 4, gêne épaule droite">${esc(ex.myNote || "")}</textarea></label>
  </article>`;
}
changes["i:set"] = (el) => {
  const ex = S().current.exercises[+el.dataset.x], si = +el.dataset.s, s = ex.sets[si], k = el.dataset.k;
  const v = num(el.value);
  if (k === "kg") { s.kg = isNaN(v) ? null : v; ex.sets.forEach((o, i) => { if (i > si && !o.done && o.g === s.g && o.type === s.type) o.kg = s.kg; }); if (ex.e1 && s.kg) s.pct = Math.round(s.kg / ex.e1 * 100); }
  else if (k === "reps") s.reps = isNaN(v) ? null : Math.round(v);
  else s.rpe = isNaN(v) ? null : Math.min(10, Math.max(5, v));
  save();
};
changes["i:exnote"] = (el) => { S().current.exercises[+el.dataset.x].myNote = el.value; save(); };
changes["i:setnote"] = (el) => { S().current.exercises[+el.dataset.x].sets[+el.dataset.s].note = el.value; save(); };
// Effort de la série : on choisit, on n'écrit pas
export const RPE_INFO = { 6: ["Facile", "4 rép. ou plus en réserve"], 6.5: ["Facile à modéré", "3 à 4 rép. en réserve"], 7: ["Modéré", "3 rép. en réserve"], 7.5: ["Assez dur", "2 à 3 rép. en réserve"], 8: ["Dur", "2 rép. en réserve"], 8.5: ["Très dur", "1 à 2 rép. en réserve"], 9: ["Effort extrême", "1 rép. en réserve"], 9.5: ["Presque maximal", "peut-être 1 rép. de plus"], 10: ["Effort maximal", "aucune rép. en réserve"] };
const RPE_STEPS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
let rpeSel = null;
function rpeSheet(xi, si) {
  const s = S().current.exercises[xi].sets[si], v = rpeSel ?? s.rpe ?? s.trpe ?? 8, info = RPE_INFO[v] || ["", ""];
  sheet(`<h2 class="h3 center">Effort de la série (RPE)</h2><div class="rpe-big">${String(v).replace(".", ",")}</div><p class="center mt8" style="margin-bottom:0"><b>${info[0]}</b></p><p class="small muted center" style="margin-top:4px">${info[1]}</p>
    <div class="rpe-seg">${RPE_STEPS.map(r => `<button class="${r === v ? "on" : ""}" data-a="rpe-set" data-x="${xi}" data-s="${si}" data-v="${r}">${String(r).replace(".", ",")}</button>`).join("")}</div>
    ${s.trpe ? `<p class="xs muted center mt8">Prévu : RPE ${String(s.trpe).replace(".", ",")}</p>` : ""}
    <div class="row mt16" style="gap:8px"><button class="btn btn-line" style="flex:0 0 34%" data-a="rpe-clear" data-x="${xi}" data-s="${si}">Effacer</button><button class="btn btn-red grow" data-a="rpe-ok" data-x="${xi}" data-s="${si}">Terminé</button></div>`, null, { keep: !!document.getElementById("sheet") });
}
actions["rpe-pick"] = (b, d) => { rpeSel = null; rpeSheet(+d.x, +d.s); };
actions["rpe-set"] = (b, d) => { rpeSel = +d.v; buzz(8); rpeSheet(+d.x, +d.s); };
actions["rpe-ok"] = (b, d) => { const s = S().current.exercises[+d.x].sets[+d.s]; s.rpe = rpeSel ?? s.rpe ?? s.trpe; rpeSel = null; save(); closeSheet(); rerender(); };
actions["rpe-clear"] = (b, d) => { S().current.exercises[+d.x].sets[+d.s].rpe = null; rpeSel = null; save(); closeSheet(); rerender(); };
actions["adv-toggle"] = () => { update(st => st.settings.adv = !adv()); rerender(); };
actions.tick = (b, d) => {
  const ex = S().current.exercises[+d.x], s = ex.sets[+d.s];
  s.done = !s.done;
  if (s.done && s.reps == null) s.reps = s.lo;
  save(); buzz(s.done ? 18 : 8); rerender();
  if (s.done) startRest(s.type === "W" ? 60 : ex.rest);
};
actions["add-set"] = (b, d) => {
  const ex = S().current.exercises[+d.x];
  if (d.t === "W") { const top = ex.sets.find(s => s.type !== "W")?.kg; const w = ex.sets.filter(s => s.type === "W").length; ex.sets.splice(w, 0, { g: -1, type: "W", kg: top ? E.roundTo(top * .5, ex.step) : null, reps: 8, lo: 8, hi: 8, trpe: 5, rpe: null, pct: null, tech: [], note: "", done: false }); }
  else { const l = ex.sets.filter(s => s.type !== "W").at(-1) || ex.sets.at(-1); ex.sets.push({ ...l, type: l?.type === "T" ? "B" : (l?.type || "N"), tech: [...(l?.tech || [])], note: "", done: false, rpe: null, pain: false }); }
  save(); closeSheet(); rerender();
};
actions["ex-prog"] = (b, d) => progSheet(+d.x);
function progSheet(xi) {
  const ex = S().current.exercises[xi], e1 = Math.round(E.currentE1rm(ex.name) * 10) / 10, st = ex.step || 2.5, pending = ex.sets.filter(s => !s.done && s.type !== "W");
  const last = ex.sug?.last;
  sheet(`<h2 class="h2">📈 ${esc(ex.name)}</h2>${last ? `<p class="small muted mt4">Dernière fois : ${esc(last)}</p>` : ""}${ex.sug && premium() ? `<div class="sug">💡 ${esc(ex.sug.txt)}</div>` : ""}
    <div class="lbl mt12">Aujourd'hui · ${pending.length} série${pending.length > 1 ? "s" : ""} à faire</div>
    ${ex.bw ? `<p class="small muted">Exercice au poids du corps : joue sur les répétitions ou ajoute du lest dans le carnet.</p>` : `<div class="row mt8" style="gap:6px">${[-2, -1, 1, 2].map(k => `<button class="btn btn-line btn-sm grow" data-a="pg-kg" data-x="${xi}" data-v="${k * st}">${k > 0 ? "+" : "−"}${E.fmtKg(Math.abs(k * st))} kg</button>`).join("")}</div>`}
    <div class="row mt8" style="gap:6px"><button class="btn btn-line btn-sm grow" data-a="pg-rep" data-x="${xi}" data-v="-1">−1 rep</button><button class="btn btn-line btn-sm grow" data-a="pg-rep" data-x="${xi}" data-v="1">+1 rep</button><button class="btn btn-line btn-sm grow" data-a="pg-set" data-x="${xi}">+1 série</button></div>
    ${ex.bw ? "" : `<div class="lbl mt16">Mon 1RM estimé · ${e1 ? E.fmtKg(e1) + " kg" : "pas encore connu"}</div>
    <p class="xs muted mt4">Il sert à calculer toutes tes charges sur cet exercice. Ajuste-le si les charges proposées sont trop légères ou trop lourdes : les prochaines séances suivent.</p>
    ${e1 ? `<div class="row mt8" style="gap:6px">${[-5, -2.5, 2.5, 5].map(v => `<button class="btn btn-line btn-sm grow" data-a="pg-e1" data-x="${xi}" data-v="${v}">${v > 0 ? "+" : "−"}${E.fmtKg(Math.abs(v))} kg</button>`).join("")}</div>` : `<p class="small">Fais une première série : l'app le calcule tout de suite après.</p>`}`}
    <button class="btn btn-red mt16" data-a="set-close">OK</button>`);
}
actions["pg-kg"] = (b, d) => { const ex = S().current.exercises[+d.x]; ex.sets.forEach(s => { if (!s.done && s.type !== "W") s.kg = E.roundTo((s.kg || 0) + +d.v, ex.step || 2.5); }); save(); toast(`${+d.v > 0 ? "+" : ""}${E.fmtKg(+d.v)} kg sur les séries restantes`); rerender(); progSheet(+d.x); };
actions["pg-rep"] = (b, d) => { const ex = S().current.exercises[+d.x]; ex.sets.forEach(s => { if (!s.done && s.type !== "W") { s.reps = Math.max(1, (s.reps || s.lo) + +d.v); s.lo = Math.max(1, s.lo + +d.v); s.hi = Math.max(s.lo, s.hi + +d.v); } }); save(); rerender(); progSheet(+d.x); };
actions["pg-set"] = (b, d) => { actions["add-set"](b, { x: d.x }); progSheet(+d.x); };
actions["pg-e1"] = (b, d) => {
  const ex = S().current.exercises[+d.x], v = E.nudgeE1rm(ex.name, +d.v); if (!v) return;
  const old = ex.e1 || v; ex.e1 = v;
  ex.sets.forEach(s => { if (!s.done && s.kg) { s.kg = E.roundTo(s.kg * v / old, ex.step || 2.5); if (s.pct) s.pct = Math.round(s.kg / v * 100); } });
  save(); toast(`1RM estimé : ${E.fmtKg(v)} kg, charges recalculées`); rerender(); progSheet(+d.x);
};
actions["ex-rest"] = (b, d) => {
  const ex = S().current.exercises[+d.x];
  sheet(`<h2 class="h2">Temps de repos</h2><p class="small muted">${esc(ex.name)}</p><div class="chips wrap mt12">${[45, 60, 75, 90, 120, 150, 180, 240, 300].map(x => `<button class="chip ${ex.rest === x ? "on" : ""}" data-a="ex-rest-set" data-x="${d.x}" data-v="${x}">${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}</button>`).join("")}</div><p class="xs muted mt12">Le minuteur démarre tout seul dès que tu valides une série.</p>`);
};
actions["ex-rest-set"] = (b, d) => { S().current.exercises[+d.x].rest = +d.v; save(); closeSheet(); rerender(); };
actions["ex-more"] = (b, d) => {
  const xi = +d.x, ex = S().current.exercises[xi], L = S().current.exercises.length;
  sheet(`<h2 class="h2">${esc(ex.name)}</h2><div class="list mt12">
    ${xi > 0 ? `<button class="li" data-a="ex-move" data-x="${xi}" data-v="-1"><span class="grow">⬆️ Monter</span></button>` : ""}
    ${xi < L - 1 ? `<button class="li" data-a="ex-move" data-x="${xi}" data-v="1"><span class="grow">⬇️ Descendre</span></button>` : ""}
    <button class="li" data-a="ex-tech" data-x="${xi}"><span class="grow">⚡ Technique sur toutes les séries</span>${I.chev}</button>
    <button class="li" data-a="ex-del" data-x="${xi}"><span class="grow" style="color:var(--red)">🗑️ Retirer de la séance</span></button></div>`);
};
actions["ex-order"] = () => orderSheet();
function orderSheet() {
  const a = S().current.exercises;
  sheet(`<h2 class="h2">Réorganiser</h2><p class="small muted">Change l'ordre de ta séance : machine prise, envie de commencer par un autre mouvement.</p>
    <div class="list mt12">${a.map((ex, i) => `<div class="li" style="gap:6px"><span class="num" style="width:22px">${i + 1}</span><span class="grow small"><b>${esc(ex.name)}</b><br><span class="xs muted">${ex.sets.filter(s => s.done).length}/${ex.sets.length} séries</span></span><button class="icon-btn" data-a="ord-mv" data-x="${i}" data-v="-1" ${i === 0 ? "disabled style=\"opacity:.3\"" : ""} aria-label="Monter">↑</button><button class="icon-btn" data-a="ord-mv" data-x="${i}" data-v="1" ${i === a.length - 1 ? "disabled style=\"opacity:.3\"" : ""} aria-label="Descendre">↓</button></div>`).join("")}</div>
    <button class="btn btn-red mt12" data-a="set-close">Terminé</button>`);
}
actions["ord-mv"] = (b, d) => { const a = S().current.exercises, i = +d.x, j = i + +d.v; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); orderSheet(); };
actions["ex-move"] = (b, d) => { const a = S().current.exercises, i = +d.x, j = i + +d.v; [a[i], a[j]] = [a[j], a[i]]; save(); closeSheet(); rerender(); };
actions["ex-del"] = (b, d) => { if (!confirm("Retirer cet exercice de la séance ?")) return; S().current.exercises.splice(+d.x, 1); save(); closeSheet(); rerender(); };
actions["ex-tech"] = (b, d) => {
  sheet(`<h2 class="h2">Technique d'intensification</h2><p class="small muted">S'applique à toutes les séries de travail.</p><div class="chips wrap mt12">${E.TECHS.map(([e, t]) => `<button class="chip" data-a="ex-tech-set" data-x="${d.x}" data-v="${esc(t)}">${e} ${esc(t)}</button>`).join("")}</div>`);
};
actions["ex-tech-set"] = (b, d) => { S().current.exercises[+d.x].sets.forEach(s => { if (s.type !== "W" && !s.tech.includes(d.v)) s.tech.push(d.v); }); save(); closeSheet(); rerender(); };
function setMenu(xi, si) {
  const ex = S().current.exercises[xi], s = ex.sets[si];
  sheet(`<h2 class="h2">Série ${si + 1} · ${esc(ex.name)}</h2>
    <div class="lbl mt12">Type de série</div><div class="chips wrap mt8">${Object.entries(E.SET_TYPES).map(([k, l]) => `<button class="chip ${s.type === k ? "on" : ""}" data-a="set-type" data-x="${xi}" data-s="${si}" data-v="${k}">${l}</button>`).join("")}</div>
    <div class="lbl mt16">Techniques</div><div class="chips wrap mt8">${E.TECHS.map(([e, t]) => `<button class="chip ${s.tech.includes(t) ? "on" : ""}" data-a="set-tech" data-x="${xi}" data-s="${si}" data-v="${esc(t)}">${e} ${esc(t)}</button>`).join("")}</div>
    <label class="field mt16"><span>📝 Note sur cette série</span><textarea data-i="setnote" data-x="${xi}" data-s="${si}" rows="2" placeholder="Ex. dernière rep lente, prise large">${esc(s.note || "")}</textarea></label>
    <div class="li mt8" style="padding:8px 0"><span class="grow">🩹 Douleur ou gêne</span><button class="switch ${s.pain ? "on" : ""}" data-a="set-pain" data-x="${xi}" data-s="${si}" aria-label="Douleur"></button></div>
    <div class="row mt12" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="set-dup" data-x="${xi}" data-s="${si}">Dupliquer</button><button class="btn btn-line btn-sm grow" data-a="set-del" data-x="${xi}" data-s="${si}" style="color:var(--red)">Supprimer</button></div>
    <button class="btn btn-red mt12" data-a="set-close">OK</button>`);
}
actions["set-menu"] = (b, d) => setMenu(+d.x, +d.s);
actions["set-type"] = (b, d) => { const s = S().current.exercises[+d.x].sets[+d.s]; s.type = d.v; if (d.v === "W") s.trpe = 5; save(); setMenu(+d.x, +d.s); };
actions["set-tech"] = (b, d) => { const s = S().current.exercises[+d.x].sets[+d.s]; s.tech = s.tech.includes(d.v) ? s.tech.filter(t => t !== d.v) : [...s.tech, d.v]; save(); setMenu(+d.x, +d.s); };
actions["set-pain"] = (b, d) => { const s = S().current.exercises[+d.x].sets[+d.s]; s.pain = !s.pain; save(); setMenu(+d.x, +d.s); };
actions["set-dup"] = (b, d) => { const a = S().current.exercises[+d.x].sets; a.splice(+d.s + 1, 0, { ...a[+d.s], tech: [...a[+d.s].tech], done: false, rpe: null }); save(); closeSheet(); rerender(); };
actions["set-del"] = (b, d) => { S().current.exercises[+d.x].sets.splice(+d.s, 1); save(); closeSheet(); rerender(); };
actions["set-close"] = () => { closeSheet(); rerender(); };

// Choisir un exercice : recherche par nom ou par muscle, filtres muscle et matériel, fiche, exercice perso
const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/[-'’]/g, " ");
// Les mots qu'on tape vraiment pour chercher un muscle
const MUS_ALIAS = { "Pecs": "pectoraux poitrine pec", "Dos-largeur": "dos dorsaux dorsal grand dorsal lats largeur", "Dos-épaisseur": "dos epaisseur rhomboides milieu du dos", "Épaules-avant": "epaules epaule deltoide anterieur", "Épaules-latéral": "epaules epaule deltoide lateral", "Épaules-arrière": "epaules epaule deltoide posterieur arriere coiffe", "Trapèzes": "trapeze trap", "Biceps": "bras biceps", "Triceps": "bras triceps", "Avant-bras": "avant bras poignet prise grip", "Abdos": "abdominaux abdos ventre sangle gainage obliques core", "Lombaires": "bas du dos lombaires erecteurs", "Quadriceps": "jambes cuisses quadri quads", "Ischios": "jambes ischio jambiers ischios arriere cuisse", "Fessiers": "fesses fessier glutes", "Adducteurs": "adducteurs interieur cuisse", "Mollets": "mollet jambes", "Cou": "cou nuque", "Mobilite": "mobilite etirement souplesse", "Mobilité": "mobilite etirement souplesse echauffement", "Cardio": "cardio endurance conditionnement" };
const pk = { cb: null, title: "", q: "", mus: "", eq: "", multi: false, added: 0, pre: null };
export function filterExercises(q, mus, eq, pre = null) {
  const terms = nrm(q).split(/\s+/).filter(t => t.length > 1);
  const list = pre || E.allExercises();
  const qq = nrm(q).trim();
  const score = (n) => { const nn = nrm(n), m0 = E.musclesOf(n)[0]; let s = 0; if (qq && nn === qq) s += 20; else if (qq && nn.startsWith(qq)) s += 6; if (terms.every(t => nn.includes(t))) s += 4; if (terms.some(t => nrm(m0 + " " + (MUS_ALIAS[m0] || "")).includes(t))) s += 2; if (mus && m0 === mus) s += 2; return s; };
  const out = list.filter(n => {
    const ms = E.musclesOf(n);
    if (mus && !ms.includes(mus)) return false;
    if (eq && E.equipOf(n) !== eq) return false;
    if (!terms.length) return true;
    const hay = nrm(n + " " + ms.map(m => m + " " + (MUS_ALIAS[m] || "")).join(" ") + " " + E.equipOf(n));
    return terms.every(t => hay.includes(t) || hay.includes(t.replace(/s$/, "")));
  });
  return terms.length || mus ? out.map(n => [score(n), n]).sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1], "fr")).map(x => x[1]) : out;
}
export function pickExercise(cb, title = "Ajouter un exercice", opts = {}) {
  Object.assign(pk, { cb, title, multi: !!opts.multi, added: 0, pre: opts.pre || null }, opts.keep ? {} : { q: "", mus: opts.mus || "", eq: "" });
  drawPicker();
}
function drawPicker() {
  sheet(`<div class="row between"><h2 class="h2">${esc(pk.title)}</h2>${pk.multi ? `<button class="btn btn-red btn-xs" data-a="pick-done" style="width:auto">Terminé${pk.added ? ` (${pk.added})` : ""}</button>` : ""}</div>
    <div class="search mt12">${I.search}<input id="pq" placeholder="Nom ou muscle : squat, dorsaux, triceps…" autocomplete="off" value="${esc(pk.q)}"></div>
    <div class="mt8">${chips([["", "Tous les muscles"], ...E.MUSCLES.map(m => [m, m])], pk.mus, "pick-mus")}</div>
    <div class="mt4">${chips([["", "Tout le matériel"], ...E.EQUIP.map(m => [m, m])], pk.eq, "pick-eq")}</div>
    <div id="pl" class="mt12"></div>`, (w) => {
    const inp = w.querySelector("#pq");
    inp.addEventListener("input", () => { pk.q = inp.value; drawPickList(); });
    drawPickList();
    w.querySelectorAll(".chips").forEach(r => { const on = r.querySelector(".chip.on"); if (on) r.scrollLeft = on.offsetLeft - 16; });
  });
}
function drawPickList() {
  const box = document.getElementById("pl"); if (!box) return;
  const r = filterExercises(pk.q, pk.mus, pk.eq, pk.pre);
  box.innerHTML = `<p class="xs muted">${r.length} exercice${r.length > 1 ? "s" : ""}</p>` + (r.length ? `<div class="list">${r.slice(0, 150).map(n => `<div class="li" style="gap:6px"><button class="grow" style="text-align:left" data-a="pick-ex" data-n="${esc(n)}"><span class="small"><b>${esc(n)}</b></span><br><span class="xs muted">${esc(E.musclesOf(n).join(" · "))} · ${esc(E.equipOf(n))}</span></button><button class="icon-btn" data-a="pick-fiche" data-n="${esc(n)}" aria-label="Fiche technique">📖</button><button class="icon-btn" data-a="pick-ex" data-n="${esc(n)}" aria-label="Choisir">${I.plus.replace("<svg", '<svg width="18"')}</button></div>`).join("")}</div>` : `<p class="empty small">Aucun exercice.</p>`)
    + `<button class="btn btn-line btn-sm mt12" data-a="pick-new" style="width:100%">＋ Créer mon exercice${pk.q ? ` « ${esc(pk.q)} »` : ""}</button>`;
}
actions["pick-mus"] = (b, d) => { pk.mus = d.v; drawPicker(); };
actions["pick-eq"] = (b, d) => { pk.eq = d.v; drawPicker(); };
actions["pick-ex"] = (b, d) => {
  if (pk.multi) { pk.cb?.(d.n); pk.added++; toast(`${d.n} ajouté`); b.closest(".li").style.opacity = ".5"; const t = document.querySelector('[data-a="pick-done"]'); if (t) t.textContent = `Terminé (${pk.added})`; return; }
  closeSheet(); pk.cb?.(d.n);
};
actions["pick-done"] = () => { closeSheet(); rerender(); };
// Fiche technique dans la fenêtre, avec retour à la liste
actions["pick-fiche"] = (b, d) => ficheSheet(d.n, true);
export function ficheSheet(name, backToPicker = false) {
  const f = E.ficheOf(name), fam = f?.fam || {};
  const li = (v) => Array.isArray(v) ? `<ul class="small" style="padding-left:18px;margin:6px 0">${v.map(x => `<li>${esc(typeof x === "string" ? x : Object.values(x).join(" : "))}</li>`).join("")}</ul>` : v ? `<p class="small" style="margin:6px 0">${esc(v)}</p>` : "";
  sheet(`${backToPicker ? `<button class="link small" data-a="pick-back">← Retour à la liste</button>` : ""}
    <h2 class="h2 mt8" style="color:var(--red)">${esc(name)}</h2><p class="small muted">${esc(E.musclesOf(name).join(" · "))} · ${esc(E.equipOf(name))}${fam.nom ? ` · ${esc(fam.nom.split("(")[0].trim())}` : ""}</p>
    ${f?.video ? `<a class="btn btn-red btn-sm mt12" href="${esc(f.video)}" target="_blank" rel="noopener" style="width:100%">▶️ Voir la vidéo de Thomas</a>` : ""}
    ${f?.setup ? `<div class="lbl mt12">🛠️ Installation</div>${li(f.setup)}` : ""}${f?.cues?.length ? `<div class="lbl mt12">🎯 Points clés</div>${li(f.cues)}` : ""}
    ${fam.exec ? `<div class="lbl mt12">▶️ Exécution</div>${li(fam.exec)}` : ""}${fam.erreurs ? `<div class="lbl mt12">⚠️ Erreurs fréquentes</div>${li(fam.erreurs)}` : ""}${fam.resp ? `<div class="lbl mt12">🌬️ Respiration</div>${li(fam.resp)}` : ""}
    ${!f ? `<p class="small muted mt12">Exercice créé par toi.</p>` : ""}
    <div class="row mt16" style="gap:8px">${f && !E.isCustomExercise(name) ? `<button class="btn btn-line btn-sm grow" data-a="go" data-r="fiche" data-p="${esc(name)}">Fiche complète</button>` : ""}${backToPicker ? `<button class="btn btn-red btn-sm grow" data-a="pick-ex" data-n="${esc(name)}">Choisir</button>` : ""}</div>`);
}
actions["pick-back"] = () => { pickExercise(pk.cb, pk.title, { multi: pk.multi, keep: true, pre: pk.pre }); };
actions["pick-new"] = () => {
  sheet(`<button class="link small" data-a="pick-back">← Retour à la liste</button><h2 class="h2 mt8">Créer mon exercice</h2>
    <form data-f="new-ex" class="mt12"><label class="field"><span>Nom</span><input name="n" value="${esc(pk.q)}" required maxlength="60"></label>
    <div class="grid2 mt8"><label class="field"><span>Muscle principal</span><select name="m1">${E.MUSCLES.map(m => `<option ${m === pk.mus ? "selected" : ""}>${m}</option>`).join("")}</select></label><label class="field"><span>Muscle secondaire</span><select name="m2"><option value="">Aucun</option>${E.MUSCLES.map(m => `<option>${m}</option>`).join("")}</select></label></div>
    <div class="grid2 mt8"><label class="field"><span>Matériel</span><select name="eq">${E.EQUIP.map(m => `<option ${m === pk.eq ? "selected" : ""}>${m}</option>`).join("")}</select></label><label class="field"><span>Mesuré en</span><select name="unit"><option value="reps">Répétitions</option><option value="s">Secondes</option></select></label></div>
    <label class="field mt8"><span>Points clés (facultatif)</span><textarea name="cues" rows="2" placeholder="Un conseil par ligne"></textarea></label>
    <button class="btn btn-red mt12">Créer et choisir</button></form>`);
};
forms["new-ex"] = (v) => {
  const n = v.n.trim(); if (!n) return;
  if (E.allExercises().some(x => x.toLowerCase() === n.toLowerCase())) return toast("Cet exercice existe déjà : cherche-le dans la liste.");
  update(st => (st.customExercises = st.customExercises || []).push({ n, mus: [v.m1, v.m2].filter(Boolean), eq: v.eq, unit: v.unit === "s" ? "s" : undefined, cues: v.cues.split("\n").map(x => x.trim()).filter(Boolean), setup: "" }));
  toast("Exercice créé"); closeSheet(); pk.cb?.(n); if (pk.multi) pickExercise(pk.cb, pk.title, { multi: true, keep: true });
};
actions["add-ex"] = async () => {
  await Promise.all([E.loadFiches(), E.loadLib()]);
  pickExercise((n) => { S().current.exercises.push(E.blankExercise(n)); save(); rerender(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); });
};
actions["ex-swap"] = async (b, d) => {
  await Promise.all([E.loadFiches(), E.loadLib()]);
  const xi = +d.x, ex = S().current.exercises[xi], alts = E.alternatives(ex.name);
  sheet(`<h2 class="h2">Remplacer</h2><p class="small muted">${esc(ex.name)} · machine prise, douleur, matériel absent : les charges sont recalculées.</p>
    <button class="btn btn-red btn-sm mt8" data-a="swap-any" data-x="${xi}" style="width:100%">🔎 Chercher par nom ou par muscle</button>
    ${ex.name !== ex.orig ? `<button class="btn btn-line btn-sm mt8" data-a="swap" data-x="${xi}" data-n="${esc(ex.orig)}" style="width:100%">Revenir à ${esc(ex.orig)}</button>` : ""}
    ${alts.length ? `<h3 class="sec">Variantes proches <small>${esc(E.musclesOf(ex.name)[0] || "")}</small></h3><div class="list">${alts.slice(0, 16).map(n => `<div class="li" style="gap:6px"><button class="grow" style="text-align:left" data-a="swap" data-x="${xi}" data-n="${esc(n)}"><span class="small"><b>${esc(n)}</b></span><br><span class="xs muted">${esc(E.musclesOf(n).join(" · "))} · ${esc(E.equipOf(n))}</span></button><button class="icon-btn" data-a="fiche-sheet" data-n="${esc(n)}" aria-label="Fiche">📖</button></div>`).join("")}</div>` : ""}`);
};
function doSwap(xi, n) {
  const cur = S().current, ex = cur.exercises[xi];
  if (!cur.free && ex.kind !== "X") update(st => { if (n === ex.orig) delete st.swaps[ex.orig]; else st.swaps[ex.orig] = n; });
  const fresh = E.blankExercise(n);
  ex.name = n; ex.unit = fresh.unit; ex.bw = fresh.bw; ex.step = fresh.step; ex.e1 = fresh.e1; ex.sug = fresh.sug;
  ex.sets.forEach(s => { if (s.done) return; s.kg = fresh.bw ? null : fresh.e1 ? E.roundTo(s.type === "W" ? (fresh.sets[0].kg || 0) * .6 : E.loadFor(fresh.e1, s.lo, s.trpe), fresh.step) : fresh.sets[0].kg; s.pct = fresh.e1 && s.kg ? Math.round(s.kg / fresh.e1 * 100) : null; });
  save(); closeSheet(); rerender(); toast("Exercice remplacé, charges recalculées");
}
actions.swap = (b, d) => doSwap(+d.x, d.n);
actions["stall-video"] = (b, d) => { window.__prefill = `Salut Thomas, je bloque sur ${d.n} depuis plusieurs semaines. Voici ma vidéo de profil : `; sessionStorage.setItem("cxs.min", "1"); go("chat"); };
actions["stall-snooze"] = (b, d) => { E.snoozeStall(d.n); toast("Rappel masqué pendant 3 semaines"); rerender(); };
actions["swap-any"] = (b, d) => pickExercise((n) => doSwap(+d.x, n), "Remplacer par", { mus: E.musclesOf(S().current.exercises[+d.x].name)[0] || "" });
actions["fiche-sheet"] = (b, d) => ficheSheet(d.n);

// Minuteur de repos (démarre seul à la validation d'une série)
function showRest() {
  document.querySelector(".rest")?.remove();
  const v = null;
  const el = document.createElement("div"); el.className = "rest";
  el.className = "rest" + (sessionStorage.getItem("cxs.restBig") === "1" ? " big" : "");
  el.innerHTML = `<div class="row between" style="gap:8px"><div class="row" style="gap:8px;align-items:baseline"><span class="xs" style="opacity:.8">⏱️</span><span class="t" id="rest-t"></span></div><div class="row" style="gap:5px">${v ? `<button class="xp" data-a="rest-big" aria-label="Afficher le verset">${sessionStorage.getItem("cxs.restBig") === "1" ? "▾" : "✝ ▴"}</button>` : ""}<button class="btn btn-xs" data-a="rest-add" data-v="-15">−15</button><button class="btn btn-xs" data-a="rest-add" data-v="30">+30</button><button class="btn btn-xs" data-a="rest-skip">Passer</button></div></div><div class="bar"><i id="rest-bar"></i></div>`;
  document.body.append(el);
  const tick = () => {
    const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)), t = document.getElementById("rest-t"), b = document.getElementById("rest-bar");
    if (!t) return clearInterval(restT);
    t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; b.style.width = `${100 - left / restTotal * 100}%`;
    if (left <= 0) { clearInterval(restT); buzz([180, 90, 180]); el.remove(); }
  };
  clearInterval(restT); tick(); restT = setInterval(tick, 250);
}
function startRest(sec) { restTotal = sec; restEnd = Date.now() + sec * 1000; showRest(); }
actions["rest-add"] = (b, d) => { restEnd += +d.v * 1000; restTotal = Math.max(1, restTotal + +d.v); };
actions["rest-big"] = () => { const big = sessionStorage.getItem("cxs.restBig") !== "1"; sessionStorage.setItem("cxs.restBig", big ? "1" : "0"); showRest(); };
actions["rest-skip"] = () => { restEnd = 0; clearInterval(restT); document.querySelector(".rest")?.remove(); };
onLeave(() => { });

actions.finish = () => {
  const cur = S().current, n = cur.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  if (!n) { if (confirm("Aucune série validée. Abandonner cette séance ?")) { update(st => st.current = null); actions["rest-skip"](); go("home"); } return; }
  if (!confirm("Terminer la séance et enregistrer tes séries ?")) return;
  actions["rest-skip"](); clearInterval(clockT);
  E.finishSession(cur); pushStats(); go("done");
};
routes.done = () => {
  const w = S().workouts.at(-1); if (!w) return go("home");
  const mins = Math.round((new Date(w.end) - new Date(w.start)) / 6e4);
  const adj = w.exercises.filter(e => !e.bw && e.sets.some(s => s.done && s.type !== "W")).map(e => {
    const g = E.parseScheme(e.scheme).at(-1); const s = E.suggestion(e.name, g.rpe || 8, g.lo, g.hi, e.step); return s ? { n: e.name, s } : null;
  }).filter(Boolean);
  $app.innerHTML = `<section class="loader done" style="justify-content:flex-start;padding-top:calc(40px + var(--safe-t));text-align:center;overflow:auto">
    <svg class="big-x" viewBox="0 0 40 40"><path class="s1" d="M9 9l22 22" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/><path class="s2" d="M9 31 31 9" stroke="#EE8A45" stroke-width="5" stroke-linecap="round" fill="none"/></svg>
    <div><h1 class="h1" style="color:#fff">Séance terminée 💪</h1><p style="opacity:.8" class="mt8">${esc(w.title)}</p></div>
    <div style="width:100%;max-width:560px"><div class="stat3"><div><b>${mins}</b><span>minutes</span></div><div><b>${w.setsDone}</b><span>séries</span></div><div><b>${(w.volume / 1000).toFixed(1).replace(".", ",")}</b><span>tonnes</span></div></div></div>
    ${w.records.length ? `<div style="width:100%;max-width:560px;text-align:left;background:rgba(255,255,255,.12);border-radius:18px;padding:14px"><b>🏆 Nouveau${w.records.length > 1 ? "x" : ""} record${w.records.length > 1 ? "s" : ""}</b>${w.records.map(r => `<div class="row between small mt8"><span>${esc(r.name)}</span><b>${Math.round(r.after)} kg <span style="opacity:.7;font-weight:400">1RM estimé</span></b></div>`).join("")}</div>` : ""}
    ${adj.length ? `<div style="width:100%;max-width:560px;text-align:left;background:rgba(255,255,255,.12);border-radius:18px;padding:14px"><b>🎯 Pour la prochaine séance</b>${premium() ? adj.map(a => `<div class="small mt8"><b>${esc(a.n)}</b><br><span style="opacity:.85">${esc(a.s.txt)}</span></div>`).join("") : `<p class="small mt8" style="opacity:.85">Tes charges sont recalculées. Les conseils détaillés (charge ou reps à viser selon ton RPE) sont dans Premium.</p>`}</div>` : ""}
    <button class="btn" style="max-width:560px;background:#fff;color:var(--red)" data-a="go" data-r="home">Retour à l'accueil</button></section>`;
};

// =====================================================================
// CRÉER SON PROGRAMME : séances, exercices, séries écrites une par une, règles de surcharge, cycle entier
// =====================================================================
let draft = null;
const KINDS = [["F", "Force"], ["P", "Principal"], ["S", "Secondaire"], ["I", "Isolation"], ["U", "Unilatéral"], ["C", "Gainage"], ["N", "Street"], ["M", "Mobilité"], ["X", "Autre"]];
const ST_SHORT = { N: "Normale", W: "Échauf.", T: "Top set", B: "Back-off", D: "Dégressive", A: "AMRAP", E: "Échec" };
const newRow = (n) => { const x = E.migrateRow({ sets: 3, lo: 8, hi: 12, rpe: 8, pct: null, tech: [], rest: 120 }); return [n, "P", "", null, null, x]; };
const PRESETS = [
  ["3×8-12", "3x8-12 RPE8"], ["4×6-8", "4x6-8 RPE8"], ["5×5", "5x5 RPE8"], ["3×10-15", "3x10-15 RPE8"],
  ["Top set + back-off", "1x5@82% + 3x8@72%"], ["Force 5×3", "5x3@85%"], ["Pyramide", "1x10 RPE7 + 1x8 RPE8 + 1x6 RPE9"], ["5/3/1", "1x5@65% + 1x5@75% + 1x5@85% AMRAP"], ["+ dégressive", "3x8-10 RPE9 + 1x10-12 RPE10 DS"],
];
// Copie un programme existant en programme modifiable, avec tout le cycle écrit
function toDraft(p) {
  const d = JSON.parse(JSON.stringify(p));
  const W = E.weeksOf(p);
  d.s.forEach(se => se[2] = se[2].map(r => {
    if (r[5]?.sets) { E.migrateRow(r[5]); return r; }
    const weeks = {}; for (let w = 1; w <= W; w++) weeks[w] = E.parseSets(E.schemeFor(p, r, w));
    const base = weeks[1]; delete weeks[1];
    return [r[0], r[1], r[2] || "", r[3] || null, r[4] || null, { sets: base, rest: 120, prog: { ...E.DEF_PROG }, weeks, auto: true }];
  }));
  if (!d.phases && !p.custom) d.phases = Array.from({ length: W }, (_, i) => E.phaseOf(p, i + 1) === "Allègement" ? "Deload" : E.phaseOf(p, i + 1));
  return Object.assign(d, { id: "my-" + Date.now(), custom: true, name: p.name + " (perso)", lvl: "Perso", weeks: W, from: p.id });
}
routes.builder = async () => {
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]);
  const mineP = S().customPrograms || [], editing = R.param && mineP.some(p => p.id === R.param);
  if (!premium() && mineP.length >= 1 && !editing && !(draft && mineP.some(p => p.id === draft.id))) {
    $app.innerHTML = header("Créer mon programme", "", { back: "carnet" }) + `<main class="page"><div class="card"><h2 class="h2">Un programme personnel en gratuit</h2><p class="small muted">Tu as déjà créé « ${esc(mineP[0].name)} ». Avec le Bâtisseur, crée autant de séances, de programmes et de cycles que tu veux.</p><button class="btn btn-red mt12" data-a="go" data-r="offers">Voir le Bâtisseur · 7 jours offerts</button><button class="btn btn-line mt8" data-a="go" data-r="builder" data-p="${mineP[0].id}">Modifier mon programme</button></div></main>${tabbar("builder")}`;
    return;
  }
  if (false) {
    $app.innerHTML = header("Créer mon programme", "", { back: "train" }) + `<main class="page"><div class="card locked" style="min-height:300px;position:relative"><h2 class="h2">Ton programme, tes règles</h2><p class="small muted">Séances, exercices, séries une par une, top set et back-off, % du 1RM ou kg, RPE, règles de surcharge, techniques et tempo semaine par semaine.</p>${lockVeil("Bâtisseur")}</div></main>${tabbar("train")}`;
    return;
  }
  if (R.param?.startsWith("lib/") || (R.param === "lib" && R.param2)) { const id = +(R.param2 || R.param.slice(4)), lp = E.extra.programs.find(x => x.lib === id); if (lp) { draft = JSON.parse(JSON.stringify(lp)); draft.custom = true; draft.weeks = draft.weeks || E.weeksOf(lp); } history.replaceState(null, "", "#/builder"); R.param = null; R.param2 = null; }
  if (window.__bdPublish) { window.__bdPublish = false; draft = null; R.param = null; draft = { id: "my-" + Date.now(), custom: true, name: "Nouveau programme", lvl: "Tous niveaux", split: "", weeks: 12, deload: { every: 4 }, days: [true, false, true, false, true, false, false], s: [["Séance A", "Lundi", []]], prof: "", desc: "", publish: true }; }
  if (R.param === "copie" && R.param2) { const src = E.program(R.param2); if (src) draft = toDraft(src); history.replaceState(null, "", "#/builder"); R.param = null; }
  if (!draft || (R.param && draft.id !== R.param && !draft.lib)) {
    const ex = R.param && (S().customPrograms || []).find(p => p.id === R.param);
    draft = ex ? JSON.parse(JSON.stringify(ex)) : { id: "my-" + Date.now(), custom: true, name: "Mon programme", lvl: "Perso", split: "Perso", weeks: 8, deload: { every: 4 }, days: [true, false, true, false, true, false, false], s: [["Séance A", "Lundi", []]], prof: "", desc: "Programme créé par moi." };
  }
  const D = draft; D.s.forEach(se => se[2].forEach(r => { r[5] = E.migrateRow(r[5] || { sets: 3 }); }));
  if (!D.phases && D.deload === undefined) D.deload = { every: 4 };
  const dl = D.phases ? "phases" : !D.deload ? "none" : D.deload.w ? "last" : String(D.deload.every);
  $app.innerHTML = header(D.from ? "Personnaliser" : "Créer mon programme", "", { back: "train" }) + `<main class="page">
    <label class="field"><span>Nom</span><input data-c="bd" data-k="name" value="${esc(D.name)}" maxlength="70"></label>
    <div class="grid2 mt8"><label class="field"><span>Durée du cycle</span><select data-c="bd" data-k="weeks">${Array.from({ length: 14 }, (_, i) => i + 3).map(w => `<option ${D.weeks === w ? "selected" : ""} value="${w}">${w} semaines</option>`).join("")}</select></label>
      <label class="field"><span>Semaines d'allègement</span><select data-c="bd-deload">${D.phases ? `<option value="phases" selected>Selon les phases du programme</option>` : ""}<option value="4" ${dl === "4" ? "selected" : ""}>Toutes les 4 semaines</option><option value="5" ${dl === "5" ? "selected" : ""}>Toutes les 5 semaines</option><option value="6" ${dl === "6" ? "selected" : ""}>Toutes les 6 semaines</option><option value="last" ${dl === "last" ? "selected" : ""}>Dernière semaine du cycle</option><option value="none" ${dl === "none" ? "selected" : ""}>Aucune</option></select></label></div>
    <div class="field mt8"><span>Jours d'entraînement</span><div class="row" style="gap:4px">${E.DAY_SHORT.map((l, i) => `<button class="chip sm ${D.days[i] ? "on" : ""}" data-a="bd-day" data-v="${i}" style="padding:6px 10px">${l}</button>`).join("")}</div></div>
    ${D.s.map((se, si) => `<div class="card mt16"><div class="row" style="gap:6px"><input class="inp grow" data-c="bd-s" data-s="${si}" value="${esc(se[0])}" aria-label="Nom de la séance" style="text-align:left;font-weight:800">${D.s.length > 1 ? `<button class="icon-btn" data-a="bd-smv" data-s="${si}" data-v="-1" aria-label="Monter la séance" ${si ? "" : "disabled style=\"opacity:.3\""}>↑</button><button class="icon-btn" data-a="bd-sdel" data-s="${si}" aria-label="Supprimer la séance">${I.close}</button>` : ""}</div>
      ${se[2].map((r, ri) => { const x = r[5], pr = x.prog || {}; const rules = [pr.load !== "auto" ? `${pr.load === "rpe" ? "RPE" : "charge"} +${String(pr.step).replace(".", ",")}${pr.load === "pct" ? " %" : pr.load === "kg" ? " kg" : ""}${pr.every > 1 ? ` / ${pr.every} sem.` : " / sem."}` : "progression auto", pr.addSet?.every ? `+1 série / ${pr.addSet.every} sem.` : "", pr.reps?.every ? `${pr.reps.delta > 0 ? "+" : ""}${pr.reps.delta} rep / ${pr.reps.every} sem.` : "", Object.keys(x.weeks || {}).length ? `${Object.keys(x.weeks).length} sem. écrites` : ""].filter(Boolean).join(" · ");
        return `<div class="bd-ex"><div class="row" style="gap:6px;align-items:flex-start"><span class="num xs" style="width:18px;padding-top:3px">${ri + 1}</span><button class="grow" style="text-align:left" data-a="bd-edit" data-s="${si}" data-r="${ri}"><b class="small" style="color:var(--red)">${r[3] ? `[${esc(r[3])}] ` : ""}${esc(r[0])}</b><br><span class="xs">S1 : ${esc(E.setsTxt(E.weekPlan(x, 1, D).sets).replace(/x/g, "×") || "aucune série")}</span><br><span class="xs muted">${esc(rules)}</span></button>
          <div class="col" style="gap:4px"><button class="icon-btn sm" data-a="bd-rmv" data-s="${si}" data-r="${ri}" data-v="-1" aria-label="Monter" ${ri ? "" : "disabled style=\"opacity:.3\""}>↑</button><button class="icon-btn sm" data-a="bd-rmv" data-s="${si}" data-r="${ri}" data-v="1" aria-label="Descendre" ${ri < se[2].length - 1 ? "" : "disabled style=\"opacity:.3\""}>↓</button></div></div></div>`; }).join("")}
      <button class="btn btn-line btn-sm mt12" data-a="bd-add" data-s="${si}" style="width:100%">+ Exercices</button></div>`).join("")}
    <button class="btn btn-ghost mt12" data-a="bd-sadd">+ Ajouter une séance</button>
    <p class="xs muted mt12">Touche un exercice pour écrire ses séries, ses règles de surcharge et chaque semaine du cycle. Les charges en % se calculent sur ton 1RM estimé.</p>
    <div class="row mt12" style="gap:8px"><button class="btn btn-red grow" data-a="bd-save">Enregistrer</button><button class="btn btn-line grow" data-a="bd-use">Enregistrer et suivre</button></div>
    ${isCoach() ? `<label class="field mt12"><span>Pour qui (affiché dans la banque)</span><input data-c="bd" data-k="prof" value="${esc(D.prof || "")}" placeholder="Ex. père de famille, 3 séances, reprise"></label><button class="btn btn-red mt8" data-a="bd-publish" style="width:100%">📤 ${D.lib ? "Mettre à jour dans la banque des membres" : "Publier dans la banque des membres"}</button>` : ""}
    ${(S().customPrograms || []).some(p => p.id === D.id) ? `<button class="btn btn-ghost mt8" data-a="bd-del" style="color:var(--red)">Supprimer ce programme</button>` : ""}
  </main>${tabbar("train")}`;
};
changes.bd = (el) => { const k = el.dataset.k; draft[k] = k === "weeks" ? +el.value : el.value; if (k === "weeks" && draft.phases) draft.phases = Array.from({ length: +el.value }, (_, i) => draft.phases[i] || "Accumulation"); rerender(); };
changes["bd-deload"] = (el) => { const v = el.value; if (v === "phases") return; delete draft.phases; draft.deload = v === "none" ? null : v === "last" ? { w: [draft.weeks] } : { every: +v }; rerender(); };
changes["bd-s"] = (el) => { draft.s[+el.dataset.s][0] = el.value; };
actions["bd-day"] = (b, d) => { draft.days[+d.v] = !draft.days[+d.v]; rerender(); };
actions["bd-sadd"] = () => { draft.s.push([`Séance ${String.fromCharCode(65 + draft.s.length)}`, "", []]); rerender(); };
actions["bd-sdel"] = (b, d) => { if (!confirm("Supprimer cette séance ?")) return; draft.s.splice(+d.s, 1); rerender(); };
actions["bd-smv"] = (b, d) => { const a = draft.s, i = +d.s, j = i + +d.v; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; rerender(); };
actions["bd-rmv"] = (b, d) => { const a = draft.s[+d.s][2], i = +d.r, j = i + +d.v; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; rerender(); };
actions["bd-add"] = (b, d) => pickExercise((n) => { draft.s[+d.s][2].push(newRow(n)); }, "Ajouter des exercices", { multi: true });

// ---------- Éditeur d'un exercice ----------
const ed = { si: 0, ri: 0, w: null }; // w = null : séries de base (semaine 1) ; sinon semaine écrite
const edRow = () => draft.s[ed.si][2][ed.ri];
const edSets = () => { const x = edRow()[5]; if (ed.w == null) return x.sets; if (!x.weeks?.[ed.w]) { x.weeks = x.weeks || {}; x.weeks[ed.w] = E.weekPlan(x, ed.w, draft).sets; } return x.weeks[ed.w]; };
const fmtN = (v) => v == null || v === "" ? "" : String(v).replace(".", ",");
function setTable(sets, unitS) {
  return `<div class="stab"><div class="stab-h"><span>Type</span><span>${unitS ? "Sec." : "Reps"}</span><span>Charge</span><span></span><span>RPE</span><span></span></div>
    ${sets.map((s, i) => `<div class="stab-r"><select data-c="bx" data-f="t" data-i="${i}" aria-label="Type de série">${Object.entries(ST_SHORT).map(([k, l]) => `<option value="${k}" ${s.t === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input data-c="bx" data-f="reps" data-i="${i}" value="${s.lo}${s.hi && s.hi !== s.lo ? "-" + s.hi : ""}" inputmode="text" aria-label="Répétitions">
      <input data-c="bx" data-f="load" data-i="${i}" value="${fmtN(s.pct ?? s.kg)}" inputmode="decimal" placeholder="auto" aria-label="Charge">
      <select data-c="bx" data-f="unit" data-i="${i}" aria-label="Unité"><option value="pct" ${s.pct != null ? "selected" : ""}>%</option><option value="kg" ${s.kg != null ? "selected" : ""}>kg</option><option value="" ${s.pct == null && s.kg == null ? "selected" : ""}>–</option></select>
      <select data-c="bx" data-f="rpe" data-i="${i}" aria-label="RPE"><option value="">–</option>${[5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(r => `<option value="${r}" ${s.rpe === r ? "selected" : ""}>${String(r).replace(".", ",")}</option>`).join("")}</select>
      <button class="icon-btn sm" data-a="bx-del" data-i="${i}" aria-label="Supprimer la série">${I.close}</button>
      ${(s.tech || []).length ? `<div class="stab-t">${s.tech.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}</div>`).join("")}</div>
    <div class="row mt8" style="gap:6px"><button class="btn btn-ghost btn-xs" data-a="bx-add">+ Série</button><button class="btn btn-ghost btn-xs" data-a="bx-add" data-t="W">+ Échauffement</button><button class="btn btn-ghost btn-xs" data-a="bx-tech">⚡ Technique</button></div>`;
}
function exEditor(keep = true) {
  const r = edRow(), x = r[5], pr = x.prog, unitS = E.unitOf(r[0], r[1]) === "s";
  const W = draft.weeks || 8;
  sheet(`<div class="row between"><h2 class="h2" style="color:var(--red)">${esc(r[0])}</h2><button class="btn btn-red btn-xs" data-a="bx-close" style="width:auto">OK</button></div>
    <p class="xs muted">${esc(E.musclesOf(r[0]).join(" · "))} · <button class="link xs" data-a="bx-swap">Remplacer</button> · <button class="link xs" data-a="fiche-sheet" data-n="${esc(r[0])}">Fiche</button> · <button class="link xs" data-a="bx-remove" style="color:var(--red)">Retirer</button></p>
    <div class="grid3 mt8"><label class="field"><span>Type</span><select data-c="bx-k" data-k="kind">${KINDS.map(([k, l]) => `<option value="${k}" ${r[1] === k ? "selected" : ""}>${l}</option>`).join("")}</select></label><label class="field"><span>Repos (s)</span><input data-c="bx-k" data-k="rest" inputmode="numeric" value="${x.rest ?? 120}"></label><label class="field"><span>Superset</span><input data-c="bx-k" data-k="ss" value="${esc(r[3] || "")}" placeholder="A, B…" maxlength="2"></label></div>
    <div class="grid2 mt8"><label class="field"><span>Tempo (descente-pause-montée)</span><input data-c="bx-k" data-k="tempo" value="${esc(r[4] || "")}" placeholder="ex. 3-1-1"></label><label class="field"><span>Consigne</span><input data-c="bx-k" data-k="note" value="${esc(r[2] || "")}" placeholder="ex. pause en bas"></label></div>
    <h3 class="sec">Séries · semaine 1</h3>
    <div class="chips mt4">${PRESETS.map(([l, v], i) => `<button class="chip sm" data-a="bx-preset" data-i="${i}">${l}</button>`).join("")}</div>
    <div class="mt8">${setTable(x.sets, unitS)}</div>
    <p class="xs muted mt4">Reps : « 8 » ou « 8-10 ». Charge vide : calculée sur ton RPE. Top set et back-off : choisis le type de chaque série.</p>
    <h3 class="sec">Surcharge progressive</h3>
    <div class="grid3"><label class="field"><span>Charge</span><select data-c="bx-p" data-k="load">${E.LOAD_MODES.map(([k, l]) => `<option value="${k}" ${pr.load === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>De combien</span><input data-c="bx-p" data-k="step" inputmode="decimal" value="${fmtN(pr.step)}" ${pr.load === "auto" ? "disabled" : ""}></label>
      <label class="field"><span>Toutes les</span><select data-c="bx-p" data-k="every" ${pr.load === "auto" ? "disabled" : ""}>${[1, 2, 3, 4].map(n => `<option value="${n}" ${pr.every === n ? "selected" : ""}>${n} sem.</option>`).join("")}</select></label></div>
    <div class="grid3 mt8"><label class="field"><span>+1 série toutes les</span><select data-c="bx-p" data-k="addEvery"><option value="">Jamais</option>${[1, 2, 3, 4].map(n => `<option value="${n}" ${pr.addSet?.every === n ? "selected" : ""}>${n} sem.</option>`).join("")}</select></label>
      <label class="field"><span>Séries max</span><input data-c="bx-p" data-k="addMax" inputmode="numeric" value="${pr.addSet?.max ?? ""}" placeholder="5" ${pr.addSet ? "" : "disabled"}></label><span></span></div>
    <div class="grid3 mt8"><label class="field"><span>Reps</span><select data-c="bx-p" data-k="repsDelta"><option value="">Fixes</option><option value="-1" ${pr.reps?.delta === -1 ? "selected" : ""}>−1 rep</option><option value="-2" ${pr.reps?.delta === -2 ? "selected" : ""}>−2 reps</option><option value="1" ${pr.reps?.delta === 1 ? "selected" : ""}>+1 rep</option></select></label>
      <label class="field"><span>Toutes les</span><select data-c="bx-p" data-k="repsEvery" ${pr.reps ? "" : "disabled"}>${[1, 2, 3, 4, 6].map(n => `<option value="${n}" ${pr.reps?.every === n ? "selected" : ""}>${n} sem.</option>`).join("")}</select></label>
      <label class="field"><span>Reps min</span><input data-c="bx-p" data-k="repsMin" inputmode="numeric" value="${pr.reps?.min ?? ""}" placeholder="3" ${pr.reps ? "" : "disabled"}></label></div>
    <h3 class="sec">Tout le cycle · ${W} semaines <small>touche une semaine pour l'écrire</small></h3>
    <div class="list">${Array.from({ length: W }, (_, i) => i + 1).map(w => { const pl = E.weekPlan(x, w, draft); return `<button class="li" data-a="bx-week" data-w="${w}"><span class="num" style="width:30px">S${w}</span><span class="grow xs"><b>${esc(E.setsTxt(pl.sets).replace(/x/g, "×") || "–")}</b>${pl.tempo || r[4] ? ` · tempo ${esc(pl.tempo || r[4])}` : ""}${x.techW?.[w]?.length ? ` · ${esc(x.techW[w].join(", "))}` : ""}<br><span class="muted">${esc(E.phaseOf(draft, w))}${pl.custom ? " · écrite à la main" : ""}</span></span>${I.chev}</button>`; }).join("")}</div>`, null, { keep });
}
function weekEditor(keep = true) {
  const r = edRow(), x = r[5], w = ed.w, unitS = E.unitOf(r[0], r[1]) === "s", pl = E.weekPlan(x, w, draft);
  const sets = x.weeks?.[w] || pl.sets;
  sheet(`<button class="link small" data-a="bx-back">← ${esc(r[0])}</button>
    <div class="row between mt8"><h2 class="h2">Semaine ${w}</h2><span class="tag ${pl.deload ? "" : "r"}">${esc(E.phaseOf(draft, w))}</span></div>
    <p class="xs muted">${x.weeks?.[w] ? "Écrite à la main : elle ne suit plus les règles." : "Calculée par tes règles. Modifie une valeur pour l'écrire à la main."}</p>
    <div class="mt8">${setTable(sets, unitS)}</div>
    <div class="grid2 mt12"><label class="field"><span>Tempo cette semaine</span><input data-c="bx-wt" value="${esc(x.tempoW?.[w] || "")}" placeholder="${esc(r[4] || "ex. 3-1-1")}"></label><span></span></div>
    <div class="lbl mt12">Technique d'intensification cette semaine</div>
    <div class="chips wrap mt8">${E.TECHS.slice(1).map(([e, t]) => `<button class="chip sm ${(x.techW?.[w] || []).includes(t) ? "on" : ""}" data-a="bx-wtech" data-v="${esc(t)}">${e} ${esc(t)}</button>`).join("")}</div>
    <div class="row mt16" style="gap:8px">${x.weeks?.[w] ? `<button class="btn btn-line btn-sm grow" data-a="bx-wreset">Revenir aux règles</button>` : ""}<button class="btn btn-line btn-sm grow" data-a="bx-wcopy">Copier sur les semaines suivantes</button></div>
    <div class="row mt8" style="gap:8px">${w > 1 ? `<button class="btn btn-ghost btn-sm grow" data-a="bx-wnav" data-v="-1">← S${w - 1}</button>` : ""}${w < (draft.weeks || 8) ? `<button class="btn btn-ghost btn-sm grow" data-a="bx-wnav" data-v="1">S${w + 1} →</button>` : ""}</div>`, null, { keep });
}
// Quand on réécrit les séries de base d'un programme copié, les semaines pré-écrites suivent les nouvelles règles
function baseChanged() { const x = edRow()[5]; if (ed.w == null && x.auto && Object.keys(x.weeks || {}).length) { x.weeks = {}; delete x.auto; toast("Le cycle suit maintenant tes séries et tes règles"); } }
const redrawEd = () => { baseChanged(); ed.w == null ? exEditor() : weekEditor(); };
actions["bd-edit"] = (b, d) => { ed.si = +d.s; ed.ri = +d.r; ed.w = null; exEditor(false); };
actions["bx-close"] = () => { closeSheet(); rerender(); };
actions["bx-back"] = () => { ed.w = null; exEditor(); };
actions["bx-week"] = (b, d) => { ed.w = +d.w; weekEditor(); };
actions["bx-wnav"] = (b, d) => { ed.w += +d.v; weekEditor(); };
actions["bx-remove"] = () => { if (!confirm("Retirer cet exercice du programme ?")) return; draft.s[ed.si][2].splice(ed.ri, 1); closeSheet(); rerender(); };
actions["bx-swap"] = () => pickExercise((n) => { edRow()[0] = n; ed.w = null; exEditor(false); }, "Remplacer par", { mus: E.musclesOf(edRow()[0])[0] || "" });
changes["bx-k"] = (el) => { const r = edRow(), k = el.dataset.k, v = el.value.trim(); if (k === "kind") r[1] = v; else if (k === "rest") r[5].rest = Math.max(15, Math.round(num(v)) || 120); else if (k === "ss") r[3] = v.toUpperCase() || null; else if (k === "tempo") r[4] = v || null; else if (k === "note") r[2] = v; };
changes["bx-p"] = (el) => {
  const pr = edRow()[5].prog, k = el.dataset.k, v = el.value;
  if (k === "load") pr.load = v; else if (k === "step") pr.step = num(v) || 0; else if (k === "every") pr.every = +v;
  else if (k === "addEvery") pr.addSet = v ? { every: +v, max: pr.addSet?.max || 5 } : null; else if (k === "addMax" && pr.addSet) pr.addSet.max = Math.round(num(v)) || 5;
  else if (k === "repsDelta") pr.reps = v ? { delta: +v, every: pr.reps?.every || 4, min: pr.reps?.min || 3 } : null; else if (k === "repsEvery" && pr.reps) pr.reps.every = +v; else if (k === "repsMin" && pr.reps) pr.reps.min = Math.round(num(v)) || 1;
  if (k === "load" && v === "pct" && !edRow()[5].sets.some(s => s.pct)) toast("Indique un % sur tes séries pour que la charge monte en %.");
  redrawEd();
};
changes.bx = (el) => {
  const sets = edSets(), s = sets[+el.dataset.i], f = el.dataset.f, v = el.value.trim();
  if (f === "t") { s.t = v; if (v === "W") { s.rpe = 5; } }
  else if (f === "reps") { const m = v.match(/(\d+)\s*(?:[-–à]\s*(\d+))?/); if (m) { s.lo = +m[1]; s.hi = +(m[2] || m[1]); } }
  else if (f === "rpe") s.rpe = v ? Math.min(10, Math.max(4, num(v))) : null;
  else if (f === "load") { const n = num(v); const unit = s.kg != null ? "kg" : "pct"; s.pct = null; s.kg = null; if (n > 0) s[unit] = n; }
  else if (f === "unit") { const val = s.pct ?? s.kg; s.pct = null; s.kg = null; if (v && val) s[v] = val; else if (v === "pct") s.pct = 70; else if (v === "kg") s.kg = 20; }
  redrawEd();
};
actions["bx-add"] = (b, d) => { const sets = edSets(), l = sets.filter(s => s.t !== "W").at(-1); if (d.t === "W") sets.splice(sets.filter(s => s.t === "W").length, 0, { t: "W", lo: 8, hi: 8, pct: l?.pct ? Math.round(l.pct * .5) : null, kg: null, rpe: 5, tech: [] }); else sets.push(l ? { ...l, t: l.t === "T" ? "B" : l.t, tech: [...(l.tech || [])] } : { t: "N", lo: 8, hi: 12, rpe: 8, pct: null, kg: null, tech: [] }); redrawEd(); };
actions["bx-del"] = (b, d) => { const sets = edSets(); if (sets.length <= 1) return toast("Garde au moins une série."); sets.splice(+d.i, 1); redrawEd(); };
actions["bx-preset"] = (b, d) => { const x = edRow()[5]; x.sets = E.parseSets(PRESETS[+d.i][1]); if (x.sets.some(s => s.pct) && x.prog.load === "auto") x.prog = { ...x.prog, load: "pct", step: 1.5 }; redrawEd(); };
actions["bx-tech"] = () => sheet(`<button class="link small" data-a="bx-tback">← Retour</button><h2 class="h2 mt8">Technique sur une série</h2><p class="small muted">Choisis la série puis la technique.</p>
  ${edSets().map((s, i) => `<div class="mt12"><b class="small">Série ${i + 1} · ${ST_SHORT[s.t]}</b><div class="chips wrap mt4">${E.TECHS.slice(1).map(([e, t]) => `<button class="chip sm ${(s.tech || []).includes(t) ? "on" : ""}" data-a="bx-stech" data-i="${i}" data-v="${esc(t)}">${e} ${esc(t)}</button>`).join("")}</div></div>`).join("")}`, null, { keep: true });
actions["bx-tback"] = () => redrawEd();
actions["bx-stech"] = (b, d) => { const s = edSets()[+d.i]; s.tech = (s.tech || []).includes(d.v) ? s.tech.filter(t => t !== d.v) : [...(s.tech || []), d.v]; b.classList.toggle("on"); };
changes["bx-wt"] = (el) => { const x = edRow()[5]; x.tempoW = x.tempoW || {}; if (el.value.trim()) x.tempoW[ed.w] = el.value.trim(); else delete x.tempoW[ed.w]; };
actions["bx-wtech"] = (b, d) => { const x = edRow()[5]; x.techW = x.techW || {}; const a = x.techW[ed.w] || []; x.techW[ed.w] = a.includes(d.v) ? a.filter(t => t !== d.v) : [...a, d.v]; if (!x.techW[ed.w].length) delete x.techW[ed.w]; weekEditor(); };
actions["bx-wreset"] = () => { const x = edRow()[5]; delete x.weeks[ed.w]; weekEditor(); };
actions["bx-wcopy"] = () => { const x = edRow()[5], src = JSON.parse(JSON.stringify(x.weeks?.[ed.w] || E.weekPlan(x, ed.w, draft).sets)); x.weeks = x.weeks || {}; for (let w = ed.w + 1; w <= (draft.weeks || 8); w++) x.weeks[w] = JSON.parse(JSON.stringify(src)); if (x.tempoW?.[ed.w]) for (let w = ed.w + 1; w <= draft.weeks; w++) x.tempoW[w] = x.tempoW[ed.w]; toast(`Copiée sur les semaines ${ed.w + 1} à ${draft.weeks}`); weekEditor(); };

function saveDraft() {
  if (!draft.s.some(s => s[2].length)) { toast("Ajoute au moins un exercice."); return false; }
  if (!premium() && (S().customPrograms || []).some(p => p.id !== draft.id)) { toast("Gratuit : un seul programme personnel. Passe au Bâtisseur pour en créer d'autres."); return false; }
  const nd = draft.days.filter(Boolean).length; if (!nd) { toast("Choisis au moins un jour."); return false; }
  let k = 0; draft.days.forEach((on, i) => { if (on && draft.s[k]) draft.s[k++][1] = E.DAY_NAMES[i]; });
  update(st => { st.customPrograms = (st.customPrograms || []).filter(p => p.id !== draft.id); st.customPrograms.push(JSON.parse(JSON.stringify(draft))); });
  return true;
}
actions["bd-publish"] = async () => {
  if (!draft.s.some(s => s[2].length)) return toast("Ajoute au moins un exercice.");
  let k = 0; draft.days.forEach((on, i) => { if (on && draft.s[k]) draft.s[k++][1] = E.DAY_NAMES[i]; });
  const { id, from, lib, publish, ...data } = JSON.parse(JSON.stringify(draft));
  const c = await cloud(); try { if (lib) await c.libraryUpdate(lib, { name: draft.name, data }); else await c.libraryAdd("program", draft.name, data); const { refreshLibrary } = await import("../library.js"); await refreshLibrary(); toast(lib ? "Programme mis à jour pour tous" : "Programme publié : tes membres le voient dans la banque"); draft = null; go("admin-db"); } catch (e) { toast("Publication impossible : " + e.message); }
};
actions["bd-save"] = () => { if (saveDraft()) { toast("Programme enregistré"); tab = "banque"; draft = null; go("train", "banque"); } };
actions["bd-use"] = () => {
  if (!saveDraft()) return; if (S().current) return toast("Enregistré. Termine ta séance en cours pour changer.");
  const keepWeek = draft.from && draft.from === S().plan?.programId ? Math.min(S().plan.week, draft.weeks) : 1;
  update(st => st.plan = { programId: draft.id, startedAt: today(), week: keepWeek, idx: 0, cycle: st.plan?.cycle || 1 });
  toast(keepWeek > 1 ? `C'est parti, tu restes en semaine ${keepWeek}` : "C'est parti avec ton programme"); draft = null; tab = "programme"; pushStats(); go("train", "programme");
};
actions["bd-del"] = () => { if (!confirm("Supprimer ce programme ?")) return; const id = draft.id; update(st => { st.customPrograms = st.customPrograms.filter(p => p.id !== id); if (st.plan?.programId === id) st.plan = { programId: st.profile.startProgram || "tb-rep3", startedAt: today(), week: 1, idx: 0, cycle: 1 }; }); draft = null; go("train", "banque"); };
