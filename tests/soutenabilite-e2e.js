// Test de bout en bout du score de soutenabilité : carte, écran, version tenable, montée progressive, adéquation à l'objectif.
// iPhone 390×844 tactile, Supabase simulé, données fictives. Lancement : servir la racine sur BASE_URL, puis `node tests/soutenabilite-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date()), dow = (d) => (new Date(d + 'T12:00:00').getDay() + 6) % 7;
const add = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return iso(x); };
const MON = add(T, -dow(T));
const YOYO = { goal: 'muscle', goal2: 'none', level: 'beginner', materiel: ['salle_basique'], daysWanted: 5, daysReal: 5, sessionMin: 60, zones: [], style: 'any', sleep: '5', stress: 'high', kids: 'yes', quits: '5', quitAfter: '2' };
const OK = { goal: 'fat', goal2: 'none', level: 'beginner', materiel: ['halteres_maison', 'poids_du_corps', 'barre_traction'], daysWanted: 3, daysReal: 3, sessionMin: 45, zones: [], style: 'any' };
const PROG = (a = {}) => ({ v: 1, at: '2026-11-10T10:00:00.000Z', answers: { ...YOYO, ...a }, prefs: {} });
const mkState = (extra = {}) => ({ profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'beginner', goal: 'muscle', weight: 80, sex: 'm', age: 30, height: 178, days: 3, place: 'bigGym', startProgram: 'tb-rep3', records: {}, createdAt: T, sessionMin: 60 }, trialStart: T, synced: false, plan: { programId: 'tb-rep3', startedAt: add(T, -2), week: 1, idx: 0, cycle: 1 }, schedule: { days: [{ on: true, time: '18:30', dur: 60, place: 'Salle' }, { on: false }, { on: true, time: '18:30', dur: 60, place: 'Salle' }, { on: false }, { on: true, time: '18:30', dur: 60, place: 'Salle' }, { on: false }, { on: false }] }, ...extra });
const wk = (jours) => jours.map((d, i) => ({ id: 'w' + i, title: 'Séance', start: d + 'T17:00:00.000Z', end: d + 'T18:00:00.000Z', volume: 5000, setsDone: 12, exercises: [] }));

