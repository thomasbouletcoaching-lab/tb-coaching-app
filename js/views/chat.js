// Messagerie façon WhatsApp : conversation coach ↔ client et groupes.
// En direct (sans recharger), « en train d'écrire », coches envoyé / lu, séparateurs de jour, réponses citées, réactions,
// modifier (15 min) / supprimer, épingler, vocaux (maintenir, glisser pour annuler, réécouter avant d'envoyer, vitesse),
// photos et vidéos, cartes partagées (séance, repas, exercice, recette, analyse vidéo), boutons de réponse rapide,
// brouillon gardé, envoi hors ligne, bandeau de contexte client et notes privées (coach), messages programmés.
import { S, today } from "../store.js";
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import * as RC from "../recipes.js";
import { $app, esc, fr, toast, routes, R, actions, forms, go, I, sheet, closeSheet, badges, buzz, isCoach, cloud, fmtDate, addDays, onLeave, canMsg, msgQuotaText } from "../core.js";
import { refreshMe } from "../sync.js";
import { absenceBanner } from "./reseau.js";
import { QUIZ_TOKEN } from "./quizexos.js";
import { readyList } from "./coach.js";
import { A, saveStore, adminLoad, nomMembre, rappelFait, hueOf, groupesCoach, rechargerGroupes } from "./admin.js";
import { ficheSheet } from "./train.js";

const REACTS = ["👍", "❤️", "🔥", "💪", "😂", "🙏"];
const EDIT_MIN = 15;
// Conversation ouverte
const CH = { kind: "dm", id: null, me: null, msgs: [], noms: {}, live: null, unLive: null, reply: null, edit: null, below: 0, typingT: null, poll: null, rec: null, preview: null };
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hm = (iso) => new Date(iso).toTimeString().slice(0, 5);
const jour = (k) => k === today() ? "Aujourd'hui" : k === addDays(today(), -1) ? "Hier" : k > addDays(today(), -7) ? fmtDate(k, { weekday: "long" }) : fmtDate(k, { weekday: "short", day: "numeric", month: "short", year: k.slice(0, 4) === today().slice(0, 4) ? undefined : "numeric" });
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
// Liens, e-mails et numéros cliquables (sur du texte déjà échappé)
function linkify(t) {
  return t.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]+)/g, '$1<a href="mailto:$2">$2</a>')
    .replace(/(^|[\s(])((?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4})/g, (m, a, n) => `${a}<a href="tel:${n.replace(/[\s.-]/g, "")}">${n}</a>`);
}
const nomDe = (uid) => uid === CH.me ? "Toi" : CH.kind === "g" ? (CH.noms[uid] || "Membre") : isCoach() ? (CH.nom || "Client") : "Thomas";
const draftKey = () => `cxs.draft.${CH.kind}.${CH.id}`;
const outbox = () => { try { return JSON.parse(localStorage.getItem("cxs.outbox") || "[]"); } catch { return []; } };
const setOutbox = (l) => { try { localStorage.setItem("cxs.outbox", JSON.stringify(l)); } catch { } };

// ---------- Affichage d'un message ----------
function refCard(x) {
  let r = null; try { r = x.ref ? JSON.parse(x.ref) : null; } catch { r = null; } if (!r || !r.t) return "";
  const IC = { seance: "🏋️", repas: "🍽️", exo: "💪", mesure: "⚖️", video: "🎥", recette: "🥗", plan: "📋" };
  const lignes = (r.l || []).slice(0, 6).map(l => `<span class="xs" style="display:block">${esc(l)}</span>`).join("");
  return `<button class="mref" data-a="ref-open" data-id="${x.id}"><span class="em">${IC[r.t] || "📎"}</span><span class="grow" style="min-width:0;text-align:left"><b class="small">${esc(r.titre || "")}</b>${r.sous ? `<span class="xs" style="display:block;opacity:.8">${esc(r.sous)}</span>` : ""}${lignes}</span></button>`;
}
function bulle(x, prev, next) {
  const mine = x.sender === CH.me, del = !!x.deleted_at;
  const suite = prev && prev.sender === x.sender && dayKey(prev.created_at) === dayKey(x.created_at) && new Date(x.created_at) - new Date(prev.created_at) < 5 * 6e4;
  const r = x.reply_to ? CH.msgs.find(m => m.id === x.reply_to) : null;
  const citation = r ? `<button class="mquote" data-a="msg-goto" data-id="${r.id}"><b>${esc(nomDe(r.sender))}</b><span>${esc(r.deleted_at ? "Message supprimé" : r.audio_path ? "🎤 Message vocal" : (r.media?.[0] ? (String(r.media[0].type).startsWith("video") ? "🎥 Vidéo" : "📷 Photo") + " " : "") + (r.body || "").replace(QUIZ_TOKEN, "").slice(0, 90))}</span></button>` : "";
  let contenu = "";
  if (del) contenu = `<i class="mdel">🚫 ${mine ? "Tu as supprimé ce message" : "Ce message a été supprimé"}</i>`;
  else {
    const pj = (Array.isArray(x.media) ? x.media : []).filter(m => m && typeof m.path === "string").map(m => {
      const t = String(m.type || ""), p = esc(m.path);
      if (t.startsWith("image")) return `<img class="mimg" data-mp="${p}" data-a="msg-photo" alt="Photo" loading="lazy">`;
      if (t.startsWith("video")) return `<video class="mimg" controls playsinline preload="metadata" data-mp="${p}"></video>${isCoach() ? `<button class="link xs" data-a="vd-from" style="margin:2px 0 6px;color:inherit">🔬 Analyser la vidéo</button>` : ""}`;
      return `<audio controls preload="none" data-mp="${p}"></audio>`;
    }).join("");
    const audio = x.audio_path ? `<div class="maud"><audio controls preload="metadata" data-ap="${esc(x.audio_path)}"></audio><button class="mspd" data-a="msg-speed">1×</button></div>${x.meta?.tr ? `<details class="mtr"><summary>📝 Transcription</summary>${esc(x.meta.tr)}</details>` : ""}` : "";
    const quiz = (x.body || "").includes(QUIZ_TOKEN), body = (x.body || "").replace(QUIZ_TOKEN, "").trim();
    const texte = x.audio_path && /^🎙️ Message vocal$/.test(body) ? "" : body;
    const btns = Array.isArray(x.buttons) && x.buttons.length ? (() => { const rep = CH.msgs.find(m => m.reply_to === x.id && m.sender !== x.sender && x.buttons.includes((m.body || "").trim()));
      return `<div class="mbtns">${x.buttons.map(b => `<button class="${rep && rep.body.trim() === b ? "on" : ""}" ${mine || rep ? "disabled" : `data-a="msg-btn" data-id="${x.id}" data-v="${esc(b)}"`}>${esc(b)}</button>`).join("")}</div>`; })() : "";
    contenu = pj + audio + refCard(x) + (texte ? `<span class="mtxt">${linkify(esc(texte))}</span>` : "") + btns
      + (quiz ? (isCoach() ? `<div class="xs mt4" style="opacity:.8">📋 Quiz envoyé : ses réponses arrivent dans la conversation.</div>` : `<button class="btn btn-red btn-sm mt8" data-a="go" data-r="quiz-exos" style="width:100%">📋 Faire le quiz</button>`) : "");
  }
  const lu = mine && !del && CH.kind === "dm" ? (x._out ? `<span class="tk">🕒</span>` : `<span class="tk ${x.read_at ? "lu" : ""}">${x.read_at ? "✓✓" : "✓"}</span>`) : "";
  const pied = `<time>${x.meta?.auto && isCoach() ? "🤖 auto · " : ""}${x.meta?.programme && isCoach() ? "🕒 · " : ""}${x.edited_at && !del ? "modifié · " : ""}${hm(x.created_at)} ${lu}</time>`;
  const rs = Object.values(x.reactions || {}), g = rs.reduce((o, e) => (o[e] = (o[e] || 0) + 1, o), {});
  const auteur = CH.kind === "g" && !mine && !suite ? `<b class="mauth" style="color:hsl(${hueOf(x.sender)} 60% 55%)">${esc(nomDe(x.sender))}</b>` : "";
  return `<div class="mwrap ${mine ? "me" : "them"} ${suite ? "suite" : ""}" data-mid="${x.id}"><span class="mswipe">↩︎</span><div class="msg ${mine ? "me" : "them"} ${x.pinned_at ? "pin" : ""}" data-id="${x.id}">${auteur}${citation}${contenu}${pied}</div>
    ${rs.length ? `<div class="reacts ${mine ? "me" : "them"}" data-a="msg-menu" data-id="${x.id}">${Object.entries(g).map(([e, n]) => `<span>${e}${n > 1 ? " " + n : ""}</span>`).join("")}</div>` : ""}</div>`;
}
function fil() {
  const l = [...CH.msgs, ...outbox().filter(o => o.kind === CH.kind && o.to === CH.id).map(o => ({ ...o.row, id: o.tmp, _out: true }))];
  let out = "", dk = null;
  l.forEach((x, i) => { const k = dayKey(x.created_at); if (k !== dk) { out += `<div class="mday"><span>${jour(k)}</span></div>`; dk = k; } out += bulle(x, l[i - 1], l[i + 1]); });
  return out || `<div class="mempty">${CH.kind === "g" ? "👋 Dis bonjour au groupe !" : isCoach() ? "Pas encore de message. Lance la conversation 👇" : `Salut ${esc((S().profile?.name || "").split(" ")[0])} ! Je suis Thomas. Pose-moi ta question sur ton entraînement, ta nutrition ou ce que tu veux : je te réponds moi-même.`}</div>`;
}
const enBas = () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 140;
function dessiner(scroll = "auto") {
  const box = document.getElementById("thread"); if (!box) return;
  const bas = enBas(); box.innerHTML = fil(); hydrater(); epingles();
  if (scroll === "bottom" || (scroll === "auto" && bas)) { window.scrollTo(0, document.body.scrollHeight); CH.below = 0; }
  majDown();
}
function majDown() { const b = document.getElementById("mdown"); if (!b) return; b.hidden = enBas(); b.innerHTML = `↓${CH.below ? `<i>${CH.below}</i>` : ""}`; }
function epingles() {
  const box = document.getElementById("mpins"); if (!box) return; const p = CH.msgs.filter(m => m.pinned_at && !m.deleted_at);
  box.innerHTML = p.length ? `<button class="mpinbar" data-a="msg-goto" data-id="${p.at(-1).id}"><span>📌</span><span class="grow">${esc(apercuCourt(p.at(-1)))}</span>${p.length > 1 ? `<span class="xs muted">+${p.length - 1}</span>` : ""}</button>` : "";
}
const apercuCourt = (x) => x.audio_path ? "🎤 Message vocal" : x.media?.[0] ? "📷 Pièce jointe " + (x.body || "") : (() => { try { const r = x.ref && JSON.parse(x.ref); if (r?.titre) return r.titre; } catch { } return (x.body || "").replace(QUIZ_TOKEN, "").slice(0, 120); })();
// Adresses signées des fichiers, demandées à l'affichage
async function hydrater() {
  const c = await cloud(); if (!c) return;
  document.querySelectorAll("#thread [data-mp]:not([src]),#thread audio[data-ap]:not([src])").forEach(async el => {
    try { el.src = await c.audioUrl(el.dataset.mp || el.dataset.ap); }
    catch { el.outerHTML = `<span class="xs" style="opacity:.7">Pièce jointe indisponible</span>`; }
  });
}

