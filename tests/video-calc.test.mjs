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
