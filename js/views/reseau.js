// Réseau privé, côté membre (onglet Coaching) et côté coach (Profil › Réseau) : absence, annonces, sondages, défis de groupe.
import { S, update, today } from "../store.js";
import { esc, toast, routes, actions, forms, header, sheet, closeSheet, fmtDate, rerender, cloud, isCoach, go, adminTabbar, I, chips } from "../core.js";
import * as RS from "../reseau.js";

const pub = () => S().coachPublic || {};
const dt = (d) => fmtDate(d, { weekday: "short", day: "numeric", month: "long" });

// ---------- Membre ----------
export function absenceBanner() {
  const a = RS.absenceActive(pub().absence, today()); if (!a) return "";
  return `<div class="card mt12" style="background:var(--tint)"><b class="small">🌴 ${a.now ? `Thomas est absent jusqu'au ${dt(a.to)}` : `Thomas sera absent du ${dt(a.from)} au ${dt(a.to)}`}</b>${a.msg ? `<p class="xs mt4" style="margin-bottom:0">${esc(a.msg)}</p>` : ""}<p class="xs muted mt4" style="margin-bottom:0">Ton programme continue normalement. Il répond à ses messages à son retour.</p></div>`;
}
let VOTES = null, RES = {}, PARTS = {};
async function loadLive() {
  const c = await cloud(); if (!c) return;
  const ps = pub().sondages?.items || [], ds = pub().defis?.items || [];
  try { VOTES = await c.myVotes(); } catch { VOTES = {}; }
  await Promise.all([...ps.filter(p => VOTES[p.id] != null).map(async p => { try { RES[p.id] = await c.pollResults(p.id); } catch { } }),
    ...ds.map(async d => { try { PARTS[d.id] = await c.defiParts(d.id); } catch { } })]);
}
export async function reseauBlock() {
  const t = today(), an = RS.annoncesVisibles(pub().annonces?.items, t).slice(0, 3), ps = (pub().sondages?.items || []).filter(p => !p.until || p.until >= t), ds = (pub().defis?.items || []).filter(d => RS.defiEtat(d, t) !== "fini" || d.to >= addD(t, -7));
  if (!an.length && !ps.length && !ds.length) return "";
  if (VOTES == null) await loadLive().catch(() => { });
  const me = (await cloud())?.myUid?.();
  return `<h2 class="sec">📣 Le groupe de Thomas</h2>
    ${an.map(a => `<div class="card mt8">${a.pin ? `<span class="tag r">📌 Épinglé</span>` : ""}<b class="small" style="display:block">${esc(a.title)}</b><p class="small mt4" style="margin-bottom:0;white-space:pre-wrap">${esc(a.txt)}</p><div class="xs muted mt4">${dt(a.d)}</div></div>`).join("")}
    ${ps.map(p => { const v = VOTES?.[p.id], r = RS.resultats(p.opts, RES[p.id] || {}); return `<div class="card mt8"><div class="lbl">📊 Sondage</div><b class="small">${esc(p.q)}</b>
      <div class="stack mt8" style="gap:6px">${p.opts.map((o, i) => v == null ? `<button class="btn btn-line btn-sm" data-a="poll-vote" data-id="${esc(p.id)}" data-v="${i}" style="text-align:left">${esc(o)}</button>`
        : `<div class="pollbar ${v === i ? "me" : ""}"><i style="width:${r.pct[i]}%"></i><span>${esc(o)}${v === i ? " ✓" : ""}</span><b>${r.pct[i]} %</b></div>`).join("")}</div>
      <div class="xs muted mt4">${v == null ? "Ton vote est anonyme pour les autres membres." : `${r.tot} vote${r.tot > 1 ? "s" : ""} · <button class="link xs" data-a="poll-again" data-id="${esc(p.id)}">changer mon vote</button>`}</div></div>`; }).join("")}
    ${ds.map(d => { const parts = PARTS[d.id] || [], mine = parts.find(x => x.user_id === me), m = RS.METRIQUES[d.metric] || ["", ""], et = RS.defiEtat(d, t), sc = RS.scoreDefi(d, S());
      return `<div class="card mt8"><div class="row between"><div class="lbl">🏆 Défi de groupe</div><span class="tag ${et === "encours" ? "r" : ""}">${et === "encours" ? "en cours" : et === "avenir" ? "bientôt" : "terminé"}</span></div><b class="small">${esc(d.title)}</b>
        <div class="xs muted mt4">${m[0]} · du ${dt(d.from)} au ${dt(d.to)}${d.goal ? ` · objectif ${d.goal} ${m[1]}` : ""}</div>
        ${parts.length ? `<div class="list mt8">${parts.slice(0, 10).map((x, i) => `<div class="li" style="padding:6px 0"><span class="num" style="width:26px">${["🥇", "🥈", "🥉"][i] || i + 1}</span><span class="grow small">${esc(x.alias)}${x.user_id === me ? " (toi)" : ""}</span><b class="small">${(+x.value).toLocaleString("fr-FR")} ${unite(m[1], +x.value)}</b></div>`).join("")}</div>` : `<p class="xs muted mt8">Personne n'a encore rejoint : sois le premier.</p>`}
        ${mine ? `<div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="defi-sync" data-id="${esc(d.id)}">↻ Mettre mon score à jour (${sc})</button><button class="btn btn-ghost btn-sm" style="width:auto" data-a="defi-leave" data-id="${esc(d.id)}">Quitter</button></div>`
          : et !== "fini" ? `<button class="btn btn-red btn-sm mt8" data-a="defi-join" data-id="${esc(d.id)}">Rejoindre le défi</button><p class="xs muted mt4">Seuls ton prénom et ton score sont visibles par le groupe.</p>` : ""}</div>`; }).join("")}`;
}
const unite = (u, n) => n > 1 || u === "min" ? u : u.replace(/s$/, "");
const addD = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
actions["poll-vote"] = async (b, d) => { try { const c = await cloud(); await c.pollVote(d.id, +d.v); VOTES = { ...(VOTES || {}), [d.id]: +d.v }; RES[d.id] = await c.pollResults(d.id).catch(() => ({})); toast("Vote enregistré"); rerender(false); } catch (e) { toast("Vote impossible : " + e.message); } };
actions["poll-again"] = (b, d) => { if (VOTES) delete VOTES[d.id]; rerender(false); };
const alias = () => String(S().profile?.name || "Membre").split(" ")[0].slice(0, 20);
const defiOf = (id) => (pub().defis?.items || []).find(x => x.id === id);
actions["defi-join"] = async (b, d) => { const df = defiOf(d.id); if (!df) return; try { const c = await cloud(); await c.defiJoin(d.id, alias(), RS.scoreDefi(df, S())); PARTS[d.id] = await c.defiParts(d.id); toast("Tu es dans le défi 💪"); rerender(false); } catch (e) { toast("Impossible : " + e.message); } };
actions["defi-sync"] = actions["defi-join"];
actions["defi-leave"] = async (b, d) => { if (!confirm("Quitter ce défi ?")) return; try { const c = await cloud(); await c.defiLeave(d.id); PARTS[d.id] = await c.defiParts(d.id); rerender(false); } catch (e) { toast("Impossible : " + e.message); } };
// Met à jour tout seul le score des défis rejoints (appelé après une séance ou un repas noté, et à l'ouverture)
export async function syncDefis() {
  const c = await cloud(); if (!c?.defiParts) return; const me = c.myUid?.(); if (!me) return; const t = today();
  for (const d of (pub().defis?.items || []).filter(x => RS.defiEtat(x, t) === "encours")) {
    try { const parts = PARTS[d.id] || (PARTS[d.id] = await c.defiParts(d.id)); const mine = parts.find(x => x.user_id === me); const sc = RS.scoreDefi(d, S());
      if (mine && +mine.value !== sc) { await c.defiJoin(d.id, mine.alias, sc); mine.value = sc; } } catch { }
  }
}

