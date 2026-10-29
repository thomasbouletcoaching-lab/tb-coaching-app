// Dépense énergétique : MB (Mifflin-St Jeor), NEAT (pas + activité), EAT (séances, cardio), TEF (effet thermique), TDEE.
import { S, today } from "../state";

export const ACTIVITY_NEAT = { low: 0.15, light: 0.22, mid: 0.3, high: 0.5, vhigh: 0.65 }; // fraction du MB hors pas comptés
// [nom, MET (Compendium of Physical Activities), pas par minute pendant l'activité (pour ne pas les compter deux fois), catégorie]
export const CARDIO = [
  ["Marche normale", 3.5, 100, "Cardio"], ["Marche rapide", 4.3, 120, "Cardio"], ["Marche inclinée (tapis)", 6, 110, "Cardio"], ["Randonnée", 6, 100, "Cardio"],
  ["Course lente (8 km/h)", 8.3, 155, "Cardio"], ["Course (10 km/h)", 9.8, 165, "Cardio"], ["Course rapide (12 km/h)", 11.5, 175, "Cardio"], ["Fractionné (course)", 10, 165, "Cardio"],
  ["Vélo tranquille", 5.8, 0, "Cardio"], ["Vélo zone 2 / home-trainer", 6.8, 0, "Cardio"], ["Vélo soutenu", 8.5, 0, "Cardio"], ["Vélo elliptique", 5, 0, "Cardio"],
  ["Rameur modéré", 7, 0, "Cardio"], ["Rameur intense", 8.5, 0, "Cardio"], ["Stepper / escalier", 9, 0, "Cardio"], ["Corde à sauter", 11.8, 0, "Cardio"],
  ["HIIT / circuit training", 8, 40, "Cardio"], ["Natation tranquille", 6, 0, "Cardio"], ["Natation soutenue", 9.8, 0, "Cardio"],
  ["Football", 7, 85, "Sport"], ["Basket", 6.5, 80, "Sport"], ["Handball", 8, 80, "Sport"], ["Rugby", 8.3, 75, "Sport"], ["Volley", 4, 30, "Sport"],
  ["Tennis", 7.3, 60, "Sport"], ["Padel", 6, 55, "Sport"], ["Badminton", 5.5, 50, "Sport"], ["Tennis de table", 4, 20, "Sport"],
  ["Boxe (sac, pattes d'ours)", 7.8, 20, "Sport"], ["Boxe / MMA (sparring)", 9, 25, "Sport"], ["Judo / jiu-jitsu / lutte", 10.3, 0, "Sport"], ["Arts martiaux (kata, technique)", 5.3, 15, "Sport"],
  ["Escalade", 7.5, 0, "Sport"], ["Danse", 5.5, 60, "Sport"], ["Yoga", 2.8, 0, "Sport"], ["Pilates / mobilité", 3, 0, "Sport"],
  ["CrossFit / WOD", 8, 30, "Sport"], ["Calisthénie / street workout", 5, 0, "Sport"], ["Ski", 6.8, 0, "Sport"], ["Surf", 5, 0, "Sport"],
];
// Repères de l'onboarding : sport et cardio en plus de la musculation, en heures par semaine
export const EXTRA_SPORT = { 0: 0, 1.5: 1.5, 3.5: 3.5, 6: 6 };

export const day = (d = today()) => S().daily?.[d] || {};
// MB : Katch-McArdle quand la masse grasse est connue (plus précis chez les pratiquants), sinon Mifflin-St Jeor
export const lastFat = () => [...(S().measures || [])].reverse().find(m => m.fat > 3 && m.fat < 60)?.fat || null;
export function bmr(p = S().profile) {
  if (!p) return 1600;
  const w = day().weight || p.weight, bf = lastFat();
  if (bf) return 370 + 21.6 * w * (1 - bf / 100);
  return 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
}
export const bmrMethod = () => lastFat() ? `Katch-McArdle (masse grasse ${String(lastFat()).replace(".", ",")} %)` : "Mifflin-St Jeor";
// Effet thermique selon les macros : protéines ≈ 25 %, glucides ≈ 7,5 %, lipides ≈ 2 % de leurs calories
export const tefOf = (t) => Math.round((t.p || 0) * 4 * .25 + (t.c || 0) * 4 * .075 + (t.f || 0) * 9 * .02);
const weight = () => day().weight || S().profile?.weight || 75;
// kcal des pas : ~0,0005 kcal par pas et par kg (≈ 0,04 kcal/pas à 80 kg)
export const stepsKcal = (steps, w = weight()) => Math.round((steps || 0) * 0.0005 * w);
// Les MET comptent aussi le métabolisme de base : on retire 1 MET pour ne pas le compter deux fois avec le MB.
// Musculation : MET 5 (séance classique), donc 4 MET nets.
export const LIFT_MET = 5;
export const liftKcal = (min, w = weight()) => Math.round((LIFT_MET - 1) * w * (min / 60));
export const cardioKcal = (met, min, w = weight()) => Math.round(Math.max(0, met - 1) * w * (min / 60));
export const cardioSteps = (c) => Math.round((c.spm ?? (CARDIO.find(x => x[0] === c.n)?.[2] ?? 0)) * (c.min || 0));

