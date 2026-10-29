// Carburant : cibles, base Ciqual, plats types, plan alimentaire, journal.
import { S, update, today } from "./store.js";

let CQ = null, MODELS = null, MIC = null, OFFDB = null;
export async function loadModels() { if (!MODELS) MODELS = await (await fetch("data/nutrition-models.json")).json(); return MODELS; }
export async function loadCiqual() {
  if (!CQ) { const j = await (await fetch("data/ciqual.json")).json(); const idx = Object.fromEntries(j.foods.map((f, i) => [f[0], i]));
    const base = BASICS.map(([n, src]) => idx[src] != null ? [n, j.foods[idx[src]][1], ...j.foods[idx[src]].slice(2, 7), true, idx[src]] : null).filter(Boolean);
    const vt = (f) => { const m = /valeurs Ciqual « (.*) »/.exec(f[0]); return m && idx[m[1]] != null ? idx[m[1]] : null; };
    CQ = [...base, ...j.foods.map((f, i) => [...f.slice(0, 7), false, vt(f) ?? i]), ...EXTRA, ...EXTRA_COACH].map(f => ({ n: f[0], cat: f[1], kcal: f[2], p: f[3], c: f[4], f: f[5], fib: f[6] ?? null, k: norm(f[0]), a: f[0].toLowerCase(), base: f[7] === true, ix: f[8] ?? null }));
    CQI = Object.fromEntries(CQ.map(f => [f.n, f])); loadMicro(); }
  return CQ;
}
let CQI = {};
// Micronutriments Ciqual (pour 100 g), chargés à part
export async function loadMicro() { if (!MIC) { try { MIC = await (await fetch("data/ciqual-micro.json")).json(); } catch { MIC = { keys: [], foods: [] }; } } return MIC; }
// Produits de marque français les plus courants (Open Food Facts), disponibles hors connexion
export async function loadOffDb() { if (!OFFDB) { try { const j = await (await fetch("data/off-fr.json")).json(); OFFDB = j.foods.map(f => ({ n: f[0] + (f[1] ? " · " + f[1] : ""), brand: f[1], cat: "Produits de marque", kcal: f[2], p: f[3], c: f[4], f: f[5], fib: f[6], code: f[7], off: true, k: norm(f[0] + " " + (f[1] || "")), a: (f[0] + " " + (f[1] || "")).toLowerCase(), mic: f[8] != null || f[9] != null ? { sug: f[8], na: f[9] } : undefined })); } catch { OFFDB = []; } } return OFFDB; }
export const offDb = () => OFFDB;
// Micronutriments d'une quantité d'aliment
export function microOf(f, g) {
  if (!f || !g) return null;
  if (f.mic) { const o = {}; for (const [k, v] of Object.entries(f.mic)) if (v != null) o[k] = +(v * g / 100).toFixed(3); return Object.keys(o).length ? o : null; }
  if (!MIC || f.ix == null) return null; const v = MIC.foods[f.ix]; if (!v) return null;
  const o = {}; MIC.keys.forEach((k, i) => { if (v[i] != null) o[k] = +(v[i] * g / 100).toFixed(3); }); return o;
}
const cqFind = (label) => CQI[label] || CQI[ING_CQ[label]] || null;
export function microFor(label, g) { if (!g || !CQ) return null; const f = cqFind(label); return f ? microOf(f, g) : null; }
export const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/['’‘`´,;.()\/-]+/g, " ").replace(/\s+/g, " ").trim();
// Aliments courants absents de la table Ciqual (valeurs moyennes d'étiquettes)
const EXTRA = [
  ["Skyr nature 0 %", "Produits laitiers", 60, 10.5, 4, 0.2],
  ["Skyr aux fruits", "Produits laitiers", 80, 9, 10, 0.2],
  ["Protéine whey en poudre", "Compléments", 380, 75, 8, 6],
];
// Aliments de base avec un nom clair, recopiés de la table Ciqual (on les trouve en premier)
const BASICS = [
  ["Pâtes (cuites)", "Pâtes sèches standard, cuites, non salées"], ["Pâtes (crues)", "Pâtes sèches standard, crues"],
  ["Pâtes complètes (cuites)", "Pâtes sèches, au blé complet, cuites, non salées"], ["Pâtes aux œufs (cuites)", "Pâtes sèches, aux oeufs, cuites, non salées"],
  ["Riz blanc (cuit)", "Riz blanc, cuit, non salé"], ["Riz blanc (cru)", "Riz blanc, cru"], ["Riz basmati (cuit)", "Riz basmati, cuit, non salé"],
  ["Riz complet (cuit)", "Riz complet, cuit, non salé"], ["Riz complet (cru)", "Riz complet, cru"],
  ["Semoule (cuite)", "Semoule de blé dur, cuite, non salée"], ["Semoule (crue)", "Semoule de blé dur, crue"], ["Quinoa (cuit)", "Quinoa, bouilli/cuit à l'eau, non salé"], ["Quinoa (cru)", "Quinoa, cru"],
  ["Lentilles (cuites)", "Lentille, bouillie/cuite à l'eau"], ["Pois chiches (cuits)", "Pois chiche, bouilli/cuit à l'eau"], ["Pommes de terre (cuites)", "Pomme de terre, bouillie/cuite à l'eau"],
  ["Flocons d'avoine", "Flocon d'avoine"], ["Blanc de poulet (cru)", "Poulet, filet, sans peau, cru"], ["Blanc de poulet (cuit)", "Poulet, filet, sans peau, sauté/poêlé"],
  ["Escalope de dinde (crue)", "Dinde, escalope, crue"], ["Steak haché 5 % (cuit)", "Boeuf, steak haché 5% MG, cuit"], ["Steak haché 5 % (cru)", "Boeuf, steak haché 5% MG, cru"],
  ["Œuf entier", "Oeuf, cru"], ["Banane", "Banane, pulpe, crue"], ["Brocoli (cuit)", "Brocoli, cuit"], ["Haricots verts (cuits)", "Haricot vert, cuit"], ["Lait demi-écrémé", "Lait demi-écrémé, UHT"],
];
// Aliments ajoutés par le coach (bibliothèque partagée)
export const EXTRA_COACH = [];
export function setCoachFoods(list) {
  EXTRA_COACH.length = 0; list.forEach(f => EXTRA_COACH.push([f.n, f.cat || "Ajouts du coach", f.kcal, f.p, f.c, f.f]));
  if (CQ) { CQ = CQ.filter(x => !x.coach); EXTRA_COACH.forEach(f => CQ.push({ n: f[0], cat: f[1], kcal: f[2], p: f[3], c: f[4], f: f[5], k: norm(f[0]), a: f[0].toLowerCase(), coach: true })); }
}
export const ciqual = () => CQ;
// Mots ignorés et pluriels : « flocons d'avoine » trouve « Flocon d'avoine »
const STOP = new Set(["d", "l", "de", "du", "des", "la", "le", "les", "au", "aux", "a", "et", "en", "un", "une"]);
const stem = (t) => t.length > 3 ? t.replace(/(s|x)$/, "") : t;

export function searchFoods(q, max = 30) {
  if (!CQ || !q.trim()) return [];
  const terms = norm(q).split(" ").filter(t => t && !STOP.has(t)).map(stem);
  if (!terms.length) return [];
  const raw = String(q).toLowerCase().replace(/oe/g, "œ").split(/[\s'’,]+/).filter(t => t.length > 1 && !STOP.has(t)).map(t => t.replace(/(s|x)$/, ""));
  const res = [];
  for (const f of CQ) {
    if (!terms.every(t => f.k.startsWith(t) || f.k.includes(" " + t))) continue;
    let s = 0;
    if (f.k.startsWith(terms[0])) s += 4;
    if (f.base) s += 5;
    if (/\bpates\b/.test(norm(q)) && /\bpate (a |feuilletee|brisee|sablee|de fruit|d amande|a tartiner)|pizza|tarte/.test(f.k)) s -= 4;
    // mot entier avec ses accents : « pâtes » ne remonte pas « pâté », « lait » ne remonte pas « laitue »
    for (const w of raw) if (new RegExp(`(^|[^a-zà-ÿœ])${w.replace(/[.*+?^${}()|[\]\\]/g, "")}(s|x)?($|[^a-zà-ÿœ])`).test(f.a)) s += 2;
    if (/\b(cuit|bouilli|dur)/.test(f.k)) s += 1;
    s += terms.join(" ").length / f.k.length * 3; // plus le nom est proche de la recherche, plus il remonte
    if (!f.base && /\b(blanc|jaune|poudre|deshydrate|lyophilise|infantile|bebe)\b/.test(f.k) && !terms.some(t => /blanc|jaune|poudre/.test(t))) s -= 1.5;
    if (f.cat === "Plats préparés" && f.n.length > 25) s -= 1;
    s -= f.n.length / 80;
    res.push([s, f]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, max).map(x => x[1]);
}

// ---------- Cibles caloriques (Mifflin-St Jeor) ----------
// Mode de vie hors sport (le sport est ajouté à part, ci-dessous)
export const ACTIVITY = { low: 1.2, light: 1.3, mid: 1.4, high: 1.55, vhigh: 1.7 };
// Dépense moyenne par jour des séances de la semaine : musculation 4 MET nets, sport et cardio ~6 MET nets
export function weeklyExercise(p) {
  const w = p.weight, lift = (p.days || 0) * ((p.sessionMin || 60) / 60) * 4 * w, sport = (p.sportHours || 0) * 6 * w;
  return { lift: Math.round(lift / 7), sport: Math.round(sport / 7), total: Math.round((lift + sport) / 7) };
}
// Ajustement selon les pas déclarés (référence 7 000 pas)
const stepsAdj = (p) => p.stepsAvg ? Math.round((p.stepsAvg - 7000) * 0.0005 * p.weight) : 0;
export function pickModel(p) {
  if (p.diet === "vegan") return "vegan";
  if (p.diet === "vegetarian") return "vege";
  if (p.age >= 50) return "senior";
  if (p.goal === "fat") return p.sex === "f" ? "femme" : (p.level === "comeback" || p.level === "beginner" ? "douce" : "ventre");
  if (p.goal === "recomp") return "recompo";
  if (p.goal === "strength") return "force";
  if (p.goal === "restart") return "douce";
  return "prise";
}
export function targets(p = S().profile) {
  if (!p || !MODELS) return null;
  const m = MODELS.find(x => x.id === (p.nutritionModel || pickModel(p))) || MODELS[0];
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === "f" ? -161 : 5);
  const ex = weeklyExercise(p), base = bmr * (ACTIVITY[p.activity] || 1.4) + stepsAdj(p) + ex.total;
  const kcal = Math.round((base * (1 + (m.adj || 0) / 100) + (S().planPrefs?.kcalAdj || 0)) / 10) * 10;
  const prot = Math.round((m.pk || 1.8) * p.weight), fat = Math.round((m.lk || .9) * p.weight);
  const carbs = Math.max(50, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { model: m, kcal, prot, fat, carbs, maintenance: Math.round(base / 10) * 10, ex, bmr: Math.round(bmr) };
}

// ---------- Ingrédients de base (valeurs moyennes Ciqual arrondies, pour 100 g, pesés cuits) ----------
const ING = {
  riz: ["Riz cuit", 130, 2.7, 28, .3], rizc: ["Riz complet cuit", 123, 2.7, 25.6, 1], pates: ["Pâtes cuites", 150, 5.2, 30, .9], patesc: ["Pâtes complètes cuites", 135, 5.5, 26, 1.4],
  pdt: ["Pommes de terre cuites", 80, 1.8, 16.7, .3], pdouce: ["Patate douce cuite", 86, 1.6, 20, .1], semoule: ["Semoule cuite", 112, 3.8, 23, .2], sarrasin: ["Sarrasin cuit", 92, 3.4, 19.9, .6],
  quinoa: ["Quinoa cuit", 149, 4.7, 27.9, 1.1], avoine: ["Flocons d'avoine", 370, 13, 58, 7], pain: ["Pain complet", 244, 8.4, 44.3, 1.8],
  tortilla: ["Tortilla de blé", 300, 8, 50, 7], galette: ["Galettes de riz soufflé", 380, 8, 80, 3], muesli: ["Muesli sans sucre ajouté", 360, 10, 60, 6],
  poulet: ["Filet de poulet cuit", 160, 31, 0, 3.5], dinde: ["Escalope de dinde cuite", 135, 29, 0, 1.8], boeuf: ["Bœuf haché 5 % cuit", 155, 25.5, 0, 5.8], steak: ["Steak de bœuf cuit", 170, 28, 0, 6.5],
  jambon: ["Jambon blanc", 115, 20, 1, 3.5], jambonvol: ["Jambon de volaille", 110, 20, 1.5, 3], saumon: ["Saumon cuit", 200, 24, 0, 12], cabillaud: ["Cabillaud cuit", 105, 23, 0, 1],
  thon: ["Thon au naturel", 115, 26, 0, 1], sardines: ["Sardines à l'huile égouttées", 210, 24, 0, 13], crevettes: ["Crevettes cuites", 99, 22, 0, 1.1], maquereau: ["Maquereau cuit", 230, 21, 0, 16],
  oeuf: ["Œufs", 140, 12.5, .7, 9.8], blanc: ["Blancs d'œufs", 48, 10.3, .7, .2], tofu: ["Tofu nature", 148, 13.4, 2.9, 8.5], tempeh: ["Tempeh", 192, 19, 8, 11], seitan: ["Seitan", 140, 25, 6, 2],
  lentilles: ["Lentilles cuites", 104, 9, 12.2, .4], pchiches: ["Pois chiches cuits", 131, 8, 17, 2.4], hrouges: ["Haricots rouges cuits", 110, 8.4, 14, .5], edamame: ["Edamame", 121, 11.9, 8.9, 5.2],
  skyr: ["Skyr nature", 63, 11, 4, .2], fb: ["Fromage blanc 0 %", 46, 7.5, 4, .2], grec: ["Yaourt grec", 97, 9, 4, 5], cottage: ["Cottage cheese", 98, 11, 3.4, 4.3], lait: ["Lait demi-écrémé", 47, 3.4, 4.8, 1.6],
  mozza: ["Mozzarella", 250, 18, 1, 19], feta: ["Feta", 264, 14, 4, 21], parmesan: ["Parmesan", 392, 33, 0, 28], emmental: ["Emmental", 380, 29, 0, 29],
  soja: ["Boisson au soja", 40, 3.4, 1.5, 2], yaosoja: ["Yaourt au soja nature", 50, 4, 2, 2.2], whey: ["Protéine en poudre (whey)", 380, 78, 7, 5], veganprot: ["Protéine végétale en poudre", 380, 75, 8, 6],
  legumes: ["Légumes", 30, 2, 4, .2], brocoli: ["Brocoli", 35, 3, 4, .4], epinards: ["Épinards", 23, 2.9, 1.4, .4], hverts: ["Haricots verts", 30, 1.9, 4.1, .2], courgette: ["Courgette", 17, 1.2, 2.2, .3],
  tomate: ["Tomates", 18, .9, 3, .2], salade: ["Salade verte", 15, 1.3, 1.5, .2], carotte: ["Carottes", 36, .8, 7, .3], poivron: ["Poivron", 26, 1, 4.6, .3], champi: ["Champignons", 22, 3, 1, .3],
  avocat: ["Avocat", 160, 2, 1.8, 15], banane: ["Banane", 90, 1.1, 20, .3], pomme: ["Pomme", 52, .3, 11.6, .2], frouges: ["Fruits rouges", 45, 1, 8, .4], kiwi: ["Kiwi", 60, 1.1, 10.5, .5], orange: ["Orange", 47, .9, 9, .2],
  amandes: ["Amandes", 600, 19, 9.5, 51], noix: ["Noix", 700, 15, 7, 65], cacahuete: ["Beurre de cacahuète", 600, 25, 13, 50], huile: ["Huile d'olive", 900, 0, 0, 100], miel: ["Miel", 320, .4, 80, 0],
  choco: ["Chocolat noir 70 %", 580, 8, 33, 42], houmous: ["Houmous", 300, 7.5, 13, 24], dattes: ["Dattes", 290, 2.5, 66, .4], compote: ["Compote sans sucre ajouté", 60, .3, 13, .2],
};
// Noms Ciqual des ingrédients du plan (pour les fibres et les micronutriments)
const ING_CQ = { "Riz cuit": "Riz blanc, cuit, non salé", "Riz complet cuit": "Riz complet, cuit, non salé", "Pâtes cuites": "Pâtes sèches standard, cuites, non salées", "Pâtes complètes cuites": "Pâtes sèches, au blé complet, cuites, non salées",
  "Pommes de terre cuites": "Pomme de terre, bouillie/cuite à l'eau", "Patate douce cuite": "Patate douce, cuite", "Semoule cuite": "Semoule de blé dur, cuite, non salée", "Quinoa cuit": "Quinoa, bouilli/cuit à l'eau, non salé",
  "Flocons d'avoine": "Flocon d'avoine", "Pain complet": "Pain complet ou intégral (à la farine T150)", "Filet de poulet cuit": "Poulet, filet, sans peau, sauté/poêlé", "Escalope de dinde cuite": "Dinde, escalope, sautée/poêlée",
  "Bœuf haché 5 % cuit": "Boeuf, steak haché 5% MG, cuit", "Jambon blanc": "Jambon cuit, supérieur", "Saumon cuit": "Saumon, cuit à la vapeur", "Cabillaud cuit": "Cabillaud, cuit à la vapeur", "Thon au naturel": "Thon, au naturel, appertisé, égoutté",
  "Sardines à l'huile égouttées": "Sardine, à l'huile, appertisée, égouttée", "Crevettes cuites": "Crevette, cuite", "Maquereau cuit": "Maquereau, rôti/cuit au four", "Œufs": "Oeuf, cru", "Blancs d'œufs": "Oeuf, blanc (blanc d'oeuf), cru", "Tofu nature": "Tofu nature, préemballé",
  "Lentilles cuites": "Lentille, bouillie/cuite à l'eau", "Pois chiches cuits": "Pois chiche, bouilli/cuit à l'eau", "Haricots rouges cuits": "Haricot rouge, bouilli/cuit à l'eau", "Fromage blanc 0 %": "Fromage blanc nature, 0% MG",
  "Yaourt grec": "Yaourt à la grecque, nature", "Lait demi-écrémé": "Lait demi-écrémé, UHT", "Mozzarella": "Mozzarella au lait de vache", "Feta": "Feta AOP", "Parmesan": "Parmesan", "Emmental": "Emmental ou emmenthal", "Boisson au soja": "Boisson au soja, nature, enrichie en calcium, préemballée",
  "Brocoli": "Brocoli, cuit", "Épinards": "Épinard, cuit", "Haricots verts": "Haricot vert, cuit", "Courgette": "Courgette, pulpe et peau, cuite", "Tomates": "Tomate, crue", "Carottes": "Carotte, cuite", "Poivron": "Poivron rouge, cru", "Champignons": "Champignon de Paris ou champignon de couche, sauté/poêlé, sans matière grasse",
  "Avocat": "Avocat, pulpe, cru", "Banane": "Banane, pulpe, crue", "Pomme": "Pomme, pulpe et peau, crue", "Kiwi": "Kiwi, pulpe et graines, cru", "Orange": "Orange, pulpe, crue", "Amandes": "Amande (avec peau)", "Noix": "Noix, séchée, cerneaux",
  "Beurre de cacahuète": "Beurre de cacahuète ou Pâte d'arachide", "Huile d'olive": "Huile d'olive vierge extra", "Miel": "Miel", "Chocolat noir 70 %": "Chocolat noir à 70% cacao minimum, extra, dégustation, tablette", "Houmous": "Houmous, préemballé", "Dattes": "Datte, pulpe et peau, sèche",
  "Légumes": "Légumes, mélange surgelé, crus", "Salade verte": "Laitue, crue", "Fruits rouges": "Fraise, crue", "Edamame": "Soja, graine entière" };
// Familles d'aliments, pour filtrer selon le régime
const MEAT = new Set(["poulet", "dinde", "boeuf", "steak", "jambon", "jambonvol"]), FISH = new Set(["saumon", "cabillaud", "thon", "sardines", "crevettes", "maquereau"]);
const DAIRY = new Set(["skyr", "fb", "grec", "cottage", "lait", "mozza", "feta", "parmesan", "emmental", "whey"]), EGG = new Set(["oeuf", "blanc"]), HONEY = new Set(["miel"]);
const GLUTEN = new Set(["pates", "patesc", "pain", "semoule", "tortilla", "seitan", "muesli", "avoine"]), PORK = new Set(["jambon"]), LACTOSE = new Set(["lait", "skyr", "fb", "grec", "cottage", "mozza", "feta", "whey"]);
// Plats nommés : ce que les gens mangent vraiment. Le régime se déduit des ingrédients.
const D = (id, n, slot, ing) => ({ id, n, slot, ing });
export const DISHES = [
  D("porridge", "Porridge skyr banane", "matin", { avoine: 60, skyr: 150, banane: 100 }), D("omelette", "Omelette 3 œufs, pain complet", "matin", { oeuf: 165, pain: 60, huile: 5 }),
  D("porridge-soja", "Porridge soja banane amandes", "matin", { avoine: 70, soja: 250, banane: 100, amandes: 15 }), D("tartines-fb", "Tartines complètes, fromage blanc, miel, kiwi", "matin", { pain: 80, fb: 200, miel: 10, kiwi: 100 }),
  D("bowl-grec", "Yaourt grec, muesli, fruits rouges", "matin", { grec: 200, muesli: 50, frouges: 100 }), D("pancakes", "Pancakes avoine, blancs d'œufs, banane", "matin", { avoine: 60, blanc: 150, banane: 100, cacahuete: 15 }),
  D("tofu-brouille", "Tofu brouillé, pain, avocat", "matin", { tofu: 150, pain: 70, avocat: 50, tomate: 100 }), D("galettes-cacahuete", "Galettes de riz, beurre de cacahuète, banane, yaourt soja", "matin", { galette: 40, cacahuete: 25, banane: 120, yaosoja: 150 }),
  D("oeufs-jambon", "Œufs brouillés, jambon, pain complet", "matin", { oeuf: 110, jambon: 60, pain: 60 }), D("skyr-galettes", "Skyr, galettes de riz, pomme", "matin", { skyr: 200, galette: 30, pomme: 150 }),
  D("oeufs-pdouce", "Œufs, patate douce, épinards", "matin", { oeuf: 165, pdouce: 150, epinards: 100 }), D("smoothie-veg", "Smoothie protéiné végétal, banane, avoine", "matin", { veganprot: 30, soja: 300, banane: 100, avoine: 40 }),
  D("riz-poulet", "Riz, poulet, haricots verts", "repas", { riz: 200, poulet: 150, hverts: 200, huile: 10 }), D("bolo", "Pâtes bolognaise maigre", "repas", { pates: 220, boeuf: 125, tomate: 150, huile: 5 }),
  D("saumon", "Saumon, pommes de terre, brocoli", "repas", { saumon: 130, pdt: 250, brocoli: 200 }), D("salade-thon", "Salade thon, œufs, pommes de terre", "repas", { thon: 120, oeuf: 110, pdt: 200, salade: 100, huile: 10 }),
  D("bowl-tofu", "Bowl lentilles, quinoa, tofu", "repas", { lentilles: 150, quinoa: 150, tofu: 120, legumes: 150, huile: 10 }), D("sin-carne", "Chili sin carne et riz", "repas", { hrouges: 200, riz: 150, poivron: 150, huile: 10 }),
  D("oeufs-riz", "Riz sauté aux œufs et légumes", "repas", { riz: 200, oeuf: 165, legumes: 200, huile: 10 }), D("dinde-pdouce", "Dinde, patate douce, courgettes", "repas", { dinde: 150, pdouce: 250, courgette: 200, huile: 10 }),
  D("steak-pdt", "Steak, pommes de terre, salade", "repas", { steak: 150, pdt: 250, salade: 100, huile: 10 }), D("cabillaud-riz", "Cabillaud, riz complet, épinards", "repas", { cabillaud: 180, rizc: 200, epinards: 150, huile: 10 }),
  D("wrap-poulet", "Wrap poulet, crudités, houmous", "repas", { tortilla: 80, poulet: 120, houmous: 40, salade: 60, tomate: 80 }), D("curry-pchiches", "Curry de pois chiches, riz basmati", "repas", { pchiches: 200, riz: 150, epinards: 100, huile: 10 }),
  D("tempeh-sarrasin", "Tempeh sauté, sarrasin, brocoli", "repas", { tempeh: 120, sarrasin: 200, brocoli: 150, huile: 10 }), D("crevettes-quinoa", "Crevettes, quinoa, poivrons", "repas", { crevettes: 150, quinoa: 200, poivron: 150, huile: 10 }),
  D("pates-thon", "Pâtes complètes au thon et tomates", "repas", { patesc: 220, thon: 120, tomate: 150, huile: 5 }), D("pates-feta", "Pâtes, feta, courgettes, pois chiches", "repas", { pates: 180, feta: 40, courgette: 150, pchiches: 100, huile: 5 }),
  D("hache-pdouce", "Bœuf haché, patate douce, haricots verts", "repas", { boeuf: 150, pdouce: 250, hverts: 150, huile: 5 }), D("maquereau-pdt", "Maquereau, pommes de terre, salade", "repas", { maquereau: 120, pdt: 250, salade: 100 }),
  D("semoule-poulet", "Semoule, poulet, légumes du couscous", "repas", { semoule: 200, poulet: 130, legumes: 200, pchiches: 60, huile: 5 }), D("seitan-riz", "Seitan, riz, légumes sautés", "repas", { seitan: 150, riz: 180, legumes: 200, huile: 10 }),
  D("omelette-repas", "Omelette champignons, pommes de terre, salade", "repas", { oeuf: 220, champi: 150, pdt: 200, salade: 80, huile: 5 }), D("lentilles-saumon", "Lentilles, saumon, carottes", "repas", { lentilles: 200, saumon: 110, carotte: 150 }),
  D("lowcarb-poulet", "Poulet, avocat, légumes rôtis", "repas", { poulet: 180, avocat: 80, courgette: 200, poivron: 150, huile: 10 }), D("lowcarb-saumon", "Saumon, épinards, œuf", "repas", { saumon: 150, epinards: 200, oeuf: 55, huile: 5 }),
  D("lowcarb-tofu", "Tofu, edamame, brocoli", "repas", { tofu: 200, edamame: 100, brocoli: 200, huile: 10 }), D("dinde-riz", "Dinde, riz, carottes", "repas", { dinde: 150, riz: 200, carotte: 150, huile: 10 }),
  D("lowcarb-steak", "Steak, haricots verts, champignons", "repas", { steak: 170, hverts: 200, champi: 150, huile: 10 }), D("lowcarb-omelette", "Omelette feta épinards, salade", "repas", { oeuf: 220, feta: 30, epinards: 150, salade: 100, huile: 5 }),
  D("fb-amandes", "Fromage blanc, amandes, pomme", "collation", { fb: 200, amandes: 20, pomme: 150 }), D("skyr-banane", "Skyr et banane", "collation", { skyr: 150, banane: 100 }),
  D("soja-pomme", "Boisson soja, pomme, amandes", "collation", { soja: 300, pomme: 150, amandes: 20 }), D("shake-whey", "Shake whey, lait, banane", "collation", { whey: 30, lait: 250, banane: 100 }),
  D("yaosoja-noix", "Yaourt soja, noix, fruits rouges", "collation", { yaosoja: 200, noix: 15, frouges: 100 }), D("cottage-kiwi", "Cottage cheese, kiwi", "collation", { cottage: 200, kiwi: 100 }),
  D("oeufs-durs", "2 œufs durs, carottes", "collation", { oeuf: 110, carotte: 150 }), D("houmous-crudites", "Houmous, crudités, galettes de riz", "collation", { houmous: 60, carotte: 150, galette: 20 }),
  D("dattes-amandes", "Dattes, amandes, orange", "collation", { dattes: 30, amandes: 20, orange: 150 }), D("choco-noix", "Chocolat noir, noix, compote", "collation", { choco: 15, noix: 15, compote: 100 }),
  D("jambonvol-galette", "Jambon de volaille, galettes de riz, tomate", "collation", { jambonvol: 80, galette: 25, tomate: 100 }), D("shake-veg", "Shake protéine végétale, boisson soja", "collation", { veganprot: 30, soja: 250, banane: 80 }),
];
// Régimes : omnivore, pescétarien, végétarien, vegan ; exclusions : sans porc, sans gluten, sans lactose ; faible en glucides
export const DIETS = [["all", "Omnivore"], ["pesce", "Pescétarien"], ["vegetarian", "Végétarien"], ["vegan", "Vegan"]];
export function dishOk(d, prefs = planPrefs()) {
  const k = Object.keys(d.ing), has = (set) => k.some(x => set.has(x)), diet = prefs.diet || "all";
  if (diet !== "all" && has(MEAT)) return false;
  if ((diet === "vegetarian" || diet === "vegan") && has(FISH)) return false;
  if (diet === "vegan" && (has(DAIRY) || has(EGG) || has(HONEY))) return false;
  if (prefs.noPork && has(PORK)) return false;
  if (prefs.noGluten && has(GLUTEN)) return false;
  if (prefs.noLactose && has(LACTOSE)) return false;
  if (prefs.lowCarb && d.slot === "repas") { const m = macrosOf(d.ing); if (m.c * 4 / Math.max(1, m.kcal) > .3) return false; }
  return true;
}
// Préférences du plan : nombre de repas, régime, exclusions, modèle choisi
export const planPrefs = () => ({ meals: 4, diet: S().profile?.diet || "all", noPork: false, noGluten: false, noLactose: false, lowCarb: false, kcalAdj: 0, preset: null, ...(S().planPrefs || {}) });
export function setPlanPrefs(p) { update(st => { st.planPrefs = { ...planPrefs(), ...p }; st.planChoice = {}; }); }
// Programmes alimentaires types, par profil
export const PLAN_PRESETS = [
  { id: "perte3", e: "📉", n: "Perte de gras · 3 repas", d: "Trois vrais repas, pas de grignotage, des protéines à chaque repas.", p: { meals: 3 } },
  { id: "if168", e: "⏳", n: "Jeûne intermittent 16/8 · 2 repas", d: "Déjeuner et dîner, dans une fenêtre de 8 heures.", p: { meals: 2 } },
  { id: "masse5", e: "💪", n: "Prise de muscle · 5 repas", d: "Les calories réparties sur 5 prises pour manger assez sans se forcer.", p: { meals: 5 } },
  { id: "athlete6", e: "🏋️", n: "Sportif · 6 prises", d: "Gros volume d'entraînement : 3 repas et 3 collations.", p: { meals: 6 } },
  { id: "vege4", e: "🥚", n: "Végétarien · 4 repas", d: "Œufs, laitages, légumineuses, tofu.", p: { meals: 4, diet: "vegetarian" } },
  { id: "vegan4", e: "🌱", n: "Vegan · 4 repas", d: "100 % végétal : soja, légumineuses et céréales pour des protéines complètes. Vitamine B12 indispensable.", p: { meals: 4, diet: "vegan" } },
  { id: "pesce4", e: "🐟", n: "Pescétarien · 4 repas", d: "Poisson et végétal, pas de viande.", p: { meals: 4, diet: "pesce" } },
  { id: "lowcarb3", e: "🥑", n: "Faible en glucides · 3 repas", d: "Moins de féculents le midi et le soir, plus de légumes et de bonnes graisses.", p: { meals: 3, lowCarb: true } },
  { id: "sansporc4", e: "🚫", n: "Sans porc · 4 repas", d: "Aucun produit à base de porc.", p: { meals: 4, noPork: true } },
  { id: "sg4", e: "🌾", n: "Sans gluten · 4 repas", d: "Riz, quinoa, sarrasin, pommes de terre à la place du blé. Vérifie les étiquettes (avoine certifiée).", p: { meals: 4, noGluten: true } },
  { id: "sl4", e: "🥛", n: "Sans lactose · 4 repas", d: "Boissons et yaourts végétaux à la place des laitages.", p: { meals: 4, noLactose: true } },
  { id: "papa3", e: "👨", n: "Papa pressé · 3 repas", d: "Des plats simples à préparer en batch le dimanche.", p: { meals: 3 } },
  { id: "allait5", e: "🤱", n: "Maman allaitante · 5 repas · +400 kcal", d: "L'allaitement demande environ 400 kcal de plus par jour. Pas de régime restrictif pendant cette période.", p: { meals: 5, kcalAdj: 400 } },
  { id: "enceinte2", e: "🤰", n: "Grossesse 2e trimestre · 5 repas · +250 kcal", d: "Pas de restriction calorique pendant la grossesse : suis l'avis de ton médecin ou de ta sage-femme.", p: { meals: 5, kcalAdj: 250 } },
  { id: "enceinte3", e: "🤰", n: "Grossesse 3e trimestre · 5 repas · +450 kcal", d: "Des petits repas plus fréquents pour le confort digestif.", p: { meals: 5, kcalAdj: 450 } },
  { id: "senior4", e: "👴", n: "Senior · 4 repas", d: "Des protéines bien réparties sur la journée pour garder le muscle.", p: { meals: 4 } },
];
export function macrosOf(ing) {
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const [k, g] of Object.entries(ing)) { const v = ING[k]; kcal += v[1] * g / 100; p += v[2] * g / 100; c += v[3] * g / 100; f += v[4] * g / 100; }
  return { kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f) };
}
const r5 = (g, k) => k === "oeuf" ? Math.max(55, Math.round(g / 55) * 55) : k === "huile" ? Math.max(5, Math.round(g / 5) * 5) : Math.max(5, Math.round(g / 5) * 5);
export function scaleDish(d, kcal) {
  const base = macrosOf(d.ing), f = kcal / base.kcal, ing = {};
  for (const [k, g] of Object.entries(d.ing)) ing[k] = (k === "legumes") ? g : r5(g * f, k);
  return { ...d, ing, m: macrosOf(ing), items: Object.entries(ing).map(([k, g]) => ({ n: ING[k][0], g, kcal: Math.round(ING[k][1] * g / 100), p: +(ING[k][2] * g / 100).toFixed(1), c: +(ING[k][3] * g / 100).toFixed(1), f: +(ING[k][4] * g / 100).toFixed(1) })), lines: Object.entries(ing).map(([k, g]) => k === "oeuf" ? `${g / 55} œuf${g > 55 ? "s" : ""}` : `${g} g ${ING[k][0].toLowerCase()}`) };
}

// ---------- Plan alimentaire du jour ----------
const SPLITS = {
  2: [["Déjeuner", "repas", .5], ["Dîner", "repas", .5]],
  3: [["Petit-déjeuner", "matin", .27], ["Déjeuner", "repas", .4], ["Dîner", "repas", .33]],
  4: [["Petit-déjeuner", "matin", .25], ["Déjeuner", "repas", .35], ["Collation", "collation", .12], ["Dîner", "repas", .28]],
  5: [["Petit-déjeuner", "matin", .22], ["Collation du matin", "collation", .1], ["Déjeuner", "repas", .3], ["Collation", "collation", .13], ["Dîner", "repas", .25]],
  6: [["Petit-déjeuner", "matin", .2], ["Collation du matin", "collation", .1], ["Déjeuner", "repas", .28], ["Collation", "collation", .12], ["Dîner", "repas", .22], ["Collation du soir", "collation", .08]],
};
const splitOf = () => SPLITS[planPrefs().meals] || SPLITS[4];
const poolOf = (slot) => { const pr = planPrefs(), all = DISHES.filter(d => d.slot === slot);
  for (const p of [pr, { ...pr, lowCarb: false }, { ...pr, lowCarb: false, noGluten: false, noLactose: false }]) { const l = all.filter(d => dishOk(d, p)); if (l.length) return l; }
  return all; };
export const planPool = poolOf;
export function dayPlan(t, date = today()) {
  const MP = planFor(date);
  if (MP) return MP.map(m => ({ meal: m.name, time: m.time, n: m.title || m.items.map(i => i.label.split(",")[0]).slice(0, 3).join(", ") || m.name, items: m.items.map(i => ({ n: i.label, g: i.g, kcal: i.kcal, p: i.p, c: i.c, f: i.f })), lines: m.items.map(i => `${i.g ? i.g + " g " : ""}${i.label}`), m: m.items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { kcal: 0, p: 0, c: 0, f: 0 }), poolSize: 1, mine: true }));
  const seed = Math.floor(new Date(date).getTime() / 864e5);
  const choice = S().planChoice?.[date] || {};
  return splitOf().map(([meal, slot, share], i) => {
    const pool = poolOf(slot);
    const pick = choice[meal] != null ? pool[choice[meal] % pool.length] : pool[(seed + i * 3) % pool.length];
    return { meal, slot, time: MEAL_TIMES[meal], ...scaleDish(pick, t.kcal * share), poolSize: pool.length };
  });
}
// Les autres plats possibles pour ce repas, à la même dose de calories
export function planOptions(t, date, meal) {
  const x = dayPlan(t, date).find(p => p.meal === meal); if (!x || x.mine || !x.slot) return [];
  const share = splitOf().find(s => s[0] === meal)?.[2] || .3;
  return poolOf(x.slot).map((d, i) => ({ i, ...scaleDish(d, t.kcal * share) }));
}
export function chooseDish(meal, i, date = today()) { update(st => { st.planChoice = st.planChoice || {}; (st.planChoice[date] = st.planChoice[date] || {})[meal] = i; }); }
export function swapDish(meal, date = today()) {
  update(st => { st.planChoice = st.planChoice || {}; const c = st.planChoice[date] = st.planChoice[date] || {}; c[meal] = (c[meal] ?? Math.floor(Math.random() * 5)) + 1; });
}

// ---------- Semaine type, jours d'entraînement et de repos, cheat meal ----------
// Le type de jour (entraînement ou repos) vient de l'agenda : fourni par l'app au démarrage.
let dayKindFn = null;
export const setDayKind = (f) => { dayKindFn = f; };
export const dayKind = (date = today()) => dayKindFn ? dayKindFn(date) : "rest";
const dowOf = (d) => (new Date(d + "T12:00:00").getDay() + 6) % 7;
const shiftD = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export const mondayOf = (d) => shiftD(d, -dowOf(d));
export const weekType = () => S().weekType || { mode: "same", train: "main", rest: "main", pct: 10, days: Array(7).fill("main") };
export const variants = () => S().planVariants || [];
// Plan en cours d'écriture : le plan principal ou une variante (jour de repos, samedi…)
export const edPlan = (st = S()) => st.editVar ? (st.planVariants || []).find(v => v.id === st.editVar) || st.myPlan : st.myPlan;
export function setEdPlan(st, val) {
  const v = st.editVar && (st.planVariants || []).find(x => x.id === st.editVar);
  if (v) v.meals = val?.meals || []; else st.myPlan = val;
}
// Les repas prévus pour une date : variante du jour si la semaine type le demande, sinon le plan principal
export function planFor(date = today()) {
  const W = weekType(), byId = (id) => id && id !== "main" ? variants().find(v => v.id === id)?.meals : null;
  let m = null;
  if (W.mode === "trainrest") m = byId(dayKind(date) === "train" ? W.train : W.rest);
  else if (W.mode === "days") m = byId(W.days?.[dowOf(date)]);
  return m?.length ? m : S().myPlan?.meals?.length ? S().myPlan.meals : null;
}
const cheatExtra = (c, t) => Math.max(0, (c.kcal || 1200) - Math.round(t.kcal * .3));
export const cheats = () => (S().cheats || []).slice().sort((a, b) => a.d.localeCompare(b.d));
export const nextCheat = () => cheats().find(c => c.d >= today()) || null;
export const cheatOn = (d) => (S().cheats || []).filter(c => c.d === d);
// Cible du jour : jours d'entraînement un peu plus hauts, jours de repos un peu plus bas (moyenne de la semaine inchangée),
// et un cheat meal prévu est compensé sur les autres jours de la semaine pour garder le déficit hebdomadaire.
export function dayTarget(date = today()) {
  const t = targets(); if (!t) return null;
  let kcal = t.kcal; const notes = [];
  const W = weekType();
  if (W.mode === "trainrest" && W.pct) {
    const n = Math.max(1, Math.min(6, S().profile?.days || 3)), up = Math.round(t.kcal * W.pct / 100);
    if (dayKind(date) === "train") { kcal += up; notes.push(`+${up} kcal : jour d'entraînement`); }
    else { const dn = Math.round(up * n / (7 - n)); kcal -= dn; notes.push(`−${dn} kcal : jour de repos`); }
  }
  const mon = mondayOf(date), sun = shiftD(mon, 6);
  const cs = (S().cheats || []).filter(c => c.d >= mon && c.d <= sun);
  if (cs.length) {
    const mine = cs.filter(c => c.d === date);
    if (mine.length) { const e = mine.reduce((a, c) => a + cheatExtra(c, t), 0); kcal += e; notes.push(`+${e} kcal : cheat meal`); }
    else {
      let cut = 0;
      cs.forEach(c => {
        const from = (c.at || mon) > mon ? c.at : mon;
        if (date < from) return;
        const cheatDays = new Set(cs.map(x => x.d));
        let others = 0; for (let k = from; k <= sun; k = shiftD(k, 1)) if (!cheatDays.has(k)) others++;
        cut += cheatExtra(c, t) / Math.max(1, others);
      });
      cut = Math.min(Math.round(t.kcal * .15), Math.round(cut));
      if (cut > 0) { kcal -= cut; notes.push(`−${cut} kcal : cheat meal prévu cette semaine`); }
    }
  }
  const diff = kcal - t.kcal;
  return { ...t, kcal: Math.round(kcal / 10) * 10, carbs: Math.max(50, Math.round(t.carbs + diff * .7 / 4)), fat: Math.max(30, Math.round(t.fat + diff * .3 / 9)), base: t.kcal, notes };
}
// Sucres et sel du jour (à partir des micronutriments des aliments notés)
export function sugarSalt(date = today()) {
  let sug = 0, na = 0, n = 0;
  dayLog(date).forEach(e => { if (e.mic) { n++; sug += e.mic.sug || 0; na += e.mic.na || 0; } });
  return { sug: Math.round(sug), salt: Math.round(na * 2.5 / 100) / 10, known: n, total: dayLog(date).length };
}
// Changer la quantité d'un aliment déjà noté : tout est recalculé à la même proportion
export function rescaleEntry(id, date, g) {
  update(st => { const e = (st.food[date] || []).find(x => x.id === id); if (!e?.g || !(g > 0)) return; const k = g / e.g;
    e.kcal = Math.round(e.kcal * k); ["p", "c", "f", "fib"].forEach(x => { if (e[x] != null) e[x] = +(e[x] * k).toFixed(1); });
    if (e.mic) Object.keys(e.mic).forEach(x => { e.mic[x] = +(e.mic[x] * k).toFixed(3); }); e.g = g; });
}

// ---------- Journal ----------
export const MEALS = ["Petit-déjeuner", "Déjeuner", "Collation", "Dîner"];
export function dayLog(date = today()) { return S().food[date] || []; }
export function dayTotals(date = today()) {
  return dayLog(date).reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f, fib: a.fib + (e.fib || 0), fibN: a.fibN + (e.fib != null ? 1 : 0) }), { kcal: 0, p: 0, c: 0, f: 0, fib: 0, fibN: 0 });
}
export const MEAL_TIMES = { "Petit-déjeuner": "08:00", "Collation du matin": "10:30", "Déjeuner": "12:30", "Collation": "16:30", "Dîner": "19:30", "Collation du soir": "21:30" };
export function addEntry(e, date = today()) {
  if (!e.mic && e.g) { const m = microFor(e.label, e.g); if (m) e = { ...e, mic: m }; }
  if (e.fib == null && e.g && CQ) { const f = cqFind(e.label); if (f?.fib != null) e = { ...e, fib: +(f.fib * e.g / 100).toFixed(1) }; }
  const now = new Date(); const t = e.time || (date === today() ? now.toTimeString().slice(0, 5) : MEAL_TIMES[e.meal] || "12:00");
  update(st => { (st.food[date] = st.food[date] || []).push({ id: Date.now() + Math.random(), ...e, time: t }); });
}
export function setEntryTime(id, time, date = today()) { update(st => { const e = (st.food[date] || []).find(x => x.id === id); if (e) e.time = time; }); }
export const isFavFood = (n) => S().favFoods.some(f => f.n === n);
export function toggleFavFood(f) { update(st => { st.favFoods = isFavFood(f.n) ? st.favFoods.filter(x => x.n !== f.n) : [f, ...st.favFoods]; }); }
export function lastMealTime(date = today()) { const l = dayLog(date); return l.length ? l.map(e => e.time || "00:00").sort().at(-1) : null; }
export function removeEntry(id, date = today()) { update(st => { st.food[date] = (st.food[date] || []).filter(e => e.id !== id); }); }
export function entryFromFood(f, g, meal) {
  const k = g / 100, mic = microOf(f, g);
  return { meal, label: f.n, g, kcal: Math.round(f.kcal * k), p: +(f.p * k).toFixed(1), c: +(f.c * k).toFixed(1), f: +(f.f * k).toFixed(1), ...(f.fib != null ? { fib: +(f.fib * k).toFixed(1) } : {}), ...(mic ? { mic } : {}) };
}
// Micronutriments d'une journée : aliments notés (part des calories connue) + compléments pris
export function dayMicros(date = today()) {
  const o = {}, add = (m) => { for (const [k, v] of Object.entries(m || {})) o[k] = (o[k] || 0) + (+v || 0); };
  let known = 0; const log = dayLog(date), t = dayTotals(date);
  log.forEach(e => { if (e.mic) { known += e.kcal; add(e.mic); } });
  return { m: o, cover: t.kcal ? known / t.kcal : 0, n: log.length, kcal: t.kcal };
}
export function rememberFood(f) {
  update(st => { st.recentFoods = [f, ...st.recentFoods.filter(x => x.n !== f.n)].slice(0, 12); });
}

