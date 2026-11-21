// Canal « vidéos à analyser » (décision C72) : le membre envoie sa vidéo à Thomas, Thomas l'analyse dans l'éditeur
// (manuel ou automatique), puis partage le compte rendu et la vidéo commentée. Le membre n'a rien à faire d'autre.
// Données : table cxs_video_demandes ; fichiers : bucket « media », dossier <client>/analyses/<id>/ (js/cloud.js).
import { S } from "../store.js";
import { $app, esc, toast, routes, actions, changes, forms, header, go, R, I, fmtDate, ago, sheet, closeSheet, cloud, isCoach, rank, canMsg, rerender, buzz } from "../core.js";
import * as V from "../video-calc.js";

const LIMITE = 45e6; // le stockage accepte 50 Mo par fichier : au-delà, la vidéo est recompressée en 720p sur le téléphone
const STATUT = { envoyee: ["⏳", "En attente d'analyse"], en_cours: ["🔎", "Thomas l'analyse"], analysee: ["✅", "Analyse prête"] };
export let MES = null, ERR = null;
export const peutEnvoyer = () => !isCoach() && (rank() >= 2 || canMsg());

// ---------- Recompression (720p, 2,5 Mb/s) quand la vidéo dépasse la limite ----------
export async function compresser(file, onProg = () => { }) {
  if (file.size <= LIMITE) return file;
  if (typeof MediaRecorder === "undefined") throw new Error("Vidéo trop lourde (50 Mo maximum) : filme en 1080p ou coupe-la avant de l'envoyer");
  const url = URL.createObjectURL(file), v = document.createElement("video"); v.src = url; v.muted = true; v.playsInline = true;
  await new Promise((ok, ko) => { v.onloadedmetadata = ok; v.onerror = () => ko(new Error("Vidéo illisible")); });
  if (v.duration > 180) { URL.revokeObjectURL(url); throw new Error("Vidéo trop longue : 3 minutes au plus (une série suffit)"); }
  const sc = Math.min(1, 720 / Math.min(v.videoWidth, v.videoHeight)), c = document.createElement("canvas"); c.width = Math.round(v.videoWidth * sc / 2) * 2; c.height = Math.round(v.videoHeight * sc / 2) * 2;
  const x = c.getContext("2d"), type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: type, videoBitsPerSecond: 2.5e6 }), parts = []; rec.ondataavailable = e => e.data.size && parts.push(e.data);
  rec.start(500); await v.play();
  await new Promise(fin => { const pas = () => { if (v.ended || v.currentTime >= v.duration - 0.03) return fin(); x.drawImage(v, 0, 0, c.width, c.height); onProg(Math.round(v.currentTime / v.duration * 100)); requestAnimationFrame(pas); }; requestAnimationFrame(pas); v.onended = fin; });
  rec.stop(); await new Promise(r => rec.onstop = r); URL.revokeObjectURL(url);
  const t = type.split(";")[0], out = new File([new Blob(parts, { type: t })], `video.${t === "video/mp4" ? "mp4" : "webm"}`, { type: t });
  if (out.size > 50e6) throw new Error("Vidéo encore trop lourde : coupe-la (une série suffit)");
  return out;
}

