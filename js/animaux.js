// Animaux totems et médailles, dessinés pour TB my Coach (illustrations originales, SVG, décision C61).
// Chaque animal est une tête de face, en aplats ; la moitié droite est le miroir de la gauche (S = symétrique).
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

let N = 0; // compteur : identifiants SVG uniques sur la page
const S = (g) => `${g}<g transform="translate(100 0) scale(-1 1)">${g}</g>`;
const oeil = (x, y, c = "#1B1D24") => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="4.2" fill="${c}"/><circle cx="${x + 1.2}" cy="${y - 1.4}" r="1.2" fill="#fff"/>`;

// fond : deux couleurs du médaillon ; dessin : la tête (viewBox 0 0 100 100)
export const ANIMAUX = {
  renard: { nom: "Renard", fond: ["#FFB36B", "#E8742A"], dessin:
    S(`<path d="M20 12 L40 36 L17 44 Z" fill="#D85F1C"/><path d="M23 20 L36 36 L21 40 Z" fill="#3A2218"/>`)
    + `<path d="M15 46 Q22 31 40 33 L60 33 Q78 31 85 46 L72 66 L50 88 L28 66 Z" fill="#EE7A2E"/>`
    + S(`<path d="M15 46 Q30 60 44 62 L50 88 L28 66 Z" fill="#FFF4E8"/>`)
    + S(oeil(38, 52)) + `<path d="M45 82 Q50 79 55 82 L50 88 Z" fill="#1B1D24"/>` },
  ours: { nom: "Ours", fond: ["#B98962", "#6B4429"], dessin:
    S(`<circle cx="26" cy="28" r="11" fill="#5A3720"/><circle cx="26" cy="28" r="5.5" fill="#C59A72"/>`)
    + `<ellipse cx="50" cy="56" rx="34" ry="31" fill="#6E4628"/>`
    + `<ellipse cx="50" cy="70" rx="15" ry="12" fill="#D9B48C"/>`
    + S(oeil(37, 50)) + `<path d="M43 63 Q50 59 57 63 Q55 69 50 70 Q45 69 43 63 Z" fill="#1B1D24"/><path d="M50 70 L50 75 M45 77 Q50 80 55 77" stroke="#1B1D24" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  loup: { nom: "Loup", fond: ["#9FB4CC", "#4E6683"], dessin:
    S(`<path d="M18 10 L38 34 L16 42 Z" fill="#4D5A6B"/><path d="M21 18 L34 34 L20 39 Z" fill="#C9D3DE"/>`)
    + `<path d="M14 44 Q20 30 40 32 L60 32 Q80 30 86 44 L80 60 L62 74 L50 90 L38 74 L20 60 Z" fill="#6C7A8C"/>`
    + S(`<path d="M14 44 L20 60 L38 74 L44 60 Q28 56 14 44 Z" fill="#DCE3EA"/><path d="M50 40 L44 60 L38 74 L50 90 Z" fill="#E9EEF3"/>`)
    + S(`<path d="M31 50 L43 47 L41 55 Z" fill="#F5C343"/><circle cx="39" cy="51" r="1.8" fill="#1B1D24"/>`)
    + `<path d="M44 83 Q50 80 56 83 L50 90 Z" fill="#1B1D24"/>` },
  taureau: { nom: "Taureau", fond: ["#E06A55", "#9B2E25"], dessin:
    S(`<path d="M28 34 Q10 32 8 14 Q18 26 32 27 Z" fill="#F2E6CF"/><path d="M24 40 L12 42 Q14 34 26 34 Z" fill="#5B3424"/>`)
    + `<path d="M24 32 Q50 24 76 32 L74 62 Q72 82 50 84 Q28 82 26 62 Z" fill="#6B3D2A"/>`
    + `<path d="M50 30 L44 40 L50 48 L56 40 Z" fill="#F5F0E6"/>`
    + `<ellipse cx="50" cy="73" rx="17" ry="12" fill="#C9907A"/>`
    + S(oeil(38, 50)) + S(`<ellipse cx="43" cy="73" rx="3" ry="4" fill="#5B3424"/>`)
    + `<circle cx="50" cy="85" r="4.5" fill="none" stroke="#E9C46A" stroke-width="2.4"/>` },
  guepard: { nom: "Guépard", fond: ["#FFD27A", "#D89A2B"], dessin:
    S(`<circle cx="27" cy="26" r="8" fill="#C98E2E"/><circle cx="27" cy="26" r="4" fill="#3A2A18"/>`)
    + `<ellipse cx="50" cy="55" rx="31" ry="31" fill="#E9B04A"/>`
    + S(`<circle cx="30" cy="40" r="2.2" fill="#3A2A18"/><circle cx="40" cy="33" r="2" fill="#3A2A18"/><circle cx="24" cy="54" r="2.2" fill="#3A2A18"/><circle cx="27" cy="66" r="2" fill="#3A2A18"/>`)
    + `<ellipse cx="50" cy="70" rx="16" ry="13" fill="#FFF3DC"/>`
    + S(oeil(39, 50) + `<path d="M38 55 Q40 63 44 68" stroke="#3A2A18" stroke-width="2.6" fill="none" stroke-linecap="round"/>`)
    + `<path d="M45 64 Q50 61 55 64 L50 69 Z" fill="#1B1D24"/><path d="M50 69 L50 73 M46 75 Q50 78 54 75" stroke="#1B1D24" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  gorille: { nom: "Gorille", fond: ["#8C95A6", "#3E4553"], dessin:
    S(`<circle cx="18" cy="52" r="8" fill="#2B2F38"/><circle cx="18" cy="52" r="4" fill="#5E6575"/>`)
    + `<path d="M22 46 Q22 20 50 18 Q78 20 78 46 L80 66 Q76 88 50 88 Q24 88 20 66 Z" fill="#2E323C"/>`
    + `<path d="M30 46 Q50 38 70 46 Q74 56 66 60 Q50 54 34 60 Q26 56 30 46 Z" fill="#6E7687"/>`
    + `<path d="M32 62 Q50 56 68 62 Q70 82 50 84 Q30 82 32 62 Z" fill="#7C8596"/>`
    + `<path d="M30 44 Q50 36 70 44" stroke="#1E2128" stroke-width="4" fill="none" stroke-linecap="round"/>`
    + S(oeil(40, 50, "#2A1C14")) + S(`<ellipse cx="45" cy="66" rx="3" ry="2.4" fill="#2B2F38"/>`)
    + `<path d="M42 76 Q50 72 58 76" stroke="#2B2F38" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  aigle: { nom: "Aigle", fond: ["#8EC5FF", "#2F6BC2"], dessin:
    `<path d="M22 40 Q22 14 50 14 Q78 14 78 40 L74 62 L50 72 L26 62 Z" fill="#FAFAF7"/>`
    + S(`<path d="M22 40 Q26 54 26 62 L14 70 Q12 54 22 40 Z" fill="#E5E3DC"/>`)
    + `<path d="M26 62 Q50 72 74 62 L70 86 Q50 94 30 86 Z" fill="#6B4A2E"/>`
    + S(`<path d="M28 42 Q38 36 46 42" stroke="#2B2F38" stroke-width="3" fill="none" stroke-linecap="round"/>` + oeil(38, 48, "#3A2410"))
    + `<path d="M42 52 Q50 46 58 52 L58 60 Q56 74 46 78 Q52 68 48 62 L42 60 Z" fill="#F5B82E"/><path d="M48 62 Q52 68 46 78" stroke="#C98A12" stroke-width="1.6" fill="none"/>` },
  requin: { nom: "Requin", fond: ["#7FD8E8", "#1E7A93"], dessin:
    `<path d="M50 6 L60 30 L40 30 Z" fill="#4A6D86"/>`
    + `<path d="M16 50 Q16 26 50 24 Q84 26 84 50 Q84 74 50 80 Q16 74 16 50 Z" fill="#5E86A3"/>`
    + `<path d="M22 60 Q50 52 78 60 Q74 76 50 80 Q26 76 22 60 Z" fill="#F2F5F7"/>`
    + `<path d="M28 62 Q50 56 72 62 Q66 72 50 74 Q34 72 28 62 Z" fill="#7A2430"/>`
    + `<path d="M30 62 L34 67 L38 61 L42 66 L46 60 L50 65 L54 60 L58 66 L62 61 L66 67 L70 62" fill="#fff" stroke="#fff" stroke-width="1" stroke-linejoin="round"/>`
    + S(`<circle cx="33" cy="44" r="4" fill="#1B1D24"/><circle cx="34.2" cy="42.6" r="1.2" fill="#fff"/><path d="M20 50 L24 48 M20 55 L24 53" stroke="#3E5C72" stroke-width="2" stroke-linecap="round"/>`) },
  phenix: { nom: "Phénix", fond: ["#FFB46B", "#D2361E"], dessin:
    S(`<path d="M50 8 Q36 14 34 30 Q26 18 18 16 Q24 28 26 40 Q18 34 10 34 Q20 44 24 54 L40 58 Z" fill="#F7A52B"/><path d="M50 16 Q42 22 40 34 Q34 28 28 26 Q32 36 32 46 L44 54 Z" fill="#F7D046"/>`)
    + `<ellipse cx="50" cy="56" rx="20" ry="22" fill="#E8432A"/>`
    + `<path d="M36 62 Q50 92 64 62 Q60 76 50 80 Q40 76 36 62 Z" fill="#F7A52B"/>`
    + S(oeil(42, 52))
    + `<path d="M45 58 L55 58 L50 68 Z" fill="#F7D046"/>` },
  lion: { nom: "Lion", fond: ["#FFD36E", "#C98618"], dessin:
    `<circle cx="50" cy="52" r="40" fill="#B5651D"/>`
    + S(`<path d="M50 12 L36 20 L22 22 L22 36 L12 46 L18 58 L14 72 L28 76 L34 88 L50 84 Z" fill="#9A4F14"/>`)
    + `<ellipse cx="50" cy="54" rx="26" ry="28" fill="#F0B04A"/>`
    + S(`<circle cx="28" cy="34" r="6" fill="#F0B04A"/><circle cx="28" cy="34" r="3" fill="#B5651D"/>`)
    + `<ellipse cx="50" cy="70" rx="14" ry="11" fill="#FFE7B8"/>`
    + S(oeil(40, 52)) + `<path d="M44 62 Q50 58 56 62 L50 68 Z" fill="#5A2E12"/><path d="M50 68 L50 72 M45 74 Q50 77 55 74" stroke="#5A2E12" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  tigre: { nom: "Tigre", fond: ["#FFB25E", "#D35A12"], dessin:
    S(`<circle cx="26" cy="27" r="9" fill="#E9781E"/><circle cx="26" cy="27" r="4.5" fill="#FFF3E2"/>`)
    + `<ellipse cx="50" cy="55" rx="32" ry="31" fill="#F08A24"/>`
    + S(`<path d="M18 48 L30 50 L19 54 Z M19 60 L30 59 L21 65 Z M34 28 L38 38 L40 27 Z" fill="#2A1C14"/><path d="M18 54 Q26 66 40 70 L50 86 Q30 84 20 68 Z" fill="#FFF6EA"/>`)
    + `<path d="M50 24 L46 34 L50 32 L54 34 Z M50 36 L47 42 L53 42 Z" fill="#2A1C14"/>`
    + `<ellipse cx="50" cy="71" rx="13" ry="11" fill="#FFF6EA"/>`
    + S(oeil(39, 50, "#2A1C14")) + `<path d="M45 63 Q50 60 55 63 L50 68 Z" fill="#E36A6A"/><path d="M50 68 L50 72 M45 74 Q50 77 55 74" stroke="#2A1C14" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  dragon: { nom: "Dragon", fond: ["#7BE0B0", "#167A55"], dessin:
    S(`<path d="M30 30 Q20 18 22 4 Q30 16 38 24 Z" fill="#F2E3B3"/><path d="M18 46 L6 40 L14 54 Z M20 58 L8 60 L20 66 Z" fill="#1E8C62"/>`)
    + `<path d="M20 44 Q20 22 50 22 Q80 22 80 44 L76 64 Q70 86 50 88 Q30 86 24 64 Z" fill="#27A673"/>`
    + `<path d="M34 64 Q50 58 66 64 Q66 82 50 86 Q34 82 34 64 Z" fill="#9BE7BF"/>`
    + S(`<path d="M28 44 L44 46 L40 54 Q32 54 28 44 Z" fill="#FCE36A"/><ellipse cx="38" cy="49" rx="1.6" ry="3.6" fill="#1B1D24"/><path d="M26 40 L44 42" stroke="#145C41" stroke-width="3" stroke-linecap="round"/><ellipse cx="44" cy="70" rx="2.2" ry="3" fill="#145C41"/>`)
    + `<path d="M50 26 L46 34 L54 34 Z" fill="#F2E3B3"/>` },
};

// Médaillon d'un animal ; anneau = couleur du niveau (si fourni)
export function medaillon(id, { taille = 72, anneau = null, titre = "" } = {}) {
  const a = ANIMAUX[id] || ANIMAUX.renard, k = `g${++N}`;
  return `<svg viewBox="0 0 100 100" width="${taille}" height="${taille}" role="img" aria-label="${esc(titre || a.nom)}" style="display:block;flex:none"><defs><radialGradient id="${k}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${a.fond[0]}"/><stop offset="1" stop-color="${a.fond[1]}"/></radialGradient><clipPath id="c${k}"><circle cx="50" cy="50" r="${anneau ? 44 : 48}"/></clipPath></defs>${anneau ? `<circle cx="50" cy="50" r="49" fill="${anneau}"/><circle cx="50" cy="50" r="45.5" fill="#fff" opacity=".9"/>` : ""}<circle cx="50" cy="50" r="${anneau ? 44 : 48}" fill="url(#${k})"/><g clip-path="url(#c${k})"><g transform="translate(50 50) scale(.86) translate(-50 -48)">${a.dessin}</g></g></svg>`;
}
// Animal verrouillé : silhouette grise
export function silhouette(id, taille = 64) {
  const a = ANIMAUX[id] || ANIMAUX.renard;
  return `<svg viewBox="0 0 100 100" width="${taille}" height="${taille}" aria-hidden="true" style="display:block;flex:none"><circle cx="50" cy="50" r="48" fill="var(--line, #DDE1E8)"/><g transform="translate(50 50) scale(.86) translate(-50 -48)" style="filter:brightness(0)" opacity=".22">${a.dessin}</g></svg>`;
}

// ---------- Médailles ----------
// 5 niveaux : bronze, argent, or, platine, diamant (gemme)
export const NIVEAUX = [
  { id: "bronze", nom: "Bronze", c: ["#E9A46A", "#A0582A"] }, { id: "argent", nom: "Argent", c: ["#F1F4F8", "#9AA6B6"] },
  { id: "or", nom: "Or", c: ["#FFE27A", "#D29A12"] }, { id: "platine", nom: "Platine", c: ["#D9F3F2", "#5FA9B0"] },
  { id: "diamant", nom: "Diamant", c: ["#C9E6FF", "#4C7BF2"] },
];
// Pictogrammes des catégories (blanc, centrés dans 100 × 100)
export const PICTOS = {
  force: `<rect x="22" y="47" width="56" height="6" rx="3"/><rect x="26" y="36" width="8" height="28" rx="2.5"/><rect x="66" y="36" width="8" height="28" rx="2.5"/><rect x="17" y="41" width="7" height="18" rx="2"/><rect x="76" y="41" width="7" height="18" rx="2"/>`,
  relatif: `<rect x="22" y="57" width="56" height="5" rx="2.5"/><rect x="27" y="49" width="7" height="21" rx="2"/><rect x="66" y="49" width="7" height="21" rx="2"/><path d="M50 24 L58 38 H42 Z"/><rect x="47" y="36" width="6" height="14" rx="2"/>`,
  regularite: `<path d="M50 20 C56 32 68 38 66 54 C65 66 57 74 50 74 C40 74 33 66 34 55 C35 46 41 42 42 34 C47 40 48 44 50 46 C52 38 52 30 50 20 Z"/>`,
  course: `<path d="M24 64 Q24 56 32 55 L44 54 L50 42 L58 44 L58 54 Q70 56 76 62 L76 68 L24 68 Z"/><rect x="22" y="70" width="56" height="5" rx="2.5"/>`,
  calisthenie: `<rect x="20" y="22" width="60" height="6" rx="3"/><path d="M36 28 L36 42 Q36 48 42 50 L42 66 L48 66 L48 52 L52 52 L52 66 L58 66 L58 50 Q64 48 64 42 L64 28 L58 28 L58 42 L42 42 L42 28 Z"/><circle cx="50" cy="36" r="5"/>`,
  skill: `<path d="M50 18 L58 40 L82 40 L62 54 L70 78 L50 63 L30 78 L38 54 L18 40 L42 40 Z"/>`,
  nutrition: `<path d="M50 20 C64 20 74 42 74 56 C74 70 63 78 50 78 C37 78 26 70 26 56 C26 42 36 20 50 20 Z"/>`,
  esprit: `<path d="M50 74 C34 62 22 52 22 40 C22 30 30 24 38 24 C44 24 48 28 50 32 C52 28 56 24 62 24 C70 24 78 30 78 40 C78 52 66 62 50 74 Z"/>`,
};
// Médaille : ruban + disque ; « diamant » prend la forme d'une gemme
export function medaille(cat, niveau, { taille = 56, verrouille = false, titre = "" } = {}) {
  const n = NIVEAUX.find(x => x.id === niveau) || NIVEAUX[0], k = `m${++N}`;
  const c = verrouille ? ["#E6E9EF", "#B9C0CC"] : n.c, picto = PICTOS[cat] || PICTOS.skill;
  const corps = niveau === "diamant"
    ? `<path d="M50 14 L84 40 L50 92 L16 40 Z" fill="url(#${k})"/><path d="M16 40 L84 40 L50 92 Z" fill="#000" opacity=".12"/><path d="M50 14 L36 40 L50 92 L64 40 Z" fill="#fff" opacity=".18"/>`
    : `<path d="M30 4 L44 4 L54 30 L40 30 Z" fill="${verrouille ? "#C3C8D2" : "#E0312B"}"/><path d="M70 4 L56 4 L46 30 L60 30 Z" fill="${verrouille ? "#AEB4C0" : "#1F4FB5"}"/><circle cx="50" cy="58" r="34" fill="url(#${k})"/><circle cx="50" cy="58" r="27" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>`;
  const py = niveau === "diamant" ? -4 : 9, ps = niveau === "diamant" ? 0.5 : 0.66;
  return `<svg viewBox="0 0 100 100" width="${taille}" height="${taille}" role="img" aria-label="${esc(titre || n.nom)}" style="display:block;flex:none"><defs><linearGradient id="${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>${corps}<g fill="#fff" opacity="${verrouille ? 0.7 : 0.95}" transform="translate(50 ${50 + py}) scale(${ps}) translate(-50 -48)">${verrouille ? `<rect x="34" y="46" width="32" height="26" rx="4"/><path d="M40 46 V38 Q40 28 50 28 Q60 28 60 38 V46" fill="none" stroke="#fff" stroke-width="6"/>` : picto}</g></svg>`;
}
