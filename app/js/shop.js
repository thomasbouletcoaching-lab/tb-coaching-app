// Courses : quantités à acheter d'après le plan, prix (estimés ou les miens, par magasin), budget de la diète et du foyer.
import { S, update, today } from "./store.js";
import * as N from "./nutrition.js";

const norm = (s) => N.norm(s);
// [id, motif, libellé, rayon, € par kg acheté (prix moyen indicatif), rendement cuit → acheté, poids d'une unité (g), unité, unités]
const SHOP = [
  ["riz", /\briz\b/, "Riz", "Féculents & céréales", 2.2, .37, 0],
  ["pates", /\bpates?\b(?! (a|feuillet|bris|sabl))/, "Pâtes", "Féculents & céréales", 1.6, .4, 0],
  ["semoule", /semoule/, "Semoule", "Féculents & céréales", 1.8, .4, 0],
  ["quinoa", /quinoa/, "Quinoa", "Féculents & céréales", 5, .37, 0],
  ["avoine", /avoine/, "Flocons d'avoine", "Féculents & céréales", 1.6, 1, 0],
  ["pdt", /pomme(s)? de terre/, "Pommes de terre", "Fruits & légumes", 1.5, 1, 0],
  ["pdouce", /patate douce/, "Patates douces", "Fruits & légumes", 3, 1, 0],
  ["pain", /\bpain\b/, "Pain", "Boulangerie", 4.5, 1, 0],
  ["lentilles", /lentille/, "Lentilles", "Légumineuses", 3, .4, 0],
  ["pchiches", /pois chiche/, "Pois chiches", "Légumineuses", 3, .45, 0],
  ["poulet", /poulet|volaille/, "Blanc de poulet", "Volailles & viandes", 11, .75, 0],
  ["dinde", /dinde/, "Escalope de dinde", "Volailles & viandes", 12, .75, 0],
  ["boeuf", /boeuf|steak|hache/, "Bœuf haché 5 %", "Volailles & viandes", 12, .75, 0],
  ["jambon", /jambon/, "Jambon blanc", "Volailles & viandes", 14, 1, 0],
  ["saumon", /saumon/, "Saumon", "Poissons", 24, .8, 0],
  ["cabillaud", /cabillaud|colin|merlu/, "Poisson blanc", "Poissons", 16, .8, 0],
  ["thon", /\bthon\b/, "Thon au naturel", "Poissons", 14, 1, 0],
  ["oeuf", /\boeuf/, "Œufs", "Œufs & laitages", 5.5, 1, 55, "œuf", "œufs"],
  ["skyr", /skyr/, "Skyr", "Œufs & laitages", 4.5, 1, 0],
  ["fb", /fromage blanc/, "Fromage blanc", "Œufs & laitages", 2.6, 1, 0],
  ["yaourt", /yaourt|yogourt/, "Yaourts", "Œufs & laitages", 3, 1, 125, "yaourt", "yaourts"],
  ["lait", /\blait\b(?! de coco)/, "Lait", "Œufs & laitages", 1.1, 1, 0],
  ["soja", /boisson (au )?soja|lait de soja/, "Boisson au soja", "Œufs & laitages", 1.8, 1, 0],
  ["fromage", /fromage|emmental|mozzarella|comte|feta|parmesan/, "Fromage", "Œufs & laitages", 11, 1, 0],
  ["tofu", /tofu/, "Tofu", "Légumineuses", 8, 1, 0],
  ["banane", /banane/, "Bananes", "Fruits", 2.2, 1, 120, "banane", "bananes"],
  ["pomme", /\bpomme\b(?! de terre)/, "Pommes", "Fruits", 2.8, 1, 150, "pomme", "pommes"],
  ["orange", /orange/, "Oranges", "Fruits", 2.5, 1, 150, "orange", "oranges"],
  ["frouges", /fruits rouges|framboise|myrtille|fraise/, "Fruits rouges surgelés", "Fruits", 7, 1, 0],
  ["brocoli", /brocoli/, "Brocoli", "Légumes", 3.5, 1, 0],
  ["hverts", /haricot(s)? vert/, "Haricots verts", "Légumes", 4, 1, 0],
  ["legumes", /legume|courgette|carotte|poivron|epinard|tomate|salade/, "Légumes", "Légumes", 3, 1, 0],
  ["amandes", /amande/, "Amandes", "Fruits secs & oléagineux", 16, 1, 0],
  ["cacahuete", /cacahuete|arachide/, "Beurre de cacahuète", "Fruits secs & oléagineux", 9, 1, 0],
  ["noix", /\bnoix\b/, "Noix", "Fruits secs & oléagineux", 18, 1, 0],
  ["huile", /huile/, "Huile d'olive", "Épicerie", 10, 1, 0],
  ["miel", /miel/, "Miel", "Produits sucrés & desserts", 12, 1, 0],
  ["choco", /chocolat/, "Chocolat noir", "Produits sucrés & desserts", 14, 1, 0],
  ["whey", /whey|proteine en poudre/, "Protéine en poudre", "Épicerie", 28, 1, 0],
];
export function shopRef(name) {
  const n = norm(name);
  const r = SHOP.find(x => x[1].test(n));
  const cooked = /\bcuit|bouilli|poele|roti|saute|vapeur/.test(n) && !/\bcru/.test(n);
  if (r) return { id: r[0], label: r[2], aisle: r[3], eurKg: r[4], factor: cooked ? r[5] : 1, unitG: r[6], u1: r[7], uN: r[8] };
  const f = (N.ciqual() || []).find(x => x.n === name);
  return { id: "x:" + n, label: name.split(",")[0], aisle: f?.cat || "Divers", eurKg: 6, factor: 1, unitG: 0 };
}
// Mes magasins et mes prix : prix payé, poids du paquet, magasin
export const STORES0 = ["Lidl", "Leclerc", "Intermarché"];
export const shopState = () => S().shop || { store: null, stores: STORES0, prices: {}, have: {}, horizon: 7, family: { adults: 1, kids: 0, extra: null } };
export function setShop(fn) { update(st => { st.shop = st.shop || shopState(); fn(st.shop); }); }
export function priceKg(ref) {
  const p = shopState().prices[ref.id];
  if (p?.eur && p?.g) return { eurKg: p.eur / p.g * 1000, mine: true, store: p.store || null };
  return { eurKg: ref.eurKg, mine: false, store: null };
}
// Quantités prévues sur N jours d'après le plan (première option de chaque repas, ou le plan écrit)
export function planNeeds(days = 7, from = today()) {
  const t = N.targets(); if (!t) return { items: [], days };
  const tot = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(from + "T12:00:00"); d.setDate(d.getDate() + i);
    const date = today(d);
    N.dayPlan(t, date).forEach(x => (x.items || []).forEach(it => { if (!it.g) return; const r = shopRef(it.n); const o = tot[r.id] = tot[r.id] || { ref: r, g: 0, raw: 0 }; o.g += it.g; o.raw += it.g * r.factor; }));
  }
  const items = Object.values(tot).map(o => { const pk = priceKg(o.ref); return { ...o, perWeek: o.g / days * 7, cost: o.raw / 1000 * pk.eurKg, mine: pk.mine, store: pk.store }; });
  return { items, days };
}
// Coût de ce qui a été noté dans le journal
export function loggedCost(days = 7) {
  let sum = 0, n = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); const es = N.dayLog(today(d)).filter(e => e.g);
    if (!es.length) continue; n++;
    es.forEach(e => { const r = shopRef(e.label); sum += e.g * r.factor / 1000 * priceKg(r).eurKg; });
  }
  return { perDay: n ? sum / n : null, days: n };
}
export function unitsTxt(ref, g) {
  if (!ref.unitG) return "";
  const u = Math.round(g / ref.unitG * 2) / 2;
  return `${String(u).replace(".", ",")} ${u > 1 ? ref.uN : ref.u1} · `;
}