// Open Food Facts : code-barres
export async function lookupBarcode(code) {
  const loc = await barcodeLocal(code).catch(() => null); if (loc) return loc;
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,nutriments,brands`);
  const j = await r.json();
  if (j.status !== 1) return null;
  const n = j.product.nutriments || {};
  return { n: [j.product.product_name, j.product.brands].filter(Boolean).join(" · ") || "Produit scanné", kcal: Math.round(n["energy-kcal_100g"] || 0), p: n.proteins_100g || 0, c: n.carbohydrates_100g || 0, f: n.fat_100g || 0, fib: n.fiber_100g ?? null, ...microsOff(n) };
}
// Micronutriments Open Food Facts (pour 100 g), quand la marque les donne
const OFF_MICRO = { na: ["sodium_100g", 1000], ca: ["calcium_100g", 1000], fe: ["iron_100g", 1000], mg: ["magnesium_100g", 1000], k: ["potassium_100g", 1000], zn: ["zinc_100g", 1000], vc: ["vitamin-c_100g", 1000], vd: ["vitamin-d_100g", 1e6], b12: ["vitamin-b12_100g", 1e6] };
function microsOff(n) { const o = {}; for (const [k, [f, m]] of Object.entries(OFF_MICRO)) if (n[f] != null) o[k] = +(n[f] * m).toFixed(2); return Object.keys(o).length ? { mic: o } : {}; }
// Produits de marque : d'abord la base hors connexion (43 000 produits vendus en France), puis Open Food Facts en ligne
export async function searchBrands(q, n = 15) {
  await loadOffDb(); const terms = norm(q).split(" ").filter(t => t && !STOP.has(t)).map(stem); if (!terms.length) return [];
  const res = [];
  for (const f of OFFDB) { if (!terms.every(t => f.k.startsWith(t) || f.k.includes(" " + t))) continue; res.push([(f.k.startsWith(terms[0]) ? 3 : 0) + terms.join(" ").length / f.k.length * 3 - f.n.length / 60, f]); if (res.length > 600) break; }
  const local = res.sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
  if (local.length >= 6) return local;
  const live = await searchOff(q).catch(() => []);
  return [...local, ...live.filter(x => !local.some(l => l.code && l.code === x.code))].slice(0, n + 10);
}
const offCache = new Map();
const offItem = (p) => { const m = p.nutriments || {}, name = (p.product_name_fr || p.product_name || "").trim(), br = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0] || "").trim(); if (!name || m["energy-kcal_100g"] == null) return null;
  return { n: [name, br].filter(Boolean).join(" · "), brand: br, cat: "Produits de marque", kcal: Math.round(m["energy-kcal_100g"]), p: +(m.proteins_100g || 0), c: +(m.carbohydrates_100g || 0), f: +(m.fat_100g || 0), fib: m.fiber_100g ?? null, code: p.code, off: true, ...microsOff(m) }; };
export async function searchOff(q, n = 20) {
  const k = norm(q).trim(); if (k.length < 3) return [];
  if (offCache.has(k)) return offCache.get(k);
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000);
  const F = "code,product_name,product_name_fr,brands,nutriments";
  try {
    let list = [];
    try { const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=${n}&langs=fr&fields=${F}`, { signal: ctl.signal }); list = (await r.json()).hits || []; }
    catch { const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${n}&fields=${F}`, { signal: ctl.signal }); list = (await r.json()).products || []; }
    const out = list.map(offItem).filter(Boolean); offCache.set(k, out); return out;
  } catch { return []; } finally { clearTimeout(to); }
}
// Code-barres : base hors connexion d'abord
export async function barcodeLocal(code) { await loadOffDb(); return OFFDB.find(f => f.code === code) || null; }
