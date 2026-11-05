// Test de bout en bout de l'écran « Volume de la semaine » (app client, hors ligne, données fictives).
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/volume-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const today = new Date().toISOString().slice(0, 10);
const STATE = { profile: { name: 'Client Fictif', level: 'regular', goal: 'muscle', weight: 80, startProgram: 'tb-int4', records: {}, days: 4, createdAt: today }, trialStart: today,
  plan: { programId: 'tb-int4', startedAt: today, week: 1, idx: 0, cycle: 1 }, measures: [{ d: today, weight: 80 }] };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  // Supabase simulé : aucune session (l'app fonctionne hors ligne), toutes les requêtes renvoient du vide
  const SB = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(STATE));
  const txt = async (sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');

  await p.goto(BASE + '#/builder', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.click('[data-a="vol-open"]'); await p.waitForTimeout(600);
  ok(/Volume de la semaine/.test(await txt('#app')), 'écran « Volume de la semaine » ouvert depuis l\'éditeur');
  ok(/Commence par le travail de la semaine/.test(await txt('#app')), 'brouillon vide au départ');

  // Ajout de 3 exercices par la liste
  await p.click('[data-a="vol-add"]'); await p.waitForTimeout(400);
  for (const q of ['Développé couché barre', 'Squat barre', 'Développé incliné haltères']) {
    await p.fill('#pq', q); await p.waitForTimeout(250);
    await p.click(`#pl [data-a="pick-ex"][data-n="${q}"] >> nth=0`); await p.waitForTimeout(150);
  }
  await p.click('[data-a="pick-done"]'); await p.waitForTimeout(400);
  ok((await p.$$('[data-a="vol-del"]')).length === 3, '3 exercices dans le brouillon');
  ok(await p.$eval('[data-a="vol-force"][data-l="0"]', el => el.classList.contains('on')), 'développé couché reconnu comme mouvement de force');
  await p.click('[data-a="vol-sets"][data-l="0"][data-v="1"]'); await p.click('[data-a="vol-sets"][data-l="0"][data-v="1"]'); await p.waitForTimeout(300);
  ok(/8 séries/.test(await txt('.card.soft')) || /20 séries/.test(await txt('.card.soft')), 'total des séries mis à jour');

  // Tonnage
  await p.click('[data-a="vol-mode"][data-l="0"][data-v="ton"]'); await p.waitForTimeout(200);
  await p.selectOption('[data-c="vol-f"][data-l="0"][data-k="it.t"]', 'kg'); await p.waitForTimeout(200);
  await p.fill('[data-c="vol-f"][data-l="0"][data-k="it.v"]', '100'); await p.press('[data-c="vol-f"][data-l="0"][data-k="it.v"]', 'Tab'); await p.waitForTimeout(250);
  await p.fill('[data-c="vol-f"][data-l="0"][data-k="ton"]', '3000'); await p.press('[data-c="vol-f"][data-l="0"][data-k="ton"]', 'Tab'); await p.waitForTimeout(300);
  ok(/→ 6 séries de 5 reps à 100 kg/.test(await txt('#app')), 'mode tonnage : 3000 kg à 100 kg × 5 → 6 séries');

  // Volume
  await p.click('[data-a="vol-tab"][data-v="vol"]'); await p.waitForTimeout(300);
  const vol = await txt('#app');
  ok(/Pectoraux/.test(vol) && /Quadriceps/.test(vol) && /MRV/.test(vol), 'jauges par muscle avec les repères');
  await p.click('[data-a="vol-g"][data-v="pecs"]'); await p.waitForTimeout(200);
  ok(/Pectoral haut/.test(await txt('#app')) && /Pectoral milieu/.test(await txt('#app')), 'détail par faisceau');
  ok(/Développé couché barre/.test(await txt('.vtab')), 'tableau des mouvements de force');

  // Variante : bench lourd + bench volume
  await p.click('[data-a="vol-tab"][data-v="ex"]'); await p.waitForTimeout(200);
  await p.click('[data-a="vol-dup"][data-l="0"]'); await p.waitForTimeout(300);
  ok((await p.$$('[data-a="vol-del"]')).length === 4 && /Développé couché barre · lourd/.test(await txt('#app')) && /Développé couché barre · volume/.test(await txt('#app')), 'variante lourd + volume du même exercice');

  // Split : semaine type, mouvement imposé, fréquence, répartition selon le split
  await p.click('[data-a="vol-tab"][data-v="split"]'); await p.waitForTimeout(300);
  await p.click('[data-a="vol-preset"][data-v="ul4"]'); await p.waitForTimeout(300);
  ok((await p.$$('select[data-c="vol-st"]')).length === 4, 'semaine type Upper / Lower : 4 jours');
  const heavyId = await p.$eval('[data-a="vol-pin"][data-d="0"] >> nth=0', el => el.dataset.v);
  await p.click(`[data-a="vol-pin"][data-d="0"][data-v="${heavyId}"]`); await p.waitForTimeout(250);
  await p.click('[data-a="vol-sf"][data-d="1"][data-v="Ischios"]'); await p.waitForTimeout(250);
  ok(/Pectoraux/.test(await txt('.vfreq')) && /Quadriceps/.test(await txt('.vfreq')), 'tableau de fréquence par muscle');
  await p.screenshot({ path: (process.env.SHOTS_DIR || require('os').tmpdir()) + '/volume-split.png', fullPage: true });
  await p.click('[data-a="vol-bysplit"] >> nth=0'); await p.waitForTimeout(400);
  ok(/Répartition|placées/.test(await txt('#app')), 'répartition selon le split, onglet Jours');
  const sp = await p.$$eval('.tag', els => els.map(e => e.textContent).filter(t => /placées/.test(t)));
  ok(sp.length === 4 && sp.every(t => { const [a, b] = t.match(/\d+/g); return a === b; }), 'split : toutes les séries placées (' + sp.join(', ') + ')');
  const heavyDays = await p.$$eval('.card', cs => { const c = cs.find(x => /Développé couché barre · lourd/.test(x.textContent) && x.querySelector('[data-a="vol-split"]')); return c ? [...c.querySelectorAll('.vday')].filter(v => +v.querySelector('b').textContent > 0).map(v => v.textContent.trim().slice(0, 3)) : []; });
  ok(heavyDays.length === 1 && heavyDays[0] === 'Lun', 'bench lourd imposé uniquement le lundi (' + heavyDays.join(',') + ')');

  // Répartition
  await p.click('[data-a="vol-tab"][data-v="jours"]'); await p.waitForTimeout(300);
  await p.click('[data-a="vol-auto"]'); await p.waitForTimeout(300);
  const tags = await p.$$eval('.tag', els => els.map(e => e.textContent).filter(t => /placées/.test(t)));
  ok(tags.length === 4 && tags.every(t => { const [a, b] = t.match(/\d+/g); return a === b; }), 'proposition : toutes les séries placées (' + tags.join(', ') + ')');
  await p.click('[data-a="vol-split"][data-l="1"][data-v="1"] >> nth=0'); await p.waitForTimeout(200);
  ok(/placées sur/.test(await txt('#app')), 'contrôle : séries en trop signalées sans bloquer');
  await p.click('[data-a="vol-split"][data-l="1"][data-v="-1"] >> nth=0'); await p.waitForTimeout(200);
  await p.click('[data-a="vol-build"]'); await p.waitForTimeout(800);
  const bd = await txt('#app');
  ok(/Séance A ·/.test(await p.$eval('input[data-c="bd-s"]', el => el.value)), 'séances créées dans l\'éditeur');
  ok(/Développé couché barre/.test(bd) && /Squat barre/.test(bd), 'exercices placés dans les séances');
  let saved = await p.evaluate(() => JSON.parse(localStorage.getItem('cxs.vol.self') || 'null'));
  ok(saved?.lines?.length === 4 && Object.keys(saved.plan || {}).length === 4, 'brouillon (exercices + split) gardé sur le téléphone');
  ok(/Séance A · Upper/.test(await p.$eval('input[data-c="bd-s"]', el => el.value)), 'séances nommées d\'après le split');

  // Rouvrir : le plan de volume revient
  await p.click('[data-a="vol-open"]'); await p.waitForTimeout(500);
  ok((await p.$$('[data-a="vol-del"]')).length === 4, 'le plan de volume est conservé avec le programme');
  await p.screenshot({ path: (process.env.SHOTS_DIR || require('os').tmpdir()) + '/volume-ex.png' });
  await p.click('[data-a="vol-tab"][data-v="vol"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: (process.env.SHOTS_DIR || require('os').tmpdir()) + '/volume-vol.png', fullPage: true });
  await p.click('[data-a="vol-tab"][data-v="jours"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: (process.env.SHOTS_DIR || require('os').tmpdir()) + '/volume-jours.png', fullPage: true });

  // Client : volume de son programme
  await p.goto(BASE + '#/train/programme', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  await p.click('[data-a="vol-mine"]'); await p.waitForTimeout(600);
  const sh = await txt('#sheet');
  ok(/Volume · semaine 1/.test(sh) && /séries/.test(sh), 'client : volume de son programme par muscle');
  await p.click('#sheet [data-a="vol-g"] >> nth=0'); await p.waitForTimeout(200);
  ok(!!(await p.$('#sheet')), 'la fenêtre reste ouverte en dépliant un muscle');

  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`); process.exit(fails ? 1 : 0);
})();
