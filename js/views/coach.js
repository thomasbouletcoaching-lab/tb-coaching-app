import { analyseHtml } from "./stats.js";
import { GOALS } from "../programme.js";
import { libelleGenre, libelleSexe } from "../genre.js";
import { PUBLIC_OFFERS } from "../config.js";
// Coach : messagerie (avec réactions), offres et démo, candidature, bilans, notifications, espace coach.
import { S, update, today, withState } from "../store.js";
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import { CONFIG, OFFERS, offer, assignable, COMPARE, TRIAL_DAYS } from "../config.js";
import { adherenceCard, defiCard } from "./suivi.js";
import { checkinCard } from "./checkin.js";
import { memberSuivi } from "./suivi-coach.js";
import * as BR from "../bilan-reglages.js";
import { recapExercice, serieTxt } from "../recap.js";
import { pushState, enablePush, disablePush } from "../push.js";
import * as RV from "../revue.js";
import { QUIZ_TOKEN } from "./quizexos.js";
import * as XO from "../exercices.js";
import * as CA from "../cardio.js";
import { ouvrirEditeur } from "./cardio.js";
import { ouvrirVideo } from "./video.js";
import { absenceBanner, reseauBlock } from "./reseau.js";
import { claimInvite } from "../sync.js";
import { myAdherence, summaryBetween, checkins as myCheckins, defiDay, since as sinceStart } from "../progress.js";
import { ring, coachLogo, trialLeft, $app, esc, num, fr, buzz, toast, ago, routes, R, actions, forms, changes, go, I, header, tabbar, adminTabbar, seg, chips, sheet, closeSheet, badges, fmtDate, addDays, rerender, tier, rank, premium, isCoach, msgQuotaText, cloud, cloudNow, render, onLeave, canMsg, locked } from "../core.js";
import { refreshMe, syncProfile } from "../sync.js";
import { fromCoach, libraryRows } from "../library.js";
import { openProgramEditor } from "./coachprog.js";

routes.coach = async () => {
  if (isCoach()) return go("admin");
  await E.loadPrograms();
  const o = offer(tier()), sent = fromCoach(), progs = sent.filter(r => r.kind === "program"), plans = sent.filter(r => r.kind === "plan");
  const bubble = `<button class="pill ic" data-a="coach-msg" aria-label="Messages avec Thomas" style="position:relative">${I.coach}${badges.msgs ? `<span class="badge">${badges.msgs}</span>` : ""}</button>`;
  const coached = canMsg();
  const curP = S().plan?.programId;
  $app.innerHTML = header("Coaching", esc(CONFIG.coachName), { actions: bubble, offers: false }) + `<main class="page">
    ${badges.msgs || badges.notifs ? `<button class="card tap mt12" data-a="${badges.msgs ? "coach-msg" : "notifs"}" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;box-shadow:0 0 0 2px var(--red) inset"><span style="font-size:26px">🔔</span><span class="grow"><b>${badges.msgs ? `${badges.msgs} nouveau${badges.msgs > 1 ? "x" : ""} message${badges.msgs > 1 ? "s" : ""} de Thomas` : `${badges.notifs} notification${badges.notifs > 1 ? "s" : ""} de ton coach`}</b><br><span class="small muted">Touche pour lire</span></span>${I.chev}</button>`
      : `<p class="small muted mt12">${coached ? "Aucune nouvelle notification de ton coach." : "Les messages avec Thomas sont réservés aux personnes coachées."}</p>`}
    ${absenceBanner()}${coached ? "" : `<button class="card tap mt12" data-a="code-coach" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:24px">🔑</span><span class="grow"><b class="small">J'ai un code de Thomas</b><br><span class="xs muted">Il a préparé ton espace : entre ton code pour le retrouver</span></span>${I.chev}</button>`}
    ${await defiCard()}${checkinCard()}
    <div class="row mt12" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="go" data-r="bilan">📝 Mon bilan</button><button class="btn btn-line btn-sm grow" data-a="go" data-r="bilans">Mes bilans</button><button class="btn btn-line btn-sm grow" data-a="go" data-r="rapport">📤 Rapport</button></div>
    <h2 class="sec">📋 Mon programme du coach</h2>
    ${progs.length || plans.length ? `${progs.map(r => { const id = "lib-" + r.id, on = curP === id; return `<div class="card"><div class="lbl">🏋️ Entraînement</div><b class="h3">${esc(r.name)}</b><p class="small muted mt4">${esc(r.data?.desc || "Écrit pour toi par Thomas.")}</p>${on ? `<span class="tag r">Programme suivi</span> <button class="link small" data-a="go" data-r="carnet">Ouvrir le carnet</button>` : `<button class="btn btn-red btn-sm mt8" data-a="coach-follow" data-id="${id}">Suivre ce programme</button>`}</div>`; }).join("")}
      ${plans.map(r => { const k = (r.data?.meals || []).flatMap(m => m.items || []).reduce((a, x) => a + (x.kcal || 0), 0); return `<div class="card"><div class="lbl">🍽️ Nutrition</div><b class="h3">${esc(r.name)}</b><p class="small muted mt4">${(r.data?.meals || []).length} repas · ${fr(k)} kcal par jour${r.data?.note ? " · " + esc(r.data.note) : ""}</p><button class="btn ${S().coachPlanId === r.id ? "btn-line" : "btn-red"} btn-sm mt8" data-a="coach-plan" data-id="${r.id}">${S().coachPlanId === r.id ? "✓ Plan appliqué · le réappliquer" : "Appliquer ce plan à mon journal"}</button></div>`; }).join("")}`
      : `<div class="card"><p class="small" style="margin:0">${coached ? "Thomas t'envoie ici ton programme d'entraînement et ton plan alimentaire, écrits pour toi. Ils apparaissent dès qu'il les a préparés." : "Avec le coaching personnalisé, Thomas écrit ton programme d'entraînement et ton plan alimentaire : ils arrivent ici, et il suit tes séances et ton journal."}</p>${coached ? "" : `<button class="btn btn-red btn-sm mt12" data-a="go" data-r="apply">Candidater au coaching</button>`}</div>`}
    ${mesConsignes()}
    ${await reseauBlock()}
    <h2 class="sec">🎯 Ta formule <small>${esc(o.name)}</small></h2>
    ${rank() >= 2 ? followUp() : `<button class="card tap" data-a="go" data-r="offers" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left"><span style="font-size:28px">🚀</span><span class="grow"><b>${premium() ? "Passer au coaching avec Thomas" : "Voir les offres"}</b><br><span class="small muted">${premium() ? "Programme et plan écrits pour toi, bilans, messages" : `Bâtisseur : ${TRIAL_DAYS} jours offerts, puis 19,99 €/mois`}</span></span>${I.chev}</button>`}
    ${rank() >= 2 ? `<button class="card tap mt12" data-a="go" data-r="offers" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left"><span class="grow"><b>Toutes les offres</b><br><span class="small muted">Comparer et changer de formule</span></span>${I.chev}</button>` : ""}
  </main>${tabbar("coach")}`;
};
actions["coach-msg"] = () => { if (canMsg()) return go("chat"); toast("Les messages avec Thomas sont réservés aux personnes coachées"); go("offers"); };
actions["coach-follow"] = (b, d) => { const p = E.program(d.id); if (!p) return toast("Programme indisponible hors connexion"); if (!confirm(`Suivre « ${p.name} » ? Ton programme actuel s'arrête, tes charges sont gardées.`)) return; update(st => st.plan = { programId: d.id, startedAt: today(), week: 1, idx: 0, cycle: 1 }); toast("C'est parti : ton nouveau programme est dans le carnet"); go("carnet"); };
actions["coach-plan"] = (b, d) => { const r = libraryRows().find(x => x.id === +d.id); if (!r?.data?.meals) return; update(st => { st.myPlan = { meals: JSON.parse(JSON.stringify(r.data.meals)) }; st.coachPlanId = r.id; st.editVar = null; }); toast("Plan de Thomas appliqué : il s'affiche chaque jour dans ton journal"); rerender(); };
function followUp() {
  const r = rank(), weekly = r >= 3;
  return `<div class="card"><div class="h3">📝 ${weekly ? "Bilan de la semaine" : "Bilan du mois"}</div><p class="small muted mt4">Envoie-le chaque ${weekly ? "dimanche" : "fin de mois"} : je te réponds avec tes ajustements.</p><button class="btn btn-red btn-sm mt8" data-a="checkin">Remplir mon bilan</button></div>
    ${r >= 4 ? `<div class="card"><div class="h3">📞 Mes appels avec Thomas</div><p class="small muted mt4">${r >= 5 ? "Un appel toutes les deux semaines." : "Un appel par mois."}</p><a class="btn btn-line btn-sm mt8" href="${CONFIG.calendly}" target="_blank" rel="noopener noreferrer">Réserver un appel</a></div>
      <div class="card"><div class="h3">🎥 Analyse de ta technique</div><p class="small muted mt4">Filme une série de profil et envoie-moi le lien de la vidéo dans les messages : je te réponds avec mes corrections.</p></div>` : ""}
    ${false ? `<div class="card hl"><div class="h3">✝ Corps, âme et esprit</div><p class="small muted mt4">Ton accompagnement inclut aussi tes objectifs de vie, ta discipline et, si tu le souhaites, ta foi. On en parle à chaque appel.</p></div>` : ""}`;
}

