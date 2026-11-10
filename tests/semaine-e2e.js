// Test de bout en bout de « Ma semaine » : Premium / gratuit, le fixe, les imprévus, placement, replacement, « Je ne peux pas »,
// revue du dimanche, rappel dans le calendrier. iPhone 390×844 tactile, Supabase simulé, données fictives.
// Lancement : servir la racine sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/semaine-e2e.js`.
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
const MON = add(T, -dow(T)), NEXT = add(MON, 7);
const BUREAU = { id: 'b1', type: 'travail', label: 'Bureau', jours: [0, 1, 2, 3, 4], debut: '09:00', fin: '18:00' };
const mkState = (extra = {}) => ({ profile: { name: 'Karim', email: 'karim@exemple.fr', level: 'regular', goal: 'muscle', weight: 80, sex: 'm', age: 30, height: 178, days: 3, place: 'bigGym', startProgram: 'tb-rep3', records: {}, createdAt: T, sessionMin: 60 }, trialStart: T, synced: false, plan: { programId: 'tb-rep3', startedAt: add(T, -2), week: 1, idx: 0, cycle: 1 }, schedule: { days: [{ on: true, time: '18:30', dur: 60, place: 'Salle' }, { on: false }, { on: true, time: '18:30', dur: 60, place: 'Salle' }, { on: false }, { on: true, time: '18:30', dur: 60, place: 'Salle' }, { on: false }, { on: false }] }, ...extra });

