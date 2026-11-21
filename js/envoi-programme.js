// Application d'un programme envoyé par le coach (module pur, testé par tests/envoi-programme.test.mjs).
// Programme posé par le coach. « ajustement » : même programme, on garde tout (semaine, séance suivante, cycle, début).
// « nouveau » : repart en semaine 1. Ancien envoi sans mode : la position est gardée si le membre suivait déjà le programme du coach.
export function planApresEnvoi(plan, prog, auj) {
  const suit = plan && plan.programId === "coach-plan", mode = prog.envoi?.mode;
  const garde = mode === "ajustement" ? suit : mode === "nouveau" ? false : suit;
  if (!garde) return { programId: "coach-plan", startedAt: auj, week: 1, idx: 0, cycle: 1 };
  return { ...plan, programId: "coach-plan", startedAt: plan.startedAt || auj, week: plan.week || 1, idx: Math.min(plan.idx || 0, prog.s.length - 1), cycle: plan.cycle || 1 };
}