async function page(b, { state, url = '#/monplan', tier = 'premium', dark = false }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  const st = mkState(state); if (tier !== 'free') st.me = { tier, isCoach: false }; else st.trialStart = '2026-01-01';
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(st));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1600);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(700); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Essai terminé, sans abonnement : app verrouillée sur les offres');
  const g = await page(b, { state: { programme: PROG({ goal: 'strength', target: '100 kg au développé couché', daysWanted: 2, daysReal: 2, style: 'hautbas', sessionMin: 90, sleep: undefined, stress: undefined, kids: undefined, quits: undefined, level: 'regular' }) }, tier: 'free' });
  ok(/Ton essai est terminé/.test(await txt(g.p)) && await g.p.locator('[data-a="choose"]').count() >= 1, 'écran des offres à la place du programme proposé');
  await g.p.evaluate(() => { location.hash = '#/soutenabilite'; }); await g.p.waitForTimeout(800);
  ok(/Ton essai est terminé/.test(await txt(g.p)), 'écran des offres à la place du score de soutenabilité');
  ok(g.errs.length === 0, 'aucune erreur JavaScript' + (g.errs.length ? ' (' + g.errs.slice(0, 3).join(' | ') + ')' : ''));
  await g.ctx.close();

  console.log('Premium : plan trop ambitieux');
  const a = await page(b, { state: { programme: PROG() } });
  let t = await txt(a.p);
  ok(/Est-ce que ça tient dans ta vie \? Trop ambitieux/.test(t), 'carte dans la proposition : Trop ambitieux');
  ok(/Ce plan vise trop haut pour ta vie actuelle\. Mieux vaut \d séances tenues 12 semaines que 5 pendant 3 semaines\./.test(t), 'message de la spec, avec les bons nombres');
  await shot(a.p, '01-carte');
  await tap(a.p, '.card.tap[data-r="soutenabilite"]');
  t = await txt(a.p);
  ok(/Trop ambitieux/.test(t) && /\d+\/100/.test(t) && await a.p.locator('.stjauge').count() === 1, 'écran : niveau, score sur 100, jauge');
  ok(['Le temps', 'La charge', 'Le saut', "L'historique", 'Ce que tu tiens'].every(x => t.includes(x)), 'les cinq ingrédients sont expliqués');
  ok(/très grande marche/.test(t) && /sommeil court/.test(t), 'raisons concrètes : le saut et le sommeil');
  ok(!/échec|paresse|honte|raté|faible/i.test(t), 'ton positif, jamais culpabilisant');
  ok(/Remplis « Ma semaine »/.test(t) && /Score à affiner/.test(t), 'temps libre estimé : invitation à remplir Ma semaine');
  ok((await overflow(a.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(a.p, '02-ecran');
  ok(/Une version tenable/.test(t) && await a.p.locator('[data-a="st-version"]').count() === 1, 'une version tenable est proposée');
  const vk = await a.p.locator('[data-a="st-version"]').evaluate(e => ({ k: +e.dataset.k, m: +e.dataset.m }));
  ok(vk.k >= 2 && vk.k < 5 && vk.m <= 60, `version tenable : ${vk.k} séances de ${vk.m} min`);
  await shot(a.p, '03-version-tenable');

  console.log('Version tenable appliquée à la proposition');
  await tap(a.p, '[data-a="st-version"]'); await a.p.waitForTimeout(600);
  const s1 = await S(a.p);
  ok(s1.monplan.ajust.daysReal === vk.k && s1.monplan.prop.n === vk.k && s1.monplan.prop.sessions.length === vk.k, 'la proposition est refaite avec ' + vk.k + ' séances');
  ok(s1.monplan.prop.sessions.every(s => s.minutes <= vk.m + 3), 'séances de ' + vk.m + ' min au plus');
  ok(Object.values(s1.monplan.prop.semaine).every(x => !x.absent), 'les 8 patterns restent couverts');
  ok(/Tenable/.test(await txt(a.p)) && !/Trop ambitieux/.test(await txt(a.p)), 'la carte passe à Tenable');
  ok(s1.programme.answers.daysReal === 5 && s1.programme.answers.sessionMin === 60, 'les réponses du questionnaire ne sont pas modifiées');
  ok(s1.plan.programId === 'tb-rep3', 'le programme en cours ne change pas');
  await tap(a.p, '.card.tap[data-r="soutenabilite"]');
  ok(/version allégée de ton plan/.test(await txt(a.p)) && await a.p.locator('[data-a="st-retour"]').count() === 1, 'écran : rappel qu\'on regarde une version allégée');
  await tap(a.p, '[data-a="st-retour"]'); await a.p.waitForTimeout(600);
  const s2 = await S(a.p);
  ok(!s2.monplan.ajust && s2.monplan.prop.n === 5 && /Trop ambitieux/.test(await txt(a.p)), 'retour au plan de départ : 5 séances, Trop ambitieux');

  console.log('Montée progressive');
  await tap(a.p, '.card.tap[data-r="soutenabilite"]');
  t = await txt(a.p);
  ok(/Monter par étapes/.test(t) && /démarre à \d/.test(t) && /3 semaines à 90 %/.test(t), 'proposition de démarrer sous la cible');
  const dep = await a.p.locator('[data-a="st-demarrer"]').evaluate(e => +e.dataset.k);
  ok(dep >= 2 && dep < 5, 'départ à ' + dep + ' séances');
  await tap(a.p, '[data-a="st-demarrer"]'); await a.p.waitForTimeout(800);
  const s3 = await S(a.p);
  ok(s3.montee.cible === 5 && s3.montee.palier === dep && s3.montee.depuis === T, 'montée enregistrée : palier ' + dep + ', objectif 5');
  ok(s3.schedule.days.filter(d => d.on).length === Math.min(dep, 3), 'la semaine type compte ' + Math.min(dep, 3) + ' jours (le programme a 3 séances)');
  ok(JSON.stringify(s3.workouts) === JSON.stringify(s2.workouts), 'séances faites intactes');
  await a.p.evaluate(() => { location.hash = '#/soutenabilite'; }); await a.p.waitForTimeout(900);
  ok(/Montée progressive/.test(await txt(a.p)) && /Tu en es à \d séance/.test(await txt(a.p)) && /encore 3 semaines pour juger|0 semaine|semaine/.test(await txt(a.p)), 'écran : palier en cours et condition de montée');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));
  await a.ctx.close();
  const direct = await page(b, { state: { programme: PROG(OK) }, url: '#/soutenabilite' });
  ok(/Soutenabilité/.test(await txt(direct.p)) && /Tenable/.test(await txt(direct.p)) && !/Il me faut d'abord une proposition/.test(await txt(direct.p)), 'ouvert directement : la proposition est générée et le score affiché, pas de cul-de-sac');
  await direct.ctx.close();

  console.log('Régularité prouvée : on peut monter');
  const sem = [1, 2, 3].flatMap(i => [add(MON, -7 * i + 1), add(MON, -7 * i + 3)]);
  const m = await page(b, { state: { programme: PROG(OK), monplan: null, montee: { cible: 3, palier: 2, depuis: add(MON, -35) }, workouts: wk(sem), schedule: { days: [{ on: true, time: '18:30', dur: 45, place: 'Salle' }, { on: false }, { on: false }, { on: true, time: '18:30', dur: 45, place: 'Salle' }, { on: false }, { on: false }, { on: false }] } }, url: '#/home' });
  await m.p.waitForTimeout(500);
  ok(/Tu as tenu 3 semaines d'affilée/.test(await txt(m.p)), 'accueil : carte « Tu as tenu 3 semaines d\'affilée »');
  await shot(m.p, '04-monter');
  await tap(m.p, '.card.tap[data-r="soutenabilite"]');
  await m.p.evaluate(() => { location.hash = '#/monplan'; }); await m.p.waitForTimeout(500);
  await m.p.evaluate(() => { location.hash = '#/soutenabilite'; }); await m.p.waitForTimeout(900);
  ok(await m.p.locator('[data-a="st-monter"]').count() === 1 && /Tu as tenu 3 semaines/.test(await txt(m.p)), 'écran : « Passer à 3 séances »');
  await tap(m.p, '[data-a="st-monter"]'); await m.p.waitForTimeout(900);
  const s4 = await S(m.p);
  ok(s4.montee.palier === 3 && s4.montee.depuis === T && s4.schedule.days.filter(d => d.on).length === 3, 'palier 3, trois jours dans la semaine type');
  await m.p.evaluate(() => { location.hash = '#/home'; }); await m.p.waitForTimeout(900);
  ok(!/Tu as tenu 3 semaines d'affilée/.test(await txt(m.p)), 'plus de carte une fois monté');
  ok(m.errs.length === 0, 'aucune erreur JavaScript' + (m.errs.length ? ' (' + m.errs.slice(0, 3).join(' | ') + ')' : ''));
  await m.ctx.close();
  const peu = await page(b, { state: { programme: PROG(OK), montee: { cible: 3, palier: 2, depuis: add(MON, -35) }, workouts: wk([add(MON, -6), add(MON, -4), add(MON, -13), add(MON, -20), add(MON, -18)]) }, url: '#/home' });
  ok(!/Tu as tenu 3 semaines d'affilée/.test(await txt(peu.p)), 'une semaine à 1 séance sur 2 : pas de montée');
  await peu.ctx.close();

  console.log('Temps libre mesuré, plan tenable, thème sombre');
  const BUREAU = { id: 'b1', type: 'travail', label: 'Bureau', jours: [0, 1, 2, 3, 4], debut: '09:00', fin: '18:00' };
  const d = await page(b, { state: { programme: PROG(OK), semaine: { v: 1, reglages: { lever: '07:00', coucher: '23:00', trajet: 15, pref: 'soir' }, fixe: [BUREAU], variable: [] }, workouts: [] }, url: '#/monplan', dark: true });
  await tap(d.p, '.card.tap[data-r="soutenabilite"]'); await d.p.waitForTimeout(600);
  t = await txt(d.p);
  ok(/Tenable/.test(t) && !/Une version tenable/.test(t), 'plan tenable : pas de version alternative proposée');
  ok(/temps libre utile/.test(t) && !/Remplis « Ma semaine »/.test(t), 'temps libre mesuré à partir de Ma semaine');
  ok(/Ce plan tient dans ta vie/.test(t), 'message : le plan tient');
  ok((await overflow(d.p)).length === 0, 'sombre : rien ne dépasse');
  await shot(d.p, '05-sombre');
  ok(d.errs.length === 0, 'aucune erreur JavaScript');
  await d.ctx.close();

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
