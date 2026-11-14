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
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(350); };
const pick = (p, v) => tap(p, `[data-a="pq-pick"][data-v="${v}"]`);
const multi = async (p, vals) => { for (const v of vals) await p.check(`input[name="v"][value="${v}"]`, { force: true }); await tap(p, '[data-f="pq-multi"] button'); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  // ===== 1. Parcours pendant l'essai (app complète) =====
  console.log('Parcours pendant l\'essai');
  const a = await page(b, {});
  let t = await txt(a.p);
  ok(/Un programme qui tient dans ta vie/.test(t), 'écran d\'accueil du questionnaire');
  await shot(a.p, '01-intro');
  await tap(a.p, '[data-a="pq-start"]');
  ok(/objectif principal/.test(await txt(a.p)), 'première question : objectif principal');
  await pick(a.p, 'fat'); await pick(a.p, 'muscle');
  ok(/objectif chiffré/.test(await txt(a.p)), 'question facultative : objectif chiffré');
  await a.p.fill('input[name="v"]', '-8 kg d\'ici juin'); await tap(a.p, '[data-f="pq-text"] button');
  await pick(a.p, 'comeback');
  await shot(a.p, '02-materiel');
  await tap(a.p, '[data-f="pq-multi"] button');
  ok(/Choisis au moins une réponse/.test(await txt(a.p, 'body')) || /matériel/.test(await txt(a.p)), 'matériel : au moins un choix exigé');
  await multi(a.p, ['poids_du_corps', 'elastique']);
  await pick(a.p, '5'); await pick(a.p, '3');
  await pick(a.p, '30');
  await shot(a.p, '03-genes');
  ok(/gêne/.test(await txt(a.p)) && /professionnel de santé/.test(await txt(a.p)), 'gênes : mention d\'un professionnel de santé');
  await multi(a.p, ['genou']);
  await pick(a.p, 'any');
  ok(/muscles/.test(await txt(a.p)), 'pendant l\'essai, la partie avancée suit la partie courte');
  // Partie avancée, puis favoris, jusqu'au récapitulatif
  await multi(a.p, ['pecs', 'dos']); await multi(a.p, ['PH', 'FG']);
  await pick(a.p, 'lot'); await pick(a.p, 'limited'); await pick(a.p, 'good');
  await pick(a.p, '3'); await pick(a.p, '5'); await multi(a.p, ['temps']);
  await pick(a.p, '6.5'); await pick(a.p, 'mid'); await pick(a.p, 'desk'); await pick(a.p, 'yes');
  await tap(a.p, '[data-a="pq-favs-ok"]');
  t = await txt(a.p);
  ok(/C'est noté, Karim/.test(t) && /5 voulues · 3 tenables/.test(t), 'fin : récapitulatif et écart voulues/tenables');
  ok(/on construira ton programme sur 3/.test(t), 'message sur la régularité');
  const st = await S(a.p);
  ok(st.programme?.answers?.goal === 'fat' && st.programme.answers.daysReal === 3 && st.programme.answers.zones[0] === 'genou' && st.programme.answers.materiel.length === 2 && st.programme.answers.target === '-8 kg d\'ici juin', 'réponses enregistrées sur le téléphone');
  ok((await overflow(a.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(a.p, '04-fin');
  // Modifier : les réponses sont reprises
  await tap(a.p, '[data-a="pq-start"]');
  ok(await a.p.locator('.choice.on').count() === 1, 'modification : la réponse précédente est cochée');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));
  // Essai terminé, sans abonnement : le questionnaire n'est plus accessible, l'app montre les offres
  const z = await page(b, { trial: false });
  ok(/Ton essai est terminé/.test(await txt(z.p)) && await z.p.locator('[data-a="pq-start"]').count() === 0, 'essai terminé : écran des offres à la place du questionnaire');
  ok(z.errs.length === 0, 'essai terminé : aucune erreur JavaScript');
  await z.ctx.close();
  await a.ctx.close();

  // ===== 2. Parcours Premium, thème par défaut =====
  console.log('Parcours Premium');
  const c = await page(b, { tier: 'premium' });
  await tap(c.p, '[data-a="pq-start"]');
  const flow = [['pick', 'strength'], ['pick', 'none'], ['skip'], ['pick', 'regular'], ['multi', ['salle_basique']], ['pick', '4'], ['pick', '4'], ['pick', '60'], ['multi', []], ['pick', 'hautbas']];
  for (const [k, v] of flow) { if (k === 'pick') await pick(c.p, v); else if (k === 'multi') { await multi(c.p, v); } else await tap(c.p, '[data-f="pq-text"] button'); }
  ok(/muscles/.test(await txt(c.p)), 'Premium : la partie avancée suit la partie courte');
  await multi(c.p, ['pecs', 'dos']);
  await multi(c.p, ['PH', 'FG']);
  await pick(c.p, 'lot'); await pick(c.p, 'limited'); await pick(c.p, 'good');
  await pick(c.p, '3');
  ok(/combien de temps/.test(await txt(c.p)), 'arrêts passés : la durée est demandée');
  await pick(c.p, '5'); await multi(c.p, ['temps', 'perfectionnisme']);
  await pick(c.p, '6.5'); await pick(c.p, 'mid'); await pick(c.p, 'desk'); await pick(c.p, 'yes');
  let t2 = await txt(c.p);
  ok(/exercices favoris/.test(t2) && /Poussée horizontale/.test(t2) && /Flexion de genou/.test(t2), 'favoris : exercices groupés par pattern');
  ok(await c.p.locator('.pat').count() >= 8, 'pastilles de pattern');
  ok(await c.p.locator('[data-slug="leg-curl-assis"]').count() === 1 && await c.p.locator('[data-slug="hack-squat-machine"]').count() === 0, 'liste adaptée au matériel : salle basique, pas de hack squat (salle complète)');
  await shot(c.p, '05-favoris');
  await c.p.evaluate(() => (document.scrollingElement || document.body).scrollTo(0, 400)); await c.p.waitForTimeout(200);
  await tap(c.p, '[data-slug="pompes"] [data-v="love"]');
  ok(await c.p.locator('[data-slug="pompes"] [data-v="love"].on').count() === 1, 'j\'adore : coché');
  ok(await c.p.evaluate(() => (document.scrollingElement || document.body).scrollTop) >= 300, 'la liste ne remonte pas à chaque touche');
  await tap(c.p, '[data-slug="leg-curl-assis"] [data-v="hate"]');
  await tap(c.p, '[data-slug="pompes"] [data-v="love"]');
  ok(await c.p.locator('[data-slug="pompes"] [data-v="love"].on').count() === 0, 'toucher à nouveau remet neutre');
  await tap(c.p, '[data-slug="chest-press-machine"] [data-v="love"]');
  await tap(c.p, '[data-a="pq-favs-ok"]');
  t2 = await txt(c.p);
  ok(/C'est noté/.test(t2) && /1 adoré · 1 détesté/.test(t2) && /Anatomie/.test(t2) && /Priorités/.test(t2) && /Arrêts passés/.test(t2), 'fin : récapitulatif complet');
  await shot(c.p, '06-fin-premium');
  const sp = (await S(c.p)).programme;
  ok(sp.prefs['chest-press-machine'] === 'love' && sp.prefs['leg-curl-assis'] === 'hate' && !sp.prefs.pompes, 'préférences enregistrées');
  ok(sp.answers.quits === '3' && sp.answers.quitAfter === '5' && sp.answers.quitWhy.length === 2 && sp.answers.weak.join() === 'PH,FG', 'réponses avancées enregistrées');
  ok(c.errs.length === 0, 'aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));
  await c.ctx.close();

  // ===== 3. Gênes reprises de « Mon point de départ » + menu Profil =====
  console.log('Reprise des gênes déclarées, entrée dans le menu');
  const d = await page(b, { state: { anamnese: { at: new Date().toISOString(), consent: true, zones: ['lombaires', 'nuque', 'epaule'] } }, url: '#/profile', tier: 'premium' });
  ok(/Mon programme sur mesure/.test(await txt(d.p)) && /10 questions/.test(await txt(d.p)), 'tuile dans le menu Profil');
  await d.p.evaluate(() => { location.hash = '#/monprogramme'; }); await d.p.waitForTimeout(800);
  await tap(d.p, '[data-a="pq-start"]');
  for (const [k, v] of [['pick', 'fat'], ['pick', 'none'], ['text'], ['pick', 'beginner'], ['multi', ['salle_basique']], ['pick', '3'], ['pick', '3'], ['pick', '45']]) { if (k === 'pick') await pick(d.p, v); else if (k === 'multi') await multi(d.p, v); else await tap(d.p, '[data-f="pq-text"] button'); }
  const checked = await d.p.$$eval('input[name="v"]:checked', e => e.map(x => x.value));
  ok(checked.sort().join() === 'bas_du_dos,epaule', 'gênes préremplies depuis l\'état de santé (nuque ignorée)');
  ok(d.errs.length === 0, 'aucune erreur JavaScript');
  await d.ctx.close();

  // ===== 4. Instantané pour le coach : gênes seulement avec consentement =====
  console.log('Instantané pour le coach');
  const e = await page(b, { state: { programme: { v: 1, at: new Date().toISOString(), answers: { goal: 'fat', zones: ['genou'] }, prefs: { pompes: 'love' } } }, url: '#/home' });
  const snap = await e.p.evaluate(async () => (await import('./js/sync.js')).snapshot().data.programme);
  ok(snap.answers.goal === 'fat' && snap.answers.zones === undefined && snap.prefs.pompes === 'love', 'sans consentement : les gênes ne partent pas');
  await e.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cxs.v1')); s.anamnese = { at: new Date().toISOString(), consent: true, zones: [] }; localStorage.setItem('cxs.v1', JSON.stringify(s)); });
  await e.p.reload({ waitUntil: 'load' }); await e.p.waitForTimeout(1000);
  const snap2 = await e.p.evaluate(async () => (await import('./js/sync.js')).snapshot().data.programme);
  ok(snap2.answers.zones?.[0] === 'genou', 'avec consentement : les gênes partent');
  await e.ctx.close();

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
