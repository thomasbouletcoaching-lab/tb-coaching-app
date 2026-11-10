// Test de bout en bout de la bibliothèque « 8 patterns » de l'espace coach. iPhone 390×844 tactile, Supabase simulé.
// Deux cas : table cxs_exercices absente (version embarquée, lecture seule) et table présente (vidéo, désactivation).
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/exercices-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const COACH = '00000000-0000-0000-0000-00000000c0ac';
const ROWS = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/exercices.json'), 'utf8')).ex.map((e, i) => ({ id: 'id-' + i, ...e }));

// Supabase simulé : `rows` = contenu de la table cxs_exercices (null = la table n'existe pas encore)
const SB = (rows) => `
const DB = ${JSON.stringify({ COACH, rows })};
window.__updates = [];
function q(table, rpc) {
  const st = { table, f: {}, one: false, upd: null };
  const res = () => {
    if (table === 'cxs_exercices') {
      if (!DB.rows) return { data: null, error: { message: 'relation "public.cxs_exercices" does not exist' } };
      if (st.upd) { const r = DB.rows.find(x => x.id === st.f.id); Object.assign(r, st.upd); window.__updates.push({ id: st.f.id, ...st.upd }); return { data: null, error: null }; }
      return { data: DB.rows, error: null };
    }
    let d = null;
    if (rpc === 'cxs_inbox') d = [];
    else if (rpc) d = null;
    else if (table === 'cxs_profiles') d = st.f.id === DB.COACH ? { id: DB.COACH, email: 'coach@exemple.fr', name: 'Thomas', tier: 'surmesure', is_coach: true } : [];
    else d = st.one ? null : [];
    return { data: d, error: null, count: 0 };
  };
  const b = new Proxy(function () {}, { get: (t, k) => {
    if (k === 'then') return (ok, ko) => Promise.resolve(res()).then(ok, ko);
    if (k === 'eq') return (c, v) => { st.f[c] = v; return b; };
    if (k === 'update') return (v) => { st.upd = v; return b; };
    if (k === 'maybeSingle' || k === 'single') return () => { st.one = true; return b; };
    return () => b; }, apply: () => b });
  return b;
}
const session = { access_token: 't', user: { id: DB.COACH, email: 'coach@exemple.fr' } };
export function createClient() { return { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: (t) => q(t), rpc: (n) => q(null, n), channel: () => q(), removeChannel() {}, storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }), upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }) }) } }; }`;
const STATE = { profile: { name: 'Thomas', email: 'coach@exemple.fr', createdAt: '2026-09-01' }, synced: true, me: { id: COACH, tier: 'surmesure', isCoach: true } };