// ---------- Contexte client (coach) ----------
function contexte(id) {
  const s = A.sums?.[id] || {}, m = (A.members || []).find(x => x.id === id) || {};
  const lw = s.lastWorkout, jours = lw?.end ? Math.floor((Date.now() - new Date(lw.end)) / 864e5) : null;
  const kT = s.nut?.kT, pT = s.nut?.pT, auj = s.today === today();
  const al = [...(s.alerts || [])]; if (jours != null && jours >= 4) al.unshift(`Pas de séance depuis ${jours} j`); if (auj && !s.meals && new Date().getHours() >= 14) al.push("Aucun repas noté aujourd'hui");
  if (s.lastCheckin && s.lastCheckin < addDays(today(), -9)) al.push("Bilan en retard");
  const note = A.store?.notes?.[id];
  return `<details class="mctx"><summary><span class="grow">${s.program ? `📋 ${esc(s.program)}${s.week ? ` · S${s.week}` : ""}` : "📋 Contexte client"}${lw ? ` · <span class="muted" style="font-weight:500">séance ${jours === 0 ? "aujourd'hui" : jours === 1 ? "hier" : `il y a ${jours} j`}</span>` : ""}</span>${al.length ? `<span class="tag r">⚠️ ${al.length}</span>` : ""}<span class="muted">▾</span></summary>
    <div class="mctx-g">
      <div><span class="xs muted">Dernière séance</span><b class="small">${lw ? `${esc(lw.title || "Séance")} · ${jours === 0 ? "aujourd'hui" : jours === 1 ? "hier" : `il y a ${jours} j`}` : "aucune"}</b></div>
      <div><span class="xs muted">Aujourd'hui</span><b class="small">${auj ? `${fr(s.kcal || 0)}${kT ? `/${fr(kT)}` : ""} kcal · P ${fr(s.prot || 0)}${pT ? `/${pT}` : ""} g` : "rien de noté"}</b></div>
      <div><span class="xs muted">Poids</span><b class="small">${s.weight ? `${fr(s.weight, 1)} kg` : "–"}</b></div>
      <div><span class="xs muted">Dernier bilan</span><b class="small">${s.lastCheckin ? fmtDate(s.lastCheckin, { day: "numeric", month: "short" }) : "aucun"}</b></div>
    </div>
    ${al.length ? `<div class="mt4">${al.map(a => `<span class="tag r" style="margin:2px">${esc(a)}</span>`).join("")}</div>` : ""}
    ${note ? `<div class="mnote mt8"><b class="xs">📝 Ta note privée</b><div class="small">${esc(note)}</div></div>` : ""}
    <div class="row mt8" style="gap:6px;flex-wrap:wrap"><button class="chip sm" data-a="go" data-r="member" data-p="${id}">👤 Fiche</button><button class="chip sm" data-a="msg-note" data-id="${id}">📝 Note privée</button><button class="chip sm" data-a="msg-rappel" data-id="${id}">⏰ Me le rappeler</button><button class="chip sm" data-a="msg-sched" data-id="${id}">🕒 Programmés</button></div></details>`;
}
actions["msg-note"] = (b, d) => sheet(`<h2 class="h2">📝 Note privée</h2><p class="xs muted">Visible par toi seul, jamais par le client.</p><form data-f="msg-note" data-id="${d.id}" class="mt8"><textarea class="inp" name="n" rows="6">${esc(A.store?.notes?.[d.id] || "")}</textarea><button class="btn btn-red mt8">Enregistrer</button></form>`);
forms["msg-note"] = async (v, f) => { A.store.notes = A.store.notes || {}; A.store.notes[f.dataset.id] = v.n.trim(); await saveStore("notes"); closeSheet(); toast("Note enregistrée"); const c = document.getElementById("mctx"); if (c) c.innerHTML = contexte(f.dataset.id); };