// ---------- Offres et démo ----------
routes.offers = () => {
  const cur = S().me?.tier || "free";
  $app.innerHTML = header("Les offres", locked() ? "Ton essai est terminé" : `${TRIAL_DAYS} jours d'essai, sans carte bancaire`, { back: "__hist", offers: false }) + `<main class="page">
    <h2 class="sec" style="margin-top:8px">Ce qui accélère vraiment tes progrès</h2>
    <div class="list">${[["🎯", "Des charges calculées à chaque séance", "Fini le hasard : l'app te dit quoi soulever selon ton RPE, et détecte tes plateaux avant qu'ils durent."],
      ["🍽️", "Un plan alimentaire au gramme", "Ton plan selon ton profil, tes jours d'entraînement et de repos, tes courses et ton budget."],
      ["📈", "Toutes tes données, lisibles", "Tonnage, records, mensurations, projections : tu vois si tu avances, semaine après semaine."],
      ["🧑‍🏫", "Le coaching : quelqu'un qui ajuste pour toi", "Thomas écrit ton programme et ton plan, lit tes séances, répond à tes messages."]].map(([e, t, d]) => `<div class="li"><span class="em">${e}</span><span class="grow small"><b>${t}</b><br><span class="xs muted">${d}</span></span></div>`).join("")}</div>
    ${locked() ? `<div class="card grad"><b>🔒 Ton essai de ${TRIAL_DAYS} jours est terminé</b><p class="small mt4" style="margin:0">Pour continuer, choisis Bâtisseur (19,99 €/mois, résiliable à tout moment) ou candidate au coaching. Tes données sont conservées. Thomas t'a offert un accès ? Connecte-toi avec ton compte.</p><button class="btn btn-line btn-sm mt8" data-a="go" data-r="account">Me connecter</button></div>` : trialLeft() > 0 ? `<div class="card grad"><b>🎁 Ton essai : encore ${trialLeft()} jour${trialLeft() > 1 ? "s" : ""}</b><p class="small mt4" style="margin:0">Pendant ${TRIAL_DAYS} jours, tout Bâtisseur est ouvert, sans carte bancaire. Ensuite : 19,99 €/mois, résiliable à tout moment.</p></div>` : `<div class="card grad"><b>🎁 ${TRIAL_DAYS} jours d'essai, sans carte bancaire</b><p class="small mt4" style="margin:0">Chaque nouveau compte essaie Bâtisseur pendant ${TRIAL_DAYS} jours. Ensuite : 19,99 €/mois.</p></div>`}
    <h2 class="sec">Comparer</h2>
    <div class="card" style="padding:6px"><table class="cmpt"><thead><tr><th></th><th>Bâtisseur</th><th>Coaching</th></tr></thead><tbody>${COMPARE.map(r => `<tr><td>${esc(r[0])}</td>${[r[2], r[4]].map(c => `<td class="${c === "–" ? "muted" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${PUBLIC_OFFERS.map(o => `<div class="offer ${o.id === cur ? "cur" : ""} mt16">${o.id === cur ? `<span class="ribbon">Ta formule</span>` : o.ribbon ? `<span class="ribbon">${esc(o.ribbon)}</span>` : ""}
      <div class="row between" style="align-items:flex-end;flex-wrap:wrap;gap:4px 12px"><div style="flex:1 1 150px;min-width:0"><div class="h2">${esc(o.name)}</div><div class="small muted">${esc(o.tagline)}</div></div><div class="price" style="text-align:right;white-space:nowrap;margin-left:auto">${esc(o.price)}<small>${esc(o.per)}</small></div></div>
      ${o.alt ? `<div class="small red mt4" style="text-align:right">${esc(o.alt)}</div>` : ""}${o.was ? `<div class="small mt4" style="text-align:right"><span class="muted">au lieu de <s>${esc(o.was)}</s></span></div>` : ""}
      <ul>${o.feats.map(f => `<li>${I.check}<span>${esc(f)}</span></li>`).join("")}<li>${I.check}<span>${esc(o.msgs)}</span></li></ul>
      ${o.id === cur ? "" : `<button class="btn btn-red" data-a="choose" data-v="${o.id}">${o.rank >= 2 ? "Candidater au coaching" : locked() || trialLeft() > 0 ? "S'abonner · 19,99 €/mois" : `Essayer ${TRIAL_DAYS} jours gratuitement`}</button>${o.rank === 1 && o.pay?.year && (locked() || trialLeft() > 0) ? `<button class="btn btn-line mt8" data-a="choose-year">S'abonner à l'année · 119,99 €</button>` : ""}`}
    </div>`).join("")}
    <p class="xs muted mt16">Sans engagement, résiliable à tout moment. Les formules de suivi démarrent après un appel de 15 minutes pour vérifier que je peux vraiment t'aider.</p>
  </main>${tabbar("coach")}`;
};
actions.demo = (b, d) => { update(st => st.demoTier = d.v); toast(`Démo ${offer(d.v).name} : explore l'app`); go("home"); };
actions["demo-exit"] = () => { update(st => st.demoTier = null); render(); };
actions["demo-choose"] = () => { const t = S().demoTier; update(st => st.demoTier = null); chooseOffer(t); };
actions.choose = (b, d) => chooseOffer(d.v);
actions["choose-year"] = () => chooseOffer("premium", "year");
function chooseOffer(id, per = "month") {
  const o = offer(id);
  if (o.rank === 1) {
    const link = o.pay?.[per];
    if (link) { const u = new URL(link); const c = cloudNow()?.userId?.(); if (c) u.searchParams.set("client_reference_id", c); if (S().profile?.email) u.searchParams.set("prefilled_email", S().profile.email); location.href = u.toString(); return; }
    sheet(`<h2 class="h1">Bâtisseur</h2><p class="mt12">Le paiement en ligne ouvre très bientôt. En attendant, écris-moi : je t'active la formule Bâtisseur moi-même.</p><button class="btn btn-red mt12" data-a="prefill" data-t="Bonjour Thomas, je veux passer à la formule Bâtisseur.">Écrire à Thomas</button>`);
    return;
  }
  const m = S().anamnese?.motivation, h = S().anamnese?.history;
  startApply(id, { goal: m?.proud || "", obstacle: h?.stopped || "" });
}
actions.prefill = (b, d) => { closeSheet(); window.__prefill = d.t; go("chat"); };

// ---------- Candidature ----------
const AP = { i: 0, a: {} };
// Ouvre la candidature (depuis les offres, le Défi 14 jours…) avec des réponses déjà connues
export function startApply(offerId = "avance", prefill = {}) { AP.i = 0; AP.a = { offer: offerId, ...prefill }; go("apply"); }
const AQ = [
  { id: "goal", q: "🎯 Ton objectif précis dans 12 semaines ?", type: "text", ph: "Ex. perdre 6 kg, ou passer de 100 à 120 kg au squat" },
  { id: "obstacle", q: "Qu'est-ce qui t'a fait abandonner ou stagner les fois précédentes ?", type: "text", ph: "Sois honnête, c'est entre nous" },
  { id: "time", q: "⏱️ Combien d'heures par semaine peux-tu vraiment bloquer ?", opts: [["lt2", "Moins de 2 h"], ["2-3", "2 à 3 h"], ["3-5", "3 à 5 h"], ["5+", "Plus de 5 h"]] },
  { id: "urgency", q: "🔥 De 1 à 10, à quel point c'est important pour toi maintenant ?", opts: [[10, "10 · c'est ma priorité"], [8, "8"], [6, "6"], [4, "4 ou moins"]] },
  { id: "phone", q: "📞 Ton téléphone, pour notre appel", type: "phone" },
];
routes.apply = () => {
  if (!AP.a.offer) return go("offers");
  const s = AQ[AP.i]; if (!s) return applyDone();
  let body;
  if (s.type === "text") body = `<form class="choices" data-f="ap-text" style="align-items:stretch"><label class="field"><span>${esc(s.ph)}</span><textarea name="v" required maxlength="400">${esc(AP.a[s.id] || "")}</textarea></label><button class="btn btn-red">Continuer</button></form>`;
  else if (s.type === "phone") body = `<form class="choices" data-f="ap-phone" style="align-items:stretch"><label class="field"><span>Téléphone (facultatif)</span><input name="v" type="tel" autocomplete="tel"></label><button class="btn btn-red">Envoyer ma candidature</button></form>`;
  else body = `<div class="choices">${s.opts.map(([v, l]) => `<button class="choice" data-a="ap-pick" data-v='${JSON.stringify(v)}'>${l}</button>`).join("")}</div>`;
  $app.innerHTML = `<section class="convo"><div class="convo-top"><button class="icon-btn" data-a="ap-back" aria-label="Retour">${I.back}</button><div class="progress"><i style="width:${AP.i / AQ.length * 100}%"></i></div></div>
    <div class="coach-mark"><span class="av">${coachLogo(20)}</span>Candidature · ${esc(offer(AP.a.offer).name)}</div><h1 class="q">${esc(s.q)}</h1>${body}</section>`;
};
actions["ap-back"] = () => { if (AP.i === 0) go("offers"); else { AP.i--; routes.apply(); } };
actions["ap-pick"] = (b, d) => { AP.a[AQ[AP.i].id] = JSON.parse(d.v); AP.i++; buzz(); routes.apply(); };
forms["ap-text"] = (v) => { AP.a[AQ[AP.i].id] = v.v.trim(); AP.i++; routes.apply(); };
forms["ap-phone"] = (v) => { AP.a.phone = v.v.trim(); AP.i++; routes.apply(); };
function calendlyUrl(a) {
  const u = new URL(CONFIG.calendly);
  u.searchParams.set("name", S().profile?.name || ""); u.searchParams.set("email", S().profile?.email || "");
  const d = a.dossier || {};
  u.searchParams.set("a1", `Offre : ${offer(a.offer).name}\nObjectif : ${a.goal}\nFrein : ${a.obstacle}\nTemps : ${a.time} · Urgence : ${a.urgency}/10`
    + (d.score != null ? `\nRégularité : ${d.score}/100 · ${d.sessions} séances · ${d.checkins} bilans${d.weight != null ? ` · poids ${d.weight > 0 ? "+" : ""}${String(d.weight).replace(".", ",")} kg` : ""}${d.waist != null ? ` · taille ${d.waist > 0 ? "+" : ""}${String(d.waist).replace(".", ",")} cm` : ""}${d.defiDay ? ` · défi jour ${d.defiDay}` : ""}` : "")
    + (d.why ? `\nPourquoi maintenant : ${d.why}` : ""));
  return u.toString();
}
function applyDone() {
  const a = { ...AP.a, at: new Date().toISOString(), dossier: applyDossier() };
  update(st => { st.application = a; st.synced = false; });
  syncProfile();
  $app.innerHTML = `<section class="convo" style="justify-content:center">
    <div class="coach-mark"><span class="av">${coachLogo(20)}</span>Thomas</div>
    <h1 class="q">Merci ${esc(S().profile.name)}. J'ai bien reçu ta candidature pour ${esc(offer(a.offer).name)}.</h1>
    <p class="q-sub">Dernière étape : réserve notre appel de 15 minutes. Tes réponses me seront transmises avec la réservation.</p>
    <div class="stack mt32"><a class="btn btn-red" href="${calendlyUrl(a)}" target="_blank" rel="noopener noreferrer">📞 Réserver mon appel</a><button class="btn btn-line" data-a="go" data-r="home">Plus tard</button></div></section>`;
  AP.i = 0; AP.a = {};
}

// ---------- Messagerie (avec réactions) ----------
const REACTS = ["👍", "❤️", "🙏", "🔥", "💪", "😂"];
let pollT = null, msgs = [], me = null;
const stopPoll = () => { clearInterval(pollT); pollT = null; };
function msgHtml(x) {
  const mine = x.sender === me, rs = Object.values(x.reactions || {});
  const grouped = rs.reduce((o, e) => (o[e] = (o[e] || 0) + 1, o), {});
  const pj = (Array.isArray(x.media) ? x.media : []).filter(m => m && typeof m.path === "string").map(m => {
    const t = String(m.type || ""), p = esc(m.path);
    if (t.startsWith("image")) return `<img data-mp="${p}" alt="Photo jointe" loading="lazy" style="max-width:100%;border-radius:10px;display:block;margin-bottom:6px">`;
    if (t.startsWith("video")) return `<video controls playsinline preload="none" data-mp="${p}" style="max-width:100%;border-radius:10px;display:block;margin-bottom:6px"></video><button class="link xs" data-a="vd-from" style="margin-bottom:6px">🔬 Analyser la vidéo</button>`;
    return `<audio controls preload="none" data-ap="${p}" style="width:220px;max-width:100%;display:block"></audio>`;
  }).join("");
  const quiz = (x.body || "").includes(QUIZ_TOKEN), body = (x.body || "").replace(QUIZ_TOKEN, "").trim();
  const content = x.audio_path ? `<audio controls preload="none" data-ap="${esc(x.audio_path)}" style="width:220px;max-width:100%;display:block"></audio>` : pj + esc(body) + (quiz ? (isCoach() ? `<div class="xs mt4" style="opacity:.8">📋 Quiz envoyé : ses réponses arrivent dans la conversation.</div>` : `<button class="btn btn-red btn-sm mt8" data-a="go" data-r="quiz-exos" style="width:100%">📋 Faire le quiz</button>`) : "");
  return `<div class="msg ${mine ? "me" : "them"}" data-a="msg" data-id="${x.id}">${content}<time>${ago(x.created_at)}${mine && x.read_at ? " · lu" : ""}</time></div>${rs.length ? `<div class="reacts ${mine ? "me" : "them"}">${Object.entries(grouped).map(([e, n]) => `<span>${e}${n > 1 ? " " + n : ""}</span>`).join("")}</div>` : ""}`;
}
// Messages prêts (espace coach) : phrases réutilisables, stockées dans l'espace coach (clé « ready »)
const READY0 = [
  { id: "r1", label: "Séance validée", body: "Séance bien validée. Continue comme ça, on ajuste la suite à la prochaine." },
  { id: "r2", label: "Charge trop lourde", body: "Si la série est trop dure, baisse la charge de 5 % et garde la même technique. Mieux vaut une série propre qu'une série forcée." },
  { id: "r3", label: "Envoie une vidéo", body: "Envoie-moi une vidéo de ta prochaine série, de côté, pour que je vérifie la technique." },
  { id: "r4", label: "Repas non notés", body: "Tu n'as pas noté tes repas cette semaine. Note au moins les repas principaux, on ajustera à partir de là." },
  { id: "r5", label: "Bilan reçu", body: "Bilan reçu, merci. Je regarde tes chiffres et je reviens vers toi avant la prochaine séance." },
];
let READY = null;
const readyList = () => READY || READY0;
export { readyList };
export async function ensureReady() { if (READY === null) await readyLoad(); return readyList(); }
function readyBar() {
  return `<div id="ready-bar" style="display:flex;gap:6px;overflow-x:auto;padding:8px 0;white-space:nowrap"><button class="chip sm" data-a="quiz-send">📋 Quiz exos</button>${readyList().map(r => `<button class="chip sm" data-a="ready-use" data-v="${esc(r.id)}">${esc(r.label)}</button>`).join("")}<button class="chip sm" data-a="ready-manage">⚙️ Gérer</button></div>`;
}
async function readyLoad() {
  try { const c = await cloud(); const s = await c.storeGet(["ready"]); READY = Array.isArray(s.ready) ? s.ready : READY0; }
  catch (e) { READY = READY0; }
  const bar = document.getElementById("ready-bar"); if (bar) bar.outerHTML = readyBar();
}
async function readySave(list) {
  READY = list; const bar = document.getElementById("ready-bar"); if (bar) bar.outerHTML = readyBar();
  try { const c = await cloud(); await c.storeSet("ready", list); } catch (e) { toast("Enregistrement impossible : " + e.message); }
}
actions["ready-use"] = (b, d) => {
  const r = readyList().find(x => x.id === d.v), t = document.querySelector("form.composer textarea");
  if (r && t) { t.value = r.body; t.focus(); t.dispatchEvent(new Event("input", { bubbles: true })); }
};
actions["ready-manage"] = () => {
  sheet(`<h2 class="h2">Messages prêts</h2><p class="xs muted">Un tap remplit ton message.</p>
    ${readyList().map(r => `<div class="card mt8"><div class="row between"><b>${esc(r.label)}</b><button class="ghost sm" data-a="ready-del" data-v="${esc(r.id)}">Supprimer</button></div><p class="small mt4" style="white-space:pre-wrap">${esc(r.body)}</p></div>`).join("")}
    <form data-f="ready-new" class="mt12"><label class="field"><span>Titre court</span><input name="label" required maxlength="40"></label><label class="field"><span>Message</span><textarea name="body" rows="3" required maxlength="1000"></textarea></label><button class="btn btn-red mt8">Ajouter</button></form>`);
};
actions["ready-del"] = async (b, d) => { await readySave(readyList().filter(r => r.id !== d.v)); closeSheet(); toast("Supprimé"); };
forms["ready-new"] = async (v) => { await readySave([...readyList(), { id: "r" + Date.now(), label: v.label.trim(), body: v.body.trim() }]); closeSheet(); toast("Message prêt ajouté"); };

// Lecteurs audio : l'adresse signée n'est demandée qu'au moment de l'affichage
async function hydrateAudio() {
  const c = await cloud(); if (!c) return;
  document.querySelectorAll("[data-mp]:not([src])").forEach(async el => {
    try { el.src = await c.audioUrl(el.dataset.mp); }
    catch (e) { el.outerHTML = `<span class="xs muted">Pièce jointe indisponible</span>`; }
  });
  document.querySelectorAll("audio[data-ap]:not([src])").forEach(async el => {
    try { el.src = await c.audioUrl(el.dataset.ap); }
    catch (e) { el.outerHTML = `<span class="xs muted">Message vocal indisponible</span>`; }
  });
}
// Message vocal : enregistrer (touche 🎙️), puis toucher ⏹️ pour envoyer
let REC = null;
actions["rec"] = async () => {
  if (REC) { REC.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast("Enregistrement vocal non disponible sur ce téléphone");
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast("Micro refusé : autorise-le dans les réglages du téléphone"); }
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported?.(t)) || "";
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : {}), chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); REC = null; setRecBtn(false);
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    if (blob.size < 2000) return toast("Message trop court");
    await sendAudio(blob);
  };
  REC = rec; rec.start(); setRecBtn(true); toast("Enregistrement… touche ⏹️ pour envoyer");
};
function setRecBtn(on) { const b = document.getElementById("rec-btn"); if (b) b.textContent = on ? "⏹️" : "🎙️"; }
async function sendAudio(blob) {
  const c = await cloud(); const memberId = isCoach() ? R.param : null;
  try {
    await c.ensureSession(); const to = memberId || c.userId();
    const path = await c.uploadAudio(blob, to);
    await c.send("🎙️ Message vocal", to, path);
    buzz(); window.__reloadThread?.(); toast("Message vocal envoyé");
  } catch (e) { toast("Envoi impossible : " + (e?.message || e)); }
}

