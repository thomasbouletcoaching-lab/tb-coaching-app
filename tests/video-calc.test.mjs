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

test("C76 : disque trouvé autour du point touché (bord extérieur, pas les anneaux intérieurs)", () => {
  const w = 220, h = 180, d = new Uint8Array(w * h).fill(40);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = Math.hypot(x - 100, y - 90); if (r <= 40) d[y * w + x] = r <= 10 ? 120 : r <= 22 ? 200 : 170; }
  const c = V.trouverDisque({ w, h, d }, 104, 86);
  assert.ok(c, "disque trouvé"); assert.ok(Math.abs(c.r - 40) < 2, "rayon " + c.r); assert.ok(Math.hypot(c.x - 100, c.y - 90) < 2, `centre ${c.x},${c.y}`); assert.ok(c.score > 0.5, "score " + c.score);
  assert.equal(V.trouverDisque({ w, h, d: new Uint8Array(w * h).fill(90) }, 104, 86), null, "image uniforme : rien");
});
test("C76 : lissage du squelette — le tremblement baisse, le mouvement reste", () => {
  const lmT = Array.from({ length: 60 }, (_, i) => ({ t: i / 30, lm: [{ x: 0.5 + (i % 2 ? 0.01 : -0.01), y: 0.2 + i * 0.005, visibility: 1 }] }));
  const L = V.lisserSquelette(lmT), ec = (a) => a.slice(10).reduce((s, q) => s + Math.abs(q.lm[0].x - 0.5), 0) / (a.length - 10);
  assert.ok(ec(L) < ec(lmT) * 0.6, "tremblement réduit"); assert.ok(Math.abs(L.at(-1).lm[0].y - lmT.at(-1).lm[0].y) < 0.02, "pas de retard notable");
});
test("C76 : indice de fiabilité", () => {
  assert.equal(V.fiabilite({ suivi: { moy: 0.9, perdu: false }, vis: 0.9, haut: 720, echelle: true, reps: 5 }).niveau, "élevée");
  assert.equal(V.fiabilite({ suivi: { moy: 0.78 }, vis: 0.9, haut: 720, echelle: true, reps: 5 }).niveau, "moyenne");
  const f = V.fiabilite({ suivi: { moy: 0.9, perdu: true }, vis: 0.5, haut: 720, echelle: false, reps: 3 });
  assert.equal(f.niveau, "faible"); assert.ok(f.raisons.some(r => /perdue/.test(r)));
  assert.equal(V.fiabilite({ auto: true, vis: 0.9, haut: 720, echelle: true, reps: 0 }).niveau, "faible");
});
test("C76 : juge streetlifting (traction, dips)", () => {
  // squelette de profil (côté gauche visible) : épaule 11, coude 13, poignet 15, bouche 9/10, mains 15/16
  const mk = (bras, bouche, epaule = 0.5, coudeY = 0.45) => { const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    [12, 14, 16, 24, 26, 28].forEach(i => p[i].visibility = 0.1);
    p[11] = { x: 0.5, y: epaule, visibility: 1 }; p[13] = bras === "tendu" ? { x: 0.5, y: epaule - 0.15, visibility: 1 } : { x: 0.6, y: coudeY, visibility: 1 };
    p[15] = { x: 0.5, y: bras === "tendu" ? epaule - 0.3 : epaule - 0.15, visibility: 1 }; p[16] = { ...p[15] }; p[9] = { x: 0.5, y: bouche, visibility: 1 }; p[10] = { ...p[9] }; return p; };
  const R = [{ exc: null, con: { t0: 0, t1: 1 } }];
  const bonne = [{ t: 0, lm: mk("tendu", 0.45) }, { t: 0.5, lm: mk("plie", 0.4) }, { t: 1, lm: mk("plie", 0.3, 0.42, 0.40) }];
  bonne[2].lm[9].y = bonne[2].lm[10].y = 0.2; bonne[2].lm[15].y = bonne[2].lm[16].y = 0.25;
  assert.equal(V.jugeRep("traction", R, bonne)[0].valide, true);
  const courte = bonne.map(q => ({ ...q, lm: q.lm.map(p => ({ ...p })) })); courte[2].lm[9].y = courte[2].lm[10].y = 0.3;
  const j = V.jugeRep("traction", R, courte)[0]; assert.equal(j.valide, false); assert.ok(j.raisons.some(r => /menton/.test(r)));
  assert.equal(V.jugeRep("squat", R, bonne), null);
  // dips (de profil) : en haut bras tendus vers le bas (coude sous l'épaule), en bas l'épaule passe au niveau du coude
  const dp = (epaule, coudeY, poignetY, coudeX) => { const p = mk("tendu", 0.2); p[11] = { x: 0.5, y: epaule, visibility: 1 }; p[13] = { x: coudeX, y: coudeY, visibility: 1 }; p[15] = { x: 0.5, y: poignetY, visibility: 1 }; p[16] = { ...p[15] }; return p; };
  const haut = dp(0.3, 0.45, 0.6, 0.5), basOk = dp(0.5, 0.49, 0.6, 0.62), basKo = dp(0.42, 0.5, 0.6, 0.6);
  assert.equal(V.jugeRep("dips", R, [{ t: 0, lm: haut }, { t: 0.5, lm: basOk }, { t: 1, lm: haut }])[0].valide, true);
  const ko = V.jugeRep("dips", R, [{ t: 0, lm: haut }, { t: 0.5, lm: basKo }, { t: 1, lm: haut }])[0];
  assert.equal(ko.valide, false); assert.ok(ko.raisons.some(r => /épaule/.test(r)));
});
test("C76 : protocole de prise de vue et contrôle qualité", () => {
  assert.match(V.protocole("squat"), /profil/); assert.match(V.protocole("inconnu"), /profil/);
  assert.equal(V.qualiteVideo({ w: 1280, h: 720, duree: 20 }).length, 0);
  assert.equal(V.qualiteVideo({ w: 640, h: 360, duree: 120 }).length, 2);
});
