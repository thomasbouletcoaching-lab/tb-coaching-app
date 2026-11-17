// Ce que la fonction serveur « hybride-xp » écrit pour un membre (décision C56 : l'XP est calculée par le serveur).
// Module pur, testé par `node --test tests/hybride-serveur.test.mjs`. Copié tel quel dans supabase/functions/hybride-xp/
// (tools/sync-fonction-hybride.sh ; un test vérifie que les copies sont identiques).
//
// Entrées : l'instantané envoyé par le téléphone (cxs_member_data.data), le bloc en cours (table cxs_hyb_bloc)
// et les objets déjà débloqués (cxs_hyb_personnage.debloques). Sortie : lignes à insérer, sans doublon possible
// (clés déterministes, « on conflict do nothing »), et objets débloqués (union : jamais rien de retiré).
import { journalDepuisEtat, evenements, reussites, bilan } from "./hybride-quetes.js";

export const VERSION = 1;
export const MAX_EVENEMENTS = 2000;

// Date du jour à Paris (AAAA-MM-JJ)
export const aujourdhuiParis = (now = new Date()) => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export function blocDepuisLigne(l) {
  if (!l || !["M1", "M2", "M3", "M4"].includes(l.macro_id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.debut)) || !(l.nb_seances >= 3 && l.nb_seances <= 6)) return null;
  return { macroId: l.macro_id, debut: String(l.debut), nbSeances: +l.nb_seances };
}

export function aEcrire(D, { data = {}, blocLigne = null, debloquesAvant = [] } = {}, exDe = () => null, auj = aujourdhuiParis()) {
  // Le bloc vient de la table (source de vérité côté serveur), pas de l'instantané
  const etat = { workouts: Array.isArray(data.workouts) ? data.workouts : [], daily: data.daily && typeof data.daily === "object" ? data.daily : {}, hybride: { ...(data.hybride || {}), bloc: blocDepuisLigne(blocLigne) } };
  const J = journalDepuisEtat(D, etat, exDe);
  const ev = evenements(D, J, auj).slice(-MAX_EVENEMENTS);
  const xp = ev.map(e => ({ cle: String(e.cle).slice(0, 200), source: e.source, xp: Math.max(0, Math.min(500, Math.round(e.xp))), cree_le: e.d + "T12:00:00Z" }));
  const quetes = reussites(D, J, auj).map(r => ({ quete_id: r.id, periode: String(r.periode).slice(0, 100), progres: r.palier ? { palier: r.palier } : {}, reussie_le: r.d + "T12:00:00Z" }));
  const b = bilan(D, J, auj, { precedents: Array.isArray(debloquesAvant) ? debloquesAvant : [] });
  return { xp, quetes, debloques: b.debloques, resume: { xp: b.xp, rang: b.rang, serie: b.serie } };
}