routes.chat = async () => {
  if (!isCoach() && !canMsg()) { toast("Les messages avec Thomas sont réservés aux personnes coachées"); return go("offers"); }
  const memberId = isCoach() ? R.param : null;
  const m = memberId ? (window.__members || []).find(x => x.id === memberId) : null;
  $app.innerHTML = header(memberId ? esc(m?.name || "Membre") : "Thomas", memberId ? esc(m?.email || "") : "Je réponds moi-même", { back: memberId ? "member/" + memberId : "coach", ...(memberId ? { actions: `<button class="pill" data-a="msg-unread" data-id="${esc(memberId)}">Marquer non lu</button>` } : {}) })
    + `<main class="page" style="padding-bottom:calc(100px + var(--safe-b))">${memberId ? "" : absenceBanner()}<div class="thread" id="thread"><p class="empty small">Chargement…</p></div>${memberId ? readyBar() : ""}${memberId ? "" : `<p class="xs muted center">${msgQuotaText()} · touche un message pour réagir</p>`}</main>
    <form class="composer" data-f="send"><textarea name="v" rows="1" placeholder="Ton message" maxlength="2000" aria-label="Message">${esc(window.__prefill || "")}</textarea><button type="button" class="send" id="rec-btn" data-a="rec" aria-label="Message vocal">🎙️</button><button class="send" aria-label="Envoyer">${I.send}</button></form>`;
  window.__prefill = "";
  const load = async (first) => {
    const c = await cloud(); const box = document.getElementById("thread"); if (!box) return stopPoll();
    try {
      await c.ensureSession(); me = c.userId();
      const list = await c.thread(memberId || me);
      const changed = JSON.stringify(list) !== JSON.stringify(msgs); msgs = list;
      if (changed || first) { box.innerHTML = list.length ? list.map(msgHtml).join("") : `<div class="msg them">Salut ${esc(S().profile?.name || "")} ! Je suis Thomas. Pose-moi ta question sur ton entraînement, ta nutrition ou ce que tu vis : je te réponds moi-même.</div>`; hydrateAudio(); }
      await c.markRead(memberId || me);
      if (!memberId) badges.msgs = 0;
      if (changed || first) window.scrollTo(0, document.body.scrollHeight);
    } catch (e) { box.innerHTML = `<p class="empty small">Messagerie indisponible pour le moment. Vérifie ta connexion et réessaie.</p>`; }
  };
  window.__reloadThread = () => load(false);
  msgs = []; await load(true); if (memberId) readyLoad(); stopPoll(); pollT = setInterval(() => load(false), 15000);
  onLeave(stopPoll);
};
actions.msg = (b, d) => {
  const x = msgs.find(m => String(m.id) === d.id); if (!x) return;
  sheet(`<p class="small muted center">Réagir au message</p><div class="reactbar">${REACTS.map(e => `<button data-a="react" data-id="${x.id}" data-v="${e}" style="${x.reactions?.[me] === e ? "box-shadow:0 0 0 2px var(--red) inset" : ""}">${e}</button>`).join("")}</div>
    <button class="btn btn-ghost btn-sm mt8" data-a="msg-copy" data-id="${x.id}">Copier le texte</button>`);
};
actions.react = async (b, d) => {
  const x = msgs.find(m => String(m.id) === d.id); closeSheet();
  try { const c = await cloud(); x.reactions = await c.react(x.id, d.v, x.reactions); buzz(); document.getElementById("thread").innerHTML = msgs.map(msgHtml).join(""); }
  catch { toast("Réaction impossible, réessaie."); }
};
actions["msg-copy"] = (b, d) => { const x = msgs.find(m => String(m.id) === d.id); navigator.clipboard?.writeText(x.body); closeSheet(); toast("Copié"); };
forms.send = async (v, form) => {
  const ta = form.querySelector("textarea"), body = ta.value.trim(); if (!body) return;
  const c = await cloud(); if (!c) return toast("Pas de connexion.");
  const memberId = isCoach() ? R.param : null;
  if (!memberId && S().demoTier) toast("En démo, ton message part avec ta formule actuelle.");
  try {
    await c.ensureSession(); await c.send(body, memberId || c.userId()); ta.value = ""; buzz();
    const x = { id: "tmp" + Date.now(), sender: c.userId(), body, created_at: new Date().toISOString(), reactions: {} };
    msgs.push(x); document.getElementById("thread")?.insertAdjacentHTML("beforeend", msgHtml(x));
    window.scrollTo(0, document.body.scrollHeight);
    refreshMe();
  } catch (e) {
    const quota = /row-level|policy/i.test(e.message);
    toast(quota ? "Tu as utilisé tes messages de la semaine. Une formule supérieure t'en donne plus." : "Envoi impossible : " + (e?.message || e));
    if (quota) setTimeout(() => go("offers"), 1800);
  }
};

// ---------- Bilan ----------
actions.checkin = () => go("bilan");
actions["checkin-old"] = () => {
  sheet(`<h2 class="h1">📝 Mon bilan</h2><form data-f="checkin" class="stack mt12">
    <div class="grid2"><label class="field"><span>Poids moyen (kg)</span><input name="poids" inputmode="decimal" value="${E.fmtKg(S().profile.weight)}"></label><label class="field"><span>Séances faites</span><input name="seances" inputmode="numeric" value="${E.workoutsThisWeek().length}"></label></div>
    <div class="grid3">${[["energie", "Énergie /10"], ["sommeil", "Sommeil /10"], ["faim", "Faim /10"]].map(([k, l]) => `<label class="field"><span>${l}</span><input name="${k}" inputmode="numeric"></label>`).join("")}</div>
    <label class="field"><span>Ma victoire</span><textarea name="victoire"></textarea></label>
    <label class="field"><span>Ma difficulté</span><textarea name="difficulte"></textarea></label>
    <button class="btn btn-red">Envoyer à Thomas</button></form>`);
};
forms.checkin = async (v) => {
  const t = `📝 Bilan du ${new Date().toLocaleDateString("fr-FR")}\nPoids moyen : ${v.poids} kg · Séances : ${v.seances}\nÉnergie ${v.energie || "–"}/10 · Sommeil ${v.sommeil || "–"}/10 · Faim ${v.faim || "–"}/10\nVictoire : ${v.victoire || "–"}\nDifficulté : ${v.difficulte || "–"}`;
  const c = await cloud(); try { await c.ensureSession(); await c.send(t); closeSheet(); toast("Bilan envoyé à Thomas"); refreshMe(); } catch { toast("Envoi impossible, réessaie."); }
};

// ---------- Notifications ----------
actions.notifs = () => {
  sheet(`<div class="row between"><h2 class="h1" style="margin:0">🔔 Notifications</h2><button class="link xs" data-a="notif-all">Tout marquer lu</button></div><div id="nl" class="mt12"><p class="empty small">Chargement…</p></div>${pushState() === "on" ? "" : `<div class="card soft mt12"><b class="small">📲 Recevoir les notifications sur ce téléphone</b><p class="xs muted mt4">Messages, fin de repos (même écran verrouillé), rappels.</p><button class="btn btn-red btn-sm mt8" data-a="push-on">Activer</button></div>`}`, async (w) => {
    const c = await cloud(); let list = [];
    try { await c.currentSession(); list = await c.notifications(); } catch { }
    NL = list.filter(n => !n.read || n.epingle); drawNotifs(w);
    navigator.serviceWorker?.controller?.postMessage("clear-badge");
  });
};
let NL = [];
export function clearAppBadge() { try { navigator.clearAppBadge?.(); navigator.serviceWorker?.controller?.postMessage("clear-badge"); } catch { } }
function drawNotifs(w = document) {
  const box = w.querySelector("#nl"); if (!box) return;
  box.innerHTML = NL.length ? `<div class="stack" style="gap:6px">${NL.map(n => `<button class="nt ${n.read ? "" : "unread"}" data-a="notif-open" data-id="${n.id}"><span class="dot"></span><span class="grow" style="min-width:0"><b>${esc(n.title)}</b>${n.body ? `<span class="small nb">${esc(n.body)}</span>` : ""}<span class="xs muted">${ago(n.created_at)}</span></span></button>`).join("")}</div>` : `<p class="empty small">Aucune notification pour l'instant.</p>`;
  const un = NL.filter(n => !n.read).length; badges.notifs = un; if (!un && !badges.msgs) clearAppBadge();
  document.querySelectorAll("[data-a=notifs] .badge").forEach(b => { if (un) b.textContent = un; else b.remove(); });
}
actions["notif-open"] = async (b, d) => {
  const n = NL.find(x => x.id === +d.id); if (!n) return;
  b.classList.toggle("open");
  if (!n.read) { n.read = true; n.garde = true; drawNotifs(); document.querySelector(`[data-a="notif-open"][data-id="${n.id}"]`)?.classList.add("open"); try { (await cloud()).notifRead([n.id]); } catch { } }
};
actions["msg-unread"] = async (b, d) => { try { await (await cloud()).markUnread(d.id); toast("Remis en non lu"); go("admin-msg"); } catch (e) { toast(e.message); } };
actions["msg-read"] = async (b, d) => { try { await (await cloud()).markRead(d.id); go("admin-msg"); } catch (e) { toast(e.message); } };
actions["notif-all"] = async () => { const ids = NL.filter(n => !n.read).map(n => n.id); NL.forEach(n => n.read = true); NL = []; drawNotifs(); clearAppBadge(); try { (await cloud()).notifRead(ids); } catch { } };
actions["push-on"] = async (b) => { try { b && (b.disabled = true); await enablePush(); toast("🔔 Notifications activées"); const c = await cloud(); await c.pushTest().catch(() => { }); closeSheet(); rerender(); } catch (e) { toast(e.message); if (b) b.disabled = false; } };
actions["push-off"] = async () => { await disablePush(); toast("Notifications coupées sur ce téléphone"); rerender(); };

