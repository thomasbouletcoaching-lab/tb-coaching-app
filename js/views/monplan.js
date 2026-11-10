// Écran « Mon programme proposé » (créateur de programme, étape 3) : le squelette des 8 patterns, la semaine, les séances,
// le bouton « remplacer » et les contrôles. Une PROPOSITION : elle ne remplace jamais le programme en cours sans accord.
import { S, update, today } from "../store.js";
import { $app, esc, toast, routes, actions, go, I, header, buzz, sheet, closeSheet, isCoach } from "../core.js";
import * as X from "../exercices.js";
import * as P from "../programme.js";
import * as G from "../generateur.js";
import { pushStats } from "../sync.js";
import * as IX from "../indice.js";
import { pastilleIndice, feuilleIndice } from "./indice-ui.js";

const PAT = (c, cls = "") => `<span class="pat ${c} ${cls}" title="${esc(X.PATTERN[c]?.nom || c)}">${c}</span>`;
const LABEL_CAT = (c) => X.CATEGORIES[c] || c;
const indiceDe = (s) => s.indice || IX.indiceSeance(s.items);

// La proposition est gardée sur le téléphone ; elle est refaite si les réponses ont changé depuis
function courante(force = false, seed = null) {
  const prog = S().programme, mp = S().monplan;
  if (!prog?.answers) return null;
  if (!force && mp?.prop && mp.progAt === prog.at && mp.prop.v === G.VERSION) return mp;
  const sd = seed != null ? seed : (mp?.seed || 0), prop = G.generer(prog, { seed: sd });
  update(st => { st.monplan = { at: new Date().toISOString(), progAt: prog.at, seed: sd, prop, adopte: mp?.adopte || null }; });
  return S().monplan;
}

routes.monplan = async () => {
  await X.loadExercices();
  const prog = S().programme;
  if (!prog?.answers) {
    $app.innerHTML = header("Mon programme proposé", "", { back: "monprogramme" }) + `<main class="page"><div class="card"><h2 class="h2">Réponds d'abord au questionnaire</h2><p class="small muted mt8">Dix questions, deux minutes : objectif, matériel, séances que tu tiens vraiment, gênes.</p><button class="btn btn-red mt12" data-a="go" data-r="monprogramme">Commencer</button></div></main>`;
    return;
  }
  const mp = courante(), p = mp.prop, mins = p.sessions.map(s => s.minutes);
  $app.innerHTML = header("Ma proposition", "À adopter quand tu veux", { back: "monprogramme" }) + `<main class="page" style="padding-bottom:120px">
    <div class="card hl"><div class="stat3"><div><b>${p.n}×</b><span>par semaine</span></div><div><b>${Math.min(...mins)}–${Math.max(...mins)}</b><span>minutes</span></div><div><b>${p.semaines}</b><span>semaines</span></div></div>
      <p class="small muted mt12" style="margin:0">${esc(p.sessions.map(s => `${G.DOW[s.dow].slice(0, 3)}.`).join(" · "))} · décharge toutes les ${p.decharge} semaines. C'est une proposition : ton programme actuel ne change que si tu l'adoptes.</p></div>
    <h2 class="sec">Ton squelette <small>séries par semaine</small></h2>${squelette(p)}
    ${Object.keys(p.iso).length ? `<p class="xs muted mt8" style="margin:8px 2px 0">Isolation ajoutée : ${Object.entries(p.iso).map(([c, n]) => `${esc(LABEL_CAT(c).toLowerCase())} ${n}`).join(" · ")} séries.</p>` : ""}
    <h2 class="sec">Ta semaine</h2>${grille(p)}
    <h2 class="sec">Tes séances</h2>${p.sessions.map((s, si) => seance(s, si)).join("")}
    <h2 class="sec">Est-ce que ça tient ?</h2><div class="card" style="padding:4px 14px">${p.controles.map(c => `<div class="li" style="gap:10px;padding:12px 0"><span>${c.niveau === "ok" ? "✅" : c.niveau === "alerte" ? "⚠️" : "ℹ️"}</span><span class="grow small">${esc(c.texte)}</span></div>`).join("")}${p.avertissements.map(w => `<div class="li" style="gap:10px;padding:12px 0"><span>⚠️</span><span class="grow small">${esc(w)}</span></div>`).join("")}</div>
    ${p.suggestions.length ? `<h2 class="sec">À côté des séances</h2><div class="card small">${p.suggestions.map(t => `<p style="margin:0 0 8px">• ${esc(t)}</p>`).join("")}</div>` : ""}
    <div class="stack mt12"><button class="btn btn-line" data-a="mp-autre">🔀 Autre variante</button><button class="btn btn-ghost" data-a="go" data-r="monprogramme">Modifier mes réponses</button></div>
  </main><div class="dock"><button class="btn btn-red" data-a="mp-adopter">${mp.adopte ? "Adopter cette version" : "Adopter ce programme"}</button></div>`;
};

