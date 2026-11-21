// Analyse vidéo v2, sur le téléphone : découpe, trajectoire complète de la barre (couleur par phase), échelle et vitesse,
// durées excentrique / concentrique par répétition, outils (crayon, gomme, ligne, angle réglable, bulle), arrêts sur image
// commentés et comparés (delta d'angle), critères par mouvement, vidéo commentée à enregistrer ou partager,
// analyses rangées par mouvement et par date. Le squelette (MediaPipe Pose) est calculé sur l'appareil.
import { S, update, today } from "../store.js";
import { esc, toast, routes, actions, changes, header, go, rerender, sheet, closeSheet, fmtDate, I, buzz } from "../core.js";
import * as V from "../video-calc.js";
import * as DBV from "../video-store.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const OUTILS = [["main", "👆", "Défiler"], ["crayon", "✏️", "Crayon"], ["gomme", "🧽", "Gomme"], ["ligne", "📏", "Ligne"], ["angle", "📐", "Angle"], ["bulle", "💬", "Bulle"], ["barre", "📍", "Barre"], ["echelle", "📐", "Échelle"]];
const COUL = { exc: "#FF5A5F", con: "#3DDC84", repos: "#FFD400" };
let A = null, blobUrl = null, cur = null, outil = "main", sel = -1, squel = false, pose = null, poseErr = null, lmCache = new Map(), raf = 0, trace = null, cmp = [0, 1];

