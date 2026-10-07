// Buy 9 coffees, the 10th is free: 9 stamps = 1 free coffee.
export const GOAL = 9; // default goal (overridden by settings.goal)

// Stamps in the current cycle (0..goal-1).
export function cycle(points: number, goal: number = GOAL): number {
  return ((points % goal) + goal) % goal;
}

// Free coffees available (cumulative).
export function rewardsAvailable(points: number, goal: number = GOAL): number {
  return Math.floor(Math.max(0, points) / goal);
}

// Stamps to show on a card: a full card while a reward is waiting to be
// redeemed (9/9 rather than 0/9), otherwise the current cycle.
export function displayStamps(points: number, goal: number = GOAL): number {
  return rewardsAvailable(points, goal) > 0 ? goal : cycle(points, goal);
}

// Text row of stamps for the current cycle.
export function stamps(points: number, goal: number = GOAL): string {
  const c = cycle(points, goal);
  return "●".repeat(c) + "○".repeat(goal - c);
}

// Coffees left before the next reward.
export function remaining(points: number, goal: number = GOAL): number {
  return goal - cycle(points, goal);
}
