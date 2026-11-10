// Test de bout en bout de « Mon programme proposé » : iPhone 390×844 tactile, Supabase simulé, données fictives.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/monplan-e2e.js`.
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
const PROG = (extra = {}) => ({ v: 1, at: '2026-11-10T10:00:00.000Z', answers: { goal: 'muscle', goal2: 'none', level: 'regular', materiel: ['salle_basique'], daysWanted: 4, daysReal: 4, sessionMin: 75, zones: [], style: 'any', priorities: ['bras'], ...extra }, prefs: {} });
const mkState = (extra = {}) => ({ profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'regular', goal: 'muscle', weight: 80, sex: 'm', age: 30, height: 178, days: 3, startProgram: 'tb-rep3', records: {}, createdAt: T }, trialStart: T, synced: false, plan: { programId: 'tb-rep3', startedAt: T, week: 1, idx: 0, cycle: 1 }, ...extra });

async function page(b, { state, url = '#/monplan', dark = false }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(mkState(state)));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name, full = false) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }); } };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Sans questionnaire');
  const a = await page(b, {});
  ok(/Réponds d'abord au questionnaire/.test(await txt(a.p)), 'invitation à répondre au questionnaire');
  ok(a.errs.length === 0, 'aucune erreur JavaScript');
  await a.ctx.close();

  console.log('Proposition (4 séances, salle basique, priorité bras)');
  const c = await page(b, { state: { programme: PROG() } });
  let t = await txt(c.p);
  ok(/4×/.test(t) && /minutes/.test(t) && /12/.test(t) && /ne change que si tu l'adoptes/.test(t), 'résumé : séances, durée, 12 semaines, rien d\'imposé');
  ok(await c.p.locator('.mpcase').count() === 8, 'squelette : 8 cases');
  ok(await c.p.locator('.mpbar i').count() === 8, 'barres de volume');
  ok(/Haut du corps/.test(t) && /Bas du corps/.test(t) && /priorité bras|Isolation ajoutée/.test(t), 'haut / bas du corps, isolation annoncée');
  ok(await c.p.locator('.mpc[title]').count() >= 8, 'grille de la semaine : cases colorées');
  ok(await c.p.locator('#app .card.mt8 .li').count() >= 20, 'séances : exercices listés');
  ok(/Haut du corps A/.test(t) && /Bas du corps B/.test(t), 'séances nommées');
  ok(/Est-ce que ça tient/.test(t) && /Les 8 patterns sont couverts/.test(t) && /48 h/.test(t), 'contrôles affichés');
  ok((await overflow(c.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(c.p, '01-proposition-haut'); await shot(c.p, '02-proposition-complet', true);
  const avant = await S(c.p);
  ok(avant.plan.programId === 'tb-rep3' && !(avant.customPrograms || []).length, 'le programme en cours n\'a pas bougé');
  ok(avant.monplan.prop.sessions.length === 4 && avant.monplan.progAt === '2026-11-10T10:00:00.000Z', 'proposition gardée sur le téléphone');

  console.log('Remplacer, autre variante');
  const prem = avant.monplan.prop.sessions[0].items[0];
  await tap(c.p, '[data-a="mp-remplacer"][data-s="0"][data-i="0"]');
  t = await txt(c.p, '#sheet');
  ok(/Remplacer/.test(t) && /séries sont conservées/.test(t) && await c.p.locator('#sheet [data-a="mp-pick"]').count() >= 2, 'feuille « remplacer » : alternatives du même pattern');
  ok(!(await c.p.locator(`#sheet [data-x="${prem.slug}"]`).count()), 'l\'exercice en cours n\'est pas reproposé');
  await shot(c.p, '03-remplacer');
  const choix = await c.p.locator('#sheet [data-a="mp-pick"]').first().getAttribute('data-x');
  await tap(c.p, '#sheet [data-a="mp-pick"]'); await c.p.waitForTimeout(500);
  const apres = await S(c.p), l2 = apres.monplan.prop.sessions[0].items[0];
  ok(l2.slug === choix && l2.slug !== prem.slug && l2.n === prem.n && l2.pattern === prem.pattern, 'remplacé : même pattern, mêmes séries');
  await tap(c.p, '[data-a="mp-autre"]'); await c.p.waitForTimeout(400);
  const v2 = await S(c.p);
  ok(v2.monplan.seed === 1 && JSON.stringify(v2.monplan.prop.sessions.map(s => s.items.map(l => l.slug))) !== JSON.stringify(apres.monplan.prop.sessions.map(s => s.items.map(l => l.slug))), 'autre variante : d\'autres exercices');

  console.log('Adopter');
  await tap(c.p, '[data-a="mp-adopter"]'); await c.p.waitForTimeout(1200);
  const ad = await S(c.p);
  const gen = (ad.customPrograms || []).find(x => String(x.id).startsWith('gen-'));
  ok(!!gen && ad.plan.programId === gen.id && ad.plan.week === 1 && ad.plan.idx === 0, 'programme ajouté et suivi à partir de la semaine 1');
  ok(gen.s.length === 4 && gen.weeks === 12 && gen.deload.every === 4 && gen.days.filter(Boolean).length === 4, 'programme au format du moteur');
  ok(JSON.stringify(ad.workouts) === JSON.stringify(avant.workouts) && JSON.stringify(ad.lifts) === JSON.stringify(avant.lifts) && JSON.stringify(ad.daily) === JSON.stringify(avant.daily) && JSON.stringify(ad.food) === JSON.stringify(avant.food) && JSON.stringify(ad.profile) === JSON.stringify(avant.profile), 'séances, charges, journal et profil existants intacts');
  ok(/#\/train/.test(await c.p.evaluate(() => location.hash)), 'retour sur l\'entraînement');
  const moteur = await c.p.evaluate(async () => { const E = await import('./js/engine.js'); await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib()]); const s = E.buildSession(); return s ? { title: s.title, n: s.exercises.length, noms: s.exercises.map(e => e.name), sets: s.exercises.map(e => e.sets.length) } : null; });
  ok(moteur && moteur.n >= 5 && moteur.sets.every(n => n >= 1), 'le moteur de séances construit la première séance : ' + (moteur ? moteur.title + ' · ' + moteur.n + ' exercices' : 'rien'));
  ok(c.errs.length === 0, 'aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));
  await shot(c.p, '04-apres-adoption');
  await c.ctx.close();

  console.log('Séance en cours, réponses modifiées, thème sombre');
  const d = await page(b, { state: { programme: PROG() } });
  await d.p.evaluate(async () => { const { update } = await import('./js/store.js'); update(st => { st.current = { id: 'x', title: 'Séance', start: new Date().toISOString(), exercises: [] }; }); });
  await tap(d.p, '[data-a="mp-adopter"]'); await d.p.waitForTimeout(500);
  const st0 = await S(d.p);
  ok(st0.plan.programId === 'tb-rep3' && !(st0.customPrograms || []).length && /Termine ta séance en cours/.test(await txt(d.p, 'body')), 'séance en cours : l\'adoption est refusée, le programme ne change pas');
  const e = await page(b, { state: { programme: PROG(), monplan: { at: '2026-11-01T00:00:00Z', progAt: 'ancien', seed: 0, prop: { v: 1, sessions: [] } } }, dark: true });
  const regen = await S(e.p);
  ok(regen.monplan.progAt === '2026-11-10T10:00:00.000Z' && regen.monplan.prop.sessions.length === 4, 'réponses modifiées depuis : la proposition est refaite');
  ok((await overflow(e.p)).length === 0, 'sombre : rien ne dépasse');
  await shot(e.p, '05-sombre');
  const f = await page(b, { state: { programme: PROG({ materiel: ['poids_du_corps'], level: 'beginner', daysWanted: 3, daysReal: 3, sessionMin: 45 }) } });
  t = await txt(f.p);
  ok(/Aucun exercice possible/.test(t) && /Patterns absents/.test(t), 'au poids du corps seul : le tirage vertical manquant est dit clairement');
  ok(f.errs.length === 0 && e.errs.length === 0, 'aucune erreur JavaScript');
  await shot(f.p, '06-poids-du-corps');

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
