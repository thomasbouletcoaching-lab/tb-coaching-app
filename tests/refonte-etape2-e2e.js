// Test de bout en bout de la refonte coach, étape 2 : réseau privé (absence, annonces, sondages, défis), mot du coach, tout valider, frise des phases, éditeur (A/B, supersets, phases), code coach, étiquettes.
// Ancien en-tête : (bilan, anamnèse, régularité, défi 30 jours, comparateur, rapport, témoignage, candidature,
// onglet Suivi et alertes de décrochage côté coach). iPhone 390×844 tactile, Supabase simulé, données fictives uniquement.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/adherence-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const T = iso(new Date());
const ago = (n) => iso(new Date(Date.now() - n * 864e5));

const START = ago(20);
const S1 = (kg, reps) => ({ kg, reps, done: true, type: 'N' });
const workouts = [
  { id: 101, title: 'Séance A', start: ago(7) + 'T17:00:00.000Z', end: ago(7) + 'T18:00:00.000Z', volume: 1600, programId: 'tb-rep3', exercises: [{ name: 'Squat barre', orig: 'Squat barre', scheme: '3x8-10', sets: [S1(100, 8), S1(100, 7)] }] },
  { id: 102, title: 'Séance A', start: ago(1) + 'T17:00:00.000Z', end: ago(1) + 'T18:00:00.000Z', volume: 1620, programId: 'tb-rep3', exercises: [{ name: 'Squat barre', orig: 'Squat barre', scheme: '3x8-10', sets: [S1(102.5, 8), S1(100, 8)] }] },
];
const STATE = {
  profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'comeback', goal: 'fat', weight: 86, sex: 'm', age: 38, height: 178, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'all', sessionMin: 60 },
  trialStart: START, synced: false, plan: { programId: 'tb-rep3', startedAt: START, week: 3, idx: 1, cycle: 1 },
  workouts, daily: {}, food: {}, lifts: {}, measures: [], checkins: [],
  coachPublic: { absence: { on: true, from: ago(1), to: iso(new Date(Date.now() + 4 * 864e5)), msg: 'Vacances en famille' }, annonces: { items: [{ id: 1, d: ago(0), title: 'Nouveau créneau', txt: 'Cours collectif samedi 10 h', pin: true }] }, sondages: { items: [{ id: 'p1', d: ago(0), q: 'Prochain live ?', opts: ['Nutrition', 'Sommeil'] }] }, defis: { items: [{ id: 'd1', title: 'Défi séances', metric: 'seances', from: ago(10), to: iso(new Date(Date.now() + 10 * 864e5)) }] } },
  coachSettings: { feedback: { txt: 'Bravo pour ta semaine, on garde le cap !', d: ago(0) }, bilan: { on: true, dow: (new Date().getDay() + 6) % 7, every: 1, from: ago(14), digest: true, questions: ['Comment va ton genou ?'] }, deadlines: [{ id: 1, title: 'Compétition régionale', d: iso(new Date(Date.now() + 12 * 864e5)), type: 'compet', visible: true }, { id: 2, title: 'Note privée', d: iso(new Date(Date.now() + 5 * 864e5)), type: 'rdv', visible: false }] },
};

const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;

async function page(b, { url, state, key = 'cxs.v1', sb = SB_NONE }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
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
// Aucun élément ne doit dépasser la largeur de l'écran (rendu mobile)
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));



