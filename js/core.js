// Noyau d'interface : état partagé, routeur, en-tête, barre d'onglets, feuilles, graphiques, formules.
import { S, update, today, APP_MODE } from "./store.js";
import { CONFIG, offer, MSGS_PER_WEEK, FREE_PROGRAMS, FREE_WEEKS, ALL_FREE, TRIAL_DAYS } from "./config.js";

export const $app = document.getElementById("app");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const buzz = (ms = 12) => { if (S().settings.haptics && navigator.vibrate) navigator.vibrate(ms); };
export const num = (x) => parseFloat(String(x ?? "").replace(",", "."));
export const fr = (n, d = 0) => (Math.round((n || 0) * 10 ** d) / 10 ** d).toLocaleString("fr-FR");
export const fmtDate = (d, o = { weekday: "long", day: "numeric", month: "long" }) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("fr-FR", o);
export const ago = (d) => { const m = Math.round((Date.now() - new Date(d)) / 6e4); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };
export const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return today(x); };
export const hhmm = (d = new Date()) => d.toTimeString().slice(0, 5);

// ---------- Formules ----------
// Essai : les 7 premiers jours, l'app complète (Bâtisseur) est ouverte
export const trialLeft = () => { const t = S().trialStart; if (!t || (S().me?.tier && S().me.tier !== "free")) return 0; return Math.max(0, TRIAL_DAYS - Math.floor((Date.now() - new Date(t + "T00:00:00").getTime()) / 864e5)); };
export const tier = () => (S().me?.isCoach ? "surmesure" : null) || (S().me?.tier && S().me.tier !== "free" ? S().me.tier : trialLeft() > 0 ? "premium" : "free");
export const rank = () => offer(tier()).rank;
export const premium = () => ALL_FREE || rank() >= 1;
export const expert = () => ALL_FREE || rank() >= 2; // contenus « suivi » (connaissances expertes)
export const isCoach = () => APP_MODE === "coach" && !!S().me?.isCoach && !S().demoTier;
export const programOpen = (id) => premium() || FREE_PROGRAMS.includes(id) || id === S().profile?.startProgram || (S().customPrograms || []).some(p => p.id === id);
export const weekOpen = (w) => premium() || w <= FREE_WEEKS;
// Messagerie avec Thomas : réservée aux coachés (0 message = pas d'accès)
export const canMsg = () => MSGS_PER_WEEK[tier()] !== 0;
export function msgQuotaText() {
  const lim = MSGS_PER_WEEK[tier()];
  if (lim == null) return "Messages illimités";
  if (lim === 0) return "Messages avec Thomas réservés aux coachés";
  const left = S().demoTier ? lim : (S().me?.msgsLeft ?? lim);
  return `${left} message${left > 1 ? "s" : ""} disponible${left > 1 ? "s" : ""} cette semaine`;
}

// ---------- Serveur (chargé à la demande) ----------
let C = null;
export const cloud = async () => { if (!C) { try { C = await import("./cloud.js"); } catch { C = null; } } return C; };
export const cloudNow = () => C;

