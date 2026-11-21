// Apple Santé et widget, via l'app Raccourcis (et Scriptable pour le widget) : une web app ne peut pas lire Santé directement,
// alors un Raccourci lancé chaque jour envoie pas, sommeil et poids à l'app, et écrit les séances et les repas dans Santé.
import { S, update, today } from "../store.js";
import { esc, toast, routes, actions, header, cloud, rerender, fmtDate, ago, addDays } from "../core.js";
import { fusionner } from "../sante.js";

let ETAT = { tok: null, st: undefined };
const app = () => location.origin + location.pathname.replace(/[^/]*$/, "");
routes.sante = async () => {
  const $a = document.getElementById("app");
  $a.innerHTML = header("Apple Santé et widget", "Par l'app Raccourcis", { back: "profile" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  const c = await cloud(); let connecte = false;
  try { connecte = !!(await c.currentSession()); if (connecte && ETAT.st === undefined) ETAT.st = await c.healthStatus(); } catch { }
  const U = c?.SANTE_URL || "", tok = ETAT.tok, tk = tok || "TON_JETON", last = S().healthAt;
  const etape = (n, t, body) => `<div class="card mt12"><div class="row" style="gap:10px;align-items:flex-start"><span class="num" style="min-width:26px;height:26px;border-radius:50%;background:var(--red);color:#fff;display:grid;place-items:center;font-size:13px">${n}</span><div class="grow small"><b>${t}</b>${body}</div></div></div>`;
  const code = (s, id) => `<pre class="code mt8" id="${id}">${esc(s)}</pre><button class="btn btn-line btn-xs mt4" data-a="sante-copy" data-id="${id}">📋 Copier</button>`;
  const script = `// Widget TB my Coach pour Scriptable\nconst r = await new Request("${U}?quoi=widget&token=${tk}").loadJSON();\nconst w = new ListWidget();\nw.backgroundColor = new Color("#1B3FA0");\nconst t = w.addText("TB my Coach"); t.font = Font.boldSystemFont(14); t.textColor = Color.white();\nw.addSpacer(6);\nfor (const l of (r.lignes || [r.erreur || "Pas de données"])) { const x = w.addText(l); x.font = Font.systemFont(12); x.textColor = Color.white(); x.minimumScaleFactor = 0.7; }\nw.url = "${app()}";\nScript.setWidget(w);\nScript.complete();`;
  $a.innerHTML = header("Apple Santé et widget", "Par l'app Raccourcis", { back: "profile" }) + `<main class="page">
    <div class="card soft"><p class="small" style="margin:0">Apple réserve Santé aux apps de l'App Store. On passe donc par <b>l'app Raccourcis</b> de ton iPhone : une fois réglée (10 minutes), elle tourne toute seule chaque jour.</p>
      <ul class="small mt8" style="padding-left:18px;margin-bottom:0"><li>👣 Pas, 😴 sommeil et ⚖️ poids arrivent dans l'app.</li><li>🏋️ Tes séances et 🍽️ tes repas s'écrivent dans Santé.</li><li>📱 Un widget sur ton écran d'accueil (avec Scriptable).</li></ul></div>
    ${last ? `<p class="xs muted mt8">Dernières données reçues de Santé : ${ago(last)}.</p>` : ""}
    ${!connecte ? `<div class="card mt12"><p class="small" style="margin:0">Connecte-toi d'abord (Profil › Mon compte) : le Raccourci a besoin de ton compte pour envoyer les données au bon endroit.</p></div>` : etape(1, "Ton jeton personnel", `<p class="xs muted mt4">Il remplace ton mot de passe pour le Raccourci. Garde-le pour toi ; tu peux en créer un nouveau à tout moment (l'ancien ne marche plus).</p>
      ${tok ? `<pre class="code mt8" id="sa-tok">${esc(tok)}</pre><button class="btn btn-red btn-sm mt4" data-a="sante-copy" data-id="sa-tok">📋 Copier le jeton</button><p class="xs mt8" style="color:var(--warn)">Il ne sera plus affiché après : copie-le maintenant.</p>`
        : `${ETAT.st ? `<p class="xs mt8">Jeton actif depuis le ${fmtDate(ETAT.st.created_at.slice(0, 10), { day: "numeric", month: "long" })}${ETAT.st.last_used ? ` · utilisé ${ago(ETAT.st.last_used)}` : " · jamais utilisé"}.</p>` : ""}<div class="row mt8" style="gap:8px"><button class="btn btn-red btn-sm" data-a="sante-tok">${ETAT.st ? "Créer un nouveau jeton" : "Créer mon jeton"}</button>${ETAT.st ? `<button class="btn btn-ghost btn-sm" style="width:auto" data-a="sante-del">Couper le lien</button>` : ""}</div>`}`)}
    ${etape(2, "Raccourci « TB ← Santé » : envoyer pas, sommeil, poids", `<ol class="xs mt8" style="padding-left:16px">
      <li>Raccourcis › <b>+</b> › nomme-le « TB ← Santé ».</li>
      <li>Action <b>Rechercher des échantillons de santé</b> : Type <i>Pas</i>, Date de début <i>Aujourd'hui</i>. Puis <b>Calculer les statistiques</b> : <i>Somme</i>. Renomme le résultat « Pas ».</li>
      <li>Action <b>Rechercher des échantillons de santé</b> : Type <i>Analyse du sommeil</i>, Date de fin <i>est aujourd'hui</i>, Valeur <i>n'est pas</i> Au lit, Valeur <i>n'est pas</i> Éveillé (avec une montre, la nuit est découpée en Essentiel, Profond, Paradoxal). Puis <b>Calculer les statistiques</b> : <i>Somme</i> de la <i>Durée</i>. Renomme « Sommeil » (heures, minutes ou secondes : l'app convertit).</li>
      <li>Action <b>Rechercher des échantillons de santé</b> : Type <i>Poids</i>, Trier par <i>Date de début (plus récent)</i>, Limite <i>1</i>. Renomme « Poids » (facultatif).</li>
      <li>Action <b>Obtenir le contenu de l'URL</b> avec l'adresse ci-dessous. Afficher plus › Méthode <i>POST</i>, Corps de la requête <i>JSON</i>, ajoute 4 champs Texte : à gauche (Clé) <b>token</b>, <b>pas</b>, <b>sommeil</b>, <b>poids</b> ; à droite (Valeur) ton jeton puis les variables Pas, Sommeil, Poids.</li>
      <li>Action <b>Afficher la notification</b> avec le résultat (facultatif).</li></ol>${code(U, "sa-url")}`)}
    ${etape(3, "Raccourci « TB → Santé » : écrire tes séances et tes repas", `<ol class="xs mt8" style="padding-left:16px">
      <li>Nouveau raccourci « TB → Santé ». Action <b>Obtenir le contenu de l'URL</b> avec l'adresse ci-dessous (méthode GET).</li>
      <li><b>Obtenir la valeur du dictionnaire</b> « seances », puis <b>Répéter avec chaque élément</b> : <b>Enregistrer l'entraînement</b> (Type : valeur « type », Début : « debut », Fin : « fin », Calories : « kcal », Distance : « km »).</li>
      <li>Après la boucle : <b>Obtenir la valeur du dictionnaire</b> « nutrition », puis <b>Enregistrer un échantillon de santé</b> : <i>Énergie alimentaire</i> = « kcal », <i>Protéines</i> = « proteines », <i>Glucides</i>, <i>Lipides</i>.</li></ol>${code(`${U}?quoi=export&token=${tk}`, "sa-exp")}`)}
    ${etape(4, "Que ça tourne tout seul", `<p class="xs mt8">Raccourcis › <b>Automatisation</b> › <b>+</b> › <i>Heure de la journée</i> : 9:00, tous les jours, <b>Exécuter immédiatement</b> (désactive « Demander avant d'exécuter »), avec « TB ← Santé » : ton sommeil de la nuit arrive le matin. Refais-en une à 21:30 avec « TB ← Santé » puis « TB → Santé » pour les pas de la journée. Ajoute une 2ᵉ automatisation <i>App › TB my Coach › Est ouverte</i> avec « TB ← Santé » pour avoir tes pas à jour dès que tu ouvres l'app.</p>`)}
    ${etape(5, "Le widget sur l'écran d'accueil", `<p class="xs mt8">Installe <b>Scriptable</b> (gratuit, App Store), crée un script, colle le code ci-dessous, puis ajoute un widget Scriptable sur ton écran d'accueil et choisis ce script. Il affiche ta séance du jour, tes calories, tes protéines et tes pas, et ouvre l'app au toucher.</p>${code(script, "sa-wid")}`)}
    <p class="xs muted mt12">Les noms des actions peuvent varier un peu selon ta version d'iOS. Bloqué à une étape ? Envoie une capture à Thomas dans la conversation.</p>
  </main>`;
};
actions["sante-tok"] = async () => { if (ETAT.st && !confirm("Créer un nouveau jeton ? L'ancien ne marchera plus : il faudra le remplacer dans tes Raccourcis.")) return; try { const c = await cloud(); ETAT.tok = await c.healthTokenNew(); ETAT.st = { created_at: new Date().toISOString(), last_used: null }; rerender(); } catch (e) { toast("Création impossible : " + e.message); } };
actions["sante-del"] = async () => { if (!confirm("Couper le lien avec Apple Santé ? Tes Raccourcis ne pourront plus envoyer de données.")) return; try { const c = await cloud(); await c.healthDel(); ETAT = { tok: null, st: null }; rerender(); } catch (e) { toast(e.message); } };
actions["sante-copy"] = async (b, d) => { const t = document.getElementById(d.id)?.textContent || ""; try { await navigator.clipboard.writeText(t); toast("Copié"); } catch { toast("Copie impossible : appuie longuement sur le texte pour le copier."); } };

// Récupère ce que le Raccourci a envoyé (14 derniers jours) et le range dans le journal
export async function pullSante() {
  const c = await cloud(); if (!c?.healthDaily) return;
  try { if (!(await c.currentSession())) return; const rows = await c.healthDaily(addDays(today(), -14)); if (!rows.length) return;
    const r = fusionner(S().daily || {}, rows); if (r.n) update(st => { st.daily = r.daily; st.healthAt = new Date().toISOString(); }); } catch { }
}
