// Analyse vidéo v2, sur le téléphone : découpe, trajectoire complète de la barre (couleur par phase), échelle et vitesse,
// durées excentrique / concentrique par répétition, outils (crayon, gomme, ligne, angle réglable, bulle), arrêts sur image
// commentés et comparés (delta d'angle), critères par mouvement, vidéo commentée à enregistrer ou partager,
// analyses rangées par mouvement et par date. Le squelette (MediaPipe Pose) est calculé sur l'appareil.
import { S, update, today } from "../store.js";
import { esc, toast, routes, actions, changes, header, go, rerender, sheet, closeSheet, fmtDate, I, buzz } from "../core.js";
import * as V from "../video-calc.js";
import * as DBV from "../video-store.js";
import { canalMembreHtml, compteRenduHtml } from "./video-canal.js";
import { cloud, isCoach } from "../core.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
// Modèle « full » (plus précis que « lite »), gratuit (Apache 2.0), exécuté sur le téléphone : aucun coût par analyse (C76)
const MODELE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const MODELE_LITE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const OUTILS = [["main", "👆", "Défiler"], ["crayon", "✏️", "Crayon"], ["gomme", "🧽", "Gomme"], ["ligne", "📏", "Ligne"], ["angle", "📐", "Angle"], ["bulle", "💬", "Bulle"], ["barre", "📍", "Barre"], ["echelle", "📏", "Échelle"], ["zoom", "🔍", "Zoom"]];
const COUL = { exc: "#FF5A5F", con: "#3DDC84", repos: "#FFD400" };
let A = null, blobUrl = null, cur = null, outil = "main", sel = -1, squel = false, pose = null, poseVid = null, tsOff = 0, tsLast = 0, poseErr = null, lmCache = new Map(), raf = 0, trace = null, cmp = [0, 1], zoom = { z: 1, x: 50, y: 50 };

// ---------- Annuler / rétablir : chaque modification garde une copie de l'analyse (50 au plus) ----------
let hist = [], redo = [];
const etatCopie = () => JSON.stringify({ path: A.path, keys: A.keys, scale: A.scale, trim: A.trim, crit: A.crit, sens: A.sens, auto: A.auto, pathAuto: A.pathAuto, pathQ: A.pathQ, critAuto: A.critAuto });
function memo() { if (!A) return; hist.push(etatCopie()); if (hist.length > 50) hist.shift(); redo = []; majUndo(); }
function restaurer(json) { Object.assign(A, JSON.parse(json)); sel = Math.min(sel, A.keys.length - 1); majKeys(); majStats(); majAuto(); dessiner(); majUndo(); }
const majUndo = () => { const u = document.getElementById("vundo"), r = document.getElementById("vredo"); if (u) u.disabled = !hist.length; if (r) r.disabled = !redo.length; };
actions["vd-undo"] = () => { if (!hist.length) return; redo.push(etatCopie()); restaurer(hist.pop()); buzz(8); };
actions["vd-redo"] = () => { if (!redo.length) return; hist.push(etatCopie()); restaurer(redo.pop()); buzz(8); };

export const _analyse = () => A; // tests de bout en bout

// ---------- Bibliothèque : analyses rangées par mouvement, avec la date ----------
const liste = () => S().analyses || [];
routes.videos = () => {
  const par = V.MOUVEMENTS.map(m => [m, liste().filter(a => a.mvt === m.id).sort((x, y) => y.date.localeCompare(x.date))]).filter(([, l]) => l.length);
  document.getElementById("app").innerHTML = header("Analyses vidéo", "Rangées par mouvement", { back: "carnet/carnet/historique" }) + `<main class="page">
    ${isCoach() ? `<button class="btn btn-red mt8" data-a="go" data-r="coach-videos" style="width:100%">🎥 Vidéos envoyées par les clients</button>` : canalMembreHtml()}
    <h2 class="sec">🔬 Analyser moi-même</h2>
    <label class="btn btn-line mt8" style="display:block;text-align:center">🎥 Nouvelle analyse<input type="file" accept="video/*" data-c="vd-file" style="display:none"></label>
    <p class="xs muted mt8">Filme de profil, téléphone posé à hauteur de hanche, tout le corps et le bout de la barre dans l'image. Ces analyses restent sur ce téléphone.</p>
    ${par.length ? par.map(([m, l]) => `<h2 class="sec">${esc(m.n)} <small>${l.length}</small></h2><div class="list">${l.map(a => `<button class="li" data-a="vd-open" data-id="${a.id}"><span class="em">🎬</span><span class="grow"><b class="small">${esc(a.nom || m.n)}</b><br><span class="xs muted">${fmtDate(a.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}${a.vmc ? ` · VMC ${String(a.vmc).replace(".", ",")} m/s` : ""}${a.nk ? ` · ${a.nk} arrêt${a.nk > 1 ? "s" : ""} sur image` : ""}${a.score != null ? ` · critères ${a.score} %` : ""}</span></span>${I.chev}</button>`).join("")}</div>`).join("")
      : `<div class="card center mt12"><div style="font-size:40px">🎥</div><p class="small muted">Aucune analyse enregistrée. Tes analyses apparaîtront ici, par mouvement.</p></div>`}</main>`;
};
actions["vd-open"] = async (b, d) => { try { const r = await DBV.lire(d.id); if (!r) return toast("Analyse introuvable sur ce téléphone"); ouvrirAnalyse(r.data, r.blob); } catch (e) { toast("Lecture impossible : " + e.message); } };
changes["vd-file"] = (el) => { const f = el.files?.[0]; if (!f) return; if (f.size > 400e6) return toast("Vidéo trop lourde (400 Mo maximum)"); nouvelleAnalyse(f); };
// Depuis la conversation (vidéo d'un membre) : on récupère le fichier pour pouvoir l'enregistrer
export async function ouvrirVideo(url, { demande = null } = {}) { try { const r = await fetch(url); nouvelleAnalyse(await r.blob(), null, demande); } catch { nouvelleAnalyse(null, url, demande); } }
function nouvelleAnalyse(blob, url = null, demande = null) {
  A = { id: demande ? "d-" + demande.id : "v" + Date.now(), nom: demande ? demande.nom : "", mvt: demande?.mvt || null, date: today(), trim: null, path: [], keys: [], crit: {}, scale: null, rot: 0, demande }; ouvrirAnalyse(A, blob, url);
  if (!A.mvt) setTimeout(choisirMouvement, 300);
}
function ouvrirAnalyse(data, blob, url = null) { A = data; A._blob = blob; hist = []; redo = []; zoom = { z: 1, x: 50, y: 50 }; if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = blob ? URL.createObjectURL(blob) : url; sel = A.keys.length ? 0 : -1; outil = "main"; lmCache.clear(); go("video"); }
function choisirMouvement() {
  sheet(`<h2 class="h2">Quel mouvement ?</h2><p class="xs muted">Il range l'analyse et donne les critères d'évaluation.</p><div class="chips wrap mt8">${V.MOUVEMENTS.map(m => `<button class="chip ${A?.mvt === m.id ? "on" : ""}" data-a="vd-mvt" data-v="${m.id}">${esc(m.n)}</button>`).join("")}</div>
    <label class="field mt12"><span>Nom (facultatif)</span><input id="vd-nom" maxlength="60" value="${esc(A?.nom || "")}" placeholder="Ex. 140 kg · série de 3"></label>`);
}
actions["vd-mvt"] = (b, d) => { A.mvt = d.v; A.nom = document.getElementById("vd-nom")?.value.trim() || A.nom; closeSheet(); rerender(); };

