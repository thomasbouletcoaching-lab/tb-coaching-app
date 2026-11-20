// Retours clients du 20/11/2026 : quantités naturelles et quantité habituelle, fibres des repas enregistrés, semaine en anneaux
// et flamme, cardio dans Entraînement, séance oubliée notée après coup, séance rouverte, durée, supersets, chrono non bloquant.
// Puis (20/11, soir) : calories du tapis ou de la montre, pente et vitesse, alertes de blessure à traiter, athlète hybride et trophées dans Profil.
// iPhone 390×844 et Android 360×740 ; Supabase simulé, données fictives.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/retours-client-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, functions: { invoke: async () => ({ data: null, error: null }) }, storage: { from: () => chain() } }; }`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date()), ago = (n) => iso(new Date(Date.now() - n * 864e5));
const START = ago(20);
const food = {};
for (let i = 1; i <= 6; i++) food[ago(i)] = [{ id: i, label: 'Poulet riz', meal: 'Déjeuner', g: 350, kcal: i % 2 ? 1700 : 2600, p: 120, c: 200, f: 40 }];
food[T] = [{ id: 100, label: 'Flocon d\'avoine', meal: 'Petit-déjeuner', g: 60, kcal: 220, p: 8, c: 36, f: 4, fib: 6 }, { id: 101, label: 'Banane, pulpe, crue', meal: 'Petit-déjeuner', g: 120, kcal: 108, p: 1, c: 24, f: 0, fib: 2.4 }];
const W = (id, n) => ({ id, title: 'Séance ' + id, programId: 'tb-rep3', week: 1, idx: 0, cycle: 1, start: ago(n) + 'T17:00:00.000Z', end: ago(n) + 'T18:00:00.000Z', volume: 3200, setsDone: 2,
  exercises: [{ name: 'Squat barre', orig: 'Squat barre', kind: 'P', unit: 'reps', rest: 120, scheme: '2x8 RPE8', sets: [{ type: 'N', kg: 60, reps: 8, lo: 8, hi: 8, trpe: 8, tech: [], done: true }, { type: 'N', kg: 60, reps: 8, lo: 8, hi: 8, trpe: 8, tech: [], done: true }] }] });
const STATE = {
  profile: { name: 'Camille', email: 'camille@exemple.invalid', level: 'comeback', goal: 'fat', weight: 68, sex: 'f', age: 34, height: 166, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'all', sessionMin: 60 },
  trialStart: T, me: { tier: 'premium' }, synced: false, plan: { programId: 'tb-rep3', startedAt: START, week: 1, idx: 0, cycle: 1 },
  workouts: [W(1001, 3)], food, daily: {}, lifts: {}, settings: {},
};
const SEANCE = { id: 5005, free: true, title: 'Séance test', phase: 'Libre', week: 1, start: new Date().toISOString(), exercises: [
  { name: 'Gainage planche', orig: 'Gainage planche', kind: 'C', unit: 's', rest: 60, scheme: '2x30', bw: true, sets: [{ type: 'N', kg: null, reps: null, lo: 30, hi: 30, trpe: 8, tech: [], done: false }, { type: 'N', kg: null, reps: null, lo: 30, hi: 30, trpe: 8, tech: [], done: false }] },
  { name: 'Pompes', orig: 'Pompes', kind: 'P', unit: 'reps', rest: 60, scheme: '2x10', bw: true, sets: [{ type: 'N', kg: null, reps: null, lo: 10, hi: 10, trpe: 8, tech: [], done: false }] },
  ...Array.from({ length: 4 }, (_, i) => ({ name: 'Curl haltères ' + i, orig: 'Curl haltères ' + i, kind: 'I', unit: 'reps', rest: 60, scheme: '3x12', sets: [{ type: 'N', kg: 10, reps: null, lo: 12, hi: 12, trpe: 8, tech: [], done: false }] }))] };

