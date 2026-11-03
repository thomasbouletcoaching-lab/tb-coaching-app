// Moteur « Volume de la semaine » : on choisit tout le travail de la semaine (exercices et séries),
// on lit le volume par faisceau et par muscle face aux repères MV / MEV / MAV / MRV,
// puis on répartit ce travail sur les jours d'entraînement.
// Module pur : aucun accès à l'écran ni au stockage (testé dans Node, tests/volume.test.mjs).

// Coefficient d'un faisceau secondaire (le principal compte 1 série par série faite). Décision validée : 0,5.
export const SEC_COEF = 0.5;
// Plus de séries que ça pour un même muscle dans une séance : signalé (sans bloquer)
export const SESSION_CAP = 10;
// Fréquence hebdomadaire au-delà de laquelle on signale (jours par semaine pour un même muscle)
export const FREQ_CAP = 3;
const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// Muscles (porteurs des repères) et leurs faisceaux. Repères indicatifs en séries par semaine,
// d'après les repères de volume de Mike Israetel (Renaissance Periodization) ; ajustables par client et par bloc.
// mav = [début, fin] de la zone adaptative maximale. ind = repère peu documenté, affiché comme indicatif.
export const GROUPS = [
  { id: "pecs", n: "Pectoraux", f: ["Pecs-haut", "Pecs-milieu", "Pecs-bas"], lm: { mv: 6, mev: 8, mav: [12, 20], mrv: 22 } },
  { id: "dos", n: "Dos", f: ["Dos-largeur", "Dos-épaisseur"], lm: { mv: 6, mev: 10, mav: [14, 22], mrv: 25 } },
  { id: "dant", n: "Deltoïde antérieur", f: ["Épaules-avant"], lm: { mv: 0, mev: 0, mav: [6, 8], mrv: 12 } },
  { id: "dlat", n: "Deltoïde latéral", f: ["Épaules-latéral"], lm: { mv: 0, mev: 8, mav: [16, 22], mrv: 26 } },
  { id: "dpost", n: "Deltoïde postérieur", f: ["Épaules-arrière"], lm: { mv: 0, mev: 8, mav: [16, 22], mrv: 26 } },
  { id: "trap", n: "Trapèzes", f: ["Trapèzes"], lm: { mv: 0, mev: 0, mav: [12, 20], mrv: 26 } },
  { id: "bic", n: "Biceps", f: ["Biceps"], lm: { mv: 6, mev: 8, mav: [14, 17], mrv: 26 } },
  { id: "tri", n: "Triceps", f: ["Triceps"], lm: { mv: 4, mev: 6, mav: [10, 14], mrv: 18 } },
  { id: "avb", n: "Avant-bras", f: ["Avant-bras"], lm: { mv: 0, mev: 2, mav: [10, 16], mrv: 25 } },
  { id: "abs", n: "Abdos", f: ["Abdos"], lm: { mv: 0, mev: 0, mav: [16, 20], mrv: 25 } },
  { id: "lomb", n: "Lombaires", f: ["Lombaires"], lm: { mv: 0, mev: 0, mav: [4, 8], mrv: 12 }, ind: true },
  { id: "quad", n: "Quadriceps", f: ["Quadriceps"], lm: { mv: 6, mev: 8, mav: [12, 16], mrv: 20 } },
  { id: "isch", n: "Ischio-jambiers", f: ["Ischios"], lm: { mv: 4, mev: 6, mav: [10, 14], mrv: 20 } },
  { id: "fess", n: "Fessiers", f: ["Fessiers"], lm: { mv: 0, mev: 0, mav: [4, 12], mrv: 16 } },
  { id: "add", n: "Adducteurs", f: ["Adducteurs"], lm: { mv: 0, mev: 0, mav: [4, 10], mrv: 14 }, ind: true },
  { id: "mol", n: "Mollets", f: ["Mollets"], lm: { mv: 6, mev: 8, mav: [12, 16], mrv: 20 } },
];
export const FAISCEAUX = GROUPS.flatMap(g => g.f);
const F_LABEL = { "Pecs-haut": "Pectoral haut (claviculaire)", "Pecs-milieu": "Pectoral milieu (sternal)", "Pecs-bas": "Pectoral bas (abdominal)", "Dos-largeur": "Dos · largeur (grand dorsal)", "Dos-épaisseur": "Dos · épaisseur (rhomboïdes, trapèze moyen)" };
export const fLabel = (f) => F_LABEL[f] || f;
export const groupOf = (f) => GROUPS.find(g => g.f.includes(f)) || null;
export const groupById = (id) => GROUPS.find(g => g.id === id) || null;