async function page(b, { state, url = '#/semaine', tier = 'premium', dark = false, date = null }) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: dark ? 'dark' : 'light', acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  const st = mkState(state); if (tier !== 'free') st.me = { tier, isCoach: false }; else st.trialStart = '2026-01-01';
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(st));
  if (date) await p.addInitScript((iso) => { const R = Date; const fake = new R(iso).getTime(); const off = fake - R.now(); const N = class extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }; window.Date = N; }, date);
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { p, ctx, errs };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const shot = async (p, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1 && !e.closest('.chips,.hscroll,.modes,svg,pre'); }).map(e => e.className || e.tagName).slice(0, 5));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(500); };
const closeSheet = async (p) => { await p.evaluate(() => document.querySelector('#sheet .grab')?.click()); await p.waitForTimeout(400); };
const hh = (s) => s.slice(0, 5);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });

  console.log('Gratuit : aperçu verrouillé, l\'agenda existant reste');
  const g = await page(b, { tier: 'free' });
  ok(/calées dans ta vraie semaine/.test(await txt(g.p)) && await g.p.locator('.veil').count() === 1, 'écran verrouillé avec explication');
  ok(await g.p.locator('[data-a="sm-bloc"]').count() === 0, 'aucune fonction Premium accessible');
  await g.p.evaluate(() => { location.hash = '#/home'; }); await g.p.waitForTimeout(700);
  const st = await S(g.p); ok(st.schedule.days.filter(d => d.on).length === 3 && !st.semaine, 'la semaine type existante est intacte, rien écrit');
  await g.p.evaluate((d) => { location.hash = '#/home/month'; }, T); await g.p.waitForTimeout(900);
  await g.p.evaluate(async (t) => { const E = await import('./js/engine.js'); await E.loadPrograms(); }, T);
  ok(g.errs.length === 0, 'aucune erreur JavaScript' + (g.errs.length ? ' (' + g.errs.slice(0, 3).join(' | ') + ')' : ''));
  await g.ctx.close();

  console.log('Premium : le fixe, le variable, la grille');
  const a = await page(b, {});
  ok(/Ma semaine/.test(await txt(a.p)) && await a.p.locator('.swrow').count() === 7, 'grille : 7 jours');
  ok(await a.p.locator('.swseg.sw-seance').count() + await a.p.locator('.swdot').count() >= 1, 'les séances prévues apparaissent sur la grille');
  ok((await overflow(a.p)).length === 0, 'rien ne dépasse de l\'écran');
  const axe = await a.p.locator('.swaxis > div > span').evaluateAll(e => e.map(x => Math.round(x.getBoundingClientRect().left)));
  ok(axe.length === 6 && axe.every((x, i) => i === 0 || x - axe[i - 1] > 20), 'axe des heures : 6 repères bien répartis (' + axe.join(', ') + ')');
  await tap(a.p, '[data-a="sm-bloc"][data-id=""]');
  await a.p.selectOption('#sheet select[name="type"]', 'travail'); await a.p.fill('#sheet input[name="label"]', 'Bureau');
  await a.p.fill('#sheet input[name="debut"]', '18:00'); await a.p.fill('#sheet input[name="fin"]', '09:00'); await tap(a.p, '#sheet form button.btn-red');
  ok(/la fin doit être après le début/i.test(await txt(a.p, 'body')), 'horaires incohérents refusés avec un message clair');
  await a.p.fill('#sheet input[name="debut"]', '09:00'); await a.p.fill('#sheet input[name="fin"]', '18:00'); await tap(a.p, '#sheet form button.btn-red'); await a.p.waitForTimeout(500);
  let s1 = await S(a.p); ok(s1.semaine.fixe.length === 1 && s1.semaine.fixe[0].jours.join() === '0,1,2,3,4' && s1.semaine.fixe[0].label === 'Bureau', 'bloc fixe enregistré (lundi à vendredi)');
  ok(await a.p.locator('.swseg.sw-travail').count() === 5, 'le travail apparaît sur 5 jours de la grille');
  await tap(a.p, '[data-a="sm-reglages"]'); await a.p.fill('#sheet input[name="lever"]', '06:30'); await a.p.fill('#sheet input[name="coucher"]', '22:30'); await a.p.fill('#sheet input[name="trajet"]', '20'); await tap(a.p, '#sheet form button.btn-red');
  s1 = await S(a.p); ok(s1.semaine.reglages.lever === '06:30' && s1.semaine.reglages.trajet === 20, 'lever, coucher et trajet enregistrés');
  ok(/8 h de sommeil/.test(await txt(a.p)), 'sommeil visé calculé : 8 h');
  await shot(a.p, '01-semaine');

  console.log('Semaine type proposée');
  await tap(a.p, '[data-a="sm-type"]');
  let t = await txt(a.p, '#sheet');
  ok(/Ma semaine type proposée/.test(t) && /Au moins 48 h/.test(t) && /créneau de rechange/.test(t), 'aperçu : jours, récupération, rechange');
  const jourTxt = await a.p.locator('#sheet .card').first().locator('.li').allTextContents();
  ok(jourTxt.length === 3 && jourTxt.every(x => /(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)/.test(x)), 'trois séances placées');
  await shot(a.p, '02-semaine-type');
  await tap(a.p, '#sheet [data-a="sm-valider"][data-m="type"]'); await a.p.waitForTimeout(600);
  const s2 = await S(a.p), jours = s2.schedule.days.filter(d => d.on);
  ok(jours.length === 3 && jours.every(d => /^\d\d:\d\d$/.test(d.time) && d.dur >= 20), 'semaine type écrite dans l\'agenda existant : ' + s2.schedule.days.map((d, i) => d.on ? 'LMMJVSD'[i] + ' ' + d.time : '').filter(Boolean).join(', '));
  const sem = s2.semaine.fixe[0], libre = s2.schedule.days.map((d, i) => d.on && i <= 4 ? (hh(d.time) >= '18:00' || hh(d.time) < '09:00') : true).every(Boolean);
  ok(libre, 'aucune séance en semaine pendant les heures de bureau');
  const ag = await a.p.evaluate(async (m) => { const E = await import('./js/engine.js'); await E.loadPrograms(); const d = new Date(m + 'T12:00:00'); const out = []; for (let i = 0; i < 14; i++) { const k = new Date(d.getTime() + i * 864e5); const z = new Date(k.getTime() - k.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); out.push(z); } const a = E.agenda(out[0], out[13]); return Object.entries(a).filter(([, x]) => x.st === 'planned').map(([k, x]) => [k, x.time]); }, MON);
  ok(ag.length >= 3 && ag.every(([, tm]) => /^\d\d:\d\d$/.test(tm)), 'l\'agenda existant prévoit les séances aux nouveaux horaires');

  console.log('Imprévu de la semaine, replacement');
  await tap(a.p, '[data-a="sm-imprevu"]');
  await tap(a.p, '#sheet [data-a="sm-imp-pick"] >> nth=1');
  ok(await a.p.inputValue('#sheet input[name="label"]') === 'Une réunion tardive' && await a.p.inputValue('#sheet input[name="debut"]') === '17:00', 'choix rapide : réunion tardive préremplie');
  const jourOpt = await a.p.locator('#sheet select[name="date"] option').evaluateAll(o => o.map(x => x.value));
  const cibleJour = jourOpt.find(d => d >= T && ((new Date(d + 'T12:00:00').getDay() + 6) % 7) <= 4) || jourOpt[2];
  await a.p.selectOption('#sheet select[name="date"]', cibleJour); await a.p.fill('#sheet input[name="debut"]', '17:00'); await a.p.fill('#sheet input[name="fin"]', '21:30'); await tap(a.p, '#sheet form button.btn-red'); await a.p.waitForTimeout(500);
  const s3 = await S(a.p); ok(s3.semaine.variable.length === 1 && s3.semaine.variable[0].date === cibleJour, 'imprévu enregistré pour ce jour-là seulement');
  ok(/Réunion tardive|réunion tardive/i.test(await txt(a.p)) && /17:00–21:30/.test(await txt(a.p)), 'visible dans « Ce qui change cette semaine »');
  await shot(a.p, '03-imprevu');
  const avant = JSON.stringify((await S(a.p)).workouts) + JSON.stringify((await S(a.p)).plan);
  await tap(a.p, '[data-a="sm-replacer"]'); await a.p.waitForTimeout(400);
  t = await txt(a.p, '#sheet');
  ok(/Mes séances replacées/.test(t) && /Une séance décalée n'est pas un échec/.test(t), 'aperçu du replacement');
  await tap(a.p, '#sheet [data-a="sm-valider"][data-m="semaine"]'); await a.p.waitForTimeout(600);
  const s4 = await S(a.p);
  ok(JSON.stringify(s4.workouts) + JSON.stringify(s4.plan) === avant, 'séances faites et plan intacts');
  ok(Object.keys(s4.slots || {}).length >= 1, 'les créneaux de la période sont enregistrés (' + Object.keys(s4.slots || {}).length + ')');
  ok(a.errs.length === 0, 'aucune erreur JavaScript' + (a.errs.length ? ' (' + a.errs.slice(0, 3).join(' | ') + ')' : ''));

  console.log('Je ne peux pas');
  const prochaine = await a.p.evaluate(async (t) => { const E = await import('./js/engine.js'); await E.loadPrograms(); const d = (n) => { const x = new Date(t + 'T12:00:00'); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }; const ag = E.agenda(d(1), d(14)); return Object.entries(ag).filter(([, x]) => x.st === 'planned').map(([k]) => k)[0]; }, T);
  await a.p.evaluate((d) => { location.hash = '#/home/month'; }, prochaine); await a.p.waitForTimeout(900);
  await a.p.evaluate((k) => document.querySelector(`[data-a="ag-day"][data-v="${k}"]`)?.click(), prochaine); await a.p.waitForTimeout(600);
  ok(await a.p.locator('#sheet [data-a="jnp"]').count() === 1, 'bouton « Je ne peux pas » dans la séance de l\'agenda');
  await tap(a.p, '#sheet [data-a="jnp"]'); await a.p.waitForTimeout(700);
  t = await txt(a.p, '#sheet');
  ok(/Je ne peux pas/.test(t) && /pas un échec/.test(t), 'feuille ouverte, ton bienveillant');
  const props = await a.p.locator('#sheet [data-a="jnp-go"]').count();
  ok(props >= 1 && props <= 3, `${props} proposition(s) de créneau`);
  await shot(a.p, '04-je-ne-peux-pas');
  const cibleProp = await a.p.locator('#sheet [data-a="jnp-go"]').first().evaluate(e => ({ d: e.dataset.t, h: e.dataset.h }));
  const mv0 = JSON.stringify((await S(a.p)).moves || {});
  await tap(a.p, '#sheet [data-a="jnp-go"] >> nth=0'); await a.p.waitForTimeout(500);
  const s5 = await S(a.p);
  ok(s5.moves[prochaine] === cibleProp.d && s5.slots[cibleProp.d].time === cibleProp.h, 'séance décalée au créneau proposé : ' + cibleProp.d + ' ' + cibleProp.h);
  const ag2 = await a.p.evaluate(async ([k]) => { const E = await import('./js/engine.js'); return E.agenda(k, k)[k]?.st; }, [prochaine]);
  ok(ag2 === 'away' && JSON.stringify(s5.workouts) === JSON.stringify(s4.workouts), 'l\'ancien jour affiche « déplacée », pas « loupée » : ' + ag2);
  ok(a.errs.length === 0, 'aucune erreur JavaScript');

  console.log('Calendrier : rappel avant le rendez-vous');
  await a.p.evaluate(() => { location.hash = '#/semaine'; }); await a.p.waitForTimeout(900);
  const dl = a.p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await a.p.evaluate(() => document.querySelector('[data-a="ics-export"]')?.click());
  const d = await dl; let ics = '';
  if (d) ics = fs.readFileSync(await d.path(), 'utf8');
  ok(/BEGIN:VEVENT/.test(ics) && /BEGIN:VALARM/.test(ics) && /TRIGGER:-PT30M/.test(ics), 'export .ics : un rappel 30 minutes avant chaque séance');
  await a.ctx.close();

  console.log('Revue du dimanche, thème sombre');
  const dim = add(MON, 6);
  const r = await page(b, { state: { semaine: { v: 1, reglages: { lever: '07:00', coucher: '23:00', trajet: 15, pref: 'soir' }, fixe: [BUREAU], variable: [] } }, url: '#/home', date: dim + 'T15:00:00' });
  await r.p.waitForTimeout(600);
  ok(/Ta revue de la semaine/.test(await txt(r.p)), 'le dimanche : carte « Ta revue de la semaine » sur l\'accueil');
  await tap(r.p, '[data-a="go"][data-p="revue"]'); await r.p.waitForTimeout(800);
  t = await txt(r.p);
  ok(/Ta revue du dimanche/.test(t) && /La semaine prochaine/.test(t), 'revue : la semaine suivante est affichée');
  ok(await r.p.locator('.chip.on[data-a="sm-sem"]').first().textContent().then(x => /prochaine/.test(x)), 'la semaine prochaine est sélectionnée');
  ok((await overflow(r.p)).length === 0, 'rien ne dépasse de l\'écran');
  await shot(r.p, '05-revue-dimanche');
  await r.ctx.close();
  const dk = await page(b, { state: { semaine: { v: 1, reglages: { lever: '07:00', coucher: '23:00', trajet: 15, pref: 'soir' }, fixe: [BUREAU], variable: [] } }, dark: true });
  ok((await overflow(dk.p)).length === 0 && await dk.p.locator('.swrow').count() === 7, 'sombre : grille lisible, rien ne dépasse');
  await shot(dk.p, '06-sombre');
  const hn = await page(b, { state: { semaine: { v: 1, reglages: { lever: '07:00', coucher: '23:00', trajet: 15, pref: 'soir' }, fixe: [BUREAU], variable: [] } }, url: '#/home' });
  ok(!/Ta revue de la semaine/.test(await txt(hn.p)) || dow(T) === 6, 'hors dimanche : pas de carte de revue');
  ok(dk.errs.length === 0 && hn.errs.length === 0, 'aucune erreur JavaScript');
  await dk.ctx.close(); await hn.ctx.close();

  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
