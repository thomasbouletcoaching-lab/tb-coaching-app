// Partage, parrainage, amis et communauté : règles pures (aucun accès au DOM, au stockage ni au réseau).
// Testé par tests/social.test.mjs. Les écrans sont dans js/views/social.js, la base dans
// supabase/migrations/2026-11-18_cxs_social.sql.

// ---------- Réglages ----------
export const PARRAINAGE = {
  bonusFilleulJours: 7,     // jours d'essai en plus pour la personne invitée (30 → 37)
  moisParFilleul: 1,        // mois de Bâtisseur offert au parrain par filleul qui passe Bâtisseur
  plafondAnnuel: 12,        // au plus 12 mois offerts par an
  lienJours: 30,            // le code se lie dans les 30 jours qui suivent la création du compte
};
// Paliers : badge + cadeau en plus des mois offerts. « Légende » : une visio de 30 min avec Thomas (à valider par lui).
export const PALIERS = [
  { n: 1, id: "recruteur", nom: "Recruteur", em: "🤝", cadeau: "1 mois de Bâtisseur offert" },
  { n: 3, id: "ambassadeur", nom: "Ambassadeur", em: "🎖️", cadeau: "1 mois offert en bonus" },
  { n: 5, id: "mentor", nom: "Mentor", em: "🏅", cadeau: "Ton programme relu par Thomas" },
  { n: 10, id: "legende", nom: "Légende", em: "👑", cadeau: "Une visio de 30 min avec Thomas" },
];

// Réactions possibles : un geste, jamais un texte (pas de message, pas d'échange de contacts)
export const REACTIONS = [
  { id: "muscle", em: "💪", l: "Costaud" },
  { id: "feu", em: "🔥", l: "En feu" },
  { id: "bravo", em: "👏", l: "Bravo" },
  { id: "fusee", em: "🚀", l: "Ça décolle" },
  { id: "couronne", em: "👑", l: "Patron" },
];
export const REACTION_IDS = REACTIONS.map(r => r.id);
export const AVATARS = ["🦁", "🐺", "🦅", "🐻", "🐯", "🦊", "🐉", "🦍", "🐗", "🦬", "🐢", "🦈", "⚡", "🔥", "🌊", "⛰️"];
export const VISIBILITES = [["prive", "Moi seul"], ["amis", "Mes amis"], ["communaute", "Toute la communauté"]];

// ---------- Jeu : encouragements ----------
export const QUETE_JOUR = 3; // encourager 3 séances par jour entretient la flamme du supporter
export const NIVEAUX_SUPPORTER = [
  { min: 0, nom: "Nouveau venu", em: "🌱" },
  { min: 10, nom: "Allumeur", em: "🕯️" },
  { min: 50, nom: "Moteur", em: "⚙️" },
  { min: 150, nom: "Pilier", em: "🏛️" },
  { min: 400, nom: "Phare", em: "🗼" },
  { min: 1000, nom: "Légende du vestiaire", em: "👑" },
];
export function niveauSupporter(donnes) {
  const n = Math.max(0, donnes | 0);
  let i = 0; while (i + 1 < NIVEAUX_SUPPORTER.length && n >= NIVEAUX_SUPPORTER[i + 1].min) i++;
  const cur = NIVEAUX_SUPPORTER[i], next = NIVEAUX_SUPPORTER[i + 1] || null;
  return { ...cur, rang: i + 1, n, suivant: next, manque: next ? next.min - n : 0, pct: next ? (n - cur.min) / (next.min - cur.min) : 1 };
}
const jour = (d) => { const x = new Date(d + "T12:00:00"); return x; };
const iso = (x) => x.toISOString().slice(0, 10);
const veille = (d) => { const x = jour(d); x.setUTCDate(x.getUTCDate() - 1); return iso(x); };
// Série de jours où la quête (QUETE_JOUR encouragements) est remplie. parJour = { 'AAAA-MM-JJ': nombre }.
// Aujourd'hui pas encore rempli ne casse pas la série (on a jusqu'à minuit).
export function serieSupporter(parJour, auj) {
  const p = parJour || {}; let d = (p[auj] || 0) >= QUETE_JOUR ? auj : veille(auj), n = 0;
  while ((p[d] || 0) >= QUETE_JOUR) { n++; d = veille(d); }
  return { jours: n, aujourdhui: Math.min(QUETE_JOUR, p[auj] || 0), faite: (p[auj] || 0) >= QUETE_JOUR, enDanger: n > 0 && (p[auj] || 0) < QUETE_JOUR };
}
// Badges de régularité sociale (débloqués par l'activité, jamais par l'argent)
export function badgesSociaux({ donnes = 0, recus = 0, serie = 0, amis = 0, publies = 0 } = {}) {
  return [
    { id: "premier-pas", em: "👣", nom: "Premier pas", ok: publies >= 1, txt: "Partager ta première séance" },
    { id: "coeur", em: "💛", nom: "Grand cœur", ok: donnes >= 25, txt: "Encourager 25 séances" },
    { id: "aime", em: "🌟", nom: "Inspirant", ok: recus >= 50, txt: "Recevoir 50 encouragements" },
    { id: "flamme", em: "🔥", nom: "Flamme d'une semaine", ok: serie >= 7, txt: "7 jours de suite à encourager 3 séances" },
    { id: "bande", em: "🫂", nom: "La bande", ok: amis >= 3, txt: "Avoir 3 amis dans l'app" },
    { id: "metronome", em: "⏱️", nom: "Métronome", ok: publies >= 12, txt: "Partager 12 séances" },
  ];
}

