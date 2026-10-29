// Bibliothèque partagée par le coach : aliments, recettes, exercices, vidéos, programmes.
// Chargée depuis le serveur, gardée sur le téléphone pour marcher hors ligne.
import * as E from "./engine.js";
import * as N from "./nutrition.js";
import * as RC from "./recipes.js";
import { cloud } from "./core.js";
import { S } from "./store.js";

const KEY = "cxs.lib";
let rows = [];
try { rows = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { rows = []; }
export const libraryRows = () => rows;
// Ce que le coach a envoyé personnellement à ce membre : programme d'entraînement et plan alimentaire
export const fromCoach = () => { const me = S().me?.id; return me ? rows.filter(r => r.data?.for === me).sort((a, b) => b.id - a.id) : []; };
export function applyLibrary() {
  const me = S().me?.id, mine = (r) => !r.data?.for || r.data.for === me || S().me?.isCoach;
  const by = (k) => rows.filter(r => r.kind === k && mine(r));
  N.setCoachFoods(by("food").map(r => ({ n: r.name, ...r.data })));
  RC.setCoachRecipes(by("recipe").map(r => ({ ...r.data, id: "lib-" + r.id, n: r.name })));
  E.extra.programs = by("program").map(r => ({ ...r.data, id: "lib-" + r.id, name: r.name, lib: r.id, custom: r.data.custom ?? true }));
  E.extra.exercises = Object.fromEntries(by("exercise").map(r => [r.name, { fam: "", setup: "", cues: [], ...r.data }]));
  E.extra.videos = Object.fromEntries(by("video").map(r => [r.name, r.data.url]));
}
export async function refreshLibrary() {
  const c = await cloud(); if (!c) return;
  try { await c.currentSession() || await c.ensureSession(); rows = await c.libraryAll(); localStorage.setItem(KEY, JSON.stringify(rows)); applyLibrary(); } catch (e) { console.warn("Bibliothèque indisponible :", e.message); }
}
applyLibrary();
