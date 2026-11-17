// Écrans du module « athlète hybride » : programme du jour, quêtes, radar des 7 qualités, frise du bloc, personnage.
// Les calculs sont dans des modules purs et testés (js/hybride.js, js/hybride-quetes.js, js/hybride-generation.js,
// js/personnage.js). Ici : lecture des données de l'app, affichage, et appels au serveur (bloc, apparence, calcul de l'XP).
// Accès (décision C58) : pendant l'essai, avec un abonnement, pour les personnes coachées et invitées.
// Rien n'est imposé : le programme en cours de l'app n'est jamais remplacé sans accord explicite (et il est gardé en copie).
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as H from "../hybride.js";
import * as Q from "../hybride-quetes.js";
import * as GH from "../hybride-generation.js";
import * as P from "../personnage.js";
import { $app, esc, routes, actions, forms, header, tabbar, toast, buzz, go, sheet, closeSheet, rerender, tier, isCoach, cloud, fmtDate } from "../core.js";
import { etatDuJour } from "./fatigue.js";

let D = null, chargement = null, echec = false;
// Un échec de chargement est mémorisé (pas de boucle de requêtes) : l'écran propose « Réessayer »
const charger = () => chargement || (chargement = Promise.all([fetch("data/hybride.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }), X.loadExercices()])
  .then(([d]) => { if (!d?.macros || !d?.groupes) throw new Error("données"); D = d; echec = false; })
  .catch(() => { echec = true; chargement = null; }));
const ecranAttente = () => echec
  ? `<main class="page"><div class="card"><p class="small" style="margin:0">Données indisponibles pour l'instant (connexion ?).</p><button class="btn btn-line btn-sm mt8" data-a="hyb-reessayer">Réessayer</button></div></main>`
  : `<main class="page"><p class="small muted">Chargement…</p></main>`;
const COACHES = ["avance", "surmesure", "invite"];
export const accesHybride = () => isCoach() || tier() !== "free";
const estObjet = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const hyb = () => estObjet(S().hybride) ? S().hybride : {};
const prepare = (st) => { if (!estObjet(st.hybride)) st.hybride = {}; return st.hybride; };
// Bloc valide (macro connue, date ISO, 3 à 6 séances), lu via H.lire() : un ancien format est converti en copie
const blocValide = (b) => estObjet(b) && D.macros.some(m => m.id === b.macroId) && /^\d{4}-\d{2}-\d{2}$/.test(String(b.debut)) && !isNaN(new Date(b.debut + "T12:00:00")) && [3, 4, 5, 6].includes(+b.nbSeances);
function blocCourant() {
  const b = hyb().bloc; if (!b) return null;
  const lu = estObjet(b) ? (H.lire(b).courant || b) : b;
  if (blocValide(lu)) return { ...lu, nbSeances: +lu.nbSeances };
  // Bloc illisible : archivé tel quel (jamais effacé), puis on repropose le formulaire
  update(st => { const h = prepare(st); h.anciens = [...(Array.isArray(h.anciens) ? h.anciens : []), { illisible: h.bloc, archiveLe: new Date().toISOString() }]; h.bloc = null; });
  return null;
}
const exDe = (n) => X.exercice(n) || null;
const lundiProchain = (d = today()) => H.dowDe(d) === 0 ? d : H.addJours(H.lundiDe(d), 7);
const QLT = (id) => D.qualites.find(q => q.id === id)?.nom || id;

// ---------- Calcul de l'état affiché ----------
function etat() {
  const auj = today(), h = hyb(), bloc = blocCourant(), J = Q.journalDepuisEtat(D, { ...S(), hybride: { ...h, bloc } }, exDe);
  const b = Q.bilan(D, J, auj, { precedents: h.debloques || [], xpBase: h.xpServeur ?? null });
  const cal = bloc ? H.calendrier(D, { debut: bloc.debut, macroId: bloc.macroId }) : null;
  const pos = cal ? H.position(cal, auj) : null;
  return { auj, J, b, cal, pos, bloc };
}

// ---------- Synchronisation avec le serveur (silencieuse, jamais bloquante) ----------
let dernierCalcul = 0;
async function synchroniser(force = false) {
  if (!force && Date.now() - dernierCalcul < 5 * 60e3) return;
  dernierCalcul = Date.now();
  try {
    const c = await cloud(); if (!c || !(await c.ensureSession().catch(() => null))) return;
    const bl = D && blocCourant(); if (bl && !hyb().blocEnvoye) { await c.hybBlocSave(bl); update(st => { prepare(st).blocEnvoye = true; }); }
    const r = await c.hybCalcul();
    if (r?.ok) { update(st => { const h = prepare(st); h.xpServeur = Math.max(+h.xpServeur || 0, +r.xp || 0); h.debloques = [...new Set([...(Array.isArray(h.debloques) ? h.debloques : []), ...(Array.isArray(r.debloques) ? r.debloques : [])])]; }); if (location.hash.startsWith("#/hybride")) rerender(); }
  } catch (e) { console.warn("Calcul de l'XP reporté :", e.message); }
}

// ---------- Morceaux d'écran ----------
const carte = (titre, corps, extra = "") => `<div class="card" ${extra}><div class="lbl">${titre}</div>${corps}</div>`;
const barre = (pct, lbl) => `<div class="gauge mt4" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(lbl)}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;

function cartePerso({ b }) {
  const h = hyb(), r = b.rang, s = b.serie;
  return `<div class="card grad"><div class="row" style="gap:14px;align-items:center">
    <div style="flex:none;border-radius:16px;overflow:hidden;line-height:0">${P.svg(h.apparence, { debloques: b.debloques, taille: 96 })}</div>
    <div class="grow"><div class="lbl">Rang</div><b class="h2">${esc(r.nom)}</b><div class="small muted mt4">${b.xp} XP${r.suivant ? ` · ${r.reste} avant ${esc(r.suivant.nom)}` : ""}</div>${barre(r.pct, "Progression vers le rang suivant")}
    <div class="xs muted mt8">${s.retour ? "" : s.jours ? `🔥 Série : ${s.jours} jour${s.jours > 1 ? "s" : ""}${s.graceRestante ? " · 1 jour de grâce disponible" : ""}` : esc(s.message || "")}</div></div></div>
    ${s.retour ? `<p class="mt8" style="margin:8px 0 0"><b>${esc(s.message)}</b></p>` : ""}
    <div class="row mt12" style="gap:8px"><button class="btn btn-sm" style="background:var(--paper);color:var(--ink);min-height:44px" data-a="go" data-r="hybride-perso">Personnaliser</button></div></div>`;
}

// Séance du jour : générée pour la semaine du bloc, puis ajustée selon la Forme du jour
function seanceDuJour({ auj, pos, bloc }) {
  const h = { ...hyb(), bloc };
  if (!pos || pos.fini) return null;
  const prop = GH.semaine(D, X.exercices(), { bloc: h.bloc, semaineMacro: pos.n, answers: S().programme?.answers || { level: S().profile?.level, materiel: [], zones: [] }, prefs: S().programme?.prefs || {}, reprise: h.bloc.reprise, vma: h.bloc.vma, halterophilie: h.bloc.halterophilie, paliers: h.paliers || {} });
  const s = prop.seances.find(x => x.dow === H.dowDe(auj));
  if (!s) return { repos: true, prop };
  const info = Object.fromEntries(D.blocs.map(b => [b.id, b]));
  const brute = { blocs: s.blocs.map(b => ({ id: b.id, exercices: b.items.map(l => ({ ...l, role: info[b.id]?.principal ? "principal" : "accessoire" })) })) };
  const feu = (() => { try { return etatDuJour()?.feu?.id || "vert"; } catch { return "vert"; } })();
  const f = H.formeDuJour(D, brute, ["vert", "orange", "rouge"].includes(feu) ? feu : "vert");
  return { s, prop, feu, adaptee: f.seance, note: f.note, info };
}

function carteJour(e) {
  const { pos } = e;
  if (!pos) return carte("Programme du jour", `<p class="small" style="margin:6px 0 0">Ton bloc commence le ${esc(fmtDate(e.bloc.debut))}.</p>`);
  if (pos.fini) return carte("Programme du jour", `<p class="small" style="margin:6px 0 0">Bloc terminé. Choisis le suivant quand tu veux.</p><button class="btn btn-red btn-sm mt8" data-a="hyb-nouveau">Choisir le bloc suivant</button>`);
  const j = seanceDuJour(e);
  const tete = `<div class="xs muted mt4">Semaine ${pos.n} sur 12 · ${pos.decharge ? "décharge" : `RIR ${pos.rir}`}${pos.tests.length ? ` · tests : ${pos.tests.map(t => esc(t.toUpperCase())).join(", ")}` : ""}</div>`;
  if (j.repos) return carte("Programme du jour", tete + `<p class="small" style="margin:8px 0 0">Repos prévu. Marche, mobilité : ta série continue.</p>`);
  const blocs = j.adaptee.blocs.map(b => `<div class="mt8"><div class="xs muted">${esc(j.info[b.id]?.nom || b.id)}</div>${b.exercices.map(l => l.unite === "min" ? `<div class="small" style="padding:3px 0">${esc(l.nom)}<div class="xs muted">${esc(l.note || "")}</div></div>` : `<div class="row between small" style="padding:3px 0;gap:8px"><span>${esc(l.nom)}</span><span class="xs muted" style="white-space:nowrap">${l.n} × ${l.lo}${l.unite === "s" ? " s" : ""}</span></div>`).join("")}</div>`).join("");
  const forme = j.feu === "vert" ? "" : `<p class="xs mt8" style="margin:8px 0 0">🟠 ${esc(j.note || "")}</p>`;
  return carte(`Programme du jour · ${esc(j.s.titre)}`, tete + forme + blocs + `<div class="row mt12" style="gap:8px;flex-wrap:wrap"><button class="btn btn-red btn-sm" data-a="hyb-go">Commencer la séance</button><button class="btn btn-line btn-sm" data-a="hyb-pause">Imprévu ou mauvaise nuit</button></div>`);
}

function carteQuetes({ b }) {
  const ligne = (q) => `<div class="row between small" style="padding:5px 0;gap:8px"><span>${q.reussie ? "✅" : "⬜"} ${esc(q.titre)}${q.prochain ? `<br><span class="xs muted">Prochain palier : ${esc(q.prochain)}</span>` : ""}</span><span class="xs muted" style="white-space:nowrap">${q.sur > 1 ? `${q.n}/${q.sur}` : ""}</span></div>`;
  const grp = (t, l) => l.length ? `<div class="mt8"><div class="xs muted">${t}</div>${l.map(ligne).join("")}</div>` : "";
  const Qs = b.quetes;
  return carte("Quêtes", grp("Aujourd'hui", Qs.filter(q => q.type === "jour")) + grp("Cette semaine", Qs.filter(q => q.type === "semaine")) + grp("Ce bloc", Qs.filter(q => q.type === "bloc" || q.type === "boss")) + grp("Skills", Qs.filter(q => q.type === "skill"))
    + `<p class="xs muted mt8" style="margin:8px 0 0">Une séance faite avec une douleur ou une grande fatigue notée ne rapporte pas d'XP : écouter son corps fait partie du programme.</p>`);
}

// Radar : 7 axes, 0 à 100
function radarSvg(r) {
  const n = r.length, c = 110, R = 78, pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + Math.cos(a) * R * v / 100, c + Math.sin(a) * R * v / 100]; };
  const grille = [25, 50, 75, 100].map(v => `<polygon points="${r.map((_, i) => pt(i, v).join(",")).join(" ")}" fill="none" stroke="var(--line)"/>`).join("");
  const forme = `<polygon points="${r.map((x, i) => pt(i, Math.max(4, x.v)).join(",")).join(" ")}" fill="var(--tint2)" stroke="var(--red)" stroke-width="2"/>`;
  const lbl = r.map((x, i) => { const [x0, y0] = pt(i, 122); return `<text x="${x0}" y="${y0}" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="var(--soft)">${esc(x.nom.split(" ")[0])}</text>`; }).join("");
  return `<svg viewBox="-20 0 260 220" width="100%" style="max-width:300px" role="img" aria-label="Radar des 7 qualités : ${r.map(x => `${x.nom} ${x.v} sur 100`).join(", ")}">${grille}${forme}${lbl}</svg>`;
}
function carteRadar(e) {
  const C = e.bloc && e.pos && !e.pos.fini ? H.cibles(D, { macroId: e.bloc.macroId, semaine: e.pos.semaine, nbSeances: e.bloc.nbSeances }) : null;
  const r = Q.radar(D, e.J, e.auj, C);
  return carte("Tes 7 qualités · 4 dernières semaines", `<div style="text-align:center">${radarSvg(r)}</div><p class="xs muted" style="margin:4px 0 0">Ce que tu as entraîné, comparé aux repères du programme. Ce n'est ni une note ni une mesure du corps.</p>`);
}

