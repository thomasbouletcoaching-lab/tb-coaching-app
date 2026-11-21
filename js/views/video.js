// Analyse vidéo sur le téléphone : squelette et angles (MediaPipe Pose, calculé sur l'appareil, rien n'est envoyé),
// trajectoire de la barre après un toucher sur la barre, dessin du coach par-dessus, image annotée à partager.
import { esc, toast, routes, actions, changes, header, go, rerender } from "../core.js";
import * as V from "../video-calc.js";

const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODELE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
let pose = null, poseErr = null, src = null, opt = { sq: true, ang: true, bar: false, dessin: false }, barre = null, chemin = [], traits = [], cur = null, raf = 0, lmCache = new Map();
export function ouvrirVideo(url) { src = url; barre = null; chemin = []; traits = []; lmCache.clear(); go("video"); }
async function chargerPose() {
  if (pose || poseErr) return pose;
  try { const { PoseLandmarker, FilesetResolver } = await import(/* @vite-ignore */ `${MP}/vision_bundle.mjs`);
    const fs = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    pose = await PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELE, delegate: "GPU" }, runningMode: "IMAGE", numPoses: 1 });
  } catch (e) { poseErr = e; console.warn("Pose :", e); }
  return pose;
}
routes.video = () => {
  const $a = document.getElementById("app");
  $a.innerHTML = header("Analyse vidéo", "Squelette, angles, trajectoire de barre", { back: "__hist" }) + `<main class="page" style="padding-bottom:150px">
    ${src ? `<div class="vwrap" id="vw"><video id="vv" src="${esc(src)}" playsinline muted crossorigin="anonymous" preload="auto"></video><canvas id="vc"></canvas></div>
      <div class="row mt8" style="gap:6px;align-items:center"><button class="icon-btn" data-a="vd-step" data-v="-1" aria-label="Image précédente">⏮</button><button class="btn btn-red btn-sm" style="width:auto;flex:1" data-a="vd-play" id="vplay">▶ Lecture</button><button class="icon-btn" data-a="vd-step" data-v="1" aria-label="Image suivante">⏭</button><select id="vspd" data-c="vd-spd" style="width:auto"><option value="1">×1</option><option value="0.5">×0,5</option><option value="0.25" selected>×0,25</option></select></div>
      <input type="range" id="vseek" data-c="vd-seek" min="0" max="1000" value="0" class="mt8" style="width:100%">
      <div class="chips wrap mt8">${[["sq", "🦴 Squelette"], ["ang", "📐 Angles"], ["bar", "📍 Barre"], ["dessin", "✏️ Dessiner"]].map(([k, l]) => `<button class="chip ${opt[k] ? "on" : ""}" data-a="vd-opt" data-v="${k}">${l}</button>`).join("")}</div>
      <div id="vinfo" class="card soft mt8 small">${poseErr ? "Squelette indisponible : connexion nécessaire au premier usage." : "Mets en pause sur l'image à analyser, ou lance la lecture au ralenti."}</div>
      <div class="row mt8" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="vd-clear">🧽 Effacer dessin et trajectoire</button><button class="btn btn-line btn-sm grow" data-a="vd-snap">📸 Image annotée</button></div>
      <button class="btn btn-ghost btn-sm mt8" data-a="vd-new">Changer de vidéo</button>`
    : `<div class="card center"><div style="font-size:44px">🎥</div><b class="h3">Analyse une série en vidéo</b><p class="small muted mt8">Filme-toi <b>de profil</b>, le téléphone posé à hauteur de hanche, tout le corps et la barre dans l'image.</p>
        <label class="btn btn-red mt12" style="display:block">📹 Choisir ou filmer une vidéo<input type="file" accept="video/*" data-c="vd-file" style="display:none"></label>
        <p class="xs muted mt8">L'analyse se fait sur ton téléphone : la vidéo n'est envoyée nulle part.</p></div>
      <ul class="small mt12" style="padding-left:18px"><li>🦴 Squelette et angles du genou, de la hanche, du coude.</li><li>📍 Touche la barre : sa trajectoire est tracée image par image.</li><li>✏️ Dessine par-dessus, puis partage l'image à Thomas.</li></ul>`}
  </main>`;
  if (src) monter();
};
function monter() {
  const v = document.getElementById("vv"), c = document.getElementById("vc"), ctx = c.getContext("2d"), seek = document.getElementById("vseek");
  v.playbackRate = 0.25;
  const taille = () => { const r = v.getBoundingClientRect(); c.width = v.videoWidth || 640; c.height = v.videoHeight || 360; c.style.width = r.width + "px"; c.style.height = r.height + "px"; };
  v.addEventListener("loadedmetadata", () => { taille(); dessiner(); chargerPose().then(() => { if (poseErr) info("Squelette indisponible (connexion nécessaire la première fois). La trajectoire et le dessin marchent quand même."); else dessiner(); }); });
  v.addEventListener("seeked", dessiner); v.addEventListener("pause", () => { majPlay(); dessiner(); }); v.addEventListener("play", () => { majPlay(); boucle(); });
  v.addEventListener("timeupdate", () => { if (v.duration) seek.value = Math.round(v.currentTime / v.duration * 1000); });
  // toucher : poser le point de la barre, ou dessiner
  let enCours = null; const pt = (e) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  c.addEventListener("pointerdown", (e) => { const p = pt(e);
    if (opt.dessin) { enCours = [p]; traits.push(enCours); c.setPointerCapture(e.pointerId); return; }
    if (opt.bar) { const g = image(); if (!g) return; barre = { tpl: V.motif(g, Math.round(p.x * g.w), Math.round(p.y * g.h), 20), x: Math.round(p.x * g.w), y: Math.round(p.y * g.h), w: g.w, h: g.h }; chemin = [{ t: v.currentTime, x: p.x, y: p.y }]; info("Barre repérée : lance la lecture au ralenti pour tracer sa trajectoire."); dessiner(); } });
  c.addEventListener("pointermove", (e) => { if (enCours) { enCours.push(pt(e)); dessiner(); } });
  c.addEventListener("pointerup", () => { enCours = null; });
  cur = { v, c, ctx };
}
const info = (t) => { const el = document.getElementById("vinfo"); if (el) el.innerHTML = t; };
const majPlay = () => { const b = document.getElementById("vplay"), v = cur?.v; if (b && v) b.textContent = v.paused ? "▶ Lecture" : "⏸ Pause"; };
// Image réduite en niveaux de gris pour le suivi de la barre
let off = null;
function image() { const v = cur?.v; if (!v?.videoWidth) return null; const W = 240, H = Math.round(W * v.videoHeight / v.videoWidth); off = off || document.createElement("canvas"); off.width = W; off.height = H; const o = off.getContext("2d", { willReadFrequently: true }); try { o.drawImage(v, 0, 0, W, H); return V.gris(o.getImageData(0, 0, W, H).data, W, H); } catch { return null; } }
function boucle() { cancelAnimationFrame(raf); const pas = () => { if (!cur || cur.v.paused) return; suivreBarre(); dessiner(); raf = requestAnimationFrame(pas); }; raf = requestAnimationFrame(pas); }
function suivreBarre() {
  if (!barre) return; const g = image(); if (!g) return; const r = V.suivre(g, barre.tpl, barre.x, barre.y, 10); barre.x = r.x; barre.y = r.y;
  const t = cur.v.currentTime; if (!chemin.length || t > chemin.at(-1).t) chemin.push({ t, x: r.x / g.w, y: r.y / g.h });
}
async function dessiner() {
  if (!cur) return; const { v, c, ctx } = cur; ctx.clearRect(0, 0, c.width, c.height); const W = c.width, H = c.height, lw = Math.max(2, W / 220);
  let lm = null;
  if (pose && (opt.sq || opt.ang)) { const k = Math.round(v.currentTime * 30); lm = lmCache.get(k); if (!lm) { try { lm = pose.detect(v).landmarks?.[0] || null; } catch { lm = null; } lmCache.set(k, lm); } }
  if (lm && opt.sq) { ctx.strokeStyle = "rgba(80,255,170,.9)"; ctx.lineWidth = lw; V.OS.forEach(([a, b]) => { if ((lm[a]?.visibility ?? 1) < 0.4 || (lm[b]?.visibility ?? 1) < 0.4) return; ctx.beginPath(); ctx.moveTo(lm[a].x * W, lm[a].y * H); ctx.lineTo(lm[b].x * W, lm[b].y * H); ctx.stroke(); });
    ctx.fillStyle = "#fff"; [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(i => { if ((lm[i]?.visibility ?? 1) < 0.4) return; ctx.beginPath(); ctx.arc(lm[i].x * W, lm[i].y * H, lw * 1.4, 0, 7); ctx.fill(); }); }
  if (lm && opt.ang) { const a = V.angles(lm, W, H); if (a) { const s = a.cote === "droit" ? 1 : 0, lab = (i, txt) => { const p = lm[i]; if (!p) return; ctx.font = `bold ${Math.round(W / 22)}px system-ui`; ctx.fillStyle = "rgba(0,0,0,.55)"; const m = ctx.measureText(txt).width; ctx.fillRect(p.x * W + 8, p.y * H - W / 22, m + 10, W / 18); ctx.fillStyle = "#FFE27A"; ctx.fillText(txt, p.x * W + 13, p.y * H); };
    if (a.genou != null) lab(s ? 26 : 25, `${a.genou}°`); if (a.hanche != null) lab(s ? 24 : 23, `${a.hanche}°`); if (a.coude != null) lab(s ? 14 : 13, `${a.coude}°`);
    info(`Côté ${a.cote} · genou <b>${a.genou ?? "–"}°</b> · hanche <b>${a.hanche ?? "–"}°</b> · coude <b>${a.coude ?? "–"}°</b>${chemin.length > 5 ? ` · barre : écart horizontal ${V.deriveTrajectoire(chemin.map(p => ({ x: p.x * W, y: p.y * H })))} %` : ""}`); } }
  if (chemin.length) { const pts = chemin.filter(p => p.t <= v.currentTime + 0.01); ctx.strokeStyle = "#FF5A5F"; ctx.lineWidth = lw * 1.3; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)); ctx.stroke();
    const l = pts.at(-1); if (l) { ctx.fillStyle = "#FF5A5F"; ctx.beginPath(); ctx.arc(l.x * W, l.y * H, lw * 2.5, 0, 7); ctx.fill(); } }
  ctx.strokeStyle = "#FFD400"; ctx.lineWidth = lw * 1.2; ctx.lineCap = "round"; traits.forEach(tr => { ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(p.x * W, p.y * H) : ctx.moveTo(p.x * W, p.y * H)); ctx.stroke(); });
}
changes["vd-file"] = (el) => { const f = el.files?.[0]; if (!f) return; if (f.size > 300e6) return toast("Vidéo trop lourde (300 Mo maximum)"); ouvrirVideo(URL.createObjectURL(f)); };
changes["vd-spd"] = (el) => { if (cur) cur.v.playbackRate = +el.value; };
changes["vd-seek"] = (el) => { if (cur?.v.duration) cur.v.currentTime = el.value / 1000 * cur.v.duration; };
actions["vd-play"] = () => { const v = cur?.v; if (!v) return; if (v.paused) v.play().catch(() => toast("Lecture impossible")); else v.pause(); };
actions["vd-step"] = (b, d) => { const v = cur?.v; if (!v) return; v.pause(); v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + +d.v / 30)); if (+d.v > 0) setTimeout(() => { suivreBarre(); dessiner(); }, 80); };
actions["vd-opt"] = (b, d) => { opt[d.v] = !opt[d.v]; if (d.v === "dessin" && opt.dessin) opt.bar = false; if (d.v === "bar" && opt.bar) { opt.dessin = false; cur?.v.pause(); info("Touche la barre (le bout du disque, de profil)."); } document.querySelectorAll('[data-a="vd-opt"]').forEach(x => x.classList.toggle("on", !!opt[x.dataset.v])); dessiner(); };
actions["vd-clear"] = () => { traits = []; chemin = []; barre = null; dessiner(); };
actions["vd-new"] = () => { src = null; cur = null; rerender(); };
actions["vd-snap"] = async () => {
  if (!cur) return; const { v, c } = cur, o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const x = o.getContext("2d");
  try { x.drawImage(v, 0, 0, o.width, o.height); x.drawImage(c, 0, 0); } catch { return toast("Image impossible pour cette vidéo"); }
  o.toBlob(async (bl) => { if (!bl) return; const f = new File([bl], "analyse.png", { type: "image/png" });
    try { if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: "Analyse vidéo" }); else { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = "analyse.png"; a.click(); } } catch { } }, "image/png");
};
