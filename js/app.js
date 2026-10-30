// Point d'entrée TB my Coach : charge les vues, installe les événements, démarre.
import * as E from "./engine.js";
import * as N from "./nutrition.js";
import { R, render, installEvents } from "./core.js";
import { S, update, today } from "./store.js";
import { refreshMe, pullCoachSlots } from "./sync.js";
import { refreshLibrary } from "./library.js";
import "./views/onboarding.js";
import "./views/home.js";
import "./views/agenda.js";
import "./views/train.js";
import "./views/food.js";
import "./views/crise.js";
import "./views/recup.js";
import "./views/trophees.js";
import "./views/coach.js";
import "./views/season.js";
import "./views/admin.js";
import "./views/account.js";
import { applyTheme } from "./views/more.js";

installEvents();
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && e.target.matches(".composer textarea")) { e.preventDefault(); e.target.form.requestSubmit(); } });
window.addEventListener("hashchange", render);

(async () => {
  try { applyTheme(); } catch { }
  await Promise.all([E.loadPrograms(), N.loadModels()]).catch(() => { });
  if (S().profile && !S().trialStart) update(st => st.trialStart = today());
  if (S().demoTier) update(st => st.demoTier = null); // plus de mode démo : essai de 7 jours seulement
  render();
  refreshMe().then(() => { if (["home", "coach"].includes(R.route) && !document.querySelector(".sheet-wrap, .composer, input:focus, textarea:focus")) render(); });
  setInterval(refreshMe, 60000);
  pullCoachSlots(); setInterval(pullCoachSlots, 5 * 60000);
  refreshLibrary(); setInterval(refreshLibrary, 15 * 60000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
})();
