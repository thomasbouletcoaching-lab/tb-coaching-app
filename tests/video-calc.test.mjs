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
