// Test de bout en bout de l'armoire à trophées (décision C61) : iPhone 390×844 et Android 360×740, clair et sombre,
// mouvement réduit ; Supabase simulé, données fictives. Zéro erreur JavaScript, zéro débordement.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/armoire-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, functions: { invoke: async () => ({ data: null, error: null }) }, storage: { from: () => chain() } }; }`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date());
const addD = (n) => iso(new Date(Date.now() + n * 864e5));
const profil = { name: 'Alex', email: 'alex@exemple.invalid', level: 'regular', goal: 'muscle', days: 4, records: {}, createdAt: T };
const s = (reps, kg = 0, o = {}) => ({ done: true, reps, kg, ...o });
const seance = (d, exos) => ({ id: 'w' + d, end: d + 'T18:00:00Z', title: 'Séance', exercises: exos.map(([name, sets]) => ({ name, sets })) });
// Persona fictive : quelques performances
const ATHLETE = {
  profile: { ...profil }, trialStart: T, me: { tier: 'premium' },
  workouts: [
    seance(addD(-2), [['Développé couché barre', [s(5, 60, { type: 'W' }), s(3, 82.5)]], ['Squat barre', [s(3, 100)]], ['Tractions pronation (poids de corps)', [s(11)]]]),
    seance(addD(-4), [['Muscle-up strict', [s(1)]], ['Équilibre libre (handstand)', [s(0, 0, { sec: 12 })]]]),
  ],
  daily: { [addD(-10)]: { weight: 80, cardio: [{ n: 'Footing', min: 50 }] } },
};

