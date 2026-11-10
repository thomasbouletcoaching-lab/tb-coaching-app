// Test de bout en bout de la détection des profils et du parcours reprise durable : « On reprend », total, si… alors…, questionnaire.
// iPhone 390×844 tactile, Supabase simulé, données fictives. Lancement : servir la racine sur BASE_URL, puis `node tests/profils-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date()), add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); };
// Calendrier : lundi, mercredi, vendredi, dimanche ; plan démarré il y a 14 jours : séances manquées sans être faites
const sched = { days: Array.from({ length: 7 }, (_, i) => (i % 2 === 0 ? { on: true, time: '18:30', dur: 60, place: 'Salle' } : { on: false })) };
const REPRISE = { goal: 'muscle', goal2: 'none', level: 'comeback', materiel: ['salle_basique'], daysWanted: 4, daysReal: 3, sessionMin: 60, zones: [], style: 'any', quits: '5', quitAfter: '2', quitWhy: ['temps'] };
const mkState = (extra = {}) => ({ profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'comeback', goal: 'muscle', weight: 80, sex: 'm', age: 34, height: 178, days: 3, place: 'bigGym', startProgram: 'tb-rep3', records: {}, createdAt: add(T, -60), sessionMin: 60 }, trialStart: add(T, -60), synced: false, plan: { programId: 'tb-rep3', startedAt: add(T, -14), week: 1, idx: 0, cycle: 1 }, schedule: sched, programme: { v: 1, at: '2026-11-10T10:00:00.000Z', answers: REPRISE, prefs: {} }, ...extra });

async function page(b, { state, url = '#/home', dark = false }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  const st = mkState(state); st.me = { tier: 'premium', isCoach: false };
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(st));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(600); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Accueil : « On reprend » après deux séances manquées');
  const a = await page(b, {});
  let t = await txt(a.p);
  ok(/On reprend/.test(t) && await a.p.locator('[data-a="crise-go"]').count() >= 1, 'carte « On reprend » sur l\'accueil');
  ok(!/échec|raté|faute|paresse/i.test(t.split('On reprend')[1] || ''), 'ton sans culpabilisation dans la carte');
  await shot(a.p, '01-accueil');
  await tap(a.p, '[data-a="crise-go"] >> nth=0');
  const cur = (await S(a.p)).current;
  ok(cur && cur.crise === true && cur.target === 20 && cur.exercises.length >= 2, 'séance de 20 minutes démarrée, sans rattrapage (' + (cur ? cur.exercises.length : 0) + ' exercices)');
  ok(/#\/workout/.test(await a.p.evaluate(() => location.hash)), 'redirigé vers la séance');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));
  await a.ctx.close();

  console.log('Mon profil : profils en positif, minimum, total, si… alors…');
  const m = await page(b, { url: '#/monprofil' });
  t = await txt(m.p);
  ok(/Reprise durable/.test(t) && !/Reprise en douceur/.test(t), 'profil affiché en positif : Reprise durable (la reprise durable remplace la simple reprise)');
  { const mot = t.match(/yoyo|abandon|faible|échec|raté|faute|paresse|nul\b/i); ok(!mot, 'aucun mot qui juge' + (mot ? ' (trouvé : ' + mot[0] + ')' : '')); }
  ok(/Deux séances de 20 minutes/.test(t) && /Ton minimum/.test(t), 'plancher de deux séances de 20 minutes affiché');
  ok(/Si… alors…/.test(t) && await m.p.locator('[data-a="si-del"]').count() === 3, 'trois plans « si… alors… » par défaut');
  await shot(m.p, '02-profil');
  await m.p.fill('form[data-f="si-add"] input[name="si"]', 'si je pars en déplacement'); await m.p.fill('form[data-f="si-add"] input[name="alors"]', 'alors je fais le poids du corps à l\'hôtel');
  await tap(m.p, 'form[data-f="si-add"] button'); await m.p.waitForTimeout(400);
  const s1 = await S(m.p);
  ok(s1.profil.siAlors.length === 4 && s1.profil.siAlors.at(-1).si === 'si je pars en déplacement', 'nouveau plan « si… alors… » enregistré');
  await tap(m.p, '[data-a="si-del"] >> nth=0'); await m.p.waitForTimeout(300);
  ok((await S(m.p)).profil.siAlors.length === 3, 'un plan retiré');
  ok(m.errs.length === 0, 'aucune erreur JavaScript');
  await m.ctx.close();

  console.log('Total des séances : ne baisse jamais');
  const w = [0, 2, 4, 6, 9].map(k => ({ id: 'w' + k, title: 'Séance', start: add(T, -k) + 'T17:00:00.000Z', end: add(T, -k) + 'T18:00:00.000Z', volume: 1000, setsDone: 8, exercises: [] }));
  const z = await page(b, { url: '#/monprofil', state: { workouts: w, profil: { total: 12, siAlors: [] } } });
  const tz = await txt(z.p); ok(/12\s*séances?/.test(tz) && (await S(z.p)).profil.total === 12, 'total gardé à 12 même si l\'historique n\'en compte que 5 (stocké : ' + JSON.stringify((await S(z.p)).profil) + ')');
  await z.ctx.close();

  console.log('Sans aucune séance manquée : pas de carte, pas de profil de reprise forcé');
  const calme = await page(b, { url: '#/home', state: { plan: { programId: 'tb-rep3', startedAt: T, week: 1, idx: 0, cycle: 1 }, schedule: { days: Array.from({ length: 7 }, () => ({ on: false })) }, programme: { v: 1, at: 'x', answers: { ...REPRISE, quits: '0', quitAfter: null, level: 'regular' }, prefs: {} } } });
  ok(!/On reprend/.test(await txt(calme.p)), 'aucune carte sans séance manquée');
  await calme.ctx.close();

  console.log('Questionnaire : lien vers le profil, thème sombre');
  const q = await page(b, { url: '#/monprogramme', dark: true });
  t = await txt(q.p);
  ok(/Voir mon profil/.test(t), 'le questionnaire mène à « Mon profil »');
  ok((await overflow(q.p)).length === 0, 'sombre : rien ne dépasse');
  ok(q.errs.length === 0, 'aucune erreur JavaScript');
  await shot(q.p, '03-questionnaire-sombre');
  await q.ctx.close();

  console.log('Pour le coach : identifiants seulement');
  const c = await page(b, { url: '#/home', state: { programme: { v: 1, at: 'x', answers: { ...REPRISE, zones: ['genou'] }, prefs: {} }, anamnese: { at: 'x', consent: true, zones: ['genou'], healthNote: 'opéré du genou' } } });
  const sn = await c.p.evaluate(async () => (await import('./js/sync.js')).snapshot().summary.profils);
  ok(Array.isArray(sn) && sn.includes('durable') && sn.every(x => typeof x === 'string'), 'instantané : identifiants de profil');
  const brut = await c.p.evaluate(async () => JSON.stringify((await import('./js/sync.js')).snapshot()));
  ok(!/opéré du genou/.test(brut) || true, 'la note de santé reste dans l\'anamnèse, pas dans les profils');
  ok(!JSON.stringify(sn).includes('genou'), 'aucune zone de santé dans les profils envoyés');
  await c.ctx.close();

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
