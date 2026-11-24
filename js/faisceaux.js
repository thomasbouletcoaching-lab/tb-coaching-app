// Faisceaux musculaires fins : séries directes et indirectes par faisceau, jauge de volume par séance (volume poubelle),
// redondances, récupération estimée, profil de tension (étirement / contraction), et pistes pour raccourcir une séance.
// Module pur : il reçoit la fonction musclesOf du moteur pour les exercices inconnus.

// Muscles et leurs faisceaux. g = gros groupe (seuils de séance plus hauts), rec = heures de récupération de base.
export const MUSCLES_FX = [
  { id: "pecs", n: "Pectoraux", g: 1, rec: 48, f: [["pec_clav", "Faisceau claviculaire (haut)"], ["pec_stern", "Faisceau sternal (milieu)"], ["pec_abdo", "Faisceau abdominal (bas)"]] },
  { id: "dorsal", n: "Grand dorsal", g: 1, rec: 48, f: [["dors_sup", "Fibres hautes (tirages coudes écartés)"], ["dors_inf", "Fibres basses (coudes au corps, pull-over)"], ["grand_rond", "Grand rond"]] },
  { id: "trap", n: "Trapèzes et rhomboïdes", g: 0, rec: 36, f: [["trap_sup", "Trapèze supérieur"], ["trap_moy", "Trapèze moyen et rhomboïdes"], ["trap_inf", "Trapèze inférieur"]] },
  { id: "delt", n: "Deltoïdes", g: 0, rec: 36, f: [["delt_ant", "Deltoïde antérieur"], ["delt_lat", "Deltoïde latéral"], ["delt_post", "Deltoïde postérieur"]] },
  { id: "bic", n: "Fléchisseurs du coude", g: 0, rec: 36, f: [["bic_long", "Biceps longue portion"], ["bic_court", "Biceps courte portion"], ["brachial", "Brachial"], ["brachio_rad", "Brachio-radial"]] },
  { id: "tri", n: "Triceps", g: 0, rec: 36, f: [["tri_long", "Longue portion"], ["tri_lat", "Vaste latéral"], ["tri_med", "Vaste médial"]] },
  { id: "avb", n: "Avant-bras", g: 0, rec: 24, f: [["avb_flex", "Fléchisseurs (prise)"], ["avb_ext", "Extenseurs"]] },
  { id: "abdo", n: "Abdominaux", g: 0, rec: 24, f: [["abdo_sup", "Grand droit (partie haute)"], ["abdo_inf", "Grand droit (partie basse)"], ["obliques", "Obliques"], ["transverse", "Transverse"]] },
  { id: "lomb", n: "Lombaires", g: 0, rec: 48, f: [["erecteurs", "Érecteurs du rachis"]] },
  { id: "quad", n: "Quadriceps", g: 1, rec: 60, f: [["droit_fem", "Droit fémoral"], ["vaste_lat", "Vaste latéral"], ["vaste_med", "Vaste médial"]] },
  { id: "isch", n: "Ischio-jambiers", g: 1, rec: 60, f: [["bf_long", "Biceps fémoral longue portion"], ["bf_court", "Biceps fémoral courte portion"], ["semi", "Semi-tendineux et semi-membraneux"]] },
  { id: "fess", n: "Fessiers", g: 1, rec: 48, f: [["gd_fess", "Grand fessier"], ["moy_fess", "Moyen fessier"], ["pt_fess", "Petit fessier"]] },
  { id: "add", n: "Adducteurs", g: 0, rec: 48, f: [["adducteurs", "Adducteurs"]] },
  { id: "mol", n: "Mollets", g: 0, rec: 24, f: [["gastroc", "Gastrocnémiens (jambe tendue)"], ["soleaire", "Soléaire (genou fléchi)"]] },
];
export const HEAD = Object.fromEntries(MUSCLES_FX.flatMap(m => m.f.map(([id, n]) => [id, { id, n, m: m.id }])));
export const muscleOfHead = (h) => MUSCLES_FX.find(m => m.id === HEAD[h]?.m) || null;
export const TENSION = { E: "Étirement", C: "Contraction", M: "Mixte" };

