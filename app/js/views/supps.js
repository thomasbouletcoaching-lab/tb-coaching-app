// Compléments alimentaires et micronutriments : faut-il en prendre, à quelle dose pour ton profil,
// suivi des apports en vitamines et minéraux, prises du jour.
import { S, update, today } from "../store.js";
import * as N from "../nutrition.js";
import { esc, num, fr, buzz, toast, actions, forms, changes, I, seg, sheet, closeSheet, addDays, rerender, premium, lockVeil } from "../core.js";

// ---------- Références journalières (ANSES 2021, adultes ; limites supérieures EFSA) ----------
// kind "min" = à atteindre, "max" = à ne pas dépasser
export function refs(p = S().profile, sp = suppProfile()) {
  const f = p?.sex === "f", old = (p?.age || 30) >= 50, preg = sp.situation === "enceinte", lact = sp.situation === "allaitante", menst = f && !old && !preg;
  const kcal = N.targets()?.kcal || (f ? 2000 : 2500);
  return {
    fib: { n: "Fibres", u: "g", v: 30, kind: "min" },
    ca: { n: "Calcium", u: "mg", v: (p?.age || 30) < 25 ? 1000 : 950, kind: "min" },
    fe: { n: "Fer", u: "mg", v: preg ? 16 : menst ? 16 : 11, kind: "min" },
    mg: { n: "Magnésium", u: "mg", v: f ? 360 : 420, kind: "min" },
    k: { n: "Potassium", u: "mg", v: 3500, kind: "min" },
    zn: { n: "Zinc", u: "mg", v: f ? 9.3 : 11.7, kind: "min" },
    se: { n: "Sélénium", u: "µg", v: 70, kind: "min" },
    iode: { n: "Iode", u: "µg", v: preg || lact ? 200 : 150, kind: "min" },
    va: { n: "Vitamine A", u: "µg", v: lact ? 1300 : f ? 650 : 750, kind: "min" },
    vd: { n: "Vitamine D", u: "µg", v: 15, kind: "min" },
    ve: { n: "Vitamine E", u: "mg", v: f ? 9.9 : 10.5, kind: "min" },
    vk: { n: "Vitamine K", u: "µg", v: 79, kind: "min" },
    vc: { n: "Vitamine C", u: "mg", v: 110, kind: "min" },
    b1: { n: "Vitamine B1", u: "mg", v: f ? 1 : 1.2, kind: "min" },
    b2: { n: "Vitamine B2", u: "mg", v: f ? 1.5 : 1.6, kind: "min" },
    b3: { n: "Vitamine B3", u: "mg", v: f ? 14 : 17, kind: "min" },
    b6: { n: "Vitamine B6", u: "mg", v: f ? 1.5 : 1.8, kind: "min" },
    b9: { n: "Vitamine B9 (folates)", u: "µg", v: preg || sp.situation === "projet" ? 600 : 330, kind: "min" },
    b12: { n: "Vitamine B12", u: "µg", v: preg ? 4.5 : lact ? 5 : 4, kind: "min" },
    o3: { n: "Oméga-3", u: "g", v: Math.round(kcal * .01 / 9 * 10) / 10 + .5, kind: "min" },
    na: { n: "Sodium", u: "mg", v: 2300, kind: "max" },
    sug: { n: "Sucres", u: "g", v: 100, kind: "max" },
    ags: { n: "Graisses saturées", u: "g", v: Math.round(kcal * .12 / 9), kind: "max" },
  };
}
export const suppProfile = () => ({ situation: "aucune", fish: 1, dairy: 2, sun: "peu", sweat: false, labs: {}, ...(S().suppProfile || {}) });
const setSP = (fn) => update(st => { st.suppProfile = st.suppProfile || suppProfile(); fn(st.suppProfile); });

