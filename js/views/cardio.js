// Cardio et multisport : ma semaine (séances programmées, récurrentes), éditeur de séance structurée,
// guidage en direct (blocs, allures, bips et notification à chaque changement), enregistrement avec dépense par MET.
// Le même éditeur sert au coach pour programmer le cardio d'un athlète, avec un plan de progression.
import { S, update, today } from "../store.js";
import { esc, num, fr, toast, routes, actions, forms, changes, header, sheet, closeSheet, rerender, go, I, addDays, fmtDate, buzz, tabbar } from "../core.js";
import * as C from "../cardio.js";
import { scheduleRest, unlockAudio, beep } from "../push.js";

const ref = () => S().cardioRef || {};
const poids = () => S().profile?.weight || 75;
const opts = (it) => ({ vma: +ref().vma || 0, sport: it?.sport || "course" });
const mes = () => S().cardioPlan || [];
const duCoach = () => (S().coachSettings?.cardio || []).map(x => ({ ...x, coach: true }));
export const tousItems = () => [...duCoach(), ...mes()];
const cle = (it, d) => `${it.id}@${d}`;
const faite = (it, d) => (S().daily?.[d]?.cardio || []).some(c => c.plan === cle(it, d));
const dowOf = (k) => (new Date(k + "T12:00:00").getDay() + 6) % 7;

// ---------- Ma semaine cardio (onglet Entraînement › Cardio) ----------
let wkOff = 0;
export function semaineCardio() {
  const t = today(), mon = addDays(addDays(t, -dowOf(t)), 7 * wkOff), sun = addDays(mon, 6), occ = C.occurrences(tousItems(), mon, sun);
  const jours = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  return `<div class="card mt12"><div class="row between"><b class="small">🗓️ ${wkOff === 0 ? "Ma semaine cardio" : `Semaine du ${fmtDate(mon, { day: "numeric", month: "short" })}`}</b>
      <div class="row" style="gap:4px"><button class="icon-btn sm" data-a="cw-wk" data-v="-1" aria-label="Semaine précédente">${I.back}</button><button class="icon-btn sm" data-a="cw-wk" data-v="1" aria-label="Semaine suivante" style="transform:scaleX(-1)">${I.back}</button></div></div>
    <div data-swipe="cw-wk">${jours.map(k => { const l = occ.filter(o => o.d === k); return `<div class="cw-day ${k === t ? "today" : ""}"><span class="cw-d">${C.JOURS[dowOf(k)]}<br><b>${Number(k.slice(8))}</b></span><div class="grow" style="min-width:0">${l.length ? l.map(o => occLigne(o, t)).join("") : `<span class="xs muted">—</span>`}</div></div>`; }).join("")}</div>
    <div class="row mt8" style="gap:8px"><button class="btn btn-red btn-sm grow" data-a="cd-new">+ Programmer une séance</button><button class="btn btn-line btn-sm" style="width:auto" data-a="cd-ref">⚙️ Allures</button></div>
    ${+ref().vma ? `<p class="xs muted" style="margin:6px 0 0">VMA ${fr(ref().vma, 1)} km/h · endurance ${C.allureZone("ef", +ref().vma)}${+ref().fcmax ? ` · FC max ${ref().fcmax}` : ""}</p>` : `<p class="xs muted" style="margin:6px 0 0">Règle ta VMA (⚙️ Allures) pour avoir tes allures cibles.</p>`}</div>`;
}
function occLigne(o, t) {
  const it = o.it, f = faite(it, o.d), b = C.progresser(it, o.k), m = C.modele(it.modele);
  return `<div class="cw-it ${f ? "done" : ""}"><button class="grow" style="text-align:left;min-width:0" data-a="cd-open" data-id="${esc(it.id)}" data-d="${o.d}"><b class="small">${f ? "✅ " : ""}${esc(it.titre || m?.n || "Séance")}${it.coach ? ` <span class="tag" style="font-size:10px">Thomas</span>` : ""}</b><br><span class="xs muted">${it.heure ? it.heure + " · " : ""}${esc(C.sport(it.sport)[1])} · ${C.dureeTotale(b, opts(it))} min${it.prog && o.k ? ` · semaine ${o.k + 1}` : ""}</span></button>
    ${!f && o.d <= t ? `<button class="btn btn-red btn-xs" data-a="cd-go" data-id="${esc(it.id)}" data-d="${o.d}">▶</button>` : ""}</div>`;
}
actions["cw-wk"] = (b, d) => { wkOff = Math.max(-8, Math.min(8, wkOff + +d.v)); rerender(false); };

