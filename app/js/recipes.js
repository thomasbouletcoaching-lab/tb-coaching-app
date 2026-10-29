// Banque de recettes. Valeurs pour 100 g (aliments cuits quand c'est précisé), d'après la table Ciqual (arrondies).
// [nom, kcal, protéines, glucides, lipides, rayon de courses]
export const ING = {
  riz: ["riz (cuit)", 130, 2.7, 28, .3, "Féculents"], rizc: ["riz complet (cuit)", 123, 2.7, 25.6, 1, "Féculents"], pates: ["pâtes (cuites)", 150, 5.2, 30, .9, "Féculents"],
  patesc: ["pâtes complètes (cuites)", 135, 5.5, 26, 1.4, "Féculents"], pdt: ["pommes de terre (cuites)", 80, 1.8, 16.7, .3, "Féculents"], pdouce: ["patate douce (cuite)", 86, 1.6, 20, .1, "Féculents"],
  quinoa: ["quinoa (cuit)", 149, 4.7, 27.9, 1.1, "Féculents"], semoule: ["semoule (cuite)", 112, 3.8, 23, .2, "Féculents"], avoine: ["flocons d'avoine", 370, 13, 58, 7, "Féculents"],
  pain: ["pain complet", 244, 8.4, 44.3, 1.8, "Boulangerie"], tortilla: ["tortilla de blé", 300, 8, 50, 7, "Boulangerie"], wasa: ["pain suédois", 360, 10, 66, 2, "Boulangerie"],
  poulet: ["filet de poulet (cuit)", 160, 31, 0, 3.5, "Viandes & poissons"], dinde: ["escalope de dinde (cuite)", 135, 29, 0, 1.8, "Viandes & poissons"], boeuf: ["bœuf haché 5 % (cuit)", 155, 25.5, 0, 5.8, "Viandes & poissons"],
  steak: ["steak de bœuf (cuit)", 170, 28, 0, 6.5, "Viandes & poissons"], jambon: ["jambon blanc", 115, 20, 1, 3.5, "Viandes & poissons"], saumon: ["saumon (cuit)", 200, 24, 0, 12, "Viandes & poissons"],
  cabillaud: ["cabillaud (cuit)", 105, 23, 0, 1, "Viandes & poissons"], thon: ["thon au naturel", 115, 26, 0, 1, "Viandes & poissons"], crevettes: ["crevettes (cuites)", 99, 22, 0, 1.1, "Viandes & poissons"],
  sardines: ["sardines à l'huile égouttées", 210, 24, 0, 13, "Viandes & poissons"], oeuf: ["œufs", 140, 12.5, .7, 9.8, "Œufs & laitages"], blanc: ["blancs d'œufs", 48, 10.3, .7, .2, "Œufs & laitages"],
  skyr: ["skyr nature", 63, 11, 4, .2, "Œufs & laitages"], fb: ["fromage blanc 0 %", 46, 7.5, 4, .2, "Œufs & laitages"], grec: ["yaourt grec", 97, 9, 4, 5, "Œufs & laitages"],
  lait: ["lait demi-écrémé", 47, 3.4, 4.8, 1.6, "Œufs & laitages"], mozza: ["mozzarella", 250, 18, 1, 19, "Œufs & laitages"], feta: ["feta", 264, 14, 4, 21, "Œufs & laitages"],
  parmesan: ["parmesan", 392, 33, 0, 28, "Œufs & laitages"], cottage: ["cottage cheese", 98, 11, 3.4, 4.3, "Œufs & laitages"], whey: ["protéine en poudre (whey)", 380, 78, 7, 5, "Épicerie"],
  tofu: ["tofu nature", 148, 13.4, 2.9, 8.5, "Végétal"], tempeh: ["tempeh", 192, 19, 8, 11, "Végétal"], lentilles: ["lentilles (cuites)", 104, 9, 12.2, .4, "Végétal"],
  pchiches: ["pois chiches (cuits)", 131, 8, 17, 2.4, "Végétal"], hrouges: ["haricots rouges (cuits)", 110, 8.4, 14, .5, "Végétal"], soja: ["boisson au soja", 40, 3.4, 1.5, 2, "Végétal"],
  legumes: ["légumes de saison", 30, 2, 4, .2, "Fruits & légumes"], brocoli: ["brocoli", 35, 3, 4, .4, "Fruits & légumes"], epinards: ["épinards", 23, 2.9, 1.4, .4, "Fruits & légumes"],
  courgette: ["courgette", 17, 1.2, 2.2, .3, "Fruits & légumes"], poivron: ["poivron", 26, 1, 4.6, .3, "Fruits & légumes"], tomate: ["tomates", 18, .9, 3, .2, "Fruits & légumes"],
  champi: ["champignons", 22, 3, 1, .3, "Fruits & légumes"], oignon: ["oignon", 40, 1.1, 9, .1, "Fruits & légumes"], hverts: ["haricots verts", 30, 1.9, 4.1, .2, "Fruits & légumes"],
  salade: ["salade verte", 15, 1.3, 1.5, .2, "Fruits & légumes"], carotte: ["carottes", 36, .8, 7, .3, "Fruits & légumes"], avocat: ["avocat", 160, 2, 1.8, 15, "Fruits & légumes"],
  banane: ["banane", 90, 1.1, 20, .3, "Fruits & légumes"], pomme: ["pomme", 52, .3, 11.6, .2, "Fruits & légumes"], frouges: ["fruits rouges", 45, 1, 8, .4, "Fruits & légumes"],
  citron: ["citron", 30, .8, 3, .3, "Fruits & légumes"], amandes: ["amandes", 600, 19, 9.5, 51, "Épicerie"], noix: ["noix", 690, 15, 7, 65, "Épicerie"],
  cacahuete: ["beurre de cacahuète", 600, 25, 15, 50, "Épicerie"], huile: ["huile d'olive", 900, 0, 0, 100, "Épicerie"], miel: ["miel", 320, .4, 80, 0, "Épicerie"],
  choco: ["chocolat noir 70 %", 560, 8, 30, 42, "Épicerie"], coco: ["lait de coco léger", 120, 1, 2.5, 11, "Épicerie"], stomate: ["sauce tomate", 45, 1.5, 7, 1, "Épicerie"],
  creme: ["crème légère 15 %", 160, 2.6, 3.6, 15, "Œufs & laitages"], curry: ["épices (curry, paprika…)", 0, 0, 0, 0, "Épicerie"], pesto: ["pesto", 450, 5, 6, 45, "Épicerie"],
  houmous: ["houmous", 300, 8, 14, 24, "Épicerie"], graines: ["graines de chia", 490, 17, 42, 31, "Épicerie"], compote: ["compote sans sucre ajouté", 50, .3, 11, .1, "Épicerie"],
};
// [id, nom, catégorie, émoji, minutes, portions, ingrédients (g pour toutes les portions), étapes, batch?]
const R = [
  ["porridge-banane", "Porridge protéiné banane", "Petit-déjeuner", "🥣", 8, 1, { avoine: 60, lait: 200, whey: 25, banane: 100 }, ["Cuire les flocons dans le lait 4 min en remuant.", "Hors du feu, ajouter la whey.", "Servir avec la banane en rondelles."]],
  ["overnight-oats", "Overnight oats fruits rouges", "Petit-déjeuner", "🫐", 5, 1, { avoine: 50, skyr: 150, lait: 80, frouges: 100, graines: 10 }, ["Mélanger flocons, skyr, lait et chia dans un bocal.", "Une nuit au frigo.", "Ajouter les fruits rouges le matin."], true],
  ["omelette-pain", "Omelette 3 œufs et pain complet", "Petit-déjeuner", "🍳", 8, 1, { oeuf: 165, pain: 60, huile: 5, tomate: 80 }, ["Battre les œufs, saler, poivrer.", "Cuire 3 min dans l'huile chaude.", "Servir avec le pain et les tomates."]],
  ["skyr-bowl", "Bol de skyr, fruits et amandes", "Petit-déjeuner", "🥛", 3, 1, { skyr: 250, frouges: 100, amandes: 20, miel: 10 }, ["Verser le skyr, ajouter fruits, amandes concassées et miel."]],
  ["pancakes-prot", "Pancakes protéinés", "Petit-déjeuner", "🥞", 15, 2, { avoine: 80, blanc: 200, banane: 100, whey: 30, frouges: 120 }, ["Mixer flocons, blancs, banane et whey.", "Cuire des petits pancakes 2 min par face.", "Servir avec les fruits rouges."], true],
  ["tartines-oeufs", "Tartines œufs brouillés avocat", "Petit-déjeuner", "🥑", 10, 1, { pain: 70, oeuf: 110, avocat: 50 }, ["Brouiller les œufs à feu doux.", "Écraser l'avocat sur le pain grillé.", "Déposer les œufs, poivrer."]],
  ["cottage-pomme", "Cottage cheese, pomme et cannelle", "Petit-déjeuner", "🍏", 3, 1, { cottage: 200, pomme: 150, noix: 15 }, ["Couper la pomme en dés, mélanger au cottage, parsemer de noix."]],
  ["smoothie-prot", "Smoothie banane cacahuète", "Petit-déjeuner", "🥤", 3, 1, { lait: 250, banane: 120, whey: 30, cacahuete: 15, avoine: 30 }, ["Tout mixer 30 secondes."]],
  ["porridge-soja", "Porridge vegan chia et banane", "Petit-déjeuner", "🌱", 8, 1, { avoine: 70, soja: 250, banane: 100, graines: 15 }, ["Cuire les flocons dans la boisson soja.", "Ajouter le chia et la banane."]],
  ["wrap-matin", "Wrap œufs, jambon, fromage", "Petit-déjeuner", "🌯", 8, 1, { tortilla: 60, oeuf: 110, jambon: 40, mozza: 20 }, ["Cuire les œufs en omelette fine.", "Garnir la tortilla de jambon, omelette et mozzarella, rouler."]],
  ["riz-poulet-hv", "Riz, poulet, haricots verts", "Plat", "🍗", 25, 4, { riz: 800, poulet: 600, hverts: 800, huile: 30, curry: 5 }, ["Cuire le riz.", "Saisir le poulet en lanières avec les épices.", "Cuire les haricots verts à la vapeur, répartir en 4 boîtes."], true],
  ["bolo-maigre", "Pâtes bolognaise maigre", "Plat", "🍝", 30, 4, { pates: 880, boeuf: 500, stomate: 400, oignon: 100, carotte: 150, huile: 20 }, ["Faire revenir oignon et carotte hachés.", "Ajouter le bœuf, colorer, puis la sauce tomate : 15 min à feu doux.", "Servir sur les pâtes."], true],
  ["chili", "Chili con carne", "Plat", "🌶️", 40, 5, { boeuf: 500, hrouges: 500, stomate: 500, oignon: 150, poivron: 200, riz: 900, curry: 10 }, ["Faire revenir oignon et poivron.", "Ajouter le bœuf, les épices, puis tomates et haricots.", "Mijoter 25 min, servir avec le riz."], true],
  ["sin-carne", "Chili sin carne", "Plat", "🫘", 35, 4, { lentilles: 600, hrouges: 400, stomate: 500, oignon: 150, poivron: 200, riz: 720, curry: 10 }, ["Comme le chili, en remplaçant la viande par les lentilles cuites."], true],
  ["curry-poulet", "Curry de poulet léger", "Plat", "🍛", 30, 4, { poulet: 600, coco: 200, stomate: 200, epinards: 300, oignon: 100, riz: 800, curry: 10 }, ["Dorer oignon et poulet.", "Ajouter curry, tomate, lait de coco : 15 min.", "Incorporer les épinards, servir avec le riz."], true],
  ["saumon-pdouce", "Saumon, patate douce, brocoli", "Plat", "🐟", 30, 2, { saumon: 260, pdouce: 500, brocoli: 400, huile: 10, citron: 30 }, ["Rôtir la patate douce en cubes 25 min à 200 °C.", "Cuire le saumon 12 min au four.", "Brocoli vapeur, citron."], true],
  ["cabillaud-riz", "Cabillaud, riz et légumes", "Plat", "🐠", 20, 2, { cabillaud: 300, riz: 360, courgette: 300, huile: 15, citron: 20 }, ["Cuire le riz.", "Poêler le cabillaud 4 min par face.", "Sauter les courgettes."]],
  ["steak-pdt", "Steak, pommes de terre, salade", "Plat", "🥩", 25, 1, { steak: 150, pdt: 300, salade: 80, huile: 10 }, ["Rôtir les pommes de terre.", "Saisir le steak 2-3 min par face.", "Servir avec la salade."]],
  ["dinde-quinoa", "Dinde, quinoa et légumes rôtis", "Plat", "🦃", 30, 4, { dinde: 560, quinoa: 720, legumes: 800, huile: 30 }, ["Rôtir les légumes 25 min.", "Cuire le quinoa.", "Poêler la dinde en morceaux."], true],
  ["wok-crevettes", "Wok crevettes et nouilles", "Plat", "🍤", 20, 2, { crevettes: 300, pates: 360, poivron: 200, brocoli: 200, huile: 15 }, ["Sauter les légumes à feu vif.", "Ajouter crevettes puis nouilles cuites, 2 min."]],
  ["buddha-bowl", "Buddha bowl pois chiches et tofu", "Plat", "🥗", 25, 2, { pchiches: 250, tofu: 200, quinoa: 300, avocat: 80, epinards: 100, huile: 10 }, ["Rôtir pois chiches et tofu 20 min.", "Dresser sur quinoa et épinards, ajouter l'avocat."], true],
  ["dahl", "Dahl de lentilles corail", "Plat", "🍲", 30, 4, { lentilles: 700, coco: 200, stomate: 300, oignon: 100, riz: 600, curry: 10 }, ["Faire revenir oignon et épices.", "Ajouter lentilles, tomate, coco : 20 min.", "Servir avec le riz."], true],
  ["hachis-light", "Hachis parmentier léger", "Plat", "🥔", 45, 4, { boeuf: 500, pdt: 900, lait: 150, oignon: 100, parmesan: 30 }, ["Écraser les pommes de terre avec le lait.", "Faire revenir le bœuf et l'oignon.", "Monter en couches, parmesan, 20 min au four."], true],
  ["gratin-pates", "Gratin de pâtes thon et brocoli", "Plat", "🧀", 30, 4, { patesc: 800, thon: 280, brocoli: 500, creme: 100, mozza: 100 }, ["Mélanger pâtes cuites, thon, brocoli, crème.", "Couvrir de mozzarella, 15 min à 200 °C."], true],
  ["salade-thon", "Salade thon, œufs, pommes de terre", "Plat", "🥚", 15, 1, { thon: 120, oeuf: 110, pdt: 200, salade: 80, tomate: 100, huile: 10 }, ["Cuire œufs et pommes de terre.", "Assembler avec thon, salade et tomates."]],
  ["poke", "Poke bowl saumon", "Plat", "🍣", 15, 1, { saumon: 120, riz: 200, avocat: 50, carotte: 80, courgette: 60 }, ["Dresser le riz, le saumon en dés et les crudités."]],
  ["fajitas", "Fajitas poulet poivrons", "Plat", "🌮", 25, 2, { poulet: 300, tortilla: 180, poivron: 300, oignon: 100, grec: 100, curry: 5 }, ["Saisir poulet et légumes avec les épices.", "Garnir les tortillas, une cuillère de yaourt grec."]],
  ["burger-maison", "Burger maison", "Plat", "🍔", 20, 1, { steak: 125, pain: 90, mozza: 25, tomate: 50, salade: 20, pdouce: 200 }, ["Cuire le steak.", "Monter le burger.", "Frites de patate douce au four."]],
  ["pizza-wrap", "Pizza tortilla express", "Plat", "🍕", 12, 1, { tortilla: 60, stomate: 60, jambon: 60, mozza: 60, champi: 60 }, ["Garnir la tortilla, 8 min au four à 220 °C."]],
  ["riz-saute-oeufs", "Riz sauté aux œufs et légumes", "Plat", "🍚", 15, 2, { riz: 400, oeuf: 220, legumes: 300, huile: 15 }, ["Sauter les légumes, ajouter le riz froid.", "Pousser sur le côté, brouiller les œufs, mélanger."]],
  ["tempeh-bowl", "Bol tempeh, riz complet, brocoli", "Plat", "🌿", 20, 2, { tempeh: 250, rizc: 360, brocoli: 300, huile: 10 }, ["Dorer le tempeh en tranches.", "Servir avec riz complet et brocoli."], true],
  ["omelette-legumes", "Omelette aux légumes et feta", "Plat", "🫑", 12, 1, { oeuf: 165, courgette: 100, poivron: 80, feta: 30, pain: 50 }, ["Sauter les légumes, verser les œufs battus, émietter la feta."]],
  ["pates-pesto", "Pâtes pesto poulet", "Plat", "🌱", 20, 2, { pates: 440, poulet: 240, pesto: 40, tomate: 150 }, ["Mélanger pâtes chaudes, pesto, poulet poêlé et tomates."]],
  ["couscous", "Couscous poulet légumes", "Plat", "🫓", 40, 4, { semoule: 720, poulet: 560, pchiches: 240, legumes: 800, curry: 10 }, ["Mijoter légumes et pois chiches avec les épices 30 min.", "Ajouter le poulet poêlé, servir avec la semoule."], true],
  ["sardines-tartines", "Tartines sardines et salade", "Plat", "🐟", 5, 1, { pain: 80, sardines: 90, salade: 80, tomate: 100 }, ["Écraser les sardines sur le pain, servir avec la salade."]],
  ["jambon-pdt", "Pommes de terre, jambon, haricots verts", "Plat", "🥔", 20, 1, { pdt: 300, jambon: 120, hverts: 200, huile: 10 }, ["Cuire pommes de terre et haricots, servir avec le jambon."]],
  ["soupe-lentilles", "Soupe lentilles et légumes", "Plat", "🥣", 35, 4, { lentilles: 500, legumes: 800, oignon: 100, pain: 160 }, ["Cuire lentilles et légumes 25 min, mixer en partie.", "Servir avec le pain."], true],
  ["tofu-saute", "Tofu sauté et nouilles", "Plat", "🥢", 20, 2, { tofu: 300, pates: 360, brocoli: 200, poivron: 150, huile: 15 }, ["Dorer le tofu, ajouter légumes et nouilles."]],
  ["quiche-sans-pate", "Quiche sans pâte poulet épinards", "Plat", "🥧", 40, 4, { oeuf: 330, lait: 300, poulet: 300, epinards: 300, mozza: 80 }, ["Battre œufs et lait, ajouter poulet et épinards.", "Cuire 30 min à 180 °C."], true],
  ["fb-amandes", "Fromage blanc, amandes, pomme", "Collation", "🍎", 3, 1, { fb: 200, amandes: 20, pomme: 150 }, ["Servir le fromage blanc avec la pomme et les amandes."]],
  ["skyr-banane", "Skyr et banane", "Collation", "🍌", 2, 1, { skyr: 150, banane: 100 }, ["Servir."]],
  ["shaker", "Shaker whey et fruit", "Collation", "🥤", 2, 1, { whey: 30, lait: 250, pomme: 150 }, ["Mélanger la whey au lait, croquer la pomme."]],
  ["houmous-crudites", "Houmous et crudités", "Collation", "🥕", 5, 1, { houmous: 60, carotte: 150, wasa: 20 }, ["Tremper les crudités dans le houmous."]],
  ["energy-balls", "Energy balls avoine cacahuète", "Collation", "🍫", 15, 8, { avoine: 150, cacahuete: 100, miel: 60, whey: 60, choco: 40 }, ["Mélanger, former 16 boules, 1 h au frigo."], true],
  ["cottage-fruits", "Cottage cheese fruits rouges", "Collation", "🍓", 2, 1, { cottage: 200, frouges: 100 }, ["Servir."]],
  ["oeufs-durs", "Œufs durs et pain suédois", "Collation", "🥚", 10, 1, { oeuf: 110, wasa: 20 }, ["Cuire les œufs 9 min."]],
  ["mousse-choco", "Mousse chocolat protéinée", "Dessert", "🍮", 5, 1, { skyr: 200, whey: 15, choco: 10 }, ["Mélanger le skyr et la whey chocolat, râper le chocolat."]],
  ["crumble-pomme", "Crumble pomme avoine", "Dessert", "🥧", 30, 4, { pomme: 600, avoine: 120, amandes: 40, miel: 30, grec: 400 }, ["Pommes en dés, couvrir d'avoine et amandes mélangées au miel.", "25 min à 180 °C, servir avec le yaourt grec."], true],
  ["banana-bread", "Banana bread protéiné", "Dessert", "🍞", 50, 8, { banane: 400, avoine: 200, oeuf: 165, whey: 60, choco: 40 }, ["Mixer bananes, avoine, œufs et whey.", "Ajouter le chocolat, 40 min à 180 °C."], true],
  ["compote-fb", "Fromage blanc compote", "Dessert", "🍏", 2, 1, { fb: 200, compote: 100 }, ["Servir."]],
];
export const CATS = ["Petit-déjeuner", "Plat", "Collation", "Dessert"];
export function macros(ing, portions = 1) {
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const [k, g] of Object.entries(ing)) { const v = ING[k]; if (!v) continue; kcal += v[1] * g / 100; p += v[2] * g / 100; c += v[3] * g / 100; f += v[4] * g / 100; }
  return { kcal: Math.round(kcal / portions), p: Math.round(p / portions), c: Math.round(c / portions), f: Math.round(f / portions) };
}
export const RECIPES = R.map(([id, n, cat, e, min, portions, ing, steps, batch]) => ({ id, n, cat, e, min, portions, ing, steps, batch: !!batch, m: macros(ing, portions) }));
export const recipe = (id, mine = []) => [...RECIPES, ...mine].find(r => r.id === id);
export const ingLabel = (k) => ING[k]?.[0] || k;
// Aliments ajoutés aux recettes depuis la base complète (Ciqual, Open Food Facts) : gardés dans la recette (ingDef)
export function registerIng(defs = {}) { for (const [k, v] of Object.entries(defs)) if (!ING[k]) ING[k] = v; }
// Liste de courses : agrège les ingrédients, regroupés par rayon
export function shoppingList(items) {
  const tot = {};
  items.forEach(({ r, portions }) => { const f = portions / r.portions; Object.entries(r.ing).forEach(([k, g]) => { tot[k] = (tot[k] || 0) + g * f; }); });
  const byAisle = {};
  Object.entries(tot).forEach(([k, g]) => { const a = ING[k]?.[5] || "Divers"; (byAisle[a] = byAisle[a] || []).push([ingLabel(k), k === "oeuf" ? `${Math.ceil(g / 55)} œufs` : `${Math.round(g / 10) * 10} g`]); });
  return byAisle;
}