// ---------- Ouverture d'une conversation ----------
async function ouvrir(kind, id) {
  arreter();
  Object.assign(CH, { kind, id, msgs: [], noms: {}, reply: null, edit: null, below: 0, preview: null });
  const c = await cloud(); if (!c) { toast("Pas de connexion"); return; }
  await c.ensureSession(); CH.me = c.userId();
  const coach = isCoach(), dm = kind === "dm";
  let titre = "Thomas", sous = "Répond en général sous 24 h", av = `<span class="mav sm" style="background:var(--gradbtn)">T</span>`;
  if (dm && coach) { if (!A.members) await adminLoad().catch(() => { }); const m = (A.members || []).find(x => x.id === id) || (window.__members || []).find(x => x.id === id) || {}; CH.nom = nomMembre(m).split(" ")[0]; titre = esc(CH.nom); sous = ""; av = `<span class="mav sm" style="background:hsl(${hueOf(id)} 55% 45%)">${esc(titre[0] || "?")}</span>`; }
  let g = null;
  if (!dm) { const gs = coach ? (groupesCoach().length ? groupesCoach() : await rechargerGroupes()) : await c.groups().catch(() => []); g = (gs || []).find(x => x.id === +id); titre = esc(g ? `${g.emoji || "👥"} ${g.name}` : "Groupe"); sous = g ? `${g.members.length} membre${g.members.length > 1 ? "s" : ""}${g.coach_only ? " · seul Thomas écrit" : ""}` : ""; av = ""; CH.gco = !!g?.coach_only; }
  const peutEcrire = dm || coach || !CH.gco;
  const retour = dm ? (coach ? "admin-msg" : "coach") : (coach ? "admin-msg" : "chat");
  const autres = !coach && dm ? await c.groups().catch(() => []) : [];
  // En-tête de conversation compact (comme WhatsApp) : retour, avatar, nom, statut, menu
  const tete = `<header class="top mtop"><div class="row1"><button class="icon-btn" ${coach ? `data-a="hist-back"` : `data-a="go" data-r="${retour}"`} aria-label="Retour">${I.back}</button>
    <button class="mhd2 grow" ${coach && dm ? `data-a="go" data-r="member" data-p="${id}"` : ""}>${av}<span class="mhd"><b>${titre}</b><small id="msub">${esc(sous)}</small></span></button>
    <button class="pill ic" data-a="msg-plus-menu" aria-label="Plus d'options">⋯</button></div></header>`;
  $app.innerHTML = tete
    + `<main class="page mchat">${!coach && dm ? absenceBanner() : ""}${autres.length ? `<div class="chips-scroll mt8"><button class="chip on">💬 Thomas</button>${autres.map(x => `<button class="chip" data-a="go" data-r="groupe" data-p="${x.id}">${esc(x.emoji || "👥")} ${esc(x.name)}${x.unread ? ` <b>${x.unread}</b>` : ""}</button>`).join("")}</div>` : ""}
      ${coach && dm ? `<div id="mctx">${contexte(id)}</div>` : ""}<div id="mpins"></div>
      <div class="thread" id="thread"><p class="empty small">Chargement…</p></div><div id="mtyping" class="mtyping" hidden><span></span><span></span><span></span></div>
      ${!coach && dm ? `<p class="xs muted center mt8">${msgQuotaText()}</p>` : ""}</main>
      <button id="mdown" class="mdown" data-a="msg-down" hidden>↓</button>
      ${peutEcrire ? composer() : `<div class="composer"><p class="small muted center grow" style="margin:10px 0">Seul Thomas écrit dans ce groupe</p></div>`}`;
  const ta = document.querySelector("#mcomp textarea");
  if (ta) {
    ta.value = window.__prefill || localStorage.getItem(draftKey()) || ""; window.__prefill = ""; auto(ta); majSend();
    ta.addEventListener("input", () => { auto(ta); majSend(); try { ta.value ? localStorage.setItem(draftKey(), ta.value) : localStorage.removeItem(draftKey()); } catch { } CH.live?.typing?.(); slash(ta); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  await charger(true);
  // En direct
  try {
    if (dm) CH.live = c.liveThread(id, (p) => recu(p), () => tape());
    else CH.unLive = c.liveGroup(+id, (p) => recu(p));
  } catch { }
  CH.poll = setInterval(() => charger(false), 30000); // filet de sécurité si le direct est coupé
  window.addEventListener("online", vider); vider();
  document.addEventListener("visibilitychange", vis);
  onLeave(arreter);
}
function arreter() {
  try { CH.live?.stop(); } catch { } try { CH.unLive?.(); } catch { } CH.live = null; CH.unLive = null;
  clearInterval(CH.poll); CH.poll = null; window.removeEventListener("scroll", onScroll); window.removeEventListener("online", vider); document.removeEventListener("visibilitychange", vis);
  if (CH.rec) { try { CH.rec.cancel(); } catch { } }
}
const vis = () => { if (document.visibilityState === "visible") { charger(false); lu(); } };
function onScroll() { if (enBas()) CH.below = 0; majDown(); }
async function charger(first) {
  const c = await cloud(); if (!c) return;
  try {
    let l;
    if (CH.kind === "dm") l = await c.thread(CH.id || CH.me);
    else { const r = await c.groupThread(+CH.id); l = r.msgs; CH.noms = r.noms; }
    const chg = JSON.stringify(l) !== JSON.stringify(CH.msgs); CH.msgs = l;
    if (chg || first) dessiner(first ? "bottom" : "auto");
    lu();
  } catch (e) { const box = document.getElementById("thread"); if (box && first) box.innerHTML = `<p class="empty small">Messagerie indisponible pour le moment. Vérifie ta connexion et réessaie.</p>`; }
}
async function lu() {
  if (document.visibilityState !== "visible") return; const c = await cloud(); if (!c) return;
  try {
    if (CH.kind === "dm") { if (CH.msgs.some(m => m.sender !== CH.me && !m.read_at)) { await c.markRead(CH.id); CH.msgs.forEach(m => { if (m.sender !== CH.me && !m.read_at) m.read_at = new Date().toISOString(); }); }
      if (isCoach()) { const th = A.threads?.[CH.id]; if (th) th.unread = 0; } else badges.msgs = 0; }
    else await c.groupRead(+CH.id);
  } catch { }
}
function recu(p) {
  const n = p.new, o = p.old; if (!n && !o) return;
  const i = CH.msgs.findIndex(m => m.id === (n?.id ?? o?.id));
  if (p.eventType === "DELETE") { if (i >= 0) CH.msgs.splice(i, 1); }
  else if (i >= 0) CH.msgs[i] = { ...CH.msgs[i], ...n };
  else { CH.msgs.push(n); if (n.sender !== CH.me) { if (!enBas()) CH.below++; masquerTape(); try { navigator.vibrate?.(8); } catch { } } }
  dessiner(n?.sender === CH.me ? "bottom" : "auto");
  if (n && n.sender !== CH.me) lu();
}
function tape() {
  const t = document.getElementById("mtyping"), s = document.getElementById("msub"); if (!t) return;
  t.hidden = false; if (s) { s.dataset.o = s.dataset.o ?? s.textContent; s.textContent = "écrit…"; }
  clearTimeout(CH.typingT); CH.typingT = setTimeout(masquerTape, 4000);
}
function masquerTape() { const t = document.getElementById("mtyping"), s = document.getElementById("msub"); if (t) t.hidden = true; if (s && s.dataset.o != null) { s.textContent = s.dataset.o; delete s.dataset.o; } }

routes.chat = async () => {
  if (!isCoach() && !canMsg()) { toast("Les messages avec Thomas sont réservés aux personnes coachées"); return go("offers"); }
  await ouvrir("dm", isCoach() ? R.param : null);
};
routes.groupe = async () => { if (!R.param) return go(isCoach() ? "admin-msg" : "chat"); await ouvrir("g", R.param); };

// ---------- Saisie ----------
function composer() {
  return `<form class="composer mcomp" id="mcomp" data-f="send">
    <div id="mbar" class="mbar" hidden></div><div id="mslash" class="mslash" hidden></div>
    <div class="row" style="gap:8px;align-items:flex-end;width:100%">
      <button type="button" class="mplus" data-a="msg-plus" aria-label="Joindre">＋</button>
      <div id="mrecbox" class="mrecbox grow" hidden></div>
      <textarea name="v" rows="1" placeholder="Message" maxlength="4000" aria-label="Message"></textarea>
      <button type="button" class="send" id="rec-btn" aria-label="Maintenir pour enregistrer un vocal">🎙️</button>
      <button class="send" id="send-btn" aria-label="Envoyer" hidden>${I.send}</button></div>
    <input type="file" id="mfile" accept="image/*,video/*" multiple hidden></form>`;
}
const auto = (ta) => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; };
function majSend() { const ta = document.querySelector("#mcomp textarea"), v = !!ta?.value.trim() || !!CH.edit; const s = document.getElementById("send-btn"), r = document.getElementById("rec-btn"); if (s) s.hidden = !v; if (r) r.hidden = v; }
function barre() {
  const b = document.getElementById("mbar"); if (!b) return;
  const x = CH.edit || CH.reply; if (!x) { b.hidden = true; b.innerHTML = ""; return; }
  b.hidden = false; b.innerHTML = `<span class="em">${CH.edit ? "✏️" : "↩︎"}</span><span class="grow" style="min-width:0"><b class="xs">${CH.edit ? "Modifier le message" : "Répondre à " + esc(nomDe(x.sender))}</b><span class="xs muted mquote-t">${esc(apercuCourt(x))}</span></span><button type="button" class="icon-btn sm" data-a="msg-bar-x">✕</button>`;
}
actions["msg-bar-x"] = () => { if (CH.edit) { const ta = document.querySelector("#mcomp textarea"); if (ta) ta.value = ""; } CH.reply = null; CH.edit = null; barre(); majSend(); };
// « / » : réponses enregistrées (coach), prénom rempli tout seul
function slash(ta) {
  const box = document.getElementById("mslash"); if (!box) return; const v = ta.value;
  if (!isCoach() || !/^\/\S*$/.test(v)) { box.hidden = true; return; }
  const q = v.slice(1).toLowerCase(), l = readyList().filter(r => !q || r.label.toLowerCase().includes(q) || r.body.toLowerCase().includes(q)).slice(0, 8);
  box.hidden = !l.length; box.innerHTML = l.map(r => `<button type="button" data-a="slash-use" data-v="${esc(r.id)}"><b class="small">${esc(r.label)}</b><span class="xs muted">${esc(r.body.slice(0, 80))}</span></button>`).join("") + `<button type="button" data-a="ready-manage"><span class="xs muted">⚙️ Gérer les réponses enregistrées</span></button>`;
}
const perso = (t) => t.replace(/\{prenom\}/g, CH.nom || "");
actions["slash-use"] = (b, d) => { const r = readyList().find(x => x.id === d.v), ta = document.querySelector("#mcomp textarea"); if (!r || !ta) return; ta.value = perso(r.body); auto(ta); majSend(); document.getElementById("mslash").hidden = true; ta.focus(); };
actions["ready-use"] = actions["slash-use"];

forms.send = async (v, form) => {
  const ta = form.querySelector("textarea"), body = (ta?.value || "").trim();
  if (CH.edit) { const x = CH.edit; if (!body) return; try { await (await cloud()).editMsg(x.id, body); x.body = body; x.edited_at = new Date().toISOString(); CH.edit = null; ta.value = ""; barre(); majSend(); dessiner(); } catch (e) { toast(e.message); } return; }
  if (!body) return;
  ta.value = ""; auto(ta); majSend(); try { localStorage.removeItem(draftKey()); } catch { }
  const replyTo = CH.reply?.id && typeof CH.reply.id === "number" ? CH.reply.id : null; CH.reply = null; barre();
  await envoyer({ body, replyTo });
};
// Envoi commun (texte, vocal, médias, carte, boutons) avec file d'attente hors ligne
async function envoyer({ body = "", audio = null, media = null, meta = null, ref = null, buttons = null, replyTo = null }) {
  const c = await cloud(); if (!c) return toast("Pas de connexion.");
  const tmp = "tmp" + Date.now(), row = { sender: CH.me, body, audio_path: audio, media: media || [], meta: meta || {}, ref: ref ? JSON.stringify(ref) : null, buttons, reply_to: replyTo, created_at: new Date().toISOString(), reactions: {} };
  if (!navigator.onLine) { setOutbox([...outbox(), { tmp, kind: CH.kind, to: CH.id, row }]); dessiner("bottom"); return toast("🕒 Hors ligne : il partira dès que le réseau revient"); }
  try {
    await c.ensureSession();
    const x = CH.kind === "dm" ? await c.send(body, CH.id || CH.me, audio, { media, meta, ref, buttons, replyTo }) : await c.groupSend(+CH.id, body, audio, { media, meta, replyTo });
    if (x && !CH.msgs.some(m => m.id === x.id)) CH.msgs.push(x);
    buzz(); dessiner("bottom");
    if (isCoach() && CH.kind === "dm") { rappelFait(CH.id).catch(() => { }); const th = A.threads?.[CH.id]; if (th) th.last = { ...x, sender: "coach" }; }
    if (!isCoach()) refreshMe();
  } catch (e) {
    const reseau = /fetch|network|Load failed/i.test(e?.message || "");
    if (reseau) { setOutbox([...outbox(), { tmp, kind: CH.kind, to: CH.id, row }]); dessiner("bottom"); return toast("🕒 Envoi en attente du réseau"); }
    const quota = /row-level|policy/i.test(e?.message || "");
    toast(quota ? (CH.kind === "g" ? "Seul Thomas peut écrire dans ce groupe" : "Tu as utilisé tes messages de la semaine. Une formule supérieure t'en donne plus.") : "Envoi impossible : " + (e?.message || e));
    if (quota && CH.kind === "dm") setTimeout(() => go("offers"), 1800);
  }
}
async function vider() {
  const l = outbox(); if (!l.length || !navigator.onLine) return; const c = await cloud(); if (!c) return;
  const reste = [];
  for (const o of l) { try { await c.ensureSession(); const r = o.row; if (o.kind === "dm") await c.send(r.body, o.to || c.userId(), r.audio_path, { media: r.media, meta: r.meta, ref: r.ref, buttons: r.buttons, replyTo: r.reply_to }); else await c.groupSend(+o.to, r.body, r.audio_path, { media: r.media, meta: r.meta, replyTo: r.reply_to }); } catch { reste.push(o); } }
  setOutbox(reste); if (reste.length < l.length) { toast("Messages en attente envoyés ✓"); charger(false); }
}

// ---------- Gestes sur les bulles : glisser à droite = répondre, appui long = menu ----------
let bg = null, blp = null;
document.addEventListener("touchstart", (e) => {
  const w = e.target.closest?.("#thread .mwrap"); if (!w || e.target.closest("audio,video,a,button:not(.msg)")) return;
  const t = e.touches[0]; bg = { w, b: w.querySelector(".msg"), x: t.clientX, y: t.clientY, on: false, dx: 0 };
  clearTimeout(blp); blp = setTimeout(() => { if (bg && !bg.on && Math.abs(bg.dx) < 8) { const id = bg.b.dataset.id; bg = null; try { navigator.vibrate?.(15); } catch { } menuMsg(id); } }, 480);
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!bg) return; const t = e.touches[0], dx = t.clientX - bg.x, dy = t.clientY - bg.y; bg.dx = dx;
  if (Math.abs(dy) > 10 && !bg.on) { clearTimeout(blp); bg = null; return; }
  if (!bg.on && dx > 12 && dx > Math.abs(dy) * 1.4) { bg.on = true; clearTimeout(blp); }
  if (!bg.on) return; const x = Math.max(0, Math.min(80, dx)); bg.b.style.transition = "none"; bg.b.style.transform = `translateX(${x}px)`; bg.w.classList.toggle("rep", x > 55);
}, { passive: true });
document.addEventListener("touchend", () => {
  clearTimeout(blp); if (!bg) return; const g = bg; bg = null; if (!g.on) return;
  g.b.style.transition = ""; g.b.style.transform = ""; g.w.classList.remove("rep");
  if (g.dx > 55) { const x = trouve(g.b.dataset.id); if (x && !x.deleted_at && !x._out) { try { navigator.vibrate?.(10); } catch { } CH.reply = x; CH.edit = null; barre(); document.querySelector("#mcomp textarea")?.focus(); } }
}, { passive: true });
document.addEventListener("contextmenu", (e) => { const b = e.target.closest?.("#thread .msg"); if (b) { e.preventDefault(); menuMsg(b.dataset.id); } });
const trouve = (id) => CH.msgs.find(m => String(m.id) === String(id));
function menuMsg(id) {
  const x = trouve(id); if (!x || x._out) return; const mine = x.sender === CH.me, del = !!x.deleted_at;
  const modif = mine && !del && !x.audio_path && CH.kind === "dm" && Date.now() - new Date(x.created_at) < EDIT_MIN * 6e4 && !x.media?.length;
  sheet(`${del ? "" : `<div class="reactbar">${REACTS.map(e => `<button data-a="react" data-id="${x.id}" data-v="${e}" class="${x.reactions?.[CH.me] === e ? "on" : ""}">${e}</button>`).join("")}</div>`}
    <div class="list mt8">${del ? "" : `<button class="li" data-a="msg-reply" data-id="${x.id}"><span class="em">↩︎</span><span class="grow">Répondre</span></button>`}
    ${!del && x.body ? `<button class="li" data-a="msg-copy" data-id="${x.id}"><span class="em">📋</span><span class="grow">Copier</span></button>` : ""}
    ${modif ? `<button class="li" data-a="msg-edit" data-id="${x.id}"><span class="em">✏️</span><span class="grow">Modifier<br><span class="xs muted">encore ${Math.max(1, EDIT_MIN - Math.floor((Date.now() - new Date(x.created_at)) / 6e4))} min</span></span></button>` : ""}
    ${!del && CH.kind === "dm" ? `<button class="li" data-a="msg-pinm" data-id="${x.id}"><span class="em">📌</span><span class="grow">${x.pinned_at ? "Détacher" : "Épingler en haut de la conversation"}</span></button>` : ""}
    ${!del && (mine || isCoach()) ? `<button class="li" data-a="msg-del" data-id="${x.id}"><span class="em">🗑️</span><span class="grow" style="color:#C8323F">Supprimer pour tous</span></button>` : ""}</div>
    <p class="xs muted center mt8">${fmtDate(dayKey(x.created_at), { weekday: "long", day: "numeric", month: "long" })} à ${hm(x.created_at)}${x.read_at && mine ? ` · lu à ${hm(x.read_at)}` : ""}</p>`);
}
actions["msg-menu"] = (b, d) => menuMsg(d.id);
actions.react = async (b, d) => {
  const x = trouve(d.id); closeSheet(); if (!x) return;
  try { const c = await cloud(); x.reactions = CH.kind === "dm" ? await c.react(x.id, d.v, x.reactions) : await c.groupReact(x.id, d.v, x.reactions); buzz(); dessiner(); }
  catch { toast("Réaction impossible, réessaie."); }
};
actions["msg-reply"] = (b, d) => { closeSheet(); CH.reply = trouve(d.id); CH.edit = null; barre(); document.querySelector("#mcomp textarea")?.focus(); };
actions["msg-copy"] = (b, d) => { const x = trouve(d.id); navigator.clipboard?.writeText((x?.body || "").replace(QUIZ_TOKEN, "").trim()); closeSheet(); toast("Copié"); };
actions["msg-edit"] = (b, d) => { closeSheet(); const x = trouve(d.id), ta = document.querySelector("#mcomp textarea"); if (!x || !ta) return; CH.edit = x; CH.reply = null; ta.value = x.body; auto(ta); barre(); majSend(); ta.focus(); };
actions["msg-del"] = async (b, d) => {
  closeSheet(); if (!confirm("Supprimer ce message pour tout le monde ?")) return; const x = trouve(d.id);
  try { const c = await cloud(); CH.kind === "dm" ? await c.deleteMsg(x.id) : await c.groupMsgDelete(x.id); Object.assign(x, { deleted_at: new Date().toISOString(), body: "", media: [], audio_path: null, reactions: {}, pinned_at: null }); dessiner(); } catch (e) { toast(e.message); }
};
actions["msg-pinm"] = async (b, d) => { closeSheet(); const x = trouve(d.id); try { await (await cloud()).pinMsg(x.id, !x.pinned_at); x.pinned_at = x.pinned_at ? null : new Date().toISOString(); dessiner(); toast(x.pinned_at ? "📌 Épinglé" : "Détaché"); } catch (e) { toast(e.message); } };
actions["msg-goto"] = (b, d) => { const el = document.querySelector(`.mwrap[data-mid="${d.id}"]`); if (!el) return toast("Message trop ancien"); el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400); };
actions["msg-down"] = () => { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); CH.below = 0; majDown(); };
actions["msg-speed"] = (b) => { const a = b.previousElementSibling; if (!a) return; const v = { 1: 1.5, 1.5: 2, 2: 1 }[a.playbackRate] || 1; a.playbackRate = v; b.textContent = `${String(v).replace(".", ",")}×`; };
actions["msg-btn"] = async (b, d) => { const x = trouve(d.id); if (!x) return; await envoyer({ body: d.v, replyTo: x.id }); };
// Photo en plein écran (double-tap pour zoomer, glisser pour se déplacer)
actions["msg-photo"] = (b) => {
  const v = document.createElement("div"); v.className = "mview"; v.innerHTML = `<button class="mview-x" aria-label="Fermer">✕</button><div class="mview-s"><img src="${b.src}" alt="Photo"></div>`;
  document.body.appendChild(v); const img = v.querySelector("img"), sc = v.querySelector(".mview-s"); let z = 1, last = 0;
  v.querySelector(".mview-x").onclick = () => v.remove();
  img.addEventListener("click", (e) => { const now = Date.now(); if (now - last < 300) { z = z > 1 ? 1 : 2.5; img.style.width = z > 1 ? `${z * 100}%` : ""; if (z > 1) { sc.scrollLeft = (img.offsetWidth - sc.clientWidth) * (e.offsetX / (img.offsetWidth / z)); sc.scrollTop = (img.offsetHeight - sc.clientHeight) * (e.offsetY / (img.offsetHeight / z)); } } last = now; });
  sc.addEventListener("click", (e) => { if (e.target === sc && z === 1) v.remove(); });
};

