import test from "node:test";
import assert from "node:assert/strict";
import { angle, angles, suivre, motif, deriveTrajectoire } from "../js/video-calc.js";
test("angles", () => {
  assert.equal(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }), 90);
  assert.equal(angle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }), 180);
  const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  Object.assign(lm[23], { x: 0.5, y: 0.5, visibility: 1 }); Object.assign(lm[25], { x: 0.5, y: 0.7, visibility: 1 }); Object.assign(lm[27], { x: 0.7, y: 0.7, visibility: 1 }); Object.assign(lm[11], { x: 0.5, y: 0.2, visibility: 1 });
  const a = angles(lm); assert.equal(a.cote, "gauche"); assert.equal(a.genou, 90); assert.equal(a.hanche, 180);
});
test("suivi d'un motif", () => {
  const w = 80, h = 60, mk = (cx, cy) => { const d = new Uint8Array(w * h).fill(20); for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) d[(cy + j) * w + cx + i] = 230; return { w, h, d }; };
  const t = motif(mk(30, 30), 30, 30, 16);
  const r = suivre(mk(36, 25), t, 30, 30, 10); assert.equal(r.x, 36); assert.equal(r.y, 25);
  assert.equal(deriveTrajectoire([{ x: 10, y: 0 }, { x: 12, y: 50 }, { x: 11, y: 100 }]), 2);
});
import { phases, reps, inclinaison, comparer, scoreCriteres, ecartHorizontal, MOUVEMENTS } from "../js/video-calc.js";
test("phases et vitesse d'un squat simulé", () => {
  // 2 répétitions : descente de 0,5 m en 1 s, remontée en 0,8 s, pause 0,5 s (30 images/s), y vers le bas en mètres
  const pts = []; let t = 0; const push = (y) => { pts.push({ t, x: 0, y }); t += 1 / 30; };
  for (let r = 0; r < 2; r++) { for (let i = 0; i < 15; i++) push(0); for (let i = 0; i <= 30; i++) push(0.5 * i / 30); for (let i = 1; i <= 24; i++) push(0.5 - 0.5 * i / 24); }
  for (let i = 0; i < 15; i++) push(0);
  const ph = phases(pts), R = reps(ph);
  assert.equal(R.length, 2);
  assert.ok(Math.abs(R[0].exc.dur - 1) < 0.2, String(R[0].exc.dur)); assert.ok(Math.abs(R[0].con.dur - 0.8) < 0.2, String(R[0].con.dur));
  assert.ok(Math.abs(R[0].con.vMoy - 0.62) < 0.12, String(R[0].con.vMoy));
  assert.ok(R[0].con.disp > 0.45);
});
test("lignes, comparaison, critères, écart", () => {
  assert.equal(inclinaison({ x: 0, y: 0 }, { x: 0, y: 1 }), 0);
  assert.equal(inclinaison({ x: 0, y: 0 }, { x: 1, y: 1 }), 45);
  const k1 = { items: [{ k: "ligne", a: { x: 0, y: 0 }, b: { x: 0.1, y: 1 } }] }, k2 = { items: [{ k: "ligne", a: { x: 0, y: 0 }, b: { x: 0.5, y: 1 } }] };
  const c = comparer(k1, k2); assert.equal(c[0].a, 6); assert.equal(c[0].b, 27); assert.equal(c[0].delta, 21);
  assert.equal(scoreCriteres("squat", { 0: "ok", 1: "moyen", 2: "ko" }), 50);
  assert.ok(MOUVEMENTS.length >= 14);
  assert.deepEqual(ecartHorizontal([{ x: 0.1, y: 0 }, { x: 0.15, y: 1 }, { x: 0.08, y: 2 }]), { max: 0.07, droite: 0.05, gauche: 0.02 });
});
import { suivreNCC, nettoyerTrajectoire, detailReps, sensDe, retourner, trajectoireAuto, anglesBas, buste } from "../js/video-calc.js";
import * as V from "../js/video-calc.js";
test("suivi NCC : retrouve le motif malgré un changement de lumière, avec un score", () => {
  const w = 90, h = 70, mk = (cx, cy, fond = 20, lum = 230) => { const d = new Uint8Array(w * h).fill(fond); for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) d[(cy + j) * w + cx + i] = j === 0 || i === 0 ? fond : lum; return { w, h, d }; };
  const t = motif(mk(40, 30), 40, 30, 18);
  const r = suivreNCC(mk(46, 36, 60, 255), t, 40, 30, 10);
  assert.ok(Math.abs(r.x - 46) < 0.6 && Math.abs(r.y - 36) < 0.6, `${r.x},${r.y}`); assert.ok(r.score > 0.9, String(r.score));
  const vide = suivreNCC({ w, h, d: new Uint8Array(w * h).fill(90) }, t, 40, 30, 6); assert.ok(vide.score < 0.5, "pas de motif : score bas");
});
test("trajectoire nettoyée : un saut isolé est interpolé", () => {
  const pts = Array.from({ length: 10 }, (_, i) => ({ t: i / 30, x: 0.5, y: 0.1 + i * 0.01 })); pts[5] = { t: 5 / 30, x: 0.9, y: 0.6 };
  const n = nettoyerTrajectoire(pts); assert.ok(Math.abs(n[5].x - 0.5) < 1e-9 && Math.abs(n[5].y - 0.15) < 1e-9); assert.equal(n[5].corrige, true); assert.equal(n[4].corrige, undefined);
});
test("sens : au tirage vertical, la phase concentrique fait descendre la barre", () => {
  assert.equal(sensDe("tirage-vertical"), -1); assert.equal(sensDe("squat"), 1);
  const pts = []; let t = 0; const push = (y) => { pts.push({ t, x: 0, y }); t += 1 / 30; };
  for (let r = 0; r < 2; r++) { for (let i = 0; i < 10; i++) push(0); for (let i = 0; i <= 20; i++) push(0.4 * i / 20); for (let i = 1; i <= 30; i++) push(0.4 - 0.4 * i / 30); }
  for (let i = 0; i < 10; i++) push(0);
  const R = reps(phases(retourner(pts, -1)));
  assert.equal(R.length, 2); assert.ok(Math.abs(R[0].con.dur - 0.67) < 0.2, "la descente rapide (tirage) est la concentrique : " + R[0].con.dur);
});
test("détail des répétitions : amplitude, vitesse, régularité, répétitions à revoir", () => {
  const R = [0, 1, 2, 3].map(i => ({ exc: { t0: i * 2, t1: i * 2 + 1, dur: 1, vMoy: 0.5 }, con: { t0: i * 2 + 1, t1: i * 2 + 1.8, dur: 0.8, disp: i === 3 ? 0.35 : 0.5, vMoy: i === 3 ? 0.4 : 0.62 - i * 0.02, vMax: 0.9 } }));
  const pts = Array.from({ length: 160 }, (_, k) => ({ t: k / 20, x: k / 20 > 6 ? 0.1 + (k % 3) * 0.04 : 0.1, y: 0 }));
  const d = detailReps(R, pts);
  assert.equal(d.reps.length, 4); assert.ok(d.reps[3].alertes.includes("amplitude plus courte")); assert.ok(d.reps[3].alertes.some(a => /vitesse −35 %/.test(a)));
  assert.ok(d.reps[3].alertes.includes("trajectoire qui s'écarte"));
  assert.equal(d.constance.standard, false); assert.deepEqual(d.constance.aRevoir, [4]); assert.equal(d.constance.perte, 35);
  const ok = detailReps(R.slice(0, 3), pts.slice(0, 100)); assert.equal(ok.constance.standard, true); assert.match(ok.constance.resume, /standardisées/);
});
test("analyse automatique : point suivi depuis le squelette, angles au point bas", () => {
  const lm = (y) => { const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 })); p[11] = { x: 0.5, y: y, visibility: 1 }; p[12] = { x: 0.5, y: y, visibility: 0.2 }; p[15] = { x: 0.4, y: 0.3, visibility: 1 }; p[16] = { x: 0.6, y: 0.3, visibility: 1 }; p[23] = { x: 0.45, y: y + 0.3, visibility: 1 }; p[25] = { x: 0.6, y: 0.75, visibility: 1 }; p[27] = { x: 0.55, y: 0.95, visibility: 1 }; return p; };
  const lmT = [{ t: 0, lm: lm(0.2) }, { t: 1, lm: lm(0.46) }];
  assert.deepEqual(trajectoireAuto(lmT, "bench").map(p => Math.round(p.x * 100) / 100), [0.5, 0.5], "développé : milieu des poignets");
  assert.ok(Math.abs(trajectoireAuto(lmT, "squat")[1].y - 0.46) < 1e-9, "squat : épaule du côté filmé");
  const b = anglesBas([{ exc: { t1: 1 }, con: { t0: 1 } }], lmT)[0]; assert.equal(b.sousParallele, true); assert.ok(b.genou > 0); assert.equal(buste(lmT[0].lm), 9);
});

test("C73 : phases fiables — sortie du rack et oscillations écartées, point de blocage fusionné", () => {
  const P = (type, t0, t1, disp) => ({ type, t0, t1, dur: t1 - t0, disp, vMoy: disp / (t1 - t0), vMax: disp / (t1 - t0) * 1.5 });
  // sortie du rack (petite montée), recul, 1 vraie répétition avec un blocage à mi-montée, petit tremblement, retour au rack
  const ph = [P("con", 0, 0.5, 0.04), P("exc", 1, 1.3, 0.03), P("exc", 2, 3, 0.5), P("con", 3.1, 3.6, 0.25), P("con", 3.9, 4.4, 0.24), P("exc", 5, 5.2, 0.05), P("con", 5.3, 5.5, 0.04)];
  const f = V.phasesFiables(ph), R = V.reps(f);
  assert.equal(R.length, 1, "1 seule répétition");
  assert.equal(f.length, 2); assert.ok(Math.abs(f[1].disp - 0.49) < 1e-6, "montée fusionnée malgré le blocage");
  assert.ok(V.AVEC_BARRE.includes("squat") && !V.AVEC_BARRE.includes("traction"));
});
