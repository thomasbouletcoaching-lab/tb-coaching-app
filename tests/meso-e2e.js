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

async function page(b, { state, url = '#/monprogramme', tier = 'free', trial = true }) {
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
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: name === 'meso-page' }); } };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(350); };
const pick = (p, v) => tap(p, `[data-a="pq-pick"][data-v="${v}"]`);
const multi = async (p, vals) => { for (const v of vals) await p.check(`input[name="v"][value="${v}"]`, { force: true }); await tap(p, '[data-f="pq-multi"] button'); };

const row = (n, k, ss) => [n, k, '', ss || null, null, { sets: [1, 2, 3].map(() => ({ t: 'N', lo: 8, hi: 8, kg: null, pct: 70, rpe: 8, tech: [] })), prog: { load: 'auto', step: 2.5, every: 1, addSet: null, reps: null } }];
const PROG = { id: 'my-meso', custom: true, name: 'Cycle 16', lvl: 'Perso', split: 'Perso', weeks: 12, deload: { every: 4 }, days: [true, false, true, false, true, false, false], prof: '', desc: '',
  s: [['Séance A', 'Lundi', [row('Squat barre', 'F'), row('Développé couché', 'P', 'A'), row('Tractions', 'P', 'A'), row('Curl biceps', 'I')]], ['Séance B', 'Mercredi', [row('Soulevé de terre', 'F'), row('Rowing barre', 'P', 'B'), row('Élévations latérales', 'I', 'B')]]] };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  console.log('Mésocycles, courbes, séries par muscle, supersets en couleur');
  const a = await page(b, { url: '#/builder/my-meso', state: { customPrograms: [PROG] } });
  const p = a.p;
  ok(/Mésocycles, volume et intensité/.test(await txt(p)), "éditeur : bouton Mésocycles, volume et intensité");
  const ss = await p.$$eval('.bd-ex.ss', els => els.map(e => e.getAttribute('style') || ''));
  ok(ss.length === 4 && ss.every(x => /--ss:#/.test(x)), 'éditeur : 4 exercices en superset colorés');
  ok(new Set(ss).size === 2, 'éditeur : une couleur par superset (A ≠ B)');
  await tap(p, '[data-a="go"][data-r="builder-meso"]');
  ok(/Aucun bloc/.test(await txt(p)), 'page mésocycles vide au départ');
  await tap(p, '[data-a="ms-ex16"]');
  ok((await p.$$('.frise .fz')).length === 8, 'exemple 16 semaines : 8 blocs dans la frise');
  ok(/Accumulation/.test(await txt(p)) && /Intensification/.test(await txt(p)) && /Réalisation/.test(await txt(p)) && /Allègement/.test(await txt(p)), 'phases nommées visibles');
  ok((await p.$$('svg path')).length >= 2 && (await p.$$('input[data-c="ms-v"]')).length === 32, 'courbes : graphique superposé et 16 × 2 cases');
  await shot(p, 'meso-page');
  // modifier une case de volume
  await p.fill('input[data-c="ms-v"][data-k="vol"][data-w="3"]', '140'); await p.dispatchEvent('input[data-c="ms-v"][data-k="vol"][data-w="3"]', 'change'); await p.waitForTimeout(300);
  ok((await p.inputValue('input[data-c="ms-v"][data-k="vol"][data-w="3"]')) === '140', 'volume semaine 3 : 140 %');
  // éditer un bloc
  await tap(p, '.li[data-a="ms-edit"]');
  ok(await p.$('[data-f="ms-blk"]') !== null, 'fenêtre du bloc ouverte');
  await p.fill('[data-f="ms-blk"] input[name="sets"]', '4'); await tap(p, '[data-f="ms-blk"] button:not([type="button"])');
  ok(/4×8/.test(await txt(p)), 'bloc modifié : 4×8');
  // séries par muscle
  await tap(p, '[data-a="ms-mus-add"]'); await tap(p, '[data-a="ms-mus-pick"][data-g="dos"]');
  await p.fill('[data-f="ms-mus-fill"] input[name="start"]', '12'); await tap(p, '[data-f="ms-mus-fill"] button');
  ok((await p.inputValue('input[data-c="ms-m"][data-g="dos"][data-w="1"]')) === '12' && (await p.inputValue('input[data-c="ms-m"][data-g="dos"][data-w="2"]')) === '13', 'dos : rampe 12, 13…');
  ok((await p.inputValue('input[data-c="ms-m"][data-g="dos"][data-w="4"]')) === '8', 'dos : allègement à 60 % du dernier niveau (14 → 8)');
  // retour + enregistrement
  await tap(p, '[data-a="go"][data-r="builder"]');
  ok(/8 blocs/.test(await txt(p)), 'retour éditeur : 8 blocs annoncés');
  await tap(p, '[data-a="bd-save"]');
  const st = await S(p), pr = (st.customPrograms || []).find(x => x.id === 'my-meso');
  ok(pr && pr.meso?.length === 8 && pr.weeks === 16 && pr.vol?.[3] === 140 && pr.muscleSets?.dos?.[1] === 12, 'programme enregistré avec blocs, courbes et séries par muscle');
  ok(pr?.phases?.length === 16 && pr.phases[3] === 'Deload', 'phases du cycle dérivées des blocs');
  // exercice : choix par exercice
  await tap(p, '[data-a="go"][data-r="builder"][data-p="my-meso"], [data-a="bd-edit"]').catch(() => { });
  ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs[0] ? ' : ' + a.errs[0] : ''));
  console.log(`\n${passed} réussis, ${fails} échoués`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
