// Quantités « naturelles » : 1 œuf, 1 noisette de beurre, 1 c. à café de sucre, 1 tranche de pain…
// Pur (sans DOM ni état) : testé par tests/portions.test.mjs.
// Chaque unité : { s: singulier, p: pluriel, g: grammes pour 1 unité }. Les grammes restent la référence stockée.

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
const U = (s, p, g) => ({ s, p, g });
const CAF = (g = 5) => U("c. à café", "c. à café", g), SOU = (g = 15) => U("c. à soupe", "c. à soupe", g);

// Règles par mot-clé (ordre important : la première règle qui correspond l'emporte)
const RULES = [
  [/^blanc d.?oeuf|^oeuf, blanc/, [U("blanc d'œuf", "blancs d'œuf", 33)]],
  [/^jaune d.?oeuf|^oeuf, jaune/, [U("jaune d'œuf", "jaunes d'œuf", 18)]],
  [/^oeufs?\b(?!.*(paques|chocolat))/, [U("œuf", "œufs", 55), U("gros œuf", "gros œufs", 65), U("petit œuf", "petits œufs", 45)]],
  [/^beurre de cacahuete|^pate d.?arachide|^puree d.?(amande|noisette|cajou)/, [CAF(6), SOU(16)]],
  [/^beurre\b/, [U("noisette de beurre", "noisettes de beurre", 5), U("noix de beurre", "noix de beurre", 15), CAF(5), SOU(15), U("plaquette de 10 g", "plaquettes de 10 g", 10)]],
  [/^margarine|^matiere grasse/, [U("noisette", "noisettes", 5), CAF(5), SOU(15)]],
  [/^huile\b/, [CAF(4), SOU(13), U("filet", "filets", 5)]],
  [/^sucre\b|^cassonade|^vergeoise/, [U("morceau de sucre", "morceaux de sucre", 5), CAF(5), SOU(12)]],
  [/^miel\b|^confiture|^sirop d.?erable|^pate a tartiner|^nutella|^gelee/, [CAF(8), SOU(20)]],
  [/^creme (fraiche|de lait|epaisse|liquide|legere)/, [CAF(5), SOU(15)]],
  [/^mayonnaise|^ketchup|^moutarde|^sauce|^vinaigrette|^pesto/, [CAF(5), SOU(15)]],
  [/^(poudre de )?proteine|whey|^isolat|^caseine/, [U("dose", "doses", 30), SOU(10)]],
  [/^cacao|^farine|^maizena|^levure/, [CAF(4), SOU(10)]],
  [/^(graine|chia|lin\b|sesame)/, [CAF(4), SOU(10)]],
  [/^flocon|avoine|^muesli|^granola|^cereales? pour petit/, [SOU(10), U("bol", "bols", 40)]],
  [/^pain de mie/, [U("tranche", "tranches", 25)]],
  [/^baguette|^pain, baguette/, [U("baguette entière", "baguettes entières", 250), U("quart de baguette", "quarts de baguette", 60), U("tranche", "tranches", 20)]],
  [/^pain\b|^biscotte|^pain grille|^wasa/, [U("tranche", "tranches", 30)]],
  [/^tortilla|^wrap/, [U("tortilla", "tortillas", 60)]],
  [/^jambon|^blanc de (dinde|poulet)|^bacon|^bresaola|^viande des grisons|^filet de bacon/, [U("tranche", "tranches", 40)]],
  [/steak hache|^boeuf, hache/, [U("steak de 100 g", "steaks de 100 g", 100), U("steak de 125 g", "steaks de 125 g", 125)]],
  [/^poulet, filet|^filet de poulet|^(dinde|poulet|veau), escalope|^escalope/, [U("filet", "filets", 120)]],
  [/^yaourt|^yogourt|^skyr|^dessert lacte/, [U("pot", "pots", 125)]],
  [/^petit.suisse/, [U("petit-suisse", "petits-suisses", 60)]],
  [/^fromage blanc/, [U("pot de 100 g", "pots de 100 g", 100), SOU(30)]],
  [/^compote/, [U("pot", "pots", 100)]],
  [/^mozzarella/, [U("boule", "boules", 125)]],
  [/^parmesan|rape\b/, [SOU(6), U("poignée", "poignées", 20)]],
  [/^(camembert|brie|chevre|comte|emmental|gouda|cheddar|fromage|feta|roquefort|reblochon|raclette|tomme|cantal|mimolette|saint)/, [U("portion", "portions", 30), U("tranche", "tranches", 20)]],
  [/^lait\b|^boisson (au soja|a base|d.?amande|d.?avoine|vegetale)/, [U("verre", "verres", 200), U("bol", "bols", 250)]],
  [/^jus\b|^soda|^cola|^nectar/, [U("verre", "verres", 200)]],
  [/^cafe\b|^the\b|^infusion/, [U("tasse", "tasses", 150)]],
  [/^banane\b/, [U("banane", "bananes", 120)]],
  [/^pomme\b(?!.*de terre)/, [U("pomme", "pommes", 150)]],
  [/^poire\b/, [U("poire", "poires", 160)]],
  [/^orange\b/, [U("orange", "oranges", 150)]],
  [/^(clementine|mandarine)/, [U("clémentine", "clémentines", 60)]],
  [/^kiwi\b/, [U("kiwi", "kiwis", 75)]],
  [/^(peche|nectarine|brugnon)/, [U("pêche", "pêches", 140)]],
  [/^abricot/, [U("abricot", "abricots", 45)]],
  [/^datte/, [U("datte", "dattes", 8)]],
  [/^(fraise|framboise|myrtille|fruits rouges|raisin\b)/, [U("poignée", "poignées", 80), U("barquette", "barquettes", 250)]],
  [/^avocat/, [U("demi-avocat", "demi-avocats", 75), U("avocat", "avocats", 150)]],
  [/^tomate cerise/, [U("tomate cerise", "tomates cerises", 15)]],
  [/^tomate\b/, [U("tomate", "tomates", 120)]],
  [/^carotte\b/, [U("carotte", "carottes", 100)]],
  [/^(pomme de terre|patate douce)/, [U("pomme de terre moyenne", "pommes de terre moyennes", 150)]],
  [/^(oignon|echalote)/, [U("oignon", "oignons", 100)]],
  [/^courgette/, [U("courgette", "courgettes", 200)]],
  [/^concombre/, [U("concombre", "concombres", 300)]],
  [/^(amande|noix|noisette|cajou|pistache|cacahuete|arachide|melange de fruits a coque)/, [U("poignée (30 g)", "poignées (30 g)", 30), U("pièce", "pièces", 1.2)]],
  [/^chocolat/, [U("carré", "carrés", 5), U("tablette", "tablettes", 100)]],
  [/^(riz|pates|spaghetti|semoule|quinoa|boulgour|coquillette|lentille|pois chiche|haricot)/, [U("assiette", "assiettes", 200), SOU(20)]],
];