// ---------- Icônes ----------
const svg = (d, w = 1.9) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  x: (s = 28) => `<svg viewBox="0 0 40 40" width="${s}" height="${s}" aria-hidden="true"><defs><linearGradient id="gx${s}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8F3510"/><stop offset=".6" stop-color="#C2541F"/><stop offset="1" stop-color="#EE8A45"/></linearGradient></defs><path d="M9 9l22 22" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M9 31 31 9" stroke="url(#gx${s})" stroke-width="6" stroke-linecap="round"/></svg>`,
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  bar: svg('<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', 2),
  fork: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2H6"/><path d="M11.5 7v7M9 9.5h5"/>'),
  coach: svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 1.6),
  pen: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  clip: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
  chart: svg('<path d="M4 20V4M4 20h16"/><path d="m8 15 3.5-4 3 2.5L20 7"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.3-3.4 3.8-5 7-5s5.7 1.6 7 5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 2.2),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2.2),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.6),
  chev: `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>`,
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2.2),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>'),
  dots: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 2.2),
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`,
  send: svg('<path d="M4 12 20 4l-6 16-3-7z"/>', 2),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>', 2),
  scan: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9v6M11 9v6M14 9v6M17 9v6"/>'),
};
// Nom de marque : CAL X STHENOS, avec le X du logo
const MINI_X = `<svg viewBox="54 52 292 320" aria-hidden="true" style="height:.74em;width:.68em;margin:0 .12em"><defs><linearGradient id="mxr" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8F3510"/><stop offset=".55" stop-color="#C2541F"/><stop offset="1" stop-color="#EE8A45"/></linearGradient><linearGradient id="mxd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B9501E"/><stop offset="1" stop-color="#5C2410"/></linearGradient></defs><path d="M300 52H346L212 212L118 372H70L188 212Z" fill="url(#mxd)"/><path d="M54 52H100L212 212L330 372H282L188 212Z" fill="url(#mxr)"/></svg>`;
export const logo = (size = 24) => `<span role="img" aria-label="TB my Coach" style="display:inline-flex;align-items:center;font-family:var(--fg);font-weight:800;font-size:${size}px;letter-spacing:.02em;white-space:nowrap">TB my <span style="color:var(--red)">Coach</span></span>`;
export const coachLogo = (size = 22) => `<img src="assets/icon-192-grec.png" alt="TB my Coach" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
export const markImg = (size = 96) => `<img src="assets/logo-tb.png" alt="Logo TB my Coach" width="${size}" height="${size}" style="border-radius:${Math.round(size * .22)}px;box-shadow:0 12px 30px rgba(42,11,19,.3)">`;

// ---------- Retours visuels ----------
let toastT;
export function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600);
}
export function sheet(html, onMount, { keep = false } = {}) {
  const old = document.getElementById("sheet");
  if (keep && old) { const sh = old.querySelector(".sheet"), y = sh.scrollTop; sh.innerHTML = `<div class="grab" role="button" aria-label="Fermer"></div>${html}`; sh.querySelector(".grab").addEventListener("click", closeSheet); sh.scrollTop = y; onMount?.(old); return old; }
  closeSheet();
  const w = document.createElement("div"); w.className = "sheet-wrap"; w.id = "sheet";
  w.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  w.addEventListener("click", e => { if (e.target === w) closeSheet(); });
  const g = w.querySelector(".grab"), sh = w.querySelector(".sheet");
  g.setAttribute("role", "button"); g.setAttribute("aria-label", "Fermer"); g.addEventListener("click", closeSheet);
  // Glisser vers le bas pour fermer : suit le doigt sans retard (pas de transition pendant le geste), ferme selon la distance ou la vitesse
  let y0 = null, last = 0, t0 = 0, dy = 0, drag = false, raf = 0;
  const setY = (v) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { sh.style.transform = v ? `translate3d(0,${v}px,0)` : ""; w.style.backgroundColor = v ? `rgba(10,4,6,${Math.max(0, .45 * (1 - v / 500))})` : ""; }); };
  sh.addEventListener("touchstart", e => { if (e.touches.length > 1) return; y0 = e.touches[0].clientY; last = y0; t0 = performance.now(); dy = 0; drag = false; }, { passive: true });
  sh.addEventListener("touchmove", e => {
    if (y0 == null) return;
    const y = e.touches[0].clientY; dy = y - y0;
    const nearTop = y0 - sh.getBoundingClientRect().top < 110;
    if (!drag) { if (dy > 6 && (sh.scrollTop <= 0 || nearTop) && !e.target.closest("input,textarea,select,.hscroll,.chips")) { drag = true; sh.style.transition = "none"; y0 = y; dy = 0; } else if (Math.abs(dy) > 6) { y0 = null; return; } }
    if (drag) { e.preventDefault(); const v = (y - last) / Math.max(1, performance.now() - t0); last = y; t0 = performance.now(); sh.dataset.v = v; setY(Math.max(0, dy)); }
  }, { passive: false });
  const end = () => { if (!drag) { y0 = null; return; } drag = false; y0 = null; const v = +sh.dataset.v || 0; sh.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1)";
    if (dy > 120 || (dy > 30 && v > .5)) { sh.style.transform = "translate3d(0,100%,0)"; w.style.transition = "background-color .22s"; w.style.backgroundColor = "rgba(10,4,6,0)"; setTimeout(closeSheet, 200); } else setY(0); };
  sh.addEventListener("touchend", end, { passive: true }); sh.addEventListener("touchcancel", end, { passive: true });
  document.documentElement.classList.add("sheet-open");
  document.body.append(w); onMount?.(w); return w;
}
export function closeSheet() { const s = document.getElementById("sheet"); if (!s) return; s.remove(); document.documentElement.classList.remove("sheet-open"); if (s.dataset.rr) rerender(); }
// ---------- Clavier et fenêtres : la zone visible réelle (iPhone, Android) ----------
// --vvh / --vvt = hauteur et décalage de la zone visible ; --kb = hauteur du clavier ; html.kb quand il est ouvert
function viewportVars() {
  const v = window.visualViewport, root = document.documentElement; if (!v) return;
  const kb = Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop));
  root.style.setProperty("--vvh", `${Math.round(v.height)}px`); root.style.setProperty("--vvt", `${Math.round(v.offsetTop)}px`); root.style.setProperty("--kb", `${kb}px`);
  const typing = kb > 120 || (document.activeElement?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select") && kb > 60);
  root.classList.toggle("kb", !!typing);
}
if (window.visualViewport) { visualViewport.addEventListener("resize", viewportVars); visualViewport.addEventListener("scroll", viewportVars); }
window.addEventListener("orientationchange", () => setTimeout(viewportVars, 300));
// Le champ touché reste visible au-dessus du clavier, dans une fenêtre comme dans la page
document.addEventListener("focusin", (e) => {
  const el = e.target; if (!el.matches?.("input,textarea,select") || el.type === "checkbox" || el.type === "file") return;
  setTimeout(() => { viewportVars(); const sh = el.closest(".sheet"); if (sh) { const r = el.getBoundingClientRect(), vh = window.visualViewport?.height || innerHeight; if (r.bottom > vh - 20 || r.top < 60) el.scrollIntoView({ block: "center", behavior: "smooth" }); } else if (!el.closest(".composer")) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 320);
});
document.addEventListener("focusout", () => setTimeout(() => { viewportVars(); if (!document.activeElement?.matches?.("input,textarea,select")) document.documentElement.classList.remove("kb"); }, 120));
viewportVars();
export const wordOn = () => false; // dimension spirituelle retirée de l'application
export const greet = () => { const h = new Date().getHours(); return h < 5 ? "Bonne nuit" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"; };

// ---------- En-tête et barre d'onglets ----------
export const badges = { msgs: 0, notifs: 0 };
const TAB_TITLES = ["Accueil", "Entraînement", "Nutrition", "Récupération", "Coaching", "Profil"]; // déjà affichés dans la barre du bas
export function header(title, sub = "", { back = null, actions = "", offers = true } = {}) {
  const demo = false ? `<div class="demo-bar"><span class="grow">Démo · <b>${esc(offer(S().demoTier).name)}</b></span><button data-a="demo-choose">Choisir</button><button data-a="demo-exit">Quitter</button></div>` : "";
  const lead = back ? `<button class="icon-btn" ${back === "__hist" ? `data-a="hist-back"` : `data-a="go" data-r="${back}"`} aria-label="Retour">${I.back}</button>` : "";
  return demo + `<header class="top"><div class="row1">${lead}<h1>${!back && TAB_TITLES.includes(title) ? "" : title}</h1>
    ${actions}<button class="pill ic" data-a="notifs" aria-label="Notifications">${I.bell}${badges.notifs ? `<span class="badge">${badges.notifs}</span>` : ""}</button>
    ${isCoach() || !offers ? "" : `<button class="pill" data-a="go" data-r="offers">🚀 ${rank() >= 2 ? "Coaching" : "Offres"}</button>`}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</header>`;
}
export function tabbar(active) {
  if (APP_MODE === "coach") return adminTabbar("admin");
  // Chaque écran secondaire allume l'onglet auquel il appartient
  const PARENT = { train: "carnet", workout: "carnet", builder: "carnet", fiche: "carnet", simu: "profile", settings: "profile", stats: "profile", body: "profile", chat: "coach", offers: "coach", apply: "coach" };
  const act = PARENT[active] || active;
  const t = [["home", "Accueil", I.home], ["carnet", "Entraînement", I.bar], ["food", "Nutrition", I.fork], ["recup", "Récupération", I.moon], ["coach", "Coaching", I.clip], ["profile", "Profil", I.user]];
  const cur = S().current ? `<button data-a="resume" class="card tap" style="position:fixed;left:12px;right:12px;bottom:calc(92px + var(--safe-b));z-index:29;width:auto;max-width:616px;margin:0 auto;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:12px;text-align:left;box-shadow:0 0 0 2px var(--red) inset,var(--shadow)"><span style="font-size:26px">🏋️</span><span class="grow"><b>Séance en cours</b><br><span class="small muted">${esc(S().current.title)}</span></span><span class="red" style="font-weight:700">Reprendre</span></button>` : "";
  const ix = Math.max(0, t.findIndex(([r]) => r === act));
  return cur + `<nav class="tabbar" aria-label="Navigation" style="--n:${t.length};--i:${ix}"><span class="lens" aria-hidden="true"></span>${t.map(([r, l, ic]) => `<a href="#/${r}" class="tab" ${r === act ? 'aria-current="page"' : ""}>${ic}<span>${l}</span>${r === "coach" && badges.msgs ? `<span class="badge">${badges.msgs}</span>` : ""}</a>`).join("")}</nav>`;
}
// Sélecteur de mode en haut d'un onglet (Carnet / Explorer / Connaissances), comme Hevy
export const modeBar = (items, cur, act) => `<div class="modes" role="tablist">${items.map(([v, l]) => `<button role="tab" class="${v === cur ? "on" : ""}" data-a="${act}" data-v="${v}" aria-selected="${v === cur}">${l}</button>`).join("")}</div>`;
// Barre d'onglets de l'espace coach
export const adminBadges = { msgs: 0, subs: 0 };
export function adminTabbar(active) {
  const ic = { today: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>`,
    clients: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5"/></svg>`,
    msgs: I.coach, biz: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5"/><path d="M4 10.5h9M4 13.5h9"/></svg>`,
    subs: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>`,
    db: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></svg>` };
  const t = [["admin-today", "Aujourd'hui", ic.today], ["admin", "Mes clients", ic.clients], ["admin-msg", `Messages${adminBadges.msgs ? ` (${adminBadges.msgs})` : ""}`, ic.msgs], ["admin-biz", "Business", ic.biz], ["admin-subs", "Abonnés", ic.subs], ["admin-db", "Base de données", ic.db]];
  const ix = Math.max(0, t.findIndex(([r]) => r === active));
  return `<nav class="tabbar" aria-label="Espace coach" style="--n:${t.length};--i:${ix}"><span class="lens" aria-hidden="true"></span>${t.map(([r, l, i]) => `<a href="#/${r}" class="tab" ${r === active ? 'aria-current="page"' : ""}>${i}<span>${l}</span></a>`).join("")}</nav>`;
}
export const lockVeil = (label = "Bâtisseur", why = "") => `<div class="veil"><span class="lock">🔒 ${esc(label)}</span>${why ? `<p class="small muted" style="max-width:280px;margin:0">${esc(why)}</p>` : ""}<button class="btn btn-red btn-sm" data-a="go" data-r="offers">Voir les offres</button></div>`;
export const lockBtn = (label = "Bâtisseur") => `<button class="lock" data-a="go" data-r="offers">🔒 ${esc(label)}</button>`;
export const seg = (opts, cur, action) => `<div class="seg">${opts.map(([v, l]) => `<button data-a="${action}" data-v="${v}" class="${cur === v ? "on" : ""}">${l}</button>`).join("")}</div>`;
export const chips = (opts, cur, action, extra = "") => `<div class="chips ${extra}">${opts.map(([v, l]) => `<button class="chip ${cur === v ? "on" : ""}" data-a="${action}" data-v="${esc(v)}">${l}</button>`).join("")}</div>`;