// ---------- Éditeur ----------
const W = () => cur?.c.width || 1, H = () => cur?.c.height || 1;
const tA = () => A.trim?.a ?? 0, tB = () => A.trim?.b ?? (cur?.v.duration || 0);
const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0").replace(".", ",")}`;
routes.video = () => {
  if (!A || !blobUrl) return go("videos");
  const m = A.mvt ? V.mouvement(A.mvt) : null;
  document.getElementById("app").innerHTML = header(esc(m ? A.nom || m.n : "Analyse vidéo"), `${fmtDate(A.date, { day: "numeric", month: "long", year: "numeric" })}${m ? ` · <button class="link" data-a="vd-chmvt" style="color:inherit">${esc(m.n)} ✏️</button>` : ""}`, { back: "videos" }) + `<main class="page" style="padding-bottom:120px">
    ${A.demande ? `<div class="card soft mb8" style="margin-bottom:8px"><b class="small">📥 Vidéo de ${esc(A.demande.nom)}</b>${A.demande.note ? `<p class="small" style="margin:4px 0 0">« ${esc(A.demande.note)} »</p>` : ""}<p class="xs muted" style="margin:4px 0 0">Analyse-la (outils ou 🤖 auto), puis « 📤 Partager » en bas.</p></div>` : ""}
    <div class="vwrap" id="vw"><div id="vz" class="vz" style="${zoomStyle()}"><video id="vv" src="${esc(blobUrl)}" playsinline muted crossorigin="anonymous" preload="auto"></video><canvas id="vc" class="${outil === "main" ? "" : "on"}"></canvas></div><div id="vprog" class="vprog" hidden></div>${zoom.z > 1 ? `<button class="vzbadge" data-a="vd-zoom0">🔍 ×${zoom.z} · revenir</button>` : ""}</div>
    <div id="vqual">${qualiteHtml()}</div>
    <details class="card mt8"${A.path.length || A.auto ? "" : " open"}><summary class="small"><b>🎥 Comment filmer${m ? " · " + esc(m.n) : ""}</b></summary><p class="small mt8" style="margin-bottom:0">${esc(V.protocole(A.mvt))}</p><p class="xs muted mt4" style="margin-bottom:0">Téléphone posé (pas tenu à la main), bonne lumière, 60 images/s si possible. Mauvais angle = mesures fausses : l'app te le signale par l'indice de fiabilité.</p></details>
    <div class="row mt8" style="gap:6px;align-items:center"><button class="icon-btn" data-a="vd-step" data-v="-1" aria-label="Image précédente">⏮</button><button class="btn btn-red btn-sm" style="width:auto;flex:1" data-a="vd-play" id="vplay">▶ Lecture</button><button class="icon-btn" data-a="vd-step" data-v="1" aria-label="Image suivante">⏭</button><select data-c="vd-spd" style="width:auto"><option value="1">×1</option><option value="0.5">×0,5</option><option value="0.25" selected>×0,25</option></select></div>
    <div class="row mt4" style="gap:8px;align-items:center"><span class="xs num" id="vt" style="min-width:58px">0:00,00</span><input type="range" id="vseek" data-i="vd-seek" min="0" max="1000" value="0" style="flex:1"></div>
    <details class="card mt8" id="vtrim"><summary class="small"><b>✂️ Découper</b> <span class="xs muted" id="vtrim-l"></span></summary>
      <div class="row mt8" style="gap:8px;align-items:center"><span class="xs" style="width:42px">Début</span><input type="range" data-i="vd-ta" id="vta" min="0" max="1000" value="0" style="flex:1"><button class="btn btn-line btn-xs" data-a="vd-tset" data-v="a">Ici</button></div>
      <div class="row mt8" style="gap:8px;align-items:center"><span class="xs" style="width:42px">Fin</span><input type="range" data-i="vd-tb" id="vtb" min="0" max="1000" value="1000" style="flex:1"><button class="btn btn-line btn-xs" data-a="vd-tset" data-v="b">Ici</button></div>
      <p class="xs muted mt4" style="margin-bottom:0">La lecture, la trajectoire et la vidéo commentée ne gardent que ce passage.</p></details>
    <div class="row mt8" style="gap:6px"><button class="btn btn-line btn-sm grow" id="vundo" data-a="vd-undo" ${hist.length ? "" : "disabled"}>↶ Annuler</button><button class="btn btn-line btn-sm grow" id="vredo" data-a="vd-redo" ${redo.length ? "" : "disabled"}>↷ Rétablir</button><button class="btn btn-red btn-sm grow" data-a="vd-auto">🤖 Analyse auto</button></div>
    <div class="vtools mt8">${OUTILS.map(([k, ic, l]) => `<button class="vtool ${outil === k ? "on" : ""}" data-a="vd-tool" data-v="${k}"><span>${ic}</span>${l}</button>`).join("")}<button class="vtool ${squel ? "on" : ""}" data-a="vd-squel"><span>🦴</span>Squelette</button></div>
    <div id="vhelp" class="xs muted mt4">${aide()}</div>
    <div id="vauto">${autoHtml()}</div>
    <div id="vstats">${statsHtml()}</div>
    <h2 class="sec">⏸️ Arrêts sur image <small>${A.keys.length}</small></h2>
    <button class="btn btn-line btn-sm" data-a="vd-key">⏸ Arrêt sur image ici</button>
    <div id="vkeys">${keysHtml()}</div>
    ${A.mvt ? `<h2 class="sec">✅ Critères · ${esc(V.mouvement(A.mvt).n)}${V.scoreCriteres(A.mvt, A.crit) != null ? ` <small>${V.scoreCriteres(A.mvt, A.crit)} %</small>` : ""}</h2><div class="card" style="padding:4px 12px">${V.mouvement(A.mvt).crit.map((c, i) => `<div class="li" style="gap:6px;align-items:center"><span class="grow small">${esc(c)}${A.critAuto?.[i] ? ' <span class="tag">auto</span>' : ""}</span>${[["ok", "✅"], ["moyen", "〰️"], ["ko", "❌"]].map(([k, e]) => `<button class="chip sm ${A.crit[i] === k ? "on" : ""}" data-a="vd-crit" data-i="${i}" data-v="${k}" aria-label="${k}">${e}</button>`).join("")}</div>`).join("")}</div>` : `<button class="btn btn-line mt12" data-a="vd-chmvt">Choisir le mouvement (critères d'évaluation)</button>`}
    <label class="field mt12"><span>Notes générales</span><textarea data-c="vd-notes" rows="3" maxlength="1500" placeholder="Ce qu'on retient, ce qu'on travaille à la prochaine séance.">${esc(A.notes || "")}</textarea></label>
    ${A.demande ? `<button class="btn btn-red mt12" style="width:100%" data-a="vd-partager">📤 Partager l'analyse à ${esc(A.demande.nom)}</button>` : ""}
    <div class="row mt12" style="gap:8px"><button class="btn ${A.demande ? "btn-line" : "btn-red"} grow" data-a="vd-save">💾 Enregistrer</button><button class="btn btn-line grow" data-a="vd-export">🎬 Vidéo commentée</button></div>
    <div class="row mt8" style="gap:8px"><button class="btn btn-ghost btn-sm grow" data-a="vd-snap">📸 Image</button><button class="btn btn-ghost btn-sm grow" data-a="vd-del" style="color:var(--red)">🗑️ Supprimer</button></div>
  </main>`;
  monter();
};
function qualiteHtml() { const q = A?.qualite || []; return q.length ? `<div class="card soft mt8">${q.map(x => `<p class="xs" style="margin:2px 0">⚠️ ${esc(x)}</p>`).join("")}</div>` : ""; }
function aide() {
  return { main: "👆 Défiler : la vidéo ne bloque pas le défilement de la page. Choisis un outil pour dessiner.", crayon: "✏️ Dessine à main levée sur l'arrêt sur image en cours. Fais glisser un dessin pour le déplacer.", gomme: "🧽 Passe sur un dessin pour l'effacer.", ligne: "📏 Trace une ligne (ex. le buste) : son inclinaison par rapport à la verticale s'affiche. Fais glisser un bout pour l'ajuster, ou le milieu pour la déplacer.", angle: "📐 Touche pour poser un angle, fais glisser ses 3 points sur les articulations, ou un côté pour le déplacer en entier.", bulle: "💬 Touche l'image pour écrire un commentaire dans une bulle.", barre: A?.path?.length ? "📍 Le tracé dévie ? Va à l'image où il se trompe, zoome si besoin et touche le bout de la barre : la trajectoire repart d'ici. ↶ Annuler revient en arrière." : "📍 Mets en pause au début du mouvement, zoome (🔍) et touche le bout de la barre (le centre du disque, vu de profil) : toute la trajectoire est tracée image par image.", zoom: "🔍 Touche l'endroit à agrandir : ×2, puis ×3, puis retour. Les outils restent précis en zoom.", echelle: "📐 Trace une ligne sur le diamètre d'un disque (45 cm pour un disque de compétition) pour avoir les vitesses en m/s." }[outil];
}
function monter() {
  const v = document.getElementById("vv"), c = document.getElementById("vc"), ctx = c.getContext("2d"); cur = { v, c, ctx }; v.playbackRate = 0.25;
  v.addEventListener("loadedmetadata", () => { c.width = v.videoWidth || 640; c.height = v.videoHeight || 360; if (!A.trim) A.trim = { a: 0, b: v.duration || 0 };
    A.qualite = V.qualiteVideo({ w: v.videoWidth, h: v.videoHeight, duree: v.duration }); const q = document.getElementById("vqual"); if (q) q.innerHTML = qualiteHtml(); majTrim(); v.currentTime = tA(); if (squel) chargerPose().then(dessiner); });
  v.addEventListener("seeked", () => { majTemps(); dessiner(); }); v.addEventListener("pause", () => { majPlay(); dessiner(); }); v.addEventListener("play", () => { majPlay(); boucle(); });
  v.addEventListener("timeupdate", () => { if (v.currentTime >= tB() - 0.01 && !v.paused) { v.pause(); v.currentTime = tB(); } majTemps(); });
  // pointeur : seulement quand un outil est choisi (sinon le doigt fait défiler la page)
  let drag = null; const pt = (e) => { const r = c.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const proche = (p, q, d = 0.04) => q && Math.hypot((p.x - q.x) * W() / H(), p.y - q.y) < d;
  c.addEventListener("pointerdown", (e) => {
    if (outil === "main") return; e.preventDefault(); c.setPointerCapture(e.pointerId); const p = pt(e);
    if (outil === "zoom") { zoom = zoom.z >= 3 ? { z: 1, x: 50, y: 50 } : { z: zoom.z + 1, x: p.x * 100, y: p.y * 100 }; appliquerZoom(); return; }
    if (outil === "barre") { memo(); return lancerTrace(p); }
    if (outil === "echelle") { drag = { k: "echelle", a: p, b: p }; return; }
    memo();
    const k = cleCourante(true);
    if (outil === "gomme") { gommer(k, p); drag = { k: "gomme", key: k }; return; }
    // attraper un point existant (ligne, angle, bulle) pour l'ajuster, ou le corps d'un dessin pour le déplacer en entier
    const prec = 0.05 / zoom.z;
    for (const it of k.items) for (const h of ["a", "b", "c", "p"]) if (it[h] && proche(p, it[h], prec)) { drag = { k: "poignee", it, h }; return; }
    for (const it of [...k.items].reverse()) if (surDessin(it, p, prec * 0.7)) { drag = { k: "deplacer", it, last: p }; return; }
    if (outil === "crayon") { const it = { k: "trait", pts: [p] }; k.items.push(it); drag = { k: "trait", it }; }
    else if (outil === "ligne") { const it = { k: "ligne", a: p, b: p }; k.items.push(it); drag = { k: "poignee", it, h: "b" }; }
    else if (outil === "angle") { const it = { k: "angle", a: { x: p.x, y: Math.max(0, p.y - 0.18) }, b: p, c: { x: Math.min(1, p.x + 0.14), y: Math.min(1, p.y + 0.12) } }; k.items.push(it); drag = { k: "poignee", it, h: "b" }; }
    else if (outil === "bulle") { const txt = prompt("Commentaire dans la bulle"); if (txt?.trim()) k.items.push({ k: "bulle", p, txt: txt.trim().slice(0, 140) }); majKeys(); }
    dessiner();
  });
  c.addEventListener("pointermove", (e) => { if (!drag) return; const p = pt(e);
    if (drag.k === "trait") drag.it.pts.push(p); else if (drag.k === "poignee") drag.it[drag.h] = p;
    else if (drag.k === "deplacer") { const dx = p.x - drag.last.x, dy = p.y - drag.last.y; deplacer(drag.it, dx, dy); drag.last = p; } else if (drag.k === "gomme") gommer(drag.key, p); else if (drag.k === "echelle") drag.b = p; dessiner(drag.k === "echelle" ? drag : null); });
  c.addEventListener("pointerup", () => { if (drag?.k === "echelle") { memo(); calibrer(drag); } if (drag && drag.k !== "echelle") { majKeys(); majStats(); } drag = null; dessiner(); });
}
// Dessin touché près de son tracé (segments de la ligne, de l'angle, du trait) ?
const distSeg = (p, a, b, r) => { const ax = a.x * r, bx = b.x * r, px = p.x * r, dx = bx - ax, dy = b.y - a.y, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (p.y - a.y) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, p.y - a.y - t * dy); };
function surDessin(it, p, d) { const r = W() / H(); if (it.k === "ligne") return distSeg(p, it.a, it.b, r) < d; if (it.k === "angle") return distSeg(p, it.a, it.b, r) < d || distSeg(p, it.b, it.c, r) < d; if (it.k === "trait") return it.pts.some((q, i) => i && distSeg(p, it.pts[i - 1], q, r) < d); return false; }
const bouge = (q, dx, dy) => { q.x = Math.min(1, Math.max(0, q.x + dx)); q.y = Math.min(1, Math.max(0, q.y + dy)); };
function deplacer(it, dx, dy) { (it.k === "trait" ? it.pts : [it.a, it.b, it.c, it.p].filter(Boolean)).forEach(q => bouge(q, dx, dy)); }
// Zoom : agrandit la vidéo et le dessin ensemble autour du point touché (les coordonnées restent justes)
const zoomStyle = () => zoom.z > 1 ? `transform:scale(${zoom.z});transform-origin:${zoom.x}% ${zoom.y}%` : "";
function appliquerZoom() { const z = document.getElementById("vz"); if (z) z.setAttribute("style", zoomStyle()); const w = document.getElementById("vw"); w?.querySelector(".vzbadge")?.remove(); if (zoom.z > 1) w?.insertAdjacentHTML("beforeend", `<button class="vzbadge" data-a="vd-zoom0">🔍 ×${zoom.z} · revenir</button>`); dessiner(); }
actions["vd-zoom0"] = () => { zoom = { z: 1, x: 50, y: 50 }; appliquerZoom(); };
const majTrim = () => { const v = cur?.v; if (!v?.duration) return; const ta = document.getElementById("vta"), tb = document.getElementById("vtb"), l = document.getElementById("vtrim-l"); if (ta) ta.value = Math.round(tA() / v.duration * 1000); if (tb) tb.value = Math.round(tB() / v.duration * 1000); if (l) l.textContent = `${fmtT(tA())} → ${fmtT(tB())} (${(tB() - tA()).toFixed(1).replace(".", ",")} s)`; };
const majTemps = () => { const v = cur?.v; if (!v) return; const t = document.getElementById("vt"), s = document.getElementById("vseek"); if (t) t.textContent = fmtT(v.currentTime); if (s && tB() > tA()) s.value = Math.round((v.currentTime - tA()) / (tB() - tA()) * 1000); };
const majPlay = () => { const b = document.getElementById("vplay"); if (b && cur) b.textContent = cur.v.paused ? "▶ Lecture" : "⏸ Pause"; };
const majKeys = () => { const el = document.getElementById("vkeys"); if (el) el.innerHTML = keysHtml(); };
const majStats = () => { const el = document.getElementById("vstats"); if (el) el.innerHTML = statsHtml(); };
function boucle() { cancelAnimationFrame(raf); const pas = () => { if (!cur || cur.v.paused) return; dessiner(); majTemps(); raf = requestAnimationFrame(pas); }; raf = requestAnimationFrame(pas); }

// Arrêt sur image : celui de l'instant affiché (créé au premier dessin)
function cleCourante(creer = false) {
  const t = cur.v.currentTime; let i = A.keys.findIndex(k => Math.abs(k.t - t) < 0.02);
  if (i < 0 && creer) { cur.v.pause(); A.keys.push({ id: Date.now(), t, items: [], note: "" }); A.keys.sort((a, b) => a.t - b.t); i = A.keys.findIndex(k => Math.abs(k.t - t) < 0.02); majKeys(); }
  if (i >= 0) sel = i; return A.keys[i] || null;
}
function gommer(k, p) { if (!k) return; const n = k.items.length; k.items = k.items.filter(it => { const ps = it.k === "trait" ? it.pts : [it.a, it.b, it.c, it.p].filter(Boolean); return !ps.some(q => Math.hypot((p.x - q.x) * W() / H(), p.y - q.y) < 0.035); }); if (k.items.length !== n) buzz(8); }
function calibrer(d) {
  const px = Math.hypot((d.b.x - d.a.x) * W(), (d.b.y - d.a.y) * H()); if (px < 10) return;
  const r = prompt("Longueur réelle de ce trait (cm) — un disque de compétition fait 45 cm", "45"); const cm = parseFloat(String(r || "").replace(",", "."));
  if (!(cm > 1 && cm < 300)) return; A.scale = { a: d.a, b: d.b, m: cm / 100 }; // remplace l'échelle automatique toast("Échelle enregistrée : vitesses en m/s"); majStats();
}
// m par unité normalisée verticale (et horizontale) de l'image
const echelle = () => { if (!A.scale || !cur) return null; const px = Math.hypot((A.scale.b.x - A.scale.a.x) * W(), (A.scale.b.y - A.scale.a.y) * H()); return px ? A.scale.m / px : null; };
const enMetres = (pts) => { const k = echelle(); return k ? pts.map(p => ({ t: p.t, x: p.x * W() * k, y: p.y * H() * k })) : null; };

// ---------- Trajectoire complète de la barre (image par image, sur toute la vidéo découpée) ----------
// Suivi par corrélation normalisée (robuste à la lumière), prédiction par la vitesse, motif mis à jour quand le suivi est
// sûr, arrêt propre si la barre est perdue (on la retouche pour repartir), sauts aberrants nettoyés (décision C72).
let off = null; const LARG = 360;
function image() { const v = cur?.v; if (!v?.videoWidth) return null; const w = LARG, h = Math.round(w * v.videoHeight / v.videoWidth); off = off || document.createElement("canvas"); off.width = w; off.height = h; const o = off.getContext("2d", { willReadFrequently: true }); try { o.drawImage(v, 0, 0, w, h); return V.gris(o.getImageData(0, 0, w, h).data, w, h); } catch { return null; } }
// Aller à un instant et attendre que la NOUVELLE image soit affichée (sinon on analyserait l'image d'avant)
const allerA = (t) => new Promise(ok => { const v = cur.v; if (Math.abs(v.currentTime - t) < 0.001) return ok(); let fini = false; const fin = () => { if (fini) return; fini = true; v.removeEventListener("seeked", f); ok(); };
  const f = () => { if (v.requestVideoFrameCallback) { v.requestVideoFrameCallback(() => fin()); setTimeout(fin, 120); } else fin(); };
  v.addEventListener("seeked", f); v.currentTime = t; setTimeout(fin, 1500); });
async function lancerTrace(p) {
  if (trace) return; const v = cur.v; v.pause(); const t0 = v.currentTime, g0 = image(); if (!g0) return toast("Image illisible pour cette vidéo");
  // Correction : une trajectoire existe déjà → on garde ce qui précède cet instant et on repart d'ici vers la fin
  const corr = A.path.length > 5 && t0 > A.path[0].t + 0.05, sensList = corr ? [1] : [1, -1];
  const T = 25, x0 = p.x * g0.w, y0 = p.y * g0.h, tplO = V.motif(g0, Math.round(x0), Math.round(y0), T), pas = 1 / 30;
  trace = { stop: false }; const pr = document.getElementById("vprog"); if (pr) { pr.hidden = false; pr.innerHTML = `<span>Tracé de la trajectoire…</span> <button class="link" data-a="vd-stoptrace" style="color:#fff">Arrêter</button>`; }
  const pts = [{ t: t0, x: p.x, y: p.y }], perdu = [], scores = [];
  if (!corr && !A.scale) echelleAuto(p);
  for (const sens of sensList) { let x = x0, y = y0, vx = 0, vy = 0, t = t0, tpl = tplO;
    while (!trace.stop) { t += sens * pas; if (t > tB() + 0.001 || t < tA() - 0.001) break; await allerA(t); const g = image(); if (!g) break;
      // le motif de départ fait foi (pas de dérive) ; le motif récent ne sert qu'à retrouver la barre, puis on recale sur celui de départ
      const px = x + vx, py = y + vy; let r = V.suivreNCC(g, tplO, px, py, 10);
      if (r.score < 0.6) { let r2 = V.suivreNCC(g, tpl, px, py, 16); if (r2.score < 0.6) { const r3 = V.suivreNCC(g, tplO, px, py, 26); if (r3.score > r2.score) r2 = r3; }
        if (r2.score > r.score) { const re = V.suivreNCC(g, tplO, r2.x, r2.y, 3); r = re.score > 0.5 ? re : r2; } }
      if (r.score < 0.42) { perdu.push(cur.v.currentTime); break; }
      scores.push(r.score); vx = 0.6 * (r.x - x) + 0.4 * vx; vy = 0.6 * (r.y - y) + 0.4 * vy; x = r.x; y = r.y;
      if (r.score > 0.75) tpl = V.motif(g, Math.round(x), Math.round(y), T);
      pts.push({ t: cur.v.currentTime, x: x / g.w, y: y / g.h });
      if (pr && pts.length % 6 === 0) pr.firstChild.textContent = `Tracé de la trajectoire… ${Math.round(Math.abs(t - t0) / Math.max(0.1, sens > 0 ? tB() - t0 : t0 - tA()) * 100)} % ${sens > 0 ? "(vers la fin)" : "(vers le début)"} `; } }
  const neuf = pts.sort((a, b) => a.t - b.t).filter((q, i, l) => !i || q.t - l[i - 1].t > 0.005);
  A.path = V.nettoyerTrajectoire(corr ? [...A.path.filter(q => q.t < t0 - 0.005), ...neuf] : neuf); A.pathAuto = false;
  if (scores.length) { const moy = scores.reduce((a, b) => a + b, 0) / scores.length; A.pathQ = corr && A.pathQ ? { moy: Math.min(A.pathQ.moy, moy), perdu: perdu.length > 0 } : { moy, perdu: perdu.length > 0 }; } trace = null; if (pr) pr.hidden = true;
  await allerA(t0); outil = "main"; rerender();
  toast(perdu.length ? `Barre perdue à ${fmtT(perdu[0])} : va à cette image et touche-la à nouveau (outil Barre) pour continuer` : `Trajectoire tracée : ${A.path.length} images`);
  if (A.autoApres && !perdu.length) { A.autoApres = false; return actions["vd-auto"](); }
  A.autoApres = false;
}
// Échelle automatique (C76) : le point touché est le centre du disque ; on retrouve son bord et on prend son diamètre
// (disque de compétition : 45 cm). Autre disque : corriger avec l'outil Échelle (trait sur le diamètre, longueur réelle).
function echelleAuto(p) {
  const v = cur?.v; if (!v?.videoWidth) return; const w = Math.min(960, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth);
  const o = document.createElement("canvas"); o.width = w; o.height = h; const x = o.getContext("2d", { willReadFrequently: true });
  let g; try { x.drawImage(v, 0, 0, w, h); g = V.gris(x.getImageData(0, 0, w, h).data, w, h); } catch { return; }
  const c = V.trouverDisque(g, p.x * w, p.y * h, { rMin: Math.max(6, Math.round(Math.min(w, h) * 0.02)) }); if (!c || c.score < 0.45) return;
  const cm = 45;
  A.scale = { a: { x: c.x / w, y: (c.y - c.r) / h }, b: { x: c.x / w, y: (c.y + c.r) / h }, m: cm / 100, disque: { x: c.x / w, y: c.y / h, r: c.r / w }, auto: true };
  toast(`📏 Échelle automatique : disque de ${cm} cm repéré (cercle pointillé). Faux ? Corrige avec l'outil Échelle.`);
}
actions["vd-stoptrace"] = () => { if (trace) trace.stop = true; };
actions["vd-clearpath"] = () => { if (!A.path.length) return; memo(); A.path = []; A.pathAuto = false; majStats(); dessiner(); toast("Trajectoire effacée (↶ pour revenir)"); };
const sensMvt = () => A.sens || V.sensDe(A.mvt);
function analyse() {
  if (A.path.length < 8) return null; const m = enMetres(A.path), base0 = m || A.path.map(p => ({ t: p.t, x: p.x, y: p.y * (H() / W()) }));
  const base = V.retourner(base0, sensMvt()), ph = V.phasesFiables(V.phases(base, m ? { seuil: 0.05, amp: 0.03 } : { seuil: 0.04, amp: 0.025 })), R = V.reps(ph), ec = V.ecartHorizontal(base0);
  return { m: !!m, ph, R, ec, vit: V.vitesses(V.lisser(base)), det: V.detailReps(R, base0) };
}
const vmcDe = (s) => s?.R.length ? Math.round(s.R.reduce((a, r) => a + r.con.vMoy, 0) / s.R.length * 100) / 100 : null;
function statsHtml() {
  const s = analyse(); if (!s) return `<div class="card soft mt8 small">📍 Deux façons : <b>🤖 Analyse auto</b> (l'app suit le corps et compte les répétitions), ou l'outil <b>Barre</b> : mets en pause au début, zoome et touche le bout de la barre. La trajectoire, les phases et les vitesses apparaissent ici.</div>`;
  const u = s.m ? " m/s" : "", f = (x) => s.m ? String(x).replace(".", ",") + u : "–", vmc = vmcDe(s), c = s.det.constance, d2 = (x) => x == null ? "–" : x.toFixed(2).replace(".", ",") + " s";
  const ampl = (x) => s.m ? Math.round(x * 100) + " cm" : Math.round(x * 100) + " %";
  return `<div class="card mt8"><div class="row between"><b class="small">📍 Trajectoire et vitesse${A.pathAuto ? " <span class='tag'>auto</span>" : ""}</b><span class="xs"><i class="zdot" style="background:${COUL.exc}"></i>excentrique <i class="zdot" style="background:${COUL.con};margin-left:6px"></i>concentrique</span></div>
    ${courbe(s)}
    <div class="stat3 mt8"><div><b>${s.R.length}</b><span>répétitions</span></div><div><b>${s.m && vmc != null ? String(vmc).replace(".", ",") : "–"}</b><span>VMC (m/s)</span></div><div><b>${s.ec ? ampl(s.ec.max) : "–"}</b><span>écart horizontal</span></div></div>
    ${s.R.length ? `<div style="overflow-x:auto"><table class="qtab mt8"><tr><th>Rép.</th><th>Exc.</th><th>Conc.</th><th>VMC</th><th>V. max</th><th>Ampl.</th><th>Écart</th></tr>${s.det.reps.map(r => `<tr${r.alertes.length ? ' style="background:rgba(233,174,0,.12)"' : ""}><td>${r.n}${r.alertes.length ? " ⚠️" : ""}</td><td>${d2(r.exc)}</td><td>${d2(r.con)}</td><td>${f(r.vMoy)}</td><td>${f(r.vMax)}</td><td>${ampl(r.amp)}</td><td>${r.ecart != null ? ampl(r.ecart) : "–"}</td></tr>`).join("")}</table></div>
      <p class="small mt8" style="margin-bottom:0"><b>${esc(c.resume)}</b></p>
      ${s.det.reps.filter(r => r.alertes.length).map(r => `<p class="xs" style="margin:2px 0 0">• Rép. ${r.n} : ${esc(r.alertes.join(", "))}</p>`).join("")}
      <p class="xs muted mt4" style="margin-bottom:0">Amplitude ${c.amplitudeTxt || "–"}${c.amplitude != null ? ` (variation ${Math.round(c.amplitude * 100)} %)` : ""} · tempo ${c.tempoTxt || "–"}${s.m && c.perte != null ? ` · perte de vitesse 1re → dernière : ${c.perte} %` : ""}.</p>`
      : `<p class="xs muted mt8">Pas de répétition nette détectée : vérifie le tracé, la découpe ou le sens ci-dessous.</p>`}
    <div class="row mt8" style="gap:6px;flex-wrap:wrap;align-items:center"><span class="xs muted">Concentrique quand la charge</span>${[[1, "monte"], [-1, "descend"]].map(([k, l]) => `<button class="chip sm ${sensMvt() === k ? "on" : ""}" data-a="vd-sens" data-v="${k}">${l}</button>`).join("")}<button class="link xs" data-a="vd-clearpath" style="margin-left:auto">Effacer la trajectoire</button></div>
    ${s.m ? "" : `<p class="xs mt8" style="color:var(--warn)">Pour des vitesses en m/s, règle l'échelle (outil Échelle, sur le diamètre d'un disque).</p>`}</div>`;
}
actions["vd-sens"] = (b, d) => { memo(); A.sens = +d.v; majStats(); dessiner(); };

