// Espace coach : onglet « Suivi » du dossier d'un membre (régularité, alertes, bilans, anamnèse, témoignage, photos envoyées).
// Appelé dans withState(D, …) : S() est l'état du membre affiché.
import { S, today } from "../store.js";
import { esc, fr, fmtDate, cloud, lineChart } from "../core.js";
import { offer } from "../config.js";
import { STATUS, LABELS, WEIGHTS } from "../adherence.js";
import { myAdherence, myAlerts, checkins, summaryBetween, defiDay, since } from "../progress.js";
import { HEALTH } from "./anamnese.js";
import { checkinText } from "./checkin.js";
import { scoreRing } from "./suivi.js";
import { resume } from "../programme.js";

const ZL = { epaule: "Épaule", coude: "Coude", poignet: "Poignet", nuque: "Nuque", lombaires: "Bas du dos", hanche: "Hanche", genou: "Genou", cheville: "Cheville" };
const YL = { 0: "Jamais vraiment", 1: "Moins d'1 an", 3: "1 à 3 ans", 5: "Plus de 3 ans" };

export function memberSuivi(D, m) {
  const coached = offer(m.tier).rank >= 2;
  const a = myAdherence(), st = STATUS[a.status], al = myAlerts(today(), coached || !!S().trialStart);
  const cis = checkins().slice().reverse(), an = S().anamnese, t = S().testimonial;
  const from = S().trialStart || since() || today(), sum = summaryBetween(from);
  const ser = (k) => checkins().filter(c => c[k] != null).map(c => ({ y: c[k], l: c.d.slice(8, 10) + "/" + c.d.slice(5, 7) }));
  const parts = Object.keys(WEIGHTS).map(k => [k, a.parts[k]]).filter(([, p]) => p);
  setTimeout(hydratePhotos, 0);
  return `
    <div class="card mt12" style="display:flex;gap:14px;align-items:center">${scoreRing(a.score, 84)}<div class="grow"><span class="tag ${"st-" + st.tone}">${st.label}</span>
      <p class="xs muted mt4" style="margin:0">${a.trend != null ? `Cette semaine ${a.week} · la précédente ${a.prevWeek} (${a.trend > 0 ? "+" : ""}${a.trend})` : "Tendance après 2 semaines"}${S().trialStart && defiDay() <= 37 ? ` · défi jour ${defiDay()}` : ""}</p>
      <p class="xs mt4" style="margin:0">${parts.map(([k, p]) => `${LABELS[k]} ${Math.round(p.pct * 100)} %`).join(" · ")}</p></div></div>
    ${al.length ? `<div class="list mt12">${al.map(x => `<div class="li"><span class="em">${x.level === "risk" ? "🔴" : x.level === "watch" ? "🟠" : "🔵"}</span><span class="grow small">${esc(x.text)}</span></div>`).join("")}</div>` : `<p class="small muted mt8">✅ Aucune alerte.</p>`}
    <h2 class="sec">📈 Depuis le ${fmtDate(from, { day: "numeric", month: "short" })}</h2>
    <div class="card"><div class="stat3"><div><b>${sum.weight ? `${sum.weight.delta > 0 ? "+" : ""}${fr(sum.weight.delta, 1)}` : "–"}</b><span>kg</span></div><div><b>${sum.waist ? `${sum.waist.delta > 0 ? "+" : ""}${fr(sum.waist.delta, 1)}` : "–"}</b><span>cm de taille</span></div><div><b>${sum.sessions}</b><span>séances</span></div></div>
      ${sum.lifts.length ? `<p class="xs mt8" style="margin-bottom:0">🏆 ${sum.lifts.map(l => `${esc(l.name)} +${fr(l.delta, 1)} kg`).join(" · ")}</p>` : ""}</div>
    <h2 class="sec">📝 Bilans <small>${cis.length}</small></h2>
    ${cis.length >= 2 ? `<div class="card"><div class="lbl">Poids moyen</div>${lineChart(ser("weight"), { h: 120, yfmt: (x) => fr(x, 1) })}<div class="lbl mt8">Énergie /10</div>${lineChart(ser("energy"), { h: 110 })}</div>` : ""}
    ${cis.slice(0, 6).map((c, i) => `<details class="card mt8" ${i === 0 ? "open" : ""}><summary style="list-style:none;cursor:pointer"><div class="row between"><b class="small">${fmtDate(c.d, { weekday: "short", day: "numeric", month: "short" })}</b><span class="xs muted">${c.score ?? "–"}/100</span></div></summary><pre class="xs" style="white-space:pre-wrap;font-family:inherit;margin:8px 0 0">${esc(checkinText(c).split("\n").slice(1).join("\n"))}</pre></details>`).join("") || `<p class="small muted">Pas encore de bilan structuré.</p>`}
    <h2 class="sec">🩺 Anamnèse</h2>
    ${an?.at ? `<div class="card small">
      ${an.flags?.length ? `<div class="card" style="box-shadow:0 0 0 2px var(--warn) inset;margin:0 0 10px"><b>⚠️ ${an.flags.length} réponse${an.flags.length > 1 ? "s" : ""} « oui » santé</b>${HEALTH.filter(([k]) => an.health?.[k]).map(([, q]) => `<p class="xs mt4" style="margin:0">• ${esc(q)}</p>`).join("")}${an.healthNote ? `<p class="xs mt4" style="margin:0"><b>Précision :</b> ${esc(an.healthNote)}</p>` : ""}<p class="xs muted mt4" style="margin:0">Avis médical conseillé avant d'augmenter l'intensité.</p></div>` : `<p style="margin:0 0 6px">✅ Aucun « oui » aux questions santé.</p>`}
      ${an.zones?.length ? `<p style="margin:0 0 6px"><b>Gênes :</b> ${an.zones.map(z => ZL[z] || z).join(", ")}</p>` : ""}${an.surgery ? `<p style="margin:0 0 6px"><b>Antécédents :</b> ${esc(an.surgery)}</p>` : ""}
      <p style="margin:0 0 6px"><b>Pourquoi maintenant :</b> ${esc(an.motivation?.why || "–")}</p><p style="margin:0 0 6px"><b>Fier si :</b> ${esc(an.motivation?.proud || "–")}${an.motivation?.deadline ? ` · <b>échéance</b> ${fmtDate(an.motivation.deadline, { day: "numeric", month: "short", year: "numeric" })}` : ""}${an.motivation?.ready ? ` · <b>prêt</b> ${an.motivation.ready}/10` : ""}</p>
      <p style="margin:0 0 6px"><b>Historique :</b> ${YL[an.history?.years] || "–"}${an.history?.tried?.length ? ` · a essayé : ${an.history.tried.join(", ")}` : ""}</p>${an.history?.worked ? `<p style="margin:0 0 6px"><b>A marché :</b> ${esc(an.history.worked)}</p>` : ""}${an.history?.stopped ? `<p style="margin:0 0 6px"><b>L'a fait arrêter :</b> ${esc(an.history.stopped)}</p>` : ""}
      <p class="xs muted" style="margin:0">Sommeil ${an.life?.sleep ?? "–"} h · stress ${an.life?.stress ?? "–"}/10 · ${esc(an.life?.schedule || "rythme ?")} · enfants ${an.life?.kids == null ? "?" : an.life.kids ? "oui" : "non"} · alcool ${esc(an.life?.alcohol || "?")} · tabac ${an.life?.smoke == null ? "?" : an.life.smoke ? "oui" : "non"} · rempli le ${fmtDate(an.at.slice(0, 10), { day: "numeric", month: "short" })}</p></div>`
      : `<p class="small muted">Pas encore remplie. Le membre la voit sur son accueil et dans le Défi 30 jours.</p>`}
    <h2 class="sec">🧩 Programme sur mesure</h2>
    ${S().programme?.answers ? `<div class="card small">${resume(S().programme).map(([k, v]) => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line);gap:12px;align-items:flex-start"><span class="muted" style="flex:none">${esc(k)}</span><span style="text-align:right">${esc(v)}</span></div>`).join("")}<p class="xs muted mt8" style="margin:0">Rempli le ${fmtDate(S().programme.at.slice(0, 10), { day: "numeric", month: "long" })}.${an?.consent ? "" : " Gênes non partagées : pas de consentement dans « Mon point de départ »."}</p></div>`
      : `<p class="small muted">Pas encore rempli. Le membre le trouve dans Profil › Mon programme sur mesure.</p>`}
    <h2 class="sec">💬 Témoignage</h2>
    ${t?.ok ? `<div class="card small"><p style="margin:0">« ${esc(t.quote)} »</p><p class="xs muted mt8" style="margin:0">Accord du ${fmtDate(t.at.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })} · ${t.anon === "anonyme" ? "anonyme" : t.anon === "initiale" ? "initiale seulement" : "prénom"} · ${t.photos ? "photos autorisées" : "sans photos"}${t.summary ? ` · ${t.summary.days} j, ${t.summary.weight != null ? `${t.summary.weight > 0 ? "+" : ""}${fr(t.summary.weight, 1)} kg, ` : ""}${t.summary.sessions} séances` : ""}</p></div>`
      : t?.revokedAt ? `<p class="small muted">Accord retiré le ${fmtDate(t.revokedAt.slice(0, 10), { day: "numeric", month: "long" })} : ne plus utiliser.</p>` : `<p class="small muted">Pas de témoignage autorisé.</p>`}
    <h2 class="sec">📸 Photos envoyées <small>${(S().sharedPhotos || []).length}</small></h2>
    ${(S().sharedPhotos || []).length ? `<div class="photo-grid">${S().sharedPhotos.slice(-9).map(p => `<figure><img alt="Photo du ${esc(p.d)}" data-ppath="${esc(p.path)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="background:var(--line)"><figcaption>${fmtDate(p.d, { day: "numeric", month: "short" })} · ${esc(p.view)}</figcaption></figure>`).join("")}</div>`
      : `<p class="small muted">Le membre n'a envoyé aucune photo (elles restent sur son téléphone tant qu'il ne les envoie pas).</p>`}`;
}

async function hydratePhotos() {
  const imgs = [...document.querySelectorAll("img[data-ppath]")]; if (!imgs.length) return;
  try { const c = await cloud(); const urls = await c.progressPhotoUrls(imgs.map(i => i.dataset.ppath)); imgs.forEach(i => { if (urls[i.dataset.ppath]) i.src = urls[i.dataset.ppath]; }); } catch (e) { console.warn("Photos indisponibles :", e.message); }
}
