// Test de bout en bout de l'onglet Business → Objectif (espace coach, iPhone 390×844, Supabase simulé, données fictives).
// Lancement : servir la racine du dépôt sur BASE_URL (par défaut http://localhost:8765/), puis `node tests/objectif-e2e.js`.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const SHOTS = process.env.SHOTS_DIR || require('os').tmpdir();
let fails = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('  ✓', msg); } else { fails++; console.log('  ✗', msg); } };

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date(), today = iso(now);
const shift = (days) => { const d = new Date(now); d.setDate(d.getDate() + days); return iso(d); };
const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
const future = shift(400);
const monthEnd = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

const DATA = {
  coach: { id: 'c0ac', email: 'coach@exemple.fr', name: 'Coach Fictif', tier: 'free', is_coach: true },
  members: [
    { id: 'm1', email: 'a@exemple.fr', name: 'Abonné Un', tier: 'premium', created_at: today + 'T08:00:00Z', last_seen: today + 'T08:00:00Z', onboarding: {}, stats: {} },
    { id: 'm2', email: 'b@exemple.fr', name: 'Abonné Deux', tier: 'essentiel', created_at: today + 'T08:00:00Z', last_seen: today + 'T08:00:00Z', onboarding: {}, stats: {} },
    { id: 'm3', email: 'c@exemple.fr', name: 'Client Cycle', tier: 'suivi', created_at: today + 'T08:00:00Z', last_seen: today + 'T08:00:00Z', onboarding: {}, stats: {} },
    { id: 'm4', email: 'd@exemple.fr', name: 'Accès Offert', tier: 'premium', tier_until: future, created_at: today + 'T08:00:00Z', last_seen: today + 'T08:00:00Z', onboarding: {}, stats: {} },
  ],
  biz: {
    payments: [
      { id: 1, who: 'Client Cycle', amount: 540, d: monthStart, label: 'Cycle · mois 1/3', paid: true },
      { id: 2, who: 'Client Cycle', amount: 540, d: monthEnd, label: 'Cycle · mois 2/3', paid: false },
      { id: 3, who: 'Autre', amount: 89, d: shift(-40), label: 'Coaching', paid: false },
    ],
    cycles: [{ id: 10, who: 'Client Cycle', offer: 'custom', label: 'Cycle 12 semaines', start: shift(-10), weeks: 12, price: 540, split: 'mois' }],
    settings: {},
  },
  leads: [
    { id: 101, created_at: shift(-2) + 'T10:00:00Z', name: 'Prospect Reel', email: 'p1@exemple.fr', phone: null, status: 'nouveau', data: { origine: 'site', demande: 'candidature', src: 'reel-1rm', goal: 'Force' } },
    { id: 102, created_at: shift(-5) + 'T10:00:00Z', name: 'Prospect Bio', email: 'p2@exemple.fr', phone: '0600000000', status: 'appel prévu', data: { origine: 'site', demande: 'candidature', src: 'bio' } },
    { id: 103, created_at: shift(-20) + 'T10:00:00Z', name: 'Client Signé', email: 'p3@exemple.fr', status: 'client', data: { origine: 'site', demande: 'candidature', src: 'reel-1rm' } },
    { id: 104, created_at: shift(-30) + 'T10:00:00Z', name: 'Pas Pour Lui', email: 'p4@exemple.fr', status: 'pas pour moi', data: { origine: 'site', demande: 'calculateur' } },
  ],
};