function carteFrise({ cal, pos, bloc }) {
  const m = H.macro(D, bloc.macroId);
  const cases = cal.map(s => `<div title="Semaine ${s.n}" style="flex:1;min-width:0;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;${pos?.n === s.n ? "background:var(--red);color:var(--red-ink);font-weight:700" : s.decharge ? "background:var(--tint2)" : "background:var(--tint)"}">${s.decharge ? "D" : s.n}</div>`).join("");
  return carte(`Bloc ${esc(m.id)} · ${esc(m.nom)}`, `<div class="xs muted mt4">En développement : ${m.dev.map(QLT).map(esc).join(" et ")}. Le reste est entretenu.</div><div class="row mt8" style="gap:3px" role="img" aria-label="Frise des 12 semaines : semaine ${pos && !pos.fini ? pos.n : "–"} en cours, décharges en semaines 4, 8 et 12">${cases}</div><div class="xs muted mt4">D = décharge (volume divisé par deux) ou tests.</div>
    <div class="row mt12" style="gap:8px;flex-wrap:wrap"><button class="btn btn-line btn-sm" data-a="hyb-test">Noter un test</button><button class="btn btn-line btn-sm" data-a="hyb-nouveau">Changer de bloc</button></div>`);
}

// État du partage relu sur le serveur à l'ouverture (nouvel appareil, réinstallation)
let consentementLu = false;
async function lireConsentement() {
  if (consentementLu || COACHES.includes(tier()) || isCoach()) return; consentementLu = true;
  try {
    const c = await cloud(); if (!c || !(await c.ensureSession().catch(() => null))) { consentementLu = false; return; }
    const r = await c.hybConsentement(), on = !!(r?.accorde_le && (!r.revoque_le || r.revoque_le < r.accorde_le));
    const avant = hyb().partage; update(st => { const h = prepare(st); h.partage = on; h.partageConnu = true; });
    if (avant !== on && location.hash.startsWith("#/hybride")) rerender();
  } catch { consentementLu = false; }
}
function carteConsentement() {
  if (COACHES.includes(tier()) || isCoach()) return "";
  const on = !!hyb().partage;
  if (!hyb().partageConnu) return carte("Partager avec Thomas", `<p class="small" style="margin:6px 0 0">Par défaut, Thomas ne voit rien de ton module hybride. Ton choix sera vérifié à ta prochaine connexion ; tu peux le fixer ici.</p><div class="row mt8" style="gap:8px;flex-wrap:wrap"><button class="btn btn-line btn-sm" data-a="hyb-partage" data-v="1">Partager ma progression</button><button class="btn btn-line btn-sm" data-a="hyb-partage" data-v="0">Ne pas partager</button></div>`);
  return carte("Partager avec Thomas", `<p class="small" style="margin:6px 0 0">${on ? "Thomas voit ton bloc, tes quêtes et ton XP du module hybride. Tu peux arrêter quand tu veux." : "Par défaut, Thomas ne voit rien de ton module hybride. Tu peux lui ouvrir ton bloc, tes quêtes et ton XP, et revenir en arrière quand tu veux."}</p><button class="btn btn-line btn-sm mt8" data-a="hyb-partage" data-v="${on ? 0 : 1}">${on ? "Arrêter le partage" : "Partager ma progression"}</button>`);
}

