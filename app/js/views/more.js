// Profil, réglages, sauvegarde, connaissances, mon compte, confidentialité.
import { S, update, resetAll, exportJSON, importJSON, today } from "../store.js";
import * as E from "../engine.js";
import * as N from "../nutrition.js";
import { CONFIG, offer, OFFERS, ALL_FREE } from "../config.js";
import { $app, esc, num, fr, toast, routes, R, actions, forms, changes, go, I, logo, markImg, header, tabbar, seg, sheet, closeSheet, lockVeil, premium, rank, expert, render, rerender, barChart, tier, trialLeft } from "../core.js";
import { syncProfile } from "../sync.js";
import { ONB_STEPS, resetOnboarding } from "./onboarding.js";

// ---------- Profil (façon Hevy) : en-tête crayon + réglages, graphiques, tableau de bord ----------
let pStat = "dur";
const monday = (d = new Date()) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; };
// Chiffres par semaine : durée (min), volume (kg), répétitions, exercices
export function weeklyStats(n = 12) {
  const m0 = monday(), out = [];
  for (let k = n - 1; k >= 0; k--) {
    const a = new Date(m0); a.setDate(a.getDate() - 7 * k); const b = new Date(a); b.setDate(b.getDate() + 7);
    const ws = S().workouts.filter(w => w.end && new Date(w.end) >= a && new Date(w.end) < b);
    let dur = 0, vol = 0, reps = 0, exos = 0;
    ws.forEach(w => {
      dur += Math.max(0, Math.round((new Date(w.end) - new Date(w.start)) / 6e4));
      vol += w.volume || 0;
      (w.exercises || []).forEach(ex => { const done = (ex.sets || []).filter(s => s.done && s.type !== "W"); if (done.length) exos++; done.forEach(s => { if (ex.unit !== "s") reps += s.reps || 0; }); });
    });
    out.push({ l: `${String(a.getDate()).padStart(2, "0")}/${String(a.getMonth() + 1).padStart(2, "0")}`, dur, vol, reps, exos, n: ws.length });
  }
  return out;
}
const STATS = [["dur", "Durée", (v) => v >= 60 ? `${fr(v / 60, 1)} h` : `${v} min`], ["vol", "Volume", (v) => v >= 1000 ? `${fr(v / 1000, 1)} t` : `${v} kg`], ["reps", "Reps", (v) => String(v)], ["exos", "Exercices", (v) => String(v)]];
routes.profile = async () => {
  await Promise.all([N.loadModels(), E.loadPrograms()]);
  const p = S().profile, ws = S().workouts, wk = weeklyStats(12), cur = wk.at(-1);
  const st = STATS.find(x => x[0] === pStat) || STATS[0];
  const total = wk.reduce((a, w) => a + w[pStat], 0);
  const recs = Object.keys(S().lifts || {}).length;
  const tile = (r, ic, l, sub = "") => `<button class="tile" data-a="go" data-r="${r}"><span class="tile-ic">${ic}</span><span><b>${l}</b>${sub ? `<br><span class="xs muted">${sub}</span>` : ""}</span></button>`;
  const acts = `<button class="pill ic" data-a="edit-body" aria-label="Modifier mon profil">${I.pen}</button><button class="pill ic" data-a="go" data-r="settings" aria-label="Réglages">${I.gear}</button>`;
  const last = [...ws].reverse().slice(0, 3);
  $app.innerHTML = header("Profil", "", { actions: acts, offers: false }) + `<main class="page">
    <div class="card mt12"><div class="row" style="gap:14px"><span class="avatar">${esc((p.name || "?")[0].toUpperCase())}</span><div class="grow"><b class="h2">${esc(p.name)}</b><div class="small muted">${esc(offer(tier()).name)}${trialLeft() > 0 ? " (essai)" : ""} · ${p.age} ans · ${p.height} cm · ${E.fmtKg(S().daily?.[today()]?.weight || p.weight)} kg</div></div></div>
      <div class="minis mt12"><div><div class="v">${ws.length}</div><div class="l">entraînements</div></div><div><div class="v">${recs}</div><div class="l">exercices suivis</div></div><div><div class="v">${E.streakWeeks()}</div><div class="l">semaines de série</div></div></div></div>
    ${rank() < 1 ? `<button class="card tap grad mt12" data-a="go" data-r="offers" style="display:flex;gap:12px;align-items:center;text-align:left;width:100%"><span style="font-size:28px">🚀</span><span class="grow"><b>Passe au Bâtisseur</b><br><span class="small" style="opacity:.9">Charges calculées, plan alimentaire, stats complètes · 7 jours offerts</span></span>${I.chev}</button>` : ""}
    <div class="card mt12"><div class="row between"><b>${st[2](cur[pStat])} <span class="small muted" style="font-weight:500">cette semaine</span></b><span class="xs muted">12 dernières semaines</span></div>
      <div class="mt8">${barChart(wk.map(w => ({ l: w.l.slice(0, 2), v: w[pStat] })), { fmt: (v) => pStat === "vol" ? (v >= 1000 ? fr(v / 1000, 1) + "t" : Math.round(v)) : pStat === "dur" ? (v >= 60 ? fr(v / 60, 1) + "h" : v) : v })}</div>
      <div class="chips mt8">${STATS.map(([k, l]) => `<button class="chip ${k === pStat ? "on" : ""}" data-a="p-stat" data-v="${k}">${l}</button>`).join("")}</div>
      <p class="xs muted mt8" style="margin-bottom:0">Total sur 12 semaines : <b>${st[2](total)}</b> · ${wk.reduce((a, w) => a + w.n, 0)} séances</p></div>
    <h2 class="sec">Tableau de bord</h2>
    <div class="tiles">
      ${tile("train/stats", I.chart, "Statistiques", "Volume par muscle, séances")}
      ${tile("simu", "🏆", "Exercices et records", "1RM, toutes tes charges")}
      ${tile("body", "📏", "Mesures et photos", "Poids, mensurations")}
      ${tile("home/month", I.cal, "Calendrier", "Jour, semaine, mois, année")}
      ${tile("moncorps", "🔥", "Mon corps", "Déficit, dépense, projection")}
      ${tile("train/saison", "🎯", "Objectifs et cycles", "Charges visées, blocs")}
    </div>
    <h2 class="sec">Entraînements</h2>
    ${last.length ? `<div class="list">${last.map(w => `<button class="li" data-a="ag-day" data-v="${today(new Date(w.end))}"><span class="em">🏋️</span><span class="grow"><b>${esc(w.title)}</b><br><span class="xs muted">${new Date(w.end).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })} · ${Math.round((new Date(w.end) - new Date(w.start)) / 6e4)} min · ${fr((w.volume || 0) / 1000, 1)} t</span></span>${I.chev}</button>`).join("")}</div>` : `<p class="empty small">Ta première séance apparaîtra ici.</p>`}
  </main>${tabbar("profile")}`;
};
actions["p-stat"] = (b, d) => { pStat = d.v; rerender(); };

