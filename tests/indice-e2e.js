// Test de bout en bout de l'indice de difficulté de la séance : proposition, version courte, onglet Entraînement, côté coach.
// iPhone 390×844 tactile, Supabase simulé, données fictives. Lancement : servir la racine sur BASE_URL, puis `node tests/indice-e2e.js`.
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

async function page(b, { state, url = '#/monplan', dark = false, coach = false }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  const key = coach ? 'cxs.coach.v1' : 'cxs.v1', st = mkState(state); if (coach) st.me = { id: '00000000-0000-0000-0000-00000000c0ac', tier: 'surmesure', isCoach: true };
  await p.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, s); }, [key, JSON.stringify(st)]);
  await p.goto(BASE + (coach ? 'coach.html' : 'index.html') + url, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const S = (p, key = 'cxs.v1') => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };
const NIVEAUX = /Légère|Modérée|Exigeante|Très exigeante/;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Proposition : pastille et « En savoir plus »');
  const a = await page(b, { state: { programme: PROG() } });
  let t = await txt(a.p);
  ok(await a.p.locator('.card.mt8 .idx').count() === 4 && await a.p.locator('.idxbars').count() === 4, 'une pastille d\'indice par séance (4 séances)');
  ok((await a.p.locator('.idx b').allTextContents()).every(x => NIVEAUX.test(x)), 'niveaux : Légère / Modérée / Exigeante / Très exigeante');
  ok(!/INOL/.test(t), 'le mot « INOL » n\'apparaît pas dans l\'écran du membre');
  ok((await overflow(a.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(a.p, '01-proposition-indice');
  await tap(a.p, '[data-a="mp-indice"][data-s="0"]');
  t = await txt(a.p, '#sheet');
  ok(/Indice de difficulté de la séance/.test(t) && /La durée/.test(t) && /La charge d'intensité/.test(t) && /Le coût nerveux/.test(t), '« En savoir plus » : les trois ingrédients');
  ok(/inspirée de l'INOL/.test(t) && !/Détail coach/.test(t), 'INOL cité une fois pour le curieux, sans le détail coach');
  ok(/Légère moins de 28/.test(t) && /pas proposées à la suite|ne sont pas proposées/.test(t), 'bandes et règle des séances très exigeantes');
  await shot(a.p, '02-en-savoir-plus');
  await a.p.evaluate(() => document.querySelector('#sheet .grab').click()); await a.p.waitForTimeout(400);

  console.log('Version courte');
  const prop0 = (await S(a.p)).monplan.prop, min0 = prop0.sessions[0].minutes;
  await tap(a.p, '[data-a="mp-courte"][data-s="0"]');
  t = await txt(a.p, '#sheet');
  ok(/Version courte/.test(t) && /Retiré/.test(t) && await a.p.locator('#sheet .chip').count() === 3, 'feuille : trois durées (20, 30, 45) et ce qui est retiré');
  const mins = async () => +(((await txt(a.p, '#sheet')).match(/à (\d+) min/) || [])[1]);
  const m45 = await mins();
  ok(m45 <= 45 && m45 < min0, `45 min : ${m45} min (séance d'origine : ${min0} min)`);
  await tap(a.p, '#sheet [data-c="20"]');
  const m20 = await mins();
  ok(m20 <= 21 && m20 < m45, `20 min : ${m20} min`);
  ok(await a.p.locator('#sheet .li').count() >= 2 && !/Curl|Extension triceps|Élévation latérale/.test(await txt(a.p, '#sheet .card')), 'plus d\'isolation dans la version courte');
  ok(await a.p.locator('#sheet .idx').count() === 1, 'indice de la version courte affiché');
  await shot(a.p, '03-version-courte');
  ok(JSON.stringify((await S(a.p)).monplan.prop.sessions[0].items) === JSON.stringify(prop0.sessions[0].items), 'la séance de la proposition n\'a pas changé');
  await a.p.evaluate(() => document.querySelector('#sheet .grab').click()); await a.p.waitForTimeout(400);
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));

  console.log('Onglet Entraînement : programme de la banque, puis programme adopté');
  await a.p.evaluate(() => { location.hash = '#/train/programme'; }); await a.p.waitForTimeout(1500);
  const sessions = await a.p.locator('#app .card.mt8 > .mt12').count();
  const tags = await a.p.locator('#app .card.mt8 > .mt12 .idx').count();
  ok(sessions >= 3 && tags === sessions, `programme de la banque : une pastille par séance (${tags}/${sessions})`);
  ok((await a.p.locator('#app .card.mt8 > .mt12 .idx b').allTextContents()).every(x => NIVEAUX.test(x)), 'niveaux valides sur un programme existant');
  const avantAff = await a.p.evaluate(async () => { const E = await import('./js/engine.js'); return JSON.stringify(E.programs().map(p => p.s)); });
  await a.p.evaluate(() => { location.hash = '#/train/stats'; }); await a.p.waitForTimeout(500); await a.p.evaluate(() => { location.hash = '#/train/programme'; }); await a.p.waitForTimeout(1200);
  ok(avantAff === await a.p.evaluate(async () => { const E = await import('./js/engine.js'); return JSON.stringify(E.programs().map(p => p.s)); }), 'afficher l\'indice ne modifie aucun programme');
  await shot(a.p, '04-entrainement-banque');
  await tap(a.p, '#app .idxinfo >> nth=0');
  ok(/Indice de difficulté de la séance/.test(await txt(a.p, '#sheet')), '« En savoir plus » depuis l\'onglet Entraînement');
  await a.p.evaluate(() => document.querySelector('#sheet .grab').click()); await a.p.waitForTimeout(400);
  await a.p.evaluate(() => { location.hash = '#/monplan'; }); await a.p.waitForTimeout(900);
  await tap(a.p, '[data-a="mp-adopter"]'); await a.p.waitForTimeout(1500);
  const sessions2 = await a.p.locator('#app .card.mt8 > .mt12').count(), tags2 = await a.p.locator('#app .card.mt8 > .mt12 .idx').count();
  ok(sessions2 === 4 && tags2 === 4, `programme adopté : une pastille par séance (${tags2}/${sessions2})`);
  const idxProp = (await S(a.p)).monplan.prop.sessions.map(s => s.indice.niveau.nom);
  const idxVue = await a.p.locator('#app .card.mt8 > .mt12 .idx b').allTextContents();
  ok(JSON.stringify(idxProp) === JSON.stringify(idxVue.slice(0, 4)), 'même indice dans la proposition et dans le programme adopté : ' + idxVue.join(' · '));
  await shot(a.p, '05-entrainement-adopte');
  ok(a.errs.length === 0, 'aucune erreur JavaScript');
  const pcts = await a.p.evaluate(async () => { const E = await import('./js/engine.js'), I = await import('./js/indice.js'); return [[1, 10], [3, 8], [5, 8], [8, 8], [10, 7], [12, 8], [15, 6], [20, 8]].map(([r, p]) => [E.pctFor(r, p), I.pctDe(r, p)]); });
  ok(pcts.every(([e, i]) => Math.abs(e - i) < 1e-9), 'le % du 1RM estimé est identique à celui du moteur de séances');
  await a.ctx.close();

  console.log('Thème sombre');
  const d = await page(b, { state: { programme: PROG({ sessionMin: 90, level: 'advanced', goal: 'strength', materiel: ['salle_complete'], daysWanted: 5, daysReal: 5 }) }, dark: true });
  ok(await d.p.locator('.idx').count() === 5 && (await overflow(d.p)).length === 0, 'sombre : 5 pastilles, rien ne dépasse');
  const niv = await d.p.locator('.idx b').allTextContents();
  ok(!niv.some((x, i) => x === 'Très exigeante' && niv[(i + 1) % niv.length] === 'Très exigeante'), 'jamais deux séances très exigeantes de suite : ' + niv.join(' · '));
  await shot(d.p, '06-sombre');
  await d.ctx.close();

  console.log('Côté coach : détail INOL');
  const c = await page(b, { state: { programme: PROG() }, coach: true });
  await tap(c.p, '[data-a="mp-indice"][data-s="0"]');
  t = await txt(c.p, '#sheet');
  ok(/Détail coach/.test(t) && /INOL total/.test(t) && /coût nerveux/.test(t) && /INOL \d/.test(t) && /Indice : \d+\/100/.test(t), 'le coach voit l\'INOL total, par exercice, et l\'indice sur 100');
  ok(/Coefficients/.test(t), 'coefficients affichés pour être ajustés');
  await shot(c.p, '07-coach-detail');
  ok(c.errs.length === 0, 'aucune erreur JavaScript');
  await c.ctx.close();

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