// ---------- Choix du bloc ----------
function formBloc() {
  const p = S().profile || {}, n = Math.min(6, Math.max(3, +p.days || 3)), b = blocValide(hyb().bloc) ? hyb().bloc : null;
  return `<form data-f="hyb-bloc" class="card"><div class="lbl">Ton bloc de 12 semaines</div>
    <p class="small" style="margin:6px 0 0">Deux qualités progressent, les autres sont entretenues. Une semaine sur quatre est allégée.</p>
    <label class="lbl mt12" for="hyb-macro">Priorités</label><select id="hyb-macro" name="macro">${D.macros.map(m => `<option value="${m.id}" ${(b?.macroId || "M1") === m.id ? "selected" : ""}>${esc(m.id)} · ${esc(m.nom)} : ${m.dev.map(QLT).map(esc).join(" et ")}</option>`).join("")}</select>
    <label class="lbl mt12" for="hyb-n">Séances par semaine</label><select id="hyb-n" name="n">${[3, 4, 5, 6].map(k => `<option value="${k}" ${k === (b?.nbSeances || n) ? "selected" : ""}>${k} séances</option>`).join("")}</select>
    <label class="lbl mt12" for="hyb-debut">Début (un lundi)</label><input id="hyb-debut" type="date" name="debut" value="${lundiProchain()}">
    <label class="lbl mt12" for="hyb-vma">VMA en km/h (facultatif)</label><input id="hyb-vma" name="vma" inputmode="decimal" placeholder="Après ton test de semaine 4">
    <label class="check mt12"><input type="checkbox" name="reprise" ${b?.reprise ? "checked" : ""}> Commencer par 4 semaines de course en zone 2 (conseillé après un arrêt)</label>
    <label class="check mt8"><input type="checkbox" name="halterophilie" ${b?.halterophilie ? "checked" : ""}> Je maîtrise l'épaulé et l'arraché (sinon : kettlebell)</label>
    <button class="btn btn-red mt16" type="submit">Valider ce bloc</button></form>`;
}