// ---------- Apports moyens (aliments notés + compléments pris) ----------
export function suppMicros(date) {
  const st = S().supps || {}, taken = st.log?.[date] || {}, o = {};
  (st.mine || []).forEach(x => { if (taken[x.id]) for (const [k, v] of Object.entries(x.mic || {})) o[k] = (o[k] || 0) + v; });
  return o;
}
export function microDay(date) {
  const d = N.dayMicros(date), s = suppMicros(date), m = { ...d.m };
  for (const [k, v] of Object.entries(s)) m[k] = (m[k] || 0) + v;
  m.fib = N.dayTotals(date).fib || 0;
  return { m, food: d.m, cover: d.cover, kcal: d.kcal, n: d.n };
}
// Moyenne sur les jours bien notés (au moins 60 % des calories avec des valeurs connues)
export function microAvg(days = 7) {
  const rows = []; for (let i = 0; i < days; i++) { const d = addDays(today(), -i), x = microDay(d); if (x.n && x.cover >= .6 && x.kcal > 600) rows.push(x); }
  if (!rows.length) return null;
  const keys = new Set(rows.flatMap(r => Object.keys(r.m))), m = {}, food = {};
  keys.forEach(k => { m[k] = rows.reduce((a, r) => a + (r.m[k] || 0) / r.cover * (k in r.food ? 1 : r.cover), 0) / rows.length; food[k] = rows.reduce((a, r) => a + (r.food[k] || 0) / r.cover, 0) / rows.length; });
  return { m, food, days: rows.length };
}
const pctOf = (v, r) => r ? Math.round(v / r * 100) : 0;
const fmt = (v, u) => `${fr(v, v < 10 ? 1 : 0)} ${u}`;