function squelette(p) {
  const max = 14, case_ = (c) => { const v = p.semaine[c], pr = v.why?.find(w => /priorité|point faible/.test(w));
    return `<div class="mpcase ${v.absent ? "absent" : ""}">${PAT(c)}<div class="grow"><b class="small">${esc(X.PATTERN[c].nom)}</b>${v.absent ? `<br><span class="xs muted">Aucun exercice possible avec ton matériel et tes gênes</span>` : `<div class="mpbar"><i class="${c}" style="width:${Math.round(Math.min(1, v.sets / max) * 100)}%"></i></div><span class="xs muted">${v.sets} séries${pr ? ` · ${esc(pr)}` : ""}</span>`}</div></div>`; };
  return `<p class="xs muted patzone" style="margin-top:0">Haut du corps</p><div class="patgrid">${["PH", "PV", "TH", "TV"].map(case_).join("")}</div><p class="xs muted patzone">Bas du corps</p><div class="patgrid">${["SG", "SH", "CH", "FG"].map(case_).join("")}</div>`;
}
function grille(p) {
  const jours = ["L", "M", "M", "J", "V", "S", "D"], at = (c, d) => p.sessions.filter(s => s.dow === d).reduce((t, s) => t + s.items.filter(l => l.pattern === c && l.couche === "squelette").reduce((u, l) => u + l.n, 0), 0);
  return `<div class="card" style="padding:10px 12px"><div class="mpgrid" role="table" aria-label="Patterns travaillés chaque jour"><span></span>${jours.map(j => `<b class="xs muted">${j}</b>`).join("")}
    ${X.PATTERNS.map(({ code }) => `${PAT(code)}${jours.map((_, d) => { const n = at(code, d); return n ? `<i class="mpc ${code}" style="opacity:${(.35 + .65 * Math.min(1, n / 6)).toFixed(2)}" title="${code} : ${n} séries" aria-label="${code}, ${G.DOW[d]} : ${n} séries"></i>` : `<i class="mpc"></i>`; }).join("")}`).join("")}</div>
    <p class="xs muted mt8" style="margin:8px 0 0">Plus la case est foncée, plus il y a de séries ce jour-là. Les jours vides sont des jours de repos.</p></div>`;
}
const serie = (l) => `${l.n} × ${l.lo}${l.hi !== l.lo ? "-" + l.hi : ""}${l.unite === "s" ? " s" : ""}${l.rpe ? ` · RPE ${l.rpe}` : ""}`;
function seance(s, si) {
  const pats = [...new Set(s.items.filter(l => l.couche === "squelette").map(l => l.pattern))];
  return `<div class="card mt8"><div class="row between" style="gap:8px"><div><b class="h3">${esc(s.titre)}</b><div class="xs muted">${G.DOW[s.dow]}</div><div class="mt4">${pastilleIndice(indiceDe(s), { info: { a: "mp-indice", d: `data-s="${si}"` } })}</div></div><div class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">${pats.map(c => PAT(c)).join("")}</div></div>
    <div class="mt8">${s.items.map((l, li) => `<div class="li" style="padding:10px 0;gap:8px">${l.pattern ? PAT(l.pattern) : `<span class="pat nul">${l.couche === "isolation" ? "ISO" : "MOD"}</span>`}<span class="grow small"><b>${esc(l.nom)}</b><br><span class="xs muted">${esc(serie(l))}</span></span><button class="icon-btn sm" data-a="mp-remplacer" data-s="${si}" data-i="${li}" aria-label="Remplacer ${esc(l.nom)}">🔄</button></div>`).join("")}</div>
    ${G.ciblesPour(s.minutes).length ? `<button class="btn btn-line btn-sm mt8" style="width:100%" data-a="mp-courte" data-s="${si}">⚡ Version courte (${G.ciblesPour(s.minutes).join(", ")} min)</button>` : ""}</div>`;
}

