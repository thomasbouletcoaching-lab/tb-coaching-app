import { PUBLIC_OFFERS } from "../config.js";
// Coach : messagerie (avec réactions), offres et démo, candidature, bilans, notifications, espace coach.
import { S, update, today, withState } from "../store.js";
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import { CONFIG, OFFERS, offer, COMPARE } from "../config.js";
import { coachLogo, trialLeft, $app, esc, num, fr, buzz, toast, ago, routes, R, actions, forms, changes, go, I, header, tabbar, adminTabbar, seg, chips, sheet, closeSheet, badges, fmtDate, addDays, rerender, tier, rank, premium, isCoach, msgQuotaText, cloud, cloudNow, render, onLeave, canMsg } from "../core.js";
import { refreshMe, syncProfile } from "../sync.js";
import { fromCoach, libraryRows } from "../library.js";

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
    <h2 class="sec">📋 Mon programme du coach</h2>
    ${progs.length || plans.length ? `${progs.map(r => { const id = "lib-" + r.id, on = curP === id; return `<div class="card"><div class="lbl">🏋️ Entraînement</div><b class="h3">${esc(r.name)}</b><p class="small muted mt4">${esc(r.data?.desc || "Écrit pour toi par Thomas.")}</p>${on ? `<span class="tag r">Programme suivi</span> <button class="link small" data-a="go" data-r="carnet">Ouvrir le carnet</button>` : `<button class="btn btn-red btn-sm mt8" data-a="coach-follow" data-id="${id}">Suivre ce programme</button>`}</div>`; }).join("")}
      ${plans.map(r => { const k = (r.data?.meals || []).flatMap(m => m.items || []).reduce((a, x) => a + (x.kcal || 0), 0); return `<div class="card"><div class="lbl">🍽️ Nutrition</div><b class="h3">${esc(r.name)}</b><p class="small muted mt4">${(r.data?.meals || []).length} repas · ${fr(k)} kcal par jour${r.data?.note ? " · " + esc(r.data.note) : ""}</p><button class="btn ${S().coachPlanId === r.id ? "btn-line" : "btn-red"} btn-sm mt8" data-a="coach-plan" data-id="${r.id}">${S().coachPlanId === r.id ? "✓ Plan appliqué · le réappliquer" : "Appliquer ce plan à mon journal"}</button></div>`; }).join("")}`
      : `<div class="card"><p class="small" style="margin:0">${coached ? "Thomas t'envoie ici ton programme d'entraînement et ton plan alimentaire, écrits pour toi. Ils apparaissent dès qu'il les a préparés." : "Avec le coaching personnalisé, Thomas écrit ton programme d'entraînement et ton plan alimentaire : ils arrivent ici, et il suit tes séances et ton journal."}</p>${coached ? "" : `<button class="btn btn-red btn-sm mt12" data-a="go" data-r="apply">Candidater au coaching</button>`}</div>`}
    <h2 class="sec">🎯 Ta formule <small>${esc(o.name)}</small></h2>
    ${rank() >= 2 ? followUp() : `<button class="card tap" data-a="go" data-r="offers" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left"><span style="font-size:28px">🚀</span><span class="grow"><b>${premium() ? "Passer au coaching avec Thomas" : "Voir les offres"}</b><br><span class="small muted">${premium() ? "Programme et plan écrits pour toi, bilans, messages" : "Bâtisseur : 7 jours offerts, puis 14,99 €/mois"}</span></span>${I.chev}</button>`}
    ${rank() >= 2 ? `<button class="card tap mt12" data-a="go" data-r="offers" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left"><span class="grow"><b>Toutes les offres</b><br><span class="small muted">Comparer et changer de formule</span></span>${I.chev}</button>` : ""}
  </main>${tabbar("coach")}`;
};
actions["coach-msg"] = () => { if (canMsg()) return go("chat"); toast("Les messages avec Thomas sont réservés aux coachés"); go("offers"); };
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
  $app.innerHTML = header("Les offres", "7 jours d'essai, sans engagement", { back: "__hist", offers: false }) + `<main class="page">
    <h2 class="sec" style="margin-top:8px">Ce qui accélère vraiment tes progrès</h2>
    <div class="list">${[["🎯", "Des charges calculées à chaque séance", "Fini le hasard : l'app te dit quoi soulever selon ton RPE, et détecte tes plateaux avant qu'ils durent."],
      ["🍽️", "Un plan alimentaire au gramme", "Ton plan selon ton profil, tes jours d'entraînement et de repos, tes courses et ton budget."],
      ["📈", "Toutes tes données, lisibles", "Tonnage, records, mensurations, projections : tu vois si tu avances, semaine après semaine."],
      ["🧑‍🏫", "Le coaching : quelqu'un qui ajuste pour toi", "Thomas écrit ton programme et ton plan, lit tes séances, répond à tes messages."]].map(([e, t, d]) => `<div class="li"><span class="em">${e}</span><span class="grow small"><b>${t}</b><br><span class="xs muted">${d}</span></span></div>`).join("")}</div>
    ${trialLeft() > 0 ? `<div class="card grad"><b>🎁 Ton essai : encore ${trialLeft()} jour${trialLeft() > 1 ? "s" : ""}</b><p class="small mt4" style="margin:0">Pendant 7 jours, tout Bâtisseur est ouvert. Ensuite tu gardes le Gratuit, ou tu continues avec Bâtisseur.</p></div>` : `<div class="card grad"><b>🎁 7 jours d'essai de l'app complète</b><p class="small mt4" style="margin:0">Chaque nouveau compte essaie Bâtisseur gratuitement pendant 7 jours.</p></div>`}
    <h2 class="sec">Comparer</h2>
    <div class="card" style="padding:6px"><table class="cmp"><thead><tr><th></th><th>Gratuit</th><th>Bâtis&shy;seur</th><th>Coa&shy;ching</th></tr></thead><tbody>${COMPARE.map(r => `<tr><td>${esc(r[0])}</td>${r.filter((_, i) => i !== 3).slice(1).map(c => `<td class="${c === "–" ? "muted" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${PUBLIC_OFFERS.map(o => `<div class="offer ${o.id === cur ? "cur" : ""} mt16">${o.id === cur ? `<span class="ribbon">Ta formule</span>` : o.ribbon ? `<span class="ribbon">${esc(o.ribbon)}</span>` : ""}
      <div class="row between" style="align-items:flex-end"><div><div class="h2">${esc(o.name)}</div><div class="small muted">${esc(o.tagline)}</div></div><div class="price" style="text-align:right;white-space:nowrap">${esc(o.price)}<small>${esc(o.per)}</small></div></div>
      ${o.alt ? `<div class="small red mt4" style="text-align:right">${esc(o.alt)}</div>` : ""}${o.was ? `<div class="small mt4" style="text-align:right"><span class="muted">au lieu de <s>${esc(o.was)}</s></span></div>` : ""}
      <ul>${o.feats.map(f => `<li>${I.check}<span>${esc(f)}</span></li>`).join("")}<li>${I.check}<span>${esc(o.msgs)}</span></li></ul>
      ${o.id === "free" || o.id === cur ? "" : `<button class="btn btn-red" data-a="choose" data-v="${o.id}">${o.rank >= 2 ? "Candidater au coaching" : trialLeft() > 0 ? "Continuer avec le Bâtisseur" : "Essayer 7 jours gratuitement"}</button>`}
    </div>`).join("")}
    <p class="xs muted mt16">Sans engagement, résiliable à tout moment. Les formules de suivi démarrent après un appel de 15 minutes pour vérifier que je peux vraiment t'aider.</p>
  </main>${tabbar("coach")}`;
};
actions.demo = (b, d) => { update(st => st.demoTier = d.v); toast(`Démo ${offer(d.v).name} : explore l'app`); go("home"); };
actions["demo-exit"] = () => { update(st => st.demoTier = null); render(); };
actions["demo-choose"] = () => { const t = S().demoTier; update(st => st.demoTier = null); chooseOffer(t); };
actions.choose = (b, d) => chooseOffer(d.v);
function chooseOffer(id) {
  const o = offer(id);
  if (o.rank === 1) {
    const link = o.pay?.month;
    if (link) { const u = new URL(link); const c = cloudNow()?.userId?.(); if (c) u.searchParams.set("client_reference_id", c); if (S().profile?.email) u.searchParams.set("prefilled_email", S().profile.email); location.href = u.toString(); return; }
    sheet(`<h2 class="h1">Bâtisseur</h2><p class="mt12">Le paiement en ligne ouvre très bientôt. En attendant, écris-moi : je t'active la formule Bâtisseur moi-même.</p><button class="btn btn-red mt12" data-a="prefill" data-t="Bonjour Thomas, je veux passer à la formule Bâtisseur.">Écrire à Thomas</button>`);
    return;
  }
  AP.i = 0; AP.a = { offer: id }; go("apply");
}
actions.prefill = (b, d) => { closeSheet(); window.__prefill = d.t; go("chat"); };

// ---------- Candidature ----------
const AP = { i: 0, a: {} };
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
  u.searchParams.set("a1", `Offre : ${offer(a.offer).name}\nObjectif : ${a.goal}\nFrein : ${a.obstacle}\nTemps : ${a.time} · Urgence : ${a.urgency}/10`);
  return u.toString();
}
function applyDone() {
  const a = { ...AP.a, at: new Date().toISOString() };
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
  const content = x.audio_path ? `<audio controls preload="none" data-ap="${esc(x.audio_path)}" style="width:220px;max-width:100%;display:block"></audio>` : esc(x.body);
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
  return `<div id="ready-bar" style="display:flex;gap:6px;overflow-x:auto;padding:8px 0;white-space:nowrap">${readyList().map(r => `<button class="chip sm" data-a="ready-use" data-v="${esc(r.id)}">${esc(r.label)}</button>`).join("")}<button class="chip sm" data-a="ready-manage">⚙️ Gérer</button></div>`;
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
  if (!isCoach() && !canMsg()) { toast("Les messages avec Thomas sont réservés aux coachés"); return go("offers"); }
  const memberId = isCoach() ? R.param : null;
  const m = memberId ? (window.__members || []).find(x => x.id === memberId) : null;
  $app.innerHTML = header(memberId ? esc(m?.name || "Membre") : "Thomas", memberId ? esc(m?.email || "") : "Je réponds moi-même", { back: memberId ? "admin-msg" : "coach" })
    + `<main class="page" style="padding-bottom:calc(100px + var(--safe-b))"><div class="thread" id="thread"><p class="empty small">Chargement…</p></div>${memberId ? readyBar() : ""}${memberId ? "" : `<p class="xs muted center">${msgQuotaText()} · touche un message pour réagir</p>`}</main>
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
actions.checkin = () => {
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
  sheet(`<h2 class="h1">🔔 Notifications</h2><div id="nl" class="mt12"><p class="empty small">Chargement…</p></div>`, async (w) => {
    const c = await cloud(); let list = [];
    try { await c.currentSession(); list = await c.notifications(); } catch { }
    const seen = S().notifSeen;
    w.querySelector("#nl").innerHTML = list.length ? `<div class="list">${list.map(n => `<div class="li" style="align-items:flex-start"><span style="width:8px;height:8px;border-radius:50%;margin-top:8px;background:${new Date(n.created_at).getTime() > seen ? "var(--red)" : "transparent"};flex:none"></span><span class="grow"><b>${esc(n.title)}</b>${n.body ? `<br><span class="small muted">${esc(n.body)}</span>` : ""}<br><span class="xs muted">${ago(n.created_at)}</span></span></div>`).join("")}</div>` : `<p class="empty">Aucune notification pour l'instant.</p>`;
    update(st => st.notifSeen = Date.now()); badges.notifs = 0; document.querySelectorAll("[data-a=notifs] .badge").forEach(b => b.remove());
  });
};

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
    <div class="chips">${OFFERS.map(o => `<span class="chip">${esc(o.name)} · ${list.filter(m => m.tier === o.id).length}</span>`).join("")}</div>
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
  if (mbr.id !== m.id) Object.assign(mbr, { id: m.id, tab: "jour", day: null, data: null });
  if (!mbr.data) { $app.innerHTML = header(esc(m.name || "Membre"), "", { back: "admin" }) + `<main class="page"><p class="empty">Chargement de ses données…</p></main>`; await Promise.all([E.loadPrograms(), N.loadModels()]); try { mbr.data = (await c.memberData(m.id)) || { data: null }; } catch (e) { mbr.data = { data: null, err: e.message }; } }
  const tabs = [["jour", "☀️ Journée"], ["seances", "🏋️ Séances"], ["agenda", "🗓️ Agenda"], ["corps", "⚖️ Corps"], ["profil", "👤 Profil"]];
  const D = mbr.data.data;
  const top = `<div class="row" style="gap:8px"><a class="btn btn-red btn-sm grow" href="#/chat/${m.id}">💬 Messages${m.unread ? ` · ${m.unread}` : ""}</a>${m.email ? `<a class="btn btn-line btn-sm grow" href="mailto:${esc(m.email)}">✉️ E-mail</a>` : ""}</div>
    <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="mb-assign">📋 Assigner un programme</button><button class="btn btn-line btn-sm grow" data-a="mb-plan">🍽️ Envoyer un plan</button></div>
    <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="go" data-r="member-food" data-p="${esc(m.id)}">📊 Plan alimentaire (semaine ou jour)</button><button class="btn btn-red btn-sm grow" data-a="live-start" data-id="${esc(m.id)}">▶ Séance en direct</button></div>
    <div class="mt12">${chips(tabs, mbr.tab, "mb-tab")}</div>
    ${D ? `<p class="xs muted mt4">Données mises à jour ${ago(mbr.data.updated_at)}</p>` : ""}`;
  if (mbr.tab !== "profil") {
    const body = !D ? `<p class="empty small">${mbr.data.err ? esc(mbr.data.err) : "Pas encore de données : elles arrivent la prochaine fois que ce membre ouvre l'app (version à jour)."}</p>` : withState(D, () => mbr.tab === "jour" ? memberDay(D) : mbr.tab === "seances" ? memberSessions(D) : mbr.tab === "agenda" ? memberAgenda(D) : memberBody(D));
    $app.innerHTML = header(esc(m.name || "Membre"), esc(D?.plan ? `${(E.program(D.plan.programId)?.name || "").split("·")[0]} · semaine ${D.plan.week}` : m.email || ""), { back: "admin", actions: `<button class="pill" data-a="go" data-r="member-prog" data-p="${esc(m.id)}">📋 Programme</button>` }) + `<main class="page">${top}${body}</main>${adminTabbar("admin")}`;
    return;
  }
  const L = { goal: "Objectif", discipline: "Discipline", level: "Niveau", place: "Lieu", days: "Jours / semaine", sex: "Sexe", age: "Âge", height: "Taille", weight: "Poids", diet: "Alimentation", activity: "Activité", backPain: "Gêne lombaire", word: "Parole", news: "Accepte les e-mails" };
  $app.innerHTML = header(esc(m.name || "Membre"), esc(m.email || ""), { back: "admin" }) + `<main class="page">${top}
    <h2 class="sec">Formule</h2>
    <div class="card"><div class="row" style="gap:8px"><select id="tier" class="inp grow" style="text-align:left">${OFFERS.map(x => `<option value="${x.id}" ${x.id === m.tier ? "selected" : ""}>${esc(x.name)} · ${esc(x.price)}</option>`).join("")}</select><button class="btn btn-red btn-sm" style="width:auto" data-a="set-tier" data-id="${m.id}">Valider</button></div></div>
    ${ap ? `<h2 class="sec">Candidature <small>${new Date(ap.at).toLocaleDateString("fr-FR")}</small></h2><div class="card small"><b>${esc(offer(ap.offer).name)}</b><p class="mt8"><b>Objectif :</b> ${esc(ap.goal)}</p><p><b>Frein :</b> ${esc(ap.obstacle)}</p><p><b>Temps :</b> ${esc(ap.time)} · <b>Urgence :</b> ${esc(ap.urgency)}/10</p>${ap.phone ? `<p><b>Téléphone :</b> <a href="tel:${esc(ap.phone)}">${esc(ap.phone)}</a></p>` : ""}</div>` : ""}
    <h2 class="sec">Activité</h2>
    <div class="card"><div class="stat3"><div><b>${st.workouts ?? 0}</b><span>séances</span></div><div><b>${st.weight ? E.fmtKg(st.weight) : "–"}</b><span>kg</span></div><div><b>${st.week ?? "–"}</b><span>semaine</span></div></div></div>
    <p class="xs muted mt8">Inscrit le ${new Date(m.created_at).toLocaleDateString("fr-FR")} · dernière visite ${ago(m.last_seen)}${st.lastWorkout ? ` · dernière séance ${ago(st.lastWorkout)}` : ""}${st.program ? ` · programme ${esc(st.program)}` : ""}</p>
    <h2 class="sec">Réponses de l'onboarding</h2>
    <div class="list">${Object.entries(L).filter(([k]) => o[k] !== undefined && o[k] !== null && o[k] !== "").map(([k, l]) => `<div class="li"><span class="grow small muted">${l}</span><span class="small"><b>${esc(typeof o[k] === "boolean" ? (o[k] ? "oui" : "non") : o[k])}</b></span></div>`).join("")}
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

// ---------- Fiche membre : journée, séances, agenda, corps ----------
const mbr = { id: null, tab: "jour", day: null, data: null };
actions["mb-tab"] = (b, d) => { mbr.tab = d.v; rerender(false); };
actions["mb-day"] = (b, d) => { const n = addDays(mbr.day || today(), +d.v); mbr.day = n > today() ? null : n; rerender(); };
actions["mb-reload"] = () => { mbr.data = null; rerender(); };
const setsLine = (e) => e.sets.filter(s => s.done).map(s => `${s.type === "W" ? "é " : ""}${s.kg ? E.fmtKg(s.kg) + "×" : ""}${s.reps ?? "–"}${s.rpe != null ? "@" + String(s.rpe).replace(".", ",") : ""}${s.pain ? " ⚠️" : ""}`).join(" · ");
function workoutCard(w, open = false) {
  const mins = Math.round((new Date(w.end || Date.now()) - new Date(w.start)) / 6e4);
  return `<details class="card mt8" ${open ? "open" : ""}><summary style="list-style:none;cursor:pointer"><div class="row between"><b>${esc(w.title)}</b><span class="xs muted">${fmtDate(today(new Date(w.end || w.start)), { weekday: "short", day: "numeric", month: "short" })}</span></div>
    <div class="xs muted mt4">${w.end ? "" : "EN COURS · "}${mins} min${w.target ? ` / ${w.target} visées` : ""} · ${w.setsDone ?? w.exercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0)} séries${w.volume ? ` · ${fr(w.volume / 1000, 1)} t` : ""}${w.week ? ` · semaine ${w.week}` : ""}${w.records?.length ? ` · 🏆 ${w.records.length} record${w.records.length > 1 ? "s" : ""}` : ""}</div></summary>
    <div class="mt8">${w.exercises.map(e => `<div class="small" style="padding:6px 0;border-top:1px solid var(--line)"><b>${esc(e.name)}</b>${e.name !== e.orig ? ` <span class="xs muted">(remplace ${esc(e.orig)})</span>` : ""}<br><span class="xs">${esc(setsLine(e)) || "<span class='muted'>pas fait</span>"}</span>${e.sets.some(s => s.note) ? `<br><span class="xs muted">📝 ${esc(e.sets.filter(s => s.note).map(s => s.note).join(" · "))}</span>` : ""}${e.myNote ? `<br><span class="xs muted">📝 ${esc(e.myNote)}</span>` : ""}</div>`).join("")}</div></details>`;
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
      ${log.length ? N.MEALS.map(m => { const es = log.filter(e => e.meal === m); return es.length ? `<div class="mt12"><b class="small">${m}</b> <span class="xs muted">${es[0].time || ""} · ${fr(es.reduce((a, e) => a + e.kcal, 0))} kcal</span>${es.map(e => `<div class="row between xs" style="padding:2px 0"><span>${e.g ? fr(e.g) + " g " : ""}${esc(e.label)}</span><span class="muted">${e.kcal} kcal · ${fr(e.p)} g P</span></div>`).join("")}</div>` : ""; }).join("") : `<p class="small muted mt8" style="margin-bottom:0">Rien noté ce jour-là.</p>`}</div>
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
actions["mb-wk"] = (b, d) => { mbr.wk = (mbr.wk || 0) + +d.v; rerender(); };
function memberBody(D) {
  const ws = Object.entries(S().daily).filter(([, v]) => v.weight).sort().slice(-30);
  const ms = (S().measures || []).filter(m => Object.keys(m).some(k => k !== "d" && k !== "weight")).slice(-6).reverse();
  const L = { neck: "Cou", shoulders: "Épaules", chest: "Poitrine", waistNav: "Taille nombril", waistLow: "Taille basse", waistHigh: "Taille haute", hips: "Hanches", fat: "MG %" };
  return `<h2 class="sec">⚖️ Poids <small>${ws.length} pesées</small></h2>
    <div class="card">${ws.length ? `<div class="num" style="font-size:26px">${fr(ws.at(-1)[1].weight, 1)} kg</div><p class="xs muted" style="margin:4px 0 0">${ws.slice(-10).map(([k, v]) => `${k.slice(8)}/${k.slice(5, 7)} : ${fr(v.weight, 1)}`).join(" · ")}</p>` : `<p class="small muted" style="margin:0">Pas de pesée.</p>`}</div>
    <h2 class="sec">📏 Mensurations</h2>
    ${ms.length ? ms.map(m => `<div class="card mt8"><b class="small">${fmtDate(m.d, { day: "numeric", month: "long", year: "numeric" })}</b><p class="xs mt4" style="margin:0">${Object.entries(m).filter(([k]) => k !== "d" && k !== "weight").map(([k, v]) => `${L[k] || k.replace(/_l_/, " G ").replace(/_r_/, " D ").replace(/r$/, "rel.").replace(/ c$/, " contr.").replace("forearm", "Avant-bras").replace(/^arm/, "Bras").replace("thigh", "Cuisse").replace("calf", "Mollet")} ${fr(v, 1)}`).join(" · ")}</p></div>`).join("") : `<p class="small muted">Pas de mensurations.</p>`}
    <p class="xs muted mt12">Les photos restent sur le téléphone du membre : demande-lui de te les envoyer s'il le souhaite.</p>`;
}

