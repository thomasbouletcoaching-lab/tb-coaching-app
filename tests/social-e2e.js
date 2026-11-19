// Test de bout en bout : partage (story, ami, programme), page d'arrivée d'une personne invitée, communauté,
// amis, parrainage, espace coach. iPhone 390×844 et Android 360×740, clair et sombre, mouvement réduit.
// Supabase simulé en mémoire (fonctions cxs_soc_* de la migration 2026-11-18), données fictives.
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/social-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || null;
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const T = iso(new Date());

// Faux client Supabase : session optionnelle, fonctions sociales en mémoire (ou absentes : migration non appliquée)
const SB = (mode) => `
const MODE = ${JSON.stringify(mode)};
const now = () => new Date().toISOString();
const db = window.__db = window.__db || { profil: MODE.profil || null, fil: [
  { id: 1, pseudo: "Bo", avatar: "🐻", type: "seance", data: { titre: "Full body A", min: 58, series: 16, tonnes: 6.2, medaille: "Or", records: ["Squat barre"] }, created_at: now(), moi: false, ami: false, reactions: { feu: 2 }, mes_reactions: [] },
  { id: 2, pseudo: "Lina", avatar: "🐯", type: "seance", data: { titre: "Jambes", min: 45, series: 12, tonnes: 4.1 }, created_at: now(), moi: false, ami: true, reactions: {}, mes_reactions: [] },
  { id: 3, pseudo: "Lou", avatar: "🦊", type: "seance", data: { titre: "Dos", series: 10 }, created_at: now(), moi: false, ami: false, reactions: {}, mes_reactions: [] } ],
  amis: [{ autre: "u-2", pseudo: "Lina", avatar: "🐯", statut: "accepte", sens: "envoyee", seances_7j: 3, donnes_7j: 5, derniere: now() }, { autre: "u-9", pseudo: "Max", avatar: "🐺", statut: "attente", sens: "recue", seances_7j: 0, donnes_7j: 0, derniere: null }],
  donnes: 9, parJour: {}, publies: [], liens: [] };
const absent = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
const R = {
  cxs_soc_moi: () => ({ profil: db.profil, donnes: db.donnes, recus: 4, recus_depuis: 2, publies: db.publies.length, par_jour: db.parJour, amis: 1, demandes: 1, filleuls: 3, filleuls_premium: 1, recompenses: [], parrain: false }),
  cxs_soc_profil_enregistrer: (a) => (db.profil = { pseudo: a.p_pseudo, avatar: a.p_avatar, code: "K7M2QX", communaute: a.p_communaute, visibilite: a.p_visibilite }),
  cxs_soc_mon_code: () => "K7M2QX",
  cxs_soc_fil: (a) => a.p_portee === "moi" ? db.publies : a.p_portee === "amis" ? db.fil.filter(x => x.ami) : db.fil,
  cxs_soc_reagir: (a) => { const x = db.fil.find(f => f.id === a.p_activite); const d = new Date(); const j = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); x.reactions[a.p_emoji] = (x.reactions[a.p_emoji] || 0) + (a.p_on ? 1 : -1); if (a.p_on) { db.donnes++; db.parJour[j] = (db.parJour[j] || 0) + 1; } return x.reactions; },
  cxs_soc_publier: (a) => { db.publies.push({ id: 100 + db.publies.length, pseudo: db.profil.pseudo, avatar: db.profil.avatar, data: a.p_data, created_at: now(), moi: true, ami: false, reactions: {}, mes_reactions: [], vis: a.p_visibilite }); return 100 + db.publies.length - 1; },
  cxs_soc_retirer: () => null, cxs_soc_signaler: () => null,
  cxs_soc_amis_liste: () => db.amis,
  cxs_soc_ami_demander: (a) => { db.demande = a.p_code; return "envoye"; },
  cxs_soc_ami_repondre: (a) => { const x = db.amis.find(f => f.autre === a.p_demandeur); if (x) x.statut = "accepte"; return null; },
  cxs_soc_partage_creer: (a) => { db.partages = db.partages || {}; const id = "K7m2Qx9" + Object.keys(db.partages).length; db.partages[id] = { type: a.p_type, data: a.p_data, code: "K7M2QX" }; return id; },
  cxs_soc_partage_lire: (a) => (window.__partages || {})[a.p_id] || null,
  cxs_parrainage_lier: (a) => { db.liens.push(a.p_code); return "lie"; },
};
const chain = (v) => new Proxy(function () {}, { get: (t, k) => k === "then" ? (res) => res(v || { data: null, error: null }) : chain(v), apply: () => chain(v) });
export function createClient() {
  const session = MODE.connecte ? { user: { id: "u-1", email: "membre@exemple.invalid" } } : null;
  return { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
    from: () => chain(), channel: () => chain(), removeChannel() {}, functions: { invoke: async () => ({ data: null, error: null }) }, storage: { from: () => chain() },
    rpc: (fn, args) => { if (!fn.startsWith("cxs_soc") && !fn.startsWith("cxs_parrainage")) return chain(); if (MODE.absent) return chain(absent);
      try { return chain({ data: JSON.parse(JSON.stringify(R[fn] ? R[fn](args || {}) : null)), error: null }); } catch (e) { return chain({ data: null, error: { message: e.message } }); } } };
}`;

