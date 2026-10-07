"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stamps from "@/app/_components/Stamps";

// Stamp count + actions on the member page, with INSTANT (optimistic) updates.
// Staff taps, the counter moves immediately, the request runs in the background.
// No page reload; rolled back on failure. The database answer is authoritative.
function loyalty(points: number, goal: number) {
  const cycle = ((points % goal) + goal) % goal;
  const rewards = Math.floor(Math.max(0, points) / goal);
  const ready = rewards > 0;
  // Full card (9/9) while a free coffee is waiting, like both wallet cards.
  return { shown: ready ? goal : cycle, rewards, ready, reste: goal - cycle };
}

export default function MemberActions({
  id,
  goal,
  initialPoints,
}: {
  id: string;
  goal: number;
  initialPoints: number;
}) {
  const router = useRouter();
  const [points, setPoints] = useState(initialPoints);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(false);
  const { shown, rewards, ready, reste } = loyalty(points, goal);
  const clamp = (v: number) => Math.min(100, Math.max(1, v));

  // Sends the operation: applies the result at once, then aligns with the server.
  async function send(body: Record<string, string>, optimistic: number) {
    if (busy) return;
    const prev = points;
    setPoints(optimistic);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/member/${id}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.points === "number") {
        setPoints(data.points);
        // Refresh the server-rendered parts (total coffees, history).
        router.refresh();
      } else setPoints(prev); // failure → roll back
    } catch {
      setPoints(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <div style={{ textAlign: "center", margin: "4px 0" }}>
          <div style={{ fontFamily: "var(--font-display), serif", fontSize: 56, fontWeight: 800, color: ready ? "var(--s-green)" : "var(--s-red)", lineHeight: 1 }}>
            {shown}<span style={{ fontSize: 26, color: "var(--s-ink-dim)" }}>/{goal}</span>
          </div>
        </div>
        <Stamps points={points} goal={goal} />
        {ready
          ? <div className="note ok" style={{ textAlign: "center" }}>🎉 Reward available · {rewards} free coffee{rewards > 1 ? "s" : ""} to give</div>
          : <p className="page-sub" style={{ textAlign: "center" }}>{reste} more coffee{reste > 1 ? "s" : ""} until a free coffee</p>}
      </div>

      <div className="panel">
        <div className="qty-adder">
          <div className="qty-stepper">
            <button type="button" className="qty-btn" onClick={() => setQty((v) => clamp(v - 1))} aria-label="One less coffee">−</button>
            <input
              type="number" min={1} max={100} value={qty}
              onChange={(e) => setQty(clamp(parseInt(e.target.value, 10) || 1))}
              className="qty-input" aria-label="Number of coffees bought"
            />
            <button type="button" className="qty-btn" onClick={() => setQty((v) => clamp(v + 1))} aria-label="One more coffee">+</button>
          </div>
          <button
            type="button" className="s-btn-full qty-submit" disabled={busy}
            onClick={() => send({ op: "add", n: String(qty) }, points + qty)}
          >
            +{qty} stamp{qty > 1 ? "s" : ""} · {qty} coffee{qty > 1 ? "s" : ""} bought ☕
          </button>
        </div>

        {ready && (
          <button
            type="button" className="s-btn-full s-green" style={{ marginTop: 10 }} disabled={busy}
            onClick={() => send({ op: "claim" }, points - goal)}
          >
            Redeem free coffee 🎉
          </button>
        )}

        <button
          type="button" className="s-btn-full s-ghost" style={{ marginTop: 10 }} disabled={busy}
          onClick={() => send({ op: "remove" }, Math.max(0, points - 1))}
        >
          −1 stamp · fix a mistake
        </button>

        <button
          type="button" className="s-btn-full s-ghost" style={{ marginTop: 10 }} disabled={busy}
          onClick={async () => {
            setSynced(false);
            const res = await fetch(`/api/admin/member/${id}`, {
              method: "POST",
              headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
              body: "op=sync",
            }).catch(() => null);
            setSynced(!!res?.ok);
          }}
        >
          {synced ? "Wallet cards refreshed ✓" : "Refresh wallet cards"}
        </button>
      </div>
    </>
  );
}
