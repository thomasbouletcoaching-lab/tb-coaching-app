// Réponse rapide depuis une notification : un geste et la donnée est notée (repas comme prévu, eau, nuit, heure de réveil)
import * as N from "../nutrition.js";
import * as E from "../engine.js";
import { S, update, today } from "../store.js";
import { $app, esc, fr, toast, routes, actions, header, tabbar, R, go, rerender, buzz } from "../core.js";

const hh = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
const enMin = (t) => { const [h, m] = String(t || "").split(":").map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const DUREES = [7, 7.5, 8, 8.5, 9];

routes.rep = () => {
  const k = R.param || "", t = today(), D = S().daily[t] || {};
  let body = "";
  if (k === "repas") {
    const T = N.targets(), plan = T ? N.dayPlan(T, t) : [], faits = new Set(N.dayLog(t).map(e => e.meal)), cible = R.param2 ? decodeURIComponent(R.param2) : null;
    const reste = plan.filter(m => !faits.has(m.meal)).sort((a, b) => (b.meal === cible) - (a.meal === cible));
    body = `<p class="small muted">Tu as mangé ce qui était prévu ? Un geste suffit.</p>
      ${reste.length ? reste.map(m => `<div class="card mt12"><div class="row between"><b>${esc(m.meal)}</b><span class="xs muted">${m.time || ""} · ${fr(m.kcal || 0)} kcal</span></div><p class="small muted" style="margin:4px 0 10px">${esc(m.n || "")}</p>
        <div class="row" style="gap:8px"><button class="btn btn-red btn-sm grow" data-a="rep-eat" data-m="${esc(m.meal)}">✅ Comme prévu</button><button class="btn btn-line btn-sm grow" data-a="go" data-r="food">✏️ Autre chose</button></div></div>`).join("")
        : `<div class="card mt12 center"><div style="font-size:40px">🎉</div><b>Tous tes repas du jour sont notés.</b></div>`}`;
  } else if (k === "eau") {
    const v = D.water || 0;
    body = `<div class="card mt12 center"><div style="font-size:44px">💧</div><div class="h1" style="margin:4px 0">${fr(v * .25, 2)} L</div><p class="small muted" style="margin:0">sur 2 L conseillés</p>
      <div class="row mt16" style="gap:8px;justify-content:center">${[[1, "+ 1 verre"], [2, "+ 50 cl"], [4, "+ 1 L"]].map(([n, l]) => `<button class="btn btn-line btn-sm" data-a="rep-eau" data-v="${n}">${l}</button>`).join("")}</div></div>`;
  } else if (k === "sommeil") {
    const h = D.sleep, q = D.sleepQ;
    body = `<p class="small muted">Combien d'heures as-tu dormi cette nuit ?</p>
      <div class="chips wrap mt8">${[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(x => `<button class="chip ${h === x ? "on" : ""}" data-a="rep-sleep" data-v="${x}">${String(x).replace(".", ",")} h</button>`).join("")}</div>
      <p class="small muted mt16">Et la qualité ?</p>
      <div class="chips wrap mt8">${[[1, "😫 Mauvaise"], [2, "😐 Moyenne"], [3, "🙂 Bonne"], [4, "😴 Excellente"]].map(([v, l]) => `<button class="chip ${q === v ? "on" : ""}" data-a="rep-sq" data-v="${v}">${l}</button>`).join("")}</div>
      ${h ? `<button class="btn btn-red mt16" data-a="go" data-r="home">C'est noté ✓</button>` : ""}`;
  } else if (k === "reveil") {
    const sl = S().settings?.sleep || {}, w = sl.wake || "07:00", need = sl.need || 8, bed = hh(enMin(w) - need * 60);
    body = `<p class="small muted">À quelle heure tu te lèves demain ?</p>
      <div class="chips wrap mt8">${["05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30"].map(x => `<button class="chip ${w === x ? "on" : ""}" data-a="rep-wake" data-v="${x}">${x}</button>`).join("")}</div>
      <p class="small muted mt16">Combien d'heures de sommeil tu vises ?</p>
      <div class="chips wrap mt8">${DUREES.map(x => `<button class="chip ${need === x ? "on" : ""}" data-a="rep-need" data-v="${x}">${String(x).replace(".", ",")} h</button>`).join("")}</div>
      <div class="card mt16 center"><div class="xs muted">Pour te lever à ${w}, couche-toi à</div><div class="h1" style="margin:4px 0">🛏️ ${bed}</div><p class="xs muted" style="margin:0">Je te le rappellerai 30 minutes avant.</p></div>
      <button class="btn btn-red mt12" data-a="rep-wake-ok">Valider</button>`;
  } else if (k === "heure") {
    const j = /^\d{4}-\d\d-\d\d$/.test(R.param2 || "") ? R.param2 : t, a = E.agenda(j, j)[j], cur = E.slotOf(j).time;
    body = `<p class="small muted">${a?.title ? `<b>${esc(a.title)}</b><br>` : ""}À quelle heure peux-tu t'entraîner ${j === t ? "aujourd'hui" : "ce jour-là"} ?</p>
      <div class="chips wrap mt8">${["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "12:30", "13:00", "14:00", "16:00", "17:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"].map(x => `<button class="chip ${cur === x ? "on" : ""}" data-a="rep-heure" data-d="${j}" data-v="${x}">${x}</button>`).join("")}</div>
      <p class="small muted mt16">Une autre heure ?</p><div class="row mt8" style="gap:8px"><input class="inp grow" type="time" id="rep-h" value="${cur || ""}"><button class="btn btn-red btn-sm" style="width:auto" data-a="rep-heure" data-d="${j}" data-v="">OK</button></div>
      ${cur ? `<div class="card mt16 center"><div class="xs muted">C'est noté</div><div class="h1" style="margin:4px 0">🗓️ ${cur}</div><p class="xs muted" style="margin:0">Thomas le voit. Je te préviens avant.</p></div>` : ""}`;
  } else body = `<p class="empty">Rien à répondre ici.</p>`;
  const titre = { repas: "🍽️ Mes repas", eau: "💧 Hydratation", sommeil: "😴 Ma nuit", reveil: "⏰ Mon réveil", heure: "🗓️ Ma séance" }[k] || "Réponse rapide";
  $app.innerHTML = header(titre, "Réponse rapide", { back: "home" }) + `<main class="page">${body}</main>${tabbar("home")}`;
};
actions["rep-eat"] = (b, d) => { actions["meal-eat"]?.(b, { m: d.m, d: today() }); buzz(12); toast(`${d.m} noté ✓`); setTimeout(() => routes.rep(), 50); };
actions["rep-eau"] = (b, d) => { update(st => { const x = st.daily[today()] = st.daily[today()] || {}; x.water = (x.water || 0) + +d.v; }); buzz(10); rerender(); };
actions["rep-sleep"] = (b, d) => { update(st => { const x = st.daily[today()] = st.daily[today()] || {}; x.sleep = +d.v; }); rerender(); };
actions["rep-sq"] = (b, d) => { update(st => { const x = st.daily[today()] = st.daily[today()] || {}; x.sleepQ = +d.v; }); rerender(); };
const setSleep = (o) => update(st => { const s = { wake: "07:00", need: 8, ...(st.settings.sleep || {}), ...o }; s.bed = hh(enMin(s.wake) - s.need * 60); st.settings.sleep = s; });
actions["rep-wake"] = (b, d) => { setSleep({ wake: d.v }); rerender(); };
actions["rep-need"] = (b, d) => { setSleep({ need: +d.v }); rerender(); };
actions["rep-wake-ok"] = () => { setSleep({}); toast(`Réveil ${S().settings.sleep.wake} · coucher ${S().settings.sleep.bed}`); go("home"); };
actions["rep-heure"] = (b, d) => { const v = d.v || document.getElementById("rep-h")?.value; if (!v) return toast("Choisis une heure"); E.setSlot(d.d, { time: v }); buzz(12); toast(`Séance à ${v} ✓`); rerender(); };
