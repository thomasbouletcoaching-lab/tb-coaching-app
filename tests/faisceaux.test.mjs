import test from "node:test";
import assert from "node:assert/strict";
import * as F from "../js/faisceaux.js";
test("faisceaux des exercices courants", () => {
  assert.deepEqual(F.headsOf("Squat barre").d, ["vaste_lat", "vaste_med"]);
  assert.equal(F.headsOf("Curl incliné haltères").d[0], "bic_long");
  assert.equal(F.headsOf("Leg curl assis").t, "E");
  assert.equal(F.headsOf("Développé incliné haltères").d[0], "pec_clav");
});
test("une série compte une fois par muscle, volume poubelle signalé", () => {
  const c = F.countSets([{ name: "Développé couché barre", sets: 5 }, { name: "Développé incliné haltères", sets: 5 }, { name: "Écarté poulie", sets: 4 }]);
  assert.equal(c.muscles.pecs.d, 14);
  assert.equal(F.jauge("pecs", c.muscles.pecs.eq).k, "junk");
});
test("redondance et pistes pour raccourcir", () => {
  assert.equal(F.redondances([{ name: "Développé couché barre" }, { name: "Développé couché haltères" }]).length, 1);
  const s = (n) => Array.from({ length: n }, () => ({ done: false, type: "N" }));
  const r = F.raccourcir([{ name: "Développé couché barre", sets: s(4), rest: 120 }, { name: "Rowing assis machine", sets: s(4), rest: 90 }]);
  assert.equal(r.ss.length, 1); assert.ok(r.ss[0].anta);
});
test("pièges de noms corrigés", () => {
  assert.equal(F.headsOf("Curl barre debout").d[0], "bic_long");
  assert.equal(F.headsOf("Curl haltères assis").d[0], "bic_long");
  assert.equal(F.headsOf("Reverse fly haltères").d[0], "delt_post");
  assert.equal(F.headsOf("Rowing haltère banc incliné").d[0], "dors_inf");
  assert.equal(F.headsOf("Kickback poulie").d[0], "gd_fess");
  assert.equal(F.headsOf("Leg curl allongé").d[0], "bf_court");
});