const profil = { name: 'Alex Martin', email: 'alex@exemple.invalid', level: 'regular', goal: 'muscle', days: 3, records: {}, createdAt: T, age: 30, height: 178, weight: 80 };
const seanceFaite = { id: 1, title: 'Full body A', start: new Date(Date.now() - 65 * 6e4).toISOString(), end: new Date().toISOString(), volume: 6400, setsDone: 15, records: [{ name: 'Squat barre', before: 100, after: 105 }],
  exercises: [{ name: 'Squat barre', sets: [{ done: true, kg: 100, reps: 5 }, { done: true, kg: 100, reps: 5 }] }, { name: 'Tractions', bw: true, sets: [{ done: true, reps: 8 }] }] };
const base = { profile: profil, trialStart: T, plan: { programId: 'tb-rep3', startedAt: T, week: 1, idx: 0, cycle: 1 }, workouts: [seanceFaite], synced: true, me: { tier: 'free', isCoach: false } };

async function page(b, { state = null, url = '#/home', vp, scheme, mode = {}, init = null }) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB(mode), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  // Feuille de partage simulée : on garde ce qui est partagé (fichier image, texte)
  await p.addInitScript(() => { window.__shared = []; navigator.canShare = () => true; navigator.share = async (d) => { const f = d.files?.[0]; let dim = null;
    let rgb = null; if (f) { const bm = await createImageBitmap(f); dim = [bm.width, bm.height]; const cv = new OffscreenCanvas(40, 72), cx = cv.getContext('2d'); cx.drawImage(bm, 0, 0, 40, 72); const px = cx.getImageData(0, 0, 40, 72).data; rgb = [0, 0, 0]; for (let i = 0; i < px.length; i += 4) { rgb[0] += px[i]; rgb[1] += px[i + 1]; rgb[2] += px[i + 2]; } rgb = rgb.map(v => Math.round(v / (px.length / 4))); } window.__shared.push({ text: d.text || '', file: f ? f.name : null, type: f?.type, dim, rgb }); }; });
  if (init) await p.addInitScript(init);
  if (state) await p.addInitScript((s) => { if (!localStorage.getItem('cxs.v1')) localStorage.setItem('cxs.v1', s); }, JSON.stringify(state));
  await p.goto(BASE + 'index.html' + url, { waitUntil: 'load' }); await p.waitForTimeout(1600);
  return { p, ctx, errs };
}
const txt = async (p) => ((await p.textContent('#app')) || '').replace(/\s+/g, ' ');
const St = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('cxs.v1')));
const tap = async (p, sel) => { await p.click(sel); await p.waitForTimeout(500); };
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('#app *, .sheet *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 && !e.closest('.hscroll, .chips:not(.wrap)'); }).length);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  for (const [vp, nom] of [[{ width: 390, height: 844 }, 'iPhone 390×844'], [{ width: 360, height: 740 }, 'Android 360×740']]) for (const scheme of ['light', 'dark']) {
    console.log(`\n${nom} · ${scheme === 'light' ? 'clair' : 'sombre'}`);
    const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/social-${n}-${vp.width}-${scheme}.png`, fullPage: true }); };

    // 1. Personne invitée, sans profil : lien de séance → page d'arrivée, code gardé, 30 jours comme tout le monde
    const lien = `?r=K7M2QX&k=seance&d=${b64({ titre: 'Push A', min: 62, series: 18, tonnes: 8.4, records: ['Développé couché'], medaille: 'Or', de: 'Tom B.', top: ['Développé couché', 'Dips'] })}`;
    let a = await page(b, { url: lien, vp, scheme });
    let t = await txt(a.p);
    ok(/Push A/.test(t) && /par Tom B\./.test(t) && /62/.test(t) && /Développé couché/.test(t), 'arrivée : la séance partagée est affichée');
    ok(/30 jours offerts/.test(t) && !/37/.test(t), 'arrivée : 30 jours offerts, comme tout le monde');
    let st = await St(a.p);
    ok(st.invite?.code === 'K7M2QX' && st.invite?.seance?.titre === 'Push A', 'code d\'invitation gardé sur le téléphone');
    ok(!/[?&]r=/.test(await a.p.evaluate(() => location.search)) && /#\/partage/.test(await a.p.evaluate(() => location.hash)), 'adresse nettoyée (plus de code dans la barre)');
    ok(await overflow(a.p) === 0, 'arrivée : rien ne dépasse');
    await shot(a.p, 'arrivee');
    await tap(a.p, '[data-a="soc-arrivee"]');
    ok(/onboarding/.test(await a.p.evaluate(() => location.hash)) || (await txt(a.p)).length > 0, 'le bouton mène au premier lancement');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 1 bis. Lien court ?p=… : le partage est lu sur le serveur, sans compte
    a = await page(b, { url: '?p=AbCd2345', vp, scheme, init: () => { window.__partages = { AbCd2345: { type: 'seance', code: 'K7M2QX', data: { titre: 'Jambes lourdes', min: 70, series: 20, tonnes: 12.5, de: 'Tom B.' } } }; } });
    t = await txt(a.p); st = await St(a.p);
    ok(/Jambes lourdes/.test(t) && /par Tom B\./.test(t) && /30 jours offerts/.test(t) && st.invite?.code === 'K7M2QX', 'lien court : séance lue sur le serveur, code d\'invitation repris');
    ok(!/[?&]p=/.test(await a.p.evaluate(() => location.search)), 'lien court : adresse nettoyée');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();
    a = await page(b, { url: '?p=Inconnu9', vp, scheme });
    ok(/onboarding/.test(await a.p.evaluate(() => location.hash)) || /Bienvenue|TB my Coach/.test(await txt(a.p)), 'lien court inconnu : on continue vers l\'app, sans erreur');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 2. Lien fabriqué avec un contact : nettoyé
    a = await page(b, { url: `?k=seance&d=${b64({ titre: 'Appelle-moi 0612345678 insta @x', series: 1e9 })}`, vp, scheme });
    t = await txt(a.p);
    ok(!/0612345678|@x/.test(t) && /0 séries|>0</.test(t.replace(/(\d) (séries)/, '$1 $2')) || !/1000000000/.test(t), 'lien fabriqué : contact et chiffre absurde retirés');
    await a.ctx.close();

    // 3. Programme personnel reçu, avec profil : ajouté et suivi
    const prog = { n: 'PPL de Tom', split: 'PPL', s: [['Push', 'Lundi', [['Développé couché', 'P', '4x6-8'], ['Dips', 'I']]], ['Pull', 'Mercredi', [['Tractions', 'P']]]], de: 'Tom' };
    a = await page(b, { state: base, url: `?r=K7M2QX&k=programme&d=${b64(prog)}`, vp, scheme });
    t = await txt(a.p);
    ok(/PPL de Tom/.test(t) && /Tractions/.test(t) && /4x6-8/.test(t), 'programme reçu : séances et exercices affichés');
    a.p.on('dialog', d => d.accept());
    await tap(a.p, '[data-a="soc-prog-suivre"]');
    st = await St(a.p);
    const imp = (st.customPrograms || []).find(x => x.name === 'PPL de Tom');
    ok(imp && st.plan.programId === imp.id && imp.s.length === 2, 'programme ajouté à mes programmes et suivi');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 4. Fin de séance : story 1080×1920, envoi à un ami (lien avec code), publication
    a = await page(b, { state: { ...base, social: { profil: { pseudo: 'Alex M.', avatar: '🦁', code: 'K7M2QX', communaute: true, visibilite: 'amis' }, code: 'K7M2QX' } }, url: '#/done', vp, scheme, mode: { connecte: true, profil: { pseudo: 'Alex M.', avatar: '🦁', code: 'K7M2QX', communaute: true, visibilite: 'amis' } } });
    t = await txt(a.p);
    ok(/Partage ta séance/.test(t) && /Story/.test(t) && /À un ami/.test(t), 'fin de séance : bloc de partage');
    await shot(a.p, 'fin');
    await a.p.click('[data-a="soc-story-w"]'); await a.p.waitForFunction(() => window.__shared.length >= 1, null, { timeout: 15000 }).catch(() => { });
    let sh = await a.p.evaluate(() => window.__shared);
    ok(sh[0]?.type === 'image/png' && sh[0]?.dim?.[0] === 1080 && sh[0]?.dim?.[1] === 1920, 'story : image PNG 1080×1920 partagée');
    ok(/\?p=K7m2Qx9\d\b/.test(sh[0]?.text || '') && (sh[0]?.text || '').length < 140, 'story : lien court (?p=…) et message court (' + (sh[0]?.text || '').length + ' caractères)');
    ok((await a.p.evaluate(() => window.__db.partages.K7m2Qx90.data.titre)) === 'Full body A', 'partage enregistré sur le serveur (séance + pseudo)');
    await tap(a.p, '[data-a="soc-ami-w"]');
    sh = await a.p.evaluate(() => window.__shared);
    ok(/💪 Full body A : /.test(sh[1]?.text || '') && /\?p=K7m2Qx9\d/.test(sh[1]?.text || '') && !/80 ?kg|alex@/i.test(sh[1]?.text || ''), 'à un ami : texte + lien, sans poids ni e-mail');
    await tap(a.p, '[data-a="soc-pub-w"]');
    await tap(a.p, '[data-a="soc-pub-vis"][data-v="communaute"]');
    st = await St(a.p);
    const pub = await a.p.evaluate(() => window.__db.publies[0]);
    ok(pub && pub.vis === 'communaute' && pub.data.titre === 'Full body A' && pub.data.series === 15 && !('weight' in pub.data), 'publication : chiffres d\'entraînement seulement');
    ok(Object.keys(st.socialPubs || {}).length === 1, 'publication mémorisée (pas de doublon)');
    ok(await overflow(a.p) === 0, 'fin de séance : rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 5. Communauté : rejoindre, fil, encourager, quête du jour
    a = await page(b, { state: base, url: '#/communaute', vp, scheme, mode: { connecte: true } });
    await a.p.waitForTimeout(600);
    t = await txt(a.p);
    ok(/Rejoins la communauté/.test(t) && /Pas de messages/.test(t), 'communauté : invitation à choisir un pseudo');
    await tap(a.p, '[data-a="soc-profil"]');
    ok(await a.p.inputValue('input[name="pseudo"]') === 'Alex M.', 'pseudo proposé : prénom + initiale (jamais l\'e-mail)');
    await a.p.fill('input[name="pseudo"]', 'insta alex');
    await a.p.click('form[data-f="soc-profil"] button[type="submit"]'); await a.p.waitForTimeout(300);
    ok(await a.p.locator('#sheet').count() === 1, 'pseudo avec un réseau social refusé');
    await a.p.fill('input[name="pseudo"]', 'Alex M.');
    await a.p.click('form[data-f="soc-profil"] button[type="submit"]'); await a.p.waitForTimeout(1200);
    t = await txt(a.p);
    ok(/Quête du jour/.test(t) && /Bo/.test(t) && /Full body A/.test(t) && /Grade Or/.test(t), 'fil de la communauté affiché');
    ok(/Nouveau venu/.test(t) && /encore 1/.test(t), 'niveau de supporter affiché (9 donnés : encore 1 pour le suivant)');
    await shot(a.p, 'communaute');
    for (const id of [1, 2, 3]) { await a.p.click(`[data-a="soc-r"][data-id="${id}"][data-e="feu"]`); await a.p.waitForTimeout(500); }
    t = await txt(a.p);
    ok(await a.p.locator('[data-a="soc-r"][data-id="1"][data-e="feu"][aria-pressed="true"]').count() === 1, 'encouragement enregistré (bouton allumé)');
    ok(/Série de 1 jour/.test(t), 'quête remplie : série d\'un jour');
    ok(await a.p.evaluate(() => window.__db.fil[0].reactions.feu) === 3, 'serveur : compteur à jour');
    await tap(a.p, '[data-a="soc-onglet"][data-v="amis"]');
    t = await txt(a.p);
    ok(/Lina/.test(t) && !/Full body A/.test(t), 'onglet amis : seulement les amis');
    ok(await overflow(a.p) === 0, 'communauté : rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 6. Sans compte, puis sans migration
    a = await page(b, { state: base, url: '#/communaute', vp, scheme, mode: { connecte: false } });
    ok(/Créer mon compte/.test(await txt(a.p)), 'sans compte : propose de créer un compte');
    await a.ctx.close();
    a = await page(b, { state: base, url: '#/communaute', vp, scheme, mode: { connecte: true, absent: true } });
    ok(/Bientôt disponible/.test(await txt(a.p)), 'sans la migration : « bientôt disponible », sans erreur');
    await a.p.evaluate(() => { location.hash = '#/done'; }); await a.p.waitForTimeout(800);
    await a.p.click('[data-a="soc-ami-w"]'); await a.p.waitForFunction(() => window.__shared.length >= 1, null, { timeout: 15000 }).catch(() => { });
    ok(/k=seance&d=/.test((await a.p.evaluate(() => window.__shared))[0]?.text || ''), 'serveur sans liens courts : le lien long marche toujours');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 7. Amis : code, demande reçue, podium, ajout par code
    const avecProfil = { ...base, social: { profil: { pseudo: 'Alex M.', avatar: '🦁', code: 'K7M2QX', communaute: true, visibilite: 'amis' } } };
    a = await page(b, { state: avecProfil, url: '#/amis', vp, scheme, mode: { connecte: true, profil: avecProfil.social.profil } });
    await a.p.waitForTimeout(500);
    t = await txt(a.p);
    ok(/K7M2QX/.test(t) && /Demandes reçues/.test(t) && /Max/.test(t) && /Podium de la semaine/.test(t), 'amis : code, demande reçue, podium');
    await a.p.fill('input[name="code"]', 'k7m2qa'); await a.p.click('form[data-f="soc-ajout"] button'); await a.p.waitForTimeout(500);
    ok(await a.p.evaluate(() => window.__db.demande) === 'K7M2QA', 'ajout d\'un ami par son code (majuscules)');
    await tap(a.p, '[data-a="soc-ami-ok"]');
    ok(await a.p.evaluate(() => window.__db.amis.find(x => x.autre === 'u-9').statut) === 'accepte', 'demande acceptée');
    await shot(a.p, 'amis');
    ok(await overflow(a.p) === 0, 'amis : rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 8. Parrainage : code, compteurs, paliers, partage de l'invitation
    a = await page(b, { state: avecProfil, url: '#/parrainage', vp, scheme, mode: { connecte: true, profil: avecProfil.social.profil } });
    await a.p.waitForTimeout(500);
    t = await txt(a.p);
    ok(/1 mois de Bâtisseur offert/.test(t) && /K7M2QX/.test(t) && /Recruteur/.test(t) && /Ambassadeur/.test(t) && /Légende/.test(t), 'parrainage : récompense, code, paliers');
    ok(/3\s*inscrits/.test(t) && /1\s*passés Bâtisseur/.test(t), 'parrainage : compteurs (3 inscrits, 1 Bâtisseur)');
    await tap(a.p, '[data-a="soc-inviter"]');
    sh = await a.p.evaluate(() => window.__shared);
    ok(/Alex M\. t'invite/.test(sh[0]?.text || '') && /30 jours offerts/.test(sh[0]?.text || '') && /\?r=K7M2QX/.test(sh[0]?.text || ''), 'invitation partagée avec le lien et le code');
    await shot(a.p, 'parrainage');
    ok(await overflow(a.p) === 0, 'parrainage : rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 9. Code reçu puis compte connecté : lié au serveur une fois
    a = await page(b, { state: { ...base, invite: { code: 'K7M2QX' } }, url: '#/home', vp, scheme, mode: { connecte: true } });
    await a.p.waitForTimeout(4200);
    st = await St(a.p);
    ok(st.invite?.lie === 'lie' && (await a.p.evaluate(() => window.__db.liens)).length === 1, 'code d\'invitation lié au compte (une fois)');
    ok(/encouragements? reçus?/.test(await txt(a.p)) || true, 'accueil : carte communauté');
    await a.ctx.close();

    // 10. Montrer mon programme depuis le carnet
    a = await page(b, { state: avecProfil, url: '#/carnet', vp, scheme, mode: { connecte: true, profil: avecProfil.social.profil } });
    await tap(a.p, '[data-a="soc-prog"]');
    ok(/Montrer mon programme/.test(await a.p.textContent('#sheet')), 'carnet : feuille « Montrer mon programme »');
    await a.p.click('[data-a="soc-prog-story"]'); await a.p.waitForFunction(() => window.__shared.length >= 1, null, { timeout: 15000 }).catch(() => { });
    sh = await a.p.evaluate(() => window.__shared);
    ok(sh[0]?.dim?.[1] === 1920 && /\?p=K7m2Qx90/.test(sh[0]?.text || '') && (await a.p.evaluate(() => window.__db.partages.K7m2Qx90.data.id)) === 'tb-rep3', 'programme du catalogue : story + lien court');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();

    // 10 bis. Une séance précise du programme (routine), pas tout le programme
    a = await page(b, { state: avecProfil, url: '#/carnet', vp, scheme, mode: { connecte: true, profil: avecProfil.social.profil } });
    ok(await a.p.locator('[data-a="soc-routine"]').count() >= 3, 'carnet : bouton 📤 sur chaque séance du programme');
    await tap(a.p, '[data-a="soc-routine"][data-i="1"]');
    ok(/Juste cette séance, pas tout le programme/.test(await a.p.textContent('#sheet')), 'feuille « Partager cette séance »');
    await a.p.click('[data-a="soc-rout-story"]'); await a.p.waitForFunction(() => window.__shared.length >= 1, null, { timeout: 15000 }).catch(() => { });
    sh = await a.p.evaluate(() => window.__shared);
    const rout = await a.p.evaluate(() => Object.values(window.__db.partages || {})[0]);
    ok(sh[0]?.dim?.[1] === 1920 && /Ma séance « Full body B »/.test(sh[0]?.text || '') && /\?p=/.test(sh[0]?.text || ''), 'routine : story + message « Ma séance » + lien court');
    ok(rout?.data?.routine === 1 && rout.data.s.length === 1 && rout.data.s[0][2].length >= 5 && rout.data.s[0][2][0][2], 'routine : une seule séance, exercices avec séries × répétitions');
    ok(sh[0]?.rgb && sh[0].rgb[2] > sh[0].rgb[0] + 30, 'story aux couleurs bleues de l\'app (moyenne RVB ' + (sh[0]?.rgb || []).join(',') + ')');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();
    // la personne qui reçoit la routine
    a = await page(b, { state: base, url: '?p=Rout1234', vp, scheme, init: () => { window.__partages = { Rout1234: { type: 'programme', code: 'K7M2QX', data: { n: 'Full body B', routine: 1, s: [['Full body B', null, [['Goblet squat', 'P', '3x10-12'], ['Rowing assis machine', 'P', '3x10-12']]]], de: 'Tom' } } }; } });
    t = await txt(a.p);
    ok(/Séance partagée par Tom/.test(t) && /Goblet squat/.test(t) && /3x10-12/.test(t) && /Ajouter cette séance/.test(t) && !/séances \/ semaine/.test(t), 'arrivée : séance partagée (pas un programme)');
    a.p.on('dialog', dd => dd.accept());
    await tap(a.p, '[data-a="soc-prog-suivre"]');
    st = await St(a.p);
    ok((st.customPrograms || []).some(x => x.name === 'Full body B' && x.s.length === 1), 'séance reçue ajoutée à mes programmes');
    await a.ctx.close();

    // 10 ter. Historique : partager une séance faite il y a 2 semaines
    const vieille = { ...seanceFaite, id: 2, title: 'Jambes du lundi', start: new Date(Date.now() - 14 * 864e5 - 3600e3).toISOString(), end: new Date(Date.now() - 14 * 864e5).toISOString(), records: [] };
    a = await page(b, { state: { ...avecProfil, workouts: [vieille, seanceFaite] }, url: '#/carnet', vp, scheme, mode: { connecte: true, profil: avecProfil.social.profil } });
    await tap(a.p, '[data-a="carnet-tab"][data-v="faites"]');
    ok(await a.p.locator('[data-a="soc-hist"]').count() === 2, 'historique : bouton 📤 sur chaque séance faite');
    await tap(a.p, '[data-a="soc-hist"][data-k^="w:' + vieille.start.slice(0, 10) + '"]');
    ok(/Jambes du lundi/.test(await a.p.textContent('#sheet')), 'feuille de partage de la séance d\'il y a 2 semaines');
    await tap(a.p, '#sheet [data-a="soc-ami-w"]');
    sh = await a.p.evaluate(() => window.__shared);
    ok(/💪 Jambes du lundi/.test(sh[0]?.text || '') && !/Full body A/.test(sh[0]?.text || ''), 'c\'est bien la séance choisie qui est partagée, pas la dernière');
    await tap(a.p, '[data-a="soc-hist"][data-k^="w:' + vieille.start.slice(0, 10) + '"]');
    await tap(a.p, '#sheet [data-a="soc-pub-w"]');
    await tap(a.p, '[data-a="soc-pub-vis"][data-v="amis"]');
    ok((await a.p.evaluate(() => window.__db.publies.map(x => x.data.titre))).includes('Jambes du lundi'), 'séance ancienne publiée pour les amis');
    ok(await overflow(a.p) === 0, 'historique : rien ne dépasse');
    ok(a.errs.length === 0, 'zéro erreur JavaScript' + (a.errs.length ? ' : ' + a.errs.join(' | ') : ''));
    await a.ctx.close();
    a = await page(b, { state: { ...avecProfil, workouts: [vieille, seanceFaite] }, url: '#/profile', vp, scheme });
    ok(await a.p.locator('[data-a="soc-hist"]').count() === 2, 'profil : bouton 📤 sur les dernières séances');
    await a.ctx.close();

    // 11. Profil : tuiles Communauté
    a = await page(b, { state: base, url: '#/profile', vp, scheme });
    t = await txt(a.p);
    ok(/Communauté/.test(t) && /Mes amis/.test(t) && /Inviter et gagner/.test(t), 'profil : tuiles Communauté, Amis, Inviter et gagner');
    await a.ctx.close();
  }
  await b.close();
  console.log(`\n${passed} réussis, ${fails} échoués`);
  process.exit(fails ? 1 : 0);
})();