// ---------- Parrainage ----------
// Progression : n = filleuls passés Bâtisseur. Renvoie les paliers atteints et le prochain.
export function progressionParrainage(nPremium = 0, nInscrits = 0) {
  const n = Math.max(0, nPremium | 0);
  const atteints = PALIERS.filter(p => n >= p.n), prochain = PALIERS.find(p => n < p.n) || null;
  const bonus = n >= 3 ? 1 : 0; // mois bonus de l'Ambassadeur
  const mois = Math.min(PARRAINAGE.plafondAnnuel, n * PARRAINAGE.moisParFilleul + bonus);
  return { n, inscrits: Math.max(n, nInscrits | 0), atteints, prochain, manque: prochain ? prochain.n - n : 0, mois, badge: atteints.at(-1) || null };
}
// Essai : la personne invitée gagne quelques jours (si un code d'invitation a été reçu)
export const joursEssai = (base, invite) => base + (invite?.code ? PARRAINAGE.bonusFilleulJours : 0);
// Code d'invitation : 6 caractères, sans lettres ambiguës (0/O, 1/I/L)
export const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const codeValide = (c) => typeof c === "string" && new RegExp(`^[${ALPHABET_CODE}]{6}$`).test(c);
export const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

// ---------- Filtre anti-contacts ----------
// La communauté ne sert pas à échanger des contacts : les titres et pseudos perdent liens, e-mails, @comptes et numéros.
const RX_CONTACT = [
  /\b(?:https?:\/\/|www\.)\S+/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,
  /(?:^|\s)@[\w.]{2,}/g,
  /(?:\+?\d[\s.-]?){8,}/g,
  /\b[\w-]+\.(?:com|fr|net|org|io|me|co|be|ch|link|bio|ly|gg|tv)\b\S*/gi,
  /\b(?:insta(?:gram)?|snap(?:chat)?|tiktok|whats ?app|telegram|facebook|fb|discord|onlyfans|wa\.me|t\.me)\b\s*:?\s*\S*/gi,
];
export function sansContact(s, max = 60) {
  let t = String(s ?? "").normalize("NFC");
  for (const rx of RX_CONTACT) t = t.replace(rx, " ");
  return t.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
}
export const contientContact = (s) => sansContact(s, 1e4) !== String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
// Pseudo : 2 à 20 caractères, lettres (accents compris), chiffres, espace, tiret, point, souligné ; pas de contact
export function pseudoErreur(p) {
  const s = String(p ?? "").trim();
  if (s.length < 2) return "Au moins 2 caractères.";
  if (s.length > 20) return "20 caractères au plus.";
  if (!/^[\p{L}\p{N} ._-]+$/u.test(s)) return "Lettres, chiffres, espace, tiret ou point seulement.";
  if (/\d{5,}/.test(s.replace(/[ ._-]/g, ""))) return "Pas de numéro dans le pseudo.";
  if (contientContact(s)) return "Pas de lien ni de réseau social dans le pseudo.";
  return null;
}
// Prénom affiché par défaut : prénom + initiale (« Thomas B. ») ; jamais l'e-mail
export function pseudoParDefaut(nom) {
  const m = String(nom || "").trim().split(/\s+/).filter(Boolean);
  if (!m.length) return "";
  const p = sansContact(m[0], 14).replace(/[^\p{L}\p{N}-]/gu, "");
  return p ? (m[1] ? `${p} ${m[1][0].toUpperCase()}.` : p) : "";
}

