// Test de bout en bout de l'étape 3 (notifications, connaissances, swipe nutrition, libellés entiers…)
// Base reprise de l'étape 2 : réseau privé (absence, annonces, sondages, défis), mot du coach, tout valider, frise des phases, éditeur (A/B, supersets, phases), code coach, étiquettes.
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
const ME = 'me-0001';
window.__reads = [];
const NOTIFS = [{ id: 11, user_id: null, title: 'Nouveau créneau', body: 'Cours samedi 10 h', created_at: new Date().toISOString() }, { id: 12, user_id: ME, title: 'Bravo', body: 'Belle semaine', created_at: new Date(Date.now() - 864e5).toISOString() }];
function q(table, rpc, args) {
  const st = { f: {}, up: null };
  const res = () => {
    if (rpc === 'cxs_health_token_new') return { data: 'tb_' + 'ab'.repeat(24), error: null };
    if (table === 'cxs_health_daily') return { data: [{ d: new Date().toISOString().slice(0, 10), data: { steps: 8421, sleep: 7.2 } }], error: null };
    if (table === 'cxs_health_tokens') return { data: null, error: null };
    if (table === 'cxs_notifications') return { data: NOTIFS, error: null };
    if (table === 'cxs_notif_reads') { if (st.up) { window.__reads.push(...st.up.map(r => r.notif_id)); return { data: null, error: null }; } return { data: [{ notif_id: 12 }], error: null }; }
    if (table === 'cxs_coach_settings' || table === 'cxs_coach_public' || table === 'cxs_session_reviews') return { data: null, error: { message: 'hors ligne' } };
    return { data: null, error: null };
  };
  const b = new Proxy(function () {}, { get: (t, k) => {
    if (k === 'then') return (ok, ko) => Promise.resolve(res()).then(ok, ko);
    if (k === 'eq') return (c, v) => { st.f[c] = v; return b; };
    if (k === 'upsert') return (row) => { st.up = row; return b; };
    return () => b; }, apply: () => b });
  return b;
}
const session = { access_token: 't', user: { id: ME, email: 'karim@exemple.fr' } };
export function createClient() { return { auth: { getSession: async () => ({ data: { session } }), getUser: async () => ({ data: { user: session.user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: (t) => q(t), rpc: (n, a) => q(null, n, a), channel: () => q(), removeChannel() {}, storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }), upload: async () => ({ error: null }) }) } }; }`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  let t;
  console.log('Notifications');
  const { p, errs } = await page(b, { url: '#/home', state: { ...STATE, coachSettings: null, coachPublic: null }, sb: SB_MEMBER });
  await p.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'notifs'; document.body.appendChild(b); b.click(); }); await p.waitForTimeout(800);
  ok(await p.$$eval('.nt.unread', l => l.length) === 1 && await p.$$eval('.nt', l => l.length) === 2, 'centre : 1 non lue (bleue), 1 lue');
  await p.click('.nt.unread'); await p.waitForTimeout(400);
  ok(await p.$$eval('.nt.unread', l => l.length) === 0 && (await p.evaluate(() => window.__reads)).includes(11), 'centre : toucher une notification la marque lue');
  ok(/Recevoir les notifications sur ce téléphone/.test(await txt(p, 'body')), 'centre : proposition d\'activer les notifications');
  await p.evaluate(() => document.querySelector('.sheet-wrap')?.remove());
  console.log('Connaissances');
  await go(p, 'carnet/savoir'); await p.waitForTimeout(600); t = await txt(p);
  ok(/Exercices/.test(t) && /Documentation/.test(t) && /Science/.test(t), 'connaissances : menus en haut');
  await p.click('[data-a="savoir-sub"][data-v="science"]'); await p.waitForTimeout(400); t = await txt(p);
  ok(/Combien de protéines par jour/.test(t) && /Podcasts/.test(t), 'science : fiches et podcasts');
  await p.click('[data-a="sci-th"][data-v="endurance"]'); await p.waitForTimeout(300); t = await txt(p);
  ok(/Endurance : beaucoup de lent/.test(t) && !/protéines par jour/.test(t), 'science : filtre par thème');
  await p.click('[data-a="sci-open"][data-id="polarise"]'); await p.waitForTimeout(300); t = await txt(p, 'body');
  ok(/En pratique/.test(t) && /Seiler/.test(t) && await p.$$eval('a[href*="pubmed.ncbi.nlm.nih.gov"]', l => l.length) >= 2, 'science : fiche avec études PubMed');
  await p.evaluate(() => document.querySelector('.sheet-wrap')?.remove());
  await p.click('[data-a="savoir-sub"][data-v="doc"]'); await p.waitForTimeout(600);
  ok(/Entraînement/.test(await txt(p)), 'documentation : rubriques');
  console.log('Libellés entiers');
  for (const w of [360, 390]) {
    await p.setViewportSize({ width: w, height: 800 }); await go(p, 'carnet'); await p.waitForTimeout(400);
    const cut = await p.$$eval('.modes button, .seg button', l => l.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()));
    ok(cut.length === 0, `entraînement ${w}px : aucun libellé coupé` + (cut.length ? ' (' + cut.join(', ') + ')' : ''));
  }
  await p.setViewportSize({ width: 390, height: 844 });
  console.log('Nutrition : balayage');
  await go(p, 'food'); await p.waitForTimeout(600);
  const swipe = async (sel, dx) => p.evaluate(([sel, dx]) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + 20;
    const T = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [T(x, y)], changedTouches: [T(x, y)] }));
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [T(x + dx, y + 4)] })); }, [sel, dx]);
  const head = () => p.$eval('.wkring', el => el.previousElementSibling?.textContent || '');
  const h0 = await head();
  await swipe('.card.mt8', 140); await p.waitForTimeout(400);
  const h1 = await head();
  ok(h0 !== h1 && !/Aujourd'hui/.test(h1), 'balayage vers la droite : jour précédent');
  await swipe('.wkring', 140); await p.waitForTimeout(400);
  const d2 = await p.$eval('.wd.sel', el => el.getAttribute('aria-label'));
  ok(!!d2, 'balayage sur la semaine : semaine précédente');
  await swipe('.card.mt8', -140); await p.waitForTimeout(400);
  ok(await p.$eval('.wd.sel', el => el.getAttribute('aria-label')) !== d2, 'balayage vers la gauche : jour suivant');

  console.log('Correction, consignes, quiz');
  const RVS = { '102': { data: { reaction: '🔥', vu: true, grades: { technique: 4, intensite: 5 }, note: 'Très bonne séance', ex: { 0: { c: 'Belle profondeur', sets: { 1: 'Genoux qui rentrent' } } } }, seen_at: null } };
  const st3 = { ...STATE, coachPublic: null, coachSettings: { cues: { 'Squat barre': 'Pousse le sol avec tout le pied' } }, reviews: RVS };
  const m3 = await page(b, { url: '#/home', state: st3, sb: SB_MEMBER });
  t = await txt(m3.p);
  ok(/Thomas a corrigé ta séance/.test(t), 'accueil : séance corrigée à lire');
  await m3.p.click('[data-a="w-detail"][data-id="102"]'); await m3.p.waitForTimeout(500); t = await txt(m3.p, 'body');
  ok(/Vue par ton coach/.test(t) && /4,5\/5/.test(t) && /Très bonne séance/.test(t), 'détail : réaction, note, retour global');
  ok(/Thomas : Belle profondeur/.test(t) && /Série 2 : Genoux qui rentrent/.test(t), 'détail : commentaires exercice et série');
  ok((await S(m3.p)).reviews['102'].seen_at, 'détail : correction marquée lue');
  await m3.p.evaluate(() => document.querySelector('.sheet-wrap')?.remove());
  await go(m3.p, 'carnet/carnet/historique'); await m3.p.waitForTimeout(500);
  ok(/vue par Thomas/.test(await txt(m3.p)), 'historique : étiquette « vue par Thomas »');
  await m3.p.evaluate(async () => { const E = await import('./js/engine.js'); const st = await import('./js/store.js'); const s0 = E.buildSession(); s0.start = new Date().toISOString(); s0.exercises[0].name = 'Squat barre'; st.update(x => { x.current = s0; }); });
  await go(m3.p, 'workout'); await m3.p.waitForTimeout(600);
  ok(/Thomas : Pousse le sol avec tout le pied/.test(await txt(m3.p)), 'séance : consigne du coach sur l\'exercice');
  await m3.p.evaluate(async () => { const st = await import('./js/store.js'); st.update(x => { x.current = null; }); });
  await go(m3.p, 'coach'); await m3.p.waitForTimeout(700);
  ok(/Mes consignes de Thomas/.test(await txt(m3.p)), 'coaching : mes consignes');
  await go(m3.p, 'quiz-exos'); await m3.p.waitForTimeout(1500); t = await txt(m3.p);
  ok(await m3.p.$$eval('[data-a="qx-pref"]', l => l.length) > 20, 'quiz : exercices par pattern');
  const btns = await m3.p.$$('[data-a="qx-pref"][data-v="love"]'); await btns[0].click(); const h = await m3.p.$$('[data-a="qx-pref"][data-v="hate"]'); await h[3].click();
  ok(/1 😍 · 1 🚫/.test(await txt(m3.p, 'body')), 'quiz : compteur');
  await m3.p.click('[data-a="qx-send"]'); await m3.p.waitForTimeout(800);
  const pr = (await S(m3.p)).programme?.prefs || {};
  ok(Object.values(pr).filter(v => v === 'love').length === 1 && Object.values(pr).filter(v => v === 'hate').length === 1, 'quiz : réponses enregistrées');
  ok(m3.errs.length === 0, 'correction et quiz : aucune erreur JavaScript' + (m3.errs.length ? ' (' + m3.errs.slice(0, 3).join(' | ') + ')' : ''));

  console.log('Cardio');
  const st4 = { ...STATE, coachPublic: null, coachSettings: { cardio: [{ id: 'k1', titre: 'Seuil progressif', sport: 'course', modele: 'seuil', blocs: [{ t: 'chauffe', z: 'ef', min: 0.05 }, { rep: 2, items: [{ t: 'effort', z: 'seuil', min: 0.05 }, { t: 'recup', z: 'facile', min: 0.05 }] }], quand: { jours: [0, 1, 2, 3, 4, 5, 6], from: ago(7) }, prog: { weeks: 8, effortMin: 2 } }] }, cardioRef: { vma: 15, fcmax: 188 } };
  const c4 = await page(b, { url: '#/carnet/cardio', state: st4, sb: SB_MEMBER });
  await c4.p.waitForTimeout(600); t = await txt(c4.p);
  ok(/Ma semaine cardio/.test(t) && /Seuil progressif/.test(t) && /Thomas/.test(t), 'cardio : semaine avec la séance du coach');
  ok(/semaine 2/.test(t), 'cardio : progression du coach (semaine 2)');
  await c4.p.click('[data-a="cd-new"]'); await c4.p.waitForTimeout(400);
  await c4.p.click('[data-a="cd-mod"][data-v="30-30"]'); await c4.p.waitForTimeout(300);
  ok(/Répéter/.test(await txt(c4.p, 'body')) && /3:49–4:13 \/km/.test(await txt(c4.p, 'body')), 'éditeur : modèle 30/30 avec allures VMA');
  await c4.p.click('[data-a="cd-jour"][data-v="2"]').catch(() => {}); await c4.p.click('[data-a="cd-save"]'); await c4.p.waitForTimeout(500);
  ok(((await S(c4.p)).cardioPlan || []).length === 1, 'éditeur : séance programmée récurrente');
  await go(c4.p, 'home'); await c4.p.waitForTimeout(500);
  ok(/Cardio prévu aujourd'hui/.test(await txt(c4.p)), 'accueil : cardio du jour');
  await c4.p.click('[data-a="cd-go"][data-id="k1"]'); await c4.p.waitForTimeout(600); t = await txt(c4.p);
  ok(/Endurance fondamentale/.test(t) && /\/km/.test(t) && /Ensuite/.test(t), 'séance guidée : bloc, allure, suivant');
  await shot(c4.p, 'etape3-cardio-live');
  await c4.p.waitForTimeout(4200);
  const live = (await S(c4.p)).cardioLive;
  ok(live && live.i >= 1, 'séance guidée : passage automatique au bloc suivant');
  await c4.p.click('[data-a="cl-end"]'); await c4.p.waitForTimeout(400);
  await c4.p.fill('form[data-f="cl-save"] input[name="km"]', '2,5'); await c4.p.click('form[data-f="cl-save"] .btn-red'); await c4.p.waitForTimeout(600);
  const dd = (await S(c4.p)).daily; const entry = Object.values(dd).flatMap(x => x.cardio || []).find(x => x.struct);
  ok(entry && entry.km === 2.5 && entry.met > 1 && /k1@/.test(entry.plan), 'séance guidée : enregistrée avec MET et distance');
  t = await txt(c4.p);
  ok(/✅/.test(t), 'semaine : séance marquée faite');
  await c4.p.click('[data-a="cd-libre"]'); await c4.p.waitForTimeout(300);
  await c4.p.click('[data-a="cd-go"][data-id="libre"][data-s="hyrox"]'); await c4.p.waitForTimeout(500);
  await c4.p.click('[data-a="cl-tour"]'); await c4.p.waitForTimeout(200);
  ok(/Tour 1/.test(await txt(c4.p)), 'activité libre : chrono et tours');
  ok((await overflow(c4.p)).length === 0, 'cardio : rien ne dépasse');
  ok(c4.errs.length === 0, 'cardio : aucune erreur JavaScript' + (c4.errs.length ? ' (' + c4.errs.slice(0, 3).join(' | ') + ')' : ''));

  console.log('Apple Santé');
  const hs = await page(b, { url: '#/sante', state: { ...STATE, coachPublic: null, coachSettings: null }, sb: SB_MEMBER });
  await hs.p.waitForTimeout(1200); t = await txt(hs.p);
  ok(/Raccourcis/.test(t) && /Créer mon jeton/.test(t) && /functions\/v1\/sante/.test(t) && /Scriptable/.test(t), 'santé : guide pas à pas et adresse');
  await hs.p.click('[data-a="sante-tok"]'); await hs.p.waitForTimeout(600);
  ok(/tb_abab/.test(await txt(hs.p)) && /quoi=widget&token=tb_abab/.test(await txt(hs.p)), 'santé : jeton créé et reporté dans le widget');
  const dly = (await S(hs.p)).daily[new Date().toISOString().slice(0, 10)] || {};
  ok(dly.steps === 8421 && dly.sleep === 7.2, 'santé : pas et sommeil récupérés dans le journal');
  ok((await overflow(hs.p)).length === 0, 'santé : rien ne dépasse');
  ok(hs.errs.length === 0, 'santé : aucune erreur JavaScript' + (hs.errs.length ? ' (' + hs.errs.slice(0, 3).join(' | ') + ')' : ''));

  console.log('Analyse vidéo');
  await go(hs.p, 'video'); await hs.p.waitForTimeout(500); t = await txt(hs.p);
  ok(/Analyse une série en vidéo/.test(t) && await hs.p.$('input[type=file][accept="video/*"]') !== null, 'vidéo : écran et choix de la vidéo');
  // vidéo de test fabriquée dans le navigateur (un carré qui monte) pour vérifier lecture, dessin et trajectoire
  const url = await hs.p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 160; c.height = 120; const x = c.getContext('2d'); const st = c.captureStream(30); const rec = new MediaRecorder(st, { mimeType: 'video/webm' }); const parts = []; rec.ondataavailable = e => parts.push(e.data);
    rec.start(); for (let i = 0; i < 30; i++) { x.fillStyle = '#222'; x.fillRect(0, 0, 160, 120); x.fillStyle = '#fff'; x.fillRect(70, 90 - i * 2, 14, 14); await new Promise(r => setTimeout(r, 34)); } rec.stop(); await new Promise(r => rec.onstop = r); return URL.createObjectURL(new Blob(parts, { type: 'video/webm' })); });
  await hs.p.evaluate(async (u) => { const m = await import('./js/views/video.js'); m.ouvrirVideo(u); }, url); await hs.p.waitForTimeout(1500);
  ok(await hs.p.$('#vv') !== null && await hs.p.$('#vc') !== null, 'vidéo : lecteur et calque de dessin');
  await hs.p.click('[data-a="vd-opt"][data-v="dessin"]');
  const box = await hs.p.$eval('#vc', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  if (box.w > 0) { await hs.p.mouse.move(box.x + 10, box.y + 10); await hs.p.mouse.down(); await hs.p.mouse.move(box.x + box.w / 2, box.y + box.h / 2, { steps: 5 }); await hs.p.mouse.up(); }
  const px = await hs.p.$eval('#vc', el => { const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  ok(px > 0, 'vidéo : le dessin s\'affiche sur l\'image');
  ok(hs.errs.filter(e => !/mediapipe|vision_bundle|Failed to fetch|tasks-vision|import/i.test(e)).length === 0, 'vidéo : aucune erreur JavaScript' + (hs.errs.length ? ' (' + hs.errs.slice(0, 3).join(' | ') + ')' : ''));
  ok(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' (' + errs.slice(0, 3).join(' | ') + ')' : ''));
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
