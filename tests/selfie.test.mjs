// Tests de la lecture de selfie (images synthétiques fictives : aucun visage réel)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as SF from "../js/selfie.js";
import * as P from "../js/personnage.js";

const W = SF.LARGEUR, H = SF.HAUTEUR;
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// Fond, tête (cheveux ou peau) un peu plus grande que l'ovale, visage dans l'ovale, petit bruit
function image({ fond = "#3060A0", tete, visage }) {
  const d = new Uint8ClampedArray(W * H * 4), { cx, cy, rx, ry } = SF.GUIDE;
  let s = 7; const bruit = () => { s = (s * 16807) % 2147483647; return (s % 13) - 6; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const dansVisage = ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
    const dansTete = ((u - cx) / (rx + 0.06)) ** 2 + ((v - (cy - 0.04)) / (ry + 0.07)) ** 2 <= 1;
    const c = rgb(dansVisage ? visage : dansTete && tete ? tete : fond), i = (y * W + x) * 4;
    d[i] = c[0] + bruit(); d[i + 1] = c[1] + bruit(); d[i + 2] = c[2] + bruit(); d[i + 3] = 255;
  }
  return d;
}

test("selfie : teint clair et cheveux noirs", () => {
  const r = SF.analyser(image({ tete: "#1C1916", visage: "#EED9C6" }), W, H);
  assert.equal(r.ok, true); assert.ok(r.teint <= 3, `teint ${r.teint}`); assert.equal(r.cheveux, "#2A2622");
});
test("selfie : teint foncé et cheveux noirs", () => {
  const r = SF.analyser(image({ tete: "#1C1916", visage: "#5A3E30" }), W, H);
  assert.equal(r.ok, true); assert.ok(r.teint >= 6, `teint ${r.teint}`); assert.equal(r.cheveux, "#2A2622");
});
test("selfie : teint moyen et cheveux blonds, puis roux", () => {
  const r = SF.analyser(image({ tete: "#CDAE78", visage: "#B48562" }), W, H);
  assert.equal(r.ok, true); assert.ok(r.teint >= 4 && r.teint <= 6, `teint ${r.teint}`); assert.equal(r.cheveux, "#E2C690");
  assert.equal(SF.analyser(image({ tete: "#94482A", visage: "#E8CDB6" }), W, H).cheveux, "#C05A30");
});
test("selfie : tête rasée → aucune couleur de cheveux proposée", () => {
  const r = SF.analyser(image({ tete: "#D9B79A", visage: "#D9B79A" }), W, H);
  assert.equal(r.ok, true); assert.equal(r.cheveux, null);
});
test("selfie : pas de visage dans l'ovale → refus poli, rien n'est proposé", () => {
  const r = SF.analyser(image({ visage: "#3060A0" }), W, H);
  assert.equal(r.ok, false); assert.match(r.raison, /ovale/);
  assert.equal(SF.analyser(null, W, H).ok, false);
  assert.equal(SF.analyser(new Uint8ClampedArray(10), W, H).ok, false);
});
test("selfie : les propositions sont des choix valides du personnage", () => {
  assert.equal(SF.MONK.length, P.R3D.teints.length);
  for (const [, pal] of SF.CHEVEUX_REELS) assert.ok(P.R3D.cheveux[pal], pal);
});