// ---------- Espace coach ----------
let adminFilter = "";
async function adminHome() {
  $app.innerHTML = header("Espace coach", "Tes membres") + `<main class="page"><p class="empty">Chargement…</p></main>${tabbar("coach")}`;
  const c = await cloud(); let list = [];
  let sums = [];
  try { [list, sums] = await Promise.all([c.members(), c.allSummaries().catch(() => [])]); window.__members = list; } catch (e) { $app.querySelector(".page").innerHTML = `<p class="empty">Impossible de charger les membres : ${esc(e.message)}</p>`; return; }
  const hidden = list.filter(m => !m.name && !m.email).length; list = list.filter(m => m.name || m.email);
  const SM = Object.fromEntries(sums.map(x => [x.user_id, x])); window.__sums = SM;
  const q = adminFilter.toLowerCase();
  const shown = list.filter(m => !q || (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)).sort((a, b) => b.unread - a.unread);
  const t = today();
  const todayRows = list.map(m => ({ m, s: SM[m.id]?.summary })).filter(x => x.s && x.s.today === t && (x.s.session || x.s.inProgress || x.s.meals));
  const stTxt = (s) => s.inProgress ? `🏋️ en séance · ${esc(s.inProgress.title)} (${s.inProgress.done} séries)` : s.session?.st === "done" ? `✅ ${esc(s.session.title)}` : s.session?.st === "planned" ? `🗓️ prévue : ${esc(s.session.title)}` : s.session?.st === "missed" ? `❌ loupée : ${esc(s.session.title)}` : "😌 repos";
  const page = $app.querySelector(".page"); if (!page) return;
  page.innerHTML = `
    <div class="card"><div class="stat3"><div><b>${list.length}</b><span>membres</span></div><div><b>${list.filter(m => m.tier !== "free").length}</b><span>payants</span></div><div><b>${list.reduce((a, m) => a + m.unread, 0)}</b><span>non lus</span></div></div></div>
    <h2 class="sec">☀️ Aujourd'hui chez tes membres</h2>
    ${todayRows.length ? `<div class="list">${todayRows.map(({ m, s }) => `<button class="li" data-a="go" data-r="member" data-p="${m.id}"><span class="grow"><b class="small">${esc(m.name || m.email)}</b><br><span class="xs">${stTxt(s)}</span><br><span class="xs muted">🍽️ ${s.meals ? `${fr(s.kcal)} kcal · ${fr(s.prot)} g P` : "rien noté"}${s.weight ? ` · ⚖️ ${fr(s.weight, 1)} kg` : ""}${s.focus ? ` · 🎯 ${esc(s.focus)}` : ""}</span></span>${I.chev}</button>`).join("")}</div>` : `<p class="small muted">Rien encore aujourd'hui. Les données arrivent dès qu'un membre ouvre l'app.</p>`}
    <h2 class="sec">👥 Tous les membres</h2>
    <div class="chips">${assignable().map(o => `<span class="chip">${esc(o.name)} · ${list.filter(m => m.tier === o.id).length}</span>`).join("")}</div>
    <div class="search mt12">${I.search}<input id="aq" placeholder="Nom ou e-mail" value="${esc(adminFilter)}"></div>
    <div class="list mt12">${shown.length ? shown.map(m => `<button class="li" data-a="go" data-r="member" data-p="${m.id}"><span class="grow"><b>${esc(m.name || "Sans nom")}</b> <span class="tag ${m.tier !== "free" ? "r" : ""}">${esc(offer(m.tier).name)}</span>${m.onboarding?.application ? ` <span class="tag r">Candidature</span>` : ""}<br><span class="xs muted">${esc(m.email || "e-mail non renseigné")} · vu ${ago(m.last_seen)}${SM[m.id]?.summary?.program ? ` · ${esc(SM[m.id].summary.program.split("·")[0])} S${SM[m.id].summary.week}` : ""}</span></span>${m.unread ? `<span class="badge" style="position:static;border:0">${m.unread}</span>` : ""}${I.chev}</button>`).join("") : `<p class="empty small">Aucun membre pour l'instant.</p>`}</div>
    ${hidden ? `<p class="xs muted mt8">${hidden} compte${hidden > 1 ? "s" : ""} sans prénom ni e-mail masqué${hidden > 1 ? "s" : ""} (onboarding pas terminé ou tests).</p>` : ""}
    <button class="btn btn-line btn-sm mt12" data-a="export-members">⬇️ Exporter les e-mails (CSV)</button>
    <h2 class="sec">📣 Notification à tous</h2>
    <form class="card stack" data-f="broadcast"><label class="field"><span>Titre</span><input name="t" required maxlength="80"></label><label class="field"><span>Message</span><textarea name="b" maxlength="300"></textarea></label><button class="btn btn-red btn-sm">Envoyer à tous les membres</button></form>`;
  const inp = page.querySelector("#aq"); inp.addEventListener("input", () => { adminFilter = inp.value; clearTimeout(window.__aqT); window.__aqT = setTimeout(adminHome, 350); });
}
actions["export-members"] = () => {
  const rows = [["prenom", "email", "formule", "inscrit", "derniere_visite", "accepte_emails", "objectif"], ...(window.__members || []).map(m => [m.name || "", m.email || "", offer(m.tier).name, (m.created_at || "").slice(0, 10), (m.last_seen || "").slice(0, 10), m.onboarding?.news ? "oui" : "non", m.onboarding?.goal || ""])];
  const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `membres-calxsthenos-${today()}.csv`; a.click();
};
routes.member = async () => {
  if (!isCoach()) return go("home");
  const c = await cloud();
  if (!window.__members) { try { window.__members = await c.members(); } catch { } }
  const m = (window.__members || []).find(x => x.id === R.param); if (!m) return go("admin");
  const o = m.onboarding || {}, ap = o.application, st = m.stats || {};
  if (mbr.id !== m.id) Object.assign(mbr, { id: m.id, tab: "suivi", day: null, vw: 0, data: null, settings: null });
  if (!mbr.data) { $app.innerHTML = header(esc(m.name || "Membre"), "", { back: "admin" }) + `<main class="page"><p class="empty">Chargement de ses données…</p></main>`; await Promise.all([E.loadPrograms(), N.loadModels()]); try { mbr.data = (await c.memberData(m.id)) || { data: null }; mbr.settings = await c.coachSettingsGet(m.id).catch(() => ({})); mbr.reviews = await c.reviewsOf(m.id).catch(() => ({})); await XO.loadExercices().catch(() => { }); } catch (e) { mbr.data = { data: null, err: e.message }; } }
  const tabs = [["suivi", "🏠 Vue d'ensemble"], ["jour", "☀️ Journée"], ["seances", "🏋️ Séances"], ["stats", "📊 Stats"], ["agenda", "🗓️ Agenda"], ["corps", "⚖️ Corps"], ["profil", "👤 Profil"]];
  const D = mbr.data.data;
  const cur = D?.current?.exercises?.length ? D.current : null, curDone = cur ? cur.exercises.reduce((a, e) => a + e.sets.filter(x => x.done).length, 0) : 0, curTot = cur ? cur.exercises.reduce((a, e) => a + e.sets.filter(x => x.type !== "W").length, 0) : 0;
  const liveBan = cur ? `<button class="card" data-a="go" data-r="live" data-p="${esc(m.id)}" style="width:100%;text-align:left;margin-bottom:10px;box-shadow:0 0 0 2px var(--red) inset"><div class="row between"><span><b>🔴 Séance en direct</b><br><span class="small">${esc(cur.title || "Séance")} · ${curDone} séries faites${curTot ? ` / ${curTot}` : ""}</span></span><span class="btn btn-red btn-sm">Ouvrir ▶</span></div></button>` : "";
  const act = (attrs, em, l) => `<${attrs.startsWith("href") ? "a" : "button"} class="mb-act" ${attrs}><span>${em}</span><small>${l}</small></${attrs.startsWith("href") ? "a" : "button"}>`;
  const top = `${liveBan}<div class="mb-acts">${act(`href="#/chat/${m.id}"`, "💬", `Messages${m.unread ? ` · ${m.unread}` : ""}`)}${act(`data-a="go" data-r="member-prog" data-p="${esc(m.id)}"`, "📋", "Programme")}${act(`data-a="go" data-r="member-food" data-p="${esc(m.id)}"`, "🍽️", "Diète")}${act(`data-a="live-start" data-id="${esc(m.id)}"`, "▶️", "Direct")}${act(`data-a="saisie-seance" data-id="${esc(m.id)}"`, "✍️", "Noter séance")}${act(`data-a="pre-acces" data-id="${esc(m.id)}"`, "🔑", "Accès")}${act(`data-a="saisie-repas" data-id="${esc(m.id)}"`, "🍴", "Noter repas")}${m.email ? act(`href="mailto:${esc(m.email)}"`, "✉️", "E-mail") : ""}</div>
    <div class="mt12">${chips(tabs, mbr.tab, "mb-tab")}</div>
    ${D ? `<p class="xs muted mt4">Données mises à jour ${ago(mbr.data.updated_at)}</p>` : ""}`;
  if (mbr.tab !== "profil") {
    const body = !D ? `<p class="empty small">${mbr.data.err ? esc(mbr.data.err) : "Pas encore de données : elles arrivent quand ce membre ouvre l'app."}</p>` : withState(D, () => mbr.tab === "stats" ? statsMembre() : mbr.tab === "suivi" ? `<details class="card mt12 plis"><summary><b>📈 Régularité, bilans et historique</b></summary>${memberSuivi(D, m)}</details>` : mbr.tab === "jour" ? memberDay(D) : mbr.tab === "seances" ? memberSessions(D) : mbr.tab === "agenda" ? memberAgenda(D) : memberBody(D));
    const cards = mbr.tab === "suivi" && D ? withState(D, () => vueEnsemble(m, D) + `<details class="card mt16 plis"><summary><b>⚙️ Réglages du suivi</b><span class="xs muted"> · objectif, mot, consignes, cardio, diète, bilans, échéances</span></summary>${fileCards(m, D)}</details>`) : mbr.tab === "suivi" && !D ? withState({}, () => `<div class="card mt12 grad"><b>🆕 Pas encore connecté</b><p class="small mt4" style="margin:4px 0 8px">Prépare son espace : programme, diète, course, objectif, consignes. Quand tout est prêt, envoie-lui son lien de connexion.</p><button class="btn btn-sm" style="background:#fff;color:#111;width:auto" data-a="pre-lien" data-id="${esc(m.id)}">🔗 Lien de connexion</button></div><div class="card mt12">${fileCards(m, {})}</div>`) : "";
    $app.innerHTML = header(esc(m.name || "Membre"), esc(D?.plan ? `${(E.program(D.plan.programId)?.name || "").split("·")[0]} · semaine ${D.plan.week}` : m.email || ""), { back: "admin" }) + `<main class="page">${top}${cards}${body}</main>${adminTabbar("admin")}`;
    return;
  }
  const L = { goal: "Objectif", discipline: "Discipline", level: "Niveau", place: "Lieu", days: "Jours / semaine", sex: "Sexe déclaré", genre: "Souhaite qu'on s'adresse à lui ou elle", age: "Âge", height: "Taille", weight: "Poids", diet: "Alimentation", activity: "Activité", backPain: "Gêne lombaire", word: "Parole", news: "Accepte les e-mails" };
  $app.innerHTML = header(esc(m.name || "Membre"), esc(m.email || ""), { back: "admin" }) + `<main class="page">${top}
    <h2 class="sec">Formule</h2>
    <div class="card"><div class="row" style="gap:8px"><select id="tier" class="inp grow" style="text-align:left">${assignable(m.tier).map(x => `<option value="${x.id}" ${x.id === m.tier ? "selected" : ""}>${esc(x.name)} · ${esc(x.price)}</option>`).join("")}</select><button class="btn btn-red btn-sm" style="width:auto" data-a="set-tier" data-id="${m.id}">Valider</button></div></div>
    ${ap ? `<h2 class="sec">Candidature <small>${new Date(ap.at).toLocaleDateString("fr-FR")}</small></h2><div class="card small"><b>${esc(offer(ap.offer).name)}</b><p class="mt8"><b>Objectif :</b> ${esc(ap.goal)}</p><p><b>Frein :</b> ${esc(ap.obstacle)}</p><p><b>Temps :</b> ${esc(ap.time)} · <b>Urgence :</b> ${esc(ap.urgency)}/10</p>${ap.phone ? `<p><b>Téléphone :</b> <a href="tel:${esc(ap.phone)}">${esc(ap.phone)}</a></p>` : ""}</div>` : ""}
    <h2 class="sec">Activité</h2>
    <div class="card"><div class="stat3"><div><b>${st.workouts ?? 0}</b><span>séances</span></div><div><b>${st.weight ? E.fmtKg(st.weight) : "–"}</b><span>kg</span></div><div><b>${st.week ?? "–"}</b><span>semaine</span></div></div></div>
    <p class="xs muted mt8">Inscrit le ${new Date(m.created_at).toLocaleDateString("fr-FR")} · dernière visite ${ago(m.last_seen)}${st.lastWorkout ? ` · dernière séance ${ago(st.lastWorkout)}` : ""}${st.program ? ` · programme ${esc(st.program)}` : ""}</p>
    <h2 class="sec">Réponses de l'onboarding</h2>
    <div class="list">${Object.entries(L).filter(([k]) => o[k] !== undefined && o[k] !== null && o[k] !== "").map(([k, l]) => `<div class="li"><span class="grow small muted">${l}</span><span class="small"><b>${esc(typeof o[k] === "boolean" ? (o[k] ? "oui" : "non") : k === "genre" ? (libelleGenre(o[k]) || o[k]).toLowerCase() : k === "sex" ? libelleSexe(o[k]) || o[k] : o[k])}</b></span></div>`).join("")}
      ${Object.entries(o.records || {}).map(([k, v]) => `<div class="li"><span class="grow small muted">Record ${esc(k)}</span><span class="small"><b>${v.r} × ${E.fmtKg(v.k)} kg</b></span></div>`).join("")}</div>
    <h2 class="sec">Notification à ${esc(m.name || "ce membre")}</h2>
    <form class="card stack" data-f="notify-one" data-id="${m.id}"><label class="field"><span>Titre</span><input name="t" required maxlength="80"></label><label class="field"><span>Message</span><textarea name="b" maxlength="300"></textarea></label><button class="btn btn-red btn-sm">Envoyer</button></form>
    ${A_NOTE(m.id)}
  </main>${adminTabbar("admin")}`;
};
actions["set-tier"] = async (b, d) => {
  const t = document.getElementById("tier").value, c = await cloud();
  try { await c.setTier(d.id, t); const m = window.__members.find(x => x.id === d.id); if (m) m.tier = t; toast(`Formule ${offer(t).name} activée`); } catch (e) { toast(e.message); }
};
forms.broadcast = async (v, f) => { const c = await cloud(); try { await c.notify(v.t, v.b, null); f.reset(); toast("Notification envoyée à tous"); } catch (err) { toast(err.message); } };
forms["notify-one"] = async (v, f) => { const c = await cloud(); try { await c.notify(v.t, v.b, f.dataset.id); f.reset(); toast("Notification envoyée"); } catch (err) { toast(err.message); } };

// ---------- Fiche membre : statistiques sur le réalisé (mêmes calculs que chez le membre) ----------
let statsPer = "month";
const statsMembre = () => `<div class="mt8">${chips([["week", "7 jours"], ["month", "4 semaines"], ["quarter", "12 semaines"]], statsPer, "mb-stper")}</div>${analyseHtml(statsPer)}`;
actions["mb-stper"] = (b, d) => { statsPer = d.v; rerender(false); };

// ---------- Fiche membre : journée, séances, agenda, corps ----------
const mbr = { id: null, tab: "jour", day: null, data: null };
actions["mb-tab"] = (b, d) => { mbr.tab = d.v; rerender(false); };
actions["mb-day"] = (b, d) => { const n = addDays(mbr.day || today(), +d.v); mbr.day = n > today() ? null : n; rerender(); };
actions["mb-reload"] = () => { mbr.data = null; rerender(); };
const setsLine = (e) => e.sets.filter(s => s.done).map(s => `${s.type === "W" ? "é " : ""}${s.kg ? E.fmtKg(s.kg) + "×" : ""}${s.reps ?? "–"}${s.rpe != null ? "@" + String(s.rpe).replace(".", ",") : ""}${s.pain ? " ⚠️" : ""}${Object.entries(s.td || {}).map(([t, d]) => E.techSummary(t, d) ? ` (${t} : ${E.techSummary(t, d)})` : "").join("") || Object.entries(s.tq || {}).filter(([, v]) => v).map(([t, v]) => ` (${t} ×${v})`).join("")}`).join(" · ");
function workoutCard(w, open = false) {
  const mins = Math.round((new Date(w.end || Date.now()) - new Date(w.start)) / 6e4);
  return `<details class="card mt8" ${open ? "open" : ""}><summary style="list-style:none;cursor:pointer"><div class="row between"><b>${esc(w.title)}</b><span class="xs muted">${fmtDate(today(new Date(w.end || w.start)), { weekday: "short", day: "numeric", month: "short" })}</span></div>
    <div class="xs muted mt4">${w.end ? "" : "EN COURS · "}${mins} min${w.target ? ` / ${w.target} visées` : ""} · ${w.setsDone ?? w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} séries${w.volume ? ` · ${fr(w.volume / 1000, 1)} t` : ""}${w.week ? ` · semaine ${w.week}` : ""}${w.records?.length ? ` · 🏆 ${w.records.length} record${w.records.length > 1 ? "s" : ""}` : ""}</div></summary>
    ${w.end ? `<button class="btn btn-line btn-sm mt8" style="width:100%" data-a="saisie-edit" data-id="${w.id}">✏️ Modifier cette séance (séries, charges, heure, durée)</button>` : `<button class="btn btn-red btn-sm mt8" style="width:100%" data-a="go" data-r="live" data-p="${esc(mbr.id)}">🔴 Ouvrir en direct</button>`}<div class="mt8">${w.exercises.map(e => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><b>${esc(e.name)}</b>${e.name !== e.orig ? ` <span class="xs muted">(remplace ${esc(e.orig)})</span>` : ""}<br><span class="xs">${esc(setsLine(e)) || "<span class='muted'>pas fait</span>"}</span>${w.end ? recapLine(w, e) : ""}${e.sets.some(s => s.note) ? `<br><span class="xs muted">📝 ${esc(e.sets.filter(s => s.note).map(s => s.note).join(" · "))}</span>` : ""}${e.myNote ? `<br><span class="xs muted">📝 ${esc(e.myNote)}</span>` : ""}</div>`).join("")}</div>${w.end && mbr.id && mbr.reviews ? reviewBar(w) : ""}</details>`;
}
function memberDay(D) {
  const d = mbr.day || today(), ag = E.agenda(d, d)[d], t = N.targets(), log = N.dayLog(d), tot = N.dayTotals(d), R0 = S().daily[d] || {};
  const ws = S().workouts.filter(w => today(new Date(w.end)) === d);
  let sess = "";
  if (d === today() && S().current) sess = workoutCard(S().current, true);
  if (ws.length) sess += ws.map(w => workoutCard(w, true)).join("");
  else if (!sess && ag?.st === "planned") { const ns = E.nextSession(); sess = `<div class="card mt8"><div class="lbl">🗓️ Séance prévue</div><b class="h3">${esc(ag.title)}</b>${ns && d === today() ? `<div class="xs mt8">${ns.exercises.map(r => `<div class="row between"><span>${esc(S().swaps[r[0]] || r[0])}</span><span class="muted">${esc(E.schemeFor(ns.p, r, ns.week).replace(/x/g, "×"))}</span></div>`).join("")}</div>` : ""}</div>`; }
  else if (!sess) sess = `<div class="card mt8"><p class="small muted" style="margin:0">${ag?.st === "missed" ? `❌ Séance loupée : ${esc(ag.title)}` : "Jour de repos."}</p></div>`;
  return `<div class="row between mt12"><button class="icon-btn" data-a="mb-day" data-v="-1" aria-label="Jour précédent">${I.back}</button><b class="h3" style="text-transform:capitalize">${d === today() ? "Aujourd'hui" : fmtDate(d)}</b><button class="icon-btn" data-a="mb-day" data-v="1" aria-label="Jour suivant" style="transform:scaleX(-1);${d === today() ? "visibility:hidden" : ""}">${I.back}</button></div>
    <h2 class="sec">🏋️ Entraînement</h2>${sess}
    <h2 class="sec">🍽️ Ce qu'il a mangé <small>${fr(tot.kcal)} / ${t ? fr(t.kcal) : "–"} kcal</small></h2>
    <div class="card"><div class="stat3"><div><b>${fr(tot.p)}</b><span>/ ${t?.prot ?? "–"} g prot.</span></div><div><b>${fr(tot.c)}</b><span>/ ${t?.carbs ?? "–"} g gluc.</span></div><div><b>${fr(tot.f)}</b><span>/ ${t?.fat ?? "–"} g lip.</span></div></div>
      ${log.length ? [...N.MEALS, ...new Set(log.map(e => e.meal).filter(m => !N.MEALS.includes(m)))].map(m => { const es = log.filter(e => e.meal === m); return es.length ? `<div class="mt12"><b class="small">${m}</b> <span class="xs muted">${es[0].time || ""} · ${fr(es.reduce((a, e) => a + e.kcal, 0))} kcal</span>${es.map(e => `<div class="row between xs" style="padding:2px 0"><span>${e.g ? fr(e.g) + " g " : ""}${esc(e.label)}</span><span class="muted">${e.kcal} kcal · ${fr(e.p)} g P</span></div>`).join("")}</div>` : ""; }).join("") : `<p class="small muted mt8" style="margin-bottom:0">Rien noté ce jour-là.</p>`}</div>
    <h2 class="sec">📋 Routine</h2>
    <div class="card"><div class="stat3"><div><b>${R0.weight ? fr(R0.weight, 1) : "–"}</b><span>kg</span></div><div><b>${R0.steps ? fr(R0.steps) : "–"}</b><span>pas</span></div><div><b>${R0.sleep ? fr(R0.sleep, 1) : "–"}</b><span>h de sommeil</span></div></div>
      <p class="xs muted mt8" style="margin-bottom:0">💧 ${fr((R0.water || 0) * .25, 2)} L d'eau${R0.ritual?.focus ? ` · 🎯 priorité : ${esc(R0.ritual.focus)}` : ""}${(R0.cardio || []).length ? ` · 🏃 ${R0.cardio.map(c => `${esc(c.n)} ${c.min} min`).join(", ")}` : ""}</p></div>
    ${E.stalls().length ? `<div class="card mt12" style="box-shadow:0 0 0 2px var(--warn) inset"><div class="lbl">📹 Plateaux</div><p class="small mt4" style="margin:0">${E.stalls().map(x => `${esc(x.name)} (${x.weeks} sem.)`).join(" · ")}</p></div>` : ""}
    ${E.injuryAlerts().length ? `<div class="card mt12" style="box-shadow:0 0 0 2px var(--warn) inset"><div class="lbl">⚠️ Douleurs signalées</div>${E.injuryAlerts().map(a => `<p class="small mt4" style="margin:0"><b>${esc(a.name)}</b> · ${a.count} fois · ${esc(a.last.note)}</p>`).join("")}</div>` : ""}
    <button class="btn btn-ghost btn-sm mt12" data-a="mb-reload">🔄 Actualiser</button>`;
}
function memberSessions(D) {
  const ws = S().workouts.slice().reverse();
  return `${S().current ? `<h2 class="sec">En cours</h2>${workoutCard(S().current, true)}` : ""}<h2 class="sec">Séances faites <small>${S().workouts.length}</small></h2>${ws.length ? ws.map(w => workoutCard(w)).join("") : `<p class="empty small">Aucune séance enregistrée.</p>`}`;
}
function memberAgenda(D) {
  const t = today(), mon = addDays(t, -E.dowOf(t) + 7 * (mbr.wk || 0)), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)), ag = E.agenda(days[0], days[6]);
  const ns = E.nextSession();
  return `<div class="row between mt12"><button class="icon-btn" data-a="mb-wk" data-v="-1" aria-label="Semaine précédente">${I.back}</button><b class="h3">Semaine du ${fmtDate(mon, { day: "numeric", month: "long" })}</b><button class="icon-btn" data-a="mb-wk" data-v="1" aria-label="Semaine suivante" style="transform:scaleX(-1)">${I.back}</button></div>
    <div class="list mt12">${days.map((k, i) => { const a = ag[k]; return `<div class="li"><span class="em" style="font-size:20px">${a ? { done: "✅", missed: "❌", planned: "🏋️", rest: "😌", away: "↪️" }[a.st] : "·"}</span><span class="grow"><b class="small">${E.DAY_NAMES[i]} ${Number(k.slice(8))}</b><br><span class="xs muted">${a ? esc(a.title || "") : "Repos"}</span></span></div>`; }).join("")}</div>
    ${ns ? `<div class="card mt12"><div class="lbl">🎯 Programme</div><b>${esc(ns.p.name)}</b><p class="small muted mt4" style="margin:0">Semaine ${ns.week}/${ns.weeks} · ${esc(ns.phase)} · prochaine séance : ${esc(ns.title)}</p></div>` : ""}
    ${S().season?.blocks?.length ? `<div class="card mt12"><div class="lbl">🗓️ Saison</div>${E.seasonBlocks().map(b => `<div class="xs mt4">${b.cur ? "👉 " : ""}<b>${esc(E.FOCUS[b.focus]?.[0] || "")}</b> · ${b.weeks} sem. · ${esc((b.p?.name || "").split("·")[0])} · ${fmtDate(b.from, { day: "numeric", month: "short" })} → ${fmtDate(b.to, { day: "numeric", month: "short" })}</div>`).join("")}</div>` : ""}
    ${(S().goals || []).length ? `<div class="card mt12"><div class="lbl">🎯 Objectifs</div>${S().goals.map(g => { const s2 = E.goalStatus(g); return `<div class="xs mt4"><b>${esc(g.name)}</b> : ${fr(g.kg, 1)} kg × ${g.reps} avant le ${fmtDate(g.date, { day: "numeric", month: "short", year: "numeric" })} · aujourd'hui ${fr(s2.cur, 1)} / ${fr(s2.tgt, 1)} (1RM est.)</div>`; }).join("")}</div>` : ""}`;
}
actions["mb-vw"] = (b, d) => { mbr.vw = Math.min(0, (mbr.vw || 0) + +d.v); rerender(true); };
actions["mb-wk"] = (b, d) => { mbr.wk = (mbr.wk || 0) + +d.v; rerender(); };
// Mensurations : tronc en tuiles, membres en tableau gauche / droite, écart avec la mesure précédente
const MS_TRONC = [["neck", "Cou"], ["shoulders", "Épaules"], ["chest", "Poitrine"], ["waistHigh", "Taille haute"], ["waistNav", "Taille nombril"], ["waistLow", "Taille basse"], ["hips", "Hanches"], ["fat", "Masse grasse", "%"]];
const MS_MEMBRES = [["arm", "Bras"], ["forearm", "Avant-bras"], ["thigh", "Cuisse"], ["calf", "Mollet"]];
function mensurations(ms) {
  const cur = ms[0], val = (m, k) => m?.[k] != null ? +m[k] : null;
  const prev = (k) => ms.slice(1).find(m => m[k] != null);
  const delta = (k, bonBaisse) => { const v = val(cur, k), p = prev(k); if (v == null || !p) return ""; const d = Math.round((v - p[k]) * 10) / 10; if (!d) return `<span class="xs muted">=</span>`; const bon = bonBaisse ? d < 0 : d > 0; return `<span class="xs" style="color:var(--${bon ? "good" : "muted"});font-weight:700">${d > 0 ? "▲" : "▼"} ${fr(Math.abs(d), 1)}</span>`; };
  const tuile = ([k, l, u]) => val(cur, k) == null ? "" : `<div class="card soft" style="padding:10px 12px"><div class="xs muted">${l}</div><div class="row" style="gap:6px;align-items:baseline"><b class="num" style="font-size:20px">${fr(val(cur, k), 1)}</b><span class="xs muted">${u || "cm"}</span></div>${delta(k, ["waistHigh", "waistNav", "waistLow", "fat"].includes(k))}</div>`;
  const tronc = MS_TRONC.map(tuile).join("");
  const membres = MS_MEMBRES.filter(([k]) => ["l_r", "l_c", "r_r", "r_c"].some(s => val(cur, `${k}_${s}`) != null));
  const cell = (k) => val(cur, k) == null ? `<span class="muted">–</span>` : `<b>${fr(val(cur, k), 1)}</b><br>${delta(k, false)}`;
  const tab = membres.length ? `<div class="card mt8" style="padding:10px 8px"><div style="display:grid;grid-template-columns:1.2fr repeat(4,1fr);gap:6px 4px;text-align:center;align-items:center">
    <span></span><span class="xs muted">G relâché</span><span class="xs muted">G contracté</span><span class="xs muted">D relâché</span><span class="xs muted">D contracté</span>
    ${membres.map(([k, l]) => `<b class="small" style="text-align:left;padding-left:6px">${l}</b>${["l_r", "l_c", "r_r", "r_c"].map(s => `<div class="small">${cell(`${k}_${s}`)}</div>`).join("")}`).join("")}</div></div>` : "";
  const histo = ms.length > 1 ? `<details class="card mt8 plis"><summary><b class="small">Historique</b> <span class="xs muted">${ms.length - 1} mesure${ms.length > 2 ? "s" : ""} avant</span></summary>${ms.slice(1).map(m => { const ks = [...MS_TRONC.map(x => x[0]), ...MS_MEMBRES.flatMap(([k]) => ["l_r", "l_c", "r_r", "r_c"].map(s => `${k}_${s}`))].filter(k => m[k] != null); const nom = (k) => (MS_TRONC.find(x => x[0] === k) || [])[1] || (MS_MEMBRES.find(([a]) => k.startsWith(a + "_")) || [])[1] + " " + { l_r: "G rel.", l_c: "G contr.", r_r: "D rel.", r_c: "D contr." }[k.slice(k.indexOf("_") + 1)]; return `<div class="mt8"><b class="small">${fmtDate(m.d, { day: "numeric", month: "long", year: "numeric" })}</b><div class="xs muted mt4">${ks.map(k => `${nom(k)} ${fr(m[k], 1)}`).join(" · ")}</div></div>`; }).join("")}</details>` : "";
  return `${tronc ? `<div class="grid2 mt8" style="gap:8px">${tronc}</div>` : ""}${tab}${histo}`;
}
function memberBody(D) {
  const ws = Object.entries(S().daily).filter(([, v]) => v.weight).sort().slice(-30);
  const ms = (S().measures || []).filter(m => Object.keys(m).some(k => k !== "d" && k !== "weight")).sort((a, b) => String(b.d).localeCompare(String(a.d))).slice(0, 12);
  return `<h2 class="sec">⚖️ Poids <small>${ws.length} pesées</small></h2>
    <div class="card">${ws.length ? `<div class="num" style="font-size:26px">${fr(ws.at(-1)[1].weight, 1)} kg</div><p class="xs muted" style="margin:4px 0 0">${ws.slice(-10).map(([k, v]) => `${k.slice(8)}/${k.slice(5, 7)} : ${fr(v.weight, 1)}`).join(" · ")}</p>` : `<p class="small muted" style="margin:0">Pas de pesée.</p>`}</div>
    <h2 class="sec">📏 Mensurations${ms.length ? ` <small>${fmtDate(ms[0].d, { day: "numeric", month: "long", year: "numeric" })}</small>` : ""}</h2>
    ${ms.length ? mensurations(ms) : `<p class="small muted">Pas de mensurations.</p>`}
    <p class="xs muted mt12">Les photos restent sur le téléphone du membre : demande-lui de te les envoyer s'il le souhaite.</p>`;
}

