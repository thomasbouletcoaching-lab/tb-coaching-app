// Journal (plan du jour : « Mangé » ou les autres façons de noter), Mon plan modifiable,
// Courses (quantités, prix par magasin, budget de la diète et du foyer), bilan énergétique cumulé.
import { S, update, today, addPhoto } from "../store.js";
import * as N from "../nutrition.js";
import * as RC from "../recipes.js";
import * as EN from "../energy.js";
import * as SH from "../shop.js";
import { esc, num, fr, buzz, toast, actions, forms, changes, go, I, chips, seg, sheet, closeSheet, fmtDate, addDays, hhmm, rerender, premium, lockVeil } from "../core.js";
import { addFoodSheet, scanBarcode, recipePool } from "./food.js";

const eur = (x) => `${(Math.round((x || 0) * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const mac = (it) => `P ${fr(it.p, 1)} · G ${fr(it.c, 1)} · L ${fr(it.f, 1)} g${it.fib != null ? ` · F ${fr(it.fib, 1)} g` : ""} · ${Math.round(it.kcal)} kcal`;
const sumM = (items) => items.reduce((a, i) => ({ kcal: a.kcal + (i.kcal || 0), p: a.p + (i.p || 0), c: a.c + (i.c || 0), f: a.f + (i.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
const ICON = { "Petit-déjeuner": "🥣", "Déjeuner": "🍛", "Collation": "🍎", "Dîner": "🍲" };

// =====================================================================
// JOURNAL
// =====================================================================
const openMod = {};
export function journalMeals(t, d) {
  const plan = t ? N.dayPlan(t, d) : [], log = N.dayLog(d);
  const names = [...plan.map(x => x.meal)];
  N.MEALS.forEach(m => { if (!names.includes(m) && (!plan.length || log.some(e => e.meal === m))) names.push(m); });
  log.forEach(e => { if (!names.includes(e.meal)) names.push(e.meal); });
  return names.map(m => ({ meal: m, plan: plan.find(x => x.meal === m) || null, es: log.filter(e => e.meal === m) }));
}
export function mealCards(t, d) {
  const skips = S().daily[d]?.skip || {};
  return journalMeals(t, d).map(({ meal, plan: x, es }) => {
    const k = es.reduce((a, e) => a + e.kcal, 0), key = esc(meal);
    const head = `<div class="row between"><div><b class="h3">${ICON[meal] || "🍽️"} ${esc(meal)}</b>${es.length ? `<div class="xs muted">${es[0].time || ""} · ${fr(k)} kcal · ${fr(es.reduce((a, e) => a + e.p, 0))} g prot.</div>` : x?.time ? `<div class="xs muted">prévu à ${x.time}</div>` : ""}</div><button class="btn ${es.length || skips[meal] ? "btn-line" : "btn-ghost"} btn-xs" data-a="add-food" data-m="${key}">+ Ajouter</button></div>`;
    if (es.length) return `<div class="card mt12">${head}
      <div class="row mt8" style="gap:8px"><span class="xs muted">🕐 Heure du repas</span><input type="time" class="inp" style="width:116px;font-size:16px;padding:4px 8px" value="${es[0].time || ""}" data-c="mtime" data-m="${key}" data-d="${d}" aria-label="Heure du repas"></div>
      <div class="list mt8">${es.map(e => `<div class="li" style="gap:8px"><span class="grow small">${esc(e.label)}<br><span class="xs muted">${e.g ? fr(e.g) + " g · " : ""}${mac(e)}</span></span><button class="icon-btn" data-a="del-food" data-id="${e.id}" data-d="${d}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>
      <button class="link xs mt8" data-a="save-meal" data-m="${key}" data-d="${d}">⭐ Enregistrer ce repas pour le refaire</button></div>`;
    if (skips[meal]) return `<div class="card mt12">${head}<p class="small muted mt8" style="margin-bottom:0">Repas sauté. <button class="link small" data-a="meal-skip" data-m="${key}" data-d="${d}">Annuler</button></p></div>`;
    if (!x) return `<div class="card mt12">${head}<p class="xs muted mt8" style="margin-bottom:0">Rien de prévu : ajoute ce que tu as mangé.</p></div>`;
    const items = x.items || [], m = x.m || sumM(items), open = openMod[d + meal];
    return `<div class="card mt12">${head}
      <div class="mt8"><b>${esc(x.n)}</b> <span class="small muted">· ${fr(m.kcal)} kcal</span></div><p class="xs muted" style="margin:2px 0 6px">Ce repas : P ${fr(m.p)} g · G ${fr(m.c)} g · L ${fr(m.f)} g</p>
      ${items.map(it => `<div class="row between" style="padding:7px 0;border-bottom:1px dashed var(--line);gap:8px"><span class="small grow">${esc(it.n)}<br><span class="xs muted"><b style="color:var(--ink)">P ${fr(it.p, 1)}</b> · G ${fr(it.c, 1)} · L ${fr(it.f, 1)} g · ${Math.round(it.kcal)} kcal</span></span><span class="small">${it.g ? fr(it.g) + " g" : ""}</span></div>`).join("")}
      <div class="row mt12" style="gap:8px"><button class="btn btn-red btn-sm grow" data-a="meal-eat" data-m="${key}" data-d="${d}">✅ Mangé</button><button class="btn btn-line btn-sm grow" data-a="meal-mod" data-m="${key}" data-d="${d}">${open ? "× Fermer" : "✏️ Modifier"}</button></div>
      ${open ? `<div class="list mt8">${[["mine", "📒", "Un de mes repas ou de ma journée type"], ["say", "✍️", "Le décrire (texte ou voix) 🎙️"], ["photo", "📷", "Le prendre en photo"], ["scan", "🔎", "Scanner un code-barres"], ...(x.poolSize > 1 && !x.mine ? [["other", "🔄", "J'ai pris l'autre option"]] : []), ["qty", "✏️", "Modifier ce repas : quantités, ajouter, retirer"], ["equiv", "🔁", "Un plat équivalent"], ["search", "🔍", "Chercher un aliment"]].map(([k, e, l]) => `<button class="li" data-a="meal-opt" data-k="${k}" data-m="${key}" data-d="${d}"><span class="em">${e}</span><span class="grow small"><b>${l}</b></span>${I.chev}</button>`).join("")}</div>` : ""}
      <div class="center mt8"><button class="link small muted" data-a="meal-skip" data-m="${key}" data-d="${d}" style="text-decoration:underline">Repas sauté</button></div></div>`;
  }).join("");
}
const planOf = (meal, d) => { const t = N.targets(); return t ? N.dayPlan(t, d).find(x => x.meal === meal) : null; };
function logItems(meal, d, items, time) {
  const tm = time || N.dayLog(d).find(e => e.meal === meal)?.time || (d === today() ? hhmm() : planOf(meal, d)?.time || N.MEAL_TIMES[meal] || "12:00");
  items.forEach(it => N.addEntry({ meal, label: it.n, g: it.g || null, kcal: Math.round(it.kcal), p: +(+it.p).toFixed(1), c: +(+it.c).toFixed(1), f: +(+it.f).toFixed(1), ...(it.fib != null ? { fib: it.fib } : {}), time: tm }, d));
  update(st => { const x = st.daily[d]; if (x?.skip) delete x.skip[meal]; });
  delete openMod[d + meal]; buzz(); toast(`${meal} noté`); closeSheet(); rerender();
}
actions["meal-eat"] = (b, d) => { const x = planOf(d.m, d.d); if (!x) return; logItems(d.m, d.d, x.items?.length ? x.items : [{ n: x.n, g: null, ...x.m }], x.time && d.d !== today() ? x.time : null); };
actions["meal-mod"] = (b, d) => { openMod[d.d + d.m] = !openMod[d.d + d.m]; rerender(); };
actions["meal-skip"] = (b, d) => { update(st => { const x = st.daily[d.d] = st.daily[d.d] || {}; x.skip = x.skip || {}; if (x.skip[d.m]) delete x.skip[d.m]; else x.skip[d.m] = true; }); rerender(); };
actions["meal-opt"] = (b, d) => { const f = OPT[d.k]; if (f) f(d.m, d.d); };
const OPT = {
  // Repas enregistrés et repas du plan écrit
  mine(meal, d) {
    const dishes = S().dishes || [], my = S().myPlan?.meals || [];
    sheet(`<h2 class="h2">📒 Mes repas</h2><p class="xs muted">Touche un repas pour le noter au ${esc(meal.toLowerCase())}.</p>
      ${dishes.length ? `<div class="lbl mt12">Repas enregistrés</div><div class="list mt4">${dishes.map((x, i) => `<button class="li" data-a="mo-dish" data-i="${i}" data-m="${esc(meal)}" data-d="${d}"><span class="grow small"><b>${esc(x.n)}</b><br><span class="xs muted">${fr(x.kcal)} kcal · ${fr(x.p)} g P${x.items ? ` · ${x.items.length} aliments` : ""}</span></span>${I.plus.replace("<svg", '<svg width="18"')}</button>`).join("")}</div>` : `<p class="small muted mt12">Dans le journal, « Enregistrer ce repas » le garde ici pour le refaire en un geste.</p>`}
      ${my.length ? `<div class="lbl mt12">Ma journée type</div><div class="list mt4">${my.map((x, i) => `<button class="li" data-a="mo-plan" data-i="${i}" data-m="${esc(meal)}" data-d="${d}"><span class="grow small"><b>${esc(x.name)}</b><br><span class="xs muted">${x.items.map(it => esc(it.label.split(",")[0])).join(", ")} · ${fr(sumM(x.items).kcal)} kcal</span></span>${I.plus.replace("<svg", '<svg width="18"')}</button>`).join("")}</div>` : ""}`);
  },
  // Texte libre ou dictée : « 200 g de riz, 150 g de poulet, 2 œufs »
  say(meal, d, photo = null) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    sheet(`<h2 class="h2">✍️ Décris ton repas</h2>${photo ? `<img src="${photo}" alt="" style="width:100%;border-radius:14px;margin-top:8px;max-height:220px;object-fit:cover">` : ""}
      <p class="xs muted mt4">Une ligne ou une virgule par aliment, avec la quantité : « 200 g de riz, 150 g de poulet, 2 œufs, 1 banane ».${Rec ? "" : " Pour dicter, touche le micro 🎙️ de ton clavier."}</p>
      <textarea id="say-t" class="inp mt8" rows="4" style="text-align:left;height:auto;padding:12px;width:100%;box-sizing:border-box" placeholder="Ex. 250 g de pâtes cuites, 125 g de steak haché, 30 g de parmesan"></textarea>
      <div class="row mt8" style="gap:8px">${Rec ? `<button class="btn btn-line btn-sm" data-a="say-mic" style="width:auto">🎙️ Dicter</button>` : ""}<button class="btn btn-red btn-sm grow" data-a="say-go" data-m="${esc(meal)}" data-d="${d}">Trouver les aliments</button></div><div id="say-r" class="mt12"></div>`);
  },
  // Photo gardée avec le repas, puis on décrit ce qu'il y a dans l'assiette
  photo(meal, d) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.capture = "environment";
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; await addPhoto(f, d, "repas", { meal }); OPT.say(meal, d, URL.createObjectURL(f)); toast("Photo gardée avec ton repas"); };
    inp.click();
  },
  scan(meal, d) { scanBarcode(meal, d, false); },
  // Les autres plats prévus pour ce repas
  other(meal, d) {
    const t = N.targets(), l = N.planOptions(t, d, meal), cur = planOf(meal, d);
    sheet(`<h2 class="h2">🔄 L'autre option</h2><p class="xs muted">Mêmes calories que prévu. Touche celle que tu as prise.</p><div class="list mt12">${l.filter(x => x.n !== cur?.n).map(x => `<button class="li" data-a="mo-other" data-i="${x.i}" data-m="${esc(meal)}" data-d="${d}"><span class="grow small"><b>${esc(x.n)}</b><br><span class="xs muted">${x.lines.join(" · ")}<br>${fr(x.m.kcal)} kcal · ${fr(x.m.p)} g P</span></span>${I.plus.replace("<svg", '<svg width="18"')}</button>`).join("")}</div>`);
  },
  // Modifier le repas prévu : il est noté tel quel, puis on change les grammes, on retire ou on ajoute dans la même fenêtre
  qty(meal, d) {
    const x = planOf(meal, d), items = x?.items?.length ? x.items : x ? [{ n: x.n, g: null, ...x.m }] : [];
    const tm = N.dayLog(d).find(e => e.meal === meal)?.time || (d === today() ? hhmm() : x?.time || N.MEAL_TIMES[meal] || "12:00");
    items.forEach(it => N.addEntry({ meal, label: it.n, g: it.g || null, kcal: Math.round(it.kcal), p: +(+it.p).toFixed(1), c: +(+it.c).toFixed(1), f: +(+it.f).toFixed(1), ...(it.fib != null ? { fib: it.fib } : {}), time: tm }, d));
    delete openMod[d + meal]; rerender(); addFoodSheet(meal);
  },
  // Un plat équivalent : recettes à ± 25 % des calories prévues, dose ajustée
  equiv(meal, d) {
    const x = planOf(meal, d), target = x?.m?.kcal || 600;
    const l = recipePool().map(r => ({ r, por: Math.max(.5, Math.round(target / Math.max(1, r.m.kcal) * 4) / 4) })).filter(({ r, por }) => Math.abs(r.m.kcal * por - target) / target < .25 && por <= 2.5).sort((a, b) => b.r.m.p * b.por - a.r.m.p * a.por).slice(0, 20);
    sheet(`<h2 class="h2">🔁 Un plat équivalent</h2><p class="xs muted">Autour de ${fr(target)} kcal, comme prévu.</p><div class="list mt12">${l.map(({ r, por }) => `<button class="li" data-a="mo-equiv" data-id="${r.id}" data-p="${por}" data-m="${esc(meal)}" data-d="${d}"><span class="em">${r.e}</span><span class="grow small"><b>${esc(r.n)}</b><br><span class="xs muted">${String(por).replace(".", ",")} portion${por > 1 ? "s" : ""} · ${fr(r.m.kcal * por)} kcal · ${fr(r.m.p * por)} g P</span></span>${I.plus.replace("<svg", '<svg width="18"')}</button>`).join("") || `<p class="empty small">Aucun plat proche.</p>`}</div>`);
  },
  search(meal) { addFoodSheet(meal); },
};
actions["mo-dish"] = (b, d) => { const x = S().dishes[+d.i]; logItems(d.m, d.d, x.items?.length ? x.items.map(i => ({ n: i.label, ...i })) : [{ n: x.n, g: null, kcal: x.kcal, p: x.p, c: x.c, f: x.f }]); };
actions["mo-plan"] = (b, d) => { const x = S().myPlan.meals[+d.i]; logItems(d.m, d.d, x.items.map(i => ({ n: i.label, ...i }))); };
actions["mo-other"] = (b, d) => { const t = N.targets(), o = N.planOptions(t, d.d, d.m).find(x => x.i === +d.i); N.chooseDish(d.m, +d.i, d.d); logItems(d.m, d.d, o.items); };
forms["mo-qty"] = (v, f) => {
  const x = planOf(f.dataset.m, f.dataset.d), items = (x.items || []).map((it, i) => { const g = num(v["g" + i]); if (!(g > 0)) return null; const k = g / (it.g || g); return { n: it.n, g, kcal: it.kcal * k, p: it.p * k, c: it.c * k, f: it.f * k }; }).filter(Boolean);
  if (!items.length) return toast("Indique au moins une quantité");
  logItems(f.dataset.m, f.dataset.d, items);
};
actions["mo-equiv"] = (b, d) => { const r = recipePool().find(x => x.id === d.id), p = +d.p; logItems(d.m, d.d, [{ n: `${r.n} (${String(p).replace(".", ",")} portion${p > 1 ? "s" : ""})`, g: null, kcal: r.m.kcal * p, p: r.m.p * p, c: r.m.c * p, f: r.m.f * p }]); };
// Dictée
actions["say-mic"] = (b) => {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Rec) return;
  const r = new Rec(); r.lang = "fr-FR"; r.interimResults = false; b.textContent = "🎙️ J'écoute…";
  r.onresult = (e) => { const t = document.getElementById("say-t"); t.value = (t.value ? t.value + ", " : "") + e.results[0][0].transcript; };
  r.onend = () => { b.textContent = "🎙️ Dicter"; }; r.onerror = () => { b.textContent = "🎙️ Dicter"; toast("Micro indisponible : utilise celui du clavier."); };
  r.start();
};
const UNIT_G = [[/oeuf/, 55], [/banane/, 120], [/pomme(?! de terre)/, 150], [/orange/, 150], [/kiwi/, 80], [/yaourt|yogourt|skyr/, 125], [/tranche/, 35], [/biscotte/, 10], [/carre/, 10], [/cuill(ere)? a soupe|c a s/, 15], [/cuill(ere)? a cafe|c a c/, 5], [/verre/, 200], [/bol/, 250], [/poignee/, 30]];
export function parseMeal(txt) {
  return txt.split(/\n|,|;|\+| et (?=\d|un |une |deux |trois )/i).map(x => x.trim()).filter(Boolean).map(part => {
    const n0 = N.norm(part).replace(/\b(un|une)\b/, "1").replace(/\bdeux\b/, "2").replace(/\btrois\b/, "3").replace(/\bquatre\b/, "4").replace(/\bdemi\b/, "0.5");
    const m = n0.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grammes?|ml|cl|l)?\b/);
    let g = null, name = n0;
    if (m) { const q = +m[1].replace(",", "."), u = m[2] || ""; g = /kg/.test(u) ? q * 1000 : /^l$/.test(u) ? q * 1000 : /cl/.test(u) ? q * 10 : /g|ml/.test(u) ? q : null;
      name = n0.replace(m[0], " ");
      if (g == null) { const ug = UNIT_G.find(([re]) => re.test(n0))?.[1] || 100; g = q * ug; } }
    name = name.replace(/\b(de|d|des|du|la|le|les|tranches?|cuilleres?|a soupe|a cafe|verres?|bols?|poignees?|portions?)\b/g, " ").replace(/\s+/g, " ").trim();
    const found = N.searchFoods(name, 5);
    return { part, name, g: g || 100, cands: found };
  });
}
actions["say-go"] = async (b, d) => {
  await N.loadCiqual(); const txt = document.getElementById("say-t").value.trim(); if (!txt) return toast("Écris ou dicte ton repas.");
  const rows = parseMeal(txt); window.__say = rows;
  document.getElementById("say-r").innerHTML = `<form data-f="say-add" data-m="${esc(d.m)}" data-d="${d.d}">${rows.map((r, i) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="xs muted">« ${esc(r.part)} »</div>${r.cands.length ? `<div class="row mt4" style="gap:6px"><select class="inp grow" name="f${i}" style="text-align:left;font-size:15px">${r.cands.map((c, j) => `<option value="${j}">${esc(c.n)} · ${c.kcal} kcal/100 g</option>`).join("")}<option value="-1">Ne pas ajouter</option></select><input class="inp" name="g${i}" inputmode="decimal" value="${Math.round(r.g)}" style="width:80px"><span class="xs muted">g</span></div>` : `<p class="small red" style="margin:4px 0 0">Pas trouvé : écris-le plus simplement.</p>`}</div>`).join("")}
    <button class="btn btn-red mt12">Ajouter au ${esc(d.m.toLowerCase())}</button></form>`;
};
forms["say-add"] = (v, f) => {
  const items = (window.__say || []).map((r, i) => { const j = +v["f" + i]; if (!r.cands.length || j < 0 || isNaN(j)) return null; const c = r.cands[j], g = num(v["g" + i]) || r.g; const e = N.entryFromFood(c, g, f.dataset.m); N.rememberFood({ n: c.n, kcal: c.kcal, p: c.p, c: c.c, f: c.f, g }); return { n: c.n, g, kcal: e.kcal, p: e.p, c: e.c, f: e.f, fib: e.fib }; }).filter(Boolean);
  if (!items.length) return toast("Rien à ajouter");
  logItems(f.dataset.m, f.dataset.d, items);
};

// =====================================================================
// MON PLAN : la journée type, modifiable
// =====================================================================
const per100 = (it) => it.g ? { k: it.kcal / it.g * 100, p: it.p / it.g * 100, c: it.c / it.g * 100, f: it.f / it.g * 100 } : null;
export function planBody(t) {
  if (!t) return "";
  const P = N.edPlan(), vName = S().editVar ? N.variants().find(v => v.id === S().editVar)?.name : null;
  const vBar = vName ? `<div class="card soft mt12 row between"><span class="small">✏️ Tu modifies : <b>${esc(vName)}</b></span><button class="link xs" data-a="var-done">Revenir au plan principal</button></div>` : "";
  if (!P?.meals?.length) {
    const plan = N.dayPlan(t), tot = sumM(plan.map(x => x.m));
    return vBar + prefsCard() + `<div class="card grad mt12"><div class="lbl">📋 Plan proposé pour toi</div><h2 class="h2 mt4">${fr(tot.kcal)} kcal · ${fr(tot.p)} g de protéines</h2><p class="small mt4">Objectif : ${fr(t.kcal)} kcal · ${t.prot} g P · ${t.carbs} g G · ${t.fat} g L</p></div>
      <p class="small muted mt12">Ce plan change chaque jour pour varier les plats. Pour avoir ta propre journée type, que tu modifies aliment par aliment :</p>
      ${premium() ? `<button class="btn btn-red mt8" data-a="plan-make">✏️ Écrire mon plan à partir de celui-ci</button>` : `<button class="btn btn-line mt8" data-a="go" data-r="offers">🔒 Écrire mon plan (Bâtisseur)</button>`}
      ${plan.map(x => `<div class="card mt12"><div class="lbl">🕐 ${esc(x.time)} · ${esc(x.meal)}</div><b class="small">${esc(x.n)}</b><p class="xs muted" style="margin:4px 0 0">${x.lines.join(" · ")} · ${fr(x.m.kcal)} kcal</p></div>`).join("")}
      <p class="xs muted mt12">Le plan du jour s'affiche dans le Journal : tu notes « Mangé » ou ce que tu as pris à la place.</p>`;
  }
  const tot = sumM(P.meals.flatMap(m => m.items)), diff = Math.round(tot.kcal - t.kcal);
  return vBar + `<div class="card grad mt12"><div class="lbl">📋 ${vName ? esc(vName) : "Mon plan"}</div><h2 class="h2 mt4">${fr(tot.kcal)} kcal · ${fr(tot.p)} g P · ${fr(tot.c)} g G · ${fr(tot.f)} g L</h2>
      <p class="small mt4" style="margin-bottom:0">Objectif ${fr(t.kcal)} kcal · ${t.prot} g P : ${Math.abs(diff) <= 50 ? "dans la cible ✅" : diff > 0 ? `${fr(diff)} kcal au-dessus` : `${fr(-diff)} kcal en dessous`}</p></div>
    ${P.meals.map((m, mi) => { const mm = sumM(m.items); return `<div class="card mt12"><div class="row" style="gap:8px"><input class="inp grow" style="text-align:left;font-weight:800" value="${esc(m.name)}" data-c="pl-name" data-m="${mi}" aria-label="Nom du repas"><input class="inp" type="time" style="width:128px" value="${m.time}" data-c="pl-time" data-m="${mi}" aria-label="Heure"></div>
      <input class="inp mt8" style="text-align:left;font-size:15px" value="${esc(m.title || "")}" data-c="pl-title" data-m="${mi}" placeholder="Nom du plat (facultatif), ex. Riz poulet brocoli">
      <p class="xs muted mt8" style="margin-bottom:4px">Ce repas : ${fr(mm.kcal)} kcal · P ${fr(mm.p)} g · G ${fr(mm.c)} g · L ${fr(mm.f)} g</p>
      ${m.items.map((it, ii) => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)"><span class="grow small">${esc(it.label)}<br><span class="xs muted">P ${fr(it.p, 1)} · G ${fr(it.c, 1)} · L ${fr(it.f, 1)} g · ${Math.round(it.kcal)} kcal</span></span>${it.g ? `<input class="inp" style="width:78px" inputmode="decimal" value="${fr(it.g)}" data-c="pl-g" data-m="${mi}" data-i="${ii}" aria-label="Grammes"><span class="xs muted">g</span>` : ""}<button class="icon-btn sm" data-a="pl-idel" data-m="${mi}" data-i="${ii}" aria-label="Retirer">${I.close}</button></div>`).join("")}
      <div class="row mt8" style="gap:6px;flex-wrap:wrap"><button class="btn btn-ghost btn-xs" data-a="pl-add" data-m="${mi}">+ Aliment</button><button class="btn btn-ghost btn-xs" data-a="pl-addr" data-m="${mi}">+ Recette</button>${P.meals.length > 1 ? `<button class="btn btn-ghost btn-xs" data-a="pl-mdel" data-m="${mi}">Supprimer le repas</button>` : ""}</div></div>`; }).join("")}
    <button class="btn btn-line btn-sm mt12" data-a="pl-madd" style="width:100%">+ Ajouter un repas</button>
    <button class="btn btn-ghost btn-sm mt8" data-a="plan-auto" style="width:100%">Revenir au plan proposé</button>
    <button class="btn btn-ghost btn-sm mt8" data-a="plan-prefs" style="width:100%">🍽️ Changer de modèle de plan (repas, régime)</button>
    <p class="xs muted mt12">Quantités pesées telles que tu les manges (cuites quand c'est précisé). Ton plan s'affiche chaque jour dans le Journal.</p>`;
}
actions["plan-make"] = () => {
  const auto = N.dayPlan(N.targets());
  update(st => N.setEdPlan(st, { meals: auto.map(x => ({ name: x.meal, time: x.time, title: x.n, items: (x.items || []).map(i => ({ label: i.n, g: i.g, kcal: i.kcal, p: i.p, c: i.c, f: i.f })) })) }));
  toast("Ton plan est prêt : modifie-le aliment par aliment"); rerender();
};
changes["pl-g"] = (el) => { const g = num(el.value); if (!(g > 0)) return; update(st => { const it = N.edPlan(st).meals[+el.dataset.m].items[+el.dataset.i], b = per100(it); if (!b) return; it.g = Math.round(g); it.kcal = Math.round(b.k * g / 100); it.p = +(b.p * g / 100).toFixed(1); it.c = +(b.c * g / 100).toFixed(1); it.f = +(b.f * g / 100).toFixed(1); }); rerender(); };
changes["pl-title"] = (el) => update(st => N.edPlan(st).meals[+el.dataset.m].title = el.value.trim());

