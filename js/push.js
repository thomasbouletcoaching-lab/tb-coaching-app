// Notifications push de ce téléphone : activation (geste de l'utilisateur obligatoire sur iPhone), rappel de fin de repos, bip.
import { S, update } from "./store.js";
import { cloud } from "./core.js";

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const pushState = () => !pushSupported() ? "unsupported" : Notification.permission === "granted" && S().settings.pushOn ? "on" : Notification.permission === "denied" ? "denied" : "off";
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const b64 = (s) => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };

export async function enablePush() {
  if (!pushSupported()) throw new Error(isStandalone() ? "Ce téléphone ne prend pas en charge les notifications." : "Sur iPhone : ajoute d'abord l'app à l'écran d'accueil (Partager › Sur l'écran d'accueil), puis ouvre-la depuis l'icône.");
  const perm = await Notification.requestPermission(); if (perm !== "granted") throw new Error("Notifications refusées. Réglages › Notifications › TB my Coach pour les autoriser.");
  const c = await cloud(); if (!(await c.currentSession())) throw new Error("Connecte-toi d'abord.");
  const key = await c.pushPublicKey(); if (!key) throw new Error("Notifications pas encore prêtes côté serveur.");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await c.pushRegister(sub);
  update(st => { st.settings.pushOn = true; });
}
export async function disablePush() { try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); await sub?.unsubscribe(); } catch { } update(st => { st.settings.pushOn = false; }); }

// Fin de repos : le serveur envoie une notification qui sonne même écran verrouillé. 0 = annuler.
let lastRest = 0;
export async function scheduleRest(sec, label) {
  if (pushState() !== "on") return; const now = Date.now(); if (sec > 0 && now - lastRest < 600) return; lastRest = now;
  try { const c = await cloud(); await c.pushRest(sec > 0 ? sec : 0, "⏱️ Repos terminé", label ? `C'est reparti : ${label}` : "C'est reparti : série suivante !"); } catch { }
}

// Bip (appli ouverte) : le contexte audio est débloqué au premier geste (validation d'une série)
let ac = null;
export function unlockAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch { } }
export function beep(n = 3) {
  if (S().settings.sound === false) return; try { unlockAudio(); if (!ac) return; const t0 = ac.currentTime;
    for (let i = 0; i < n; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = i === n - 1 ? 1320 : 880; o.connect(g); g.connect(ac.destination);
      const t = t0 + i * 0.28; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.start(t); o.stop(t + 0.25); } } catch { }
}
