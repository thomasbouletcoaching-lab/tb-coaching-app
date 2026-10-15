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
    ok((await txt(p, '#app h2')).startsWith('Séance du jour'), 'Semaine › Aujourd\'hui montre la séance du jour (pas l\'Accueil)');
    await p.click('[data-act="sv73"][data-v="sem"]'); await p.waitForTimeout(300);
    ok((await p.$$('.wk77d')).length === 7, 'Semaine : les 7 jours séparés');
    ok(!!(await p.$('#pl73')), 'planning de la semaine présent dans Semaine');
    await p.click('[data-act="sv73"][data-v="mois"]'); await p.waitForTimeout(300);
    ok(!!(await p.$('#cal-card')), 'calendrier présent dans Mois');
    await p.click('[data-act="sv73"][data-v="sem"]'); await p.waitForTimeout(300);
    const hd = p.locator('.wk77s .pl73h').first(); await hd.scrollIntoViewIfNeeded(); const b1 = await hd.boundingBox();
    const sun = p.locator('.wk77d').nth(1); await sun.scrollIntoViewIfNeeded(); const b1b = await hd.boundingBox(), b2 = await sun.boundingBox();
    await p.mouse.move(b1b.x + 8, b1b.y + 10); await p.mouse.down(); await p.mouse.move(b2.x + 100, b2.y + b2.height / 2, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(400);
    ok(/_d_/.test((sc.lastWrite || {}).k || ''), 'déplacement enregistré dans le carnet');
    ok((await p.locator('.wk77d').nth(1).locator('.wk77s').count()) === 1, 'séance déplacée affichée le mardi');
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

  'client : vidéos (enregistrer, suppression à 30 jours)': () => run('client', async (p) => {
    await p.waitForTimeout(1000); await p.evaluate(() => msgOpen()); await p.waitForTimeout(800);
    const t = await txt(p, '#mp-l');
    ok(t.includes('Enregistrer') && t.includes('supprimée le'), 'vidéo récente : bouton Enregistrer et date de suppression');
    ok(t.includes('Vidéo supprimée automatiquement après 30 jours'), 'vidéo expirée : message à la place de la vidéo');
    ok((await txt(p, '.mp-c')).includes('supprimées après 30 jours'), 'information sous la zone d\'envoi');
  }, clientPre(sc => (m, path, b, a, t) => {
    if (path.startsWith('/storage/v1/object/sign/media')) return (b && b.paths || []).map(x => /vieille/.test(x) ? { path: x, error: 'Object not found', signedURL: null } : { path: x, signedURL: '/object/sign/media/' + x + '?token=t' });
    if (t === 'messages' && m === 'GET') return [
      { id: 'v1', client_id: sc.CID, sender: 'coach', from_coach: true, body: '', media: [{ path: sc.CID + '/recente.mp4', type: 'video' }], created_at: new Date().toISOString() },
      { id: 'v2', client_id: sc.CID, sender: 'coach', from_coach: true, body: '', media: [{ path: sc.CID + '/vieille.mp4', type: 'video' }], created_at: '2026-08-01T10:00:00Z' } ];
  })),

  'coach : activation et revue de la semaine': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1200); ok((await txt(p, '#app')).includes('Activation 3/5'), 'activation dans À traiter');
    await p.click('[data-act="act-open"]'); await p.waitForTimeout(1200);
    ok(!!(await p.$('#act-card')), 'fiche d\'activation'); ok(!!(await p.$('#rv-card')), 'revue de la semaine'); ok(!!(await p.$('#onb-card')), 'mise en route');
  }, coachPre(sc => (m, path) => { if (/rpc\/client_activation/.test(path)) return [{ client_id: sc.CID, has_account: true, new_app: true, pw_set: false, devices: 0, onboarding: true, cgv: false }]; if (/rpc\/client_app_status/.test(path)) return []; })),

  'client : réorganiser une séance (glisser-déposer)': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'carnet'; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(300);
    const names = async () => p.$$eval('#app .cx .linkbtn[data-act="cx-hist"]', a => a.map(x => x.textContent));
    const before = await names(); const ses = (await p.getAttribute('[data-act="ro-ses"]', 'data-v')).split('.')[1]; await p.click('[data-act="ro-ses"]'); await p.waitForTimeout(300);
    ok(await p.$$eval('#ro-l .ro-it', a => a.length) === before.length, 'liste compacte avec tous les exercices');
    const h = await p.locator('#ro-l [data-rodrag]').nth(0).boundingBox(), t = await p.locator('#ro-l .ro-it').nth(2).boundingBox();
    await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
    for (let i = 1; i <= 12; i++) { await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + (t.y + t.height * 0.8 - h.y - h.height / 2) * i / 12); await p.waitForTimeout(15); }
    await p.mouse.up(); await p.click('[data-act="ro-save"]'); await p.waitForTimeout(600); const after = await names();
    ok(after[2] === before[0] && after[0] === before[1], 'nouvel ordre affiché dans le carnet');
    ok((sc.w || []).includes('1_o_' + ses) && (sc.w || []).includes('2_o_' + ses), 'ordre enregistré pour cette semaine et les suivantes');
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
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'semaine'; ST.sv73 = 'mois'; CAL.open = true; render(); }); await p.waitForTimeout(300);
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

  'coach : méthode TB — programme par profil, règles, modèle alimentaire': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(1200);
    const chk = await p.evaluate(() => { const L = BANK.filter(b => b.tb); const miss = [], bad = [];
      L.forEach(b => { applyBank(b.id); recompute(); b.s.forEach(s => s[2].forEach(e => { if (!BASEMAP[e.name]) miss.push(e.name); }));
        M.rows.forEach(r => { for (let w = 1; w <= 12; w++) { const k = r.weeks[w]; if (r.ex && k && k.eff && k.valid === false) bad.push(b.id + ' ' + r.ex + ' S' + w); } }); });
      return { n: L.length, miss, bad, first: BANK[0].cat }; });
    ok(chk.n === 6 && chk.first === 'Méthode TB', '6 programmes Méthode TB en tête de la banque');
    ok(!chk.miss.length, 'tous les exercices existent dans la bibliothèque' + (chk.miss.length ? ' : ' + chk.miss.join(', ') : ''));
    ok(!chk.bad.length, 'toutes les prescriptions des 12 semaines sont valides' + (chk.bad.length ? ' : ' + chk.bad.slice(0, 3).join(', ') : ''));
    const tp = await p.evaluate(() => [trainProposal({ years: "Moins d'1 an", n_ses: '3', obj: 'Améliorer ma composition corporelle' }).bank.id, trainProposal({ years: 'Plus de 5 ans', n_ses: '4', obj: 'Gagner en force' }).bank.id]);
    ok(tp[0] === 'tb-rep3' && tp[1] === 'tb-pb4', 'le questionnaire propose le programme de la méthode adapté');
    await p.evaluate(() => { applyBank('tb-rep3'); ST.view = 'programme'; render(); }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => ST.prog.method && ST.prog.method.id === 'tb-rep3' && !!document.getElementById('mc66')), 'règles de la méthode affichées dans Programme');
    await p.evaluate(() => { ST.view = 'nutrition'; NU.nv = 'plan'; render(); }); await p.waitForTimeout(1200);
    ok(!!(await p.$('#nm66 [data-act="nm66-apply"][data-v="ventre"]')), 'modèles alimentaires par profil proposés');
    ok(await p.evaluate(() => /Recommandé/.test(document.getElementById('nm66').textContent)), 'un modèle recommandé selon le questionnaire');
    await p.click('#nm66 summary'); await p.click('[data-act="nm66-apply"][data-v="ventre"]'); await p.waitForTimeout(1200);
    const pl = await p.evaluate(() => ({ m: NU.plan.model && NU.plan.model.id, pk: NU.plan.prof.pk, adj: NU.plan.prof.adj, k: NU.plan.tgt.k, c: (NU.plan.cardio || []).length, st: NU.plan.steps }));
    ok(pl.m === 'ventre' && pl.pk === 2 && pl.adj === -20 && pl.k > 1500, 'plan créé et individualisé (' + pl.k + ' kcal)');
    ok(pl.c >= 1 && pl.st === 8000, 'cardio et objectif de pas du programme ajoutés au plan');
  }, coachPre(sc => { getDb().onboarding = [{ client_id: sc.CID, data: { diet: 'Omnivore', sex: 'Homme', age: '41', height: '178', weight: '92', nobj: 'Perdre du gras', activity: 'Plutôt assis' }, submitted_at: '2026-10-01T10:00:00Z' }];
    return (m, path, b, a, t) => { if (t === 'nutri_dishes' && m === 'GET') return [...DISHES, { id: 'd2', name: 'Riz au lait', cat: 'Petit-déjeuner', items: [{ f: 'fr', q: 150 }] }, { id: 'd3', name: 'Poulet avocat', cat: 'Collation', items: [{ f: 'fp', q: 80 }, { f: 'fa', q: 50 }] }]; }; })),

  'client : charge conseillée, méthode et base de connaissances': () => run('client', async (p) => {
    await p.waitForTimeout(1000);
    const n = await p.evaluate(() => { applyBank('tb-rep3'); ST.prog.profile.start = isoD(new Date(Date.now() - (7 + (new Date().getDay() + 6) % 7) * 864e5)); recompute();
      const r = i => M.rows.find(x => x.s === 0 && x.i === i);
      ST.carnet['1_' + r(0).key] = { sets: [{ g: 100, h: 12, r: 7, d: 1 }, { g: 100, h: 12, r: 7.5, d: 1 }] };
      ST.carnet['1_' + r(1).key] = { sets: [{ g: 40, h: 9, r: 8, d: 1 }, { g: 40, h: 8, r: 8.5, d: 1 }] };
      ST.carnet['1_' + r(2).key] = { sets: [{ g: 50, h: 11, r: 8, d: 1 }] };
      recompute(); ST.todayOn = false; ST.view = 'carnet'; ST.week = 2; ST.ses = 0; ST.cses = 0; ST.csesW = 2; render();
      return [...document.querySelectorAll('.nx66')].map(x => x.className + '|' + x.textContent); });
    ok(n.length === 3 && /up\|.*102,5 kg/.test(n[0]), 'haut de fourchette atteint : +2,5 kg conseillés');
    ok(/hold/.test(n[1]) && /keep/.test(n[2]), 'sous la fourchette : on consolide ; sinon +1 rép');
    ok(await p.evaluate(() => document.querySelector('input.si[data-cs$="|g"]').placeholder === '102,5'), 'charge conseillée proposée dans la case');
    await p.evaluate(() => { ST.view = 'semaine'; render(); }); await p.waitForTimeout(300);
    ok(!!(await p.$('#mc66')), 'carte « Ma méthode de progression » dans Semaine');
    await p.click('#mc66 summary'); await p.locator('#mc66 [data-act="kb66-go"]').first().click(); await p.waitForTimeout(400);
    ok((await txt(p, '#app h2')).includes('La méthode') && !(await p.$('.kbco66')), 'base de connaissances en version client (sans la partie coach)');
    ok(await p.evaluate(() => document.getElementById('kb66-priorites').open), 'chapitre lié ouvert');
  }, clientPre()),

  'coach : méthode & théorie depuis Plus, version coach et client': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(1000);
    await p.evaluate(() => { ST.view = 'plus'; render(); }); await p.waitForTimeout(300);
    await p.click('.menu [data-act="kb66-go"]'); await p.waitForTimeout(400);
    ok((await txt(p, '#app h2')).includes('Méthode & théorie') && (await p.$$('.kb66')).length >= 12, 'chapitres affichés');
    ok((await p.$$('.kbco66')).length >= 12, 'version coach avec la théorie complète');
    await p.click('[data-act="kb66-v"][data-v="cli"]'); await p.waitForTimeout(200);
    ok(!(await p.$('.kbco66')), 'aperçu de la version client');
  }, coachPre()),

  'coach : plan nutrition — alertes, correction auto, plan proposé': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(1000);
    await p.evaluate(() => { ST.view = 'nutrition'; NU.nv = 'plan'; render(); }); await p.waitForTimeout(1200);
    await p.evaluate(() => { NU.nv = 'plan'; render(); }); await p.waitForTimeout(600);
    const w = await txt(p, '#pw84');
    ok(/plus de calories que/.test(w) && /Portions peu réalistes/.test(w), 'alerte : repos > entraînement et portion absurde');
    ok(/Plan de test/.test(await txt(p, '#pp84')), 'plan proposé affiché au coach');
    await p.click('[data-act="pp84-fix"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const [E, R] = NU.plan.types; return { g: R.g, e: dayPlan(E).k, r: dayPlan(R).k, min: Math.min(...E.meals[0].opts[0].it.map(i => i.q)) }; });
    ok(r.g === 170 && r.e >= r.r && r.min >= 5, 'correction : repos à −15 % de glucides, portions réalistes');
    await p.click('[data-act="pp84-apply"]'); await p.waitForTimeout(600);
    ok(!(await p.$('#pp84')) && await p.evaluate(() => NU.plan.types[0].meals[0].opts[0].it[0].q === 160), 'plan proposé appliqué puis retiré');
  }, coachPre(sc => (m, path, b, a, t, one) => {
    const it = (n, k, pp, g, l, q) => ({ n, k, p: pp, g, l, q });
    const ms = (a1, b1) => [{ name: 'Déjeuner', opts: [{ n: 'Poulet riz', m: 1, it: [it('Blanc de poulet (cru)', 110, 23, 0, 1.5, a1), it('Riz basmati (cuit)', 130, 3, 28, 0.4, b1), it("Huile d'olive", 900, 0, 0, 100, 10)] }] }];
    const NUT = { v: 1, active: true, prof: {}, tgt: { k: 2000, p: 150, g: 200, l: 70 }, week: ['E', 'R', 'E', 'R', 'E', 'R', 'R'], types: [{ id: 'E', name: "Jour d'entraînement", meals: ms(10, 150) }, { id: 'R', name: 'Jour de repos', meals: ms(150, 700) }] };
    if (t === 'clients' && m === 'GET') { const c = { id: sc.CID, coach_id: sc.uid, email: 'client@exemple.fr', name: 'Client Fictif', archived: false, program: {}, nutrition: NUT }; return one ? c : [c]; }
    if (t === 'carnet' && m === 'GET' && /nu_prop/.test(path)) { const d = { data: { note: 'Plan de test', types: [{ id: 'E', meals: ms(160, 250) }, { id: 'R', meals: ms(160, 180) }] } }; return one ? d : [d]; }
  })),

  'page publique : redirection vers le site': async () => {
    const b = await chromium.launch({ executablePath: EXE }); const p = await (await b.newContext()).newPage(); let target = null;
    await p.route('https://thomasbouletcoaching-lab.github.io/**', async r => { target = r.request().url(); await r.fulfill({ status: 200, contentType: 'text/html', body: '<p>site</p>' }); });
    await p.goto(BASE + 'coaching.html'); await p.waitForTimeout(800);
    ok(target && target.includes('/thomasboulet-coaching/coaching.html'), 'coaching.html redirige vers la page de vente du site'); await b.close(); },
};

(async () => {
  for (const [name, fn] of Object.entries(T)) { if (process.env.ONLY && !name.includes(process.env.ONLY)) continue; console.log('▶', name); try { await fn(); } catch (e) { fails++; console.log('  ✗', e.message.split('\n')[0]); } }
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`); process.exit(fails ? 1 : 0);
})();
