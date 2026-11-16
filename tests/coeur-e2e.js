// Cœur de l'app, trois boucles : 1. accueil « Aujourd'hui » 2. saisie quotidienne en 2 taps maximum 3. séance et progression.
// En iPhone 390×844 ET petit Android 360×740, en clair ET en sombre, animations réduites. Données fictives uniquement.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/coeur-e2e.js`.
// Une seule boucle : `BOUCLE=2 node tests/coeur-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
let fails = 0, passed = 0;
const B = (n) => !process.env.BOUCLE || +process.env.BOUCLE === n;
const ok = (c, msg) => { if (c) { passed++; } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };

// Persona fictive : Alex, programme 3 séances par semaine, démarré il y a 8 jours. `t0` = « maintenant » pour la page (date simulée).
function persona(t0, { plan = true, absent = 0 } = {}) {
  const ago = (n) => iso(new Date(t0 - n * 864e5)), START = ago(8);
  const daily = {}, food = {};
  for (let i = 1 + absent; i <= 8 + absent; i++) { daily[ago(i)] = { weight: 71.4, sleep: 7.5, steps: 8200, water: 6 }; food[ago(i)] = [{ id: i, label: 'Flocons d\'avoine', meal: 'Petit-déjeuner', time: '08:00', g: 80, kcal: 300, p: 11, c: 48, f: 6 }, { id: i + .5, label: 'Poulet riz', meal: 'Déjeuner', time: '12:30', g: 350, kcal: 520, p: 160, c: 60, f: 10 }]; }
  const st = {
    profile: { name: 'Alex', email: 'alex@exemple.fr', level: 'comeback', goal: 'fat', weight: 71.4, sex: 'f', age: 34, height: 168, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'all', sessionMin: 60 },
    trialStart: START, synced: false, workouts: [], daily, food,
    dishes: [{ n: 'Bowl du midi', kcal: 610, p: 42, c: 70, f: 16 }],
    recentFoods: [{ n: 'Riz blanc, cuit', kcal: 130, p: 2.7, c: 28, f: 0.3, g: 150 }], favFoods: [],
  };
  if (plan) st.plan = { programId: 'tb-rep3', startedAt: START, week: 2, idx: 0, cycle: 1 };
  return st;
}
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;
const CONFS = [['iPhone clair', 390, 844, 'light'], ['iPhone sombre', 390, 844, 'dark'], ['Android clair', 360, 740, 'light'], ['Android sombre', 360, 740, 'dark']];

// Ce qui dépasse à droite de l'écran, feuilles comprises (hors zones prévues pour défiler)
const mesure = (w) => {
  const over = [...document.querySelectorAll('#app *, #sheet *, .rest *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && !e.closest('.chips:not(.wrap),.hscroll,.modes,.seg,svg,pre'); }).map(e => String(e.className || e.tagName)).slice(0, 3);
  return { over, docW: document.documentElement.scrollWidth };
};
// Cibles tactiles trop petites (moins de 44 px) parmi les boutons et champs visibles
const petits = (sel) => [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5); }).map(e => (e.dataset.a || e.dataset.i || e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)).slice(0, 5);