// Carte « cardio du jour » (accueil)
export function cardioDuJour() {
  const t = today(), l = C.occurrences(tousItems(), t, t).filter(o => !faite(o.it, t)); if (!l.length) return "";
  return `<div class="card mt12"><div class="lbl">🏃 Cardio prévu aujourd'hui</div>${l.map(o => `<div class="row between mt8" style="gap:8px"><span class="small"><b>${esc(o.it.titre || C.modele(o.it.modele)?.n || "Séance")}</b><br><span class="xs muted">${o.it.heure ? o.it.heure + " · " : ""}${C.dureeTotale(C.progresser(o.it, o.k), opts(o.it))} min · ${esc(C.resumeBlocs(C.progresser(o.it, o.k)))}</span></span><button class="btn btn-red btn-sm" style="width:auto;flex:none" data-a="cd-go" data-id="${esc(o.it.id)}" data-d="${t}">▶ Lancer</button></div>`).join("")}</div>`;
}

// ---------- Allures de référence ----------
actions["cd-ref"] = () => sheet(`<h2 class="h2">⚙️ Mes allures</h2><form data-f="cd-ref" class="mt12">
  <div class="grid2"><label class="field"><span>VMA (km/h)</span><input name="vma" inputmode="decimal" value="${ref().vma || ""}" placeholder="14"></label><label class="field"><span>FC max (bpm)</span><input name="fcmax" inputmode="numeric" value="${ref().fcmax || ""}" placeholder="${S().profile?.age ? 220 - S().profile.age : 185}"></label></div>
  <p class="xs muted mt8">Pas de VMA ? Ton allure sur 6 minutes à fond, ou ta vitesse moyenne sur un 10 km ÷ 0,85, en donnent une bonne estimation. Sans FC max mesurée : 220 − ton âge.</p>
  ${+ref().vma ? `<div class="card soft mt8">${["ef", "tempo", "seuil", "vma"].map(z => `<div class="row between xs" style="padding:3px 0"><span><i class="zdot" style="background:${C.ZONES[z].c}"></i>${C.ZONES[z].n}</span><b>${C.allureZone(z, +ref().vma)}</b></div>`).join("")}</div>` : ""}
  <button class="btn btn-red mt12">Enregistrer</button></form>`);
forms["cd-ref"] = (v) => { const vma = num(v.vma || ""), fc = Math.round(num(v.fcmax || "")); update(st => { st.cardioRef = { vma: vma > 5 && vma < 30 ? vma : null, fcmax: fc > 120 && fc < 230 ? fc : null }; }); closeSheet(); toast("Allures enregistrées"); rerender(); };