// ---------- Côté membre ----------
export async function chargerMes() { try { const c = await cloud(); MES = c ? await c.videosMiennes() : []; ERR = null; } catch (e) { MES = []; ERR = e.message; } return MES; }
export function canalMembreHtml() {
  if (!peutEnvoyer()) return "";
  if (MES === null) { chargerMes().then(() => { if (/^#\/videos/.test(location.hash)) rerender(false); }); }
  const l = MES || [], nv = l.filter(d => d.statut === "analysee" && !d.seen_at).length;
  return `<div class="card mt8" style="box-shadow:0 0 0 1.5px var(--red) inset"><b>📤 Faire analyser ma vidéo par Thomas</b><p class="small muted mt4" style="margin:0 0 8px">Envoie ta série, Thomas l'analyse (trajectoire, vitesse, angles, technique) et te renvoie le compte rendu et la vidéo commentée.</p>
    <label class="btn btn-red btn-sm" style="display:block;text-align:center">🎥 Envoyer une vidéo<input type="file" accept="video/*" data-c="vc-file" style="display:none"></label></div>
    ${l.length ? `<h2 class="sec">Envoyées à Thomas <small>${l.length}${nv ? ` · ${nv} nouvelle${nv > 1 ? "s" : ""}` : ""}</small></h2><div class="list">${l.map(d => { const [ic, st] = STATUT[d.statut] || STATUT.envoyee;
      return `<button class="li" data-a="${d.statut === "analysee" ? "vc-voir" : "vc-attente"}" data-id="${d.id}"><span class="em">${ic}</span><span class="grow"><b class="small">${esc(d.mvt ? V.mouvement(d.mvt).n : "Vidéo")}</b>${d.statut === "analysee" && !d.seen_at ? ` <span class="tag r">nouveau</span>` : ""}<br><span class="xs muted">${esc(st)} · envoyée ${ago(d.created_at)}</span></span>${I.chev}</button>`; }).join("")}</div>` : ""}
    ${ERR ? `<p class="xs muted mt8">Liste indisponible pour l'instant (${esc(ERR)}).</p>` : ""}`;
}
let ENVOI = null;
changes["vc-file"] = (el) => {
  const f = el.files?.[0]; el.value = ""; if (!f) return; ENVOI = f;
  sheet(`<h2 class="h2">🎥 Envoyer à Thomas</h2><p class="small muted">${(f.size / 1e6).toFixed(0)} Mo${f.size > LIMITE ? " : elle sera allégée sur ton téléphone avant l'envoi (garde l'app ouverte)" : ""}.</p>
    <form data-f="vc-send" class="mt8"><label class="field"><span>Mouvement</span><select name="mvt">${V.MOUVEMENTS.map(m => `<option value="${m.id}">${esc(m.n)}</option>`).join("")}</select></label>
    <label class="field mt8"><span>Ce que tu veux qu'il regarde (facultatif)</span><textarea name="note" rows="3" maxlength="500" placeholder="Ex. 140 kg × 3, mal au genou gauche en bas, je sens que je bascule en avant"></textarea></label>
    <p class="xs muted mt8">Conseil : filme de profil, téléphone posé à hauteur de hanche, tout le corps et la barre dans l'image.</p>
    <button class="btn btn-red mt12" style="width:100%" id="vc-go">Envoyer</button></form>`);
};
forms["vc-send"] = async (v) => {
  if (!ENVOI) return; const b = document.getElementById("vc-go"); if (b) { b.disabled = true; b.textContent = "Préparation…"; }
  try {
    const f = await compresser(ENVOI, (p) => { if (b) b.textContent = `Allègement de la vidéo… ${p} %`; });
    if (b) b.textContent = "Envoi…";
    const c = await cloud(); await c.videoEnvoyer(f, { mvt: v.mvt, note: (v.note || "").trim() });
    c.send(`🎥 Nouvelle vidéo à analyser : ${V.mouvement(v.mvt).n}${v.note?.trim() ? ` · « ${v.note.trim().slice(0, 140)} »` : ""}`).catch(() => { });
    ENVOI = null; closeSheet(); buzz(); toast("Vidéo envoyée à Thomas ✅ Tu seras prévenu quand l'analyse sera prête"); await chargerMes(); rerender(false);
  } catch (e) { toast("Envoi impossible : " + e.message); if (b) { b.disabled = false; b.textContent = "Réessayer"; } }
};
actions["vc-attente"] = (b, d) => { const x = (MES || []).find(y => y.id === d.id); if (!x) return;
  sheet(`<h2 class="h2">${STATUT[x.statut]?.[0] || "⏳"} ${esc(STATUT[x.statut]?.[1] || "")}</h2><p class="small muted">${esc(x.mvt ? V.mouvement(x.mvt).n : "Vidéo")} · envoyée le ${fmtDate(x.created_at.slice(0, 10), { day: "numeric", month: "long" })}</p>${x.note ? `<p class="small">« ${esc(x.note)} »</p>` : ""}
    <p class="small">Tu recevras une notification dès que Thomas aura fini.</p><button class="btn btn-ghost btn-sm mt8" data-a="vc-del" data-id="${x.id}" style="color:var(--red)">Retirer cette vidéo</button>`); };
actions["vc-del"] = async (b, d) => { const x = [...(MES || []), ...(COACH || [])].find(y => y.id === d.id); if (!x || !confirm("Supprimer cette vidéo et son analyse ?")) return;
  try { await (await cloud()).videoSupprimer(x); closeSheet(); toast("Vidéo supprimée"); if (isCoach()) { COACH = null; go("coach-videos"); } else { await chargerMes(); go("videos"); } } catch (e) { toast(e.message); } };
actions["vc-voir"] = (b, d) => go("video-cr", d.id);

// ---------- Compte rendu (membre et coach) ----------
const d2 = (x) => x == null ? "–" : Number(x).toFixed(2).replace(".", ",");
export function compteRenduHtml(cr) {
  if (!cr) return `<p class="empty small">Compte rendu indisponible.</p>`;
  const u = cr.m ? " m/s" : "", ampl = (x) => x == null ? "–" : cr.m ? Math.round(x * 100) + " cm" : Math.round(x * 100) + " %";
  return `${cr.resume?.length ? `<div class="card mt8"><b class="small">🧾 En bref</b>${cr.resume.map(l => `<p class="small" style="margin:4px 0 0">${esc(l)}</p>`).join("")}</div>` : ""}
    ${cr.reps?.length ? `<div class="card mt8"><b class="small">📍 Répétition par répétition</b><div style="overflow-x:auto"><table class="qtab mt8"><tr><th>Rép.</th><th>Desc.</th><th>Montée</th>${cr.m ? "<th>Vitesse</th>" : ""}<th>Ampl.</th></tr>${cr.reps.map(r => `<tr${r.alertes?.length ? ' style="background:rgba(233,174,0,.12)"' : ""}><td>${r.n}${r.alertes?.length ? " ⚠️" : ""}</td><td>${d2(r.exc)} s</td><td>${d2(r.con)} s</td>${cr.m ? `<td>${d2(r.vMoy)}${u}</td>` : ""}<td>${ampl(r.amp)}</td></tr>`).join("")}</table></div>
      ${cr.reps.filter(r => r.alertes?.length).map(r => `<p class="xs" style="margin:2px 0 0">• Rép. ${r.n} : ${esc(r.alertes.join(", "))}</p>`).join("")}</div>` : ""}
    ${cr.crit?.length ? `<div class="card mt8"><b class="small">✅ Technique · ${esc(cr.mvtNom || "")}${cr.score != null ? ` · ${cr.score} %` : ""}</b>${cr.crit.map(c => `<p class="small" style="margin:4px 0 0">${c.v === "ok" ? "✅" : c.v === "moyen" ? "〰️" : "❌"} ${esc(c.c)}</p>`).join("")}</div>` : ""}
    ${cr.arrets?.length ? `<div class="card mt8"><b class="small">⏸️ Moments clés</b>${cr.arrets.map(k => `<p class="small" style="margin:6px 0 0"><b>${esc(k.t)}</b>${k.mesures?.length ? ` · ${esc(k.mesures.join(", "))}` : ""}${k.note ? `<br>${esc(k.note)}` : ""}</p>`).join("")}</div>` : ""}
    ${cr.notes ? `<div class="card mt8"><b class="small">💬 Le mot de Thomas</b><p class="small" style="margin:4px 0 0;white-space:pre-wrap">${esc(cr.notes)}</p></div>` : ""}`;
}
routes["video-cr"] = async () => {
  const id = R.param; $app.innerHTML = header("Analyse vidéo", "", { back: "videos" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  try {
    const c = await cloud(); const l = isCoach() ? await c.videosCoach() : await chargerMes(); const d = l.find(x => x.id === id); if (!d) throw new Error("analyse introuvable");
    const url = d.analyse_path ? await c.videoUrl(d.analyse_path) : await c.videoUrl(d.source_path);
    if (!isCoach() && !d.seen_at) c.videoVue(d.id).then(() => { d.seen_at = new Date().toISOString(); }).catch(() => { });
    const cr = d.compte_rendu || {};
    $app.innerHTML = header(esc(cr.mvtNom || (d.mvt ? V.mouvement(d.mvt).n : "Analyse vidéo")), `Analysée le ${fmtDate((d.analysed_at || d.created_at).slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}`, { back: isCoach() ? "coach-videos" : "videos" }) + `<main class="page" style="padding-bottom:100px">
      <video src="${esc(url)}" controls playsinline style="width:100%;border-radius:16px;background:#000"></video>
      <p class="xs muted mt4">${d.analyse_path ? "Vidéo commentée par Thomas : touche ⋯ ou appuie longtemps pour l'enregistrer." : "Vidéo envoyée."}</p>
      ${compteRenduHtml(cr)}
      ${d.analyse_path ? `<a class="btn btn-line mt12" href="${esc(url)}" download="analyse.mp4" style="display:block;text-align:center">⬇️ Enregistrer la vidéo commentée</a>` : ""}</main>`;
  } catch (e) { $app.innerHTML = header("Analyse vidéo", "", { back: "videos" }) + `<main class="page"><p class="empty">Ouverture impossible : ${esc(e.message)}</p></main>`; }
};

// ---------- Côté coach : la file des vidéos à analyser ----------
let COACH = null;
const nomDe = (uid) => { const m = (window.__members || []).find(x => x.id === uid); return m ? (m.name || m.email || "Client") : "Client"; };
export async function videosEnAttente() { try { const c = await cloud(); COACH = await c.videosCoach(); } catch { COACH = COACH || []; } return COACH.filter(d => d.statut !== "analysee"); }
export function blocAdmin(attente) {
  if (!attente?.length) return "";
  return `<button class="card tap mt12" data-a="go" data-r="coach-videos" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;box-shadow:0 0 0 2px var(--red) inset"><span style="font-size:28px">🎥</span><span class="grow"><b>${attente.length} vidéo${attente.length > 1 ? "s" : ""} à analyser</b><br><span class="small muted">${esc(attente.slice(0, 3).map(d => `${nomDe(d.user_id).split(" ")[0]} · ${d.mvt ? V.mouvement(d.mvt).n.toLowerCase() : "vidéo"}`).join(", "))}</span></span>${I.chev}</button>`;
}
routes["coach-videos"] = async () => {
  if (!isCoach()) return go("home");
  $app.innerHTML = header("Vidéos à analyser", "", { back: "admin-today" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  const c = await cloud(); if (!window.__members) { try { window.__members = await c.members(); } catch { } }
  try { COACH = await c.videosCoach(); } catch (e) { $app.innerHTML = header("Vidéos à analyser", "", { back: "admin-today" }) + `<main class="page"><p class="empty">Liste indisponible : ${esc(e.message)}</p></main>`; return; }
  const att = COACH.filter(d => d.statut !== "analysee"), faites = COACH.filter(d => d.statut === "analysee");
  const li = (d) => `<div class="li"><span class="em">${STATUT[d.statut]?.[0] || "⏳"}</span><span class="grow small"><b>${esc(nomDe(d.user_id))}</b> · ${esc(d.mvt ? V.mouvement(d.mvt).n : "Vidéo")}<br><span class="xs muted">${ago(d.created_at)}${d.note ? ` · « ${esc(d.note.slice(0, 90))} »` : ""}${d.statut === "analysee" ? ` · ${d.seen_at ? "vue" : "pas encore vue"}` : ""}</span></span>
    ${d.statut === "analysee" ? `<button class="btn btn-line btn-xs" data-a="go" data-r="video-cr" data-p="${d.id}">Voir</button>` : ""}<button class="btn ${d.statut === "analysee" ? "btn-ghost" : "btn-red"} btn-xs" data-a="vc-analyser" data-id="${d.id}">${d.statut === "analysee" ? "Reprendre" : "🔬 Analyser"}</button></div>`;
  $app.innerHTML = header("Vidéos à analyser", `${att.length} en attente`, { back: "admin-today" }) + `<main class="page" style="padding-bottom:100px">
    <h2 class="sec">À analyser <small>${att.length}</small></h2>${att.length ? `<div class="list">${att.map(li).join("")}</div>` : `<p class="empty small">Rien en attente 👌</p>`}
    ${faites.length ? `<h2 class="sec">Analysées <small>${faites.length}</small></h2><div class="list">${faites.slice(0, 40).map(li).join("")}</div>` : ""}
    <p class="xs muted mt12">Une analyse se fait dans l'éditeur (outils ou 🤖 analyse auto), puis « 📤 Partager à … » envoie le compte rendu et la vidéo commentée.</p></main>`;
};
actions["vc-analyser"] = async (b, d) => {
  const x = (COACH || []).find(y => y.id === d.id); if (!x) return;
  try { const c = await cloud(); const url = await c.videoUrl(x.source_path); if (x.statut === "envoyee") c.videoStatut(x.id, "en_cours").catch(() => { });
    const { ouvrirVideo } = await import("./video.js"); await ouvrirVideo(url, { demande: { id: x.id, user_id: x.user_id, source_path: x.source_path, analyse_path: x.analyse_path, mvt: x.mvt, note: x.note, nom: nomDe(x.user_id) } });
  } catch (e) { toast("Ouverture impossible : " + e.message); }
};
