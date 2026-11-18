// Test de bout en bout du module « athlète hybride » : iPhone 390×844 et petit Android 360×740, clair et sombre,
// mouvement réduit activé ; Supabase simulé, données fictives (personas). Zéro erreur JavaScript, zéro débordement.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/hybride-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, functions: { invoke: async () => ({ data: null, error: null }) }, storage: { from: () => chain() } }; }`;
// Selfie fictif (SVG) : fond, cheveux noirs, visage foncé placé dans l'ovale guide (300 × 400, décalé de 16 px vers le haut)
const SELFIE_FICTIF = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#3060A0"/><ellipse cx="150" cy="176" rx="99" ry="148" fill="#1C1916"/><ellipse cx="150" cy="192" rx="81" ry="120" fill="#5A3E30"/></svg>`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date());
const addD = (n) => iso(new Date(Date.now() + n * 864e5));
const dow = (d) => (new Date(d + 'T12:00:00').getDay() + 6) % 7;
const lundi = (d) => addD(-dow(d)); // lundi de cette semaine (d = aujourd'hui)
const profil = { name: 'Alex', email: 'alex@exemple.invalid', level: 'regular', goal: 'muscle', days: 4, records: {}, createdAt: T };
const set = (o = {}) => ({ done: true, reps: 5, kg: 60, ...o });
const seance = (d) => ({ id: 'w' + d, end: d + 'T18:00:00Z', title: 'Séance', exercises: [{ name: 'Squat barre', sets: [set({ type: 'W' }), set(), set()] }, { name: 'Rotation externe élastique', sets: [set(), set()] }] });
// Personas fictifs
const PERSONAS = {
  reprise: { profile: { ...profil, name: 'Camille', level: 'comeback', days: 3 }, trialStart: T, hybride: { bloc: { macroId: 'M1', debut: addD(-dow(T) - 7), nbSeances: 6, reprise: true } }, workouts: [seance(addD(-3)), seance(addD(-5))], daily: { [T]: { feel: { energy: 7 } } } },
  avance: { profile: { ...profil, name: 'Sam', level: 'advanced', days: 6 }, trialStart: T, me: { tier: 'surmesure', isCoach: false }, hybride: { bloc: { macroId: 'M2', debut: addD(-dow(T) - 21), nbSeances: 6, vma: 15, halterophilie: true }, debloques: ['tenue-argent', 'bandeau'] }, workouts: [seance(addD(-1)), seance(addD(-2)), seance(addD(-4))] },
  nouveau: { profile: { ...profil, name: 'Lou', level: 'beginner', days: 3 }, trialStart: T },
  expire: { profile: { ...profil, name: 'Noa' }, trialStart: '2026-01-01' },
};

