import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as N from "../nutrition.js";
import { $app, esc, buzz, num, toast, routes, actions, forms, go, I, logo, markImg, wordOn } from "../core.js";
import { syncProfile } from "../sync.js";
import { importJSON } from "../store.js";

const OB = { i: -1, a: {}, echo: null };
const STEPS = [
  { id: "name", type: "text", q: () => `Salut, je suis Thomas, ton coach. <span class="k">Comment tu t'appelles ?</span>`, ph: "Ton prénom" },
  { id: "email", type: "email", q: (a) => `Enchanté ${esc(a.name)}. Quelle est ton <span class="k">adresse e-mail</span> ?`, sub: "Elle sert à retrouver ton compte et à recevoir mes réponses. Jamais revendue." },
  { id: "who", q: (a) => `Pour bien t'accompagner, ${esc(a.name)} : <span class="k">qui es-tu</span> ?`, opts: [["student", "Étudiant"], ["employee", "Salarié"], ["freelance", "Indépendant ou chef d'entreprise"], ["parent", "Parent, avec peu de temps pour moi"], ["shift", "Horaires décalés ou en déplacement"], ["retired", "Retraité"], ["other", "Autre"]] },
  { id: "priority", q: () => `Qu'est-ce qui compte <span class="k">le plus</span> pour toi ?`, sub: "Une seule réponse : c'est le problème que l'app doit régler en premier.", opts: [["strength", "Progresser en force sans stagner"], ["fat", "Perdre du gras sans me priver"], ["time", "M'entraîner avec peu de temps"], ["regular", "Tenir dans la durée"], ["food", "Savoir quoi manger, au gramme"], ["coach", "Être suivi par un coach"]] },
  { id: "promise", type: "info", q: (a) => `Voilà comment l'app <span class="k">règle ça</span>`, sub: "Tout est prêt dès la fin de ces questions." },
  { id: "goal", q: () => `🎯 Quel est ton <span class="k">objectif principal</span> ?`, opts: [["muscle", "Prendre du muscle"], ["strength", "Gagner en force"], ["fat", "Perdre du gras"], ["recomp", "Perdre du gras et prendre du muscle"], ["restart", "Reprendre le sport"]] },
  { id: "discipline", q: () => `🏋️ Ce qui te <span class="k">parle le plus</span> ?`, opts: [["musculation", "Musculation"], ["powerbuilding", "Powerbuilding", "Force et muscle"], ["powerlifting", "Powerlifting", "Squat, développé couché, soulevé de terre"], ["streetlifting", "Street lifting", "Tractions et dips lestés"], ["street", "Street workout", "Le programme poids du corps arrive bientôt"]] },
  { id: "level", q: () => `Où en es-tu <span class="k">aujourd'hui</span> ?`, opts: [["beginner", "Je débute"], ["comeback", "Je reprends après une pause"], ["regular", "Je m'entraîne régulièrement"], ["advanced", "Je m'entraîne depuis plus de 2 ans"]] },
  { id: "place", q: () => `Compris. <span class="k">Où</span> t'entraînes-tu ?`, opts: [["bigGym", "En salle (Basic-Fit ou équivalent)"], ["smallGym", "Dans une petite salle"], ["home", "À la maison, avec haltères"], ["bodyweight", "Au poids du corps, dehors"]] },
  { id: "days", q: () => `📅 Combien de <span class="k">jours par semaine</span> peux-tu vraiment t'entraîner ?`, sub: "Vise ce que tu tiens sur 12 semaines, pas ce que tu ferais une bonne semaine.", opts: [[2, "2 jours"], [3, "3 jours"], [4, "4 jours"], [5, "5 jours"], [6, "6 jours"]] },
  { id: "sessionMin", q: () => `⏱️ Combien de <span class="k">temps par séance</span> de musculation ?`, sub: "Échauffement compris, sans le trajet.", opts: [[45, "45 minutes ou moins"], [60, "Environ 1 heure"], [75, "1 h 15"], [90, "1 h 30"], [120, "2 heures ou plus"]] },
  { id: "sportHours", q: () => `🏃 Et en plus de la muscu, du <span class="k">sport ou du cardio</span> ?`, sub: "Foot, course, vélo, boxe, natation, danse… En moyenne, par semaine.", opts: [[0, "Non, rien d'autre"], [1.5, "Un peu", "1 à 2 h par semaine"], [3.5, "Régulièrement", "3 à 4 h par semaine"], [6, "Beaucoup", "5 h ou plus par semaine"]] },
  { id: "backPain", q: () => `As-tu une <span class="k">gêne au bas du dos</span> en ce moment ?`, opts: [[false, "Non"], [true, "Oui, régulièrement"]] },
  { id: "records", type: "records", skip: (a) => a.level === "beginner" || a.level === "comeback", q: () => `💪 Tes <span class="k">meilleures séries</span> récentes`, sub: "Répétitions et charge d'une série récente faite avec effort et bonne technique. Laisse vide ce que tu ne fais pas." },
  { id: "body", type: "body", q: () => `🔥 Pour calculer ton <span class="k">carburant</span>`, sub: "Âge, taille et poids." },
  { id: "activity", q: () => `🔥 Ta journée, <span class="k">en dehors du sport</span> ?`, sub: "Ça sert à calculer ta dépense calorique. Pense à une journée de travail ou d'études habituelle.", opts: [["low", "Presque toujours assis", "Bureau, télétravail, voiture"], ["light", "Assis, mais je bouge un peu", "Études, bureau avec trajets à pied, tâches à la maison"], ["mid", "Debout une bonne partie du temps", "Vente, enseignement, coiffure, accueil, parent au foyer"], ["high", "Métier physique", "Serveur, livreur, infirmier, aide-soignant, artisan"], ["vhigh", "Métier très physique", "BTP, déménagement, travail agricole, manutention"]] },
  { id: "steps", q: () => `👣 Combien de <span class="k">pas par jour</span> en moyenne ?`, sub: "Regarde l'app Santé de ton téléphone si tu ne sais pas. Ça affine ta dépense.", opts: [[3000, "Moins de 4 000"], [5500, "4 000 à 7 000"], [8500, "7 000 à 10 000"], [11500, "10 000 à 13 000"], [15000, "Plus de 13 000"]] },
  { id: "diet", q: () => `🍽️ Ton <span class="k">alimentation</span> ?`, opts: [["all", "Je mange de tout"], ["vegetarian", "Végétarien"], ["vegan", "Vegan"]] },
  { id: "source", q: () => `Dernière question : comment as-tu <span class="k">connu TB my Coach</span> ?`, opts: [["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["friend", "Un ami, de la famille"], ["gym", "En salle (Basic-Fit…)"], ["thomas", "Par Thomas directement"], ["google", "Google ou l'App Store"], ["other", "Autre"]] },
];
const LIFTS_ALL = [["squat", "Squat barre"], ["bench", "Développé couché barre"], ["deadlift", "Soulevé de terre"], ["ohp", "Développé militaire barre"], ["row", "Rowing barre"],
  ["dbbench", "Développé couché haltères", "halt"], ["dbohp", "Développé militaire haltères", "halt"], ["pullup", "Tractions (poids du corps ou lestées)", "lest"], ["dip", "Dips (poids du corps ou lestés)", "lest"], ["muscleup", "Muscle-up (poids du corps ou lesté)", "lest"], ["pulldown", "Tirage vertical poulie"]];
const LIFTS_FIRST = { powerlifting: ["squat", "bench", "deadlift"], streetlifting: ["pullup", "dip", "muscleup", "squat"] };
const LIFTS_ASK = (a) => { const f = LIFTS_FIRST[a.discipline] || []; return [...LIFTS_ALL.filter(l => f.includes(l[0])).sort((x, y) => f.indexOf(x[0]) - f.indexOf(y[0])), ...LIFTS_ALL.filter(l => !f.includes(l[0]))]; };
const PROMISE = {
  strength: [["🎯", "Des charges calculées à chaque séance", "Selon ton RPE : tu sais quoi soulever, l'app détecte les plateaux."], ["🏆", "Tes objectifs de force datés", "Une charge, une date : tu vois si tu es dans les temps."], ["🔁", "Des cycles de 12 semaines", "Accumulation, intensification, test : la méthode de Thomas."]],
  fat: [["🍽️", "Un plan alimentaire à ton profil", "Calories et protéines calculées, modifiables au gramme."], ["🍕", "Le cheat meal programmé", "Prévu dans l'agenda, compensé sur la semaine : pas de culpabilité."], ["🆘", "Le bouton « Je craque »", "Deux minutes pour souffler et décider, sans rattrapage."]],
  time: [["⚡", "Séances express de 10 à 45 min", "Les mouvements principaux sont gardés, le reste saute."], ["📅", "Ta semaine type", "Les séances calées dans ton agenda, déplaçables en un geste."], ["🥡", "Batch cooking", "Cuisiner une fois, manger toute la semaine."]],
  regular: [["🔥", "Séries, quêtes et trophées", "La régularité récompensée, jamais le poids."], ["🔁", "Reprendre après un raté", "Un bouton, pas une liste de reproches."], ["😴", "Récupération", "Sommeil et énergie : l'app adapte la séance du jour."]],
  food: [["🍽️", "Journal complet", "Calories, macros, fibres, sucre, sel, eau, compléments."], ["🔎", "Scan des codes-barres", "Avec la caméra, et une base de produits français."], ["🛒", "Courses et budget", "Prix par magasin, tickets de caisse, coût par repas."]],
  coach: [["🧑‍🏫", "Thomas écrit ton programme", "Entraînement et plan alimentaire, envoyés dans l'app."], ["💬", "Messages et bilans", "Il lit tes séances et ton journal, et ajuste."], ["📞", "Appels de suivi", "Selon ta formule, sur candidature."]],
};
const visible = () => STEPS.filter(s => !(s.skip && s.skip(OB.a)));
export const ONB_STEPS = STEPS;

routes.onboarding = () => {
  if (OB.i < 0) return welcome();
  const steps = visible(), s = steps[OB.i];
  if (!s) return building();
  const pct = Math.round(OB.i / steps.length * 100);
  let body;
  if (s.type === "text") body = `<form class="choices" data-f="ob-text" style="align-items:stretch"><label class="field"><span>${s.ph}</span><input name="v" autocomplete="given-name" required maxlength="30" value="${esc(OB.a[s.id] || "")}"></label><button class="btn btn-red">Continuer</button></form>`;
  else if (s.type === "email") body = `<form class="choices" data-f="ob-email" style="align-items:stretch"><label class="field"><span>Adresse e-mail</span><input name="v" type="email" autocomplete="email" inputmode="email" required value="${esc(OB.a.email || "")}"></label>
    <label class="check"><input type="checkbox" name="news" ${OB.a.news !== false ? "checked" : ""}> Recevoir mes conseils et les nouveautés de TB my Coach par e-mail (désinscription en un clic).</label>
    <p class="xs muted" style="text-align:left;margin:0">En continuant, tu acceptes la <a href="#/privacy">politique de confidentialité</a>.</p><button class="btn btn-red">Continuer</button></form>`;
  else if (s.type === "records") body = `<form class="choices" data-f="ob-records" style="align-items:stretch">${LIFTS_ASK(OB.a).map(([k, n, lest]) => `<div><div class="small" style="font-weight:700;margin-bottom:6px;text-align:left">${n}</div><div class="grid2"><label class="field"><span>${lest === "lest" ? "Lest (kg), vide = poids du corps" : lest === "halt" ? "Charge par haltère (kg)" : "Charge (kg)"}</span><input name="${k}-k" inputmode="decimal" placeholder="0"></label><label class="field"><span>Répétitions</span><input name="${k}-r" inputmode="numeric" placeholder="0"></label></div></div>`).join("")}<button class="btn btn-red">Continuer</button><button type="button" class="link" data-a="ob-skip" style="align-self:center">Je ne sais pas, passer</button></form>`;
  else if (s.type === "body") body = `<form class="choices" data-f="ob-body" style="align-items:stretch"><div class="seg"><button type="button" data-a="ob-sex" data-v="m" class="${OB.a.sex !== "f" ? "on" : ""}">Homme</button><button type="button" data-a="ob-sex" data-v="f" class="${OB.a.sex === "f" ? "on" : ""}">Femme</button></div><div class="grid3"><label class="field"><span>Âge</span><input name="age" inputmode="numeric" required value="${OB.a.age || ""}"></label><label class="field"><span>Taille (cm)</span><input name="height" inputmode="numeric" required value="${OB.a.height || ""}"></label><label class="field"><span>Poids (kg)</span><input name="weight" inputmode="decimal" required value="${OB.a.weight || ""}"></label></div><button class="btn btn-red">Continuer</button></form>`;
  else if (s.type === "info") body = `<div class="choices" style="align-items:stretch">${(PROMISE[OB.a.priority] || PROMISE.regular).map(([e, t, d]) => `<div class="choice" style="text-align:left;cursor:default"><b>${e} ${t}</b><small>${d}</small></div>`).join("")}<button class="btn btn-red mt8" data-a="ob-info">Continuer</button></div>`;
  else body = `<div class="choices">${s.opts.map(([v, l, sub]) => `<button class="choice" data-a="ob-pick" data-v='${JSON.stringify(v)}'>${l}${sub ? `<small>${sub}</small>` : ""}</button>`).join("")}</div>`;
  $app.innerHTML = `<section class="convo"><div class="convo-top"><button class="icon-btn" data-a="ob-back" aria-label="Retour">${I.back}</button><div class="progress"><i style="width:${pct}%"></i></div></div>
    ${OB.echo ? `<div class="echo">${esc(OB.echo)}</div>` : ""}
    <div class="coach-mark"><span class="av">${I.x(22)}</span>Thomas · ton coach</div>
    <h1 class="q">${s.q(OB.a)}</h1>${s.sub ? `<p class="q-sub">${s.sub}</p>` : ""}${body}</section>`;
};
function welcome() {
  $app.innerHTML = `<section class="convo" style="justify-content:space-between">
    <div class="mt24" style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">${markImg(150)}${logo(30)}</div>
    <div><p class="kicker">Corps · régularité · méthode</p><h1 class="hello mt8" style="font-size:46px">Un seul plan pour ton corps.</h1>
      <p class="mt16 muted" style="font-size:17px">Entraînement, nutrition et progression calculés pour toi par un coach diplômé STAPS. Des charges qui suivent ce que tu fais vraiment.</p></div>
    <div class="stack"><button class="btn btn-red" data-a="ob-start">Créer mon plan gratuit</button>
      <label class="btn btn-line" style="cursor:pointer">Restaurer une sauvegarde<input type="file" accept="application/json" data-c="import" hidden></label></div></section>`;
}
function next(val, echo) { const s = visible()[OB.i]; if (s) OB.a[s.id] = val; OB.echo = echo; OB.i++; buzz(); routes.onboarding(); }
async function building() {
  const a = OB.a;
  const lines = ["Analyse de ton profil", "Choix de ton programme", "Calcul de tes charges", "Calcul de ton carburant"];
  $app.innerHTML = `<section class="loader"><svg class="big-x" viewBox="0 0 40 40"><defs><linearGradient id="gxl" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8F3510"/><stop offset=".6" stop-color="#C2541F"/><stop offset="1" stop-color="#EE8A45"/></linearGradient></defs><path class="s1" d="M9 9l22 22" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/><path class="s2" d="M9 31 31 9" stroke="url(#gxl)" stroke-width="5" stroke-linecap="round" fill="none"/></svg><ul style="padding:0;margin:0">${lines.map(l => `<li><i></i>${l}</li>`).join("")}</ul></section>`;
  await Promise.all([E.loadPrograms(), N.loadModels()]);
  const rec = {};
  Object.entries(a.records || {}).forEach(([k, v]) => { if (v.r > 0) rec[k] = { ...v, rpe: 9, e1rm: v.k > 0 ? Math.round(E.e1rm(v.k, v.r, 9) * 10) / 10 : 0, d: today() }; });
  const profile = { name: a.name, email: a.email, news: a.news !== false, goal: a.goal, discipline: a.discipline === "street" ? "musculation" : a.discipline, wantsStreet: a.discipline === "street", level: a.level, place: a.place, days: a.days, backPain: a.backPain, records: rec, sex: a.sex || "m", age: +a.age, height: +a.height, weight: +a.weight, activity: a.activity, sessionMin: a.sessionMin || 60, sportHours: a.sportHours || 0, stepsAvg: a.steps || null, stepsGoal: Math.max(8000, Math.ceil(((a.steps || 0) + 1000) / 1000) * 1000), diet: a.diet, who: a.who || null, priority: a.priority || null, source: a.source || null, createdAt: today() };
  profile.nutritionModel = N.pickModel(profile);
  profile.startProgram = E.pickProgram(profile);
  update(st => {
    st.profile = profile; st.trialStart = st.trialStart || today(); st.settings.word = a.word || "daily"; st.synced = false;
    st.plan = { programId: profile.startProgram, startedAt: today(), week: 1, idx: 0, cycle: 1 };
    st.measures.push({ d: today(), weight: profile.weight });
    st.daily[today()] = { ...(st.daily[today()] || {}), weight: profile.weight };
  });
  const sync = syncProfile();
  const lis = [...$app.querySelectorAll("li")];
  for (let k = 0; k < lis.length; k++) { await new Promise(r => setTimeout(r, 550)); lis[k].classList.add("ok"); lis[k].querySelector("i").innerHTML = I.check.replace("<svg", '<svg width="13" height="13"'); }
  await Promise.race([sync, new Promise(r => setTimeout(r, 2500))]);
  OB.i = -1; OB.a = {}; OB.echo = null;
  go("plan");
}

routes.plan = () => {
  const ns = E.nextSession(); if (!ns) return go("home");
  const { p } = ns, t = N.targets(), lay = E.weekLayout(p);
  $app.innerHTML = `<main class="page full">
    <p class="kicker mt16">🎯 Ton plan, ${esc(S().profile.name)}</p>
    <h1 class="hello mt8">${esc(p.name.split("·")[0].trim())}</h1>
    <p class="muted mt8">${esc(p.desc)}</p>
    <div class="stat3 mt16"><div><b>${p.s.length}×</b><span>par semaine</span></div><div><b>${ns.weeks}</b><span>semaines</span></div><div><b style="font-size:18px;line-height:29px">${esc(p.lvl)}</b><span>niveau</span></div></div>
    ${S().profile.days !== p.s.length ? `<p class="small muted mt12">Tu as choisi ${S().profile.days} jours : ce programme en demande ${p.s.length}, le meilleur rapport résultats / régularité pour ton profil.</p>` : ""}
    <h2 class="sec">📅 Ta semaine type</h2>
    ${lay.map((l, i) => `<div class="card ${i === 0 ? "hl" : ""}" style="padding:14px 16px"><span class="tag ${i === 0 ? "r" : ""}">${E.DAY_NAMES[l.dow]}</span>${i === 0 ? '<span class="tag r">Première séance</span>' : ""}<div class="h3 mt4">${esc(l.s[0])}</div><div class="small muted">${l.s[2].length} exercices</div></div>`).join("")}
    <h2 class="sec">💡 Pourquoi ce plan marche</h2><div class="card"><p style="margin:0">${esc(p.why)}</p></div>
    <h2 class="sec">🔥 Ton carburant</h2><div class="card"><div class="row between"><b class="h2">${t.kcal} kcal</b><span class="small muted">${esc(t.model.name)}</span></div><p class="small muted mt8" style="margin:0">${t.prot} g de protéines · ${t.carbs} g de glucides · ${t.fat} g de lipides par jour</p></div>
  </main><div class="dock"><button class="btn btn-red" data-a="go" data-r="home">C'est parti</button></div>`;
};

actions["ob-start"] = () => { OB.i = 0; OB.echo = null; routes.onboarding(); };
actions["ob-back"] = () => { if (OB.i <= 0) OB.i = -1; else { OB.i--; OB.echo = null; } routes.onboarding(); };
actions["ob-pick"] = (b, d) => next(JSON.parse(d.v), b.firstChild.textContent.trim());
actions["ob-skip"] = () => next({}, "Je passe");
actions["ob-info"] = () => next(true, null);
actions["ob-sex"] = (b, d) => { OB.a.sex = d.v; b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); };
forms["ob-text"] = (v) => { if (v.v.trim()) next(v.v.trim(), v.v.trim()); };
forms["ob-email"] = (v) => { const em = v.v.trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast("Vérifie ton adresse e-mail."); OB.a.news = !!v.news; next(em, em); };
forms["ob-records"] = (v) => {
  const rec = {}; LIFTS_ASK(OB.a).forEach(([k, , t]) => { const r = num(v[k + "-r"]), kg = num(v[k + "-k"]) || 0; if (r > 0 && (kg > 0 || t === "lest")) rec[k] = { r, k: kg }; });
  const n = Object.keys(rec).length; next(rec, n ? `${n} record${n > 1 ? "s" : ""} enregistré${n > 1 ? "s" : ""}` : "Je passe");
};
forms["ob-body"] = (v) => {
  const age = num(v.age), height = num(v.height), weight = num(v.weight);
  if (!(age > 12 && age < 100 && height > 120 && height < 230 && weight > 30 && weight < 250)) return toast("Vérifie ton âge, ta taille et ton poids.");
  Object.assign(OB.a, { age, height, weight, sex: OB.a.sex || "m" }); next({ age, height, weight }, `${age} ans · ${height} cm · ${E.fmtKg(weight)} kg`);
};
export function resetOnboarding() { OB.i = -1; OB.a = {}; OB.echo = null; }