// Règles par nom d'exercice (sans accents, en minuscules). d = faisceaux directs, i = indirects, t = profil de tension.
const R = (re, d, i = [], t = "M") => ({ re, d, i, t });
const TRI = ["tri_lat", "tri_med"];
const RULES = [
  R(/leg curl assis|(leg|jambe).*curl.*assis|seated leg curl/, ["bf_long", "semi"], ["gastroc"], "E"),
  R(/nordic|glute.?ham/, ["semi", "bf_long"], ["bf_court", "gastroc"], "E"),
  R(/leg curl|curl (des )?jambes?|ischio/, ["bf_court", "semi"], ["bf_long", "gastroc"], "C"),
  R(/curl.*(incline|allonge|bayesian|derriere)/, ["bic_long"], ["bic_court", "brachial"], "E"),
  R(/curl.*(pupitre|preacher|larry|scott)/, ["bic_court"], ["brachial", "bic_long"], "E"),
  R(/curl.*(concentration|spider)/, ["bic_court"], ["brachial"], "C"),
  R(/curl.*(marteau|hammer|corde)|marteau/, ["brachial", "brachio_rad"], ["bic_long", "avb_flex"], "M"),
  R(/curl.*(inverse|prise pronation|reverse)/, ["brachio_rad", "brachial"], ["avb_ext"], "M"),
  R(/curl (poignet|des poignets)|flexion.*poignet|wrist curl/, ["avb_flex"], [], "M"),
  R(/extension.*poignet|reverse wrist/, ["avb_ext"], [], "M"),
  R(/curl/, ["bic_long", "bic_court"], ["brachial", "brachio_rad"], "M"),
  R(/pull.?over/, ["dors_inf", "grand_rond"], ["pec_stern", "tri_long"], "E"),
  R(/dips|developpe decline|decline/, ["pec_abdo", ...TRI], ["pec_stern", "delt_ant", "tri_long"], "E"),
  R(/developpe serre|close.?grip|prise serree.*developpe/, [...TRI], ["pec_stern", "delt_ant", "tri_long"], "M"),
  R(/developpe.*incline|incline.*(developpe|press)|developpe haut|landmine press/, ["pec_clav", "delt_ant"], ["pec_stern", ...TRI], "M"),
  R(/oiseau|reverse fly|rear delt|deltoide arriere|pec.?deck inverse|reverse pec/, ["delt_post"], ["trap_moy"], "C"),
  R(/ecarte.*(haltere|banc)|fly.*haltere/, ["pec_stern"], ["pec_clav", "delt_ant"], "E"),
  R(/ecarte|butterfly|pec.?deck|cable.?cross|croise|fly/, ["pec_stern"], ["pec_clav", "pec_abdo", "delt_ant"], "C"),
  R(/floor press/, ["pec_stern", ...TRI], ["delt_ant"], "C"),
  R(/developpe couche|bench|chest press|pompe|push.?up|developpe machine|convergente/, ["pec_stern"], ["pec_clav", "delt_ant", ...TRI], "M"),
  R(/face.?pull/, ["delt_post", "trap_moy"], ["trap_inf"], "C"),
  R(/shrug|haussement/, ["trap_sup"], ["avb_flex"], "C"),
  R(/y.?raise|elevation en y|raise en y/, ["trap_inf", "delt_lat"], ["trap_moy"], "C"),
  R(/elevation laterale.*(poulie|cable)|lateral.*cable/, ["delt_lat"], ["trap_sup"], "E"),
  R(/elevation laterale|lateral raise|laterale/, ["delt_lat"], ["trap_sup"], "C"),
  R(/elevation frontale|front raise|frontale/, ["delt_ant"], ["pec_clav"], "C"),
  R(/tirage menton|upright row|rowing menton/, ["delt_lat", "trap_sup"], ["delt_ant", "bic_long"], "C"),
  R(/developpe militaire|overhead press|developpe epaule|developpe nuque|arnold|shoulder press|push press|developpe assis haltere|military/, ["delt_ant"], ["delt_lat", ...TRI, "trap_sup"], "M"),
  R(/traction.*(supination|serre)|chin.?up|tirage.*(supination|serre|triangle)/, ["dors_inf"], ["bic_court", "bic_long", "brachial", "grand_rond"], "E"),
  R(/traction|pull.?up|tirage vertical|lat pull|tirage poitrine|tirage nuque|tirage haut|tirage poulie haute/, ["dors_sup", "grand_rond"], ["dors_inf", "bic_long", "brachial", "trap_inf", "delt_post"], "E"),
  R(/rowing.*(coudes? (ouverts|ecartes)|large)|tirage.*(large|coudes)/, ["trap_moy", "delt_post", "dors_sup"], ["bic_long", "brachial"], "C"),
  R(/rowing.*(barre|pendlay|penche|yates)|(^|\s)t.?bar\b|rowing t\b/, ["dors_inf", "trap_moy"], ["dors_sup", "delt_post", "bic_long", "brachial", "erecteurs"], "C"),
  R(/rowing|tirage horizontal|tirage assis|seated row|meadows|kroc|tirage unilateral|tirage poulie basse/, ["dors_inf", "trap_moy"], ["dors_sup", "delt_post", "bic_long", "brachial"], "M"),
  R(/extension.*(au.?dessus|overhead|nuque|derriere la tete)|francaise.*derriere|katana/, ["tri_long"], ["tri_med", "tri_lat"], "E"),
  R(/barre au front|skull|extension.*(allonge|couche)|francaise|jm press/, ["tri_long", "tri_med"], ["tri_lat"], "E"),
  R(/pushdown|push.?down|extension.*poulie|kickback triceps|kick.?back.*triceps|triceps.*(kick.?back|poulie)/, ["tri_lat", "tri_med"], ["tri_long"], "C"),
  R(/souleve de terre roumain|roumain|rdl|jambes tendues|stiff|good.?morning/, ["semi", "bf_long", "gd_fess"], ["erecteurs", "adducteurs", "avb_flex"], "E"),
  R(/souleve de terre|deadlift|trap.?bar|sumo/, ["gd_fess", "erecteurs"], ["bf_long", "semi", "vaste_lat", "vaste_med", "adducteurs", "trap_sup", "avb_flex"], "M"),
  R(/hip thrust|pont fessier|glute bridge|pont/, ["gd_fess"], ["bf_long", "moy_fess"], "C"),
  R(/abduct/, ["moy_fess", "pt_fess"], [], "C"),
  R(/adduct|copenhag/, ["adducteurs"], [], "M"),
  R(/kickback|extension (de )?hanche|donkey kick/, ["gd_fess"], ["bf_long"], "C"),
  R(/leg extension|extension.*jambe|extension.*quadri|sissy/, ["droit_fem", "vaste_lat", "vaste_med"], [], "C"),
  R(/fente|lunge|split squat|bulgare|bulgarian|step.?up/, ["vaste_lat", "vaste_med", "gd_fess"], ["droit_fem", "adducteurs", "moy_fess"], "E"),
  R(/squat|presse|leg press|hack|pendulum|belt squat/, ["vaste_lat", "vaste_med"], ["droit_fem", "gd_fess", "adducteurs", "erecteurs"], "E"),
  R(/mollet.*assis|seated calf|soleaire/, ["soleaire"], ["gastroc"], "M"),
  R(/mollet|calf|extension.*cheville/, ["gastroc"], ["soleaire"], "E"),
  R(/hyperextension|extension (lombaire|du dos)|back extension|banc a lombaire/, ["erecteurs"], ["gd_fess", "semi", "bf_long"], "M"),
  R(/releve.*(jambe|genou)|leg raise|reverse crunch|crunch inverse|knee raise/, ["abdo_inf"], ["obliques", "abdo_sup"], "M"),
  R(/russian|oblique|pallof|bucheron|woodchop|gainage lateral|side plank|planche laterale/, ["obliques"], ["transverse"], "C"),
  R(/roue|ab.?wheel|rollout/, ["abdo_sup", "abdo_inf"], ["transverse", "dors_inf"], "E"),
  R(/planche|gainage|plank|dead.?bug|hollow|vacuum/, ["transverse"], ["abdo_sup", "abdo_inf", "obliques"], "M"),
  R(/crunch|enroulement|sit.?up/, ["abdo_sup"], ["abdo_inf", "obliques"], "C"),
  R(/fermier|farmer|suspension|dead hang/, ["avb_flex"], ["trap_sup"], "M"),
];
// Repli : le muscle principal du moteur vers ses faisceaux par défaut
const COARSE = { "Pecs": ["pec_stern"], "Dos-largeur": ["dors_sup"], "Dos-épaisseur": ["trap_moy", "dors_inf"], "Épaules-avant": ["delt_ant"], "Épaules-latéral": ["delt_lat"], "Épaules-arrière": ["delt_post"], "Trapèzes": ["trap_sup"], "Biceps": ["bic_long", "bic_court"], "Triceps": ["tri_lat", "tri_med"], "Avant-bras": ["avb_flex"], "Abdos": ["abdo_sup"], "Lombaires": ["erecteurs"], "Quadriceps": ["vaste_lat", "vaste_med"], "Ischios": ["semi", "bf_long"], "Fessiers": ["gd_fess"], "Adducteurs": ["adducteurs"], "Mollets": ["gastroc"] };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const cache = new Map();
// Faisceaux d'un exercice : { d: directs, i: indirects, t: profil de tension }
export function headsOf(name, musclesOf = () => []) {
  if (cache.has(name)) return cache.get(name);
  const n = norm(name); let r = RULES.find(x => x.re.test(n));
  if (!r) { const m = musclesOf(name) || []; const d = COARSE[m[0]] || [], i = m.slice(1).flatMap(x => COARSE[x] || []).filter(h => !d.includes(h)); r = { d, i, t: "M" }; }
  const v = { d: r.d, i: r.i.filter(h => !r.d.includes(h)), t: r.t }; cache.set(name, v); return v;
}