// ---------- Analyse automatique : squelette image par image, trajectoire, répétitions, angles au point bas, compte rendu ----------
const majAuto = () => { const el = document.getElementById("vauto"); if (el) el.innerHTML = autoHtml(); };
function autoHtml() {
  const a = A?.auto; if (!a) return "";
  return `<div class="card mt8" style="box-shadow:0 0 0 1.5px var(--red) inset"><div class="row between"><b class="small">🤖 Compte rendu automatique</b><span class="xs muted">${a.n} rép.</span></div>
    ${a.fiab ? fiabHtml(a.fiab) : ""}
    ${a.lignes.map(l => `<p class="small" style="margin:4px 0 0">${esc(l)}</p>`).join("")}
    ${a.juge?.length ? `<div class="row mt8" style="gap:6px;flex-wrap:wrap">${a.juge.map(j => `<span class="tag" title="${esc(j.raisons.join(", "))}" style="${j.valide ? "" : j.valide === false ? "background:rgba(255,90,95,.18)" : "opacity:.6"}">${j.valide ? "⚪" : j.valide === false ? "🔴" : "❔"} Rép. ${j.n}</span>`).join("")}</div>${a.juge.filter(j => j.valide === false).map(j => `<p class="xs" style="margin:2px 0 0">• Rép. ${j.n} refusée : ${esc(j.raisons.join(", "))}</p>`).join("")}` : ""}
    ${a.bas?.length ? `<div style="overflow-x:auto"><table class="qtab mt8"><tr><th>Rép.</th><th>Genou</th><th>Hanche</th><th>Buste</th>${a.profondeur ? "<th>Profondeur</th>" : ""}</tr>${a.bas.map((b, i) => b ? `<tr><td>${i + 1}</td><td>${b.genou ?? "–"}°</td><td>${b.hanche ?? "–"}°</td><td>${b.buste ?? "–"}°</td>${a.profondeur ? `<td>${b.sousParallele ? "✅ sous le parallèle" : "❌ au-dessus"}</td>` : ""}</tr>` : "").join("")}</table></div>` : ""}
    <p class="xs muted mt8" style="margin-bottom:0">Indicatif : calculé sur l'image, à valider à l'œil. Les arrêts sur image « auto » se corrigent comme les autres (↶ pour annuler).</p></div>`;
}
const FIAB = { "élevée": ["🟢", "var(--ok, #3DDC84)"], moyenne: ["🟠", "var(--warn, #E9AE00)"], faible: ["🔴", "var(--red)"] };
function fiabHtml(f) { const [e, c] = FIAB[f.niveau] || FIAB.moyenne;
  return `<p class="small" style="margin:6px 0 0"><b style="color:${c}">${e} Fiabilité ${f.niveau}</b></p>${f.raisons.length ? `<p class="xs muted" style="margin:2px 0 0">${esc(f.raisons.join(" · "))}</p>` : ""}`; }