// ---------- Ce qui part dans la communauté ----------
// Grades de séance (js/fx.js) : le seul « niveau » publié, calculé depuis le tonnage
export const GRADES_NOMS = ["Fer", "Bronze", "Argent", "Or", "Platine", "Diamant", "Légende"];
// Récap public d'une séance : pas de poids de corps, pas de santé, pas de notes, pas de charges série par série.
export function recapSeance(w, { medaille = null } = {}) {
  if (!w) return null;
  const ex = (w.exercises || []).filter(e => (e.sets || []).some(s => s.done && s.type !== "W"));
  const min = w.start && w.end ? Math.max(1, Math.round((new Date(w.end) - new Date(w.start)) / 6e4)) : null;
  const recs = [...(w.records || []).map(r => r.name), ...ex.flatMap(e => (e.recsHit || []).length ? [e.name] : [])];
  return {
    titre: sansContact(w.title || "Séance", 48) || "Séance",
    min: min && min < 600 ? min : null,
    series: w.setsDone ?? ex.reduce((a, e) => a + e.sets.filter(s => s.done && s.type !== "W").length, 0),
    exos: ex.length,
    tonnes: w.volume ? Math.round(w.volume / 100) / 10 : 0,
    records: [...new Set(recs)].slice(0, 3).map(n => sansContact(n, 40)).filter(Boolean),
    top: ex.slice(0, 4).map(e => sansContact(e.name, 40)).filter(Boolean),
    medaille: GRADES_NOMS.includes(medaille) ? medaille : null,
    d: (w.end || w.start || "").slice(0, 10) || null,
  };
}
// Programme montré à quelqu'un : un programme du catalogue voyage par son identifiant, un programme personnel en entier (sans notes)
export function programmePublic(p, { catalogue = false, schema = null } = {}) {
  if (!p) return null;
  if (catalogue) return { id: String(p.id).slice(0, 60), n: sansContact(p.name, 70) };
  return {
    n: sansContact(p.name || p.n || "Mon programme", 70) || "Mon programme",
    split: sansContact(p.split || "", 30) || null, lvl: sansContact(p.lvl || "", 20) || null,
    sem: nb(p.weeks ?? p.sem, 52),
    s: (p.s || []).slice(0, 7).map(([nom, jourS, exs]) => [sansContact(nom, 40) || "Séance", JOURS.includes(jourS) ? jourS : null,
      (exs || []).slice(0, 14).map(e => { const r = Array.isArray(e) ? e : [e?.name, e?.kind];
        const sch = schema ? sansContact(schema(r), 24) : sansContact(r[2] && /^\d/.test(r[2]) ? r[2] : "", 24);
        return [sansContact(r[0], 50), /^[A-Z]$/.test(r[1] || "") ? r[1] : "P", ...(sch ? [sch] : [])]; }).filter(e => e[0])]),
  };
}
export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
// Programme reçu → programme personnel prêt à suivre (nouvel identifiant, marqué comme reçu)
export function programmeImportable(pub, { id, de = "" } = {}) {
  if (!pub?.s?.length) return null;
  const s = pub.s.filter(x => x?.[2]?.length).map(([n, j, exs]) => [n, j, exs.map(([e, k]) => [e, k || "P"])]);
  if (!s.length) return null;
  // Jours : ceux du programme reçu, sinon répartis (lundi, mercredi, vendredi, mardi, jeudi, samedi, dimanche)
  const libres = [0, 2, 4, 1, 3, 5, 6].filter(i => !s.some(x => x[1] === JOURS[i]));
  s.forEach(x => { if (!JOURS.includes(x[1])) x[1] = JOURS[libres.shift() ?? 6]; });
  const days = JOURS.map(j => s.some(x => x[1] === j));
  const qui = sansContact(de, 30);
  return { id, name: pub.n || "Programme reçu", custom: true, split: pub.split || "Personnalisé", lvl: pub.lvl || "Tous niveaux", weeks: pub.sem || 8, deload: { every: 4 }, days, s,
    prof: "", desc: qui ? `Programme partagé par ${qui}.` : "Programme reçu.", recu: { de: qui } };
}

