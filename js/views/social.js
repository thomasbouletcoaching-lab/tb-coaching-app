// Partage, parrainage, amis et communauté (écrans). Règles pures : js/social.js. Serveur : js/cloud.js (cxs_soc_*).
// Sans compte ou sans la migration 2026-11-18_cxs_social.sql, la story et l'envoi à un ami marchent quand même ;
// la communauté et les amis affichent ce qu'il manque.
import { $app, esc, header, tabbar, adminTabbar, go, rerender, routes, actions, forms, toast, buzz, sheet, closeSheet, cloud, ago, fmtDate, isCoach, fr, R, modeBar } from "../core.js";
import { S, update, today, proxyActive } from "../store.js";
import { CONFIG, TRIAL_DAYS } from "../config.js";
import * as SO from "../social.js";
import * as E from "../engine.js";
import { gradeOf, GRADES, weightLike } from "../fx.js";
import * as EN from "../energy.js";

// ---------- État ----------
const ETAT = { absent: false, connecte: null, moi: null, err: null, at: 0 };
const FIL = { amis: null, communaute: null, moi: null };
let onglet = "communaute";
const soc = () => S().social || {};
const profil = () => ETAT.moi?.profil || soc().profil || null;
const monCode = () => profil()?.code || soc().code || null;
const prenom = () => (S().profile?.name || "").trim().split(/\s+/)[0] || "";
export const baseApp = () => { const u = new URL("./", location.href); return u.href; };
const joursOfferts = () => SO.joursEssai(TRIAL_DAYS, { code: "x" });

async function charger(force = false) {
  if (!force && Date.now() - ETAT.at < 20000 && ETAT.connecte != null) return;
  ETAT.at = Date.now(); ETAT.err = null;
  const c = await cloud(); if (!c) { ETAT.connecte = false; return; }
  try {
    if (!(await c.currentSession())) { ETAT.connecte = false; return; }
    ETAT.connecte = true;
    const m = await c.socMoi(soc().vu || null); ETAT.moi = m; ETAT.absent = false;
    update(st => { st.social = { ...(st.social || {}), profil: m.profil, code: m.profil?.code || st.social?.code || null, resume: resumeDe(m) }; });
  } catch (e) { if (e.name === "SocialAbsent") ETAT.absent = true; else ETAT.err = e.message; }
}
// Ce que l'accueil affiche sans attendre le réseau
const resumeDe = (m) => ({ recusDepuis: m.recus_depuis || 0, demandes: m.demandes || 0, amis: m.amis || 0, donnes: m.donnes || 0, parJour: m.par_jour || {}, at: new Date().toISOString() });
// Appelé régulièrement par app.js (toutes les 5 min), et au retour au premier plan
export async function pullSocial() { if (proxyActive()) return; try { if (!S().profile || isCoach()) return; await lierInvitation(); await charger(true); } catch { } }

// ---------- Invitation reçue (lien ?r=CODE…) ----------
// Lue au démarrage, avant tout écran : le code est gardé même si la personne n'a pas encore de profil.
export function captureInvitation() {
  const lu = SO.lireLien(location.search); if (!lu) return false;
  update(st => { st.invite = { ...(st.invite || {}), ...(lu.code ? { code: lu.code } : {}), ...(lu.seance ? { seance: lu.seance, programme: null } : {}), ...(lu.programme ? { programme: lu.programme, seance: null } : {}), ...(lu.partage ? { partageId: lu.partage, seance: null, programme: null } : {}), at: new Date().toISOString(), vu: false }; });
  const u = new URL(location.href); ["r", "k", "d", "prog", "de", "p"].forEach(k => u.searchParams.delete(k));
  history.replaceState(null, "", u.pathname + (u.searchParams.toString() ? "?" + u.searchParams : "") + (lu.seance || lu.programme || lu.partage ? "#/partage" : u.hash));
  return true;
}
// Le code reçu est lié au compte dès qu'il existe (une fois) : c'est ce qui permet la récompense du parrain
async function lierInvitation() {
  const inv = S().invite; if (!inv?.code || inv.lie) return;
  const c = await cloud(); if (!c || !(await c.currentSession())) return;
  try { const r = await c.parrainageLier(inv.code); update(st => { st.invite = { ...st.invite, lie: r, lieAt: new Date().toISOString() }; }); if (r === "lie") toast("🤝 Invitation validée : vous êtes maintenant amis"); }
  catch (e) { if (e.name !== "SocialAbsent") console.warn("Invitation non liée :", e.message); }
}
// Code d'invitation : celui du profil social, ou créé à la demande
async function assurerCode() {
  if (monCode()) return monCode();
  const c = await cloud(); if (!c) return null;
  try { if (!(await c.currentSession())) return null; const code = await c.socCode(SO.pseudoParDefaut(S().profile?.name) || null); if (SO.codeValide(code)) update(st => { st.social = { ...(st.social || {}), code }; }); return code; }
  catch { return null; }
}

// ---------- Partage (feuille de partage du téléphone) ----------
function telecharger(blob, nom) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nom; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
async function copier(t) { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } }
async function partagerTexte(texte, titre = "TB my Coach") {
  try { if (navigator.share) { await navigator.share({ title: titre, text: texte }); return "ok"; } } catch (e) { if (e?.name === "AbortError") return "annule"; }
  if (await copier(texte)) { toast("Message copié : colle-le dans ta conversation"); return "copie"; }
  sheet(`<h2 class="h2">Copie ce message</h2><textarea class="inp mt8" rows="6" readonly style="width:100%">${esc(texte)}</textarea><button class="btn mt12" data-a="close">Fermer</button>`); return "affiche";
}
async function partagerImage(blob, nom, texte) {
  const file = new File([blob], nom, { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: texte }); return "ok"; } } catch (e) { if (e?.name === "AbortError") return "annule"; }
  telecharger(blob, nom); const ok = await copier(texte);
  toast(ok ? "Image enregistrée, lien copié : ajoute-le à ta story" : "Image enregistrée"); return "telecharge";
}