const SB_MEMBER = `
window.__votes = {}; window.__parts = [];
const ME = 'me-0001';
function q(table, rpc, args) {
  const st = { f: {}, up: null, del: false };
  const res = () => {
    if (rpc === 'cxs_poll_results') return { data: Object.entries(window.__votes).map(([k, v]) => ({ choice: v, n: 1 })), error: null };
    if (rpc === 'cxs_invite_claim') return { data: args.p_code === 'TB-ABCDE' ? { name: 'Karim', tier: 'suivi', program: true } : null, error: null };
    if (table === 'cxs_poll_votes') { if (st.up) { window.__votes[st.up.poll_id] = st.up.choice; return { data: null, error: null }; } return { data: Object.entries(window.__votes).map(([k, v]) => ({ poll_id: k, choice: v })), error: null }; }
    if (table === 'cxs_defi_parts') { if (st.up) { window.__parts = window.__parts.filter(x => x.user_id !== ME).concat([{ user_id: ME, alias: st.up.alias, value: st.up.value }]); return { data: null, error: null }; } if (st.del) { window.__parts = window.__parts.filter(x => x.user_id !== ME); return { data: null, error: null }; } return { data: [{ user_id: 'x', alias: 'Paul', value: 1 }, ...window.__parts].sort((a, b) => b.value - a.value), error: null }; }
    if (table === 'cxs_coach_settings' || table === 'cxs_coach_public') return { data: null, error: { message: 'hors ligne' } };
    return { data: null, error: null };
  };
  const b = new Proxy(function () {}, { get: (t, k) => {
    if (k === 'then') return (ok, ko) => Promise.resolve(res()).then(ok, ko);
    if (k === 'eq') return (c, v) => { st.f[c] = v; return b; };
    if (k === 'upsert') return (row) => { st.up = row; return b; };
    if (k === 'delete') return () => { st.del = true; return b; };
    return () => b; }, apply: () => b });
  return b;
}
const session = { access_token: 't', user: { id: ME, email: 'karim@exemple.fr' } };
export function createClient() { return { auth: { getSession: async () => ({ data: { session } }), getUser: async () => ({ data: { user: session.user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: (t) => q(t), rpc: (n, a) => q(null, n, a), channel: () => q(), removeChannel() {}, storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }), upload: async () => ({ error: null }) }) } }; }`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  let t;
  console.log('Membre');
  const { p, errs } = await page(b, { url: '#/home', state: STATE, sb: SB_MEMBER });
  t = await txt(p);
  ok(/Le mot de Thomas/.test(t) && /Bravo pour ta semaine/.test(t), 'accueil : mot du coach');
  await p.click('[data-a="fb-hide"]'); await p.waitForTimeout(400);
  ok(!/Bravo pour ta semaine/.test(await txt(p)), 'accueil : mot du coach masqué une fois lu');
  await go(p, 'coach'); await p.waitForTimeout(800); t = await txt(p);
  ok(/Thomas est absent jusqu'au/.test(t) && /Vacances en famille/.test(t), 'coaching : bandeau d\'absence');
  ok(/Nouveau créneau/.test(t) && /Épinglé/.test(t), 'coaching : annonce épinglée');
  ok(/Prochain live/.test(t), 'coaching : sondage');
  await p.click('[data-a="poll-vote"][data-v="1"]'); await p.waitForTimeout(700); t = await txt(p);
  ok(/Sommeil ✓/.test(t) && /100 %/.test(t), 'sondage : vote et résultats');
  ok(/Défi séances/.test(t) && /Paul/.test(t), 'défi : classement visible');
  await p.click('[data-a="defi-join"]'); await p.waitForTimeout(700); t = await txt(p);
  ok(/Karim \(toi\)/.test(t) && /2 séances/.test(t), 'défi : rejoint avec son score calculé (2 séances)');
  ok(/J'ai un code de Thomas/.test(t), 'coaching : entrée « code coach »');
  await p.click('[data-a="code-coach"]'); await p.fill('form[data-f="code-coach"] input[name="code"]', 'tb-abcde'); await p.click('form[data-f="code-coach"] .btn-red'); await p.waitForTimeout(700);
  ok(/préparé ton espace/.test(await txt(p, 'body')), 'code coach : espace rattaché');
  ok((await overflow(p)).length === 0, 'membre : rien ne dépasse');
  ok(errs.length === 0, 'membre : aucune erreur JavaScript' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''));
  await shot(p, 'etape2-membre');

  // ---------- Éditeur, frise, tout valider ----------
  console.log('Éditeur et séance');
  const ROW = (n) => [n, 'P', '', null, null, { sets: [{ t: 'N', lo: 8, hi: 10, rpe: 8 }, { t: 'N', lo: 8, hi: 10, rpe: 8 }, { t: 'N', lo: 8, hi: 10, rpe: 8 }], rest: 120 }];
  const PH = { id: 'my-ph', custom: true, name: 'Cycle phases', lvl: 'Perso', weeks: 6, phases: ['Accumulation', 'Accumulation', 'Intensification', 'Intensification', 'Réalisation', 'Deload'], days: [true, false, true, false, false, false, false], s: [['Séance A', 'Lundi', [ROW('Squat barre'), ROW('Développé couché')]], ['Séance B', 'Mercredi', [ROW('Soulevé de terre')]]] };
  const ED = { id: 'my-ed', custom: true, name: 'À éditer', lvl: 'Perso', weeks: 4, deload: { every: 4 }, days: [true, false, true, false, false, false, false], s: [['Séance A', 'Lundi', [ROW('Squat barre'), ROW('Développé couché'), ROW('Rowing barre')]]] };
  const ST2 = { ...STATE, coachSettings: null, coachPublic: null, customPrograms: [PH, ED], plan: { programId: 'my-ph', startedAt: START, week: 3, idx: 0, cycle: 1 } };
  const e = await page(b, { url: '#/train/programmes', state: ST2 });
  await go(e.p, 'train/muscu'); await e.p.waitForTimeout(500); t = await txt(e.p);
  ok(/Les phases de ton cycle/.test(t) && /Intensification/.test(t) && /S3–4/.test(t), 'frise des phases sur le programme');
  await shot(e.p, 'etape2-frise');
  await go(e.p, 'builder/my-ed'); await e.p.waitForTimeout(600);
  await e.p.click('[data-a="bd-link"][data-r="0"]'); await e.p.waitForTimeout(300);
  t = await txt(e.p);
  ok((t.match(/Superset A/g) || []).length === 2 && await e.p.$$eval('.bd-ex.ss', l => l.length) === 2, 'éditeur : superset visuel entre 2 exercices');
  await e.p.click('[data-a="bd-ab"][data-r="2"]'); await e.p.waitForTimeout(300);
  ok(/Semaines A \(impaires\)/.test(await txt(e.p)), 'éditeur : exercice en semaines A');
  await e.p.selectOption('select[data-c="bd-deload"]', 'phases'); await e.p.waitForTimeout(400);
  ok(await e.p.$$eval('.phases-row .ph', l => l.length) === 4, 'éditeur : phases nommées par semaine');
  await e.p.click('[data-a="bd-ph"][data-v="1"]'); await e.p.waitForTimeout(300);
  await e.p.fill('form[data-f="bd-ph"] input[name="nm"]', 'Prépa compét'); await e.p.click('form[data-f="bd-ph"] .btn-red'); await e.p.waitForTimeout(300);
  ok(/Prépa compét/.test(await txt(e.p)), 'éditeur : phase renommée');
  ok((await overflow(e.p)).length === 0, 'éditeur : rien ne dépasse');
  await shot(e.p, 'etape2-editeur');
  await e.p.click('[data-a="bd-save"]'); await e.p.waitForTimeout(600);
  const sv = (await S(e.p)).customPrograms.find(x => x.id === 'my-ed');
  ok(sv && sv.s[0][2][0][3] === 'A' && sv.s[0][2][1][3] === 'A' && sv.s[0][2][2][5].ab === 'A' && Array.isArray(sv.s[0][2][2][5].weeks[2]) && !sv.s[0][2][2][5].weeks[2].length && sv.phases[1] === 'Prépa compét', 'éditeur : superset, A/B et phases enregistrés');
  // séance en cours : tout valider
  await e.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cxs.v1')); s.plan = { programId: 'my-ph', startedAt: s.plan.startedAt, week: 3, idx: 0, cycle: 1 }; localStorage.setItem('cxs.v1', JSON.stringify(s)); });
  await e.p.reload(); await e.p.waitForTimeout(1200);
  await e.p.evaluate(async () => { const E = await import('./js/engine.js'); const st = await import('./js/store.js'); const s0 = E.buildSession(0); s0.start = new Date().toISOString(); st.update(x => { x.current = s0; }); });
  await go(e.p, 'workout'); await e.p.waitForTimeout(600);
  const before = await e.p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')).current.exercises[0].sets.filter(s => s.done).length);
  await e.p.click('[data-a="ex-all"][data-x="0"]'); await e.p.waitForTimeout(500);
  const cur = (await S(e.p)).current.exercises[0];
  ok(before === 0 && cur.sets.every(s => s.done && s.reps != null), 'séance : « Tout valider » valide toutes les séries');
  await e.p.click('[data-a="rest-skip"]').catch(() => {});
  await e.p.click('[data-a="ex-rest"][data-x="1"]'); await e.p.waitForTimeout(300);
  await e.p.check('#rest-keep'); await e.p.click('[data-a="ex-rest-set"][data-v="150"]'); await e.p.waitForTimeout(300);
  ok((await S(e.p)).restFor?.['Développé couché'] === 150, 'repos retenu pour l\'exercice');
  ok(e.errs.length === 0, 'éditeur et séance : aucune erreur JavaScript' + (e.errs.length ? ' (' + e.errs.slice(0, 3).join(' | ') + ')' : ''));
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
