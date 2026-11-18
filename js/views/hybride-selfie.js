// « Me ressembler avec une photo » : la photo est lue sur le téléphone, puis oubliée (décision C60).
// Rien n'est envoyé ni enregistré : l'image vit dans un canvas le temps du cadrage, puis tout est effacé.
// On ne garde que la proposition acceptée (un teint, une couleur de cheveux), que la personne peut corriger.
import * as SF from "../selfie.js";
import * as P from "../personnage.js";
import { esc, sheet, closeSheet, toast, buzz } from "../core.js";

const { cx, cy, rx, ry } = SF.GUIDE, W = SF.LARGEUR, H = SF.HAUTEUR;
const ovale = `<svg viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" aria-hidden="true"><defs><mask id="sf-m"><rect width="${W}" height="${H}" fill="#fff"/><ellipse cx="${cx * W}" cy="${cy * H}" rx="${rx * W}" ry="${ry * H}" fill="#000"/></mask></defs><rect width="${W}" height="${H}" fill="rgba(0,0,0,.45)" mask="url(#sf-m)"/><ellipse cx="${cx * W}" cy="${cy * H}" rx="${rx * W}" ry="${ry * H}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="7 5"/></svg>`;

export function ouvrirSelfie(appliquer) {
  sheet(`<h2 class="h2" style="margin:0">Ton personnage d'après une photo</h2>
    <p class="small">La photo reste sur ton téléphone : elle n'est <b>ni envoyée ni enregistrée</b>. On lit seulement la couleur de ta peau et de tes cheveux pour te proposer des réglages. Tu pourras tout corriger.</p>
    <p class="xs muted">Conseil : de face, à la lumière du jour, sans filtre.</p>
    <div class="row mt12" style="gap:8px;flex-wrap:wrap">
      <label class="btn btn-red" style="min-height:44px">📷 Prendre une photo<input type="file" accept="image/*" capture="user" id="sf-cam" style="position:absolute;width:1px;height:1px;opacity:0"></label>
      <label class="btn btn-line" style="min-height:44px">🖼️ Choisir dans la galerie<input type="file" accept="image/*" id="sf-gal" style="position:absolute;width:1px;height:1px;opacity:0"></label>
    </div>
    <button class="btn btn-line btn-sm mt12" data-a="close-sheet">Annuler</button>`, (w) => {
    w.querySelectorAll("input[type=file]").forEach(i => i.addEventListener("change", () => { const f = i.files?.[0]; i.value = ""; if (f) cadrer(f, appliquer); }));
  });
}