// Faux client Supabase (module ES servi à la place du CDN) : renvoie les données ci-dessus selon la table
const SB = (data) => `const D = ${JSON.stringify(data)}; window.__writes = [];
function q(table) {
  const st = { table, single: false, filters: [], op: 'select', body: null };
  const res = () => {
    if (st.op !== 'select') { window.__writes.push({ table, op: st.op, body: st.body, filters: st.filters }); return { data: null, error: null }; }
    if (table === 'cxs_profiles') return { data: st.single ? D.coach : [D.coach].concat(D.members), error: null };
    if (table === 'cxs_coach_store') return { data: [{ key: 'biz', value: D.biz }], error: null };
    if (table === 'leads') return { data: D.leads, error: null };
    return { data: st.single ? null : [], error: null };
  };
  const b = new Proxy({}, { get: (t, k) => {
    if (k === 'then') return (ok, ko) => Promise.resolve(res()).then(ok, ko);
    if (k === 'maybeSingle' || k === 'single') return () => { st.single = true; return b; };
    if (k === 'update' || k === 'upsert' || k === 'insert' || k === 'delete') return (body) => { st.op = k; st.body = body; return b; };
    if (k === 'eq') return (c, v) => { st.filters.push([c, v]); return b; };
    return () => b;
  } });
  return b;
}
const session = { access_token: 't', user: { id: D.coach.id, email: D.coach.email } };
export function createClient() { return {
  auth: { getSession: async () => ({ data: { session } }), getUser: async () => ({ data: { user: session.user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: q, rpc: () => Promise.resolve({ data: 0, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, storage: { from: () => ({}) } }; }`;

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: SB(DATA), contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.addInitScript((s) => { localStorage.setItem('cxs.coach.v1', s); }, JSON.stringify({ profile: { name: 'Coach Fictif', email: 'coach@exemple.fr' }, synced: true, me: { id: 'c0ac', isCoach: true, tier: 'free' } }));
  const txt = async (sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ');

  await p.goto(BASE + 'coach.html#/admin-biz', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  ok(/Business/.test(await txt('#app')), 'onglet Business ouvert dans l\'espace coach');
  await p.click('[data-a="biz-tab"][data-v="obj"]'); await p.waitForTimeout(800);
  const mois = await txt('#obj-mois');
  ok(/540,00 € \/ 10 000,00 €/.test(mois), 'encaissé du mois face à l\'objectif par défaut (10 000 €)');
  ok(/540,00 € attendus/.test(mois) && /89,00 € en retard/.test(mois), 'attendu du mois et retard à relancer');
  const plan = await txt('#obj-plan');
  ok(/1\/10/.test(plan), 'places de cycle occupées : 1 sur 10');
  ok(/73,99 €/.test(plan) && /\(2\)/.test(plan), 'abonnements de l\'app : Bâtisseur + Fraternité, sans l\'accès offert ni le coaching');
  ok(/Remplir 9 places/.test(plan) && /4 860,00 €/.test(plan), 'plan : 9 places libres valorisées à 540 €');
  ok(/plafond est de 5 473,99 €/.test(plan), 'alerte : 10 places pleines ne suffisent pas pour 10 000 €');
  const seuils = await txt('#obj-seuils');
  ok(/Franchise de TVA/.test(seuils) && /37 500,00 €/.test(seuils) && /83 600,00 €/.test(seuils), 'seuils TVA et micro-entreprise affichés');
  ok(/economie\.gouv\.fr/.test(seuils), 'sources des seuils citées');
  const src = await txt('#obj-src');
  ok(/Demandes du site \(90 jours\) : 4/.test(src) && /Reel · mot-clé 1RM ?2 demandes ?1 client/.test(src), 'entonnoir : sources des demandes et clients signés');
  ok(/3,3 nouveaux clients par mois/.test(await txt('#obj-acq')) && /environ 7 appels/.test(await txt('#obj-acq')), 'besoin : 3,3 nouveaux clients et 7 appels par mois au taux de signature mesuré (50 %)');
  ok((await p.$$('#obj-leads [data-c="obj-lead-st"]')).length === 2, 'deux demandes à traiter (nouveau, appel prévu)');

  // Mobile : pas de défilement horizontal, sélecteur de statut assez grand pour le doigt
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'aucun débordement horizontal à 390 px');
  const h = await p.$eval('#obj-leads [data-c="obj-lead-st"]', el => el.getBoundingClientRect().height);
  ok(h >= 44, `sélecteur de statut de ${Math.round(h)} px de haut (44 px minimum)`);
  await p.screenshot({ path: SHOTS + '/objectif.png', fullPage: true });

  // Changer le statut d'une demande : écrit dans « leads »
  await p.selectOption('#obj-leads [data-c="obj-lead-st"][data-id="101"]', 'contacté'); await p.waitForTimeout(500);
  const w = await p.evaluate(() => window.__writes);
  ok(w.some(x => x.table === 'leads' && x.op === 'update' && x.body.status === 'contacté' && x.filters.some(f => f[0] === 'id' && f[1] === 101)), 'statut de la demande enregistré');

  // Réglages : objectif et capacité modifiables, les autres réglages sont conservés
  await p.click('[data-a="biz-tab"][data-v="set"]'); await p.waitForTimeout(400);
  await p.fill('input[name="rate"]', '25,6'); await p.fill('input[name="goalMonth"]', '8000'); await p.fill('input[name="places"]', '12');
  await p.click('form[data-f="biz-set"] button'); await p.waitForTimeout(500);
  const set = (await p.evaluate(() => window.__writes)).filter(x => x.table === 'cxs_coach_store').pop();
  ok(set && set.body.value.settings.goalMonth === 8000 && set.body.value.settings.places === 12 && set.body.value.settings.rate === 25.6, 'réglages enregistrés (objectif 8 000 €, 12 places, taux conservé)');
  await p.click('[data-a="biz-tab"][data-v="obj"]'); await p.waitForTimeout(600);
  ok(/540,00 € \/ 8 000,00 €/.test(await txt('#obj-mois')) && /1\/12/.test(await txt('#obj-plan')), 'l\'objectif suit les réglages');

  // Mode sombre : l'écran reste lisible (pas d'erreur, rendu capturé)
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(300);
  await p.screenshot({ path: SHOTS + '/objectif-sombre.png', fullPage: true });

  ok(!errs.length, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await b.close();
  console.log(`\n${passed} vérifications réussies, ${fails} échec(s).`); process.exit(fails ? 1 : 0);
})();