export function breakdown(d = today()) {
  const p = S().profile, D = S().daily?.[d] || {};
  const B = Math.round(bmr(p));
  const totalSteps = D.steps ?? 0;
  const list = D.cardio || [];
  // Les pas faits pendant la course, la marche ou un sport sont déjà dans les kcal de l'activité : on les retire du NEAT
  const activitySteps = Math.min(totalSteps, list.reduce((a, c) => a + cardioSteps(c), 0));
  const steps = Math.max(0, totalSteps - activitySteps);
  const baseNeat = Math.round(B * (ACTIVITY_NEAT[p?.activity] ?? .3) * .5);
  const neat = baseNeat + stepsKcal(steps);
  const sessions = S().workouts.filter(w => w.end?.slice(0, 10) === d).map(w => ({ n: w.title, min: Math.max(10, Math.round((new Date(w.end) - new Date(w.start)) / 6e4)) }));
  const lifts = sessions.reduce((a, x) => a + liftKcal(x.min), 0);
  const cardio = list.reduce((a, c) => a + cardioKcal(c.met, c.min), 0);
  const eat = lifts + cardio;
  const log = S().food?.[d] || [];
  const intake = log.reduce((a, e) => a + e.kcal, 0);
  const tef = tefOf(log.reduce((a, e) => ({ p: a.p + (e.p || 0), c: a.c + (e.c || 0), f: a.f + (e.f || 0) }), { p: 0, c: 0, f: 0 }));
  return { bmr: B, neat, steps, totalSteps, activitySteps, sessions, list, eat, lifts, cardio, tef, intake, tdee: B + neat + eat + tef };
}
// Dépense « à cette heure » : MB et NEAT de base au prorata de l'heure + ce qui a été fait
export function burnedNow(d = today()) {
  const b = breakdown(d), now = new Date();
  const frac = d === today() ? (now.getHours() * 60 + now.getMinutes()) / 1440 : 1;
  const base = Math.round((b.bmr + (b.neat - stepsKcal(b.steps))) * frac);
  return { now: base + stepsKcal(b.steps) + b.eat + b.tef, total: b.tdee, frac, ...b };
}
// Jeûne : ce qui se passe dans le corps (repères moyens, variables d'une personne à l'autre)
export const FAST_STAGES = [
  [0, "🍽️", "Digestion", "Le corps utilise le repas : glycémie et insuline montent puis redescendent."],
  [4, "📉", "Fin de digestion", "L'insuline revient à son niveau de base. Le corps puise dans le glycogène du foie."],
  [12, "🔥", "Bascule vers les graisses", "Le glycogène du foie baisse : la part d'énergie venant des graisses augmente nettement."],
  [16, "⚡", "Début de cétose légère", "Le foie produit davantage de corps cétoniques. La faim se stabilise souvent par vagues."],
  [24, "🧠", "Cétose installée", "Les corps cétoniques deviennent un carburant important. À réserver aux personnes en bonne santé."],
  [48, "⚠️", "Jeûne prolongé", "Au-delà de 48 h, avis médical recommandé. Hydratation et électrolytes indispensables."],
];
export function fastState() {
  const f = S().fast; if (!f?.start) return null;
  const h = (Date.now() - new Date(f.start)) / 36e5;
  const stage = [...FAST_STAGES].reverse().find(s => h >= s[0]);
  const next = FAST_STAGES.find(s => s[0] > h);
  return { hours: h, stage, next, goal: f.goal || 16 };
}