// Modèle de plan : programmes alimentaires par profil, nombre de repas, régime, exclusions
function prefsCard() {
  const pr = N.planPrefs(), pre = N.PLAN_PRESETS.find(x => x.id === pr.preset);
  const tg = (k, l) => `<button class="chip ${pr[k] ? "on" : ""}" data-a="pp-tg" data-k="${k}">${l}</button>`;
  return `<div class="card mt12"><div class="row between"><span class="lbl">🍽️ Mon modèle de plan</span><button class="link xs" data-a="plan-prefs">Voir les modèles</button></div>
    ${pre ? `<p class="small mt8" style="margin-bottom:0"><b>${pre.e} ${esc(pre.n)}</b><br><span class="xs muted">${esc(pre.d)}</span></p>` : ""}
    <div class="lbl mt12">Repas par jour</div><div class="mt4">${seg([2, 3, 4, 5, 6].map(n => [String(n), String(n)]), String(pr.meals), "pp-meals")}</div>
    <div class="lbl mt12">Régime</div><div class="chips wrap mt4">${N.DIETS.map(([k, l]) => `<button class="chip ${pr.diet === k ? "on" : ""}" data-a="pp-diet" data-v="${k}">${l}</button>`).join("")}</div>
    <div class="chips wrap mt8">${tg("noPork", "Sans porc")}${tg("noGluten", "Sans gluten")}${tg("noLactose", "Sans lactose")}${tg("lowCarb", "Faible en glucides")}</div>
    ${pr.kcalAdj ? `<p class="xs muted mt8" style="margin-bottom:0">+${pr.kcalAdj} kcal par jour ajoutées à ton objectif (${pre ? esc(pre.n.split("·")[0].trim().toLowerCase()) : "ajustement"}). <button class="link xs" data-a="pp-adj0">Retirer</button></p>` : ""}</div>`;
}
actions["plan-prefs"] = () => sheet(`<h2 class="h2">🍽️ Programmes alimentaires</h2><p class="xs muted">Choisis le modèle qui te ressemble : nombre de repas, régime, situation. Tu peux ensuite tout ajuster.</p>
  <div class="list mt12">${N.PLAN_PRESETS.map(x => `<button class="li" data-a="pp-preset" data-id="${x.id}"><span class="em">${x.e}</span><span class="grow small"><b>${esc(x.n)}</b><br><span class="xs muted">${esc(x.d)}</span></span>${N.planPrefs().preset === x.id ? "✓" : I.chev}</button>`).join("")}</div>
  <p class="xs muted mt12">Grossesse, allaitement, maladie, traitement : ces modèles ne remplacent pas l'avis de ton médecin ou d'un diététicien.</p>`);
