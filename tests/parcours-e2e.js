// Parcours général : chaque écran principal s'ouvre sans erreur JavaScript et sans rien qui dépasse de l'écran,
// en iPhone 390×844 ET petit Android 360×740, en clair ET en sombre, animations réduites. Données fictives uniquement.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/parcours-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const ago = (n) => iso(new Date(Date.now() - n * 864e5));

// Persona fictive : Camille, en reprise, 3 séances par semaine, jour 20 de son essai
const START = ago(20);
const workouts = [18, 16, 13, 11, 9, 6, 4].map((n, i) => ({ id: 'w' + i, title: 'Séance ' + (i % 3 + 1), start: ago(n) + 'T17:00:00.000Z', end: ago(n) + 'T18:00:00.000Z', volume: 3000 + i * 200, exercises: [{ name: 'Squat barre', orig: 'Squat barre', sets: [{ kg: 40 + i * 2.5, reps: 8, rpe: 8, done: true }] }] }));
const daily = {}, food = {};
for (let i = 0; i <= 20; i++) { const d = ago(i); if (i % 2 === 0) daily[d] = { weight: Math.round((68 - (20 - i) * 0.05) * 10) / 10, sleep: 6.5 + (i % 3) * 0.5, steps: 6000 + i * 100, feel: { energy: 3 + (i % 3) } }; if (i % 3 !== 1) food[d] = [{ label: 'Poulet riz', meal: 'Déjeuner', g: 350, kcal: 520, p: 40, c: 60, f: 10 }]; }
const CAMILLE = {
  profile: { name: 'Camille', email: 'camille@exemple.fr', level: 'comeback', goal: 'fat', weight: 68, sex: 'f', age: 34, height: 166, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: START, diet: 'all', sessionMin: 60 },
  trialStart: START, synced: false, plan: { programId: 'tb-rep3', startedAt: START, week: 3, idx: 1, cycle: 1 }, workouts, daily, food,
  lifts: { 'Squat barre': [{ d: ago(18), e1rm: 50 }, { d: ago(4), e1rm: 62 }] },
  measures: [{ d: START, weight: 68, waistNav: 82 }, { d: ago(6), waistNav: 80.5 }],
  checkins: [{ d: ago(13), week: ago(13), weight: 67.6, energy: 5, sleepH: 6.5, stress: 7, mood: 3, win: 'Trois séances tenues', sessions: 3 }],
};
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;

const ROUTES = ['home', 'plan', 'defi', 'carnet', 'train', 'atelier', 'monprogramme', 'monplan', 'semaine', 'soutenabilite', 'roadmap', 'volume', 'food', 'body', 'moncorps', 'recup', 'bilan', 'bilans', 'regularite', 'rapport', 'compare', 'anamnese', 'coach', 'offers', 'profile', 'settings', 'account', 'trophees', 'crise', 'kb', 'monprofil', 'privacy', 'agenda', 'simu', 'builder'];
const CONFS = [['iPhone clair', 390, 844, 'light'], ['iPhone sombre', 390, 844, 'dark'], ['Android clair', 360, 740, 'light'], ['Android sombre', 360, 740, 'dark']];

// Ce qui dépasse à droite de l'écran (hors zones prévues pour défiler). La largeur de la page est comparée à la largeur
// réelle du téléphone, pas à innerWidth : en émulation mobile, innerWidth s'élargit avec le contenu qui déborde.
const mesure = () => {
  const over = [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => String(e.className || e.tagName)).slice(0, 3);
  return { over, docW: document.documentElement.scrollWidth, vw: innerWidth, len: (document.querySelector('#app')?.innerText || '').length, bg: getComputedStyle(document.body).backgroundColor };
};

async function ouvrir(b, { state, w, h, scheme }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/i.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(state));
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1400);
  return { p, ctx, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [nom, w, h, scheme] of CONFS) {
    console.log(nom + ' (' + w + '×' + h + ')');
    const a = await ouvrir(b, { state: CAMILLE, w, h, scheme });
    for (const r of ROUTES) {
      const n0 = a.errs.length;
      await a.p.evaluate((r) => { location.hash = '#/' + r; }, r); await a.p.waitForTimeout(650);
      const m = await a.p.evaluate(mesure);
      ok(m.len > 40, `${nom} · ${r} : l'écran s'affiche`);
      ok(a.errs.length === n0, `${nom} · ${r} : aucune erreur JavaScript` + (a.errs.length > n0 ? ' (' + a.errs.slice(n0, n0 + 2).join(' | ').slice(0, 200) + ')' : ''));
      ok(m.over.length === 0 && m.docW <= w + 1, `${nom} · ${r} : rien ne dépasse de l'écran (largeur ${m.docW} pour ${w}) ${m.over.join(', ')}`);
      if (r === 'home') ok(scheme === 'dark' ? m.bg !== 'rgb(238, 241, 244)' : m.bg === 'rgb(238, 241, 244)', `${nom} : thème ${scheme === 'dark' ? 'sombre' : 'clair'} appliqué (${m.bg})`);
      if (SHOTS && nom === 'Android sombre') { fs.mkdirSync(SHOTS, { recursive: true }); await a.p.screenshot({ path: `${SHOTS}/parcours-${r}.png` }); }
    }
    await a.ctx.close();

    // Essai terminé, sans abonnement : l'écran des offres remplace l'app, sans débordement
    const fin = JSON.parse(JSON.stringify(CAMILLE)); fin.trialStart = ago(45); fin.profile.createdAt = ago(45);
    const z = await ouvrir(b, { state: fin, w, h, scheme });
    const m = await z.p.evaluate(mesure);
    ok(/Ton essai est terminé/.test(await z.p.textContent('#app')), `${nom} · essai terminé : écran des offres`);
    ok(m.over.length === 0 && m.docW <= w + 1, `${nom} · essai terminé : rien ne dépasse de l'écran (largeur ${m.docW} pour ${w})`);
    ok(z.errs.length === 0, `${nom} · essai terminé : aucune erreur JavaScript`);
    await z.ctx.close();

    // Premier lancement
    const n = await ouvrir(b, { state: {}, w, h, scheme });
    const mo = await n.p.evaluate(mesure);
    ok(await n.p.locator('[data-a="ob-start"]').count() === 1 && mo.docW <= w + 1 && n.errs.length === 0, `${nom} · premier lancement : accueil de l'onboarding, sans erreur ni débordement`);
    await n.ctx.close();
  }
  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})();
