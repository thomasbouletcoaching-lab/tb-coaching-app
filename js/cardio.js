// Cardio et multisport structurés : sports, zones d'allure, modèles de séances (endurance fondamentale, seuil, fractionné…),
// planning avec récurrence, progression semaine après semaine (coach), déroulé pas à pas et dépense par MET.
// Pur (sans DOM ni état) : testé par tests/cardio.test.mjs.
import { treadmillMet } from "./activite-calc.js";

// [clé, nom, MET « modéré », famille]. course et marche : MET calculé selon l'allure ; les autres : MET × facteur de la zone.
export const SPORTS = [
  ["course", "Course à pied", 9.8, "course"], ["trail", "Trail", 10, "course"], ["marche", "Marche / marche rapide", 4.3, "marche"], ["tapis", "Marche inclinée (tapis)", 6, "marche"],
  ["velo", "Vélo / home-trainer", 6.8, "velo"], ["rameur", "Rameur", 7, "rameur"], ["natation", "Natation", 8, "natation"], ["elliptique", "Vélo elliptique", 5, "autre"],
  ["hyrox", "Hyrox (course + stations)", 9, "hyrox"], ["corde", "Corde à sauter", 11.8, "autre"], ["ski", "Ski de fond / ski-erg", 9, "autre"], ["autre", "Autre sport", 7, "autre"],
];
export const sport = (k) => SPORTS.find(s => s[0] === k) || SPORTS.at(-1);
// Zones : % de VMA (course), % de FC max, facteur de MET pour les autres sports, description pour se repérer sans montre
export const ZONES = {
  facile: { n: "Facile", vma: [0.6, 0.65], fc: [0.6, 0.68], f: 0.75, rpe: "2–3/10 · on parle sans effort", c: "#7CC4A5" },
  ef: { n: "Endurance fondamentale", vma: [0.65, 0.75], fc: [0.68, 0.76], f: 0.9, rpe: "3–4/10 · on peut tenir une conversation", c: "#4FA3D9" },
  tempo: { n: "Tempo", vma: [0.75, 0.83], fc: [0.76, 0.84], f: 1.05, rpe: "5–6/10 · phrases courtes", c: "#E8B33C" },
  seuil: { n: "Seuil", vma: [0.83, 0.88], fc: [0.84, 0.9], f: 1.2, rpe: "7/10 · quelques mots seulement", c: "#F08A3C" },
  vma: { n: "VMA", vma: [0.95, 1.05], fc: [0.9, 0.97], f: 1.4, rpe: "9/10 · impossible de parler", c: "#E5484D" },
  sprint: { n: "Sprint", vma: [1.05, 1.2], fc: [0.95, 1], f: 1.5, rpe: "10/10 · à fond", c: "#B0216F" },
  libre: { n: "Libre", vma: null, fc: null, f: 1, rpe: "à la sensation", c: "#8A94A6" },
};
export const BLOC_T = { chauffe: "Échauffement", effort: "Effort", recup: "Récupération", calme: "Retour au calme", station: "Station" };