// ---------- Écrans ----------
routes.hybride = () => {
  if (!accesHybride()) { $app.innerHTML = header("Athlète hybride", "", { back: "home", offers: false }) + `<main class="page"><div class="card"><p class="small" style="margin:0">Le module athlète hybride est ouvert pendant l'essai, avec l'abonnement et pour les personnes coachées.</p></div></main>${tabbar("carnet")}`; return; }
  if (!D) { $app.innerHTML = header("Athlète hybride", "", { back: "home", offers: false }) + ecranAttente() + tabbar("carnet"); if (!echec) charger().then(() => { if ((D || echec) && location.hash.startsWith("#/hybride")) rerender(); }); return; }
  lireConsentement();
  if (!blocCourant()) { $app.innerHTML = header("Athlète hybride", "Choisis ton bloc", { back: "home", offers: false }) + `<main class="page">${formBloc()}</main>${tabbar("carnet")}`; return; }
  let e; try { e = etat(); } catch (err) { console.warn("Hybride :", err.message); $app.innerHTML = header("Athlète hybride", "", { back: "home", offers: false }) + `<main class="page"><div class="card"><p class="small" style="margin:0">Cet écran n'a pas pu s'afficher. Ton bloc est gardé : tu peux en choisir un autre.</p><button class="btn btn-line btn-sm mt8" data-a="hyb-nouveau">Choisir un bloc</button></div></main>${tabbar("carnet")}`; return; }
  $app.innerHTML = header("Athlète hybride", "", { back: "home", offers: false }) + `<main class="page">${cartePerso(e)}${carteJour(e)}${carteQuetes(e)}${carteRadar(e)}${carteFrise(e)}${carteConsentement()}</main>${tabbar("carnet")}`;
  synchroniser();
};

