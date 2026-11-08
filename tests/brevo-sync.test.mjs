// Tests de la transformation demande du site → contact Brevo (node --test tests/brevo-sync.test.mjs). Données fictives.
import test from "node:test";
import assert from "node:assert/strict";
import { versContact, listesDepuis, sansAttributsPerso, memeSecret } from "../supabase/functions/brevo-sync/contact.ts";

const L = listesDepuis((k) => ({ BREVO_LIST_CALCULATEUR: "12", BREVO_LIST_APPEL: "13", BREVO_LIST_AUTRE: "abc" })[k]);

test("listes lues dans l'environnement, valeurs invalides ignorées", () => {
  assert.deepEqual(L, { calculateur: 12, appel: 13, candidature: undefined, autre: undefined });
});

test("calculateur : liste Calculateur, prénom et chiffres", () => {
  const c = versContact({ name: "Jean Fictif", email: " Jean@Exemple.fr ", consent: true, data: { demande: "calculateur", src: "reel-1rm", e1rm: "114.5 kg", objectif: "1 rep à 160 kg", delai: "40 semaines" } }, L);
  assert.equal(c.ok, true);
  assert.deepEqual(c.body, { email: "jean@exemple.fr", attributes: { FIRSTNAME: "Jean", SOURCE: "reel-1rm", DEMANDE: "calculateur", E1RM: "114.5 kg", OBJECTIF: "1 rep à 160 kg", DELAI: "40 semaines" }, listIds: [12], updateEnabled: true });
});

test("appel : liste Appel", () => {
  const c = versContact({ name: "Paul", email: "paul@exemple.fr", consent: true, data: { demande: "appel", origine: "site" } }, L);
  assert.deepEqual(c.body.listIds, [13]);
  assert.equal(c.body.attributes.SOURCE, "site");
});

test("rien n'est envoyé sans accord, sans e-mail valide ou sans liste réglée", () => {
  assert.equal(versContact({ email: "a@exemple.fr", consent: false, data: { demande: "appel" } }, L).ok, false);
  assert.equal(versContact({ email: "pas-un-email", consent: true, data: { demande: "appel" } }, L).ok, false);
  const r = versContact({ email: "a@exemple.fr", consent: true, data: { demande: "guide-3h" } }, L);
  assert.equal(r.ok, false); assert.match(r.raison, /guide-3h/);
});

test("secours : prénom seul si Brevo refuse les attributs", () => {
  assert.deepEqual(sansAttributsPerso({ email: "a@b.fr", attributes: { FIRSTNAME: "A", E1RM: "1" }, listIds: [1] }).attributes, { FIRSTNAME: "A" });
  assert.deepEqual(sansAttributsPerso({ email: "a@b.fr", attributes: { E1RM: "1" }, listIds: [1] }).attributes, {});
});

test("secret du webhook comparé strictement", () => {
  assert.equal(memeSecret("abc", "abc"), true);
  assert.equal(memeSecret("abc", "abd"), false);
  assert.equal(memeSecret("", ""), false);
  assert.equal(memeSecret("abc", "abcd"), false);
});