actions["vd-auto-ok"] = () => { closeSheet(); toast("Touche le bout de la barre"); };
actions["vd-auto-corps"] = () => { closeSheet(); A.autoApres = false; A.sansBarre = true; outil = "main"; actions["vd-auto"](); A.sansBarre = false; };
actions["vd-auto"] = async () => {
  if (!cur || trace) return; if (!A.mvt) { choisirMouvement(); return toast("Choisis d'abord le mouvement, puis relance l'analyse auto"); }
  const v = cur.v; v.pause();
  // Barre : on suit la barre elle-même (on la touche une fois), jamais l'épaule ou le poignet (C73)
  if (V.AVEC_BARRE.includes(A.mvt) && (!A.path.length || A.pathAuto) && !A.sansBarre) {
    await allerA(tA()); outil = "barre"; A.autoApres = true; rerender();
    return sheet(`<h2 class="h2">🎯 Touche la barre</h2><p class="small">Sur la première image, touche <b>le bout de la barre</b> (le centre du disque). Zoome si besoin. L'app suit la barre jusqu'à la fin, puis compte les répétitions sur sa trajectoire.</p><button class="btn btn-red mt8" data-a="vd-auto-ok">C'est parti</button><button class="link small mt8" data-a="vd-auto-corps">Pas de barre visible : suivre le corps</button>`);
  }
  await chargerPose(); if (!pose) return toast("Analyse auto indisponible : il faut du réseau la première fois (squelette).");
  memo(); trace = { stop: false }; const pr = document.getElementById("vprog"); if (pr) { pr.hidden = false; pr.innerHTML = `<span>🤖 Analyse automatique…</span> <button class="link" data-a="vd-stoptrace" style="color:#fff">Arrêter</button>`; }
  let lmT = []; const pas = 1 / 24; tsOff = tsLast + 1000 - Math.round(tA() * 1000); // horodatage réel, toujours croissant d'une analyse à l'autre
  for (let t = tA(); t <= tB() + 0.001 && !trace.stop; t += pas) { await allerA(t); let lm = null; try { lm = detecterVideo(v); } catch { } if (lm) lmT.push({ t: v.currentTime, lm });
    if (pr && lmT.length % 4 === 0) pr.firstChild.textContent = `🤖 Analyse automatique… ${Math.round((t - tA()) / Math.max(0.1, tB() - tA()) * 100)} %`; }
  const arrete = trace.stop; trace = null; if (pr) pr.hidden = true;
  if (lmT.length < 8) { await allerA(tA()); return toast(arrete ? "Analyse arrêtée" : "Personne mal visible : filme de profil, tout le corps dans l'image"); }
  lmT = V.lisserSquelette(lmT); lmT.forEach(q => lmCache.set(Math.round(q.t * 30), q.lm)); // points lissés (sans tremblement), réutilisés par le squelette affiché
  const visMoy = (() => { const ids = (lm) => V.cote(lm) ? [12, 14, 24, 26, 28] : [11, 13, 23, 25, 27]; const v2 = lmT.map(q => ids(q.lm).reduce((a, i) => a + (q.lm[i]?.visibility ?? 0), 0) / 5); return v2.reduce((a, b) => a + b, 0) / v2.length; })();
  if (!A.path.length || A.pathAuto) { A.path = V.nettoyerTrajectoire(V.trajectoireAuto(lmT, A.mvt)); A.pathAuto = true; }
  const s = analyse(), bas = s ? V.anglesBas(s.R, lmT, W(), H()) : [], prof = ["squat", "frontsquat"].includes(A.mvt);
  // arrêts sur image au point bas de chaque répétition, avec les angles posés sur les articulations
  A.keys = A.keys.filter(k => !k.auto);
  bas.forEach((b, i) => { if (!b) return; const x = lmT.find(q => q.t === b.t); if (!x) return; const lm = x.lm, sd = V.cote(lm), P = (j) => ({ x: lm[j].x, y: lm[j].y });
    const items = [{ k: "angle", a: P(sd ? 24 : 23), b: P(sd ? 26 : 25), c: P(sd ? 28 : 27), auto: true }, { k: "angle", a: P(sd ? 12 : 11), b: P(sd ? 24 : 23), c: P(sd ? 26 : 25), auto: true }, { k: "ligne", a: P(sd ? 24 : 23), b: P(sd ? 12 : 11), auto: true }];
    A.keys.push({ id: Date.now() + i, t: b.t, auto: true, items, note: `Rép. ${i + 1} au point bas : genou ${b.genou ?? "–"}°, hanche ${b.hanche ?? "–"}°, buste ${b.buste ?? "–"}° / verticale${prof && b.sousParallele != null ? (b.sousParallele ? ", sous le parallèle" : ", au-dessus du parallèle") : ""}.` }); });
  A.keys.sort((a, b) => a.t - b.t); sel = A.keys.findIndex(k => k.auto);
  // critères mesurables pré-remplis (marqués « auto », à valider)
  const crit = V.mouvement(A.mvt).crit, idx = (re) => crit.findIndex(c => re.test(c));
  Object.keys(A.critAuto || {}).forEach(i => delete A.crit[i]); A.critAuto = {};
  const fiab = V.fiabilite({ suivi: A.pathAuto ? null : A.pathQ, vis: visMoy, haut: cur.v.videoHeight, echelle: !!echelle(), reps: s?.R.length || 0, auto: A.pathAuto });
  const juge = s ? V.jugeRep(A.mvt, s.R, lmT, W(), H()) : null;
  const okB = bas.filter(Boolean); if (fiab.niveau !== "faible" && prof && okB.length) { const i = idx(/^Profondeur/); if (i >= 0) { A.crit[i] = okB.every(b => b.sousParallele) ? "ok" : okB.some(b => b.sousParallele) ? "moyen" : "ko"; A.critAuto[i] = true; } }
  if (fiab.niveau !== "faible" && s?.ec) { const i = idx(/milieu du pied|collée|près du corps/); const e = s.m ? s.ec.max : s.ec.max * 0.6; if (i >= 0) { A.crit[i] = e <= 0.05 ? "ok" : e <= 0.1 ? "moyen" : "ko"; A.critAuto[i] = true; } }
  const lignes = [];
  if (s?.R.length) { lignes.push(`${s.R.length} répétition${s.R.length > 1 ? "s" : ""} comptée${s.R.length > 1 ? "s" : ""}. ${s.det.constance.resume}`);
    const ex = s.det.reps.filter(r => r.exc != null).map(r => r.exc), co = s.det.reps.map(r => r.con), my = (l) => l.length ? (l.reduce((a, b) => a + b, 0) / l.length).toFixed(2).replace(".", ",") : "–";
    lignes.push(`Tempo moyen : descente ${my(ex)} s, montée ${my(co)} s.${s.m && vmcDe(s) != null ? ` VMC ${String(vmcDe(s)).replace(".", ",")} m/s.` : " Règle l'échelle pour les vitesses en m/s."}`);
    if (s.ec) lignes.push(`Écart horizontal de la trajectoire : ${s.m ? Math.round(s.ec.max * 100) + " cm" : Math.round(s.ec.max * 100) + " % de la hauteur de l'image"}.`); }
  else lignes.push("Aucune répétition nette : vérifie la découpe, le sens du mouvement, ou trace la barre avec l'outil Barre.");
  if (okB.length) { const m = (k) => Math.round(okB.reduce((a, b) => a + (b[k] || 0), 0) / okB.length); lignes.push(`Au point bas (moyenne) : genou ${m("genou")}°, hanche ${m("hanche")}°, buste ${m("buste")}° par rapport à la verticale.`);
    const bu = okB.map(b => b.buste).filter(x => x != null); if (bu.length > 1 && Math.max(...bu) - Math.min(...bu) >= 8) lignes.push(`⚠️ L'inclinaison du buste varie de ${Math.max(...bu) - Math.min(...bu)}° d'une répétition à l'autre.`); }
  if (juge) { const ok = juge.filter(j => j.valide).length, nj = juge.filter(j => j.valide != null).length;
    lignes.unshift(`⚖️ Juge streetlifting : ${ok} répétition${ok > 1 ? "s" : ""} valide${ok > 1 ? "s" : ""} sur ${juge.length}${nj < juge.length ? ` (${juge.length - nj} non jugée${juge.length - nj > 1 ? "s" : ""})` : ""}.`);
    if (fiab.niveau !== "faible") { const i = idx(/Menton|Épaule descend/); if (i >= 0 && nj) { A.crit[i] = ok === nj ? "ok" : ok ? "moyen" : "ko"; A.critAuto[i] = true; } } }
  if (fiab.niveau === "faible") lignes.unshift("⚠️ Fiabilité faible : les mesures sont indicatives et aucun critère n'a été coché automatiquement. Refilme en suivant « Comment filmer ».");
  A.auto = { at: new Date().toISOString(), n: s?.R.length || 0, lignes, bas, profondeur: prof, fiab, juge };
  await allerA(sel >= 0 ? A.keys[sel].t : tA()); rerender(); toast("Analyse automatique terminée : vérifie et corrige si besoin");
};
function courbe(s) {
  const V2 = s.vit; if (V2.length < 3) return ""; const w = 320, h = 110, t0 = V2[0].t, t1 = V2.at(-1).t, mx = Math.max(0.1, ...V2.map(x => Math.abs(x.v)));
  const X = (t) => ((t - t0) / Math.max(0.01, t1 - t0) * w).toFixed(1), Y = (v) => (h / 2 - v / mx * (h / 2 - 6)).toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" class="mt8" style="width:100%;height:auto;background:var(--chalk);border-radius:10px">${s.ph.map(p => `<rect x="${X(p.t0)}" y="0" width="${(X(p.t1) - X(p.t0)).toFixed(1)}" height="${h}" fill="${COUL[p.type]}" opacity=".13"/>`).join("")}<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="var(--line)"/><polyline fill="none" stroke="#2F6FED" stroke-width="2" points="${V2.map(x => X(x.t) + "," + Y(x.v)).join(" ")}"/><text x="4" y="12" font-size="10" fill="var(--muted)">${s.m ? `+${mx.toFixed(2).replace(".", ",")} m/s` : "vitesse (relative)"}</text></svg>`;
}

