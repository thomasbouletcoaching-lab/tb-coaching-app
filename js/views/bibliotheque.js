// Espace coach › Base de données › « 8 patterns » : la bibliothèque d'exercices classée par pattern, couche et matériel.
import * as E from "../engine.js";
import * as X from "../exercices.js";
import { esc, toast, actions, forms, chips, sheet, closeSheet, rerender, cloud, I } from "../core.js";

const F = { pattern: "", couche: "", materiel: "", q: "" };

// Version embarquée ou dernière copie connue tout de suite ; le serveur est relu en arrière-plan, au plus une fois par minute
// (sinon chaque réaffichage relancerait une lecture, qui relancerait un affichage).
let lu = 0;
export async function loadBibliotheque(force = false) {
  await X.loadExercices();
  if (!force && Date.now() - lu < 60000) return;
  lu = Date.now();
  const p = cloud().then(c => X.refreshExercices(c)).then(ok => { if (ok && document.getElementById("bib")) rerender(); });
  if (force) await p;
}

// Pastille colorée d'un pattern ; grise pour l'isolation (ISO) et les modules (MOD)
export const pastille = (e, second = false) => {
  const c = second ? e.pattern_secondaire : e.pattern_principal;
  if (c) return `<span class="pat ${c}${second ? " sec2" : ""}" title="${esc(X.PATTERN[c].nom)}">${c}</span>`;
  return second ? "" : `<span class="pat nul" title="${esc(X.label(X.COUCHES, e.couche))}">${e.couche === "isolation" ? "ISO" : "MOD"}</span>`;
};
const nerf = (n) => `<span class="nerf" aria-label="Coût nerveux ${n} sur 3">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
const ligne = (e) => `<button class="li" data-a="bib-open" data-s="${esc(e.slug)}" style="gap:10px">${pastille(e)}<span class="grow small"><b>${esc(e.nom)}</b>${e.actif ? "" : ` <span class="tag">inactif</span>`}${e.video_url || E.videoOf(e.nom) ? " 🎥" : ""}<br>
  <span class="xs muted">${esc(e.pattern_principal ? e.muscles.join(" · ") : X.CATEGORIES[e.categorie] || "")} · ${esc(X.label(X.NIVEAUX, e.niveau))}</span></span>${nerf(e.cout_nerveux)}</button>`;

export function bibliothequeBody() {
  const all = X.exercices(), n = X.compterParPattern(), l = X.filtrer(F);
  if (!all.length) return `<p class="empty small mt12" id="bib">Bibliothèque indisponible pour l'instant. Vérifie ta connexion puis touche ↻.</p>`;
  const cases = (zone) => X.PATTERNS.filter(p => p.zone === zone).map(p => `<button class="${F.pattern === p.code ? "on" : ""}" data-a="bib-pat" data-v="${p.code}" aria-pressed="${F.pattern === p.code}"><span class="pat ${p.code}">${p.code}</span><b>${esc(p.nom)}</b><span class="n">${n[p.code]}</span></button>`).join("");
  return `<div id="bib">
    <p class="xs muted mt12">${all.length} exercices classés selon les 8 patterns. Touche un pattern pour filtrer.${X.source() === "embarquée" ? " Version embarquée dans l'app (lecture seule)." : ""}</p>
    <p class="xs muted patzone">Haut du corps</p><div class="patgrid">${cases("haut")}</div>
    <p class="xs muted patzone">Bas du corps</p><div class="patgrid">${cases("bas")}</div>
    <div class="mt12">${chips([["", "Toutes les couches"], ...X.COUCHES], F.couche, "bib-couche")}</div>
    <div class="mt8">${chips([["", "Tout matériel"], ...X.MATERIEL], F.materiel, "bib-mat")}</div>
    <input class="inp mt8" id="bib-q" value="${esc(F.q)}" style="text-align:left" placeholder="Nom ou muscle" aria-label="Rechercher un exercice">
    <p class="xs muted mt8">${l.length} exercice${l.length > 1 ? "s" : ""}${F.pattern ? ` · ${esc(X.PATTERN[F.pattern].nom)}` : ""} · à droite : coût nerveux de 1 à 3</p>
    ${l.length ? `<div class="card" style="padding:4px 12px">${l.map(ligne).join("")}</div>` : `<p class="empty small">Aucun exercice avec ces filtres.</p>`}</div>`;
}
export function mountBibliotheque() {
  const i = document.getElementById("bib-q");
  i?.addEventListener("input", () => { F.q = i.value; clearTimeout(i._t); i._t = setTimeout(() => { rerender(); const j = document.getElementById("bib-q"); if (j) { j.focus(); j.setSelectionRange(j.value.length, j.value.length); } }, 300); });
}
actions["bib-pat"] = (b, d) => { F.pattern = F.pattern === d.v ? "" : d.v; rerender(); };
actions["bib-couche"] = (b, d) => { F.couche = d.v; rerender(); };
actions["bib-mat"] = (b, d) => { F.materiel = d.v; rerender(); };

