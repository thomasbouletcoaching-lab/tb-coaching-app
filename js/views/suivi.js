// Régularité (score d'adhérence), Défi 30 jours, rapport de progression partageable, comparateur de photos avant / après.
import { S, update, today, listPhotos } from "../store.js";
import * as E from "../engine.js";
import { CONFIG } from "../config.js";
import { $app, esc, fr, toast, routes, actions, changes, forms, go, header, tabbar, fmtDate, buzz, I, sheet, closeSheet, rerender, cloud, canMsg, rank, premium, lineChart } from "../core.js";
import { pushData } from "../sync.js";
import { STATUS, LABELS, WEIGHTS } from "../adherence.js";
import { myAdherence, myWeekly, myAlerts, checkins, lastCheckin, summaryBetween, defiDay, defiOn, defiSteps, DEFI_DAYS, addDays, since } from "../progress.js";
import { startApply } from "./coach.js";

const pct = (x) => Math.round((x || 0) * 100);
const VIEWS = [["face", "Face"], ["profil", "Profil"], ["dos", "Dos"], ["autre", "Autre"]];
const isBody = (p) => !["repas", "ticket"].includes(p.view);
const toneTag = (st) => `<span class="tag ${"st-" + st.tone}">${st.label}</span>`;

// Anneau de score (SVG)
export function scoreRing(score, size = 112) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, (score ?? 0) / 100));
  const col = score == null ? "var(--line)" : score >= 70 ? "var(--good)" : score >= 45 ? "var(--warn)" : "#D2452F";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Régularité ${score ?? "non calculée"} sur 100"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" font-size="${size * .3}" font-weight="800" fill="var(--ink)">${score ?? "–"}</text></svg>`;
}

// Carte compacte (Accueil, Coaching)
export function adherenceCard() {
  if (!S().profile || S().me?.isCoach) return "";
  const a = myAdherence(), st = STATUS[a.status];
  return `<button class="card tap mt12" data-a="go" data-r="regularite" style="display:flex;gap:14px;align-items:center;width:100%;text-align:left">${scoreRing(a.score, 64)}<span class="grow"><b>Ma régularité</b> ${toneTag(st)}<br><span class="small muted">${a.trend != null ? `${a.trend > 0 ? "▲ +" : a.trend < 0 ? "▼ " : "= "}${a.trend} pts cette semaine · ` : ""}14 derniers jours</span></span>${I.chev}</button>`;
}

routes.regularite = async () => {
  await E.loadPrograms();
  const a = myAdherence(), st = STATUS[a.status], wk = myWeekly(), al = myAlerts(today(), canMsg()).filter(x => x.code !== "health");
  const tips = { train: "Cale tes séances dans l'agenda et déplace-les plutôt que de les sauter.", food: "Note au moins un repas par jour : même approximatif, ça compte.", routine: "Pèse-toi le matin et note ton sommeil : 10 secondes.", checkin: "Fais ton bilan chaque fin de semaine : il est pré-rempli." };
  const parts = Object.keys(WEIGHTS).map(k => [k, a.parts[k]]).filter(([, p]) => p);
  const weakest = parts.slice().sort((x, y) => x[1].pct - y[1].pct)[0];
  $app.innerHTML = header("Ma régularité", "Ce qui fait vraiment les résultats", { back: "__hist", offers: false }) + `<main class="page">
    <div class="card" style="display:flex;gap:16px;align-items:center">${scoreRing(a.score)}<div class="grow">${toneTag(st)}<p class="small mt8" style="margin:0">${st.hint}</p>${a.trend != null ? `<p class="xs muted mt4" style="margin:0">Cette semaine ${a.week} · la précédente ${a.prevWeek}</p>` : ""}</div></div>
    <h2 class="sec">Le détail <small>14 derniers jours</small></h2>
    <div class="list">${parts.map(([k, p]) => `<div class="li" style="flex-direction:column;align-items:stretch;gap:6px"><div class="row between"><b class="small">${LABELS[k]}</b><span class="small">${p.done} / ${p.of} · <b>${pct(p.pct)} %</b></span></div><div class="gauge"><i style="width:${pct(p.pct)}%"></i></div></div>`).join("")}</div>
    ${weakest && weakest[1].pct < .8 ? `<div class="card soft mt12"><b class="small">👉 Le levier le plus simple cette semaine</b><p class="small mt4" style="margin:0">${tips[weakest[0]]}</p></div>` : ""}
    ${al.length ? `<h2 class="sec">À surveiller</h2><div class="list">${al.map(x => `<div class="li"><span class="em">${x.level === "risk" ? "🔴" : "🟠"}</span><span class="grow small">${esc(x.text)}</span></div>`).join("")}</div>` : ""}
    ${wk.length >= 2 ? `<h2 class="sec">Semaine après semaine</h2><div class="card">${lineChart(wk.map(p => ({ y: p.score, l: p.to.slice(8, 10) + "/" + p.to.slice(5, 7) })))}</div>` : ""}
    <p class="xs muted mt12">Le score compte tes séances faites sur celles prévues (40 %), les jours où tu notes tes repas (25 %), ton poids, ton sommeil ou tes pas (15 %) et tes bilans de la semaine (20 %). Ce n'est pas une note sur toi : c'est ce qui prédit le mieux tes résultats.</p>
    <div class="stack mt16"><button class="btn btn-red" data-a="go" data-r="bilan">Faire mon bilan de la semaine</button><button class="btn btn-line" data-a="go" data-r="rapport">Mon rapport de progression</button></div>
  </main>${tabbar("profile")}`;
};

// =====================================================================
// DÉFI 30 JOURS
// =====================================================================
export async function defiCard() {
  if (!defiOn()) return "";
  const d = defiDay(), photos = (await listPhotos().catch(() => [])).filter(isBody);
  const steps = defiSteps(photos.length > 0 || !!S().defi?.photos), open = steps.filter(s => s.day <= d), next = open.find(s => !s.ok);
  const doneN = steps.filter(s => s.ok).length;
  return `<button class="card tap grad mt12" data-a="go" data-r="defi" style="display:block;width:100%;text-align:left"><div class="row between"><b>🔥 Défi ${DEFI_DAYS} jours</b><span class="small" style="opacity:.9">jour ${Math.min(d, DEFI_DAYS)} / ${DEFI_DAYS}</span></div>
    <div class="gauge mt8" style="background:rgba(255,255,255,.25)"><i style="width:${Math.min(100, d / DEFI_DAYS * 100)}%;background:#fff"></i></div>
    <p class="small mt8" style="margin:0">${next ? `Prochaine étape : <b>${esc(next.t)}</b>` : d > DEFI_DAYS ? "Défi terminé : découvre ton rapport et la suite" : "Tout est fait pour aujourd'hui 💪"} · ${doneN}/${steps.length}</p></button>`;
}

routes.defi = async () => {
  await E.loadPrograms();
  const d = defiDay() || 1, photos = (await listPhotos().catch(() => [])).filter(isBody);
  if (photos.length && !S().defi?.photos) update(st => { st.defi = { ...(st.defi || {}), photos: true }; });
  const steps = defiSteps(photos.length > 0), a = myAdherence(), st = STATUS[a.status];
  const end = d >= DEFI_DAYS, sum = summaryBetween(S().trialStart || since() || today());
  const row = (s) => { const locked = s.day > d; return `<${locked ? "div" : "button"} class="li" ${locked ? "" : `data-a="defi-go" data-r="${s.r}"`} style="${locked ? "opacity:.5" : ""}"><span class="em">${s.ok ? "✅" : locked ? "🔒" : "⭕"}</span><span class="grow"><b class="small">${esc(s.t)}</b><br><span class="xs muted">${locked ? `s'ouvre au jour ${s.day}` : esc(s.s)}</span></span>${locked ? "" : I.chev}</${locked ? "div" : "button"}>`; };
  $app.innerHTML = header(`Défi ${DEFI_DAYS} jours`, end ? "Terminé : place aux résultats" : `Jour ${d} sur ${DEFI_DAYS} · l'app complète est ouverte`, { back: "home", offers: false }) + `<main class="page">
    <div class="card grad"><div class="row between"><b class="h3">${end ? "🏁 Tu es allé au bout" : d >= 21 ? "🚀 Dernière ligne droite" : d >= 8 ? "💪 Tu tiens" : "🔥 C'est parti"}</b><span class="small">${Math.min(d, DEFI_DAYS)} / ${DEFI_DAYS}</span></div>
      <div class="gauge mt8" style="background:rgba(255,255,255,.25)"><i style="width:${Math.min(100, d / DEFI_DAYS * 100)}%;background:#fff"></i></div>
      <p class="small mt8" style="margin:0">Pendant ${DEFI_DAYS} jours, tout est ouvert : programme calculé, plan alimentaire, suivi. Ta seule mission : être régulier et faire tes bilans. À la fin, tu as tes chiffres, ton avant / après, et tu décides de la suite.</p></div>
    <div class="card mt12" style="display:flex;gap:14px;align-items:center">${scoreRing(a.score, 72)}<div class="grow"><b>Régularité</b> ${toneTag(st)}<p class="xs muted mt4" style="margin:0">${sum.sessions} séance${sum.sessions > 1 ? "s" : ""}${sum.weight ? ` · ${sum.weight.delta > 0 ? "+" : ""}${fr(sum.weight.delta, 1)} kg` : ""}${sum.waist ? ` · taille ${sum.waist.delta > 0 ? "+" : ""}${fr(sum.waist.delta, 1)} cm` : ""}</p></div></div>
    <h2 class="sec">Tes étapes</h2>
    <div class="list">${steps.map(row).join("")}</div>
    ${d >= 21 && !S().application ? `<div class="card hl mt16"><b class="h3">Et après le défi ?</b><p class="small mt4">Tu as vu ce que tu peux faire seul. Avec Thomas, ton programme et ton plan sont écrits pour toi, il lit tes bilans chaque semaine et ajuste. Les places sont limitées : la candidature prend 2 minutes, tes résultats du défi y sont joints.</p><button class="btn btn-red mt8" data-a="defi-go" data-r="apply-defi">Candidater au coaching</button></div>` : ""}
    ${end ? `<div class="card mt12"><b class="small">Ou continuer seul</b><p class="xs muted mt4">Tu gardes le Gratuit pour toujours (carnet, journal, 6 programmes). Bâtisseur garde tout ouvert.</p><button class="btn btn-line btn-sm mt8" data-a="go" data-r="offers">Voir les formules</button>${S().defi?.closed ? "" : `<button class="btn btn-ghost btn-sm mt8" data-a="defi-close">Masquer le défi</button>`}</div>` : ""}
  </main>${tabbar("home")}`;
};
actions["defi-go"] = (b, d) => { if (d.r === "apply-defi") return applyFromDefi(); go(d.r); };
actions["defi-close"] = () => { update(st => { st.defi = { ...(st.defi || {}), closed: true }; }); go("home"); };

export function applyFromDefi() {
  if (!S().anamnese?.at) { toast("D'abord ton point de départ : Thomas en a besoin pour étudier ta candidature."); return go("anamnese"); }
  const m = S().anamnese.motivation || {}, h = S().anamnese.history || {};
  startApply("avance", { goal: m.proud || "", obstacle: h.stopped || "", from: "defi" });
}

// =====================================================================
// RAPPORT DE PROGRESSION (image partageable + témoignage)
// =====================================================================
const RP = { period: "defi", anon: "prenom", photos: true };
function periodRange() {
  const t = today(), s = S().trialStart || since() || addDays(t, -29);
  if (RP.period === "30") return [addDays(t, -29), t];
  if (RP.period === "90") return [addDays(t, -89), t];
  if (RP.period === "tout") return [since() || s, t];
  return [s, t];
}
async function pairForReport(from, to) {
  const ph = (await listPhotos().catch(() => [])).filter(p => isBody(p) && p.d >= from && p.d <= to);
  for (const v of ["face", "profil", "dos", "autre"]) { const l = ph.filter(p => (p.view || "autre") === v).sort((a, b) => a.d.localeCompare(b.d) || a.id - b.id); if (l.length >= 2 && l[0].d !== l.at(-1).d) return [l[0], l.at(-1)]; }
  return null;
}
routes.rapport = async () => {
  await E.loadPrograms();
  const [from, to] = periodRange(), s = summaryBetween(from, to), a = myAdherence(), pair = await pairForReport(from, to);
  const name = (S().profile?.name || "").trim(), t = S().testimonial;
  const line = (e, l, v) => v ? `<div class="li"><span class="em">${e}</span><span class="grow small">${l}</span><b class="small">${v}</b></div>` : "";
  const sg = (x, d = 1) => `${x > 0 ? "+" : ""}${fr(x, d)}`;
  $app.innerHTML = header("Mon rapport de progression", `Du ${fmtDate(from, { day: "numeric", month: "short" })} au ${fmtDate(to, { day: "numeric", month: "short", year: "numeric" })}`, { back: "__hist", offers: false }) + `<main class="page">
    <div class="chips">${[["defi", S().trialStart ? `Depuis mon début` : "Depuis le début"], ["30", "30 jours"], ["90", "3 mois"], ["tout", "Tout"]].map(([v, l]) => `<button class="chip ${RP.period === v ? "on" : ""}" data-a="rp-period" data-v="${v}">${l}</button>`).join("")}</div>
    <div class="list mt12">
      ${line("⚖️", "Poids (moyenne)", s.weight ? `${sg(s.weight.delta)} kg` : "")}
      ${line("📏", "Tour de taille", s.waist ? `${sg(s.waist.delta)} cm` : "")}
      ${line("📏", "Hanches", s.hips ? `${sg(s.hips.delta)} cm` : "")}
      ${line("💪", "Bras", s.arm ? `${sg(s.arm.delta)} cm` : "")}
      ${line("🏋️", "Séances faites", String(s.sessions))}
      ${line("🧱", "Tonnage soulevé", s.tonnage ? `${fr(s.tonnage / 1000, 1)} t` : "")}
      ${s.lifts.map(l => line("🏆", esc(l.name), `+${fr(l.delta, 1)} kg (1RM est.)`)).join("")}
      ${line("📝", "Bilans faits", s.checkins ? String(s.checkins) : "")}
      ${line("🎯", "Régularité actuelle", a.score != null ? `${a.score} / 100` : "")}
    </div>
    ${!s.weight && !s.waist && !s.sessions ? `<p class="small muted mt8">Pas encore assez de données sur cette période : pèse-toi, prends tes mesures et fais tes séances, le rapport se remplit tout seul.</p>` : ""}
    ${pair ? `<div class="card mt12"><div class="lbl">📸 Avant / après</div><div class="cmp mt8"><figure><img alt="Avant" src="${URL.createObjectURL(pair[0].blob)}"><figcaption>${fmtDate(pair[0].d, { day: "numeric", month: "short" })}</figcaption></figure><figure><img alt="Après" src="${URL.createObjectURL(pair[1].blob)}"><figcaption>${fmtDate(pair[1].d, { day: "numeric", month: "short" })}</figcaption></figure></div>
      <label class="check mt8"><input type="checkbox" data-c="rp-photos" ${RP.photos ? "checked" : ""}> Mettre mes photos dans l'image partagée</label></div>`
      : `<a class="card tap mt12" href="#/compare" style="display:flex;gap:12px;align-items:center"><span style="font-size:26px">📸</span><span class="grow small"><b>Pas encore d'avant / après</b><br><span class="xs muted">Il faut deux photos de la même vue à deux dates différentes</span></span>${I.chev}</a>`}
    <div class="card mt12"><div class="lbl">Nom affiché</div>${["prenom", "initiale", "anonyme"].map(v => `<label class="check mt8"><input type="radio" name="rp-anon" data-c="rp-anon" value="${v}" ${RP.anon === v ? "checked" : ""}> ${v === "prenom" ? esc(name || "Mon prénom") : v === "initiale" ? esc((name[0] || "X").toUpperCase() + ".") : "Anonyme"}</label>`).join("")}</div>
    <div class="stack mt12"><button class="btn btn-red" data-a="rp-share">📤 Partager mon rapport</button><button class="btn btn-line" data-a="rp-save">⬇️ Enregistrer l'image</button></div>
    <h2 class="sec">💬 Témoignage</h2>
    <div class="card">${t?.ok ? `<p class="small" style="margin:0">✅ Tu as autorisé Thomas à utiliser ce rapport comme témoignage le ${fmtDate(t.at.slice(0, 10), { day: "numeric", month: "long" })} (${t.anon === "anonyme" ? "anonyme" : t.anon === "initiale" ? "initiale seulement" : "avec ton prénom"}, ${t.photos ? "photos comprises" : "sans photos"}).</p><button class="btn btn-ghost btn-sm mt8" data-a="rp-revoke">Retirer mon accord</button>`
      : `<p class="small" style="margin:0">Tes résultats peuvent aider d'autres hommes à se lancer. Si tu es d'accord, Thomas pourra montrer ce rapport (et tes mots) sur ses réseaux et son site.</p>
      <form data-f="rp-testi" class="stack mt8"><label class="field"><span>En quelques mots, ce qui a changé pour toi</span><textarea name="quote" maxlength="500" required placeholder="ex. Je tiens 3 séances par semaine depuis un mois, j'ai perdu 3 cm de tour de taille et je dors mieux.">${esc(t?.quote || "")}</textarea></label>
        <label class="check"><input type="checkbox" name="ok" required> J'autorise Thomas Boulet à publier ce rapport et ce texte, ${RP.anon === "anonyme" ? "de façon anonyme" : RP.anon === "initiale" ? "avec mon initiale seulement" : "avec mon prénom"}${pair && RP.photos ? ", photos comprises" : ", sans photos"}. Je peux retirer mon accord à tout moment.</label>
        <button class="btn btn-red btn-sm">Envoyer mon témoignage</button></form>`}</div>
  </main>${tabbar("profile")}`;
};
actions["rp-period"] = (b, d) => { RP.period = d.v; rerender(); };
changes["rp-anon"] = (el) => { RP.anon = el.value; rerender(); };
changes["rp-photos"] = (el) => { RP.photos = el.checked; };
forms["rp-testi"] = async (v) => {
  const [from, to] = periodRange(), pair = await pairForReport(from, to);
  const tt = { ok: true, at: new Date().toISOString(), quote: v.quote.trim(), anon: RP.anon, photos: !!(pair && RP.photos), from, to, summary: compactSummary(summaryBetween(from, to)) };
  update(st => { st.testimonial = tt; st.defi = { ...(st.defi || {}), report: st.defi?.report || new Date().toISOString() }; });
  pushData(true);
  if (tt.photos) shareProgressPhotos(pair).catch(() => { });
  if (canMsg()) { try { const c = await cloud(); await c.send(`💬 Témoignage (accord donné, ${tt.anon}, ${tt.photos ? "photos comprises" : "sans photos"})\n« ${tt.quote} »`); } catch { } }
  buzz(20); toast("Merci ! Thomas a reçu ton témoignage"); rerender();
};
actions["rp-revoke"] = () => { if (!confirm("Retirer ton accord ? Thomas ne pourra plus utiliser ce témoignage.")) return; update(st => { st.testimonial = { ok: false, revokedAt: new Date().toISOString() }; }); pushData(true); toast("Accord retiré"); rerender(); };
const compactSummary = (s) => ({ days: s.days, weight: s.weight?.delta ?? null, waist: s.waist?.delta ?? null, sessions: s.sessions, lifts: s.lifts.map(l => ({ n: l.name, d: Math.round(l.delta * 10) / 10 })), checkins: s.checkins });

actions["rp-share"] = async () => {
  const blob = await reportImage(); if (!blob) return;
  update(st => { st.defi = { ...(st.defi || {}), report: st.defi?.report || new Date().toISOString() }; });
  const file = new File([blob], "mon-rapport-tb-my-coach.png", { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Mon rapport de progression" }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  download(blob, "mon-rapport-tb-my-coach.png");
};
actions["rp-save"] = async () => { const blob = await reportImage(); if (blob) { update(st => { st.defi = { ...(st.defi || {}), report: st.defi?.report || new Date().toISOString() }; }); download(blob, "mon-rapport-tb-my-coach.png"); } };
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast("Image enregistrée"); }

const loadImg = (blob) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
function cover(ctx, img, x, y, w, h) { const r = Math.max(w / img.width, h / img.height), sw = w / r, sh = h / r; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h); }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export async function reportImage() {
  try {
    const [from, to] = periodRange(), s = summaryBetween(from, to), a = myAdherence(), pair = RP.photos ? await pairForReport(from, to) : null;
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d");
    try { await document.fonts?.ready; } catch { }
    const F = (w, px) => `${w} ${px}px Barlow, system-ui, sans-serif`;
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#18212C"); g.addColorStop(1, "#173C8A"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const name = (S().profile?.name || "").trim(), who = RP.anon === "anonyme" ? "" : RP.anon === "initiale" ? (name[0] || "").toUpperCase() + "." : name;
    c.fillStyle = "#9FB8EA"; c.font = F(700, 30); c.fillText("RAPPORT DE PROGRESSION", 72, 110);
    c.fillStyle = "#fff"; c.font = F(800, 72); c.fillText(who ? `${who}, ${s.days} jours` : `${s.days} jours de progrès`, 72, 195);
    c.fillStyle = "#C9D6EE"; c.font = F(500, 32); c.fillText(`Du ${fmtDate(from, { day: "numeric", month: "long" })} au ${fmtDate(to, { day: "numeric", month: "long", year: "numeric" })}`, 72, 248);
    let y = 300;
    if (pair) {
      const [i0, i1] = await Promise.all([loadImg(pair[0].blob), loadImg(pair[1].blob)]); const pw = 456, ph = 560;
      [[i0, 72, pair[0].d, "AVANT"], [i1, 552, pair[1].d, "APRÈS"]].forEach(([im, x, d, l]) => { c.save(); rrect(c, x, y, pw, ph, 28); c.clip(); cover(c, im, x, y, pw, ph); c.restore();
        c.fillStyle = "rgba(0,0,0,.55)"; rrect(c, x + 18, y + ph - 70, 260, 52, 16); c.fill(); c.fillStyle = "#fff"; c.font = F(700, 28); c.fillText(`${l} · ${fmtDate(d, { day: "numeric", month: "short" })}`, x + 34, y + ph - 34); });
      y += ph + 40;
    }
    const sg = (x, d = 1) => `${x > 0 ? "+" : ""}${fr(x, d)}`;
    const tiles = [s.weight && ["Poids", `${sg(s.weight.delta)} kg`], s.waist && ["Tour de taille", `${sg(s.waist.delta)} cm`], ["Séances", String(s.sessions)], a.score != null && ["Régularité", `${a.score}/100`], s.lifts[0] && [s.lifts[0].name.split(" ").slice(0, 2).join(" "), `+${fr(s.lifts[0].delta, 1)} kg`], s.tonnage && ["Tonnage", `${fr(s.tonnage / 1000, 1)} t`]].filter(Boolean).slice(0, pair ? 3 : 6);
    const cols = 3, tw = (W - 144 - 24 * (cols - 1)) / cols, th = 170;
    tiles.forEach(([l, v], i) => { const x = 72 + (i % cols) * (tw + 24), yy = y + Math.floor(i / cols) * (th + 24); c.fillStyle = "rgba(255,255,255,.1)"; rrect(c, x, yy, tw, th, 26); c.fill();
      c.fillStyle = "#fff"; c.font = F(800, 58); c.fillText(v, x + 26, yy + 92, tw - 40); c.fillStyle = "#C9D6EE"; c.font = F(600, 28); c.fillText(l, x + 26, yy + 140, tw - 40); });
    y += Math.ceil(tiles.length / cols) * (th + 24) + 20;
    const quote = S().testimonial?.ok ? S().testimonial.quote : (s.wins.at(-1) || "");
    if (quote && y < H - 260) { c.fillStyle = "#fff"; c.font = F(500, 34); wrap(c, `« ${quote} »`, 72, y + 30, W - 144, 46, Math.max(1, Math.floor((H - 200 - y) / 46))); }
    c.fillStyle = "#fff"; c.font = F(800, 40); c.fillText("TB my Coach", 72, H - 80); c.fillStyle = "#9FB8EA"; c.font = F(600, 28); c.fillText(`${CONFIG.coachName} · ${CONFIG.coachTitle}`, 72, H - 40);
    return await new Promise(r => cv.toBlob(r, "image/png"));
  } catch (e) { console.warn(e); toast("Image impossible à créer sur ce téléphone"); return null; }
}
function wrap(c, text, x, y, w, lh, maxLines) {
  const words = text.split(/\s+/); let line = "", n = 0;
  for (const wd of words) { const t = line ? line + " " + wd : wd; if (c.measureText(t).width > w && line) { c.fillText(n === maxLines - 1 ? line + " …" : line, x, y); y += lh; line = wd; if (++n >= maxLines) return; } else line = t; }
  if (line) c.fillText(line, x, y);
}

// =====================================================================
// COMPARATEUR DE PHOTOS AVANT / APRÈS
// =====================================================================
const CP = { view: "face", a: null, b: null, mode: "side" };
routes.compare = async () => {
  const all = (await listPhotos().catch(() => [])).filter(isBody), list = all.filter(p => (p.view || "autre") === CP.view).sort((x, y) => x.d.localeCompare(y.d) || x.id - y.id);
  if (!premium()) { $app.innerHTML = header("Avant / après", "", { back: "body" }) + `<main class="page"><div class="card"><p class="small">Le comparateur fait partie de Bâtisseur (et du Défi ${DEFI_DAYS} jours).</p><button class="btn btn-red btn-sm" data-a="go" data-r="offers">Voir les offres</button></div></main>${tabbar("body")}`; return; }
  const A = list.find(p => p.id === CP.a) || list[0], B = list.find(p => p.id === CP.b) || list.at(-1);
  const mOf = (d) => { const m = (S().measures || []).filter(x => x.d <= d).sort((x, y) => y.d.localeCompare(x.d)); const w = Object.entries(S().daily || {}).filter(([k, x]) => k <= d && x.weight).sort().at(-1); return { w: w?.[1].weight ?? m.find(x => x.weight)?.weight ?? null, waist: m.find(x => x.waistNav != null)?.waistNav ?? null }; };
  const ma = A ? mOf(A.d) : {}, mb = B ? mOf(B.d) : {};
  const delta = (x, y, u) => x != null && y != null ? `<b>${y - x > 0 ? "+" : ""}${fr(y - x, 1)} ${u}</b>` : "–";
  const days = A && B ? Math.round((new Date(B.d) - new Date(A.d)) / 864e5) : 0;
  const pick = (k, cur) => `<select class="inp" data-c="cp-pick" data-k="${k}" style="text-align:left;font-size:15px">${list.map(p => `<option value="${p.id}" ${p.id === cur?.id ? "selected" : ""}>${fmtDate(p.d, { day: "numeric", month: "short", year: "numeric" })}</option>`).join("")}</select>`;
  $app.innerHTML = header("Avant / après", "Même vue, deux dates", { back: "body" }) + `<main class="page">
    <div class="chips">${VIEWS.map(([v, l]) => `<button class="chip ${CP.view === v ? "on" : ""}" data-a="cp-view" data-v="${v}">${l} · ${all.filter(p => (p.view || "autre") === v).length}</button>`).join("")}</div>
    ${list.length < 2 ? `<div class="card mt12"><p class="small" style="margin:0">Il faut au moins deux photos « ${VIEWS.find(v => v[0] === CP.view)[1]} » à des dates différentes. ${list.length ? "Tu en as une : refais-la dans 2 semaines, même lumière, même tenue, même heure." : "Ajoute ta première dans « Mesures et photos »."}</p><a class="btn btn-red btn-sm mt8" href="#/body">Ajouter une photo</a></div>` : `
    <div class="grid2 mt12"><label class="field"><span>Avant</span>${pick("a", A)}</label><label class="field"><span>Après</span>${pick("b", B)}</label></div>
    <div class="mt8">${[["side", "Côte à côte"], ["slide", "Curseur"]].map(([v, l]) => `<button class="chip sm ${CP.mode === v ? "on" : ""}" data-a="cp-mode" data-v="${v}">${l}</button>`).join(" ")}</div>
    ${CP.mode === "side" ? `<div class="cmp mt12"><figure><img alt="Avant" src="${URL.createObjectURL(A.blob)}"><figcaption>${fmtDate(A.d, { day: "numeric", month: "short", year: "numeric" })}</figcaption></figure><figure><img alt="Après" src="${URL.createObjectURL(B.blob)}"><figcaption>${fmtDate(B.d, { day: "numeric", month: "short", year: "numeric" })}</figcaption></figure></div>`
      : `<div class="slider mt12" id="cp-sl"><img alt="Après" src="${URL.createObjectURL(B.blob)}"><img class="top" alt="Avant" src="${URL.createObjectURL(A.blob)}" style="clip-path:inset(0 50% 0 0)"><span class="bar" style="left:50%"></span><span class="lab l">Avant</span><span class="lab r">Après</span></div><input type="range" min="0" max="100" value="50" data-i="cp-range" class="mt8" style="width:100%" aria-label="Curseur avant après">`}
    <div class="stat3 mt12"><div><b>${days}</b><span>jours d'écart</span></div><div><b style="font-size:20px">${delta(ma.w, mb.w, "kg")}</b><span>poids</span></div><div><b style="font-size:20px">${delta(ma.waist, mb.waist, "cm")}</b><span>taille</span></div></div>
    <div class="stack mt12"><button class="btn btn-red" data-a="cp-export">📤 Exporter l'avant / après</button>${canMsg() || rank() >= 2 ? `<button class="btn btn-line" data-a="cp-send">Envoyer ces 2 photos à Thomas</button>` : ""}</div>
    <p class="xs muted mt8">Les photos restent sur ton téléphone. Rien n'est envoyé sans que tu appuies sur un bouton.</p>`}
  </main>${tabbar("body")}`;
  CP.cur = A && B ? [A, B] : null;
};
actions["cp-view"] = (b, d) => { CP.view = d.v; CP.a = CP.b = null; rerender(); };
actions["cp-mode"] = (b, d) => { CP.mode = d.v; rerender(); };
changes["cp-pick"] = (el) => { CP[el.dataset.k] = +el.value; rerender(); };
changes["i:cp-range"] = (el) => { const s = document.getElementById("cp-sl"); if (!s) return; s.querySelector(".top").style.clipPath = `inset(0 ${100 - el.value}% 0 0)`; s.querySelector(".bar").style.left = el.value + "%"; };
actions["cp-export"] = async () => {
  if (!CP.cur) return; const [A, B] = CP.cur;
  try {
    const [i0, i1] = await Promise.all([loadImg(A.blob), loadImg(B.blob)]), W = 1080, H = 820, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d");
    c.fillStyle = "#18212C"; c.fillRect(0, 0, W, H);
    [[i0, 24, A.d, "AVANT"], [i1, 552, B.d, "APRÈS"]].forEach(([im, x, d, l]) => { c.save(); rrect(c, x, 24, 504, 672, 24); c.clip(); cover(c, im, x, 24, 504, 672); c.restore(); c.fillStyle = "#fff"; c.font = "700 30px Barlow, system-ui, sans-serif"; c.fillText(`${l} · ${fmtDate(d, { day: "numeric", month: "short", year: "numeric" })}`, x + 8, 750); });
    c.fillStyle = "#9FB8EA"; c.font = "600 24px Barlow, system-ui, sans-serif"; c.fillText("TB my Coach", 24, 800);
    const blob = await new Promise(r => cv.toBlob(r, "image/png")), file = new File([blob], "avant-apres.png", { type: "image/png" });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Mon avant / après" }); return; } } catch (e) { if (e?.name === "AbortError") return; }
    download(blob, "avant-apres.png");
  } catch { toast("Export impossible sur ce téléphone"); }
};
actions["cp-send"] = async () => { if (!CP.cur) return; if (!confirm("Envoyer ces 2 photos à Thomas ? Elles ne seront visibles que par lui.")) return; try { const n = await shareProgressPhotos(CP.cur); toast(`${n} photo${n > 1 ? "s" : ""} envoyée${n > 1 ? "s" : ""} à Thomas`); } catch (e) { toast(e.message); } };

// Envoi de photos au coach (dossier privé progress/<uid>/ du bucket « media », voir la migration 2026-11-08_suivi_photos.sql)
async function shrink(blob, max = 1080) {
  const im = await loadImg(blob), r = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement("canvas");
  cv.width = Math.round(im.width * r); cv.height = Math.round(im.height * r); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
  return await new Promise(res => cv.toBlob(res, "image/jpeg", .82));
}
export async function shareProgressPhotos(photos) {
  const c = await cloud(); if (!c?.uploadProgressPhoto) throw new Error("Envoi indisponible hors connexion");
  let n = 0; const sent = [...(S().sharedPhotos || [])];
  for (const p of photos) {
    if (sent.some(x => x.id === p.id)) { n++; continue; }
    try { const path = await c.uploadProgressPhoto(await shrink(p.blob), `${p.d}-${p.view || "autre"}-${p.id}.jpg`); sent.push({ id: p.id, d: p.d, view: p.view || "autre", path }); n++; }
    catch (e) { throw new Error(/policy|security|denied|403|Unauthorized/i.test(e.message || "") ? "L'envoi de photos n'est pas encore activé par Thomas." : "Envoi impossible : " + e.message); }
  }
  update(st => { st.sharedPhotos = sent; }); pushData(true); return n;
}
