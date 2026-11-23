// Quantités « naturelles » : 1 œuf, 1 noisette de beurre, 1 c. à café de sucre, 1 tranche de pain…
// Pur (sans DOM ni état) : testé par tests/portions.test.mjs.
// Chaque unité : { s: singulier, p: pluriel, g: grammes pour 1 unité }. Les grammes restent la référence stockée.

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
const U = (s, p, g) => ({ s, p, g });
const CAF = (g = 5) => U("c. à café", "c. à café", g), SOU = (g = 15) => U("c. à soupe", "c. à soupe", g);

// Règles par mot-clé (ordre important : la première règle qui correspond l'emporte)
const RULES = [
  // Buffet, restaurant, boulangerie, apéro : poids moyens d'une pièce ou d'une portion servie (estimations, ajustables au gramme)
  // Repas de fête, cuisine africaine, antillaise et orientale
  [/^(beignets? africains?|beignet rond)/, [U("beignet", "beignets", 35)]],
  [/^basboussa/, [U("carré", "carrés", 50)]],
  [/^(makrout|makroud)/, [U("makrout", "makrouts", 40)]],
  [/^baklava/, [U("baklava", "baklavas", 30)]],
  [/^corne de gazelle/, [U("corne", "cornes", 30)]],
  [/^(alloco|banane plantain)/, [U("portion", "portions", 100)]],
  [/^attieke/, [U("portion", "portions", 150)]],
  [/^(foutou|fufu)/, [U("boule", "boules", 200)]],
  [/^riz jollof/, [U("bol", "bols", 150), U("assiette", "assiettes", 250)]],
  [/^chou saute/, [U("portion", "portions", 100)]],
  [/^patate douce/, [U("portion", "portions", 150)]],
  [/^accra/, [U("accra", "accras", 20)]],
  [/^salade de chou|coleslaw/, [U("portion", "portions", 100)]],
  [/^poulet, cuisse/, [U("cuisse", "cuisses", 120)]],
  [/^saucisse cocktail/, [U("saucisse", "saucisses", 10)]],
  [/^(saucisse de strasbourg|saucisse de volaille, type knack|knack)/, [U("knack", "knacks", 35)]],
  [/^mini.feuillete|feuilletes? (a la |aux? )?saucisse/, [U("feuilleté", "feuilletés", 25)]],
  [/^(feuillete ou friand|friand)/, [U("friand", "friands", 100)]],
  [/^quatre.quarts/, [U("tranche", "tranches", 50)]],
  [/^gateau marbre/, [U("tranche", "tranches", 50)]],
  [/^gateau au yaourt/, [U("part", "parts", 70)]],
  [/^(gateau genoise|genoise \/ gateau nature)/, [U("part", "parts", 60)]],
  [/^(fraisier|gateau au chocolat type foret noire|tarte ou gateau au citron)/, [U("part", "parts", 120)]],
  [/^california/, [U("california", "californias", 30)]],
  [/^maki\b/, [U("maki", "makis", 20)]],
  [/^nigiri/, [U("nigiri", "nigiris", 30)]],
  [/^temaki/, [U("temaki", "temakis", 80)]],
  [/^sushi ou maki/, [U("maki", "makis", 20), U("sushi (nigiri)", "sushis (nigiris)", 30), U("california", "californias", 30)]],
  [/^sashimi/, [U("tranche", "tranches", 15)]],
  [/^nem\b/, [U("nem", "nems", 50)]],
  [/^rouleau de printemps/, [U("rouleau", "rouleaux", 90)]],
  [/^(ravioli chinois|har gow)/, [U("ravioli vapeur", "raviolis vapeur", 20)]],
  [/^(specialite chinoise type bouchee|siu mai)/, [U("bouchée vapeur", "bouchées vapeur", 25)]],
  [/^samo?u?ssa/, [U("samoussa", "samoussas", 40)]],
  [/^beignet de crevette/, [U("beignet", "beignets", 20)]],
  [/^calamars frits|^calmar.*romaine/, [U("anneau", "anneaux", 10)]],
  [/^yakitori/, [U("brochette", "brochettes", 40)]],
  [/^brochette/, [U("brochette", "brochettes", 100)]],
  [/^(riz cantonais|nouilles (sautees|asiatiques))/, [U("bol", "bols", 150), U("assiette", "assiettes", 250)]],
  [/^soupe miso/, [U("bol", "bols", 200)]],
  [/^pizza/, [U("part", "parts", 80), U("pizza entière", "pizzas entières", 450)]],
  [/^sandwich grec|^kebab/, [U("kebab", "kebabs", 350)]],
  [/^sandwich/, [U("sandwich", "sandwichs", 250)]],
  [/^croque/, [U("croque", "croques", 150)]],
  [/^hot.dog/, [U("hot-dog", "hot-dogs", 150)]],
  [/^(quiche|tarte ou quiche)/, [U("part", "parts", 130)]],
  [/^tarte\b/, [U("part", "parts", 120)]],
  [/^frites/, [U("petite portion", "petites portions", 80), U("portion moyenne", "portions moyennes", 120), U("grande portion", "grandes portions", 160)]],
  [/croquette panee ou nuggets|^nuggets?\b/, [U("nugget", "nuggets", 18)]],
  [/^(merguez|chipolata)/, [U("saucisse", "saucisses", 50)]],
  [/^falafel/, [U("falafel", "falafels", 25)]],
  [/^croissant(?! au jambon)/, [U("croissant", "croissants", 45)]],
  [/^pain au chocolat/, [U("pain au chocolat", "pains au chocolat", 60)]],
  [/^pain aux raisins/, [U("pain aux raisins", "pains aux raisins", 90)]],
  [/^chouquette/, [U("chouquette", "chouquettes", 8)]],
  [/^eclair/, [U("éclair", "éclairs", 80)]],
  [/^flan patissier/, [U("part", "parts", 120)]],
  [/^cookie/, [U("cookie de boulangerie", "cookies de boulangerie", 70), U("petit cookie", "petits cookies", 12)]],
  [/^muffin anglais/, [U("muffin anglais", "muffins anglais", 60)]],
  [/^muffin/, [U("muffin", "muffins", 80)]],
  [/^mousse au chocolat/, [U("pot", "pots", 60), U("ramequin", "ramequins", 100)]],
  [/^ile flottante/, [U("portion", "portions", 150)]],
  [/^creme brulee/, [U("ramequin", "ramequins", 100)]],
  [/^tiramisu/, [U("part", "parts", 100)]],
  [/^dessert glace, type sundae/, [U("sundae", "sundaes", 150)]],
  [/^(glace|sorbet)/, [U("boule", "boules", 50)]],
  [/^milk.shake/, [U("milk-shake moyen", "milk-shakes moyens", 300)]],
  [/^litchi/, [U("litchi", "litchis", 10)]],
  [/^biere/, [U("demi (25 cl)", "demis (25 cl)", 250), U("bouteille (33 cl)", "bouteilles (33 cl)", 330), U("pinte (50 cl)", "pintes (50 cl)", 500)]],
  [/^vin\b/, [U("verre (12,5 cl)", "verres (12,5 cl)", 125)]],
  [/^chips/, [U("poignée", "poignées", 20), U("paquet individuel", "paquets individuels", 30)]],
  [/^saucisson/, [U("rondelle", "rondelles", 5)]],
  [/^olives?\b/, [U("olive", "olives", 4)]],
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