// ---------- Catalogue des compléments : utile ou pas, dose pour toi ----------
// status : need (utile pour toi), maybe (selon tes apports), lab (bilan sanguin d'abord), no (pas nécessaire), doc (avis médical)
const winter = () => { const m = new Date().getMonth(); return m >= 9 || m <= 2; };
export function catalog(p = S().profile, sp = suppProfile(), avg = microAvg(14)) {
  const R = refs(p, sp), w = p?.weight || 75, f = p?.sex === "f", vegan = p?.diet === "vegan", vege = p?.diet === "vegetarian" || vegan, preg = sp.situation === "enceinte", lact = sp.situation === "allaitante", proj = sp.situation === "projet";
  const low = (k, t = .7) => avg && avg.food[k] != null && avg.food[k] < R[k].v * t;
  const lowTxt = (k) => avg && avg.food[k] != null ? `Tes repas notés t'apportent en moyenne ${fmt(avg.food[k], R[k].u)} par jour pour un repère de ${fmt(R[k].v, R[k].u)} (${pctOf(avg.food[k], R[k].v)} %).` : "Note tes repas quelques jours pour savoir si tes apports suffisent.";
  const L = sp.labs || {}, T = N.targets(), protAvg = avg ? null : null;
  const vdLab = L.vitd != null ? (L.vitd < 20 ? "carence" : L.vitd < 30 ? "insuffisance" : "ok") : null;
  const out = [
    { id: "vitd", e: "☀️", n: "Vitamine D", mic: { vd: 25 }, unit: "µg", dflt: "1 000 UI (25 µg)",
      st: vdLab === "carence" ? "doc" : vdLab === "ok" ? "no" : (winter() || sp.sun === "peu" || (p?.age || 30) >= 65) ? "need" : "maybe",
      why: vdLab ? `Ton dosage : ${L.vitd} ng/mL (${vdLab === "carence" ? "carence, sous 20" : vdLab === "insuffisance" ? "insuffisance, entre 20 et 30" : "correct, 30 ou plus"}).` : `En France, la peau en fabrique très peu d'octobre à mars, et l'alimentation en apporte peu (poissons gras, œufs). ${winter() ? "On est en période d'hiver." : ""}`,
      dose: vdLab === "carence" ? "Une carence se traite avec ton médecin (doses plus fortes, sur prescription)." : "800 à 2 000 UI par jour (20 à 50 µg), au cours d'un repas, d'octobre à mars, ou toute l'année si tu sors peu.", max: "Ne dépasse pas 4 000 UI (100 µg) par jour sans avis médical.", how: "Avec un repas contenant des graisses. Forme D3 de préférence." },
    { id: "omega3", e: "🐟", n: "Oméga-3 (EPA + DHA)", mic: { o3: .5 }, unit: "mg", dflt: "500 mg EPA + DHA",
      st: sp.fish >= 2 ? "no" : "need",
      why: sp.fish >= 2 ? `Tu manges ${sp.fish} portions de poisson par semaine : c'est suffisant si au moins une est un poisson gras (saumon, maquereau, sardine).` : `Tu manges ${sp.fish || "moins d'une"} portion de poisson par semaine : l'apport en EPA et DHA est probablement bas.${vegan ? " En vegan, prends une huile d'algue." : ""}`,
      dose: `250 à 500 mg d'EPA + DHA par jour${vegan ? " (huile d'algue)" : ""}.`, max: "Jusqu'à 5 g par jour sans risque connu. Sous anticoagulant : avis médical.", how: "Au repas. Mieux encore : 2 portions de poisson par semaine dont une grasse." },
    { id: "mg", e: "🌙", n: "Magnésium", mic: { mg: 200 }, unit: "mg", dflt: "200 mg",
      st: low("mg") ? "need" : avg ? "no" : "maybe", why: lowTxt("mg") + " Sources : oléagineux, légumineuses, céréales complètes, chocolat noir, eaux minérales riches en magnésium.",
      dose: "150 à 250 mg par jour (citrate ou bisglycinate), le soir.", max: "Pas plus de 250 mg par jour en complément (au-delà : troubles digestifs). Maladie des reins : avis médical.", how: "Le soir, au repas." },
    { id: "zn", e: "🛡️", n: "Zinc", mic: { zn: 10 }, unit: "mg", dflt: "10 mg",
      st: vege || low("zn") ? "maybe" : "no", why: lowTxt("zn") + (vege ? " Les régimes végétariens et vegans apportent un zinc moins bien absorbé." : " Sources : viande, fruits de mer, fromage, légumineuses."),
      dose: "5 à 10 mg par jour si tes apports sont bas.", max: "Pas plus de 25 mg par jour au total : au-delà, risque de carence en cuivre.", how: "À distance du fer et du calcium." },
    { id: "fe", e: "🩸", n: "Fer", mic: { fe: 14 }, unit: "mg", dflt: "14 mg",
      st: L.ferritine != null && L.ferritine < 30 ? "doc" : (f && !preg && (p?.age || 30) < 50) || vegan || low("fe", .6) ? "lab" : "no",
      why: `${lowTxt("fe")} ${L.ferritine != null ? `Ta ferritine : ${L.ferritine} µg/L${L.ferritine < 30 ? " (basse)" : ""}.` : ""} Un excès de fer est dangereux : on n'en prend jamais « au cas où ».`,
      dose: "Seulement après une prise de sang (ferritine) et sur conseil de ton médecin.", max: "Pas d'automédication.", how: "Si prescrit : à jeun ou avec de la vitamine C, loin du thé, du café et du calcium." },
    { id: "b12", e: "🌱", n: "Vitamine B12", mic: { b12: 50 }, unit: "µg", dflt: "50 µg",
      st: vegan ? "need" : (vege && low("b12")) || ((p?.age || 30) >= 60 && low("b12")) ? "maybe" : "no",
      why: vegan ? "Indispensable en vegan : la B12 ne se trouve que dans les produits animaux et les aliments enrichis." : lowTxt("b12"),
      dose: vegan ? "25 à 100 µg par jour, ou 1 000 µg deux fois par semaine." : "25 à 50 µg par jour si tes apports sont bas.", max: "Pas de limite connue aux doses habituelles.", how: "Cyanocobalamine, à n'importe quel moment." },
    { id: "iode", e: "🧂", n: "Iode", mic: { iode: 150 }, unit: "µg", dflt: "150 µg",
      st: preg || lact ? "doc" : vegan || (sp.fish < 1 && sp.dairy < 1) ? "maybe" : "no",
      why: preg || lact ? "Les besoins augmentent pendant la grossesse et l'allaitement : un complément est souvent prescrit." : "Sources : poissons, fruits de mer, laitages, œufs et sel iodé. Utilise du sel iodé.",
      dose: "150 µg par jour si tes apports sont bas.", max: "Pas plus de 600 µg par jour. Maladie de la thyroïde : avis médical.", how: "Au repas." },
    { id: "b9", e: "🤰", n: "Acide folique (vitamine B9)", mic: { b9: 400 }, unit: "µg", dflt: "400 µg",
      st: proj || preg ? "need" : "no", why: proj || preg ? "Recommandé à toutes les femmes qui veulent un enfant : il réduit le risque de malformation du tube neural." : "Inutile en complément si tu manges des légumes verts, des légumineuses et des fruits.",
      dose: "400 µg par jour, au moins 1 mois avant la conception et jusqu'à 3 mois de grossesse.", max: "Ton médecin peut prescrire plus selon ton dossier.", how: "Tous les jours, à heure fixe." },
    { id: "ca", e: "🦴", n: "Calcium", mic: { ca: 500 }, unit: "mg", dflt: "500 mg",
      st: low("ca", .6) ? "maybe" : "no", why: lowTxt("ca") + " Priorité à l'alimentation : laitages, eaux riches en calcium, boissons végétales enrichies, tofu.",
      dose: "500 mg maximum par prise, seulement si l'alimentation ne suffit pas.", max: "Avis médical au-delà de 1 000 mg par jour en complément.", how: "Au repas, loin du fer et du zinc." },
    { id: "creatine", e: "⚡", n: "Créatine monohydrate", mic: {}, unit: "g", dflt: `${Math.min(5, Math.max(3, Math.round(w * .05)))} g`,
      st: preg || lact ? "no" : (S().profile?.days || 0) >= 2 ? "need" : "maybe",
      why: "Le complément le plus étudié pour la force et la masse musculaire. Elle remplit les réserves de tes muscles (pas de « charge » nécessaire). Utile aussi en vegan, dont les apports sont faibles.",
      dose: `${Math.min(5, Math.max(3, Math.round(w * .05)))} g par jour pour ${fr(w)} kg, tous les jours, même les jours de repos.`, max: "Sans danger chez l'adulte en bonne santé aux doses habituelles. Maladie des reins : avis médical. Pas pendant la grossesse (manque de données).", how: "N'importe quand, avec de l'eau. Monohydrate, pas besoin d'autre forme." },
    { id: "whey", e: "🥛", n: "Protéine en poudre", mic: {}, unit: "g", dflt: "30 g",
      st: "maybe", why: `Ce n'est qu'un aliment pratique. Utile seulement si tu n'atteins pas ta cible de ${T?.prot || "–"} g de protéines par jour avec tes repas.`,
      dose: "20 à 40 g par prise pour compléter ce qui manque.", max: "Pas de limite propre : compte-la dans tes protéines du jour.", how: "Après la séance ou en collation. Végétale si tu es vegan ou intolérant au lactose." },
    { id: "cafeine", e: "☕", n: "Caféine (avant l'effort)", mic: {}, unit: "mg", dflt: `${Math.round(w * 3 / 10) * 10} mg`,
      st: preg ? "doc" : "maybe", why: "Améliore la performance et réduit la fatigue perçue.",
      dose: `${Math.round(w * 3 / 10) * 10} mg (3 mg par kg) 30 à 60 min avant la séance.`, max: `Pas plus de 400 mg par jour au total (${preg ? "200 mg pendant la grossesse" : "200 mg en une prise"}). Pas après 15 h si tu dors mal.`, how: "Un café ≈ 80 à 100 mg." },
    { id: "fibres", e: "🌾", n: "Fibres (psyllium)", mic: { fib: 5 }, unit: "g", dflt: "5 g",
      st: avg && (avg.m.fib || 0) < 20 ? "maybe" : "no", why: avg ? `Tu manges en moyenne ${fr(avg.m.fib || 0)} g de fibres par jour pour un repère de 30 g.` : "Repère : 30 g par jour (légumes, fruits, légumineuses, céréales complètes).",
      dose: "5 à 10 g par jour avec un grand verre d'eau, en augmentant doucement.", max: "À distance des médicaments (2 h).", how: "Mieux : ajoute légumineuses et légumes." },
    { id: "collagene", e: "🦵", n: "Collagène", mic: {}, unit: "g", dflt: "15 g",
      st: "maybe", why: "Peut aider les tendons quand il est pris avant des exercices ciblés. Les preuves restent limitées.",
      dose: "10 à 15 g avec 50 mg de vitamine C, 30 à 60 min avant ta rééducation ou ta séance.", max: "Sans risque connu.", how: "Ne remplace pas les protéines de tes repas." },
    { id: "electrolytes", e: "💧", n: "Électrolytes", mic: { na: 500 }, unit: "mg", dflt: "500 mg de sodium",
      st: sp.sweat ? "maybe" : "no", why: "Utile pour les efforts de plus de 90 minutes, ou quand tu transpires beaucoup et qu'il fait chaud.",
      dose: "300 à 600 mg de sodium par litre de boisson pendant l'effort.", max: "Hypertension : avis médical.", how: "Pendant l'effort." },
    { id: "multi", e: "💊", n: "Multivitamines", mic: { vc: 80, vd: 5, b9: 200, zn: 5, b12: 2.5, ve: 6 }, unit: "comprimé", dflt: "1 comprimé",
      st: vegan || (T && T.kcal < 1600) ? "maybe" : "no", why: "Inutile si tu manges varié. Peut dépanner pendant un régime très restrictif ou une alimentation peu variée.",
      dose: "1 comprimé par jour dosé autour de 100 % des repères (pas de « mégadoses »).", max: "Attention au cumul avec tes autres compléments.", how: "Au petit-déjeuner." },
    { id: "melatonine", e: "😴", n: "Mélatonine", mic: {}, unit: "mg", dflt: "1 mg",
      st: "doc", why: "Peut aider pour le décalage horaire. Au-delà de 1,9 mg par jour, c'est un médicament en France.",
      dose: "0,5 à 1 mg, 30 min avant le coucher, sur une courte période.", max: "Déconseillée enceinte, allaitante, et avec certains traitements : demande à ton médecin ou à ton pharmacien.", how: "Commence par les bases : lumière le matin, écrans coupés le soir." },
    { id: "ashwa", e: "🌿", n: "Ashwagandha", mic: {}, unit: "mg", dflt: "–",
      st: "doc", why: "L'ANSES a alerté sur des effets indésirables (foie, thyroïde) et la déconseille à plusieurs publics.",
      dose: "Pas sans avis d'un professionnel de santé.", max: "Déconseillée enceinte, allaitante, en cas de maladie de la thyroïde ou de traitement.", how: "–" },
  ];
  return out;
}
const ST = { need: ["✅", "Utile pour toi", "var(--ok,#2E7D32)"], maybe: ["🟡", "Selon tes apports", "#B7791F"], lab: ["🔬", "Bilan sanguin d'abord", "#2B6CB0"], no: ["⚪", "Pas nécessaire", "var(--soft)"], doc: ["🩺", "Avis médical", "var(--red)"] };

