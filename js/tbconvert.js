// Conversion d'un programme TB my Coach (séances + prescriptions par semaine) en programme perso CalXsthenos,
// et calcul de la position (séance suivante) à partir de la dernière séance faite dans le carnet TB.
import { parseSets } from "./engine.js";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function convertTb(raw, tag = "main") {
  const sess = Array.isArray(raw?.sessions) ? raw.sessions : [];
  if (!sess.length) return null;
  const weeks = (raw.phases || []).length || 12;
  const s = sess.map((ses, i) => {
    const rows = (ses.ex || []).map(ex => {
      const wk = {};
      (ex.weeks || []).forEach((str, w) => { if (w >= 1 && str) wk[w] = parseSets(String(str).replace(/%%/g, "%")); });
      const first = wk[1] || [];
      return [ex.name, "S", ex.note || "", ex.ss || null, null, { weeks: wk, sets: first.length ? first : parseSets("3x8-12 RPE8"), rest: 120 }];
    });
    return [ses.name || `Séance ${i + 1}`, DAYS.includes(ses.day) ? ses.day : "Lundi", rows];
  });
  const program = {
    id: "tb-" + tag, custom: true, name: "Programme TB my Coach", lvl: "Tous niveaux", split: "",
    weeks, deload: { every: 5 }, days: DAYS.map(d => sess.some(x => x.day === d)), s, prof: "", desc: "", publish: false,
  };
  if (raw.phases?.length) program.phases = raw.phases;
  return program;
}

// Séance suivante après la dernière séance faite (last = { w, si }, si = index de séance TB)
export function tbPosition(program, last) {
  const n = program.s.length;
  const next = !last ? { week: 1, idx: 0 }
    : last.si + 1 < n ? { week: last.w, idx: last.si + 1 }
    : { week: Math.min(last.w + 1, program.weeks), idx: 0 };
  return { programId: program.id, startedAt: new Date().toISOString().slice(0, 10), week: next.week, idx: next.idx, cycle: 1 };
}