const A_NOTE = () => "";

// ---------- Espace coach : programme et plan alimentaire envoyés à un client ----------
let asQ = "", plDraft = null;
actions["mb-assign"] = () => {
  const draw = () => {
    const q = N.norm(asQ), mine = E.programs().filter(p => p.custom || p.lib), bank = E.programs().filter(p => !p.custom && !p.lib && (!q || N.norm(p.name).includes(q))).slice(0, q ? 40 : 12);
    const li = (p) => `<button class="li" data-a="mb-assign-go" data-id="${esc(p.id)}"><span class="grow small"><b>${esc(p.name)}</b><br><span class="xs muted">${p.s?.length || "?"} séances / sem. · ${esc(p.lvl || "")}</span></span>${I.chev}</button>`;
    return `<h2 class="h2">📋 Assigner un programme</h2><p class="xs muted">Touche un programme pour voir chaque séance, chaque exercice et chaque semaine. Tu le modifies, puis tu l'envoies.</p>
      ${mine.length ? `<div class="lbl mt12">Mes programmes</div><div class="list mt4">${mine.map(li).join("")}</div>` : ""}
      <div class="lbl mt12">Banque</div><div class="search mt4">${I.search}<input id="as-q" value="${esc(asQ)}" placeholder="Chercher : force, haut bas, 3 jours…" autocomplete="off"></div><div class="list mt4" id="as-l">${bank.map(li).join("")}</div>`;
  };
  sheet(draw(), (w) => { const i = w.querySelector("#as-q"); i?.addEventListener("input", () => { asQ = i.value; const h = document.createElement("div"); h.innerHTML = draw(); w.querySelector("#as-l").innerHTML = h.querySelector("#as-l").innerHTML; }); });
};
actions["mb-assign-go"] = (b, d) => {
  const p = E.program(d.id), m = (window.__members || []).find(x => x.id === mbr.id); if (!p || !m) return;
  closeSheet(); openProgramEditor(m.id, JSON.parse(JSON.stringify(p)));
};
actions["mb-plan"] = () => {
  const D = mbr.data?.data; if (!D?.profile) return toast("Données du client indisponibles");
  const own = D.myPlan?.meals?.length ? D.myPlan.meals : null;
  const auto = withState(D, () => { const t = N.targets(); return t ? N.dayPlan(t).map(x => ({ name: x.meal, time: x.time, title: x.n, items: (x.items || []).map(i => ({ label: i.n, g: i.g, kcal: Math.round(i.kcal), p: i.p, c: i.c, f: i.f })) })) : []; });
  plDraft = { meals: JSON.parse(JSON.stringify(own || auto)), note: "" };
  planSheet(own ? "son plan actuel" : "le plan calculé pour son profil");
};
function planSheet(src = "") {
  const tot = plDraft.meals.flatMap(m => m.items).reduce((a, x) => ({ kcal: a.kcal + (x.kcal || 0), p: a.p + (x.p || 0) }), { kcal: 0, p: 0 });
  sheet(`<h2 class="h2">🍽️ Plan pour ce client</h2>${src ? `<p class="xs muted">Base : ${esc(src)}. Ajuste les grammes ou retire un aliment, puis envoie.</p>` : ""}
    <div class="card soft mt8 center"><b>${fr(tot.kcal)} kcal</b> · ${fr(tot.p)} g de protéines par jour</div>
    ${plDraft.meals.map((m, mi) => `<div class="lbl mt12">${esc(m.name)}${m.time ? " · " + esc(m.time) : ""}</div>${m.items.map((it, ii) => `<div class="row mt4" style="gap:6px">${it.g ? `<input class="inp" style="width:70px;padding:4px 6px;font-size:15px" inputmode="decimal" value="${fr(it.g)}" data-c="pd-g" data-m="${mi}" data-i="${ii}" aria-label="Grammes">` : ""}<span class="grow xs">${esc(it.label)}<br><span class="muted">${Math.round(it.kcal)} kcal · P ${fr(it.p, 1)} g</span></span><button class="icon-btn" data-a="pd-del" data-m="${mi}" data-i="${ii}" aria-label="Retirer">${I.close}</button></div>`).join("")}`).join("")}
    <label class="field mt12"><span>Message pour ton client (facultatif)</span><input id="pd-note" value="${esc(plDraft.note)}" placeholder="ex. Jours de repos : retire la collation"></label>
    <button class="btn btn-red mt12" data-a="pd-send">Envoyer ce plan</button>`, null, { keep: !!document.getElementById("sheet") });
}
changes["pd-g"] = (el) => { const it = plDraft.meals[+el.dataset.m].items[+el.dataset.i], g = num(el.value); if (!(g > 0) || !it.g) return; const k = g / it.g; Object.assign(it, { g, kcal: Math.round(it.kcal * k), p: +(it.p * k).toFixed(1), c: +(it.c * k).toFixed(1), f: +(it.f * k).toFixed(1) }); plDraft.note = document.getElementById("pd-note")?.value || plDraft.note; planSheet(); };
actions["pd-del"] = (b, d) => { plDraft.meals[+d.m].items.splice(+d.i, 1); plDraft.meals = plDraft.meals.filter(m => m.items.length); plDraft.note = document.getElementById("pd-note")?.value || plDraft.note; planSheet(); };
actions["pd-send"] = async () => {
  const m = (window.__members || []).find(x => x.id === mbr.id); if (!m) return;
  const note = document.getElementById("pd-note")?.value.trim() || "";
  try { const c = await cloud(); await c.libraryAdd("plan", `Plan alimentaire · ${m.name || "client"}`, { meals: plDraft.meals, note, for: m.id }); await c.notify("🍽️ Ton plan alimentaire", "Thomas t'a envoyé ton plan. Ouvre l'onglet Coaching pour l'appliquer.", m.id).catch(() => { }); closeSheet(); toast("Plan envoyé"); }
  catch (e) { toast("Envoi impossible : " + (e.message || "serveur indisponible")); }
};

