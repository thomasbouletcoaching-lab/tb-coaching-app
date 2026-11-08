// Moteur « Objectif » de l'espace coach : où en est le CA face à l'objectif mensuel, face aux seuils
// de TVA et de la micro-entreprise, et ce qu'il faut remplir (places de cycle, abonnés, appels) pour combler l'écart.
// Module pur : aucun accès à l'écran, au réseau ni au stockage (testé dans Node : tests/objectif.test.mjs).
// Aucune donnée inventée : il ne calcule qu'à partir des encaissements, cycles, abonnés et demandes du coach.

// Seuils légaux 2026 (prestations de services). À revoir chaque année.
// - Franchise de TVA : 37 500 € ; seuil majoré 41 250 € (au-delà, TVA due dès le dépassement).
//   Sources : https://www.maxcompta.com/blogs/actualites/seuils-tva-franchise-base-2026-independants
//             https://hayot-expertise.fr/blog/reforme-franchise-tva-2026-seuil-25000-euros (réforme à 25 000 € abandonnée)
// - Plafond micro-entreprise : 83 600 € pour 2026-2028 (sortie du régime après 2 années consécutives de dépassement).
//   Sources : https://www.economie.gouv.fr/node/34776 · https://propulsebyca.fr/micro-entrepreneur/plafond
export const SEUILS = Object.freeze({
  annee: 2026,
  liste: Object.freeze([
    Object.freeze({ id: "tva", label: "Franchise de TVA", montant: 37500, effet: "Au-delà, TVA à facturer à partir du 1er janvier suivant." }),
    Object.freeze({ id: "tva-maj", label: "Seuil majoré de TVA", montant: 41250, effet: "Au-delà, TVA due dès le jour du dépassement." }),
    Object.freeze({ id: "micro", label: "Plafond micro-entreprise", montant: 83600, effet: "Dépassé deux années de suite : changement de régime." }),
  ]),
});

// Réglages par défaut : l'objectif de Thomas, sa capacité de suivi et le prix mensuel du cycle (CGV : 3 × 540 €).
export const DEFAUTS = Object.freeze({ objectifMois: 10000, places: 10, prixCycleMois: 540, signature: null });

// Statuts des demandes du site (table « leads »), dans l'ordre du parcours
export const STATUTS = ["nouveau", "contacté", "appel prévu", "client", "pas pour moi"];

const round2 = (x) => Math.round((x || 0) * 100) / 100;
const ym = (d) => String(d || "").slice(0, 7);
const montant = (p) => +p.amount || 0;

// Somme encaissée (paiements marqués « encaissé ») dont la date commence par `prefixe` (« 2026 » ou « 2026-11 »)
export function encaisse(payments, prefixe) {
  return round2((payments || []).filter((p) => p.paid && String(p.d || "").startsWith(prefixe)).reduce((a, p) => a + montant(p), 0));
}

// Le mois en cours : encaissé, encore attendu ce mois-ci, et retards (tous mois confondus)
export function etatMois(payments, today) {
  const m = ym(today), P = payments || [];
  const aVenir = P.filter((p) => !p.paid && ym(p.d) === m && p.d >= today);
  const retard = P.filter((p) => !p.paid && p.d < today);
  return {
    encaisse: encaisse(P, m),
    aVenir: round2(aVenir.reduce((a, p) => a + montant(p), 0)), nAVenir: aVenir.length,
    retard: round2(retard.reduce((a, p) => a + montant(p), 0)), nRetard: retard.length,
  };
}

// Mois précédents au format AAAA-MM (le mois en cours exclu), du plus récent au plus ancien
export function moisPrecedents(today, n) {
  const [y, mo] = today.split("-").map(Number), out = [];
  for (let i = 1; i <= n; i++) { const d = new Date(Date.UTC(y, mo - 1 - i, 1)); out.push(d.toISOString().slice(0, 7)); }
  return out;
}

// Rythme mensuel : moyenne des `n` derniers mois complets qui ont au moins un encaissement.
// S'il n'y en a aucun, on prend le mois en cours (même incomplet). Renvoie aussi la base du calcul.
export function rythme(payments, today, n = 3) {
  const mois = moisPrecedents(today, n).map((m) => encaisse(payments, m)).filter((v) => v > 0);
  if (mois.length) return { parMois: round2(mois.reduce((a, b) => a + b, 0) / mois.length), base: `${mois.length} dernier${mois.length > 1 ? "s" : ""} mois complet${mois.length > 1 ? "s" : ""}` };
  const cur = encaisse(payments, ym(today));
  return { parMois: cur, base: cur ? "mois en cours" : "aucun encaissement" };
}

// Cumul de l'année civile face aux seuils, avec le mois de franchissement prévu au rythme actuel
export function seuilsAnnee(payments, today, liste = SEUILS.liste) {
  const annee = today.slice(0, 4), cumul = encaisse(payments, annee), r = rythme(payments, today);
  const [y, mo, d] = today.split("-").map(Number), jours = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const resteMois = 12 - mo + (1 - d / jours); // fraction de l'année restante, en mois
  const seuils = liste.map((s) => {
    const pct = s.montant ? Math.round(cumul / s.montant * 1000) / 10 : 0;
    if (cumul >= s.montant) return { ...s, pct, statut: "depasse", prevu: null };
    let prevu = null;
    if (r.parMois > 0) {
      const mois = (s.montant - cumul) / r.parMois;
      if (mois <= resteMois) { const t = new Date(Date.UTC(y, mo - 1, d)); t.setUTCDate(t.getUTCDate() + Math.ceil(mois * 30.44)); prevu = t.toISOString().slice(0, 7); }
    }
    return { ...s, pct, statut: prevu ? "proche" : pct >= 80 ? "proche" : "ok", prevu };
  });
  return { annee, cumul, rythme: r, seuils, projectionAnnee: round2(cumul + r.parMois * resteMois) };
}