const OBJ = (id) => D.objets.find(o => o.id === id);
const condition = (o) => { const c = o.condition || {}; return c.rang ? `Rang ${D.rangs.find(r => r.id === c.rang)?.nom}` : c.quete ? `Quête : ${D.quetes.find(q => q.id === c.quete)?.titre}` : c.serie ? `Série de ${c.serie} jours` : ""; };
routes["hybride-perso"] = () => {
  if (!accesHybride()) return go("hybride");
  if (!D) { if (!echec) charger().then(() => { if ((D || echec) && location.hash.startsWith("#/hybride-perso")) rerender(); }); $app.innerHTML = header("Ton personnage", "", { back: "hybride", offers: false }) + ecranAttente() + tabbar("carnet"); return; }
  const h = hyb(), deb = new Set(["tenue-base", "decor-salle", ...(h.debloques || []), ...Q.bilan(D, Q.journalDepuisEtat(D, S(), exDe), today(), { precedents: h.debloques || [], xpBase: h.xpServeur ?? null }).debloques]);
  const a = P.normaliser(h.apparence, [...deb]);
  const choix = (k, opts) => `<div class="chips wrap mt8" role="group" aria-label="${esc(k)}">${opts.map(([v, l, on, off]) => `<button type="button" class="chip ${on ? "on" : ""}" style="min-height:44px;white-space:normal;text-align:left;max-width:100%;height:auto;${off ? "opacity:.6" : ""}" data-a="hyb-app" data-k="${k}" data-v="${esc(String(v))}" ${off ? "disabled" : ""} aria-pressed="${on}">${l}</button>`).join("")}</div>`;
  const objets = (type) => D.objets.filter(o => o.type === type).map(o => [o.id, deb.has(o.id) ? esc(o.nom) : `🔒 ${esc(o.nom)}<span class="xs" style="display:block;font-weight:400">${esc(condition(o))}</span>`, type === "accessoire" ? a.accessoires.includes(o.id) : a[type] === o.id, !deb.has(o.id)]);
  $app.innerHTML = header("Ton personnage", "Il évolue avec ta régularité, jamais en arrière", { back: "hybride", offers: false }) + `<main class="page">
    <div class="card" style="text-align:center"><div style="display:inline-block;border-radius:20px;overflow:hidden;line-height:0">${P.svg(a, { debloques: [...deb], taille: 180 })}</div></div>
    <div class="card"><div class="lbl">Peau</div><div class="chips wrap mt8" role="group" aria-label="Peau">${P.PEAUX.map((c, i) => `<button type="button" class="chip ${a.peau === i ? "on" : ""}" style="min-height:44px;min-width:44px;background:${c}" data-a="hyb-app" data-k="peau" data-v="${i}" aria-label="Teinte ${i + 1}" aria-pressed="${a.peau === i}"></button>`).join("")}</div>
      <div class="lbl mt12">Coiffure</div>${choix("coiffure", P.COIFFURES.map(c => [c, { rase: "Rasée", courte: "Courte", boucles: "Boucles", chignon: "Chignon", tresses: "Tresses", longue: "Longue" }[c], a.coiffure === c]))}
      <div class="lbl mt12">Couleur des cheveux</div><div class="chips wrap mt8" role="group" aria-label="Couleur des cheveux">${P.CHEVEUX_COULEURS.map((c, i) => `<button type="button" class="chip ${a.cheveux === i ? "on" : ""}" style="min-height:44px;min-width:44px;background:${c}" data-a="hyb-app" data-k="cheveux" data-v="${i}" aria-label="Couleur ${i + 1}" aria-pressed="${a.cheveux === i}"></button>`).join("")}</div>
      <div class="lbl mt12">Visage</div>${choix("visage", P.VISAGES.map(v => [v, { rond: "Rond", ovale: "Ovale", carre: "Carré" }[v], a.visage === v]))}
      <div class="lbl mt12">Silhouette</div>${choix("silhouette", P.SILHOUETTES.map(v => [v, `Forme ${v}`, a.silhouette === v]))}
      <p class="xs muted mt8" style="margin:8px 0 0">La silhouette est un simple choix de dessin : elle ne dit rien de ton corps et ne change jamais avec tes données.</p></div>
    <div class="card"><div class="lbl">Tenue</div>${choix("tenue", objets("tenue"))}<div class="lbl mt12">Accessoires</div>${choix("accessoires", objets("accessoire"))}<div class="lbl mt12">Décor</div>${choix("decor", objets("decor"))}</div>
  </main>${tabbar("carnet")}`;
};

