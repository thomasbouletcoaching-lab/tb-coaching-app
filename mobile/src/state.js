// État local de l'app (même forme que CalXsthenos). Tout reste sur le téléphone, dans AsyncStorage.
// S() lit l'état courant, update(fn) le modifie puis le sauvegarde et prévient les écrans.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const KEY = "cxs.v1";

const blank = () => ({
  profile: null,      // réponses de l'onboarding
  plan: null,         // { programId, startedAt, week, idx, cycle }
  lifts: {},          // { [exercice]: [{ d, e1rm }] }
  workouts: [],       // séances terminées
  current: null,      // séance en cours
  food: {},           // { 'YYYY-MM-DD': [entrées] }
  measures: [],       // { d, weight, waist, hips, chest, arm, thigh }
  swaps: {},          // exercice d'origine -> remplaçant
  settings: { haptics: true },
  daily: {},          // { 'YYYY-MM-DD': { weight, steps, sleep, water } }
  customPrograms: [],
  moves: {}, skips: {},
});

let state = blank();
const listeners = new Set();

export const S = () => state;

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    state = Object.assign(blank(), JSON.parse(raw || "{}"));
  } catch {
    state = blank();
  }
  return state;
}

export function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  listeners.forEach(f => f());
}

export function update(fn) {
  fn(state);
  save();
}

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};

// Un écran qui se redessine quand l'état change
export function useS() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick(n => n + 1);
    listeners.add(f);
    return () => listeners.delete(f);
  }, []);
  return state;
}
