// Armoire à trophées (décision C61) : ton animal, ton niveau, ton grade et ta collection de badges.
// Les calculs sont dans js/armoire.js (module pur) ; les dessins dans js/animaux.js.
import { GENRES, genreChoisi } from "../genre.js";
import { S, update } from "../store.js";
import { $app, esc, routes, actions, header, tabbar, buzz, toast, sheet, closeSheet } from "../core.js";
import { syncProfile } from "../sync.js";
import { gather, stageOf, rewardsFor, dailyQuests } from "../quests.js";
import * as A from "../armoire.js";
import * as AN from "../animaux.js";

const CATS = [["force", "Force"], ["relatif", "Force selon ton poids"], ["calisthenie", "Calisthénie"], ["skill", "Skills"], ["course", "Course"], ["regularite", "Régularité"], ["nutrition", "Nutrition"], ["esprit", "État d'esprit"]];
const NOM_NIVEAU = Object.fromEntries(AN.NIVEAUX.map(n => [n.id, n.nom]));

// Tout ce qu'il faut pour afficher : chiffres de régularité, armoire, choix de la personne
export function calculer() {
  const c = gather(), p = S().profile || {};
  const a = A.armoire(S(), c, { poids: !!p.badgesPoids });
  return { c, a, pr: A.profilArmoire(p, a), deb: A.animauxDebloques(a), grade: stageOf(a.niveau) };
}
const medailleDe = (b, taille = 44) => AN.medaille(b.cat, b.niveau, { taille, verrouille: !b.ok, titre: `${b.nom} : ${b.libelle}${b.ok ? "" : " (à débloquer)"}` });
const epinglesDe = (a, pr, taille = 40) => pr.epingles.map(id => a.badges.find(b => b.id === id)).filter(Boolean).map(b => medailleDe(b, taille)).join("");

// Icône de profil : l'animal choisi, entouré de la couleur du niveau
export function iconeProfil(taille = 72) {
  const { a, pr } = calculer();
  return AN.medaillon(pr.animal, { taille, anneau: a.anneau, titre: `Ton animal : ${AN.ANIMAUX[pr.animal].nom}, niveau ${a.niveau}` });
}

// Nouveaux badges depuis la dernière visite : une seule annonce, puis ils sont marqués comme vus.
// Première visite : tout est marqué sans fête (pas de pluie d'annonces pour l'historique).
function annoncer(a) {
  const vus = S().armoireVus;
  const ids = a.obtenus.map(b => b.id);
  if (!Array.isArray(vus)) { update(st => { st.armoireVus = ids; }); return; }
  const n = A.nouveaux(a, vus);
  if (!n.length) return;
  update(st => { st.armoireVus = [...new Set([...(Array.isArray(st.armoireVus) ? st.armoireVus : []), ...ids])]; });
  const best = [...n].sort((x, y) => A.NIVEAUX.indexOf(y.niveau) - A.NIVEAUX.indexOf(x.niveau))[0];
  setTimeout(() => toast(n.length > 1 ? `🏅 ${n.length} nouveaux badges, dont ${best.nom} (${NOM_NIVEAU[best.niveau]})` : `🏅 Nouveau badge : ${best.nom} (${NOM_NIVEAU[best.niveau]})`), 400);
}

// Carte de l'accueil
export function carteProgression() {
  const { c, a, pr, grade } = calculer();
  annoncer(a);
  const q = dailyQuests(c);
  return `<div class="card"><div class="row" style="gap:12px;align-items:center">
    <button type="button" data-a="go" data-r="trophees" aria-label="Ouvrir ton armoire à trophées" style="border:0;padding:0;background:none;flex:none;min-height:44px">${AN.medaillon(pr.animal, { taille: 64, anneau: a.anneau })}</button>
    <div class="grow" style="min-width:0"><b>${esc(grade.name)}</b> · niveau ${a.niveau}<div class="gauge mt4" role="progressbar" aria-label="Progression vers le niveau suivant" aria-valuenow="${a.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${a.pct}%"></i></div><div class="xs muted mt4">${a.reste} XP avant le niveau ${a.niveau + 1}</div></div></div>
    ${pr.epingles.length ? `<div class="row mt8" style="gap:6px">${epinglesDe(a, pr, 34)}</div>` : ""}
    <div class="mt8">${q.map(x => `<div class="row between small" style="padding:4px 0"><span>${x.ok ? "✅" : "⬜"} ${esc(x.n)}</span><span class="xs muted">+${x.p}</span></div>`).join("")}</div>
    <div class="row between mt8"><span class="xs muted">${c.streak ? `🔥 Série : ${c.streak} jour${c.streak > 1 ? "s" : ""}` : "Série à démarrer"} · ${a.obtenus.length}/${a.badges.length} badges</span><button class="btn btn-line btn-sm" style="min-height:44px" data-a="go" data-r="trophees">Armoire</button></div></div>`;
}

