import { GOAL, cycle } from "@/lib/loyalty";

// Grille de tampons visuels : pleins (🍕) jusqu'au cycle courant, vides ensuite.
export default function Stamps({ points, goal = GOAL }: { points: number; goal?: number }) {
  const filled = cycle(points, goal);
  return (
    <div className="stamps-grid">
      {Array.from({ length: goal }).map((_, i) => (
        <div key={i} className={`stamp ${i < filled ? "full" : ""}`}>
          {i < filled ? "🍕" : ""}
        </div>
      ))}
    </div>
  );
}