// ---------- Vue ----------
let mView = "today", catOpen = null;
export function suppsBody() {
  const sp = suppProfile(), p = S().profile, R = refs(p, sp), d = today(), x = microDay(d), avg = microAvg(7);
  const st = S().supps || {}, mine = st.mine || [], taken = st.log?.[d] || {};
  const src = mView === "today" ? { m: x.m, cover: x.cover } : avg ? { m: avg.m, cover: 1 } : null;
  const order = ["fib", "vd", "mg", "ca", "fe", "zn", "b12", "b9", "iode", "o3", "k", "vc", "va", "ve", "vk", "se", "b1", "b2", "b3", "b6", "na", "sug", "ags"];
  const bar = (k) => { const r = R[k], v = src?.m?.[k] || 0, pc = pctOf(v, r.v), max = r.kind === "max";
    const col = max ? (pc > 100 ? "var(--red)" : "#6B8E23") : pc >= 100 ? "#6B8E23" : pc >= 70 ? "#E0A93B" : "var(--red)";
    return `<div class="row between xs" style="gap:8px;padding:5px 0"><span style="width:118px;flex:none">${esc(r.n)}</span><div class="gauge grow" style="height:8px"><i style="width:${Math.min(100, pc)}%;background:${col}"></i></div><span style="width:104px;text-align:right;flex:none"><b style="color:var(--ink)">${fmt(v, r.u)}</b> <span class="muted">${max ? "max " : "/ "}${fmt(r.v, r.u)}</span></span></div>`; };
  const cat = catalog(p, sp, microAvg(14));
  const need = cat.filter(c => c.st === "need");
  return `<div class="card mt12"><div class="row between"><span class="lbl">💊 Mes compléments du jour</span><button class="link xs" data-a="sp-add">+ Ajouter</button></div>
      ${mine.length ? `<div class="list mt8">${mine.map(m => `<div class="li" style="gap:10px"><button class="rk" data-a="sp-take" data-id="${m.id}" aria-label="Pris" style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line);background:${taken[m.id] ? "var(--gradbtn)" : "var(--paper)"};color:#fff;flex:none">${taken[m.id] ? "✓" : ""}</button><span class="grow small"><b>${esc(m.name)}</b><br><span class="xs muted">${esc(m.dose)}${m.time ? " · " + esc(m.time) : ""}</span></span><button class="icon-btn sm" data-a="sp-del" data-id="${m.id}" aria-label="Retirer">${I.close}</button></div>`).join("")}</div>
        <p class="xs muted mt8" style="margin-bottom:0">${Object.keys(taken).length}/${mine.length} pris aujourd'hui. Ce que tu prends s'ajoute à tes apports ci-dessous.</p>` : `<p class="small muted mt8" style="margin-bottom:0">Ajoute les compléments que tu prends pour cocher tes prises chaque jour.${need.length ? ` D'après ton profil : ${need.map(c => esc(c.n)).join(", ")}.` : ""}</p>`}</div>
    <div class="card mt12"><div class="row between"><span class="lbl">🔬 Vitamines et minéraux</span>${seg([["today", "Jour"], ["avg", "7 j"]], mView, "mv-view")}</div>
      ${src ? `<div class="mt8">${order.map(bar).join("")}</div>
        <p class="xs muted mt8" style="margin-bottom:0">${mView === "today" ? (x.n ? `Valeurs connues pour ${Math.round(x.cover * 100)} % des calories notées aujourd'hui.` : "Note tes repas pour voir tes apports.") : `Moyenne de ${avg.days} jour${avg.days > 1 ? "s" : ""} bien notés.`} Vert : repère atteint. Orange : 70 à 99 %. Rouge : moins de 70 % (ou trop pour sodium, sucres, graisses saturées). Valeurs : table Ciqual (Anses) ; produits de marque : seulement ce que l'étiquette indique.</p>`
        : `<p class="small muted mt8">Note tes repas pendant quelques jours (au moins 60 % des calories avec des aliments de la base) : la moyenne apparaîtra ici.</p>`}</div>
    <h2 class="sec">❓ Faut-il en prendre ? <small>pour ton profil</small></h2>
    <div class="card"><div class="lbl">Mon profil</div>
      <form data-f="sp-prof" class="mt8"><div class="grid2"><label class="field"><span>Situation</span><select name="situation">${[["aucune", "Aucune particulière"], ...(p?.sex === "f" ? [["projet", "Projet de grossesse"], ["enceinte", "Enceinte"], ["allaitante", "J'allaite"]] : [])].map(([v, l]) => `<option value="${v}" ${sp.situation === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field"><span>Poisson par semaine</span><select name="fish">${[0, 1, 2, 3].map(n => `<option value="${n}" ${+sp.fish === n ? "selected" : ""}>${n === 3 ? "3 ou plus" : n}</option>`).join("")}</select></label>
        <label class="field"><span>Laitages par jour</span><select name="dairy">${[0, 1, 2, 3].map(n => `<option value="${n}" ${+sp.dairy === n ? "selected" : ""}>${n === 3 ? "3 ou plus" : n}</option>`).join("")}</select></label>
        <label class="field"><span>Dehors au soleil</span><select name="sun">${[["peu", "Peu"], ["moyen", "Un peu chaque jour"], ["souvent", "Souvent"]].map(([v, l]) => `<option value="${v}" ${sp.sun === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
        <label class="row small mt8" style="gap:8px"><input type="checkbox" name="sweat" ${sp.sweat ? "checked" : ""}> Je transpire beaucoup (efforts longs, chaleur)</label>
        <div class="lbl mt12">Mes analyses de sang (facultatif)</div><div class="grid3 mt4"><label class="field"><span>Vitamine D (ng/mL)</span><input name="vitd" inputmode="decimal" value="${sp.labs.vitd ?? ""}"></label><label class="field"><span>Ferritine (µg/L)</span><input name="ferritine" inputmode="decimal" value="${sp.labs.ferritine ?? ""}"></label><label class="field"><span>B12 (pg/mL)</span><input name="b12" inputmode="decimal" value="${sp.labs.b12 ?? ""}"></label></div>
        <button class="btn btn-line btn-sm mt8" style="width:100%">Mettre à jour</button></form></div>
    ${premium() ? cat.map(c => { const s = ST[c.st], open = catOpen === c.id;
      return `<div class="card mt8"><button class="row between" data-a="sp-open" data-id="${c.id}" style="width:100%;text-align:left;gap:10px"><span style="font-size:24px">${c.e}</span><span class="grow"><b class="small">${esc(c.n)}</b><br><span class="xs" style="color:${s[2]};font-weight:700">${s[0]} ${s[1]}</span></span>${I.chev}</button>
        ${open ? `<p class="small mt8">${esc(c.why)}</p><p class="small" style="margin:6px 0"><b>Dose pour toi :</b> ${esc(c.dose)}</p><p class="xs muted" style="margin:4px 0"><b>Limite :</b> ${esc(c.max)}</p><p class="xs muted" style="margin:4px 0"><b>Comment :</b> ${esc(c.how)}</p>
          ${["need", "maybe"].includes(c.st) && !mine.some(m => m.cat === c.id) ? `<button class="btn btn-line btn-xs mt8" data-a="sp-addcat" data-id="${c.id}">+ Ajouter à mes compléments</button>` : ""}` : ""}</div>`; }).join("")
      : `<div class="card mt8 locked" style="position:relative;min-height:220px"><p class="small">Pour chaque complément (vitamine D, oméga-3, magnésium, zinc, fer, B12, créatine…) : utile ou pas pour toi, la dose adaptée à ton poids et à tes apports, les limites à ne pas dépasser.</p>${lockVeil("Bâtisseur")}</div>`}
    <p class="xs muted mt12">Repères généraux pour adultes en bonne santé (références ANSES et limites de sécurité EFSA). Une carence ne se voit qu'avec une prise de sang. Grossesse, allaitement, maladie, traitement en cours : demande l'avis de ton médecin ou de ton pharmacien avant tout complément.</p>`;
}
actions["mv-view"] = (b, d) => { mView = d.v; rerender(); };
actions["sp-open"] = (b, d) => { catOpen = catOpen === d.id ? null : d.id; rerender(); };
actions["sp-take"] = (b, d) => { update(st => { st.supps = st.supps || {}; const l = (st.supps.log = st.supps.log || {})[today()] = st.supps.log[today()] || {}; if (l[d.id]) delete l[d.id]; else l[d.id] = true; }); buzz(8); rerender(); };
actions["sp-del"] = (b, d) => { if (!confirm("Retirer ce complément de ta liste ?")) return; update(st => st.supps.mine = st.supps.mine.filter(x => x.id !== d.id)); rerender(); };
actions["sp-addcat"] = (b, d) => { const c = catalog().find(x => x.id === d.id); addSupp({ name: c.n, dose: c.dflt, mic: c.mic, cat: c.id }); };
function addSupp(x) { update(st => { st.supps = st.supps || {}; st.supps.mine = [...(st.supps.mine || []), { id: "s" + Date.now(), time: "", ...x }]; }); closeSheet(); toast(`${x.name} ajouté à tes compléments`); rerender(); }
actions["sp-add"] = () => {
  const cat = catalog();
  sheet(`<h2 class="h2">💊 Ajouter un complément</h2><div class="list mt12">${cat.filter(c => c.id !== "ashwa").map(c => `<button class="li" data-a="sp-addcat" data-id="${c.id}"><span class="em">${c.e}</span><span class="grow small"><b>${esc(c.n)}</b><br><span class="xs muted">${esc(c.dflt)}</span></span>${I.plus.replace("<svg", '<svg width="18"')}</button>`).join("")}</div>
    <form data-f="sp-custom" class="mt12"><div class="lbl">Autre complément</div><div class="grid2 mt4"><label class="field"><span>Nom</span><input name="n" maxlength="40" required></label><label class="field"><span>Dose</span><input name="dose" maxlength="30" placeholder="ex. 1 gélule"></label></div><button class="btn btn-red btn-sm mt8" style="width:100%">Ajouter</button></form>`);
};
forms["sp-custom"] = (v) => addSupp({ name: v.n.trim(), dose: v.dose.trim(), mic: {} });
forms["sp-prof"] = (v, f) => { setSP(sp => { sp.situation = v.situation; sp.fish = +v.fish; sp.dairy = +v.dairy; sp.sun = v.sun; sp.sweat = !!f.sweat.checked; const lab = (x) => { const n = num(x); return n > 0 ? n : null; }; sp.labs = { vitd: lab(v.vitd), ferritine: lab(v.ferritine), b12: lab(v.b12), d: today() }; }); toast("Profil mis à jour"); rerender(); };
// Carte compacte pour le journal
export function suppsMini(d) {
  const st = S().supps || {}, mine = st.mine || [], taken = st.log?.[d] || {};
  if (!mine.length) return "";
  return `<div class="card mt12"><div class="row between"><span class="lbl">💊 Compléments</span><button class="link xs" data-a="food-tab" data-v="complements">Détails</button></div><div class="chips wrap mt8">${mine.map(m => `<button class="chip ${taken[m.id] ? "on" : ""}" data-a="sp-take" data-id="${m.id}">${taken[m.id] ? "✓ " : ""}${esc(m.name)}</button>`).join("")}</div></div>`;
}