// ---------- Budget : prix moyens estimés en supermarché (€ par kg, poids tel qu'utilisé dans la recette ; œufs à l'unité de 55 g) ----------
// Repères moyens France 2026, à ajuster par chacun dans « Mes prix ».
export const PRICE = {
  riz: 1.0, rizc: 1.2, pates: 0.9, patesc: 1.1, pdt: 1.6, pdouce: 3.0, quinoa: 2.8, semoule: 0.9, avoine: 2.2,
  pain: 4.5, tortilla: 6.0, wasa: 8.0,
  poulet: 13, dinde: 13, boeuf: 15, steak: 24, jambon: 14, saumon: 28, cabillaud: 22, thon: 14, crevettes: 22, sardines: 12,
  oeuf: 5.5, blanc: 6, skyr: 4.5, fb: 2.6, grec: 4.2, lait: 1.1, mozza: 9, feta: 13, parmesan: 22, cottage: 7,
  whey: 28, tofu: 8, tempeh: 16, lentilles: 1.8, pchiches: 2.4, hrouges: 2.4, soja: 1.8,
  legumes: 3, brocoli: 3.5, epinards: 4, courgette: 2.8, poivron: 4.5, tomate: 3.2, champi: 5, oignon: 2, hverts: 4, salade: 6, carotte: 1.6, avocat: 8,
  banane: 2.2, pomme: 2.8, frouges: 10, citron: 4,
  amandes: 16, noix: 18, cacahuete: 9, huile: 10, miel: 12, choco: 14, coco: 6, stomate: 3, creme: 4.5, curry: 30, pesto: 15, houmous: 9, graines: 12, compote: 3.5,
};
export const priceOf = (k, mine = {}) => mine[k] ?? PRICE[k] ?? 5;
export function costOf(ing, portions = 1, mine = {}) {
  let c = 0; for (const [k, g] of Object.entries(ing)) c += priceOf(k, mine) * g / 1000; return c / portions;
}
// Liste de courses chiffrée, regroupée par rayon
export function shoppingListPriced(items, mine = {}) {
  const tot = {};
  items.forEach(({ r, portions }) => { const f = portions / r.portions; Object.entries(r.ing).forEach(([k, g]) => { tot[k] = (tot[k] || 0) + g * f; }); });
  const byAisle = {}; let total = 0;
  Object.entries(tot).forEach(([k, g]) => {
    const a = ING[k]?.[5] || "Divers", cost = priceOf(k, mine) * g / 1000; total += cost;
    (byAisle[a] = byAisle[a] || []).push({ k, label: ingLabel(k), qty: k === "oeuf" ? `${Math.ceil(g / 55)} œufs` : `${Math.round(g / 10) * 10} g`, cost });
  });
  return { byAisle, total };
}
// Protéines les moins chères : euros pour 100 g de protéines
export function cheapProteins(mine = {}) {
  return Object.entries(ING).filter(([, v]) => v[2] >= 8).map(([k, v]) => ({ k, label: v[0], eur: priceOf(k, mine) * 100 / v[2] / 10 })).sort((a, b) => a.eur - b.eur);
}

// Recettes ajoutées par le coach (bibliothèque partagée)
export function setCoachRecipes(list) {
  for (let i = RECIPES.length - 1; i >= 0; i--) if (RECIPES[i].coach) RECIPES.splice(i, 1);
  list.forEach(r => RECIPES.push({ ...r, coach: true, batch: !!r.batch, m: macros(r.ing || {}, r.portions || 1) }));
}
