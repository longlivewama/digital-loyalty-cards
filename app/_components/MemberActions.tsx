"use client";

import { useState } from "react";
import Stamps from "@/app/_components/Stamps";

// Score + actions de la fiche client, en MISE À JOUR INSTANTANÉE (optimiste).
// Le commerçant tape, le compteur bouge tout de suite, la requête part en fond.
// Pas de rechargement de page ; en cas d'échec on annule.
function loyalty(points: number, goal: number) {
  const cycle = ((points % goal) + goal) % goal;
  const rewards = Math.floor(Math.max(0, points) / goal);
  return { cycle, rewards, ready: rewards > 0, reste: goal - cycle };
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
  const [points, setPoints] = useState(initialPoints);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const { cycle, rewards, ready, reste } = loyalty(points, goal);
  const clamp = (v: number) => Math.min(100, Math.max(1, v));

  // Envoie l'opération : applique le résultat tout de suite, recale sur le serveur.
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
      if (res.ok && typeof data?.points === "number") setPoints(data.points);
      else setPoints(prev); // échec → on annule
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
            {cycle}<span style={{ fontSize: 26, color: "var(--s-ink-dim)" }}>/{goal}</span>
          </div>
        </div>
        <Stamps points={points} goal={goal} />
        {ready
          ? <div className="note ok" style={{ textAlign: "center" }}>🎉 {rewards} pizza{rewards > 1 ? "s" : ""} offerte{rewards > 1 ? "s" : ""} à donner</div>
          : <p className="page-sub" style={{ textAlign: "center" }}>Plus que {reste} pizza{reste > 1 ? "s" : ""} avant la récompense</p>}
      </div>

      <div className="panel">
        <div className="qty-adder">
          <div className="qty-stepper">
            <button type="button" className="qty-btn" onClick={() => setQty((v) => clamp(v - 1))} aria-label="Moins une pizza">−</button>
            <input
              type="number" min={1} max={100} value={qty}
              onChange={(e) => setQty(clamp(parseInt(e.target.value, 10) || 1))}
              className="qty-input" aria-label="Nombre de pizzas achetées"
            />
            <button type="button" className="qty-btn" onClick={() => setQty((v) => clamp(v + 1))} aria-label="Plus une pizza">+</button>
          </div>
          <button
            type="button" className="s-btn-full qty-submit" disabled={busy}
            onClick={() => send({ op: "add", n: String(qty) }, points + qty)}
          >
            {qty} pizza{qty > 1 ? "s" : ""} achetée{qty > 1 ? "s" : ""} 🍕
          </button>
        </div>

        {ready && (
          <button
            type="button" className="s-btn-full s-green" style={{ marginTop: 10 }} disabled={busy}
            onClick={() => send({ op: "claim" }, points - goal)}
          >
            Pizza donnée 🎉
          </button>
        )}

        <button
          type="button" className="s-btn-full s-ghost" style={{ marginTop: 10 }} disabled={busy}
          onClick={() => send({ op: "remove" }, Math.max(0, points - 1))}
        >
          −1 · corriger une erreur
        </button>
      </div>
    </>
  );
}
