// Tests de bout en bout de l'app (Supabase simulé, données fictives uniquement).
// Lancement : servir le dossier racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/run.js`.
const { run, BASE, EXE, getDb } = require('./harness');
const { chromium } = require('playwright');
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');
const clientPre = (extra) => sc => { sc.user.user_metadata.rgpd_ok = '2026-10-01'; sc.user.user_metadata.pw_set = 'x';
  getDb().onboarding = [{ client_id: sc.CID, data: { diet: 'Omnivore' }, submitted_at: '2026-10-01T10:00:00Z' }]; if (extra) sc.extra = extra(sc); };
const coachPre = (extra) => sc => { sc.user.user_metadata.rgpd_ok = '2026-10-01'; if (extra) sc.extra = extra(sc); };
const CAR = [{ k: '1_0_0', data: { sets: [{ g: 60, h: 8, r: 8, d: 1 }] } }, { k: '2_0_0', data: { sets: [{ g: 65, h: 6, r: 8, d: 1 }] } }];
const DISHES = [{ id: 'd1', name: 'Bowl poulet avocat', cat: 'Repas', items: [{ f: 'fp', q: 120 }, { f: 'fr', q: 150 }, { f: 'fa', q: 50 }] }];

const T = {
  'client : accueil, calendrier, déplacement de séance': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    ok((await txt(p, '#tabs')).startsWith('Accueil'), 'onglet Accueil en premier');
    ok((await txt(p, '#app h2')).startsWith('Bonjour'), 'vue Accueil affichée');
    await p.click('nav.tabs [data-v="semaine"]'); await p.waitForTimeout(300);
    ok(!!(await p.$('#cal-card')), 'calendrier présent dans Semaine');
    await p.locator('[data-act="mv-open"]').first().click(); await p.locator('[data-act="mv-set"]').nth(6).click(); await p.waitForTimeout(400);
    ok(/_d_/.test((sc.lastWrite || {}).k || ''), 'déplacement enregistré dans le carnet');
    ok((await p.$$eval('.card.ses h3', a => a.map(x => x.textContent))).pop().includes('Dimanche'), 'séance déplacée affichée le dimanche');
  }, clientPre(sc => (m, path, body, acc, t) => { if (t === 'carnet' && m === 'POST') { sc.lastWrite = body; return []; } })),

  'client : records': () => run('client', async (p) => {
    await p.waitForTimeout(800); await p.click('nav.tabs [data-v="objectifs"]'); await p.waitForTimeout(300);
    ok((await txt(p, '#rec-card')).includes('65 kg × 6'), 'charge max affichée');
    ok(await p.evaluate(async () => { ST.carnet['2_0_0'].sets.push({ g: 70, h: 5, r: 8.5, d: 1 }); await saveCarnet('2_0_0'); return document.body.textContent.includes('Nouveau record'); }), 'toast nouveau record');
  }, clientPre(() => (m, path, b, a, t) => { if (t === 'carnet' && m === 'GET' && /client_id=eq/.test(path)) return CAR; if (t === 'carnet') return []; })),

  'client : rappels réglables': () => run('client', async (p, sc) => {
    await p.waitForTimeout(1500); ok(!!(sc.pp && sc.pp.plan && sc.pp.plan.ses.length), 'calendrier des rappels synchronisé');
    await p.click('nav.tabs [data-v="compte"]'); await p.waitForTimeout(300);
    await p.check('[data-rm="meals.on"]'); await p.fill('[data-rm="meals.h"]', '20:40'); await p.click('[data-act="rm-save"]'); await p.waitForTimeout(400);
    ok(sc.pp.data && sc.pp.data.meals.on && sc.pp.data.meals.h === '20:45', 'préférences enregistrées (arrondi au quart d\'heure)');
  }, clientPre(sc => (m, path, body, acc, t, one) => { if (t === 'push_prefs') { if (m === 'POST') { sc.pp = Object.assign(sc.pp || {}, body); return []; } return one ? null : []; } })),

  'client : plat équivalent': () => run('client', async (p) => {
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'nutrition'; NU.nv = 'jour'; NU.day = todayISO(); render(); }); await p.waitForTimeout(400);
    await p.locator('[data-act="eq-open"][data-v="1"]').click(); await p.waitForTimeout(600);
    await p.locator('[data-act="eq-use"]').first().click(); await p.waitForTimeout(300);
    ok(await p.evaluate(() => /équivalent/.test((NU.logs[todayISO()].m[1] || {}).n || '')), 'repas remplacé enregistré');
  }, clientPre(() => (m, path, b, a, t) => { if (t === 'nutri_dishes' && m === 'GET') return DISHES; })),

  'client : acceptation des CGV': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(() => { CGV.on = true; render(); }); await p.waitForTimeout(300);
    ok((await txt(p, '#app h2')) === 'Conditions générales', 'écran CGV bloquant');
    await p.click('[data-act="cg-ok"]'); ok((await txt(p, '#app h2')) === 'Conditions générales', 'refus sans case cochée');
    await p.check('#cg-ck'); await p.click('[data-act="cg-ok"]'); await p.waitForTimeout(400);
    ok(sc.cg && sc.cg.version, 'acceptation datée enregistrée'); ok((await txt(p, '#app h2')).startsWith('Bonjour'), 'accès à l\'app après acceptation');
  }, clientPre(sc => (m, path, body, acc, t, one) => { if (t === 'cgv_accept') { if (m === 'POST') { sc.cg = body; const r = Object.assign({ accepted_at: new Date().toISOString() }, body); return one ? r : [r]; } return []; } })),

  'coach : notes privées, réponses types, message à plusieurs, candidatures': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000);
    ok((await txt(p, '#ld-card summary')).includes('1 nouvelle'), 'candidature affichée');
    await p.click('#bc-card summary'); await p.fill('#bc-txt', 'Salut {prenom} !'); await p.click('[data-act="bc-send"]'); await p.waitForTimeout(500);
    ok(Array.isArray(sc.bc) && sc.bc.length === 2 && sc.bc[1].body === 'Salut Paul !', 'message à plusieurs personnalisé');
    await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(800);
    await p.evaluate(() => { ST.view = 'tableau'; render(); }); await p.waitForTimeout(400);
    await p.click('#cn-card summary'); await p.fill('#cn-new', 'Note de test'); await p.click('[data-act="cn-add"]'); await p.waitForTimeout(400);
    ok((await txt(p, '#cn-card')).includes('Note de test'), 'note privée ajoutée');
    await p.evaluate(() => msgOpen()); await p.waitForTimeout(400); await p.click('[data-act="rt-tog"]'); await p.click('[data-act="rt-use"][data-v="0"]');
    ok((await p.inputValue('#msg-txt')).includes('Merci Client'), 'réponse type insérée avec le prénom');
  }, coachPre(sc => (m, path, body, acc, t, one) => {
    if (t === 'clients' && m === 'GET' && !one) return [{ id: sc.CID, coach_id: sc.uid, name: 'Client Fictif', email: 'client@exemple.fr', archived: false, program: {}, nutrition: {} }, { id: '22222222-2222-2222-2222-222222222222', coach_id: sc.uid, name: 'Paul Exemple', archived: false, program: {}, nutrition: {} }];
    if (t === 'messages' && m === 'POST' && !one) { sc.bc = sc.lastBody; return []; }
    if (t === 'leads' && m === 'GET') return [{ id: 'l1', name: 'Marc Exemple', email: 'marc@exemple.fr', created_at: new Date().toISOString(), status: 'nouveau', data: { goal: 'Gagner en force' } }];
    if (t === 'coach_notes') { if (m === 'POST') { const r = Object.assign({ id: 'n1', pinned: false, created_at: new Date().toISOString() }, body); return one ? r : [r]; } return []; } })),

  'page publique : candidature': async () => {
    const b = await chromium.launch({ executablePath: EXE }); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); let posted = null; const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('https://*.supabase.co/**', async r => { posted = r.request().postDataJSON(); await r.fulfill({ status: 201, body: '', headers: { 'access-control-allow-origin': '*' } }); });
    await p.goto(BASE + 'coaching.html'); await p.click('#go'); ok(posted === null, 'formulaire vide refusé');
    await p.fill('[name=name]', 'Marc Exemple'); await p.fill('[name=email]', 'marc@exemple.fr'); await p.selectOption('[name=goal]', 'Gagner en force');
    await p.fill('[name=practice]', 'Muscu 3x/sem'); await p.check('[name=consent]'); await p.click('#go'); await p.waitForTimeout(400);
    ok(posted && posted.consent === true && posted.email === 'marc@exemple.fr', 'candidature envoyée'); ok(!errs.length, 'aucune erreur JavaScript'); await b.close(); },
};

(async () => {
  for (const [name, fn] of Object.entries(T)) { console.log('▶', name); try { await fn(); } catch (e) { fails++; console.log('  ✗', e.message.split('\n')[0]); } }
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`); process.exit(fails ? 1 : 0);
})();