// Fin d'un cycle (dernier jour), à partir de son début et de sa durée en semaines
export function finCycle(c) {
  const t = new Date(c.start + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + (Math.max(1, +c.weeks || 12) * 7) - 1);
  return t.toISOString().slice(0, 10);
}
export const cyclesActifs = (cycles, today) => (cycles || []).filter((c) => c.start && c.start <= today && finCycle(c) >= today);

// Ce que rapportent par mois les cycles en cours (prix mensuel, ou prix total ramené au mois)
export function revenuCycles(cycles, today) {
  const actifs = cyclesActifs(cycles, today);
  const parMois = actifs.reduce((a, c) => a + (c.split === "mois" ? (+c.price || 0) : (+c.price || 0) / Math.max(1, (+c.weeks || 12) / 4.33)), 0);
  return { n: actifs.length, parMois: round2(parMois) };
}

// Ce qu'il faut pour atteindre l'objectif du mois.
// recurrent = cycles en cours + abonnements de l'app (estimation). Les places libres sont valorisées au prix mensuel du cycle ;
// s'il manque encore, on traduit l'écart en nombre d'abonnés à une formule (prix mensuel donné).
export function plan({ objectif = DEFAUTS.objectifMois, cycles = { n: 0, parMois: 0 }, app = 0, places = DEFAUTS.places, prixCycleMois = DEFAUTS.prixCycleMois, formules = [] } = {}) {
  const recurrent = round2(cycles.parMois + app);
  const manque = round2(Math.max(0, objectif - recurrent));
  const placesLibres = Math.max(0, places - cycles.n);
  const placesUtiles = prixCycleMois > 0 ? Math.min(placesLibres, Math.ceil(manque / prixCycleMois)) : 0;
  const apportPlaces = round2(placesUtiles * prixCycleMois);
  const reste = round2(Math.max(0, manque - apportPlaces));
  const capaciteMax = round2(places * prixCycleMois + app);
  return {
    objectif, recurrent, manque, pct: objectif ? Math.min(100, Math.round(recurrent / objectif * 100)) : 0,
    placesLibres, placesUtiles, apportPlaces, reste,
    // Plafond atteignable avec toutes les places de cycle pleines (et les abonnements actuels)
    capaciteMax, capaciteSuffit: capaciteMax >= objectif,
    complements: formules.filter((f) => f.prix > 0).map((f) => ({ ...f, n: Math.ceil(reste / f.prix) })),
  };
}

// Nouveaux clients et appels nécessaires chaque mois pour garder les places pleines.
// renouvellement : part des clients qui enchaînent un nouveau cycle (0 à 1) ; signature : part des appels qui signent (0 à 1).
export function besoinAcquisition({ places = DEFAUTS.places, dureeMois = 3, renouvellement = 0, signature = null } = {}) {
  const nouveaux = Math.round(places * (1 - Math.min(1, Math.max(0, renouvellement))) / Math.max(1, dureeMois) * 10) / 10;
  return { nouveaux, appels: signature > 0 ? Math.ceil(nouveaux / signature) : null };
}

// Source d'une demande du site : paramètre ?src= (ex. reel-1rm), sinon utm_source, sinon le site d'origine
export function sourceDe(lead) {
  const d = (lead && lead.data) || {};
  return String(d.src || d.utm_source || d.ref || d.origine || "inconnue").toLowerCase().slice(0, 40);
}

// Entonnoir des demandes du site sur les `jours` derniers jours : par statut et par source.
// Le taux de signature = clients ÷ demandes tranchées après l'appel (client + pas pour moi) ;
// `appels` compte aussi celles dont l'appel est seulement prévu.
export function entonnoir(leads, today, jours = 90) {
  const depuis = new Date(today + "T00:00:00Z"); depuis.setUTCDate(depuis.getUTCDate() - jours);
  const L = (leads || []).filter((l) => l.created_at && new Date(l.created_at) >= depuis);
  const parStatut = Object.fromEntries(STATUTS.map((s) => [s, 0]));
  const src = {};
  L.forEach((l) => {
    const st = STATUTS.includes(l.status) ? l.status : "nouveau"; parStatut[st]++;
    const k = sourceDe(l), x = src[k] = src[k] || { source: k, n: 0, clients: 0, candidatures: 0 };
    x.n++; if (st === "client") x.clients++; if ((l.data || {}).demande === "candidature") x.candidatures++;
  });
  const appels = parStatut["appel prévu"] + parStatut.client + parStatut["pas pour moi"];
  const decides = parStatut.client + parStatut["pas pour moi"];
  return {
    jours, total: L.length, parStatut,
    signature: decides ? Math.round(parStatut.client / decides * 100) / 100 : null,
    appels, sources: Object.values(src).sort((a, b) => b.clients - a.clients || b.n - a.n),
  };
}
