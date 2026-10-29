// Agenda : mois et semaine, séances faites / loupées / prévues, déplacer une séance, vue du cycle.
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as N from "../nutrition.js";
import { $app, esc, fr, routes, actions, forms, changes, go, I, header, tabbar, seg, sheet, closeSheet, toast, fmtDate, addDays, rerender } from "../core.js";

let mode = "month", cursor = null; // cursor = 1er du mois affiché (YYYY-MM-01) ou lundi de la semaine
const MK = { done: "✓", missed: "✕", planned: "•", rest: "–", away: "↪" };
const CLS = { done: "dn", missed: "ms", planned: "pl", rest: "", away: "" };

function monthGrid(first) {
  const d0 = new Date(first + "T12:00:00");
  const last = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const end = first.slice(0, 8) + String(last).padStart(2, "0");
  const ag = E.agenda(first, end), lead = E.dowOf(first), t = today();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<button class="empty" tabindex="-1" aria-hidden="true"></button>`);
  for (let n = 1; n <= last; n++) {
    const k = first.slice(0, 8) + String(n).padStart(2, "0"), a = ag[k];
    cells.push(`<button class="${a ? CLS[a.st] + " has" : ""} ${k === t ? "today" : ""}" data-a="ag-day" data-v="${k}" aria-label="${fmtDate(k)}${a ? " : " + esc(a.title) : ""}"><span>${n}</span><span class="mk">${a ? MK[a.st] : ""}${N.cheatOn(k).length ? "🍕" : ""}</span></button>`);
  }
  const stats = Object.values(ag).reduce((o, a) => (o[a.st] = (o[a.st] || 0) + 1, o), {});
  return { html: `<div class="cal">${E.DAY_SHORT.map(d => `<div class="dh">${d}</div>`).join("")}${cells.join("")}</div>`, stats };
}
function weekList(mon) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)), ag = E.agenda(days[0], days[6]), t = today();
  return `<div class="list">${days.map((k, i) => {
    const a = ag[k];
    const em = a ? { done: "✅", missed: "❌", planned: "🏋️", rest: "😌", away: "↪️" }[a.st] : "·";
    const sub = !a ? "Repos" : a.st === "done" ? "Faite" : a.st === "missed" ? "Loupée" : a.st === "planned" ? (a.moved ? "Prévue (déplacée)" : "Prévue") : a.st === "away" ? `Déplacée au ${fmtDate(a.to, { weekday: "long", day: "numeric" })}` : "Repos choisi";
    return `<button class="li" data-a="ag-day" data-v="${k}" style="${k === t ? "box-shadow:0 0 0 2px var(--red) inset;border-radius:14px" : ""}"><span class="em" style="font-size:22px">${em}</span><span class="grow"><b>${E.DAY_NAMES[i]} ${Number(k.slice(8))}</b><br><span class="small muted">${a && a.st !== "rest" && a.st !== "away" ? esc(a.title) + " · " : ""}${sub}${N.cheatOn(k).length ? " · 🍕 Cheat meal" : ""}</span>${a && (a.st === "planned" || a.st === "missed") && slotTxt(a) ? `<br><span class="xs muted">🕐 ${esc(slotTxt(a))}</span>` : ""}</span>${a?.st === "planned" && a.time ? `<b class="small" style="color:var(--red)">${a.time}</b>` : ""}${I.chev}</button>`;
  }).join("")}</div>
  <button class="btn btn-line btn-sm mt8" data-a="week-plan" style="width:100%">🔁 Ma semaine type : jours, heures, durée, lieu</button>
  <p class="xs muted center mt8">Touche un jour pour décaler une séance, changer son heure ou prendre un repos.</p>`;
}
function cycleBlock() {
  const ns = E.nextSession(); if (!ns) return "";
  const ov = E.cycleOverview(ns.p);
  return `<h2 class="sec">🎯 Mon cycle <small>${ov.weeks} semaines · cycle ${ns.cycle}</small></h2>
    <div class="card"><div class="lbl">${esc(ns.p.n || ns.p.name || "Programme")}</div>
    <div class="gauge mt8"><i style="width:${Math.round((ns.week - 1) / ov.weeks * 100)}%"></i></div>
    <div class="cycle mt12">${ov.rows.map(r => `<div class="wk ${r.w === ns.week ? "cur" : ""}"><b class="num">S${r.w}</b><span><b class="small">${esc(r.phase)}</b>${r.w < ns.week ? ` <span class="tag g">faite</span>` : r.w === ns.week ? ` <span class="tag r">en cours</span>` : ""}<br><span class="xs muted">${ov.kinds.slice(0, 3).map(k => `${E.KIND_LABEL[k] || k} ${esc(r.schemes[k])}`).join(" · ")}</span></span></div>`).join("")}</div>
    <p class="xs muted mt8">Les séries, répétitions et RPE changent chaque semaine. Tes charges suivent tes performances réelles.</p></div>`;
}

// Les vues de l'agenda vivent maintenant dans l'accueil (Semaine, Mois, Année)
export const AG = { week: null, month: null, year: null };
export function agendaWeekView() {
  const t = today(); if (!AG.week) AG.week = addDays(t, -E.dowOf(t));
  return `${navRow("week", `Semaine du ${fmtDate(AG.week, { day: "numeric", month: "long" })}`)}<div class="mt12">${weekList(AG.week)}</div>`;
}
export function agendaMonthView() {
  const t = today(); if (!AG.month) AG.month = t.slice(0, 8) + "01";
  const g = monthGrid(AG.month), title = new Date(AG.month + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return `${navRow("month", title)}<div class="card mt12">${g.html}<div class="legend"><span><i style="background:var(--good)"></i>Faite ${g.stats.done || 0}</span><span><i style="background:var(--red)"></i>Loupée ${g.stats.missed || 0}</span><span><i style="background:#2563EB"></i>Prévue ${g.stats.planned || 0}</span></div></div>
    <p class="small muted center mt8">Touche un jour pour voir la séance, la déplacer ou prendre un jour de repos.</p>${cycleBlock()}`;
}
export function agendaYearView(extra = "") {
  const y = AG.year || new Date().getFullYear(), t = today();
  const months = Array.from({ length: 12 }, (_, m) => `${y}-${String(m + 1).padStart(2, "0")}-01`);
  const ag = E.agenda(`${y}-01-01`, `${y}-12-31`);
  const all = Object.values(ag), done = all.filter(a => a.st === "done").length, missed = all.filter(a => a.st === "missed").length;
  const ws = S().workouts.filter(w => w.end.slice(0, 4) === String(y));
  const ton = ws.reduce((a, w) => a + (w.volume || 0), 0);
  const mini = (first) => { const d0 = new Date(first + "T12:00:00"), last = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate(), lead = E.dowOf(first);
    let c = ""; for (let i = 0; i < lead; i++) c += `<i class="e"></i>`;
    for (let n = 1; n <= last; n++) { const k = first.slice(0, 8) + String(n).padStart(2, "0"), a = ag[k]; c += `<i class="${a ? CLS[a.st] : ""} ${k === t ? "t" : ""}"></i>`; }
    const n = Object.entries(ag).filter(([k, a]) => k.startsWith(first.slice(0, 7)) && a.st === "done").length;
    return `<button class="ymon" data-a="ag-open-month" data-v="${first}"><b>${d0.toLocaleDateString("fr-FR", { month: "short" })}</b><span class="xs muted">${n ? n + " séance" + (n > 1 ? "s" : "") : ""}</span><div class="ygrid">${c}</div></button>`; };
  return `${navRow("year", String(y))}<div class="card mt12"><div class="stat3"><div><b>${done}</b><span>séances faites</span></div><div><b>${fr(ton / 1000, 1)}</b><span>tonnes soulevées</span></div><div><b>${done + missed ? Math.round(done / (done + missed) * 100) + " %" : "–"}</b><span>régularité</span></div></div></div>
    ${extra}<div class="yeargrid mt12">${months.map(mini).join("")}</div>`;
}
function navRow(m, title) { return `<div class="row between mt16"><button class="icon-btn" data-a="ag-nav" data-m="${m}" data-v="-1" aria-label="Précédent">${I.back}</button><b class="h3" style="text-transform:capitalize">${esc(title)}</b><button class="icon-btn" data-a="ag-nav" data-m="${m}" data-v="1" aria-label="Suivant" style="transform:scaleX(-1)">${I.back}</button></div>`; }
actions["ag-nav"] = (b, d) => {
  const m = d.m, v = +d.v;
  if (m === "month") { const x = new Date(AG.month + "T12:00:00"); x.setMonth(x.getMonth() + v, 1); AG.month = today(x).slice(0, 8) + "01"; }
  else if (m === "week") AG.week = addDays(AG.week, 7 * v);
  else AG.year = (AG.year || new Date().getFullYear()) + v;
  rerender();
};
actions["ag-open-month"] = (b, d) => { AG.month = d.v; go("home", "month"); };
routes.agenda = () => go("home", "month");

const slotTxt = (a) => [a.time, a.dur ? a.dur + " min" : "", a.place].filter(Boolean).join(" · ");
const PLACES = ["Salle", "Maison", "Extérieur"];
actions["ag-day"] = (b, d) => {
  const k = d.v, a = E.agenda(k, k)[k], t = today();
  let html = `<h2 class="h1" style="text-transform:capitalize">${fmtDate(k)}</h2>`;
  if (a?.st === "done") html += a.w.map(w => `<div class="card mt12"><div class="lbl">✅ Séance faite · ${new Date(w.start).toTimeString().slice(0, 5)}</div><b class="h3">${esc(w.title)}</b><p class="small muted mt4">${w.setsDone} séries · ${(w.volume / 1000).toFixed(1).replace(".", ",")} t · ${Math.round((new Date(w.end) - new Date(w.start)) / 6e4)} min</p>
      <div class="small mt8">${w.exercises.filter(e => e.sets.some(s => s.done)).map(e => `<div class="row between"><span>${esc(e.name)}</span><span class="muted">${e.sets.filter(s => s.done && s.type !== "W").map(s => s.kg ? `${E.fmtKg(s.kg)}×${s.reps}` : s.reps).join(" · ")}</span></div>`).join("")}</div>
      <div class="row mt12" style="gap:8px"><button class="btn btn-line btn-sm grow" data-a="w-edit" data-id="${w.id}">✏️ Modifier</button><button class="btn btn-ghost btn-sm grow" data-a="w-del" data-id="${w.id}" style="color:var(--red)">🗑️ Supprimer</button></div></div>`).join("");
  else if (a?.st === "planned" || (a?.st === "missed")) {
    const quick = Array.from({ length: 8 }, (_, i) => addDays(k < t ? t : k, i - (k < t ? 0 : 1))).filter(x => x >= t && x !== k).slice(0, 7);
    html += `<div class="card mt12"><div class="lbl">${a.st === "missed" ? "❌ Séance loupée" : "🏋️ Prévue"}${a.time ? ` · ${a.time}` : ""}</div><b class="h3">${esc(a.title)}</b>${slotTxt(a) ? `<p class="small muted mt4" style="margin-bottom:0">${esc(slotTxt(a))}</p>` : ""}
      ${k === t ? `<button class="btn btn-red mt12" data-a="start">Commencer maintenant</button>` : ""}
      ${a.st === "missed" ? `<p class="small muted mt8">Tu peux la rattraper : déplace-la à un autre jour.</p>` : ""}</div>
      <h3 class="sec">${a.st === "missed" ? "Rattraper le" : "Décaler au"}</h3>
      <div class="chips wrap">${quick.map(x => `<button class="chip" data-a="mv-day" data-v="${x}">${fmtDate(x, { weekday: "short", day: "numeric" })}</button>`).join("")}</div>
      <form data-f="ag-move" data-f0="${k}" class="mt12"><div class="grid2"><label class="field"><span>Ou une autre date</span><input type="date" name="to" min="${t}" max="${addDays(t, 120)}" value="${k >= t ? k : t}" required></label><label class="field"><span>Heure</span><input type="time" name="time" value="${a.time || ""}"></label></div>
      ${k >= t ? `<div class="grid2 mt8"><label class="field"><span>Durée</span><select name="dur">${[30, 40, 45, 50, 60, 75, 90, 120].map(m => `<option ${+a.dur === m ? "selected" : ""} value="${m}">${m} min</option>`).join("")}</select></label><label class="field"><span>Lieu</span><input name="place" value="${esc(a.place || "")}" list="ag-places" placeholder="Salle, maison…"><datalist id="ag-places">${PLACES.map(x => `<option value="${x}">`).join("")}</datalist></label></div>` : ""}
      <button class="btn btn-red btn-sm mt12" style="width:100%">Enregistrer</button></form>
      ${k >= t ? `<button class="btn btn-line btn-sm mt8" data-a="ag-skip" data-v="${k}" style="width:100%">Prendre ce jour en repos</button>` : ""}`;
  }
  else if (a?.st === "away") html += `<div class="card mt12"><p>Séance déplacée au <b>${fmtDate(a.to)}</b>${E.slotOf(a.to).time ? ` à ${E.slotOf(a.to).time}` : ""}.</p><button class="btn btn-line btn-sm mt8" data-a="ag-move" data-f="${k}" data-v="${k}">Annuler le déplacement</button></div>`;
  else if (a?.st === "rest") html += `<div class="card mt12"><p>Repos choisi ce jour-là.</p><button class="btn btn-line btn-sm mt8" data-a="ag-skip" data-v="${k}">Remettre la séance</button></div>`;
  else html += `<div class="card mt12"><p class="muted">Jour de repos. Récupérer fait partie du programme.</p>${k === t ? `<button class="btn btn-line btn-sm mt8" data-a="free-session">Faire une séance libre</button>` : ""}${k >= t ? `<p class="xs muted mt8" style="margin-bottom:0">Pour t'entraîner ce jour-là, ouvre une séance prévue et décale-la ici.</p>` : ""}</div>`;
  html += `<button class="btn btn-ghost btn-sm mt12" data-a="week-plan" style="width:100%">🔁 Ma semaine type (jours et heures)</button>`;
  sheet(html, (w) => { w._from = k; });
};
actions["mv-day"] = (b, d) => { const f = document.querySelector('form[data-f="ag-move"]'); f.to.value = d.v; f.querySelectorAll('[data-a="mv-day"]').forEach(() => { }); document.querySelectorAll('[data-a="mv-day"]').forEach(x => x.classList.toggle("on", x === b)); };
forms["ag-move"] = (v, f) => {
  const from = f.dataset.f0, to = v.to; if (!to) return;
  if (to !== from) E.moveSession(from, to, v.time || E.slotOf(from).time);
  E.setSlot(to, { time: v.time || null, ...(v.dur ? { dur: +v.dur } : {}), ...(v.place !== undefined ? { place: v.place.trim() || null } : {}) });
  closeSheet(); toast(to === from ? "Séance mise à jour" : `Séance décalée au ${fmtDate(to, { weekday: "long", day: "numeric" })}${v.time ? ` à ${v.time}` : ""}`); rerender();
};
actions["ag-move"] = (b, d) => { E.moveSession(d.f, d.v); closeSheet(); toast(d.f === d.v ? "Déplacement annulé" : "Séance déplacée"); rerender(); };

// ---------- Semaine type : récurrence hebdomadaire ----------
actions["week-plan"] = () => weekPlanSheet();
function weekPlanSheet() {
  const ns = E.nextSession(), p = ns?.p, cur = E.schedule();
  const days = cur ? cur.days : E.DAY_NAMES.map((_, i) => ({ on: !!p?.days?.[i], time: "18:30", dur: S().profile?.sessionMin || 60, place: "Salle" }));
  const n = days.filter(x => x.on).length, need = p?.s.length || 0;
  sheet(`<h2 class="h2">🔁 Ma semaine type</h2><p class="small muted mt4">Tes créneaux reviennent chaque semaine. Une séance déplacée garde son nouveau jour.</p>
    <form data-f="week-plan" class="mt12">${E.DAY_NAMES.map((dn, i) => { const x = days[i]; return `<div class="wkrow ${x.on ? "on" : ""}"><label class="row" style="gap:8px;min-width:104px"><input type="checkbox" name="on${i}" ${x.on ? "checked" : ""} data-c="wk-on"><b class="small">${dn}</b></label>
      <input type="time" name="time${i}" value="${x.time || ""}" aria-label="Heure ${dn}"><select name="dur${i}" aria-label="Durée ${dn}">${[30, 40, 45, 50, 60, 75, 90, 120].map(m => `<option value="${m}" ${+x.dur === m ? "selected" : ""}>${m}′</option>`).join("")}</select><input name="place${i}" value="${esc(x.place || "")}" list="ag-places2" placeholder="Lieu" aria-label="Lieu ${dn}"></div>`; }).join("")}
      <datalist id="ag-places2">${PLACES.map(x => `<option value="${x}">`).join("")}</datalist>
      ${need ? `<p class="xs muted mt8">Ton programme compte <b>${need} séance${need > 1 ? "s" : ""}</b> par semaine${n !== need ? ` : tu as coché ${n} jour${n > 1 ? "s" : ""}.${n < need ? " Les séances restantes passent à la semaine suivante." : " Les jours en trop restent libres."}` : "."}</p>` : ""}
      <button class="btn btn-red mt12">Enregistrer ma semaine type</button></form>
    ${cur ? `<button class="btn btn-line btn-sm mt8" data-a="week-ics" style="width:100%">📅 Ajouter mes créneaux à mon calendrier</button><button class="btn btn-ghost btn-sm mt8" data-a="week-reset" style="width:100%">Revenir aux jours du programme</button>` : ""}`);
}
changes["wk-on"] = (el) => el.closest(".wkrow").classList.toggle("on", el.checked);
forms["week-plan"] = (v) => {
  const days = E.DAY_NAMES.map((_, i) => ({ on: !!v["on" + i], time: v["time" + i] || null, dur: +v["dur" + i] || 60, place: (v["place" + i] || "").trim() || null }));
  if (!days.some(d => d.on)) return toast("Coche au moins un jour.");
  update(st => st.schedule = { days });
  closeSheet(); toast("Semaine type enregistrée"); rerender();
};
actions["week-reset"] = () => { update(st => st.schedule = null); closeSheet(); toast("Jours du programme rétablis"); rerender(); };
// Export .ics avec récurrence hebdomadaire (Apple Calendrier, Google Agenda)
actions["week-ics"] = () => {
  const sc = E.schedule(); if (!sc) return;
  const BY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"], t = today(), mon = addDays(t, -E.dowOf(t));
  const pad = (x) => String(x).padStart(2, "0"), stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = sc.days.map((d, i) => { if (!d.on || !d.time) return ""; const day = addDays(mon, i) < t ? addDays(mon, i + 7) : addDays(mon, i); const [h, m] = d.time.split(":").map(Number); const end = new Date(2000, 0, 1, h, m + (d.dur || 60));
    return `BEGIN:VEVENT\r\nUID:cxs-${i}-${Date.now()}@calxsthenos\r\nDTSTAMP:${stamp}\r\nDTSTART;TZID=Europe/Paris:${day.replace(/-/g, "")}T${pad(h)}${pad(m)}00\r\nDTEND;TZID=Europe/Paris:${day.replace(/-/g, "")}T${pad(end.getHours())}${pad(end.getMinutes())}00\r\nRRULE:FREQ=WEEKLY;BYDAY=${BY[i]}\r\nSUMMARY:Séance TB my Coach\r\n${d.place ? `LOCATION:${d.place}\r\n` : ""}BEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Séance dans 30 min\r\nEND:VALARM\r\nEND:VEVENT\r\n`; }).join("");
  if (!ev) return toast("Indique une heure sur tes jours d'entraînement.");
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TB my Coach//FR\r\nCALSCALE:GREGORIAN\r\n${ev}END:VCALENDAR\r\n`;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "seances-calxsthenos.ics"; a.click();
  toast("Ouvre le fichier pour ajouter tes séances au calendrier");
};
actions["ag-skip"] = (b, d) => { E.toggleSkip(d.v); closeSheet(); toast("Agenda mis à jour"); rerender(); };