// Dossier joint à la candidature : régularité, résultats depuis le début, motivation (le membre n'a rien à réécrire)
function applyDossier() {
  try {
    const a = myAdherence(), from = S().trialStart || sinceStart() || today(), s = summaryBetween(from), an = S().anamnese;
    const r1 = (x) => x == null ? null : Math.round(x * 10) / 10;
    return { score: a.score, status: a.status, sessions: s.sessions, checkins: myCheckins().length, weight: r1(s.weight?.delta), waist: r1(s.waist?.delta), days: s.days,
      defiDay: S().trialStart ? defiDay() : null, why: an?.motivation?.why || null, anam: !!an?.at }; // pas de donnée de santé dans la candidature (voir confidentialite.html)
  } catch { return null; }
}

// =====================================================================
// FICHE ATHLÈTE EN CARTES (refonte 21/11/2026) : programme, diète, bilans, échéances
// =====================================================================
const DL_TYPES = [["compet", "🏁 Compétition"], ["bilan", "📝 Bilan"], ["cycle", "🔁 Fin de cycle"], ["rdv", "📅 Rendez-vous"], ["objectif", "🎯 Objectif"]];
// Vue d'ensemble d'un athlète (C73) : prénom et objectif, profil, programme, anneaux nutrition du jour et de la semaine, séances
const NIVEAUX_L = { beginner: "Débutant", new: "Débutant", debutant: "Débutant", comeback: "Reprise", regular: "Régulier", intermediate: "Intermédiaire", advanced: "Avancé", avance: "Avancé" };
const LIEUX_L = { gym: "Salle", home: "Maison", outdoor: "Extérieur", both: "Salle et maison" };
function vueEnsemble(m, D) {
  const pr = D.profile || {}, prenom = (pr.name || m.name || "Athlète").split(" ")[0], but = (GOALS.find(g => g[0] === pr.goal) || [])[1] || pr.goal || "";
  const ob = mbr.settings?.objectif, ns = E.nextSession(), t0 = today();
  const poids = Object.entries(D.daily || {}).filter(([, v]) => v?.weight).sort().at(-1)?.[1]?.weight || pr.weight;
  const champ = (l, v) => v == null || v === "" ? "" : `<div><span>${l}</span><b>${esc(String(v))}</b></div>`;
  const hero = `<div class="card mt12 mb-hero"><div class="row" style="gap:12px;align-items:center"><span class="mb-av">${esc(prenom[0] || "?").toUpperCase()}</span><div class="grow" style="min-width:0"><b class="h2" style="display:block;line-height:1.1">${esc(prenom)}</b>${but ? `<span class="tag r mt4" style="display:inline-block">🎯 ${esc(but)}</span>` : ""}</div></div>
    ${ob ? `<p class="small mt8" style="margin-bottom:0"><b>Objectif de la période :</b> ${esc(ob.titre)} <span class="xs muted">(→ ${fmtDate(ob.au, { day: "numeric", month: "short" })})</span></p>` : ""}</div>`;
  const profil = `<h2 class="sec">👤 Profil</h2><div class="card mb-grid">${champ("Âge", pr.age ? pr.age + " ans" : null)}${champ("Taille", pr.height ? pr.height + " cm" : null)}${champ("Poids", poids ? fr(poids, 1) + " kg" : null)}${champ("Niveau", NIVEAUX_L[pr.level] || pr.level)}${champ("Séances / sem.", pr.days)}${champ("Lieu", LIEUX_L[pr.place] || pr.place)}${champ("Discipline", pr.discipline)}${champ("Alimentation", pr.diet && pr.diet !== "all" && pr.diet !== "omni" ? pr.diet : null)}</div>`;
  const prog = `<h2 class="sec">📋 Programme</h2>${ns ? `<button class="card grad" style="width:100%;text-align:left;padding:12px 14px" data-a="go" data-r="member-prog" data-p="${esc(m.id)}"><div class="xs" style="opacity:.85">Semaine ${ns.week}/${ns.weeks} · ${esc(ns.phase)}</div><b style="display:block;font-size:17px">${esc(ns.p.name)}</b><div class="xs mt4" style="opacity:.9">Prochaine séance : ${esc(ns.title)} · ✏️ modifier</div></button>` : `<div class="card"><p class="small muted" style="margin:0">Pas de programme en cours. <button class="link" data-a="go" data-r="member-prog" data-p="${esc(m.id)}">En créer un</button></p></div>`}`;
  // Nutrition et séances : semaine courante, ou une semaine passée en balayant l'écran (vw = 0, -1, -2…)
  const vw = mbr.vw || 0, lun0 = addDays(t0, -E.dowOf(t0)), lun = addDays(lun0, 7 * vw), sem = Array.from({ length: 7 }, (_, i) => addDays(lun, i));
  const semTxt = vw === 0 ? "Cette semaine" : `Semaine du ${fmtDate(lun, { day: "numeric", month: "short" })} au ${fmtDate(sem[6], { day: "numeric", month: "short" })}`;
  const nav = `<div class="row between xs muted" style="margin:0 0 6px"><span>← glisse pour la semaine précédente</span>${vw < 0 ? `<span>→ ${vw === -1 ? "semaine en cours" : "plus récent"}</span>` : ""}</div>`;
  const t = N.targets(), jt = N.dayTotals(t0), jours = vw === 0 ? Array.from({ length: 7 }, (_, i) => addDays(t0, -i)) : sem, notes = jours.filter(k => N.dayLog(k).length);
  const moy = (k) => notes.length ? notes.reduce((a, d) => a + (N.dayTotals(d)[k] || 0), 0) / notes.length : 0;
  const anneau = (v, cible, l, col) => { const f = cible ? v / cible : 0; return `<div><div class="mini"><svg viewBox="0 0 66 66">${ring(Math.min(1, f), 66, 7, col)}</svg><b>${cible ? Math.round(f * 100) + "%" : "–"}</b></div><div class="l">${l}<br><span class="xs">${fr(v)}${cible ? " / " + fr(cible) : ""}</span></div></div>`; };
  const ligne = (x) => `<div class="minis" style="grid-template-columns:repeat(4,1fr);margin-top:8px">${anneau(x.kcal, t?.kcal, "kcal", "#2F6FED")}${anneau(x.p, t?.prot, "Prot. g", "#B3263A")}${anneau(x.c, t?.carbs, "Gluc. g", "#E0A93B")}${anneau(x.f, t?.fat, "Lip. g", "#1E8F4E")}</div>`;
  const barres = `<div class="wk7s mt12">${sem.map((k, i) => { const kc = N.dayTotals(k).kcal || 0, f = t?.kcal ? Math.min(1, kc / t.kcal) : 0; return `<div class="${k === t0 ? "on" : ""}"><span>${E.DAY_SHORT[i]}</span><i style="display:block;height:34px;width:14px;margin:4px auto;border-radius:7px;background:var(--line);position:relative;overflow:hidden"><i style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(f * 100)}%;background:#2F6FED;border-radius:7px"></i></i><b class="xs">${kc ? fr(kc) : "·"}</b></div>`; }).join("")}</div>`;
  const nutri = `<h2 class="sec">🍽️ Nutrition <small>${esc(semTxt)}</small></h2><div class="card" data-swipe="mb-vw">${nav}${vw === 0 ? `<div class="row between"><b class="small">Aujourd'hui</b><span class="xs muted">${N.dayLog(t0).length} aliment${N.dayLog(t0).length > 1 ? "s" : ""} notés</span></div>${ligne({ kcal: jt.kcal || 0, p: jt.p || 0, c: jt.c || 0, f: jt.f || 0 })}` : ""}
    <div class="row between ${vw === 0 ? "mt12" : ""}"><b class="small">Moyenne ${vw === 0 ? "7 jours" : "de la semaine"}</b><span class="xs muted">${notes.length}/7 jours notés</span></div>${ligne({ kcal: moy("kcal"), p: moy("p"), c: moy("c"), f: moy("f") })}${barres}</div>`;
  const ag = E.agenda(sem[0], sem[6]);
  const fait = sem.filter(k => ag[k]?.st === "done").length, prevu = sem.filter(k => ag[k] && !["rest", "away"].includes(ag[k].st)).length;
  const ico = { done: "✅", missed: "❌", planned: "🏋️", rest: "😌", away: "↪️" };
  const der = vw === 0 ? (D.workouts || []).slice(-3).reverse() : (D.workouts || []).filter(w => { const k = today(new Date(w.end)); return k >= sem[0] && k <= sem[6]; }).reverse();
  const seances = `<h2 class="sec">🏋️ Séances <small>${fait}/${prevu} ${vw === 0 ? "cette semaine" : "cette semaine-là"}</small></h2><div class="card" data-swipe="mb-vw">${nav}<div class="wk7s">${sem.map((k, i) => `<div class="${k === t0 ? "on" : ""}"><span>${E.DAY_SHORT[i]}</span><b>${ag[k] ? ico[ag[k].st] || "·" : "·"}</b></div>`).join("")}</div>
    ${der.length ? der.map(w => `<button class="li" style="width:100%;text-align:left" data-a="mb-tab" data-v="seances"><span class="grow small"><b>${esc(w.title)}</b><br><span class="xs muted">${fmtDate(today(new Date(w.end)), { weekday: "short", day: "numeric", month: "short" })} · ${w.setsDone ?? (w.exercises || []).reduce((a, e) => a + (e.sets || []).filter(x => x.done && x.type !== "W").length, 0)} séries${w.volume ? ` · ${fr(w.volume / 1000, 1)} t` : ""}${w.records?.length ? " · 🏆" : ""}</span></span>${I.chev}</button>`).join("") : `<p class="small muted mt8" style="margin-bottom:0">Aucune séance enregistrée${vw === 0 ? "" : " cette semaine-là"}.</p>`}</div>`;
  return hero + profil + prog + nutri + seances;
}
function fileCards(m, D) {
  mbr.exNames = [...new Set([...(E.nextSession()?.p?.s || []).flatMap(x => (x[2] || []).map(r => r[0])), ...(D.workouts || []).slice(-20).flatMap(w => w.exercises.map(e => e.name))])].filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
  const ns = E.nextSession(), st = mbr.settings || {}, bl = st.bilan, dls = (st.deadlines || []).slice().sort((a, b) => a.d.localeCompare(b.d));
  const plan = D.myPlan?.meals?.length ? D.myPlan.meals : null, kcal = plan ? plan.flatMap(x => x.items || []).reduce((a, i) => a + (i.kcal || 0), 0) : null, t = N.targets();
  const nb = ns?.p?.s?.length || 0, startD = D.plan?.startedAt;
  const lastCi = (D.checkins || []).at(-1);
  const fb = st.feedback, ob = st.objectif;
  return `<div class="row between mt16"><b class="lbl" style="margin:0">🎯 Objectif de la période</b><button class="link xs" data-a="mb-obj">${ob ? "Modifier" : "+ Fixer"}</button></div>
    ${ob ? `<div class="card mt4 grad"><div class="xs" style="opacity:.85">VISIBLE PAR ${esc((m.name || "l'athlète").split(" ")[0].toUpperCase())} · ${fmtDate(ob.du, { day: "numeric", month: "short" })} → ${fmtDate(ob.au, { day: "numeric", month: "short" })}</div><b class="h3 mt4" style="display:block">${esc(ob.titre)}</b>${ob.detail ? `<div class="xs mt4" style="opacity:.9;white-space:pre-wrap">${esc(ob.detail)}</div>` : ""}</div>` : `<p class="xs muted mt4">Ce qu'il vise d'ici la fin du cycle (« −4 kg et 100 kg au squat d'ici le 7 octobre ») : il le voit en haut de son accueil.</p>`}
    <div class="row between mt16"><b class="lbl" style="margin:0">Mon mot sur son accueil</b><button class="link xs" data-a="mb-fb">${fb?.txt ? "Modifier" : "+ Écrire"}</button></div>
    ${fb?.txt ? `<div class="card mt4 soft"><p class="small" style="margin:0;white-space:pre-wrap">${esc(fb.txt)}</p><div class="xs muted mt4">Écrit le ${fmtDate(fb.d, { day: "numeric", month: "long" })}${fb.seen ? ` · lu le ${fmtDate(fb.seen, { day: "numeric", month: "long" })}` : " · pas encore lu"}</div></div>` : `<p class="xs muted mt4">Un retour sur sa semaine, une consigne : il le voit en haut de son accueil.</p>`}
    <div class="row between mt16"><b class="lbl" style="margin:0">🗣️ Consignes par exercice</b><button class="link xs" data-a="cue-add">+ Ajouter</button></div>
    ${Object.keys(st.cues || {}).length ? `<div class="card mt4" style="padding:4px 8px">${Object.entries(st.cues).map(([n, t]) => `<div class="li" style="gap:8px;align-items:flex-start"><span class="grow small"><b>${esc(n)}</b><br><span class="xs" style="white-space:pre-wrap">${esc(t)}</span></span><button class="icon-btn sm" data-a="cue-add" data-n="${esc(n)}" aria-label="Modifier">✏️</button><button class="icon-btn sm" data-a="cue-del" data-n="${esc(n)}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>` : `<p class="xs muted mt4">Ses cues à lui (« pousse le sol », « coudes à 45° ») : elles s'affichent sur l'exercice pendant sa séance.</p>`}
    <div class="row between mt16"><b class="lbl" style="margin:0">Programme sport</b><span class="xs muted">${ns ? "1 actif" : "aucun"}</span></div>
    ${ns ? `<div class="card grad mt4"><div class="xs" style="opacity:.85">● EN COURS · VISIBLE PAR ${esc((m.name || "l'athlète").split(" ")[0].toUpperCase())}</div><b class="h3 mt4" style="display:block">${esc(ns.p.name)}</b>
      <div class="xs mt4" style="opacity:.9">${startD ? `Depuis le ${fmtDate(startD, { day: "numeric", month: "short" })} · ` : ""}semaine ${ns.week}/${ns.weeks} · ${nb} séance${nb > 1 ? "s" : ""}/sem. · ${esc(ns.phase)}</div>
      <div class="row mt12" style="gap:8px"><button class="btn btn-sm grow" style="background:rgba(255,255,255,.2);color:#fff" data-a="mb-tab" data-v="agenda">🗓️ Planning</button><button class="btn btn-sm grow" style="background:#fff;color:var(--ink)" data-a="go" data-r="member-prog" data-p="${esc(m.id)}">✏️ Modifier</button></div></div>`
      : `<div class="card mt4"><p class="small muted" style="margin:0">Pas de programme en cours.</p></div>`}
    <div class="grid3 mt8"><button class="btn btn-line btn-sm" data-a="mb-zero">✨ De zéro</button><button class="btn btn-line btn-sm" data-a="mb-squel">🦴 8 patterns</button><button class="btn btn-line btn-sm" data-a="mb-assign">📋 Un modèle</button></div>
    ${prefsCard(D)}
    <div class="row between mt16"><b class="lbl" style="margin:0">🏃 Cardio programmé</b><button class="link xs" data-a="mb-cardio">+ Programmer</button></div>
    ${(st.cardio || []).length ? `<div class="card mt4" style="padding:4px 8px">${st.cardio.map(c => `<div class="li" style="gap:8px"><button class="grow small" style="text-align:left" data-a="mb-cardio" data-id="${esc(c.id)}"><b>${esc(c.titre)}</b><br><span class="xs muted">${esc(CA.libQuand(c.quand))}${c.heure ? " · " + c.heure : ""} · ${CA.dureeTotale(c.blocs)} min${c.prog?.weeks ? ` · progression ${c.prog.weeks} sem.` : ""}</span></button><button class="icon-btn sm" data-a="mb-cardio-del" data-id="${esc(c.id)}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>` : `<p class="xs muted mt4">Endurance, seuil, fractionné, Hyrox… avec un plan de progression : il le lance et l'app le guide bloc par bloc.</p>`}
    <div class="row between mt16"><b class="lbl" style="margin:0">Plan diète</b><span class="xs muted">${plan ? "1 actif" : t ? "calculé par l'app" : "aucun"}</span></div>
    <div class="card mt4"><b class="small">${plan ? "Plan écrit" : "Plan calculé pour son profil"}</b><div class="xs muted mt4">${plan ? `${fr(kcal)} kcal · ${plan.length} repas` : t ? `${fr(t.kcal)} kcal · ${t.prot} g de protéines` : "Profil incomplet"}</div>
      <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="go" data-r="member-food" data-p="${esc(m.id)}">✏️ Modifier</button><button class="btn btn-line btn-sm grow" data-a="mb-plan">🍽️ Envoyer un plan</button></div></div>
    <div class="row between mt16"><b class="lbl" style="margin:0">Bilans</b><button class="link xs" data-a="mb-bilan">Régler</button></div>
    <div class="card mt4"><b class="small">${esc(BR.libelleRythme(bl))}</b><div class="xs muted mt4">${bl?.on === false ? "Aucun rappel de bilan." : `Prochain : ${fmtDate(BR.prochainJourBilan(bl, today()), { weekday: "long", day: "numeric", month: "long" })}${(bl?.questions || []).length ? ` · ${bl.questions.length} question${bl.questions.length > 1 ? "s" : ""} en plus` : ""}${bl?.digest ? " · transit et digestion" : ""}`}${lastCi ? ` · dernier le ${fmtDate(lastCi.d, { day: "numeric", month: "short" })}` : ""}</div></div>
    <div class="row between mt16"><b class="lbl" style="margin:0">Échéances</b><button class="link xs" data-a="mb-dl-add">+ Ajouter</button></div>
    ${dls.length ? `<div class="card mt4" style="padding:4px 8px">${dls.map(e => `<div class="li" style="gap:8px"><span class="grow small"><b>${esc((DL_TYPES.find(x => x[0] === e.type) || ["", "🎯"])[1].split(" ")[0])} ${esc(e.title)}</b><br><span class="xs muted">${fmtDate(e.d, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}${e.visible === false ? " · visible par toi seul" : ""}</span></span><button class="icon-btn sm" data-a="mb-dl-del" data-id="${e.id}" aria-label="Supprimer l'échéance">${I.close}</button></div>`).join("")}</div>` : `<p class="xs muted mt4">Compétition, test, fin de cycle : l'athlète voit le compte à rebours sur son accueil.</p>`}`;
}
async function saveSettings(patch) {
  const c = await cloud(); const next = { ...(mbr.settings || {}), ...patch };
  try { await c.coachSettingsSet(mbr.id, next); mbr.settings = next; return true; } catch (e) { toast("Enregistrement impossible : " + e.message); return false; }
}
actions["mb-bilan"] = () => {
  const b = { ...BR.BILAN_DEFAUT, ...(mbr.settings?.bilan || {}) };
  sheet(`<h2 class="h2">📝 Bilans de cet athlète</h2><form data-f="mb-bilan" class="mt12">
    <label class="li" style="padding:8px 0"><span class="grow">Bilans activés</span><input type="checkbox" name="on" ${b.on ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--red)"></label>
    <div class="grid2 mt8"><label class="field"><span>Jour</span><select name="dow">${["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((l, i) => `<option value="${i}" ${b.dow === i ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="field"><span>Fréquence</span><select name="every">${[[1, "Chaque semaine"], [2, "Toutes les 2 semaines"], [4, "Toutes les 4 semaines"]].map(([v, l]) => `<option value="${v}" ${b.every === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="li mt8" style="padding:8px 0"><span class="grow">Transit et digestion (notes de 1 à 10)</span><input type="checkbox" name="digest" ${b.digest ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--red)"></label>
    <label class="field mt8"><span>Tes questions en plus (une par ligne)</span><textarea name="questions" rows="4" placeholder="Comment va ton genou ?&#10;Combien de pas en moyenne ?">${esc((b.questions || []).join("\n"))}</textarea></label>
    <p class="xs muted mt8">Toujours remplis : poids, mensurations, sommeil, énergie, stress, faim, plan suivi, victoire, difficulté. L'athlète reçoit le rappel sur son accueil le jour prévu.</p>
    <button class="btn btn-red mt12">Enregistrer</button></form>`);
};
forms["mb-bilan"] = async (v) => {
  const old = mbr.settings?.bilan || {}, every = +v.every || 1;
  const bilan = { on: !!v.on, dow: +v.dow, every, digest: !!v.digest, questions: String(v.questions || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8), from: old.every === every && old.from ? old.from : today() };
  if (await saveSettings({ bilan })) { closeSheet(); toast("Bilans réglés"); rerender(); }
};
actions["mb-dl-add"] = () => sheet(`<h2 class="h2">🎯 Nouvelle échéance</h2><form data-f="mb-dl" class="mt12"><label class="field"><span>Quoi</span><input name="title" maxlength="80" placeholder="Compétition, test de force, fin de sèche…" required></label>
  <div class="grid2 mt8"><label class="field"><span>Date</span><input type="date" name="d" min="${today()}" required></label><label class="field"><span>Type</span><select name="type">${DL_TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label></div>
  <label class="li mt8" style="padding:8px 0"><span class="grow">Visible par l'athlète</span><input type="checkbox" name="visible" checked style="width:22px;height:22px;accent-color:var(--red)"></label>
  <button class="btn btn-red mt12">Ajouter</button></form>`);
forms["mb-dl"] = async (v) => {
  const deadlines = [...(mbr.settings?.deadlines || []).filter(e => e.d >= addDays(today(), -30)), { id: Date.now(), title: v.title.trim(), d: v.d, type: v.type, visible: !!v.visible }];
  if (await saveSettings({ deadlines })) { closeSheet(); toast("Échéance ajoutée"); rerender(); }
};
actions["mb-dl-del"] = async (b, d) => { if (!confirm("Supprimer cette échéance ?")) return; if (await saveSettings({ deadlines: (mbr.settings?.deadlines || []).filter(e => e.id !== +d.id) })) rerender(); };

// Récap : prévu, dernière fois, écart par série (vert = progrès, rouge = recul)
function recapLine(w, e) {
  const r = recapExercice(w, e, S().workouts); if (!r.series.length) return "";
  const col = (x) => x > 0 ? "var(--good)" : x < 0 ? "var(--red)" : "var(--muted)";
  return `<div class="xs mt4" style="line-height:1.5">${r.prevu ? `<span class="muted">Prévu ${esc(r.prevu.replace(/x/g, "×"))}</span>` : ""}${r.avant.length ? `${r.prevu ? " · " : ""}<span class="muted">Dernière fois (${fmtDate(today(new Date(r.avantLe)), { day: "numeric", month: "short" })}) : ${r.avant.map(serieTxt).join(" · ")}</span><br>${r.series.map((x, i) => `S${i + 1} <b style="color:${col(x.ecart.sens)}">${esc(x.ecart.txt)}</b>`).join(" · ")}` : ""}</div>`;
}

actions["mb-fb"] = () => sheet(`<h2 class="h2">💬 Mon mot sur son accueil</h2><form data-f="mb-fb" class="mt12"><label class="field"><span>Ton retour (vide = retirer)</span><textarea name="txt" rows="5" maxlength="600" placeholder="Belle semaine : 3 séances sur 3. On garde le cap, et on vise 8 000 pas par jour.">${esc(mbr.settings?.feedback?.txt || "")}</textarea></label><button class="btn btn-red mt12">Publier</button></form>`);
forms["mb-fb"] = async (v) => {
  const txt = (v.txt || "").trim(), feedback = txt ? { txt, d: today() } : null;
  if (await saveSettings({ feedback })) { closeSheet(); toast(txt ? "Publié sur son accueil" : "Retiré"); if (txt) { try { const c = await cloud(); await c.notify("💬 Un mot de Thomas", txt.slice(0, 120), mbr.id); } catch { } } rerender(); }
};

actions["code-coach"] = () => sheet(`<h2 class="h2">🔑 Mon code coach</h2><form data-f="code-coach" class="mt12"><label class="field"><span>Code reçu de Thomas</span><input name="code" maxlength="12" placeholder="TB-XXXXX" autocapitalize="characters" required></label><button class="btn btn-red mt12">Valider</button></form>`);
forms["code-coach"] = async (v) => { const c = await cloud(); const r = await claimInvite(c, v.code.trim().toUpperCase()); if (r) { closeSheet(); rerender(); } else toast("Code inconnu ou déjà utilisé"); };

// =====================================================================
// CORRECTION DES SÉANCES (coach) : comme une copie qu'on corrige. Entre le coach et l'athlète seulement.
// =====================================================================
function reviewBar(w) {
  const r = mbr.reviews?.[String(w.id)];
  return `<div class="row between mt8" style="gap:8px;border-top:1px dashed var(--line);padding-top:8px"><span class="xs ${r ? "" : "muted"}">${r ? esc(RV.resumeRevue(r.data)) + (r.seen_at ? " · lu" : "") : "Pas encore corrigée"}</span>
    <div class="row" style="gap:6px">${r ? "" : `<button class="btn btn-line btn-xs" data-a="rv-quick" data-id="${esc(w.id)}">👀 Vue</button>`}<button class="btn btn-red btn-xs" data-a="rv-open" data-id="${esc(w.id)}">✍️ ${r ? "Modifier" : "Corriger"}</button></div></div>`;
}
const wOf = (id) => (mbr.data?.data?.workouts || []).find(w => String(w.id) === String(id));
async function saveReview(w, data, msg = true) {
  const c = await cloud(); const clean = RV.nettoyer(data);
  try { await c.reviewSave(mbr.id, w.id, clean); mbr.reviews = { ...(mbr.reviews || {}), [String(w.id)]: { data: clean, updated_at: new Date().toISOString(), seen_at: null } };
    if (msg) await c.notify(`${clean.reaction || "✅"} Thomas a corrigé ta séance`, `${w.title} · ${RV.resumeRevue(clean)}`, mbr.id).catch(() => { });
    return true; } catch (e) { toast("Enregistrement impossible : " + e.message); return false; }
}
actions["rv-quick"] = async (b, d) => { const w = wOf(d.id); if (!w) return; if (await saveReview(w, { reaction: "👀", vu: true })) { toast("Marquée « vue par ton coach »"); rerender(false); } };
actions["rv-open"] = (b, d) => {
  const w = wOf(d.id); if (!w) return; const r = mbr.reviews?.[String(w.id)]?.data || {};
  const stars = (k, v) => `<div class="stars" data-k="${k}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${v >= n ? "on" : ""}" data-a="rv-star" data-k="${k}" data-v="${n}" aria-label="${n} sur 5">★</button>`).join("")}<input type="hidden" name="g_${k}" value="${v || ""}"></div>`;
  sheet(`<h2 class="h2">✍️ ${esc(w.title)}</h2><div class="xs muted">${fmtDate(today(new Date(w.end)), { weekday: "long", day: "numeric", month: "long" })} · ${w.setsDone ?? ""} séries</div>
    <form data-f="rv-save" class="mt12"><input type="hidden" name="id" value="${esc(w.id)}"><input type="hidden" name="reaction" value="${esc(r.reaction || "")}">
    <div class="lbl">Ta réaction</div><div class="chips wrap">${RV.REACTIONS.map(e => `<button type="button" class="chip ${r.reaction === e ? "on" : ""}" data-a="rv-react" data-v="${e}" style="font-size:20px">${e}</button>`).join("")}</div>
    <div class="lbl mt12">Notation</div><div class="card" style="padding:6px 12px">${RV.CRITERES.map(([k, l]) => `<div class="row between" style="padding:6px 0"><span class="small">${l}</span>${stars(k, r.grades?.[k] || 0)}</div>`).join("")}</div>
    <div class="lbl mt12">Par exercice</div>
    ${w.exercises.map((e, i) => { const done = e.sets.filter(x => x.done); if (!done.length) return ""; const re = r.ex?.[i] || {};
      return `<div class="card mt8"><b class="small">${esc(e.name)}</b><div class="xs muted">${esc(setsLine(e))}</div>
        <textarea name="e${i}_c" rows="2" maxlength="600" class="mt8" placeholder="Ton commentaire sur l'exercice">${esc(re.c || "")}</textarea>
        <details class="mt4" ${Object.keys(re.sets || {}).length ? "open" : ""}><summary class="xs" style="cursor:pointer;color:var(--red)">Commenter une série</summary>
        ${e.sets.map((x, j) => x.done ? `<label class="row mt4" style="gap:8px;align-items:center"><span class="xs" style="min-width:74px">S${j + 1} · ${x.kg ? E.fmtKg(x.kg) + "×" : ""}${x.reps ?? "–"}</span><input name="e${i}_s${j}" maxlength="300" value="${esc(re.sets?.[j] || "")}" placeholder="Ex. dos rond en fin de série"></label>` : "").join("")}</details></div>`; }).join("")}
    <label class="field mt12"><span>Ton retour global</span><textarea name="note" rows="4" maxlength="1500" placeholder="Ce qui est bien, ce qu'on travaille à la prochaine.">${esc(r.note || "")}</textarea></label>
    <button class="btn btn-red mt12">Envoyer la correction</button>${mbr.reviews?.[String(w.id)] ? `<button type="button" class="btn btn-ghost mt8" data-a="rv-del" data-id="${esc(w.id)}">Retirer la correction</button>` : ""}</form>`);
};
actions["rv-react"] = (b, d) => { const f = b.closest("form"); const cur = f.elements.reaction.value === d.v ? "" : d.v; f.elements.reaction.value = cur; f.querySelectorAll('[data-a="rv-react"]').forEach(x => x.classList.toggle("on", x.dataset.v === cur)); };
actions["rv-star"] = (b, d) => { const box = b.closest(".stars"), inp = box.querySelector("input"), v = inp.value === d.v ? "" : d.v; inp.value = v; box.querySelectorAll("button").forEach(x => x.classList.toggle("on", +x.dataset.v <= +v)); };
forms["rv-save"] = async (v) => {
  const w = wOf(v.id); if (!w) return;
  const ex = {}; w.exercises.forEach((e, i) => { const sets = {}; e.sets.forEach((x, j) => { if (v[`e${i}_s${j}`]) sets[j] = v[`e${i}_s${j}`]; }); ex[i] = { c: v[`e${i}_c`], sets }; });
  const grades = Object.fromEntries(RV.CRITERES.map(([k]) => [k, v["g_" + k]]));
  if (await saveReview(w, { reaction: v.reaction, note: v.note, grades, ex })) { closeSheet(); toast("Correction envoyée"); rerender(false); }
};
actions["rv-del"] = async (b, d) => { if (!confirm("Retirer cette correction ?")) return; try { await (await cloud()).reviewDel(mbr.id, d.id); delete mbr.reviews[String(d.id)]; closeSheet(); rerender(false); } catch (e) { toast(e.message); } };

actions["cue-add"] = (b, d) => {
  const n = d.n || "", t = (mbr.settings?.cues || {})[n] || "";
  sheet(`<h2 class="h2">🗣️ Consigne sur un exercice</h2><form data-f="cue-save" class="mt12"><input type="hidden" name="old" value="${esc(n)}">
    <label class="field"><span>Exercice</span><input name="n" list="cue-ex" value="${esc(n)}" required maxlength="80" placeholder="Choisis ou tape le nom"><datalist id="cue-ex">${(mbr.exNames || []).map(x => `<option value="${esc(x)}">`).join("")}</datalist></label>
    <label class="field mt8"><span>Ses consignes (ce sur quoi vous travaillez)</span><textarea name="t" rows="5" maxlength="1500" required placeholder="Pousse le sol avec tout le pied.&#10;Genoux dans l'axe des pieds.&#10;Expire en haut.">${esc(t)}</textarea></label>
    <p class="xs muted">Il la voit sur l'exercice pendant sa séance et dans « Mes notes » (Profil).${(mbr.data?.data?.exoNotes || {})[n] ? `</p><div class="card soft"><b class="xs">📝 Sa note</b><p class="small" style="margin:4px 0 0;white-space:pre-wrap">${esc(mbr.data.data.exoNotes[n])}</p></div><p class="xs muted">` : ""}</p><button class="btn btn-red mt12">Enregistrer</button></form>`);
};
forms["cue-save"] = async (v) => {
  const cues = { ...(mbr.settings?.cues || {}) }; if (v.old && v.old !== v.n) delete cues[v.old]; cues[v.n.trim()] = v.t.trim();
  if (await saveSettings({ cues })) { closeSheet(); toast("Consigne enregistrée"); rerender(); }
};
actions["cue-del"] = async (b, d) => { if (!confirm("Supprimer cette consigne ?")) return; const cues = { ...(mbr.settings?.cues || {}) }; delete cues[d.n]; if (await saveSettings({ cues })) rerender(); };

actions["quiz-send"] = async () => {
  const id = R.param; if (!id) return;
  if (!confirm("Envoyer le quiz « exercices aimés et détestés » dans la conversation ?")) return;
  try { const c = await cloud(); await c.send(`📋 Petit quiz pour construire ton programme : pour chaque mouvement, coche les exercices que tu aimes et ceux que tu détestes. 2 minutes !\n${QUIZ_TOKEN}`, id); window.__reloadThread?.(); toast("Quiz envoyé"); } catch (e) { toast("Envoi impossible : " + e.message); }
};

// ---------- Créer le programme d'un athlète : de zéro, sur le squelette des 8 patterns, ou depuis un modèle ----------
function prefsCard(D) {
  const pr = D.programme?.prefs || {}, love = Object.keys(pr).filter(k => pr[k] === "love"), hate = Object.keys(pr).filter(k => pr[k] === "hate");
  const nom = (slug) => (XO.exercices?.() || []).find(e => e.slug === slug)?.nom || slug.replace(/[-_]/g, " ");
  return love.length || hate.length ? `<div class="card mt8"><div class="xs"><b>😍 Aime :</b> ${esc(love.map(nom).join(", ") || "–")}</div><div class="xs mt4"><b>🚫 Déteste :</b> ${esc(hate.map(nom).join(", ") || "–")}</div><div class="xs muted mt4">Le squelette 8 patterns met ses favoris en premier et écarte ce qu'il déteste.</div></div>`
    : `<p class="xs muted mt8">Ses exercices préférés : envoie-lui le quiz « 📋 Quiz exos » depuis la conversation.</p>`;
}
actions["mb-zero"] = async () => {
  const m = (window.__members || []).find(x => x.id === mbr.id) || { id: mbr.id };
  const { openProgramEditor } = await import("./coachprog.js");
  openProgramEditor(mbr.id, { name: `Programme de ${(m.name || "").split(" ")[0] || "l'athlète"}`, s: [["Séance A", "Lundi", []], ["Séance B", "Mercredi", []], ["Séance C", "Vendredi", []]] });
};
actions["mb-squel"] = async () => {
  const D = mbr.data?.data; if (!D) return;
  toast("Squelette en cours de construction…");
  try {
    await XO.loadExercices(); const G = await import("../generateur.js");
    const prog = { answers: { daysWanted: 3, level: D.profile?.level === "beginner" ? "debutant" : "regulier", ...(D.programme?.answers || {}) }, prefs: D.programme?.prefs || {} };
    const prop = G.generer(prog, { seed: Date.now() % 1000 }), m = (window.__members || []).find(x => x.id === mbr.id) || {};
    const program = G.versProgramme(prop, { name: `Programme de ${(m.name || "").split(" ")[0] || "l'athlète"} · 8 patterns` });
    const { openProgramEditor } = await import("./coachprog.js");
    toast(`Squelette prêt : ${prop.n} séances. Ajoute l'isolation et le travail spécifique.`);
    openProgramEditor(mbr.id, program);
  } catch (e) { toast("Squelette impossible : " + e.message); }
};

function mesConsignes() {
  const c = S().coachSettings?.cues || {}; if (!Object.keys(c).length) return "";
  return `<h2 class="sec">🗣️ Mes consignes de Thomas</h2><div class="card" style="padding:4px 12px">${Object.entries(c).map(([n, t]) => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b class="small">${esc(n)}</b><div class="xs mt4" style="white-space:pre-wrap">${esc(t)}</div></div>`).join("")}<p class="xs muted" style="margin:8px 0">Elles s'affichent aussi sur l'exercice pendant ta séance.</p></div>`;
}

// Cardio programmé par le coach (réglages de l'athlète) : même éditeur que l'athlète, avec plan de progression
actions["mb-cardio"] = (b, d) => {
  const it = d.id ? (mbr.settings?.cardio || []).find(x => String(x.id) === d.id) : null;
  ouvrirEditeur(it ? { ...it, saved: true } : { id: "k" + Date.now(), sport: "course", modele: "ef", blocs: CA.modele("ef").blocs, quand: { jours: [1, 3], from: today() }, prog: { weeks: 8, every: 1, effortMin: 2 } }, { coach: true,
    onSave: async (item, delId) => { const l = (mbr.settings?.cardio || []).filter(x => x.id !== (item?.id || delId)); if (item) l.push(item); const ok = await saveSettings({ cardio: l }); if (ok && item) { try { (await cloud()).notify("🏃 Nouveau cardio programmé", `${item.titre} · ${CA.libQuand(item.quand)}`, mbr.id); } catch { } } return ok; } });
};
actions["mb-cardio-del"] = async (b, d) => { if (!confirm("Supprimer ce cardio programmé ?")) return; if (await saveSettings({ cardio: (mbr.settings?.cardio || []).filter(x => String(x.id) !== d.id) })) rerender(); };

actions["vd-from"] = (b) => { const v = b.previousElementSibling; const u = v?.currentSrc || v?.src; if (!u) return toast("Vidéo pas encore chargée : lance-la une fois puis réessaie."); ouvrirVideo(u); };

actions["mb-obj"] = () => { const o = mbr.settings?.objectif || {}; sheet(`<h2 class="h2">🎯 Objectif de la période</h2><form data-f="mb-obj" class="mt12">
  <label class="field"><span>Objectif</span><input name="titre" maxlength="90" required value="${esc(o.titre || "")}" placeholder="−4 kg et 100 kg au squat"></label>
  <div class="grid2 mt8"><label class="field"><span>Du</span><input type="date" name="du" value="${o.du || today()}" required></label><label class="field"><span>Au</span><input type="date" name="au" value="${o.au || addDays(today(), 84)}" required></label></div>
  <label class="field mt8"><span>Détail (facultatif)</span><textarea name="detail" rows="3" maxlength="400" placeholder="Les étapes, ce qu'on mesure, pourquoi c'est important pour lui.">${esc(o.detail || "")}</textarea></label>
  <button class="btn btn-red mt12">Enregistrer</button>${o.titre ? `<button type="button" class="btn btn-ghost mt8" data-a="mb-obj-del">Retirer l'objectif</button>` : ""}</form>`); };
forms["mb-obj"] = async (v) => { if (v.au < v.du) return toast("La fin est avant le début"); if (await saveSettings({ objectif: { titre: v.titre.trim(), du: v.du, au: v.au, detail: (v.detail || "").trim() } })) { closeSheet(); toast("Objectif fixé"); rerender(); } };
actions["mb-obj-del"] = async () => { if (await saveSettings({ objectif: null })) { closeSheet(); rerender(); } };

// ---------- Saisie à la place du client (séance oubliée, repas non noté) ----------
import { saisieStart, saisieStop } from "../saisie.js";
import { proxyActive } from "../store.js";
const mbrName = () => (window.__members || []).find(x => x.id === mbr.id)?.name || "le client";
actions["saisie-seance"] = (b, d) => sheet(`<h2 class="h2">✍️ Noter une séance pour ${esc(mbrName().split(" ")[0])}</h2><p class="small muted mt4">Même écran que le sien : tu valides les séries, les charges, puis tu règles l'heure et la durée. Rien n'est lancé en direct.</p>
  <form data-f="saisie-seance" data-id="${esc(d.id)}" class="mt12"><label class="field"><span>Jour de la séance</span><input type="date" name="d" value="${today()}" max="${today()}" required></label><button class="btn btn-red mt12">Continuer</button></form>`);
forms["saisie-seance"] = async (v, f) => {
  const ok = await saisieStart(f.dataset.id, mbrName(), mbr.data?.data || {}); if (!ok) return;
  closeSheet(); await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]).catch(() => { });
  actions["missed-done"](null, { v: v.d });
};
actions["saisie-repas"] = async (b, d) => { await saisieStart(d.id, mbrName(), mbr.data?.data || {}); go("food"); };
actions["saisie-fin"] = async () => { const id = mbr.id; await saisieStop(); toast("Enregistré chez le client"); mbr.data = null; go("member", id); };

// Corriger une séance déjà terminée du client (oublis de reps, charges…) : même éditeur que le sien ; l'enregistrement la met à jour chez lui
let editBranche = false;
actions["saisie-edit"] = async (b, d) => {
  await saisieStart(mbr.id, mbrName(), mbr.data?.data || {});
  if (!editBranche) {
    editBranche = true;
    for (const k of ["we-save", "w-del"]) { const o = actions[k]; actions[k] = async (...a) => { await o(...a); if (proxyActive()) { await saisieStop(); mbr.data = null; toast("Séance mise à jour chez le client"); go("member", mbr.id); } }; }
  }
  actions["w-edit"](null, { id: d.id });
};
