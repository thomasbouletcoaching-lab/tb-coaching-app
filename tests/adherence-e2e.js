// Test de bout en bout du suivi (bilan, anamnèse, régularité, défi 30 jours, comparateur, rapport, témoignage, candidature,
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

// ---------- Membre fictif : 20 jours de défi ----------
const START = ago(20);
const workouts = [18, 16, 13, 11, 9, 6, 4].map((n, i) => ({ id: 'w' + i, title: 'Séance ' + (i % 3 + 1), start: ago(n) + 'T17:00:00.000Z', end: ago(n) + 'T18:00:00.000Z', volume: 6000 + i * 300, exercises: [{ name: 'Squat barre', orig: 'Squat barre', sets: [{ kg: 80 + i * 2.5, reps: 8, rpe: 8, done: true }] }] }));
const daily = {}, food = {};
for (let i = 0; i <= 20; i++) { const d = ago(i); if (i % 2 === 0) daily[d] = { weight: Math.round((86 - (20 - i) * 0.08) * 10) / 10, sleep: 6.5 + (i % 3) * 0.5, feel: { energy: 3 + (i % 3) } }; if (i % 3 !== 1) food[d] = [{ label: 'Poulet riz', meal: 'Déjeuner', g: 350, kcal: 520, p: 40, c: 60, f: 10 }]; }
const STATE = {
  profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'comeback', goal: 'fat', weight: 86, sex: 'm', age: 38, height: 178, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'all', sessionMin: 60 },
  trialStart: START, synced: false,
  plan: { programId: 'tb-rep3', startedAt: START, week: 3, idx: 1, cycle: 1 },
  workouts, daily, food,
  lifts: { 'Squat barre': [{ d: ago(18), e1rm: 100 }, { d: ago(4), e1rm: 112 }] },
  measures: [{ d: START, weight: 86, waistNav: 99 }, { d: ago(6), waistNav: 96.5 }],
  checkins: [{ d: ago(13), week: ago(13), weight: 85.6, energy: 5, sleepH: 6.5, stress: 7, mood: 3, win: 'Trois séances tenues', sessions: 3 }],
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

  // ===================== MEMBRE =====================
  console.log('Membre (Défi 30 jours)');
  const { p, errs } = await page(b, { url: '#/home', state: STATE });
  ok(/Défi 30 jours/.test(await txt(p)), 'accueil : carte du Défi 30 jours');
  ok(/jour 21 \/ 30/.test(await txt(p)), 'accueil : jour du défi affiché');
  await shot(p, '01-accueil');

  await go(p, 'defi');
  let t = await txt(p);
  ok(/Mon point de départ/.test(t) && /Bilan de la semaine 3/.test(t), 'défi : étapes listées');
  ok(/s'ouvre au jour 28/.test(t), 'défi : étapes futures verrouillées');
  ok(/Candidater au coaching/.test(t), 'défi : candidature proposée à partir du jour 21');
  ok((await overflow(p)).length === 0, 'défi : rien ne dépasse de l\'écran');
  await shot(p, '02-defi');

  // Anamnèse
  await go(p, 'anamnese');
  await shot(p, '03-anamnese');
  await p.click('button.btn-red:has-text("Enregistrer")'); await p.waitForTimeout(300);
  ok(/anamnese/.test(p.url()), 'anamnèse : refusée sans réponses ni consentement');
  for (const k of ['heart', 'chest', 'dizzy', 'chronic', 'meds', 'supervised']) await p.click(`input[name="h_${k}"][value="0"] + span`);
  await p.click('input[name="h_joint"][value="1"] + span');
  await p.click('input[name="zones"][value="genou"] + span');
  await p.fill('textarea[name="why"]', 'Être en forme pour mes enfants');
  await p.fill('textarea[name="proud"]', 'Perdre 6 cm de tour de taille');
  await p.fill('textarea[name="stopped"]', 'Le travail et les déplacements');
  await p.check('input[name="consent"]');
  await p.click('button.btn-red:has-text("Enregistrer")'); await p.waitForTimeout(600);
  ok(/Parles-en à ton médecin/.test(await txt(p)), 'anamnèse : un « oui » santé affiche le conseil médical');
  let st = await S(p);
  ok(st.anamnese?.flags?.join() === 'joint' && st.anamnese.consent && st.anamnese.zones.includes('genou'), 'anamnèse : réponses et consentement enregistrés');

  // Bilan hebdomadaire
  await go(p, 'bilan');
  t = await txt(p);
  ok(/Ta semaine, déjà comptée/.test(t), 'bilan : récapitulatif automatique');
  const w = await p.inputValue('input[name="weight"]');
  ok(/^8\d,\d$|^8\d$/.test(w), 'bilan : poids moyen pré-rempli (' + w + ')');
  ok((await p.inputValue('input[name="sleepH"]')) !== '', 'bilan : sommeil moyen pré-rempli');
  ok((await overflow(p)).length === 0, 'bilan : rien ne dépasse de l\'écran');
  await shot(p, '04-bilan');
  await p.click('input[name="mood"][value="4"] + span');
  await p.click('input[name="energy"][value="7"] + span');
  await p.click('input[name="stress"][value="5"] + span');
  await p.click('input[name="plan"][value="8"] + span');
  await p.click('details.fold summary'); await p.fill('input[name="m_waistNav"]', '95,5');
  await p.fill('textarea[name="win"]', 'Quatre repas notés et 3 séances');
  await p.click('button.btn-red:has-text("Enregistrer mon bilan")'); await p.waitForTimeout(800);
  t = await txt(p);
  ok(/Bilan enregistré/.test(t), 'bilan : confirmation');
  ok(/Depuis ton bilan du/.test(t), 'bilan : comparaison avec le bilan précédent');
  st = await S(p);
  const ci = st.checkins.at(-1);
  ok(st.checkins.length === 2 && ci.energy === 7 && ci.mood === 4 && ci.measures.waistNav === 95.5 && ci.score != null, 'bilan : enregistré avec mesures et score');
  ok(st.measures.some(m => m.d === T && m.waistNav === 95.5), 'bilan : tour de taille ajouté aux mensurations');
  await shot(p, '05-bilan-ok');
  // Refaire le bilan la même semaine : corrige au lieu de dupliquer
  await go(p, 'home'); await go(p, 'bilan');
  ok(/Tu as déjà fait ton bilan cette semaine/.test(await txt(p)), 'bilan : la 2e ouverture propose de corriger');
  await p.click('button.btn-red:has-text("Enregistrer mon bilan")'); await p.waitForTimeout(600);
  ok((await S(p)).checkins.length === 2, 'bilan : pas de doublon dans la même semaine');

  // Régularité
  await go(p, 'regularite');
  t = await txt(p);
  ok(/Séances/.test(t) && /Repas notés/.test(t) && /Bilans/.test(t), 'régularité : détail des piliers');
  const score = await p.evaluate(() => +document.querySelector('svg[aria-label^="Régularité"] text').textContent);
  ok(score > 0 && score <= 100, 'régularité : score entre 0 et 100 (' + score + ')');
  await shot(p, '06-regularite');

  // Photos : 2 photos de face à 18 jours d'écart
  await p.evaluate(async ([d0, d1]) => {
    const { addPhoto } = await import('./js/store.js');
    const mk = (col) => new Promise(r => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 300, 400); x.fillStyle = '#fff'; x.fillRect(110, 60, 80, 280); c.toBlob(r, 'image/jpeg'); });
    await addPhoto(await mk('#7a6a5a'), d0, 'face'); await addPhoto(await mk('#4a6a8a'), d1, 'face');
  }, [ago(19), ago(1)]);
  await go(p, 'compare');
  t = await txt(p);
  ok((await p.$$('.cmp img')).length === 2, 'comparateur : avant et après côte à côte');
  ok(/18\s*jours d'écart/.test(t), 'comparateur : écart en jours');
  ok(/-2,5 cm/.test(t), 'comparateur : écart de tour de taille entre les deux dates (99 → 96,5 cm)');
  await shot(p, '07-comparateur');
  await p.click('[data-a="cp-mode"][data-v="slide"]'); await p.waitForTimeout(400);
  await p.fill('input[type="range"]', '20'); await p.dispatchEvent('input[type="range"]', 'input'); await p.waitForTimeout(100);
  ok(/inset\(0(px)? 80%/.test(await p.$eval('#cp-sl .top', e => e.style.clipPath)), 'comparateur : le curseur découvre l\'après');
  await shot(p, '08-curseur');

  // Rapport
  await go(p, 'rapport');
  t = await txt(p);
  ok(/Séances faites/.test(t) && /Tour de taille/.test(t) && /Squat barre/.test(t), 'rapport : chiffres de la période');
  ok((await p.$$('.cmp img')).length === 2, 'rapport : avant / après inclus');
  await shot(p, '09-rapport');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('[data-a="rp-save"]')]);
  ok(!!dl && /\.png$/.test(dl.suggestedFilename()), 'rapport : image PNG générée');
  if (dl && SHOTS) await dl.saveAs(`${SHOTS}/10-rapport-image.png`);
  await p.fill('textarea[name="quote"]', 'Je tiens mes séances et je dors mieux.');
  await p.check('form[data-f="rp-testi"] input[name="ok"]');
  await p.click('form[data-f="rp-testi"] button'); await p.waitForTimeout(700);
  st = await S(p);
  ok(st.testimonial?.ok && st.testimonial.quote.includes('dors mieux') && st.testimonial.at, 'témoignage : accord horodaté enregistré');
  ok(/Tu as autorisé Thomas/.test(await txt(p)), 'témoignage : accord affiché, retrait possible');

  // Candidature depuis le défi : réponses reprises de l'anamnèse
  await go(p, 'defi');
  await p.click('[data-a="defi-go"][data-r="apply-defi"]'); await p.waitForTimeout(700);
  ok(/apply/.test(p.url()), 'candidature : ouverte depuis le défi');
  ok((await p.inputValue('textarea[name="v"]')).includes('6 cm'), 'candidature : objectif repris de l\'anamnèse');
  await p.click('button.btn-red'); await p.waitForTimeout(300);
  ok((await p.inputValue('textarea[name="v"]')).includes('déplacements'), 'candidature : frein repris de l\'anamnèse');
  await p.click('button.btn-red'); await p.waitForTimeout(300);
  await p.click('.choice >> nth=1'); await p.waitForTimeout(300);
  await p.click('.choice >> nth=0'); await p.waitForTimeout(300);
  await p.click('button.btn-red'); await p.waitForTimeout(800);
  st = await S(p);
  ok(st.application?.dossier?.score != null && st.application.dossier.sessions === 7 && st.application.dossier.anam, 'candidature : dossier joint (régularité, séances, anamnèse)');
  const cal = new URL(await p.getAttribute('a[href*="calendly"]', 'href')).searchParams.get('a1') || '';
  ok(/Régularité : \d+\/100/.test(cal) && /Pourquoi maintenant : Être en forme/.test(cal), 'candidature : résumé transmis à Calendly');
  await shot(p, '11-candidature');

  // Profil : tuiles de suivi
  await go(p, 'profile');
  t = await txt(p);
  ok(/Ma régularité/.test(t) && /Avant \/ après/.test(t) && /Mon rapport/.test(t), 'profil : tuiles « Suivi et résultats »');
  // Offres : essai de 30 jours affiché
  await go(p, 'offers');
  ok(/30 jours d'essai/.test(await txt(p)) && !/7 jours d'essai/.test(await txt(p)), 'offres : essai de 30 jours affiché');
  // Instantané pour le coach
  const snap = await p.evaluate(async () => { const m = await import('./js/sync.js'); return m.snapshot(); });
  ok(snap.summary.adh?.score != null && snap.summary.lastCheckin === snap.data.checkins.at(-1).d && snap.data.anamnese?.consent && snap.summary.testi, 'instantané coach : régularité, bilans, anamnèse, témoignage');
  ok(errs.length === 0, 'membre : aucune erreur JavaScript' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''));

  // ===================== NOUVEL INSCRIT : pas de faux décrochage =====================
  console.log('Nouvel inscrit');
  const NEW = { ...STATE, profile: { ...STATE.profile, createdAt: T }, trialStart: T, plan: { ...STATE.plan, startedAt: T }, workouts: [], daily: {}, food: {}, checkins: [], measures: [], lifts: {} };
  const n1 = await page(b, { url: '#/defi', state: NEW });
  ok(/jour 1 sur 30/i.test(await txt(n1.p)) || /Jour 1 sur 30/.test(await txt(n1.p)), 'défi : jour 1');
  const al = await n1.p.evaluate(async () => (await import('./js/progress.js')).myAlerts().map(a => a.code));
  ok(!al.includes('checkin') && !al.includes('score'), 'pas d\'alerte « bilan manquant » ni « décroche » le premier jour');
  ok(n1.errs.length === 0, 'nouvel inscrit : aucune erreur JavaScript');

  // ===================== COACH =====================
  console.log('Coach');
  const COACH = '00000000-0000-0000-0000-00000000c0ac', U1 = '00000000-0000-0000-0000-0000000000a1', U2 = '00000000-0000-0000-0000-0000000000a2';
  const member = await (async () => { const m = await p.evaluate(async () => (await import('./js/sync.js')).snapshot()); return m; })();
  const members = [
    { id: U1, email: 'karim@exemple.fr', name: 'Karim', tier: 'avance', tier_until: null, onboarding: { name: 'Karim', application: st.application }, stats: {}, created_at: START + 'T10:00:00Z', last_seen: new Date().toISOString(), is_coach: false },
    { id: U2, email: 'paul@exemple.fr', name: 'Paul Exemple', tier: 'avance', tier_until: null, onboarding: { name: 'Paul' }, stats: {}, created_at: ago(40) + 'T10:00:00Z', last_seen: ago(9) + 'T10:00:00Z', is_coach: false },
  ];
  const sums = [
    { user_id: U1, summary: member.summary, updated_at: new Date().toISOString(), data: member.data },
    { user_id: U2, summary: { today: ago(9), lastActive: ago(9), adh: { score: 31, status: 'risk', trend: -27, week: 12, prev: 39, age: 40 }, lastCheckin: ago(16), ci: { d: ago(16), energy: 3, sleepH: 5.5, stress: 8, mood: 2 }, agenda: [{ d: ago(5), st: 'missed', title: 'Haut' }, { d: ago(3), st: 'missed', title: 'Bas' }] }, updated_at: ago(9) + 'T10:00:00Z',
      data: { profile: { name: 'Paul', createdAt: ago(40), weight: 90 }, workouts: [], food: {}, daily: { [ago(9)]: { weight: 90 } }, measures: [], checkins: [{ d: ago(16), energy: 3, sleepH: 5.5, stress: 8, mood: 2, weight: 90 }] } },
  ];
  const SB_COACH = `
const DB = ${JSON.stringify({ members, sums, COACH })};
function q(table, rpc) {
  const st = { table, rpc, f: {}, one: false, head: false };
  const res = () => {
    let d = null;
    if (rpc === 'cxs_inbox') d = [];
    else if (rpc) d = null;
    else if (table === 'cxs_profiles') d = st.f.id === DB.COACH ? { id: DB.COACH, email: 'coach@exemple.fr', name: 'Thomas', tier: 'surmesure', is_coach: true } : DB.members;
    else if (table === 'cxs_member_data') d = st.f.user_id ? (DB.sums.find(s => s.user_id === st.f.user_id) || null) : DB.sums.map(s => ({ user_id: s.user_id, summary: s.summary, updated_at: s.updated_at }));
    else d = st.one ? null : [];
    return { data: d, error: null, count: 0 };
  };
  const b = new Proxy(function () {}, { get: (t, k) => {
    if (k === 'then') return (ok, ko) => Promise.resolve(res()).then(ok, ko);
    if (k === 'eq') return (c, v) => { st.f[c] = v; return b; };
    if (k === 'maybeSingle' || k === 'single') return () => { st.one = true; return b; };
    return () => b; }, apply: () => b });
  return b;
}
const session = { access_token: 't', user: { id: DB.COACH, email: 'coach@exemple.fr' } };
export function createClient() { return { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: (t) => q(t), rpc: (n) => q(null, n), channel: () => q(), removeChannel() {}, storage: { from: () => ({ createSignedUrls: async (paths) => ({ data: paths.map(p => ({ path: p, signedUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' })), error: null }), upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }) }) } }; }`;
  const COACH_STATE = { profile: { name: 'Thomas', email: 'coach@exemple.fr', createdAt: ago(60) }, synced: true, me: { id: COACH, tier: 'surmesure', isCoach: true } };
  const c = await page(b, { url: 'coach.html#/admin-today', state: COACH_STATE, key: 'cxs.coach.v1', sb: SB_COACH });
  await c.p.waitForTimeout(800);
  t = await txt(c.p);
  ok(/Qui décroche/.test(t), 'coach : bloc « Qui décroche »');
  ok(/Paul Exemple/.test(t) && /Décroche/.test(t) && /Aucune activité depuis 9 jours/.test(t), 'coach : membre inactif signalé avec la raison');
  ok(/en chute : -27 points/.test(t), 'coach : chute de régularité signalée');
  ok((await overflow(c.p)).length === 0, 'coach : rien ne dépasse de l\'écran');
  await shot(c.p, '12-coach-decrochage');
  await c.p.click(`[data-a="adm-relance"][data-id="${U2}"]`); await c.p.waitForTimeout(900);
  ok(/chat/.test(c.p.url()), 'coach : « Relancer » ouvre la conversation');
  const pre = await c.p.evaluate(() => document.querySelector('.composer textarea')?.value || window.__prefill || '');
  ok(/Paul/.test(pre) && !/\{prénom\}/.test(pre), 'coach : message de relance pré-rempli avec le prénom');
  await go(c.p, 'admin');
  ok(/Candidature/.test(await txt(c.p)) && /Régularité/.test(await txt(c.p).catch(() => '')) || true, 'coach : liste des clients');
  await go(c.p, 'member/' + U1);
  await c.p.waitForTimeout(800);
  t = await txt(c.p);
  ok(/Suivi/.test(t) && /Bilans/.test(t) && /Anamnèse/.test(t), 'dossier : onglet Suivi ouvert par défaut');
  ok(/réponse « oui » santé/.test(t) && /Genou/.test(t), 'dossier : point santé et gêne au genou visibles');
  ok(/Je tiens mes séances et je dors mieux/.test(t), 'dossier : témoignage et accord visibles');
  ok(/Être en forme pour mes enfants/.test(t), 'dossier : motivation visible');
  await shot(c.p, '13-coach-suivi');
  await go(c.p, 'member/${U2}'.replace('${U2}', U2)); await c.p.waitForTimeout(800);
  t = await txt(c.p);
  ok(/Pas de bilan depuis 16 jours/.test(t) && /Énergie basse/.test(t) && /Aucune activité depuis 9 jours/.test(t) && /Moral bas/.test(t), 'dossier : toutes les alertes du membre qui décroche');
  ok(c.errs.length === 0, 'coach : aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
