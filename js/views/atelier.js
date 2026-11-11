// Atelier « Créer mon programme » : on part du squelette (les 8 catégories de mouvements), on les répartit sur la semaine,
// on choisit les exercices dans chaque catégorie, on ajoute du travail direct, et on lit l'équilibre (graphique + volume par muscle).
// Le programme obtenu est un programme perso ordinaire du moteur : surcharge progressive, séances, agenda, tout fonctionne comme avant.
import { S, update, today } from "../store.js";
import { $app, esc, toast, routes, actions, changes, go, I, header, buzz, sheet, closeSheet, rerender } from "../core.js";
import * as X from "../exercices.js";
import * as P from "../programme.js";
import * as G from "../generateur.js";
import * as A from "../atelier.js";
import { estRoi } from "../exercices.js";
import { BASE } from "../exercices-base.js";
import { pastilleIndice } from "./indice-ui.js";
import * as IX from "../indice.js";
import { pushStats } from "../sync.js";

const PAT = (c) => `<span class="pat ${c}" title="${esc(X.PATTERN[c]?.nom || c)}">${c}</span>`;
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const niveauProfil = () => ({ beginner: "debutant", comeback: "debutant", regular: "regulier", advanced: "avance" })[S().profile?.level] || "regulier";

let D = null;                                   // le brouillon en cours (aussi gardé sur le téléphone : S().atelier)
let K = { groupe: "PH", q: "", muscle: "", tout: false, si: 0, mode: "add", li: 0, retour: null }; // sélecteur d'exercices
const charge = () => { D = S().atelier?.d ? JSON.parse(JSON.stringify(S().atelier.d)) : null; };
const garde = () => update(st => { st.atelier = { d: D, at: new Date().toISOString() }; });
const set = (d) => { D = d; garde(); };

// ---------- Écran ----------
routes.atelier = async () => {
  await X.loadExercices();
  if (!D) charge();
  if (!D) return intro();
  editeur();
};