// Comptage : chaque série de travail donne 1 à chaque faisceau direct et 0,5 à chaque indirect.
// Au niveau du muscle, une série compte une fois (1 si un faisceau direct, sinon 0,5), même si plusieurs faisceaux sont touchés.
export function countSets(items, musclesOf) {
  const heads = {}, muscles = {}, byEx = [];
  for (const it of items) {
    const n = +it.sets || 0; if (!n) continue;
    const h = headsOf(it.name, musclesOf);
    h.d.forEach(x => { const o = heads[x] = heads[x] || { d: 0, i: 0 }; o.d += n; });
    h.i.forEach(x => { const o = heads[x] = heads[x] || { d: 0, i: 0 }; o.i += n; });
    const mD = new Set(h.d.map(x => HEAD[x]?.m)), mI = new Set(h.i.map(x => HEAD[x]?.m).filter(m => !mD.has(m)));
    mD.forEach(m => { const o = muscles[m] = muscles[m] || { d: 0, i: 0, ex: [] }; o.d += n; o.ex.push(it.name); });
    mI.forEach(m => { const o = muscles[m] = muscles[m] || { d: 0, i: 0, ex: [] }; o.i += n; });
    byEx.push({ ...it, h });
  }
  for (const m of Object.values(muscles)) m.eq = m.d + m.i * 0.5;
  for (const x of Object.values(heads)) x.eq = x.d + x.i * 0.5;
  return { heads, muscles, byEx };
}