// ---------- Joindre : photos, vidéos, cartes, boutons, programmer ----------
actions["msg-plus"] = () => {
  const coach = isCoach(), dm = CH.kind === "dm";
  const L = [["msg-pick", "📷", "Photo ou vidéo", "depuis la galerie ou l'appareil"],
    ...(coach && dm ? [["share-pick", "🔗", "Partager un exercice, une séance, une recette", "le client l'ouvre en un geste"], ["msg-btns", "🔘", "Question à choix", "Oui / Non, Fait ✅, note de 1 à 5…"], ["msg-sched", "🕒", "Programmer un message", "écrire maintenant, envoyer plus tard"], ["quiz-send", "📋", "Quiz exercices aimés / détestés", ""]] : []),
    ...(!coach && dm ? [["share-me", "🏋️", "Ma dernière séance", ""], ["share-me-repas", "🍽️", "Mes repas d'aujourd'hui", ""], ["share-me-poids", "⚖️", "Mon poids et mes mesures", ""], ["msg-pick", "📸", "Une photo de progression", "visible seulement par Thomas"]] : [])];
  sheet(`<div class="list">${L.map(([a, e, l, s]) => `<button class="li" data-a="${a}" ${a === "msg-sched" ? `data-id="${CH.id}"` : ""}><span class="em">${e}</span><span class="grow">${l}${s ? `<br><span class="xs muted">${s}</span>` : ""}</span></button>`).join("")}</div>`);
};
actions["msg-pick"] = () => { closeSheet(); const f = document.getElementById("mfile"); if (!f) return; f.value = ""; f.onchange = () => envoyerFichiers([...f.files]); f.click(); };
async function envoyerFichiers(files) {
  if (!files.length) return; const c = await cloud(); if (!c) return;
  const trop = files.find(f => f.size > 50e6); if (trop) return toast("Fichier trop lourd (50 Mo maximum)");
  toast(`Envoi de ${files.length} fichier${files.length > 1 ? "s" : ""}…`);
  try {
    await c.ensureSession(); const media = [];
    for (const f of files.slice(0, 10)) { const blob = f.type.startsWith("image") && f.size > 1.5e6 ? await reduire(f) : f; const path = await c.uploadMsgFile(blob, CH.kind === "dm" ? (CH.id || CH.me) : CH.me, f.type.startsWith("video") ? "video" : "photo"); media.push({ path, type: blob.type || f.type }); }
    const ta = document.querySelector("#mcomp textarea"), legende = (ta?.value || "").trim(); if (ta) { ta.value = ""; auto(ta); majSend(); }
    await envoyer({ body: legende, media });
  } catch (e) { toast("Envoi impossible : " + e.message); }
}
// Photo réduite à 2000 px (plus rapide à envoyer et à ouvrir)
function reduire(f) {
  return new Promise((res) => { const img = new Image(), u = URL.createObjectURL(f); img.onload = () => { const k = Math.min(1, 2000 / Math.max(img.width, img.height)); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); cv.toBlob(b => res(b || f), "image/jpeg", .85); }; img.onerror = () => res(f); img.src = u; });
}
// Boutons de réponse rapide
actions["msg-btns"] = () => sheet(`<h2 class="h2">🔘 Question à choix</h2><p class="xs muted">Le client répond d'un geste, sa réponse arrive dans la conversation.</p>
  <form data-f="msg-btns" class="mt8"><textarea class="inp" name="q" rows="2" required placeholder="Tu as fait ta séance de jambes ?"></textarea>
  <div class="chips wrap mt8">${[["Oui|Non", "Oui / Non"], ["Fait ✅|Pas encore", "Fait / Pas encore"], ["1|2|3|4|5", "Note de 1 à 5"], ["😫|😐|🙂|💪", "Humeur"]].map(([v, l]) => `<button type="button" class="chip sm" data-a="btns-preset" data-v="${v}">${l}</button>`).join("")}</div>
  <input class="inp mt8" name="b" required placeholder="Choix séparés par |" value="Oui|Non"><button class="btn btn-red mt8">Envoyer</button></form>`);