function cadrer(fichier, appliquer) {
  const url = URL.createObjectURL(fichier), img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); toast("Cette image ne peut pas être lue."); };
  img.onload = () => {
    URL.revokeObjectURL(url);
    // Cadrage initial : l'image couvre le cadre, centrée un peu vers le haut (le visage d'un selfie)
    const couvre = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    let z = 1, dx = 0, dy = H * 0.04;
    sheet(`<h2 class="h2" style="margin:0">Place ton visage dans l'ovale</h2><p class="xs muted">Glisse pour déplacer, règle le zoom en dessous.</p>
      <div style="position:relative;width:100%;max-width:300px;margin:8px auto 0;aspect-ratio:3/4;border-radius:14px;overflow:hidden;touch-action:none" id="sf-zone"><canvas id="sf-c" width="${W}" height="${H}" style="width:100%;height:100%;display:block"></canvas>${ovale}</div>
      <label class="lbl mt12" for="sf-z">Zoom</label><input id="sf-z" type="range" min="1" max="4" step="0.02" value="1" style="width:100%">
      <div class="row mt12" style="gap:8px"><button class="btn btn-red" id="sf-ok">Analyser</button><button class="btn btn-line" id="sf-non">Annuler</button></div>`, (w) => {
      const c = w.querySelector("#sf-c"), ctx = c.getContext("2d", { willReadFrequently: true }), zone = w.querySelector("#sf-zone");
      const dessiner = () => {
        const s = couvre * z, iw = img.naturalWidth * s, ih = img.naturalHeight * s;
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, (W - iw) / 2 + dx, (H - ih) / 2 + dy, iw, ih);
      };
      dessiner();
      w.querySelector("#sf-z").addEventListener("input", (e) => { z = +e.target.value; dessiner(); });
      let p = null;
      zone.addEventListener("pointerdown", (e) => { p = { x: e.clientX, y: e.clientY, dx, dy, k: W / zone.clientWidth }; zone.setPointerCapture(e.pointerId); });
      zone.addEventListener("pointermove", (e) => { if (!p) return; dx = p.dx + (e.clientX - p.x) * p.k; dy = p.dy + (e.clientY - p.y) * p.k; dessiner(); });
      zone.addEventListener("pointerup", () => { p = null; }); zone.addEventListener("pointercancel", () => { p = null; });
      // Effacement : le canvas est vidé et l'image oubliée dès que l'analyse est faite ou annulée
      const oublier = () => { ctx.clearRect(0, 0, W, H); c.width = 1; img.onerror = null; img.removeAttribute("src"); veille.disconnect(); };
      // Feuille fermée autrement (fond, poignée, changement d'écran) : on efface aussi
      const veille = new MutationObserver(() => { if (!w.isConnected) oublier(); });
      veille.observe(document.body, { childList: true });
      // Clavier : flèches pour déplacer la photo
      zone.tabIndex = 0; zone.setAttribute("aria-label", "Photo à cadrer : flèches pour déplacer");
      zone.addEventListener("keydown", (e) => { const k = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[e.key]; if (k) { e.preventDefault(); dx += k[0]; dy += k[1]; dessiner(); } });
      w.querySelector("#sf-non").addEventListener("click", () => { oublier(); closeSheet(); });
      w.querySelector("#sf-ok").addEventListener("click", () => {
        let r; try { r = SF.analyser(ctx.getImageData(0, 0, W, H).data, W, H); } catch { r = { ok: false, raison: "Image illisible." }; }
        oublier(); resultat(r, appliquer);
      });
    });
  };
  img.src = url;
}

function resultat(r, appliquer) {
  if (!r.ok) {
    sheet(`<h2 class="h2" style="margin:0">On n'a pas réussi</h2><p class="small">${esc(r.raison)}</p><p class="xs muted">La photo a déjà été effacée.</p><div class="row mt12" style="gap:8px"><button class="btn btn-red" id="sf-re">Réessayer</button><button class="btn btn-line" data-a="close-sheet">Fermer</button></div>`, (w) => w.querySelector("#sf-re").addEventListener("click", () => ouvrirSelfie(appliquer)));
    return;
  }
  const pastille = (c, l) => `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:${c};vertical-align:middle;border:2px solid var(--line);margin-right:8px"></span>${esc(l)}`;
  const t = P.R3D.teints[r.teint];
  sheet(`<h2 class="h2" style="margin:0">Proposition</h2><p class="xs muted">La photo a déjà été effacée. Seuls ces réglages seront gardés si tu les acceptes.</p>
    <div class="mt12 small">${pastille(t.vu, `Teint ${r.teint + 1} sur 10`)}</div>
    <div class="mt8 small">${r.cheveux ? pastille(r.cheveux, `Cheveux : ${P.R3D.cheveux[r.cheveux]}`) : "Cheveux : couleur non détectée, garde ton choix actuel."}</div>
    <p class="xs muted mt8" style="margin:8px 0 0">La lumière change beaucoup les couleurs : corrige librement ensuite.</p>
    <div class="row mt12" style="gap:8px"><button class="btn btn-red" id="sf-oui">Appliquer</button><button class="btn btn-line" data-a="close-sheet">Non merci</button></div>`, (w) => {
    w.querySelector("#sf-oui").addEventListener("click", () => { appliquer({ teint: r.teint, ...(r.cheveux ? { cheveuxTeinte: r.cheveux } : {}) }); closeSheet(); buzz(); toast("Réglages appliqués. Tu peux encore les ajuster."); });
  });
}