actions["pp-preset"] = (b, d) => { const x = N.PLAN_PRESETS.find(p => p.id === d.id); N.setPlanPrefs({ meals: 4, diet: S().profile?.diet || "all", noPork: false, noGluten: false, noLactose: false, lowCarb: false, kcalAdj: 0, ...x.p, preset: x.id }); closeSheet(); toast(`Modèle « ${x.n} » appliqué`); rerender(); };
actions["pp-meals"] = (b, d) => { N.setPlanPrefs({ meals: +d.v, preset: null }); rerender(); };
actions["pp-diet"] = (b, d) => { N.setPlanPrefs({ diet: d.v, preset: null }); rerender(); };
actions["pp-tg"] = (b, d) => { N.setPlanPrefs({ [d.k]: !N.planPrefs()[d.k], preset: null }); rerender(); };
actions["pp-adj0"] = () => { N.setPlanPrefs({ kcalAdj: 0 }); rerender(); };

// =====================================================================
// COURSES ET BUDGET
// =====================================================================
export function shopBody() {
  if (!premium()) return `<div class="card mt12 locked" style="position:relative;min-height:300px"><h2 class="h2">🛒 Courses et budget</h2><p class="small muted">Liste de courses d'après ton plan pour 3, 7, 14 ou 30 jours, prix de chaque aliment dans ton magasin, coût de ta diète et budget du foyer.</p>${lockVeil("Bâtisseur")}</div>`;
  const st = SH.shopState(), H = st.horizon || 7;
  const wk = SH.planNeeds(7), weekCost = wk.items.reduce((a, i) => a + i.cost, 0), logged = SH.loggedCost(7);
  const fam = st.family || { adults: 1, kids: 0, extra: null };
  const others = fam.extra != null ? +fam.extra : weekCost * Math.max(0, (fam.adults || 1) - 1) + weekCost * .6 * (fam.kids || 0);
  const foyer = weekCost + others;
  const need = SH.planNeeds(H), byAisle = {};
  need.items.forEach(i => (byAisle[i.ref.aisle] = byAisle[i.ref.aisle] || []).push(i));
  const total = need.items.filter(i => !st.have?.[i.ref.id]).reduce((a, i) => a + i.cost, 0);
  const byStore = {}; need.items.filter(i => !st.have?.[i.ref.id]).forEach(i => { const s = i.mine ? (i.store || "Mes prix") : "Prix moyens (estimés)"; byStore[s] = (byStore[s] || 0) + i.cost; });
  const RCP = S().receipts || [], month = today().slice(0, 7), spent = RCP.filter(r => r.d.startsWith(month)).reduce((a, r) => a + r.amount, 0);
  return `<div class="card mt12"><div class="lbl">💶 Ma diète coûte</div>
      <div class="kpis mt8"><div class="kpi"><b>${eur(weekCost / 7)}</b><span>par jour</span></div><div class="kpi"><b>${eur(weekCost)}</b><span>par semaine</span></div><div class="kpi"><b>${eur(weekCost * 30.4 / 7)}</b><span>par mois</span></div><div class="kpi"><b>${logged.perDay != null ? eur(logged.perDay) : "–"}</b><span>par jour d'après ton journal${logged.days ? ` (${logged.days} j notés)` : ""}</span></div></div>
      <p class="xs muted mt8" style="margin-bottom:0">Pour ton plan (première option de chaque repas). Seulement ce que tu manges, toi.</p></div>
    <div class="card mt12"><div class="lbl">👨‍👩‍👧 Budget du foyer</div>
      <form data-f="shop-fam" class="mt8"><div class="grid3"><label class="field"><span>Adultes</span><input name="adults" inputmode="numeric" value="${fam.adults || 1}"></label><label class="field"><span>Enfants</span><input name="kids" inputmode="numeric" value="${fam.kids || 0}"></label><label class="field"><span>Autres courses (€/sem.)</span><input name="extra" inputmode="decimal" value="${fam.extra ?? ""}" placeholder="auto"></label></div><button class="btn btn-line btn-xs mt8">Recalculer</button></form>
      <div class="kpis mt12"><div class="kpi"><b>${eur(foyer)}</b><span>courses du foyer / semaine</span></div><div class="kpi"><b>${eur(foyer * 30.4 / 7)}</b><span>par mois</span></div></div>
      <p class="xs muted mt8" style="margin-bottom:0">Ta diète ${eur(weekCost)} + les autres ${eur(others)}${fam.extra == null ? " (estimés : un adulte comme toi, un enfant à 60 %)" : ""}.${spent ? ` Tickets notés ce mois-ci : ${eur(spent)}.` : ""}${S().budget?.weekly ? ` Budget fixé : ${eur(S().budget.weekly)} / semaine.` : ""}</p></div>
    <div class="card mt12"><div class="lbl">🏪 Magasin par défaut</div><p class="xs muted mt4">Chaque aliment peut avoir son magasin : ✏️ dans la liste.</p>
      <div class="chips wrap mt8"><button class="chip ${!st.store ? "on" : ""}" data-a="shop-store" data-v="">Prix moyens</button>${(st.stores || SH.STORES0).map(s => `<button class="chip ${st.store === s ? "on" : ""}" data-a="shop-store" data-v="${esc(s)}">${esc(s)}</button>`).join("")}<button class="chip" data-a="shop-newstore">+ Mon magasin</button></div></div>
    <h2 class="sec">🛒 Ma liste de courses</h2>
    ${chips([[3, "3 jours"], [7, "7 jours"], [14, "14 jours"], [30, "1 mois"]].map(([k, l]) => [String(k), l]), String(H), "shop-h")}
    <p class="xs muted mt8">D'après ton plan. Coche ce que tu as déjà. ✏️ : ton prix (prix payé et poids du paquet) et ton magasin.</p>
    ${Object.entries(byAisle).sort().map(([a, l]) => `<div class="card mt12"><b class="h3">${esc(a)}</b>${l.sort((x, y) => x.ref.label.localeCompare(y.ref.label, "fr")).map(i => { const have = st.have?.[i.ref.id]; return `<div class="row" style="gap:10px;padding:10px 0;border-top:1px solid var(--line);${have ? "opacity:.45" : ""}"><button class="rk" data-a="shop-have" data-id="${esc(i.ref.id)}" aria-label="Déjà acheté" style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--line);background:${have ? "var(--gradbtn)" : "var(--paper)"};color:#fff;flex:none">${have ? "✓" : ""}</button>
        <span class="grow" style="min-width:0"><b class="small">${esc(i.ref.label)}</b><br><span class="xs muted">${SH.unitsTxt(i.ref, i.g)}${fr(i.g)} g${i.ref.factor !== 1 ? ` · à acheter ≈ ${fr(i.raw)} g cru` : ""}${i.store ? ` · 🛒 ${esc(i.store)}` : ""}<br>≈ ${fr(i.perWeek)} g par semaine</span></span>
        <span class="xs" style="text-align:right;white-space:nowrap"><b class="small">${eur(i.cost)}</b><br><span class="muted">${i.mine ? "mon prix" : "estimé"}</span></span><button class="icon-btn sm" data-a="shop-price" data-id="${esc(i.ref.id)}" data-l="${esc(i.ref.label)}" aria-label="Mon prix">✏️</button></div>`; }).join("")}</div>`).join("") || `<p class="empty small">Ton plan n'a pas encore d'aliments pesés.</p>`}
    <div class="card mt12"><b class="h3">Total de la liste (${H} jours) : ≈ ${eur(total)}</b>${Object.entries(byStore).sort((a, b) => b[1] - a[1]).map(([s, v]) => `<div class="row between small mt4"><span>🛒 ${esc(s)}</span><b>${eur(v)}</b></div>`).join("")}
      <p class="xs muted mt8" style="margin-bottom:0">Estimation : la taille des paquets achetés change le montant réel. Riz, pâtes et légumineuses prévus cuits : le prix est celui du produit acheté cru.</p>
      ${Object.keys(st.have || {}).length ? `<button class="link xs mt8" data-a="shop-reset">Tout décocher</button>` : ""}</div>`;
}
actions["shop-h"] = (b, d) => { SH.setShop(s => s.horizon = +d.v); rerender(); };
actions["shop-have"] = (b, d) => { SH.setShop(s => { s.have = s.have || {}; if (s.have[d.id]) delete s.have[d.id]; else s.have[d.id] = true; }); buzz(8); rerender(); };
actions["shop-reset"] = () => { SH.setShop(s => s.have = {}); rerender(); };
actions["shop-store"] = (b, d) => { SH.setShop(s => s.store = d.v || null); rerender(); };
actions["shop-newstore"] = () => { const n = prompt("Nom du magasin"); if (!n?.trim()) return; SH.setShop(s => { s.stores = [...new Set([...(s.stores || SH.STORES0), n.trim()])]; s.store = n.trim(); }); rerender(); };
actions["shop-price"] = (b, d) => {
  const st = SH.shopState(), p = st.prices[d.id] || {}, ref = { id: d.id };
  sheet(`<h2 class="h2">✏️ ${esc(d.l)}</h2><p class="xs muted">Recopie le prix et le poids du paquet que tu achètes (poids cru pour le riz, les pâtes, la viande).</p>
    <form data-f="shop-price" data-id="${esc(d.id)}" class="mt12"><div class="grid2"><label class="field"><span>Prix payé (€)</span><input name="eur" inputmode="decimal" value="${p.eur != null ? String(p.eur).replace(".", ",") : ""}" required></label><label class="field"><span>Poids du paquet (g)</span><input name="g" inputmode="numeric" value="${p.g || ""}" placeholder="1000" required></label></div>
    <div class="lbl mt12">Magasin</div><div class="chips wrap mt8">${(st.stores || SH.STORES0).map(s => `<label class="chip ${(p.store || st.store) === s ? "on" : ""}"><input type="radio" name="store" value="${esc(s)}" ${(p.store || st.store) === s ? "checked" : ""} hidden>${esc(s)}</label>`).join("")}</div>
    <button class="btn btn-red mt12">Enregistrer</button>${st.prices[d.id] ? `<button type="button" class="btn btn-line mt8" data-a="shop-pdel" data-id="${esc(d.id)}">Revenir au prix estimé</button>` : ""}</form>`, (w) => w.querySelectorAll('input[name="store"]').forEach(r => r.addEventListener("change", () => w.querySelectorAll("label.chip").forEach(l => l.classList.toggle("on", l.contains(r) && r.checked)))));
  void ref;
};
forms["shop-price"] = (v, f) => { const e = num(v.eur), g = num(v.g); if (!(e > 0 && g > 0)) return toast("Indique le prix et le poids"); SH.setShop(s => s.prices[f.dataset.id] = { eur: e, g, store: v.store || s.store || null }); closeSheet(); toast(`Prix enregistré : ${eur(e / g * 1000)} le kg`); rerender(); };
actions["shop-pdel"] = (b, d) => { SH.setShop(s => delete s.prices[d.id]); closeSheet(); rerender(); };
forms["shop-fam"] = (v) => { SH.setShop(s => s.family = { adults: Math.max(1, Math.round(num(v.adults)) || 1), kids: Math.max(0, Math.round(num(v.kids)) || 0), extra: v.extra.trim() ? num(v.extra) : null }); rerender(); };