// ---------- Coach : Profil › Réseau ----------
let NET = null;
async function loadNet() { const c = await cloud(); NET = await c.coachPublic(["absence", "annonces", "sondages", "defis"]); NET.annonces = NET.annonces || { items: [] }; NET.sondages = NET.sondages || { items: [] }; NET.defis = NET.defis || { items: [] }; NET.absence = NET.absence || { on: false }; }
async function saveNet(k) { try { const c = await cloud(); await c.coachPublicSet(k, NET[k]); return true; } catch (e) { toast("Enregistrement impossible : " + e.message); return false; } }
routes["admin-reseau"] = async () => {
  if (!isCoach()) return go("home");
  $app().innerHTML = header("Réseau privé", "Annonces, sondages, défis", { back: "admin-profile" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  try { await loadNet(); } catch (e) { $app().innerHTML = header("Réseau privé", "", { back: "admin-profile" }) + `<main class="page"><p class="empty">${esc(e.message)}</p></main>`; return; }
  const ab = NET.absence, abA = RS.absenceActive(ab, today()), c = await cloud();
  const res = {}; await Promise.all(NET.sondages.items.map(async p => { try { res[p.id] = await c.pollResults(p.id); } catch { } }));
  const parts = {}; await Promise.all(NET.defis.items.map(async d => { try { parts[d.id] = await c.defiParts(d.id); } catch { } }));
  $app().innerHTML = header("Réseau privé", "Visible par tous tes membres", { back: "admin-profile" }) + `<main class="page">
    <div class="row between mt8"><b class="lbl" style="margin:0">🌴 Mode absence</b><button class="link xs" data-a="net-abs">${ab.on ? "Modifier" : "Activer"}</button></div>
    <div class="card mt4">${ab.on ? `<b class="small">${abA?.now ? "En cours" : "Prévue"} : du ${dt(ab.from)} au ${dt(ab.to)}</b>${ab.msg ? `<p class="xs mt4" style="margin-bottom:0">${esc(ab.msg)}</p>` : ""}<div><button class="btn btn-line btn-sm mt8" style="width:auto" data-a="net-abs-off">Désactiver</button></div>` : `<p class="small muted" style="margin:0">Vacances, compétition : tes membres voient un bandeau sur Coaching et dans les messages.</p>`}</div>
    <div class="row between mt16"><b class="lbl" style="margin:0">📣 Annonces</b><button class="link xs" data-a="net-an">+ Publier</button></div>
    ${NET.annonces.items.length ? NET.annonces.items.slice().sort((a, b) => b.d.localeCompare(a.d)).map(a => `<div class="card mt4"><div class="row between" style="gap:8px"><b class="small">${a.pin ? "📌 " : ""}${esc(a.title)}</b><button class="icon-btn sm" data-a="net-del" data-k="annonces" data-id="${a.id}" aria-label="Supprimer">${I.close}</button></div><p class="xs mt4" style="margin-bottom:0;white-space:pre-wrap">${esc(a.txt)}</p><div class="xs muted mt4">${dt(a.d)}</div></div>`).join("") : `<p class="xs muted mt4">Une nouvelle séance au club, un conseil de la semaine…</p>`}
    <div class="row between mt16"><b class="lbl" style="margin:0">📊 Sondages</b><button class="link xs" data-a="net-poll">+ Créer</button></div>
    ${NET.sondages.items.length ? NET.sondages.items.map(p => { const r = RS.resultats(p.opts, res[p.id] || {}); return `<div class="card mt4"><div class="row between" style="gap:8px"><b class="small">${esc(p.q)}</b><button class="icon-btn sm" data-a="net-del" data-k="sondages" data-id="${p.id}" aria-label="Supprimer">${I.close}</button></div>
      <div class="stack mt8" style="gap:6px">${p.opts.map((o, i) => `<div class="pollbar"><i style="width:${r.pct[i]}%"></i><span>${esc(o)}</span><b>${r.pct[i]} %</b></div>`).join("")}</div><div class="xs muted mt4">${r.tot} vote${r.tot > 1 ? "s" : ""}${p.until ? ` · jusqu'au ${dt(p.until)}` : ""}</div></div>`; }).join("") : `<p class="xs muted mt4">Choisis le prochain thème de live, l'horaire d'un cours…</p>`}
    <div class="row between mt16"><b class="lbl" style="margin:0">🏆 Défis de groupe</b><button class="link xs" data-a="net-defi">+ Lancer</button></div>
    ${NET.defis.items.length ? NET.defis.items.map(d => { const m = RS.METRIQUES[d.metric] || ["", ""], l = parts[d.id] || []; return `<div class="card mt4"><div class="row between" style="gap:8px"><b class="small">${esc(d.title)}</b><button class="icon-btn sm" data-a="net-del" data-k="defis" data-id="${d.id}" aria-label="Supprimer">${I.close}</button></div><div class="xs muted mt4">${m[0]} · du ${dt(d.from)} au ${dt(d.to)} · ${l.length} participant${l.length > 1 ? "s" : ""}</div>${l.slice(0, 5).map((x, i) => `<div class="row between xs mt4"><span>${["🥇", "🥈", "🥉"][i] || i + 1} ${esc(x.alias)}</span><b>${(+x.value).toLocaleString("fr-FR")} ${unite(m[1], +x.value)}</b></div>`).join("")}</div>`; }).join("") : `<p class="xs muted mt4">Le plus de séances en novembre, 10 jours de repas notés…</p>`}
  </main>${adminTabbar("admin-profile")}`;
};
const $app = () => document.getElementById("app");
actions["net-abs"] = () => { const a = NET.absence; sheet(`<h2 class="h2">🌴 Mode absence</h2><form data-f="net-abs" class="mt12"><div class="grid2"><label class="field"><span>Du</span><input type="date" name="from" value="${a.from || today()}" required></label><label class="field"><span>Au</span><input type="date" name="to" value="${a.to || ""}" required></label></div>
  <label class="field mt8"><span>Message (facultatif)</span><textarea name="msg" rows="3" maxlength="300" placeholder="Je suis en vacances : continuez vos séances, je réponds à mon retour.">${esc(a.msg || "")}</textarea></label><button class="btn btn-red mt12">Activer</button></form>`); };
forms["net-abs"] = async (v) => { if (v.to < v.from) return toast("La fin est avant le début"); NET.absence = { on: true, from: v.from, to: v.to, msg: (v.msg || "").trim() }; if (await saveNet("absence")) { closeSheet(); toast("Mode absence activé"); rerender(); } };
actions["net-abs-off"] = async () => { NET.absence = { ...NET.absence, on: false }; if (await saveNet("absence")) rerender(); };
actions["net-an"] = () => sheet(`<h2 class="h2">📣 Nouvelle annonce</h2><form data-f="net-an" class="mt12"><label class="field"><span>Titre</span><input name="title" maxlength="80" required></label><label class="field mt8"><span>Texte</span><textarea name="txt" rows="5" maxlength="1200" required></textarea></label><label class="li mt8" style="padding:6px 0"><span class="grow small">📌 Épingler en haut</span><input type="checkbox" name="pin"></label><label class="li" style="padding:6px 0"><span class="grow small">🔔 Prévenir tous les membres</span><input type="checkbox" name="notif" checked></label><button class="btn btn-red mt12">Publier</button></form>`);
forms["net-an"] = async (v) => { NET.annonces.items.push({ id: Date.now(), d: today(), title: v.title.trim(), txt: v.txt.trim(), pin: !!v.pin }); if (await saveNet("annonces")) { if (v.notif) await notifyAll("📣 " + v.title.trim(), v.txt.trim().slice(0, 120)); closeSheet(); toast("Annonce publiée"); rerender(); } };
actions["net-poll"] = () => sheet(`<h2 class="h2">📊 Nouveau sondage</h2><form data-f="net-poll" class="mt12"><label class="field"><span>Question</span><input name="q" maxlength="140" required></label><label class="field mt8"><span>Réponses (une par ligne, 2 à 6)</span><textarea name="opts" rows="4" required placeholder="Mardi soir&#10;Jeudi soir&#10;Samedi matin"></textarea></label><label class="field mt8"><span>Fin (facultatif)</span><input type="date" name="until" min="${today()}"></label><label class="li" style="padding:6px 0"><span class="grow small">🔔 Prévenir tous les membres</span><input type="checkbox" name="notif" checked></label><button class="btn btn-red mt12">Publier</button></form>`);
forms["net-poll"] = async (v) => { const opts = String(v.opts).split("\n").map(x => x.trim()).filter(Boolean).slice(0, 6); if (opts.length < 2) return toast("Au moins 2 réponses"); NET.sondages.items.push({ id: "p" + Date.now(), d: today(), q: v.q.trim(), opts, until: v.until || null }); if (await saveNet("sondages")) { if (v.notif) await notifyAll("📊 Sondage", v.q.trim()); closeSheet(); toast("Sondage publié"); rerender(); } };
actions["net-defi"] = () => sheet(`<h2 class="h2">🏆 Nouveau défi de groupe</h2><form data-f="net-defi" class="mt12"><label class="field"><span>Nom</span><input name="title" maxlength="80" required placeholder="Défi de décembre : 12 séances"></label><label class="field mt8"><span>Ce qui compte</span><select name="metric">${Object.entries(RS.METRIQUES).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
  <div class="grid2 mt8"><label class="field"><span>Du</span><input type="date" name="from" value="${today()}" required></label><label class="field"><span>Au</span><input type="date" name="to" required></label></div><label class="field mt8"><span>Objectif (facultatif)</span><input name="goal" inputmode="numeric" placeholder="12"></label><button class="btn btn-red mt12">Lancer</button></form>`);
forms["net-defi"] = async (v) => { if (v.to < v.from) return toast("La fin est avant le début"); NET.defis.items.push({ id: "d" + Date.now(), title: v.title.trim(), metric: v.metric, from: v.from, to: v.to, goal: +v.goal || null }); if (await saveNet("defis")) { await notifyAll("🏆 Nouveau défi", v.title.trim()); closeSheet(); toast("Défi lancé"); rerender(); } };
actions["net-del"] = async (b, d) => { if (!confirm("Supprimer ?")) return; NET[d.k].items = NET[d.k].items.filter(x => String(x.id) !== d.id); if (await saveNet(d.k)) rerender(); };
async function notifyAll(title, body) { try { const c = await cloud(); const ms = (window.__members || []).filter(m => !m.is_coach); await Promise.all(ms.map(m => c.notify(title, body, m.id).catch(() => { }))); } catch { } }