// ---------- Image « story » 1080 × 1920 ----------
const F = (w, px) => `${w} ${px}px Barlow, system-ui, -apple-system, "Segoe UI", sans-serif`;
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function lignes(c, txt, w, max) { const out = []; let l = ""; for (const m of String(txt).split(/\s+/)) { const t = l ? l + " " + m : m; if (c.measureText(t).width > w && l) { out.push(l); l = m; if (out.length === max) break; } else l = t; } if (out.length < max && l) out.push(l); else if (l && out.length === max) out[max - 1] = out[max - 1].replace(/\s*\S*$/, " …"); return out; }
function fond(c, W, H) {
  // Couleurs de TB my Coach : le bleu de l'app (--gradbtn : #173C8A → #2E5FC9 → #4F82E0)
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0E2560"); g.addColorStop(.5, "#173C8A"); g.addColorStop(1, "#0A1838"); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = c.createRadialGradient(W * .85, H * .12, 20, W * .85, H * .12, 760); r.addColorStop(0, "rgba(79,130,224,.6)"); r.addColorStop(1, "rgba(79,130,224,0)"); c.fillStyle = r; c.fillRect(0, 0, W, H);
  const r2 = c.createRadialGradient(W * .1, H * .9, 20, W * .1, H * .9, 700); r2.addColorStop(0, "rgba(46,95,201,.45)"); r2.addColorStop(1, "rgba(46,95,201,0)"); c.fillStyle = r2; c.fillRect(0, 0, W, H);
}
function marque(c, x, y) { c.font = F(800, 54); c.fillStyle = "#fff"; c.fillText("TB my ", x, y); const w = c.measureText("TB my ").width; c.fillStyle = "#8FB4FF"; c.fillText("Coach", x + w, y); }
function pied(c, W, H, code, lien = "", compact = false) {
  if (compact) { const y = H - 250; c.fillStyle = "rgba(255,255,255,.12)"; rr(c, 80, y, W - 160, 180, 32); c.fill();
    c.fillStyle = "#fff"; c.font = F(800, 40); c.fillText("Rejoins-moi sur TB my Coach", 120, y + 60, W - 240);
    c.fillStyle = "#C9DAFF"; c.font = F(600, 28); c.fillText(`${joursOfferts()} jours offerts${code ? ` · code ${code}` : ""} · ${CONFIG.coachName}`, 120, y + 108, W - 240);
    if (lien) { c.fillStyle = "#fff"; c.font = F(700, 26); c.fillText("👉 " + lien.replace(/^https?:\/\//, ""), 120, y + 150, W - 240); } return; }
  const y = H - 470; c.fillStyle = "rgba(255,255,255,.12)"; rr(c, 80, y, W - 160, 250, 40); c.fill();
  c.fillStyle = "#fff"; c.font = F(800, 50); c.fillText("Rejoins-moi sur TB my Coach", 130, y + 85, W - 260);
  c.fillStyle = "#C9DAFF"; c.font = F(600, 34); c.fillText(`${joursOfferts()} jours offerts, sans carte bancaire${code ? ` · code d'invitation ${code}` : ""}`, 130, y + 140, W - 260);
  if (lien) { const u = lien.replace(/^https?:\/\//, ""); c.fillStyle = "#fff"; c.font = F(700, 30); c.fillText("👉 " + u, 130, y + 192, W - 260); }
  c.fillStyle = "rgba(255,255,255,.65)"; c.font = F(500, 26); c.fillText(`${CONFIG.coachName} · ${CONFIG.coachTitle}`, 130, y + 232, W - 260);
}
// Détail complet de la séance (exercices, séries, notes) qui tient dans la place disponible : la taille du texte s'adapte
function detailSeance(c, d, X, y, LW, bas) {
  const ex = (d.detail || []).filter(e => e.s?.length); if (!ex.length) return y;
  const serie = (e, z) => { const [kg, r, rpe] = z; return `${kg ? fr(kg, 1) + "×" : ""}${r ?? "–"}${e.u === "sec" ? "s" : e.u === "m" ? "m" : ""}${rpe ? "@" + String(rpe).replace(".", ",") : ""}`; };
  const txt = (e) => e.s.map(z => serie(e, z)).join(" · ");
  // Hauteur d'un exercice à la taille fs : nom et séries sur une ligne si ça tient, sinon séries en dessous (coupées en lignes)
  const plan = (fs) => ex.map(e => { c.font = F(800, fs); const wn = c.measureText(e.n).width; c.font = F(600, Math.round(fs * .9)); const t = txt(e), wt = c.measureText(t).width;
    const une = wn + wt + 30 <= LW; const nl = une ? 0 : Math.ceil(wt / LW); const note = e.note && fs >= 24; return { e, t, une, nl, note, h: fs * 1.25 + nl * fs * 1.1 + (note ? fs * 1.05 : 0) + fs * .3 }; });
  const dispo = bas - y - 46; let fs = 34, p = plan(fs);
  while (fs > 20 && p.reduce((a, x) => a + x.h, 0) > dispo) { fs -= 1; p = plan(fs); }
  let rows = p.length; if (p.reduce((a, x) => a + x.h, 0) > dispo) { let h = 0; rows = 0; for (const x of p) { if (h + x.h > dispo - 40) break; h += x.h; rows++; } }
  c.fillStyle = "rgba(255,255,255,.55)"; c.font = F(700, 26); c.fillText("MA SÉANCE", X, y + 22); y += 46;
  c.fillStyle = "rgba(255,255,255,.08)"; rr(c, X - 24, y - 10, LW + 48, p.slice(0, rows).reduce((a, x) => a + x.h, 0) + 20, 28); c.fill();
  p.slice(0, rows).forEach(({ e, t, une, nl, note }) => {
    c.fillStyle = "#fff"; c.font = F(800, fs); c.fillText(e.n, X, y + fs, une ? LW - c.measureText(t).width - 30 : LW);
    c.font = F(600, Math.round(fs * .9)); c.fillStyle = "#C9DAFF";
    if (une) { c.textAlign = "right"; c.fillText(t, X + LW, y + fs); c.textAlign = "left"; y += fs * 1.25; }
    else { y += fs * 1.25; const mots = t.split(" · "); let l = ""; const out = []; mots.forEach(m => { const z = l ? l + " · " + m : m; if (c.measureText(z).width > LW && l) { out.push(l); l = m; } else l = z; }); if (l) out.push(l); out.forEach(o => { c.fillText(o, X, y + fs * .95); y += fs * 1.1; }); }
    if (note) { c.fillStyle = "rgba(255,255,255,.7)"; c.font = `italic ${F(500, Math.round(fs * .8))}`; c.fillText("« " + e.note + " »", X, y + fs * .85, LW); y += fs * 1.05; }
    y += fs * .3;
  });
  if (ex.length > rows) { c.fillStyle = "rgba(255,255,255,.6)"; c.font = F(600, 26); c.fillText(`+ ${ex.length - rows} autre${ex.length - rows > 1 ? "s" : ""} exercice${ex.length - rows > 1 ? "s" : ""}`, X, y + 28); }
  return y;
}
export async function imageStory(type, d, { code = monCode(), qui = profil()?.pseudo || prenom(), lien = "" } = {}) {
  try {
    const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const c = cv.getContext("2d");
    try { await document.fonts?.ready; } catch { }
    fond(c, W, H); marque(c, 80, 190);
    const X = 80, LW = W - 160; let y = 330;
    if (type === "seance") {
      c.fillStyle = "#8FB4FF"; c.font = F(700, 34); c.fillText(`SÉANCE TERMINÉE${d.d ? " · " + fmtDate(d.d, { day: "numeric", month: "long" }).toUpperCase() : ""}`, X, y);
      const det = !!d.detail?.length, ft = det ? 64 : 92, lh = det ? 72 : 100;
      c.fillStyle = "#fff"; c.font = F(800, ft); const tl = lignes(c, d.titre, LW, 2); tl.forEach((l, i) => c.fillText(l, X, y + (det ? 80 : 110) + i * lh)); y += (det ? 80 : 110) + tl.length * lh;
      if (qui) { c.fillStyle = "rgba(255,255,255,.75)"; c.font = F(600, det ? 30 : 38); c.fillText(`par ${qui}`, X, y - (det ? 10 : 0)); y += det ? 20 : 40; }
      y += det ? 20 : 50;
      const tuiles = [[d.min ?? "–", "minutes"], [d.series || 0, "séries"], [d.tonnes ? fr(d.tonnes, 1) : "0", "tonnes"]], tw = (LW - 40) / 3;
      const th = det ? 140 : 250; tuiles.forEach(([v, l], i) => { const x = X + i * (tw + 20); c.fillStyle = "rgba(255,255,255,.1)"; rr(c, x, y, tw, th, det ? 28 : 36); c.fill(); c.fillStyle = "#fff"; c.font = F(800, det ? 60 : 96); c.fillText(String(v), x + 30, y + (det ? 78 : 140), tw - 50); c.fillStyle = "#C9DAFF"; c.font = F(600, det ? 26 : 36); c.fillText(l, x + 30, y + (det ? 118 : 205)); });
      y += th + (det ? 36 : 60);
      if (det) {
        // Médaille de la séance (comme en fin de séance) : disque du grade, nom, équivalent du tonnage, records
        const g = d.medaille ? GRADES.find(x => x.name === d.medaille) : null, kg = (d.tonnes || 0) * 1000;
        if (g) { const R = 62, cx = X + R, cy = y + R; const gr = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, g.color || "#4F82E0"); c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
          c.font = F(400, 64); c.textAlign = "center"; c.fillText(g.icon, cx, cy + 22); c.textAlign = "left";
          const tx = X + R * 2 + 30, tw2 = LW - R * 2 - 30;
          c.fillStyle = "rgba(255,255,255,.65)"; c.font = F(700, 24); c.fillText("GRADE DE LA SÉANCE", tx, y + 30);
          c.fillStyle = g.color || "#fff"; c.font = F(800, 56); c.fillText(g.name, tx, y + 88, tw2);
          if (kg >= 100) { const lk = weightLike(kg); c.fillStyle = "#fff"; c.font = F(600, 27); c.fillText(`${fr(d.tonnes, 1)} t : l'équivalent ${lk.txt.replace(/^une? /, m => m.startsWith("une") ? "d'une " : "d'un ").replace(/^(\d)/, "de $1")} ${lk.icon}`, tx, y + 126, tw2); }
          y += R * 2 + 26; }
        const nRec = d.nRecords || d.records?.length || 0;
        if (nRec) { c.fillStyle = "#fff"; c.font = F(700, 30); c.fillText(`🏆 ${nRec} record${nRec > 1 ? "s" : ""}${d.records?.length ? " · " + d.records.slice(0, 3).join(", ") : ""}`, X, y + 30, LW); y += 54; }
        detailSeance(c, d, X, y, LW, H - 280); pied(c, W, H, code, lien, true); return await new Promise(res => cv.toBlob(res, "image/png")); }
      const g = d.medaille ? GRADES.find(x => x.name === d.medaille) : null;
      if (g) { const t = `${g.icon}  Grade ${g.name}`; c.font = F(800, 46); const w = c.measureText(t).width + 80; const gr = c.createLinearGradient(X, y, X + w, y); gr.addColorStop(0, "#2E5FC9"); gr.addColorStop(1, "#4F82E0"); c.fillStyle = gr; rr(c, X, y, w, 96, 48); c.fill(); c.fillStyle = "#fff"; c.fillText(t, X + 40, y + 64); y += 140; }
      if (d.records?.length) { c.fillStyle = "#fff"; c.font = F(800, 46); c.fillText("🏆 Record battu", X, y + 40); c.font = F(600, 40); c.fillStyle = "#C9DAFF"; d.records.slice(0, 2).forEach((r, i) => c.fillText(r, X, y + 100 + i * 54, LW)); y += 100 + Math.min(2, d.records.length) * 54 + 30; }
      if (d.top?.length && y < H - 640) { c.fillStyle = "rgba(255,255,255,.55)"; c.font = F(700, 30); c.fillText("AU PROGRAMME", X, y + 30); c.fillStyle = "#fff"; c.font = F(600, 40); d.top.forEach((t, i) => { if (y + 90 + i * 56 < H - 520) c.fillText("• " + t, X, y + 90 + i * 56, LW); }); }
    } else {
      c.fillStyle = "#8FB4FF"; c.font = F(700, 34); c.fillText(d.routine ? "MA SÉANCE" : "MON PROGRAMME D'ENTRAÎNEMENT", X, y);
      c.fillStyle = "#fff"; c.font = F(800, 80); const tl = lignes(c, d.n || "Mon programme", LW, 2); tl.forEach((l, i) => c.fillText(l, X, y + 100 + i * 90)); y += 100 + tl.length * 90;
      const meta = [d.split, d.lvl, d.s?.length && !d.routine ? `${d.s.length} séances / semaine` : null, d.routine && d.s?.[0]?.[2]?.length ? `${d.s[0][2].length} exercices` : null, d.sem ? `${d.sem} semaines` : null].filter(Boolean).join(" · ");
      if (meta) { c.fillStyle = "#C9DAFF"; c.font = F(600, 36); c.fillText(meta, X, y, LW); y += 60; }
      if (d.routine && d.s?.[0]) {
        const exs = d.s[0][2] || [], n = Math.min(exs.length, Math.max(1, Math.floor((H - 560 - y) / 92)));
        exs.slice(0, n).forEach((e, k) => { const yy = y + k * 92; c.fillStyle = "rgba(255,255,255,.09)"; rr(c, X, yy, LW, 78, 24); c.fill();
          c.fillStyle = "#fff"; c.font = F(700, 38); c.fillText(e[0], X + 30, yy + 51, LW - (e[2] ? 300 : 60));
          if (e[2]) { c.fillStyle = "#C9DAFF"; c.font = F(700, 36); c.textAlign = "right"; c.fillText(e[2], X + LW - 30, yy + 51, 250); c.textAlign = "left"; } });
        if (exs.length > n) { c.fillStyle = "rgba(255,255,255,.6)"; c.font = F(600, 32); c.fillText(`+ ${exs.length - n} autre${exs.length - n > 1 ? "s" : ""} exercice${exs.length - n > 1 ? "s" : ""}`, X, y + n * 92 + 30); }
        pied(c, W, H, code, lien); return await new Promise(res => cv.toBlob(res, "image/png"));
      }
      const ses = (d.s || []).slice(0, 5), place = H - 560 - y, h1 = Math.min(250, Math.floor(place / Math.max(1, ses.length)) - 20);
      ses.forEach(([nom, jour, exs]) => { c.fillStyle = "rgba(255,255,255,.09)"; rr(c, X, y, LW, h1, 30); c.fill();
        c.fillStyle = "#fff"; c.font = F(800, 42); c.fillText(nom + (jour ? ` · ${jour}` : ""), X + 34, y + 62, LW - 60);
        c.fillStyle = "rgba(255,255,255,.8)"; c.font = F(500, 32); const t = (exs || []).map(e => e[0]).join(" · "); lignes(c, t, LW - 68, Math.max(1, Math.floor((h1 - 90) / 42))).forEach((l, i) => c.fillText(l, X + 34, y + 112 + i * 42));
        y += h1 + 20; });
      if ((d.s || []).length > 5) { c.fillStyle = "rgba(255,255,255,.6)"; c.font = F(600, 32); c.fillText(`+ ${d.s.length - 5} autre${d.s.length > 6 ? "s" : ""} séance${d.s.length > 6 ? "s" : ""}`, X, y + 30); }
      if (!d.s?.length && d.id) { c.fillStyle = "rgba(255,255,255,.8)"; c.font = F(500, 40); lignes(c, "Un des programmes de Thomas Boulet, à suivre dans l'app.", LW, 2).forEach((l, i) => c.fillText(l, X, y + 40 + i * 52)); }
    }
    pied(c, W, H, code, lien);
    return await new Promise(r => cv.toBlob(r, "image/png"));
  } catch (e) { console.warn(e); toast("Image impossible à créer sur ce téléphone"); return null; }
}

// ---------- Séance : story, envoi à un ami, publication ----------
const cleSeance = (w) => "w:" + (w.start || w.end || w.id);
export const recapDe = (w) => SO.recapSeance(w, { medaille: gradeOf(w.volume || 0)?.name });
// Publication automatique à la fin d'une séance, si le membre l'a choisie (réglage « auto ») et a un profil social
// Toutes les séances (muscu et cardio) sont publiées dans la communauté : règle du groupe TB my Coach.
// Sans profil de communauté, on en crée un (prénom, premier avatar) au premier envoi.
async function assurerProfil() {
  const so = soc(); if (so.profil?.pseudo && so.profil.communaute !== false && so.profil.visibilite === "communaute") return true;
  const c = await cloud(); if (!c || !(await c.currentSession())) return false;
  const p = await c.socProfil(so.profil?.pseudo && so.profil.pseudo !== "Membre" ? so.profil.pseudo : SO.pseudoParDefaut(S().profile?.name), so.profil?.avatar || SO.AVATARS[0], true, "communaute");
  update(st => { st.social = { ...(st.social || {}), profil: p, code: p.code, auto: true }; }); return true;
}
export async function autoPublier(w) {
  if (!w || proxyActive()) return; try { if (!(await assurerProfil())) return; } catch { return; }
  await publier(w, "communaute").catch(() => { });
  const b = R.route === "done" && document.querySelector('[data-a="soc-pub-w"]'), vis = SO.VISIBILITES.find(v => v[0] === so.profil.visibilite)?.[1];
  if (b && (S().socialPubs || {})[cleSeance(w)]) b.textContent = `✅ Publiée · ${vis} · changer`;
}
export async function publierCardio(jour, a) {
  try { if (!(await assurerProfil())) return; const c = await cloud();
    const id = await c.socPublier("c:" + (a.at || jour + a.n), { titre: String(a.n || "Cardio").split(" · ")[0], sport: String(a.n || "").split(" · ")[1] || "", min: a.min || 0, ...(a.km ? { km: a.km } : {}), kcal: EN.actKcal(a) || undefined, fait: a.at ? new Date(new Date(a.at).getTime() - (a.min || 0) * 6e4).toISOString() : undefined }, "communaute", "cardio");
    update(st => { st.socialPubs = { ...(st.socialPubs || {}), ["c:" + (a.at || jour + a.n)]: { id, vis: "communaute" } }; }); FIL.amis = FIL.communaute = FIL.moi = null;
  } catch { }
}
window.addEventListener("cxs:cardio-fait", (e) => { const d = e.detail || {}; if (d.a) publierCardio(d.jour, d.a); });
// Anciennes publications sans détail des séries : on les republie une fois depuis l'historique du téléphone
let REPARE = false;
async function reparerDetails() {
  if (REPARE) return; REPARE = true;
  try {
    const pubs = S().socialPubs || {}, ws = S().workouts || [], c = await cloud(); let n = 0;
    for (const w of ws) { const p = pubs[cleSeance(w)]; if (!p || p.detail) continue;
      const r = recapDe(w); if (!r.detail?.length) continue;
      await c.socPublier(cleSeance(w), r, p.vis || "communaute"); update(st => { st.socialPubs[cleSeance(w)] = { ...p, detail: 1 }; }); n++; }
    if (n) { FIL.amis = FIL.communaute = FIL.moi = null; rerender(); }
  } catch { REPARE = false; }
}
async function publier(w, vis) {
  const c = await cloud(); if (!c || !(await c.currentSession())) throw new Error("Connexion requise");
  const id = await c.socPublier(cleSeance(w), recapDe(w), vis);
  update(st => { st.socialPubs = { ...(st.socialPubs || {}), [cleSeance(w)]: { id, vis } }; });
  FIL.amis = FIL.communaute = FIL.moi = null; return id;
}
// Lien à partager : court (enregistré sur le serveur, ?p=XXXXXXXX), sinon le lien long qui porte les données (hors connexion, sans compte)
async function lienDe({ code, seance = null, programme = null }) {
  const de = profil()?.pseudo && profil().pseudo !== "Membre" ? profil().pseudo : prenom();
  try {
    const c = await cloud();
    if (c && await c.currentSession()) {
      const id = await c.partageCreer(seance ? "seance" : "programme", { ...(seance || programme), de: SO.sansContact(de, 30) });
      if (SO.ID_PARTAGE.test(id || "")) return SO.lienCourt(baseApp(), id);
    }
  } catch (e) { console.warn("Lien court indisponible :", e.message); }
  return SO.lienPartage(baseApp(), { code, seance, programme, de });
}
// Bloc affiché sur l'écran « Séance terminée »
export function blocPartageSeance(w) {
  const pub = (S().socialPubs || {})[cleSeance(w)], vis = SO.VISIBILITES.find(v => v[0] === pub?.vis)?.[1];
  return `<div style="width:100%;max-width:560px;text-align:left;background:rgba(255,255,255,.12);border-radius:18px;padding:14px">
    <b>📣 Partage ta séance</b><p class="small" style="opacity:.85;margin:6px 0 10px">En story sur tes réseaux, ou à un ami : il reçoit une invitation avec ${joursOfferts()} jours offerts.</p>
    <div class="row" style="gap:8px"><button class="btn btn-sm" style="background:#fff;color:var(--red);flex:1" data-a="soc-story-w">📸 Story</button><button class="btn btn-sm" style="background:rgba(255,255,255,.2);color:#fff;flex:1" data-a="soc-ami-w">💬 À un ami</button></div>
    <button class="btn btn-sm mt8" style="width:100%;background:rgba(255,255,255,.2);color:#fff" data-a="soc-pub-w">${pub ? `✅ Publiée · ${esc(vis || "")} · changer` : "🏟️ Publier dans la communauté"}</button></div>`;
}
const derniere = () => S().workouts.at(-1);
// Séance à partager : celle de l'historique désignée par sa clé (data-k), sinon la dernière terminée
const seanceDe = (d) => (d?.k && S().workouts.find(w => cleSeance(w) === d.k)) || (d?.k ? null : derniere());
actions["soc-story-w"] = async (b, d) => { const w = seanceDe(d); if (!w) return; closeSheet(); toast("Image en préparation…"); const code = await assurerCode(), r = recapDe(w);
  const notes = Object.fromEntries((w.exercises || []).map(e => [e.name, e.myNote || (e.sets || []).find(z => z.note)?.note || ""]));
  const rr2 = { ...r, nRecords: (w.records || []).length + (w.exercises || []).reduce((a, e) => a + (e.recsHit || []).length, 0), detail: (r.detail || []).map(e => ({ ...e, note: (notes[e.n] || "").slice(0, 70) })) };
  const lien = await lienDe({ code, seance: r }), blob = await imageStory("seance", rr2, { code, lien }); if (!blob) return;
  await partagerImage(blob, "ma-seance-tb-my-coach.png", SO.texteSeance(r, lien)); buzz(15); };
actions["soc-ami-w"] = async (b, d) => { const w = seanceDe(d); if (!w) return; closeSheet(); const code = await assurerCode(), r = recapDe(w);
  await partagerTexte(SO.texteSeance(r, await lienDe({ code, seance: r })), "Ma séance"); };
actions["soc-pub-w"] = async (b, d) => {
  const w = seanceDe(d); if (!w) return; await charger();
  if (!ETAT.connecte) return sheet(`<h2 class="h2">Publier ta séance</h2><p class="small muted mt8">Crée ton compte TB my Coach (gratuit) pour publier tes séances et encourager les autres membres.</p><button class="btn btn-red mt12" data-a="go" data-r="account">Créer mon compte</button>`);
  if (ETAT.absent) return toast("La communauté arrive très bientôt");
  if (!profil()) return feuilleProfil(() => d?.k ? actions["soc-pub-w"](b, d) : go("done"));
  const pub = (S().socialPubs || {})[cleSeance(w)];
  sheet(`<h2 class="h2">Qui voit cette séance ?</h2><p class="xs muted mt4">Seuls des chiffres d'entraînement sont publiés : titre, durée, séries, tonnage, records. Jamais ton poids ni ta santé.</p>
    <div class="list mt12">${SO.VISIBILITES.map(([v, l]) => `<button class="li" data-a="soc-pub-vis" data-v="${v}" data-k="${esc(cleSeance(w))}"><span class="em">${v === "prive" ? "🔒" : v === "amis" ? "🫂" : "🏟️"}</span><span class="grow"><b>${l}</b>${v === "prive" && pub ? `<br><span class="xs muted">Retire la publication</span>` : ""}</span>${(pub?.vis || "prive") === v ? "✓" : ""}</button>`).join("")}</div>`);
};
actions["soc-pub-vis"] = async (b, d) => {
  const w = seanceDe(d); if (!w) return closeSheet(); const pub = (S().socialPubs || {})[cleSeance(w)];
  try {
    if (d.v === "prive") { if (pub) { const c = await cloud(); await c.socRetirer(pub.id); update(st => { delete st.socialPubs[cleSeance(w)]; }); FIL.amis = FIL.communaute = FIL.moi = null; } toast("Séance gardée pour toi"); }
    else { await publier(w, d.v); buzz(20); toast(d.v === "amis" ? "Publiée pour tes amis 🫂" : "Publiée dans la communauté 🏟️"); }
  } catch (e) { toast("Publication impossible : " + e.message); }
  closeSheet(); if (R.route === "done") go("done");
};
// Historique : partager une séance faite il y a des jours ou des semaines
actions["soc-hist"] = (b, d) => {
  const w = seanceDe(d); if (!w) return toast("Séance introuvable");
  const pub = (S().socialPubs || {})[cleSeance(w)], quand = new Date(w.end || w.start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  sheet(`<h2 class="h2">📤 Partager cette séance</h2><p class="small muted mt4">${esc(w.title)} · ${esc(quand)}</p>
    <button class="btn btn-red mt12" data-a="soc-story-w" data-k="${esc(d.k)}">📸 En story (image)</button>
    <button class="btn btn-line mt8" data-a="soc-ami-w" data-k="${esc(d.k)}">💬 Envoyer à un ami</button>
    <button class="btn btn-line mt8" data-a="soc-pub-w" data-k="${esc(d.k)}">${pub ? "✅ Publiée dans la communauté · changer" : "🏟️ Publier dans la communauté"}</button>`);
};

// ---------- Programme : story et lien ----------
export function programmePourPartage(p) {
  const catalogue = !p.custom && !(S().customPrograms || []).some(x => x.id === p.id);
  return SO.programmePublic(p, catalogue ? { catalogue: true } : { schema: (r) => { try { return E.schemeFor(p, r, 1); } catch { return ""; } } });
}
actions["soc-prog"] = async (b, d) => {
  await E.loadPrograms(); const p = E.program(d.id || S().plan?.programId); if (!p) return toast("Choisis d'abord un programme");
  sheet(`<h2 class="h2">📤 Montrer mon programme</h2><p class="small muted mt4">« ${esc(p.name)} ». La personne le voit, et peut le suivre avec ${joursOfferts()} jours offerts.</p>
    <button class="btn btn-red mt12" data-a="soc-prog-story" data-id="${esc(p.id)}">📸 En story (image)</button>
    <button class="btn btn-line mt8" data-a="soc-prog-lien" data-id="${esc(p.id)}">💬 Envoyer le lien à un ami</button>`);
};
async function progDonnees(id) { await E.loadPrograms(); const p = E.program(id); if (!p) return null; const pub = programmePourPartage(p); const vue = pub.s ? pub : { ...SO.programmePublic(p, { schema: (r) => { try { return E.schemeFor(p, r, 1); } catch { return ""; } } }), id: p.id }; return { p, pub, vue }; }
actions["soc-prog-story"] = async (b, d) => { const x = await progDonnees(d.id); if (!x) return; closeSheet(); toast("Image en préparation…"); const code = await assurerCode();
  const blob = await imageStory("programme", x.vue, { code }); if (!blob) return; await partagerImage(blob, "mon-programme-tb-my-coach.png", SO.texteProgramme(x.p.name, await lienDe({ code, programme: x.pub }))); };
actions["soc-prog-lien"] = async (b, d) => { const x = await progDonnees(d.id); if (!x) return; closeSheet(); const code = await assurerCode();
  await partagerTexte(SO.texteProgramme(x.p.name, await lienDe({ code, programme: x.pub })), "Mon programme"); };

// ---------- Routine : une séance précise du programme (pas tout le programme) ----------
async function routineDonnees(id, sem, i) {
  await E.loadPrograms(); const p = E.program(id), se = p?.s?.[i]; if (!se) return null;
  const pub = SO.programmePublic({ name: se[0], lvl: p.lvl, routine: 1, s: [se] }, { schema: (r) => { try { return E.schemeFor(p, r, sem || 1); } catch { return ""; } } });
  pub.s = pub.s.map(([n, , exs]) => [n, null, exs.map(e => [S().swaps?.[e[0]] || e[0], ...e.slice(1)])]);
  return { p, se, pub };
}
actions["soc-routine"] = async (b, d) => {
  const x = await routineDonnees(d.id, +d.w, +d.i); if (!x) return toast("Séance introuvable");
  sheet(`<h2 class="h2">📤 Partager cette séance</h2><p class="small muted mt4">« ${esc(x.se[0])} » : ${x.pub.s[0][2].length} exercices, avec les séries et répétitions. Juste cette séance, pas tout le programme.</p>
    <button class="btn btn-red mt12" data-a="soc-rout-story" data-id="${esc(d.id)}" data-w="${esc(d.w)}" data-i="${esc(d.i)}">📸 En story (image)</button>
    <button class="btn btn-line mt8" data-a="soc-rout-lien" data-id="${esc(d.id)}" data-w="${esc(d.w)}" data-i="${esc(d.i)}">💬 Envoyer à un ami</button>
    <button class="btn btn-ghost mt8" data-a="soc-prog" data-id="${esc(d.id)}">Partager tout le programme</button>`);
};
actions["soc-rout-story"] = async (b, d) => { const x = await routineDonnees(d.id, +d.w, +d.i); if (!x) return; closeSheet(); toast("Image en préparation…"); const code = await assurerCode();
  const blob = await imageStory("programme", x.pub, { code }); if (!blob) return; await partagerImage(blob, "ma-seance-tb-my-coach.png", SO.texteRoutine(x.pub.n, await lienDe({ code, programme: x.pub }))); buzz(15); };
actions["soc-rout-lien"] = async (b, d) => { const x = await routineDonnees(d.id, +d.w, +d.i); if (!x) return; closeSheet(); const code = await assurerCode();
  await partagerTexte(SO.texteRoutine(x.pub.n, await lienDe({ code, programme: x.pub })), "Ma séance"); };

// ---------- Page d'arrivée d'une personne invitée ----------
routes.partage = async () => {
  if (S().invite?.partageId) {
    $app.innerHTML = `<main class="page"><p class="empty small">Chargement du partage…</p></main>`;
    let lu = null; try { const c = await cloud(); lu = SO.lirePartage(await c.partageLire(S().invite.partageId)); } catch (e) { console.warn("Partage illisible :", e.message); }
    update(st => { st.invite = { ...st.invite, partageId: null, ...(lu?.code && !st.invite.code ? { code: lu.code } : {}), ...(lu?.seance ? { seance: lu.seance } : {}), ...(lu?.programme ? { programme: lu.programme } : {}) }; });
    if (!lu) { toast("Ce lien de partage n'existe plus"); return go(S().profile ? "home" : "onboarding"); }
  }
  const inv = S().invite || {}, moi = !!S().profile;
  if (!inv.seance && !inv.programme) return go(moi ? "home" : "onboarding");
  const de = esc(inv.seance?.de || inv.programme?.de || ""), cta = moi ? "" : `<button class="btn btn-red mt16" data-a="soc-arrivee">🚀 Commencer mes ${joursOfferts()} jours offerts</button><p class="xs muted center mt8">Sans carte bancaire. Programme, charges calculées, nutrition.</p>`;
  let corps = "";
  if (inv.seance) {
    const r = inv.seance;
    corps = `<div class="card grad mt12"><div class="lbl">💪 Séance terminée${r.d ? " · " + fmtDate(r.d, { day: "numeric", month: "long" }) : ""}</div><h2 class="h2 mt4">${esc(r.titre)}</h2>${de ? `<p class="small mt4" style="opacity:.9">par ${de}</p>` : ""}
      <div class="stat3 mt12"><div><b>${r.min ?? "–"}</b><span>minutes</span></div><div><b>${r.series}</b><span>séries</span></div><div><b>${fr(r.tonnes, 1)}</b><span>tonnes</span></div></div>
      ${r.medaille ? `<p class="small mt8">Grade de la séance : <b>${esc(r.medaille)}</b></p>` : ""}${r.records?.length ? `<p class="small mt4">🏆 Record : <b>${esc(r.records.join(", "))}</b></p>` : ""}</div>
      ${r.top?.length ? `<div class="card mt12"><div class="lbl">Au programme</div>${r.top.map(t => `<p class="small" style="margin:6px 0 0">• ${esc(t)}</p>`).join("")}</div>` : ""}
      <div class="card mt12"><b>${de ? de + " s'entraîne" : "On s'entraîne"} avec TB my Coach</b><p class="small muted mt4" style="margin-bottom:0">L'app de ${esc(CONFIG.coachName)} : ton programme, tes charges calculées à chaque séance, ta nutrition. ${inv.code ? `<b>${joursOfferts()} jours offerts</b>, sans carte bancaire, et vous serez amis dans l'app pour vous encourager.` : ""}</p></div>`;
  } else {
    const pr = inv.programme; let vue = pr;
    if (pr.id && !pr.s) { await E.loadPrograms(); const p = E.program(pr.id); vue = p ? { ...SO.programmePublic(p, { schema: (r) => { try { return E.schemeFor(p, r, 1); } catch { return ""; } } }), desc: p.desc } : { n: "Programme introuvable", s: [] }; }
    corps = `<div class="card grad mt12"><div class="lbl">${vue.routine ? "🏋️ Séance partagée" : "📋 Programme partagé"}${de ? " par " + de : ""}</div><h2 class="h2 mt4">${esc(vue.n)}</h2><p class="small mt4" style="opacity:.9">${esc([vue.split, vue.lvl, vue.s?.length && !vue.routine ? vue.s.length + " séances / semaine" : null].filter(Boolean).join(" · "))}</p>${vue.desc ? `<p class="small mt8" style="opacity:.9;margin-bottom:0">${esc(vue.desc)}</p>` : ""}</div>
      ${(vue.s || []).map(([n, j, exs]) => `<div class="card mt12"><div class="row between"><b>${esc(n)}</b>${j ? `<span class="tag">${esc(j)}</span>` : ""}</div>${exs.map(e => `<div class="row between small mt8"><span>${esc(e[0])}</span>${e[2] ? `<span class="muted">${esc(e[2])}</span>` : ""}</div>`).join("")}</div>`).join("")}
      ${moi ? `<button class="btn btn-red mt16" data-a="soc-prog-suivre">✅ ${vue.routine ? "Ajouter cette séance à mes programmes" : "Ajouter à mes programmes et le suivre"}</button>` : `<p class="small muted mt12">Crée ton profil : ce programme t'attendra sur ton accueil, prêt à suivre.</p>`}`;
  }
  $app.innerHTML = (moi ? header("Partage", "", { back: "home" }) : `<header class="top"><div class="row1"><h1>TB my <span style="color:var(--red)">Coach</span></h1></div></header>`) + `<main class="page">${corps}${cta}
    ${moi ? `<button class="btn btn-ghost mt8" data-a="soc-arrivee-fin">Fermer</button>` : ""}</main>${moi ? tabbar("home") : ""}`;
  update(st => { if (st.invite) st.invite.vu = true; });
};
actions["soc-arrivee"] = () => go("onboarding");
actions["soc-arrivee-fin"] = () => { update(st => { if (st.invite) { st.invite.seance = null; if (!st.invite.programme?.s && !st.invite.programme?.id) st.invite.programme = null; } }); go("home"); };
actions["soc-prog-suivre"] = async () => {
  const pr = S().invite?.programme; if (!pr) return go("home");
  await E.loadPrograms();
  let id = pr.id && !pr.s ? pr.id : null;
  if (id && !E.program(id)) return toast("Ce programme n'existe plus");
  if (!id) { const imp = SO.programmeImportable(pr, { id: "recu-" + Date.now(), de: pr.de }); if (!imp) return toast("Programme illisible"); id = imp.id; update(st => { st.customPrograms = [...(st.customPrograms || []), imp]; }); }
  if (S().plan?.programId && S().plan.programId !== id && !confirm("Suivre ce programme à la place de ton programme actuel ? Tes séances passées sont gardées.")) { update(st => { st.invite.programme = null; }); toast("Programme ajouté à tes programmes"); return go("carnet"); }
  update(st => { st.plan = { programId: id, startedAt: today(), week: 1, idx: 0, cycle: 1 }; st.invite.programme = null; });
  buzz(20); toast("Programme prêt : ta première séance t'attend"); go("carnet");
};
// Carte de l'accueil : programme reçu en attente, encouragements reçus, demandes d'ami
export function carteSociale() {
  const inv = S().invite, r = soc().resume;
  if (inv?.programme && (inv.programme.s || inv.programme.id)) return `<button class="card tap grad mt12" data-a="go" data-r="partage" style="display:flex;gap:12px;align-items:center;text-align:left;width:100%"><span style="font-size:28px">📋</span><span class="grow"><b>Programme reçu${inv.programme.de ? " de " + esc(inv.programme.de) : ""}</b><br><span class="small" style="opacity:.9">Le voir et le suivre</span></span>›</button>`;
  if (!r) return "";
  const bits = [r.recusDepuis ? `🔥 ${r.recusDepuis} encouragement${r.recusDepuis > 1 ? "s" : ""} reçu${r.recusDepuis > 1 ? "s" : ""}` : "", r.demandes ? `🫂 ${r.demandes} demande${r.demandes > 1 ? "s" : ""} d'ami` : ""].filter(Boolean);
  const q = SO.serieSupporter(r.parJour, today());
  if (!bits.length && !q.enDanger) return "";
  return `<button class="card tap mt12" data-a="go" data-r="${r.demandes ? "amis" : "communaute"}" style="display:flex;gap:12px;align-items:center;text-align:left;width:100%"><span style="font-size:28px">🏟️</span><span class="grow"><b>${bits.join(" · ") || "Ta flamme de supporter s'éteint ce soir"}</b><br><span class="small muted">${q.enDanger ? `Encourage encore ${SO.QUETE_JOUR - q.aujourdhui} séance${SO.QUETE_JOUR - q.aujourdhui > 1 ? "s" : ""} pour garder ta série de ${q.jours} jour${q.jours > 1 ? "s" : ""}` : "Voir la communauté"}</span></span>›</button>`;
}

// ---------- Profil social (pseudo, avatar, communauté) ----------
function feuilleProfil(apres = null) {
  const p = profil() || {}, so = soc(), av = p.avatar || SO.AVATARS[0];
  sheet(`<h2 class="h2">${p.pseudo ? "Mon profil dans la communauté" : "Rejoindre la communauté"}</h2>
    <p class="xs muted mt4">Personne ne voit ton nom, ton e-mail ni ton poids. Pas de messages privés entre membres : on s'encourage par des gestes et de courts commentaires sous les séances. <a href="cgv.html#communaute" target="_blank" rel="noopener">Règles de la communauté</a> · <a href="confidentialite.html#communaute" target="_blank" rel="noopener">Tes données</a></p>
    <form data-f="soc-profil" class="mt12">
      <label class="lbl">Pseudo</label><input class="inp mt4" name="pseudo" maxlength="20" required value="${esc(p.pseudo && p.pseudo !== "Membre" ? p.pseudo : SO.pseudoParDefaut(S().profile?.name))}" autocomplete="off" style="width:100%">
      <label class="lbl mt12" style="display:block">Avatar</label><div class="chips wrap mt4">${SO.AVATARS.map(a => `<label class="chip ${a === av ? "on" : ""}" style="font-size:22px;cursor:pointer"><input type="radio" name="avatar" value="${a}" ${a === av ? "checked" : ""} style="display:none" onchange="this.closest('.chips').querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c.contains(this)))">${a}</label>`).join("")}</div>
      <div class="card soft mt12"><p class="small" style="margin:0">🏟️ <b>Toutes tes séances</b> (muscu et cardio) sont publiées dans la communauté : c'est la règle du groupe, pour qu'on se voie avancer et qu'on s'encourage. Seuls ton pseudo, ton avatar et les chiffres de la séance sont visibles.</p></div>
      <button class="btn btn-red mt16" type="submit">Enregistrer</button></form>
    ${p.pseudo ? `<button class="btn btn-ghost mt8" data-a="soc-effacer" style="color:var(--red)">Effacer mes données de la communauté</button>` : ""}`);
  feuilleProfil.apres = apres;
}
forms["soc-profil"] = async (v) => {
  const err = SO.pseudoErreur(v.pseudo); if (err) return toast(err);
  try { const c = await cloud(); const p = await c.socProfil(v.pseudo.trim(), v.avatar || SO.AVATARS[0], true, "communaute");
    update(st => { st.social = { ...(st.social || {}), profil: p, code: p.code, auto: true }; }); ETAT.moi = { ...(ETAT.moi || {}), profil: p }; FIL.amis = FIL.communaute = FIL.moi = null;
    closeSheet(); buzz(20); toast(p.communaute ? "Bienvenue dans la communauté 🏟️" : "Profil enregistré"); const a = feuilleProfil.apres; feuilleProfil.apres = null; if (a) a(); else rerender();
  } catch (e) { toast(e.message === "Pseudo refusé" ? "Ce pseudo n'est pas accepté" : "Enregistrement impossible : " + e.message); }
};
actions["soc-profil"] = () => feuilleProfil();

// ---------- Communauté ----------
const etatBloquant = (quoi) => {
  if (ETAT.connecte === false) return `<div class="card mt12 center"><div style="font-size:42px">🏟️</div><b class="h3">${quoi}</b><p class="small muted mt8">Crée ton compte (gratuit) pour retrouver tes amis, voir les séances des membres et les encourager.</p><button class="btn btn-red mt8" data-a="go" data-r="account">Créer mon compte ou me connecter</button></div>`;
  if (ETAT.absent) return `<div class="card mt12 center"><div style="font-size:42px">🚧</div><b class="h3">Bientôt disponible</b><p class="small muted mt8">La communauté ouvre très bientôt. En attendant, partage tes séances en story et invite tes amis : ton code sera prêt à l'ouverture.</p><button class="btn btn-line mt8" data-a="go" data-r="parrainage">🎁 Inviter et gagner</button></div>`;
  if (ETAT.err) return `<div class="card mt12 center"><p class="small muted">Connexion au serveur impossible pour l'instant (${esc(ETAT.err)}).</p><button class="btn btn-line btn-sm" data-a="soc-reload">Réessayer</button></div>`;
  return null;
};
function carteJeu() {
  const m = ETAT.moi || {}, niv = SO.niveauSupporter(m.donnes || 0), q = SO.serieSupporter(m.par_jour, today());
  const pts = Array.from({ length: SO.QUETE_JOUR }, (_, i) => `<span style="width:28px;height:28px;border-radius:50%;display:inline-grid;place-items:center;font-size:15px;background:${i < q.aujourdhui ? "var(--red)" : "var(--line)"};color:#fff">${i < q.aujourdhui ? "🔥" : ""}</span>`).join("");
  return `<div class="card mt12"><div class="row between"><div><div class="lbl">Quête du jour</div><b>Encourage ${SO.QUETE_JOUR} séances</b></div><div class="row" style="gap:6px">${pts}</div></div>
    <div class="row between mt12"><span class="small">${q.jours ? `🔥 Série de <b>${q.jours} jour${q.jours > 1 ? "s" : ""}</b>${q.enDanger ? " · à garder ce soir" : ""}` : "Remplis la quête pour lancer ta série"}</span><span class="small muted">💛 ${m.recus || 0} reçus</span></div>
    <div class="row between mt12"><span class="small">${niv.em} <b>${esc(niv.nom)}</b> · ${niv.n} encouragement${niv.n > 1 ? "s" : ""} donné${niv.n > 1 ? "s" : ""}</span>${niv.suivant ? `<span class="xs muted">encore ${niv.manque} → ${niv.suivant.em}</span>` : ""}</div>
    <div class="gauge mt4"><i style="width:${Math.round(niv.pct * 100)}%"></i></div></div>`;
}
function carteActivite(a) {
  const d = a.data || {}, res = SO.resumeReactions(a.reactions), mes = new Set(a.mes_reactions || []);
  const stats = [d.sport ? esc(d.sport) : "", d.min ? `⏱️ ${d.min} min` : "", d.km ? `${fr(d.km, 1)} km` : "", d.kcal ? `🔥 ${fr(d.kcal)} kcal` : "", d.series ? `${d.series} séries` : "", d.tonnes ? `${fr(d.tonnes, 1)} t` : "", d.medaille ? `Grade ${esc(d.medaille)}` : ""].filter(Boolean);
  return `<div class="card mt12" data-act="${a.id}" data-a="soc-detail" data-id="${a.id}" style="cursor:pointer"><div class="row" style="gap:10px"><span class="avatar" style="font-size:22px">${esc(a.avatar)}</span><div class="grow" style="min-width:0"><b>${esc(a.pseudo)}</b>${a.moi ? ` <span class="tag">moi</span>` : a.ami ? ` <span class="tag r">ami</span>` : ""}<br><span class="xs muted">${quandFait(a)}</span></div>
      ${a.moi || isCoach() ? `<button class="icon-btn" data-a="soc-menu" data-id="${a.id}" data-moi="${a.moi ? 1 : 0}" aria-label="Options">⋯</button>` : ""}</div>
    <p class="mt8" style="margin-bottom:4px"><b>${a.type === "cardio" ? "🏃" : "💪"} ${esc(d.titre || "Séance")}</b></p>
    ${stats.length ? `<div class="chips wrap">${stats.map(s => `<span class="tag">${s}</span>`).join("")}</div>` : ""}
    ${d.records?.length ? `<p class="small mt8" style="margin-bottom:0">🏆 Record : <b>${esc(d.records.join(", "))}</b></p>` : ""}
    ${d.detail?.length ? `<button class="link small mt8" data-a="soc-detail" data-id="${a.id}">Voir la séance complète (${d.detail.length} exercice${d.detail.length > 1 ? "s" : ""})</button>` : d.top?.length ? `<p class="xs muted mt8" style="margin-bottom:0">${esc(d.top.join(" · "))}</p>` : ""}
    ${res.length ? `<p class="xs muted mt8" style="margin-bottom:0">${res.map(r => `${r.em} ${r.n}`).join("  ")}</p>` : ""}
    ${a.moi ? "" : `<div class="row mt8" style="gap:6px;justify-content:space-between">${SO.REACTIONS.map(r => `<button class="chip ${mes.has(r.id) ? "on" : ""}" data-a="soc-r" data-id="${a.id}" data-e="${r.id}" aria-label="${esc(r.l)}" aria-pressed="${mes.has(r.id)}" style="font-size:20px;flex:1;justify-content:center">${r.em}</button>`).join("")}</div>`}
    <button class="link xs mt8" data-a="soc-com" data-id="${a.id}">💬 ${NBC[a.id] ? `${NBC[a.id]} commentaire${NBC[a.id] > 1 ? "s" : ""}` : "Commenter"}</button></div>`;
}
// Onglet Communauté (barre du bas) : le fil, les amis, les invitations
const COMM_MODES = [["communaute", "🏟️ Fil"], ["amis", "🫂 Amis"], ["parrainage", "🎁 Inviter"]];
actions["comm-mode"] = (b, d) => { if (R.route !== d.v) go(d.v); };
routes.communaute = async () => {
  if (["amis", "communaute", "moi"].includes(R.param)) onglet = R.param;
  $app.innerHTML = header("Communauté", "", { actions: `<button class="pill ic" data-a="soc-profil" aria-label="Mon profil de la communauté">👤</button>` }) + `<main class="page">${modeBar(COMM_MODES, "communaute", "comm-mode")}<div id="comm"><p class="empty small">Chargement…</p></div></main>${tabbar("communaute")}`;
  await charger();
  const bloc = etatBloquant("La communauté TB my Coach");
  let body;
  if (bloc) body = bloc;
  else if (!profil() || profil().pseudo === "Membre" && !profil().communaute) body = `<div class="card grad mt12"><div style="font-size:40px">🏟️</div><b class="h2">Rejoins la communauté</b><p class="small mt8" style="opacity:.9">Vois les séances des membres, encourage-les d'un geste 💪 🔥 👏, remplis ta quête du jour et grimpe les niveaux de supporter. Pas de messages, pas de contacts : juste de l'énergie.</p><button class="btn mt8" style="background:#fff;color:var(--red)" data-a="soc-profil">Choisir mon pseudo</button></div>`;
  else {
    if (!FIL[onglet]) { try { const c = await cloud(); FIL[onglet] = await c.socFil(onglet); const ids = FIL[onglet].map(x => x.id); if (ids.length) Object.assign(NBC, await c.socNbCommentaires(ids).catch(() => ({}))); } catch (e) { FIL[onglet] = []; toast("Fil indisponible : " + e.message); } }
    reparerDetails();
    const items = FIL[onglet] || [];
    const vide = onglet === "amis" ? `<div class="card mt12 center"><p class="small muted">Aucune séance de tes amis pour l'instant.</p><button class="btn btn-line btn-sm" data-a="go" data-r="amis">Ajouter des amis</button></div>`
      : onglet === "moi" ? `<p class="empty small">Tes séances publiées apparaîtront ici.</p>` : profil().communaute ? `<p class="empty small">Sois le premier à publier une séance aujourd'hui 💪</p>` : `<div class="card mt12 center"><p class="small muted">Tu n'as pas rejoint la communauté : tu ne vois que tes amis.</p><button class="btn btn-line btn-sm" data-a="soc-profil">Rejoindre</button></div>`;
    body = carteJeu() + `<div class="mt12">${[["communaute", "🏟️ Tous"], ["amis", "🫂 Amis"], ["moi", "👤 Moi"]].map(([v, l]) => `<button class="chip ${onglet === v ? "on" : ""}" data-a="soc-onglet" data-v="${v}">${l}</button>`).join(" ")}</div>`
      + (items.length ? items.map(carteActivite).join("") + (items.length >= 30 ? `<button class="btn btn-line btn-sm mt12" data-a="soc-plus">Voir plus</button>` : "") : vide)
      + `<div class="row mt16" style="gap:8px"><button class="btn btn-line btn-sm" style="flex:1" data-a="soc-profil">${esc(profil().avatar)} Mon profil</button><button class="btn btn-line btn-sm" style="flex:1" data-a="go" data-r="parrainage">🎁 Inviter</button></div>`;
    update(st => { st.social = { ...(st.social || {}), vu: new Date().toISOString(), resume: { ...(st.social?.resume || {}), recusDepuis: 0 } }; });
  }
  if (R.route !== "communaute") return;
  const w = derniere(), pubs = S().socialPubs || {};
  const pubCard = w && !bloc && profil() && onglet !== "amis" ? `<div class="card mt12 row" style="gap:12px;align-items:center"><span style="font-size:26px">📣</span><span class="grow small"><b>${pubs[cleSeance(w)] ? "Dernière séance publiée" : "Publie ta dernière séance"}</b><br><span class="xs muted">${esc(w.title)} · ${new Date(w.end).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span></span><button class="btn btn-red btn-sm" style="width:auto;flex:none" data-a="soc-hist" data-k="${esc(cleSeance(w))}">Partager</button></div>` : "";
  const box = document.getElementById("comm"); if (box) box.innerHTML = pubCard + body + `<button class="card tap mt12" data-a="go" data-r="rapport" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:24px">📈</span><span class="grow"><b>Partager mes résultats</b><br><span class="xs muted">Mon rapport : progrès, régularité, avant / après</span></span></button>`;
};
actions["soc-onglet"] = (b, d) => { onglet = d.v; history.replaceState(null, "", "#/communaute/" + d.v); rerender(); };
actions["soc-reload"] = async () => { ETAT.at = 0; FIL.amis = FIL.communaute = FIL.moi = null; rerender(); };
actions["soc-plus"] = async () => { const it = FIL[onglet] || []; try { const c = await cloud(); const plus = await c.socFil(onglet, it.at(-1)?.data?.fait || it.at(-1)?.created_at); FIL[onglet] = [...it, ...plus.filter(x => !it.some(y => y.id === x.id))]; rerender(); } catch (e) { toast(e.message); } };
function gerbe(btn, em) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = btn.getBoundingClientRect();
  for (let i = 0; i < 5; i++) { const s = document.createElement("span"); s.className = "soc-burst"; s.textContent = em; s.style.left = `${r.left + r.width / 2 - 14 + (i - 2) * 12}px`; s.style.top = `${r.top - 6}px`; s.style.animationDelay = `${i * 60}ms`; document.body.append(s); setTimeout(() => s.remove(), 1300); }
}
actions["soc-r"] = async (b, d) => {
  const id = +d.id, e = d.e, it = Object.values(FIL).flat().filter(Boolean).filter(x => x.id === id); if (!it.length) return;
  const on = !(it[0].mes_reactions || []).includes(e);
  it.forEach(x => { x.mes_reactions = on ? [...(x.mes_reactions || []), e] : (x.mes_reactions || []).filter(y => y !== e); x.reactions = { ...(x.reactions || {}), [e]: Math.max(0, ((x.reactions || {})[e] || 0) + (on ? 1 : -1)) }; });
  if (on) { buzz(14); gerbe(b, SO.REACTIONS.find(r => r.id === e)?.em || "💪"); }
  const m = ETAT.moi || (ETAT.moi = {}), t = today(), avant = SO.serieSupporter(m.par_jour, t);
  m.par_jour = { ...(m.par_jour || {}), [t]: Math.max(0, ((m.par_jour || {})[t] || 0) + (on ? 1 : -1)) }; m.donnes = Math.max(0, (m.donnes || 0) + (on ? 1 : -1));
  const apres = SO.serieSupporter(m.par_jour, t), niv0 = SO.niveauSupporter(m.donnes - (on ? 1 : -1)), niv1 = SO.niveauSupporter(m.donnes);
  rerender();
  if (on && !avant.faite && apres.faite) { buzz([40, 60, 40]); toast(`🔥 Quête du jour remplie ! Série : ${apres.jours} jour${apres.jours > 1 ? "s" : ""}`); }
  else if (on && niv1.rang > niv0.rang) { buzz([40, 60, 40]); toast(`${niv1.em} Nouveau niveau : ${niv1.nom} !`); }
  try { const c = await cloud(); const cpt = await c.socReagir(id, e, on); it.forEach(x => { x.reactions = cpt || {}; }); update(st => { st.social = { ...(st.social || {}), resume: resumeDe(m) }; }); }
  catch (err) { toast(err.message); ETAT.at = 0; FIL.amis = FIL.communaute = FIL.moi = null; rerender(); }
};
actions["soc-menu"] = (b, d) => {
  if (d.moi === "1") return sheet(`<h2 class="h2">Ma publication</h2><button class="btn btn-line mt12" data-a="soc-suppr" data-id="${d.id}" style="color:var(--red)">Retirer cette séance du fil</button>`);
  if (!isCoach()) return;
  sheet(`<h2 class="h2">Signaler cette publication</h2><p class="xs muted mt4">Seul le coach régule la communauté : ton signalement est examiné par Thomas.</p>
    <div class="list mt12">${[["contact", "Elle contient un contact ou une pub"], ["insulte", "Pseudo ou titre insultant"], ["faux", "Chiffres manifestement faux"], ["autre", "Autre chose"]].map(([v, l]) => `<button class="li" data-a="soc-signal" data-id="${d.id}" data-v="${v}"><span class="grow">${l}</span></button>`).join("")}</div>`);
};
actions["soc-signal"] = async (b, d) => { try { const c = await cloud(); await c.socSignaler(+d.id, d.v); toast("Merci, c'est signalé"); } catch (e) { toast(e.message); } closeSheet(); };
actions["soc-suppr"] = async (b, d) => { try { const c = await cloud(); await c.socRetirer(+d.id); update(st => { for (const [k, v] of Object.entries(st.socialPubs || {})) if (v.id === +d.id) delete st.socialPubs[k]; }); FIL.amis = FIL.communaute = FIL.moi = null; toast("Publication retirée"); } catch (e) { toast(e.message); } closeSheet(); rerender(); };

// ---------- Amis ----------
let AMIS = null;
routes.amis = async () => {
  $app.innerHTML = header("Communauté", "") + `<main class="page">${modeBar(COMM_MODES, "amis", "comm-mode")}<div id="comm"><p class="empty small">Chargement…</p></div></main>${tabbar("communaute")}`;
  await charger(); const bloc = etatBloquant("Tes amis dans l'app");
  let body = bloc;
  if (!bloc) {
    const code = await assurerCode();
    try { const c = await cloud(); AMIS = await c.socAmis(); } catch (e) { AMIS = []; toast(e.message); }
    const recues = AMIS.filter(a => a.statut === "attente" && a.sens === "recue"), envoyees = AMIS.filter(a => a.statut === "attente" && a.sens === "envoyee"), amis = AMIS.filter(a => a.statut === "accepte");
    const pod = SO.podium([{ pseudo: (profil()?.pseudo || "Moi") + " (moi)", seances: (FIL.moi || []).filter(x => Date.now() - new Date(x.created_at) < 7 * 864e5).length || S().workouts.filter(w => Date.now() - new Date(w.end) < 7 * 864e5).length, donnes: 0, moi: true }, ...amis.map(a => ({ pseudo: a.pseudo, avatar: a.avatar, seances: +a.seances_7j, donnes: +a.donnes_7j }))]);
    body = `<div class="card grad mt12"><div class="lbl">Mon code ami</div><div class="row between mt4"><b style="font-size:34px;letter-spacing:.12em">${esc(code || "······")}</b><button class="btn btn-sm" style="background:#fff;color:var(--red);width:auto" data-a="soc-inviter">Inviter</button></div><p class="xs mt8" style="opacity:.9;margin:0">Donne ce code à quelqu'un que tu connais, ou envoie-lui ton lien.</p></div>
      <form data-f="soc-ajout" class="card mt12"><b>Ajouter un ami</b><div class="row mt8" style="gap:8px"><input class="inp grow" name="code" maxlength="6" placeholder="Son code (6 caractères)" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.1em"><button class="btn btn-red btn-sm" style="width:auto" type="submit">Ajouter</button></div></form>
      ${recues.length ? `<h2 class="sec">Demandes reçues</h2><div class="list">${recues.map(a => `<div class="li"><span class="em">${esc(a.avatar)}</span><span class="grow"><b>${esc(a.pseudo)}</b></span><button class="btn btn-red btn-xs" style="width:auto" data-a="soc-ami-ok" data-id="${a.autre}">Accepter</button><button class="btn btn-line btn-xs" style="width:auto" data-a="soc-ami-non" data-id="${a.autre}">Refuser</button></div>`).join("")}</div>` : ""}
      ${amis.length ? `<h2 class="sec">🏆 Podium de la semaine <small>séances publiées</small></h2><div class="list">${pod.map(l => `<div class="li"><span class="em">${l.rang === 1 ? "🥇" : l.rang === 2 ? "🥈" : l.rang === 3 ? "🥉" : l.rang}</span><span class="grow"><b>${esc(l.avatar || "")} ${esc(l.pseudo)}</b>${l.moi ? "" : `<br><span class="xs muted">💛 ${l.donnes} encouragement${l.donnes > 1 ? "s" : ""} donnés</span>`}</span><b>${l.seances}</b></div>`).join("")}</div>
        <h2 class="sec">Mes amis (${amis.length})</h2><div class="list">${amis.map(a => `<div class="li"><span class="em">${esc(a.avatar)}</span><span class="grow"><b>${esc(a.pseudo)}</b><br><span class="xs muted">${a.derniere ? "dernière séance " + ago(a.derniere) : "pas encore de séance publiée"}</span></span><button class="icon-btn" data-a="soc-ami-retirer" data-id="${a.autre}" data-n="${esc(a.pseudo)}" aria-label="Retirer ${esc(a.pseudo)}">✕</button></div>`).join("")}</div>`
        : `<div class="card mt12 center"><div style="font-size:40px">🫂</div><p class="small muted">Pas encore d'amis dans l'app. Invite ceux avec qui tu t'entraînes : vous verrez vos séances et vous pourrez vous encourager.</p></div>`}
      ${envoyees.length ? `<p class="xs muted mt12">En attente de réponse : ${envoyees.map(a => esc(a.pseudo)).join(", ")}</p>` : ""}`;
  }
  if (R.route === "amis") { const box = document.getElementById("comm"); if (box) box.innerHTML = body; }
};
forms["soc-ajout"] = async (v) => {
  const code = SO.normCode(v.code); if (!SO.codeValide(code)) return toast("Un code fait 6 caractères (lettres et chiffres)");
  if (!profil()) return feuilleProfil(() => forms["soc-ajout"](v));
  try { const c = await cloud(); const r = await c.socAmiDemander(code); toast(r === "accepte" ? "🫂 Vous êtes amis !" : r === "deja" ? "Vous êtes déjà amis" : "Demande envoyée"); buzz(15); FIL.amis = null; rerender(); }
  catch (e) { toast(e.message === "Code inconnu" ? "Ce code n'existe pas" : e.message); }
};
actions["soc-ami-ok"] = async (b, d) => { try { const c = await cloud(); await c.socAmiRepondre(d.id, true); buzz(15); toast("🫂 Vous êtes amis !"); FIL.amis = null; ETAT.at = 0; } catch (e) { toast(e.message); } rerender(); };
actions["soc-ami-non"] = async (b, d) => { try { const c = await cloud(); await c.socAmiRepondre(d.id, false); ETAT.at = 0; } catch (e) { toast(e.message); } rerender(); };
actions["soc-ami-retirer"] = async (b, d) => { if (!confirm(`Retirer ${d.n} de tes amis ?`)) return; try { const c = await cloud(); await c.socAmiRetirer(d.id); FIL.amis = null; } catch (e) { toast(e.message); } rerender(); };

// ---------- Parrainage : inviter et gagner ----------
routes.parrainage = async () => {
  $app.innerHTML = header("Communauté", "") + `<main class="page">${S().profile ? modeBar(COMM_MODES, "parrainage", "comm-mode") : ""}<div id="comm"><p class="empty small">Chargement…</p></div></main>${S().profile ? tabbar("communaute") : ""}`;
  await charger(); const code = ETAT.connecte && !ETAT.absent ? await assurerCode() : null, m = ETAT.moi || {};
  const pg = SO.progressionParrainage(+m.filleuls_premium || 0, +m.filleuls || 0);
  const etape = (n, t, s) => `<div class="row mt12" style="gap:12px;align-items:flex-start"><span style="width:34px;height:34px;flex:none;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center;font-weight:800">${n}</span><span class="small"><b>${t}</b><br><span class="muted">${s}</span></span></div>`;
  const statut = !ETAT.connecte ? `<div class="card mt12"><p class="small" style="margin:0">Crée ton compte pour avoir ton code : c'est lui qui relie tes invités à toi.</p><button class="btn btn-red btn-sm mt8" data-a="go" data-r="account">Créer mon compte</button></div>`
    : ETAT.absent ? `<p class="xs muted mt8">Le suivi de tes invitations ouvre très bientôt. Tu peux déjà partager ton lien.</p>` : "";
  const body = `<div class="card grad mt12"><div style="font-size:40px">🎁</div><b class="h2">1 mois de Bâtisseur offert</b><p class="small mt8" style="opacity:.9">pour chaque ami qui s'abonne au Bâtisseur. Lui profite de ses <b>${joursOfferts()} jours d'essai</b>, sans carte bancaire.</p>
      ${code ? `<div class="row between mt12" style="background:rgba(255,255,255,.15);border-radius:14px;padding:10px 14px"><span><span class="xs" style="opacity:.8">Ton code</span><br><b style="font-size:30px;letter-spacing:.12em">${esc(code)}</b></span><button class="btn btn-sm" style="background:rgba(255,255,255,.25);color:#fff;width:auto" data-a="soc-copier">Copier le lien</button></div>` : ""}
      <button class="btn mt12" style="background:#fff;color:var(--red)" data-a="soc-inviter">📤 Inviter un ami</button></div>${statut}
    ${ETAT.connecte && !ETAT.absent ? `<div class="minis mt12"><div><div class="v">${pg.inscrits}</div><div class="l">inscrits</div></div><div><div class="v">${pg.n}</div><div class="l">passés Bâtisseur</div></div><div><div class="v">${pg.mois}</div><div class="l">mois gagnés</div></div></div>` : ""}
    <h2 class="sec">🏅 Paliers</h2><div class="list">${SO.PALIERS.map(p => { const ok = pg.n >= p.n; return `<div class="li" style="${ok ? "" : "opacity:.75"}"><span class="em">${ok ? p.em : "🔒"}</span><span class="grow"><b>${p.nom}</b> · ${p.n} ami${p.n > 1 ? "s" : ""} Bâtisseur<br><span class="xs muted">${esc(p.cadeau)}</span></span>${ok ? "✓" : `<span class="xs muted">${Math.min(pg.n, p.n)}/${p.n}</span>`}</div>`; }).join("")}</div>
    ${pg.prochain ? `<p class="small mt8">Plus que <b>${pg.manque} ami${pg.manque > 1 ? "s" : ""}</b> pour devenir ${pg.prochain.em} ${pg.prochain.nom}.</p>` : ""}
    <h2 class="sec">Comment ça marche</h2><div class="card">${etape(1, "Partage ton lien", "En story après une séance, en montrant ton programme, ou directement à un ami.")}${etape(2, "Ton ami crée son compte", `Il a ${joursOfferts()} jours pour tout essayer, sans carte. Vous devenez amis dans l'app.`)}${etape(3, "Il passe Bâtisseur : tu gagnes 1 mois", "Déduit de ta prochaine facture, ou ajouté à ton accès si tu n'es pas abonné.")}</div>
    <p class="xs muted mt12">Un mois par ami abonné, 6 mois au plus par an. L'analyse vidéo du palier Ambassadeur : Thomas te contacte pour recevoir ta vidéo. Le code doit être utilisé dans les 30 jours qui suivent la création du compte de ton ami. Membres coachés : Thomas choisit avec toi une récompense équivalente. Pas de récompense pour un compte créé pour soi-même. <a href="cgv.html#parrainage" target="_blank" rel="noopener">Conditions complètes</a></p>`;
  if (R.route === "parrainage") { const box = document.getElementById("comm"); if (box) box.innerHTML = body; }
};
actions["soc-inviter"] = async () => { const code = await assurerCode(); await partagerTexte(SO.texteInvitation({ prenom: profil()?.pseudo && profil().pseudo !== "Membre" ? profil().pseudo : prenom(), code, lien: SO.lienPartage(baseApp(), { code }), jours: joursOfferts() }), "Rejoins-moi sur TB my Coach"); };
actions["soc-copier"] = async () => { const code = await assurerCode(); if (await copier(SO.lienPartage(baseApp(), { code }))) { toast("Lien copié"); buzz(12); } else toast(SO.lienPartage(baseApp(), { code })); };

// ---------- Réglages : quitter, effacer ----------
actions["soc-effacer"] = async () => {
  if (!confirm("Effacer ton profil de la communauté, tes amis, tes publications et tes encouragements ? Ton programme et tes séances restent sur ton téléphone.")) return;
  try { const c = await cloud(); await c.socEffacer(); update(st => { st.social = { auto: false }; st.socialPubs = {}; }); ETAT.moi = null; FIL.amis = FIL.communaute = FIL.moi = null; toast("Données de la communauté effacées"); go("profile"); } catch (e) { toast(e.message); }
};

// ---------- Espace coach : signalements, récompenses à traiter, meilleurs parrains ----------
routes["admin-social"] = async () => {
  if (!isCoach()) return go("home");
  $app.innerHTML = header("Parrainage et communauté", "", { back: "admin-biz" }) + `<main class="page"><p class="empty small">Chargement…</p></main>${adminTabbar("admin-biz")}`;
  let body;
  try {
    const c = await cloud(), D = await c.socCoach(), mem = Object.fromEntries((window.__members || []).map(m => [m.id, m])), prof = Object.fromEntries(D.profils.map(p => [p.user_id, p]));
    const nom = (id) => esc(mem[id]?.name || mem[id]?.email || prof[id]?.pseudo || "Membre");
    const acts = Object.fromEntries(D.activites.map(a => [a.id, a]));
    const parrains = Object.values(D.parrainages.reduce((o, p) => { const x = o[p.parrain_id] || (o[p.parrain_id] = { id: p.parrain_id, n: 0, prem: 0 }); x.n++; if (p.premium_le) x.prem++; return o; }, {})).sort((a, b) => b.prem - a.prem || b.n - a.n);
    const aTraiter = D.recompenses.filter(r => r.statut === "a_traiter");
    body = `<div class="minis mt12"><div><div class="v">${D.parrainages.length}</div><div class="l">filleuls</div></div><div><div class="v">${D.parrainages.filter(p => p.premium_le).length}</div><div class="l">passés Bâtisseur</div></div><div><div class="v">${D.profils.filter(p => p.communaute).length}</div><div class="l">dans la communauté</div></div></div>
      <h2 class="sec">🚩 Signalements (${D.signalements.length})</h2>${D.signalements.length ? `<div class="list">${D.signalements.map(s => { const a = acts[s.activite_id]; return `<div class="li"><span class="grow"><b>${esc(a?.data?.titre || "Publication")}</b> · ${nom(a?.user_id)}<br><span class="xs muted">${esc(s.motif)} · ${ago(s.created_at)}${a?.masque ? " · masquée" : ""}</span></span><button class="btn btn-line btn-xs" style="width:auto" data-a="soc-mod" data-id="${s.activite_id}" data-v="1">Masquer</button><button class="btn btn-line btn-xs" style="width:auto" data-a="soc-mod" data-id="${s.activite_id}" data-v="0">Garder</button></div>`; }).join("")}</div>` : `<p class="empty small">Rien à regarder.</p>`}
      <h2 class="sec">🎁 Récompenses à traiter (${aTraiter.length})</h2><p class="xs muted">Parrains coachés : choisis avec eux un cadeau équivalent à un mois. Palier Ambassadeur (3 amis abonnés) : demande-lui la vidéo d'un exercice et renvoie ton analyse.</p>${aTraiter.length ? `<div class="list">${aTraiter.map(r => `<div class="li"><span class="grow"><b>${nom(r.parrain_id)}</b> ${r.type === "bonus_palier" ? "🎖️ Ambassadeur : analyse vidéo à faire" : "a fait venir " + nom(r.filleul_id)}<br><span class="xs muted">${ago(r.created_at)}</span></span><button class="btn btn-red btn-xs" style="width:auto" data-a="soc-rec" data-id="${r.id}" data-v="1">Fait</button><button class="btn btn-line btn-xs" style="width:auto" data-a="soc-rec" data-id="${r.id}" data-v="0">Refuser</button></div>`).join("")}</div>` : `<p class="empty small">Aucune.</p>`}
      <h2 class="sec">🏆 Meilleurs parrains</h2>${parrains.length ? `<div class="list">${parrains.slice(0, 20).map(p => `<div class="li"><span class="grow"><b>${nom(p.id)}</b><br><span class="xs muted">${p.n} inscrit${p.n > 1 ? "s" : ""} · ${p.prem} Bâtisseur</span></span><b>${SO.progressionParrainage(p.prem).badge?.em || ""}</b></div>`).join("")}</div>` : `<p class="empty small">Pas encore de parrainage.</p>`}
      <h2 class="sec">Récompenses accordées</h2><p class="small">${D.recompenses.filter(r => r.statut === "accordee").length} (crédit Stripe : ${D.recompenses.filter(r => r.mode === "credit_stripe").length}, prolongation : ${D.recompenses.filter(r => r.mode === "prolongation").length})</p>`;
  } catch (e) { body = e.name === "SocialAbsent" ? `<div class="card mt12"><b>Migration à appliquer</b><p class="small muted mt8">Applique <code>supabase/migrations/2026-11-18_cxs_social.sql</code> pour ouvrir la communauté et le parrainage.</p></div>` : `<p class="empty small">${esc(e.message)}</p>`; }
  if (R.route === "admin-social") $app.querySelector("main").innerHTML = body;
};
actions["soc-mod"] = async (b, d) => { try { const c = await cloud(); await c.socModerer(+d.id, d.v === "1"); toast(d.v === "1" ? "Publication masquée" : "Publication gardée"); } catch (e) { toast(e.message); } rerender(); };
actions["soc-rec"] = async (b, d) => { try { const c = await cloud(); await c.recompenseTraiter(+d.id, d.v === "1"); toast("Noté"); } catch (e) { toast(e.message); } rerender(); };

// ---------- Commentaires sous les séances ----------
const NBC = {};
actions["soc-com"] = (b, d) => {
  const id = +d.id;
  sheet(`<h2 class="h2">💬 Commentaires</h2><div id="coms" class="mt8"><p class="empty small">Chargement…</p></div>
    <form data-f="soc-com" class="mt12"><input type="hidden" name="id" value="${id}"><div class="row" style="gap:8px"><input name="t" maxlength="280" placeholder="Bravo, belle séance 💪" required style="flex:1;min-width:0" autocomplete="off"><button class="btn btn-red" style="width:auto">Envoyer</button></div>
    <p class="xs muted mt4">Encouragements courts. Pas de coordonnées ni de liens.</p></form>`, () => chargerComs(id));
};
async function chargerComs(id) {
  const box = document.getElementById("coms"); if (!box) return;
  try { const c = await cloud(); const l = await c.socCommentaires(id); NBC[id] = l.length;
    box.innerHTML = l.length ? l.map(x => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--line);align-items:flex-start"><span style="font-size:20px">${esc(x.avatar)}</span><span class="grow small"><b>${esc(x.pseudo)}</b> <span class="xs muted">${ago(x.created_at)}</span><br>${esc(x.texte)}</span>${x.moi ? `<button class="link xs" data-a="soc-com-del" data-id="${x.id}" data-act="${id}">Retirer</button>` : ""}</div>`).join("") : `<p class="xs muted">Aucun commentaire. Lance la discussion !</p>`;
  } catch (e) { box.innerHTML = `<p class="xs muted">Commentaires indisponibles (${esc(e.message)}).</p>`; }
}
forms["soc-com"] = async (v, f) => {
  try { await assurerProfil(); const c = await cloud(); await c.socCommenter(+v.id, v.t.trim()); f.reset(); buzz(10); await chargerComs(+v.id); document.querySelectorAll(`[data-a="soc-com"][data-id="${v.id}"]`).forEach(b => b.textContent = `💬 ${NBC[+v.id]} commentaire${NBC[+v.id] > 1 ? "s" : ""}`); }
  catch (e) { toast(e.message); }
};
actions["soc-com-del"] = async (b, d) => { try { const c = await cloud(); await c.socRetirerCommentaire(+d.id); chargerComs(+d.act); } catch (e) { toast(e.message); } };

// « faite mercredi à 18 h 19 » : l'heure réelle de la séance, même si elle est partagée plus tard
export function quandFait(a) {
  const f = a.data?.fait; if (!f) return ago(a.created_at);
  const d = new Date(f), j = Math.round((new Date(new Date().toDateString()) - new Date(d.toDateString())) / 864e5), h = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
  return `faite ${j === 0 ? "aujourd'hui" : j === 1 ? "hier" : j < 7 ? d.toLocaleDateString("fr-FR", { weekday: "long" }) : "le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${h}`;
}

// Détail complet d'une séance publiée : chaque exercice, chaque série (charge × reps, RPE)
export function detailHtml(d) {
  const serie = (x, u) => { const [kg, r, rpe] = x; const rep = r == null ? "" : u === "sec" ? `${fr(r)} s` : u === "m" ? `${fr(r)} m` : `${fr(r)} reps`;
    return [kg ? `${fr(kg, 1)} kg` : "", rep].filter(Boolean).join(" × ") + (rpe ? ` <span class="muted">· RPE ${fr(rpe, 1)}</span>` : ""); };
  return (d.detail || []).map(e => `<div class="mt12"><b class="small">${esc(e.n)}</b>${e.s.map((x, i) => `<div class="row between xs" style="padding:3px 0;border-bottom:1px solid var(--line)"><span class="muted">Série ${i + 1}</span><span>${serie(x, e.u)}</span></div>`).join("")}</div>`).join("");
}
actions["soc-detail"] = (b, d) => {
  const a = Object.values(FIL).flat().filter(Boolean).find(x => String(x.id) === String(d.id)); if (!a) return;
  const x = a.data || {}, bits = [x.min ? `${x.min} min` : "", x.series ? `${x.series} séries` : "", x.tonnes ? `${fr(x.tonnes, 1)} t` : ""].filter(Boolean).join(" · ");
  const det = detailHtml(x);
  sheet(`<h2 class="h2">${a.type === "cardio" ? "🏃" : "💪"} ${esc(x.titre || "Séance")}</h2><p class="small muted" style="margin:4px 0 0">${esc(a.pseudo)} · ${quandFait(a)}${bits ? " · " + bits : ""}</p>${det || `<p class="small muted mt12">Cette publication n'a pas gardé le détail des séries. Republie la séance depuis ton journal pour l'afficher ici.</p>`}<button class="btn btn-line mt16" data-a="soc-detail-x">Fermer</button>`);
};
actions["soc-detail-x"] = () => closeSheet();