// =====================================================================
// BILAN ÉNERGÉTIQUE CUMULÉ (dans Corps)
// =====================================================================
let balMode = "week", balOff = 0;
function dayExpense(d) {
  const D = S().daily[d] || {}, t = N.targets();
  if (D.steps == null && !(D.cardio || []).length) return t?.maintenance || EN.breakdown(d).tdee;
  return EN.breakdown(d).tdee;
}
function periodOf() {
  const t = today();
  if (balMode === "week") { const mon = addDays(t, -((new Date().getDay() + 6) % 7) + 7 * balOff); return { from: mon, to: addDays(mon, 6), label: `Semaine du ${fmtDate(mon, { day: "numeric", month: "long" })}` }; }
  const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() + balOff); const from = today(x); x.setMonth(x.getMonth() + 1); x.setDate(0);
  return { from, to: today(x), label: new Date(from + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
}
function dualChart(rows) {
  if (rows.length < 2) return `<p class="empty small">La courbe apparaît après deux journées notées.</p>`;
  const W = 340, H = 170, pl = 38, pr = 10, pt = 12, pb = 22, all = rows.flatMap(r => [r.in, r.out]), lo = Math.min(...all) * .95, hi = Math.max(...all) * 1.02;
  const x = (i) => pl + i * (W - pl - pr) / Math.max(1, rows.length - 1), y = (v) => pt + (1 - (v - lo) / (hi - lo || 1)) * (H - pt - pb);
  const path = (k) => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(r[k]).toFixed(1)}`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Apport et dépense par jour"><text x="${pl - 6}" y="${y(hi) + 4}" fill="var(--soft)" font-size="11" text-anchor="end">${Math.round(hi)}</text><text x="${pl - 6}" y="${y(lo) + 4}" fill="var(--soft)" font-size="11" text-anchor="end">${Math.round(lo)}</text>
    <path d="${path("out")}" fill="none" stroke="var(--soft)" stroke-width="2" stroke-dasharray="5 4"/><path d="${path("in")}" fill="none" stroke="var(--red)" stroke-width="3" stroke-linejoin="round"/>
    ${rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.in)}" r="3" fill="var(--red)"/>`).join("")}
    <text x="${pl}" y="${H - 4}" fill="var(--soft)" font-size="11">${rows[0].l}</text><text x="${W - pr}" y="${H - 4}" fill="var(--soft)" font-size="11" text-anchor="end">${rows.at(-1).l}</text></svg>
    <div class="season-key mt4"><span><i style="background:var(--red)"></i>mangé</span><span><i style="background:var(--soft)"></i>dépensé</span></div>`;
}
export function balanceCard(lineChart) {
  const t = N.targets(); if (!t) return "";
  const P = periodOf(), days = [];
  for (let d = P.from; d <= P.to && d <= today(); d = addDays(d, 1)) days.push(d);
  const rows = days.map(d => { const log = N.dayLog(d), tot = N.dayTotals(d), meals = new Set(log.map(e => e.meal)).size; return { d, l: `${d.slice(8)}/${d.slice(5, 7)}`, noted: log.length > 0, full: tot.kcal >= t.kcal * .6 || meals >= 3, in: Math.round(tot.kcal), out: Math.round(dayExpense(d)), p: tot.p, c: tot.c, f: tot.f }; });
  const full = rows.filter(r => r.full && r.d < today() || (r.full && r.d === today() && new Date().getHours() >= 21));
  const bal = full.reduce((a, r) => a + r.in - r.out, 0), avgIn = full.length ? full.reduce((a, r) => a + r.in, 0) / full.length : 0, avgOut = full.length ? full.reduce((a, r) => a + r.out, 0) / full.length : 0;
  const ws = Object.entries(S().daily).filter(([k, v]) => v.weight && k >= P.from && k <= P.to).sort();
  const real = ws.length >= 2 ? ws.at(-1)[1].weight - ws[0][1].weight : null;
  let cum = 0; const cumRows = full.map(r => ({ y: (cum += r.in - r.out), l: r.l }));
  // À ce rythme : moyenne des 28 derniers jours complets
  const last = []; for (let i = 1; i <= 28; i++) { const d = addDays(today(), -i), tot = N.dayTotals(d); if (tot.kcal >= t.kcal * .6 || new Set(N.dayLog(d).map(e => e.meal)).size >= 3) last.push(tot.kcal - dayExpense(d)); }
  const perDay = last.length >= 5 ? last.reduce((a, b) => a + b, 0) / last.length : null, perWeekKg = perDay != null ? perDay * 7 / 7700 : null;
  const goal = S().profile?.goal;
  return `<div class="card mt12"><div class="row between"><span class="lbl">⚡ Bilan énergétique</span>${seg([["week", "Semaine"], ["month", "Mois"]], balMode, "bal-mode")}</div>
    <div class="row between mt12"><button class="icon-btn sm" data-a="bal-nav" data-v="-1" aria-label="Précédent">‹</button><b class="h3">${esc(P.label.charAt(0).toUpperCase() + P.label.slice(1))}</b><button class="icon-btn sm" data-a="bal-nav" data-v="1" aria-label="Suivant" ${balOff >= 0 ? "disabled style=\"opacity:.3\"" : ""}>›</button></div>
    <div class="kpis mt12"><div class="kpi"><b>${full.length ? fr(avgIn) : "–"}</b><span>kcal / jour (moy.)</span></div><div class="kpi"><b>${full.length ? fr(avgOut) : "–"}</b><span>dépense / jour</span></div>
      <div class="kpi"><b class="${bal > 0 ? "red" : ""}">${full.length ? (bal > 0 ? "+" : "") + fr(bal) : "–"}</b><span>${bal > 0 ? "surplus" : "déficit"} cumulé (kcal)</span></div><div class="kpi"><b>${full.length ? (bal > 0 ? "+" : "") + fr(bal / 7700, 2) + " kg" : "–"}</b><span>équivalent estimé</span></div></div>
    ${full.length ? `<p class="small mt8" style="margin-bottom:4px">Moyenne / jour : P ${fr(full.reduce((a, r) => a + r.p, 0) / full.length)} g · G ${fr(full.reduce((a, r) => a + r.c, 0) / full.length)} g · L ${fr(full.reduce((a, r) => a + r.f, 0) / full.length)} g</p>` : ""}
    <p class="xs muted" style="margin:0">${rows.filter(r => r.noted).length} jour${rows.filter(r => r.noted).length > 1 ? "s" : ""} noté${rows.filter(r => r.noted).length > 1 ? "s" : ""} · bilan calculé sur ${full.length} journée${full.length > 1 ? "s" : ""} complète${full.length > 1 ? "s" : ""}${real != null ? ` · poids réel : <b style="color:var(--ink)">${real > 0 ? "+" : ""}${fr(real, 1)} kg</b>` : ""}</p>
    <div class="lbl mt16">Apport et dépense par jour</div><div class="mt8">${dualChart(full)}</div>
    <div class="lbl mt16">Bilan cumulé (kcal)</div><div class="mt8">${lineChart(cumRows, { yfmt: (v) => (v > 0 ? "+" : "") + Math.round(v) })}</div>
    ${perWeekKg != null ? `<div class="card soft mt12"><b>📉 À ce rythme</b> (${perDay > 0 ? "+" : ""}${fr(perDay)} kcal / jour en moyenne sur ${last.length} jours) : <b>${perWeekKg > 0 ? "+" : ""}${fr(perWeekKg, 2)} kg par semaine</b>, soit ${perWeekKg > 0 ? "+" : ""}${fr(perWeekKg * 4, 1)} kg en 4 semaines et ${perWeekKg > 0 ? "+" : ""}${fr(perWeekKg * 12, 1)} kg en 12 semaines.<br><span class="xs muted">${goal === "fat" ? (perWeekKg > -.2 ? "Un peu lent pour perdre du gras : vise un déficit de 300 à 500 kcal par jour." : perWeekKg < -1 ? "Rapide : attention à ton muscle, remonte un peu." : "Bon rythme pour perdre du gras en gardant ton muscle.") : goal === "muscle" ? (perWeekKg < .1 ? "Trop juste pour prendre du muscle : ajoute 150 à 200 kcal par jour." : perWeekKg > .5 ? "Rapide : une partie sera du gras." : "Bon rythme de prise de muscle.") : "Compare avec ta balance : si l'écart est grand, ta dépense réelle est différente de l'estimation."} 7 700 kcal ≈ 1 kg.</span></div>` : `<p class="xs muted mt12">La projection « à ce rythme » apparaît après 5 journées complètes.</p>`}</div>`;
}
actions["bal-mode"] = (b, d) => { balMode = d.v; balOff = 0; rerender(); };
actions["bal-nav"] = (b, d) => { balOff = Math.min(0, balOff + +d.v); rerender(); };
