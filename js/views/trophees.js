// Trophées, niveaux et récompenses : la régularité rendue visible.
import { GENRES, genreChoisi } from "../genre.js";
import { S, update } from "../store.js";
import { $app, esc, routes, actions, header, tabbar, buzz, I } from "../core.js";
import { gather, stageOf, TROPHIES, rewardsFor, unlockedTrophies, unlockedRewards, dailyQuests } from "../quests.js";

routes.trophees = () => {
  const c = gather();
  const st = stageOf(c.level);
  const got = unlockedTrophies(c), gotIds = new Set(got.map(t => t.id));
  const rw = unlockedRewards(c), rwIds = new Set(rw.map(r => r.id));
  const q = dailyQuests(c);
  $app.innerHTML = header("Trophées", "Régularité, niveaux et récompenses", { back: "home" }) + `<main class="page">
    <div class="card grad"><div class="row" style="gap:14px"><span style="font-size:52px;line-height:1">${st.icon}</span><div class="grow"><div class="lbl">Ton personnage</div><b class="h2">${esc(st.name)}</b><div class="small muted mt4">Niveau ${c.level} · ${c.points} points</div>
      <div class="gauge mt8"><i style="width:${c.levelPct}%"></i></div><div class="xs muted mt4">Prochain niveau à ${c.nextAt} pts</div></div></div>
      <p class="small mt8" style="margin:8px 0 0">${esc(st.line)}</p>
      ${genreChoisi(S().profile) ? "" : `<div class="mt12" style="border-top:1px solid var(--line);padding-top:12px"><div class="lbl" id="tr-l-genre">Comment veux-tu qu'on s'adresse à toi ?</div><div class="chips wrap mt8" role="group" aria-labelledby="tr-l-genre">${GENRES.map(([v, l]) => `<button type="button" class="chip" style="min-height:44px" data-a="genre-set" data-v="${v}">${l}</button>`).join("")}</div><p class="xs muted mt8" style="margin:0">Les noms de tes paliers suivront ton choix. Tu peux le changer dans Profil › Mes infos.</p></div>`}
      <div class="minis mt8"><div><b>${c.streak}</b><div class="v">jours de série</div></div><div><b>${c.weekSessions}</b><div class="v">séances cette semaine</div></div><div><b>${c.comebacks}</b><div class="v">reprises</div></div></div></div>
    <h2 class="sec">Quêtes du jour</h2>
    <div class="card">${q.map(x => `<div class="row between" style="padding:6px 0"><span>${x.ok ? "✅" : "⬜"} ${esc(x.n)}</span><b class="red">+${x.p}</b></div>`).join("")}
      <p class="xs muted mt8" style="margin:0">Un geste compte même quand c'est petit. Un écart n'enlève jamais de points.</p></div>
    <h2 class="sec">Trophées · ${got.length}/${TROPHIES.length}</h2>
    <div class="grid2">${TROPHIES.map(t => `<div class="card" style="text-align:center;${gotIds.has(t.id) ? "" : "opacity:.45"}"><div style="font-size:30px">${gotIds.has(t.id) ? t.icon : "🔒"}</div><b class="small">${esc(t.name)}</b><div class="xs muted">${esc(t.desc)}</div></div>`).join("")}</div>
    <h2 class="sec">Récompenses</h2>
    <div class="list">${rewardsFor().map(r => `<div class="li" style="${rwIds.has(r.id) ? "" : "opacity:.5"}"><span class="em">${rwIds.has(r.id) ? r.icon : "🔒"}</span><span class="grow"><b>${esc(r.name)}</b><br><span class="xs muted">${rwIds.has(r.id) ? "Débloquée · à réclamer dans la conversation avec Thomas" : `Niveau ${r.lvl} requis`}</span></span></div>`).join("")}</div>
    <p class="xs muted mt16">Les points récompensent la régularité : séances, protéines, routine et honnêteté après un écart. Rien ne dépend de ton poids ni de ton corps.</p>
  </main>${tabbar("")}`;
};

actions["genre-set"] = (b, d) => {
  if (!GENRES.some(g => g[0] === d.v)) return;
  update(st => { st.profile.genre = d.v; st.synced = false; });
  buzz(); routes.trophees();
};
