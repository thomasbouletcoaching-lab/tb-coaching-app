// Test de bout en bout du questionnaire « Mon programme sur mesure » : iPhone 390×844 tactile, Supabase simulé, données fictives.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/programme-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date());
const mkState = (extra = {}) => ({ profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'comeback', goal: 'fat', weight: 86, sex: 'm', age: 38, height: 178, days: 3, startProgram: 'tb-rep3', records: {}, createdAt: T }, trialStart: T, synced: false, plan: { programId: 'tb-rep3', startedAt: T, week: 1, idx: 0, cycle: 1 }, ...extra });

async function page(b, { state, url = '#/atelier', tier = 'free', trial = true }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  const st = mkState(state); if (!trial) st.trialStart = '2026-01-01'; if (tier !== 'free') st.me = { tier, isCoach: false };
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(st));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1400);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(350); };
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *, #sheet *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,svg'); }).length);
async function choisir(p, groupe, slug, session = 0) {
  await p.evaluate(([g, s]) => document.querySelector(`[data-a="at-choix"]`)?.click(), [groupe, session]);
  await p.waitForTimeout(300);
  await p.click(`#sheet [data-a="at-g"][data-g="${groupe}"]`); await p.waitForTimeout(250);
  await p.click(`#sheet [data-a="at-pick"][data-x="${slug}"]`); await p.waitForTimeout(350);
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  console.log('Atelier : compte en essai');
  const a = await page(b, {});
  let t = await txt(a.p);
  ok(/Ta semaine, bâtie sur 8 catégories de mouvements/.test(t) && /Partir d'une page blanche/.test(t), 'écran de départ');
  ok(/questionnaire/.test(t), 'sans questionnaire : lien vers le questionnaire');
  await tap(a.p, '[data-a="at-blanc"]');
  t = await txt(a.p);
  ok(/Ton squelette/.test(t) && (await a.p.locator('.mpcase').count()) === 8, 'éditeur : 8 cartes de catégories');
  ok((await a.p.locator('#app svg[role="img"]').count()) === 1, 'graphique d\'équilibre (radar) présent');
  ok(/Place tes premiers exercices/.test(t), 'message d\'accueil des contrôles');
  ok(await a.p.locator('.dock button[disabled]').count() === 1, 'impossible de commencer sans exercice');
  // + sur Poussée horizontale : le choix s'ouvre sur la bonne catégorie
  await a.p.click('[data-a="at-pat-d"][data-c="PH"][data-v="1"]'); await a.p.waitForTimeout(350);
  t = await txt(a.p, '#sheet');
  ok(/Ajouter des exercices/.test(t) && /Développé couché barre/.test(t) && /Les 8 catégories de mouvements/.test(t), 'choix : catégories et exercices de Poussée horizontale');
  ok(/Pecs/.test(t) && /Tous les muscles/.test(t), 'choix : filtre par muscle');
  ok(await overflow(a.p) === 0, 'choix : rien ne dépasse de l\'écran');
  await a.p.fill('#sheet [data-c="at-q"]', 'incliné barre'); await a.p.waitForTimeout(350);
  ok(/Développé incliné barre/.test(await txt(a.p, '#sheet')), 'recherche par nom');
  await a.p.fill('#sheet [data-c="at-q"]', ''); await a.p.waitForTimeout(300);
  await a.p.click('#sheet [data-a="at-pick"][data-x="developpe-couche-barre"]'); await a.p.waitForTimeout(250);
  await a.p.click('#sheet [data-a="at-pick"][data-x="developpe-incline-barre"]'); await a.p.waitForTimeout(250);
  ok(/Ajouter 2 exercices/.test(await txt(a.p, '#sheet')), 'sélection multiple : 2 exercices cochés');
  await a.p.click('#sheet [data-a="at-pick"][data-x="developpe-incline-barre"]'); await a.p.waitForTimeout(250);
  await a.p.click('#sheet [data-a="at-ajout"]'); await a.p.waitForTimeout(400);
  let st = await S(a.p);
  ok(st.atelier.d.sessions.some(s => s.items.some(l => l.slug === 'developpe-couche-barre')), 'exercice ajouté au brouillon (gardé sur le téléphone)');
  ok(/\d+ séries? ·/.test(await txt(a.p, '.mpcase')), 'la carte PH affiche ses séries');
  // les exercices rois sont tous accessibles dans leur catégorie
  const rois = [['SG', 'squat-barre'], ['PV', 'developpe-militaire-barre-ohp'], ['PV', 'developpe-militaire-halteres'], ['CH', 'souleve-de-terre-roumain-barre'], ['CH', 'souleve-de-terre-roumain-halteres'], ['TH', 'rowing-penche-debout-a-la-barre'], ['TV', 'tractions-pronation-poids-de-corps'], ['SH', 'squat-barre-basse-low-bar'], ['FG', 'leg-curl-assis']];
  for (const [g, s] of rois) {
    await a.p.evaluate(([gg]) => document.querySelector('[data-a="at-choix"][data-s="1"]').click(), [g]); await a.p.waitForTimeout(250);
    await a.p.click(`#sheet [data-a="at-g"][data-g="${g}"]`); await a.p.waitForTimeout(200);
    await a.p.click('#sheet [data-a="at-tout"]', { timeout: 400 }).catch(() => {}); await a.p.waitForTimeout(150);
    const dispo = await a.p.locator(`#sheet [data-a="at-pick"][data-x="${s}"]`).count();
    ok(dispo === 1, `exercice roi disponible : ${s} (${g})`);
    if (['squat-barre', 'souleve-de-terre-roumain-barre', 'rowing-penche-debout-a-la-barre', 'developpe-militaire-barre-ohp', 'tractions-pronation-poids-de-corps', 'squat-barre-basse-low-bar', 'leg-curl-assis'].includes(s)) { await a.p.click(`#sheet [data-a="at-pick"][data-x="${s}"]`); await a.p.waitForTimeout(250); await a.p.click('#sheet [data-a="at-ajout"]'); await a.p.waitForTimeout(350); }
    else await a.p.evaluate(() => document.getElementById('sheet')?.remove());
  }
  t = await txt(a.p);
  ok(/Les huit catégories de mouvements sont présentes/.test(t), 'les 8 catégories présentes : contrôle vert');
  ok((await a.p.locator('.mpcase', { hasText: 'Absent' }).count()) === 0, 'aucune catégorie absente');
  ok(/Pectoraux/.test(t) && /Quadriceps/.test(t) && /minimum \d+ · idéal/.test(t), 'volume par muscle affiché avec les repères');
  // le graphique reflète les séries
  ok((await a.p.locator('#app svg polygon[fill="var(--tint)"]').count()) === 1, 'radar rempli');
  // fiche d'un exercice : focus et superset
  await a.p.click('[data-a="at-fiche"][data-s="0"][data-i="0"]'); await a.p.waitForTimeout(350);
  t = await txt(a.p, '#sheet');
  ok(/Focus sur ce mouvement/.test(t) && /Superset avec le suivant/.test(t) && /Séries/.test(t), 'fiche d\'exercice : séries, focus, superset');
  const n0 = (await S(a.p)).atelier.d.sessions[0].items[0].n;
  await tap(a.p, '#sheet [data-a="at-focus"]');
  let it0 = (await S(a.p)).atelier.d.sessions[0].items[0];
  ok(it0.focus === true && it0.n === n0 + 2, 'focus : +2 séries');
  await a.p.evaluate(() => document.getElementById('sheet')?.remove());
  await a.p.click('[data-a="at-fiche"][data-s="1"][data-i="0"]'); await a.p.waitForTimeout(350);
  await tap(a.p, '#sheet [data-a="at-ss"]');
  const s1 = (await S(a.p)).atelier.d.sessions[1].items;
  ok(s1[0].ss === 'A' && s1[1].ss === 'A', 'superset avec l\'exercice suivant');
  await a.p.evaluate(() => document.getElementById('sheet')?.remove());
  await a.p.click('[data-a="at-fiche"][data-s="0"][data-i="0"]'); await a.p.waitForTimeout(350);
  it0 = (await S(a.p)).atelier.d.sessions[0].items[0];
  await tap(a.p, '#sheet [data-a="at-r"][data-k="rpe"][data-v="1"]');
  ok((await S(a.p)).atelier.d.sessions[0].items[0].rpe > it0.rpe, 'RPE réglable');
  ok(await overflow(a.p) === 0, 'fiche : rien ne dépasse');
  await a.p.evaluate(() => document.getElementById('sheet')?.remove());
  await a.p.waitForTimeout(100);
  // répartition d'une catégorie
  await a.p.evaluate(() => { document.querySelector('[data-a="at-pat"][data-c="PH"]').click(); }); await a.p.waitForTimeout(350);
  ok(/Répartis-les sur tes séances/.test(await txt(a.p, '#sheet')) && /Jours où tu travailles ce mouvement/.test(await txt(a.p, '#sheet')), 'répartition par séance et jours du mouvement');
  let nPH = (await S(a.p)).atelier.d.sessions[0].items.find(l => l.slug === 'developpe-couche-barre').n;
  await tap(a.p, '#sheet [data-a="at-ln"][data-s="0"][data-v="1"]');
  ok((await S(a.p)).atelier.d.sessions[0].items.find(l => l.slug === 'developpe-couche-barre').n === nPH + 1, 'séries réglables exercice par exercice');
  await tap(a.p, '#sheet [data-a="at-lj"][data-s="0"][data-i="0"][data-v="2"]');
  ok((await S(a.p)).atelier.d.sessions[2].items.some(l => l.slug === 'developpe-couche-barre'), 'exercice envoyé sur un autre jour');
  await tap(a.p, '#sheet [data-a="at-pj"][data-c="PH"][data-v="0"]');
  ok(JSON.stringify((await S(a.p)).atelier.d.patJours.PH) === '[0,4]', 'jours du mouvement modifiables');
  await tap(a.p, '#sheet [data-a="at-lj"][data-s="2"][data-i="0"][data-v="0"]');
  ok((await S(a.p)).atelier.d.sessions[0].items.some(l => l.slug === 'developpe-couche-barre'), 'retour sur un jour du mouvement');
  ok(await overflow(a.p) === 0, 'répartition : rien ne dépasse');
  await a.p.evaluate(() => document.getElementById('sheet')?.remove());
  // travail direct
  await a.p.evaluate(() => document.querySelector('[data-a="at-choix"][data-g="biceps"]').click()); await a.p.waitForTimeout(300);
  ok(/Biceps/.test(await txt(a.p, '#sheet')), 'travail direct : biceps');
  await a.p.evaluate(() => { const b = document.querySelector('#sheet [data-a="at-pick"]'); b.click(); }); await a.p.waitForTimeout(300);
  await a.p.click('#sheet [data-a="at-g"][data-g="triceps"]'); await a.p.waitForTimeout(250);
  await a.p.evaluate(() => { const b = document.querySelector('#sheet [data-a="at-pick"]'); b.click(); }); await a.p.waitForTimeout(300);
  await a.p.click('#sheet [data-a="at-cs"][data-v="1"]'); await a.p.waitForTimeout(250);
  await a.p.click('#sheet [data-a="at-ajout"]'); await a.p.waitForTimeout(400);
  const s1b = (await S(a.p)).atelier.d.sessions[1].items;
  ok(s1b.some(l => l.categorie === 'biceps') && s1b.some(l => l.categorie === 'triceps'), 'isolation : plusieurs catégories ajoutées d\'un coup sur le jour choisi');
  ok(await overflow(a.p) === 0, 'éditeur : rien ne dépasse à 390 px');
  // adopter
  await tap(a.p, '[data-a="at-adopter"]'); await a.p.waitForTimeout(900);
  st = await S(a.p);
  const pg = (st.customPrograms || []).find(p => p.id === 'atelier');
  ok(!!pg && st.plan?.programId === 'atelier', 'programme enregistré et adopté');
  ok(pg.s[1][2].some(r => r[3] === 'A') && pg.s.length === 3, 'superset et séances présents dans le programme du moteur');
  const ok2 = await a.p.evaluate(async () => { const E = await import('./js/engine.js'); await E.loadPrograms(); await E.loadFiches(); await E.loadLib(); const s = E.buildSession(); return !!s && s.exercises.length > 0; });
  ok(ok2, 'le moteur sait construire la séance du programme');
  ok(a.errs.length === 0, 'aucune erreur JavaScript ' + a.errs.join('|'));
  // reprise du brouillon
  await a.p.goto(BASE + 'index.html#/atelier', { waitUntil: 'load' }); await a.p.waitForTimeout(1000);
  ok(/Ton squelette/.test(await txt(a.p)) && (await a.p.locator('.mpcase').count()) === 8, 'le brouillon est retrouvé');
  console.log('Atelier : thème sombre');
  const c = await page(b, {});
  await c.p.emulateMedia({ colorScheme: 'dark' }); await tap(c.p, '[data-a="at-blanc"]');
  ok(await c.p.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'), 'thème sombre appliqué');
  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})();