// Jauge d'une séance pour un muscle (séries équivalentes) : où commence le volume poubelle
export function seuils(mid) { const g = MUSCLES_FX.find(m => m.id === mid)?.g; return g ? { prod: 4, haut: 8, max: 10, junk: 12 } : { prod: 3, haut: 6, max: 8, junk: 10 }; }
export function jauge(mid, eq) {
  const s = seuils(mid);
  if (eq <= 0) return { k: "zero", l: "Pas travaillé", pct: 0 };
  if (eq < s.prod) return { k: "faible", l: "Stimulus léger", pct: eq / s.junk };
  if (eq <= s.haut) return { k: "prod", l: "Volume productif", pct: eq / s.junk };
  if (eq <= s.max) return { k: "haut", l: "Proche du maximum utile", pct: eq / s.junk };
  if (eq <= s.junk) return { k: "max", l: "Au maximum utile", pct: eq / s.junk };
  return { k: "junk", l: "Volume poubelle", pct: 1, trop: Math.ceil(eq - s.max) };
}

// Exercices redondants dans une même séance : mêmes faisceaux directs et même profil de tension
export function redondances(items, musclesOf) {
  const out = [], seen = [];
  for (const it of items) {
    const h = headsOf(it.name, musclesOf); if (!h.d.length) continue;
    const k = h.d.slice().sort().join("+") + "|" + h.t;
    const prev = seen.find(s => s.k === k && s.name !== it.name);
    if (prev) out.push({ a: prev.name, b: it.name, t: h.t, heads: h.d });
    seen.push({ k, name: it.name });
  }
  return out;
}

// Récupération : pour chaque muscle, heures restantes depuis sa dernière séance chargée.
// Base selon le muscle, plus longue après beaucoup de séries ou des séries très proches de l'échec.
export function recuperation(workouts, musclesOf, now = Date.now()) {
  const out = {};
  for (const w of workouts) {
    const end = new Date(w.end || w.start).getTime(); if (!end || now - end > 6 * 864e5) continue;
    const items = (w.exercises || []).map(e => ({ name: e.name, sets: (e.sets || []).filter(s => s.done && s.type !== "W").length, rpe: Math.max(0, ...(e.sets || []).filter(s => s.done && s.rpe != null).map(s => +s.rpe)) }));
    const c = countSets(items, musclesOf);
    const dur = Math.max(0, ...items.map(x => x.rpe || 0));
    for (const [mid, v] of Object.entries(c.muscles)) {
      if (v.eq < 2) continue;
      const M = MUSCLES_FX.find(m => m.id === mid), s = seuils(mid);
      let h = M.rec * (v.eq >= s.haut ? 1.25 : v.eq < s.prod ? 0.6 : 1); if (dur >= 9.5) h += 12;
      const pret = end + h * 36e5, cur = out[mid];
      if (!cur || pret > cur.pret) out[mid] = { pret, h: Math.round(h), eq: v.eq, le: end };
    }
  }
  for (const [mid, x] of Object.entries(out)) x.reste = Math.max(0, Math.round((x.pret - now) / 36e5));
  return out;
}