// Faisceau pectoral d'après le nom de l'exercice (incliné → haut, décliné ou dips → bas, sinon milieu)
export function pecsPart(name) {
  const n = String(name || "").toLowerCase();
  if (/inclin|low.?to.?high|bas vers le haut|guillotine|landmine|prise inversée/.test(n)) return "Pecs-haut";
  if (/déclin|declin|dips|high.?to.?low|haut vers le bas|pull.?over/.test(n)) return "Pecs-bas";
  return "Pecs-milieu";
}
// Faisceaux d'un exercice : 1 à 3, le principal à 1, les secondaires à SEC_COEF.
// line.fx (facultatif) remplace le calcul : [{ f, c }] réglé par le coach.
export function faisceauxOf(name, musclesOf, fx = null) {
  if (Array.isArray(fx) && fx.length) return fx.filter(x => FAISCEAUX.includes(x.f) && x.c > 0).map(x => ({ f: x.f, c: +x.c }));
  const out = [];
  (musclesOf(name) || []).slice(0, 3).forEach((m, i) => {
    const f = m === "Pecs" ? pecsPart(name) : m;
    if (!FAISCEAUX.includes(f) || out.some(x => x.f === f)) return;
    out.push({ f, c: out.length === 0 && i === 0 ? 1 : SEC_COEF });
  });
  if (out.length && out[0].c !== 1) out[0].c = 1; // le premier faisceau retenu est le principal
  return out;
}

// ---------- Repères ----------
// Valeurs par défaut, puis seuils du client (réglés par le coach), puis seuils du bloc : le plus précis gagne
export function landmarks(...overrides) {
  const out = {};
  GROUPS.forEach(g => { out[g.id] = { ...g.lm, mav: [...g.lm.mav] }; });
  overrides.filter(Boolean).forEach(o => Object.entries(o).forEach(([id, v]) => {
    if (!out[id] || !v) return; const L = out[id];
    ["mv", "mev", "mrv"].forEach(k => { if (Number.isFinite(+v[k]) && v[k] !== "" && v[k] != null) L[k] = +v[k]; });
    if (Array.isArray(v.mav) && v.mav.length === 2 && v.mav.every(x => Number.isFinite(+x))) L.mav = [+v.mav[0], +v.mav[1]];
  }));
  return out;
}
// Repère d'un faisceau : celui du muscle, réparti à parts égales entre ses faisceaux (indicatif)
export function faisceauLm(f, lm) {
  const g = groupOf(f); if (!g) return null; const L = lm[g.id], k = 1 / g.f.length;
  if (k === 1) return L;
  const r = (x) => Math.round(x * k * 2) / 2;
  return { mv: r(L.mv), mev: r(L.mev), mav: [r(L.mav[0]), r(L.mav[1])], mrv: r(L.mrv), ind: true };
}
// Statut d'un volume face à un repère
export const STATUS = {
  none: { n: "Non travaillé", c: "var(--soft)", k: "none" },
  low: { n: "Insuffisant", c: "#C8202B", k: "low" },
  mv: { n: "Maintien", c: "#E07B1F", k: "mv" },
  prog: { n: "Progression", c: "#1E8F4E", k: "prog" },
  opt: { n: "Progression · zone optimale", c: "#1E8F4E", k: "opt" },
  watch: { n: "À surveiller", c: "#C99A06", k: "watch" },
  over: { n: "Excessif", c: "#C8202B", k: "over" },
};
export function statusOf(v, L) {
  if (!L) return STATUS.none;
  if (!v) return L.mv > 0 ? STATUS.low : STATUS.none;
  if (v < L.mv) return STATUS.low;
  if (v < L.mev) return STATUS.mv;
  if (v > L.mrv) return STATUS.over;
  if (v > L.mav[1]) return STATUS.watch;
  if (v >= L.mav[0]) return STATUS.opt;
  return STATUS.prog;
}

