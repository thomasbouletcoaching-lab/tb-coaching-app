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
    ok(!(await p.locator('[data-act="eq-open"][data-v="1"]').isVisible()), 'options secondaires repliées par défaut');
    await p.locator('[data-act="nu90-more"][data-v="1"]').click(); await p.waitForTimeout(300);
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
    ok(chk.n === 8 && chk.first === 'Méthode TB', '8 programmes Méthode TB en tête de la banque');
    const dos = await p.evaluate(() => { applyBank('tb-dos4'); recompute(); const rows = M.rows.filter(r => r.ex);
      return { nw: M.phases.filter(Boolean).length, tempo: ST.prog.sessions.some(s => s.ex.some(e => e.tempo === '3-1-1')), timed: rows.filter(r => /Side plank|Couch stretch|Suitcase/.test(r.ex)).every(r => isTimed(r.ex, r.E)), m: ST.prog.method && ST.prog.method.id }; });
    ok(dos.nw === 6 && dos.m === 'tb-dos4', 'programme Dos solide : 6 semaines, règles rattachées');
    ok(dos.tempo && dos.timed, 'tempos et exercices en secondes (gainage, étirements, carries) bien repris');
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
    ok((await p.$$('.kb66[id^="kb66-dos-"]')).length === 10 && !!(await p.$('.kbg66')) && (await p.$$('#kb66-dos-erect .xk66')).length === 3, 'chapitres Dos solide & maillons faibles (10, avec 3 exercices par zone)');
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
    await p.evaluate(() => { NU.plan.prof = { sex: 'F', age: 32, h: 165, w: 62, adj: -20 }; NU.nv = 'besoins'; render(); }); await p.waitForTimeout(400);
    const k0 = await p.evaluate(() => NU.calc.k);
    await p.selectOption('select[data-nk="prof.lact"]', 'ex'); await p.waitForTimeout(500);
    const k1 = await p.evaluate(() => NU.calc.k), at = await txt(p, '#app');
    ok((k1 > k0 && /Allaitement/.test(at) && /limité à −12 %/.test(at) && /\(−12 %\)/.test(at)), `allaitement exclusif : +500 kcal et déficit limité à −12 % (${k0} → ${k1} kcal)`);
    await p.selectOption('select[data-nk="prof.lact"]', 'g3'); await p.waitForTimeout(500);
    const k2 = await p.evaluate(() => NU.calc.k), gt = await txt(p, '#app');
    ok(/Grossesse/.test(gt) && /ramené au maintien/.test(gt) && /\(0 %\)/.test(gt) && k2 > k1, `grossesse 3e trimestre : +500 kcal, pas de déficit (${k2} kcal)`);
    await p.evaluate(() => { NU.plan.prof.sex = 'H'; render(); }); await p.waitForTimeout(300);
    ok(!(await p.$('select[data-nk="prof.lact"]')), 'option allaitement masquée pour un homme');
  }, coachPre(sc => (m, path, b, a, t, one) => {
    const it = (n, k, pp, g, l, q) => ({ n, k, p: pp, g, l, q });
    const ms = (a1, b1) => [{ name: 'Déjeuner', opts: [{ n: 'Poulet riz', m: 1, it: [it('Blanc de poulet (cru)', 110, 23, 0, 1.5, a1), it('Riz basmati (cuit)', 130, 3, 28, 0.4, b1), it("Huile d'olive", 900, 0, 0, 100, 10)] }] }];
    const NUT = { v: 1, active: true, prof: {}, tgt: { k: 2000, p: 150, g: 200, l: 70 }, week: ['E', 'R', 'E', 'R', 'E', 'R', 'R'], types: [{ id: 'E', name: "Jour d'entraînement", meals: ms(10, 150) }, { id: 'R', name: 'Jour de repos', meals: ms(150, 700) }] };
    if (t === 'clients' && m === 'GET') { const c = { id: sc.CID, coach_id: sc.uid, email: 'client@exemple.fr', name: 'Client Fictif', archived: false, program: {}, nutrition: NUT }; return one ? c : [c]; }
    if (t === 'carnet' && m === 'GET' && /nu_prop/.test(path)) { const d = { data: { note: 'Plan de test', types: [{ id: 'E', meals: ms(160, 250) }, { id: 'R', meals: ms(160, 180) }] } }; return one ? d : [d]; }
  })),

  'client : journée type, estimateur texte, extra rattaché à un repas, aliment ajouté à la base': () => run('client', async (p, sc) => {
    await p.waitForTimeout(1200); await p.evaluate(() => { ST.todayOn = false; ST.view = 'nutrition'; NU.nv = 'jour'; NU.day = todayISO(); render(); }); await p.waitForTimeout(800);
    ok(!!(await p.$('#jt85')), 'carte « Ma journée type » affichée');
    await p.evaluate(() => { document.querySelector('details#jt85').open = true; }); await p.waitForTimeout(200);
    await p.click('[data-act="jt85-addmeal"][data-v="Collation"]'); await p.waitForTimeout(300);
    await p.fill('[data-nuq="jtq"]', 'riz'); await p.waitForTimeout(200); await p.click('#jt85res [data-act="jt85-add"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => ST.carnet.nu_jt.meals.some(m => m.name === 'Collation' && m.it.length === 1)), 'repas ajouté à la journée type avec un aliment');
    ok(await p.evaluate(() => document.querySelector('details#jt85').open), 'journée type reste ouverte après modification');
    await p.click('[data-act="nu90-more"][data-v="0"]'); await p.waitForTimeout(200);
    await p.click('[data-act="es85-open"][data-v="m:0"]'); await p.waitForTimeout(200);
    await p.fill('#es85 [data-es85t]', '2 oeufs, 2 tranches de pain complet, une banane et 150 g de skyr'); await p.click('#es85 [data-act="es85-parse"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ES85.res.map(x => NU.fmap[x.f].name + ' ' + x.q).join(','));
    ok(r === 'Oeuf entier 100,Pain complet 70,Banane 120,Skyr nature 150', 'description écrite → aliments et quantités (' + r + ')');
    await p.click('#es85 [data-act="es85-apply"]'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => NU.logs[todayISO()].m[0].it.length === 4), 'repas noté depuis la description');
    await p.click('[data-act="nu-xopen"]'); await p.waitForTimeout(300); await p.click('[data-act="xm85-mi"][data-v="1"]'); await p.waitForTimeout(200);
    await p.fill('[data-nuq="xq"]', 'galette bretonne'); await p.waitForTimeout(200); await p.click('#nu-xres [data-act="nf85-new"]'); await p.waitForTimeout(300);
    await p.fill('[data-nf85="p"]', '6'); await p.fill('[data-nf85="g"]', '60'); await p.fill('[data-nf85="l"]', '17'); await p.click('[data-act="nf85-save"]'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => { const x = NU.logs[todayISO()].x; return x.length === 1 && x[0].n === 'Galette bretonne' && x[0].mi === 1; }), 'aliment absent créé, ajouté en extra et rattaché au 2e repas');
    ok((await p.$$('.xm85')).length === 1, "l'extra apparaît dans la carte du repas");
  }, clientPre((sc) => (m, path, b) => { if (path.startsWith('/rest/v1/rpc/nutri_food_add')) { const f = b.f; return { id: 'new1', name: f.name, cat: f.cat, kcal: 360, p: f.p, g: f.g, l: f.l, unit: null, unit_g: null }; }
    if (/nutri_foods/.test(path) && m === 'GET') return [{ id: 'fr', name: 'Riz basmati (cuit)', cat: 'Féculents & céréales', kcal: 130, p: 3, g: 28, l: 0.4 }, { id: 'fo', name: 'Oeuf entier', cat: 'Oeufs', kcal: 140, p: 12.5, g: 0.5, l: 10, unit: 'oeuf', unit_g: 50 }, { id: 'fpc', name: 'Pain complet', cat: 'Pains & viennoiseries', kcal: 245, p: 9, g: 41, l: 3.3, unit: 'tranche', unit_g: 35 }, { id: 'fb', name: 'Banane', cat: 'Fruits', kcal: 90, p: 1.1, g: 20, l: 0.3, unit: 'banane', unit_g: 120 }, { id: 'fs', name: 'Skyr nature', cat: 'Produits laitiers', kcal: 60, p: 10.5, g: 4, l: 0.2, unit: 'pot', unit_g: 150 }]; })),

  'coach : sélecteur de client + vue par exercice + remplissage de progression': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(1000);
    await p.click('#appTitle'); await p.waitForTimeout(600);
    ok((await p.$$('#cs85 .cs85r')).length === 2, 'menu des clients ouvert depuis le prénom');
    await p.click('#cs85 .cs85r:not(.cur)'); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => CUR === '22222222-2222-2222-2222-222222222222') && !(await p.$('#cs85')), 'bascule vers un autre client');
    await p.evaluate(() => { ST.view = 'programme'; render(); }); await p.waitForTimeout(400);
    await p.click('[data-act="vx85-open"]'); await p.waitForTimeout(400);
    ok((await p.$$('.vx85t tr')).length >= 13, 'vue par exercice : une ligne par semaine');
    await p.click('#vx85f summary'); await p.fill('[data-vx85="kg"]', '60'); await p.fill('[data-vx85="inc"]', '2,5'); await p.click('[data-act="vx85-apply"]'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => { const o = vxOcc85(VX85.ex)[0].r; return o.weeks[1].load1 === 60 && o.weeks[3].load1 === 65; }), 'progression écrite : 60 → 62,5 → 65 kg');
  }, coachPre(sc => (m, path, b, a, t, one) => { if (t === 'clients' && m === 'GET' && !one) return [{ id: sc.CID, coach_id: sc.uid, name: 'Client Fictif', email: 'client@exemple.fr', archived: false, program: {}, nutrition: {} }, { id: '22222222-2222-2222-2222-222222222222', coach_id: sc.uid, name: 'Paul Exemple', archived: false, program: {}, nutrition: {} }]; })),

  'client : techniques d’intensification (rest-pause avec repos) + coach : MYO dans la prescription': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'carnet'; render(); window.scrollTo(0, 0); }); await p.waitForTimeout(400);
    const b = await p.$('[data-act="st-open"]'); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(300);
    await p.click('.st50 [data-act="st86-all"]'); await p.waitForTimeout(300); ok((await p.$$('.st50 [data-act="st-tag"]')).length >= 19, 'toutes les techniques proposées au client');
    await p.click('.st50 [data-act="st-tag"][data-v$="|rp"]'); await p.waitForTimeout(300);
    await p.fill('.st50 [data-st86$="|mr|t"]', '4+3+2'); await p.dispatchEvent('.st50 [data-st86$="|mr|t"]', 'change'); await p.waitForTimeout(200);
    await p.fill('.st50 [data-st86$="|rs|n"]', '15'); await p.dispatchEvent('.st50 [data-st86$="|rs|n"]', 'change'); await p.waitForTimeout(300);
    const x = await p.evaluate(() => { const k = Object.keys(ST.carnet).find(k => (ST.carnet[k].sets || []).some(s => s.t && s.t.includes('rp'))); const s = ST.carnet[k].sets.find(s => s.t && s.t.includes('rp')); return { mr: s.mr, rs: s.rs, det: setDetail50(s) }; });
    ok(x.mr === '4+3+2' && x.rs === 15, 'mini-séries et repos enregistrés');
    ok(/4\+3\+2/.test(await txt(p, '.det50')) && /repos 15 s/.test(x.det), 'détail affiché sous la série (' + x.det + ')');
    const pb = await p.evaluate(() => { const r = parsePrescription('1x12@RPE9 MYO + 1x8 RP'); return r.valid && r.blocks[0].tags[0] === 'myo' && r.blocks[1].tags[0] === 'rp'; });
    ok(pb, 'prescription coach « 1x12@RPE9 MYO + 1x8 RP » reconnue');
  }, clientPre()),

  'coach : centre de notifications avec le texte des messages': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1500); ok(!(await p.$eval('#nc87b', x => x.hidden)), 'cloche 🔔 dans l’en-tête');
    await p.click('#nc87b'); await p.waitForTimeout(900);
    const r = await p.$$eval('#nc87 .nc87r', a => a.map(x => x.className + '|' + x.innerText.replace(/\s+/g, ' ')));
    ok(r.length === 2 && /new/.test(r[0]) && /douleur au genou/.test(r[0]) && /Paul Exemple/.test(r[0]), 'message lisible sans ouvrir, non lu en évidence');
    ok(/Vidéo · Squat/.test(r[1]), 'vidéo annoncée avec son exercice');
    await p.click('#nc87 .nc87r.new'); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => CUR === '22222222-2222-2222-2222-222222222222' && MSG.open) && !(await p.$('#nc87')), 'toucher le message ouvre la conversation du client');
  }, coachPre(sc => (m, path, b, a, t, one) => { const C2 = '22222222-2222-2222-2222-222222222222';
    if (t === 'clients' && m === 'GET' && !one) return [{ id: sc.CID, coach_id: sc.uid, name: 'Client Fictif', email: 'client@exemple.fr', archived: false, program: {}, nutrition: {} }, { id: C2, coach_id: sc.uid, name: 'Paul Exemple', archived: false, program: {}, nutrition: {} }];
    if (t === 'messages' && m === 'GET' && /from_coach=eq.false/.test(path) && /order=created_at/.test(path)) return [{ id: 'm1', client_id: C2, body: "J'ai une douleur au genou depuis la séance d'hier", media: null, created_at: new Date(Date.now() - 4 * 60e3).toISOString(), read_at: null, from_coach: false }, { id: 'm2', client_id: sc.CID, body: null, media: [{ type: 'video', path: 'x.mp4' }], ref: 'Squat · S2', created_at: new Date(Date.now() - 3 * 3600e3).toISOString(), read_at: '2026-10-18T08:00:00Z', from_coach: false }]; })),

  'client : notification de message → conversation ouverte directement': () => run('client', async (p) => {
    await p.waitForTimeout(1200); await p.evaluate(() => ncFromUrl87('./?msg=1')); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => MSG.open), 'la conversation avec le coach s’ouvre');
    ok(!(await p.$eval('#nc87b', x => x.hidden)), 'cloche aussi côté client');
  }, clientPre()),

  'page publique : redirection vers le site': async () => {
    const b = await chromium.launch({ executablePath: EXE }); const p = await (await b.newContext()).newPage(); let target = null;
    await p.route('https://thomasbouletcoaching-lab.github.io/**', async r => { target = r.request().url(); await r.fulfill({ status: 200, contentType: 'text/html', body: '<p>site</p>' }); });
    await p.goto(BASE + 'coaching.html'); await p.waitForTimeout(800);
    ok(target && target.includes('/thomasboulet-coaching/coaching.html'), 'coaching.html redirige vers la page de vente du site'); await b.close(); },
  'public : nouveau compte sans dossier → formules + démarrage gratuit': () => run('client', async (p, sc) => {
    await p.waitForTimeout(500);
    ok((await txt(p, '#app')).includes('Démarrer en autonomie'), 'écran de départ affiché');
    ok((await p.$$('.of88')).length === 4, '4 formules présentées');
    await p.fill('#p88-name', 'Alex'); await p.check('#p88-ck');
    sc.noClients = false; sc.client.coach_id = sc.uid; sc.client.program = {}; sc.me.sub = { plan: 'free', status: 'active', source: 'self' };
    await p.click('[data-act="p88-start"]'); await p.waitForTimeout(1500);
    ok(sc.db.log.some(l => /rpc\/self_start/.test(l)), 'dossier créé (self_start)');
    ok(!!(await p.$('#solo88b')), 'bouton outils du coach présent');
    ok((await txt(p, '#app')).includes('Générer mon programme'), 'questionnaire adapté à l\'autonomie');
    const gen = await p.evaluate(async () => { Object.assign(X10.obDraft, { obj: 'Gagner en force', years: '1 à 3 ans', n_ses: '3', dur: '60 min', lieu: 'Salle de sport', q1: 'Non', q2: 'Non', q3: 'Non', q4: 'Non', q5: 'Non', q6: 'Non', q7: 'Non' });
      await obSave(true); await new Promise(r => setTimeout(r, 900)); return { gen: !!ST.prog.gen88, name: ST.prog.profile.name, days: (ST.prog.profile.days || []).filter(Boolean).length }; });
    ok(gen.gen && gen.name === 'Alex' && gen.days === 3, 'programme de départ généré depuis le questionnaire');
    ok(sc.db.log.some(l => /^PATCH \/rest\/v1\/clients/.test(l)), 'programme enregistré dans son dossier');
  }, sc => { sc.noClients = true; sc.user.user_metadata.pw_set = 'x'; }),

  'public : abonné Gratuit (autonomie)': () => run('client', async (p, sc) => {
    await p.waitForTimeout(600);
    ok((await txt(p, '#app')).includes('Outils du coach 🔒'), 'bouton Outils du coach verrouillé (Accueil)');
    ok(!(await p.isVisible('#msgfab')), 'messagerie avec le coach masquée');
    await p.click('#solo88c button'); await p.waitForTimeout(300);
    ok((await p.$$('#p88 .of88')).length === 4, 'formules proposées');
    await p.click('#p88 .cs85p [data-act="p88-close"]'); await p.waitForTimeout(200);
    await p.evaluate(() => { ST.todayOn = false; ST.view = 'compte'; render(); }); await p.waitForTimeout(300);
    ok((await txt(p, '#app')).includes('Ma formule : Gratuit'), 'compte : Ma formule');
    ok(!(await txt(p, '#app')).includes('Réserver un rendez-vous'), 'pas de prise de rendez-vous avec le coach');
  }, clientPre(sc => { sc.client.coach_id = sc.uid; sc.me.sub = { plan: 'free', status: 'active', source: 'self' }; })),

  'public : abonné Premium → outils du coach sur son dossier': () => run('client', async (p, sc) => {
    await p.waitForTimeout(600); await p.click('#solo88c button'); await p.waitForTimeout(500);
    ok((await txt(p, '#tabs')).includes('Programme'), 'onglet Programme (outils du coach)');
    ok(await p.evaluate(() => coach() && ST.solo), 'mode coach sur son propre dossier');
    await p.click('#solo88b'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => !coach()), 'retour à l\'espace athlète');
  }, clientPre(sc => { sc.client.coach_id = sc.uid; sc.me.sub = { plan: 'premium', status: 'trialing', source: 'stripe', period_end: new Date(Date.now() + 5 * 864e5).toISOString() }; })),

  'coach : abonnés, ouverture des inscriptions, activation manuelle': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(600); await p.click('[data-act="home"][data-v="abo"]'); await p.waitForTimeout(800);
    ok((await txt(p, '#app')).includes('Alex Test'), 'abonné listé');
    ok((await txt(p, '#tabs')).includes('Abonnés (2)'), 'onglet Abonnés avec compteur');
    ok((await txt(p, '#app')).includes('(Stripe)9,99'), 'revenu mensuel récurrent');
    await p.click('[data-act="p88-open"]'); await p.waitForTimeout(400);
    ok(sc.flag && sc.flag.k === 'signup_open' && sc.flag.v === true, 'inscriptions ouvertes');
    await p.selectOption('[data-ab88p="s1"]', 'premium'); await p.click('[data-act="p88-set"][data-v="s1"]'); await p.waitForTimeout(600);
    ok(sc.setPlan && sc.setPlan.p_plan === 'premium' && sc.setPlan.p_client === 's1', 'activation manuelle (Premium offert)');
  }, coachPre(sc => { sc.me.signup_open = false; return (m, path, body) => {
    if (/rpc\/coach_subscribers/.test(path)) return [{ client_id: 's1', name: 'Alex Test', email: 'alex@exemple.fr', plan: 'free', status: 'active', source: 'self', created_at: '2026-10-10T10:00:00Z' }, { client_id: 's2', name: 'Sam Test', email: 'sam@exemple.fr', plan: 'premium', status: 'active', source: 'stripe', interval: 'month', created_at: '2026-10-11T10:00:00Z' }];
    if (/app_flags/.test(path) && m === 'POST') { sc.flag = body; sc.me.signup_open = true; return []; }
    if (/rpc\/coach_set_plan/.test(path)) { sc.setPlan = body; return null; } }; })),
  'client : éditeur de série (techniques, note, vidéo, suppression)': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { ST.todayOn = false; ST.view = 'carnet'; render(); });
    await p.waitForTimeout(400);
    const b = await p.$('[data-act="st-open"][data-v]:not([data-v=""])'); ok(!!b, 'bouton de série présent'); if (!b) return;
    await b.click(); await p.waitForTimeout(400);
    const box = await txt(p, '.st50');
    ok(box.includes('technique, note, vidéo'), 'titre : technique, note, vidéo');
    ok(!!(await p.$('.st50 [data-act="st-tag"]')), 'techniques d\'intensification');
    ok(!!(await p.$('.st50 textarea[data-sn]')), 'note sur la série');
    ok(!!(await p.$('.st50 [data-act="sv-take"]')), 'vidéo de la série');
    ok(!!(await p.$('.st50 [data-act="cx-sdel70"]')), 'supprimer cette série');
    await p.fill('.st50 textarea[data-sn]', 'Dernière rep lente'); await p.click('.st50 b'); await p.waitForTimeout(700);
    ok(sc.lastWrite && JSON.stringify(sc.lastWrite).includes('Dernière rep lente'), 'note enregistrée');
  }, clientPre(sc => (m, path, body, acc, t) => { if (t === 'carnet' && m === 'GET' && /client_id=eq/.test(path)) return CAR; if (t === 'carnet' && m === 'POST') { sc.lastWrite = body; return []; } if (t === 'carnet') return []; })),
  'client : balayer une série vers la gauche pour la supprimer, son de fin de repos': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { ST.todayOn = false; ST.view = 'carnet'; render(); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const tr = document.querySelector('table.sets tr[data-sk^="c|"]'); if (!tr) return; const key = tr.dataset.sk.split('|')[1]; const c = ensureSets(key); c.sets = [{ g: 60, h: 8, r: 8 }, { g: 62.5, h: 8, r: 8 }, { g: 65, h: 6, r: 9 }]; render(); });
    await p.waitForTimeout(400);
    const info = await p.evaluate(() => { const tr = document.querySelector('table.sets tr[data-sk^="c|"]'); if (!tr) return null; tr.scrollIntoView({ block: 'center' }); const r = tr.getBoundingClientRect(); const key = tr.dataset.sk.split('|')[1]; return { x: r.left + r.width * 0.8, y: r.top + r.height / 2, key, n: (ST.carnet[key] && ST.carnet[key].sets || []).length }; });
    ok(!!info, 'ligne de série balayable'); if (!info) return;
    await p.mouse.move(info.x, info.y); await p.mouse.down();
    for (let d = 10; d <= 130; d += 20) { await p.mouse.move(info.x - d, info.y + 2); await p.waitForTimeout(20); }
    await p.mouse.up(); await p.waitForTimeout(400);
    const bt = await p.evaluate(() => { const b = document.querySelector('.sw89bg'); if (!b) return null; const r = b.getBoundingClientRect(); return { t: b.textContent, w: r.width, right: r.right, vw: innerWidth }; });
    ok(bt && /Supprimer/.test(bt.t) && bt.w > 90 && Math.abs(bt.right - bt.vw) < 40, 'la ligne reste ouverte sur le bouton rouge « Supprimer » à droite');
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
    await p.click('.sw89bg'); await p.waitForTimeout(600);
    const after = await p.evaluate(k => (ST.carnet[k] && ST.carnet[k].sets || []).length, info.key);
    ok(after === info.n - 1, 'série supprimée (' + info.n + ' → ' + after + ')');
    ok(sc.lastWrite && sc.lastWrite.k === info.key, 'suppression enregistrée');
    ok(await p.isVisible('#sw89u'), 'bouton Annuler proposé');
    await p.click('#sw89u button'); await p.waitForTimeout(400);
    ok(await p.evaluate(k => (ST.carnet[k] && ST.carnet[k].sets || []).length, info.key) === info.n, 'Annuler rétablit la série');
    const snd = await p.evaluate(() => { try { startRest(1); stopRest(true); return { ok: true, el: !!SND89.el }; } catch (e) { return { ok: false, err: e.message }; } });
    ok(snd.ok && snd.el, 'fin de repos : son préparé et joué sans erreur');
  }, clientPre(sc => (m, path, body, acc, t) => { if (t === 'carnet' && m === 'GET' && /client_id=eq/.test(path)) return CAR; if (t === 'carnet' && m === 'POST') { sc.lastWrite = body; return []; } if (t === 'carnet') return []; })),
  'client : balayage au doigt, le bouton Supprimer reste ouvert (clavier, défilement) puis supprime': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { ST.todayOn = false; ST.view = 'carnet'; render(); }); await p.waitForTimeout(400);
    await p.evaluate(() => { const tr = document.querySelector('table.sets tr[data-sk^="c|"]'); const c = ensureSets(tr.dataset.sk.split('|')[1]); c.sets = [{ g: 60, h: 8, r: 8 }, { g: 62.5, h: 8, r: 8 }, { g: 65, h: 6, r: 9 }]; render(); });
    await p.waitForTimeout(400);
    const info = await p.evaluate(() => { const tr = document.querySelectorAll('table.sets tr[data-sk^="c|"]')[1]; tr.scrollIntoView({ block: 'center' }); const r = tr.getBoundingClientRect(); return { x: r.left + r.width * 0.55, y: r.top + r.height / 2, key: tr.dataset.sk.split('|')[1] }; });
    await p.waitForTimeout(300);
    const c = await p.context().newCDPSession(p); const T = (type, x, y) => c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await T('touchStart', info.x, info.y); for (let d = 8; d <= 140; d += 12) { await T('touchMove', info.x - d, info.y + d / 12); await p.waitForTimeout(16); } await T('touchEnd'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !!document.querySelector('.sw89bg') && !!SW89.open), 'bouton Supprimer ouvert après le balayage au doigt');
    await p.setViewportSize({ width: 390, height: 500 }); await p.waitForTimeout(200); await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => window.scrollBy(0, 250)); await p.waitForTimeout(400);
    const g = await p.evaluate(() => { const b = document.querySelector('.sw89bg'), O = SW89.open; if (!b || !O) return null; const br = b.getBoundingClientRect(), tr = O.tr.getBoundingClientRect(); return { dy: Math.abs(br.top - tr.top), dx: Math.abs(br.right - (tr.right + SW89.W)), cx: br.left + br.width / 2, cy: br.top + br.height / 2 }; });
    ok(g && g.dy < 2 && g.dx < 2, 'toujours ouvert et aligné après clavier et défilement');
    if (!g) return;
    await T('touchStart', g.cx, g.cy); await T('touchEnd'); await p.waitForTimeout(700);
    ok(await p.evaluate(k => ensureSets(k).sets.length, info.key) === 2, 'un toucher sur Supprimer supprime la série');
  }, clientPre(sc => (m, path, body, acc, t) => { if (t === 'carnet' && m === 'GET' && /client_id=eq/.test(path)) return CAR; if (t === 'carnet' && m === 'POST') { sc.lastWrite = body; return []; } if (t === 'carnet') return []; })),
  'client : repas à l\'avance (batch), mes repas et journée type dans chaque repas': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { const it = (n, q, k, pp, g, l) => ({ n, q, k, p: pp, g, l }); ST.carnet.nu_my = { list: [{ id: 'm1', n: 'Chili maison', it: [it('Riz basmati (cuit)', 200, 130, 3, 28, 0.4), it('Blanc de poulet (cru)', 120, 110, 23, 0, 1.5)] }] };
      ST.carnet.nu_jt = { meals: [{ name: 'Dîner', it: [it('Avocat', 100, 160, 2, 1.8, 15)] }, { name: 'Collation', it: [it('Avocat', 50, 160, 2, 1.8, 15)] }] };
      ST.todayOn = false; ST.view = 'nutrition'; NU.nv = 'jour'; NU.day = todayISO(); render(); }); await p.waitForTimeout(500);
    await p.click('[data-act="nu90-more"][data-v="0"]'); await p.waitForTimeout(200);
    await p.click('[data-act="nu91-my"][data-v="0"]'); await p.waitForTimeout(200);
    await p.click('[data-act="nu91-log"][data-v="0|my:m1"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => NU.logs[todayISO()].m[0].n === 'Chili maison' && NU.logs[todayISO()].m[0].it.length === 2), 'un de mes repas noté directement dans le repas');
    await p.click('[data-act="nu91-jt"]'); await p.waitForTimeout(300);
    const j = await p.evaluate(() => { const L = NU.logs[todayISO()]; return { d: L.m[2] && L.m[2].n, x: (L.x || []).length, m0: L.m[0].n }; });
    ok(j.d === 'Dîner' && j.x === 1 && j.m0 === 'Chili maison', 'journée type : Dîner rempli, Collation en extra, repas déjà noté gardé');
    await p.click('[data-act="bt91-open"]'); await p.waitForTimeout(200);
    await p.click('[data-act="bt91-src"][data-v="my:m1"]'); await p.click('[data-act="bt91-slot"][data-v="Déjeuner"]'); await p.click('[data-act="bt91-q"][data-v="3"]'); await p.waitForTimeout(200);
    await p.click('[data-act="bt91-go"]'); await p.waitForTimeout(600);
    const b = await p.evaluate(() => [0, 1, 2].map(i => { const L = NU.logs[addDays(todayISO(), i)] || {}; return { pre: ((L.pre || {}).m || {})[1] || null, eaten: !!(L.m || {})[1], k: consumed(L).k }; }));
    ok(b.every(x => x.pre && x.pre.n === 'Chili maison' && !x.eaten), 'batch : déjeuner prévu sur 3 jours, pas compté comme mangé');
    ok(b[1].k === 0, 'jour suivant : 0 kcal comptées tant que rien n\'est validé');
    ok(/Prévu : Chili maison/.test(await txt(p, '#app')), 'plat prévu affiché à la place du plat du plan');
    await p.click('[data-act="nu93-preok"][data-v="1"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => { const L = NU.logs[todayISO()]; return L.m[1].n === 'Chili maison' && !(L.pre && L.pre.m && L.pre.m[1]); }), '« Mangé (plat prévu) » le compte');
    await p.evaluate(() => { NU.day = addDays(todayISO(), 9); render(); }); await p.click('[data-act="nu-day"][data-v="1"]'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => NU.day === addDays(todayISO(), 10)), 'navigation possible jusqu\'à 14 jours à l\'avance');
  }, clientPre()),
  'client : budget estimé (jour, semaine, mois) et prix perso par magasin': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { ST.todayOn = false; ST.view = 'nutrition'; NU.nv = 'courses'; render(); }); await p.waitForTimeout(800);
    const t = await txt(p, '#bu91');
    // plan : riz 350 g/j à 1,20 €/kg + poulet 300 g/j à 12 €/kg + avocat 80 g/j à 8 €/kg = 0,42 + 3,60 + 0,64 = 4,66 €/j
    ok(/4,66 €/.test(t) && /32,62 €/.test(t) && /par mois/.test(t), 'budget du plan : 4,66 €/jour, 32,62 €/semaine');
    await p.click('[data-act="px91-add"]'); await p.waitForTimeout(400);
    await p.click('[data-act="px91-ed"][data-v="Blanc de poulet (cru)"]'); await p.waitForTimeout(200);
    await p.fill('#px91p', '4,5'); await p.fill('#px91g', '500'); await p.click('[data-act="px91-save"]'); await p.waitForTimeout(500);
    const X = await p.evaluate(() => ST.carnet.nu_px);
    ok(X.store === 'Lidl' && X.st.Lidl['Blanc de poulet (cru)'].p === 4.5, 'magasin ajouté et prix perso enregistré');
    ok(/mon prix/.test(await txt(p, '#app')) && /3,76 €/.test(await txt(p, '#bu91')), 'calcul refait avec mon prix (9 €/kg → 3,76 €/jour)');
  }, sc => { clientPre()(sc); sc.extra = (m, path, b, a, t, one) => { if (t === 'nutri_foods' && m === 'GET') return [{ id: 'fp', name: 'Blanc de poulet (cru)', cat: 'Volailles & viandes', kcal: 110, p: 23, g: 0, l: 1.5, price_kg: 12 }, { id: 'fr', name: 'Riz basmati (cuit)', cat: 'Féculents & céréales', kcal: 130, p: 3, g: 28, l: 0.4, price_kg: 1.2 }, { id: 'fa', name: 'Avocat', cat: 'Fruits', kcal: 160, p: 2, g: 1.8, l: 15, price_kg: 8 }]; if (t === 'carnet' && m === 'POST') return []; }; sc.prompt = 'Lidl'; }),
  'coach : onglets, base de données, programme créé sans client, principes de surcharge': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(() => { CUR = null; ST.view = 'clients'; render(); }); await p.waitForTimeout(300);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabs button:not([hidden])')].map(b => b.textContent.trim()));
    ok(tabs.join('|').replace(/Messages \(\d+\)/, 'Messages') === 'Mes clients|Messages|Business|Abonnés|Base de données', 'onglets : ' + tabs.join(' · '));
    await p.click('#tabs [data-v="base"]'); await p.waitForTimeout(600);
    ok(/Base de données/.test(await txt(p, '#app')) && !!(await p.$('[data-act="b92-tab"][data-v="ex"]')), 'page Base de données avec ses sous-onglets');
    ok(!!(await p.$('[data-act="lib-fnew"]')), 'aliments : ajout possible');
    await p.click('[data-act="b92-tab"][data-v="ex"]'); await p.waitForTimeout(400);
    ok(!!(await p.$('[data-vlq]')), 'exercices & vidéos');
    await p.click('[data-act="b92-tab"][data-v="prog"]'); await p.waitForTimeout(400);
    await p.selectOption('select[data-ov92="Accumulation.t"]', 'mixte'); await p.waitForTimeout(400);
    await p.click('[data-act="b92-new"]'); await p.fill('#b92-name', 'Force 4 j test'); await p.selectOption('#b92-from', 'pb4'); await p.click('[data-act="b92-create"]'); await p.waitForTimeout(800);
    const ed = await p.evaluate(() => ({ cur: CUR, v: ST.view, n: ST.prog.sessions.length, t: document.getElementById('appTitle').textContent, ov: (ST.prog.overload.Accumulation || {}).t }));
    ok(ed.v === 'programme' && ed.n === 4 && /Force 4 j test/.test(ed.t) && ed.ov === 'mixte', 'modèle créé depuis la banque et ouvert dans l\'éditeur, avec mes principes');
    await p.evaluate(() => { ST.prog.sessions[0].name = 'Haut du corps A'; saveProg(); }); await p.waitForTimeout(200);
    await p.click('#tabs [data-act="b92-done"]'); await p.waitForTimeout(600);
    const T = await p.evaluate(() => ({ cur: CUR, v: ST.view, t: BZ.set.templates.map(t => t.name + ':' + t.prog.sessions[0].name), ov: BZ.set.ov92.ph.Accumulation.t }));
    ok(T.cur === null && T.v === 'base' && T.t.includes('Force 4 j test:Haut du corps A') && T.ov === 'mixte', 'modification enregistrée dans le modèle, retour à la base');
  }, coachPre()),

  'coach : fiches programmes (banque, tableaux, par mouvement, volume par muscle, modification)': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(() => { CUR = null; ST.view = 'base'; B92.tab = 'prog'; render(); }); await p.waitForTimeout(600);
    const n = await p.evaluate(() => bankList93().length);
    ok(n >= 20 && /Banque TB · \d+ programmes/.test(await txt(p, '#app')), `toute la banque listée (${n} programmes)`);
    await p.evaluate(() => { FI93.open['Powerbuilding'] = true; render(); }); await p.click('[data-act="fi93-open"][data-v="bank:pb4"]'); await p.waitForTimeout(500);
    const t = await txt(p, '#app');
    ok(await p.inputValue('input[data-fi93sn="0"]') === 'Upper A' && await p.inputValue('input[data-fi93x="0.0"]') === 'Développé couché barre' && await p.$$eval('table.fi93 tr', r => r.length) > 20, 'fiche : séances en tableaux');
    await p.click('[data-act="fi93-tab"][data-v="mvt"]'); await p.waitForTimeout(300);
    ok(await p.$$eval('table.mvt93 tr:first-child th', r => r.length) === 13, 'par mouvement : 12 semaines en colonnes');
    await p.click('[data-act="fi93-tab"][data-v="vol"]'); await p.waitForTimeout(300);
    ok(/Séries par muscle · S1/.test(await txt(p, '#app')) && /Pectoraux|Quadriceps|Dos/.test(await txt(p, '#app')), 'volume par muscle');
    await p.click('[data-act="fi93-tab"][data-v="ses"]'); await p.waitForTimeout(300);
    await p.fill('input[data-fi93="0.1.1.0.rpe"]', '7'); await p.press('input[data-fi93="0.1.1.0.rpe"]', 'Tab'); await p.waitForTimeout(500);
    const T = await p.evaluate(() => { const t = BZ.set.templates[BZ.set.templates.length - 1]; return { from: t.from, w1: t.prog.sessions[0].ex[1].weeks[1], src: FI93.src.kind }; });
    ok(T.from === 'pb4' && /RPE7/.test(T.w1) && T.src === 'tpl', 'modifier un programme de la banque crée ma copie (' + T.w1 + ')');
    await p.click('[data-act="fi93-w"][data-v="3"]'); await p.waitForTimeout(300);
    await p.fill('input[data-fi93="0.1.3.0.sets"]', '6'); await p.press('input[data-fi93="0.1.3.0.sets"]', 'Tab'); await p.waitForTimeout(500);
    const w3 = await p.evaluate(() => BZ.set.templates[BZ.set.templates.length - 1].prog.sessions[0].ex[1].weeks[3]);
    ok(/^6x6-8/.test(w3) && await p.$('[data-act="fi93-unforce"][data-v="0.1.3"]'), 'semaine 3 forcée (' + w3 + '), retour au calcul possible');
  }, coachPre()),

  'coach : fiches exercices (brouillon, schéma, biomécanique, validation) puis client : fiche visible seulement si validée': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(() => { CUR = null; ST.view = 'base'; B92.tab = 'ex'; VL.q = 'squat barre'; render(); }); await p.waitForTimeout(1200);
    ok(/280 fiches/.test(await txt(p, '#app')), 'carte fiches : 280 fiches');
    await p.click('[data-act="fi94-open"][data-v="Squat barre"]'); await p.waitForTimeout(400);
    const t = await txt(p, '#fi94');
    ok(/Brouillon/.test(t) && /Moment de force/.test(t) && /Courbe de résistance/.test(t) && /Sagittal/.test(t) && !!(await p.$('#fi94 svg')), 'fiche complète avec schéma, en brouillon');
    await p.click('#fi94 [data-act="fi94-ok"]'); await p.waitForTimeout(400);
    ok(sc.flags && sc.flags.v.ex['Squat barre'], 'validation enregistrée');
    await p.click('#fi94 [data-act="fi94-close"]'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.getElementById('fi94').hidden), 'fiche fermée');
  }, sc => { coachPre()(sc); sc.extra = (m, path, b) => { if (/app_flags/.test(path)) { if (m === 'POST') { sc.flags = b; return []; } return null; } }; }),
  'client : bouton Fiche seulement pour les fiches validées': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { ST.prog.sessions = [{ name: 'Séance A', day: 'Lundi', ex: [{ name: 'Squat barre', mode: 'Auto', weeks: [null, '3x5 RPE8'] }, { name: 'Leg extension', mode: 'Auto', weeks: [null, '3x12 RPE8'] }] }]; ST.prog.profile.source = 'Manuel'; recompute(); ST.todayOn = false; ST.week = 1; ST.view = 'carnet'; render(); }); await p.waitForTimeout(1500);
    const f = await p.evaluate(() => [...document.querySelectorAll('.fi94b')].map(b => b.dataset.v));
    ok(f.includes('Squat barre') && !f.includes('Leg extension'), 'fiche validée visible, brouillon caché (' + f.join(', ') + ')');
  }, sc => { clientPre()(sc); sc.extra = (m, path, b, a, t, one) => { if (/app_flags/.test(path)) return one ? { v: { all: false, ex: { 'Squat barre': '2026-10-21' } } } : [{ v: { all: false, ex: { 'Squat barre': '2026-10-21' } } }]; }; }),

  'coach : onglet Messages, répondre, modifier, copier, émoji au choix ; agenda du jour': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(() => { CUR = null; ST.view = 'clients'; render(); }); await p.waitForTimeout(300);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('#tabs button:not([hidden])')].map(b => b.textContent.trim()));
    ok(tabs[1].startsWith('Messages'), 'onglet Messages à côté de Mes clients (' + tabs.join(' · ') + ')');
    const ag = await txt(p, '#ag-card');
    ok(/Aujourd'hui ·/.test(ag) && !!(await p.$('[data-act="ag95-mode"][data-v="jour"].on')), 'agenda ouvert sur aujourd\'hui (vue Jour)');
    await p.click('[data-act="ag95-mode"][data-v="semaine"]'); await p.waitForTimeout(200);
    ok(/Agenda de la semaine/.test(await txt(p, '#ag-card')), 'bascule en vue Semaine');
    await p.click('[data-act="ag95-mode"][data-v="jour"]'); await p.waitForTimeout(100);
    await p.click('#tabs [data-v="msgs"]'); await p.waitForTimeout(800);
    const ib = await txt(p, '#app');
    ok(/Client Fictif/.test(ib) && /Tu peux regarder ma série/.test(ib) && !!(await p.$('.in95r.un .in95b')), 'conversation listée avec le dernier message et le nombre de non lus');
    await p.click('[data-act="in95-open"]'); await p.waitForTimeout(900);
    ok(await p.evaluate(() => MSG.open && !!document.querySelector('#mp-l .msg[data-mid="m1"]')), 'conversation ouverte depuis la messagerie');
    await p.click('#mp-l .msg[data-mid="m1"] .mbody'); await p.waitForTimeout(200);
    await p.click('[data-act="msg95-reply"][data-v="m1"]'); await p.waitForTimeout(200);
    ok(/Réponse à Client/.test(await txt(p, '#msgpanel')), 'bandeau « Réponse à » au-dessus de la saisie');
    await p.fill('#msg-txt', 'Oui, envoie-la'); await p.click('[data-act="msg-send"]'); await p.waitForTimeout(500);
    ok(sc.sent && sc.sent.reply_to === 'm1' && sc.sent.body === 'Oui, envoie-la', 'réponse envoyée avec le message cité');
    ok(!!(await p.$('#mp-l .mq95')), 'citation affichée dans la bulle');
    await p.click('#mp-l .msg[data-mid="m2"] .mbody'); await p.waitForTimeout(200);
    await p.click('[data-act="msg95-edit"][data-v="m2"]'); await p.waitForTimeout(200);
    ok(await p.inputValue('#msg-txt') === 'Bonjour, comment ça va ?', 'modifier : texte remis dans la saisie');
    await p.fill('#msg-txt', 'Bonjour, comment s\'est passée la séance ?'); await p.click('[data-act="msg-send"]'); await p.waitForTimeout(500);
    ok(sc.patched && sc.patched.body === 'Bonjour, comment s\'est passée la séance ?' && /modifié/.test(await txt(p, '#mp-l')), 'message modifié, mention « modifié »');
    await p.click('#mp-l .msg[data-mid="m1"] .mbody'); await p.waitForTimeout(200);
    await p.click('[data-act="rx95-more"][data-v="m1"]'); await p.waitForTimeout(200);
    await p.fill('#rx95-in', '🤙'); await p.click('[data-act="rx95-ok"]'); await p.waitForTimeout(400);
    ok(sc.rx === '🤙' && /🤙/.test(await txt(p, '#mp-l')), 'réaction avec un émoji au choix');
    await p.click('[data-act="msg-close"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => ST.view === 'msgs' && !CUR), 'fermer revient à la messagerie');
  }, sc => { coachPre()(sc); const C = sc.CID, U = sc.user.id; sc.extra = (m, path, b, a, t, one) => {
      if (t === 'messages' && m === 'GET') return [{ id: 'm2', client_id: C, sender: U, from_coach: true, body: 'Bonjour, comment ça va ?', media: [], created_at: new Date(Date.now() - 7200e3).toISOString(), read_at: new Date().toISOString(), reactions: {} }, { id: 'm1', client_id: C, sender: '00000000-0000-0000-0000-0000000000u1', from_coach: false, body: 'Tu peux regarder ma série de squat ?', media: [], created_at: new Date(Date.now() - 3600e3).toISOString(), read_at: null, reactions: {} }].sort((x, y) => /created_at\.desc/.test(path) ? (x.created_at < y.created_at ? 1 : -1) : (x.created_at < y.created_at ? -1 : 1));
      if (t === 'messages' && m === 'POST') { sc.sent = b; return one ? Object.assign({ id: 'm3', created_at: new Date().toISOString(), reactions: {} }, b) : []; }
      if (t === 'messages' && m === 'PATCH') { if (b && b.body) sc.patched = b; return []; }
      if (/rpc\/msg_react/.test(path)) { sc.rx = b.p_emoji; return { [b.p_emoji]: ['c'] }; } }; }),

  'coach : icônes des onglets, liste clients compacte avec l\'activité de la semaine': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(() => { CUR = null; ST.view = 'clients'; render(); }); await p.waitForTimeout(1200);
    const ic = await p.evaluate(() => ['msgs', 'abo', 'base'].map(v => { const b = document.querySelector(`#tabs [data-v="${v}"] svg.ic45`); return b && !/circle cx="5" cy="12"/.test(b.innerHTML); }));
    ok(ic.every(Boolean), 'Messages, Abonnés et Base de données ont leur icône (plus de « ••• »)');
    ok(!!(await p.$('#cl96 .cl96i')) && !(await p.$('#ov-card')) && !(await p.$('#app .card.ses [data-act="open"]')), 'une ligne par client, aperçu de la semaine intégré');
    ok(/Client Fictif/.test(await txt(p, '#cl96')) && /nutri \d\/7/.test(await txt(p, '#cl96')), 'activité de la semaine dans la ligne');
    ok(!(await p.$('#nc-name')), 'formulaire nouveau client replié');
    await p.click('[data-act="cl96-add"]'); await p.waitForTimeout(200); ok(!!(await p.$('#nc-name')), '« ＋ Client » ouvre le formulaire');
    await p.click('[data-act="cl96-more"]'); await p.waitForTimeout(200);
    ok(!!(await p.$('.cl96p [data-act="arch"]')) && !!(await p.$('.cl96p [data-cemail]')), '« ⋯ » : gestion du client (e-mail, archiver…)');
    await p.fill('#cl96q', 'zzz'); await p.waitForTimeout(100); ok(await p.evaluate(() => [...document.querySelectorAll('#cl96 .cl96i')].every(r => r.hidden)), 'recherche filtre la liste');
  }, coachPre()),
  'client : séances faites (récapitulatif) et notes de la séance précédente': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800);
    await p.evaluate(() => { const C = ST.carnet; C['1_0_0'] = { sets: [{ g: 60, h: 8, r: 8, d: 1, n: 'Genou qui rentre à la dernière rep' }, { g: 60, h: 7, r: 9, d: 1 }], j: 'Pieds un peu plus larges' };
      C['1_t_0'] = { start: Date.now() - 86400e3 * 6 - 3600e3, end: Date.now() - 86400e3 * 6 }; recompute(); ST.todayOn = false; ST.week = 2; ST.view = 'carnet'; render(); }); await p.waitForTimeout(600);
    const pn = await txt(p, '#app');
    ok(/Notes de la dernière fois/.test(pn) && /Genou qui rentre/.test(pn) && /Pieds un peu plus larges/.test(pn), 'notes de la séance précédente affichées sur l\'exercice');
    await p.click('[data-act="cv96-mode"][data-v="done"]'); await p.waitForTimeout(300);
    ok(/Séances faites/.test(await txt(p, '#app')) && !!(await p.$('.dn96')), 'espace « Séances faites » séparé');
    await p.click('.dn96 [data-act="cv96-open"]'); await p.waitForTimeout(200);
    const d = await txt(p, '.dn96');
    ok(/60 kg/.test(d) && /RPE 8/.test(d) && /Genou qui rentre/.test(d) && /2 séries/.test(d), 'récapitulatif : charges, reps, RPE, notes');
    await p.click('[data-act="cv96-mode"][data-v="fill"]'); await p.waitForTimeout(200);
    await p.evaluate(() => { const b = document.querySelector('.pn96 [data-act="cx-hist"]'); b && b.closest('details').setAttribute('open', ''); b && b.click(); }); await p.waitForTimeout(300);
    ok(/Historique des notes/.test(await txt(p, '#app')), 'historique complet des notes dans l\'exercice');
  }, clientPre(sc => (m, path, body, acc, t) => { if (t === 'carnet' && m === 'POST') return []; })),

  'coach : le logo ramène à tous mes clients': () => run('coach', async (p, sc) => {
    await p.waitForTimeout(1000); await p.evaluate(id => openClient(id), sc.CID); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => !!CUR && ST.view !== 'clients'), 'dossier client ouvert');
    const r = await p.evaluate(() => { const b = document.getElementById('appTitle').getBoundingClientRect(); return { x: b.left + 18, y: b.top + b.height / 2 }; });
    await p.mouse.click(r.x, r.y); await p.waitForTimeout(800);
    ok(await p.evaluate(() => !CUR && ST.view === 'clients' && !!document.getElementById('cl96')), 'toucher le logo : retour à la liste de tous les clients');
  }, coachPre()),

  'client : macros de chaque aliment et répartition du jour par aliment': () => run('client', async (p, sc) => {
    await p.waitForTimeout(800); await p.evaluate(() => { ST.todayOn = false; ST.view = 'nutrition'; NU.nv = 'jour'; NU.day = todayISO(); render(); }); await p.waitForTimeout(500);
    // Déjeuner prévu : poulet 150 g (23 g P/100 g) = 35 g de protéines, riz 200 g (3 g P/100 g) = 6 g
    const li = await p.evaluate(() => [...document.querySelectorAll('.card.meal')][1].querySelector('ul.its').innerText);
    ok(/P 35/.test(li) && /P 6 /.test(li), 'chaque aliment du repas prévu affiche ses macros (' + li.replace(/\n/g, ' | ') + ')');
    await p.click('[data-act="nu-ok"][data-v="1"]'); await p.waitForTimeout(400);
    const lg = await p.evaluate(() => [...document.querySelectorAll('.card.meal')][1].innerText);
    ok(/P 35/.test(lg), 'repas noté : macros sous chaque aliment');
    await p.evaluate(() => { document.getElementById('src98').open = true; }); await p.waitForTimeout(100);
    const sr = await txt(p, '#src98');
    ok(/Protéines mangés : 41 g/.test(sr) && /Blanc de poulet \(cru\)[\s\S]*35 g[\s\S]*85 %/.test(sr), 'répartition : 35 g sur 41 g viennent du poulet (85 %)');
    await p.click('[data-act="src98"][data-v="g"]'); await p.waitForTimeout(200);
    ok(/Glucides mangés : 56 g/.test(await txt(p, '#src98')), 'bascule sur les glucides');
  }, clientPre(sc => (m, path, b, a, t) => { if (t === 'nutri_log' && m === 'POST') return []; })),

  'client : menus qui restent à l\'écran, scanner plein écran, photo depuis la pellicule, créer un aliment': () => run('client', async (p, sc) => {
    await p.click('nav.tabs [data-v="nutrition"]'); await p.waitForTimeout(1200);
    const x = p.locator('#app [data-act="nu-xopen"]'); await x.scrollIntoViewIfNeeded(); await x.click(); await p.waitForTimeout(600);
    const box = await p.evaluate(() => { const c = document.querySelector('#app [data-act="nu-xscan"]').closest('.card').getBoundingClientRect(); return { top: c.top, bottom: c.bottom, h: innerHeight }; });
    ok(box.top >= 60 && box.bottom <= box.h - 60, `panneau Extras ouvert entièrement visible (haut ${Math.round(box.top)}, bas ${Math.round(box.bottom)})`);
    ok(/Crée-le avec son étiquette/.test(await txt(p, '#nu-xres')), 'bouton « créer un aliment » visible sans recherche');
    await p.click('#nu-xres [data-act="nf85-new"]'); await p.waitForTimeout(300);
    ok(!!(await p.$('#nf85 [data-nf85="name"]')), 'formulaire « Nouvel aliment » ouvert');
    await p.click('[data-act="nf85-cancel"]'); await p.waitForTimeout(200);
    await p.click('#app [data-act="nu-xscan"]'); await p.waitForTimeout(500);
    const sc99 = await p.evaluate(() => { const o = document.getElementById('scan99'); if (!o || o.hidden) return null; const r = o.getBoundingClientRect(), v = document.getElementById('scan-v').getBoundingClientRect(); return { top: r.top, h: r.height, vt: v.top, ih: innerHeight }; });
    ok(sc99 && sc99.top === 0 && sc99.h === sc99.ih && sc99.vt < 120, 'scanner en plein écran, caméra visible en haut de l\'écran sans défiler');
    ok(!(await p.$('#app #scan-v')), 'plus de scanner coincé dans la page');
    await p.click('#scan99 [data-act="scan-stop"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.getElementById('scan99').hidden), 'scanner fermé');
    ok(await p.evaluate(() => { const f = phInput62(); return !!f && !f.hasAttribute('capture'); }), 'photo de repas : appareil photo OU pellicule (pas de capture forcée)');
  }, clientPre()),

  'fiches : schéma propre à l\'exercice (back extension ≠ soulevé de terre)': () => run('coach', async (p) => {
    await p.evaluate(() => fiShow94('45° back extension (focus ischios)')); await p.waitForTimeout(1500);
    const t = await p.evaluate(() => document.querySelector('#fi94 svg').getAttribute('aria-label'));
    ok(t === 'Schéma : back_ext', 'back extension : schéma back_ext (' + t + ')');
    await p.evaluate(() => fiShow94('Pompes')); await p.waitForTimeout(300);
    ok((await p.evaluate(() => document.querySelector('#fi94 svg').getAttribute('aria-label'))) === 'Schéma : pushup', 'pompes : schéma pushup');
    await p.evaluate(() => fiShow94('Soulevé de terre')); await p.waitForTimeout(300);
    ok((await p.evaluate(() => document.querySelector('#fi94 svg').getAttribute('aria-label'))) === 'Schéma : hinge', 'soulevé de terre : schéma de la famille');
  }, coachPre()),

};

(async () => {
  for (const [name, fn] of Object.entries(T)) { if (process.env.ONLY && !name.includes(process.env.ONLY)) continue; console.log('▶', name); try { await fn(); } catch (e) { fails++; console.log('  ✗', e.message.split('\n')[0]); } }
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`); process.exit(fails ? 1 : 0);
})();