// ---------- Bibliothèque : analyses rangées par mouvement, avec la date ----------
const liste = () => S().analyses || [];
routes.videos = () => {
  const par = V.MOUVEMENTS.map(m => [m, liste().filter(a => a.mvt === m.id).sort((x, y) => y.date.localeCompare(x.date))]).filter(([, l]) => l.length);
  document.getElementById("app").innerHTML = header("Analyses vidéo", "Rangées par mouvement", { back: "carnet/carnet/historique" }) + `<main class="page">
    <label class="btn btn-red mt8" style="display:block;text-align:center">🎥 Nouvelle analyse<input type="file" accept="video/*" data-c="vd-file" style="display:none"></label>
    <p class="xs muted mt8">Filme de profil, téléphone posé à hauteur de hanche, tout le corps et le bout de la barre dans l'image. Les vidéos restent sur ce téléphone.</p>
    ${par.length ? par.map(([m, l]) => `<h2 class="sec">${esc(m.n)} <small>${l.length}</small></h2><div class="list">${l.map(a => `<button class="li" data-a="vd-open" data-id="${a.id}"><span class="em">🎬</span><span class="grow"><b class="small">${esc(a.nom || m.n)}</b><br><span class="xs muted">${fmtDate(a.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}${a.vmc ? ` · VMC ${String(a.vmc).replace(".", ",")} m/s` : ""}${a.nk ? ` · ${a.nk} arrêt${a.nk > 1 ? "s" : ""} sur image` : ""}${a.score != null ? ` · critères ${a.score} %` : ""}</span></span>${I.chev}</button>`).join("")}</div>`).join("")
      : `<div class="card center mt12"><div style="font-size:40px">🎥</div><p class="small muted">Aucune analyse enregistrée. Tes analyses apparaîtront ici, par mouvement.</p></div>`}</main>`;
};
actions["vd-open"] = async (b, d) => { try { const r = await DBV.lire(d.id); if (!r) return toast("Analyse introuvable sur ce téléphone"); ouvrirAnalyse(r.data, r.blob); } catch (e) { toast("Lecture impossible : " + e.message); } };
changes["vd-file"] = (el) => { const f = el.files?.[0]; if (!f) return; if (f.size > 400e6) return toast("Vidéo trop lourde (400 Mo maximum)"); nouvelleAnalyse(f); };
// Depuis la conversation (vidéo d'un membre) : on récupère le fichier pour pouvoir l'enregistrer
export async function ouvrirVideo(url) { try { const r = await fetch(url); nouvelleAnalyse(await r.blob()); } catch { nouvelleAnalyse(null, url); } }
function nouvelleAnalyse(blob, url = null) {
  A = { id: "v" + Date.now(), nom: "", mvt: null, date: today(), trim: null, path: [], keys: [], crit: {}, scale: null, rot: 0 }; ouvrirAnalyse(A, blob, url);
  setTimeout(choisirMouvement, 300);
}
function ouvrirAnalyse(data, blob, url = null) { A = data; A._blob = blob; if (blobUrl) URL.revokeObjectURL(blobUrl); blobUrl = blob ? URL.createObjectURL(blob) : url; sel = A.keys.length ? 0 : -1; outil = "main"; lmCache.clear(); go("video"); }
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
    <div class="vwrap" id="vw"><video id="vv" src="${esc(blobUrl)}" playsinline muted crossorigin="anonymous" preload="auto"></video><canvas id="vc" class="${outil === "main" ? "" : "on"}"></canvas><div id="vprog" class="vprog" hidden></div></div>
    <div class="row mt8" style="gap:6px;align-items:center"><button class="icon-btn" data-a="vd-step" data-v="-1" aria-label="Image précédente">⏮</button><button class="btn btn-red btn-sm" style="width:auto;flex:1" data-a="vd-play" id="vplay">▶ Lecture</button><button class="icon-btn" data-a="vd-step" data-v="1" aria-label="Image suivante">⏭</button><select data-c="vd-spd" style="width:auto"><option value="1">×1</option><option value="0.5">×0,5</option><option value="0.25" selected>×0,25</option></select></div>
    <div class="row mt4" style="gap:8px;align-items:center"><span class="xs num" id="vt" style="min-width:58px">0:00,00</span><input type="range" id="vseek" data-i="vd-seek" min="0" max="1000" value="0" style="flex:1"></div>
    <details class="card mt8" id="vtrim"><summary class="small"><b>✂️ Découper</b> <span class="xs muted" id="vtrim-l"></span></summary>
      <div class="row mt8" style="gap:8px;align-items:center"><span class="xs" style="width:42px">Début</span><input type="range" data-i="vd-ta" id="vta" min="0" max="1000" value="0" style="flex:1"><button class="btn btn-line btn-xs" data-a="vd-tset" data-v="a">Ici</button></div>
      <div class="row mt8" style="gap:8px;align-items:center"><span class="xs" style="width:42px">Fin</span><input type="range" data-i="vd-tb" id="vtb" min="0" max="1000" value="1000" style="flex:1"><button class="btn btn-line btn-xs" data-a="vd-tset" data-v="b">Ici</button></div>
      <p class="xs muted mt4" style="margin-bottom:0">La lecture, la trajectoire et la vidéo commentée ne gardent que ce passage.</p></details>
    <div class="vtools mt8">${OUTILS.map(([k, ic, l]) => `<button class="vtool ${outil === k ? "on" : ""}" data-a="vd-tool" data-v="${k}"><span>${ic}</span>${l}</button>`).join("")}<button class="vtool ${squel ? "on" : ""}" data-a="vd-squel"><span>🦴</span>Squelette</button></div>
    <div id="vhelp" class="xs muted mt4">${aide()}</div>
    <div id="vstats">${statsHtml()}</div>
    <h2 class="sec">⏸️ Arrêts sur image <small>${A.keys.length}</small></h2>
    <button class="btn btn-line btn-sm" data-a="vd-key">⏸ Arrêt sur image ici</button>
    <div id="vkeys">${keysHtml()}</div>
    ${A.mvt ? `<h2 class="sec">✅ Critères · ${esc(V.mouvement(A.mvt).n)}${V.scoreCriteres(A.mvt, A.crit) != null ? ` <small>${V.scoreCriteres(A.mvt, A.crit)} %</small>` : ""}</h2><div class="card" style="padding:4px 12px">${V.mouvement(A.mvt).crit.map((c, i) => `<div class="li" style="gap:6px;align-items:center"><span class="grow small">${esc(c)}</span>${[["ok", "✅"], ["moyen", "〰️"], ["ko", "❌"]].map(([k, e]) => `<button class="chip sm ${A.crit[i] === k ? "on" : ""}" data-a="vd-crit" data-i="${i}" data-v="${k}" aria-label="${k}">${e}</button>`).join("")}</div>`).join("")}</div>` : `<button class="btn btn-line mt12" data-a="vd-chmvt">Choisir le mouvement (critères d'évaluation)</button>`}
    <label class="field mt12"><span>Notes générales</span><textarea data-c="vd-notes" rows="3" maxlength="1500" placeholder="Ce qu'on retient, ce qu'on travaille à la prochaine séance.">${esc(A.notes || "")}</textarea></label>
    <div class="row mt12" style="gap:8px"><button class="btn btn-red grow" data-a="vd-save">💾 Enregistrer</button><button class="btn btn-line grow" data-a="vd-export">🎬 Vidéo commentée</button></div>
    <div class="row mt8" style="gap:8px"><button class="btn btn-ghost btn-sm grow" data-a="vd-snap">📸 Image</button><button class="btn btn-ghost btn-sm grow" data-a="vd-del" style="color:var(--red)">🗑️ Supprimer</button></div>
  </main>`;
  monter();
};
function aide() {
  return { main: "👆 Défiler : la vidéo ne bloque pas le défilement de la page. Choisis un outil pour dessiner.", crayon: "✏️ Dessine à main levée sur l'arrêt sur image en cours.", gomme: "🧽 Passe sur un dessin pour l'effacer.", ligne: "📏 Trace une ligne (ex. ton tronc) : son inclinaison par rapport à la verticale s'affiche. Fais glisser un bout pour l'ajuster.", angle: "📐 Touche pour poser un angle, puis fais glisser ses 3 points sur les articulations.", bulle: "💬 Touche l'image pour écrire un commentaire dans une bulle.", barre: "📍 Mets en pause au début du mouvement et touche le bout de la barre : toute la trajectoire est tracée.", echelle: "📐 Trace une ligne sur le diamètre d'un disque (45 cm pour un disque de compétition) pour avoir les vitesses en m/s." }[outil];
}
function monter() {
  const v = document.getElementById("vv"), c = document.getElementById("vc"), ctx = c.getContext("2d"); cur = { v, c, ctx }; v.playbackRate = 0.25;
  v.addEventListener("loadedmetadata", () => { c.width = v.videoWidth || 640; c.height = v.videoHeight || 360; if (!A.trim) A.trim = { a: 0, b: v.duration || 0 }; majTrim(); v.currentTime = tA(); if (squel) chargerPose().then(dessiner); });
  v.addEventListener("seeked", () => { majTemps(); dessiner(); }); v.addEventListener("pause", () => { majPlay(); dessiner(); }); v.addEventListener("play", () => { majPlay(); boucle(); });
  v.addEventListener("timeupdate", () => { if (v.currentTime >= tB() - 0.01 && !v.paused) { v.pause(); v.currentTime = tB(); } majTemps(); });
  // pointeur : seulement quand un outil est choisi (sinon le doigt fait défiler la page)
  let drag = null; const pt = (e) => { const r = c.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const proche = (p, q, d = 0.04) => q && Math.hypot((p.x - q.x) * W() / H(), p.y - q.y) < d;
  c.addEventListener("pointerdown", (e) => {
    if (outil === "main") return; e.preventDefault(); c.setPointerCapture(e.pointerId); const p = pt(e);
    if (outil === "barre") return lancerTrace(p);
    if (outil === "echelle") { drag = { k: "echelle", a: p, b: p }; return; }
    const k = cleCourante(true);
    if (outil === "gomme") { gommer(k, p); drag = { k: "gomme", key: k }; return; }
    // attraper un point existant (ligne, angle, bulle) pour l'ajuster
    for (const it of k.items) for (const h of ["a", "b", "c", "p"]) if (it[h] && proche(p, it[h])) { drag = { k: "poignee", it, h }; return; }
    if (outil === "crayon") { const it = { k: "trait", pts: [p] }; k.items.push(it); drag = { k: "trait", it }; }
    else if (outil === "ligne") { const it = { k: "ligne", a: p, b: p }; k.items.push(it); drag = { k: "poignee", it, h: "b" }; }
    else if (outil === "angle") { const it = { k: "angle", a: { x: p.x, y: Math.max(0, p.y - 0.18) }, b: p, c: { x: Math.min(1, p.x + 0.14), y: Math.min(1, p.y + 0.12) } }; k.items.push(it); drag = { k: "poignee", it, h: "b" }; }
    else if (outil === "bulle") { const txt = prompt("Commentaire dans la bulle"); if (txt?.trim()) k.items.push({ k: "bulle", p, txt: txt.trim().slice(0, 140) }); majKeys(); }
    dessiner();
  });
  c.addEventListener("pointermove", (e) => { if (!drag) return; const p = pt(e);
    if (drag.k === "trait") drag.it.pts.push(p); else if (drag.k === "poignee") drag.it[drag.h] = p; else if (drag.k === "gomme") gommer(drag.key, p); else if (drag.k === "echelle") drag.b = p; dessiner(drag.k === "echelle" ? drag : null); });
  c.addEventListener("pointerup", () => { if (drag?.k === "echelle") calibrer(drag); if (drag && drag.k !== "echelle") { majKeys(); majStats(); } drag = null; dessiner(); });
}
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
  if (!(cm > 1 && cm < 300)) return; A.scale = { a: d.a, b: d.b, m: cm / 100 }; toast("Échelle enregistrée : vitesses en m/s"); majStats();
}
// m par unité normalisée verticale (et horizontale) de l'image
const echelle = () => { if (!A.scale || !cur) return null; const px = Math.hypot((A.scale.b.x - A.scale.a.x) * W(), (A.scale.b.y - A.scale.a.y) * H()); return px ? A.scale.m / px : null; };
const enMetres = (pts) => { const k = echelle(); return k ? pts.map(p => ({ t: p.t, x: p.x * W() * k, y: p.y * H() * k })) : null; };

// ---------- Trajectoire complète de la barre (image par image, sur toute la vidéo découpée) ----------
let off = null;
function image() { const v = cur?.v; if (!v?.videoWidth) return null; const w = 240, h = Math.round(w * v.videoHeight / v.videoWidth); off = off || document.createElement("canvas"); off.width = w; off.height = h; const o = off.getContext("2d", { willReadFrequently: true }); try { o.drawImage(v, 0, 0, w, h); return V.gris(o.getImageData(0, 0, w, h).data, w, h); } catch { return null; } }
const allerA = (t) => new Promise(ok => { const v = cur.v; if (Math.abs(v.currentTime - t) < 0.001) return ok(); const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); v.currentTime = t; setTimeout(f, 1500); });
async function lancerTrace(p) {
  if (trace) return; const v = cur.v; v.pause(); const t0 = v.currentTime, g0 = image(); if (!g0) return toast("Image illisible pour cette vidéo");
  const x0 = Math.round(p.x * g0.w), y0 = Math.round(p.y * g0.h), tpl = V.motif(g0, x0, y0, 20), pas = 1 / 30;
  trace = { stop: false }; const pr = document.getElementById("vprog"); if (pr) { pr.hidden = false; pr.innerHTML = `Tracé de la trajectoire… <button class="link" data-a="vd-stoptrace" style="color:#fff">Arrêter</button>`; }
  const pts = [{ t: t0, x: p.x, y: p.y }];
  for (const sens of [1, -1]) { let x = x0, y = y0, t = t0;
    while (!trace.stop) { t += sens * pas; if (t > tB() + 0.001 || t < tA() - 0.001) break; await allerA(t); const g = image(); if (!g) break; const r = V.suivre(g, tpl, x, y, 12); x = r.x; y = r.y; pts.push({ t: cur.v.currentTime, x: x / g.w, y: y / g.h });
      if (pr && pts.length % 6 === 0) pr.firstChild.textContent = `Tracé de la trajectoire… ${Math.round(Math.abs(t - t0) / Math.max(0.1, sens > 0 ? tB() - t0 : t0 - tA()) * 100)} % ${sens > 0 ? "(fin)" : "(début)"} `; } }
  A.path = pts.sort((a, b) => a.t - b.t).filter((q, i, l) => !i || q.t - l[i - 1].t > 0.005); trace = null; if (pr) pr.hidden = true;
  await allerA(t0); outil = "main"; rerender(); toast(`Trajectoire tracée : ${A.path.length} images`);
}
actions["vd-stoptrace"] = () => { if (trace) trace.stop = true; };
function analyse() {
  if (A.path.length < 8) return null; const m = enMetres(A.path), base = m || A.path.map(p => ({ t: p.t, x: p.x, y: p.y * (H() / W()) }));
  const ph = V.phases(base, m ? { seuil: 0.05, amp: 0.05 } : { seuil: 0.04, amp: 0.04 }), R = V.reps(ph), ec = V.ecartHorizontal(base);
  return { m: !!m, ph, R, ec, vit: V.vitesses(V.lisser(base)) };
}
function statsHtml() {
  const s = analyse(); if (!s) return `<div class="card soft mt8 small">📍 Choisis l'outil <b>Barre</b>, mets en pause au début du mouvement et touche le bout de la barre : la trajectoire complète, les phases et les vitesses apparaissent ici.</div>`;
  const u = s.m ? " m/s" : "", f = (x) => s.m ? String(x).replace(".", ",") + u : "–", vmc = s.R.length ? Math.round(s.R.reduce((a, r) => a + r.con.vMoy, 0) / s.R.length * 100) / 100 : null;
  return `<div class="card mt8"><div class="row between"><b class="small">📍 Trajectoire et vitesse</b><span class="xs"><i class="zdot" style="background:${COUL.exc}"></i>descente <i class="zdot" style="background:${COUL.con};margin-left:6px"></i>montée</span></div>
    ${courbe(s)}
    <div class="stat3 mt8"><div><b>${s.R.length}</b><span>répétitions</span></div><div><b>${s.m && vmc != null ? String(vmc).replace(".", ",") : "–"}</b><span>VMC (m/s)</span></div><div><b>${s.ec ? (s.m ? Math.round(s.ec.max * 100) + " cm" : Math.round(s.ec.max * 100) + " %") : "–"}</b><span>écart horizontal</span></div></div>
    ${s.R.length ? `<table class="qtab mt8"><tr><th>Rép.</th><th>Excentrique</th><th>Concentrique</th><th>VMC</th><th>V. max</th></tr>${s.R.map((r, i) => `<tr><td>${i + 1}</td><td>${r.exc ? r.exc.dur.toFixed(2).replace(".", ",") + " s" : "–"}</td><td>${r.con.dur.toFixed(2).replace(".", ",")} s</td><td>${f(r.con.vMoy)}</td><td>${f(r.con.vMax)}</td></tr>`).join("")}</table>` : `<p class="xs muted mt8">Pas de répétition nette détectée : vérifie le tracé (outil Barre) ou la découpe.</p>`}
    ${s.m ? "" : `<p class="xs mt8" style="color:var(--warn)">Pour des vitesses en m/s, règle l'échelle (outil Échelle, sur le diamètre d'un disque).</p>`}
    ${s.R.length > 1 && s.m ? `<p class="xs muted mt4" style="margin-bottom:0">Perte de vitesse entre la 1re et la dernière répétition : ${Math.round((1 - s.R.at(-1).con.vMoy / s.R[0].con.vMoy) * 100)} %.</p>` : ""}</div>`;
}
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
    ${k ? `<div class="card mt8"><div class="row between"><b class="small">Arrêt à ${fmtT(k.t)}</b><button class="link xs" data-a="vd-kdel" style="color:var(--red)">Supprimer</button></div>
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
actions["vd-kdel"] = () => { if (!confirm("Supprimer cet arrêt sur image et ses dessins ?")) return; A.keys.splice(sel, 1); sel = Math.min(sel, A.keys.length - 1); majKeys(); dessiner(); };
changes["vd-knote"] = (el) => { const k = A.keys[sel]; if (k) k.note = el.value.trim(); };
changes["vd-cmp"] = (el) => { cmp[+el.dataset.j] = +el.value; majKeys(); };
changes["vd-notes"] = (el) => { A.notes = el.value.trim(); };
actions["vd-crit"] = (b, d) => { A.crit[d.i] = A.crit[d.i] === d.v ? undefined : d.v; rerender(false); };
actions["vd-chmvt"] = () => choisirMouvement();

// ---------- Dessin de l'image : trajectoire, squelette, outils de l'arrêt, bulles ----------
async function chargerPose() {
  if (pose || poseErr) return pose;
  try { const { PoseLandmarker, FilesetResolver } = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`); const fs = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    pose = await PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELE, delegate: "GPU" }, runningMode: "IMAGE", numPoses: 1 }); }
  catch (e) { poseErr = e; toast("Squelette indisponible : connexion nécessaire la première fois."); }
  return pose;
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
actions["vd-tset"] = (b, d) => { const v = cur?.v; if (!v) return; if (d.v === "a") A.trim.a = Math.min(v.currentTime, tB() - 0.2); else A.trim.b = Math.max(v.currentTime, tA() + 0.2); majTrim(); toast(d.v === "a" ? "Début placé ici" : "Fin placée ici"); };
actions["vd-play"] = () => { const v = cur?.v; if (!v) return; if (v.paused) { if (v.currentTime >= tB() - 0.02 || v.currentTime < tA()) v.currentTime = tA(); v.play().catch(() => toast("Lecture impossible")); } else v.pause(); };
actions["vd-step"] = (b, d) => { const v = cur?.v; if (!v) return; v.pause(); v.currentTime = Math.max(tA(), Math.min(tB(), v.currentTime + +d.v / 30)); };
actions["vd-tool"] = (b, d) => { outil = outil === d.v ? "main" : d.v; if (outil !== "main") cur?.v.pause(); document.querySelectorAll('[data-a="vd-tool"]').forEach(x => x.classList.toggle("on", x.dataset.v === outil)); cur?.c.classList.toggle("on", outil !== "main"); const h = document.getElementById("vhelp"); if (h) h.textContent = aide(); };
actions["vd-squel"] = async (b) => { squel = !squel; b.classList.toggle("on", squel); if (squel) { cur?.v.pause(); await chargerPose(); } dessiner(); };

