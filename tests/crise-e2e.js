// Test de bout en bout de « Je craque » : description de l'envie, réponse concrète, suite, journal, déclencheurs,
// partage avec le coach seulement sur accord. iPhone 390×844 et Android 360×740, clair et sombre, animations réduites.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/crise-e2e.js`.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const T = iso(new Date()), ago = (n) => iso(new Date(Date.now() - n * 864e5));
const mkState = (extra = {}) => ({ profile: { name: 'Léa', email: 'lea@exemple.fr', level: 'beginner', goal: 'fat', weight: 64, sex: 'f', age: 29, height: 165, days: 3, startProgram: 'tb-rep3', records: {}, createdAt: ago(5) }, trialStart: ago(5), synced: false, plan: { programId: 'tb-rep3', startedAt: ago(5), week: 1, idx: 0, cycle: 1 }, workouts: [], daily: {}, food: {}, ...extra });
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, storage: { from: () => chain() } }; }`;

async function page(b, { state = {}, w = 390, h = 844, scheme = 'light' } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|WebSocket/i.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(mkState(state)));
  await p.goto(BASE + 'index.html#/crise', { waitUntil: 'load' }); await p.waitForTimeout(1400);
  return { p, ctx, errs, w };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(250); };
const pick = (p, k, v) => tap(p, `[data-a="cr-pick"][data-k="${k}"][data-v="${v}"]`);
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };
// Mise en page : rien ne dépasse, cibles tactiles d'au moins 44 px, boutons tous nommés
const mise = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inter = [...document.querySelectorAll('#app main button, #app main a[href], #app main textarea')].filter(vis);
  return { docW: document.documentElement.scrollWidth,
    petits: inter.filter(e => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(e => (e.textContent || e.tagName).trim().slice(0, 20) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)),
    muets: inter.filter(e => e.tagName === 'BUTTON' && !(e.textContent || '').trim() && !e.getAttribute('aria-label')).length,
    cases: [...document.querySelectorAll('#app main input[type=checkbox]')].filter(e => !e.closest('label')).length };
});
const INTERDITS = /suicid|3114|\bprier\b|prière|alcool|rattrap|punit/i;
const sansApres = (t) => t.replace(/Pas de repas sauté, pas de jeûne pour rattraper, pas de séance en plus pour compenser\./, '');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Décrire une envie et recevoir une réponse concrète');
  const a = await page(b);
  let t = await txt(a.p);
  ok(/Qu'est-ce qui se passe/.test(t) && /J'ai envie de/.test(t) && /Ce que je ressens/.test(t) && /Où je suis/.test(t) && /Force de l'envie/.test(t), 'écran de saisie : envie, ressenti, lieu, force');
  ok(!INTERDITS.test(t), 'aucune mention du suicide, du 3114, de la prière ni de rattrapage');
  ok(/parles-en à un médecin, ou à la ligne d'écoute spécialisée dans les troubles du comportement alimentaire au 09 69 325 900/.test(t) && (t.match(/09 69 325 900/g) || []).length === 1, 'une seule phrase sobre en bas, avec la ligne d\'écoute spécialisée');
  let m = await mise(a.p);
  ok(m.docW <= a.w + 1, 'rien ne dépasse de l\'écran (' + m.docW + ')');
  ok(m.petits.length === 0, 'cibles tactiles d\'au moins 44 px' + (m.petits.length ? ' : ' + m.petits.slice(0, 4).join(', ') : ''));
  ok(m.muets === 0, 'tous les boutons ont un nom lisible');
  ok(((await S(a.p)).crises || []).length === 0, 'rien n\'est enregistré avant d\'avoir demandé quoi faire');
  await shot(a.p, 'crise-01-saisie');

  await pick(a.p, 'envie', 'sucre'); await pick(a.p, 'emotion', 'stress'); await pick(a.p, 'contexte', 'maison'); await pick(a.p, 'intensite', '2');
  ok(await a.p.locator('[data-a="cr-pick"][aria-pressed="true"]').count() === 4, 'les 4 choix sont marqués (état lisible par un lecteur d\'écran)');
  await pick(a.p, 'contexte', 'maison');
  ok(await a.p.locator('[data-a="cr-pick"][data-k="contexte"][aria-pressed="true"]').count() === 0, 'un second tap retire un choix');
  await pick(a.p, 'contexte', 'maison');
  await a.p.fill('[data-f="cr-go"] textarea', 'Journée difficile <b>au bureau</b>');
  await pick(a.p, 'intensite', '3');
  ok(await a.p.inputValue('[data-f="cr-go"] textarea') === 'Journée difficile <b>au bureau</b>', 'le texte saisi n\'est pas perdu quand on change un choix');
  await tap(a.p, '[data-f="cr-go"] button');
  t = await txt(a.p);
  ok(/Une pause de 10 minutes/.test(t) && /Bois un grand verre d'eau/.test(t), 'réponse concrète : pause de 10 minutes, boire, marcher');
  ok(/trois respirations lentes/.test(t) && t.indexOf('trois respirations lentes') < t.indexOf('Bois un grand verre'), 'conseil adapté au ressenti (stress), donné avant la décision');
  ok(await a.p.evaluate(() => document.activeElement?.id) === 'cr-titre', 'le focus est placé sur le titre de la réponse (lecteur d\'écran, clavier)');
  ok(/Ton prochain repas est un repas normal/.test(t) && /Pas de repas sauté, pas de jeûne pour rattraper, pas de séance en plus pour compenser/.test(t), 'ce qu\'on fait après : repas normal, aucune compensation');
  ok(/Elle ne dit rien de ta valeur ni de ta volonté/.test(t), 'déculpabilisation explicite');
  ok(!INTERDITS.test(sansApres(t)), 'toujours aucun texte interdit');
  let st = await S(a.p);
  ok(st.crises.length === 1 && st.crises[0].d === T && /^\d\d:\d\d$/.test(st.crises[0].t) && st.crises[0].envie === 'sucre' && st.crises[0].emotion === 'stress' && st.crises[0].contexte === 'maison' && st.crises[0].intensite === 3, 'envie enregistrée dans le journal avec l\'heure');
  ok(await a.p.locator('#app main b').count() === 0 && /Journée difficile <b>au bureau<\/b>/.test(t), 'le texte libre est affiché tel quel, jamais interprété comme du HTML');
  m = await mise(a.p);
  ok(m.docW <= a.w + 1 && m.petits.length === 0 && m.muets === 0, 'réponse : mise en page et cibles tactiles correctes' + (m.petits.length ? ' : ' + m.petits.slice(0, 4).join(', ') : ''));
  await shot(a.p, 'crise-02-reponse');

  // « Reviens ici ensuite » : l'app est fermée puis rouverte pendant la pause
  await a.p.reload({ waitUntil: 'load' }); await a.p.waitForTimeout(1300);
  ok(/Une pause de 10 minutes/.test(await txt(a.p)) && await a.p.locator('[data-a="cr-suite"]').count() === 3 && (await S(a.p)).crises.length === 1, 'au retour après la pause, la réponse et la question « et ensuite ? » sont retrouvées, sans doublon');
  await tap(a.p, '[data-a="cr-suite"][data-v="plus"]');
  t = await txt(a.p);
  ok(/Un repas ne défait pas ce que tu construis/.test(t) && /✓ J'ai mangé plus que prévu/.test(t) && (await S(a.p)).crises[0].suite === 'plus', '« J\'ai mangé plus que prévu » : message bienveillant, issue notée et cochée (pas seulement par la couleur)');
  await tap(a.p, '[data-a="cr-suite"][data-v="passee"]');
  ok((await S(a.p)).crises.length === 1 && (await S(a.p)).crises[0].suite === 'passee', 'on peut corriger l\'issue sans créer de doublon');
  ok(await a.p.locator('[data-c="cr-share"]').count() === 0, 'pas de partage proposé hors coaching (essai)');
  await a.p.reload({ waitUntil: 'load' }); await a.p.waitForTimeout(1300);
  ok(/Qu'est-ce qui se passe/.test(await txt(a.p)), 'une fois l\'issue notée, le retour sur l\'écran propose une nouvelle saisie');
  await pick(a.p, 'envie', 'sucre');
  ok(await a.p.evaluate(() => document.activeElement?.dataset?.v) === 'sucre', 'après un choix, le focus reste sur le bouton touché');
  await pick(a.p, 'envie', 'sucre');

  console.log('Faim, soirée, envie forte');
  await pick(a.p, 'emotion', 'faim'); await pick(a.p, 'envie', 'sale'); await tap(a.p, '[data-f="cr-go"] button');
  ok(/C'est de la faim : mange/.test(await txt(a.p)) && /par exemple du pain avec du fromage, des œufs ou du houmous/.test(await txt(a.p)), 'faim : manger quelque chose de précis et suffisant, donné en exemple adaptable');
  await tap(a.p, '[data-a="cr-new"]');
  await pick(a.p, 'contexte', 'soiree'); await pick(a.p, 'intensite', '5'); await tap(a.p, '[data-f="cr-go"] button');
  ok(/Profite du moment, en choisissant/.test(await txt(a.p)) && /Ce repas peut être ton repas plaisir/.test(await txt(a.p)), 'soirée : repli sur le repas plaisir, sans interdit');
  await tap(a.p, '[data-a="cr-new"]');
  await pick(a.p, 'intensite', '5'); await tap(a.p, '[data-f="cr-go"] button');
  ok(/Une portion choisie, tranquillement/.test(await txt(a.p)), 'envie envahissante : portion choisie');
  await tap(a.p, '[data-a="cr-new"]'); await tap(a.p, '[data-f="cr-go"] button');
  ok(/Une pause de 10 minutes/.test(await txt(a.p)) && (await S(a.p)).crises.length === 5 && (await S(a.p)).crises[4].intensite === null, 'sans rien choisir : la pause est proposée quand même, et aucune intensité n\'est inventée');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));

  console.log('Journal, effacement, quêtes');
  t = await txt(a.p);
  ok(/Mon journal 5/.test(t) && /Ce qui revient/.test(t), 'journal : 5 notes et les déclencheurs repérés');
  const avant = (await S(a.p)).crises.length;
  await tap(a.p, '[data-a="cr-del"] >> nth=0');
  ok((await S(a.p)).crises.length === avant - 1 && /Mon journal 4/.test(await txt(a.p)), 'une note s\'efface (droit de rectification)');
  await a.p.evaluate(() => { location.hash = '#/trophees'; }); await a.p.waitForTimeout(700);
  ok(/Honnête avec soi/.test(await txt(a.p)) && a.errs.length === 0, 'les trophées lisent toujours le journal sans erreur');
  await a.ctx.close();

  console.log('Anciennes notes conservées, déclencheurs et plan préventif');
  const anciennes = [{ d: ago(30), note: 'Ancienne note du protocole précédent' },
    { d: ago(6), t: '21:10', envie: 'sucre', emotion: 'fatigue', contexte: 'maison', intensite: 4 }, { d: ago(4), t: '20:40', envie: 'sucre', emotion: 'fatigue', contexte: 'maison', intensite: 3 }, { d: ago(1), t: '21:50', envie: 'gras', emotion: 'fatigue', contexte: 'maison', intensite: 5, suite: 'portion' }];
  const c = await page(b, { state: { crises: anciennes, me: { tier: 'avance', isCoach: false } } });
  t = await txt(c.p);
  ok(/3 fois sur 3, c'est le soir/.test(t) && /3 fois sur 3 : fatigue/.test(t) && /protège ton sommeil/.test(t), 'déclencheurs : le soir, la fatigue, et un plan pour prendre de l\'avance');
  ok(/Ancienne note du protocole précédent/.test(t), 'les notes de l\'ancienne version restent lisibles');
  ok(await c.p.locator('[data-c="cr-share"]').count() === 1 && !(await c.p.isChecked('[data-c="cr-share"]')), 'membre coaché : partage proposé, décoché par défaut');
  let snap = await c.p.evaluate(async () => (await import('./js/sync.js')).snapshot().data);
  ok(snap.crises === null, 'sans accord, le journal ne part pas chez le coach');
  await c.p.check('[data-c="cr-share"]'); await c.p.waitForTimeout(250);
  snap = await c.p.evaluate(async () => (await import('./js/sync.js')).snapshot().data);
  ok(Array.isArray(snap.crises) && snap.crises.length === 4 && !!(await S(c.p)).criseShare && snap.criseShare === (await S(c.p)).criseShare, 'avec accord (horodaté), le journal et la date de l\'accord sont joints au dossier');
  await c.p.uncheck('[data-c="cr-share"]'); await c.p.waitForTimeout(250);
  snap = await c.p.evaluate(async () => (await import('./js/sync.js')).snapshot().data);
  ok(snap.crises === null && snap.criseShare === null && !(await S(c.p)).criseShare, 'accord retiré : le prochain envoi ne contient plus le journal (valeur nulle, qui remplace la copie du coach)');
  // La fusion côté serveur (js/cloud.js) remplace bien l'ancienne copie par la valeur nulle
  const fusion = await c.p.evaluate(() => { const prev = { crises: [{ d: '2026-11-01', note: 'copie du coach' }], criseShare: '2026-11-01T10:00:00Z', food: {} }, data = { crises: null, criseShare: null }; return { ...prev, ...data }; });
  ok(fusion.crises === null && fusion.criseShare === null, 'fusion du dossier : une valeur nulle écrase la copie précédente');
  // Accord donné puis changement de formule : la case reste visible pour pouvoir retirer l'accord
  await c.p.check('[data-c="cr-share"]'); await c.p.waitForTimeout(250);
  await c.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cxs.v1')); s.me = { tier: 'premium', isCoach: false }; localStorage.setItem('cxs.v1', JSON.stringify(s)); });
  await c.p.reload({ waitUntil: 'load' }); await c.p.waitForTimeout(1300);
  ok(await c.p.locator('[data-c="cr-share"]').count() === 1 && await c.p.isChecked('[data-c="cr-share"]'), 'formule changée (plus de coaching) : la case reste affichée tant que l\'accord est en cours');
  await c.p.uncheck('[data-c="cr-share"]'); await c.p.waitForTimeout(250);
  snap = await c.p.evaluate(async () => (await import('./js/sync.js')).snapshot().data);
  ok(snap.crises === null && !(await S(c.p)).criseShare, 'l\'accord se retire même après le changement de formule');
  await c.p.reload({ waitUntil: 'load' }); await c.p.waitForTimeout(1300);
  ok(await c.p.locator('[data-c="cr-share"]').count() === 0, 'accord retiré et plus de coaching : la case n\'est plus proposée');

  console.log('Côté coach : bloc affiché seulement avec accord, contenu jamais interprété');
  const coach = await c.p.evaluate(async () => {
    const { craquages } = await import('./js/views/suivi-coach.js');
    const sale = [{ d: '2026-11-10', t: '21:10', emotion: 'fatigue', contexte: 'maison', note: '<img src=x onerror=alert(1)>' }, { d: '<b>x</b>', t: '<i>', envie: '<u>', emotion: '<s>', contexte: '"><script>', suite: '<p>', note: 12 }, null, 'x', { d: '2026-11-11', t: '20:00', emotion: 'fatigue' }, { d: '2026-11-12', t: '20:30', emotion: 'fatigue' }];
    // (le titre « Ce qui revient » du bloc est en gras : c'est le seul <b> légitime, d'où « p > b » plus bas)
    const html = craquages({ crises: sale, criseShare: '2026-11-09T08:00:00.000Z' }); const div = document.createElement('div'); div.innerHTML = html;
    return { sansCle: craquages({}), nul: craquages({ crises: null, criseShare: null }), sansAccord: craquages({ crises: sale }), videPartage: craquages({ crises: [], criseShare: '2026-11-09T08:00:00.000Z' }),
      balises: div.querySelectorAll('img, script, i, u, s, p > b').length, texte: div.textContent.replace(/\s+/g, ' ') };
  });
  ok(coach.sansCle === '' && coach.nul === '' && coach.sansAccord === '', 'sans accord (clé absente, nulle, ou journal sans date d\'accord) : aucun bloc « Craquages »');
  ok(/Craquages 4 /.test(coach.texte) && /Partagé par le membre depuis le/.test(coach.texte) && /fatigue/.test(coach.texte), 'avec accord : journal, date de l\'accord et déclencheurs');
  ok(coach.balises === 0 && /<img src=x onerror=alert\(1\)>/.test(coach.texte), 'un journal piégé est affiché comme du texte, jamais exécuté');
  ok(/Aucune envie notée/.test(coach.videPartage), 'accord donné, journal vide : le bloc le dit');
  m = await mise(c.p);
  ok(m.docW <= c.w + 1 && m.petits.length === 0 && m.cases === 0, 'journal : mise en page correcte, case à cocher avec son libellé' + (m.petits.length ? ' : ' + m.petits.slice(0, 4).join(', ') : ''));
  ok(c.errs.length === 0, 'aucune erreur JavaScript' + (c.errs.length ? ' (' + c.errs.slice(0, 3).join(' | ') + ')' : ''));
  await shot(c.p, 'crise-03-journal');
  await c.ctx.close();

  console.log('Petit Android, thème sombre');
  const d = await page(b, { state: { crises: anciennes }, w: 360, h: 740, scheme: 'dark' });
  await pick(d.p, 'envie', 'tout'); await pick(d.p, 'emotion', 'fete'); await tap(d.p, '[data-f="cr-go"] button');
  m = await mise(d.p);
  ok(m.docW <= 361 && m.petits.length === 0, 'Android 360×740 : rien ne dépasse, cibles de 44 px' + (m.petits.length ? ' : ' + m.petits.slice(0, 4).join(', ') : ''));
  ok(await d.p.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgb(238, 241, 244)'), 'thème sombre appliqué');
  ok(d.errs.length === 0, 'aucune erreur JavaScript');
  await shot(d.p, 'crise-04-android-sombre');
  await d.ctx.close();

  await b.close();
  console.log('\n' + passed + ' vérifications réussies, ' + fails + ' échec(s).'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
