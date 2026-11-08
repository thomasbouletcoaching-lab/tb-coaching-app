// Transforme une demande du site (ligne de la table « leads ») en contact Brevo. Module pur, testé (tests/brevo-sync.test.mjs).
// Aucune clé ici : les numéros de listes et la clé d'API sont lus dans les secrets Supabase par index.ts.

export type Listes = { calculateur?: number; appel?: number; candidature?: number; autre?: number };

const txt = (v: unknown, max = 120) => (v === undefined || v === null ? "" : String(v)).trim().slice(0, max);
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// Lit les numéros de listes dans les variables d'environnement (BREVO_LIST_CALCULATEUR=12, …)
export function listesDepuis(env: (k: string) => string | undefined): Listes {
  const n = (k: string) => { const v = Number(env(k)); return Number.isInteger(v) && v > 0 ? v : undefined; };
  return { calculateur: n("BREVO_LIST_CALCULATEUR"), appel: n("BREVO_LIST_APPEL"), candidature: n("BREVO_LIST_CANDIDATURE"), autre: n("BREVO_LIST_AUTRE") };
}

// Renvoie le corps de la requête POST /v3/contacts, ou la raison pour laquelle on n'envoie rien.
export function versContact(lead: any, listes: Listes): { ok: true; body: any } | { ok: false; raison: string } {
  if (!lead || typeof lead !== "object") return { ok: false, raison: "demande vide" };
  const email = txt(lead.email, 200).toLowerCase();
  if (!emailOk(email)) return { ok: false, raison: "e-mail invalide" };
  if (lead.consent !== true) return { ok: false, raison: "pas d'accord pour être recontacté" };
  const d = (lead.data && typeof lead.data === "object") ? lead.data : {};
  const demande = txt(d.demande, 40) || "autre";
  const liste = (listes as any)[demande] ?? listes.autre;
  if (!liste) return { ok: false, raison: `aucune liste Brevo réglée pour « ${demande} »` };
  const prenom = txt(lead.name, 80).split(/\s+/)[0] || "";
  const attributes: Record<string, string> = {};
  if (prenom) attributes.FIRSTNAME = prenom;
  const extra: Record<string, unknown> = { SOURCE: d.src || d.utm_source || d.ref || d.origine, DEMANDE: demande, E1RM: d.e1rm, OBJECTIF: d.objectif, DELAI: d.delai };
  for (const [k, v] of Object.entries(extra)) { const s = txt(v); if (s) attributes[k] = s; }
  return { ok: true, body: { email, attributes, listIds: [liste], updateEnabled: true } };
}

// Version de secours si Brevo refuse des attributs pas encore créés dans le compte : on garde seulement le prénom.
export function sansAttributsPerso(body: any) {
  const a = body.attributes && body.attributes.FIRSTNAME ? { FIRSTNAME: body.attributes.FIRSTNAME } : {};
  return { ...body, attributes: a };
}

// Comparaison à temps constant du secret du webhook
export function memeSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
