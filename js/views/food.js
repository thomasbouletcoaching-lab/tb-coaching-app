// Nutrition : journal (heures des repas), favoris, repas enregistrés, plan écrit, recettes, batch cooking,
// jeûne, dépense calorique (MB, NEAT, EAT, TEF, TDEE), corps (poids, projection, mensurations, photos).
import { S, update, today, addPhoto, listPhotos, deletePhoto, updatePhoto } from "../store.js";
import { nutriCard, levelSelector, nutriLevel } from "./nutri-detail.js";
import * as N from "../nutrition.js";
import * as RC from "../recipes.js";
import * as EN from "../energy.js";
import { $app, esc, num, fr, buzz, toast, routes, R, actions, forms, changes, go, I, header, tabbar, chips, seg, sheet, closeSheet, lockVeil, lineChart, barChart, hbars, ring, gradDef, premium, rank, fmtDate, addDays, hhmm, rerender, modeBar } from "../core.js";
import * as E from "../engine.js";
import { kbSection } from "./more.js";
import { caloriesCard } from "./home.js";
import { pushStats } from "../sync.js";
import * as ML from "./meals.js";
import * as SP from "./supps.js";

let tab = "journal", day = null, mode = "journal";
const TABS = [["journal", "🍽️ Journal"], ["favoris", "⭐ Mes aliments"], ["plan", "📋 Mon plan"], ["semaine", "🗓️ Semaine type"], ["recettes", "👩‍🍳 Recettes"], ["batch", "🥡 Batch cooking"], ["complements", "💊 Compléments"], ["budget", "🛒 Courses et budget"]];
const MODES = [["journal", "Journal"], ["explorer", "Explorer"], ["savoir", "Connaissances"]];
const D = () => day || today();
const FREE_RECIPES = 10;
const recipeOpen = (r) => premium() || r.mine || RC.RECIPES.indexOf(r) < FREE_RECIPES;
const myRecipes = () => (S().myRecipes || []).map(r => { RC.registerIng(r.ingDef); return { ...r, mine: true, m: RC.macros(r.ing, r.portions) }; });
const allRecipes = () => [...myRecipes(), ...RC.RECIPES];
export const recipePool = () => allRecipes().filter(recipeOpen);

// Le jour d'entraînement ou de repos vient de l'agenda (séance faite ou prévue)
N.setDayKind((d) => { const a = E.agenda(d, d)[d]; return a && ["done", "planned", "missed"].includes(a.st) ? "train" : "rest"; });

routes.food = async () => {
  await Promise.all([N.loadModels(), E.loadPrograms()]); N.loadCiqual().catch(() => { });
  // anciens onglets, déplacés : jeûne → Récupération, dépense et corps → Profil
  if (R.param === "jeune") return go("recup");
  if (R.param === "depense") return go("moncorps");
  if (R.param === "corps") return go("body");
  if (R.param === "explorer" || R.param === "savoir") mode = R.param;
  else if (R.param && TABS.some(t => t[0] === R.param)) { tab = R.param; mode = "journal"; }
  const t = N.dayTarget(D()), t0 = N.targets();
  let body;
  if (mode === "explorer") body = exploreBody();
  else if (mode === "savoir") body = await kbSection("nutri");
  else if (tab === "journal") body = journalBody(t);
  else if (tab === "favoris") body = favBody();
  else if (tab === "plan") body = ML.planBody(t0);
  else if (tab === "semaine") body = weekBody(t0);
  else if (tab === "recettes") body = recipesBody();
  else if (tab === "batch") body = batchBody();
  else if (tab === "budget") body = ML.shopBody() + (premium() ? `<h2 class="sec">💶 Mes dépenses réelles</h2>` + budgetBody() : "");
  else if (tab === "complements") { await N.loadCiqual(); await N.loadMicro(); body = SP.suppsBody(); }
  else body = journalBody(t);
  $app.innerHTML = header("Nutrition", t ? `${fr(t.kcal)} kcal · ${t.prot} g de protéines${t.kcal !== t.base ? " aujourd'hui" : ""}` : "") + `<main class="page">${modeBar(MODES, mode, "food-mode")}${mode === "journal" ? `<div class="mt8">${chips(TABS, tab, "food-tab")}</div>` : ""}${body}</main>${tabbar("food")}`;
  if (mode === "journal" && tab === "recettes" || mode === "explorer") bindRecipeSearch();
  if (tab === "budget") { const i = document.getElementById("prq"); i?.addEventListener("input", () => { prQ = i.value; document.getElementById("prl").innerHTML = priceRows(N.norm(prQ)); }); }
};
actions["food-mode"] = (b, d) => { mode = d.v; R.param = null; history.replaceState(null, "", "#/food" + (d.v === "journal" ? "" : "/" + d.v)); rerender(false); window.scrollTo(0, 0); };
actions["food-tab"] = (b, d) => { if (d.v === "learn") { mode = "savoir"; return rerender(false); } tab = d.v; mode = "journal"; R.param = d.v; history.replaceState(null, "", "#/food/" + d.v); rerender(false); window.scrollTo(0, 0); };
actions["food-day"] = (b, d) => { const n = addDays(D(), +d.v); day = n >= today() ? null : n; rerender(); };

// ---------- Explorer : programmes alimentaires et recettes ----------
function exploreBody() {
  const pr = N.planPrefs();
  return `<h2 class="sec">🍽️ Programmes alimentaires</h2><p class="small muted">Un modèle pour ton profil : nombre de repas, régime, situation. Ton plan du jour se construit dessus, et tu peux tout modifier au gramme.</p>
    <div class="list">${N.PLAN_PRESETS.map(x => `<button class="li" data-a="pp-preset" data-id="${x.id}"><span class="em">${x.e}</span><span class="grow small"><b>${esc(x.n)}</b><br><span class="xs muted">${esc(x.d)}</span></span>${pr.preset === x.id ? `<span class="tag r">Actif</span>` : I.chev}</button>`).join("")}</div>
    <p class="xs muted mt8">Grossesse, allaitement, maladie, traitement : ces modèles ne remplacent pas l'avis de ton médecin ou d'un diététicien.</p>
    <h2 class="sec">👩‍🍳 Recettes</h2>${recipesBody()}`;
}

