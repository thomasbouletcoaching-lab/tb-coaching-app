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
const mkState0 = (extra = {}) => ({ profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'comeback', goal: 'fat', weight: 86, sex: 'm', age: 38, height: 178, days: 3, startProgram: 'tb-rep3', records: {}, createdAt: T }, trialStart: T, synced: false, plan: { programId: 'tb-rep3', startedAt: T, week: 1, idx: 0, cycle: 1 }, ...extra });

async function page(b, { state, url = '#/roadmap/77', tier = 'free', trial = true }) {
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

const addD = (n) => iso(new Date(Date.now() + n * 864e5));
const mkState = (extra = {}) => { const s = mkState0(extra); s.lifts = { 'Développé couché barre': [{ d: addD(-21), e1rm: 98 }, { d: addD(-14), e1rm: 100 }, { d: addD(-7), e1rm: 101 }] }; return s; };
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(400); };
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,svg'); }).length);
const goal = (kg, jours) => ({ id: 77, name: 'Développé couché barre', kg, reps: 1, date: addD(jours), start: 95, created: addD(-7) });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  console.log('Roadmap : objectif ambitieux');
  const a = await page(b, { state: { goals: [goal(110, 84)] } });
  let t = await txt(a.p);
  ok(/Roadmap/.test(t) && /110 kg × 1/.test(t) && /Ton objectif/.test(t), 'objectif affiché');
  ok(/Réaliste|Ambitieux|Pas réaliste dans ce délai/.test(t), 'verdict affiché : ' + (t.match(/(Réaliste|Ambitieux|Pas réaliste dans ce délai)/) || [])[0]);
  ok(/Étape par étape/.test(t) && (await a.p.locator('details').count()) >= 10, 'une carte par semaine');
  ok((await a.p.locator('#app svg[role="img"] polyline').count()) === 1, 'courbe de progression');
  ok(/Jour J/.test(t) && /Affûtage/.test(t) && /Deload/.test(t), 'phases : affûtage, décharge, jour J');
  ok(/\d+ × \d+\s*@ [\d,]+ kg/.test(t) && /RPE/.test(t) && /%/.test(t), 'séries, charge en kg, pourcentage et RPE');
  ok(await overflow(a.p) === 0, 'rien ne dépasse à 390 px');
  await tap(a.p, '[data-a="rm-freq"][data-v="3"]');
  ok((await S(a.p)).goals[0].road.freq === 3 && (await a.p.locator('details').first().locator('text=Technique').count()) === 1, '3 séances par semaine : séance technique ajoutée');
  await a.p.selectOption('[data-c="rm-niv"]', 'avance'); await a.p.waitForTimeout(400);
  t = await txt(a.p);
  ok(/Pas réaliste dans ce délai/.test(t) && /Deux façons de le rendre tenable/.test(t), 'niveau avancé : pas réaliste, avec deux issues');
  await tap(a.p, '[data-a="rm-kg"]');
  const g2 = (await S(a.p)).goals[0]; ok(g2.kg < 110 && g2.kg >= 100, 'objectif ajusté à ' + g2.kg + ' kg');
  await a.p.fill('[data-c="rm-cur"]', '104'); await a.p.dispatchEvent('[data-c="rm-cur"]', 'change'); await a.p.waitForTimeout(400);
  ok((await S(a.p)).goals[0].road.cur === 104, '1RM de départ modifiable');
  await a.p.selectOption('[data-c="rm-niv"]', 'regulier'); await a.p.waitForTimeout(300);
  await tap(a.p, '[data-a="rm-freq"][data-v="2"]');
  // adopter
  await tap(a.p, '[data-a="rm-adopter"]'); await a.p.waitForTimeout(800);
  const st = await S(a.p), pg = (st.customPrograms || []).find(p => p.id === 'road-77');
  ok(!!pg && st.plan.programId === 'road-77' && pg.s.length === 2, 'programme créé et adopté');
  const main = pg.s[0][2][0];
  ok(Object.keys(main[5].weeks).length === pg.weeks && main[5].weeks[1].every(x => x.kg > 0), 'charges en kg pour chaque semaine');
  const dernier = pg.s[1][2][0][5].weeks[pg.weeks].at(-1);
  ok(dernier.kg === (await S(a.p)).goals[0].kg && dernier.rpe === 10, 'la dernière séance porte la tentative à la charge visée');
  const seance = await a.p.evaluate(async () => { const E = await import('./js/engine.js'); await E.loadPrograms(); await E.loadFiches(); await E.loadLib(); const s = E.buildSession(); return s ? { n: s.exercises.length, first: s.exercises[0].name, sets: s.exercises[0].sets.map(x => x.kg || x.target || null) } : null; });
  ok(seance && seance.first === 'Développé couché barre' && seance.n >= 3, 'le moteur construit la séance : ' + JSON.stringify(seance));
  ok(a.errs.length === 0, 'aucune erreur JavaScript ' + a.errs.join('|'));
  console.log('Roadmap : objectif réaliste, objectif atteint, date trop proche');
  const c = await page(b, { state: { goals: [goal(103, 84)] } });
  ok(/Réaliste/.test(await txt(c.p)), 'petit objectif : réaliste');
  const d = await page(b, { state: { goals: [goal(100, 84)] } });
  ok(/Déjà dans tes cordes/.test(await txt(d.p)), 'objectif déjà couvert');
  const e = await page(b, { state: { goals: [goal(110, 3)] } });
  ok(/trop proche/.test(await txt(e.p)) && (await e.p.locator('details').count()) === 0, 'échéance trop proche : message clair, pas de roadmap');
  const f = await page(b, { url: '#/roadmap/999', state: { goals: [goal(110, 84)] } });
  ok(/Pas d'objectif choisi/.test(await txt(f.p)), 'objectif inconnu : message clair');
  console.log('Roadmap : depuis la page des objectifs, thème sombre');
  const h = await page(b, { url: '#/train/saison', state: { goals: [goal(110, 84)] } });
  ok(/Voir la roadmap/.test(await txt(h.p)), 'bouton « Voir la roadmap » sur l\'objectif');
  await h.p.emulateMedia({ colorScheme: 'dark' }); await h.p.click('[data-a="go"][data-r="roadmap"]'); await h.p.waitForTimeout(700);
  ok(/Ton objectif/.test(await txt(h.p)) && await h.p.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'), 'thème sombre');
  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})();