// ---------- Éditeur (membre ou coach) ----------
let CD = null, CD_SAVE = null; // brouillon et fonction d'enregistrement (membre : son plan ; coach : réglages de l'athlète)
export function ouvrirEditeur(item, { onSave, coach = false } = {}) {
  CD = JSON.parse(JSON.stringify(item || { id: "c" + Date.now(), sport: "course", modele: "ef", blocs: C.modele("ef").blocs, quand: { jours: [dowOf(today())], from: today() } }));
  CD.coachMode = coach; CD_SAVE = onSave || saveMine; drawEditeur(false);
}
function blocLigne(b, path) {
  const zs = Object.entries(C.ZONES).map(([k, z]) => `<option value="${k}" ${b.z === k ? "selected" : ""}>${z.n}</option>`).join("");
  const ts = Object.entries(C.BLOC_T).map(([k, l]) => `<option value="${k}" ${b.t === k ? "selected" : ""}>${l}</option>`).join("");
  const unit = b.km != null ? "km" : "min", val = b.km != null ? b.km : b.min;
  return `<div class="cd-bloc" style="border-left:4px solid ${C.ZONES[b.z]?.c || "var(--line)"}"><div class="grid3" style="gap:6px"><select data-c="cd-b" data-p="${path}" data-k="t">${ts}</select><select data-c="cd-b" data-p="${path}" data-k="z">${zs}</select>
    <div class="row" style="gap:4px"><input data-c="cd-b" data-p="${path}" data-k="v" inputmode="decimal" value="${String(val).replace(".", ",")}" style="min-width:0"><select data-c="cd-b" data-p="${path}" data-k="u" style="width:auto;min-width:0"><option value="min" ${unit === "min" ? "selected" : ""}>min</option><option value="km" ${unit === "km" ? "selected" : ""}>km</option></select></div></div>
    <div class="row between xs mt4"><span class="muted">${+ref().vma && C.ZONES[b.z]?.vma && C.sport(CD.sport)[3] === "course" ? C.allureZone(b.z, +ref().vma) : esc(C.ZONES[b.z]?.rpe || "")}</span><button type="button" class="link xs" data-a="cd-bdel" data-p="${path}">Retirer</button></div></div>`;
}
function drawEditeur(keep = true) {
  const q = CD.quand || {}, rec = !q.date, b = CD.blocs, mod = C.MODELES.filter(m => m.sport === CD.sport || C.sport(m.sport)[3] === C.sport(CD.sport)[3] || m.id === "libre");
  sheet(`<h2 class="h2">${CD.coachMode ? "🏃 Programmer son cardio" : "🏃 Programmer une séance"}</h2>
    <label class="field mt8"><span>Sport</span><select data-c="cd-sport">${C.SPORTS.map(s => `<option value="${s[0]}" ${CD.sport === s[0] ? "selected" : ""}>${esc(s[1])}</option>`).join("")}</select></label>
    <div class="lbl mt12">Type de séance</div><div class="chips wrap">${mod.map(m => `<button type="button" class="chip ${CD.modele === m.id ? "on" : ""}" data-a="cd-mod" data-v="${m.id}">${m.ic} ${esc(m.n)}</button>`).join("")}</div>
    ${C.modele(CD.modele) ? `<p class="xs muted mt4">${esc(C.modele(CD.modele).d)}</p>` : ""}
    <label class="field mt8"><span>Nom</span><input data-c="cd-f" data-k="titre" value="${esc(CD.titre || C.modele(CD.modele)?.n || "")}" maxlength="60"></label>
    <div class="row between mt12"><b class="lbl" style="margin:0">Déroulé · ${C.dureeTotale(b, opts(CD))} min</b><span class="row" style="gap:10px"><button type="button" class="link xs" data-a="cd-badd">+ Bloc</button><button type="button" class="link xs" data-a="cd-radd">+ Répétition</button></span></div>
    ${b.map((x, i) => x.rep ? `<div class="cd-rep"><div class="row between"><b class="small">🔁 Répéter</b><span class="row" style="gap:6px;align-items:center"><input data-c="cd-rep" data-p="${i}" inputmode="numeric" value="${x.rep}" style="width:56px"> fois <button type="button" class="link xs" data-a="cd-bdel" data-p="${i}">Retirer</button></span></div>${x.items.map((y, j) => blocLigne(y, i + "." + j)).join("")}<button type="button" class="link xs mt4" data-a="cd-badd" data-p="${i}">+ Bloc dans la répétition</button></div>` : blocLigne(x, String(i))).join("")}
    <div class="lbl mt12">Quand</div>${seg2([["rec", "Toutes les semaines"], ["une", "Une fois"]], rec ? "rec" : "une")}
    ${rec ? `<div class="chips mt8">${C.JOURS.map((j, i) => `<button type="button" class="chip ${(q.jours || []).includes(i) ? "on" : ""}" data-a="cd-jour" data-v="${i}">${j}</button>`).join("")}</div>
      <div class="grid3 mt8"><label class="field"><span>À partir du</span><input type="date" data-c="cd-q" data-k="from" value="${q.from || today()}"></label><label class="field"><span>Jusqu'au</span><input type="date" data-c="cd-q" data-k="until" value="${q.until || ""}"></label><label class="field"><span>Rythme</span><select data-c="cd-q" data-k="every"><option value="1">Chaque semaine</option><option value="2" ${q.every === 2 ? "selected" : ""}>1 sur 2</option></select></label></div>`
      : `<label class="field mt8"><span>Date</span><input type="date" data-c="cd-q" data-k="date" value="${q.date || today()}"></label>`}
    <label class="field mt8"><span>Heure (facultatif)</span><input type="time" data-c="cd-f" data-k="heure" value="${CD.heure || ""}"></label>
    ${CD.coachMode || CD.prog ? `<div class="card soft mt12"><b class="small">📈 Plan de progression</b><p class="xs muted mt4">À chaque semaine, la séance s'allonge ou se densifie toute seule.</p>
      <div class="grid2 mt8"><label class="field"><span>Durée du plan (semaines)</span><input data-c="cd-p" data-k="weeks" inputmode="numeric" value="${CD.prog?.weeks || ""}" placeholder="8"></label><label class="field"><span>Toutes les</span><select data-c="cd-p" data-k="every"><option value="1">semaines</option><option value="2" ${CD.prog?.every === 2 ? "selected" : ""}>2 semaines</option></select></label></div>
      <div class="grid2 mt8"><label class="field"><span>+ min par bloc d'effort</span><input data-c="cd-p" data-k="effortMin" inputmode="decimal" value="${CD.prog?.effortMin || ""}" placeholder="2"></label><label class="field"><span>+ répétitions</span><input data-c="cd-p" data-k="reps" inputmode="numeric" value="${CD.prog?.reps || ""}" placeholder="1"></label></div></div>`
      : `<button type="button" class="link xs mt8" data-a="cd-prog">+ Ajouter un plan de progression</button>`}
    <label class="field mt8"><span>Consigne (facultatif)</span><textarea data-c="cd-f" data-k="note" rows="2" maxlength="300">${esc(CD.note || "")}</textarea></label>
    <button class="btn btn-red mt12" data-a="cd-save">Enregistrer</button>${CD.saved ? `<button class="btn btn-ghost mt8" data-a="cd-del">Supprimer</button>` : ""}`, null, { keep });
}
const seg2 = (l, v) => `<div class="seg mt4">${l.map(([k, n]) => `<button type="button" class="${k === v ? "on" : ""}" data-a="cd-qmode" data-v="${k}">${n}</button>`).join("")}</div>`;
const at = (p) => { const [i, j] = String(p).split(".").map(Number); return j == null ? { arr: CD.blocs, i } : { arr: CD.blocs[i].items, i: j }; };
changes["cd-sport"] = (el) => { CD.sport = el.value; const m = C.MODELES.find(x => x.sport === CD.sport) || C.MODELES.find(x => C.sport(x.sport)[3] === C.sport(CD.sport)[3]) || C.modele("libre"); CD.modele = m.id; CD.blocs = JSON.parse(JSON.stringify(m.blocs)); CD.titre = ""; drawEditeur(); };
actions["cd-mod"] = (b, d) => { const m = C.modele(d.v); CD.modele = m.id; CD.blocs = JSON.parse(JSON.stringify(m.blocs)); CD.titre = ""; drawEditeur(); };
changes["cd-f"] = (el) => { CD[el.dataset.k] = el.value; };
changes["cd-q"] = (el) => { CD.quand = CD.quand || {}; const k = el.dataset.k; CD.quand[k] = k === "every" ? +el.value : el.value || undefined; };
changes["cd-p"] = (el) => { CD.prog = CD.prog || {}; const v = num(el.value || ""); CD.prog[el.dataset.k] = el.dataset.k === "every" ? +el.value : v > 0 ? v : undefined; };
changes["cd-rep"] = (el) => { const n = Math.round(num(el.value)); if (n >= 1 && n <= 30) { CD.blocs[+el.dataset.p].rep = n; drawEditeur(); } };
changes["cd-b"] = (el) => {
  const { arr, i } = at(el.dataset.p), b = arr[i], k = el.dataset.k;
  if (k === "t" || k === "z") b[k] = el.value;
  else if (k === "v") { const v = num(el.value); if (v > 0) { if (b.km != null) b.km = v; else b.min = v; } }
  else if (k === "u") { const v = b.km != null ? b.km : b.min; delete b.km; delete b.min; if (el.value === "km") b.km = v > 5 ? 1 : v; else b.min = v; }
  drawEditeur();
};
actions["cd-bdel"] = (b, d) => { const { arr, i } = at(d.p); arr.splice(i, 1); if (!CD.blocs.length) CD.blocs.push({ t: "effort", z: "ef", min: 20 }); drawEditeur(); };
actions["cd-badd"] = (b, d) => { const nb = { t: "effort", z: "ef", min: 10 }; if (d.p != null && CD.blocs[+d.p]?.items) CD.blocs[+d.p].items.push(nb); else { const last = CD.blocs.at(-1)?.t === "calme" ? CD.blocs.length - 1 : CD.blocs.length; CD.blocs.splice(last, 0, nb); } drawEditeur(); };
actions["cd-radd"] = () => { const last = CD.blocs.at(-1)?.t === "calme" ? CD.blocs.length - 1 : CD.blocs.length; CD.blocs.splice(last, 0, { rep: 4, items: [{ t: "effort", z: "seuil", min: 3 }, { t: "recup", z: "facile", min: 1.5 }] }); drawEditeur(); };
actions["cd-qmode"] = (b, d) => { CD.quand = d.v === "une" ? { date: CD.quand?.date || today() } : { jours: CD.quand?.jours || [dowOf(today())], from: CD.quand?.from || today() }; drawEditeur(); };
actions["cd-jour"] = (b, d) => { const j = CD.quand.jours = CD.quand.jours || [], v = +d.v, i = j.indexOf(v); if (i >= 0) j.splice(i, 1); else j.push(v); j.sort(); drawEditeur(); };
actions["cd-prog"] = () => { CD.prog = { weeks: 8, every: 1, effortMin: 2 }; drawEditeur(); };
actions["cd-save"] = async () => {
  if (CD.quand && !CD.quand.date && !(CD.quand.jours || []).length) return toast("Choisis au moins un jour");
  const it = { ...CD }; delete it.coachMode; delete it.saved; delete it.coach; if (!it.titre) it.titre = C.modele(it.modele)?.n || "Séance";
  if (it.prog && !Object.values(it.prog).some(Boolean)) delete it.prog;
  if (await CD_SAVE(it)) { closeSheet(); toast("Séance programmée"); rerender(); }
};
actions["cd-del"] = async () => { if (!confirm("Supprimer cette séance programmée ?")) return; if (await CD_SAVE(null, CD.id)) { closeSheet(); rerender(); } };
async function saveMine(it, delId) { update(st => { st.cardioPlan = (st.cardioPlan || []).filter(x => x.id !== (it?.id || delId)); if (it) st.cardioPlan.push(it); }); return true; }
actions["cd-new"] = () => ouvrirEditeur(null);

// Détail d'une séance programmée
actions["cd-open"] = (b, d) => {
  const it = tousItems().find(x => String(x.id) === d.id); if (!it) return;
  const k = C.semaineDe(it, d.d), bl = C.progresser(it, k), f = faite(it, d.d);
  sheet(`<div class="xs muted">${fmtDate(d.d, { weekday: "long", day: "numeric", month: "long" })}${it.heure ? " · " + it.heure : ""}${it.coach ? " · programmée par Thomas" : ""}</div><h2 class="h2 mt4">${esc(it.titre)}</h2>
    <div class="xs muted">${esc(C.sport(it.sport)[1])} · ${C.dureeTotale(bl, opts(it))} min · ${esc(C.libQuand(it.quand))}${it.prog?.weeks ? ` · semaine ${k + 1}/${it.prog.weeks}` : ""}</div>
    ${it.note ? `<div class="cue mt8">🗣️ ${esc(it.note)}</div>` : ""}
    <div class="mt12">${C.deroule(bl, opts(it)).map(x => `<div class="row between small" style="padding:6px 0;border-bottom:1px solid var(--line);gap:8px"><span><i class="zdot" style="background:${C.ZONES[x.z]?.c}"></i>${esc(C.BLOC_T[x.t])}${x.rep ? ` <span class="xs muted">${x.r}/${x.rep}</span>` : ""}</span><span class="xs" style="text-align:right"><b>${C.qte(x)}</b> · ${esc(C.ZONES[x.z]?.n)}${+ref().vma && C.sport(it.sport)[3] === "course" && C.ZONES[x.z]?.vma ? `<br>${C.allureZone(x.z, +ref().vma)}` : ""}</span></div>`).join("")}</div>
    ${f ? `<p class="small mt12">✅ Faite.</p>` : d.d <= today() ? `<button class="btn btn-red mt12" data-a="cd-go" data-id="${esc(it.id)}" data-d="${d.d}">▶ Lancer la séance</button>` : ""}
    ${it.coach ? "" : `<button class="btn btn-line mt8" data-a="cd-edit" data-id="${esc(it.id)}">✏️ Modifier</button>`}`);
};
actions["cd-edit"] = (b, d) => { const it = mes().find(x => String(x.id) === d.id); if (it) { ouvrirEditeur({ ...it, saved: true }); } };

// ---------- Séance en direct ----------
const L = () => S().cardioLive;
actions["cd-go"] = (b, d) => {
  if (L() && !confirm("Une séance cardio est déjà en cours. La remplacer ?")) return go("cardio-live");
  const it = d.id === "libre" ? { id: "libre", titre: "Séance libre", sport: d.s || "autre", modele: "libre", blocs: C.modele("libre").blocs } : tousItems().find(x => String(x.id) === d.id); if (!it) return;
  const jour = d.d || today(), et = C.deroule(C.progresser(it, C.semaineDe(it, jour)), opts(it));
  unlockAudio(); closeSheet();
  update(st => { st.cardioLive = { item: { id: it.id, titre: it.titre, sport: it.sport, note: it.note || "", coach: !!it.coach }, jour, et, i: 0, start: Date.now(), stepAt: Date.now(), pause: null, faits: [], tours: [] }; });
  go("cardio-live");
};
actions["cd-libre"] = () => sheet(`<h2 class="h2">🤸 Lancer une activité</h2><p class="xs muted">Chrono, tours et notes au fur et à mesure. La dépense est calculée à la fin (MET × durée × poids).</p><div class="list mt8">${C.SPORTS.map(s => `<button class="li" data-a="cd-go" data-id="libre" data-s="${s[0]}"><span class="grow small">${esc(s[1])}</span>${I.chev}</button>`).join("")}</div>`);
let liveT = null;
const elapsed = (x) => (x.pause || Date.now()) - x.stepAt;
routes["cardio-live"] = () => {
  const x = L(); if (!x) return go("carnet/cardio");
  const e = x.et[x.i], nx = x.et[x.i + 1], Z = C.ZONES[e.z] || C.ZONES.libre, sec = e.min != null && e.z !== "libre" ? e.min * 60 : null, vma = +ref().vma, fc = +ref().fcmax;
  const tot = x.et.reduce((a, y) => a + y.dureeMin, 0), fait = x.faits.reduce((a, y) => a + y.faitMin, 0);
  document.getElementById("app").innerHTML = header(esc(x.item.titre), esc(C.sport(x.item.sport)[1]), { back: "carnet/cardio" }) + `<main class="page" style="padding-bottom:140px">
    <div class="live-z" style="background:${Z.c}"><div class="xs" style="opacity:.9">${x.i + 1}/${x.et.length} · ${esc(C.BLOC_T[e.t] || "")}${e.rep ? ` · ${e.r}/${e.rep}` : ""}</div>
      <div class="live-n">${esc(e.sta || Z.n)}</div><div class="live-t" id="cl-t">0:00</div><div class="xs" id="cl-sub">${sec ? "restant" : e.km != null ? `objectif ${C.qte(e)}` : "chrono"}</div>
      <div class="live-c">${vma && Z.vma && C.sport(x.item.sport)[3] === "course" ? `<b>${C.allureZone(e.z, vma)}</b><br>` : ""}${fc && Z.fc ? `${C.fcZone(e.z, fc)}<br>` : ""}<span class="xs">${esc(Z.rpe)}</span></div></div>
    <div class="gauge mt12"><i id="cl-g" style="width:${Math.round(fait / Math.max(1, tot) * 100)}%"></i></div>
    ${nx ? `<p class="small mt8"><span class="muted">Ensuite :</span> <b>${esc(C.BLOC_T[nx.t])} · ${C.qte(nx)} ${esc((C.ZONES[nx.z]?.n || "").toLowerCase())}</b></p>` : `<p class="small mt8 muted">Dernier bloc.</p>`}
    ${x.item.note ? `<div class="cue mt8">🗣️ ${esc(x.item.note)}</div>` : ""}
    ${x.item.id === "libre" ? `<div class="card mt12"><div class="row between"><b class="small">⏱️ Tours</b><button class="btn btn-line btn-xs" data-a="cl-tour">+ Tour</button></div>${x.tours.length ? x.tours.map((t, i) => `<div class="row between xs mt4"><span>Tour ${i + 1}</span><b>${mmss(t)}</b></div>`).join("") : `<p class="xs muted" style="margin:4px 0 0">Touche « + Tour » à chaque tour, round ou série.</p>`}</div>` : ""}
  </main><div class="dock"><div class="row" style="gap:8px"><button class="btn btn-line" data-a="cl-pause" style="width:auto;flex:1">${x.pause ? "▶ Reprendre" : "⏸ Pause"}</button>${nx ? `<button class="btn btn-line" data-a="cl-next" style="width:auto;flex:1">⏭ Bloc suivant</button>` : ""}<button class="btn btn-red" data-a="cl-end" style="width:auto;flex:1">✓ Terminer</button></div></div>`;
  clearInterval(liveT); const tick = () => {
    const y = L(); if (!y || !document.getElementById("cl-t")) return clearInterval(liveT);
    const el = elapsed(y) / 1000, s = sec ? Math.max(0, sec - el) : el; document.getElementById("cl-t").textContent = mmss(s * 1000);
    if (sec && el >= sec && !y.pause) { avancer(true); }
  }; tick(); liveT = setInterval(tick, 250);
  if (sec && !x.pause) scheduleRest(Math.max(1, sec - elapsed(x) / 1000), nx ? `${C.BLOC_T[nx.t]} · ${C.qte(nx)} ${(C.ZONES[nx.z]?.n || "").toLowerCase()}` : "fin de la séance");
};
const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function avancer(auto) {
  const x = L(); if (!x) return; const e = x.et[x.i], timed = auto && e.min != null;
  // bloc chronométré : on garde la ligne du temps (si l'écran était verrouillé, les blocs suivants s'enchaînent au bon moment)
  const fm = timed ? e.min : Math.round(elapsed(x) / 6000) / 10;
  update(st => { const y = st.cardioLive; y.faits.push({ ...y.et[y.i], faitMin: fm }); if (y.i < y.et.length - 1) { y.i++; y.stepAt = timed ? y.stepAt + e.min * 60000 : Date.now(); y.pause = null; } else y.fini = true; });
  beep(auto ? 3 : 1); buzz([200, 80, 200]);
  if (L().fini) return actions["cl-end"](null, {}, true);
  routes["cardio-live"]();
}
actions["cl-next"] = () => avancer(false);
actions["cl-pause"] = () => { update(st => { const y = st.cardioLive; if (y.pause) { y.stepAt += Date.now() - y.pause; y.pause = null; } else { y.pause = Date.now(); } }); if (L().pause) scheduleRest(0); routes["cardio-live"](); };
actions["cl-tour"] = () => { update(st => { const y = st.cardioLive, prev = y.tours.reduce((a, t) => a + t, 0); y.tours.push(Date.now() - y.start - prev); }); buzz(15); routes["cardio-live"](); };
actions["cl-end"] = (b, d, fini = false) => {
  const x = L(); if (!x) return; clearInterval(liveT); scheduleRest(0);
  if (!fini && !x.fini) update(st => { const y = st.cardioLive; y.faits.push({ ...y.et[y.i], faitMin: Math.round(elapsed(y) / 6000) / 10 }); y.fini = true; });
  const y = L(), min = Math.max(1, Math.round(y.faits.reduce((a, e) => a + e.faitMin, 0))), kc = C.kcalSeance(y.faits, poids(), opts(y.item));
  sheet(`<h2 class="h2">✅ ${esc(y.item.titre)}</h2><p class="small muted">${min} min · ≈ ${fr(kc)} kcal (MET moyen ${String(C.metMoyen(y.faits, opts(y.item))).replace(".", ",")})</p>
    <form data-f="cl-save" class="mt8"><div class="grid2"><label class="field"><span>Distance (km)</span><input name="km" inputmode="decimal" placeholder="facultatif"></label><label class="field"><span>FC moyenne</span><input name="fc" inputmode="numeric" placeholder="facultatif"></label></div>
      <div class="grid2 mt8"><label class="field"><span>Ressenti (1–10)</span><input name="rpe" inputmode="numeric" placeholder="6"></label><label class="field"><span>Kcal de la montre</span><input name="kcal" inputmode="numeric" placeholder="remplace l'estimation"></label></div>
      <label class="field mt8"><span>Notes</span><textarea name="note" rows="2" maxlength="300"></textarea></label>
      <button class="btn btn-red mt12">Enregistrer</button><button type="button" class="btn btn-ghost mt8" data-a="cl-cancel">Abandonner sans enregistrer</button></form>`);
};
actions["cl-cancel"] = () => { if (!confirm("Abandonner la séance ?")) return; update(st => { st.cardioLive = null; }); closeSheet(); go("carnet/cardio"); };
forms["cl-save"] = (v) => {
  const y = L(); if (!y) return; const o = opts(y.item), min = Math.max(1, Math.round(y.faits.reduce((a, e) => a + e.faitMin, 0)));
  const km = num(v.km || ""), kcal = Math.round(num(v.kcal || "")), fc = Math.round(num(v.fc || "")), rpe = Math.round(num(v.rpe || ""));
  const a = { n: `${y.item.titre} · ${C.sport(y.item.sport)[1]}`, met: C.metMoyen(y.faits, o) || C.sport(y.item.sport)[2], spm: 0, min, plan: y.item.id === "libre" ? null : `${y.item.id}@${y.jour}`, struct: true,
    ...(km > 0 && km < 400 ? { km } : {}), ...(fc > 40 && fc < 230 ? { fc } : {}), ...(rpe >= 1 && rpe <= 10 ? { rpe } : {}), ...(kcal > 0 && kcal < 6000 ? { kcal, kt: "actives" } : {}), ...(v.note ? { note: v.note.trim().slice(0, 300) } : {}),
    blocs: y.faits.map(e => ({ t: e.t, z: e.z, m: e.faitMin })), tours: y.tours.length ? y.tours : undefined, at: new Date().toISOString() };
  update(st => { const x = st.daily[y.jour] = st.daily[y.jour] || {}; (x.cardio = x.cardio || []).push(a); st.cardioLive = null; });
  closeSheet(); toast("Séance enregistrée 💪"); window.dispatchEvent(new CustomEvent("cxs:cardio-fait", { detail: { jour: y.jour, a } })); go("carnet/cardio");
};