// ---------- Liens ----------
// Encodage base64url d'un objet (UTF-8), pour faire voyager un récap dans le lien sans serveur
export function versB64(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function depuisB64(s) {
  try {
    const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(t + "===".slice((t.length + 3) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch { return null; }
}
// Lien d'invitation : base?r=CODE(&k=seance|programme&d=…|&prog=id)
export function lienPartage(base, { code = null, seance = null, programme = null, de = "" } = {}) {
  const u = new URL(base); u.hash = ""; u.search = "";
  if (codeValide(code)) u.searchParams.set("r", code);
  if (seance) { u.searchParams.set("k", "seance"); u.searchParams.set("d", versB64({ ...seance, de: sansContact(de, 30) })); }
  else if (programme?.id && !programme.s) { u.searchParams.set("k", "programme"); u.searchParams.set("prog", programme.id); if (de) u.searchParams.set("de", sansContact(de, 30)); }
  else if (programme) { u.searchParams.set("k", "programme"); u.searchParams.set("d", versB64({ ...programme, de: sansContact(de, 30) })); }
  return u.toString();
}
// Lecture d'un lien reçu (search = location.search). Tout est revérifié : un lien peut être fabriqué à la main.
export function lireLien(search) {
  const q = new URLSearchParams(search || ""), out = {};
  const code = normCode(q.get("r")); if (codeValide(code)) out.code = code;
  const k = q.get("k");
  if (k === "seance") {
    const d = depuisB64(q.get("d"));
    if (d && typeof d === "object") out.seance = nettoyerRecap(d);
  } else if (k === "programme") {
    const id = q.get("prog");
    if (id && /^[\w-]{1,60}$/.test(id)) out.programme = { id, n: null, de: sansContact(q.get("de"), 30) };
    else { const d = depuisB64(q.get("d")); const p = d && programmePublic(d); if (p?.s?.length) out.programme = { ...p, de: sansContact(d.de, 30) }; }
  }
  return Object.keys(out).length ? out : null;
}
const nb = (x, max) => { const n = Number(x); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null; };
function nettoyerRecap(d) {
  return { titre: sansContact(d.titre, 48) || "Séance", min: nb(d.min, 600), series: nb(d.series, 500) ?? 0, exos: nb(d.exos, 60) ?? 0, tonnes: nb(d.tonnes, 200) ?? 0,
    records: (Array.isArray(d.records) ? d.records : []).slice(0, 3).map(r => sansContact(r, 40)).filter(Boolean),
    top: (Array.isArray(d.top) ? d.top : []).slice(0, 4).map(r => sansContact(r, 40)).filter(Boolean),
    medaille: GRADES_NOMS.includes(d.medaille) ? d.medaille : null, d: /^\d{4}-\d{2}-\d{2}$/.test(d.d || "") ? d.d : null, de: sansContact(d.de, 30) };
}

// ---------- Textes ----------
export const texteInvitation = ({ prenom = "", code = null, lien = "", jours = 37 } = {}) =>
  `${prenom ? prenom + " t'invite" : "Je t'invite"} sur TB my Coach, l'app d'entraînement et de nutrition de Thomas Boulet. ${jours} jours offerts, sans carte bancaire${code ? ` (code ${code})` : ""} : ${lien}`;
export function texteSeance(r, lien) {
  const bits = [r.min ? `${r.min} min` : null, r.series ? `${r.series} séries` : null, r.tonnes ? `${String(r.tonnes).replace(".", ",")} t soulevées` : null].filter(Boolean).join(" · ");
  return `💪 Séance faite : ${r.titre}${bits ? ` (${bits})` : ""}${r.records?.length ? `. Record battu : ${r.records[0]} 🏆` : ""}. Viens t'entraîner avec moi sur TB my Coach : ${lien}`;
}
export const texteProgramme = (n, lien) => `📋 Voici mon programme d'entraînement « ${n} ». Tu peux le voir et le suivre gratuitement sur TB my Coach : ${lien}`;
// Résumé compact des réactions : [{ id, em, n }] triées, seulement celles reçues
export function resumeReactions(compte = {}) {
  return REACTIONS.map(r => ({ ...r, n: Math.max(0, compte?.[r.id] | 0) })).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
}
// Podium de la semaine entre amis (séances, puis encouragements donnés) : rang 1 à n, ex aequo partagés
export function podium(lignes = []) {
  const t = [...lignes].sort((a, b) => (b.seances - a.seances) || (b.donnes - a.donnes) || String(a.pseudo).localeCompare(String(b.pseudo), "fr"));
  let rang = 0, prev = null;
  return t.map((l, i) => { const k = `${l.seances}|${l.donnes}`; if (k !== prev) { rang = i + 1; prev = k; } return { ...l, rang }; });
}