actions["mp-remplacer"] = (b, d) => {
  const p = S().monplan?.prop, prog = S().programme; if (!p || !prog) return;
  const si = +d.s, li = +d.i, l = p.sessions[si]?.items[li]; if (!l) return;
  const alts = G.alternativesLigne(p, prog, si, li, P.alternativesPour);
  sheet(`<h2 class="h2">Remplacer</h2><p class="small muted">${esc(l.nom)} · ${esc(serie(l))}. Les séries sont conservées. Seuls les exercices que tu peux faire (matériel, gênes) sont proposés.</p>
    ${alts.length ? `<div class="list mt8">${alts.slice(0, 14).map(e => `<button class="li" data-a="mp-pick" data-s="${si}" data-i="${li}" data-x="${esc(e.slug)}" style="gap:10px">${e.pattern_principal ? PAT(e.pattern_principal) : `<span class="pat nul">${e.couche === "isolation" ? "ISO" : "MOD"}</span>`}<span class="grow small"><b>${esc(e.nom)}</b>${prog.prefs?.[e.slug] === "love" ? " 😍" : ""}<br><span class="xs muted">${esc(e.muscles.join(" · "))} · ${esc(X.label(X.NIVEAUX, e.niveau))}</span></span></button>`).join("")}</div>` : `<p class="small muted mt12">Aucun autre exercice possible dans ce groupe avec ton matériel et tes gênes.</p>`}`);
};
actions["mp-pick"] = (b, d) => {
  const p = S().monplan?.prop, prog = S().programme; if (!p) return;
  const q = G.remplacerLigne(p, prog, +d.s, +d.i, d.x);
  update(st => { st.monplan = { ...st.monplan, prop: q }; });
  closeSheet(); buzz(); toast("Exercice remplacé"); routes.monplan();
};
actions["mp-autre"] = () => { courante(true, (S().monplan?.seed || 0) + 1); buzz(); routes.monplan(); window.scrollTo?.(0, 0); toast("Nouvelle variante"); };
actions["mp-adopter"] = () => {
  const mp = S().monplan; if (!mp?.prop) return;
  if (S().current) return toast("Termine ta séance en cours pour changer de programme.");
  if (S().plan?.programId && !confirm("Ton programme actuel s'arrête et celui-ci commence en semaine 1. Tes charges et ton historique sont gardés. Adopter ce programme ?")) return;
  const id = "gen-" + Date.now(), prog = G.versProgramme(mp.prop, { id, name: `Mon programme sur mesure · ${mp.prop.n} séance${mp.prop.n > 1 ? "s" : ""}` });
  update(st => {
    st.customPrograms = [...(st.customPrograms || []).filter(x => !String(x.id).startsWith("gen-")), prog];
    st.plan = { programId: id, startedAt: today(), week: 1, idx: 0, cycle: st.plan?.cycle || 1 };
    st.monplan = { ...st.monplan, adopte: new Date().toISOString() };
  });
  buzz(); toast("C'est parti avec ton programme"); pushStats(); go("train", "programme");
};

actions["mp-indice"] = (b, d) => { const p = S().monplan?.prop, s = p?.sessions[+d.s]; if (s) feuilleIndice(indiceDe(s), s.titre); };
// Version courte : on garde le squelette, on retire l'isolation puis des séries. Consultation seulement : la séance du programme ne change pas.
const courte = (si, cible) => {
  const p = S().monplan?.prop, s = p?.sessions[si]; if (!s) return;
  const cibles = G.ciblesPour(s.minutes), c = cibles.includes(cible) ? cible : cibles.at(-1), a = G.allegeeSeance(p, si, c), n = (x) => x.series ? x.series.length : x.n;
  sheet(`<h2 class="h2">Version courte</h2><p class="small muted">${esc(s.titre)} · de ${s.minutes} à <b>${a.minutes} min</b>. Utile quand le temps manque : tu gardes les mouvements de base.</p>
    <div class="chips mt8">${cibles.map(x => `<button class="chip ${x === c ? "on" : ""}" data-a="mp-courte-set" data-s="${si}" data-c="${x}">${x} min</button>`).join("")}</div>
    <div class="mt8">${pastilleIndice(a.indice)}</div>
    <div class="card mt12" style="padding:4px 14px">${a.items.map(l => `<div class="li" style="padding:10px 0;gap:8px">${l.pattern ? `<span class="pat ${l.pattern}">${l.pattern}</span>` : ""}<span class="grow small"><b>${esc(l.nom)}</b></span><span class="xs muted" style="white-space:nowrap">${n(l)} × ${l.series ? l.series[0].lo : l.lo}${(l.series ? l.series[0].hi : l.hi) !== (l.series ? l.series[0].lo : l.lo) ? "-" + (l.series ? l.series[0].hi : l.hi) : ""}</span></div>`).join("")}</div>
    ${a.retire.length ? `<p class="xs muted mt8">Retiré : ${a.retire.map(esc).join(", ")}.</p>` : ""}
    ${a.tient ? "" : `<p class="xs mt8" style="color:var(--warn)">Même réduite, cette séance dépasse un peu ${c} min.</p>`}
    <p class="xs muted mt8">Au moment de commencer une séance, « Séance express » fait la même chose à la volée.</p>`, null, { keep: !!document.getElementById("sheet") });
};
actions["mp-courte"] = (b, d) => courte(+d.s, null);
actions["mp-courte-set"] = (b, d) => courte(+d.s, +d.c);