// ---------- Graphiques ----------
export function ring(pct, size, stroke, color, track = "var(--line)") {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
  return `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" opacity="${p > .004 ? 1 : 0}"/>`;
}
export const gradDef = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EE8A45"/><stop offset=".5" stop-color="#C2541F"/><stop offset="1" stop-color="#8F3510"/></linearGradient></defs>`;
export function lineChart(series, { h = 160, unit = "", proj = null, yfmt = (v) => Math.round(v) } = {}) {
  const pts = series.filter(p => p.y != null);
  if (pts.length < 2 && !proj) return `<p class="empty small">La courbe apparaît après deux mesures.</p>`;
  const all = [...pts, ...(proj || [])];
  const W = 340, H = h, pl = 36, pr = 12, pt = 14, pb = 22;
  const ys = all.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys), span = (hi - lo) || 1;
  const n = all.length, x = i => pl + i * (W - pl - pr) / Math.max(1, n - 1), y = v => pt + (1 - (v - lo) / span) * (H - pt - pb);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join("");
  const pd = proj ? `M${x(pts.length - 1).toFixed(1)} ${y(pts.at(-1).y).toFixed(1)}` + proj.map((p, i) => `L${x(pts.length + i).toFixed(1)} ${y(p.y).toFixed(1)}`).join("") : "";
  const last = all.at(-1);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe">${gradDef("lg")}
    <line x1="${pl}" x2="${W - pr}" y1="${y(hi)}" y2="${y(hi)}" stroke="var(--line)" stroke-dasharray="3 4"/><line x1="${pl}" x2="${W - pr}" y1="${y(lo)}" y2="${y(lo)}" stroke="var(--line)" stroke-dasharray="3 4"/>
    <text x="${pl - 6}" y="${y(hi) + 4}" fill="var(--soft)" font-size="11" text-anchor="end">${yfmt(hi)}</text><text x="${pl - 6}" y="${y(lo) + 4}" fill="var(--soft)" font-size="11" text-anchor="end">${yfmt(lo)}</text>
    <path d="${d}" fill="none" stroke="url(#lg)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${pd ? `<path d="${pd}" fill="none" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 5" opacity=".7"/><circle cx="${x(n - 1)}" cy="${y(last.y)}" r="4" fill="none" stroke="var(--red)" stroke-width="2"/>` : ""}
    <circle cx="${x(pts.length - 1)}" cy="${y(pts.at(-1).y)}" r="5" fill="var(--red)"/>
    <text x="${pl}" y="${H - 4}" fill="var(--soft)" font-size="11">${all[0].l}</text><text x="${W - pr}" y="${H - 4}" fill="var(--soft)" font-size="11" text-anchor="end">${last.l}</text></svg>`;
}
export function barChart(items, { h = 130, fmt = (v) => Math.round(v), hi = -1 } = {}) {
  const W = 340, mx = Math.max(1, ...items.map(i => i.v)), bw = (W - 20) / items.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="Histogramme">${gradDef("bg1")}${items.map((it, i) => { const bh = it.v / mx * (h - 44); const xx = 10 + i * bw; return `<rect x="${xx + bw * .18}" y="${h - 24 - bh}" width="${bw * .64}" height="${Math.max(2, bh)}" rx="6" fill="${i === (hi < 0 ? items.length - 1 : hi) ? "url(#bg1)" : "var(--ink)"}" opacity="${it.v ? (i === (hi < 0 ? items.length - 1 : hi) ? 1 : .22) : .1}"/><text x="${xx + bw / 2}" y="${h - 8}" font-size="11" text-anchor="middle" fill="var(--soft)">${esc(it.l)}</text>${it.v ? `<text x="${xx + bw / 2}" y="${h - 28 - bh}" font-size="10.5" text-anchor="middle" fill="var(--soft)">${fmt(it.v)}</text>` : ""}`; }).join("")}</svg>`;
}
export function hbars(items, fmt = (v) => fr(v, 1)) {
  const mx = Math.max(1, ...items.map(i => i.v));
  return `<div class="bars">${items.map(i => `<div class="bar"><span>${esc(i.l)}</span><span><i style="width:${Math.max(3, i.v / mx * 100)}%"></i></span><b>${fmt(i.v)}</b></div>`).join("")}</div>`;
}

// ---------- Routeur ----------
export const routes = {};
export const R = { route: "home", param: null, param2: null };
export function go(r, p = null) { const h = "#/" + r + (p != null ? "/" + encodeURIComponent(p) : ""); if (location.hash === h) render(); else location.hash = h; }
const stops = new Set();
export const onLeave = (fn) => stops.add(fn);
export function render() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  R.route = h[0] || "home"; R.param = h[1] ? decodeURIComponent(h[1]) : null; R.param2 = h[2] ? decodeURIComponent(h[2]) : null;
  if (APP_MODE === "coach" && R.route === "home") R.route = "admin-today"; // l'app coach s'ouvre sur l'espace coach
  if (!S().profile && !["onboarding", "x", "privacy", "account"].includes(R.route)) R.route = "onboarding";
  if (S().current && !["workout", "x", "fiche", "simu"].includes(R.route) && sessionStorage.getItem("cxs.min") !== "1") R.route = "workout";
  stops.forEach(f => f()); stops.clear(); closeSheet(); document.getElementById("hlb")?.remove();
  Promise.resolve((routes[R.route] || routes.home)()).then(centerChips);
  window.scrollTo(0, 0);
}
// Redessine la page sans la faire sauter : position de défilement et rangées de menus conservées
// Le champ en cours de saisie garde le focus après un redessin (le clavier ne se ferme pas, la page ne saute pas)
const FOCUS_KEYS = ["id", "name", "data-c", "data-i", "data-k", "data-x", "data-s", "data-d", "data-m", "data-f", "aria-label"];
function focusKey() { const a = document.activeElement; if (!a?.matches?.("input,textarea,select") || a.closest("#sheet")) return null; return { sel: a.tagName.toLowerCase() + FOCUS_KEYS.map(k => a.hasAttribute(k) ? `[${k}="${CSS.escape(a.getAttribute(k))}"]` : "").join(""), start: a.selectionStart, end: a.selectionEnd }; }
function refocus(f) { if (!f) return; const el = document.querySelector(f.sel); if (!el || el === document.activeElement) return; el.focus({ preventScroll: true }); try { if (f.start != null) el.setSelectionRange(f.start, f.end); } catch { } }
export function rerender(keepY = true) {
  // après un « change » (champ quitté), on attend que le doigt ait posé le focus sur le champ suivant
  if (window.event?.type === "change" || window.event?.type === "blur") { setTimeout(() => rerender(keepY), 40); return; }
  const fk = focusKey();
  const y = window.scrollY, rows = [...document.querySelectorAll(".chips:not(.wrap)")].map(r => r.scrollLeft);
  const restore = () => { document.querySelectorAll(".chips:not(.wrap)").forEach((r, i) => { if (rows[i] != null) r.scrollLeft = rows[i]; const on = r.querySelector(".chip.on"); if (on && (on.offsetLeft < r.scrollLeft || on.offsetLeft + on.offsetWidth > r.scrollLeft + r.clientWidth)) r.scrollTo({ left: on.offsetLeft - 16, behavior: "smooth" }); }); if (keepY) window.scrollTo(0, y); };
  const p = Promise.resolve((routes[R.route] || routes.home)()); restore(); refocus(fk); p.then(() => { restore(); refocus(fk); });
}
// Fait apparaître la puce active dans les rangées qui défilent
function centerChips() { document.querySelectorAll(".chips:not(.wrap)").forEach(row => { const on = row.querySelector(".chip.on"); if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2; }); }

// ---------- Actions (délégation d'événements) ----------
export const actions = {}, forms = {}, changes = {};
actions["hist-back"] = () => { if (history.length > 1) history.back(); else go("home"); };
export function installEvents() {
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const fn = actions[b.dataset.a]; if (fn) { e.preventDefault(); await fn(b, b.dataset, e); }
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("form[data-f]"); if (!f) return; e.preventDefault();
    const fn = forms[f.dataset.f]; if (fn) await fn(Object.fromEntries(new FormData(f)), f, e);
  });
  document.addEventListener("change", async (e) => { const el = e.target.closest("[data-c]"); if (el && changes[el.dataset.c]) await changes[el.dataset.c](el, e); });
  document.addEventListener("input", (e) => { const el = e.target.closest("[data-i]"); if (el && changes["i:" + el.dataset.i]) changes["i:" + el.dataset.i](el, e); });
}
actions.go = (b, d) => { closeSheet(); go(d.r, d.p ?? null); };
actions.close = () => closeSheet();

// ---------- Barre « liquid glass » : la bulle glisse sous le doigt, le relâchement ouvre l'onglet ----------
let drag = null, swallow = false;
document.addEventListener("pointerdown", (e) => {
  const nav = e.target.closest?.(".tabbar"); if (!nav) return;
  drag = { nav, x0: e.clientX, y0: e.clientY, on: false, i: Number(nav.style.getPropertyValue("--i")) || 0, n: nav.querySelectorAll(".tab").length, f: null };
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (!drag.on) {
    const dx = Math.abs(e.clientX - drag.x0), dy = Math.abs(e.clientY - drag.y0);
    if (dx < 10 || dx < dy) return;
    drag.on = true; drag.nav.classList.add("dragging");
  }
  const r = drag.nav.getBoundingClientRect(), w = (r.width - 12) / drag.n;
  drag.f = Math.min(drag.n - 1, Math.max(0, (e.clientX - r.left - 6 - w / 2) / w));
  drag.nav.style.setProperty("--i", drag.f.toFixed(3));
});
const endDrag = () => {
  if (!drag) return; const d = drag; drag = null;
  if (!d.on) return;
  d.nav.classList.remove("dragging");
  const tab = d.nav.querySelectorAll(".tab")[Math.round(d.f ?? d.i)];
  swallow = true; setTimeout(() => { swallow = false; }, 350);
  if (tab && tab.getAttribute("aria-current") !== "page") location.hash = tab.getAttribute("href");
  else d.nav.style.setProperty("--i", d.i);
};
document.addEventListener("dragstart", (e) => { if (e.target.closest?.(".tabbar")) e.preventDefault(); }); // pas de glisser natif de lien
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", (e) => { if (drag && e.pointerType === "touch") endDrag(); });
document.addEventListener("click", (e) => { if (swallow && e.target.closest?.(".tabbar")) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true);
// En-tête qui s'estompe et floute le contenu défilé derrière lui (variable --sp de 0 à 1)
const onScroll = () => document.documentElement.style.setProperty("--sp", Math.min(1, scrollY / 160).toFixed(3));
addEventListener("scroll", onScroll, { passive: true });
