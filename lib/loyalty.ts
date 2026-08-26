export const GOAL = 10; // seuil par défaut (surchargé par settings.goal)

// Tampons du cycle en cours (0..goal-1).
export function cycle(points: number, goal: number = GOAL): number {
  return ((points % goal) + goal) % goal;
}

// Pizzas offertes disponibles (cumul).
export function rewardsAvailable(points: number, goal: number = GOAL): number {
  return Math.floor(Math.max(0, points) / goal);
}

// Rangée de tampons (texte) pour le cycle en cours.
export function stamps(points: number, goal: number = GOAL): string {
  const c = cycle(points, goal);
  return "●".repeat(c) + "○".repeat(goal - c);
}

// Pizzas restantes avant la prochaine récompense.
export function remaining(points: number, goal: number = GOAL): number {
  return goal - cycle(points, goal);
}
