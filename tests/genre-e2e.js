// Test de bout en bout : genre choisi (jamais déduit), paliers adaptés au profil réel, onboarding sans présélection,
// textes sans « homme » par défaut. iPhone 390×844 et Android 360×740, clair et sombre, animations réduites.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/genre-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const ago = (n) => iso(new Date(Date.now() - n * 864e5));
const START = ago(20);
// Historique fictif qui amène au niveau 3 ou plus (palier « reprise » ou « élan »)
const workouts = [18, 16, 13, 11, 9, 6, 4].map((n, i) => ({ id: 'w' + i, title: 'Séance ' + (i % 3 + 1), start: ago(n) + 'T17:00:00.000Z', end: ago(n) + 'T18:00:00.000Z', volume: 3000, exercises: [{ name: 'Squat barre', orig: 'Squat barre', sets: [{ kg: 40, reps: 8, rpe: 8, done: true }] }] }));
const daily = {}, food = {};
for (let i = 0; i <= 20; i++) { const d = ago(i); if (i % 2 === 0) daily[d] = { weight: 68, sleep: 7, steps: 6000 }; if (i % 3 !== 1) food[d] = [{ label: 'Poulet riz', meal: 'Déjeuner', g: 350, kcal: 520, p: 40, c: 60, f: 10 }]; }
const mk = (profil = {}) => ({ profile: { name: 'Camille', email: 'camille@exemple.fr', level: 'comeback', goal: 'fat', weight: 68, age: 34, height: 166, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'all', sessionMin: 60, ...profil },
  trialStart: START, synced: false, plan: { programId: 'tb-rep3', startedAt: START, week: 3, idx: 1, cycle: 1 }, workouts, daily, food });
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;

async function page(b, { state, url = '#/trophees', w = 390, h = 844, scheme = 'light' }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/i.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  if (state) await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(state));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1400);
  return { p, ctx, errs, w };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const go = async (p, r) => { await p.evaluate((r) => { location.hash = '#/' + r; }, r); await p.waitForTimeout(700); };
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(300); };
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };
const mise = (p, sel) => p.evaluate((sel) => { const els = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0);
  return { docW: document.documentElement.scrollWidth, n: els.length, petits: els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => e.textContent.trim() + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)) }; }, sel);