const A_NOTE = () => "";

// ---------- Espace coach : programme et plan alimentaire envoyés à un client ----------
let asQ = "", plDraft = null;
actions["mb-assign"] = () => {
  const draw = () => {
    const q = N.norm(asQ), mine = E.programs().filter(p => p.custom || p.lib), bank = E.programs().filter(p => !p.custom && !p.lib && (!q || N.norm(p.name).includes(q))).slice(0, q ? 40 : 12);
    const li = (p) => `<button class="li" data-a="mb-assign-go" data-id="${esc(p.id)}"><span class="grow small"><b>${esc(p.name)}</b><br><span class="xs muted">${p.s?.length || "?"} séances / sem. · ${esc(p.lvl || "")}</span></span>${I.chev}</button>`;
    return `<h2 class="h2">📋 Assigner un programme</h2><p class="xs muted">Il arrive dans l'onglet Coaching de ton client, qui le suit en un geste. Une notification lui est envoyée.</p>
      ${mine.length ? `<div class="lbl mt12">Mes programmes</div><div class="list mt4">${mine.map(li).join("")}</div>` : ""}
      <div class="lbl mt12">Banque</div><div class="search mt4">${I.search}<input id="as-q" value="${esc(asQ)}" placeholder="Chercher : force, haut bas, 3 jours…" autocomplete="off"></div><div class="list mt4" id="as-l">${bank.map(li).join("")}</div>`;
  };
  sheet(draw(), (w) => { const i = w.querySelector("#as-q"); i?.addEventListener("input", () => { asQ = i.value; const h = document.createElement("div"); h.innerHTML = draw(); w.querySelector("#as-l").innerHTML = h.querySelector("#as-l").innerHTML; }); });
};
actions["mb-assign-go"] = async (b, d) => {
  const p = E.program(d.id), m = (window.__members || []).find(x => x.id === mbr.id); if (!p || !m) return;
  const { id, lib, name, ...data } = JSON.parse(JSON.stringify(p));
  const nm = String(name).split("·")[0].trim() + ` · ${m.name || "client"}`;
  try { const c = await cloud(); await c.libraryAdd("program", nm, { ...data, custom: true, for: m.id }); await c.notify("📋 Ton nouveau programme", `Thomas t'a préparé « ${String(name).split("·")[0].trim()} ». Ouvre l'onglet Coaching pour le suivre.`, m.id).catch(() => { }); closeSheet(); toast("Programme envoyé"); }
  catch (e) { toast("Envoi impossible : " + (e.message || "serveur indisponible")); }
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
