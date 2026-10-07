import { GOAL, displayStamps } from "@/lib/loyalty";

// Visual stamp grid: filled (☕) up to the current count, empty after.
// A full card is shown while a free coffee is waiting to be redeemed.
export default function Stamps({ points, goal = GOAL }: { points: number; goal?: number }) {
  const filled = displayStamps(points, goal);
  return (
    <div className="stamps-grid">
      {Array.from({ length: goal }).map((_, i) => (
        <div key={i} className={`stamp ${i < filled ? "full" : ""}`}>
          {i < filled ? "☕" : ""}
        </div>
      ))}
    </div>
  );
}