async function page(b, { state, url = '#/home', vp }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message + (process.env.STACK ? ' @ ' + e.stack : '')));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|WebSocket/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept(d.type() === 'prompt' ? d.defaultValue() : undefined));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((x) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', x); }, JSON.stringify(state));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1300);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };
const act = (p, name, d = {}) => p.evaluate(async ([n, d]) => { const c = await import('./js/core.js'); await c.actions[n](document.body, d); }, [name, d]);
const go = async (p, r) => { await p.evaluate((r) => { location.hash = '#/' + r; }, r); await p.waitForTimeout(900); };
const overflow = (p, root = '#app') => p.evaluate((r) => [...document.querySelectorAll(r + ' *')].filter(e => { const x = e.getBoundingClientRect(); return x.width > 0 && x.right > document.documentElement.clientWidth + 1 && !e.closest('.hscroll,.chips,.modes,.seg,svg'); }).length, root);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [vp, nom] of [[{ width: 390, height: 844 }, 'iPhone 390×844'], [{ width: 360, height: 740 }, 'Android 360×740']]) {
    console.log('\n' + nom);
    // ---------- Nutrition : semaine en anneaux, flamme, micronutriments ----------
    let a = await page(b, { state: STATE, url: '#/food', vp });
    let t = await txt(a.p);
    ok((await a.p.locator('.wkring .wd').count()) === 7, 'semaine : 7 jours entourés');
    ok((await a.p.locator('.wkring .wd svg circle[stroke="#22A45D"], .wkring .wd svg circle[stroke="#E5484D"], .wkring .wd svg circle[stroke="#F29A2E"]').count()) >= 1, 'anneaux colorés selon l\'objectif');
    ok(/calories restantes|calories en trop/.test(t), 'calories restantes en gros');
    ok(/Micronutriments/.test(t) && /AJR/.test(t), 'aperçu des micronutriments');
    const fl = await a.p.textContent('[data-a="flame"]');
    ok(/🔥\s*\d+/.test(fl), 'flamme de série : ' + fl.trim());
    await tap(a.p, '[data-a="flame"]');
    ok(/noté/.test(await txt(a.p, '#sheet')) && /± 10 %/.test(await txt(a.p, '#sheet')), 'flamme : explications des couleurs');
    await tap(a.p, '#sheet [data-a="set-close"]');
    ok(await overflow(a.p) === 0, 'nutrition : rien ne dépasse');
    // Repas enregistré : les fibres sont gardées
    await act(a.p, 'save-meal', { m: 'Petit-déjeuner', d: T }); await a.p.waitForTimeout(300);
    let st = await S(a.p);
    ok(st.dishes[0]?.fib === 8.4 && st.dishes[0].items.every(i => i.fib != null), 'repas enregistré : fibres gardées (8,4 g)');
    // Quantité naturelle : 2 œufs
    await tap(a.p, '[data-a="add-food"]');
    await a.p.fill('#fq', 'oeuf cru'); await a.p.waitForTimeout(1200);
    const li = a.p.locator('#sheet [data-a="pick-food"]', { hasText: /^Oeuf, cru/ }).first();
    ok(await li.count() === 1, 'recherche : « Oeuf, cru »');
    if (await li.count()) {
      await li.click(); await a.p.waitForTimeout(300);
      ok(/Sans peser/.test(await txt(a.p, '#sheet')) && (await a.p.locator('#sheet .qty-pick [data-u]').count()) >= 1, 'unités sans peser proposées');
      await a.p.click('#sheet .qty-pick [data-step="1"]'); await a.p.waitForTimeout(200);
      await a.p.click('#sheet .qty-pick [data-ok]'); await a.p.waitForTimeout(500);
      st = await S(a.p);
      const e = (st.food[T] || []).find(x => /^Oeuf, cru/.test(x.label));
      ok(e && e.u === '2 œufs' && e.g === 110, 'ajouté : 2 œufs (110 g)');
      ok(st.foodHabits?.['Oeuf, cru']?.l?.[0]?.u?.n === 2, 'quantité habituelle mémorisée');
      await a.p.fill('#fq', ''); await a.p.fill('#fq', 'oeuf cru'); await a.p.waitForTimeout(1200);
      ok((await a.p.locator('#sheet [data-a="quick-food"]', { hasText: '2 œufs' }).count()) >= 1, 'ajout en un geste « + 2 œufs »');
      await a.p.click('#sheet [data-a="afs-done"]'); await a.p.waitForTimeout(600);
      ok(/2 œufs/.test(await txt(a.p)), 'journal : « 2 œufs » affiché');
    }
    ok(a.errs.length === 0, 'nutrition : zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // ---------- Entraînement : cardio, séance oubliée, séance rouverte ----------
    a = await page(b, { state: STATE, url: '#/carnet', vp });
    t = await txt(a.p);
    ok(/Cardio et activités/.test(t), 'Entraînement : carte « Cardio et activités »');
    await tap(a.p, '[data-a="act-add"]');
    await a.p.fill('#sheet input[name="min"]', '35'); await a.p.click('#sheet form[data-f="act-add"] button.btn-red'); await a.p.waitForTimeout(500);
    st = await S(a.p);
    ok(st.daily[T]?.cardio?.[0]?.min === 35, 'activité ajoutée (35 min), comptée dans la dépense');
    ok(/35 min/.test(await txt(a.p)), 'activité affichée dans Entraînement');
    // Séance loupée mais faite
    const missed = await a.p.evaluate(async () => { const E = await import('./js/engine.js'); const t = new Date(); const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); const ag = E.agenda(iso(new Date(Date.now() - 14 * 864e5)), iso(t)); return Object.entries(ag).filter(([k, v]) => v.st === 'missed').map(([k]) => k); });
    ok(missed.length >= 1, 'séances loupées trouvées : ' + missed.length);
    if (missed.length) {
      const k = missed.at(-1), n0 = (await S(a.p)).workouts.length;
      await act(a.p, 'ag-day', { v: k }); await a.p.waitForTimeout(300);
      ok((await a.p.locator('#sheet [data-a="missed-done"]').count()) === 1, 'jour loupé : « Je l\'ai faite »');
      await tap(a.p, '#sheet [data-a="missed-done"]');
      await tap(a.p, '#sheet [data-a="md-quick"]'); await a.p.waitForTimeout(500);
      st = await S(a.p);
      const w = st.workouts.find(x => x.late);
      ok(st.workouts.length === n0 + 1 && w && w.end.slice(0, 10) <= k + 'T23' && iso(new Date(w.end)) === k, 'séance rangée le jour où elle a été faite');
      const after = await a.p.evaluate(async (k) => (await import('./js/engine.js')).agenda(k, k)[k]?.st, k);
      ok(after === 'done', 'le jour n\'est plus « loupé »');
    }
    // Rouvrir une séance enregistrée
    await act(a.p, 'w-reopen', { id: '1001' }); await a.p.waitForTimeout(900);
    t = await txt(a.p);
    ok(/Séance rouverte/.test(t) && /Enregistrer/.test(t), 'séance rouverte avec l\'écran de séance');
    await a.p.fill('input[data-k="kg"][data-x="0"][data-s="0"]', '65'); await a.p.dispatchEvent('input[data-k="kg"][data-x="0"][data-s="0"]', 'input'); await a.p.waitForTimeout(200);
    await act(a.p, 'set-menu', { x: '0', s: '1' }); await a.p.waitForTimeout(300);
    await a.p.fill('#sheet textarea[data-i="setnote"]', 'genou ok'); await a.p.dispatchEvent('#sheet textarea[data-i="setnote"]', 'input'); await a.p.waitForTimeout(200);
    await act(a.p, 'set-close'); await a.p.waitForTimeout(200);
    await act(a.p, 'dur-edit'); await a.p.waitForTimeout(300);
    const nW = (await S(a.p)).workouts.length;
    await a.p.click('header [data-a="finish"]'); await a.p.waitForTimeout(800);
    st = await S(a.p);
    const w1 = st.workouts.find(x => x.id === 1001);
    ok(!st.current && st.workouts.length === nW, 'enregistrée sans doublon');
    ok(w1.exercises[0].sets[0].kg === 65 && w1.exercises[0].sets[1].note === 'genou ok', 'charge et note de série modifiées');
    // Correction rapide : durée
    await act(a.p, 'w-edit', { id: '1001' }); await a.p.waitForTimeout(300);
    await a.p.fill('#sheet [data-c="we-dur"]', '75'); await a.p.dispatchEvent('#sheet [data-c="we-dur"]', 'change');
    await act(a.p, 'we-save'); await a.p.waitForTimeout(400);
    const w2 = (await S(a.p)).workouts.find(x => x.id === 1001);
    ok(Math.round((new Date(w2.end) - new Date(w2.start)) / 6e4) === 75, 'durée corrigée : 75 min');
    ok(a.errs.length === 0, 'entraînement : zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // ---------- En séance : chrono flottant, supersets, aide sur le numéro de série ----------
    a = await page(b, { state: { ...STATE, current: SEANCE }, url: '#/workout', vp });
    t = await txt(a.p);
    ok(/numéro d'une série/.test(t), 'aide : toucher le numéro de série');
    await tap(a.p, '[data-a="chrono"][data-x="0"][data-s="0"]');
    ok(await a.p.locator('#chbar').count() === 1 && await a.p.locator('#sheet').count() === 0, 'chrono : bandeau flottant, pas de fenêtre bloquante');
    await tap(a.p, '#chbar [data-a="chrono-go"]:not([data-p])');
    await a.p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await a.p.waitForTimeout(1300);
    ok(await a.p.evaluate(() => window.scrollY) > 0, 'l\'écran défile pendant que le chrono tourne');
    ok(!/0:00/.test(await a.p.textContent('#ch-time')), 'le chrono tourne : ' + (await a.p.textContent('#ch-time')));
    await tap(a.p, '#chbar [data-a="chrono-ok"]');
    st = await S(a.p);
    ok(st.current.exercises[0].sets[0].done && st.current.exercises[0].sets[0].reps >= 1 && await a.p.locator('#chbar').count() === 0, 'chrono validé : série remplie');
    await act(a.p, 'ex-more', { x: '0' }); await a.p.waitForTimeout(300);
    await tap(a.p, '#sheet [data-a="ex-ss"]');
    await tap(a.p, '#sheet [data-a="ex-ss-next"]');
    st = await S(a.p);
    ok(st.current.exercises[0].ss && st.current.exercises[0].ss === st.current.exercises[1].ss, 'superset créé pendant la séance');
    ok(/Superset/.test(await txt(a.p)), 'superset affiché');
    await act(a.p, 'ex-ss', { x: '1' }); await a.p.waitForTimeout(300);
    await tap(a.p, '#sheet [data-a="ex-ss-set"][data-v=""]');
    ok(!(await S(a.p)).current.exercises[1].ss, 'superset retiré');
    ok(await overflow(a.p) === 0, 'séance : rien ne dépasse');
    ok(a.errs.length === 0, 'séance : zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // ---------- Activité : calories de la machine, pente et vitesse ; alertes de blessure ; Profil ----------
    const DOUL = { ...STATE, workouts: [{ ...W(1002, 2), exercises: [{ ...W(1002, 2).exercises[0], name: 'Développé couché barre', orig: 'Développé couché barre', myNote: 'gêne épaule droite' }] }] };
    a = await page(b, { state: DOUL, url: '#/carnet', vp });
    t = await txt(a.p);
    ok(!/Athlète hybride/.test(t), 'Entraînement : plus de carte « Athlète hybride »');
    await tap(a.p, '[data-a="act-add"]');
    await a.p.selectOption('#sheet select[name="t"]', { label: 'Marche inclinée (tapis)' }); await a.p.waitForTimeout(300);
    ok(await a.p.evaluate(() => document.getElementById('act-tapis')?.open), 'marche inclinée : « pente et vitesse » ouvert');
    await a.p.fill('#sheet input[name="min"]', '30'); await a.p.fill('#sheet input[name="incl"]', '12'); await a.p.fill('#sheet input[name="kmh"]', '5');
    await a.p.click('#sheet form[data-f="act-add"] button.btn-red'); await a.p.waitForTimeout(500);
    let c = (await S(a.p)).daily[T].cardio.at(-1);
    ok(c.met === 8.5 && c.incl === 12 && c.kmh === 5 && /12 % · 5 km\/h/.test(c.n), 'pente 12 % à 5 km/h : 8,5 MET');
    await tap(a.p, '[data-a="act-add"]');
    await a.p.fill('#sheet input[name="min"]', '40'); await a.p.click('#sheet details:nth-of-type(2) summary'); await a.p.fill('#sheet input[name="kcal"]', '350');
    await a.p.click('#sheet form[data-f="act-add"] button.btn-red'); await a.p.waitForTimeout(500);
    c = (await S(a.p)).daily[T].cardio.at(-1);
    const net = await a.p.evaluate(async (c) => (await import('./js/energy.js')).actKcal(c), c);
    ok(c.kcal === 350 && c.kt === 'total' && net === Math.round(350 - 68 * 40 / 60), 'calories du tapis saisies : repos retiré (' + net + ' kcal comptées)');
    ok(/350 kcal affichées/.test(await txt(a.p)), 'calories affichées dans la liste');
    // Alerte de blessure
    t = await txt(a.p);
    ok(/Alertes blessure/.test(t) && (await a.p.locator('[data-a="pain-triage"]').count()) >= 1, 'alerte de blessure avec « Traiter l\'alerte »');
    await tap(a.p, '[data-a="pain-triage"]');
    for (const [q, v] of [['int', 'faible'], ['type', 'gene'], ['quand', 'effort'], ['signes', 'non'], ['evol', 'mieux']]) await tap(a.p, `#sheet [data-a="pt-ans"][data-q="${q}"][data-v="${v}"]`);
    ok(/Plutôt bénin/.test(await txt(a.p, '#sheet')), 'questionnaire : bénin');
    await tap(a.p, '#sheet [data-a="pt-save"]');
    ok(!/Alertes blessure/.test(await txt(a.p)) && (await S(a.p)).painTriage['Développé couché barre'].v === 'benin', 'alerte rangée');
    await a.p.evaluate(async () => { const st = await import('./js/store.js'); st.update(s => { delete s.painTriage; }); }); await go(a.p, 'home'); await go(a.p, 'carnet');
    await tap(a.p, '[data-a="pain-triage"]');
    for (const [q, v] of [['int', 'moyenne'], ['type', 'vive'], ['quand', 'apres'], ['signes', 'non'], ['evol', 'pareil']]) await tap(a.p, `#sheet [data-a="pt-ans"][data-q="${q}"][data-v="${v}"]`);
    ok(/À prendre au sérieux/.test(await txt(a.p, '#sheet')) && /douleur vive/.test(await txt(a.p, '#sheet')), 'questionnaire : sérieux (douleur vive)');
    await tap(a.p, '#sheet [data-a="pt-save"]:not([data-chat])');
    ok(/à prendre au sérieux/.test(await txt(a.p)) && (await a.p.locator('[data-a="pain-ok"]').count()) >= 1, 'alerte sérieuse gardée, bouton « C\'est réglé »');
    await tap(a.p, '[data-a="pain-ok"]');
    ok(!/Alertes blessure/.test(await txt(a.p)), 'réglée : alerte rangée');
    // Profil : trophées et athlète hybride
    await go(a.p, 'profile'); t = await txt(a.p);
    ok(/Trophées et quêtes/.test(t) && /Athlète hybride/.test(t) && (await a.p.locator('#app [data-r="trophees"]').count()) >= 1, 'Profil : trophées et athlète hybride');
    await go(a.p, 'home');
    ok((await a.p.locator('#app [data-r="trophees"]').count()) === 0, 'Accueil : plus de carte trophées');
    ok(await overflow(a.p) === 0, 'rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();
  }
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})();