// ---------- Actions ----------
let envoiApparence = null;
actions["hyb-reessayer"] = () => { echec = false; rerender(); };
actions["hyb-app"] = (b, d) => {
  if (b.disabled) return;
  update(st => {
    const h = prepare(st); const a = { ...P.DEFAUT, ...(estObjet(h.apparence) ? h.apparence : {}) };
    if (d.k === "accessoires") a.accessoires = (a.accessoires || []).includes(d.v) ? a.accessoires.filter(x => x !== d.v) : [...(a.accessoires || []), d.v];
    else a[d.k] = ["peau", "cheveux", "silhouette"].includes(d.k) ? +d.v : d.v;
    h.apparence = a;
  });
  buzz(); rerender();
  clearTimeout(envoiApparence);
  envoiApparence = setTimeout(async () => { try { const c = await cloud(); if (c && await c.ensureSession().catch(() => null)) await c.hybApparence(P.normaliser(hyb().apparence, hyb().debloques || [])); } catch (e) { console.warn("Apparence non envoyée :", e.message); } }, 1500);
};

forms["hyb-bloc"] = (v) => {
  if (!D || !D.macros.some(m => m.id === v.macro) || ![3, 4, 5, 6].includes(+v.n)) return toast("Choisis un bloc et un nombre de séances.");
  let debut = /^\d{4}-\d{2}-\d{2}$/.test(v.debut || "") ? v.debut : lundiProchain();
  if (H.dowDe(debut) !== 0) debut = lundiProchain(debut);
  const vma = parseFloat(String(v.vma || "").replace(",", "."));
  const bloc = { macroId: v.macro, debut, nbSeances: +v.n, reprise: !!v.reprise, halterophilie: !!v.halterophilie, vma: vma > 5 && vma < 30 ? vma : null };
  const appliquer = () => {
    update(st => {
      const h = prepare(st);
      const r = H.remplacerProgramme({ hybride: { courant: h.bloc || null, anciens: Array.isArray(h.anciens) ? h.anciens : [] } }, bloc, { accord: true });
      h.bloc = r.etat.hybride.courant; h.anciens = r.etat.hybride.anciens; h.blocEnvoye = false;
    });
    closeSheet(); toast(`Bloc enregistré : début le ${fmtDate(debut)}.`); go("hybride"); synchroniser(true);
  };
  if (blocCourant()) {
    sheet(`<h2 class="h2" style="margin:0">Remplacer ton bloc en cours ?</h2><p class="small">Ton bloc actuel est gardé en copie. Tes séances, ton XP et tes objets restent acquis.</p><div class="row mt12" style="gap:8px"><button class="btn btn-red" data-a="hyb-ok">Oui, remplacer</button><button class="btn btn-line" data-a="close-sheet">Garder l'actuel</button></div>`);
    actions["hyb-ok"] = appliquer; return;
  }
  appliquer();
};
actions["hyb-nouveau"] = () => { if (!D) return go("hybride"); $app.innerHTML = header("Athlète hybride", "Choisis ton bloc", { back: "hybride", offers: false }) + `<main class="page">${formBloc()}</main>${tabbar("carnet")}`; };
actions["close-sheet"] = actions["close-sheet"] || (() => closeSheet());

