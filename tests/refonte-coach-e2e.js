// Test de bout en bout de la refonte coach (accueil, athlètes, programmes, profil, fiche en cartes, bilans réglés, échéances, récap de séance).
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
  coachSettings: { bilan: { on: true, dow: (new Date().getDay() + 6) % 7, every: 1, from: ago(14), digest: true, questions: ['Comment va ton genou ?'] }, deadlines: [{ id: 1, title: 'Compétition régionale', d: iso(new Date(Date.now() + 12 * 864e5)), type: 'compet', visible: true }, { id: 2, title: 'Note privée', d: iso(new Date(Date.now() + 5 * 864e5)), type: 'rdv', visible: false }] },
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


(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  let t;
  // ===================== MEMBRE =====================
  console.log('Membre');
  const { p, errs } = await page(b, { url: '#/home', state: STATE });
  t = await txt(p);
  ok(/Compétition régionale/.test(t) && /J-12/.test(t), 'accueil : échéance visible avec compte à rebours');
  ok(!/Note privée/.test(t), 'accueil : échéance privée masquée');
  ok(/[Bb]ilan/.test(t), 'accueil : rappel de bilan le jour réglé par le coach');
  await go(p, 'bilan'); t = await txt(p);
  ok(/Comment va ton genou/.test(t), 'bilan : question du coach');
  ok(/Transit/.test(t) && /Digestion/.test(t), 'bilan : transit et digestion');
  await p.fill('textarea[name="q_0"]', 'Mieux, plus de douleur');
  await p.click('#bilan-form .btn-red'); await p.waitForTimeout(800);
  const st = await S(p); const ci = st.checkins.at(-1);
  ok(ci && ci.answers && ci.answers['Comment va ton genou ?'] === 'Mieux, plus de douleur', 'bilan : réponse à la question enregistrée');
  await go(p, 'carnet'); await p.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'w-detail'; b.dataset.id = '102'; document.body.appendChild(b); b.click(); }); await p.waitForTimeout(600);
  t = await txt(p, 'body');
  ok(/Prévu : 3×8-10/.test(t), 'détail de séance : schéma prévu');
  ok(/Dernière fois : 100 × 8 · 100 × 7/.test(t), 'détail de séance : séries de la dernière fois');
  ok(/Série 1 \+2,5 kg/.test(t) && /Série 2 \+1 rep/.test(t), 'détail de séance : écarts série par série');
  ok((await overflow(p)).length === 0, 'membre : rien ne dépasse de l\'écran');
  ok(errs.length === 0, 'membre : aucune erreur JavaScript' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''));
  await shot(p, 'refonte-membre');

  // ===================== COACH =====================
  console.log('Coach');
  const COACH = '00000000-0000-0000-0000-00000000c0ac', U1 = '00000000-0000-0000-0000-0000000000a1';
  const members = [{ id: U1, email: 'karim@exemple.fr', name: 'Karim Exemple', tier: 'surmesure', onboarding: { name: 'Karim' }, stats: {}, created_at: START + 'T10:00:00Z', last_seen: ago(1) + 'T10:00:00Z', is_coach: false }];
  const sums = [{ user_id: U1, summary: { today: ago(1), lastActive: ago(1), adh: { score: 80, status: 'ok', trend: 2, week: 80, prev: 78, age: 20 }, agenda: [] }, updated_at: new Date().toISOString(), data: { ...STATE, coachSettings: undefined } }];
  const SB_COACH = `
const DB = ${JSON.stringify({ members, sums, COACH })};
window.__settings = {};
function q(table, rpc) {
  const st = { table, rpc, f: {}, one: false, up: null };
  const res = () => {
    let d = null;
    if (rpc === 'cxs_inbox') d = [];
    else if (rpc) d = null;
    else if (table === 'cxs_profiles') d = st.f.id === DB.COACH ? { id: DB.COACH, email: 'coach@exemple.fr', name: 'Thomas', tier: 'surmesure', is_coach: true } : DB.members;
    else if (table === 'cxs_member_data') d = st.f.user_id ? (DB.sums.find(s => s.user_id === st.f.user_id) || null) : DB.sums.map(s => ({ user_id: s.user_id, summary: s.summary, updated_at: s.updated_at }));
    else if (table === 'cxs_coach_settings') { if (st.up) { window.__settings[st.up.user_id] = st.up.data; d = null; } else d = window.__settings[st.f.user_id] ? { data: window.__settings[st.f.user_id] } : null; }
    else d = st.one ? null : [];
    return { data: d, error: null, count: 0 };
  };
  const b = new Proxy(function () {}, { get: (t, k) => {
    if (k === 'then') return (ok, ko) => Promise.resolve(res()).then(ok, ko);
    if (k === 'eq') return (c, v) => { st.f[c] = v; return b; };
    if (k === 'upsert') return (row) => { st.up = row; return b; };
    if (k === 'maybeSingle' || k === 'single') return () => { st.one = true; return b; };
    return () => b; }, apply: () => b });
  return b;
}
const session = { access_token: 't', user: { id: DB.COACH, email: 'coach@exemple.fr' } };
export function createClient() { return { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: (t) => q(t), rpc: (n) => q(null, n), channel: () => q(), removeChannel() {}, storage: { from: () => ({ createSignedUrls: async (paths) => ({ data: [], error: null }), upload: async () => ({ error: null }) }) } }; }`;
  const COACH_STATE = { profile: { name: 'Thomas', email: 'coach@exemple.fr', createdAt: ago(60) }, synced: true, me: { id: COACH, tier: 'surmesure', isCoach: true } };
  const c = await page(b, { url: 'coach.html#/admin-today', state: COACH_STATE, key: 'cxs.coach.v1', sb: SB_COACH });
  await c.p.waitForTimeout(800); t = await txt(c.p, 'body');
  for (const l of ['Accueil', 'Athlètes', 'Messages', 'Programmes', 'Profil']) ok(t.includes(l), 'barre coach : ' + l);
  ok(await c.p.$('.fab') !== null, 'accueil coach : bouton +');
  ok(await c.p.$('.wk7') !== null, 'accueil coach : semaine en bandeau');
  ok((await overflow(c.p)).length === 0, 'accueil coach : rien ne dépasse');
  await shot(c.p, 'refonte-coach-accueil');
  await go(c.p, 'admin'); t = await txt(c.p);
  ok(/Karim Exemple/.test(t) && /Tous/.test(t) && /Actifs/.test(t) && /En attente/.test(t), 'athlètes : liste et filtres');
  await go(c.p, 'admin-prog'); t = await txt(c.p);
  ok(/Nouveau programme/.test(t) && /Assigner/.test(t), 'programmes : créer et assigner');
  await go(c.p, 'admin-profile'); t = await txt(c.p);
  ok(/Business/.test(t) && /Abonnés/.test(t) && /Base de données/.test(t), 'profil coach : Business, Abonnés, Base de données');
  await go(c.p, 'member/' + U1); await c.p.waitForTimeout(800); t = await txt(c.p);
  ok(/Programme sport/.test(t) && /Plan diète/.test(t) && /Bilans/.test(t) && /Échéances/.test(t), 'fiche athlète : cartes programme, diète, bilans, échéances');
  ok((await overflow(c.p)).length === 0, 'fiche athlète : rien ne dépasse');
  await shot(c.p, 'refonte-coach-fiche');
  await c.p.click('[data-a="mb-bilan"]'); await c.p.waitForTimeout(400);
  await c.p.selectOption('select[name="every"]', '2');
  await c.p.check('input[name="digest"]');
  await c.p.fill('textarea[name="questions"]', 'Comment va ton genou ?\nCombien de pas ?');
  await c.p.click('form[data-f="mb-bilan"] .btn-red'); await c.p.waitForTimeout(800);
  let saved = await c.p.evaluate((u) => window.__settings[u], U1);
  ok(saved?.bilan?.every === 2 && saved.bilan.digest && saved.bilan.questions.length === 2, 'bilans réglés et enregistrés');
  ok(/Toutes les 2 semaines/.test(await txt(c.p)), 'fiche athlète : rythme affiché');
  await c.p.click('[data-a="mb-dl-add"]'); await c.p.waitForTimeout(400);
  await c.p.fill('form[data-f="mb-dl"] input[name="title"]', 'Test de force');
  await c.p.fill('form[data-f="mb-dl"] input[name="d"]', iso(new Date(Date.now() + 20 * 864e5)));
  await c.p.click('form[data-f="mb-dl"] .btn-red'); await c.p.waitForTimeout(800);
  saved = await c.p.evaluate((u) => window.__settings[u], U1);
  ok(saved?.deadlines?.length === 1 && saved.bilan?.every === 2, 'échéance ajoutée sans perdre les bilans');
  ok(/Test de force/.test(await txt(c.p)), 'fiche athlète : échéance listée');
  await c.p.click('[data-a="mb-tab"][data-v="seances"]').catch(() => {}); await c.p.waitForTimeout(500);
  t = await txt(c.p);
  ok(/\+2,5 kg/.test(t) || /Dernière fois/.test(t), 'séances côté coach : écarts avec la dernière fois');
  ok(c.errs.length === 0, 'coach : aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