// ---------- Une ligne du brouillon ----------
// { n: nom, sets: séries/sem, lo, hi, it: { t: "rpe"|"pct"|"kg", v }, mode: "series"|"ton", ton: kg/sem,
//   force: bool, bw: bool (poids de corps : la charge saisie est le lest), fx: faisceaux réglés, split: { 0: 4, 3: 4 } }
const FORCE_RE = /^(squat|front squat|développé couché|développé militaire|soulevé de terre|deadlift|traction|dips|bench|overhead press|hip thrust barre|rowing barre)/i;
export const isForceName = (n) => FORCE_RE.test(String(n || "").trim());
export function newLine(name, { bw = false } = {}) {
  const force = isForceName(name);
  return { n: name, sets: 6, lo: force ? 5 : 8, hi: force ? 5 : 12, it: { t: "rpe", v: 8 }, mode: "series", ton: null, force, bw: !!bw, fx: null, split: {} };
}
export const repsOf = (l) => Math.max(1, Math.round(((+l.lo || 1) + (+l.hi || +l.lo || 1)) / 2));
const effR = (reps, rpe) => Math.min(reps + Math.max(0, 10 - (rpe || 8)), 15);
const loadFor = (e, reps, rpe = 8) => { const r = effR(reps, rpe); return r <= 1 ? e : e / (1 + r / 30); };

// Charge d'une série. ctx = { e1(nom) : 1RM estimé (charge totale, poids du corps compris pour les mouvements au poids de corps), bw : poids du corps }
// Poids de corps lesté : le % se calcule sur (PDC + lest), puis on retire le PDC pour obtenir le lest.
export function chargeOf(l, ctx = {}) {
  const reps = repsOf(l), it = l.it || {}, bw = l.bw ? (+ctx.bw || 0) : 0, e1 = +(ctx.e1?.(l.n)) || 0;
  let total = null;
  if (it.t === "kg" && +it.v > 0) total = +it.v + bw;
  else if (it.t === "kg" && l.bw && bw) total = bw;
  else if (it.t === "pct" && +it.v > 0 && e1) total = e1 * +it.v / 100;
  else if (it.t === "rpe" && e1) total = loadFor(e1, reps, +it.v || 8);
  else if (l.bw && bw) total = bw;
  if (total == null || !(total > 0)) return { total: null, lest: null };
  total = Math.round(total * 2) / 2;
  return { total, lest: l.bw ? Math.max(0, Math.round((total - bw) * 4) / 4) : null };
}
// Séries de la semaine : saisies (mode séries) ou déduites du tonnage visé (mode tonnage)
export function lineSets(l, ctx = {}) {
  if (l.mode === "ton" && +l.ton > 0) {
    const { total } = chargeOf(l, ctx);
    if (total) return Math.max(1, Math.ceil(+l.ton / (total * repsOf(l))));
  }
  return Math.max(0, Math.round(+l.sets || 0));
}
export function lineTonnage(l, ctx = {}, sets = lineSets(l, ctx)) {
  const { total } = chargeOf(l, ctx); return total ? Math.round(total * repsOf(l) * sets) : null;
}
export const placed = (l) => Object.values(l.split || {}).reduce((a, n) => a + (+n || 0), 0);

// ---------- Volume ----------
// lines : lignes du brouillon. day : index du jour (0 = lundi) pour le volume d'une séance, sinon toute la semaine.
export function computeVolume(lines, { musclesOf, ctx = {}, day = null } = {}) {
  const byF = {}, byG = {}, perLine = [];
  let total = 0;
  lines.forEach(l => {
    const n = day == null ? lineSets(l, ctx) : (+l.split?.[day] || 0);
    const fx = faisceauxOf(l.n, musclesOf, l.fx);
    perLine.push({ n: l.n, sets: n, fx });
    if (!n) return; total += n;
    fx.forEach(({ f, c }) => {
      byF[f] = (byF[f] || 0) + n * c;
      const g = groupOf(f); if (g) byG[g.id] = (byG[g.id] || 0) + n * c;
    });
  });
  return { byF, byG, total, perLine };
}
export const round5 = (v) => Math.round((v || 0) * 2) / 2;