routes.trophees = () => {
  const { c, a, pr, deb, grade } = calculer();
  annoncer(a);
  const p = S().profile || {}, q = dailyQuests(c), rw = rewardsFor();
  const famillesDe = (cat) => a.familles.filter(f => f.cat === cat), skillsDe = (cat) => a.badges.filter(b => b.famille === "skills" && b.cat === cat);
  const ligneFamille = (f) => {
    const b = f.atteint || a.badges.find(x => x.id === `${f.id}-1`);
    return `<button type="button" class="card tap" style="width:100%;text-align:left;display:flex;gap:12px;align-items:center;padding:10px 12px;margin-top:8px" data-a="arm-voir" data-f="${esc(f.id)}" aria-label="${esc(f.nom)} : voir les 5 paliers">${medailleDe(b, 48)}
      <span class="grow" style="min-width:0"><b class="small">${esc(f.nom)}</b><span class="xs muted" style="display:block">${f.atteint ? `${NOM_NIVEAU[f.atteint.niveau]} · ${esc(f.atteint.libelle)}` : "À débloquer"}${f.prochain ? ` · prochain : ${esc(f.prochain.libelle)}` : " · tout obtenu 🎉"}</span>
      <span class="gauge mt4" style="display:block"><i style="width:${f.pct}%"></i></span></span></button>`;
  };
  const tuile = (b) => `<button type="button" class="tap" style="border:0;background:none;padding:4px;text-align:center;min-height:44px;${b.ok ? "" : "opacity:.6"}" data-a="arm-voir" data-b="${esc(b.id)}" aria-label="${esc(b.nom)}${b.ok ? "" : " (à débloquer)"}"><span style="display:flex;justify-content:center">${medailleDe(b, 52)}</span><span class="xs" style="display:block;margin-top:2px">${esc(b.nom)}</span></button>`;
  const section = ([cat, titre]) => {
    const fs = famillesDe(cat), sk = skillsDe(cat);
    if (!fs.length && !sk.length) return "";
    const tous = a.badges.filter(b => b.cat === cat), ok = tous.filter(b => b.ok).length;
    return `<h2 class="sec">${esc(titre)} · ${ok}/${tous.length}</h2>${fs.map(ligneFamille).join("")}${sk.length ? `<div class="card" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:10px">${sk.map(tuile).join("")}</div>` : ""}`;
  };
  $app.innerHTML = header("Armoire à trophées", "Ton animal, ton niveau, tes badges", { back: "home" }) + `<main class="page">
    <div class="card grad"><div class="row" style="gap:14px;align-items:center">
      <button type="button" data-a="arm-animaux" aria-label="Changer d'animal" style="border:0;padding:0;background:none;flex:none">${AN.medaillon(pr.animal, { taille: 96, anneau: a.anneau })}</button>
      <div class="grow" style="min-width:0"><div class="lbl">Grade</div><b class="h2">${esc(grade.icon)} ${esc(grade.name)}</b><div class="small muted mt4">Niveau ${a.niveau} · ${a.xp} XP</div>
      <div class="gauge mt8" role="progressbar" aria-label="Progression vers le niveau suivant" aria-valuenow="${a.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${a.pct}%"></i></div><div class="xs muted mt4">${a.reste} XP avant le niveau ${a.niveau + 1}</div></div></div>
      <p class="small mt8" style="margin:8px 0 0">${esc(grade.line)}</p>
      <div class="row mt12" style="gap:8px;align-items:center;min-height:44px">${pr.epingles.length ? epinglesDe(a, pr, 44) : `<span class="xs" style="opacity:.85">Épingle jusqu'à 3 badges : ils s'affichent avec ton animal.</span>`}</div>
      <div class="minis mt8"><div><b>${a.obtenus.length}</b><div class="v">badges</div></div><div><b>${c.streak}</b><div class="v">jours de série</div></div><div><b>${deb.length}/${A.DEBLOCAGES.length}</b><div class="v">animaux</div></div></div></div>
    ${genreChoisi(S().profile) ? "" : `<div class="card"><div class="lbl" id="tr-l-genre">Comment veux-tu qu'on s'adresse à toi ?</div><div class="chips wrap mt8" role="group" aria-labelledby="tr-l-genre">${GENRES.map(([v, l]) => `<button type="button" class="chip" style="min-height:44px" data-a="genre-set" data-v="${v}">${l}</button>`).join("")}</div><p class="xs muted mt8" style="margin:0">Les noms de certains grades suivront ton choix. Modifiable dans Profil › Mes infos.</p></div>`}
    <h2 class="sec">Quêtes du jour</h2>
    <div class="card">${q.map(x => `<div class="row between" style="padding:6px 0"><span>${x.ok ? "✅" : "⬜"} ${esc(x.n)}</span><b class="red">+${x.p}</b></div>`).join("")}
      <p class="xs muted mt8" style="margin:0">Chaque badge rapporte aussi de l'XP : bronze 25, argent 50, or 100, platine 200, diamant 400.</p></div>
    ${CATS.map(section).join("")}
    <div class="card mt12"><div class="row between" style="gap:12px;align-items:center"><div class="grow"><b class="small">Badges selon ton poids de corps</b><div class="xs muted mt4">Ex. « 1 × ton poids au couché ». Calculés sur ton téléphone avec ton dernier poids noté ; le poids n'est jamais affiché ni partagé, et ces badges ne rapportent pas d'XP. Éteint par défaut.</div></div>
      <button type="button" class="btn btn-sm ${p.badgesPoids ? "btn-red" : "btn-line"}" style="min-height:44px;flex:none" data-a="arm-poids" aria-pressed="${!!p.badgesPoids}" aria-label="Badges selon ton poids de corps">${p.badgesPoids ? "Activés" : "Activer"}</button></div></div>
    ${rw.length ? `<h2 class="sec">Récompenses</h2><div class="list">${rw.map(r => `<div class="li" style="${a.niveau >= r.lvl ? "" : "opacity:.5"}"><span class="em">${a.niveau >= r.lvl ? r.icon : "🔒"}</span><span class="grow"><b>${esc(r.name)}</b><br><span class="xs muted">${a.niveau >= r.lvl ? "Débloquée · à utiliser lors de ta candidature" : `Niveau ${r.lvl} requis`}</span></span></div>`).join("")}</div>` : ""}
    <p class="xs muted mt16">Les niveaux récompensent la régularité et tes performances. Ils ne dépendent jamais de ton poids ni de ton apparence.</p>
  </main>${tabbar("")}`;
};