// ---------- Réglages (roue en haut du profil) ----------
routes.settings = async () => {
  await N.loadModels();
  const p = S().profile, t = N.targets();
  $app.innerHTML = header("Réglages", "", { back: "profile" }) + `<main class="page">
    <div class="card"><div class="lbl">Ta formule</div><div class="row between mt4"><span class="h2">${esc(offer(tier()).name)}${trialLeft() > 0 ? ` <span class="tag r">essai · ${trialLeft()} j</span>` : ""}</span><button class="link" data-a="go" data-r="offers">Voir les offres</button></div>${p.email ? `<p class="xs muted mt4" style="margin:0">${esc(p.email)}</p>` : ""}</div>
    <h2 class="sec">Profil et objectifs</h2>
    <div class="list">
      <button class="li" data-a="edit-body"><span class="em">✏️</span><span class="grow">Mes infos et mon carburant<br><span class="xs muted">${t ? `${fr(t.kcal)} kcal · ${esc(t.model.name)}` : ""}</span></span>${I.chev}</button>
      <div class="li"><span class="em">🥩</span><span class="grow">Suivi simple : calories et protéines<br><span class="xs muted">Masque glucides, lipides et micronutriments</span></span><button class="switch ${S().settings.simpleNutri ? "on" : ""}" data-a="simple-nutri" aria-label="Suivi simple"></button></div>
      <div class="li"><span class="em">📊</span><span class="grow">Afficher les % et l'e1RM dans le carnet</span><button class="switch ${S().settings.adv ?? p.level === "advanced" ? "on" : ""}" data-a="adv-toggle" aria-label="Mode avancé"></button></div>
      <div class="li"><span class="em">🛌</span><span class="grow">Jour de repos<br><span class="xs muted">Ce jour-là, l'accueil ne pousse plus à la performance</span></span><select class="inp" style="width:auto;font-size:15px" data-c="sabbat-dow" aria-label="Jour de repos">${[["-1", "Désactivé"], ...E.DAY_NAMES.map((n, i) => [String(i), n])].map(([v, l]) => `<option value="${v}" ${String(S().settings.sabbat?.on === false || !S().settings.sabbat ? -1 : S().settings.sabbat.dow) === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    </div>
    <h2 class="sec">Application</h2>
    <div class="list">
      <div class="li"><span class="em">📳</span><span class="grow">Vibrations</span><button class="switch ${S().settings.haptics ? "on" : ""}" data-a="haptics" aria-label="Vibrations"></button></div>
      <div class="li"><span class="em">🌗</span><span class="grow">Thème</span><select data-c="theme" class="inp" style="width:auto;padding:4px 8px;font-size:15px"><option value="">Automatique</option><option value="light" ${localStorage.getItem("cxs.theme") === "light" ? "selected" : ""}>Clair</option><option value="dark" ${localStorage.getItem("cxs.theme") === "dark" ? "selected" : ""}>Sombre</option></select></div>
      <button class="li" data-a="go" data-r="kb"><span class="em">📚</span><span class="grow">Connaissances</span>${I.chev}</button>
      <button class="li" data-a="go" data-r="account"><span class="em">👤</span><span class="grow">Mon compte</span>${I.chev}</button>
    </div>
    <h2 class="sec">Mes données</h2>
    <p class="small muted">Tes séances, ton journal et tes notes restent sur ce téléphone. Télécharge une sauvegarde chaque mois.</p>
    <div class="list"><button class="li" data-a="export"><span class="grow">Télécharger ma sauvegarde</span>${I.chev}</button>
      <label class="li" style="cursor:pointer"><span class="grow">Restaurer une sauvegarde</span>${I.chev}<input type="file" accept="application/json" data-c="import" hidden></label>
      <a class="li" href="#/privacy" style="color:inherit;text-decoration:none"><span class="grow">Confidentialité</span>${I.chev}</a>
      <button class="li" data-a="reset"><span class="grow" style="color:var(--red)">Tout effacer et recommencer</span></button></div>
    <p class="xs muted mt24">TB my Coach · version 4.0 · ${esc(CONFIG.coachName)}. Les conseils de l'app ne remplacent pas un avis médical : en cas de douleur ou de problème de santé, consulte un médecin avant de t'entraîner.</p>
  </main>${tabbar("settings")}`;
};
actions["simple-nutri"] = () => { update(st => st.settings.simpleNutri = !st.settings.simpleNutri); rerender(); };

actions["word-set"] = (b, d) => { update(st => st.settings.word = d.v); rerender(); };
changes["sabbat-dow"] = (el) => { const v = +el.value; update(st => st.settings.sabbat = v < 0 ? { on: false, dow: 6 } : { on: true, dow: v }); toast(v < 0 ? "Jour de repos désactivé" : "Jour de repos enregistré"); };
actions.haptics = () => { update(st => st.settings.haptics = !st.settings.haptics); rerender(); };
changes.theme = (el) => { if (el.value) localStorage.setItem("cxs.theme", el.value); else localStorage.removeItem("cxs.theme"); applyTheme(); };
export function applyTheme() { const t = localStorage.getItem("cxs.theme"); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
actions.export = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([exportJSON()], { type: "application/json" })); a.download = `calxsthenos-${today()}.json`; a.click(); toast("Sauvegarde téléchargée"); };
changes.import = async (el) => { const f = el.files?.[0]; if (!f) return; try { importJSON(await f.text()); toast("Sauvegarde restaurée"); go("home"); } catch (e) { toast(e.message); } };
actions.reset = () => { if (confirm("Effacer toutes tes données de ce téléphone ? Cette action est définitive.")) { resetAll(); localStorage.removeItem("cxs.auth"); resetOnboarding(); go("onboarding"); } };
actions["edit-body"] = () => {
  const p = S().profile, opt = (id) => ONB_STEPS.find(s => s.id === id).opts;
  sheet(`<h2 class="h1">Mes infos</h2><form data-f="edit-body" class="stack mt12">
    <div class="grid3"><label class="field"><span>Poids (kg)</span><input name="weight" inputmode="decimal" value="${E.fmtKg(p.weight)}"></label><label class="field"><span>Taille (cm)</span><input name="height" inputmode="numeric" value="${p.height}"></label><label class="field"><span>Âge</span><input name="age" inputmode="numeric" value="${p.age}"></label></div>
    <label class="field"><span>E-mail</span><input name="email" type="email" value="${esc(p.email || "")}"></label>
    <label class="field"><span>Objectif de pas par jour</span><input name="stepsGoal" inputmode="numeric" value="${p.stepsGoal || 8000}"></label>
    <label class="field"><span>Objectif</span><select name="goal">${opt("goal").map(([v, l]) => `<option value="${v}" ${p.goal === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field"><span>Activité</span><select name="activity">${opt("activity").map(([v, l]) => `<option value="${v}" ${p.activity === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field"><span>Pas par jour en moyenne</span><select name="stepsAvg">${opt("steps").map(([v, l]) => `<option value="${v}" ${p.stepsAvg == v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <div class="grid2"><label class="field"><span>Séances de muscu / semaine</span><select name="days">${[1, 2, 3, 4, 5, 6, 7].map(d => `<option ${p.days == d ? "selected" : ""}>${d}</option>`).join("")}</select></label><label class="field"><span>Durée d'une séance</span><select name="sessionMin">${opt("sessionMin").map(([v, l]) => `<option value="${v}" ${(p.sessionMin || 60) == v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="field"><span>Sport ou cardio en plus</span><select name="sportHours">${opt("sportHours").map(([v, l, sub]) => `<option value="${v}" ${(p.sportHours || 0) == v ? "selected" : ""}>${l}${sub ? " · " + sub : ""}</option>`).join("")}</select></label>
    <label class="field"><span>Alimentation</span><select name="diet">${opt("diet").map(([v, l]) => `<option value="${v}" ${p.diet === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <button class="btn btn-red">Enregistrer</button></form>`);
};
forms["edit-body"] = (v) => {
  update(st => { const p = st.profile; p.weight = num(v.weight) || p.weight; p.height = num(v.height) || p.height; p.age = num(v.age) || p.age; p.email = v.email.trim() || p.email; p.stepsGoal = Math.round(num(v.stepsGoal)) || 8000; p.goal = v.goal; p.activity = v.activity; p.stepsAvg = +v.stepsAvg || null; p.days = +v.days || p.days; p.sessionMin = +v.sessionMin || 60; p.sportHours = +v.sportHours || 0; p.diet = v.diet; p.nutritionModel = N.pickModel(p); st.synced = false; });
  closeSheet(); toast("Infos mises à jour"); syncProfile(); rerender();
};

// ---------- Connaissances ----------
let KB = null;
const EXTRA = [
  { id: "proteines", ic: "🥩", t: "Les protéines : combien et quand", cli: `<p>Pour construire ou garder du muscle, vise <b>1,6 à 2,2 g de protéines par kg</b> de poids de corps et par jour. En perte de gras, reste dans le haut de la fourchette : elles protègent ton muscle et calment la faim.</p><ul><li>Répartis-les sur 3 à 5 prises de 25 à 40 g.</li><li>Une prise de 30 à 40 g dans les heures qui suivent la séance suffit ; la « fenêtre anabolique » de 30 minutes est un mythe.</li><li>Sources : viande, poisson, œufs, laitages, et côté végétal soja, tofu, tempeh, légumineuses associées aux céréales.</li><li>La poudre de protéine n'est qu'un aliment pratique pour compléter ce qui manque.</li></ul><p>Plus de 50 ans : les besoins sont plutôt dans le haut de la fourchette, car le muscle répond moins bien.</p>` },
  { id: "fibres", ic: "🌾", t: "Les fibres", cli: `<p>Repère : <b>30 g par jour</b>. La plupart des Français en mangent moins de 20.</p><p>Elles rassasient, régulent la glycémie, nourrissent le microbiote et facilitent le transit. Sources : légumes, fruits avec la peau, légumineuses (lentilles, pois chiches, haricots), céréales complètes, flocons d'avoine, oléagineux.</p><p>Augmente progressivement et bois davantage, sinon ballonnements garantis.</p>` },
  { id: "micros", ic: "🔬", t: "Vitamines et minéraux", cli: `<p>Les micronutriments ne donnent pas d'énergie, mais sans eux rien ne fonctionne : vitamine D pour les os et les muscles, fer pour l'oxygène, magnésium pour la contraction musculaire, B12 pour les nerfs et le sang.</p><p>Ceux qui manquent le plus souvent en France : <b>vitamine D</b> (en hiver surtout), <b>magnésium</b>, <b>fer</b> chez les femmes, <b>oméga-3</b> quand on mange peu de poisson, <b>B12</b> chez les vegans, <b>iode</b> sans sel iodé ni poisson.</p><p>Le journal estime tes apports à partir des aliments notés (table Ciqual). Une estimation n'est pas un diagnostic : seule une prise de sang dit s'il y a une carence.</p>` },
  { id: "complements", ic: "💊", t: "Les compléments : ce qui marche vraiment", cli: `<p>Les compléments complètent une alimentation correcte ; ils ne la remplacent jamais.</p><ul><li><b>Preuves solides</b> : créatine monohydrate (3 à 5 g par jour) pour la force ; caféine avant l'effort (environ 3 mg par kg) ; vitamine D en hiver ; B12 pour les vegans ; acide folique en projet de grossesse.</li><li><b>Selon tes apports</b> : oméga-3, magnésium, zinc, calcium, fibres, protéine en poudre.</li><li><b>Jamais sans prise de sang</b> : le fer.</li><li><b>Avis médical</b> : mélatonine, plantes comme l'ashwagandha, et tout complément pendant la grossesse, l'allaitement ou un traitement.</li></ul><p>Les limites de sécurité existent : plus n'est pas mieux. L'onglet Compléments de Nutrition calcule ta dose selon ton profil.</p>` },
  { id: "grossesse", ic: "🤰", t: "S'entraîner enceinte et après l'accouchement", cli: `<p><b>Pendant la grossesse</b>, l'activité physique est recommandée quand le suivi médical le permet : environ 150 minutes par semaine d'effort modéré (tu peux parler en faisant l'effort). Évite l'apnée, les sports de chute ou de contact, la position allongée sur le dos prolongée en fin de grossesse, et les exercices qui font bomber le ventre.</p><p><b>Après l'accouchement</b>, la priorité est la rééducation du périnée et des abdominaux profonds, avec le feu vert de la visite post-natale. On reprend par la respiration, le gainage doux et la marche, puis les charges progressivement. Course et sauts : pas avant environ 3 mois et un périnée vérifié.</p><p>Signes d'alerte qui imposent d'arrêter et de consulter : saignements, douleurs, fuites urinaires, sensation de pesanteur, vertiges.</p>` },
  { id: "depense", ic: "🔥", t: "Ta dépense : MB, NEAT, EAT, TEF, TDEE", cli: `<p>Ce que tu brûles dans une journée se découpe en quatre parts :</p><ul><li><b>MB, métabolisme de base</b> (60 à 70 %) : ce que ton corps dépense au repos complet pour respirer, penser, garder sa température. Il dépend surtout de ton poids, de ta taille, de ton âge et de ta masse musculaire.</li><li><b>NEAT</b> (15 à 30 %) : tout le mouvement hors sport. Marcher, rester debout, monter les escaliers. C'est la part qui varie le plus d'une personne à l'autre, et la plus facile à augmenter : 4 000 pas de plus, c'est environ 150 à 200 kcal.</li><li><b>EAT</b> (5 à 10 %) : l'exercice volontaire. Une séance de musculation d'une heure brûle moins qu'on le croit (300 à 400 kcal) : son vrai rôle, c'est de construire et protéger le muscle.</li><li><b>TEF, effet thermique des aliments</b> (≈ 10 %) : l'énergie pour digérer. Les protéines en demandent le plus.</li></ul><p><b>TDEE</b> = MB + NEAT + EAT + TEF. Manger sous ton TDEE fait perdre du poids, au-dessus en fait prendre. Les calculs sont des estimations : c'est la tendance de ton poids sur 2 à 3 semaines qui dit la vérité.</p>`, co: `<p><b>Modèle utilisé.</b> MB par Mifflin-St Jeor (10 × poids + 6,25 × taille − 5 × âge + 5 ou −161). NEAT : fraction du MB selon le métier (0,15 à 0,5 × ½) + 0,0005 kcal par pas et par kg. EAT : MET 5 pour la musculation, MET tabulés pour le cardio (kcal = MET × kg × h). TEF : 10 % de l'apport.</p><p><b>Limites.</b> Erreur individuelle du MB ±10 %, adaptation métabolique en déficit prolongé (baisse du NEAT spontané surtout), surestimation fréquente des montres pour l'EAT. Ajuster par paliers de 100 à 200 kcal selon la moyenne mobile du poids.</p>` },
  { id: "jeune", ic: "⏳", t: "Le jeûne : ce qui se passe vraiment", cli: `<p>Pendant un jeûne, ton corps change progressivement de carburant :</p><ul><li><b>0 à 4 h</b> : digestion, l'insuline monte puis redescend.</li><li><b>4 à 12 h</b> : le foie puise dans ses réserves de glycogène.</li><li><b>12 à 16 h</b> : la part d'énergie venant des graisses augmente nettement.</li><li><b>16 à 24 h</b> : production accrue de corps cétoniques, la faim vient par vagues.</li></ul><p>Le jeûne n'a pas de pouvoir magique sur la perte de gras : il aide surtout parce qu'il réduit le nombre de repas, donc les calories. Si tu t'entraînes, garde assez de protéines sur la journée (1,6 à 2,2 g par kg) et place ta séance près d'un repas.</p><p>À éviter sans avis médical : grossesse, diabète traité, antécédents de troubles alimentaires, traitements médicaux.</p>`, co: `<p>Les études comparant jeûne intermittent et restriction continue à calories égales montrent des pertes de poids et de gras similaires. L'intérêt est l'adhérence. Pour la masse musculaire, la répartition des protéines (3 à 4 prises de 0,4 g/kg) reste légèrement favorable aux fenêtres larges (8 h ou plus).</p>` },
  { id: "eau", ic: "💧", t: "L'hydratation", cli: `<p>Repère simple : environ 30 à 35 ml par kg de poids corporel par jour, plus 500 ml à 1 L par heure d'entraînement. Tes urines doivent être jaune pâle.</p><p>Une perte d'eau de 2 % du poids suffit à faire baisser la force et l'endurance. Bois un grand verre au réveil, un pendant chaque repas, et pendant tes séances.</p>` },
];
// Toutes les bases sont gratuites à lire : apprendre ne doit pas être réservé aux abonnés. La version experte et les maillons faibles restent dans le suivi.
let kbMode = "cli";
routes.kb = async () => {
  if (!KB) KB = [...(await (await fetch("data/kb.json")).json()), ...EXTRA];
  if (R.param) return kbChapter(R.param);
  const open = (c) => c.g ? expert() : true;
  const groups = [["Entraînement", KB.filter(c => !c.g && !EXTRA.includes(c))], ["Nutrition, compléments, énergie", EXTRA], ["Maillons faibles et dos (suivi)", KB.filter(c => c.g)]];
  $app.innerHTML = header("Apprendre", "Entraînement, nutrition, récupération", { back: R.param2 || "home" }) + `<main class="page">
    <p class="small muted">${expert() ? "Toute la bibliothèque est ouverte, avec la version experte de chaque chapitre." : "Tous les chapitres sont libres de lecture. Le suivi ajoute la version experte et le module maillons faibles."}</p>
    ${groups.map(([g, list]) => `<h2 class="sec">${g}</h2><div class="list">${list.map(c => `<button class="li" data-a="go" data-r="kb" data-p="${c.id}"><span class="em">${c.ic || "📘"}</span><span class="grow"><b class="small">${esc(c.t)}</b>${S().kbRead?.[c.id] ? ` <span class="tag g">lu</span>` : ""}</span>${open(c) ? I.chev : `<span class="lock">🔒</span>`}</button>`).join("")}</div>`).join("")}
  </main>${tabbar("kb")}`;
};
// Connaissances intégrées aux onglets Entraînement et Nutrition
export async function kbSection(which) {
  if (!KB) KB = [...(await (await fetch("data/kb.json")).json()), ...EXTRA];
  const groups = which === "nutri" ? [["Nutrition, compléments, énergie", EXTRA]] : [["Entraînement", KB.filter(c => !c.g && !EXTRA.includes(c))], ["Maillons faibles et dos", KB.filter(c => c.g)]];
  return groups.map(([g, list]) => `<h2 class="sec">${g}</h2><div class="list">${list.map(c => `<button class="li" data-a="go" data-r="kb" data-p="${c.id}"><span class="em">${c.ic || "📘"}</span><span class="grow"><b class="small">${esc(c.t)}</b>${S().kbRead?.[c.id] ? ` <span class="xs muted">· lu</span>` : ""}</span>${c.g && !expert() ? I.lock : I.chev}</button>`).join("")}</div>`).join("");
}

function kbChapter(id) {
  const c = KB.find(x => x.id === id); if (!c) return go("kb");
  const open = c.g ? expert() : true, isExp = expert() && c.co;
  if (open) update(st => { st.kbRead = st.kbRead || {}; st.kbRead[id] = true; });
  const html = open ? (kbMode === "co" && isExp ? c.co : (c.cli || c.co)) : "";
  $app.innerHTML = header(`${c.ic || "📘"} ${esc(c.t)}`, "", { back: "__hist" }) + `<main class="page full">
    ${c.co ? `<div class="mt8">${expert() ? seg([["cli", "Version simple"], ["co", "Version experte"]], kbMode, "kb-mode") : `<p class="xs muted">🔒 Version experte avec les formules de suivi.</p>`}</div>` : ""}
    ${open ? `<article class="card mt12 prose kb">${html}</article>` : `<div class="card mt12 locked" style="position:relative;min-height:260px"><p class="small muted">${esc((c.cli || "").replace(/<[^>]+>/g, " ").slice(0, 160))}…</p>${lockVeil(c.g ? "Suivi" : "Premium")}</div>`}
  </main>`;
}
actions["kb-mode"] = (b, d) => { kbMode = d.v; kbChapter(R.param); };

// ---------- Confidentialité ----------
routes.privacy = () => {
  $app.innerHTML = header("Confidentialité", "", { back: S().profile ? "profile" : "onboarding" }) + `<main class="page full prose">
    <p><b>Responsable :</b> ${esc(CONFIG.coachName)}, micro-entrepreneur, coach sportif.</p>
    <p><b>Ce qui est envoyé sur notre serveur</b> (hébergé à Paris) : ton prénom, ton e-mail, tes réponses au questionnaire de départ, un résumé de ton activité (nombre de séances, poids, semaine du programme), tes messages avec Thomas et leurs réactions, ta candidature si tu en envoies une.</p>
    <p><b>Ce qui reste uniquement sur ton téléphone :</b> le détail de tes séances, ton journal alimentaire, tes jeûnes, ta routine, tes mensurations, tes photos, tes surlignages et tes notes de la Bible.</p>
    <p><b>Pourquoi :</b> te proposer un programme adapté, te répondre et, si tu l'as accepté, t'envoyer des conseils par e-mail. Tes données ne sont jamais vendues.</p>
    <p><b>Tes droits :</b> accès, rectification, suppression. Écris à Thomas depuis l'onglet Coach, ou efface tout depuis ton profil. Les données de ton compte serveur sont supprimées sur simple demande.</p>
  </main>`;
};