actions["hyb-pause"] = () => {
  const d = today();
  update(st => { const h = prepare(st); h.pauses = { ...(estObjet(h.pauses) ? h.pauses : {}), [d]: "imprevu" }; });
  buzz(); toast("C'est noté. Ta série ne bouge pas, on reprend demain."); rerender();
};

actions["hyb-test"] = () => {
  const types = [...new Set(D.macros.flatMap(m => Object.values(m.tests || {}).flat()))];
  const nom = { vma: "VMA (demi-Cooper)", "5rm": "5RM", "1rm": "1RM", "100m": "100 m", "400m": "400 m", "5km": "5 km", sauts: "Sauts" };
  sheet(`<h2 class="h2" style="margin:0">Noter un test</h2><p class="small">Seule la date compte pour tes quêtes : ton résultat reste sur ton téléphone.</p><div class="chips wrap mt8">${types.map(t => `<button type="button" class="chip" style="min-height:44px" data-a="hyb-test-ok" data-v="${t}">${esc(nom[t] || t)}</button>`).join("")}</div>`);
};
actions["hyb-test-ok"] = (b, d) => {
  update(st => { const h = prepare(st); h.tests = [...(Array.isArray(h.tests) ? h.tests : []), { d: today(), type: d.v }].slice(-80); });
  closeSheet(); buzz(); toast("Test noté. Bravo, c'est fait."); rerender(); synchroniser(true);
};