actions["btns-preset"] = (b, d) => { const i = document.querySelector("form[data-f=msg-btns] input[name=b]"); if (i) i.value = d.v; };
forms["msg-btns"] = async (v) => { const buttons = v.b.split("|").map(x => x.trim()).filter(Boolean).slice(0, 6); if (buttons.length < 2) return toast("Au moins 2 choix"); closeSheet(); await envoyer({ body: v.q.trim(), buttons }); };
// Programmer
actions["msg-sched"] = async (b, d) => {
  const id = d.id || CH.id; let l = []; try { l = await (await cloud()).schedList(id); } catch { }
  const dflt = new Date(Date.now() + 864e5); dflt.setHours(7, 0, 0, 0); const loc = (x) => new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  sheet(`<h2 class="h2">🕒 Programmer un message</h2><form data-f="msg-sched" data-id="${id}" class="mt8"><textarea class="inp" name="t" rows="3" required>${esc(document.querySelector("#mcomp textarea")?.value || "")}</textarea>
    <label class="field mt8"><span>Envoyer le</span><input class="inp" type="datetime-local" name="at" value="${loc(dflt)}" min="${loc(new Date())}" required></label><button class="btn btn-red mt8">Programmer</button></form>
    ${l.length ? `<div class="lbl mt16">Déjà programmés</div><div class="list mt4">${l.map(x => `<div class="li"><span class="grow small">${fmtDate(x.send_at.slice(0, 10), { day: "numeric", month: "short" })} à ${new Date(x.send_at).toTimeString().slice(0, 5)}<br><span class="muted">${esc(x.body.slice(0, 80))}</span></span><button class="icon-btn sm" data-a="sched-del" data-id="${x.id}">🗑️</button></div>`).join("")}</div>` : ""}`);
};
forms["msg-sched"] = async (v, f) => { try { await (await cloud()).schedAdd([{ user_id: f.dataset.id, body: v.t.trim(), send_at: new Date(v.at).toISOString() }]); closeSheet(); const ta = document.querySelector("#mcomp textarea"); if (ta) { ta.value = ""; majSend(); } try { localStorage.removeItem(draftKey()); } catch { } toast(`🕒 Programmé pour le ${fmtDate(v.at.slice(0, 10), { day: "numeric", month: "short" })} à ${v.at.slice(11, 16)}`); } catch (e) { toast(e.message); } };