// ---------- Mes aliments : favoris, achetés souvent, récents ----------
function favBody() {
  const fav = S().favFoods || [], rec = (S().recentFoods || []).filter(f => !N.isFavFood(f.n)).slice(0, 15), mine = (S().myFoods || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 30);
  const meal = mealNow();
  const li = (f, src, i) => `<div class="li"><button class="grow" style="text-align:left" data-a="fav-pick" data-src="${src}" data-i="${i}"><span class="small"><b>${esc(f.n)}</b></span><br><span class="xs muted">${f.kcal != null ? `${f.kcal} kcal · ${fr(f.p, 1)} g prot. / 100 g` : f.eur ? `${String(f.eur).replace(".", ",")} € · ${esc(f.shop || "")}` : "Touche pour le trouver"}</span></button><button class="icon-btn" data-a="fav-pick" data-src="${src}" data-i="${i}" aria-label="Ajouter">${I.plus}</button></div>`;
  return `<p class="small muted mt12">Touche un aliment pour l'ajouter au <b>${esc(meal.toLowerCase())}</b>. L'étoile ☆ dans la recherche le met ici.</p>
    <h2 class="sec">⭐ Favoris</h2>${fav.length ? `<div class="list">${fav.map((f, i) => li(f, "fav", i)).join("")}</div>` : `<p class="empty small">Aucun favori. Dans la recherche d'aliments, touche ☆ à côté d'un aliment.</p>`}
    ${mine.length ? `<h2 class="sec">🛒 Ceux que j'achète <small>tickets de caisse</small></h2><div class="list">${mine.map((f, i) => li(f, "mine", i)).join("")}</div>` : ""}
    ${rec.length ? `<h2 class="sec">🕘 Récents</h2><div class="list">${rec.map((f, i) => li(f, "recent", i)).join("")}</div>` : ""}
    <button class="btn btn-line btn-sm mt16" data-a="go" data-r="food" data-p="budget" style="width:100%">🧾 Ajouter un ticket de caisse</button>`;
}
const mealNow = () => { const h = new Date().getHours(); return h < 10 ? "Petit-déjeuner" : h < 15 ? "Déjeuner" : h < 18 ? "Collation" : "Dîner"; };
actions["fav-pick"] = (b, d) => {
  const list = d.src === "fav" ? S().favFoods : d.src === "recent" ? S().recentFoods : (S().myFoods || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0));
  const f = list[+d.i]; if (!f) return; const meal = mealNow();
  if (f.kcal == null) { afs.query = f.n; afs.tab = "search"; return addFoodSheet(meal); }
  gramsSheet(f, (e) => { N.addEntry(e, D()); toast(`Ajouté au ${meal.toLowerCase()}`); rerender(); }, meal);
};

// ---------- Semaine type : même plan, jours d'entraînement / repos, ou un plan par jour ; cheat meal ----------
function weekBody(t) {
  if (!t) return "";
  const W = N.weekType(), V = N.variants();
  const opt = (sel) => [["main", "Plan principal"], ...V.map(v => [v.id, v.name])].map(([id, n]) => `<option value="${id}" ${sel === id ? "selected" : ""}>${esc(n)}</option>`).join("");
  const mon = N.mondayOf(today()), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const rows = days.map((k, i) => { const dt = N.dayTarget(k), kind = N.dayKind(k), ch = N.cheatOn(k).length; return `<div class="li"><span class="em">${ch ? "🍕" : kind === "train" ? "🏋️" : "😌"}</span><span class="grow small"><b>${E.DAY_NAMES[i]}</b> ${k === today() ? "<span class=\"tag r\">Aujourd'hui</span>" : ""}<br><span class="xs muted">${ch ? "Cheat meal" : kind === "train" ? "Entraînement" : "Repos"}${dt.notes.length ? " · " + esc(dt.notes.join(" · ")) : ""}</span></span><b class="num">${fr(dt.kcal)}</b></div>`; }).join("");
  const total = days.reduce((a, k) => a + N.dayTarget(k).kcal, 0);
  const cs = N.cheats().filter(c => c.d >= addDays(today(), -7));
  return `<div class="card mt12"><div class="lbl">🗓️ Ma semaine type</div>
      <div class="mt8">${seg([["same", "Tous pareils"], ["trainrest", "Entraînement / repos"], ["days", "Par jour"]], W.mode, "wt-mode")}</div>
      ${W.mode === "same" ? `<p class="small muted mt8" style="margin-bottom:0">Le même plan chaque jour. Choisis « Entraînement / repos » pour manger un peu plus les jours de séance et un peu moins les jours off, sans changer ta moyenne.</p>` : ""}
      ${W.mode === "trainrest" ? `<div class="lbl mt12">Calories en plus les jours d'entraînement</div><div class="chips wrap mt4">${[0, 5, 10, 15, 20].map(p => `<button class="chip ${W.pct === p ? "on" : ""}" data-a="wt-pct" data-v="${p}">+${p} %</button>`).join("")}</div>
        <p class="xs muted mt4">Les jours de repos baissent d'autant : ta semaine garde le même total. Les glucides suivent (protéines inchangées).</p>
        <div class="grid2 mt8"><label class="field"><span>🏋️ Plan des jours d'entraînement</span><select class="inp" data-c="wt-train">${opt(W.train)}</select></label><label class="field"><span>😌 Plan des jours de repos</span><select class="inp" data-c="wt-rest">${opt(W.rest)}</select></label></div>` : ""}
      ${W.mode === "days" ? `<div class="list mt8">${E.DAY_NAMES.map((n, i) => `<div class="li"><span class="grow small"><b>${n}</b></span><select class="inp" style="width:auto;font-size:15px" data-c="wt-day" data-i="${i}">${opt(W.days?.[i] || "main")}</select></div>`).join("")}</div>` : ""}
      ${W.mode !== "same" ? `<div class="lbl mt12">Mes variantes de plan</div>
        ${V.length ? `<div class="list mt4">${V.map(v => `<div class="li"><span class="grow small"><b>${esc(v.name)}</b><br><span class="xs muted">${v.meals.length} repas · ${fr(v.meals.flatMap(m => m.items).reduce((a, x) => a + (x.kcal || 0), 0))} kcal</span></span><button class="btn btn-line btn-xs" data-a="var-edit" data-id="${v.id}">Modifier</button><button class="icon-btn" data-a="var-del" data-id="${v.id}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>` : ""}
        <button class="btn btn-line btn-sm mt8" data-a="var-new" style="width:100%">+ Créer une variante (copie de mon plan)</button>` : ""}</div>

    <h2 class="sec">🍕 Plaisirs du mois</h2>
    <div class="card"><p class="small muted" style="margin-top:0">Programme tes cheat meals à l'avance, à la date de ton choix, avec les aliments de ton journal : chaque plaisir est calculé comme tes repas. L'app répartit la compensation sur le mois, sans toucher à ton plan de la semaine.</p>
      <button class="btn btn-red btn-sm" data-a="cheat-new" style="width:100%">+ Programmer un cheat meal</button>
      ${cs.length ? `<div class="list mt12">${cs.map(c => cheatLi(c)).join("")}</div>` : `<p class="xs muted mt8">Aucun plaisir programmé pour l'instant.</p>`}</div>

    <h2 class="sec">📊 Cette semaine <small>${fr(total)} kcal · moyenne ${fr(total / 7)}</small></h2>
    <div class="list">${rows}</div>
    <p class="xs muted mt8">La compensation d'un cheat meal est répartie sur le mois, et se limite à 15 % de tes calories par jour : au-delà, mieux vaut un repas plaisir plus petit qu'une semaine de restriction.</p>`;
}
const setWT = (fn) => update(st => { st.weekType = { ...N.weekType(), ...(st.weekType || {}) }; fn(st.weekType); });
actions["wt-mode"] = (b, d) => { setWT(w => { w.mode = d.v; if (d.v !== "same" && !(S().planVariants || []).length && S().myPlan?.meals?.length) { /* rien : l'utilisateur crée ses variantes */ } }); rerender(); };
actions["wt-pct"] = (b, d) => { setWT(w => w.pct = +d.v); rerender(); };
changes["wt-train"] = (el) => { setWT(w => w.train = el.value); rerender(); };
changes["wt-rest"] = (el) => { setWT(w => w.rest = el.value); rerender(); };
changes["wt-day"] = (el) => { setWT(w => { w.days = w.days || Array(7).fill("main"); w.days[+el.dataset.i] = el.value; }); rerender(); };
actions["var-new"] = () => {
  const n = prompt("Nom de la variante", N.weekType().mode === "trainrest" ? "Jour de repos" : "Week-end"); if (!n?.trim()) return;
  const base = S().myPlan?.meals?.length ? S().myPlan.meals : N.dayPlan(N.targets()).map(x => ({ name: x.meal, time: x.time, title: x.n, items: (x.items || []).map(i => ({ label: i.n, g: i.g, kcal: i.kcal, p: i.p, c: i.c, f: i.f })) }));
  const id = "v" + Date.now();
  update(st => { st.planVariants = [...(st.planVariants || []), { id, name: n.trim(), meals: JSON.parse(JSON.stringify(base)) }]; const w = st.weekType = { ...N.weekType(), ...(st.weekType || {}) }; if (w.mode === "trainrest" && (!w.rest || w.rest === "main")) w.rest = id; st.editVar = id; });
  tab = "plan"; toast("Variante créée : modifie-la aliment par aliment"); rerender(); window.scrollTo(0, 0);
};
actions["var-edit"] = (b, d) => { update(st => st.editVar = d.id); tab = "plan"; rerender(); window.scrollTo(0, 0); };
actions["var-done"] = () => { update(st => st.editVar = null); tab = "semaine"; rerender(); };
actions["var-del"] = (b, d) => { if (!confirm("Supprimer cette variante ?")) return; update(st => { st.planVariants = (st.planVariants || []).filter(v => v.id !== d.id); const w = st.weekType; if (w) { if (w.train === d.id) w.train = "main"; if (w.rest === d.id) w.rest = "main"; w.days = (w.days || []).map(x => x === d.id ? "main" : x); } if (st.editVar === d.id) st.editVar = null; }); rerender(); };
// ---------- Cheat meal : aliments calculés comme ceux du journal ----------
let CH = null; // brouillon : { d, items: [{ label, g, kcal, p, c, f, fib, mic }] }
const cheatKcal = (items) => items.reduce((a, x) => a + (x.kcal || 0), 0);
const cheatLabel = (x) => typeof x === "string" ? x : x.label;
function cheatLi(c) {
  const names = (c.items || []).map(cheatLabel).join(", ") || "Plaisirs à définir";
  return `<div class="li"><span class="em">🍕</span><span class="grow small"><b>${fmtDate(c.d, { weekday: "long", day: "numeric", month: "long" })}</b><br><span class="xs muted">${esc(names)}${c.kcal ? ` · ${fr(c.kcal)} kcal` : " · calories non calculées"}</span></span><button class="icon-btn" data-a="cheat-del" data-id="${c.id}" aria-label="Supprimer">${I.close}</button></div>`;
}
function openCheatSheet() {
  const items = CH.items, total = cheatKcal(items);
  sheet(`<h2 class="h2">Cheat meal</h2>
    <label class="field mt8"><span>Date</span><input id="ch-d" type="date" min="${today()}" max="${addDays(today(), 120)}" value="${CH.d}"></label>
    <div class="lbl mt12">Au menu</div>
    <div class="list mt4">${items.length ? items.map((x, i) => `<div class="li"><span class="grow small"><b>${esc(x.label)}</b><br><span class="xs muted">${fr(x.g)} g · ${fr(x.kcal)} kcal · ${fr(x.p)} g P</span></span><button class="icon-btn" data-a="cheat-rm" data-v="${i}" aria-label="Retirer">${I.close}</button></div>`).join("") : `<p class="xs muted">Ajoute tes plaisirs ci-dessous.</p>`}</div>
    <p class="mt8"><b>${fr(total)} kcal</b> <span class="xs muted">au total</span></p>
    <div class="search mt12">${I.search}<input id="ch-q" placeholder="Pizza, tiramisu, vin rouge…" autocomplete="off"></div>
    <div id="ch-r" class="mt8"></div>
    <form data-f="cheat" class="mt16"><input type="hidden" name="d" id="ch-hd" value="${CH.d}"><button class="btn btn-red" style="width:100%" ${items.length ? "" : "disabled"}>Programmer ce cheat meal</button></form>`, (w) => {
    const dInp = w.querySelector("#ch-d"), hd = w.querySelector("#ch-hd");
    dInp.addEventListener("change", () => { CH.d = dInp.value; hd.value = dInp.value; });
    const q = w.querySelector("#ch-q"), r = w.querySelector("#ch-r"); let deb;
    q.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(() => {
      const term = q.value.trim(); if (!term) { r.innerHTML = ""; return; }
      const found = N.searchFoods(term).slice(0, 8);
      r.innerHTML = found.length ? `<div class="list">${found.map((f, i) => `<button class="li" data-cf="${i}"><span class="grow small">${esc(f.n)}</span><span class="xs muted">${fr(f.kcal)} kcal/100 g</span></button>`).join("")}</div>` : `<p class="xs muted">Rien dans la table pour « ${esc(term)} ».</p>`;
      r.querySelectorAll("[data-cf]").forEach(b => b.addEventListener("click", () => {
        const food = found[+b.dataset.cf];
        gramsSheet(food, (e) => { CH.items = [...CH.items, { label: e.label, g: e.g, kcal: e.kcal, p: e.p, c: e.c, f: e.f, ...(e.fib != null ? { fib: e.fib } : {}), ...(e.mic ? { mic: e.mic } : {}) }]; openCheatSheet(); }, "Plaisir");
      }));
    }, 140); });
  });
}
actions["cheat-new"] = () => { CH = { d: addDays(today(), 1), items: [] }; openCheatSheet(); };
actions["cheat-rm"] = (b, d) => { CH.items = CH.items.filter((_, i) => i !== +d.v); openCheatSheet(); };
forms.cheat = (v) => {
  const d = v.d || (CH && CH.d);
  if (!d || d < today()) return toast("Choisis une date à venir");
  const items = CH?.items || [];
  if (!items.length) return toast("Ajoute au moins un aliment");
  update(st => st.cheats = [...(st.cheats || []), { id: Date.now(), d, at: today(), items, kcal: Math.round(cheatKcal(items)) }]);
  CH = null; buzz(); closeSheet(); toast("Cheat meal programmé : il est dans ton agenda"); rerender();
};
actions["nutri-level"] = (b, d) => { update(st => { st.settings = { ...(st.settings || {}), nutriLevel: d.v, simpleNutri: d.v === "simple" }; }); rerender(); };
actions["cheat-del"] = (b, d) => { update(st => st.cheats = (st.cheats || []).filter(c => c.id !== +d.id)); rerender(); };

// Profil → « Mesures et photos » et « Mon corps » (dépense, déficit, projection)
routes.body = async () => {
  await N.loadModels();
  $app.innerHTML = header("Mesures et photos", "Poids, mensurations, photos datées", { back: "profile" }) + `<main class="page">${await bodyBody()}</main>${tabbar("body")}`;
};
routes.moncorps = async () => {
  await N.loadModels(); day = null;
  $app.innerHTML = header("Mon corps", "Dépense, déficit et projection", { back: "profile" }) + `<main class="page">${ML.balanceCard(lineChart)}${burnBody()}</main>${tabbar("body")}`;
};

// Sucres et sel du jour : repères OMS (sucres ajoutés < 50 g, sel < 5 g). Ici, sucres totaux des aliments.
function sugarSaltCard(d) {
  const x = N.sugarSalt(d); if (!x.total) return "";
  const bar = (v, max, col) => `<div class="gauge grow"><i style="width:${Math.min(100, Math.round(v / max * 100))}%;background:${v > max ? "var(--warn)" : col}"></i></div>`;
  return `<div class="card mt12"><div class="row between xs" style="gap:8px"><span style="width:96px">🍬 Sucres <b style="color:var(--ink)">${x.sug} g</b></span>${bar(x.sug, 50, "#C98A2B")}</div>
    <div class="row between xs mt8" style="gap:8px"><span style="width:96px">🧂 Sel <b style="color:var(--ink)">${fr(x.salt, 1)} g</b></span>${bar(x.salt, 5, "#6E5A4E")}</div>
    <p class="xs muted" style="margin:6px 0 0">Repères : sucres 50 g, sel 5 g par jour.${x.known < x.total ? ` Calculé sur ${x.known} aliment${x.known > 1 ? "s" : ""} sur ${x.total} (certains n'ont pas ces données).` : ""}</p></div>`;
}

// ---------- Journal ----------
function journalBody(t) {
  const d = D(), log = N.dayLog(d), water = S().daily[d]?.water || 0;
  const fs = EN.fastState();
  return `<div class="row between mt12"><button class="icon-btn" data-a="food-day" data-v="-1" aria-label="Jour précédent">${I.back}</button><b class="h3" style="text-transform:capitalize">${d === today() ? "Aujourd'hui" : fmtDate(d)}</b><button class="icon-btn" data-a="food-day" data-v="1" aria-label="Jour suivant" style="transform:scaleX(-1);${d === today() ? "visibility:hidden" : ""}">${I.back}</button></div>
    ${levelSelector()}
    <div class="card mt8">${caloriesCard(d)}</div>
    ${nutriLevel() === "complet" ? nutriCard(d) : ""}
    <button class="card tap mt12" data-a="go" data-r="crise" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:24px">🆘</span><span class="grow"><b>Je craque</b><br><span class="xs muted">Une envie forte ? 2 minutes pour souffler et décider, sans culpabilité.</span></span>${I.chev}</button>
    <div class="card"><div class="rt" style="border:0;padding:0"><span class="em">💧</span><div class="grow"><b>Eau</b><div class="small muted">${fr(water * .25, 2)} L · 1 verre = 25 cl</div></div><div class="water"><button data-a="water" data-v="-1" data-d="${d}" aria-label="Retirer un verre">−</button><b>${water}</b><button data-a="water" data-v="1" data-d="${d}" aria-label="Ajouter un verre">+</button></div></div></div>
    ${fs ? `<button class="card tap" data-a="food-tab" data-v="jeune" style="display:flex;gap:12px;align-items:center"><span style="font-size:26px">${fs.stage[1]}</span><span class="grow"><b>Jeûne en cours · ${Math.floor(fs.hours)} h</b><br><span class="small muted">${esc(fs.stage[2])}</span></span>${I.chev}</button>` : ""}
    ${ML.mealCards(t, d)}
    ${SP.suppsMini(d)}
    <p class="xs muted mt12">Les heures servent à suivre tes fenêtres de repas et ton jeûne. Valeurs nutritionnelles : table Ciqual (Anses) et Open Food Facts.</p>`;
}
changes.mtime = (el) => { const m = el.dataset.m, d = el.dataset.d; update(st => (st.food[d] || []).forEach(e => { if (e.meal === m) e.time = el.value; })); toast("Heure du repas enregistrée"); };
actions["del-food"] = (b, d) => { N.removeEntry(+d.id, d.d); rerender(); };
actions["save-meal"] = (b, d) => {
  const es = N.dayLog(d.d).filter(e => e.meal === d.m);
  const n = prompt("Nom de ce repas", es.map(e => e.label.split(",")[0]).slice(0, 2).join(" + ")); if (!n) return;
  const tot = es.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  update(st => st.dishes = [{ n, ...tot, items: es.map(({ label, g, kcal, p, c, f }) => ({ label, g, kcal, p, c, f })) }, ...st.dishes.filter(x => x.n !== n)].slice(0, 40));
  toast("Repas enregistré : il est dans « Mes repas »");
};

// Ajouter des aliments : on reste dans la fenêtre et on enchaîne les aliments du repas
let afs = { meal: "Déjeuner", tab: "search", date: null, time: "" };
const afsTime = () => document.getElementById("afs-time")?.value || afs.time;
export async function addFoodSheet(meal) {
  afs.meal = meal; afs.date = D(); afs.tab = afs.tab || "search";
  afs.time = N.dayLog(afs.date).find(e => e.meal === meal)?.time || (afs.date === today() ? hhmm() : N.MEAL_TIMES[meal] || "12:00");
  const w = sheet(`<div class="row between" style="gap:10px"><h2 class="h2">${esc(meal)}</h2><button class="btn btn-red btn-sm" data-a="afs-done" style="width:auto">Terminé</button></div>
    <label class="row xs muted mt8" style="gap:6px">Heure du repas <input id="afs-time" class="inp" type="time" style="width:116px" value="${afs.time}"></label>
    <div id="afs-sum" class="mt8"></div>
    <div class="mt12">${seg([["search", "Chercher"], ["fav", "Favoris"], ["recent", "Récents"], ["dishes", "Mes repas"], ["rec", "Recettes"]], afs.tab, "afs-tab")}</div><div id="afsb" class="mt12"></div>
`, (w) => { drawSum(); drawAfs(w); });
  w.dataset.rr = "1";
  w.querySelector("#afs-time").addEventListener("change", (e) => { afs.time = e.target.value; });
}
// Ce qui est déjà dans le repas, avec la possibilité de retirer un aliment
function drawSum() {
  const box = document.getElementById("afs-sum"); if (!box) return;
  const es = N.dayLog(afs.date).filter(e => e.meal === afs.meal);
  if (!es.length) { box.innerHTML = `<p class="xs muted">Ajoute autant d'aliments que tu veux, puis touche « Terminé ».</p>`; return; }
  const k = es.reduce((a, e) => a + e.kcal, 0), p = es.reduce((a, e) => a + e.p, 0);
  box.innerHTML = `<div class="card" style="padding:10px 14px"><div class="row between"><b class="small">Dans ce repas · ${es.length} aliment${es.length > 1 ? "s" : ""}</b><span class="xs muted">${fr(k)} kcal · ${fr(p)} g P</span></div>
    ${es.map(e => `<div class="row between xs mt4" style="gap:6px">${e.g ? `<input class="inp" style="width:64px;padding:4px 6px;font-size:15px" inputmode="decimal" value="${fr(e.g)}" data-c="afs-g" data-id="${e.id}" aria-label="Quantité en grammes"><span class="muted">g</span>` : ""}<span class="grow">${esc(e.label)}</span><span class="muted">${e.kcal} kcal</span><button class="icon-btn" style="width:30px;height:30px" data-a="afs-del" data-id="${e.id}" aria-label="Retirer">${I.close}</button></div>`).join("")}</div>`;
}
actions["afs-del"] = (b, d) => { N.removeEntry(+d.id, afs.date); drawSum(); };
changes["afs-g"] = (el) => { const g = num(el.value); if (!(g > 0)) return; N.rescaleEntry(+el.dataset.id, afs.date, g); drawSum(); };
actions["afs-done"] = () => closeSheet();
function addedToMeal(e, label = "Ajouté") { afs.time = afsTime(); update(st => (st.food[afs.date] || []).forEach(x => { if (x.meal === afs.meal) x.time = afs.time; })); N.addEntry({ ...e, meal: afs.meal, time: afs.time }, afs.date); buzz(); toast(label); drawSum(); }
// Sous la recherche vide : favoris puis récents, pour ajouter en un geste
function quickFoods(foodLi) {
  const fav = (S().favFoods || []).slice(0, 8), rec = (S().recentFoods || []).filter(f => !N.isFavFood(f.n)).slice(0, 8);
  if (!fav.length && !rec.length) return `<p class="empty small">Tape le nom d'un aliment. Tes favoris et tes derniers aliments apparaîtront ici.</p>`;
  return (fav.length ? `<div class="lbl">⭐ Favoris</div><div class="list mt4">${fav.map((f, i) => foodLi(f, "fav", i)).join("")}</div>` : "")
    + (rec.length ? `<div class="lbl ${fav.length ? "mt16" : ""}">🕘 Récents</div><div class="list mt4">${rec.map(f => foodLi(f, "recent", S().recentFoods.indexOf(f))).join("")}</div>` : "");
}
function drawAfs(w = document.getElementById("sheet")) {
  const box = w.querySelector("#afsb");
  w.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.v === afs.tab));
  const foodLi = (f, src, i) => `<div class="li" data-li="${src}-${i}"><button class="grow" style="text-align:left" data-a="pick-food" data-src="${src}" data-i="${i}"><span class="small">${esc(f.n)}</span><br><span class="xs muted">${f.kcal} kcal · ${fr(f.p, 1)} g prot.${f.fib != null ? ` · ${fr(f.fib, 1)} g fibres` : ""} / 100 g</span></button><button class="icon-btn" data-a="fav-food" data-src="${src}" data-i="${i}" aria-label="Favori" style="color:${N.isFavFood(f.n) ? "var(--gold)" : "var(--soft)"}">${N.isFavFood(f.n) ? "★" : "☆"}</button></div>`;
  if (afs.tab === "search") {
    box.innerHTML = `<div class="search">${I.search}<input id="fq" placeholder="riz, poulet, skyr…" autocomplete="off" enterkeyhint="search"></div>
      <button class="btn btn-line btn-sm mt8" data-a="scan" style="width:100%">${I.scan.replace("<svg", '<svg width="20"')} Scanner un code-barres</button><div id="fr" class="mt12">${quickFoods(foodLi)}</div>`;
    const inp = box.querySelector("#fq"), out = box.querySelector("#fr"); let ready = false, deb;
    if (afs.query) { inp.value = afs.query; afs.query = null; }
    const run = () => { const q = inp.value.trim(); if (!q) { out.innerHTML = quickFoods(foodLi); return; } if (!ready) { out.innerHTML = `<p class="empty small">Chargement des aliments…</p>`; return; } const r = N.searchFoods(q); window.__fr = r;
      const draw = (off) => { out.innerHTML = (r.length ? `<div class="list">${r.map((f, i) => foodLi(f, "search", i)).join("")}</div>` : `<p class="empty small">Rien dans la table Ciqual pour « ${esc(q)} ».</p>`) + `<div class="lbl mt16">🏷️ Produits de marque</div>` + (off == null ? `<p class="xs muted mt4">Recherche dans Open Food Facts…</p>` : off.length ? `<div class="list mt4">${off.map((f, i) => foodLi(f, "search", r.length + i)).join("")}</div>` : `<p class="xs muted mt4">Aucun produit de marque (ou pas de connexion).</p>`); };
      draw(null); N.searchBrands(q).then(off => { if (inp.value.trim() !== q) return; window.__fr = [...r, ...off]; draw(off); }); };
    inp.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(run, 140); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
    N.loadCiqual().then(() => { ready = true; if (inp.value.trim()) run(); });
  } else if (afs.tab === "fav") {
    const l = S().favFoods; box.innerHTML = l.length ? `<div class="list">${l.map((f, i) => foodLi(f, "fav", i)).join("")}</div>` : `<p class="empty small">Touche ☆ à côté d'un aliment pour le retrouver ici.</p>`;
  } else if (afs.tab === "recent") {
    const l = S().recentFoods; box.innerHTML = l.length ? `<div class="list">${l.map((f, i) => foodLi(f, "recent", i)).join("")}</div>` : `<p class="empty small">Tes derniers aliments apparaîtront ici.</p>`;
  } else if (afs.tab === "dishes") {
    const l = S().dishes; box.innerHTML = l.length ? `<div class="list">${l.map((d, i) => `<div class="li"><button class="grow" style="text-align:left" data-a="eat-dish" data-i="${i}"><b class="small">${esc(d.n)}</b><br><span class="xs muted">${fr(d.kcal)} kcal · ${fr(d.p)} g prot.${d.items ? ` · ${d.items.length} aliments` : ""}</span></button><button class="icon-btn" data-a="del-dish" data-i="${i}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>` : `<p class="empty small">Dans ton journal, touche « Enregistrer ce repas » : tu pourras le refaire en un geste.</p>`;
  } else {
    const l = allRecipes().filter(recipeOpen); box.innerHTML = `<div class="list">${l.map(r => `<button class="li" data-a="eat-recipe" data-id="${r.id}"><span class="em">${r.e}</span><span class="grow"><b class="small">${esc(r.n)}</b><br><span class="xs muted">1 portion · ${r.m.kcal} kcal · ${r.m.p} g prot.</span></span>${I.plus.replace("<svg", '<svg width="20"')}</button>`).join("")}</div>${premium() ? "" : `<p class="xs muted mt8">${RC.RECIPES.length - FREE_RECIPES} recettes de plus avec Premium.</p>`}`;
  }
}
actions["add-food"] = (b, d) => addFoodSheet(d.m);
actions["afs-tab"] = (b, d) => { afs.tab = d.v; drawAfs(); };
const srcList = (src) => src === "search" ? window.__fr : src === "fav" ? S().favFoods : S().recentFoods;
actions["fav-food"] = (b, d) => { const f = srcList(d.src)[+d.i]; N.toggleFavFood({ n: f.n, kcal: f.kcal, p: f.p, c: f.c, f: f.f }); const on = N.isFavFood(f.n); b.textContent = on ? "★" : "☆"; b.style.color = on ? "var(--gold)" : "var(--soft)"; toast(on ? "Ajouté aux favoris" : "Retiré des favoris"); };
// Quantité choisie sur place, sous l'aliment touché : pas de nouvelle fenêtre
actions["pick-food"] = (b, d) => {
  const food = srcList(d.src)[+d.i], li = b.closest(".li"); if (!food || !li) return;
  document.querySelectorAll("#sheet .qty-pick").forEach(x => x.remove());
  const last = (S().recentFoods || []).find(x => x.n === food.n)?.g;
  let g = last || 100;
  const panel = document.createElement("div"); panel.className = "qty-pick card"; panel.style.cssText = "margin:4px 0 10px;padding:12px";
  panel.innerHTML = `<div class="row" style="gap:8px"><input class="inp" inputmode="decimal" value="${g}" style="width:90px" aria-label="Quantité en grammes"><span class="small muted">g</span><span class="grow small" data-v></span></div>
    <div class="chips wrap mt8">${[30, 50, 100, 150, 200, 250].map(x => `<button class="chip" data-g="${x}">${x} g</button>`).join("")}</div>
    <button class="btn btn-red btn-sm mt8" style="width:100%" data-ok>Ajouter</button>`;
  li.after(panel);
  const inp = panel.querySelector("input"), v = panel.querySelector("[data-v]");
  const draw = () => { const e = N.entryFromFood(food, g, afs.meal); v.innerHTML = `<b>${e.kcal} kcal</b> <span class="xs muted">· ${fr(e.p)} g P</span>`; panel.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", +c.dataset.g === g)); };
  inp.addEventListener("input", () => { g = num(inp.value) || 0; draw(); });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); panel.querySelector("[data-ok]").click(); } });
  panel.querySelectorAll(".chip").forEach(c => c.addEventListener("click", (e) => { e.stopPropagation(); g = +c.dataset.g; inp.value = g; draw(); }));
  panel.querySelector("[data-ok]").addEventListener("click", (e) => {
    e.stopPropagation(); if (!(g > 0)) return toast("Quantité invalide");
    N.rememberFood({ ...food, g }); addedToMeal(N.entryFromFood(food, g, afs.meal), `${food.n.split(",")[0]} ajouté`);
    panel.remove(); li.style.opacity = ".55";
    const q = document.getElementById("fq"); if (q && afs.tab === "search") { q.value = ""; q.dispatchEvent(new Event("input")); q.focus(); }
  });
  draw(); inp.select?.();
};
actions["eat-dish"] = (b, d) => { const di = S().dishes[+d.i]; addedToMeal({ label: di.n, g: null, kcal: Math.round(di.kcal), p: di.p, c: di.c, f: di.f }, "Repas ajouté"); };
actions["del-dish"] = (b, d) => { if (!confirm("Supprimer ce repas enregistré ?")) return; update(st => st.dishes.splice(+d.i, 1)); drawAfs(); };
actions["eat-recipe"] = (b, d) => { const r = allRecipes().find(x => x.id === d.id); addedToMeal({ label: `${r.n} (1 portion)`, g: null, ...r.m }); };
function gramsSheet(food, onAdd, meal = afs.meal) {
  let g = 100;
  const draw = (w) => { const e = N.entryFromFood(food, g, meal); w.querySelector("#gv").innerHTML = `<span class="num" style="font-size:34px">${e.kcal}</span><span class="small muted"> kcal · ${fr(e.p)} g prot. · ${fr(e.c)} g gluc. · ${fr(e.f)} g lip.</span>`; };
  sheet(`<h2 class="h2">${esc(food.n)}</h2><div id="gv" class="mt12"></div>
    <label class="field mt12"><span>Quantité (g ou ml)</span><input id="gq" inputmode="decimal" value="100"></label>
    <div class="chips wrap mt12">${[30, 50, 100, 150, 200, 250, 300].map(x => `<button class="chip ${x === 100 ? "on" : ""}" data-g="${x}">${x} g</button>`).join("")}</div>
    <label class="field mt12"><span>Heure</span><input id="gt" type="time" value="${afs.date === today() ? hhmm() : N.MEAL_TIMES[meal]}"></label>
    <button class="btn btn-red mt16" id="gadd">Ajouter à ${esc(meal.toLowerCase())}</button>`, (w) => {
    draw(w); const inp = w.querySelector("#gq");
    inp.addEventListener("input", () => { g = num(inp.value) || 0; w.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", +c.dataset.g === g)); draw(w); });
    w.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => { g = +c.dataset.g; inp.value = g; w.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === c)); draw(w); }));
    w.querySelector("#gadd").addEventListener("click", () => { if (!g) return; const e = N.entryFromFood(food, g, meal); e.time = w.querySelector("#gt").value; N.rememberFood(food); buzz(); closeSheet(); onAdd(e); });
  });
}
export async function scanBarcode(meal = afs.meal, date = afs.date || D(), back = true) {
  const done = async (code) => { const f = await N.lookupBarcode(code); if (f) gramsSheet(f, (e) => { N.addEntry(e, date); toast("Ajouté"); if (back) addFoodSheet(meal); else rerender(); }, meal); else { closeSheet(); toast("Produit introuvable : cherche-le par son nom."); } };
  const manual = () => sheet(`<h2 class="h2">🔎 Code-barres</h2><p class="small muted">Ton navigateur ne lit pas les codes-barres avec la caméra. Tape les chiffres sous le code-barres (13 en général).</p><form data-f="bc-code" class="row mt12" style="gap:8px"><input name="c" class="inp grow" inputmode="numeric" pattern="[0-9]*" placeholder="3017620422003" required><button class="btn btn-red btn-sm" style="width:auto">Chercher</button></form>`);
  forms["bc-code"] = (v) => { const c = String(v.c).replace(/\D/g, ""); if (c.length < 8) return toast("Code incomplet"); done(c); };
  // Lecture par ZXing directement depuis la caméra (même méthode que TB my Coach, qui fonctionnait)
  let ZX;
  try { ZX = await loadZxing(); } catch { return manual(); }
  sheet(`<h2 class="h2">Scanner</h2><video id="cam" playsinline autoplay muted style="width:100%;border-radius:14px;margin-top:12px;background:#000"></video><p class="small muted mt8">Place le code-barres dans le cadre, bien à plat et de face.</p><button class="btn btn-line btn-sm mt8" data-a="scan-manual" style="width:100%">Taper le code à la place</button>`, async (w) => {
    const v = w.querySelector("#cam");
    let ctl = null, found = false;
    const stop = () => { try { ctl?.stop(); } catch { } };
    const timer = setInterval(() => { if (!document.body.contains(v)) { clearInterval(timer); stop(); } }, 500);
    try {
      let hints;
      if (ZX.DecodeHintType && ZX.BarcodeFormat) {
        hints = new Map([
          [ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13, ZX.BarcodeFormat.EAN_8, ZX.BarcodeFormat.UPC_A, ZX.BarcodeFormat.UPC_E]],
          [ZX.DecodeHintType.TRY_HARDER, true],
        ]);
      }
      const reader = new ZX.BrowserMultiFormatReader(hints);
      ctl = await reader.decodeFromConstraints({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } }, v, (res) => {
        if (!res || found) return;
        found = true; clearInterval(timer); stop(); done(res.getText());
      });
    } catch { clearInterval(timer); stop(); manual(); }
  });
}
let zxingP = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingP) zxingP = new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js"; s.onload = () => ok(window.ZXing); s.onerror = () => { zxingP = null; ko(new Error("zxing")); }; document.head.appendChild(s); });
  return zxingP;
}
actions["scan-manual"] = () => sheet(`<h2 class="h2">🔎 Code-barres</h2><p class="small muted">Tape les chiffres sous le code-barres (13 en général).</p><form data-f="bc-code" class="row mt12" style="gap:8px"><input name="c" class="inp grow" inputmode="numeric" pattern="[0-9]*" placeholder="3017620422003" required><button class="btn btn-red btn-sm" style="width:auto">Chercher</button></form>`);
actions.scan = () => scanBarcode(afs.meal, afs.date, true);