// Choix de l'animal
actions["arm-animaux"] = () => {
  const { a, pr } = calculer(), deb = new Set(A.animauxDebloques(a));
  sheet(`<h2 class="h2" style="margin:0">Ton animal</h2><p class="xs muted">D'autres se débloquent avec tes exploits.</p>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:8px">${A.DEBLOCAGES.map(x => deb.has(x.id)
      ? `<button type="button" class="tap" style="border:0;background:none;padding:4px;text-align:center;min-height:44px" data-a="arm-animal" data-v="${x.id}" aria-pressed="${pr.animal === x.id}"><span style="display:flex;justify-content:center">${AN.medaillon(x.id, { taille: 72, anneau: pr.animal === x.id ? a.anneau : null })}</span><span class="small" style="display:block;margin-top:4px;font-weight:${pr.animal === x.id ? 800 : 500}">${esc(AN.ANIMAUX[x.id].nom)}</span></button>`
      : `<div style="text-align:center;padding:4px"><span style="display:flex;justify-content:center">${AN.silhouette(x.id, 72)}</span><span class="xs muted" style="display:block;margin-top:4px"><span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Animal à découvrir : </span>🔒 ${esc(x.txt)}</span></div>`).join("")}</div>
    <button class="btn btn-line btn-sm mt12" style="min-height:44px" data-a="close-sheet">Fermer</button>`);
};
actions["arm-animal"] = (b, d) => {
  const { a } = calculer();
  if (!A.animauxDebloques(a).includes(d.v)) return;
  update(st => { st.profile = { ...(st.profile || {}), animal: d.v }; st.synced = false; });
  syncProfile(); buzz(); closeSheet(); toast(`${AN.ANIMAUX[d.v].nom} choisi`); if (location.hash.startsWith("#/trophees")) routes.trophees();
};