async function page(b, { rows, dark = false }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB(rows), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.coach.v1')) localStorage.setItem('cxs.coach.v1', s); }, JSON.stringify(STATE));
  await p.goto(BASE + 'coach.html#/admin-db', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('[data-a="db-tab"][data-v="pat"]'); await p.waitForTimeout(900);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const count = (p) => p.locator('#bib [data-a="bib-open"]').count();
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ============ 1. Table absente : version embarquée, lecture seule ============
  console.log('Table absente (avant la migration)');
  const a = await page(b, { rows: null });
  let t = await txt(a.p);
  ok(new RegExp(`${ROWS.length} exercices classés`).test(t) && /Version embarquée/.test(t), 'la bibliothèque embarquée s\'affiche');
  ok(await a.p.locator('.patgrid button').count() === 8, 'les 8 cases de pattern');
  ok(/Haut du corps/.test(t) && /Bas du corps/.test(t) && /Flexion de genou/.test(t), 'haut et bas du corps nommés');
  ok(await count(a.p) === ROWS.length, 'sans filtre : tous les exercices');
  ok((await overflow(a.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(a.p, '01-bibliotheque-clair');

  await tap(a.p, '[data-a="bib-pat"][data-v="FG"]');
  const nFG = ROWS.filter(e => e.pattern_principal === 'FG').length;
  ok(await count(a.p) === nFG, `filtre pattern FG : ${nFG} exercices`);
  ok(await a.p.locator('#bib .li .pat.FG').count() === nFG, 'chaque ligne porte la pastille FG');
  await tap(a.p, '[data-a="bib-mat"][data-v="poids_du_corps"]');
  const nFGp = ROWS.filter(e => e.pattern_principal === 'FG' && e.materiel.includes('poids_du_corps')).length;
  ok(await count(a.p) === nFGp && nFGp >= 4, `FG au poids du corps : ${nFGp} solutions`);
  await shot(a.p, '02-fg-poids-du-corps');

  await tap(a.p, '[data-a="bib-open"][data-s="nordic-hamstring-curl"]');
  t = await txt(a.p, '#sheet');
  ok(/Nordic hamstring curl/.test(t) && /Flexion de genou/.test(t) && /Coût nerveux/.test(t) && /Genou/.test(t), 'fiche : pattern, coût nerveux, contre-indication');
  ok(/Remplacements/.test(t) && /Leg curl glissé au sol/.test(t) && !/Leg curl assis/.test(t), 'remplacements filtrés par le matériel choisi');
  ok(await a.p.locator('#sheet [data-a="bib-actif"]').count() === 0 && await a.p.locator('#sheet [data-f="bib-video"]').count() === 0, 'lecture seule tant que la table n\'existe pas');
  await shot(a.p, '03-fiche');
  await a.p.evaluate(() => document.querySelector('#sheet .grab').click()); await a.p.waitForTimeout(400);

  await tap(a.p, '[data-a="bib-pat"][data-v="FG"]'); await tap(a.p, '[data-a="bib-mat"][data-v=""]');
  await tap(a.p, '[data-a="bib-couche"][data-v="isolation"]');
  ok(await count(a.p) === ROWS.filter(e => e.couche === 'isolation').length && await a.p.locator('#bib .li .pat.nul').count() > 0, 'filtre couche : isolation, pastille grise');
  await tap(a.p, '[data-a="bib-couche"][data-v=""]');
  await a.p.fill('#bib-q', 'developpe couche'); await a.p.waitForTimeout(800);
  ok(await count(a.p) === ROWS.filter(e => /développé couché/i.test(e.nom)).length, 'recherche sans accents');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));
  await a.ctx.close();

  // ============ 2. Table présente : le coach règle la vidéo et désactive ============
  console.log('Table présente (après la migration), thème sombre');
  const rows = JSON.parse(JSON.stringify(ROWS)); rows.find(r => r.slug === 'good-morning').actif = false;
  const c = await page(b, { rows, dark: true });
  t = await txt(c.p);
  ok(!/Version embarquée/.test(t) && /inactif/.test(t), 'données du serveur, exercice inactif signalé');
  ok((await overflow(c.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(c.p, '04-bibliotheque-sombre');
  await tap(c.p, '[data-a="bib-pat"][data-v="PH"]');
  await tap(c.p, '[data-a="bib-open"][data-s="pompes"]');
  await shot(c.p, '05-fiche-sombre');
  await c.p.fill('#sheet [name="url"]', 'https://exemple.fr/pompes'); await tap(c.p, '#sheet [data-f="bib-video"] button'); await c.p.waitForTimeout(500);
  let up = await c.p.evaluate(() => window.__updates);
  ok(up.length === 1 && up[0].video_url === 'https://exemple.fr/pompes' && up[0].id === rows.find(r => r.slug === 'pompes').id, 'vidéo enregistrée sur la bonne ligne');
  await tap(c.p, '[data-a="bib-open"][data-s="pompes"]'); await tap(c.p, '#sheet [data-a="bib-actif"]'); await c.p.waitForTimeout(500);
  up = await c.p.evaluate(() => window.__updates);
  ok(up.length === 2 && up[1].actif === false, 'exercice désactivé (rien n\'est supprimé)');
  await tap(c.p, '[data-a="bib-open"][data-s="developpe-couche-barre"]');
  ok(/Remplacements/.test(await txt(c.p, '#sheet')) && !(await c.p.locator('#sheet [data-a="bib-open"][data-s="pompes"]').count()), 'un exercice désactivé n\'est plus proposé en remplacement');
  ok(c.errs.length === 0, 'aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
