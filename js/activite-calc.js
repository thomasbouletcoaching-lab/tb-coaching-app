// Calories d'une activité : estimation par MET, ou chiffre exact du tapis ou de la montre ; MET du tapis selon la pente et la vitesse.
// Pur (sans DOM ni état) : testé par tests/activite-calc.test.mjs.

// Équations de l'ACSM (American College of Sports Medicine) pour le tapis, vitesse en km/h, pente en %.
// Marche (jusqu'à 7,5 km/h) : VO2 = 0,1 × v + 1,8 × v × pente + 3,5 ; course : VO2 = 0,2 × v + 0,9 × v × pente + 3,5 (v en m/min). 1 MET = 3,5 ml/kg/min.
export function treadmillMet(kmh, inclPct = 0) {
  const v = (+kmh || 0) * 1000 / 60, g = Math.max(0, +inclPct || 0) / 100;
  if (!(v > 0)) return null;
  const vo2 = kmh <= 7.5 ? 0.1 * v + 1.8 * v * g + 3.5 : 0.2 * v + 0.9 * v * g + 3.5;
  return Math.round(vo2 / 3.5 * 10) / 10;
}

// Calories nettes d'une activité (au-delà du repos, déjà compté dans le métabolisme de base).
// c.kcal : chiffre lu sur la machine ou la montre ; c.kt = "total" (tapis, la plupart des machines : repos compris) ou "actives" (montre : repos déjà retiré).
export function netKcal(c, w) {
  const min = +c.min || 0, rest = (+w || 0) * min / 60; // 1 MET ≈ 1 kcal par kg et par heure
  if (+c.kcal > 0) return Math.max(0, c.kt === "actives" ? +c.kcal : +c.kcal - rest);
  return Math.max(0, (+c.met || 0) - 1) * (+w || 0) * (min / 60);
}