// ---------- Cartes partagées ----------
// Coach : exercice, séance type, recette
actions["share-pick"] = () => sheet(`<h2 class="h2">🔗 Partager</h2><div class="list mt8"><button class="li" data-a="share-cat" data-v="exo"><span class="em">💪</span><span class="grow">Un exercice</span></button><button class="li" data-a="share-cat" data-v="seance"><span class="em">🏋️</span><span class="grow">Une de mes séances types</span></button><button class="li" data-a="share-cat" data-v="recette"><span class="em">🥗</span><span class="grow">Une recette</span></button></div>`);
actions["share-cat"] = (b, d) => {
  const L = d.v === "exo" ? E.allExercises().map(e => ({ k: e.name || e, n: e.name || e })) : d.v === "seance" ? (A.store?.seances || []).map(s => ({ k: s.id, n: s.name })) : RC.RECIPES.map(r => ({ k: r.id, n: `${r.e} ${r.n}` }));
  sheet(`<h2 class="h2">Choisir</h2><input class="inp mt8" id="shq" placeholder="Rechercher…" autocomplete="off"><div class="list mt8" id="shl" style="max-height:52vh;overflow:auto"></div>`);
  const draw = (q = "") => { const box = document.getElementById("shl"); if (box) box.innerHTML = L.filter(x => !q || x.n.toLowerCase().includes(q.toLowerCase())).slice(0, 60).map(x => `<button class="li" data-a="share-send" data-t="${d.v}" data-k="${esc(String(x.k))}"><span class="grow small">${esc(x.n)}</span></button>`).join("") || `<p class="empty small">Rien trouvé.</p>`; };
  draw(); document.getElementById("shq")?.addEventListener("input", (e) => draw(e.target.value));
};
actions["share-send"] = async (b, d) => {
  closeSheet(); let ref = null;
  if (d.t === "exo") { const f = E.ficheOf?.(d.k); ref = { t: "exo", k: d.k, titre: d.k, sous: "Exercice · touche pour voir la fiche", l: (f?.cues || f?.consignes || []).slice?.(0, 3) || [] }; }
  else if (d.t === "seance") { const s = (A.store?.seances || []).find(x => String(x.id) === d.k); if (!s) return; ref = { t: "seance", k: s.id, titre: s.name, sous: `${(s.rows || []).length} exercices`, l: (s.rows || []).map(r => `• ${r[0]}`), ex: (s.rows || []).map(r => r[0]) }; }
  else { const r = RC.recipe(d.k); if (!r) return; ref = { t: "recette", k: r.id, titre: `${r.e} ${r.n}`, sous: `${r.min || ""}${r.min ? " min · " : ""}${Math.round(r.m?.kcal || 0)} kcal` }; }
  await envoyer({ body: "", ref });
};
// Client : sa dernière séance, ses repas du jour, son poids
actions["share-me"] = async () => { closeSheet(); const w = (S().workouts || []).at(-1); if (!w) return toast("Aucune séance enregistrée"); await envoyer({ body: "", ref: carteSeance(w) }); };
export function carteSeance(w) {
  const ex = (w.exercises || []).filter(e => e.sets?.some(s => s.done)), series = ex.reduce((a, e) => a + e.sets.filter(s => s.done && s.type !== "W").length, 0);
  const dur = w.end && w.start ? Math.round((new Date(w.end) - new Date(w.start)) / 6e4) : null;
  return { t: "seance", id: w.id, titre: w.title || "Séance", sous: `${fmtDate(dayKey(w.end || w.start), { weekday: "short", day: "numeric", month: "short" })} · ${series} séries${dur ? ` · ${dur} min` : ""}${w.records?.length ? ` · 🏆 ${w.records.length} record${w.records.length > 1 ? "s" : ""}` : ""}`,
    l: ex.slice(0, 6).map(e => { const b = e.sets.filter(s => s.done && s.type !== "W").sort((a, b) => (+b.kg || 0) - (+a.kg || 0))[0]; return `${e.name} · ${e.sets.filter(s => s.done && s.type !== "W").length}×${b ? ` ${b.reps || "?"} @ ${b.kg || 0} kg` : ""}`; }) };
}
export function carteRepas(d = today()) {
  const log = N.dayLog(d), t = log.reduce((a, e) => ({ k: a.k + (+e.kcal || 0), p: a.p + (+e.p || 0) }), { k: 0, p: 0 }), T = N.targets();
  const parRepas = {}; log.forEach(e => { (parRepas[e.meal || "Autre"] = parRepas[e.meal || "Autre"] || []).push(e.label); });
  return { t: "repas", d, titre: `Mes repas · ${d === today() ? "aujourd'hui" : fmtDate(d, { day: "numeric", month: "short" })}`, sous: `${Math.round(t.k)}${T?.kcal ? `/${Math.round(T.kcal)}` : ""} kcal · P ${Math.round(t.p)}${T?.prot ? `/${Math.round(T.prot)}` : ""} g`, l: Object.entries(parRepas).map(([m, l]) => `${m} : ${l.slice(0, 4).join(", ")}`) };
}
actions["share-me-repas"] = async () => { closeSheet(); if (!N.dayLog(today()).length) return toast("Aucun repas noté aujourd'hui"); await envoyer({ body: "", ref: carteRepas() }); };
actions["share-me-poids"] = async () => {
  closeSheet(); const D = S().daily || {}, j = Object.keys(D).filter(k => D[k]?.weight).sort(), last = j.at(-1), w7 = j.filter(k => k > addDays(today(), -7)).map(k => +D[k].weight), moy = w7.length ? w7.reduce((a, b) => a + b, 0) / w7.length : null;
  const mes = (S().measures || []).at?.(-1);
  if (!last && !mes) return toast("Aucun poids noté");
  await envoyer({ body: "", ref: { t: "mesure", titre: last ? `⚖️ ${fr(D[last].weight, 1)} kg` : "Mes mesures", sous: `${last ? fmtDate(last, { day: "numeric", month: "short" }) : ""}${moy ? ` · moyenne 7 j ${fr(moy, 1)} kg` : ""}`, l: mes ? Object.entries({ waist: "Tour de taille", hips: "Hanches", chest: "Poitrine", arm: "Bras", thigh: "Cuisse" }).filter(([k]) => +mes[k]).map(([k, n]) => `${n} : ${fr(+mes[k], 1)} cm`) : [] } });
};
// Ouvrir une carte
actions["ref-open"] = (b, d) => {
  const x = trouve(d.id); let r = null; try { r = JSON.parse(x?.ref || "null"); } catch { } if (!r) return;
  if (r.t === "exo") return ficheSheet(r.k);
  if (r.t === "recette") return actions["rc-open"]?.(b, { id: r.k });
  if (r.t === "video") return go("video-cr", r.id);
  if (isCoach() && CH.kind === "dm" && ["seance", "repas", "mesure"].includes(r.t)) return go("member", CH.id);
  sheet(`<h2 class="h2">${esc(r.titre || "")}</h2>${r.sous ? `<p class="small muted">${esc(r.sous)}</p>` : ""}<div class="list mt8">${(r.l || []).map(l => `<div class="li small">${esc(l)}</div>`).join("")}</div>`);
};
// Question sur un exercice pendant la séance (bouton 💬 de l'exercice)
export function questionExo(ex, setIdx = null) {
  const s = setIdx != null ? ex.sets?.[setIdx] : (ex.sets || []).filter(x => x.done).at(-1);
  sheet(`<h2 class="h2">💬 Question à Thomas</h2><p class="small muted">${esc(ex.name)}${s ? ` · ${s.kg || 0} kg × ${s.reps || "?"}${s.rpe ? ` @${s.rpe}` : ""}` : ""}</p>
    <form data-f="q-exo" class="mt8"><textarea class="inp" name="t" rows="3" required placeholder="Ex. : je sens une gêne à l'épaule en bas du mouvement, normal ?"></textarea><button class="btn btn-red mt8">Envoyer</button></form>`);
  window.__qexo = { t: "exo", k: ex.name, titre: ex.name, sous: s ? `Série : ${s.kg || 0} kg × ${s.reps || "?"}${s.rpe ? ` @RPE ${s.rpe}` : ""}` : "Pendant la séance" };
}
forms["q-exo"] = async (v) => {
  const c = await cloud(); if (!c) return; try { await c.ensureSession(); await c.send(v.t.trim(), c.userId(), null, { ref: window.__qexo }); closeSheet(); toast("Question envoyée à Thomas ✓"); refreshMe(); }
  catch (e) { toast(/row-level|policy/i.test(e.message) ? "Messages réservés aux personnes coachées" : "Envoi impossible : " + e.message); }
};
// Envoyer à Thomas depuis l'app (fin de séance, journée de repas)
actions["share-coach"] = async (b, d) => {
  const c = await cloud(); if (!c) return; let ref = null;
  if (d.k === "seance") { const w = (S().workouts || []).find(x => String(x.id) === d.id) || (S().workouts || []).at(-1); if (w) ref = carteSeance(w); }
  if (d.k === "repas") ref = carteRepas(d.d || today());
  if (!ref) return;
  try { await c.ensureSession(); await c.send("", c.userId(), null, { ref }); toast("Envoyé à Thomas ✓"); buzz(); refreshMe(); }
  catch (e) { toast(/row-level|policy/i.test(e.message) ? "Messages réservés aux personnes coachées" : "Envoi impossible : " + e.message); }
};