const HOMME = /\bHommes?\b|\bhommes?\b/;
// Contraste du texte d'un bouton translucide posé sur une carte en dégradé : on compose le fond du bouton sur la couleur
// la plus claire du dégradé de la carte (cas le plus défavorable pour un texte clair) et on renvoie le rapport WCAG.
const contraste = (p, sel) => p.evaluate((sel) => {
  const nums = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const el = document.querySelector(sel), cs = getComputedStyle(el), carte = el.closest('.card');
  const stops = (getComputedStyle(carte).backgroundImage.match(/rgba?\([^)]+\)/g) || [getComputedStyle(carte).backgroundColor]).map(nums);
  const fg = nums(cs.color), bg = nums(cs.backgroundColor), a = bg.length > 3 ? bg[3] : 1;
  return Math.min(...stops.map(s => { const fond = [0, 1, 2].map(i => bg[i] * a + s[i] * (1 - a)); const x = lum(fg), y = lum(fond); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }));
}, sel);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Bug signalé : palier affiché à une personne dont le genre n\'est pas connu');
  for (const [nom, profil] of [['sexe féminin, genre jamais demandé (compte existant)', { sex: 'f' }], ['sexe masculin par défaut de l\'ancien onboarding', { sex: 'm' }], ['compte venu de l\'ancienne app, sans sexe ni genre', {}]]) {
    const a = await page(b, { state: mk(profil) });
    const t = await txt(a.p);
    ok(!HOMME.test(t) && !/\bFemme\b/.test(t) && /En pleine reprise/.test(t), nom + ' : palier neutre « En pleine reprise », ni « Homme » ni « Femme »');
    ok(a.errs.length === 0, nom + ' : aucune erreur JavaScript');
    await a.ctx.close();
  }

  console.log('La personne choisit elle-même comment on s\'adresse à elle');
  const a = await page(b, { state: mk({ sex: 'f' }) });
  ok(/Comment veux-tu qu'on s'adresse à toi/.test(await txt(a.p)) && await a.p.locator('[data-a="genre-set"]').count() === 3, 'question posée sur l\'écran Trophées : masculin, féminin, neutre');
  let m = await mise(a.p, '[data-a="genre-set"]');
  ok(m.petits.length === 0 && m.docW <= a.w + 1, 'boutons de 44 px au moins, rien ne dépasse' + (m.petits.length ? ' : ' + m.petits.join(', ') : ''));
  for (const scheme of ['light', 'dark']) { await a.p.emulateMedia({ colorScheme: scheme }); await a.p.waitForTimeout(150);
    const c = await contraste(a.p, '[data-a="genre-set"]'); ok(c >= 4.5, `boutons du genre lisibles sur la carte en dégradé, thème ${scheme === 'dark' ? 'sombre' : 'clair'} (contraste ${c.toFixed(1)} au point le plus clair du fond)`); }
  await a.p.emulateMedia({ colorScheme: 'light' });
  // Ouvrir Mes infos et enregistrer sans toucher au genre ne doit pas valoir un choix
  await go(a.p, 'profile'); await tap(a.p, '[data-a="edit-body"]');
  ok(await a.p.inputValue('#sheet select[name="genre"]') === '' && /Pas encore choisi/.test(await txt(a.p, '#sheet')), 'Mes infos : genre « Pas encore choisi », rien de présélectionné');
  await tap(a.p, '#sheet form button.btn-red'); await a.p.waitForTimeout(400);
  ok(!(await S(a.p)).profile.genre, 'enregistrer ses infos sans toucher au genre ne l\'enregistre pas à la place de la personne');
  await go(a.p, 'trophees');
  ok(await a.p.locator('[data-a="genre-set"]').count() === 3, 'la question reste posée sur Trophées');
  await shot(a.p, 'genre-01-question');
  await tap(a.p, '[data-a="genre-set"][data-v="f"]');
  let t = await txt(a.p);
  ok(/La Femme de la reprise/.test(t) && !HOMME.test(t) && (await S(a.p)).profile.genre === 'f', 'au féminin : « La Femme de la reprise », choix enregistré');
  ok(await a.p.locator('[data-a="genre-set"]').count() === 0, 'la question ne revient plus une fois le choix fait');
  await go(a.p, 'home');
  ok(/La Femme de la reprise/.test(await txt(a.p)) && !HOMME.test(await txt(a.p)), 'l\'Accueil affiche le même palier');
  await shot(a.p, 'genre-02-accueil');

  console.log('Modifiable dans Profil › Mes infos, indépendamment du sexe');
  await go(a.p, 'profile'); await tap(a.p, '[data-a="edit-body"]');
  ok(await a.p.inputValue('#sheet select[name="genre"]') === 'f' && await a.p.inputValue('#sheet select[name="sex"]') === 'f', 'Mes infos : genre et sexe affichés séparément');
  ok(/Je préfère ne pas le dire/.test(await txt(a.p, '#sheet')), 'on peut ne pas dire son sexe');
  const kcalAvant = await a.p.evaluate(async () => (await import('./js/energy.js')).bmr());
  await a.p.selectOption('#sheet select[name="genre"]', 'n'); await a.p.selectOption('#sheet select[name="sex"]', '');
  await tap(a.p, '#sheet form button.btn-red'); await a.p.waitForTimeout(400);
  let st = await S(a.p);
  ok(st.profile.genre === 'n' && st.profile.sex === null, 'genre neutre et sexe non précisé enregistrés');
  const kcalApres = await a.p.evaluate(async () => (await import('./js/energy.js')).bmr());
  const modeles = await a.p.evaluate(async () => { const N = await import('./js/nutrition.js'); const base = { goal: 'fat', level: 'advanced', age: 34, diet: 'all' }; return [N.pickModel({ ...base, sex: null }), N.pickModel({ ...base }), N.pickModel({ ...base, sex: 'm' }), N.pickModel({ ...base, sex: 'f' })].join(','); });
  ok(modeles === 'douce,douce,ventre,femme', 'sans sexe déclaré, le plan alimentaire par défaut est le plus doux, jamais le déficit le plus fort (' + modeles + ')');
  ok(Math.round(kcalApres - kcalAvant) === 83, 'sans sexe déclaré, la dépense de repos prend la valeur médiane (+83 kcal par rapport à « femme », −83 par rapport à « homme »)');
  await go(a.p, 'trophees');
  ok(/En pleine reprise/.test(await txt(a.p)) && !/Femme|Homme/.test(await txt(a.p)), 'retour au palier neutre');
  await go(a.p, 'profile'); await tap(a.p, '[data-a="edit-body"]');
  await a.p.selectOption('#sheet select[name="genre"]', 'm'); await tap(a.p, '#sheet form button.btn-red'); await a.p.waitForTimeout(400);
  await go(a.p, 'trophees');
  ok(/L'Homme de la reprise/.test(await txt(a.p)) && (await S(a.p)).profile.sex === null, 'au masculin sur demande : « L\'Homme de la reprise », sans toucher au sexe');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));
  await a.ctx.close();

  console.log('On ne parle de reprise qu\'à quelqu\'un qui reprend');
  const y = await page(b, { state: mk({ name: 'Yanis', level: 'advanced', goal: 'strength', sex: 'm', genre: 'm' }) });
  t = await txt(y.p);
  ok(/En plein élan/.test(t) && !/de la reprise|En pleine reprise|De retour|Tu es de retour/.test(t), 'profil avancé : « En plein élan », aucun mot de « reprise » sur sa carte');
  await y.ctx.close();
  const l = await page(b, { state: { ...mk({ name: 'Léa', level: 'beginner', genre: 'f', sex: 'f' }), workouts: [], daily: {}, food: {} } });
  ok(/La Débutante/.test(await txt(l.p)), 'débutante au féminin, niveau 1 : « La Débutante »');
  await l.ctx.close();

  console.log('Textes qui ne visaient que les hommes');
  const c = await page(b, { state: mk({ sex: 'f', genre: 'f' }), url: '#/rapport' });
  t = await txt(c.p);
  ok(!HOMME.test(t) && (!/aider d'autres/.test(t) || /aider d'autres personnes à se lancer/.test(t)), 'rapport : « d\'autres personnes », plus « d\'autres hommes »');
  await go(c.p, 'anamnese'); t = await txt(c.p);
  ok(!/tu seras fier|Prêt à changer|avec mon fils|La salle, seul/.test(t), 'point de départ : plus d\'accord au masculin ni d\'exemple qui présume une situation');
  for (const r of ['home', 'food', 'train', 'offers', 'coach', 'profile', 'settings', 'trophees', 'defi', 'regularite', 'monprofil', 'moncorps']) { await go(c.p, r); const x = await txt(c.p); ok(!HOMME.test(x), r + ' : aucun texte ne parle d\'« homme(s) »' + (HOMME.test(x) ? ' → ' + x.match(/.{0,40}[Hh]ommes?.{0,30}/)[0] : '')); }
  const modele = await c.p.evaluate(async () => { const N = await import('./js/nutrition.js'); await N.loadModels?.(); return JSON.stringify(N.MODELS || null); });
  ok(!modele || !/homme actif|Homme 30-55/.test(modele), 'modèles de plan alimentaire : plus de « homme actif »');
  ok(c.errs.length === 0, 'aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));
  await c.ctx.close();

  console.log('Premier lancement : rien de présélectionné, rien de déduit (petit Android, sombre)');
  const o = await page(b, { state: null, url: '', w: 360, h: 740, scheme: 'dark' });
  await tap(o.p, '[data-a="ob-start"]');
  let vus = '';
  for (let i = 0; i < 30 && !(await o.p.locator('[data-f="ob-body"]').count()); i++) {
    vus += ' ' + await txt(o.p);
    if (await o.p.locator('[data-f="ob-text"] input').count()) { await o.p.fill('[data-f="ob-text"] input', 'Inès'); await tap(o.p, '[data-f="ob-text"] button'); }
    else if (await o.p.locator('[data-f="ob-email"] input[type=email]').count()) { await o.p.fill('[data-f="ob-email"] input[type=email]', 'ines@exemple.fr'); await tap(o.p, '[data-f="ob-email"] button'); }
    else if (await o.p.locator('[data-a="ob-info"]').count()) await tap(o.p, '[data-a="ob-info"]');
    else if (await o.p.locator('[data-f="ob-records"]').count()) await tap(o.p, '[data-f="ob-records"] button.btn-red');
    else await tap(o.p, '[data-a="ob-pick"] >> nth=0');
  }
  ok(await o.p.locator('[data-f="ob-body"]').count() === 1, 'on arrive à l\'écran âge, taille, poids');
  ok(!/(?<![\p{L}])(Étudiant|Salarié|Retraité|Indépendant|Un ami|Serveur|livreur|infirmier|Être suivi|toujours assis|Assis,)(?![\p{L}])/u.test(vus) && /Je fais des études/.test(vus), 'les réponses proposées avant cet écran ne sont pas écrites au masculin');
  ok(await o.p.locator('[data-a="ob-sex"]').count() === 3 && await o.p.locator('[data-a="ob-genre"]').count() === 3, 'sexe : homme, femme ou ne pas dire ; genre : masculin, féminin ou neutre');
  ok(await o.p.locator('[data-f="ob-body"] .seg button.on').count() === 0 && await o.p.locator('[data-f="ob-body"] [aria-pressed="true"]').count() === 0, 'aucun choix présélectionné (« Homme » ne l\'est plus)');
  m = await mise(o.p, '[data-f="ob-body"] button, [data-f="ob-body"] label.field'); // la zone tactile d'un champ est son étiquette entière
  ok(m.docW <= 361 && m.petits.length === 0, 'Android 360×740 : rien ne dépasse, cibles de 44 px' + (m.petits.length ? ' : ' + m.petits.join(', ') : '') + ' (largeur ' + m.docW + ')');
  await shot(o.p, 'genre-03-onboarding');
  await o.p.fill('[data-f="ob-body"] input[name="age"]', '31'); await o.p.fill('[data-f="ob-body"] input[name="height"]', '168'); await o.p.fill('[data-f="ob-body"] input[name="weight"]', '62');
  await tap(o.p, '[data-f="ob-body"] button.btn-red');
  for (let i = 0; i < 12 && !(await S(o.p))?.profile; i++) { if (await o.p.locator('[data-a="ob-pick"]').count()) await tap(o.p, '[data-a="ob-pick"] >> nth=0'); else await o.p.waitForTimeout(900); }
  st = await S(o.p);
  ok(!!st?.profile && st.profile.sex === null && st.profile.genre === null, 'sans réponse : sexe et genre restent vides (plus de « homme » par défaut)');
  await go(o.p, 'trophees');
  ok(/Premiers pas/.test(await txt(o.p)) && !HOMME.test(await txt(o.p)), 'palier neutre « Premiers pas » et question du genre proposée');
  ok(o.errs.length === 0, 'aucune erreur JavaScript' + (o.errs.length ? ' (' + o.errs.slice(0, 3).join(' | ') + ')' : ''));
  await o.ctx.close();

  console.log('Premier lancement : choix explicites');
  const o2 = await page(b, { state: null, url: '' });
  await tap(o2.p, '[data-a="ob-start"]');
  for (let i = 0; i < 30 && !(await o2.p.locator('[data-f="ob-body"]').count()); i++) {
    if (await o2.p.locator('[data-f="ob-text"] input').count()) { await o2.p.fill('[data-f="ob-text"] input', 'Sofia'); await tap(o2.p, '[data-f="ob-text"] button'); }
    else if (await o2.p.locator('[data-f="ob-email"] input[type=email]').count()) { await o2.p.fill('[data-f="ob-email"] input[type=email]', 'sofia@exemple.fr'); await tap(o2.p, '[data-f="ob-email"] button'); }
    else if (await o2.p.locator('[data-a="ob-info"]').count()) await tap(o2.p, '[data-a="ob-info"]');
    else if (await o2.p.locator('[data-f="ob-records"]').count()) await tap(o2.p, '[data-f="ob-records"] button.btn-red');
    else await tap(o2.p, '[data-a="ob-pick"] >> nth=0');
  }
  await tap(o2.p, '[data-a="ob-sex"][data-v="f"]'); await tap(o2.p, '[data-a="ob-genre"][data-v="n"]');
  ok(await o2.p.locator('[data-f="ob-body"] [aria-pressed="true"]').count() === 2, 'les deux choix sont marqués (lisibles par un lecteur d\'écran)');
  await o2.p.fill('[data-f="ob-body"] input[name="age"]', '40'); await o2.p.fill('[data-f="ob-body"] input[name="height"]', '170'); await o2.p.fill('[data-f="ob-body"] input[name="weight"]', '70');
  await tap(o2.p, '[data-f="ob-body"] button.btn-red');
  for (let i = 0; i < 12 && !(await S(o2.p))?.profile; i++) { if (await o2.p.locator('[data-a="ob-pick"]').count()) await tap(o2.p, '[data-a="ob-pick"] >> nth=0'); else await o2.p.waitForTimeout(900); }
  st = await S(o2.p);
  ok(st?.profile?.sex === 'f' && st.profile.genre === 'n', 'sexe féminin et genre neutre enregistrés tels que choisis');
  ok(o2.errs.length === 0, 'aucune erreur JavaScript');
  await o2.ctx.close();

  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