// ---------- Arrêts sur image : commentaires et comparaison ----------
function keysHtml() {
  if (!A.keys.length) return `<p class="xs muted mt8">Mets en pause, puis dessine ou touche « Arrêt sur image ici ». Chaque arrêt garde ses tracés, ses angles et ton commentaire, à son horodatage.</p>`;
  const k = A.keys[sel] || A.keys[0];
  return `<div class="chips wrap mt8">${A.keys.map((x, i) => `<button class="chip ${i === sel ? "on" : ""}" data-a="vd-kgo" data-i="${i}">⏸ ${fmtT(x.t)}</button>`).join("")}</div>
    ${k ? `<div class="card mt8"><div class="row between"><b class="small">Arrêt à ${fmtT(k.t)}${k.auto ? ' <span class="tag">auto</span>' : ""}</b><button class="link xs" data-a="vd-kdel" style="color:var(--red)">Supprimer</button></div>
      ${mesures(k)}<textarea class="mt8" data-c="vd-knote" rows="2" maxlength="300" placeholder="Commentaire de cet arrêt (affiché dans la vidéo commentée)">${esc(k.note || "")}</textarea></div>` : ""}
    ${A.keys.length > 1 ? `<div class="card mt8"><b class="small">🔀 Comparer deux arrêts</b><div class="grid2 mt8">${[0, 1].map(j => `<select data-c="vd-cmp" data-j="${j}">${A.keys.map((x, i) => `<option value="${i}" ${cmp[j] === i ? "selected" : ""}>${fmtT(x.t)}</option>`).join("")}</select>`).join("")}</div>${comparaison()}</div>` : ""}`;
}
function mesures(k) { const l = k.items.filter(i => i.k === "angle" || i.k === "ligne"); return l.length ? `<div class="xs mt4">${l.map(it => `${it.k === "angle" ? "📐 Angle" : "📏 Ligne"} : <b>${V.valeurOutil(it, W(), H()) ?? "–"}°</b>${it.k === "ligne" ? " par rapport à la verticale" : ""}`).join("<br>")}</div>` : ""; }
function comparaison() {
  const a = A.keys[cmp[0]], b = A.keys[cmp[1]]; if (!a || !b || a === b) return `<p class="xs muted mt8">Choisis deux arrêts différents.</p>`;
  const c = V.comparer(a, b, W(), H()); let sq = "";
  const la = lmCache.get(Math.round(a.t * 30)), lb = lmCache.get(Math.round(b.t * 30));
  if (la && lb) { const x = V.angles(la, W(), H()), y = V.angles(lb, W(), H()); sq = ["genou", "hanche", "coude"].filter(k => x[k] != null && y[k] != null).map(k => `<tr><td>🦴 ${k}</td><td>${x[k]}°</td><td>${y[k]}°</td><td><b>${y[k] - x[k] > 0 ? "+" : ""}${y[k] - x[k]}°</b></td></tr>`).join(""); }
  if (!c.length && !sq) return `<p class="xs muted mt8">Trace une ligne ou un angle sur chacun des deux arrêts (dans le même ordre) pour voir l'écart.</p>`;
  return `<table class="qtab mt8"><tr><th>Mesure</th><th>${fmtT(a.t)}</th><th>${fmtT(b.t)}</th><th>Δ</th></tr>${c.map(r => `<tr><td>${r.k === "angle" ? "📐 Angle" : "📏 Ligne"} ${r.n}</td><td>${r.a ?? "–"}°</td><td>${r.b ?? "–"}°</td><td><b>${r.delta == null ? "–" : (r.delta > 0 ? "+" : "") + r.delta + "°"}</b></td></tr>`).join("")}${sq}</table>`;
}
actions["vd-key"] = () => { if (!cur) return; cleCourante(true); dessiner(); };
actions["vd-kgo"] = (b, d) => { sel = +d.i; cur.v.pause(); cur.v.currentTime = A.keys[sel].t; majKeys(); };
actions["vd-kdel"] = () => { if (!confirm("Supprimer cet arrêt sur image et ses dessins ?")) return; memo(); A.keys.splice(sel, 1); sel = Math.min(sel, A.keys.length - 1); majKeys(); dessiner(); };
changes["vd-knote"] = (el) => { const k = A.keys[sel]; if (k) k.note = el.value.trim(); };
changes["vd-cmp"] = (el) => { cmp[+el.dataset.j] = +el.value; majKeys(); };
changes["vd-notes"] = (el) => { A.notes = el.value.trim(); };
actions["vd-crit"] = (b, d) => { memo(); if (A.critAuto) delete A.critAuto[d.i]; A.crit[d.i] = A.crit[d.i] === d.v ? undefined : d.v; rerender(false); };
actions["vd-chmvt"] = () => choisirMouvement();