// Enregistrer : la vidéo et l'analyse restent sur ce téléphone, la liste est rangée par mouvement
actions["vd-save"] = async () => {
  if (!A.mvt) return choisirMouvement();
  try { if (!A._blob && blobUrl) A._blob = await (await fetch(blobUrl)).blob(); } catch { }
  if (!A._blob) return toast("Impossible d'enregistrer cette vidéo sur le téléphone");
  const s = analyse(), vmc = s?.m && s.R.length ? Math.round(s.R.reduce((a, r) => a + r.con.vMoy, 0) / s.R.length * 100) / 100 : null;
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
actions["vd-export"] = async () => {
  if (!cur) return; const v = cur.v; if (typeof MediaRecorder === "undefined") return toast("Ton téléphone ne permet pas d'enregistrer une vidéo ici (mets iOS à jour)");
  const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => MediaRecorder.isTypeSupported?.(t)); if (!type) return toast("Format vidéo non pris en charge sur ce téléphone");
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
  v.pause(); v.playbackRate = oldRate; image(false); await new Promise(r => setTimeout(r, 300)); rec.stop(); await new Promise(r => rec.onstop = r); if (pr) pr.hidden = true;
  if (stop) return toast("Création arrêtée");
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm", f = new File([new Blob(parts, { type: type.split(";")[0] })], `analyse-${A.mvt || "video"}-${A.date}.${ext}`, { type: type.split(";")[0] });
  toast("Vidéo prête : choisis « Enregistrer la vidéo » pour ta pellicule"); partager(f);
};