// ---------- Contrôles de cohérence (jamais bloquants) ----------
export function checks(lines, days, { musclesOf, ctx = {}, lm = landmarks() } = {}) {
  const out = [], V = computeVolume(lines, { musclesOf, ctx });
  GROUPS.forEach(g => {
    const v = round5(V.byG[g.id]), L = lm[g.id];
    if (v > L.mrv) {
      const forceHere = lines.filter(l => l.force && lineSets(l, ctx) && faisceauxOf(l.n, musclesOf, l.fx).some(x => g.f.includes(x.f)));
      out.push({ lvl: "warn", g: g.id, txt: `${g.n} : ${fmt(v)} séries, au-dessus du MRV (${L.mrv}).${forceHere.length ? ` La cible de ${forceHere.map(l => l.n).join(", ")} y contribue : arbitre entre la progression du mouvement et la fatigue du muscle.` : ""}` });
    } else if (v > 0 && v < L.mv) out.push({ lvl: "info", g: g.id, txt: `${g.n} : ${fmt(v)} séries, sous le volume de maintien (${L.mv}).` });
  });
  const on = (days || []).map((x, i) => x ? i : -1).filter(i => i >= 0);
  lines.forEach(l => { const n = lineSets(l, ctx), p = placed(l); if (n && p !== n) out.push({ lvl: p > n ? "warn" : "info", txt: `${l.n} : ${p} série${p > 1 ? "s" : ""} placée${p > 1 ? "s" : ""} sur ${n}.` }); });
  on.forEach(d => {
    const Vd = computeVolume(lines, { musclesOf, ctx, day: d });
    GROUPS.forEach(g => { const v = round5(Vd.byG[g.id]); if (v > SESSION_CAP) out.push({ lvl: "warn", txt: `${DAYS[d]} : ${fmt(v)} séries de ${g.n} dans la même séance (plus de ${SESSION_CAP}).` }); });
    const heavy = lines.filter(l => l.force && (+l.split?.[d] || 0) > 0);
    if (heavy.length >= 3) out.push({ lvl: "info", txt: `${DAYS[d]} : ${heavy.length} mouvements de force lourds (${heavy.map(l => l.n).join(", ")}).` });
  });
  GROUPS.forEach(g => {
    const n = on.filter(d => lines.some(l => (+l.split?.[d] || 0) > 0 && faisceauxOf(l.n, musclesOf, l.fx).some(x => x.c === 1 && g.f.includes(x.f)))).length;
    if (n > FREQ_CAP) out.push({ lvl: "info", txt: `${g.n} travaillé en principal ${n} jours sur 7 (plus de ${FREQ_CAP}).` });
  });
  return out;
}
const fmt = (v) => String(round5(v)).replace(".", ",");

// ---------- Répartition suggérée (jamais appliquée sans le bouton) ----------
// Chaque exercice est réparti sur le moins de jours possible (4 séries max par exercice et par séance),
// dans les jours où son muscle principal est le moins chargé, en espaçant les séances.
export function distribute(lines, days, { musclesOf, ctx = {} } = {}) {
  const on = (days || []).map((x, i) => x ? i : -1).filter(i => i >= 0);
  const res = lines.map(() => ({}));
  if (!on.length) return res;
  const load = on.reduce((a, d) => (a[d] = { tot: 0, g: {}, force: 0 }, a), {});
  const order = lines.map((l, i) => i).sort((a, b) => (lines[b].force - lines[a].force) || (lineSets(lines[b], ctx) - lineSets(lines[a], ctx)));
  order.forEach(i => {
    const l = lines[i], n = lineSets(l, ctx); if (!n) return;
    const fx = faisceauxOf(l.n, musclesOf, l.fx), g0 = groupOf(fx[0]?.f || "")?.id;
    const per = 4, k = Math.min(on.length, Math.max(1, Math.ceil(n / per)));
    const picked = [];
    for (let j = 0; j < k; j++) {
      const best = on.filter(d => !picked.includes(d)).map(d => {
        const near = picked.reduce((m, p) => Math.min(m, Math.min(Math.abs(d - p), 7 - Math.abs(d - p))), 7);
        const score = (load[d].g[g0] || 0) * 3 + load[d].tot + (l.force ? load[d].force * 8 : 0) - Math.min(near, 3) * 4;
        return { d, score };
      }).sort((a, b) => a.score - b.score || a.d - b.d)[0];
      if (best) picked.push(best.d);
    }
    picked.sort((a, b) => a - b);
    const base = Math.floor(n / picked.length); let rest = n - base * picked.length;
    picked.forEach(d => {
      const s = base + (rest-- > 0 ? 1 : 0); if (!s) return; res[i][d] = s;
      load[d].tot += s; if (l.force) load[d].force++;
      fx.forEach(({ f, c }) => { const g = groupOf(f)?.id; if (g) load[d].g[g] = (load[d].g[g] || 0) + s * c; });
    });
  });
  return res;
}