function fiche(slug) {
  const e = X.exercice(slug); if (!e) return;
  const alts = X.alternatives(e, { materiel: F.materiel }), mat = F.materiel ? X.label(X.MATERIEL, F.materiel) : "";
  const row = (k, v) => `<div class="row between small" style="padding:7px 0;border-bottom:1px solid var(--line);gap:12px;align-items:flex-start"><span class="muted" style="flex:none">${k}</span><span style="text-align:right">${v}</span></div>`;
  const vid = e.video_url || E.videoOf(e.nom) || "";
  sheet(`<div class="row" style="gap:6px;flex-wrap:wrap">${pastille(e)}${pastille(e, true)}<span class="tag" style="margin:0">${esc(X.label(X.COUCHES, e.couche))}</span>${e.actif ? "" : `<span class="tag" style="margin:0">inactif</span>`}</div>
    <h2 class="h2 mt8">${esc(e.nom)}</h2>
    <p class="small muted">${esc(e.pattern_principal ? X.PATTERN[e.pattern_principal].nom : X.CATEGORIES[e.categorie] || "")}${e.pattern_secondaire ? ` · secondaire : ${esc(X.PATTERN[e.pattern_secondaire].nom)}` : ""}</p>
    ${e.note ? `<p class="small" style="margin:8px 0">${esc(e.note)}</p>` : ""}
    <div class="mt8">
      ${row("Muscles", esc(e.muscles.join(" · ") || "—"))}
      ${row("Matériel", esc(e.materiel.map(m => X.label(X.MATERIEL, m)).join(" · ")))}
      ${row("Niveau", esc(X.label(X.NIVEAUX, e.niveau)))}
      ${row("Coût nerveux", `${nerf(e.cout_nerveux)} ${e.cout_nerveux} / 3`)}
      ${row("À éviter si gêne", esc(e.contre_indications.map(z => X.label(X.ZONES, z)).join(" · ") || "Aucune zone signalée"))}
    </div>
    <h3 class="sec" style="font-size:18px">Remplacements <small>${alts.length}${mat ? ` · ${esc(mat)}` : ""}</small></h3>
    ${alts.length ? `<div class="list">${alts.slice(0, 12).map(ligne).join("")}</div>` : `<p class="small muted">Aucun autre exercice ${mat ? "avec ce matériel" : "dans ce groupe"}.</p>`}
    ${e.id ? `<form data-f="bib-video" data-s="${esc(e.slug)}" class="mt12"><label class="field"><span>🎥 Lien vidéo</span><input name="url" type="url" value="${esc(vid)}" placeholder="https://"></label><button class="btn btn-red btn-sm mt8" style="width:100%">Enregistrer la vidéo</button></form>` : ""}
    <div class="row mt8" style="gap:8px">${E.ficheOf(e.nom) ? `<button class="btn btn-line btn-sm grow" data-a="fiche-sheet" data-n="${esc(e.nom)}">Voir la fiche</button>` : ""}
      ${e.id ? `<button class="btn btn-ghost btn-sm grow" data-a="bib-actif" data-s="${esc(e.slug)}">${e.actif ? "Désactiver" : "Réactiver"}</button>` : ""}</div>
    ${e.id ? `<p class="xs muted mt8">Un exercice désactivé n'est plus proposé aux membres. Rien n'est supprimé.</p>` : ""}`);
}
actions["bib-open"] = (b, d) => fiche(d.s);

async function enregistrer(slug, fields, msg) {
  const e = X.exercice(slug), c = await cloud(); if (!e?.id || !c) return toast("Enregistrement impossible hors ligne");
  try { await c.exerciceUpdate(e.id, fields); await X.refreshExercices(c); closeSheet(); toast(msg); rerender(); } catch (err) { toast("Impossible : " + err.message); }
}
actions["bib-actif"] = (b, d) => { const e = X.exercice(d.s); if (e) enregistrer(d.s, { actif: !e.actif }, e.actif ? "Exercice désactivé" : "Exercice réactivé"); };
forms["bib-video"] = (v, f) => enregistrer(f.dataset.s, { video_url: v.url.trim() || null }, v.url.trim() ? "Vidéo enregistrée" : "Vidéo retirée");