// ---------- Dessin de l'image : trajectoire, squelette, outils de l'arrêt, bulles ----------
async function chargerPose() {
  if (pose || poseErr) return pose;
  try { const { PoseLandmarker, FilesetResolver } = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`); const fs = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    const creer = async (modele, mode) => { try { return await PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: modele, delegate: "GPU" }, runningMode: mode, numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5 }); }
      catch { return PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: modele, delegate: "CPU" }, runningMode: mode, numPoses: 1 }); } };
    // image fixe (squelette à l'arrêt sur image) + vidéo (analyse auto : le suivi d'une image à l'autre stabilise les points)
    try { pose = await creer(MODELE, "IMAGE"); poseVid = await creer(MODELE, "VIDEO"); } catch { pose = await creer(MODELE_LITE, "IMAGE"); poseVid = await creer(MODELE_LITE, "VIDEO").catch(() => null); } }
  catch (e) { poseErr = e; toast("Squelette indisponible : connexion nécessaire la première fois."); }
  return pose;
}
// Squelette de l'image affichée, en mode vidéo (horodatage toujours croissant, exigé par MediaPipe)
function detecterVideo(v) {
  if (!poseVid) return pose.detect(v).landmarks?.[0] || null;
  const ts = Math.max(tsLast + 1, tsOff + Math.round(v.currentTime * 1000)); tsLast = ts; return poseVid.detectForVideo(v, ts).landmarks?.[0] || null;
}
export function dessinerSur(ctx, Wd, Hd, t, { pause = true, echelleTmp = null, lm = null } = {}) {
  const lw = Math.max(2, Wd / 240), P = (p) => [p.x * Wd, p.y * Hd];
  // trajectoire complète, colorée par phase, point de l'instant
  if (A.path.length > 1) { const s = analyse(), ph = s?.ph || [], col = (tt) => (ph.find(p => tt >= p.t0 && tt <= p.t1) || {}).type;
    ctx.lineWidth = lw * 1.4; ctx.lineCap = "round"; for (let i = 1; i < A.path.length; i++) { const a = A.path[i - 1], b = A.path[i]; ctx.strokeStyle = COUL[col(b.t)] || COUL.repos; ctx.globalAlpha = b.t <= t + 0.02 ? 1 : 0.45; ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); }
    ctx.globalAlpha = 1; const n = A.path.reduce((x, q) => Math.abs(q.t - t) < Math.abs(x.t - t) ? q : x, A.path[0]); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(...P(n), lw * 3, 0, 7); ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = lw * 0.6; ctx.stroke(); }
  if (lm) { ctx.strokeStyle = "rgba(80,255,170,.95)"; ctx.lineWidth = lw; V.OS.forEach(([a, b]) => { if ((lm[a]?.visibility ?? 1) < 0.4 || (lm[b]?.visibility ?? 1) < 0.4) return; ctx.beginPath(); ctx.moveTo(lm[a].x * Wd, lm[a].y * Hd); ctx.lineTo(lm[b].x * Wd, lm[b].y * Hd); ctx.stroke(); });
    const ag = V.angles(lm, Wd, Hd), s = ag?.cote === "droit" ? 1 : 0; if (ag) [[s ? 26 : 25, ag.genou], [s ? 24 : 23, ag.hanche], [s ? 14 : 13, ag.coude]].forEach(([i, v]) => v != null && etiquette(ctx, lm[i].x * Wd + 10, lm[i].y * Hd, `${v}°`, Wd)); }
  const k = pause ? A.keys.find(x => Math.abs(x.t - t) < 0.02) : null;
  if (k) for (const it of k.items) {
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = "#FFD400"; ctx.fillStyle = "#FFD400";
    if (it.k === "trait") { ctx.beginPath(); it.pts.forEach((p, i) => i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))); ctx.stroke(); }
    if (it.k === "ligne") { ctx.strokeStyle = "#4FC3F7"; ctx.beginPath(); ctx.moveTo(...P(it.a)); ctx.lineTo(...P(it.b)); ctx.stroke(); [it.a, it.b].forEach(p => poignee(ctx, P(p), lw, "#4FC3F7")); const v = V.inclinaison(it.a, it.b, Wd, Hd); if (v != null) etiquette(ctx, (it.a.x + it.b.x) / 2 * Wd + 10, (it.a.y + it.b.y) / 2 * Hd, `${v}° / verticale`, Wd); }
    if (it.k === "angle") { ctx.strokeStyle = "#FF8A3D"; ctx.beginPath(); ctx.moveTo(...P(it.a)); ctx.lineTo(...P(it.b)); ctx.lineTo(...P(it.c)); ctx.stroke(); [it.a, it.b, it.c].forEach(p => poignee(ctx, P(p), lw, "#FF8A3D")); const v = V.valeurOutil(it, Wd, Hd); if (v != null) etiquette(ctx, it.b.x * Wd + 12, it.b.y * Hd + 4, `${v}°`, Wd, "#FF8A3D"); }
    if (it.k === "bulle") bulle(ctx, P(it.p), it.txt, Wd);
  }
  if (A.scale?.disque && pause) { const d = A.scale.disque; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = lw; ctx.setLineDash([lw * 2, lw * 2]); ctx.beginPath(); ctx.arc(d.x * Wd, d.y * Hd, d.r * Wd, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (echelleTmp) { ctx.strokeStyle = "#fff"; ctx.setLineDash([lw * 3, lw * 2]); ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(...P(echelleTmp.a)); ctx.lineTo(...P(echelleTmp.b)); ctx.stroke(); ctx.setLineDash([]); }
  return k;
}
const poignee = (ctx, [x, y], lw, c) => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, lw * 2.6, 0, 7); ctx.fill(); ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); };
function etiquette(ctx, x, y, txt, Wd, c = "#FFE27A") { const f = Math.round(Wd / 24); ctx.font = `bold ${f}px system-ui,sans-serif`; const m = ctx.measureText(txt).width; ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(x - 4, y - f, m + 10, f * 1.3); ctx.fillStyle = c; ctx.fillText(txt, x + 1, y); }
function bulle(ctx, [x, y], txt, Wd) {
  const f = Math.round(Wd / 26), pad = f * 0.6, maxW = Wd * 0.62; ctx.font = `600 ${f}px system-ui,sans-serif`;
  const mots = String(txt).split(" "), lignes = []; let l = ""; mots.forEach(m => { const t2 = l ? l + " " + m : m; if (ctx.measureText(t2).width > maxW && l) { lignes.push(l); l = m; } else l = t2; }); if (l) lignes.push(l);
  const w = Math.max(...lignes.map(s => ctx.measureText(s).width)) + pad * 2, h = lignes.length * f * 1.25 + pad * 1.6; const bx = Math.min(Math.max(4, x - w / 2), Wd - w - 4), by = Math.max(4, y - h - f);
  ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, h, f * 0.6) : ctx.rect(bx, by, w, h); ctx.fill();
  ctx.beginPath(); ctx.moveTo(Math.min(Math.max(bx + 10, x - 8), bx + w - 20), by + h); ctx.lineTo(x, y); ctx.lineTo(Math.min(Math.max(bx + 26, x + 8), bx + w - 4), by + h); ctx.fill();
  ctx.fillStyle = "#18212C"; lignes.forEach((s, i) => ctx.fillText(s, bx + pad, by + pad + f * (i + 0.95) * 1.25 - f * 0.25));
}
async function dessiner(echelleTmp = null) {
  if (!cur) return; const { v, c, ctx } = cur; ctx.clearRect(0, 0, c.width, c.height);
  let lm = null; if (squel && v.paused) { await chargerPose(); if (pose) { const i = Math.round(v.currentTime * 30); lm = lmCache.get(i); if (lm === undefined) { try { lm = pose.detect(v).landmarks?.[0] || null; } catch { lm = null; } lmCache.set(i, lm); } } }
  else if (squel) lm = lmCache.get(Math.round(v.currentTime * 30)) || null;
  const k = dessinerSur(ctx, c.width, c.height, v.currentTime, { pause: v.paused, echelleTmp, lm });
  if (k) { const i = A.keys.indexOf(k); if (i !== sel) { sel = i; majKeys(); } }
}
// ---------- Commandes ----------
changes["vd-spd"] = (el) => { if (cur) cur.v.playbackRate = +el.value; };
changes["i:vd-seek"] = (el) => { if (cur?.v.duration) cur.v.currentTime = tA() + el.value / 1000 * (tB() - tA()); };
changes["i:vd-ta"] = (el) => { const v = cur?.v; if (!v?.duration) return; A.trim.a = Math.min(el.value / 1000 * v.duration, tB() - 0.2); v.currentTime = A.trim.a; majTrim(); };
changes["i:vd-tb"] = (el) => { const v = cur?.v; if (!v?.duration) return; A.trim.b = Math.max(el.value / 1000 * v.duration, tA() + 0.2); v.currentTime = A.trim.b; majTrim(); };
actions["vd-tset"] = (b, d) => { const v = cur?.v; if (!v) return; memo(); if (d.v === "a") A.trim.a = Math.min(v.currentTime, tB() - 0.2); else A.trim.b = Math.max(v.currentTime, tA() + 0.2); majTrim(); toast(d.v === "a" ? "Début placé ici" : "Fin placée ici"); };
actions["vd-play"] = () => { const v = cur?.v; if (!v) return; if (v.paused) { if (v.currentTime >= tB() - 0.02 || v.currentTime < tA()) v.currentTime = tA(); v.play().catch(() => toast("Lecture impossible")); } else v.pause(); };
actions["vd-step"] = (b, d) => { const v = cur?.v; if (!v) return; v.pause(); v.currentTime = Math.max(tA(), Math.min(tB(), v.currentTime + +d.v / 30)); };
actions["vd-tool"] = (b, d) => { outil = outil === d.v ? "main" : d.v; if (outil !== "main") cur?.v.pause(); document.querySelectorAll('[data-a="vd-tool"]').forEach(x => x.classList.toggle("on", x.dataset.v === outil)); cur?.c.classList.toggle("on", outil !== "main"); const h = document.getElementById("vhelp"); if (h) h.textContent = aide(); };
actions["vd-squel"] = async (b) => { squel = !squel; b.classList.toggle("on", squel); if (squel) { cur?.v.pause(); await chargerPose(); } dessiner(); };

// Enregistrer : la vidéo et l'analyse restent sur ce téléphone, la liste est rangée par mouvement
actions["vd-save"] = async () => {
  if (!A.mvt) return choisirMouvement();
  try { if (!A._blob && blobUrl) A._blob = await (await fetch(blobUrl)).blob(); } catch { }
  if (!A._blob) return toast("Impossible d'enregistrer cette vidéo sur le téléphone");
  const s = analyse(), vmc = s?.m ? vmcDe(s) : null;
  const data = JSON.parse(JSON.stringify({ ...A, _blob: undefined }));
  try { await DBV.enregistrer({ id: A.id, data, blob: A._blob });
    update(st => { st.analyses = (st.analyses || []).filter(x => x.id !== A.id); st.analyses.push({ id: A.id, mvt: A.mvt, nom: A.nom, date: A.date, vmc, nk: A.keys.length, score: V.scoreCriteres(A.mvt, A.crit) }); });
    toast("Analyse enregistrée dans « Analyses vidéo »"); } catch (e) { toast("Enregistrement impossible : " + e.message); }
};
actions["vd-del"] = async () => { if (!confirm("Supprimer cette analyse ?")) return; try { await DBV.supprimer(A.id); } catch { } update(st => { st.analyses = (st.analyses || []).filter(x => x.id !== A.id); }); A = null; go("videos"); };
actions["vd-snap"] = async () => {
  if (!cur) return; const { v, c } = cur, o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d");
  try { x.drawImage(v, 0, 0, o.width, o.height); x.drawImage(c, 0, 0); } catch { return toast("Image impossible pour cette vidéo"); }
  o.toBlob((bl) => bl && partager(new File([bl], "analyse.png", { type: "image/png" })), "image/png");
};
async function partager(f) {
  try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: "Analyse vidéo TB my Coach" }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
}

// ---------- Vidéo commentée : lecture de la découpe, pause commentée à chaque arrêt sur image, trajectoire et mesures incrustées ----------
actions["vd-export"] = async () => { const f = await creerVideoCommentee(); if (f) { toast("Vidéo prête : choisis « Enregistrer la vidéo » pour ta pellicule"); partager(f); } };
async function creerVideoCommentee() {
  if (!cur) return null; const v = cur.v; if (typeof MediaRecorder === "undefined") { toast("Ton téléphone ne permet pas d'enregistrer une vidéo ici (mets iOS à jour)"); return null; }
  const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => MediaRecorder.isTypeSupported?.(t)); if (!type) { toast("Format vidéo non pris en charge sur ce téléphone"); return null; }
  const sc = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight)), o = document.createElement("canvas"); o.width = Math.round(v.videoWidth * sc / 2) * 2; o.height = Math.round(v.videoHeight * sc / 2) * 2; const x = o.getContext("2d");
  const rec = new MediaRecorder(o.captureStream(30), { mimeType: type, videoBitsPerSecond: 6e6 }), parts = []; rec.ondataavailable = e => e.data.size && parts.push(e.data);
  const pr = document.getElementById("vprog"); let stop = false; if (pr) { pr.hidden = false; pr.innerHTML = `🎬 Création de la vidéo… <button class="link" style="color:#fff" id="vexp-stop">Arrêter</button>`; document.getElementById("vexp-stop").onclick = () => { stop = true; }; }
  const s = analyse(), titre = `${A.mvt ? V.mouvement(A.mvt).n : "Analyse"}${A.nom ? " · " + A.nom : ""}`, sous = fmtDate(A.date, { day: "numeric", month: "long", year: "numeric" });
  const bandeau = () => { const f = Math.round(o.width / 26); x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, o.width, f * 2.4); x.fillStyle = "#fff"; x.font = `800 ${f}px system-ui,sans-serif`; x.fillText(titre, f * 0.6, f * 1.25); x.font = `500 ${Math.round(f * 0.7)}px system-ui,sans-serif`; x.fillText(`${sous} · TB my Coach`, f * 0.6, f * 2.05);
    if (s?.m && s.R.length) { const t = `VMC ${String(Math.round(s.R.reduce((a, r) => a + r.con.vMoy, 0) / s.R.length * 100) / 100).replace(".", ",")} m/s · ${s.R.length} rép.`; x.font = `700 ${f}px system-ui,sans-serif`; const m = x.measureText(t).width; x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(o.width - m - f * 1.2, o.height - f * 2, m + f * 1.2, f * 2); x.fillStyle = "#3DDC84"; x.fillText(t, o.width - m - f * 0.6, o.height - f * 0.6); } };
  const image = (pause) => { x.drawImage(v, 0, 0, o.width, o.height); const k = dessinerSur(x, o.width, o.height, v.currentTime, { pause, lm: squel ? lmCache.get(Math.round(v.currentTime * 30)) : null }); bandeau(); if (pause && k?.note) { bulle(x, [o.width / 2, o.height * 0.92], k.note, o.width); } };
  const oldRate = v.playbackRate, keys = A.keys.filter(k => k.t >= tA() && k.t <= tB()).sort((a, b) => a.t - b.t); let ki = 0;
  await allerA(tA()); rec.start(250); image(false);
  await new Promise(async (fin) => {
    v.playbackRate = 1; const tick = async () => {
      if (stop || v.currentTime >= tB() - 0.02) return fin();
      const k = keys[ki]; if (k && v.currentTime >= k.t - 0.02) { v.pause(); await allerA(k.t); const until = Date.now() + 3500; while (Date.now() < until && !stop) { image(true); await new Promise(r => setTimeout(r, 1000 / 30)); } ki++; v.play(); }
      image(false); requestAnimationFrame(tick); };
    v.play().then(() => requestAnimationFrame(tick)).catch(() => fin()); });
  v.pause(); v.playbackRate = oldRate; image(false);
  // Écran final : le compte rendu (répétitions, constance, vitesse, critères, notes) pendant 4 s
  const fin = [s?.R.length ? `${s.R.length} répétition${s.R.length > 1 ? "s" : ""}${s.m && vmcDe(s) != null ? ` · VMC ${String(vmcDe(s)).replace(".", ",")} m/s` : ""}` : null, s?.R.length ? s.det.constance.resume : null,
    A.mvt && V.scoreCriteres(A.mvt, A.crit) != null ? `Critères ${V.mouvement(A.mvt).n.toLowerCase()} : ${V.scoreCriteres(A.mvt, A.crit)} %` : null, ...(A.auto?.lignes || []).slice(1, 3), A.notes || null].filter(Boolean);
  if (!stop && fin.length) { const until = Date.now() + 4000; while (Date.now() < until && !stop) { x.drawImage(v, 0, 0, o.width, o.height); x.fillStyle = "rgba(10,16,28,.82)"; x.fillRect(0, 0, o.width, o.height); bandeau();
    const f = Math.round(o.width / 30); x.font = `800 ${Math.round(f * 1.2)}px system-ui,sans-serif`; x.fillStyle = "#fff"; x.fillText("Compte rendu", f, o.height * 0.22);
    let y = o.height * 0.22 + f * 2; x.font = `500 ${f}px system-ui,sans-serif`; fin.forEach(l => { const mots = String(l).split(" "); let ln = ""; mots.forEach(m => { const t2 = ln ? ln + " " + m : m; if (x.measureText(t2).width > o.width - f * 2 && ln) { x.fillText(ln, f, y); y += f * 1.35; ln = m; } else ln = t2; }); if (ln) { x.fillText(ln, f, y); y += f * 1.8; } });
    await new Promise(r => setTimeout(r, 1000 / 30)); } }
  await new Promise(r => setTimeout(r, 300)); rec.stop(); await new Promise(r => rec.onstop = r); if (pr) pr.hidden = true;
  if (stop) { toast("Création arrêtée"); return null; }
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
  return new File([new Blob(parts, { type: type.split(";")[0] })], `analyse-${A.mvt || "video"}-${A.date}.${ext}`, { type: type.split(";")[0] });
}

// ---------- Compte rendu partageable (canal « vidéos à analyser ») ----------
export function compteRendu() {
  const s = analyse(), m = A.mvt ? V.mouvement(A.mvt) : null, vmc = s?.m ? vmcDe(s) : null, resume = [];
  if (s?.R.length) { resume.push(`${s.R.length} répétition${s.R.length > 1 ? "s" : ""}. ${s.det.constance.resume}`); if (vmc != null) resume.push(`Vitesse moyenne de montée : ${String(vmc).replace(".", ",")} m/s${s.det.constance.perte != null ? `, perte de ${s.det.constance.perte} % sur la série` : ""}.`); if (s.ec) resume.push(`Écart horizontal de la barre : ${s.m ? Math.round(s.ec.max * 100) + " cm" : Math.round(s.ec.max * 100) + " %"}.`); }
  (A.auto?.lignes || []).slice(2).forEach(l => resume.push(l));
  return { v: 1, mvt: A.mvt, mvtNom: m?.n || null, date: A.date, m: !!s?.m, vmc, resume,
    reps: (s?.det.reps || []).map(r => ({ n: r.n, exc: r.exc, con: r.con, vMoy: r.vMoy, amp: r.amp, alertes: r.alertes })),
    crit: m ? m.crit.map((c, i) => ({ c, v: A.crit[i] })).filter(x => x.v) : [], score: A.mvt ? V.scoreCriteres(A.mvt, A.crit) : null,
    arrets: A.keys.filter(k => k.note || k.items.some(i => i.k === "angle" || i.k === "ligne")).map(k => ({ t: fmtT(k.t), note: k.note || "", mesures: k.items.filter(i => i.k === "angle" || i.k === "ligne").map(i => `${i.k === "angle" ? "angle" : "ligne"} ${V.valeurOutil(i, W(), H()) ?? "–"}°`) })),
    notes: A.notes || "" };
}
actions["vd-partager"] = () => {
  if (!A?.demande) return;
  sheet(`<h2 class="h2">📤 Partager à ${esc(A.demande.nom)}</h2><p class="small muted">Voici ce qu'il ou elle verra :</p>${compteRenduHtml(compteRendu())}
    <label class="row mt12" style="gap:8px;align-items:center"><input type="checkbox" id="vp-video" checked><span class="small">Joindre la vidéo commentée (créée maintenant : garde l'écran ouvert)</span></label>
    <button class="btn btn-red mt12" style="width:100%" data-a="vd-partager-go" id="vp-go">Partager</button>`);
};
actions["vd-partager-go"] = async () => {
  const avec = document.getElementById("vp-video")?.checked, b = document.getElementById("vp-go"); if (b) { b.disabled = true; b.textContent = avec ? "Création de la vidéo…" : "Envoi…"; }
  try { const cr = compteRendu(); closeSheet(); const f = avec ? await creerVideoCommentee() : null; if (avec && !f) return;
    toast("Envoi de l'analyse…"); const c = await cloud(); await c.videoPartager(A.demande, cr, f);
    if (A._blob) { try { await actions["vd-save"](); } catch { } }
    buzz(); toast(`Analyse partagée à ${A.demande.nom} ✅`); go("coach-videos");
  } catch (e) { toast("Partage impossible : " + e.message); if (b) { b.disabled = false; b.textContent = "Réessayer"; } }
};