// ---------- Plan alimentaire écrit ----------
actions["eat-plan"] = (b, d) => { const x = N.dayPlan(N.targets())[+d.i]; N.addEntry({ meal: N.MEALS.includes(x.meal) ? x.meal : "Déjeuner", label: x.n, g: null, kcal: x.m.kcal, p: x.m.p, c: x.m.c, f: x.m.f, time: x.time }); buzz(); toast(`${x.meal} noté dans le journal`); };
actions["swap-dish"] = (b, d) => { N.swapDish(d.m); rerender(); };
actions["plan-auto"] = () => { if (!confirm("Revenir au plan proposé ? Ton plan écrit sera effacé.")) return; update(st => N.setEdPlan(st, null)); rerender(); };
actions["plan-edit"] = () => {
  if (!N.edPlan()?.meals?.length) {
    const auto = N.dayPlan(N.targets());
    update(st => N.setEdPlan(st, { meals: auto.map(x => ({ name: x.meal, time: x.time, items: [{ label: x.n, g: null, ...x.m }] })) }));
  }
  planEditor();
};
function planEditor() { closeSheet(); rerender(); }
changes["pl-name"] = (el) => update(st => N.edPlan(st).meals[+el.dataset.m].name = el.value);
changes["pl-time"] = (el) => update(st => N.edPlan(st).meals[+el.dataset.m].time = el.value);
actions["pl-idel"] = (b, d) => { update(st => N.edPlan(st).meals[+d.m].items.splice(+d.i, 1)); planEditor(); };
actions["pl-mdel"] = (b, d) => { update(st => N.edPlan(st).meals.splice(+d.m, 1)); planEditor(); };
actions["pl-madd"] = () => { update(st => N.edPlan(st).meals.push({ name: "Repas", time: "12:00", items: [] })); planEditor(); };
actions["pl-done"] = () => { closeSheet(); rerender(); };
actions["pl-add"] = (b, d) => {
  sheet(`<h2 class="h2">Ajouter un aliment</h2><div class="search mt12">${I.search}<input id="pq" placeholder="Rechercher" autocomplete="off"></div><div id="pr" class="mt12"></div>`, async (w) => {
    await N.loadCiqual(); const inp = w.querySelector("#pq"), out = w.querySelector("#pr");
    inp.addEventListener("input", () => { const r = N.searchFoods(inp.value); window.__pf = r; out.innerHTML = `<div class="list">${r.map((f, i) => `<button class="li" data-a="pl-pick" data-m="${d.m}" data-i="${i}"><span class="grow small">${esc(f.n)}<br><span class="xs muted">${f.kcal} kcal / 100 g</span></span>${I.chev}</button>`).join("")}</div>`; });
    inp.focus();
  });
};
actions["pl-pick"] = (b, d) => { const f = window.__pf[+d.i], mi = +d.m; gramsSheet(f, (e) => { update(st => N.edPlan(st).meals[mi].items.push({ label: e.label, g: e.g, kcal: e.kcal, p: e.p, c: e.c, f: e.f })); planEditor(); }, S().myPlan.meals[mi].name); };
actions["pl-addr"] = (b, d) => sheet(`<h2 class="h2">Ajouter une recette</h2><div class="list mt12">${allRecipes().filter(recipeOpen).map(r => `<button class="li" data-a="pl-rpick" data-m="${d.m}" data-id="${r.id}"><span class="em">${r.e}</span><span class="grow small">${esc(r.n)}<br><span class="xs muted">1 portion · ${r.m.kcal} kcal</span></span></button>`).join("")}</div>`);
actions["pl-rpick"] = (b, d) => { const r = allRecipes().find(x => x.id === d.id); update(st => N.edPlan(st).meals[+d.m].items.push({ label: r.n + " (1 portion)", g: null, ...r.m })); planEditor(); };