// ---------- Menu ⋯ : médias, recherche, réglages ----------
actions["msg-plus-menu"] = () => {
  const coach = isCoach(), dm = CH.kind === "dm", mp = A.store?.msgprefs || {};
  const apercu = S().settings?.notifs?.apercu !== false;
  sheet(`<div class="list">
    <button class="li" data-a="msg-medias"><span class="em">🖼️</span><span class="grow">Photos et vidéos</span></button>
    <button class="li" data-a="msg-find"><span class="em">🔎</span><span class="grow">Rechercher dans la conversation</span></button>
    ${coach && dm ? `<button class="li" data-a="msg-unread" data-id="${CH.id}"><span class="em">●</span><span class="grow">Marquer comme non lu</span></button>
      <button class="li" data-a="msg-mute" data-id="${CH.id}"><span class="em">${mp.muted?.[CH.id] ? "🔔" : "🔕"}</span><span class="grow">${mp.muted?.[CH.id] ? "Réactiver les notifications" : "Mettre en sourdine"}</span></button>
      <button class="li" data-a="msg-arch" data-id="${CH.id}"><span class="em">🗄️</span><span class="grow">Archiver</span></button>` : ""}
    ${coach && !dm ? `<button class="li" data-a="grp-edit" data-id="${CH.id}"><span class="em">⚙️</span><span class="grow">Modifier le groupe</span></button>` : ""}
    ${!coach ? `<button class="li" data-a="msg-apercu"><span class="em">${apercu ? "👁️" : "🙈"}</span><span class="grow">Aperçu des messages dans les notifications<br><span class="xs muted">${apercu ? "affiché" : "masqué : « Nouveau message de Thomas »"}</span></span></button>` : ""}</div>`);
};
actions["msg-apercu"] = async () => { const { update } = await import("../store.js"); update(st => { st.settings.notifs = { ...(st.settings.notifs || {}), apercu: st.settings.notifs?.apercu === false }; }); closeSheet(); toast(S().settings.notifs.apercu === false ? "🙈 Aperçu masqué" : "👁️ Aperçu affiché"); };
actions["msg-medias"] = async () => {
  const l = CH.msgs.flatMap(m => (m.deleted_at ? [] : (m.media || []).map(x => ({ ...x, at: m.created_at })))).reverse();
  sheet(`<h2 class="h2">🖼️ Photos et vidéos</h2>${l.length ? `<div class="mgal mt8">${l.map(x => String(x.type).startsWith("video") ? `<video data-mp="${esc(x.path)}" playsinline controls preload="metadata"></video>` : `<img data-mp="${esc(x.path)}" data-a="msg-photo" alt="">`).join("")}</div>` : `<p class="empty small">Aucune photo ni vidéo.</p>`}`);
  const c = await cloud(); document.querySelectorAll(".mgal [data-mp]").forEach(async el => { try { el.src = await c.audioUrl(el.dataset.mp); } catch { } });
};
actions["msg-find"] = () => { sheet(`<h2 class="h2">🔎 Rechercher</h2><input class="inp mt8" id="mfq" placeholder="Un mot…" autocomplete="off"><div class="list mt8" id="mfl"></div>`);
  document.getElementById("mfq")?.addEventListener("input", (e) => { const q = e.target.value.trim().toLowerCase(), box = document.getElementById("mfl"); if (!box) return;
    box.innerHTML = q.length < 2 ? "" : CH.msgs.filter(m => !m.deleted_at && (m.body || "").toLowerCase().includes(q)).reverse().slice(0, 40).map(m => `<button class="li" data-a="msg-find-go" data-id="${m.id}"><span class="grow small"><b>${esc(nomDe(m.sender))}</b> · <span class="xs muted">${fmtDate(dayKey(m.created_at), { day: "numeric", month: "short" })}</span><br>${esc(m.body.slice(0, 120))}</span></button>`).join("") || `<p class="empty small">Rien trouvé.</p>`; }); };
