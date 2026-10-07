// Test de bout en bout avec un Supabase simulé (données fictives uniquement)
const { chromium } = require('playwright');
const fs = require('fs');
const S = __dirname;
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const EXE = process.env.CHROME_PATH || undefined;
const SHOTS = process.env.SHOTS_DIR || require('os').tmpdir();
const UMD = fs.readFileSync(__dirname + '/node_modules/@supabase/supabase-js/dist/umd/supabase.js');
const REF = 'xtapitojdvicgcaygeqj';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub, email) => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 * 60, aud: 'authenticated' }) + '.sig';

let this_db;
const FOODS = [{ id: 'fp', name: 'Blanc de poulet (cru)', cat: 'Volailles & viandes', kcal: 110, p: 23, g: 0, l: 1.5 }, { id: 'fr', name: 'Riz basmati (cuit)', cat: 'Féculents & céréales', kcal: 130, p: 3, g: 28, l: 0.4 }, { id: 'fa', name: 'Avocat', cat: 'Fruits', kcal: 160, p: 2, g: 1.8, l: 15 }];
const it = (f, q) => ({ n: f.name, q, k: f.kcal, p: f.p, g: f.g, l: f.l });
const PLAN = { v: 1, active: true, prof: {}, tgt: { k: 2000, p: 150, g: 200, l: 70 }, types: [{ id: 'E', name: 'Jour', meals: [{ name: 'Petit-déjeuner', opts: [{ n: 'Riz au lait', m: 1, it: [it(FOODS[1], 150)] }] }, { name: 'Déjeuner', opts: [{ n: 'Poulet riz', m: 1, it: [it(FOODS[0], 150), it(FOODS[1], 200)] }] }, { name: 'Dîner', opts: [{ n: 'Poulet avocat', m: 1, it: [it(FOODS[0], 150), it(FOODS[2], 80)] }] }] }], week: ['E','E','E','E','E','E','E'] };
function scenario(role) {
  const COACH = '00000000-0000-0000-0000-00000000c0ac', CLI_U = '00000000-0000-0000-0000-0000000000u1', CID = '11111111-1111-1111-1111-111111111111';
  const uid = role === 'coach' ? COACH : CLI_U, email = role === 'coach' ? 'coach@exemple.fr' : 'client@exemple.fr';
  const user = { id: uid, email, aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {} };
  const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const client = { id: CID, coach_id: COACH, email: 'client@exemple.fr', name: 'Client Fictif', archived: false, updated_at: new Date().toISOString(), created_at: new Date().toISOString(), program: {}, nutrition: {} };
  const db = { onboarding: [], messages: [], log: [] };
  client.nutrition = PLAN; this_db = db;
  return { uid, email, user, CID, db, session: { access_token: jwt(uid, email), refresh_token: 'r', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 86400 * 60, user },
    handle(method, path, body, accept) {
      db.log.push(method + ' ' + path);
      if (this.extra) { const x = this.extra(method, path, body, accept, path.replace(/^\/rest\/v1\//, '').split('?')[0], /pgrst\.object/.test(accept || '')); if (x !== undefined) return x; }
      const one = /pgrst\.object/.test(accept || '');
      const t = path.replace(/^\/rest\/v1\//, '').split('?')[0];
      if (path.startsWith('/auth/v1/user')) { if (method === 'PUT') { Object.assign(user.user_metadata, (body && body.data) || {}); } return user; }
      if (path.startsWith('/rest/v1/rpc/push_public_key')) return 'BDFTM6oCLVfrlXoFUz0jfpFn9jWPmYYS6d7bC4N091gJEW7GEUj9l4qiz-2vRB4qeAjrRxnaKHsYfnSjfI_JOQE';
      if (path.startsWith('/storage/v1/object/sign/media')) return (body && body.paths || []).map(p => ({ path: p, signedURL: '/object/sign/media/' + p + '?token=t' }));
      if (path.startsWith('/storage/v1/object/media/')) { db.uploads = (db.uploads || []).concat(path); return { Key: path }; }
      if (t === 'messages' && method === 'POST') { db.messages.push(body); return one ? Object.assign({ id: 'm' + db.messages.length, created_at: new Date().toISOString(), sender: uid }, body) : []; }
      if (t === 'mesures' && method === 'GET') return [{ client_id: CID, d: '2026-09-20', data: { poids: 81, bras_d: 36, bras_g: 35.5, taille: 86 } }, { client_id: CID, d: '2026-10-01', data: { poids: 80, taille: 85 } }, { client_id: CID, d: '2026-10-03', data: { poids: 79.2, taille: 84 } }];
      if (t === 'video_lib' && method === 'GET') return [{ coach_id: COACH, ex: 'Développé couché barre', kind: 'url', url: 'https://www.youtube.com/watch?v=exemple' }];
      if (t === 'clients') return one ? client : [client];
      if (t === 'nutri_foods' && method === 'GET') return FOODS;
      if (t === 'onboarding') { if (method === 'POST') { const r = Object.assign({}, body); db.onboarding = [r]; return one ? r : [r]; } return one ? (db.onboarding[0] || null) : db.onboarding; }
      if (t === 'messages' && method === 'POST') { db.messages.push(body); return []; }
      if (t === 'biz_settings') return one ? { coach_id: COACH, data: {} } : [];
      return one ? null : [];
    } };
}

async function run(role, steps, pre) {
  const sc = scenario(role); if (pre) pre(sc);
  const b = await chromium.launch({ executablePath: EXE, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', permissions: ['microphone'] });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebSocket|Failed to load resource|realtime/i.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: UMD, contentType: 'application/javascript' }));
  await p.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.route(`https://${REF}.supabase.co/**`, async r => { const u = new URL(r.request().url()); let body = null; try { body = r.request().postDataJSON(); } catch (e) {}
    sc.lastBody = body; const out = sc.handle(r.request().method(), u.pathname + u.search, Array.isArray(body) ? body[0] : body, r.request().headers()['accept']);
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); });
  await p.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, [`sb-${REF}-auth-token`, JSON.stringify(sc.session)]);
  if (sc.clock) await p.clock.install({ time: new Date(sc.clock) });
  await p.goto(BASE, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await steps(p, sc);
  console.log(`[${role}] erreurs:`, errs.length ? errs : 'aucune');
  if (errs.length) { await b.close(); throw new Error(`[${role}] erreurs JavaScript : ` + errs.join(' | ')); }
  await b.close();
}

module.exports = { run, S: SHOTS, BASE, EXE, getDb: () => this_db };