// ---------- Conversion en séances du programme ----------
// Une séance par jour d'entraînement, exercices de force en premier. Retour : sessions au format de l'app
// ([nom, jour, lignes]) ; chaque ligne porte ses séries de base (la surcharge semaine par semaine se règle ensuite dans l'éditeur).
export function toSessions(lines, days, { musclesOf, ctx = {} } = {}) {
  const on = (days || []).map((x, i) => x ? i : -1).filter(i => i >= 0), out = [];
  on.forEach(d => {
    const here = lines.filter(l => (+l.split?.[d] || 0) > 0);
    if (!here.length) return;
    here.sort((a, b) => (b.force - a.force) || (faisceauxOf(b.n, musclesOf, b.fx).length - faisceauxOf(a.n, musclesOf, a.fx).length));
    const V = computeVolume(here, { musclesOf, ctx, day: d });
    const focus = Object.entries(V.byG).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => groupById(id).n);
    const rows = here.map(l => {
      const n = +l.split[d], it = l.it || {}, ch = chargeOf(l, ctx);
      const set = { t: "N", lo: +l.lo || 8, hi: +l.hi || +l.lo || 8, rpe: it.t === "rpe" ? +it.v || 8 : null, pct: it.t === "pct" ? +it.v || null : null, kg: it.t === "kg" ? (l.bw ? ch.lest ?? +it.v : +it.v) || null : null, tech: [] };
      return [l.n, l.force ? "F" : faisceauxOf(l.n, musclesOf, l.fx).length > 1 ? "P" : "I", "", null, null, { sets: Array.from({ length: n }, () => ({ ...set, tech: [] })), rest: l.force ? 180 : 120 }];
    });
    out.push([`Séance ${String.fromCharCode(65 + out.length)} · ${focus.join(", ") || "Complète"}`, DAYS[d], rows]);
  });
  return out;
}

// Lit un programme existant (semaine w) pour en faire un brouillon : séries cumulées par exercice, réparties sur les jours.
// weekPlan(row, w, program) -> { sets } (fourni par le moteur de l'app) ; dayIndex(session, i) -> index du jour.
export function fromProgram(p, { w = 1, weekPlan, dayIndex, bwOf = () => false } = {}) {
  const byName = new Map();
  (p?.s || []).forEach((se, si) => {
    const d = dayIndex(se, si);
    (se[2] || []).forEach(r => {
      if (!r?.[0]) return;
      const sets = (weekPlan(r, w, p)?.sets || []).filter(s => s.t !== "W");
      let l = byName.get(r[0]);
      if (!l) {
        const s0 = sets[0] || {};
        l = newLine(r[0], { bw: bwOf(r[0]) });
        Object.assign(l, { sets: 0, lo: s0.lo || l.lo, hi: s0.hi || s0.lo || l.hi, it: s0.pct ? { t: "pct", v: s0.pct } : s0.kg ? { t: "kg", v: s0.kg } : { t: "rpe", v: s0.rpe || 8 }, force: r[1] === "F" || l.force });
        byName.set(r[0], l);
      }
      l.sets += sets.length;
      if (d != null && sets.length) l.split[d] = (l.split[d] || 0) + sets.length;
    });
  });
  return [...byName.values()].filter(l => l.sets > 0);
}