// Détail d'une famille (5 paliers) ou d'un badge unique, avec « Épingler »
actions["arm-voir"] = (b, d) => {
  const { a, pr } = calculer();
  const lst = d.f ? a.badges.filter(x => x.famille === d.f) : a.badges.filter(x => x.id === d.b);
  if (!lst.length) return;
  const f = d.f ? a.familles.find(x => x.id === d.f) : null;
  sheet(`<h2 class="h2" style="margin:0">${esc(f ? f.nom : lst[0].nom)}</h2>${f ? `<p class="xs muted">${f.poids ? "Calculé sur ton téléphone ; ces badges ne rapportent pas d'XP et ne s'épinglent pas." : `Ton record : ${f.valeur ? esc(f.unite(f.valeur)) : "pas encore"}`}</p>` : ""}
    <div class="mt8">${lst.map(x => `<div class="row" style="gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)">${medailleDe(x, 52)}<span class="grow"><b class="small">${NOM_NIVEAU[x.niveau]}</b><span class="xs muted" style="display:block">${esc(x.libelle)}${x.cat === "relatif" ? "" : ` · +${A.XP_NIVEAU[x.niveau]} XP`}</span></span>
      ${x.ok && x.cat === "relatif" ? `<span class="xs">✅</span>` : x.ok ? `<button type="button" class="btn btn-sm ${pr.epingles.includes(x.id) ? "btn-red" : "btn-line"}" style="min-height:44px" data-a="arm-epingle" data-v="${esc(x.id)}" data-f="${esc(d.f || "")}" data-b="${esc(d.b || "")}" aria-pressed="${pr.epingles.includes(x.id)}">${pr.epingles.includes(x.id) ? "Épinglé" : "Épingler"}</button>` : `<span class="xs muted">🔒</span>`}</div>`).join("")}</div>
    <button class="btn btn-line btn-sm mt12" style="min-height:44px" data-a="close-sheet">Fermer</button>`, null, { keep: !!document.getElementById("sheet") });
};
actions["arm-epingle"] = (b, d) => {
  const { a, pr } = calculer();
  if (!a.obtenus.some(x => x.id === d.v && x.cat !== "relatif")) return;
  let ep = pr.epingles.includes(d.v) ? pr.epingles.filter(x => x !== d.v) : [...pr.epingles, d.v];
  if (ep.length > 3) { ep = ep.slice(-3); toast("3 badges au plus : le plus ancien est retiré."); }
  update(st => { st.profile = { ...(st.profile || {}), epingles: ep }; st.synced = false; });
  syncProfile(); buzz();
  actions["arm-voir"](b, { f: d.f || undefined, b: d.b || undefined });
  if (location.hash.startsWith("#/trophees")) routes.trophees();
};
actions["arm-poids"] = () => {
  update(st => { st.profile = { ...(st.profile || {}), badgesPoids: !st.profile?.badgesPoids }; st.synced = false; });
  syncProfile(); buzz(); routes.trophees();
};

actions["genre-set"] = (b, d) => {
  if (!GENRES.some(g => g[0] === d.v)) return;
  update(st => { st.profile.genre = d.v; st.synced = false; });
  syncProfile(); buzz(); toast("C'est noté. Modifiable dans Profil › Mes infos."); routes.trophees();
};
