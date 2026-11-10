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

async function page(b, { state, url = '#/plan', tier = 'free', trial = true }) {
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
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  console.log('Fin de l\'onboarding : proposition du programme sur mesure');
  const a = await page(b, {});
  let t = await txt(a.p);
  ok(/Un programme encore plus à toi/.test(t) && /Tu peux aussi le faire plus tard/.test(t), 'écran du plan : le questionnaire est proposé');
  ok(/Plus tard, c'est parti/.test(await txt(a.p, '.dock')), 'on peut passer : bouton « Plus tard, c\'est parti »');
  await a.p.click('.dock [data-a="go"]'); await a.p.waitForTimeout(500);
  ok(/home|Accueil/i.test(await a.p.evaluate(() => location.hash + document.title)) || !(await a.p.$('#ob-sur-mesure')), 'passer mène à l\'accueil sans bloquer');
  await a.p.goto(BASE + 'index.html#/plan', { waitUntil: 'load' }); await a.p.waitForTimeout(1000);
  await a.p.click('#ob-sur-mesure [data-a="go"]'); await a.p.waitForTimeout(500);
  ok(/Un programme qui tient dans ta vie/.test(await txt(a.p)), 'répondre maintenant ouvre le questionnaire');
  const c = await page(b, { state: { programme: { v: 1, at: new Date().toISOString(), answers: { goal: 'fat' }, prefs: {} } } });
  ok(!(await c.p.$('#ob-sur-mesure')) && /C'est parti/.test(await txt(c.p, '.dock')), 'déjà répondu : la proposition disparaît');
  ok(a.errs.length === 0 && c.errs.length === 0, 'aucune erreur dans la console');
  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})();