// Allure (min/km) à partir d'une vitesse (km/h) : "5:24"
export const allure = (kmh) => { if (!(kmh > 0)) return ""; const s = Math.round(3600 / kmh); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
// Fourchette d'allure d'une zone pour une VMA donnée : "5:43–6:36 /km"
export function allureZone(z, vma) { const Z = ZONES[z]; if (!Z?.vma || !(vma > 0)) return ""; return `${allure(vma * Z.vma[1])}–${allure(vma * Z.vma[0])} /km`; }
export function fcZone(z, fcmax) { const Z = ZONES[z]; if (!Z?.fc || !(fcmax > 0)) return ""; return `${Math.round(fcmax * Z.fc[0])}–${Math.round(fcmax * Z.fc[1])} bpm`; }
export const vitesseZone = (z, vma) => ZONES[z]?.vma && vma > 0 ? vma * (ZONES[z].vma[0] + ZONES[z].vma[1]) / 2 : null;

// Modèles. Un bloc : { t, z, min | km, sta? } ; une répétition : { rep, items: [blocs] }
const B = (t, z, x) => ({ t, z, ...x });
export const MODELES = [
  { id: "ef", n: "Endurance fondamentale", ic: "🫁", sport: "course", blocs: [B("chauffe", "facile", { min: 10 }), B("effort", "ef", { min: 30 }), B("calme", "facile", { min: 5 })], d: "La base : le cœur et le souffle progressent sans fatigue. 80 % de tes sorties." },
  { id: "longue", n: "Sortie longue", ic: "🛣️", sport: "course", blocs: [B("chauffe", "facile", { min: 10 }), B("effort", "ef", { min: 60 }), B("calme", "facile", { min: 5 })], d: "Une fois par semaine, en endurance : l'endurance de fond." },
  { id: "recup", n: "Footing de récupération", ic: "🌿", sport: "course", blocs: [B("effort", "facile", { min: 25 })], d: "Très lent, le lendemain d'une séance dure." },
  { id: "seuil", n: "Seuil 3 × 10 min", ic: "📈", sport: "course", blocs: [B("chauffe", "ef", { min: 15 }), { rep: 3, items: [B("effort", "seuil", { min: 10 }), B("recup", "facile", { min: 2 })] }, B("calme", "facile", { min: 10 })], d: "Repousse le moment où ça brûle : on tient l'allure plus longtemps." },
  { id: "tempo", n: "Tempo 20 min", ic: "🎵", sport: "course", blocs: [B("chauffe", "ef", { min: 15 }), B("effort", "tempo", { min: 20 }), B("calme", "facile", { min: 10 })], d: "Allure soutenue mais contrôlée, idéale avant un 10 km." },
  { id: "30-30", n: "Fractionné 30/30", ic: "⚡", sport: "course", blocs: [B("chauffe", "ef", { min: 15 }), { rep: 10, items: [B("effort", "vma", { min: 0.5 }), B("recup", "facile", { min: 0.5 })] }, B("calme", "facile", { min: 10 })], d: "Le classique pour développer la VMA." },
  { id: "1000", n: "Fractionné 5 × 1000 m", ic: "🔥", sport: "course", blocs: [B("chauffe", "ef", { min: 15 }), { rep: 5, items: [B("effort", "vma", { km: 1 }), B("recup", "facile", { min: 2 })] }, B("calme", "facile", { min: 10 })], d: "Fractionné long, proche de la VMA." },
  { id: "fartlek", n: "Fartlek", ic: "🎲", sport: "course", blocs: [B("chauffe", "ef", { min: 10 }), { rep: 6, items: [B("effort", "tempo", { min: 2 }), B("recup", "ef", { min: 2 })] }, B("calme", "facile", { min: 5 })], d: "Jeu d'allures, plus libre que le fractionné." },
  { id: "velo-z2", n: "Vélo zone 2", ic: "🚴", sport: "velo", blocs: [B("chauffe", "facile", { min: 10 }), B("effort", "ef", { min: 45 }), B("calme", "facile", { min: 5 })], d: "Endurance sans impact pour les articulations." },
  { id: "rameur-int", n: "Rameur 8 × 500 m", ic: "🚣", sport: "rameur", blocs: [B("chauffe", "facile", { min: 8 }), { rep: 8, items: [B("effort", "seuil", { km: 0.5 }), B("recup", "facile", { min: 1.5 })] }, B("calme", "facile", { min: 5 })], d: "Puissance et cardio sur tout le corps." },
  { id: "tapis-incl", n: "Marche inclinée", ic: "⛰️", sport: "tapis", blocs: [B("chauffe", "facile", { min: 5 }), B("effort", "ef", { min: 30 }), B("calme", "facile", { min: 5 })], d: "Grosse dépense, peu de fatigue : pente 10–12 %, 5 km/h." },
  { id: "hyrox", n: "Simulation Hyrox", ic: "🏟️", sport: "hyrox", blocs: [B("chauffe", "ef", { min: 10 }), { rep: 4, items: [B("effort", "tempo", { km: 1 }), B("station", "seuil", { min: 4, sta: "Station (ski-erg, sled, burpees, rameur…)" })] }, B("calme", "facile", { min: 5 })], d: "1 km de course puis une station, 4 fois (la course complète en compte 8)." },
  { id: "libre", n: "Séance libre", ic: "🤸", sport: "autre", blocs: [B("effort", "libre", { min: 45 })], d: "N'importe quel sport : on lance le chrono et on note au fur et à mesure." },
];
export const modele = (id) => MODELES.find(m => m.id === id);

// Progression : à la semaine k (0 = première), +effortMin minutes par bloc d'effort et +reps répétitions toutes les « every » semaines
export function progresser(item, k = 0) {
  const p = item.prog; if (!p || !(k > 0)) return item.blocs;
  const n = Math.floor(k / Math.max(1, p.every || 1));
  const bump = (b) => b.t === "effort" && b.min != null && p.effortMin ? { ...b, min: Math.round((b.min + n * p.effortMin) * 10) / 10 } : b.t === "effort" && b.km != null && p.effortKm ? { ...b, km: Math.round((b.km + n * p.effortKm) * 100) / 100 } : b;
  return item.blocs.map(b => b.rep ? { ...b, rep: Math.min(30, b.rep + n * (p.reps || 0)), items: b.items.map(bump) } : bump(b));
}
// Déroulé à plat (répétitions dépliées), avec la durée estimée de chaque étape
export function deroule(blocs, { vma = 0, sport: sk = "course" } = {}) {
  const out = [];
  blocs.forEach(b => { if (b.rep) for (let r = 1; r <= b.rep; r++) b.items.forEach(x => out.push({ ...x, r, rep: b.rep })); else out.push({ ...b }); });
  return out.map(x => ({ ...x, dureeMin: x.min != null ? x.min : x.km != null ? x.km / (vitesseZone(x.z, vma) || defVitesse(sk, x.z)) * 60 : 0 }));
}
const defVitesse = (sk, z) => (sport(sk)[3] === "course" ? 12 : sport(sk)[3] === "marche" ? 5.5 : sport(sk)[3] === "velo" ? 25 : sport(sk)[3] === "rameur" ? 14 : 10) * (ZONES[z]?.f || 1);
export const dureeTotale = (blocs, o) => Math.round(deroule(blocs, o).reduce((a, x) => a + x.dureeMin, 0));
export const resumeBlocs = (blocs) => blocs.map(b => b.rep ? `${b.rep} × (${b.items.map(x => qte(x) + " " + (ZONES[x.z]?.n || "").toLowerCase()).join(" / ")})` : `${qte(b)} ${(ZONES[b.z]?.n || "").toLowerCase()}`).join(" + ");
export const qte = (b) => b.km != null ? (b.km < 1 ? `${Math.round(b.km * 1000)} m` : `${String(b.km).replace(".", ",")} km`) : b.min < 1 ? `${Math.round(b.min * 60)} s` : `${String(b.min).replace(".", ",")} min`;

// MET d'une étape : selon la vitesse pour la course et la marche, sinon MET du sport × facteur de la zone
export function metEtape(x, { vma = 0, sport: sk = "course", kmh = null } = {}) {
  const s = sport(sk);
  if (s[3] === "course" || s[3] === "marche") { const v = kmh || vitesseZone(x.z, vma); if (v > 0) return treadmillMet(v, sk === "tapis" ? (x.pente || 10) : 0); }
  return Math.round(s[2] * (ZONES[x.z]?.f || 1) * 10) / 10;
}
// Dépense nette (au-delà du repos) d'une séance faite : étapes réellement faites, poids en kg
export function kcalSeance(etapes, poids, o) { return Math.round(etapes.reduce((a, x) => a + Math.max(0, metEtape(x, o) - 1) * poids * (x.faitMin ?? x.dureeMin) / 60, 0)); }
export const metMoyen = (etapes, o) => { const t = etapes.reduce((a, x) => a + (x.faitMin ?? x.dureeMin), 0); return t ? Math.round(etapes.reduce((a, x) => a + metEtape(x, o) * (x.faitMin ?? x.dureeMin), 0) / t * 10) / 10 : 0; };

// Planning : occurrences entre deux dates (incluses). item.quand = { date } (une fois) ou { jours: [0..6 lundi=0], from, until?, every: 1|2 }
const k2d = (k) => new Date(k + "T12:00:00"), d2k = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addK = (k, n) => { const d = k2d(k); d.setDate(d.getDate() + n); return d2k(d); };
const dowK = (k) => (k2d(k).getDay() + 6) % 7;
export const semaineDe = (item, k) => { const f = item.quand?.from || item.quand?.date || k; const mon = (x) => addK(x, -dowK(x)); return Math.max(0, Math.round((k2d(mon(k)) - k2d(mon(f))) / (7 * 864e5))); };
export function occurrences(items, from, to) {
  const out = [];
  for (const it of items || []) {
    const q = it.quand || {};
    if (q.date) { if (q.date >= from && q.date <= to) out.push({ d: q.date, it, k: 0 }); continue; }
    if (!Array.isArray(q.jours) || !q.jours.length) continue;
    for (let k = from > (q.from || from) ? from : q.from || from; k <= to; k = addK(k, 1)) {
      if (q.until && k > q.until) break; if (q.from && k < q.from) continue;
      const wk = semaineDe(it, k); if ((q.every || 1) > 1 && wk % q.every) continue;
      if (it.prog?.weeks && wk >= it.prog.weeks) continue;
      if (q.jours.includes(dowK(k))) out.push({ d: k, it, k: wk });
    }
  }
  return out.sort((a, b) => a.d.localeCompare(b.d) || (a.it.heure || "").localeCompare(b.it.heure || ""));
}
export const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const libQuand = (q = {}) => q.date ? "Une fois" : (q.every === 2 ? "Une semaine sur deux · " : "Chaque semaine · ") + (q.jours || []).map(j => JOURS[j]).join(", ");