// Unités proposées pour un aliment (portion vendue à l'unité en premier)
export function unitsFor(food) {
  const out = [], n = norm(food?.n || food?.label || "");
  if (food?.ug) out.push(U("portion", "portions", +food.ug));
  const hit = RULES.find(([re]) => re.test(n));
  if (hit) hit[1].forEach(u => { if (!out.some(o => o.s === u.s)) out.push(u); });
  return out;
}
// « 2 œufs », « ½ banane », « 1 c. à soupe »
export function fmtQty(n, u) {
  const q = Math.round(n * 100) / 100, txt = q === 0.5 ? "½" : q === 0.25 ? "¼" : q === 1.5 ? "1 ½" : String(q).replace(".", ",");
  return `${txt} ${q > 1 ? u.p : u.s}`;
}
export const gramsOf = (n, u) => Math.round(n * u.g * 10) / 10;

// Quantité habituelle : on garde les dernières prises d'un aliment et on propose la plus fréquente (la plus récente en cas d'égalité)
export function addHabit(h, g, u = null) {
  const l = [{ g: Math.round(g * 10) / 10, ...(u ? { u } : {}) }, ...((h && h.l) || [])].slice(0, 8);
  return { l };
}
export function usualOf(h) {
  const l = h?.l || []; if (!l.length) return null;
  const k = (x) => `${x.g}|${x.u ? x.u.n + x.u.s : ""}`, cnt = {};
  l.forEach(x => { cnt[k(x)] = (cnt[k(x)] || 0) + 1; });
  let best = l[0]; l.forEach(x => { if (cnt[k(x)] > cnt[k(best)]) best = x; });
  return { ...best, times: cnt[k(best)] };
}
