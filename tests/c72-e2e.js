// Test de bout en bout de la décision C72 : accueil sans contradiction ni raccourcis, statistiques sur le réalisé,
// pause de séance, favoris rangés de A à Z, essai de 14 jours. iPhone 390×844, Supabase simulé, données fictives.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/c72-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const T = iso(new Date());
const ago = (n) => iso(new Date(Date.now() - n * 864e5));
const START = ago(3);
const set = (kg, reps, o = {}) => ({ type: 'N', kg, pkg: kg, reps, lo: 8, hi: 10, trpe: 8, rpe: 8, done: true, ...o });
// 6 semaines : squat qui progresse, développé qui stagne, peu de tirage, ischios en retard sur le prévu
const workouts = [];
for (let w = 6; w >= 0; w--) for (const dd of [3, 0]) { const d = ago(w * 7 + dd); if (d > T) continue;
  workouts.push({ id: 1000 + w * 10 + dd, title: 'Séance', start: d + 'T17:00:00.000Z', end: d + 'T18:00:00.000Z', volume: 3000, programId: 'tb-rep3', exercises: [
    { name: 'Squat barre', unit: 'reps', sets: [set(80 + (6 - w) * 2.5, 8), set(80 + (6 - w) * 2.5, 8), set(80 + (6 - w) * 2.5, 8), set(80 + (6 - w) * 2.5, 8)] },
    { name: 'Développé couché barre', unit: 'reps', sets: [set(70, 8), set(70, 8), set(70, 8), set(70, 8)] },
    { name: 'Rowing barre', unit: 'reps', sets: [set(60, 10), set(60, 10)] },
    { name: 'Leg curl assis', unit: 'reps', sets: [set(40, 12, { rpe: 6, trpe: 6 }), set(40, 12, { done: false, rpe: null }), set(40, 12, { done: false, rpe: null })] }] }); }
const lifts = { 'Squat barre': workouts.map(w => ({ d: w.end.slice(0, 10), e1rm: w.exercises[0].sets[0].kg * 1.33 })) };
const STATE = {
  profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'regular', goal: 'muscle', weight: 82, sex: 'm', age: 34, height: 178, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'omni' },
  trialStart: START, synced: false, plan: { programId: 'tb-rep3', startedAt: ago(42), week: 3, idx: 1, cycle: 1 },
  workouts, daily: {}, food: {}, lifts, measures: [], checkins: [],
  settings: { sabbat: { on: true, dow: new Date().getDay() } },
  favFoods: [{ n: 'Yaourt grec', kcal: 97 }, { n: 'avoine', kcal: 370 }, { n: 'Banane', kcal: 89 }, { n: 'Œufs', kcal: 143 }],
};
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;

async function page(b, { url, state, key = 'cxs.v1', sb = SB_NONE }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept(d.type() === 'prompt' ? d.defaultValue() : undefined));
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: sb, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript(([k, s]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, s); }, [key, JSON.stringify(state)]);
  await p.goto(BASE + url, { waitUntil: 'load' }); await p.waitForTimeout(1400);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };
const go = async (p, r) => { await p.evaluate((r) => { location.hash = '#/' + r; }, r); await p.waitForTimeout(900); };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Accueil');
  const h = await page(b, { url: '#/home', state: STATE });
  let t = await txt(h.p);
  const prevue = await h.p.evaluate(async () => { const E = await import('./js/engine.js'); const d = new Date(); const k = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); const a = E.agenda(k, k)[k]; return !!a && !['rest', 'away'].includes(a.st); });
  ok(prevue ? !/Jour de repos/.test(t) : /Jour de repos/.test(t), `jour de repos choisi : ${prevue ? 'masqué car une séance est prévue' : 'affiché car aucune séance n\'est prévue'}`);
  ok(!/Ajouter un repas/.test(t) && !/Je craque/.test(t) && !/Partager ma séance en direct/.test(t) && !/Athlète hybride/.test(t), 'accueil : raccourcis, carte hybride et direct retirés');
  const fav = (await S(h.p)).favFoods.map(f => f.n);
  ok(JSON.stringify(fav) === JSON.stringify(['avoine', 'Banane', 'Œufs', 'Yaourt grec']), 'favoris rangés de A à Z (accents et majuscules ignorés) : ' + fav.join(', '));
  ok(h.errs.length === 0, 'accueil : aucune erreur JavaScript ' + h.errs.join(' | '));
  await h.ctx.close();

  console.log('Statistiques sur le réalisé');
  const s = await page(b, { url: '#/train/stats', state: STATE });
  await s.p.waitForTimeout(800); t = await txt(s.p);
  ok(/Volume par muscle|Par muscle/.test(t) && /MEV/.test(t) && /MRV/.test(t) && await s.p.locator('.jbar .jmk').count() >= 4, 'jauges MV / MEV / MAV / MRV avec le repère des séries réelles');
  ok(/Équilibre/.test(t) && await s.p.locator('svg.radar').count() === 1 && /Tirage \/ poussée/.test(t) && /Plus de tirage/.test(t), 'équilibre : radar des patterns et ratio tirage / poussée à rééquilibrer');
  if (process.env.DUMP) console.log(t.slice(t.indexOf('Prévu et fait'), t.indexOf('Prévu et fait') + 700));
  ok(/Prévu et fait/.test(t) && /Ischio-jambiers/.test(t) && /séries faites sur/.test(t), 'prévu et fait : les ischios en retard sont signalés');
  ok(/Surcharge progressive/.test(t) && /Squat barre · Progresse/.test(t) && /Développé couché barre · Stagne/.test(t), 'surcharge : le squat progresse, le développé stagne');
  ok(/Stimulus envoyé|Stimulus partiel|Pas assez de raisons de progresser/.test(t) && /RPE 7/.test(t), 'stimulus par muscle avec ce qui manque');
  ok(s.errs.length === 0, 'stats : aucune erreur JavaScript ' + s.errs.join(' | '));
  await s.ctx.close();

  console.log('Pause de séance');
  const cur = { id: 9001, title: 'Séance test', start: new Date(Date.now() - 40 * 60000).toISOString(), programId: 'tb-rep3', free: true, exercises: [{ name: 'Squat barre', orig: 'Squat barre', scheme: '3x8', unit: 'reps', rest: 90, sets: [set(80, 8, { done: false, rpe: null }), set(80, 8, { done: false, rpe: null })] }] };
  const w = await page(b, { url: '#/workout', state: { ...STATE, current: cur } });
  await w.p.click('[data-a="wk-pause"]'); await w.p.waitForTimeout(600);
  t = await txt(w.p);
  ok(/Séance en pause depuis/.test(t) && /Reprendre la séance/.test(t), 'pause : bandeau et bouton reprendre');
  await w.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cxs.v1')); s.current.pausedAt = new Date(Date.now() - 30 * 60000).toISOString(); localStorage.setItem('cxs.v1', JSON.stringify(s)); });
  await w.p.reload(); await w.p.waitForTimeout(1200);
  await w.p.click('[data-a="wk-pause"]'); await w.p.waitForTimeout(500);
  const st = await S(w.p);
  ok(!st.current.pausedAt && st.current.pauseMs >= 29 * 60000, 'reprise : 30 min de pause mises de côté');
  const act = await w.p.evaluate(async () => { const E = await import('./js/engine.js'); const s = JSON.parse(localStorage.getItem('cxs.v1')); return Math.round(E.actifMs(s.current) / 60000); });
  ok(act >= 9 && act <= 12, `durée active ≈ 10 min malgré 40 min d'horloge (${act} min)`);
  ok(w.errs.length === 0, 'pause : aucune erreur JavaScript ' + w.errs.join(' | '));
  await w.ctx.close();

  console.log('Essai de 14 jours');
  const o = await page(b, { url: '', state: {} });
  t = await txt(o.p, 'body');
  ok(/14 jours gratuits/.test(t) && !/30 jours/.test(t), 'accueil d\'inscription : 14 jours gratuits');
  await o.ctx.close();

  await b.close();
  console.log(`\n${passed} réussis, ${fails} échoués`);
  process.exit(fails ? 1 : 0);
})();