actions["hyb-partage"] = async (b, d) => {
  const on = d.v === "1";
  try { const c = await cloud(); if (!c || !(await c.ensureSession().catch(() => null))) return toast("Connecte-toi pour partager."); await c.hybConsentir(on); update(st => { const h = prepare(st); h.partage = on; h.partageConnu = true; }); toast(on ? "Partage activé. Tu peux l'arrêter quand tu veux." : "Partage arrêté. Thomas ne voit plus ton module hybride."); rerender(); }
  catch (e) { toast("Impossible pour l'instant, réessaie plus tard."); }
};

// Commencer la séance du jour : une séance libre remplie avec les exercices du jour (le programme de l'app ne change pas)
actions["hyb-go"] = () => {
  const e = etat(), j = seanceDuJour(e); if (!j || j.repos) return;
  if (S().current) return go("workout");
  const s = E.freeSession(`Hybride · ${j.s.titre}`);
  s.hybride = { semaine: e.pos.n, forme: j.feu };
  j.adaptee.blocs.forEach(b => b.exercices.forEach(l => {
    if (b.id === "echauffement" && !l.slug) { s.note = l.note; return; }
    if (l.categorie === "cardio" || l.categorie === "vitesse") { const x = E.blankExercise(l.nom); x.note = l.note || ""; x.sets = x.sets.slice(0, 1).map(z => ({ ...z, reps: l.lo, lo: l.lo, hi: l.hi, kg: null })); s.exercises.push(x); return; }
    const x = E.blankExercise(l.nom); const base = x.sets[0];
    x.sets = Array.from({ length: Math.max(1, l.n) }, () => ({ ...base, lo: l.lo, hi: l.hi, reps: l.lo, trpe: l.rpe ?? base.trpe }));
    if (b.id === "echauffement" || l.note) x.note = l.note || "";
    s.exercises.push(x);
  }));
  update(st => { st.current = s; }); buzz(); go("workout");
};

// ---------- Vue coach (onglet Suivi d'un membre) ----------
// Les règles d'accès du serveur décident : coaché = visible ; abonné en autonomie = visible seulement avec son accord.
export function carteCoach(memberId) {
  if (!echec) charger();
  setTimeout(async () => {
    const el = document.getElementById("hyb-coach"); if (!el) return;
    try {
      const c = await cloud(); const r = await c.hybPourCoach(memberId);
      const titre = (id) => D?.quetes?.find(q => q.id === id)?.titre || id;
      el.innerHTML = r.vide ? `<p class="small muted" style="margin:6px 0 0">Rien à afficher : module non utilisé, ou abonnement en autonomie sans partage.</p>`
        : `<div class="small mt4">${r.bloc ? `Bloc ${esc(r.bloc.macro_id)} · ${+r.bloc.nb_seances || 0} séances, début le ${esc(fmtDate(r.bloc.debut))}` : "Pas de bloc"} · <b>${+r.xp || 0} XP</b></div>${r.quetes.slice(0, 6).map(q => `<div class="xs muted">✅ ${esc(titre(q.quete_id))} · ${esc(String(q.reussie_le || "").slice(0, 10))}</div>`).join("")}`;
    } catch { el.innerHTML = `<p class="small muted" style="margin:6px 0 0">Indisponible pour l'instant.</p>`; }
  }, 0);
  return `<div class="card"><div class="lbl">Athlète hybride</div><div id="hyb-coach" data-m="${esc(memberId)}"><p class="xs muted" style="margin:6px 0 0">Chargement…</p></div></div>`;
}

// Carte d'accès depuis l'accueil
export const carteAccueil = () => !accesHybride() ? "" : `<div class="card"><div class="row between"><div><div class="lbl">🏃 Athlète hybride</div><div class="small muted mt4">${hyb().bloc ? "Programme du jour, quêtes et personnage" : "Force, vitesse, endurance, skills : un bloc de 12 semaines"}</div></div><button class="btn btn-line btn-sm" data-a="go" data-r="hybride">${hyb().bloc ? "Ouvrir" : "Découvrir"}</button></div></div>`;