actions["msg-find-go"] = (b, d) => { closeSheet(); setTimeout(() => actions["msg-goto"](null, d), 200); };
actions["msg-unread"] = async (b, d) => { closeSheet(); try { await (await cloud()).markUnread(d.id); const th = A.threads?.[d.id]; if (th) th.unread = 1; toast("Marquée non lue"); go("admin-msg"); } catch (e) { toast(e.message); } };
actions["msg-read"] = async (b, d) => { closeSheet(); try { await (await cloud()).markRead(d.id); const th = A.threads?.[d.id]; if (th) th.unread = 0; routes["admin-msg"]?.(); } catch (e) { toast(e.message); } };

// ---------- Vocal : maintenir pour enregistrer, glisser à gauche pour annuler, réécouter avant d'envoyer ----------
let pressT = 0;
document.addEventListener("pointerdown", (e) => { const b = e.target.closest?.("#rec-btn"); if (!b) return; e.preventDefault(); pressT = Date.now(); demarrer(e.clientX); });
document.addEventListener("pointermove", (e) => { if (!CH.rec || CH.rec.lock) return; const dx = e.clientX - CH.rec.x0; const box = document.getElementById("mrecbox"); if (box) box.classList.toggle("cancel", dx < -80); CH.rec.annule = dx < -80; });
document.addEventListener("pointerup", () => { if (!CH.rec || CH.rec.lock) return; if (Date.now() - pressT < 350 && !CH.rec.started) { CH.rec.cancel(); return toast("Maintiens 🎙️ pour enregistrer"); } CH.rec.annule ? CH.rec.cancel() : CH.rec.stop(); });
document.addEventListener("pointercancel", () => { if (CH.rec && !CH.rec.lock) CH.rec.stop(); });
async function demarrer(x0) {
  if (CH.rec) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast("Enregistrement vocal non disponible sur ce téléphone");
  const R0 = CH.rec = { x0, annule: false, started: false, stop() { this.fin = "send"; this.mr?.state === "recording" && this.mr.stop(); }, cancel() { this.fin = "cancel"; if (this.mr?.state === "recording") this.mr.stop(); else nettoyer(); } };
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { CH.rec = null; return toast("Micro refusé : autorise-le dans les réglages du téléphone"); }
  if (CH.rec !== R0 || R0.fin) { stream.getTracks().forEach(t => t.stop()); CH.rec = null; return; } // relâché pendant la demande d'accès
  const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg"].find(t => MediaRecorder.isTypeSupported?.(t)) || "";
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : {}), chunks = []; R0.mr = mr; R0.t0 = Date.now(); R0.started = true;
  // Transcription en direct (Android, ordinateur ; Safari iPhone ne permet pas les deux à la fois)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let tr = "";
  if (SR && !isIOS) { try { const r = new SR(); r.lang = "fr-FR"; r.continuous = true; r.interimResults = false; r.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) tr += ev.results[i][0].transcript + " "; }; r.onerror = () => { }; r.start(); R0.sr = r; } catch { } }
  mr.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };
  mr.onstop = () => {
    stream.getTracks().forEach(t => t.stop()); try { R0.sr?.stop(); } catch { } clearInterval(R0.tick);
    const dur = Math.round((Date.now() - R0.t0) / 1000), blob = new Blob(chunks, { type: mr.mimeType || "audio/mp4" });
    if (R0.fin === "cancel") { nettoyer(); return toast("Vocal annulé"); }
    if (dur < 1 || blob.size < 1500) { nettoyer(); return toast("Vocal trop court"); }
    // Réécouter avant d'envoyer
    R0.lock = true; R0.blob = blob; R0.dur = dur; setTimeout(() => { R0.tr = tr.trim(); }, 600);
    const box = document.getElementById("mrecbox"); if (!box) return;
    box.classList.remove("cancel", "on"); box.innerHTML = `<button type="button" class="icon-btn sm" data-a="rec-del" aria-label="Supprimer">🗑️</button><audio controls src="${URL.createObjectURL(blob)}"></audio><span class="xs muted">${mmss(dur)}</span>`;
    const s = document.getElementById("send-btn"), rb = document.getElementById("rec-btn"); if (s) { s.hidden = false; s.dataset.vocal = "1"; } if (rb) rb.hidden = true;
  };
  mr.start(); buzz(20);
  const box = document.getElementById("mrecbox"), ta = document.querySelector("#mcomp textarea");
  if (box) { box.hidden = false; box.classList.add("on"); box.innerHTML = `<span class="mrdot"></span><span id="mrt" class="small">0:00</span><span class="grow xs muted mrc">‹ glisse pour annuler</span>`; }
  if (ta) ta.hidden = true;
  R0.tick = setInterval(() => { const e = document.getElementById("mrt"); if (e) e.textContent = mmss((Date.now() - R0.t0) / 1000); if (Date.now() - R0.t0 > 5 * 6e4) R0.stop(); }, 250);
}
function nettoyer() {
  const r = CH.rec; CH.rec = null; if (r) clearInterval(r.tick);
  const box = document.getElementById("mrecbox"), ta = document.querySelector("#mcomp textarea"), s = document.getElementById("send-btn");
  if (box) { box.hidden = true; box.innerHTML = ""; box.classList.remove("on", "cancel"); } if (ta) ta.hidden = false; if (s) delete s.dataset.vocal; majSend();
}
actions["rec-del"] = () => nettoyer();
// Le bouton « envoyer » envoie le vocal en attente s'il y en a un
document.addEventListener("click", async (e) => {
  const s = e.target.closest?.("#send-btn"); if (!s || !s.dataset.vocal || !CH.rec?.blob) return; e.preventDefault(); e.stopPropagation();
  const r = CH.rec; nettoyer(); const c = await cloud(); if (!c) return;
  try { await c.ensureSession(); const path = await c.uploadMsgFile(r.blob, CH.kind === "dm" ? (CH.id || CH.me) : CH.me, "vocal"); const replyTo = typeof CH.reply?.id === "number" ? CH.reply.id : null; CH.reply = null; barre();
    await envoyer({ body: "", audio: path, meta: { dur: r.dur, ...(r.tr ? { tr: r.tr } : {}) }, replyTo }); }
  catch (err) { toast("Envoi impossible : " + (err?.message || err)); }
}, true);