async function ouvrir(b, { state, w, h, scheme, t0, url = '#/home' }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/i.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((ms) => { const R = Date; const off = ms - R.now(); const N = class extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }; window.Date = N; }, t0);
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(state));
  await p.goto(BASE + url, { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  const S = async () => { await p.waitForTimeout(350); return p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1'))); };
  const va = async (r) => { await p.evaluate((r) => { location.hash = '#/' + r; }, r); await p.waitForTimeout(700); };
  const tap = async (sel) => { await p.locator(sel).first().click(); await p.waitForTimeout(450); };
  const sain = async (nom) => { const m = await p.evaluate(mesure, w); ok(m.over.length === 0 && m.docW <= w + 1, `${nom} : rien ne dépasse de l'écran (largeur ${m.docW} pour ${w}) ${m.over.join(', ')}`); ok(errs.length === 0, `${nom} : aucune erreur JavaScript` + (errs.length ? ' (' + errs.slice(0, 2).join(' | ').slice(0, 200) + ')' : '')); };
  return { p, ctx, errs, S, va, tap, sain };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  // Midi, pour que « aujourd'hui » soit le même jour en heure locale et en UTC
  const midi = new Date(); midi.setHours(12, 0, 0, 0); const NOW = midi.getTime();
  // Un jour où une séance est prévue : on avance la date simulée jusqu'à en trouver un (au plus une semaine)
  let TS = null;
  for (let i = 0; i < 7 && TS == null; i++) { const t = NOW + i * 864e5; const x = await ouvrir(b, { state: persona(t), w: 390, h: 844, scheme: 'light', t0: t }); if (await x.p.locator('#hero [data-a="start"]').count()) TS = t; await x.ctx.close(); }
  ok(TS != null, 'un jour avec séance prévue existe dans la semaine');

  for (const [nom, w, h, scheme] of CONFS) {
    console.log(nom + ' (' + w + '×' + h + ')');
    const ago = (n, t = NOW) => iso(new Date(t - n * 864e5)), T = ago(0);

    // ───── Boucle 1 : accueil « Aujourd'hui » ─────
    // Sans séance prévue : l'action du jour est la saisie de la journée
    let a, g, s;
    if (B(1)) {
    a = await ouvrir(b, { state: persona(NOW, { plan: false }), w, h, scheme, t0: NOW });
    g = await a.p.evaluate(() => { const top = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? null; const hero = document.querySelector('#hero'); const red = [...hero.querySelectorAll('.btn-red')].filter(e => e.getBoundingClientRect().height > 0);
      return { hero: top('#hero'), forme: top('#forme'), prog: top('#progression'), fold: top('details.fold'), premiere: document.querySelector('main .card') === hero.querySelector('.card'), red: red.length, redBas: red[0]?.getBoundingClientRect().bottom, vh: innerHeight, ouverts: document.querySelectorAll('details.fold[open]').length, replis: document.querySelectorAll('details.fold').length,
        redVus: [...document.querySelectorAll('main .btn-red')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight; }).length, titre: hero.querySelector('h2')?.textContent, serie: !!document.querySelector('#gam .serie'), gam: document.querySelector('#gam')?.textContent || '' }; });
    ok(g.premiere, `${nom} · accueil : la première carte est l'action du jour`);
    ok(/Note ta journée/.test(g.titre), `${nom} · accueil sans séance : l'action du jour est la saisie de la journée (${g.titre})`);
    ok(g.red === 1 && g.redBas <= g.vh, `${nom} · accueil : un seul bouton principal, visible sans défiler (${g.red}, bas à ${Math.round(g.redBas)} pour ${g.vh})`);
    ok(g.redVus === 1, `${nom} · accueil : une seule action principale dans le premier écran (${g.redVus})`);
    ok(g.hero < g.forme && g.forme <= g.prog && g.prog < g.fold, `${nom} · accueil : ordre action, forme, progression, reste (${[g.hero, g.forme, g.prog, g.fold].map(Math.round)})`);
    ok(g.replis >= 3 && g.ouverts === 0, `${nom} · accueil : le reste est replié (${g.ouverts} ouvert sur ${g.replis})`);
    ok(g.serie && /de série/.test(g.gam) && /Quêtes du jour/.test(g.gam), `${nom} · accueil : série et quêtes du jour visibles`);
    await a.sain(`${nom} · accueil sans séance`);
    await a.tap('details.fold[data-fold="jour"] > summary'); await a.tap('details.fold[data-fold="sem"] > summary'); await a.tap('details.fold[data-fold="prog"] > summary');
    await a.sain(`${nom} · accueil, sections dépliées`);
    await a.ctx.close();
    }

    // ───── Boucle 2 : saisie quotidienne en 2 taps maximum ─────
    if (B(2)) {
    a = await ouvrir(b, { state: persona(NOW, { plan: false }), w, h, scheme, t0: NOW });
    ok(await a.p.locator('#hero input[data-k="weight"]').inputValue() === '71,4', `${nom} · poids pré-rempli avec la dernière valeur`);
    await a.tap('#hero [data-a="routine-same"][data-k="weight"]'); await a.tap('#hero [data-a="routine-same"][data-k="sleep"]'); await a.tap('#hero [data-a="routine-same"][data-k="steps"]');
    s = await a.S();
    ok(s.daily[T]?.weight === 71.4 && s.daily[T]?.sleep === 7.5 && s.daily[T]?.steps === 8200, `${nom} · poids, sommeil, pas : confirmés en un tap chacun (${JSON.stringify(s.daily[T])})`);
    await a.tap('#hero [data-a="food-copy"]'); s = await a.S();
    ok((s.food[T] || []).length === 2 && s.food[T][0].time === '08:00', `${nom} · « copier hier » depuis l'accueil : un tap, 2 aliments, heures gardées`);
    ok(/Journée notée|Note ta journée/.test(await a.p.locator('#hero h2').textContent()) && await a.p.locator('#hero [data-a="routine-same"]').count() === 0, `${nom} · accueil mis à jour après la saisie`);
    await a.sain(`${nom} · accueil après saisie`);
    await a.ctx.close();

    a = await ouvrir(b, { state: persona(NOW, { plan: false }), w, h, scheme, t0: NOW, url: '#/food' });
    ok(await a.p.locator('#onetap [data-a="food-copy"][data-m]').count() === 2, `${nom} · journal : les repas d'hier sont proposés`);
    await a.sain(`${nom} · journal`);
    await a.tap('#onetap [data-a="food-copy"][data-m="Déjeuner"]'); s = await a.S();
    ok((s.food[T] || []).length === 1 && s.food[T][0].meal === 'Déjeuner', `${nom} · journal : un repas d'hier copié en un tap`);
    await a.tap('#onetap [data-a="dish-now"]'); s = await a.S();
    ok((s.food[T] || []).length === 2 && s.food[T][1].label === 'Bowl du midi', `${nom} · journal : un repas type ajouté en un tap`);
    await a.tap('[data-a="add-food"]'); await a.sain(`${nom} · feuille d'ajout`);
    ok((await a.p.evaluate(petits, '#sheet [data-a="quick-food"]')).length === 0, `${nom} · feuille d'ajout : bouton d'ajout direct d'au moins 44 px`);
    await a.tap('#sheet [data-a="quick-food"]'); s = await a.S();
    ok((s.food[T] || []).length === 3 && s.food[T][2].g === 150 && s.food[T][2].kcal === 195, `${nom} · ajout d'un aliment récent en 2 taps, à la dernière quantité`);
    await a.tap('#sheet [data-a="afs-done"]');
    await a.va('recup');
    ok(await a.p.locator('input[name="h"]').inputValue() === '7,5', `${nom} · récupération : sommeil pré-rempli avec la dernière nuit`);
    await a.sain(`${nom} · récupération`);
    await a.tap('#sleep-same'); s = await a.S();
    ok(s.daily[T]?.sleep === 7.5 && await a.p.locator('#sleep-same').count() === 0, `${nom} · récupération : nuit confirmée en un tap`);
    await a.ctx.close();
    }

    // ───── Boucle 3 : séance et progression ─────
    if (B(3)) {
    a = await ouvrir(b, { state: persona(TS), w, h, scheme, t0: TS });
    g = await a.p.evaluate(() => { const hero = document.querySelector('#hero'); const r = hero.querySelector('[data-a="start"]')?.getBoundingClientRect(); return { start: !!r, bas: r?.bottom, vh: innerHeight, red: [...document.querySelectorAll('main .btn-red')].filter(e => { const q = e.getBoundingClientRect(); return q.height > 0 && q.top < innerHeight; }).length, routineRepliee: !!document.querySelector('details.fold[data-fold="jour"]:not([open]) [data-c="routine"]') }; });
    ok(g.start && g.bas <= g.vh && g.red === 1, `${nom} · accueil avec séance : « Commencer la séance » est la seule action principale, visible sans défiler`);
    ok(g.routineRepliee, `${nom} · accueil avec séance : la saisie de la journée passe au second plan, repliée`);
    await a.sain(`${nom} · accueil avec séance`);
    await a.tap('#hero [data-a="start"]'); await a.sain(`${nom} · durée de la séance`);
    await a.tap('#sheet [data-a="dur-go"]'); await a.p.waitForTimeout(600);
    let k = await a.p.evaluate(() => ({ ouverts: document.querySelectorAll('article.ex').length, lignes: document.querySelectorAll('.exline').length, nom: document.querySelector('article.ex h3')?.firstChild?.textContent.trim(), tick: document.querySelector('article.ex [data-a="tick"]')?.getBoundingClientRect().top, vh: innerHeight, anim: document.getAnimations().length }));
    ok(/#\/workout/.test(await a.p.evaluate(() => location.hash)) && k.ouverts >= 1 && k.lignes >= 1, `${nom} · séance démarrée en 2 taps : un exercice déplié, les autres sur une ligne (${k.ouverts} déplié, ${k.lignes} lignes)`);
    ok(k.tick < k.vh, `${nom} · séance : la première série se valide sans défiler (bouton à ${Math.round(k.tick)} px pour ${k.vh})`);
    const pt = await a.p.evaluate(petits, '#app button, #app input, #app summary'); ok(pt.length === 0, `${nom} · séance : boutons et champs d'au moins 44 px ${pt.join(', ')}`);
    await a.sain(`${nom} · séance`);
    const nb = await a.p.locator('article.ex').first().locator('[data-a="tick"]').count();
    await a.p.locator('article.ex input[data-k="kg"]').first().fill('40'); await a.p.locator('article.ex input[data-k="reps"]').first().fill('8');
    await a.tap('article.ex [data-a="tick"]'); s = await a.S();
    ok(s.current.exercises[0].sets[0].done && s.current.exercises[0].sets[0].kg === 40 && s.current.exercises[0].sets[0].reps === 8, `${nom} · séance : série saisie et validée`);
    const rp = await a.p.evaluate(petits, '.rest button'); const ra = await a.p.evaluate(() => { const r = document.querySelector('.rest'); return r ? getComputedStyle(r).animationName + '/' + document.getAnimations().length : 'absent'; });
    ok(rp.length === 0, `${nom} · minuteur de repos : boutons d'au moins 44 px ${rp.join(', ')}`);
    ok(ra === 'none/0', `${nom} · animations réduites respectées pendant la séance (${ra})`);
    await a.sain(`${nom} · séance, minuteur de repos`);
    if (await a.p.locator('#sheet').count()) await a.p.evaluate(() => document.querySelector('#sheet .grab')?.click());
    for (let i = 1; i < nb; i++) { await a.p.locator('article.ex').first().locator('.set:not(.done) [data-a="tick"]').first().click(); await a.p.waitForTimeout(350); if (await a.p.locator('#sheet').count()) { await a.p.evaluate(() => document.querySelector('#sheet .grab')?.click()); await a.p.waitForTimeout(200); } }
    const k2 = await a.p.evaluate(() => ({ nom: document.querySelector('article.ex h3')?.firstChild?.textContent.trim(), faits: document.querySelectorAll('.exline.done').length }));
    ok(k2.nom !== k.nom && k2.faits >= 1, `${nom} · séance : l'exercice terminé se replie, le suivant s'ouvre (${k.nom} → ${k2.nom})`);
    await a.sain(`${nom} · séance, exercice suivant`);
    await a.tap('header [data-a="finish"]'); await a.p.waitForTimeout(500); s = await a.S();
    ok(/Séance terminée/.test(await a.p.textContent('#app')) && s.workouts.length === 1 && !s.current, `${nom} · séance terminée et enregistrée`);
    await a.sain(`${nom} · fin de séance`);
    await a.va('home');
    ok(/séance faite/.test(await a.p.locator('#hero').textContent()) && await a.p.locator('#hero [data-a="start"]').count() === 0, `${nom} · accueil après la séance : l'action du jour devient la saisie de la journée`);
    await a.sain(`${nom} · accueil après la séance`);
    await a.ctx.close();

    // Retour après une absence de 6 jours : message positif, jamais de reproche. Jour de repos : la série tient.
    a = await ouvrir(b, { state: persona(NOW, { absent: 6 }), w, h, scheme, t0: NOW });
    const msg = await a.p.locator('#gam .retour').count() ? await a.p.locator('#gam .retour').innerText() : '';
    ok(/On reprend/.test(msg) && !/manqu|rat[ée]|perdu|dommage|retard|enfin/i.test(msg), `${nom} · retour après absence : message positif (« ${msg} »)`);
    await a.sain(`${nom} · accueil, retour après absence`);
    await a.va('trophees'); ok(/On reprend/.test(await a.p.textContent('#app')), `${nom} · trophées : message de retour positif`); await a.sain(`${nom} · trophées`);
    await a.ctx.close();
    // Programme en cours, 8 jours actifs : on vide un jour SANS séance prévue (repos). La série doit le traverser : 7 jours, pas moins.
    a = await ouvrir(b, { state: persona(NOW), w, h, scheme, t0: NOW });
    const agenda = await a.p.evaluate(async ([d1, d2]) => { const E = await import(new URL('js/engine.js', location.href).href); return E.agenda(d1, d2); }, [ago(7), ago(2)]);
    const repos = [2, 3, 4, 5, 6, 7].find(n => !agenda[ago(n)]);
    ok(repos != null, `${nom} · un jour sans séance prévue existe dans la semaine passée`);
    await a.ctx.close();
    a = await ouvrir(b, { state: (() => { const st = persona(NOW); delete st.daily[ago(repos)]; delete st.food[ago(repos)]; return st; })(), w, h, scheme, t0: NOW });
    const serie = parseInt((await a.p.locator('#gam .serie b').innerText()).replace(/\D/g, ''), 10);
    ok(serie === 7, `${nom} · un jour de repos prévu (il y a ${repos} jours) ne casse pas la série (${serie} jours, 7 attendus)`);
    ok(await a.p.locator('#gam .retour').count() === 0, `${nom} · pas de message de retour sans absence`);
    await a.ctx.close();
    }
  }
  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