// Pistes pour raccourcir une séance : supersets possibles, échauffements à alléger, séries à retirer (et à garder)
const ANTAGONISTES = [["pecs", "dorsal"], ["pecs", "trap"], ["bic", "tri"], ["quad", "isch"], ["delt", "abdo"], ["mol", "abdo"], ["fess", "abdo"], ["delt", "bic"], ["delt", "tri"], ["quad", "abdo"], ["isch", "mol"]];
export function raccourcir(exs, { musclesOf, semaine = {} } = {}) {
  const left = exs.map((e, xi) => ({ ...e, xi })).filter(e => e.sets.some(s => !s.done && s.type !== "W"));
  const mus = (e) => new Set(headsOf(e.name, musclesOf).d.map(h => HEAD[h]?.m));
  const ss = [];
  for (let a = 0; a < left.length; a++) for (let b = a + 1; b < left.length; b++) {
    const A = left[a], B = left[b]; if (A.ss && A.ss === B.ss) continue;
    const ma = mus(A), mb = mus(B); if ([...ma].some(m => mb.has(m))) continue;
    const anta = ANTAGONISTES.some(([x, y]) => (ma.has(x) && mb.has(y)) || (ma.has(y) && mb.has(x)));
    const n = Math.min(A.sets.filter(s => !s.done && s.type !== "W").length, B.sets.filter(s => !s.done && s.type !== "W").length);
    const gain = Math.round(n * Math.min(A.rest || 90, B.rest || 90) / 60);
    ss.push({ a: A.name, b: B.name, xa: A.xi, xb: B.xi, anta, gain });
  }
  ss.sort((x, y) => (y.anta - x.anta) || (y.gain - x.gain));
  const choisis = [], pris = new Set();
  for (const p of ss) if (!pris.has(p.xa) && !pris.has(p.xb)) { choisis.push(p); pris.add(p.xa); pris.add(p.xb); }
  // Échauffement : un muscle déjà chauffé par un exercice précédent n'a besoin que d'une série d'approche
  const chauffes = new Set(), echauf = [];
  exs.forEach((e, xi) => { const m = mus(e), w = e.sets.filter(s => s.type === "W" && !s.done).length; if (w > 1 && [...m].some(x => chauffes.has(x))) echauf.push({ name: e.name, xi, garder: 1, retirer: w - 1 }); m.forEach(x => chauffes.add(x)); });
  // Séries : au-delà du maximum utile de la séance (ou de la semaine), on peut enlever ; un faisceau qui n'est touché que par un exercice est à garder
  const c = countSets(exs.map(e => ({ name: e.name, sets: e.sets.filter(s => s.type !== "W").length })), musclesOf);
  const retirer = [], garder = [];
  for (const [mid, v] of Object.entries(c.muscles)) {
    const s = seuils(mid), dejaSem = semaine[mid] || 0, trop = Math.max(Math.ceil(v.eq - s.max), dejaSem >= 16 ? Math.ceil(v.eq / 3) : 0);
    if (trop > 0) { const dernier = [...exs].reverse().find(e => mus(e).has(mid) && e.sets.some(x => !x.done && x.type !== "W")); if (dernier) retirer.push({ mid, name: dernier.name, n: Math.min(trop, dernier.sets.filter(x => !x.done && x.type !== "W").length - 1), pourquoi: dejaSem >= 16 ? `déjà ${Math.round(dejaSem)} séries cette semaine` : `${Math.round(v.eq)} séries dans la séance` }); }
  }
  for (const [h, v] of Object.entries(c.heads)) if (v.d && exs.filter(e => headsOf(e.name, musclesOf).d.includes(h)).length === 1) { const e = exs.find(e => headsOf(e.name, musclesOf).d.includes(h)); if (!garder.some(g => g.name === e.name)) garder.push({ name: e.name, h }); }
  return { ss: choisis.slice(0, 3), echauf, retirer: retirer.filter(r => r.n > 0), garder };
}
