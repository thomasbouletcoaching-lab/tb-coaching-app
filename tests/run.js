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
    await p.waitForTimeout(800); await p.click('[data-act="nav44"][data-v="objectifs"]'); await p.waitForTimeout(300);
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

  'client : bilan express du week-end': () => run('client', async (p, sc) => {
    await p.waitForTimeout(1500); ok(!!(await p.$('#qb-card')), 'carte bilan sur l\'Accueil le samedi');
    for (const k of ['en', 'so', 'st', 'fa', 'mo']) { await p.click(`[data-act="qb-set"][data-v$=".${k}.4"]`); await p.waitForTimeout(80); }
    await p.click('[data-act="qb-send"]'); await p.waitForTimeout(500);
    ok(sc.sv && sc.sv.data && sc.sv.data.q5 && sc.sv.data.sent, 'bilan envoyé avec les 5 réponses');
  }, sc => { clientPre(sc2 => (m, path, b, a, t) => { if (t === 'suivi' && m === 'POST') { sc2.sv = b; return []; } })(sc); sc.clock = '2026-10-17T10:00:00'; }),

  'client : premier lancement allégé + 5 onglets': () => run('client', async (p) => {
    await p.waitForTimeout(1200); const n = await p.$$eval('#app .card h3', a => a.length); ok(n === 5, 'questionnaire essentiel (5 sections)');
    await p.evaluate(() => Object.assign(X10.obDraft, { obj: 'Gagner en force', q1: 'Non', q2: 'Non', q3: 'Non', q4: 'Non', q5: 'Non', q6: 'Non', q7: 'Non' }));
    await p.click('[data-act="x10-obsend"]'); await p.waitForTimeout(800);
    ok((await txt(p, '#app')).includes('Complète ton profil'), 'proposition de compléter le profil');
    ok((await txt(p, '#tabs')) === 'Accueil Semaine Carnet Suivi Compte' || (await txt(p, '#tabs')).replace(/ /g, '') === 'AccueilSemaineCarnetSuiviCompte', '5 onglets');
  }, sc => { sc.user.user_metadata.rgpd_ok = '2026-10-01'; sc.user.user_metadata.pw_set = 'x'; getDb().onboarding = []; }),

  'client : message écrit hors ligne': () => run('client', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(() => msgOpen()); await p.waitForTimeout(300);
    await p.context().setOffline(true); await p.fill('#msg-txt', 'Hors ligne'); await p.click('[data-act="msg-send"]'); await p.waitForTimeout(300);
    ok(!!(await p.$('.mpend')), 'message marqué en attente');
    await p.context().setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(2500);
    ok(sc.sent && sc.sent.body === 'Hors ligne', 'message envoyé au retour du réseau');
  }, clientPre(sc => (m, path, b, a, t) => { if (t === 'messages' && m === 'POST') { sc.sent = b; return []; } })),

  'coach : activation et revue de la semaine': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1200); ok((await txt(p, '#app')).includes('Activation 3/5'), 'activation dans À traiter');
    await p.click('[data-act="act-open"]'); await p.waitForTimeout(1200);
    ok(!!(await p.$('#act-card')), 'fiche d\'activation'); ok(!!(await p.$('#rv-card')), 'revue de la semaine'); ok(!!(await p.$('#onb-card')), 'mise en route');
  }, coachPre(sc => (m, path) => { if (/rpc\/client_activation/.test(path)) return [{ client_id: sc.CID, has_account: true, new_app: true, pw_set: false, devices: 0, onboarding: true, cgv: false }]; if (/rpc\/client_app_status/.test(path)) return []; })),

  'client : réorganiser une séance (glisser-déposer)': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'carnet'; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(300);
    const names = async () => p.$$eval('#app .cx .linkbtn[data-act="cx-hist"]', a => a.map(x => x.textContent));
    const before = await names(); await p.click('[data-act="ro-ses"]'); await p.waitForTimeout(300);
    ok(await p.$$eval('#ro-l .ro-it', a => a.length) === before.length, 'liste compacte avec tous les exercices');
    const h = await p.locator('#ro-l [data-rodrag]').nth(0).boundingBox(), t = await p.locator('#ro-l .ro-it').nth(2).boundingBox();
    await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
    for (let i = 1; i <= 12; i++) { await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + (t.y + t.height * 0.8 - h.y - h.height / 2) * i / 12); await p.waitForTimeout(15); }
    await p.mouse.up(); await p.click('[data-act="ro-save"]'); await p.waitForTimeout(600); const after = await names();
    ok(after[2] === before[0] && after[0] === before[1], 'nouvel ordre affiché dans le carnet');
    ok((sc.w || []).some(k => /^1_o_0$/.test(k)) && (sc.w || []).some(k => /^2_o_0$/.test(k)), 'ordre enregistré pour cette semaine et les suivantes');
  }, clientPre(sc => (m, path, b, a, t) => { if (t === 'carnet' && m === 'POST') { (sc.w = sc.w || []).push(b.k); return []; } })),

  'coach : réorganiser le programme (historique déplacé avec l\'exercice)': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(800);
    await p.evaluate(() => { ST.carnet['1_0_0'] = { sets: [{ g: 60, h: 8, d: 1 }] }; ST.view = 'programme'; render(); }); await p.waitForTimeout(300);
    const first = await p.evaluate(() => M.sessions[0].rows.filter(r => r.ex)[0].ex);
    await p.click('[data-act="ro-prog"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { const l = document.getElementById('ro-l'); l.appendChild(l.firstElementChild); }); await p.click('[data-act="ro-save"]'); await p.waitForTimeout(1200);
    const r = await p.evaluate(n => { const rows = M.sessions[0].rows.filter(r => r.ex); const last = rows[rows.length - 1]; return { last: last.ex, key: '1_' + last.key, has: !!ST.carnet['1_' + last.key], old: !!ST.carnet['1_0_0'] }; }, first);
    ok(r.last === first, 'exercice déplacé en dernier'); ok(r.has && !r.old, 'séries notées déplacées avec lui');
    ok((sc.w || []).some(x => x === 'DELETE') && (sc.w || []).some(x => x === r.key), 'carnet mis à jour en base');
  }, coachPre(sc => (m, path, b, a, t) => { if (t === 'carnet' && m === 'DELETE') { (sc.w = sc.w || []).push('DELETE'); return []; } if (t === 'carnet' && m === 'POST') { (sc.w = sc.w || []).push(b.k); return []; } })),

  'client : programme perso (créer, choisir les exercices, noter)': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); ok(!!(await p.$('#pp-today')), 'carte « Mon programme perso » sur l\'Accueil');
    await p.click('#pp-today [data-act="pp-go"]'); await p.waitForTimeout(300); ok((await txt(p, '#app h2')).includes('Mon programme perso'), 'écran programme perso');
    await p.click('[data-act="pp-new"]'); await p.waitForTimeout(300); await p.fill('#pp-q', 'belt'); await p.waitForTimeout(100);
    await p.locator('[data-act="pp-add"]').first().click(); await p.waitForTimeout(200);
    await p.click('[data-act="pp-pick"]'); await p.fill('[data-pps="name"]', 'Jambes'); await p.locator('[data-pps="name"]').blur();
    await p.fill('[data-ppe="0.s"]', '4'); await p.locator('[data-ppe="0.s"]').blur(); await p.waitForTimeout(100);
    await p.click('[data-act="pp-list"]'); await p.waitForTimeout(400);
    const pp = sc.pp || {}; ok(pp.ses && pp.ses[0].name === 'Jambes' && pp.ses[0].ex[0].n === 'Belt squat' && pp.ses[0].ex[0].s === 4, 'séance enregistrée (nom, exercice, séries)');
    await p.click('[data-act="pp-run"]'); await p.waitForTimeout(300); ok(await p.$$eval('[data-act="pp-done"]', a => a.length) === 4, '4 séries proposées');
    await p.fill('[data-ppl="0.0.g"]', '100'); await p.locator('[data-ppl="0.0.g"]').blur(); await p.click('[data-act="pp-done"][data-v="0.0"]'); await p.waitForTimeout(200);
    await p.click('[data-act="rt-x"]').catch(() => {}); await p.click('[data-act="pp-end"]'); await p.waitForTimeout(400);
    const lg = sc.log || {}; ok(lg.end && lg.ex[0].sets[0].g === 100 && lg.ex[0].sets[0].d === 1, 'séance notée et terminée');
    ok((await txt(p, '#app')).includes('Historique'), 'historique affiché');
  }, clientPre(sc => (m, path, b, a, t) => { if (t === 'carnet' && m === 'POST') { if (b.k === 'pp') sc.pp = b.data; if (/^pl-/.test(b.k)) sc.log = b.data; return []; } })),

  'client : heure de séance enregistrée à la fermeture de la roue': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'semaine'; CAL.open = true; render(); }); await p.waitForTimeout(300);
    const day = await p.evaluate(() => { const b = document.querySelector('.calc.has'); return b && b.dataset.v; }); await p.click(`[data-act="cal-day"][data-v="${day}"]`); await p.waitForTimeout(300);
    const inp = p.locator('[data-ctime]').first(); await inp.focus();
    await p.evaluate(() => { const el = document.querySelector('[data-ctime]'); el.value = '18:00'; el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
    ok(!sc.t && await p.evaluate(() => document.activeElement && document.activeElement.dataset.ctime !== undefined), 'pas d\'enregistrement ni de fermeture pendant le réglage');
    await p.evaluate(() => { const el = document.querySelector('[data-ctime]'); el.value = '18:30'; el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); }); await p.waitForTimeout(500);
    ok(sc.t && sc.t.data && sc.t.data.h === '18:30', 'heure enregistrée en refermant');
  }, clientPre(sc => (m, path, b, a, t) => { if (t === 'carnet' && m === 'POST') { if (/_d_/.test(b.k)) sc.t = b; return []; } })),

  'messagerie : zone de saisie pleine largeur, rien derrière': () => run('client', async (p) => {
    await p.waitForTimeout(800); await p.evaluate(() => msgOpen()); await p.waitForTimeout(400);
    const long = 'Belle semaine, bravo pour la régularité ! On garde ce cap pour la suite et on ajuste la charge au squat la semaine prochaine. Pense à bien dormir.';
    await p.fill('#msg-txt', long); await p.locator('#msg-txt').dispatchEvent('input'); await p.waitForTimeout(100);
    const r = await p.evaluate(() => { const t = document.getElementById('msg-txt'); return { w: t.getBoundingClientRect().width, full: t.scrollHeight <= t.clientHeight + 2, app: getComputedStyle(document.getElementById('app')).visibility }; });
    ok(r.w > 330, 'texte sur toute la largeur'); ok(r.full, 'message entièrement visible'); ok(r.app === 'hidden', 'tableau de bord masqué derrière la messagerie');
  }, clientPre()),

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
