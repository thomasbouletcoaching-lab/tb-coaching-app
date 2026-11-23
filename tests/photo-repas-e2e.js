// Photo du repas : bouton photo / galerie, accord avant le premier téléchargement, suggestions, quantité, zones.
// Le moteur de vision est remplacé par un faux module (aucun téléchargement) qui renvoie le vecteur d'un plat connu.
// iPhone 390×844 et Android 360×740 ; Supabase simulé, données fictives.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/photo-repas-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const SB_NONE = `const chain = () => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res({ data: null, error: null }) : chain(), apply: () => chain() });
export function createClient() { return { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) }, from: () => chain(), rpc: () => chain(), channel: () => chain(), removeChannel() {}, functions: { invoke: async () => ({ data: null, error: null }) }, storage: { from: () => chain() } }; }`;
// Faux transformers.js : mêmes fonctions que celles utilisées par js/photo-repas.js
const TF_FAKE = `export const env = {};
export class RawImage { constructor() { this.width = 800; this.height = 600; } static async fromBlob(b) { window.__blobs = (window.__blobs || 0) + 1; return new RawImage(); } async resize() { return this; } async crop() { return this; } }
export const AutoProcessor = { from_pretrained: async () => async () => ({}) };
export const SiglipVisionModel = { from_pretrained: async (m, o) => { o.progress_callback?.({ status: 'progress', file: 'vision_model.onnx', loaded: 5, total: 10 }); return async () => { window.__calls = (window.__calls || 0) + 1; return { pooler_output: { data: window.__vec } }; }; } };`;
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date()), ago = (n) => iso(new Date(Date.now() - n * 864e5));
const state = (tier, trial) => ({
  profile: { name: 'Camille', email: 'camille@exemple.invalid', level: 'comeback', goal: 'fat', weight: 68, sex: 'f', age: 34, height: 166, activity: 'low', days: 3, startProgram: 'tb-rep3', records: {}, createdAt: trial, diet: 'all', sessionMin: 60 },
  trialStart: trial, me: { tier }, synced: false, plan: { programId: 'tb-rep3', startedAt: trial, week: 1, idx: 0, cycle: 1 }, workouts: [], food: {}, daily: {}, lifts: {}, settings: {},
});

async function page(b, { st, vp }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [], sent = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|WebSocket/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => { p.__dialogs = (p.__dialogs || 0) + 1; d.accept(); });
  p.on('request', r => { const d = r.postDataBuffer(); if (d && d.length) sent.push(r.url()); });
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: /transformers/.test(r.request().url()) ? TF_FAKE : SB_NONE, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((x) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', x); }, JSON.stringify(st));
  await p.goto(BASE + 'index.html#/food', { waitUntil: 'load' }); await p.waitForTimeout(1300);
  return { p, ctx, errs, sent };
}
const txt = async (p, sel = '#app') => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const S = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(450); };
const vecOf = (p, id) => p.evaluate(async (id) => { const PR = await import('./js/photo-repas.js'); const T = await PR.loadTable(); window.__vec = T.vecs[T.plats.findIndex(x => x.id === id)]; }, id);
const PHOTO = { name: 'repas.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]) };
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#sheet *')].filter(e => { const x = e.getBoundingClientRect(); return x.width > 0 && x.right > document.documentElement.clientWidth + 1; }).length);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [vp, nom] of [[{ width: 390, height: 844 }, 'iPhone 390×844'], [{ width: 360, height: 740 }, 'Android 360×740']]) {
    console.log('\n' + nom);
    const a = await page(b, { st: state('premium', ago(3)), vp });
    await tap(a.p, '[data-a="add-food"]');
    const inputs = a.p.locator('#sheet input[type="file"][data-c="pr-photo"]');
    ok(await inputs.count() === 2, 'deux entrées : appareil photo et galerie');
    ok(await inputs.first().getAttribute('capture') === 'environment' && !(await inputs.nth(1).getAttribute('capture')), 'la première ouvre l\'appareil photo, la seconde la galerie');
    await vecOf(a.p, 'pizza');
    await inputs.first().setInputFiles(PHOTO); await a.p.waitForTimeout(900);
    ok((a.p.__dialogs || 0) === 1, 'accord demandé avant le premier téléchargement du moteur');
    const chips = a.p.locator('#prbox [data-a="pr-pick"]');
    ok(await chips.count() >= 3 && /Pizza/.test(await chips.first().textContent()), 'suggestions affichées, la plus probable en premier (Pizza)');
    ok(/ni envoyée ni enregistrée|n'est ni envoyée|Les suggestions viennent de l'image/.test(await txt(a.p, '#sheet')), 'message clair sur la photo et la vérification');
    ok(await a.p.evaluate(() => localStorage.getItem('tb-pr-ok')) === '1', 'moteur noté comme téléchargé');
    ok(a.sent.length === 0, 'aucune requête n\'envoie de données (la photo reste sur le téléphone)' + (a.sent.length ? ' : ' + a.sent.join(', ') : ''));
    await chips.first().click(); await a.p.waitForTimeout(1500);
    ok(await a.p.inputValue('#fq') === 'pizza', 'toucher un plat lance la recherche dans la base');
    const li = a.p.locator('#sheet [data-a="pick-food"]', { hasText: /^Pizza/ }).first();
    ok(await li.count() === 1, 'des pizzas de la base apparaissent');
    if (await li.count()) {
      await li.click(); await a.p.waitForTimeout(400);
      ok(/part/.test(await txt(a.p, '#sheet .qty-pick')), 'quantité sans peser : « part » de pizza');
      await a.p.click('#sheet .qty-pick [data-u="0"]'); await a.p.click('#sheet .qty-pick [data-step="1"]'); await a.p.waitForTimeout(200);
      await a.p.click('#sheet .qty-pick [data-ok]'); await a.p.waitForTimeout(500);
      const e = ((await S(a.p)).food[T] || []).find(x => /^Pizza/.test(x.label));
      ok(e && e.g === 160 && /2 parts/.test(e.u || ''), 'ajouté au journal : 2 parts = 160 g' + (e ? ` (${e.g} g, ${e.u})` : ''));
      ok(await a.p.locator('#prbox [data-a="pr-pick"]').count() >= 3, 'les suggestions restent pour ajouter le plat suivant');
    }
    const calls0 = await a.p.evaluate(() => window.__calls || 0);
    await tap(a.p, '#prbox [data-a="pr-zones"]'); await a.p.waitForTimeout(600);
    ok(await a.p.evaluate(() => window.__calls || 0) - calls0 === 6, 'zone par zone : image entière + 5 zones analysées');
    ok(/zone par zone/.test(await txt(a.p, '#prbox')) && await a.p.locator('#prbox [data-a="pr-zones"]').count() === 0, 'résultat zone par zone, photo oubliée ensuite');
    await vecOf(a.p, 'nem');
    await inputs.nth(1).setInputFiles(PHOTO); await a.p.waitForTimeout(700);
    ok((a.p.__dialogs || 0) === 1, 'pas de nouvelle demande une fois le moteur téléchargé');
    ok(/Nems/.test(await a.p.locator('#prbox [data-a="pr-pick"]').first().textContent()), 'photo de la galerie : Nems en premier');
    await tap(a.p, '#prbox [data-a="pr-clear"]');
    ok(await a.p.locator('#prbox .card').count() === 0, 'suggestions fermées');
    ok(await overflow(a.p) === 0, 'rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

  }
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`);
  process.exit(fails ? 1 : 0);
})();