// ---------- Recettes ----------
let rcat = "", rq = "";
function recipesBody() {
  return `<div class="search mt12">${I.search}<input id="rq" placeholder="Rechercher une recette" value="${esc(rq)}" autocomplete="off"></div>
    <div class="mt8">${chips([["", "Toutes"], ["mine", "⭐ Mes recettes"], ["batch", "🥡 Batch"], ...RC.CATS.map(c => [c, c])], rcat, "rc-cat")}</div>
    <button class="card tap mt8" data-a="rc-new" style="display:flex;gap:12px;align-items:center"><span style="font-size:26px">➕</span><span class="grow"><b>Créer ma recette</b><br><span class="small muted">Ingrédients, portions, étapes : les macros se calculent seules</span></span>${premium() ? I.chev : `<span class="lock">🔒</span>`}</button>
    <div id="rlist" class="mt12">${recipeList()}</div>`;
}
function recipeList() {
  const q = N.norm(rq);
  const l = allRecipes().filter(r => (!rcat || (rcat === "mine" ? r.mine : rcat === "batch" ? r.batch : r.cat === rcat)) && (!q || N.norm(r.n).includes(q)));
  return l.length ? `<div class="list">${l.map(r => `<button class="li" data-a="rc-open" data-id="${r.id}"><span class="em" style="font-size:24px">${r.e}</span><span class="grow"><b class="small">${esc(r.n)}</b>${r.batch ? ` <span class="tag">Batch</span>` : ""}<br><span class="xs muted">${r.min} min · ${r.portions} portion${r.portions > 1 ? "s" : ""} · ${r.m.kcal} kcal · ${r.m.p} g P / portion</span></span>${recipeOpen(r) ? I.chev : `<span class="lock">🔒</span>`}</button>`).join("")}</div><p class="xs muted mt8">${RC.RECIPES.length + myRecipes().length} recettes${premium() ? "" : ` · ${FREE_RECIPES} ouvertes en gratuit`}.</p>` : `<p class="empty small">Aucune recette.</p>`;
}
function bindRecipeSearch() { const i = document.getElementById("rq"); i?.addEventListener("input", () => { rq = i.value; document.getElementById("rlist").innerHTML = recipeList(); }); }
actions["rc-cat"] = (b, d) => { rcat = d.v; rerender(); };
actions["rc-open"] = (b, d) => {
  const r = allRecipes().find(x => x.id === d.id); if (!recipeOpen(r)) return go("offers");
  let por = 1;
  const draw = (w) => {
    const f = por / r.portions;
    w.querySelector("#ring").innerHTML = Object.entries(r.ing).map(([k, g]) => `<li>${k === "oeuf" ? `${Math.max(1, Math.round(g * f / 55))} œuf(s)` : `${Math.round(g * f)} g ${esc(RC.ingLabel(k))}`}</li>`).join("");
    w.querySelector("#rpor").textContent = por;
  };
  sheet(`<div class="row" style="gap:10px"><span style="font-size:40px">${r.e}</span><div><h2 class="h2">${esc(r.n)}</h2><p class="xs muted">${esc(r.cat)} · ${r.min} min${r.batch ? " · se conserve 3 à 4 jours" : ""}</p></div></div>
    <div class="stat3 mt12"><div><b>${r.m.kcal}</b><span>kcal</span></div><div><b>${r.m.p} g</b><span>protéines</span></div><div><b>${r.m.c} / ${r.m.f}</b><span>gluc. / lip.</span></div></div><p class="xs muted center">par portion · ${premium() ? `≈ ${eur(RC.costOf(r.ing, r.portions, S().prices))} la portion` : "💶 prix : Premium"}</p>
    <div class="row between mt12"><b>Ingrédients</b><div class="water"><button data-a="rc-por" data-v="-1">−</button><b id="rpor">1</b><button data-a="rc-por" data-v="1">+</button></div></div>
    <ul id="ring" class="small" style="padding-left:18px"></ul>
    <b>Préparation</b><ol class="small" style="padding-left:18px">${r.steps.map(s => `<li style="margin-bottom:6px">${esc(s)}</li>`).join("")}</ol>
    <div class="lbl mt12">Ajouter 1 portion au journal</div><div class="chips wrap mt8">${N.MEALS.map(m => `<button class="chip" data-a="rc-eat" data-id="${r.id}" data-m="${m}">${m}</button>`).join("")}</div>
    <div class="card soft mt12"><div class="lbl">⚖️ Plat entier pesé : ma part au poids</div><p class="xs muted" style="margin:4px 0 8px">Grosse préparation pour la famille ? Pèse le plat cuit en entier une fois, puis ta part : l'app calcule ta part des macros du plat entier.</p>
      <div class="grid2"><label class="field"><span>Plat cuit entier (g)</span><input id="rc-tot" inputmode="decimal" value="${r.cookedG ? fr(r.cookedG) : ""}" placeholder="ex. 3500"></label><label class="field"><span>Ma part (g)</span><input id="rc-part" inputmode="decimal" placeholder="ex. 300"></label></div>
      <div id="rc-calc" class="small mt8"></div><div class="chips wrap mt8">${N.MEALS.map(m => `<button class="chip" data-a="rc-eatg" data-id="${r.id}" data-m="${m}">${m}</button>`).join("")}</div></div>
    <div class="row mt12" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="bt-add" data-id="${r.id}">🥡 Ajouter au batch</button>${r.mine ? `<button class="btn btn-ghost btn-sm" data-a="rc-del" data-id="${r.id}" style="color:var(--red)">Supprimer</button>` : ""}</div>`, (w) => { draw(w); w.__draw = (n) => { por = Math.max(1, por + n); draw(w); }; });
};
actions["rc-por"] = (b, d) => document.getElementById("sheet")?.__draw?.(+d.v);
// Part au poids d'un plat entier : (ma part / poids cuit total) × macros de toute la recette
const partOf = (r) => { const tot = num(document.getElementById("rc-tot")?.value), part = num(document.getElementById("rc-part")?.value); if (!(tot > 0 && part > 0)) return null; const k = part / tot * r.portions; return { tot, part, kcal: Math.round(r.m.kcal * k), p: +(r.m.p * k).toFixed(1), c: +(r.m.c * k).toFixed(1), f: +(r.m.f * k).toFixed(1) }; };
document.addEventListener("input", (e) => { if (!["rc-tot", "rc-part"].includes(e.target.id)) return; const id = document.querySelector('[data-a="rc-eatg"]')?.dataset.id, r = allRecipes().find(x => x.id === id), box = document.getElementById("rc-calc"); if (!r || !box) return; const x = partOf(r); box.innerHTML = x ? `Ta part : <b>${fr(x.kcal)} kcal</b> · P ${fr(x.p)} g · G ${fr(x.c)} g · L ${fr(x.f)} g <span class="xs muted">(${fr(Math.round(x.part / x.tot * 100))} % du plat)</span>` : ""; });
actions["rc-eatg"] = (b, d) => {
  const r = allRecipes().find(x => x.id === d.id), x = partOf(r); if (!x) return toast("Indique le poids du plat entier et ta part");
  if (r.mine) update(st => { const m = (st.myRecipes || []).find(y => y.id === r.id); if (m) m.cookedG = x.tot; });
  N.addEntry({ meal: d.m, label: `${r.n} (${fr(x.part)} g)`, g: x.part, kcal: x.kcal, p: x.p, c: x.c, f: x.f }); closeSheet(); toast(`Ajouté au ${d.m.toLowerCase()}`);
};
actions["rc-eat"] = (b, d) => { const r = allRecipes().find(x => x.id === d.id); N.addEntry({ meal: d.m, label: `${r.n} (1 portion)`, g: null, ...r.m }); closeSheet(); toast(`Ajouté au ${d.m.toLowerCase()}`); };
actions["rc-del"] = (b, d) => { if (!confirm("Supprimer cette recette ?")) return; update(st => st.myRecipes = st.myRecipes.filter(r => r.id !== d.id)); closeSheet(); rerender(); };
let newR = null, nrSave = null;
export function openRecipeEditor(onSave) { nrSave = onSave; newR = { n: "", cat: "Plat", e: "🍽️", portions: 2, min: 20, ing: {}, steps: "" }; recipeForm(); }
actions["rc-new"] = () => { if (!premium()) return go("offers"); nrSave = null; newR = { n: "", cat: "Plat", e: "🍽️", portions: 2, min: 20, ing: {}, steps: "" }; recipeForm(); };
function recipeForm() {
  const m = RC.macros(newR.ing, newR.portions);
  sheet(`<h2 class="h1">Ma recette</h2>
    <label class="field mt12"><span>Nom</span><input value="${esc(newR.n)}" data-c="nr" data-k="n" maxlength="60" placeholder="Ex. Poulet coco du dimanche"></label>
    <div class="grid3 mt8"><label class="field"><span>Catégorie</span><select data-c="nr" data-k="cat">${RC.CATS.map(c => `<option ${c === newR.cat ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field"><span>Portions</span><input inputmode="numeric" value="${newR.portions}" data-c="nr" data-k="portions"></label><label class="field"><span>Minutes</span><input inputmode="numeric" value="${newR.min}" data-c="nr" data-k="min"></label></div>
    <div class="lbl mt12">Emoji</div><div class="chips wrap mt8">${["🍽️", "🍗", "🥩", "🐟", "🥚", "🍝", "🍚", "🥗", "🍲", "🥣", "🥞", "🍰"].map(e => `<button class="chip ${newR.e === e ? "on" : ""}" data-a="nr-e" data-v="${e}">${e}</button>`).join("")}</div>
    <div class="lbl mt12">Ingrédients (poids total mis dans la préparation)</div><p class="xs muted" style="margin:2px 0 0">Pèse ce que tu mets : pâtes crues si tu choisis « pâtes crues », etc. Pour un plat familial, mets tout, puis pèse le plat cuit au moment de servir.</p>
    ${Object.entries(newR.ing).map(([k, g]) => `<div class="row between small mt8"><span>${g} g ${esc(RC.ingLabel(k))}</span><button class="icon-btn" data-a="nr-del" data-k="${k}" aria-label="Retirer">${I.close}</button></div>`).join("") || `<p class="xs muted">Aucun ingrédient.</p>`}
    <div class="search mt8">${I.search}<input id="nrq" placeholder="Ajouter un aliment : riz, poulet, une marque…" autocomplete="off"></div><div id="nrr"></div>
    <div class="card soft mt12 center"><b>${m.kcal} kcal</b> · ${m.p} g P · ${m.c} g G · ${m.f} g L <span class="xs muted">par portion</span></div>
    <label class="field mt12"><span>Étapes (une par ligne)</span><textarea rows="4" data-c="nr" data-k="steps">${esc(newR.steps)}</textarea></label>
    <button class="btn btn-red mt12" data-a="nr-save">Enregistrer la recette</button>`, (w) => {
    const q = w.querySelector("#nrq"), out = w.querySelector("#nrr"); let tm;
    q.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(async () => { await N.loadCiqual(); const v = q.value.trim(); if (v.length < 2) { out.innerHTML = ""; return; }
      let r = N.searchFoods(v, 12); window.__nrf = r;
      const draw = () => out.innerHTML = `<div class="list mt8">${window.__nrf.map((f, i) => `<button class="li" data-a="nr-pick" data-i="${i}"><span class="grow small">${esc(f.n)}<br><span class="xs muted">${f.kcal} kcal · P ${fr(f.p, 1)} · G ${fr(f.c, 1)} · L ${fr(f.f, 1)} g / 100 g${f.brand ? " · " + esc(f.brand) : ""}</span></span>${I.plus.replace("<svg", '<svg width="18"')}</button>`).join("") || `<p class="xs muted">Aucun aliment.</p>`}</div>`;
      draw(); const more = await N.searchBrands(v).catch(() => []); if (q.value.trim() !== v || !more.length) return; window.__nrf = [...r, ...more]; draw(); }, 220); });
  }, { keep: true });
}
actions["nr-pick"] = (b, d) => {
  const f = window.__nrf[+d.i]; let g = 100;
  sheet(`<h2 class="h2">${esc(f.n)}</h2><p class="xs muted">${f.kcal} kcal / 100 g · poids total dans la recette</p><div class="row mt12" style="gap:8px"><input id="nrg" class="inp grow" inputmode="decimal" value="100" style="font-size:22px"><span>g</span></div>
    <div class="chips wrap mt8">${[50, 100, 150, 200, 300, 500].map(x => `<button class="chip" data-g="${x}" type="button">${x} g</button>`).join("")}</div><button class="btn btn-red mt12" id="nrok">Ajouter à la recette</button><button class="btn btn-line mt8" id="nrback">Retour</button>`, (w) => {
    const inp = w.querySelector("#nrg"); inp.focus(); inp.select();
    w.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => { inp.value = c.dataset.g; }));
    w.querySelector("#nrback").addEventListener("click", recipeForm);
    w.querySelector("#nrok").addEventListener("click", () => { g = num(inp.value); if (!(g > 0)) return toast("Indique un poids");
      const k = "c:" + N.norm(f.n).slice(0, 60); const def = [f.n.charAt(0).toLowerCase() + f.n.slice(1), f.kcal, f.p, f.c, f.f, f.cat || "Divers"];
      newR.ingDef = { ...(newR.ingDef || {}), [k]: def }; RC.registerIng({ [k]: def }); newR.ing[k] = (newR.ing[k] || 0) + g; recipeForm(); });
  }, { keep: true });
};
changes.nr = (el) => { const k = el.dataset.k; newR[k] = ["portions", "min"].includes(k) ? Math.max(1, Math.round(num(el.value)) || 1) : el.value; if (k === "portions") recipeForm(); };
actions["nr-e"] = (b, d) => { newR.e = d.v; recipeForm(); };
actions["nr-del"] = (b, d) => { delete newR.ing[d.k]; recipeForm(); };
actions["nr-save"] = () => {
  if (!newR.n.trim()) return toast("Donne un nom à ta recette");
  if (!Object.keys(newR.ing).length) return toast("Ajoute au moins un ingrédient");
  const r = { id: "my-" + Date.now(), n: newR.n.trim(), cat: newR.cat, e: newR.e, min: newR.min, portions: newR.portions, ing: newR.ing, ingDef: Object.fromEntries(Object.entries(newR.ingDef || {}).filter(([k]) => newR.ing[k] != null)), steps: newR.steps.split("\n").map(s => s.trim()).filter(Boolean), batch: newR.portions >= 3 };
  if (nrSave) { const f = nrSave; nrSave = null; return f(r); }
  update(st => st.myRecipes = [r, ...(st.myRecipes || [])]); closeSheet(); toast("Recette enregistrée"); rcat = "mine"; rerender();
};

// ---------- Batch cooking ----------
let cart = [];
function batchBody() {
  if (!premium()) return `<div class="card mt12 locked" style="position:relative;min-height:260px"><h2 class="h2">🥡 Batch cooking</h2><p class="small muted">Choisis tes recettes et tes portions : l'app calcule la liste de courses par rayon, et tes portions prêtes se mangent en un geste dans le journal.</p>${lockVeil("Bâtisseur")}</div>`;
  const stock = (S().batches || []).flatMap((b, bi) => b.items.map((it, ii) => ({ ...it, bi, ii, d: b.d }))).filter(x => x.left > 0);
  const { byAisle: list, total: cost } = RC.shoppingListPriced(cart.map(c => ({ r: allRecipes().find(r => r.id === c.id), portions: c.portions })), S().prices);
  const tot = cart.reduce((a, c) => a + c.portions, 0);
  return `${stock.length ? `<h2 class="sec">🧊 Mes portions prêtes</h2><div class="list">${stock.map(x => { const r = allRecipes().find(y => y.id === x.id); return r ? `<div class="li"><span class="em">${r.e}</span><span class="grow small"><b>${esc(r.n)}</b><br><span class="xs muted">${x.left} portion${x.left > 1 ? "s" : ""} · cuisiné ${fmtDate(x.d, { weekday: "short", day: "numeric" })}</span></span><button class="btn btn-red btn-xs" data-a="bt-eat" data-b="${x.bi}" data-i="${x.ii}">Manger</button></div>` : ""; }).join("")}</div>` : ""}
    <h2 class="sec">🛒 Préparer un batch</h2>
    ${cart.length ? `<div class="list">${cart.map((c, i) => { const r = allRecipes().find(x => x.id === c.id); return `<div class="li"><span class="em">${r.e}</span><span class="grow small"><b>${esc(r.n)}</b><br><span class="xs muted">${r.m.kcal * c.portions} kcal au total</span></span><div class="water"><button data-a="bt-por" data-i="${i}" data-v="-1">−</button><b>${c.portions}</b><button data-a="bt-por" data-i="${i}" data-v="1">+</button></div></div>`; }).join("")}</div>
      <div class="card mt12"><div class="row between"><div class="lbl">🧾 Liste de courses · ${tot} portions</div><b class="num">≈ ${eur(cost)}</b></div><p class="xs muted" style="margin:2px 0 0">soit ≈ ${eur(cost / Math.max(1, tot))} la portion${budgetLine(cost)}</p>${Object.entries(list).map(([a, its]) => `<div class="mt8"><b class="small">${esc(a)}</b>${its.map(x => `<div class="row between small"><span>☐ ${esc(x.label)} <span class="muted">${x.qty}</span></span><span class="muted">${eur(x.cost)}</span></div>`).join("")}</div>`).join("")}
        <button class="btn btn-ghost btn-xs mt8" data-a="bt-share">Partager la liste</button></div>
      <button class="btn btn-red mt12" data-a="bt-cook">✅ C'est cuisiné : ranger mes ${tot} portions</button>
      <p class="xs muted mt8">Repère : 3 à 4 jours au réfrigérateur, jusqu'à 3 mois au congélateur.</p>`
      : `<p class="small muted">Ajoute des recettes depuis l'onglet Recettes (bouton « Ajouter au batch »), ou commence par une idée :</p>`}
    <div class="list mt12">${allRecipes().filter(r => r.batch && !cart.some(c => c.id === r.id)).slice(0, 12).map(r => `<button class="li" data-a="bt-add" data-id="${r.id}"><span class="em">${r.e}</span><span class="grow small">${esc(r.n)}<br><span class="xs muted">${r.portions} portions · ${r.m.kcal} kcal / portion</span></span>${I.plus.replace("<svg", '<svg width="20"')}</button>`).join("")}</div>`;
}
actions["bt-add"] = (b, d) => { if (!premium()) return go("offers"); const r = allRecipes().find(x => x.id === d.id); if (!cart.some(c => c.id === d.id)) cart.push({ id: d.id, portions: r.portions }); closeSheet(); toast("Ajouté au batch"); tab = "batch"; go("food", "batch"); };
actions["bt-por"] = (b, d) => { const c = cart[+d.i]; c.portions += +d.v; if (c.portions <= 0) cart.splice(+d.i, 1); rerender(); };
actions["bt-share"] = () => {
  const { byAisle: list, total } = RC.shoppingListPriced(cart.map(c => ({ r: allRecipes().find(r => r.id === c.id), portions: c.portions })), S().prices);
  const t = "Liste de courses TB my Coach\n\n" + Object.entries(list).map(([a, its]) => a + "\n" + its.map(x => `- ${x.label} : ${x.qty} (≈ ${eur(x.cost)})`).join("\n")).join("\n\n") + `\n\nTotal estimé : ${eur(total)}`;
  if (navigator.share) navigator.share({ text: t }).catch(() => { }); else { navigator.clipboard?.writeText(t); toast("Liste copiée"); }
};
actions["bt-cook"] = () => { update(st => { st.batches = [{ d: today(), items: cart.map(c => ({ id: c.id, portions: c.portions, left: c.portions })) }, ...(st.batches || [])].slice(0, 20); }); cart = []; toast("Portions rangées 🧊"); rerender(); };
actions["bt-eat"] = (b, d) => {
  const it = S().batches[+d.b].items[+d.i], r = allRecipes().find(x => x.id === it.id);
  const h = new Date().getHours(), meal = h < 10 ? "Petit-déjeuner" : h < 15 ? "Déjeuner" : h < 18 ? "Collation" : "Dîner";
  N.addEntry({ meal, label: `${r.n} (batch)`, g: null, ...r.m }); update(st => st.batches[+d.b].items[+d.i].left--); toast(`Noté au ${meal.toLowerCase()}`); rerender();
};

// ---------- Jeûne ----------
export function fastBody() {
  const fs = EN.fastState(), last = N.lastMealTime(), hist = (S().fasts || []).slice(-7).reverse();
  const goal = fs?.goal || S().fastGoal || 16;
  const pct = fs ? Math.min(1, fs.hours / goal) : 0;
  return `<div class="card mt12 fast"><div class="fastring"><svg viewBox="0 0 200 200">${gradDef("fg")}${ring(pct, 200, 14, "url(#fg)")}</svg><div class="c">${fs ? `<span style="font-size:28px">${fs.stage[1]}</span><b>${Math.floor(fs.hours)}:${String(Math.floor(fs.hours % 1 * 60)).padStart(2, "0")}</b><span class="small muted">sur ${goal} h</span>` : `<span style="font-size:34px">⏳</span><b style="font-size:22px">Pas de jeûne</b><span class="small muted">en cours</span>`}</div></div>
      ${fs ? `<p class="mt12"><b>${esc(fs.stage[2])}</b></p><p class="small muted" style="max-width:420px">${esc(fs.stage[3])}</p>${fs.next ? `<p class="xs muted">Prochaine étape dans ${fr(fs.next[0] - fs.hours, 1)} h : ${esc(fs.next[2])}</p>` : ""}
        <p class="xs muted">Commencé ${fmtDate(S().fast.start, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</p><button class="btn btn-red mt8" data-a="fast-stop">Rompre le jeûne</button>`
      : `<div class="lbl mt12">Objectif</div><div class="chips wrap mt8" style="justify-content:center">${[12, 14, 16, 18, 20, 24].map(h => `<button class="chip ${goal === h ? "on" : ""}" data-a="fast-goal" data-v="${h}">${h} h</button>`).join("")}</div>
        <button class="btn btn-red mt12" data-a="fast-start">Commencer maintenant</button>${last && D() === today() ? `<button class="btn btn-line btn-sm mt8" data-a="fast-start" data-t="${last}">Depuis mon dernier repas (${last})</button>` : ""}`}</div>
    <h2 class="sec">🧬 Ce qui se passe dans ton corps</h2>
    <div class="list">${EN.FAST_STAGES.map(s => { const on = fs && fs.stage === s; return `<div class="li" style="${on ? "box-shadow:0 0 0 2px var(--red) inset;border-radius:14px" : ""}"><span class="em" style="font-size:24px">${s[1]}</span><span class="grow"><b class="small">${s[0]} h · ${esc(s[2])}</b><br><span class="xs muted">${esc(s[3])}</span></span></div>`; }).join("")}</div>
    <p class="xs muted mt8">Repères moyens, variables selon ton dernier repas, ton activité et ton métabolisme. Le jeûne n'est pas conseillé pendant la grossesse, en cas de diabète traité, de troubles alimentaires ou de traitement médical : demande l'avis de ton médecin.</p>
    ${hist.length ? `<h2 class="sec">📅 Mes derniers jeûnes</h2><div class="list">${hist.map(f => { const h = (new Date(f.end) - new Date(f.start)) / 36e5; return `<div class="li"><span class="grow small">${fmtDate(f.start, { weekday: "short", day: "numeric", month: "short" })}</span><b class="num">${fr(h, 1)} h</b>${h >= (f.goal || 16) ? " ✅" : ""}</div>`; }).join("")}</div>` : ""}`;
}
actions["fast-goal"] = (b, d) => { update(st => st.fastGoal = +d.v); rerender(); };
actions["fast-start"] = (b, d) => {
  let start = new Date();
  if (d.t) { const [h, m] = d.t.split(":"); start = new Date(); start.setHours(+h, +m, 0, 0); }
  update(st => st.fast = { start: start.toISOString(), goal: st.fastGoal || 16 }); buzz(); toast("Jeûne commencé"); rerender();
};
actions["fast-stop"] = () => { update(st => { st.fasts = [...(st.fasts || []), { ...st.fast, end: new Date().toISOString() }].slice(-60); st.fast = null; }); toast("Jeûne terminé. Bon appétit !"); rerender(); };

// ---------- Dépense calorique ----------
export function burnBody() {
  const d = D(), b = EN.breakdown(d), bn = EN.burnedNow(d), p = S().profile, t = N.targets();
  if (!premium()) return `<div class="card mt12"><div class="lbl">🔥 Brûlées aujourd'hui</div><b class="num" style="font-size:34px">${fr(bn.now)} kcal</b><p class="small muted">à cette heure, sur environ ${fr(bn.total)} kcal prévues</p></div>
    <div class="card mt12 locked" style="position:relative;min-height:240px"><h3 class="h3">Le calcul complet</h3><p class="small muted">Métabolisme de base, NEAT (pas et mouvements), EAT (séances et cardio), effet thermique des aliments, TDEE.</p>${lockVeil("Bâtisseur", "Le détail de ta dépense et l'ajout de ton cardio.")}</div>`;
  const stepTxt = b.activitySteps ? `${fr(b.steps)} pas hors activité (${fr(b.totalSteps)} au total, dont ${fr(b.activitySteps)} déjà comptés dans ton sport)` : `${fr(b.steps)} pas`;
  const rows = [["MB", "Métabolisme de base", b.bmr, `L'énergie pour vivre au repos : cœur, cerveau, organes (${EN.bmrMethod()}).`],
    ["NEAT", "Activité du quotidien", b.neat, `Ton mode de vie et ${stepTxt}.`],
    ["EAT", "Exercice", b.eat, `Musculation ${fr(b.lifts)} kcal · sport et cardio ${fr(b.cardio)} kcal (au-delà du repos).`],
    ["TEF", "Digestion", b.tef, "Selon tes macros : protéines ≈ 25 %, glucides ≈ 7,5 %, lipides ≈ 2 % de leurs calories."]];
  // semaine en cours
  const mon = addDays(today(), -((new Date().getDay() + 6) % 7)), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const wkLifts = S().workouts.filter(w => (w.end || "").slice(0, 10) >= mon);
  const liftMin = wkLifts.reduce((x, w) => x + Math.max(10, Math.round((new Date(w.end) - new Date(w.start)) / 6e4)), 0);
  const sportMin = days.reduce((x, k) => x + (S().daily[k]?.cardio || []).reduce((y, c) => y + c.min, 0), 0);
  const wkKcal = days.reduce((x, k) => { const bb = EN.breakdown(k); return x + bb.eat; }, 0);
  const opts = ["Cardio", "Sport"].map(cat => `<optgroup label="${cat === "Cardio" ? "Cardio" : "Sports"}">${EN.CARDIO.map((c, i) => c[3] === cat ? `<option value="${i}">${c[0]}</option>` : "").join("")}</optgroup>`).join("");
  return `<div class="card grad mt12"><div class="lbl">🔥 TDEE · dépense totale du jour</div><b class="num" style="font-size:40px">${fr(b.tdee)} kcal</b><p class="small" style="margin:4px 0 0">dont ${fr(bn.now)} kcal déjà brûlées à cette heure · mangé : ${fr(b.intake)} kcal</p><p class="small" style="margin:4px 0 0"><b>${b.intake - b.tdee > 0 ? "Surplus" : "Déficit"} estimé : ${fr(Math.abs(b.intake - b.tdee))} kcal</b></p></div>
    <div class="card mt12">${rows.map(([k, l, v, tx]) => `<div class="mt8"><div class="row between"><span><b>${k}</b> · <span class="small">${l}</span></span><b class="num">${fr(v)}</b></div><div class="gauge mt4"><i style="width:${Math.round(v / b.tdee * 100)}%"></i></div><p class="xs muted" style="margin:4px 0 0">${tx}</p></div>`).join("")}</div>

    <h2 class="sec">🏋️ Musculation du jour</h2>
    <div class="card">${b.sessions.length ? b.sessions.map(x => `<div class="row between small"><span>${esc(x.n)} · ${x.min} min</span><b>${fr(EN.liftKcal(x.min))} kcal</b></div>`).join("") : `<p class="small muted" style="margin:0">Pas de séance aujourd'hui. Elle s'ajoute toute seule quand tu termines une séance dans le carnet.</p>`}</div>

    <h2 class="sec">🏃 Sport et cardio du jour</h2>
    <div class="card">${b.list.length ? b.list.map((c, i) => { const st = EN.cardioSteps(c); return `<div class="row between small" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(c.n)} · ${c.min} min<br><span class="xs muted">${fr(c.met, 1)} MET${st ? ` · ≈ ${fr(st)} pas retirés du NEAT` : ""}</span></span><span><b>${fr(EN.cardioKcal(c.met, c.min))} kcal</b> <button class="icon-btn" data-a="cardio-del" data-i="${i}" aria-label="Retirer">${I.close}</button></span></div>`; }).join("") : `<p class="small muted" style="margin:0">Rien de noté aujourd'hui.</p>`}
      <form data-f="cardio" class="mt12"><select name="t" class="inp" style="width:100%;text-align:left">${opts}</select>
        <div class="row mt8" style="gap:6px"><input name="min" class="inp grow" inputmode="numeric" placeholder="Durée (min)" required><select name="int" class="inp" style="width:auto"><option value="0.85">Facile</option><option value="1" selected>Normal</option><option value="1.15">Intense</option></select><button class="btn btn-red btn-xs">Ajouter</button></div></form>
      <p class="xs muted" style="margin:8px 0 0">Les pas faits pendant la marche, la course ou un sport sont estimés et retirés de tes pas du jour, pour ne pas les compter deux fois.</p></div>

    <h2 class="sec">📅 Ma semaine</h2>
    <div class="card"><div class="stat3"><div><b>${wkLifts.length}</b><span>séance${wkLifts.length > 1 ? "s" : ""} muscu · ${Math.floor(liftMin / 60)} h ${String(liftMin % 60).padStart(2, "0")}</span></div><div><b>${Math.floor(sportMin / 60)} h ${String(sportMin % 60).padStart(2, "0")}</b><span>sport et cardio</span></div><div><b>${fr(wkKcal)}</b><span>kcal d'exercice</span></div></div>
      ${t ? `<p class="small mt12" style="margin-bottom:0">Ta semaine type : <b>${p.days} séance${p.days > 1 ? "s" : ""} de ${p.sessionMin || 60} min</b>${p.sportHours ? ` + <b>${fr(p.sportHours, 1)} h de sport</b>` : ""}, soit ≈ <b>${fr(t.ex.total)} kcal par jour</b> en moyenne. Maintien estimé : <b>${fr(t.maintenance)} kcal</b>, objectif : <b>${fr(t.kcal)} kcal</b>.</p><button class="link small mt8" data-a="edit-body">Modifier ma semaine type</button>` : ""}</div>
    <p class="xs muted mt8">MET : valeurs du Compendium des activités physiques, en retirant le repos (déjà compté dans le MB). Estimations à ±10 %. La tendance de ton poids sur 2 à 3 semaines reste le juge final : ajuste de 100 à 200 kcal si besoin.</p>`;
}
forms.cardio = (v) => { const c = EN.CARDIO[+v.t], min = Math.round(num(v.min)), k = +v.int || 1; if (!(min > 0 && min < 600)) return toast("Durée invalide"); update(st => { const x = st.daily[D()] = st.daily[D()] || {}; (x.cardio = x.cardio || []).push({ n: c[0] + (k > 1 ? " (intense)" : k < 1 ? " (facile)" : ""), met: Math.round(c[1] * k * 10) / 10, spm: c[2], min }); }); toast("Activité ajoutée"); rerender(); };
actions["cardio-del"] = (b, d) => { update(st => st.daily[D()].cardio.splice(+d.i, 1)); rerender(); };

// ---------- Corps : poids, projection, mensurations, photos ----------
// Tronc : une mesure. Membres : gauche et droite, relâché et contracté.
const TRUNK = [["neck", "Cou"], ["shoulders", "Épaules"], ["chest", "Poitrine"], ["waistNav", "Taille au nombril"], ["waistLow", "Taille, au plus large sous le nombril"], ["waistHigh", "Taille, au plus fin au-dessus du nombril"], ["hips", "Hanches"], ["fat", "Masse grasse (%)"]];
const LIMBS = [["arm", "Bras"], ["forearm", "Avant-bras"], ["thigh", "Cuisse"], ["calf", "Mollet"]];
const SIDES = [["l_r", "G relâché"], ["l_c", "G contracté"], ["r_r", "D relâché"], ["r_c", "D contracté"]];
const MS = [...TRUNK, ...LIMBS.flatMap(([k, l]) => SIDES.map(([s, sl]) => [`${k}_${s}`, `${l} ${sl}`]))];
const LEGACY = { waist: "waistNav", arm: "arm_r_r", thigh: "thigh_r_r", calf: "calf_r_r" };
function migrateMeasures() {
  if (!S().measures.some(m => Object.keys(LEGACY).some(k => m[k] != null))) return;
  update(st => st.measures.forEach(m => Object.entries(LEGACY).forEach(([o, n]) => { if (m[o] != null) { if (m[n] == null) m[n] = m[o]; delete m[o]; } })));
}
let msDate = null, msChart = "waistNav", phDate = null, phView = "face";
async function bodyBody() {
  const ws = Object.entries(S().daily).filter(([, v]) => v.weight).sort().map(([d, v]) => ({ d, w: v.weight }));
  const avg = ws.map((m, i) => { const win = ws.slice(Math.max(0, i - 6), i + 1); return { d: m.d, y: win.reduce((a, b) => a + b.w, 0) / win.length, l: m.d.slice(8, 10) + "/" + m.d.slice(5, 7) }; });
  let proj = null, rate = null;
  const recent = avg.filter(a => a.d >= addDays(today(), -28));
  if (recent.length >= 4) {
    const days = (new Date(recent.at(-1).d) - new Date(recent[0].d)) / 864e5;
    if (days >= 6) { rate = (recent.at(-1).y - recent[0].y) / days * 7; proj = [2, 4, 6, 8].map(k => ({ y: recent.at(-1).y + rate * k, l: `+${k} sem.` })); }
  }
  migrateMeasures();
  const ms = S().measures.filter(m => MS.some(([k]) => m[k] != null)).sort((a, b) => a.d.localeCompare(b.d));
  const lastM = [...ms].reverse()[0], firstM = ms[0];
  const photos = premium() ? (await listPhotos()).filter(p => p.view !== "repas") : [];
  const goal = S().profile?.goal;
  return `${ML.balanceCard(lineChart)}<div class="card mt12"><div class="row between"><span class="lbl">⚖️ Poids · moyenne 7 jours</span><span class="xs muted">${ws.length} pesées</span></div>
      ${avg.length ? `<div class="num mt4" style="font-size:32px">${fr(avg.at(-1).y, 1)} kg</div>` : ""}
      <div class="mt8">${lineChart(avg.slice(-60), { proj: premium() ? proj : null, yfmt: (v) => fr(v, 1) })}</div>
      ${rate != null ? premium() ? `<div class="card soft mt8"><b>📉 À ce rythme</b> (${rate > 0 ? "+" : ""}${fr(rate, 2)} kg / semaine) : <b>${fr(proj.at(-1).y, 1)} kg dans 8 semaines</b>.<br><span class="xs muted">${goal === "fat" ? (rate > -.2 ? "Un peu lent : vise −0,3 à −0,7 kg par semaine (baisse de 150 kcal ou +2 000 pas)." : rate < -1 ? "Rapide : attention à ta masse musculaire, remonte de 150 kcal." : "Rythme idéal pour perdre du gras en gardant ton muscle.") : goal === "muscle" ? (rate < .1 ? "Trop lent pour prendre du muscle : ajoute 150 kcal." : rate > .5 ? "Rapide : une partie sera du gras, baisse de 100 kcal." : "Bon rythme de prise de muscle.") : "La moyenne compte, pas la pesée du jour."}</span></div>` : `<p class="small mt8">🔒 Courbe de projection « à ce rythme » avec Premium.</p>` : `<p class="xs muted mt8">La projection apparaît après une semaine de pesées.</p>`}
      <form class="row mt12" data-f="weight" style="gap:8px"><input name="w" class="inp grow" inputmode="decimal" placeholder="Pesée du jour (kg)" required><button class="btn btn-red btn-sm" style="width:auto">Enregistrer</button></form></div>
    ${measuresCard(ms, lastM, firstM)}
    ${photosCard(photos)}`;
}
function measuresCard(ms, lastM, firstM) {
  const d = msDate || today(), cur = S().measures.find(m => m.d === d) || {};
  const val = (k) => cur[k] != null ? String(cur[k]).replace(".", ",") : "";
  const ph = (k) => lastM?.[k] != null ? String(lastM[k]).replace(".", ",") : "";
  const delta = (k) => { const f = ms.find(m => m[k] != null), l = [...ms].reverse().find(m => m[k] != null); if (!l) return ""; const dl = f && f !== l ? l[k] - f[k] : 0; return `<b>${fr(l[k], 1)}</b>${dl ? ` <span class="xs ${dl < 0 ? "" : "red"}">${dl > 0 ? "+" : ""}${fr(dl, 1)}</span>` : ""}`; };
  const has = (k) => ms.some(m => m[k] != null);
  const series = ms.filter(m => m[msChart] != null).map(m => ({ y: m[msChart], l: m.d.slice(8, 10) + "/" + m.d.slice(5, 7) }));
  const dates = [...ms].reverse().slice(0, 12);
  return `<div class="card mt12 ${premium() ? "" : "locked"}" style="position:relative"><div class="lbl">📏 Mensurations (cm)</div>
    ${lastM ? `<div class="mt8">${TRUNK.filter(([k]) => has(k)).map(([k, l]) => `<div class="row between small"><span>${l}</span><span>${delta(k)}</span></div>`).join("")}
      ${LIMBS.some(([k]) => SIDES.some(([s]) => has(`${k}_${s}`))) ? `<table class="mtab mt8"><tr><th></th>${SIDES.map(([, l]) => `<th>${l.replace("relâché", "rel.").replace("contracté", "contr.")}</th>`).join("")}</tr>${LIMBS.filter(([k]) => SIDES.some(([s]) => has(`${k}_${s}`))).map(([k, l]) => `<tr><td>${l}</td>${SIDES.map(([s]) => `<td>${delta(`${k}_${s}`) || "–"}</td>`).join("")}</tr>`).join("")}</table>` : ""}
      <p class="xs muted mt8">Dernière mesure : ${fmtDate(lastM.d, { day: "numeric", month: "long", year: "numeric" })}${firstM !== lastM ? ` · écart depuis le ${fmtDate(firstM.d, { day: "numeric", month: "short", year: "numeric" })}` : ""}</p>
      <div class="mt8">${chips(MS.filter(([k]) => has(k)).map(([k, l]) => [k, l.replace(", au plus large sous le nombril", " basse").replace(", au plus fin au-dessus du nombril", " haute")]), msChart, "ms-chart")}</div>
      <div class="mt8">${lineChart(series, { yfmt: (v) => fr(v, 1) })}</div></div>` : ""}
    <form data-f="measures" class="mt12"><label class="field"><span>Date des mesures</span><input type="date" name="d" value="${d}" max="${today()}" data-c="ms-date"></label>
      ${cur.d ? `<p class="xs muted mt4">Mesures déjà saisies ce jour-là : tu peux les corriger.</p>` : ""}
      <div class="lbl mt12">Tronc</div><div class="grid2 mt4">${TRUNK.map(([k, l]) => `<label class="field"><span>${l}</span><input name="${k}" inputmode="decimal" value="${val(k)}" placeholder="${ph(k)}"></label>`).join("")}</div>
      <div class="lbl mt12">Membres · gauche et droite, relâché et contracté</div>
      <table class="mtab in mt4"><tr><th></th>${SIDES.map(([, l]) => `<th>${l.replace(" ", "<br>")}</th>`).join("")}</tr>${LIMBS.map(([k, l]) => `<tr><td>${l}</td>${SIDES.map(([s, sl]) => `<td><input name="${k}_${s}" inputmode="decimal" value="${val(`${k}_${s}`)}" placeholder="${ph(`${k}_${s}`)}" aria-label="${l} ${sl}"></td>`).join("")}</tr>`).join("")}</table>
      <p class="xs muted mt8">Relâché : bras le long du corps, muscle détendu. Contracté : muscle serré au maximum, au point le plus large. Mesure toujours au même endroit, le matin.</p>
      <button class="btn btn-line btn-sm mt12" style="width:100%">Enregistrer les mesures du ${fmtDate(d, { day: "numeric", month: "long" })}</button></form>
    ${dates.length ? `<div class="lbl mt16">Historique</div><div class="chips wrap mt8">${dates.map(m => `<button class="chip ${m.d === d ? "on" : ""}" data-a="ms-pick" data-v="${m.d}">${fmtDate(m.d, { day: "numeric", month: "short", year: "2-digit" })}</button>`).join("")}</div>` : ""}
    ${premium() ? "" : lockVeil("Bâtisseur")}</div>`;
}
function photosCard(photos) {
  const VIEWS = [["face", "Face"], ["profil", "Profil"], ["dos", "Dos"], ["autre", "Autre"]];
  return `<div class="card mt12 ${premium() ? "" : "locked"}" style="position:relative"><span class="lbl">📸 Photos de progrès</span>
    <div class="grid2 mt8"><label class="field"><span>Date de la photo</span><input type="date" value="${phDate || today()}" max="${today()}" data-c="ph-date"></label><label class="field"><span>Vue</span><select data-c="ph-view">${VIEWS.map(([k, l]) => `<option value="${k}" ${k === phView ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="btn btn-line btn-sm mt8" style="width:100%;cursor:pointer">+ Ajouter une photo<input type="file" accept="image/*" data-c="photo" hidden></label>
    <p class="xs muted mt8">Chaque photo garde sa date et se relie à ton poids et tes mesures de ce jour-là. Elles restent sur ce téléphone.</p>
    ${photos.length ? `<div class="photo-grid mt12">${photos.map(p => { const m = S().measures.find(x => x.d === p.d) || {}; const w = S().daily[p.d]?.weight || m.weight; return `<figure><button data-a="photo" data-id="${p.id}" style="display:block;width:100%"><img alt="Photo du ${p.d}" src="${URL.createObjectURL(p.blob)}"></button><figcaption><b>${fmtDate(p.d, { day: "numeric", month: "short", year: "numeric" })}</b>${p.view && p.view !== "autre" ? ` · ${VIEWS.find(v => v[0] === p.view)?.[1] || ""}` : ""}${w ? `<br>${fr(w, 1)} kg` : ""}${m.waistNav ? ` · taille ${fr(m.waistNav)} cm` : ""}</figcaption></figure>`; }).join("")}</div>` : `<p class="empty small">Une photo par mois, même lumière, même tenue, même heure.</p>`}
    ${premium() ? "" : lockVeil("Bâtisseur")}</div>`;
}
forms.weight = (v) => {
  const w = num(v.w); if (!(w > 30 && w < 250)) return toast("Poids invalide");
  update(st => { const x = st.daily[today()] = st.daily[today()] || {}; x.weight = w; st.profile.weight = w; const m = st.measures.find(m => m.d === today()); if (m) m.weight = w; else st.measures.push({ d: today(), weight: w }); });
  pushStats(); toast("Pesée enregistrée"); rerender();
};
forms.measures = (v) => {
  if (!premium()) return go("offers");
  const d = v.d && v.d <= today() ? v.d : today();
  let any = false; update(st => { let m = st.measures.find(x => x.d === d); if (!m) { m = { d }; st.measures.push(m); } MS.forEach(([k]) => { if (!(k in v)) return; const x = num(v[k]); if (x > 0 && x < 300) { m[k] = x; any = true; } else if (!String(v[k]).trim()) delete m[k]; }); });
  msDate = d; toast(any ? `Mesures du ${fmtDate(d, { day: "numeric", month: "long" })} enregistrées` : "Aucune mesure saisie"); rerender();
};
changes["ms-date"] = (el) => { msDate = el.value || null; rerender(); };
actions["ms-pick"] = (b, d) => { msDate = d.v; rerender(); };
actions["ms-chart"] = (b, d) => { msChart = d.v; rerender(); };
changes["ph-date"] = (el) => { phDate = el.value || null; };
changes["ph-view"] = (el) => { phView = el.value; };
changes.photo = async (el) => { if (!premium()) return go("offers"); const f = el.files?.[0]; if (!f) return; await addPhoto(f, phDate || today(), phView); toast(`Photo du ${fmtDate(phDate || today(), { day: "numeric", month: "long" })} ajoutée`); rerender(); };
actions.photo = async (b, d) => {
  const p = (await listPhotos()).find(x => x.id === +d.id); if (!p) return;
  sheet(`<h2 class="h2">Photo</h2><img src="${URL.createObjectURL(p.blob)}" alt="" style="width:100%;border-radius:14px;margin-top:8px">
    <label class="field mt12"><span>Date</span><input type="date" id="pdate" value="${p.d}" max="${today()}"></label>
    <div class="row mt12" style="gap:8px"><button class="btn btn-red grow" data-a="photo-date" data-id="${p.id}">Enregistrer la date</button><button class="btn btn-line grow" data-a="photo-del" data-id="${p.id}" style="color:var(--red)">Supprimer</button></div>`);
};
actions["photo-date"] = async (b, d) => { const v = document.getElementById("pdate").value; if (!v) return; await updatePhoto(+d.id, { d: v }); closeSheet(); toast("Date modifiée"); rerender(); };
actions["photo-del"] = async (b, d) => { if (!confirm("Supprimer cette photo ?")) return; await deletePhoto(+d.id); closeSheet(); rerender(); };

// ---------- Budget des courses (Premium) ----------
const eur = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const mondayOf = (d) => addDays(d, -((new Date(d + "T12:00:00").getDay() + 6) % 7));
function budgetLine(cost) { const w = S().budget?.weekly; return w ? ` · ${Math.round(cost / w * 100)} % de ton budget de la semaine` : ""; }
let prQ = "";
function budgetBody() {
  if (!premium()) return `<div class="card mt12 locked" style="position:relative;min-height:300px"><h2 class="h2">💶 Budget des courses</h2><p class="small muted">Fixe ton budget, note tes tickets, vois le prix de chaque recette et de ta liste de courses, et repère les protéines les moins chères.</p>${lockVeil("Bâtisseur", "Le budget des courses fait partie de Premium.")}</div>`;
  const B = S().budget || {}, RCP = S().receipts || [], mon = mondayOf(today());
  const weekSpent = RCP.filter(r => r.d >= mon).reduce((a, r) => a + r.amount, 0);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(mon, -7 * (7 - i)));
  const perWeek = weeks.map(w => ({ l: `${Number(w.slice(8))}/${Number(w.slice(5, 7))}`, v: RCP.filter(r => r.d >= w && r.d < addDays(w, 7)).reduce((a, r) => a + r.amount, 0) }));
  const month = today().slice(0, 7), monthSpent = RCP.filter(r => r.d.startsWith(month)).reduce((a, r) => a + r.amount, 0);
  const left = B.weekly ? B.weekly - weekSpent : null, pct = B.weekly ? Math.min(1, weekSpent / B.weekly) : 0;
  const cheap = RC.cheapProteins(S().prices).slice(0, 8);
  const recipes = allRecipes().map(r => ({ r, c: RC.costOf(r.ing, r.portions, S().prices) })).sort((a, b) => a.c - b.c).slice(0, 6);
  const q = N.norm(prQ);
  return `<div class="card grad mt12"><div class="lbl">💶 Cette semaine</div><b class="num" style="font-size:36px">${eur(weekSpent)}</b>
      <p class="small" style="margin:4px 0 0">${B.weekly ? `sur ${eur(B.weekly)} · ${left >= 0 ? `reste ${eur(left)}` : `dépassé de ${eur(-left)}`}` : "Fixe ton budget pour suivre ce qu'il reste."}</p>
      ${B.weekly ? `<div class="gauge mt8" style="background:rgba(255,255,255,.25)"><i style="width:${Math.round(pct * 100)}%;background:#fff"></i></div>` : ""}
      <p class="xs" style="margin:8px 0 0;opacity:.85">Ce mois-ci : ${eur(monthSpent)}${B.people > 1 ? ` · ${B.people} personnes` : ""}</p></div>
    <form data-f="budget-set" class="card mt12"><div class="lbl">⚙️ Mon budget</div><div class="grid2 mt8"><label class="field"><span>Budget par semaine (€)</span><input name="weekly" inputmode="decimal" value="${B.weekly ?? ""}" placeholder="ex. 80"></label><label class="field"><span>Personnes au foyer</span><input name="people" inputmode="numeric" value="${B.people || 1}"></label></div><button class="btn btn-line btn-sm mt8" style="width:100%">Enregistrer</button></form>
    <h2 class="sec">🧾 Mes tickets de courses</h2>
    <form data-f="receipt" class="card"><div class="grid3"><label class="field"><span>Montant (€)</span><input name="amount" inputmode="decimal" required placeholder="0,00"></label><label class="field"><span>Magasin</span><input name="shop" maxlength="30" placeholder="ex. Lidl"></label><label class="field"><span>Date</span><input name="d" type="date" value="${today()}"></label></div>
      <label class="btn btn-line btn-sm mt8" style="width:100%;cursor:pointer">📷 Prendre le ticket en photo (lecture automatique)<input type="file" accept="image/*" capture="environment" data-c="rc-photo" hidden></label>
      <label class="field mt8"><span>Articles (un par ligne : nom et prix)</span><textarea name="items" id="rc-items" class="inp" rows="4" style="height:auto;text-align:left;padding:10px" placeholder="Blanc de poulet 1 kg 9,90&#10;Riz basmati 5,20&#10;Skyr 2,45"></textarea></label>
      <p class="xs muted" style="margin:4px 0 0">Les articles rejoignent « Mes aliments » : ceux que tu achètes souvent se retrouvent en un geste. Sans montant, le total des articles est utilisé.</p>
      <button class="btn btn-red btn-sm mt8" style="width:100%">+ Ajouter le ticket</button></form>
    ${RCP.length ? `<div class="list mt8">${RCP.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 12).map(r => `<div class="li"><span class="em">🛒</span><span class="grow small"><b>${esc(r.shop || "Courses")}</b><br><span class="xs muted">${fmtDate(r.d, { weekday: "short", day: "numeric", month: "short" })}</span></span><b class="num">${eur(r.amount)}</b><button class="icon-btn" data-a="receipt-del" data-id="${r.id}" aria-label="Supprimer">${I.close}</button></div>`).join("")}</div>
      <div class="card mt12"><div class="lbl">📊 Dépenses par semaine</div><div class="mt8">${barChart(perWeek, { fmt: (v) => Math.round(v) + " €" })}</div>${B.weekly ? `<p class="xs muted" style="margin:0">Budget : ${eur(B.weekly)} par semaine.</p>` : ""}</div>` : `<p class="empty small">Note le montant de chaque ticket : l'app suit ce qu'il te reste.</p>`}
    <h2 class="sec">💪 Protéines les moins chères <small>pour 100 g de protéines</small></h2>
    <div class="card">${hbars(cheap.map(x => ({ l: x.label, v: x.eur })), (v) => eur(v))}<p class="xs muted" style="margin:6px 0 0">Prix moyens estimés : ajuste-les à ton magasin dans « Mes prix ».</p></div>
    <h2 class="sec">👩‍🍳 Recettes les plus économiques</h2>
    <div class="list">${recipes.map(({ r, c }) => `<button class="li" data-a="rc-open" data-id="${r.id}"><span class="em">${r.e}</span><span class="grow small"><b>${esc(r.n)}</b><br><span class="xs muted">${r.m.kcal} kcal · ${r.m.p} g P</span></span><b class="num">${eur(c)}</b></button>`).join("")}</div>
    <h2 class="sec">🏷️ Mes prix <small>€ par kg</small></h2>
    <div class="search">${I.search}<input id="prq" placeholder="Chercher un ingrédient" value="${esc(prQ)}" autocomplete="off"></div>
    <div class="list mt8" id="prl">${priceRows(q)}</div>
    <form data-f="price-add" class="card mt8"><div class="grid2"><label class="field"><span>Aliment</span><input name="name" maxlength="40" required placeholder="ex. Riz basmati"></label><label class="field"><span>€ par kg</span><input name="kg" inputmode="decimal" placeholder="ex. 3,50"></label></div><button class="btn btn-line btn-sm mt8" style="width:100%">Ajouter cet aliment</button></form>
    <p class="xs muted mt8">Les prix servent à chiffrer tes recettes, ton batch cooking et ta liste de courses. Œufs : prix pour 1 kg (≈ 18 œufs).</p>`;
}
function priceEntries(q) {
  const rows = new Map();
  Object.entries(RC.ING).forEach(([k, v]) => rows.set(k, { k, label: v[0] }));
  Object.entries(S().priceNames || {}).forEach(([k, label]) => rows.set(k, { k, label, custom: true }));
  (S().myFoods || []).forEach(f => { const k = "m:" + N.norm(f.n); if (!rows.has(k)) rows.set(k, { k, label: f.n, eur: f.eur, g: f.g }); });
  return [...rows.values()].filter(r => !q || N.norm(r.label).includes(q)).sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
function priceRows(q) {
  const list = priceEntries(q);
  if (!list.length) return `<p class="xs muted center">Aucun aliment trouvé. Ajoute-le ci-dessous.</p>`;
  let letter = "", out = "";
  for (const r of list) {
    const c = (N.norm(r.label).charAt(0) || "#").toUpperCase(), L = /[A-Z]/.test(c) ? c : "#";
    if (L !== letter) { letter = L; out += `<div class="xs muted" style="padding:10px 4px 2px;font-weight:700">${L}</div>`; }
    const val = S().prices[r.k] ?? (r.eur && r.g ? Math.round(r.eur * 1000 / r.g * 100) / 100 : RC.priceOf(r.k, S().prices));
    out += `<div class="li"><span class="grow small">${esc(r.label)}${S().prices[r.k] != null ? ` <span class="tag r">perso</span>` : ""}${r.custom || r.k.startsWith("m:") ? ` <span class="tag">ajouté</span>` : ""}</span><input class="inp" style="width:84px" inputmode="decimal" value="${String(val).replace(".", ",")}" data-c="price" data-k="${esc(r.k)}" aria-label="Prix au kilo de ${esc(r.label)}"></div>`;
  }
  return out;
}
forms["price-add"] = (v) => {
  const name = String(v.name || "").trim(), p = num(v.kg);
  if (!name) return toast("Indique le nom de l'aliment");
  if (!(p > 0)) return toast("Indique le prix au kilo");
  const k = "m:" + N.norm(name);
  update(st => { st.priceNames = st.priceNames || {}; st.priceNames[k] = name; st.prices = st.prices || {}; st.prices[k] = Math.round(p * 100) / 100; });
  toast("Aliment ajouté"); rerender();
};
forms["budget-set"] = (v) => { const w = num(v.weekly); update(st => st.budget = { weekly: w > 0 ? Math.round(w * 100) / 100 : null, people: Math.max(1, Math.round(num(v.people)) || 1) }); toast("Budget enregistré"); rerender(); };
// Ticket de caisse : montant, magasin, articles (lus sur la photo ou tapés). Les articles alimentent « Mes aliments ».
const SKIP_LINE = /total|sous.?total|tva|carte|cb\b|esp[eè]ce|rendu|monnaie|merci|ticket|caisse|siret|tel\b|t[eé]l[eé]phone|remise|fidelit|points|avoir|montant|paiement|visa|contact/i;
export function parseReceipt(text) {
  const items = []; let total = null;
  String(text || "").split(/\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean).forEach(l => {
    const m = l.match(/(-?\d{1,4}[,.]\d{2})\s*(€|eur|euro)?\s*[a-z*]?$/i); if (!m) return;
    const eur = +m[1].replace(",", ".");
    if (/total|a payer|à payer/i.test(l) && !/sous/i.test(l)) { total = eur; return; }
    if (SKIP_LINE.test(l) || eur <= 0) return;
    const name = l.slice(0, m.index).replace(/\b\d+\s?x\b/i, "").replace(/[*#]/g, "").trim();
    if (name.length < 3 || !/[a-z]/i.test(name)) return;
    const w = name.match(/(\d+[,.]?\d*)\s?(kg|g)\b/i), g = w ? +w[1].replace(",", ".") * (w[2].toLowerCase() === "kg" ? 1000 : 1) : null;
    items.push({ n: name.replace(/\s{2,}/g, " "), eur, g });
  });
  return { items, total };
}
forms.receipt = (v) => {
  const items = parseReceipt(v.items).items;
  let a = num(v.amount); if (!(a > 0) && items.length) a = items.reduce((x, i) => x + i.eur, 0);
  if (!(a > 0 && a < 5000)) return toast("Indique le montant ou les articles");
  const shop = String(v.shop || "").trim(), d = v.d || today();
  update(st => {
    st.receipts = [...(st.receipts || []), { id: Date.now(), d, shop, amount: Math.round(a * 100) / 100, items }];
    const mine = st.myFoods = st.myFoods || [];
    items.forEach(it => { const k = N.norm(it.n), x = mine.find(f => N.norm(f.n) === k); if (x) Object.assign(x, { eur: it.eur, g: it.g ?? x.g, shop: shop || x.shop, d, count: (x.count || 1) + 1 }); else mine.push({ ...it, shop, d, count: 1 }); });
    if (mine.length > 300) mine.splice(0, mine.length - 300);
  });
  buzz(); toast(items.length ? `Ticket ajouté · ${items.length} article${items.length > 1 ? "s" : ""} dans « Mes aliments »` : "Ticket ajouté"); rerender();
};
let ocrP = null;
const loadOcr = () => ocrP || (ocrP = new Promise((ok, ko) => { if (window.Tesseract) return ok(window.Tesseract); const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"; sc.onload = () => ok(window.Tesseract); sc.onerror = () => { ocrP = null; ko(new Error("ocr")); }; document.head.appendChild(sc); }));
changes["rc-photo"] = async (el) => {
  const f = el.files?.[0]; if (!f) return;
  const form = el.closest("form"), ta = form.querySelector("#rc-items");
  addPhoto(f, form.querySelector('[name="d"]').value || today(), "ticket").catch(() => { });
  toast("Lecture du ticket… (10 à 30 s)");
  try {
    const T = await loadOcr(), w = await T.createWorker("fra"), { data } = await w.recognize(f); await w.terminate();
    const r = parseReceipt(data.text);
    if (!r.items.length && !r.total) return toast("Ticket illisible : tape le montant et les articles");
    ta.value = r.items.map(i => `${i.n} ${String(i.eur.toFixed(2)).replace(".", ",")}`).join("\n");
    if (r.total) form.querySelector('[name="amount"]').value = String(r.total.toFixed(2)).replace(".", ",");
    toast(`${r.items.length} article${r.items.length > 1 ? "s" : ""} lu${r.items.length > 1 ? "s" : ""} : vérifie puis ajoute le ticket`);
  } catch { toast("Lecture impossible hors connexion : tape le montant et les articles"); }
};
actions["receipt-del"] = (b, d) => { if (!confirm("Supprimer ce ticket ?")) return; update(st => st.receipts = st.receipts.filter(r => r.id !== +d.id)); rerender(); };
changes.price = (el) => { const v = num(el.value); update(st => { if (v > 0) st.prices[el.dataset.k] = Math.round(v * 100) / 100; else delete st.prices[el.dataset.k]; }); toast("Prix enregistré"); };