async function page(b, { state, url = '#/hybride', vp = { width: 390, height: 844 }, scheme = 'light' }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify({ synced: false, plan: null, ...state }));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1600);
  return { p, ctx, errs };
}
const txt = async (p) => ((await p.textContent('#app')) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 && !e.closest('.hscroll'); }).length);
const largeur = (p) => p.evaluate(() => document.documentElement.scrollWidth);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [vp, nom] of [[{ width: 390, height: 844 }, 'iPhone 390×844'], [{ width: 360, height: 740 }, 'Android 360×740']]) for (const scheme of ['light', 'dark']) {
    console.log(`\n${nom} · ${scheme === 'light' ? 'clair' : 'sombre'}`);
    // Persona « reprise » : bloc en cours, semaine 2
    const a = await page(b, { state: PERSONAS.reprise, vp, scheme });
    let t = await txt(a.p);
    ok(/Rang/.test(t) && /Bronze/.test(t) && /XP/.test(t), 'personnage, rang et XP affichés');
    ok((await a.p.locator('#app svg[aria-label="Ton personnage"]').count()) === 1, 'personnage dessiné (SVG accessible)');
    ok(dow(T) === 6 ? /Repos prévu/.test(t) : /Programme du jour/.test(t) && /Semaine 2 sur 12/.test(t), 'programme du jour, semaine 2');
    ok(/Quêtes/.test(t) && /Cette semaine/.test(t) && /Skills/.test(t), 'quêtes : jour, semaine, bloc, skills');
    ok((await a.p.locator('#app svg[aria-label^="Radar des 7 qualités"]').count()) === 1, 'radar des 7 qualités');
    ok((await a.p.locator('[aria-label^="Frise des 12 semaines"] > div').count()) === 12, 'frise du bloc : 12 semaines');
    ok(/Partager avec Thomas/.test(t), 'essai en autonomie : partage proposé, éteint par défaut');
    const bulle1 = await a.p.textContent('#perso-bulle');
    ok(bulle1 && bulle1.length > 8, 'le personnage parle : « ' + bulle1 + ' »');
    await tap(a.p, '[data-a="hyb-tape"]');
    ok((await a.p.textContent('#perso-bulle')) !== bulle1, 'il réagit quand on le touche');
    ok((await S(a.p)).hybride.rangVu === 'bronze', 'premier passage : rang mémorisé, pas de fête');
    ok(!/\b(prêt|prête|motivé|motivée|fatigué|fatiguée)\b/i.test(t), 'aucun accord de genre présumé');
    ok(await overflow(a.p) === 0 && await largeur(a.p) <= vp.width, 'rien ne dépasse');
    if (SHOTS) await a.p.screenshot({ path: `${SHOTS}/hybride-${vp.width}-${scheme}.png`, fullPage: true });
    if (dow(T) !== 6) {
      await tap(a.p, '[data-a="hyb-go"]'); await a.p.waitForTimeout(600);
      const st = await S(a.p);
      ok(st.current && /^Hybride/.test(st.current.title) && st.current.exercises.length >= 3, 'séance du jour démarrée (' + (st.current?.exercises.length || 0) + ' exercices)');
      ok(st.plan === null, 'programme de l\'app non modifié');
      await a.p.evaluate(() => { const s = JSON.parse(localStorage.getItem('cxs.v1')); s.current = null; localStorage.setItem('cxs.v1', s && JSON.stringify(s)); });
    }
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // Personnage : personnalisation, objets verrouillés
    const c = await page(b, { state: PERSONAS.avance, url: '#/hybride-perso', vp, scheme });
    t = await txt(c.p);
    ok(/Choisis une base/.test(t) && !/Musculature/.test(t), 'aucune base imposée : on choisit d\'abord');
    await tap(c.p, '[data-a="hyb-app"][data-k="base"][data-v="b"]');
    t = await txt(c.p);
    ok(/ne dit rien de ton corps/.test(t) && /Musculature/.test(t) && /Masse grasse/.test(t), 'base choisie : musculature, masse grasse, coiffure');
    await tap(c.p, '[data-a="hyb-app"][data-k="muscle"][data-v="3"]');
    await tap(c.p, '[data-a="hyb-app"][data-k="graisse"][data-v="0"]');
    await tap(c.p, '[data-a="hyb-app"][data-k="coiffure3d"][data-v="tresse"]');
    const ap = (await S(c.p)).hybride.apparence;
    ok(ap.base === 'b' && ap.muscle === 3 && ap.graisse === 0 && ap.coiffure3d === 'tresse', 'choix gardés');
    const imgs = await c.p.$$eval('.perso3d img', l => l.map(i => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })));
    ok(imgs.length >= 3 && imgs.some(i => /b-m3-g0/.test(i.src)), 'calques du personnage réaliste affichés (' + imgs.length + ')');
    await c.p.waitForTimeout(800);
    ok((await c.p.$$eval('.perso3d img', l => l.every(i => i.complete && i.naturalWidth > 0))), 'toutes les images chargées');
    ok(await c.p.locator('[data-a="hyb-app"][data-k="tenue"][data-v="tenue-maitre"]').isDisabled(), 'tenue Maître verrouillée');
    ok(!(await c.p.locator('[data-a="hyb-app"][data-k="tenue"][data-v="tenue-argent"]').isDisabled()), 'tenue Argent débloquée disponible');
    // Teint et couleur des cheveux (nuancés dans l'app)
    ok((await c.p.locator('[data-k="teint"]').count()) === 10 && (await c.p.locator('[data-k="cheveuxTeinte"]').count()) === 8, '10 teints et 8 couleurs de cheveux proposés');
    await tap(c.p, '[data-a="hyb-app"][data-k="teint"][data-v="8"]');
    await tap(c.p, '[data-a="hyb-app"][data-k="cheveuxTeinte"][data-v="#E2C690"]');
    let ap2 = (await S(c.p)).hybride.apparence;
    ok(ap2.teint === 8 && ap2.cheveuxTeinte === '#E2C690', 'teint et couleur gardés');
    ok((await c.p.locator('#perso-apercu i[style*="multiply"]').count()) === 2, 'peau et cheveux nuancés (2 calques de couleur)');
    await c.p.fill('#hyb-c', '#336699'); await tap(c.p, 'form[data-f="hyb-couleur"] button[type="submit"]');
    ok((await S(c.p)).hybride.apparence.cheveuxTeinte === '#336699', 'couleur de cheveux libre');
    // Pose de victoire à la demande, puis retour au repos
    await tap(c.p, '[data-a="hyb-pose"]');
    ok((await c.p.$$eval('#perso-apercu img', l => l.every(i => /\/biceps\//.test(i.getAttribute('src'))))), 'pose de victoire affichée');
    await c.p.waitForTimeout(800);
    ok((await c.p.$$eval('#perso-apercu img', l => l.every(i => i.complete && i.naturalWidth > 0))), 'images de la pose de victoire chargées');
    ok((await c.p.locator('.confettis').count()) === 0, 'mouvement réduit : pas de confettis');
    await c.p.waitForTimeout(2200);
    ok((await c.p.$$eval('#perso-apercu img', l => l.every(i => !/\/biceps\//.test(i.getAttribute('src'))))), 'retour à la pose de repos');
    // Photo : lue sur le téléphone, proposition à accepter (image fictive dessinée, aucun visage réel)
    await tap(c.p, '[data-a="hyb-selfie"]');
    ok(/ni envoyée ni enregistrée/.test(await c.p.textContent('#sheet')), 'photo : promesse de confidentialité affichée avant tout');
    await c.p.setInputFiles('#sf-gal', { name: 'fictif.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SELFIE_FICTIF) });
    await c.p.waitForTimeout(700);
    ok((await c.p.locator('#sf-c').count()) === 1 && (await overflow(c.p)) === 0, 'cadrage dans l\'ovale');
    await tap(c.p, '#sf-ok');
    const prop = await c.p.textContent('#sheet');
    ok(/Proposition/.test(prop) && /déjà été effacée/.test(prop) && /Noir/.test(prop), 'proposition : teint et cheveux noirs, photo effacée');
    ok((await S(c.p)).hybride.apparence.cheveuxTeinte === '#336699', 'rien n\'est appliqué sans accord');
    await tap(c.p, '#sf-oui');
    ap2 = (await S(c.p)).hybride.apparence;
    ok(ap2.cheveuxTeinte === '#2A2622' && ap2.teint >= 6, 'proposition appliquée après accord (teint ' + ap2.teint + ')');
    ok(!JSON.stringify(await S(c.p)).includes('data:image') && !JSON.stringify(await S(c.p)).includes('blob:'), 'aucune image gardée dans les données');
    if (SHOTS) await c.p.screenshot({ path: `${SHOTS}/perso-${vp.width}-${scheme}.png`, fullPage: true });
    ok(await overflow(c.p) === 0 && await largeur(c.p) <= vp.width, 'rien ne dépasse (personnage)');
    ok(c.errs.length === 0, 'zéro erreur JavaScript (personnage)' + (c.errs.length ? ' : ' + c.errs.join(' | ') : ''));
    await c.ctx.close();
  }

  console.log('\nSéance validée aujourd\'hui : le personnage fête, une seule fois');
  {
    const st = { ...PERSONAS.reprise, workouts: [seance(T), ...PERSONAS.reprise.workouts], hybride: { ...PERSONAS.reprise.hybride, apparence: { base: 'a', teint: 3 }, rangVu: 'bronze' } };
    const f = await page(b, { state: st });
    ok((await f.p.$$eval('#perso-hyb img', l => l.length > 0 && l.every(i => /\/biceps\//.test(i.getAttribute('src'))))), 'pose de victoire le jour d\'une séance');
    ok(/Séance validée|dans la boîte|brique/.test(await f.p.textContent('#perso-bulle')), 'phrase de séance validée');
    const vu = (await S(f.p)).hybride.feteVue;
    ok(vu === 'seance:' + T, 'fête marquée comme vue');
    await f.p.reload(); await f.p.waitForTimeout(1500);
    ok((await S(f.p)).hybride.feteVue === vu && !/Séance validée/.test((await f.p.textContent('.toast, #toast').catch(() => '')) || ''), 'pas de deuxième fête au retour');
    ok(f.errs.length === 0, 'zéro erreur JavaScript (fête)' + (f.errs.length ? ' : ' + f.errs.join(' | ') : ''));
    await f.ctx.close();
  }

  console.log('\nNouveau membre : choix du bloc');
  const n = await page(b, { state: PERSONAS.nouveau });
  let t = await txt(n.p);
  ok(/Ton bloc de 12 semaines/.test(t) && (await n.p.locator('#hyb-macro option').count()) === 4, 'formulaire du bloc : 4 macrocycles');
  await n.p.selectOption('#hyb-n', '3');
  await tap(n.p, 'form[data-f="hyb-bloc"] button[type="submit"]'); await n.p.waitForTimeout(500);
  const st = await S(n.p);
  ok(st.hybride.bloc && st.hybride.bloc.nbSeances === 3 && dow(st.hybride.bloc.debut) === 0, 'bloc enregistré, début un lundi');
  ok(/commence le/.test(await txt(n.p)), 'avant le début : date annoncée');
  ok(n.errs.length === 0, 'zéro erreur JavaScript (nouveau)');
  await n.ctx.close();

  console.log('\nRemplacer un bloc en cours : accord demandé, ancien gardé en copie');
  const r = await page(b, { state: PERSONAS.avance });
  await tap(r.p, '[data-a="hyb-nouveau"]');
  await r.p.selectOption('#hyb-macro', 'M1');
  await tap(r.p, 'form[data-f="hyb-bloc"] button[type="submit"]');
  ok(/Remplacer ton bloc en cours/.test(await r.p.textContent('body')), 'confirmation affichée');
  ok((await S(r.p)).hybride.bloc.macroId === 'M2', 'rien de remplacé sans accord');
  await tap(r.p, '[data-a="hyb-ok"]');
  const s2 = await S(r.p);
  ok(s2.hybride.bloc.macroId === 'M1' && s2.hybride.anciens.length === 1 && s2.hybride.anciens[0].macroId === 'M2', 'remplacé après accord, ancien bloc copié');
  ok(r.errs.length === 0, 'zéro erreur JavaScript (remplacement)');
  await r.ctx.close();

  console.log('\nÉtat corrompu et données indisponibles');
  for (const bloc of [{ macroId: 'ZZ', debut: T, nbSeances: 3 }, { macroId: 'M1', debut: 'abc', nbSeances: 3 }, { macroId: 'M1', debut: T, nbSeances: 9 }, 'texte']) {
    const k = await page(b, { state: { ...PERSONAS.nouveau, hybride: { bloc } } });
    const st = await S(k.p);
    ok(/Ton bloc de 12 semaines/.test(await txt(k.p)) && st.hybride.anciens?.length === 1 && st.hybride.bloc === null, 'bloc illisible ' + JSON.stringify(bloc) + ' : archivé, formulaire proposé');
    ok(k.errs.length === 0, 'zéro erreur JavaScript (bloc illisible)' + (k.errs.length ? ' : ' + k.errs.join(' | ') : ''));
    await k.ctx.close();
  }
  const z = await page(b, { state: { ...PERSONAS.reprise, hybride: 'texte' }, url: '#/hybride-perso' });
  await tap(z.p, '[data-a="hyb-app"][data-k="base"][data-v="a"]');
  ok((await S(z.p)).hybride.apparence.base === 'a' && z.errs.length === 0, 'état hybride corrompu : réparé à la première action, sans erreur');
  await z.ctx.close();
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); let n = 0;
    await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
    await p.route('**/data/hybride.json', r => { n++; r.fulfill({ status: 404, body: '' }); });
    await p.addInitScript((s) => localStorage.setItem('cxs.v1', s), JSON.stringify({ synced: false, plan: null, ...PERSONAS.reprise }));
    await p.goto(BASE + 'index.html#/hybride'); await p.waitForTimeout(2500);
    ok(n <= 2 && /Données indisponibles/.test(await p.textContent('#app')) && (await p.locator('[data-a="hyb-reessayer"]').count()) === 1, 'données en 404 : ' + n + ' requête(s), message et bouton « Réessayer »');
    await ctx.close();
  }

  console.log('\nEssai terminé sans abonnement');
  const x = await page(b, { state: PERSONAS.expire });
  const tx = await txt(x.p);
  ok(!/Programme du jour|Ton bloc de 12 semaines/.test(tx), 'accès fermé : aucun contenu du module (l\'app renvoie vers les offres, comme ailleurs)');
  ok(x.errs.length === 0, 'zéro erreur JavaScript (accès fermé)');
  await x.ctx.close();

  console.log('\nAccueil : carte d\'accès');
  const h = await page(b, { state: PERSONAS.reprise, url: '#/home' });
  ok(/Athlète hybride/.test(await txt(h.p)), 'carte « Athlète hybride » sur l\'accueil');
  ok(h.errs.length === 0, 'zéro erreur JavaScript (accueil)');
  await h.ctx.close();

  await b.close();
  console.log(`\n${passed} réussis, ${fails} échoués`);
  process.exit(fails ? 1 : 0);
})();