let depart = { jours: [0, 2, 4] };
function intro() {
  const prog = S().programme, peut = !!prog?.answers;
  $app.innerHTML = header("Créer mon programme", "On part du squelette", { back: "train", offers: false }) + `<main class="page" style="padding-bottom:40px">
    <div class="card"><h2 class="h2">Ta semaine, bâtie sur 8 catégories de mouvements</h2>
      <p class="small muted mt8">Poussées, tirages, squats, charnière de hanche, flexion de genou : on place chaque catégorie dans ta semaine avec assez de séries, puis on choisit les exercices, et on ajoute du travail direct (bras, épaules, points faibles). Les catégories sont fixes, les exercices se changent quand tu veux.</p></div>
    <h2 class="sec">Quels jours t'entraînes-tu ?</h2>
    <div class="card"><div class="row" style="gap:4px;flex-wrap:wrap">${JOURS.map((l, i) => `<button class="chip sm ${depart.jours.includes(i) ? "on" : ""}" data-a="at-jour0" data-v="${i}" style="padding:8px 12px" aria-pressed="${depart.jours.includes(i)}">${l}</button>`).join("")}</div>
      <button class="btn btn-red mt12" style="width:100%" data-a="at-blanc">Partir d'une page blanche</button></div>
    ${peut ? `<h2 class="sec">Ou partir de ta proposition</h2><div class="card"><p class="small muted" style="margin:0 0 10px">Ta proposition sur mesure (d'après ton questionnaire) devient ton point de départ : tu la modifies comme tu veux, elle n'est pas changée.</p><button class="btn btn-line" style="width:100%" data-a="at-prop">Partir de ma proposition</button></div>`
        : `<div class="card mt12"><p class="small muted" style="margin:0 0 10px">Tu peux aussi répondre au questionnaire : je te propose un squelette tout fait à modifier.</p><button class="btn btn-line btn-sm" data-a="go" data-r="monprogramme">Répondre au questionnaire</button></div>`}
    <p class="xs muted mt12" style="text-align:center">Besoin du détail semaine par semaine, des séries une par une ? <button class="link" data-a="go" data-r="builder">Éditeur détaillé</button></p></main>`;
}
actions["at-jour0"] = (b, d) => { const i = +d.v; depart.jours = depart.jours.includes(i) ? depart.jours.filter(x => x !== i) : [...depart.jours, i]; routes.atelier(); };
actions["at-blanc"] = () => { if (!depart.jours.length) return toast("Choisis au moins un jour."); set(A.nouveau(depart.jours, { niveau: niveauProfil() })); buzz(); routes.atelier(); };
actions["at-prop"] = async () => {
  const prog = S().programme; if (!prog?.answers) return;
  await X.loadExercices();
  const prop = S().monplan?.prop || G.generer(prog, { seed: 0 });
  set(A.depuisProposition(prop)); buzz(); routes.atelier();
};
actions["at-recommencer"] = () => { if (!confirm("Tout effacer et recommencer ? Ton programme déjà enregistré ne change pas.")) return; update(st => { st.atelier = null; }); D = null; routes.atelier(); window.scrollTo?.(0, 0); };

function editeur() {
  const eq = A.equilibre(D), cible = A.cibleSeries(D.niveau), vm = A.volumeMuscles(D), ctrl = A.controles(D);
  const noms = G.DOW;
  $app.innerHTML = header("Créer mon programme", "Ton squelette", { back: "train", offers: false }) + `<main class="page" style="padding-bottom:130px">
    <label class="field"><span>Nom</span><input data-c="at-nom" value="${esc(D.nom)}" maxlength="60"></label>
    <div class="field mt8"><span>Jours d'entraînement</span><div class="row" style="gap:4px;flex-wrap:wrap">${JOURS.map((l, i) => `<button class="chip sm ${D.sessions.some(s => s.dow === i) ? "on" : ""}" data-a="at-jour" data-v="${i}" style="padding:8px 12px" aria-label="${noms[i]}" aria-pressed="${D.sessions.some(s => s.dow === i)}">${l}</button>`).join("")}</div></div>
    <div class="grid2 mt8"><label class="field"><span>Durée du cycle</span><select data-c="at-sem">${[4, 6, 8, 10, 12].map(w => `<option value="${w}" ${D.semaines === w ? "selected" : ""}>${w} semaines</option>`).join("")}</select></label>
      <label class="field"><span>Ton niveau</span><select data-c="at-niv">${[["debutant", "Débutant"], ["regulier", "Régulier"], ["avance", "Avancé"]].map(([v, l]) => `<option value="${v}" ${D.niveau === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>

    <h2 class="sec">Ton squelette <small>séries par semaine · repère ${cible}</small></h2>${squelette(eq, cible)}
    <h2 class="sec">Ta semaine</h2>${grille()}
    <h2 class="sec">Équilibre</h2>${radar(eq)}
    <h2 class="sec">Tes séances</h2>${D.sessions.map((s, si) => seance(s, si)).join("")}
    <h2 class="sec">Travail direct <small>isolation et points faibles</small></h2>${travailDirect()}
    <h2 class="sec">Volume par muscle <small>séries par semaine</small></h2>${volume(vm)}
    <h2 class="sec">Est-ce cohérent ?</h2><div class="card" style="padding:4px 14px">${ctrl.map(c => `<div class="li" style="gap:10px;padding:12px 0"><span>${c.niveau === "ok" ? "✅" : c.niveau === "alerte" ? "⚠️" : "ℹ️"}</span><span class="grow small">${esc(c.texte)}</span></div>`).join("")}</div>
    <div class="stack mt12"><button class="btn btn-line" data-a="at-garder">Enregistrer sans l'adopter</button>${D.depuis === "proposition" || !S().programme?.answers ? "" : `<button class="btn btn-ghost" data-a="at-prop">Repartir de ma proposition</button>`}<button class="btn btn-ghost" data-a="at-recommencer">Recommencer à zéro</button></div>
    <p class="xs muted mt12" style="text-align:center">Besoin du détail semaine par semaine ? <button class="link" data-a="at-avance">Éditeur détaillé</button></p>
  </main><div class="dock"><button class="btn btn-red" data-a="at-adopter" ${A.nbExercices(D) ? "" : "disabled"}>${A.nbExercices(D) ? "Commencer ce programme" : "Ajoute un premier exercice"}</button></div>`;
}
changes["at-nom"] = (el) => { set({ ...D, nom: el.value }); };
changes["at-sem"] = (el) => { set({ ...D, semaines: +el.value }); };
changes["at-niv"] = (el) => { set({ ...D, niveau: el.value }); rerender(); };
actions["at-jour"] = (b, d) => {
  const r = A.basculerJour(D, +d.v);
  if (r.refus) return toast(r.refus);
  if (r.retire && !confirm(`Retirer ${G.DOW[+d.v]} ? Les exercices de « ${r.retire.titre} » seront supprimés.`)) return;
  const { retire, ...x } = r; set(x); rerender();
};

// ---------- Squelette ----------
const ETAT = { manque: ["Absent", "var(--red)"], faible: ["Léger", "var(--warn,#B85C00)"], juste: ["Un peu juste", "var(--soft)"], ok: ["Bien", "var(--ok,#2E7D32)"], beaucoup: ["Beaucoup", "var(--warn,#B85C00)"] };
function squelette(eq, cible) {
  const max = Math.max(14, cible + 4), case_ = (c) => { const v = eq.par[c], e = ETAT[v.etat];
    return `<div class="mpcase" style="flex-direction:column;align-items:stretch;gap:6px"><button class="row" style="gap:10px;text-align:left;width:100%;background:none;border:0;padding:0;color:inherit;align-items:flex-start" data-a="at-pat" data-c="${c}" aria-label="Répartir ${esc(X.PATTERN[c].nom)}">${PAT(c)}<div class="grow"><b class="small">${esc(X.PATTERN[c].nom)}</b><div class="mpbar"><i class="${c}" style="width:${Math.round(Math.min(1, v.sets / max) * 100)}%"></i></div><span class="xs" style="color:${e[1]}">${v.sets ? `${v.sets} série${v.sets > 1 ? "s" : ""} · ` : ""}${e[0]}</span></div></button>
      <div class="row between" style="gap:6px"><button class="icon-btn sm" data-a="at-pat-d" data-c="${c}" data-v="-1" aria-label="Une série de moins en ${esc(X.PATTERN[c].nom)}" ${v.sets ? "" : "disabled style=\"opacity:.3\""}>−</button><span class="xs muted">${v.sets ? "répartir ›" : "choisir un exercice"}</span><button class="icon-btn sm" data-a="at-pat-d" data-c="${c}" data-v="1" aria-label="Une série de plus en ${esc(X.PATTERN[c].nom)}">+</button></div></div>`; };
  return `<p class="xs muted patzone" style="margin-top:0">Haut du corps</p><div class="patgrid">${["PH", "PV", "TH", "TV"].map(case_).join("")}</div><p class="xs muted patzone">Bas du corps</p><div class="patgrid">${["SG", "SH", "CH", "FG"].map(case_).join("")}</div>`;
}
actions["at-pat-d"] = (b, d) => {
  const r = A.ajusterPattern(D, d.c, +d.v);
  if (r.besoinExercice) return ouvrirChoix({ groupe: d.c, si: meilleureSeance(d.c), mode: "add" });
  set(r.d); buzz(6); rerender();
};
// Séance où ajouter une catégorie : celle qui ne l'a pas encore et qui est la plus courte
function meilleureSeance(code) {
  const l = D.sessions.map((s, si) => ({ si, a: s.items.some(x => x.pattern === code), m: G.minutesSeance(s.items) })).sort((x, y) => x.a - y.a || x.m - y.m);
  return l[0]?.si ?? 0;
}
actions["at-pat"] = (b, d) => {
  const c = d.c, rep = A.repartition(D, c), eq = A.equilibre(D);
  const corps = () => `<h2 class="h2">${PAT(c)} ${esc(X.PATTERN[c].nom)}</h2><p class="small muted">${eq.par[c].sets} série${eq.par[c].sets > 1 ? "s" : ""} par semaine · repère ${A.cibleSeries(D.niveau)}. Répartis-les sur tes séances.</p>
    <div class="list mt8">${D.sessions.map((s, si) => `<div class="li" style="gap:8px;padding:10px 0"><span class="grow small"><b>${esc(s.titre)}</b><br><span class="xs muted">${G.DOW[s.dow]}</span></span>
      <button class="icon-btn sm" data-a="at-rep" data-c="${c}" data-s="${si}" data-v="-1" aria-label="Une série de moins ${esc(G.DOW[s.dow])}">−</button><b class="num" style="min-width:24px;text-align:center">${A.repartition(D, c)[si]}</b><button class="icon-btn sm" data-a="at-rep" data-c="${c}" data-s="${si}" data-v="1" aria-label="Une série de plus ${esc(G.DOW[s.dow])}">+</button></div>`).join("")}</div>
    ${A.lignesSquelette(D, c).length ? `<h3 class="h3 mt12">Exercices</h3><div class="list">${A.lignesSquelette(D, c).map(({ l, si, li }) => `<div class="li" style="gap:8px;padding:10px 0"><span class="grow small"><b>${esc(l.nom)}</b><br><span class="xs muted">${esc(D.sessions[si].titre)} · ${l.n} séries</span></span><button class="btn btn-line btn-sm" data-a="at-swap" data-s="${si}" data-i="${li}">Changer</button></div>`).join("")}</div>` : ""}
    <button class="btn btn-line mt12" style="width:100%" data-a="at-choix" data-g="${c}" data-s="${meilleureSeance(c)}">+ Ajouter un exercice de cette catégorie</button>`;
  sheet(corps(), (w) => { w.dataset.rr = "1"; }, { keep: !!document.getElementById("sheet") });
};
actions["at-rep"] = (b, d) => {
  const c = d.c, si = +d.s, cur = A.repartition(D, c)[si], n = Math.max(0, cur + +d.v);
  const r = A.placer(D, c, si, n);
  if (r.besoinExercice) return ouvrirChoix({ groupe: c, si, mode: "add", retour: c });
  set(r.d); buzz(6); actions["at-pat"](null, { c });
};

// ---------- Grille de la semaine ----------
function grille() {
  const at = (c, d) => D.sessions.filter(s => s.dow === d).reduce((t, s) => t + s.items.filter(l => l.pattern === c && l.couche === "squelette").reduce((u, l) => u + l.n, 0), 0);
  return `<div class="card" style="padding:10px 12px"><div class="mpgrid" role="table" aria-label="Catégories travaillées chaque jour"><span></span>${JOURS.map(j => `<b class="xs muted">${j}</b>`).join("")}
    ${X.PATTERNS.map(({ code }) => `${PAT(code)}${JOURS.map((_, d) => { const n = at(code, d); return n ? `<i class="mpc ${code}" style="opacity:${(.35 + .65 * Math.min(1, n / 6)).toFixed(2)}" title="${code} : ${n} séries" aria-label="${code}, ${G.DOW[d]} : ${n} séries"></i>` : `<i class="mpc"></i>`; }).join("")}`).join("")}</div>
    <p class="xs muted mt8" style="margin:8px 0 0">Plus la case est foncée, plus il y a de séries ce jour-là. Les jours vides sont des jours de repos.</p></div>`;
}

// ---------- Graphique d'équilibre (radar des 8 catégories) ----------
const COULEUR = { PH: "#C0392B", PV: "#B85C00", TH: "#1F5FBF", TV: "#0B7C86", SG: "#2E7D32", SH: "#6B7F1F", CH: "#6F42C1", FG: "#B0306E" };
function radar(eq) {
  const W = 300, c = W / 2, R = 96, pt = (i, k) => { const a = -Math.PI / 2 + i * Math.PI / 4; return [c + Math.cos(a) * R * k, c + Math.sin(a) * R * k]; };
  const poly = (k) => X.PATTERNS.map((_, i) => pt(i, k).map(v => v.toFixed(1)).join(",")).join(" ");
  const data = X.PATTERNS.map(({ code }, i) => pt(i, Math.min(1.5, eq.par[code].ratio) / 1.5));
  const aria = X.PATTERNS.map(({ code }) => `${X.PATTERN[code].nom} ${eq.par[code].sets} séries`).join(", ");
  const dp = eq.total ? `<polygon points="${data.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}" fill="var(--tint)" stroke="var(--red)" stroke-width="2" stroke-linejoin="round"/>${data.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${COULEUR[X.PATTERNS[i].code]}"/>`).join("")}` : "";
  const lab = X.PATTERNS.map(({ code }, i) => { const [x, y] = pt(i, 1.5 / 1.5 + .2); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="${COULEUR[code]}">${code}</text>`; }).join("");
  const axes = X.PATTERNS.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)"/>`; }).join("");
  return `<div class="card" style="padding:12px"><svg viewBox="0 0 ${W} ${W}" role="img" aria-label="Équilibre de la semaine : ${esc(aria)}" style="width:100%;max-width:320px;display:block;margin:0 auto">
      ${axes}<polygon points="${poly(1)}" fill="none" stroke="var(--line)"/><polygon points="${poly(2 / 3)}" fill="none" stroke="var(--soft)" stroke-dasharray="4 4"/><polygon points="${poly(1 / 3)}" fill="none" stroke="var(--line)"/>${dp}${lab}</svg>
    <p class="xs muted" style="margin:6px 0 0;text-align:center">Le trait pointillé est ton repère de séries par catégorie (${A.cibleSeries(D.niveau)}). Plus la forme est régulière, plus ta semaine est équilibrée.</p>
    ${eq.total ? `<div class="stat3 mt8"><div><b>${eq.haut}</b><span>haut du corps</span></div><div><b>${eq.bas}</b><span>bas du corps</span></div><div><b>${eq.poussee}:${eq.tirage}</b><span>poussées : tirages</span></div></div>` : ""}</div>`;
}

// ---------- Séances ----------
const serie = (l) => `${l.n} × ${l.lo}${l.hi !== l.lo ? "-" + l.hi : ""}${l.unite === "s" ? " s" : ""}${l.rpe ? ` · RPE ${String(l.rpe).replace(".", ",")}` : ""}`;
function seance(s, si) {
  const min = G.minutesSeance(s.items), pats = [...new Set(s.items.filter(l => l.couche === "squelette").map(l => l.pattern))];
  return `<div class="card mt8"><div class="row between" style="gap:8px"><div><b class="h3">${esc(s.titre)}</b><div class="xs muted">${G.DOW[s.dow]}${s.items.length ? ` · environ ${min} min` : ""}</div>${s.items.length ? `<div class="mt4">${pastilleIndice(IX.indiceSeance(s.items))}</div>` : ""}</div><div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">${pats.map(PAT).join("")}</div></div>
    <div class="mt8">${s.items.length ? s.items.map((l, li) => `<button class="li" style="padding:10px 0;gap:8px;width:100%;text-align:left" data-a="at-fiche" data-s="${si}" data-i="${li}" aria-label="Régler ${esc(l.nom)}">${l.pattern ? PAT(l.pattern) : `<span class="pat nul">${l.couche === "isolation" ? "ISO" : "MOD"}</span>`}<span class="grow small"><b>${esc(l.nom)}</b>${l.focus ? ` <span class="tag r">🎯 Focus</span>` : ""}${l.ss ? ` <span class="tag r">Superset ${esc(l.ss)}</span>` : ""}<br><span class="xs muted">${esc(serie(l))}</span></span><span class="muted">›</span></button>`).join("")
      : `<p class="small muted" style="margin:0">Aucun exercice pour l'instant.</p>`}</div>
    <button class="btn btn-line btn-sm mt8" style="width:100%" data-a="at-choix" data-s="${si}" data-g="">+ Ajouter un exercice</button></div>`;
}
actions["at-choix"] = (b, d) => ouvrirChoix({ groupe: d.g || K.groupe, si: +d.s, mode: "add", retour: null });
actions["at-swap"] = (b, d) => { const l = D.sessions[+d.s]?.items[+d.i]; if (!l) return; ouvrirChoix({ groupe: groupeDe(l), si: +d.s, li: +d.i, mode: "swap" }); };
const groupeDe = (l) => l.pattern || l.categorie;

// ---------- Travail direct (isolation) ----------
const ISO_CATS = ["biceps", "triceps", "elevations_laterales", "deltoides_posterieurs", "epaules_avant", "pectoraux", "trapezes", "avant_bras", "quadriceps", "fessiers", "adducteurs", "mollets", "abdos", "coiffe"];
function travailDirect() {
  const sets = {}; D.sessions.forEach(s => s.items.forEach(l => { if (l.couche === "isolation") sets[l.categorie] = (sets[l.categorie] || 0) + l.n; }));
  return `<div class="card"><p class="small muted" style="margin:0 0 8px">En plus du squelette : du travail direct sur un muscle (bras, épaules, mollets…) ou sur ton point faible. Touche une catégorie pour choisir l'exercice.</p>
    <div class="chips wrap">${ISO_CATS.map(c => `<button class="chip sm ${sets[c] ? "on" : ""}" data-a="at-choix" data-g="${c}" data-s="${prochaineSeance(c)}">${esc(X.CATEGORIES[c])}${sets[c] ? ` · ${sets[c]}` : ""}</button>`).join("")}</div></div>`;
}
const HAUT_ISO = ["biceps", "triceps", "elevations_laterales", "deltoides_posterieurs", "epaules_avant", "pectoraux", "trapezes", "avant_bras", "coiffe"];
function prochaineSeance(cat) {
  const ok = D.sessions.map((s, si) => ({ si, m: G.minutesSeance(s.items), bon: HAUT_ISO.includes(cat) ? s.items.some(l => ["PH", "PV", "TH", "TV"].includes(l.pattern)) : ["quadriceps", "fessiers", "adducteurs", "mollets"].includes(cat) ? s.items.some(l => ["SG", "SH", "CH", "FG"].includes(l.pattern)) : true }));
  return ok.sort((a, b) => (b.bon - a.bon) || a.m - b.m)[0]?.si ?? 0;
}

// ---------- Volume par muscle ----------
const COUL_STATUT = { sous: "var(--warn,#B85C00)", ok: "var(--ok,#2E7D32)", optimal: "var(--ok,#2E7D32)", trop: "var(--red)", absent: "var(--line)", libre: "var(--line)" };
const TXT_STATUT = { sous: "sous le minimum", ok: "bien", optimal: "zone idéale", trop: "trop", absent: "absent", libre: "" };
function volume(vm) {
  const lignes = vm.groupes.filter(g => g.sets > 0 || g.lm.mev > 0);
  return `<div class="card" style="padding:4px 14px"><p class="xs muted" style="margin:10px 0 0">Une série directe compte 1, un muscle secondaire 0,5. Repères d'après Israetel, à adapter. La barre va jusqu'à la limite de ce qui se récupère.</p>
    ${lignes.map(g => { const max = Math.max(g.lm.mrv, g.sets, 1), w = (v) => Math.round(Math.min(100, v / max * 100));
      return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row between"><b class="small">${esc(g.nom)}</b><span class="xs" style="color:${COUL_STATUT[g.statut]};font-weight:700">${g.sets} · ${TXT_STATUT[g.statut]}</span></div>
        <div style="position:relative;height:8px;border-radius:4px;background:var(--line);margin:6px 0 2px;overflow:hidden"><i style="position:absolute;left:${w(g.lm.mev)}%;width:${Math.max(0, w(g.lm.mrv) - w(g.lm.mev))}%;top:0;bottom:0;background:color-mix(in srgb,var(--ok,#2E7D32) 25%,transparent)"></i><i style="position:absolute;left:0;top:0;bottom:0;width:${w(g.sets)}%;background:${COUL_STATUT[g.statut]};border-radius:4px"></i></div>
        <span class="xs muted">minimum ${g.lm.mev} · idéal ${g.lm.mav[0]}-${g.lm.mav[1]} · limite ${g.lm.mrv}</span></div>`; }).join("")}</div>`;
}

// ---------- Réglage d'un exercice ----------
actions["at-fiche"] = (b, d) => fiche(+d.s, +d.i);
function fiche(si, li) {
  const l = D.sessions[si]?.items[li]; if (!l) return closeSheet();
  const it = D.sessions[si].items, step = (a, v, label, valTxt) => `<div class="row between" style="gap:8px;padding:8px 0"><span class="small">${label}</span><span class="row" style="gap:8px;align-items:center"><button class="icon-btn sm" data-a="at-r" data-k="${a}" data-v="-1" aria-label="Moins : ${esc(label)}">−</button><b class="num" style="min-width:56px;text-align:center">${valTxt}</b><button class="icon-btn sm" data-a="at-r" data-k="${a}" data-v="1" aria-label="Plus : ${esc(label)}">+</button></span></div>`;
  K.si = si; K.li = li;
  sheet(`<h2 class="h2">${l.pattern ? PAT(l.pattern) : ""} ${esc(l.nom)}</h2><p class="small muted">${esc(D.sessions[si].titre)} · ${esc(serie(l))}${l.note ? ` · ${esc(l.note)}` : ""}</p>
    ${step("n", 1, "Séries", l.n)}${step("lo", 1, "Répétitions (min)", l.lo)}${step("hi", 1, "Répétitions (max)", l.hi)}${step("rpe", 0.5, "Effort visé (RPE)", String(l.rpe ?? 8).replace(".", ","))}${step("rest", 15, "Repos", Math.round(l.rest / 15) * 15 + " s")}
    <div class="card mt12" style="padding:10px 12px"><div class="row between" style="gap:8px"><span class="small"><b>🎯 Focus sur ce mouvement</b><br><span class="xs muted">Plus de séries, des reps plus basses et une série ajoutée toutes les 2 semaines : pour progresser sur ce mouvement précis (bench, squat…).</span></span><button class="chip ${l.focus ? "on" : ""}" data-a="at-focus" aria-pressed="${!!l.focus}">${l.focus ? "Activé" : "Activer"}</button></div></div>
    <div class="card mt8" style="padding:10px 12px"><div class="row between" style="gap:8px"><span class="small"><b>🔗 Superset avec le suivant</b><br><span class="xs muted">${l.ss ? "Enchaîné avec l'exercice d'après, sans repos entre les deux." : "Enchaîne cet exercice avec celui d'en dessous."}</span></span><button class="chip ${l.ss ? "on" : ""}" data-a="at-ss" aria-pressed="${!!l.ss}">${l.ss ? "Enchaîné " + esc(l.ss) : "Enchaîner"}</button></div></div>
    <p class="xs muted mt8">La charge se règle toute seule d'après ton effort (RPE) et monte au fil des semaines. L'éditeur détaillé permet de tout écrire à la main.</p>
    <div class="row mt12" style="gap:8px;flex-wrap:wrap"><button class="btn btn-line btn-sm grow" data-a="at-swap" data-s="${si}" data-i="${li}">⇄ Changer d'exercice</button><button class="icon-btn" data-a="at-mv" data-v="-1" aria-label="Monter" ${li ? "" : "disabled style=\"opacity:.3\""}>↑</button><button class="icon-btn" data-a="at-mv" data-v="1" aria-label="Descendre" ${li < it.length - 1 ? "" : "disabled style=\"opacity:.3\""}>↓</button><button class="btn btn-ghost btn-sm" style="color:var(--red)" data-a="at-del">Retirer</button></div>`,
    (w) => { w.dataset.rr = "1"; }, { keep: !!document.getElementById("sheet") });
}
const REG = { n: [1, "n"], lo: [1, "lo"], hi: [1, "hi"], rpe: [0.5, "rpe"], rest: [15, "rest"] };
actions["at-r"] = (b, d) => {
  const l = D.sessions[K.si]?.items[K.li]; if (!l || !REG[d.k]) return;
  const [pas, cle] = REG[d.k]; let v = (+l[cle] || 0) + pas * +d.v;
  if (cle === "lo" && v > l.hi) set(A.regler(D, K.si, K.li, { lo: v, hi: v })); else set(A.regler(D, K.si, K.li, { [cle]: v }));
  buzz(5); fiche(K.si, K.li);
};
actions["at-focus"] = () => { set(A.basculerFocus(D, K.si, K.li)); buzz(); fiche(K.si, K.li); };
actions["at-ss"] = () => { const r = A.basculerSuperset(D, K.si, K.li); if (r.refus) { toast(r.refus); return; } set(r); buzz(); fiche(K.si, K.li); };
actions["at-mv"] = (b, d) => { set(A.deplacer(D, K.si, K.li, +d.v)); K.li += +d.v; buzz(5); fiche(K.si, K.li); };
actions["at-del"] = () => { set(A.retirer(D, K.si, K.li)); closeSheet(); buzz(); toast("Exercice retiré"); rerender(); };

// ---------- Choix d'un exercice : par catégorie, famille et muscle ----------
function contraintesActuelles() {
  const prog = S().programme;
  return prog?.answers ? P.contraintes(prog) : { materiel: [], contreIndications: [], exclure: [] };
}
const NOM_GROUPE = (g) => X.PATTERN[g]?.nom || X.CATEGORIES[g] || g;
const estPattern = (g) => !!X.PATTERN[g];
function candidats() {
  const c = contraintesActuelles(), g = K.groupe, prefs = S().programme?.prefs || {}, t = nrm(K.q);
  let l = X.exercices().filter(e => e.actif && (estPattern(g) ? e.couche === "squelette" && e.pattern_principal === g : e.categorie === g));
  const total = l.length;
  if (!K.tout) l = l.filter(e => (!c.materiel.length || e.materiel.some(m => c.materiel.includes(m))) && !e.contre_indications.some(z => c.contreIndications.includes(z)) && !c.exclure.includes(e.slug));
  const masques = total - l.length;
  const muscles = [...new Set(l.flatMap(e => e.muscles.slice(0, 2)))].sort((a, b) => a.localeCompare(b, "fr"));
  if (K.muscle) l = l.filter(e => e.muscles.slice(0, 3).includes(K.muscle));
  if (t) l = l.filter(e => nrm(e.nom + " " + e.muscles.join(" ")).includes(t));
  const rang = (e) => (prefs[e.slug] === "love" ? -3 : 0) + (estRoi(e) ? -2 : 0) + (BASE.has(e.slug) ? -1 : 0);
  l.sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, "fr"));
  return { l, muscles, masques, prefs };
}
const nrm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function ouvrirChoix({ groupe, si, li = 0, mode = "add", retour = null }) {
  K = { ...K, groupe: groupe || K.groupe, si: si ?? K.si, li, mode, retour, q: "", muscle: "", tout: false };
  choix();
}
function choix() {
  const { l, muscles, masques, prefs } = candidats(), g = K.groupe, MAX = 40;
  const cible = D.sessions[K.si];
  sheet(`<h2 class="h2">${mode() === "swap" ? "Changer d'exercice" : "Ajouter un exercice"}</h2>
    <p class="small muted">${mode() === "swap" ? `Remplace « ${esc(D.sessions[K.si]?.items[K.li]?.nom || "")} », séries gardées.` : `Dans « ${esc(cible?.titre || "")} » · ${esc(G.DOW[cible?.dow ?? 0])}.`}</p>
    <p class="xs muted patzone" style="margin-bottom:4px">Les 8 catégories de mouvements</p><div class="chips wrap">${X.PATTERNS.map(p => `<button class="chip sm ${g === p.code ? "on" : ""}" data-a="at-g" data-g="${p.code}">${p.code} · ${esc(p.nom)}</button>`).join("")}</div>
    <p class="xs muted patzone" style="margin:10px 0 4px">Travail direct</p><div class="chips wrap">${ISO_CATS.map(c => `<button class="chip sm ${g === c ? "on" : ""}" data-a="at-g" data-g="${c}">${esc(X.CATEGORIES[c])}</button>`).join("")}</div>
    <p class="xs muted patzone" style="margin:10px 0 4px">Autres</p><div class="chips wrap">${["unilateral", "portes", "rotation", "mobilite", "puissance", "skills", "cardio"].map(c => `<button class="chip sm ${g === c ? "on" : ""}" data-a="at-g" data-g="${c}">${esc(X.CATEGORIES[c])}</button>`).join("")}</div>
    <h3 class="h3 mt12">${esc(NOM_GROUPE(g))} <small class="muted">${l.length} exercice${l.length > 1 ? "s" : ""}</small></h3>
    <div class="search mt8">${I.search}<input data-c="at-q" placeholder="Chercher un exercice ou un muscle" value="${esc(K.q)}" autocomplete="off"></div>
    ${muscles.length > 1 ? `<div class="chips wrap mt8"><button class="chip sm ${K.muscle ? "" : "on"}" data-a="at-m" data-m="">Tous les muscles</button>${muscles.map(m => `<button class="chip sm ${K.muscle === m ? "on" : ""}" data-a="at-m" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>` : ""}
    ${masques ? `<p class="xs muted mt8">${masques} exercice${masques > 1 ? "s" : ""} masqué${masques > 1 ? "s" : ""} (matériel ou gênes du questionnaire). <button class="link" data-a="at-tout">Tout afficher</button></p>` : K.tout ? `<p class="xs muted mt8"><button class="link" data-a="at-tout">Masquer ceux qui ne conviennent pas</button></p>` : ""}
    <div class="list mt8">${l.slice(0, MAX).map(e => `<button class="li" data-a="at-pick" data-x="${esc(e.slug)}" style="gap:10px;text-align:left">${e.pattern_principal ? PAT(e.pattern_principal) : `<span class="pat nul">${e.couche === "isolation" ? "ISO" : "MOD"}</span>`}<span class="grow small"><b>${esc(e.nom)}</b>${estRoi(e) ? " ⭐" : ""}${prefs[e.slug] === "love" ? " 😍" : ""}<br><span class="xs muted">${esc(e.muscles.slice(0, 3).join(" · "))} · ${esc(X.label(X.NIVEAUX, e.niveau))}</span></span></button>`).join("") || `<p class="empty small">Aucun exercice ne correspond.</p>`}</div>
    ${l.length > MAX ? `<p class="xs muted mt8">${l.length - MAX} autres : affine avec la recherche ou un muscle.</p>` : ""}`,
    null, { keep: !!document.getElementById("sheet") });
}
const mode = () => K.mode;
actions["at-g"] = (b, d) => { K.groupe = d.g; K.muscle = ""; choix(); };
actions["at-m"] = (b, d) => { K.muscle = d.m || ""; choix(); };
actions["at-tout"] = () => { K.tout = !K.tout; choix(); };
changes["at-q"] = (el) => { K.q = el.value; choix(); const i = document.querySelector('#sheet [data-c="at-q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
actions["at-pick"] = (b, d) => {
  const e = X.exercice(d.x); if (!e) return;
  if (K.mode === "swap") { set(A.remplacer(D, K.si, K.li, e.slug)); closeSheet(); buzz(); toast("Exercice remplacé"); return rerender(); }
  const n = e.couche === "isolation" ? 3 : Math.max(2, Math.min(4, Math.round(A.cibleSeries(D.niveau) / Math.max(1, A.lignesSquelette(D, e.pattern_principal).length + 1 + (D.sessions.length > 2 ? 1 : 0)))));
  set(A.ajouter(D, K.si, e, n)); buzz(); toast(`${e.nom} ajouté`);
  if (K.retour) { const c = K.retour; K.retour = null; return actions["at-pat"](null, { c }); }
  closeSheet(); rerender();
};

// ---------- Enregistrer / adopter ----------
function programme() { return A.vers(D, { id: "atelier", name: D.nom || "Mon programme" }); }
actions["at-garder"] = () => {
  if (!A.nbExercices(D)) return toast("Ajoute au moins un exercice.");
  const prog = programme();
  update(st => { st.customPrograms = [...(st.customPrograms || []).filter(x => x.id !== "atelier"), prog]; });
  buzz(); toast("Programme enregistré dans Mes programmes"); pushStats();
};
actions["at-adopter"] = () => {
  if (!A.nbExercices(D)) return toast("Ajoute au moins un exercice.");
  if (S().current) return toast("Termine ta séance en cours pour changer de programme.");
  const eq = A.equilibre(D);
  if (!eq.complet && !confirm(`Il manque ${eq.manquants.map(c => X.PATTERN[c].nom.toLowerCase()).join(", ")} dans ta semaine. Commencer quand même ?`)) return;
  if (S().plan?.programId && S().plan.programId !== "atelier" && !confirm("Ton programme actuel s'arrête et celui-ci commence en semaine 1. Tes charges et ton historique sont gardés. Commencer ?")) return;
  const prog = programme();
  update(st => {
    st.customPrograms = [...(st.customPrograms || []).filter(x => x.id !== "atelier"), prog];
    st.plan = { programId: "atelier", startedAt: today(), week: 1, idx: 0, cycle: st.plan?.cycle || 1 };
  });
  buzz(); toast("C'est parti avec ton programme"); pushStats(); go("train", "programme");
};
actions["at-avance"] = () => {
  if (!A.nbExercices(D)) return go("builder");
  const prog = programme();
  update(st => { st.customPrograms = [...(st.customPrograms || []).filter(x => x.id !== "atelier"), prog]; });
  go("builder", "atelier");
};