async function page(b, { state, url = '#/trophees', vp = { width: 390, height: 844 }, scheme = 'light' }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((x) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', x); }, JSON.stringify({ synced: false, plan: null, ...state }));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1200);
  return { p, ctx, errs };
}
const txt = async (p) => ((await p.textContent('#app')) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(400); };
const overflow = (p, root = '#app') => p.evaluate((r) => [...document.querySelectorAll(r + ' *')].filter(e => { const x = e.getBoundingClientRect(); return x.width > 0 && x.right > document.documentElement.clientWidth + 1 && !e.closest('.hscroll'); }).length, root);
const largeur = (p) => p.evaluate(() => document.documentElement.scrollWidth);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [vp, nom] of [[{ width: 390, height: 844 }, 'iPhone 390×844'], [{ width: 360, height: 740 }, 'Android 360×740']]) for (const scheme of ['light', 'dark']) {
    console.log(`\n${nom} · ${scheme === 'light' ? 'clair' : 'sombre'}`);
    const a = await page(b, { state: ATHLETE, vp, scheme });
    let t = await txt(a.p);
    ok(/Armoire à trophées/.test(t) && /Grade/.test(t) && /Niveau \d+/.test(t) && /XP/.test(t), 'armoire : grade, niveau et XP');
    ok((await a.p.locator('#app svg[aria-label="Renard"]').count()) >= 1, 'animal par défaut : renard');
    ok(/Développé couché/.test(t) && /Or · 80 kg/.test(t) && /prochain : 100 kg/.test(t), 'badge de force : or à 80 kg, prochain 100 kg');
    ok(/Premier muscle-up/.test(t) && /Handstand libre/.test(t), 'skills de calisthénie');
    ok(!/selon ton poids ·/i.test(t), 'badges selon le poids : éteints par défaut');
    ok(/−5 %/.test(t) && !/15 min/.test(t), 'abonnement en autonomie : réductions, rien qui prend du temps de coaching');
    ok(Array.isArray((await S(a.p)).armoireVus), 'première visite : badges marqués comme vus, sans annonce');
    ok(await overflow(a.p) === 0 && await largeur(a.p) <= vp.width, 'rien ne dépasse');
    if (SHOTS) await a.p.screenshot({ path: `${SHOTS}/armoire-${vp.width}-${scheme}.png`, fullPage: true });
    // Choix de l'animal
    await tap(a.p, '[data-a="arm-animaux"]');
    const nbLibres = await a.p.locator('#sheet [data-a="arm-animal"]').count();
    ok(nbLibres >= 5 && (await a.p.locator('#sheet svg').count()) === 12, `12 animaux, ${nbLibres} débloqués (taureau, gorille…)`);
    ok(await overflow(a.p, '#sheet') === 0, 'rien ne dépasse (animaux)');
    await tap(a.p, '#sheet [data-a="arm-animal"][data-v="taureau"]');
    ok((await S(a.p)).profile.animal === 'taureau' && (await a.p.locator('#app svg[aria-label="Taureau"]').count()) >= 1, 'animal débloqué choisi : taureau');
    // Épingler un badge
    await tap(a.p, '[data-a="arm-voir"][data-f="couche"]');
    ok((await a.p.locator('#sheet [data-a="arm-epingle"]').count()) === 3, 'détail : 3 paliers obtenus à épingler');
    await tap(a.p, '#sheet [data-a="arm-epingle"][data-v="couche-3"]');
    ok(JSON.stringify((await S(a.p)).profile.epingles) === '["couche-3"]', 'badge épinglé');
    ok(/Épinglé/.test(await a.p.textContent('#sheet')), 'bouton « Épinglé »');
    await a.p.click('#sheet [data-a="close-sheet"]'); await a.p.waitForTimeout(400);
    // Badges selon le poids de corps
    await tap(a.p, '[data-a="arm-poids"]');
    t = await txt(a.p);
    ok((await S(a.p)).profile.badgesPoids === true && /Couché selon ton poids/.test(t) && /1 × ton poids/.test(t), 'badges selon le poids activés (rapport seulement)');
    ok(!/80 kg de poids|pèses|poids : 80/.test(t), 'le poids n\'est jamais affiché');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();
  }

  console.log('\nNouveau badge : une annonce, une seule fois');
  {
    const n = await page(b, { state: { ...ATHLETE, armoireVus: ['seances-1'] }, url: '#/home' });
    const toast = await n.p.evaluate(() => [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' '));
    ok(/nouveaux badges|Nouveau badge/.test(toast), 'annonce : ' + toast);
    ok((await S(n.p)).armoireVus.length > 5, 'badges marqués comme vus');
    await n.p.reload(); await n.p.waitForTimeout(1200);
    ok(!(await n.p.evaluate(() => [...document.querySelectorAll('.toast')].some(x => /badge/i.test(x.textContent)))), 'pas de deuxième annonce');
    await n.p.evaluate(() => { location.hash = '#/profile'; }); await n.p.waitForTimeout(900);
    ok((await n.p.locator('#app svg[aria-label="Renard"]').count()) >= 1 && /Armoire/.test(await txt(n.p)), 'profil : animal et accès à l\'armoire');
    ok(n.errs.length === 0, 'zéro erreur JavaScript (accueil)' + (n.errs.length ? ' : ' + n.errs.join(' | ') : ''));
    await n.ctx.close();
  }

  console.log('\nPersonnes coachées et nouveaux comptes');
  {
    const c = await page(b, { state: { ...ATHLETE, me: { tier: 'surmesure' } } });
    ok(!/Récompenses/.test(await txt(c.p)), 'personne coachée : pas de réduction sur le coaching');
    await c.ctx.close();
    const v = await page(b, { state: { profile: { ...profil, name: 'Lou' }, trialStart: T } });
    const t = await txt(v.p);
    ok(/Niveau 1/.test(t) && /0\/\d+/.test(t) && v.errs.length === 0, 'compte neuf : niveau 1, aucun badge, aucune erreur');
    const corr = await page(b, { state: { profile: { ...profil, animal: '<img>', epingles: 'x', badgesPoids: 'oui' }, trialStart: T, workouts: 'cassé' } });
    ok(corr.errs.length === 0 && (await corr.p.locator('#app svg[aria-label="Renard"]').count()) >= 1, 'données corrompues : renard par défaut, aucune erreur');
    await v.ctx.close(); await corr.ctx.close();
  }

  await b.close();
  console.log(`\n${passed} réussis, ${fails} échoués`);
  process.exit(fails ? 1 : 0);
})();
